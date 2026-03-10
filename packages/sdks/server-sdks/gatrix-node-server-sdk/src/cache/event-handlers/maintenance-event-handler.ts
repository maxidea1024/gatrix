import { IEventHandler } from './event-handler';
import { StandardEvent } from '../../types/events';
import { CacheManager } from '../cache-manager';
import { UsesConfig } from '../../types/config';
import { Logger } from '../../utils/logger';

export class MaintenanceEventHandler implements IEventHandler {
  readonly eventTypes = ['maintenance.settings.updated'];

  isEnabled(uses: UsesConfig): boolean {
    return uses.serviceMaintenance !== false;
  }

  constructor(
    private cacheManager: CacheManager,
    private logger: Logger
  ) {}

  async handle(event: StandardEvent, environmentId: string): Promise<void> {
    this.logger.info('Maintenance settings updated, refreshing cache', {
      environmentId,
    });
    try {
      await this.cacheManager.refreshServiceMaintenance(environmentId);
    } catch (error: any) {
      this.logger.error('Failed to refresh maintenance cache', {
        error: error.message,
      });
    }
  }
}
