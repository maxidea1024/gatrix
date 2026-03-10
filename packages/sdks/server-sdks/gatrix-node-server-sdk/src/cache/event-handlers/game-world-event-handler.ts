import { IEventHandler } from './event-handler';
import { StandardEvent } from '../../types/events';
import { CacheManager } from '../cache-manager';
import { UsesConfig } from '../../types/config';
import { Logger } from '../../utils/logger';

export class GameWorldEventHandler implements IEventHandler {
  readonly eventTypes = [
    'gameworld.created',
    'gameworld.updated',
    'gameworld.deleted',
    'gameworld.order_changed',
  ];

  isEnabled(uses: UsesConfig): boolean {
    return uses.gameWorld !== false;
  }

  constructor(
    private cacheManager: CacheManager,
    private logger: Logger
  ) {}

  async handle(event: StandardEvent, environmentId: string): Promise<void> {
    switch (event.type) {
      case 'gameworld.created':
      case 'gameworld.updated': {
        const isVisible =
          event.data.isVisible === 0
            ? false
            : event.data.isVisible === 1
              ? true
              : event.data.isVisible;
        await this.cacheManager.updateSingleGameWorld(
          String(event.data.id),
          environmentId,
          isVisible
        );
        break;
      }
      case 'gameworld.deleted':
        this.cacheManager.removeGameWorld(String(event.data.id), environmentId);
        break;
      case 'gameworld.order_changed':
        this.logger.info('Game world order changed, refreshing cache', {
          environmentId,
        });
        await this.cacheManager.refreshGameWorlds(environmentId);
        break;
    }
  }
}
