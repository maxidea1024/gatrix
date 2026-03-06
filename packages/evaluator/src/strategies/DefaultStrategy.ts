/**
 * Default Strategy - always returns true
 * Only constraints and segments determine the outcome.
 */

import { EvaluationContext, StrategyParameters, StrategyEvaluationResult } from '@gatrix/shared';
import { Strategy } from './Strategy';

export class DefaultStrategy extends Strategy {
  constructor() {
    super('default');
  }

  isEnabled(_parameters: StrategyParameters, _context: EvaluationContext): boolean {
    return true;
  }

  isEnabledWithDetails(
    _parameters: StrategyParameters,
    _context: EvaluationContext
  ): StrategyEvaluationResult {
    return { enabled: true, reason: 'Default strategy always enabled' };
  }
}
