import { IEventHandler } from './event-handler';
import { StandardEvent } from '../../types/events';
import { CacheManager } from '../cache-manager';
import { UsesConfig } from '../../types/config';
import { Logger } from '../../utils/logger';

export class ClientVersionEventHandler implements IEventHandler {
  readonly eventTypes = [
    'client_version.created',
    'client_version.updated',
    'client_version.deleted',
  ];

  isEnabled(uses: UsesConfig): boolean {
    return uses.clientVersion === true;
  }

  constructor(
    private cacheManager: CacheManager,
    private logger: Logger
  ) {}

  async handle(event: StandardEvent, environmentId: string): Promise<void> {
    switch (event.type) {
      case 'client_version.created':
      case 'client_version.updated': {
        const clientVersionData = event.data.clientVersion;
        if (clientVersionData) {
          this.logger.info('Client version event, updating cache directly', {
            id: event.data.id,
            environmentId,
          });
          this.cacheManager
            .getClientVersionService()
            ?.updateSingleClientVersion(clientVersionData, environmentId);
        } else {
          this.logger.info(
            'Client version event (no full data), refreshing cache',
            {
              id: event.data.id,
              environmentId,
            }
          );
          try {
            await this.cacheManager
              .getClientVersionService()
              ?.refreshByEnvironment(undefined, environmentId);
          } catch (error: any) {
            this.logger.error('Failed to refresh client version cache', {
              error: error.message,
            });
          }
        }
        break;
      }
      case 'client_version.deleted': {
        const id = String(event.data.id);
        this.logger.info('Client version deleted, removing from cache', {
          id,
          environmentId,
        });
        this.cacheManager
          .getClientVersionService()
          ?.removeFromCache(id, environmentId);
        break;
      }
    }
  }
}
