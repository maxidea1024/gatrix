/**
 * Normalized hash utility for consistent percentage bucketing.
 * Uses MurmurHash3 (via npm "murmurhash" package) for consistent
 * hashing across all platforms (TypeScript, C#, etc.).
 */

import murmurhash from 'murmurhash';

/**
 * Produces a value between 0 and 100 for a given id + groupId.
 * Used by percentage-based strategies for consistent bucketing.
 *
 * Formula: (murmurhash3(seed, 0) % 10001) / 100.0
 * This must match the C# StrategyUtils.CalculatePercentage exactly.
 */
export function normalizedStrategyValue(
  id: string,
  groupId: string,
  suffix = ''
): number {
  const seed = suffix ? `${groupId}${suffix}:${id}` : `${groupId}:${id}`;
  const hash = murmurhash.v3(seed, 0);
  return (hash % 10001) / 100.0;
}

/**
 * Convert IPv4 address to 32-bit unsigned integer.
 */
export function ipToNumber(ip: string): number | null {
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
export function isInCidr(ip: string, cidr: string): boolean {
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
