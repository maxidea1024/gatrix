import * as murmur from 'murmurhash';

/**
 * Traffic Splitter for A/B Testing
 * Uses consistent hashing to ensure users always get the same variant
 */
export class TrafficSplitter {
  /**
   * Generate a consistent hash for a user and experiment using MurmurHash
   * @param userId - User identifier
   * @param experimentId - Experiment/variant identifier
   * @param salt - Optional salt for additional randomization
   * @returns Hash value between 0 and 1
   */
  private static generateHash(userId: string, experimentId: string, salt: string = ''): number {
    const input = `${userId}:${experimentId}:${salt}`;

    // Use MurmurHash v3 for fast, consistent hashing
    // Seed value can be used for additional randomization if needed
    const seed = 0x12345678; // Fixed seed for consistency
    const hashValue = murmur.v3(input, seed);

    // Convert to number between 0 and 1
    // MurmurHash v3 returns a 32-bit unsigned integer
    const maxValue = 0xFFFFFFFF; // 2^32 - 1
    return hashValue / maxValue;
  }

  /**
   * Determine which variant a user should receive
   * @param userId - User identifier
   * @param variants - Array of variants with their traffic percentages
   * @param experimentId - Experiment identifier for consistent hashing
   * @returns Selected variant or null if user is not in any variant
   */
  static selectVariant<T extends { id: number | string; trafficPercentage: number }>(
    userId: string,
    variants: T[],
    experimentId: string
  ): T | null {
    if (!userId || !variants.length) {
      return null;
    }

    // Validate that traffic percentages sum to <= 100
    const totalTraffic = variants.reduce((sum, variant) => sum + variant.trafficPercentage, 0);
    if (totalTraffic > 100) {
      throw new Error(`Total traffic percentage (${totalTraffic}%) exceeds 100%`);
    }

    // Generate consistent hash for this user and experiment
    const hash = this.generateHash(userId, experimentId);
    const hashPercentage = hash * 100;

    // Find which variant this user falls into
    let cumulativePercentage = 0;
    for (const variant of variants) {
      cumulativePercentage += variant.trafficPercentage;
      if (hashPercentage < cumulativePercentage) {
        return variant;
      }
    }

    // User is not in any variant (falls into the remaining percentage)
    return null;
  }

  /**
   * Check if a user is in a specific variant
   * @param userId - User identifier
   * @param variantId - Variant identifier
   * @param trafficPercentage - Traffic percentage for this variant
   * @param experimentId - Experiment identifier
   * @returns True if user is in this variant
   */
  static isUserInVariant(
    userId: string,
    variantId: string | number,
    trafficPercentage: number,
    experimentId: string
  ): boolean {
    if (!userId || trafficPercentage <= 0) {
      return false;
    }

    const hash = this.generateHash(userId, `${experimentId}:${variantId}`);
    const hashPercentage = hash * 100;

    return hashPercentage < trafficPercentage;
  }

  /**
   * Split users into multiple groups for multivariate testing
   * @param userId - User identifier
   * @param groups - Array of group configurations
   * @param experimentId - Experiment identifier
   * @returns Object with group assignments
   */
  static multivariateAssignment<T extends Record<string, { variants: Array<{ id: string | number; percentage: number }> }>>(
    userId: string,
    groups: T,
    experimentId: string
  ): Record<keyof T, string | number | null> {
    const result: Record<keyof T, string | number | null> = {} as any;

    for (const [groupName, groupConfig] of Object.entries(groups)) {
      const hash = this.generateHash(userId, `${experimentId}:${groupName}`);
      const hashPercentage = hash * 100;

      let cumulativePercentage = 0;
      let selectedVariant: string | number | null = null;

      for (const variant of groupConfig.variants) {
        cumulativePercentage += variant.percentage;
        if (hashPercentage < cumulativePercentage) {
          selectedVariant = variant.id;
          break;
        }
      }

      result[groupName as keyof T] = selectedVariant;
    }

    return result;
  }

  /**
   * Calculate the actual distribution of users across variants
   * @param userIds - Array of user identifiers
   * @param variants - Array of variants with traffic percentages
   * @param experimentId - Experiment identifier
   * @returns Distribution statistics
   */
  static calculateDistribution<T extends { id: number | string; trafficPercentage: number }>(
    userIds: string[],
    variants: T[],
    experimentId: string
  ): {
    totalUsers: number;
    variantCounts: Record<string, number>;
    controlCount: number;
    actualPercentages: Record<string, number>;
  } {
    const variantCounts: Record<string, number> = {};
    let controlCount = 0;

    // Initialize counts
    variants.forEach(variant => {
      variantCounts[variant.id.toString()] = 0;
    });

    // Count assignments
    userIds.forEach(userId => {
      const selectedVariant = this.selectVariant(userId, variants, experimentId);
      if (selectedVariant) {
        variantCounts[selectedVariant.id.toString()]++;
      } else {
        controlCount++;
      }
    });

    // Calculate actual percentages
    const totalUsers = userIds.length;
    const actualPercentages: Record<string, number> = {};
    Object.entries(variantCounts).forEach(([variantId, count]) => {
      actualPercentages[variantId] = totalUsers > 0 ? (count / totalUsers) * 100 : 0;
    });

    return {
      totalUsers,
      variantCounts,
      controlCount,
      actualPercentages,
    };
  }

  /**
   * Generate a deterministic user bucket (0-99) for percentage-based experiments
   * @param userId - User identifier
   * @param experimentId - Experiment identifier
   * @returns Bucket number (0-99)
   */
  static getUserBucket(userId: string, experimentId: string): number {
    const hash = this.generateHash(userId, experimentId);
    return Math.floor(hash * 100);
  }

  /**
   * Fast bucket assignment using MurmurHash directly
   * @param userId - User identifier
   * @param experimentId - Experiment identifier
   * @param bucketCount - Number of buckets (default: 100)
   * @returns Bucket number (0 to bucketCount-1)
   */
  static getFastBucket(userId: string, experimentId: string, bucketCount: number = 100): number {
    const input = `${userId}:${experimentId}`;
    const hashValue = murmur.v3(input, 0x12345678);
    return hashValue % bucketCount;
  }

  /**
   * High-performance variant selection for A/B testing
   * Uses direct modulo operation for better performance
   * @param userId - User identifier
   * @param variants - Array of variants with their traffic percentages
   * @param experimentId - Experiment identifier
   * @returns Selected variant or null
   */
  static selectVariantFast<T extends { id: number | string; trafficPercentage: number }>(
    userId: string,
    variants: T[],
    experimentId: string
  ): T | null {
    if (!userId || !variants.length) {
      return null;
    }

    // Validate traffic percentages
    const totalTraffic = variants.reduce((sum, variant) => sum + variant.trafficPercentage, 0);
    if (totalTraffic > 100) {
      throw new Error(`Total traffic percentage (${totalTraffic}%) exceeds 100%`);
    }

    // Use fast bucket assignment
    const bucket = this.getFastBucket(userId, experimentId, 10000); // Use 10000 for better precision
    const bucketPercentage = bucket / 100; // Convert to percentage (0-99.99)

    // Find which variant this user falls into
    let cumulativePercentage = 0;
    for (const variant of variants) {
      cumulativePercentage += variant.trafficPercentage;
      if (bucketPercentage < cumulativePercentage) {
        return variant;
      }
    }

    return null;
  }

  /**
   * Check if user is in a percentage-based experiment
   * @param userId - User identifier
   * @param percentage - Experiment percentage (0-100)
   * @param experimentId - Experiment identifier
   * @returns True if user is in the experiment
   */
  static isUserInExperiment(userId: string, percentage: number, experimentId: string): boolean {
    if (percentage <= 0) return false;
    if (percentage >= 100) return true;

    const bucket = this.getUserBucket(userId, experimentId);
    return bucket < percentage;
  }
}

/**
 * Utility functions for campaign and rule evaluation
 */
export class CampaignEvaluator {
  /**
   * Check if a campaign is currently active based on time
   * @param startDate - Campaign start date
   * @param endDate - Campaign end date
   * @param now - Current time (defaults to now)
   * @returns True if campaign is active
   */
  static isCampaignActive(startDate: Date, endDate: Date, now: Date = new Date()): boolean {
    return now >= startDate && now <= endDate;
  }

  /**
   * Get the priority order for overlapping campaigns
   * @param campaigns - Array of campaigns with priorities
   * @returns Sorted campaigns by priority (highest first)
   */
  static sortCampaignsByPriority<T extends { priority: number }>(campaigns: T[]): T[] {
    return [...campaigns].sort((a, b) => b.priority - a.priority);
  }

  /**
   * Find the highest priority active campaign for a user
   * @param userId - User identifier
   * @param campaigns - Array of campaigns
   * @param now - Current time
   * @returns Active campaign with highest priority or null
   */
  static getActiveCampaign<T extends {
    id: number | string;
    priority: number;
    startDate: Date;
    endDate: Date;
    trafficPercentage?: number;
  }>(
    userId: string,
    campaigns: T[],
    now: Date = new Date()
  ): T | null {
    // Filter active campaigns
    const activeCampaigns = campaigns.filter(campaign =>
      this.isCampaignActive(campaign.startDate, campaign.endDate, now)
    );

    if (!activeCampaigns.length) {
      return null;
    }

    // Sort by priority
    const sortedCampaigns = this.sortCampaignsByPriority(activeCampaigns);

    // Find first campaign that includes this user
    for (const campaign of sortedCampaigns) {
      if (campaign.trafficPercentage) {
        if (TrafficSplitter.isUserInExperiment(userId, campaign.trafficPercentage, campaign.id.toString())) {
          return campaign;
        }
      } else {
        // If no traffic percentage specified, include all users
        return campaign;
      }
    }

    return null;
  }
}

/**
 * Performance and validation utilities for traffic splitting
 */
export class TrafficSplitterUtils {
  /**
   * Test hash distribution quality
   * @param sampleSize - Number of samples to test
   * @param experimentId - Experiment identifier
   * @returns Distribution statistics
   */
  static testHashDistribution(sampleSize: number = 100000, experimentId: string = 'test'): {
    buckets: number[];
    mean: number;
    variance: number;
    standardDeviation: number;
    uniformityScore: number; // 0-1, closer to 1 is better
  } {
    const buckets = new Array(100).fill(0);

    // Generate sample user IDs and count bucket assignments
    for (let i = 0; i < sampleSize; i++) {
      const userId = `user_${i}`;
      const bucket = TrafficSplitter.getUserBucket(userId, experimentId);
      buckets[bucket]++;
    }

    // Calculate statistics
    const mean = sampleSize / 100;

    const variance = buckets.reduce((sum, count) => {
      return sum + Math.pow(count - mean, 2);
    }, 0) / 100;

    const standardDeviation = Math.sqrt(variance);

    // Uniformity score: 1 - (coefficient of variation)
    const coefficientOfVariation = standardDeviation / mean;
    const uniformityScore = Math.max(0, 1 - coefficientOfVariation);

    return {
      buckets,
      mean,
      variance,
      standardDeviation,
      uniformityScore
    };
  }

  /**
   * Benchmark hash performance
   * @param iterations - Number of iterations to test
   * @returns Performance metrics
   */
  static benchmarkHashPerformance(iterations: number = 1000000): {
    murmurHashTime: number;
    operationsPerSecond: number;
    averageTimePerOperation: number;
  } {
    const startTime = process.hrtime.bigint();

    // Test MurmurHash performance
    for (let i = 0; i < iterations; i++) {
      const userId = `user_${i}`;
      const experimentId = `exp_${i % 100}`;
      TrafficSplitter.getFastBucket(userId, experimentId);
    }

    const endTime = process.hrtime.bigint();
    const totalTime = Number(endTime - startTime) / 1000000; // Convert to milliseconds

    return {
      murmurHashTime: totalTime,
      operationsPerSecond: Math.round((iterations / totalTime) * 1000),
      averageTimePerOperation: totalTime / iterations
    };
  }

  /**
   * Validate variant distribution accuracy
   * @param variants - Variants with expected percentages
   * @param sampleSize - Number of samples to test
   * @param experimentId - Experiment identifier
   * @returns Accuracy metrics
   */
  static validateVariantDistribution<T extends { id: string | number; trafficPercentage: number }>(
    variants: T[],
    sampleSize: number = 100000,
    experimentId: string = 'test'
  ): {
    expected: Record<string, number>;
    actual: Record<string, number>;
    accuracy: Record<string, number>; // Percentage accuracy
    overallAccuracy: number;
  } {
    const variantCounts: Record<string, number> = {};
    const expected: Record<string, number> = {};

    // Initialize counters
    variants.forEach(variant => {
      variantCounts[variant.id.toString()] = 0;
      expected[variant.id.toString()] = variant.trafficPercentage;
    });

    // Generate samples
    for (let i = 0; i < sampleSize; i++) {
      const userId = `user_${i}`;
      const selectedVariant = TrafficSplitter.selectVariantFast(userId, variants, experimentId);

      if (selectedVariant) {
        variantCounts[selectedVariant.id.toString()]++;
      }
    }

    // Calculate actual percentages and accuracy
    const actual: Record<string, number> = {};
    const accuracy: Record<string, number> = {};
    let totalAccuracy = 0;

    variants.forEach(variant => {
      const variantId = variant.id.toString();
      actual[variantId] = (variantCounts[variantId] / sampleSize) * 100;
      accuracy[variantId] = 100 - Math.abs(expected[variantId] - actual[variantId]);
      totalAccuracy += accuracy[variantId];
    });

    const overallAccuracy = totalAccuracy / variants.length;

    return {
      expected,
      actual,
      accuracy,
      overallAccuracy
    };
  }

  /**
   * Test consistency across multiple calls
   * @param userId - User identifier
   * @param experimentId - Experiment identifier
   * @param iterations - Number of iterations to test
   * @returns True if all calls return the same result
   */
  static testConsistency(userId: string, experimentId: string, iterations: number = 1000): boolean {
    const firstBucket = TrafficSplitter.getUserBucket(userId, experimentId);

    for (let i = 1; i < iterations; i++) {
      const bucket = TrafficSplitter.getUserBucket(userId, experimentId);
      if (bucket !== firstBucket) {
        return false;
      }
    }

    return true;
  }
}

export default TrafficSplitter;
