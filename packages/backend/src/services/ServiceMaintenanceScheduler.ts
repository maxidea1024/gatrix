/**
 * Service Maintenance Scheduler
 * 
 * Handles scheduled checks for service maintenance start/end times
 * and publishes events when maintenance status changes
 */

import logger from '../config/logger';
import ServiceMaintenanceModel from '../models/ServiceMaintenance';
import { pubSubService } from './PubSubService';

interface MaintenanceScheduleState {
  serviceType: string;
  maintenanceStartDate?: Date;
  maintenanceEndDate?: Date;
  hasStartEventFired: boolean;
  hasEndEventFired: boolean;
  isCurrentlyInMaintenance: boolean;
}

export class ServiceMaintenanceScheduler {
  private scheduleStates: Map<string, MaintenanceScheduleState> = new Map();

  /**
   * Check all service maintenance records and emit events if needed
   */
  async checkAndEmitEvents(): Promise<void> {
    try {
      const maintenances = await ServiceMaintenanceModel.list();
      const now = new Date();

      for (const maintenance of maintenances) {
        const serviceType = maintenance.serviceType;
        const state = this.scheduleStates.get(serviceType) || {
          serviceType,
          maintenanceStartDate: maintenance.maintenanceStartDate,
          maintenanceEndDate: maintenance.maintenanceEndDate,
          hasStartEventFired: false,
          hasEndEventFired: false,
          isCurrentlyInMaintenance: false,
        };

        const startDate = maintenance.maintenanceStartDate ? new Date(maintenance.maintenanceStartDate) : null;
        const endDate = maintenance.maintenanceEndDate ? new Date(maintenance.maintenanceEndDate) : null;

        // Detect if dates have changed
        const startDateChanged = startDate?.getTime() !== state.maintenanceStartDate?.getTime();
        const endDateChanged = endDate?.getTime() !== state.maintenanceEndDate?.getTime();

        // If dates changed, reset event flags to re-evaluate
        if (startDateChanged || endDateChanged) {
          logger.info('Maintenance dates changed, resetting event flags', {
            serviceType,
            oldStart: state.maintenanceStartDate,
            newStart: startDate,
            oldEnd: state.maintenanceEndDate,
            newEnd: endDate,
          });
          state.hasStartEventFired = false;
          state.hasEndEventFired = false;
        }

        // Check if maintenance start time has arrived
        if (
          startDate &&
          !state.hasStartEventFired &&
          startDate <= now
        ) {
          logger.info('Maintenance start time reached', { serviceType });
          await pubSubService.publishEvent({
            type: 'maintenance.started',
            data: {
              id: serviceType,
              timestamp: Date.now()
            }
          });
          state.hasStartEventFired = true;
          state.isCurrentlyInMaintenance = true;
        }

        // Check if maintenance end time has arrived
        if (
          endDate &&
          !state.hasEndEventFired &&
          endDate <= now
        ) {
          logger.info('Maintenance end time reached', { serviceType });
          await pubSubService.publishEvent({
            type: 'maintenance.ended',
            data: {
              id: serviceType,
              timestamp: Date.now()
            }
          });
          state.hasEndEventFired = true;
          state.isCurrentlyInMaintenance = false;
        }

        // Update state with current dates
        state.maintenanceStartDate = startDate || undefined;
        state.maintenanceEndDate = endDate || undefined;
        this.scheduleStates.set(serviceType, state);
      }
    } catch (error) {
      logger.error('Error checking maintenance schedules:', error);
    }
  }

  /**
   * Reset schedule state for a service type
   * Called when maintenance settings are updated
   */
  resetScheduleState(serviceType: string): void {
    this.scheduleStates.delete(serviceType);
    logger.debug('Reset schedule state for service type', { serviceType });
  }

  /**
   * Reset all schedule states
   */
  resetAllScheduleStates(): void {
    this.scheduleStates.clear();
    logger.debug('Reset all schedule states');
  }

  /**
   * Check if maintenance has already started
   */
  hasMaintenanceStarted(maintenanceStartDate?: Date): boolean {
    if (!maintenanceStartDate) {
      return false;
    }
    return new Date(maintenanceStartDate) <= new Date();
  }

  /**
   * Check if maintenance has already ended
   */
  hasMaintenanceEnded(maintenanceEndDate?: Date): boolean {
    if (!maintenanceEndDate) {
      return false;
    }
    return new Date(maintenanceEndDate) <= new Date();
  }
}

export const serviceMaintenanceScheduler = new ServiceMaintenanceScheduler();

