/**
 * User With ID Strategy
 *
 * Enables feature for specific user IDs listed in parameters.userIds.
 * No stickiness - direct userId match.
 */

import {
  EvaluationContext,
  StrategyParameters,
  StrategyEvaluationResult,
} from '@gatrix/shared';
import { Strategy } from './strategy';

export class UserWithIdStrategy extends Strategy {
  constructor() {
    super('userWithId');
  }

  isEnabled(
    parameters: StrategyParameters,
    context: EvaluationContext
  ): boolean {
    const userIds = parameters.userIds;
    if (!userIds || !context.userId) return false;
    const matched = userIds.split(/\s*,\s*/).includes(context.userId);
    return matched;
  }

  isEnabledWithDetails(
    parameters: StrategyParameters,
    context: EvaluationContext
  ): StrategyEvaluationResult {
    const userIds = parameters.userIds;
    if (!userIds) {
      return { enabled: false, reason: 'No userIds defined in parameters' };
    }

    if (!context.userId) {
      return {
        enabled: false,
        reason: 'No userId in context',
        details: { userIds },
      };
    }

    const userIdList = userIds.split(/\s*,\s*/);
    const matched = userIdList.includes(context.userId);

    return {
      enabled: matched,
      reason: matched
        ? `userId "${context.userId}" found in list`
        : `userId "${context.userId}" not in list [${userIdList.join(', ')}]`,
      details: { contextUserId: context.userId, userIdList },
    };
  }
}
