import { IEventHandler, EventHandlerScope } from './event-handler';
import { StandardEvent } from '../../types/events';
import { CacheManager } from '../cache-manager';
import { UsesConfig } from '../../types/config';
import { Logger } from '../../utils/logger';

export class FeatureFlagEventHandler implements IEventHandler {
  readonly scope: EventHandlerScope = 'environment';
  readonly eventTypes = [
    'feature_flag.changed',
    'segment.created',
    'segment.updated',
    'segment.deleted',
  ];

  isEnabled(uses: UsesConfig): boolean {
    return uses.featureFlag === true;
  }

  constructor(
    private cacheManager: CacheManager,
    private logger: Logger
  ) {}

  async handle(event: StandardEvent, environmentId: string): Promise<void> {
    if (event.type.startsWith('segment.')) {
      return this.handleSegmentEvent(event);
    }
    return this.handleFlagEvent(event, environmentId);
  }

  private async handleFlagEvent(
    event: StandardEvent,
    environmentId: string
  ): Promise<void> {
    const changedKeys = event.data.changedKeys || [];
    const changeType = event.data.changeType || 'definition_changed';
    const featureFlagService = this.cacheManager.getFeatureFlagService();

    if (!featureFlagService) {
      this.logger.warn('FeatureFlagService not available');
      return;
    }

    this.logger.info('Feature flag event received', {
      type: event.type,
      environmentId,
      changeType,
      changedKeys,
    });

    try {
      if (changedKeys.length === 0) {
        await featureFlagService.refreshByEnvironment(undefined, environmentId);
      } else if (changeType === 'deleted') {
        for (const flagName of changedKeys) {
          featureFlagService.removeFlag(flagName, environmentId);
        }
        this.logger.info('Flags removed from cache', {
          flags: changedKeys,
          environmentId,
        });
      } else if (changeType === 'enabled_changed') {
        await Promise.all(
          changedKeys.map((flagName: string) => {
            const cached = featureFlagService.getFlagByName(
              flagName,
              environmentId
            );
            if (cached?.compact) {
              this.logger.info(
                'Compacted flag re-enabled, fetching full data',
                {
                  flagName,
                  environmentId,
                }
              );
            }
            return featureFlagService
              .updateSingleFlag(flagName, undefined, environmentId)
              .catch((error: any) => {
                this.logger.warn('Failed to update flag for enabled change', {
                  flagName,
                  environmentId,
                  error: error.message,
                });
              });
          })
        );
      } else {
        await Promise.all(
          changedKeys.map((flagName: string) =>
            featureFlagService
              .updateSingleFlag(flagName, undefined, environmentId)
              .catch((error: any) => {
                this.logger.warn('Failed to update flag definition', {
                  flagName,
                  environmentId,
                  error: error.message,
                });
              })
          )
        );
      }
    } catch (error: any) {
      this.logger.error('Failed to handle feature flag event', {
        error: error.message,
      });
    }
  }

  private async handleSegmentEvent(event: StandardEvent): Promise<void> {
    const featureFlagService = this.cacheManager.getFeatureFlagService();
    if (!featureFlagService) return;

    // Extract projectId from event data for project-scoped segment caching
    const projectId = event.data.projectId as string | undefined;

    switch (event.type) {
      case 'segment.created':
      case 'segment.updated': {
        const segmentData = event.data.segment;
        const segmentName = event.data.segmentName as string;
        this.logger.info('Segment event received', {
          type: event.type,
          segmentName,
          projectId,
          hasFullData: !!segmentData,
        });
        try {
          if (segmentData) {
            featureFlagService.updateSegmentInCache(segmentData, projectId);
          } else {
            await featureFlagService.refreshSegments();
          }
        } catch (error: any) {
          this.logger.error('Failed to handle segment event', {
            error: error.message,
          });
        }
        break;
      }
      case 'segment.deleted': {
        const deletedSegmentName = event.data.segmentName as string;
        if (deletedSegmentName) {
          featureFlagService.removeSegmentFromCache(
            deletedSegmentName,
            projectId
          );
          this.logger.info('Segment removed from cache', {
            segmentName: deletedSegmentName,
            projectId,
          });
        } else {
          await featureFlagService.refreshSegments();
        }
        break;
      }
    }
  }
}
