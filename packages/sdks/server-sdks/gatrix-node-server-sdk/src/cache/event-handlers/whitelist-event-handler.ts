import { IEventHandler, EventHandlerScope } from './event-handler';
import { StandardEvent } from '../../types/events';
import { CacheManager } from '../cache-manager';
import { UsesConfig } from '../../types/config';
import { Logger } from '../../utils/logger';

export class WhitelistEventHandler implements IEventHandler {
  readonly scope: EventHandlerScope = 'environment';
  readonly eventTypes = ['ip_whitelist.updated', 'account_whitelist.updated'];

  isEnabled(uses: UsesConfig): boolean {
    return uses.whitelist !== false;
  }

  constructor(
    private cacheManager: CacheManager,
    private logger: Logger
  ) {}

  async handle(event: StandardEvent, environmentId: string): Promise<void> {
    try {
      if (event.type === 'ip_whitelist.updated') {
        this.logger.info('IP whitelist updated, refreshing IP cache', {
          environmentId,
        });
        await this.cacheManager.refreshIpWhitelists(environmentId);
      } else if (event.type === 'account_whitelist.updated') {
        this.logger.info('Account whitelist updated, refreshing account cache', {
          environmentId,
        });
        await this.cacheManager.refreshAccountWhitelists(environmentId);
      }
    } catch (error: any) {
      this.logger.error('Failed to refresh whitelist cache', {
        eventType: event.type,
        error: error.message,
      });
    }
  }
}
