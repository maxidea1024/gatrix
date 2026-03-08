import { IEventHandler } from './event-handler';
import { StandardEvent } from '../../types/events';
import { CacheManager } from '../cache-manager';
import { UsesConfig } from '../../types/config';
import { Logger } from '../../utils/logger';

export class StoreProductEventHandler implements IEventHandler {
  readonly eventTypes = [
    'store_product.created',
    'store_product.updated',
    'store_product.deleted',
    'store_product.bulk_updated',
  ];

  isEnabled(uses: UsesConfig): boolean {
    return uses.storeProduct === true;
  }

  constructor(
    private cacheManager: CacheManager,
    private logger: Logger
  ) {}

  async handle(event: StandardEvent, environmentId: string): Promise<void> {
    switch (event.type) {
      case 'store_product.created':
      case 'store_product.updated': {
        const isActive =
          event.data.isActive === 0
            ? false
            : event.data.isActive === 1
              ? true
              : event.data.isActive;
        await this.cacheManager.updateSingleStoreProduct(
          String(event.data.id),
          environmentId,
          isActive
        );
        break;
      }
      case 'store_product.deleted':
        this.cacheManager.removeStoreProduct(
          String(event.data.id),
          environmentId
        );
        break;
      case 'store_product.bulk_updated':
        this.logger.info('Store product bulk update, refreshing cache', {
          count: event.data.count,
          environmentId,
          isActive: event.data.isActive,
        });
        await this.cacheManager.refreshStoreProducts(environmentId);
        break;
    }
  }
}
