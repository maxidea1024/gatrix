/**
 * Strategy Registry
 *
 * Registers all built-in strategies and provides lookup by name.
 */

import {
  EvaluationContext,
  StrategyParameters,
  StrategyEvaluationResult,
} from '@gatrix/shared';
import { Strategy } from './strategy';
import { DefaultStrategy } from './default-strategy';
import { FlexibleRolloutStrategy } from './flexible-rollout-strategy';
import { UserWithIdStrategy } from './user-with-id-strategy';
import { GradualRolloutUserIdStrategy } from './gradual-rollout-user-id-strategy';
import { GradualRolloutRandomStrategy } from './gradual-rollout-random-strategy';
import { GradualRolloutSessionIdStrategy } from './gradual-rollout-session-id-strategy';
import { RemoteAddressStrategy } from './remote-address-strategy';
import { ApplicationHostnameStrategy } from './application-hostname-strategy';

// Re-export all strategy classes
export { Strategy } from './strategy';
export { DefaultStrategy } from './default-strategy';
export { FlexibleRolloutStrategy } from './flexible-rollout-strategy';
export { UserWithIdStrategy } from './user-with-id-strategy';
export { GradualRolloutUserIdStrategy } from './gradual-rollout-user-id-strategy';
export { GradualRolloutRandomStrategy } from './gradual-rollout-random-strategy';
export { GradualRolloutSessionIdStrategy } from './gradual-rollout-session-id-strategy';
export { RemoteAddressStrategy } from './remote-address-strategy';
export { ApplicationHostnameStrategy } from './application-hostname-strategy';
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
  return {
    enabled: strategy.isEnabled(parameters, context),
    strategyFound: true,
  };
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
  const result: StrategyEvaluationResult & { strategyFound: boolean } =
    strategy.isEnabledWithDetails(parameters, context) as any;
  result.strategyFound = true;
  return result;
}
