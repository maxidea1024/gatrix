/**
 * Gradual Rollout Random Strategy
 *
 * Percentage-based rollout using random value each evaluation.
 * No stickiness - purely random on every check.
 */

import { EvaluationContext, StrategyParameters, StrategyEvaluationResult } from '@gatrix/shared';
import { Strategy } from './Strategy';

export class GradualRolloutRandomStrategy extends Strategy {
  constructor() {
    super('gradualRolloutRandom');
  }

  isEnabled(parameters: StrategyParameters, _context: EvaluationContext): boolean {
    return this.isEnabledWithDetails(parameters, _context).enabled;
  }

  isEnabledWithDetails(
    parameters: StrategyParameters,
    _context: EvaluationContext
  ): StrategyEvaluationResult {
    const percentage = Number(parameters.percentage ?? 0);
    const random = Math.floor(Math.random() * 100) + 1;
    const enabled = percentage >= random;

    return {
      enabled,
      reason: enabled
        ? `Percentage ${percentage}%: random ${random} <= ${percentage}`
        : `Percentage ${percentage}%: random ${random} > ${percentage}`,
      details: { percentage, random },
    };
  }
}
