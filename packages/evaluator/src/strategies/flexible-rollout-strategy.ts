/**
 * Flexible Rollout Strategy
 *
 * Configurable stickiness-based percentage rollout.
 * This is the only strategy that accepts a user-configurable stickiness parameter.
 */

import {
  EvaluationContext,
  StrategyParameters,
  StrategyEvaluationResult,
} from '@gatrix/shared';
import { Strategy } from './strategy';
import { normalizedStrategyValue } from './util';

export class FlexibleRolloutStrategy extends Strategy {
  constructor() {
    super('flexibleRollout');
  }

  private resolveStickiness(
    stickiness: string,
    context: EvaluationContext
  ): string | undefined {
    switch (stickiness) {
      case 'default':
        return context.userId || context.sessionId || undefined;
      case 'userId':
        return context.userId;
      case 'sessionId':
        return context.sessionId;
      case 'random':
        return String(Math.round(Math.random() * 10000) + 1);
      default: {
        // Custom stickiness field from context properties
        const value = context.properties?.[stickiness];
        return value != null ? String(value) : undefined;
      }
    }
  }

  isEnabled(
    parameters: StrategyParameters,
    context: EvaluationContext
  ): boolean {
    const stickiness = parameters.stickiness || 'default';
    const stickinessId = this.resolveStickiness(stickiness, context);
    if (!stickinessId) return false;
    const groupId = parameters.groupId || context.appName || '';
    const rollout = Number(parameters.rollout ?? 100);
    const enabled =
      rollout > 0 && normalizedStrategyValue(stickinessId, groupId) <= rollout;
    return enabled;
  }

  isEnabledWithDetails(
    parameters: StrategyParameters,
    context: EvaluationContext
  ): StrategyEvaluationResult {
    const groupId = parameters.groupId || context.appName || '';
    const rollout = Number(parameters.rollout ?? 100);
    const stickiness = parameters.stickiness || 'default';
    const stickinessId = this.resolveStickiness(stickiness, context);

    if (!stickinessId) {
      const hint =
        stickiness === 'default'
          ? ' (requires userId or sessionId)'
          : stickiness === 'userId'
            ? ' (requires userId)'
            : stickiness === 'sessionId'
              ? ' (requires sessionId)'
              : ` (requires context property "${stickiness}")`;
      return {
        enabled: false,
        reason: `No value found for stickiness "${stickiness}"${hint}`,
        details: { stickiness, rollout, groupId },
      };
    }

    const normalizedValue = normalizedStrategyValue(stickinessId, groupId);
    const enabled = rollout > 0 && normalizedValue <= rollout;

    return {
      enabled,
      reason: enabled
        ? `Rollout ${rollout}%: normalized value ${normalizedValue} <= ${rollout}`
        : `Rollout ${rollout}%: normalized value ${normalizedValue} > ${rollout}`,
      details: { stickiness, stickinessId, rollout, normalizedValue, groupId },
    };
  }
}
