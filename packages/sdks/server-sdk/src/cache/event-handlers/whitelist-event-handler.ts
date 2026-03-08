import { IEventHandler } from './event-handler';
import { StandardEvent } from '../../types/events';
import { CacheManager } from '../cache-manager';
import { UsesConfig } from '../../types/config';
import { Logger } from '../../utils/logger';

export class WhitelistEventHandler implements IEventHandler {
  readonly eventTypes = ['whitelist.updated'];

  isEnabled(uses: UsesConfig): boolean {
    return uses.whitelist !== false;
  }

  constructor(
    private cacheManager: CacheManager,
    private logger: Logger
  ) {}

  async handle(event: StandardEvent, environmentId: string): Promise<void> {
    this.logger.info('Whitelist updated, refreshing cache', { environmentId });
    try {
      await this.cacheManager.refreshWhitelists(environmentId);
    } catch (error: any) {
      this.logger.error('Failed to refresh whitelist cache', { error: error.message });
    }
  }
}
