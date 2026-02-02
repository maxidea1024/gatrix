/**
 * MaintenanceWatcher
 * Tracks maintenance state changes and emits local events
 *
 * This watcher monitors both service-level and world-level maintenance
 * and emits maintenance.started / maintenance.ended / maintenance.updated events
 *
 * Smart scheduling:
 * - Immediate start (no startDate) + no endDate: emit events on settings change only
 * - Future startDate or endDate set: schedule timers to check at those times
 */

import { Logger } from "../utils/logger";
import { MaintenanceStatus, GameWorld } from "../types/api";

export interface MaintenanceStateSnapshot {
  // Service-level maintenance state
  serviceInMaintenance: boolean;
  // Actual time when service maintenance started (for grace period calculation)
  serviceActualStartTime?: string;
  // Service-level maintenance details for update detection
  serviceDetails?: {
    startsAt?: string;
    endsAt?: string;
    message?: string;
    kickExistingPlayers?: boolean;
    kickDelayMinutes?: number;
  };
  // World-level maintenance states (worldId -> inMaintenance)
  worldMaintenanceStates: Map<string, boolean>;
  // Actual start times for world maintenance (worldId -> actualStartTime)
  worldActualStartTimes: Map<string, string>;
  // World-level maintenance details for update detection (worldId -> details)
  worldDetails: Map<
    string,
    {
      startDate?: string;
      endDate?: string;
      message?: string;
      forceDisconnect?: boolean;
      gracePeriodMinutes?: number;
    }
  >;
}

export interface MaintenanceEventData {
  /** Source of maintenance: 'service' for global, 'world' for world-level */
  source: "service" | "world";
  /** World ID (only present when source is 'world') */
  worldId?: string;
  /** Whether maintenance is starting (true) or ending (false) - not present for updated */
  isStarting?: boolean;
  /** Timestamp of the event */
  timestamp: string;
  /**
   * Actual time when maintenance started (ISO 8601 format)
   * Used by clients to calculate remaining grace period:
   * remainingGrace = gracePeriodMinutes - (now - actualStartTime)
   */
  actualStartTime?: string;
  /** Details about the maintenance (for updated events) */
  details?: {
    startsAt?: string;
    endsAt?: string;
    message?: string;
    forceDisconnect?: boolean;
    gracePeriodMinutes?: number;
  };
}

// Local events are prefixed with 'local.' to distinguish from backend events
// grace_period_expired: Emitted when grace period has passed and players should be kicked
export type MaintenanceEventType =
  | "local.maintenance.started"
  | "local.maintenance.ended"
  | "local.maintenance.updated"
  | "local.maintenance.grace_period_expired";

export type MaintenanceEventCallback = (
  eventType: MaintenanceEventType,
  data: MaintenanceEventData,
) => void | Promise<void>;

export class MaintenanceWatcher {
  private logger: Logger;
  private previousState: MaintenanceStateSnapshot | null = null;
  private callbacks: MaintenanceEventCallback[] = [];
  private configWorldId?: string;
  private scheduledTimers: Map<string, NodeJS.Timeout> = new Map();
  // Track scheduled target times to avoid redundant re-scheduling
  private scheduledTargetTimes: Map<string, number> = new Map();
  // Track grace period kick timers separately
  private gracePeriodTimers: Map<string, NodeJS.Timeout> = new Map();

  // Store references for scheduled checks
  private lastServiceStatus: MaintenanceStatus | null = null;
  private lastGameWorlds: GameWorld[] = [];

  constructor(logger: Logger, configWorldId?: string) {
    this.logger = logger;
    this.configWorldId = configWorldId;
  }

  /**
   * Register callback for maintenance events
   * Returns a function to unregister the callback
   */
  onMaintenanceChange(callback: MaintenanceEventCallback): () => void {
    this.callbacks.push(callback);
    return () => {
      this.callbacks = this.callbacks.filter((cb) => cb !== callback);
    };
  }

  /**
   * Emit event to all registered callbacks
   */
  private emitEvent(
    eventType: MaintenanceEventType,
    data: MaintenanceEventData,
  ): void {
    for (const callback of this.callbacks) {
      try {
        callback(eventType, data);
      } catch (error: any) {
        this.logger.error("Error in maintenance event callback", {
          error: error.message,
        });
      }
    }
  }

  /**
   * Schedule a timer to check maintenance state at a specific time
   * Optimized to skip re-scheduling if the same target time is already scheduled
   */
  private scheduleCheck(key: string, targetTime: Date): void {
    const targetTimeMs = targetTime.getTime();
    const existingTimer = this.scheduledTimers.get(key);
    const existingTargetTime = this.scheduledTargetTimes.get(key);

    // Skip if the same target time is already scheduled
    if (existingTimer && existingTargetTime === targetTimeMs) {
      return;
    }

    // Clear existing timer for this key if target time is different
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.scheduledTimers.delete(key);
      this.scheduledTargetTimes.delete(key);
    }

    const now = Date.now();
    const delay = targetTimeMs - now;

    // Only schedule if in the future (with 100ms buffer)
    if (delay > 100) {
      this.logger.debug(`Scheduling maintenance check for ${key}`, {
        targetTime: targetTime.toISOString(),
        delayMs: delay,
      });

      const timer = setTimeout(() => {
        this.scheduledTimers.delete(key);
        this.scheduledTargetTimes.delete(key);
        this.logger.debug(`Executing scheduled maintenance check for ${key}`);
        // Re-check with stored data
        this.checkAndEmitChanges(this.lastServiceStatus, this.lastGameWorlds);
      }, delay);

      this.scheduledTimers.set(key, timer);
      this.scheduledTargetTimes.set(key, targetTimeMs);
    }
  }

  /**
   * Clear all scheduled timers
   */
  private clearAllTimers(): void {
    for (const timer of this.scheduledTimers.values()) {
      clearTimeout(timer);
    }
    this.scheduledTimers.clear();
    this.scheduledTargetTimes.clear();
    // Also clear grace period timers
    for (const timer of this.gracePeriodTimers.values()) {
      clearTimeout(timer);
    }
    this.gracePeriodTimers.clear();
  }

  /**
   * Schedule grace period expiry timer for service maintenance
   * When grace period expires, emit grace_period_expired event
   */
  private scheduleServiceGracePeriodTimer(
    actualStartTime: string,
    gracePeriodMinutes: number,
  ): void {
    const key = "service-grace-period";

    // Clear existing timer if any
    const existingTimer = this.gracePeriodTimers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.gracePeriodTimers.delete(key);
    }

    if (!gracePeriodMinutes || gracePeriodMinutes <= 0) {
      // Emit immediately if no grace period
      this.logger.info(
        "Service maintenance started with no grace period, emitting grace_period_expired immediately",
      );
      setImmediate(() => {
        this.emitEvent("local.maintenance.grace_period_expired", {
          source: "service",
          timestamp: new Date().toISOString(),
          actualStartTime,
          details: this.previousState?.serviceDetails,
        });
      });
      return;
    }

    const startTime = new Date(actualStartTime).getTime();
    const expiryTime = startTime + gracePeriodMinutes * 60 * 1000;
    const delay = expiryTime - Date.now();

    if (delay <= 0) {
      // Grace period already expired, emit immediately
      this.logger.info(
        "Service maintenance grace period already expired, emitting immediately",
      );
      setImmediate(() => {
        this.emitEvent("local.maintenance.grace_period_expired", {
          source: "service",
          timestamp: new Date().toISOString(),
          actualStartTime,
          details: this.previousState?.serviceDetails,
        });
      });
      return;
    }

    this.logger.info(`Scheduling service grace period expiry timer`, {
      actualStartTime,
      gracePeriodMinutes,
      expiryTime: new Date(expiryTime).toISOString(),
      delayMs: delay,
    });

    const timer = setTimeout(() => {
      this.gracePeriodTimers.delete(key);
      this.logger.info("Service maintenance grace period expired");
      this.emitEvent("local.maintenance.grace_period_expired", {
        source: "service",
        timestamp: new Date().toISOString(),
        actualStartTime,
        details: this.previousState?.serviceDetails,
      });
    }, delay);

    this.gracePeriodTimers.set(key, timer);
  }

  /**
   * Schedule grace period expiry timer for world maintenance
   */
  private scheduleWorldGracePeriodTimer(
    worldId: string,
    actualStartTime: string,
    gracePeriodMinutes: number,
  ): void {
    const key = `world-${worldId}-grace-period`;

    // Clear existing timer if any
    const existingTimer = this.gracePeriodTimers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.gracePeriodTimers.delete(key);
    }

    const worldDetails = this.previousState?.worldDetails.get(worldId);

    if (!gracePeriodMinutes || gracePeriodMinutes <= 0) {
      // Emit immediately if no grace period
      this.logger.info(
        "World maintenance started with no grace period, emitting grace_period_expired immediately",
        { worldId },
      );
      setImmediate(() => {
        this.emitEvent("local.maintenance.grace_period_expired", {
          source: "world",
          worldId,
          timestamp: new Date().toISOString(),
          actualStartTime,
          details: worldDetails,
        });
      });
      return;
    }

    const startTime = new Date(actualStartTime).getTime();
    const expiryTime = startTime + gracePeriodMinutes * 60 * 1000;
    const delay = expiryTime - Date.now();

    if (delay <= 0) {
      // Grace period already expired, emit immediately
      this.logger.info(
        "World maintenance grace period already expired, emitting immediately",
        { worldId },
      );
      setImmediate(() => {
        this.emitEvent("local.maintenance.grace_period_expired", {
          source: "world",
          worldId,
          timestamp: new Date().toISOString(),
          actualStartTime,
          details: worldDetails,
        });
      });
      return;
    }

    this.logger.info(`Scheduling world grace period expiry timer`, {
      worldId,
      actualStartTime,
      gracePeriodMinutes,
      expiryTime: new Date(expiryTime).toISOString(),
      delayMs: delay,
    });

    const timer = setTimeout(() => {
      this.gracePeriodTimers.delete(key);
      this.logger.info("World maintenance grace period expired", { worldId });
      this.emitEvent("local.maintenance.grace_period_expired", {
        source: "world",
        worldId,
        timestamp: new Date().toISOString(),
        actualStartTime,
        details: worldDetails,
      });
    }, delay);

    this.gracePeriodTimers.set(key, timer);
  }

  /**
   * Cancel grace period timer for service maintenance
   */
  private cancelServiceGracePeriodTimer(): void {
    const key = "service-grace-period";
    const timer = this.gracePeriodTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.gracePeriodTimers.delete(key);
      this.logger.debug("Cancelled service grace period timer");
    }
  }

  /**
   * Cancel grace period timer for world maintenance
   */
  private cancelWorldGracePeriodTimer(worldId: string): void {
    const key = `world-${worldId}-grace-period`;
    const timer = this.gracePeriodTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.gracePeriodTimers.delete(key);
      this.logger.debug("Cancelled world grace period timer", { worldId });
    }
  }

  /**
   * Schedule timers for service maintenance start/end times
   */
  private scheduleServiceTimers(status: MaintenanceStatus | null): void {
    if (!status?.hasMaintenanceScheduled || !status.detail) return;

    const { startsAt, endsAt } = status.detail;

    if (startsAt) {
      const startDate = new Date(startsAt);
      if (startDate.getTime() > Date.now()) {
        this.scheduleCheck("service-start", startDate);
      }
    }

    if (endsAt) {
      const endDate = new Date(endsAt);
      if (endDate.getTime() > Date.now()) {
        this.scheduleCheck("service-end", endDate);
      }
    }
  }

  /**
   * Schedule timers for world maintenance start/end times
   */
  private scheduleWorldTimers(worlds: GameWorld[]): void {
    for (const world of worlds) {
      if (!world.worldId || !world.isMaintenance) continue;

      if (world.maintenanceStartDate) {
        const startDate = new Date(world.maintenanceStartDate);
        if (startDate.getTime() > Date.now()) {
          this.scheduleCheck(`world-${world.worldId}-start`, startDate);
        }
      }

      if (world.maintenanceEndDate) {
        const endDate = new Date(world.maintenanceEndDate);
        if (endDate.getTime() > Date.now()) {
          this.scheduleCheck(`world-${world.worldId}-end`, endDate);
        }
      }
    }
  }

  /**
   * Check if a world is currently in maintenance
   */
  private isWorldMaintenanceActive(world: GameWorld): boolean {
    if (!world.isMaintenance) {
      return false;
    }

    const now = new Date();

    // Check start date
    if (world.maintenanceStartDate) {
      const startDate = new Date(world.maintenanceStartDate);
      if (now < startDate) {
        return false; // Not started yet
      }
    }

    // Check end date
    if (world.maintenanceEndDate) {
      const endDate = new Date(world.maintenanceEndDate);
      if (now > endDate) {
        return false; // Already ended
      }
    }

    return true;
  }

  /**
   * Create current state snapshot from cache data
   */
  createStateSnapshot(
    serviceMaintenanceStatus: MaintenanceStatus | null,
    gameWorlds: GameWorld[],
  ): MaintenanceStateSnapshot {
    // Check service-level maintenance
    let serviceInMaintenance = false;
    let serviceActualStartTime: string | undefined;
    let serviceDetails: MaintenanceStateSnapshot["serviceDetails"];

    if (serviceMaintenanceStatus?.hasMaintenanceScheduled) {
      const now = new Date();
      const detail = serviceMaintenanceStatus.detail;
      const startDate = detail?.startsAt ? new Date(detail.startsAt) : null;
      const endDate = detail?.endsAt ? new Date(detail.endsAt) : null;

      serviceInMaintenance = true;
      if (startDate && now < startDate) {
        serviceInMaintenance = false;
      }
      if (endDate && now > endDate) {
        serviceInMaintenance = false;
      }

      // Calculate actual start time for grace period calculation
      // If startsAt is in the past or not set, maintenance has already started
      if (serviceInMaintenance) {
        if (startDate && now >= startDate) {
          // Scheduled maintenance that has started - use scheduled start time
          serviceActualStartTime = startDate.toISOString();
        } else if (!startDate) {
          // Immediate maintenance - use current time as start
          // Note: This will be recalculated each time, so we preserve from previous state if available
          serviceActualStartTime =
            this.previousState?.serviceActualStartTime || now.toISOString();
        }
      }

      // Store details for update detection
      serviceDetails = {
        startsAt: detail?.startsAt ?? undefined,
        endsAt: detail?.endsAt ?? undefined,
        message:
          detail?.message ||
          detail?.localeMessages?.en ||
          detail?.localeMessages?.ko,
        kickExistingPlayers: detail?.kickExistingPlayers,
        kickDelayMinutes: detail?.kickDelayMinutes,
      };
    }

    // Check world-level maintenance states and details
    const worldMaintenanceStates = new Map<string, boolean>();
    const worldActualStartTimes = new Map<string, string>();
    const worldDetails = new Map<
      string,
      MaintenanceStateSnapshot["worldDetails"] extends Map<string, infer V>
        ? V
        : never
    >();

    for (const world of gameWorlds) {
      if (world.worldId) {
        const isMaintenanceActive = this.isWorldMaintenanceActive(world);
        worldMaintenanceStates.set(world.worldId, isMaintenanceActive);

        // Calculate actual start time for world maintenance
        if (isMaintenanceActive) {
          const now = new Date();
          const startDate = world.maintenanceStartDate
            ? new Date(world.maintenanceStartDate)
            : null;

          if (startDate && now >= startDate) {
            worldActualStartTimes.set(world.worldId, startDate.toISOString());
          } else if (!startDate) {
            // Immediate maintenance - preserve from previous state or use current time
            const previousStartTime =
              this.previousState?.worldActualStartTimes.get(world.worldId);
            worldActualStartTimes.set(
              world.worldId,
              previousStartTime || now.toISOString(),
            );
          }
        }

        worldDetails.set(world.worldId, {
          startDate: world.maintenanceStartDate,
          endDate: world.maintenanceEndDate,
          message: world.maintenanceMessage,
          forceDisconnect: world.forceDisconnect,
          gracePeriodMinutes: world.gracePeriodMinutes,
        });
      }
    }

    return {
      serviceInMaintenance,
      serviceActualStartTime,
      serviceDetails,
      worldMaintenanceStates,
      worldActualStartTimes,
      worldDetails,
    };
  }

  /**
   * Check for state changes and emit events
   * Called when cache is refreshed or by scheduled timers
   */
  checkAndEmitChanges(
    serviceMaintenanceStatus: MaintenanceStatus | null,
    gameWorlds: GameWorld[],
  ): void {
    // Store for scheduled timer checks
    this.lastServiceStatus = serviceMaintenanceStatus;
    this.lastGameWorlds = gameWorlds;

    const currentState = this.createStateSnapshot(
      serviceMaintenanceStatus,
      gameWorlds,
    );

    // Debug log for state comparison
    this.logger.debug("MaintenanceWatcher state check", {
      previousServiceInMaintenance:
        this.previousState?.serviceInMaintenance ?? "null",
      currentServiceInMaintenance: currentState.serviceInMaintenance,
      hasMaintenanceScheduled:
        serviceMaintenanceStatus?.hasMaintenanceScheduled ?? "null",
      isMaintenanceActive:
        serviceMaintenanceStatus?.isMaintenanceActive ?? "null",
      serviceMaintenanceStatusDetail: serviceMaintenanceStatus?.detail
        ? {
            startsAt: serviceMaintenanceStatus.detail.startsAt,
            endsAt: serviceMaintenanceStatus.detail.endsAt,
          }
        : "null",
    });

    // Skip if this is the first check (no previous state)
    if (this.previousState === null) {
      this.previousState = currentState;
      this.logger.debug("MaintenanceWatcher initialized", {
        serviceInMaintenance: currentState.serviceInMaintenance,
        worldsTracked: currentState.worldMaintenanceStates.size,
      });
      // Schedule timers for future start/end times
      this.scheduleServiceTimers(serviceMaintenanceStatus);
      this.scheduleWorldTimers(gameWorlds);
      return;
    }

    const timestamp = new Date().toISOString();

    // Check service-level maintenance change
    if (
      this.previousState.serviceInMaintenance !==
      currentState.serviceInMaintenance
    ) {
      const eventType: MaintenanceEventType = currentState.serviceInMaintenance
        ? "local.maintenance.started"
        : "local.maintenance.ended";

      this.logger.info(
        `Service maintenance ${currentState.serviceInMaintenance ? "started" : "ended"}`,
      );

      this.emitEvent(eventType, {
        source: "service",
        isStarting: currentState.serviceInMaintenance,
        timestamp,
        actualStartTime: currentState.serviceActualStartTime,
        details: currentState.serviceDetails,
      });

      // Schedule or cancel grace period timer based on maintenance state
      // Service-level uses kickExistingPlayers and kickDelayMinutes
      if (
        currentState.serviceInMaintenance &&
        currentState.serviceDetails?.kickExistingPlayers
      ) {
        // Maintenance started with kickExistingPlayers enabled - schedule grace period timer
        const actualStartTime =
          currentState.serviceActualStartTime || timestamp;
        const gracePeriodMinutes =
          currentState.serviceDetails.kickDelayMinutes ?? 0;
        this.scheduleServiceGracePeriodTimer(
          actualStartTime,
          gracePeriodMinutes,
        );
      } else if (!currentState.serviceInMaintenance) {
        // Maintenance ended - cancel grace period timer
        this.cancelServiceGracePeriodTimer();
      }
    } else if (
      currentState.serviceInMaintenance &&
      this.hasServiceDetailsChanged(currentState)
    ) {
      // Service is in maintenance but details changed -> emit updated
      this.logger.info("Service maintenance updated");
      this.emitEvent("local.maintenance.updated", {
        source: "service",
        timestamp,
        actualStartTime: currentState.serviceActualStartTime,
        details: currentState.serviceDetails,
      });

      // Reschedule grace period timer if kick settings changed
      if (currentState.serviceDetails?.kickExistingPlayers) {
        const actualStartTime =
          currentState.serviceActualStartTime || timestamp;
        const gracePeriodMinutes =
          currentState.serviceDetails.kickDelayMinutes ?? 0;
        this.scheduleServiceGracePeriodTimer(
          actualStartTime,
          gracePeriodMinutes,
        );
      } else {
        // kickExistingPlayers disabled - cancel timer
        this.cancelServiceGracePeriodTimer();
      }
    }

    // Check world-level maintenance changes
    // If configWorldId is set, only check that world
    // Otherwise, check all worlds
    const worldsToCheck = this.configWorldId
      ? [this.configWorldId]
      : Array.from(currentState.worldMaintenanceStates.keys());

    for (const worldId of worldsToCheck) {
      const previousWorldState =
        this.previousState.worldMaintenanceStates.get(worldId) ?? false;
      const currentWorldState =
        currentState.worldMaintenanceStates.get(worldId) ?? false;
      const currentWorldDetails = currentState.worldDetails.get(worldId);
      const currentWorldActualStartTime =
        currentState.worldActualStartTimes.get(worldId);

      if (previousWorldState !== currentWorldState) {
        const eventType: MaintenanceEventType = currentWorldState
          ? "local.maintenance.started"
          : "local.maintenance.ended";

        this.logger.info(
          `World maintenance ${currentWorldState ? "started" : "ended"}`,
          { worldId },
        );

        this.emitEvent(eventType, {
          source: "world",
          worldId,
          isStarting: currentWorldState,
          timestamp,
          actualStartTime: currentWorldActualStartTime,
          details: currentWorldDetails,
        });

        // Schedule or cancel grace period timer based on maintenance state
        if (currentWorldState && currentWorldDetails?.forceDisconnect) {
          // Maintenance started with forceDisconnect enabled - schedule grace period timer
          const actualStartTime = currentWorldActualStartTime || timestamp;
          const gracePeriodMinutes =
            currentWorldDetails.gracePeriodMinutes ?? 0;
          this.scheduleWorldGracePeriodTimer(
            worldId,
            actualStartTime,
            gracePeriodMinutes,
          );
        } else if (!currentWorldState) {
          // Maintenance ended - cancel grace period timer
          this.cancelWorldGracePeriodTimer(worldId);
        }
      } else if (
        currentWorldState &&
        this.hasWorldDetailsChanged(worldId, currentState)
      ) {
        // World is in maintenance but details changed -> emit updated
        this.logger.info("World maintenance updated", { worldId });
        this.emitEvent("local.maintenance.updated", {
          source: "world",
          worldId,
          timestamp,
          actualStartTime: currentWorldActualStartTime,
          details: currentWorldDetails,
        });

        // Reschedule grace period timer if kick settings changed
        if (currentWorldDetails?.forceDisconnect) {
          const actualStartTime = currentWorldActualStartTime || timestamp;
          const gracePeriodMinutes =
            currentWorldDetails.gracePeriodMinutes ?? 0;
          this.scheduleWorldGracePeriodTimer(
            worldId,
            actualStartTime,
            gracePeriodMinutes,
          );
        } else {
          // forceDisconnect disabled - cancel timer
          this.cancelWorldGracePeriodTimer(worldId);
        }
      }
    }

    // Update previous state BEFORE scheduling timers
    // This ensures getCurrentState() returns the latest state when event handlers query it
    this.previousState = currentState;

    // Schedule timers for future start/end times
    this.scheduleServiceTimers(serviceMaintenanceStatus);
    this.scheduleWorldTimers(gameWorlds);
  }

  /**
   * Check if service maintenance details have changed
   */
  private hasServiceDetailsChanged(
    currentState: MaintenanceStateSnapshot,
  ): boolean {
    const prev = this.previousState?.serviceDetails;
    const curr = currentState.serviceDetails;

    if (!prev && !curr) return false;
    if (!prev || !curr) return true;

    return (
      prev.startsAt !== curr.startsAt ||
      prev.endsAt !== curr.endsAt ||
      prev.message !== curr.message ||
      prev.kickExistingPlayers !== curr.kickExistingPlayers ||
      prev.kickDelayMinutes !== curr.kickDelayMinutes
    );
  }

  /**
   * Check if world maintenance details have changed
   */
  private hasWorldDetailsChanged(
    worldId: string,
    currentState: MaintenanceStateSnapshot,
  ): boolean {
    const prev = this.previousState?.worldDetails.get(worldId);
    const curr = currentState.worldDetails.get(worldId);

    if (!prev && !curr) return false;
    if (!prev || !curr) return true;

    return (
      prev.startDate !== curr.startDate ||
      prev.endDate !== curr.endDate ||
      prev.message !== curr.message ||
      prev.forceDisconnect !== curr.forceDisconnect ||
      prev.gracePeriodMinutes !== curr.gracePeriodMinutes
    );
  }

  /**
   * Update config worldId (if changed at runtime)
   */
  setConfigWorldId(worldId?: string): void {
    this.configWorldId = worldId;
  }

  /**
   * Get current maintenance state snapshot
   */
  getCurrentState(): MaintenanceStateSnapshot | null {
    return this.previousState;
  }

  /**
   * Reset state (useful for testing)
   */
  reset(): void {
    this.clearAllTimers();
    this.previousState = null;
    this.callbacks = [];
    this.lastServiceStatus = null;
    this.lastGameWorlds = [];
  }

  /**
   * Cleanup (call when SDK is destroyed)
   */
  destroy(): void {
    this.clearAllTimers();
  }
}
