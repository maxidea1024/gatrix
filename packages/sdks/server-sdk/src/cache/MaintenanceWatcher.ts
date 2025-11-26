/**
 * MaintenanceWatcher
 * Tracks maintenance state changes and emits local events
 * 
 * This watcher monitors both service-level and world-level maintenance
 * and emits maintenance.started / maintenance.ended events when state changes
 */

import { Logger } from '../utils/logger';
import { MaintenanceStatus, GameWorld } from '../types/api';

export interface MaintenanceStateSnapshot {
  // Service-level maintenance state
  serviceInMaintenance: boolean;
  // World-level maintenance states (worldId -> inMaintenance)
  worldMaintenanceStates: Map<string, boolean>;
}

export interface MaintenanceEventData {
  /** Source of maintenance: 'service' for global, 'world' for world-level */
  source: 'service' | 'world';
  /** World ID (only present when source is 'world') */
  worldId?: string;
  /** Whether maintenance is starting (true) or ending (false) */
  isStarting: boolean;
  /** Timestamp of the event */
  timestamp: string;
}

export type MaintenanceEventCallback = (
  eventType: 'maintenance.started' | 'maintenance.ended',
  data: MaintenanceEventData
) => void;

export class MaintenanceWatcher {
  private logger: Logger;
  private previousState: MaintenanceStateSnapshot | null = null;
  private callbacks: MaintenanceEventCallback[] = [];
  private configWorldId?: string;

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
    eventType: 'maintenance.started' | 'maintenance.ended',
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
    if (serviceMaintenanceStatus?.isMaintenance) {
      const now = new Date();
      const startDate = serviceMaintenanceStatus.detail?.startsAt
        ? new Date(serviceMaintenanceStatus.detail.startsAt)
        : null;
      const endDate = serviceMaintenanceStatus.detail?.endsAt
        ? new Date(serviceMaintenanceStatus.detail.endsAt)
        : null;

      serviceInMaintenance = true;
      if (startDate && now < startDate) {
        serviceInMaintenance = false;
      }
      if (endDate && now > endDate) {
        serviceInMaintenance = false;
      }
    }

    // Check world-level maintenance states
    const worldMaintenanceStates = new Map<string, boolean>();
    for (const world of gameWorlds) {
      if (world.worldId) {
        worldMaintenanceStates.set(world.worldId, this.isWorldInMaintenance(world));
      }
    }

    return {
      serviceInMaintenance,
      worldMaintenanceStates,
    };
  }

  /**
   * Check for state changes and emit events
   * Called when cache is refreshed
   */
  checkAndEmitChanges(
    serviceMaintenanceStatus: MaintenanceStatus | null,
    gameWorlds: GameWorld[]
  ): void {
    const currentState = this.createStateSnapshot(serviceMaintenanceStatus, gameWorlds);

    // Skip if this is the first check (no previous state)
    if (this.previousState === null) {
      this.previousState = currentState;
      this.logger.debug('MaintenanceWatcher initialized', {
        serviceInMaintenance: currentState.serviceInMaintenance,
        worldsTracked: currentState.worldMaintenanceStates.size,
      });
      return;
    }

    const timestamp = new Date().toISOString();

    // Check service-level maintenance change
    if (this.previousState.serviceInMaintenance !== currentState.serviceInMaintenance) {
      const eventType = currentState.serviceInMaintenance
        ? 'maintenance.started'
        : 'maintenance.ended';

      this.logger.info(`Service maintenance ${currentState.serviceInMaintenance ? 'started' : 'ended'}`);

      this.emitEvent(eventType, {
        source: 'service',
        isStarting: currentState.serviceInMaintenance,
        timestamp,
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

      if (previousWorldState !== currentWorldState) {
        const eventType = currentWorldState ? 'maintenance.started' : 'maintenance.ended';

        this.logger.info(`World maintenance ${currentWorldState ? 'started' : 'ended'}`, { worldId });

        this.emitEvent(eventType, {
          source: 'world',
          worldId,
          isStarting: currentWorldState,
          timestamp,
        });
      }
    }

    // Update previous state
    this.previousState = currentState;
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
    this.previousState = null;
    this.callbacks = [];
  }
}

