import { IEventHandler } from './event-handler';
import { StandardEvent } from '../../types/events';
import { CacheManager } from '../cache-manager';
import { UsesConfig } from '../../types/config';
import { Logger } from '../../utils/logger';

export class ServiceNoticeEventHandler implements IEventHandler {
  readonly eventTypes = [
    'service_notice.created',
    'service_notice.updated',
    'service_notice.deleted',
  ];

  isEnabled(uses: UsesConfig): boolean {
    return uses.serviceNotice === true;
  }

  constructor(
    private cacheManager: CacheManager,
    private logger: Logger
  ) {}

  async handle(event: StandardEvent, environmentId: string): Promise<void> {
    switch (event.type) {
      case 'service_notice.created':
      case 'service_notice.updated': {
        const serviceNoticeData = event.data.serviceNotice;
        if (serviceNoticeData) {
          this.logger.info('Service notice event, updating cache directly', {
            id: event.data.id,
            environmentId,
          });
          this.cacheManager
            .getServiceNoticeService()
            ?.updateSingleServiceNotice(serviceNoticeData, environmentId);
        } else {
          this.logger.info('Service notice event (no full data), refreshing cache', {
            id: event.data.id,
            environmentId,
          });
          try {
            await this.cacheManager.getServiceNoticeService()?.refreshByEnvironment(environmentId);
          } catch (error: any) {
            this.logger.error('Failed to refresh service notice cache', { error: error.message });
          }
        }
        break;
      }
      case 'service_notice.deleted': {
        const id = String(event.data.id);
        this.logger.info('Service notice deleted, removing from cache', { id, environmentId });
        this.cacheManager.getServiceNoticeService()?.removeFromCache(id, environmentId);
        break;
      }
    }
  }
}
