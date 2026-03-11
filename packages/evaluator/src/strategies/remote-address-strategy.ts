/**
 * Remote Address Strategy
 *
 * Enables feature for users from specific IP addresses.
 * Supports exact match and CIDR notation (e.g., 192.168.1.0/24).
 */

import {
  EvaluationContext,
  StrategyParameters,
  StrategyEvaluationResult,
} from '@gatrix/shared';
import { Strategy } from './strategy';
import { isInCidr } from './util';

export class RemoteAddressStrategy extends Strategy {
  constructor() {
    super('remoteAddress');
  }

  isEnabled(
    parameters: StrategyParameters,
    context: EvaluationContext
  ): boolean {
    const ips = parameters.IPs;
    if (!ips) return false;
    const remoteAddress = context.remoteAddress;
    if (!remoteAddress) return false;
    const matched = ips
      .split(/\s*,\s*/)
      .some(
        (range: string) =>
          range === remoteAddress || isInCidr(remoteAddress, range)
      );
    return matched;
  }

  isEnabledWithDetails(
    parameters: StrategyParameters,
    context: EvaluationContext
  ): StrategyEvaluationResult {
    const ips = parameters.IPs;
    if (!ips) {
      return { enabled: false, reason: 'No IPs defined in parameters' };
    }

    const remoteAddress = context.remoteAddress;
    if (!remoteAddress) {
      return {
        enabled: false,
        reason: 'No remoteAddress in context',
        details: { IPs: ips },
      };
    }

    const ranges = ips.split(/\s*,\s*/);
    const matchedRange = ranges.find((range: string) => {
      if (range === remoteAddress) return true;
      return isInCidr(remoteAddress, range);
    });

    return {
      enabled: !!matchedRange,
      reason: matchedRange
        ? `remoteAddress "${remoteAddress}" matched range "${matchedRange}"`
        : `remoteAddress "${remoteAddress}" not in any range [${ranges.join(', ')}]`,
      details: { remoteAddress, ranges, matchedRange },
    };
  }
}
