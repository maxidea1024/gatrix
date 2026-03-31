import { IEventHandler, EventHandlerScope } from './event-handler';
import { StandardEvent } from '../../types/events';
import { CacheManager } from '../cache-manager';
import { UsesConfig } from '../../types/config';
import { Logger } from '../../utils/logger';

export class ClientVersionEventHandler implements IEventHandler {
  readonly scope: EventHandlerScope = 'project';
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

  async handle(event: StandardEvent, projectId: string): Promise<void> {
    switch (event.type) {
      case 'client_version.created':
      case 'client_version.updated': {
        const clientVersionData = event.data.clientVersion;
        if (clientVersionData) {
          this.logger.info('Client version event, updating cache directly', {
            id: event.data.id,
            projectId,
          });
          this.cacheManager
            .getClientVersionService()
            ?.updateSingleClientVersion(clientVersionData, projectId);
        } else {
          this.logger.info(
            'Client version event (no full data), refreshing cache',
            {
              id: event.data.id,
              projectId,
            }
          );
          try {
            // In multi-tenant mode, resolve a representative environmentId for the correct API client
            const envId =
              this.cacheManager.getEnvironmentIdForProject(projectId);
            await this.cacheManager
              .getClientVersionService()
              ?.refreshByProject(false, projectId, envId);
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
          projectId,
        });
        this.cacheManager
          .getClientVersionService()
          ?.removeFromCache(id, projectId);
        break;
      }
    }
  }
}
