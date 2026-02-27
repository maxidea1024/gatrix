/**
 * Normalized hash utility for consistent percentage bucketing.
 * Uses MurmurHash3 (via npm "murmurhash" package) for consistent
 * hashing across all platforms (TypeScript, C#, etc.).
 */

import murmurhash from 'murmurhash';

/**
 * Produces a value between 0 and 99.99 for a given id + groupId.
 * Used by percentage-based strategies for consistent bucketing.
 *
 * Formula: (murmurhash3(seed, 0) % 10000) / 100.0
 * This must match the C# StrategyUtils.CalculatePercentage exactly.
 */
export function normalizedStrategyValue(id: string, groupId: string, suffix = ''): number {
    const seed = suffix ? `${groupId}${suffix}:${id}` : `${groupId}:${id}`;
    const hash = murmurhash.v3(seed, 0);
    return (hash % 10000) / 100.0;
}
