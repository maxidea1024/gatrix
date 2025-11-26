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

import { Logger } from '../utils/logger';
import { MaintenanceStatus, GameWorld } from '../types/api';

export interface MaintenanceStateSnapshot {
  // Service-level maintenance state
  serviceInMaintenance: boolean;
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
  // World-level maintenance details for update detection (worldId -> details)
  worldDetails: Map<string, {
    startDate?: string;
    endDate?: string;
    message?: string;
    forceDisconnect?: boolean;
    gracePeriodMinutes?: number;
  }>;
}

export interface MaintenanceEventData {
  /** Source of maintenance: 'service' for global, 'world' for world-level */
  source: 'service' | 'world';
  /** World ID (only present when source is 'world') */
  worldId?: string;
  /** Whether maintenance is starting (true) or ending (false) - not present for updated */
  isStarting?: boolean;
  /** Timestamp of the event */
  timestamp: string;
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
export type MaintenanceEventType = 'local.maintenance.started' | 'local.maintenance.ended' | 'local.maintenance.updated';

export type MaintenanceEventCallback = (
  eventType: MaintenanceEventType,
  data: MaintenanceEventData
) => void;

export class MaintenanceWatcher {
  private logger: Logger;
  private previousState: MaintenanceStateSnapshot | null = null;
  private callbacks: MaintenanceEventCallback[] = [];
  private configWorldId?: string;
  private scheduledTimers: Map<string, NodeJS.Timeout> = new Map();

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
    data: MaintenanceEventData
  ): void {
    for (const callback of this.callbacks) {
      try {
        callback(eventType, data);
      } catch (error: any) {
        this.logger.error('Error in maintenance event callback', { error: error.message });
      }
    }
  }

  /**
   * Schedule a timer to check maintenance state at a specific time
   */
  private scheduleCheck(key: string, targetTime: Date): void {
    // Clear existing timer for this key
    const existingTimer = this.scheduledTimers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const now = Date.now();
    const delay = targetTime.getTime() - now;

    // Only schedule if in the future (with 100ms buffer)
    if (delay > 100) {
      this.logger.debug(`Scheduling maintenance check for ${key}`, {
        targetTime: targetTime.toISOString(),
        delayMs: delay
      });

      const timer = setTimeout(() => {
        this.scheduledTimers.delete(key);
        this.logger.debug(`Executing scheduled maintenance check for ${key}`);
        // Re-check with stored data
        this.checkAndEmitChanges(this.lastServiceStatus, this.lastGameWorlds);
      }, delay);

      this.scheduledTimers.set(key, timer);
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
  }

  /**
   * Schedule timers for service maintenance start/end times
   */
  private scheduleServiceTimers(status: MaintenanceStatus | null): void {
    if (!status?.isUnderMaintenance || !status.detail) return;

    const { startsAt, endsAt } = status.detail;

    if (startsAt) {
      const startDate = new Date(startsAt);
      if (startDate.getTime() > Date.now()) {
        this.scheduleCheck('service-start', startDate);
      }
    }

    if (endsAt) {
      const endDate = new Date(endsAt);
      if (endDate.getTime() > Date.now()) {
        this.scheduleCheck('service-end', endDate);
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
  private isWorldInMaintenance(world: GameWorld): boolean {
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
    gameWorlds: GameWorld[]
  ): MaintenanceStateSnapshot {
    // Check service-level maintenance
    let serviceInMaintenance = false;
    let serviceDetails: MaintenanceStateSnapshot['serviceDetails'];

    if (serviceMaintenanceStatus?.isUnderMaintenance) {
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

      // Store details for update detection
      serviceDetails = {
        startsAt: detail?.startsAt ?? undefined,
        endsAt: detail?.endsAt ?? undefined,
        message: detail?.message || detail?.localeMessages?.en || detail?.localeMessages?.ko,
        kickExistingPlayers: detail?.kickExistingPlayers,
        kickDelayMinutes: detail?.kickDelayMinutes,
      };
    }

    // Check world-level maintenance states and details
    const worldMaintenanceStates = new Map<string, boolean>();
    const worldDetails = new Map<string, MaintenanceStateSnapshot['worldDetails'] extends Map<string, infer V> ? V : never>();

    for (const world of gameWorlds) {
      if (world.worldId) {
        worldMaintenanceStates.set(world.worldId, this.isWorldInMaintenance(world));
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
      serviceDetails,
      worldMaintenanceStates,
      worldDetails,
    };
  }

  /**
   * Check for state changes and emit events
   * Called when cache is refreshed or by scheduled timers
   */
  checkAndEmitChanges(
    serviceMaintenanceStatus: MaintenanceStatus | null,
    gameWorlds: GameWorld[]
  ): void {
    // Store for scheduled timer checks
    this.lastServiceStatus = serviceMaintenanceStatus;
    this.lastGameWorlds = gameWorlds;

    const currentState = this.createStateSnapshot(serviceMaintenanceStatus, gameWorlds);

    // Skip if this is the first check (no previous state)
    if (this.previousState === null) {
      this.previousState = currentState;
      this.logger.debug('MaintenanceWatcher initialized', {
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
    if (this.previousState.serviceInMaintenance !== currentState.serviceInMaintenance) {
      const eventType: MaintenanceEventType = currentState.serviceInMaintenance
        ? 'local.maintenance.started'
        : 'local.maintenance.ended';

      this.logger.info(`Service maintenance ${currentState.serviceInMaintenance ? 'started' : 'ended'}`);

      this.emitEvent(eventType, {
        source: 'service',
        isStarting: currentState.serviceInMaintenance,
        timestamp,
        details: currentState.serviceDetails,
      });
    } else if (currentState.serviceInMaintenance && this.hasServiceDetailsChanged(currentState)) {
      // Service is in maintenance but details changed -> emit updated
      this.logger.info('Service maintenance updated');
      this.emitEvent('local.maintenance.updated', {
        source: 'service',
        timestamp,
        details: currentState.serviceDetails,
      });
    }

    // Check world-level maintenance changes
    // If configWorldId is set, only check that world
    // Otherwise, check all worlds
    const worldsToCheck = this.configWorldId
      ? [this.configWorldId]
      : Array.from(currentState.worldMaintenanceStates.keys());

    for (const worldId of worldsToCheck) {
      const previousWorldState = this.previousState.worldMaintenanceStates.get(worldId) ?? false;
      const currentWorldState = currentState.worldMaintenanceStates.get(worldId) ?? false;
      const currentWorldDetails = currentState.worldDetails.get(worldId);

      if (previousWorldState !== currentWorldState) {
        const eventType: MaintenanceEventType = currentWorldState
          ? 'local.maintenance.started'
          : 'local.maintenance.ended';

        this.logger.info(`World maintenance ${currentWorldState ? 'started' : 'ended'}`, { worldId });

        this.emitEvent(eventType, {
          source: 'world',
          worldId,
          isStarting: currentWorldState,
          timestamp,
          details: currentWorldDetails,
        });
      } else if (currentWorldState && this.hasWorldDetailsChanged(worldId, currentState)) {
        // World is in maintenance but details changed -> emit updated
        this.logger.info('World maintenance updated', { worldId });
        this.emitEvent('local.maintenance.updated', {
          source: 'world',
          worldId,
          timestamp,
          details: currentWorldDetails,
        });
      }
    }

    // Schedule timers for future start/end times
    this.scheduleServiceTimers(serviceMaintenanceStatus);
    this.scheduleWorldTimers(gameWorlds);

    // Update previous state
    this.previousState = currentState;
  }

  /**
   * Check if service maintenance details have changed
   */
  private hasServiceDetailsChanged(currentState: MaintenanceStateSnapshot): boolean {
    const prev = this.previousState?.serviceDetails;
    const curr = currentState.serviceDetails;

    if (!prev && !curr) return false;
    if (!prev || !curr) return true;

    return prev.startsAt !== curr.startsAt ||
           prev.endsAt !== curr.endsAt ||
           prev.message !== curr.message ||
           prev.kickExistingPlayers !== curr.kickExistingPlayers ||
           prev.kickDelayMinutes !== curr.kickDelayMinutes;
  }

  /**
   * Check if world maintenance details have changed
   */
  private hasWorldDetailsChanged(worldId: string, currentState: MaintenanceStateSnapshot): boolean {
    const prev = this.previousState?.worldDetails.get(worldId);
    const curr = currentState.worldDetails.get(worldId);

    if (!prev && !curr) return false;
    if (!prev || !curr) return true;

    return prev.startDate !== curr.startDate ||
           prev.endDate !== curr.endDate ||
           prev.message !== curr.message ||
           prev.forceDisconnect !== curr.forceDisconnect ||
           prev.gracePeriodMinutes !== curr.gracePeriodMinutes;
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

