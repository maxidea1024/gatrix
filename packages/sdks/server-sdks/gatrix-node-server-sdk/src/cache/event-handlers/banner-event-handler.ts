import { IEventHandler } from './event-handler';
import { StandardEvent } from '../../types/events';
import { CacheManager } from '../cache-manager';
import { UsesConfig } from '../../types/config';
import { Logger } from '../../utils/logger';

export class BannerEventHandler implements IEventHandler {
  readonly eventTypes = ['banner.created', 'banner.updated', 'banner.deleted'];

  isEnabled(uses: UsesConfig): boolean {
    return uses.banner === true;
  }

  constructor(
    private cacheManager: CacheManager,
    private logger: Logger
  ) {}

  async handle(event: StandardEvent, environmentId: string): Promise<void> {
    switch (event.type) {
      case 'banner.created':
      case 'banner.updated': {
        const status = event.data.status as string | undefined;
        await this.cacheManager.updateSingleBanner(
          String(event.data.id),
          environmentId,
          status
        );
        break;
      }
      case 'banner.deleted':
        this.cacheManager.removeBanner(String(event.data.id), environmentId);
        break;
    }
  }
}
