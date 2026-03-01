/**
 * Strategy Registry
 *
 * Registers all built-in strategies and provides lookup by name.
 */

import { EvaluationContext, StrategyParameters, StrategyEvaluationResult } from '../types';
import { Strategy } from './Strategy';
import { DefaultStrategy } from './DefaultStrategy';
import { FlexibleRolloutStrategy } from './FlexibleRolloutStrategy';
import { UserWithIdStrategy } from './UserWithIdStrategy';
import { GradualRolloutUserIdStrategy } from './GradualRolloutUserIdStrategy';
import { GradualRolloutRandomStrategy } from './GradualRolloutRandomStrategy';
import { GradualRolloutSessionIdStrategy } from './GradualRolloutSessionIdStrategy';
import { RemoteAddressStrategy } from './RemoteAddressStrategy';
import { ApplicationHostnameStrategy } from './ApplicationHostnameStrategy';

// Re-export all strategy classes
export { Strategy } from './Strategy';
export { DefaultStrategy } from './DefaultStrategy';
export { FlexibleRolloutStrategy } from './FlexibleRolloutStrategy';
export { UserWithIdStrategy } from './UserWithIdStrategy';
export { GradualRolloutUserIdStrategy } from './GradualRolloutUserIdStrategy';
export { GradualRolloutRandomStrategy } from './GradualRolloutRandomStrategy';
export { GradualRolloutSessionIdStrategy } from './GradualRolloutSessionIdStrategy';
export { RemoteAddressStrategy } from './RemoteAddressStrategy';
export { ApplicationHostnameStrategy } from './ApplicationHostnameStrategy';
export { normalizedStrategyValue } from './util';

// ==================== Strategy Registry ====================

const strategies: Map<string, Strategy> = new Map();

function registerStrategy(strategy: Strategy): void {
  strategies.set(strategy.name, strategy);
}

// Register all built-in strategies
registerStrategy(new DefaultStrategy());
registerStrategy(new FlexibleRolloutStrategy());
registerStrategy(new UserWithIdStrategy());
registerStrategy(new GradualRolloutUserIdStrategy());
registerStrategy(new GradualRolloutRandomStrategy());
registerStrategy(new GradualRolloutSessionIdStrategy());
registerStrategy(new RemoteAddressStrategy());
registerStrategy(new ApplicationHostnameStrategy());

/**
 * Get strategy instance by name.
 * Returns undefined if no strategy found.
 */
export function getStrategy(name: string): Strategy | undefined {
  return strategies.get(name);
}

/**
 * Evaluate a strategy's isEnabled (boolean only).
 * Returns { enabled: false, strategyFound: false } if strategy is unknown.
 */
export function evaluateStrategyIsEnabled(
  strategyName: string,
  parameters: StrategyParameters,
  context: EvaluationContext
): { enabled: boolean; strategyFound: boolean } {
  const strategy = strategies.get(strategyName);
  if (!strategy) {
    return { enabled: false, strategyFound: false };
  }
  return { enabled: strategy.isEnabled(parameters, context), strategyFound: true };
}

/**
 * Evaluate a strategy with detailed result (reason + details).
 * Returns detailed reason for playground / debugging purposes.
 */
export function evaluateStrategyWithDetails(
  strategyName: string,
  parameters: StrategyParameters,
  context: EvaluationContext
): StrategyEvaluationResult & { strategyFound: boolean } {
  const strategy = strategies.get(strategyName);
  if (!strategy) {
    return {
      enabled: false,
      strategyFound: false,
      reason: `Unknown strategy type: ${strategyName}`,
    };
  }
  const result = strategy.isEnabledWithDetails(parameters, context);
  return { ...result, strategyFound: true };
}
