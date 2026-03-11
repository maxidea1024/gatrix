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

/**
 * Convert IPv4 address to 32-bit unsigned integer.
 */
function ipToNumber(ip: string): number | null {
  const parts = ip.trim().split('.');
  if (parts.length !== 4) return null;
  let result = 0;
  for (const part of parts) {
    const num = parseInt(part, 10);
    if (isNaN(num) || num < 0 || num > 255) return null;
    result = (result << 8) + num;
  }
  return result >>> 0; // Ensure unsigned 32-bit
}

/**
 * Check if an IP address falls within a CIDR range.
 */
function isInCidr(ip: string, cidr: string): boolean {
  const [rangeIp, prefixStr] = cidr.split('/');
  const ipNum = ipToNumber(ip);
  const rangeNum = ipToNumber(rangeIp);

  if (ipNum === null || rangeNum === null) return false;

  if (!prefixStr) {
    return ipNum === rangeNum;
  }

  const prefix = parseInt(prefixStr, 10);
  if (isNaN(prefix) || prefix < 0 || prefix > 32) return false;

  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  return (ipNum & mask) === (rangeNum & mask);
}

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
