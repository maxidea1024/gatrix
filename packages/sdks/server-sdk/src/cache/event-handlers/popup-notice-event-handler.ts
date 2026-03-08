import { IEventHandler } from './event-handler';
import { StandardEvent } from '../../types/events';
import { CacheManager } from '../cache-manager';
import { UsesConfig } from '../../types/config';
import { Logger } from '../../utils/logger';

export class PopupNoticeEventHandler implements IEventHandler {
  readonly eventTypes = ['popup.created', 'popup.updated', 'popup.deleted'];

  isEnabled(uses: UsesConfig): boolean {
    return uses.popupNotice !== false;
  }

  constructor(
    private cacheManager: CacheManager,
    private logger: Logger
  ) {}

  async handle(event: StandardEvent, environmentId: string): Promise<void> {
    switch (event.type) {
      case 'popup.created':
      case 'popup.updated': {
        const isVisible =
          event.data.isVisible === 0
            ? false
            : event.data.isVisible === 1
              ? true
              : event.data.isVisible;
        await this.cacheManager.updateSinglePopupNotice(
          String(event.data.id),
          environmentId,
          isVisible
        );
        break;
      }
      case 'popup.deleted':
        this.cacheManager.removePopupNotice(String(event.data.id), environmentId);
        break;
    }
  }
}
