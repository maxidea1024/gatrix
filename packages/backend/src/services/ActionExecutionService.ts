/**
 * Action Execution Service
 *
 * Processes unprocessed signals by matching them against enabled action sets
 * and executing the configured actions via the service account's permissions.
 */

import { createLogger } from '../config/logger';
import { SignalEndpointModel, Signal } from '../models/SignalEndpoint';
import { ActionSetModel, ActionSet } from '../models/ActionSet';

const logger = createLogger('ActionExecutionService');

/**
 * Supported action types and their execution logic
 */
const ACTION_TYPES = {
  TOGGLE_FLAG: 'TOGGLE_FLAG',
  ENABLE_FLAG: 'ENABLE_FLAG',
  DISABLE_FLAG: 'DISABLE_FLAG',
  UPDATE_FLAG_VARIANTS: 'UPDATE_FLAG_VARIANTS',
} as const;

export class ActionExecutionService {
  /**
   * Process all unprocessed signals
   * Called periodically by the scheduler
   */
  static async processUnprocessedSignals(): Promise<{ processed: number; errors: number }> {
    let processed = 0;
    let errors = 0;

    try {
      const signals = await SignalEndpointModel.findUnprocessedSignals(10);

      if (signals.length === 0) {
        return { processed: 0, errors: 0 };
      }

      logger.info(`Processing ${signals.length} unprocessed signals`);

      for (const signal of signals) {
        try {
          await this.processSignal(signal);
          await SignalEndpointModel.markSignalProcessed(signal.id);
          processed++;
        } catch (error) {
          logger.error(`Error processing signal ${signal.id}:`, error);
          errors++;
          // Mark as processed even on error to avoid infinite retry loops
          // The error is recorded in the action set event
          await SignalEndpointModel.markSignalProcessed(signal.id);
        }
      }

      if (processed > 0 || errors > 0) {
        logger.info(`Signal processing complete: ${processed} processed, ${errors} errors`);
      }
    } catch (error) {
      logger.error('Error in processUnprocessedSignals:', error);
    }

    return { processed, errors };
  }

  /**
   * Process a single signal by finding matching action sets and executing their actions
   */
  private static async processSignal(signal: Signal): Promise<void> {
    // Find matching action sets
    const matchingActionSets = await ActionSetModel.findMatchingActionSets(
      signal.source,
      signal.sourceId
    );

    if (matchingActionSets.length === 0) {
      logger.debug(`No matching action sets for signal ${signal.id}`);
      return;
    }

    logger.info(`Signal ${signal.id} matched ${matchingActionSets.length} action set(s)`);

    for (const actionSet of matchingActionSets) {
      await this.executeActionSet(actionSet, signal);
    }
  }

  /**
   * Check if signal payload matches the action set's filters
   */
  private static matchesFilters(signal: Signal, actionSet: ActionSet): boolean {
    if (!actionSet.filters || Object.keys(actionSet.filters).length === 0) {
      // No filters = match all signals from the source
      return true;
    }

    const payload = signal.payload;
    if (!payload) {
      return false;
    }

    // Simple key-value matching for now
    // Each filter key must match the corresponding payload value
    for (const [key, expectedValue] of Object.entries(actionSet.filters)) {
      const actualValue = (payload as any)[key];

      if (Array.isArray(expectedValue)) {
        // If filter value is array, payload value must be in the array
        if (!expectedValue.includes(actualValue)) {
          return false;
        }
      } else if (actualValue !== expectedValue) {
        return false;
      }
    }

    return true;
  }

  /**
   * Execute all actions in an action set for a given signal
   */
  private static async executeActionSet(actionSet: ActionSet, signal: Signal): Promise<void> {
    // Check filters
    if (!this.matchesFilters(signal, actionSet)) {
      logger.debug(`Signal ${signal.id} did not match filters for action set ${actionSet.id}`);
      return;
    }

    // Create execution event (started)
    const actionStates = actionSet.actions.map((action) => ({
      ...action,
      state: 'pending' as string,
      result: null as any,
    }));

    const event = await ActionSetModel.createEvent(
      actionSet.id,
      signal.id,
      'started',
      {
        id: signal.id,
        source: signal.source,
        sourceId: signal.sourceId,
        payload: signal.payload,
        createdAt: signal.createdAt,
      },
      {
        id: actionSet.id,
        name: actionSet.name,
        actorId: actionSet.actorId,
        actions: actionStates,
      }
    );

    let allSuccess = true;

    // Execute each action in order
    for (let i = 0; i < actionSet.actions.length; i++) {
      const action = actionSet.actions[i];
      try {
        const result = await this.executeAction(action, actionSet, signal);
        actionStates[i].state = 'success';
        actionStates[i].result = result;
      } catch (error) {
        allSuccess = false;
        actionStates[i].state = 'failed';
        actionStates[i].result = {
          error: error instanceof Error ? error.message : String(error),
        };
        logger.error(
          `Action ${action.id} (${action.actionType}) failed for signal ${signal.id}:`,
          error
        );
        // Continue with remaining actions even if one fails
      }
    }

    // Update event state
    await ActionSetModel.updateEventState(event.id, allSuccess ? 'success' : 'failed', {
      id: actionSet.id,
      name: actionSet.name,
      actorId: actionSet.actorId,
      actions: actionStates,
    });
  }

  /**
   * Execute a single action
   */
  private static async executeAction(
    action: { actionType: string; executionParams: Record<string, any> | null },
    actionSet: ActionSet,
    signal: Signal
  ): Promise<any> {
    const params = action.executionParams || {};

    switch (action.actionType) {
      case ACTION_TYPES.TOGGLE_FLAG:
        return this.executeToggleFlag(params, actionSet);

      case ACTION_TYPES.ENABLE_FLAG:
        return this.executeSetFlagEnabled(params, actionSet, true);

      case ACTION_TYPES.DISABLE_FLAG:
        return this.executeSetFlagEnabled(params, actionSet, false);

      default:
        logger.warn(`Unknown action type: ${action.actionType}`);
        return { warning: `Unknown action type: ${action.actionType}` };
    }
  }

  /**
   * Toggle a feature flag's enabled state in a specific environment
   */
  private static async executeToggleFlag(
    params: Record<string, any>,
    actionSet: ActionSet
  ): Promise<any> {
    const { flagName, environment } = params;

    if (!flagName || !environment) {
      throw new Error('flagName and environment are required for TOGGLE_FLAG');
    }

    // Dynamic import to avoid circular dependency
    const { featureFlagService } = await import('./FeatureFlagService');

    const flag = await featureFlagService.getFlag(environment, flagName);
    if (!flag) {
      throw new Error(`Feature flag "${flagName}" not found in environment "${environment}"`);
    }

    const envConfig = flag.environments?.[environment];
    const currentEnabled = envConfig?.isEnabled ?? false;
    const newEnabled = !currentEnabled;

    await featureFlagService.toggleFlag(environment, flagName, newEnabled, actionSet.actorId!);

    return {
      flagName,
      environment,
      previousEnabled: currentEnabled,
      newEnabled,
    };
  }

  /**
   * Set a feature flag's enabled/disabled state in a specific environment
   */
  private static async executeSetFlagEnabled(
    params: Record<string, any>,
    actionSet: ActionSet,
    enabled: boolean
  ): Promise<any> {
    const { flagName, environment } = params;

    if (!flagName || !environment) {
      throw new Error(
        `flagName and environment are required for ${enabled ? 'ENABLE_FLAG' : 'DISABLE_FLAG'}`
      );
    }

    const { featureFlagService } = await import('./FeatureFlagService');

    const flag = await featureFlagService.getFlag(environment, flagName);
    if (!flag) {
      throw new Error(`Feature flag "${flagName}" not found in environment "${environment}"`);
    }

    await featureFlagService.toggleFlag(environment, flagName, enabled, actionSet.actorId!);

    return {
      flagName,
      environment,
      isEnabled: enabled,
    };
  }
}

export default ActionExecutionService;
