/**
 * Gradual Rollout Session ID Strategy
 *
 * Percentage-based rollout using sessionId hash.
 * Stickiness is fixed to sessionId (not configurable).
 */

import {
  EvaluationContext,
  StrategyParameters,
  StrategyEvaluationResult,
} from '@gatrix/shared';
import { Strategy } from './strategy';
import { normalizedStrategyValue } from './util';

export class GradualRolloutSessionIdStrategy extends Strategy {
  constructor() {
    super('gradualRolloutSessionId');
  }

  isEnabled(
    parameters: StrategyParameters,
    context: EvaluationContext
  ): boolean {
    const { sessionId } = context;
    if (!sessionId) return false;
    const percentage = Number(parameters.percentage ?? 0);
    const groupId = parameters.groupId || '';
    const enabled =
      percentage > 0 &&
      normalizedStrategyValue(sessionId, groupId) <= percentage;
    return enabled;
  }

  isEnabledWithDetails(
    parameters: StrategyParameters,
    context: EvaluationContext
  ): StrategyEvaluationResult {
    const { sessionId } = context;
    if (!sessionId) {
      return { enabled: false, reason: 'No sessionId in context' };
    }

    const percentage = Number(parameters.percentage ?? 0);
    const groupId = parameters.groupId || '';
    const normalizedValue = normalizedStrategyValue(sessionId, groupId);
    const enabled = percentage > 0 && normalizedValue <= percentage;

    return {
      enabled,
      reason: enabled
        ? `Percentage ${percentage}%: normalized(sessionId="${sessionId}") = ${normalizedValue} <= ${percentage}`
        : `Percentage ${percentage}%: normalized(sessionId="${sessionId}") = ${normalizedValue} > ${percentage}`,
      details: { sessionId, percentage, groupId, normalizedValue },
    };
  }
}
