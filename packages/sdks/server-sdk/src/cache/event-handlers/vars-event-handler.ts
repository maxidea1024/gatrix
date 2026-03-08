import { IEventHandler } from './event-handler';
import { StandardEvent } from '../../types/events';
import { CacheManager } from '../cache-manager';
import { UsesConfig } from '../../types/config';
import { Logger } from '../../utils/logger';

export class VarsEventHandler implements IEventHandler {
  readonly eventTypes = ['vars.updated'];

  isEnabled(uses: UsesConfig): boolean {
    return uses.vars !== false;
  }

  constructor(
    private cacheManager: CacheManager,
    private logger: Logger
  ) {}

  async handle(event: StandardEvent, environmentId: string): Promise<void> {
    const varKey = event.data.key as string;
    const varValue = event.data.value;
    const varsService = this.cacheManager.getVarsService();

    this.logger.info('Vars update event received', {
      key: varKey,
      environmentId,
      hasValue: varValue !== undefined,
    });

    try {
      if (varKey && varValue !== undefined && varsService) {
        varsService.updateSingleVar(varKey, varValue, environmentId);
        this.logger.info('Single var updated in cache directly', { key: varKey, environmentId });
      } else {
        await varsService?.refreshByEnvironment(environmentId);
      }
    } catch (error: any) {
      this.logger.error('Failed to handle vars update event', { error: error.message });
    }
  }
}
