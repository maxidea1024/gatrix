import { IEventHandler } from './event-handler';
import { StandardEvent } from '../../types/events';
import { CacheManager } from '../cache-manager';
import { UsesConfig } from '../../types/config';
import { Logger } from '../../utils/logger';

export class SurveyEventHandler implements IEventHandler {
  readonly eventTypes = [
    'survey.created',
    'survey.updated',
    'survey.deleted',
    'survey.settings.updated',
  ];

  isEnabled(uses: UsesConfig): boolean {
    return uses.survey !== false;
  }

  constructor(
    private cacheManager: CacheManager,
    private logger: Logger
  ) {}

  async handle(event: StandardEvent, environmentId: string): Promise<void> {
    switch (event.type) {
      case 'survey.created':
      case 'survey.updated': {
        const isActive =
          event.data.isActive === 0
            ? false
            : event.data.isActive === 1
              ? true
              : event.data.isActive;
        await this.cacheManager.updateSingleSurvey(String(event.data.id), environmentId, isActive);
        break;
      }
      case 'survey.deleted':
        this.cacheManager.removeSurvey(String(event.data.id), environmentId);
        break;
      case 'survey.settings.updated':
        this.logger.info('Survey settings updated, refreshing', { environmentId });
        try {
          await this.cacheManager.refreshSurveySettings(environmentId);
        } catch (error: any) {
          this.logger.error('Failed to refresh survey settings', { error: error.message });
        }
        break;
    }
  }
}
