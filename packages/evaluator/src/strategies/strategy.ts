/**
 * Base Strategy class
 *
 * All strategy implementations extend this class.
 * Each strategy defines its own isEnabled() and isEnabledWithDetails() logic.
 */

import {
  EvaluationContext,
  StrategyParameters,
  StrategyEvaluationResult,
} from '@gatrix/shared';

export abstract class Strategy {
  public readonly name: string;

  constructor(name: string) {
    this.name = name;
  }

  abstract isEnabled(
    parameters: StrategyParameters,
    context: EvaluationContext
  ): boolean;

  abstract isEnabledWithDetails(
    parameters: StrategyParameters,
    context: EvaluationContext
  ): StrategyEvaluationResult;
}
