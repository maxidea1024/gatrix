/**
 * Gradual Rollout User ID Strategy
 *
 * Percentage-based rollout using userId hash.
 * Stickiness is fixed to userId (not configurable).
 */

import {
  EvaluationContext,
  StrategyParameters,
  StrategyEvaluationResult,
} from '@gatrix/shared';
import { Strategy } from './strategy';
import { normalizedStrategyValue } from './util';

export class GradualRolloutUserIdStrategy extends Strategy {
  constructor() {
    super('gradualRolloutUserId');
  }

  isEnabled(
    parameters: StrategyParameters,
    context: EvaluationContext
  ): boolean {
    const { userId } = context;
    if (!userId) return false;
    const percentage = Number(parameters.percentage ?? 0);
    const groupId = parameters.groupId || '';
    const enabled =
      percentage > 0 && normalizedStrategyValue(userId, groupId) <= percentage;
    return enabled;
  }

  isEnabledWithDetails(
    parameters: StrategyParameters,
    context: EvaluationContext
  ): StrategyEvaluationResult {
    const { userId } = context;
    if (!userId) {
      return { enabled: false, reason: 'No userId in context' };
    }

    const percentage = Number(parameters.percentage ?? 0);
    const groupId = parameters.groupId || '';
    const normalizedValue = normalizedStrategyValue(userId, groupId);
    const enabled = percentage > 0 && normalizedValue <= percentage;

    return {
      enabled,
      reason: enabled
        ? `Percentage ${percentage}%: normalized(userId="${userId}") = ${normalizedValue} <= ${percentage}`
        : `Percentage ${percentage}%: normalized(userId="${userId}") = ${normalizedValue} > ${percentage}`,
      details: { userId, percentage, groupId, normalizedValue },
    };
  }
}
