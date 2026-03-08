import db from '../../config/knex';
import { createLogger } from '../../config/logger';

const logger = createLogger('FeatureMetricsModel');
import { ulid } from 'ulid';
import { parseJsonField } from '../../utils/db-utils';
import { FeatureMetricsAttributes } from './types';

export class FeatureMetricsModel {
  static async recordMetrics(
    environmentId: string,
    flagName: string,
    enabled: boolean,
    variantName?: string
  ): Promise<void> {
    try {
      const bucket = new Date();
      bucket.setMinutes(0, 0, 0);
      const id = ulid();

      await db.raw(
        `INSERT INTO g_feature_metrics (id, environmentId, flagName, metricsBucket, yesCount, noCount, variantCounts)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           yesCount = yesCount + VALUES(yesCount),
           noCount = noCount + VALUES(noCount),
           variantCounts = IF(
             variantCounts IS NULL,
             VALUES(variantCounts),
             JSON_MERGE_PATCH(variantCounts, VALUES(variantCounts))
           )`,
        [
          id,
          environmentId,
          flagName,
          bucket,
          enabled ? 1 : 0,
          enabled ? 0 : 1,
          variantName ? JSON.stringify({ [variantName]: 1 }) : null,
        ]
      );
    } catch (error) {
      logger.error('Error recording metrics:', error);
    }
  }

  static async getMetrics(
    environmentId: string,
    flagName: string,
    startDate: Date,
    endDate: Date,
    appName?: string | null
  ): Promise<FeatureMetricsAttributes[]> {
    try {
      // Build base query for main metrics
      let metricsQuery = db('g_feature_metrics')
        .where('environmentId', environmentId)
        .where('flagName', flagName)
        .whereBetween('metricsBucket', [startDate, endDate]);

      // Filter by appName if provided (null means show only records with null appName)
      if (appName !== undefined) {
        if (appName === null) {
          metricsQuery = metricsQuery.whereNull('appName');
        } else {
          metricsQuery = metricsQuery.where('appName', appName);
        }
      }

      const metrics = await metricsQuery.orderBy('metricsBucket', 'asc');

      // Build variant metrics query with same appName filter
      let variantQuery = db('g_feature_variant_metrics')
        .where('environmentId', environmentId)
        .where('flagName', flagName)
        .whereBetween('metricsBucket', [startDate, endDate]);

      if (appName !== undefined) {
        if (appName === null) {
          variantQuery = variantQuery.whereNull('appName');
        } else {
          variantQuery = variantQuery.where('appName', appName);
        }
      }

      const variantMetrics = await variantQuery;

      // Group variant metrics by bucket (convert to ISO string for consistent key)
      const variantsByBucket: Record<string, Record<string, number>> = {};
      for (const vm of variantMetrics) {
        // Convert bucket to ISO string for consistent comparison
        const bucket =
          vm.metricsBucket instanceof Date
            ? vm.metricsBucket.toISOString()
            : String(vm.metricsBucket);
        if (!variantsByBucket[bucket]) {
          variantsByBucket[bucket] = {};
        }
        variantsByBucket[bucket][vm.variantName] = vm.count;
      }

      // Merge variant counts into main metrics
      return metrics.map((m: any) => {
        const bucket =
          m.metricsBucket instanceof Date
            ? m.metricsBucket.toISOString()
            : String(m.metricsBucket);
        return {
          ...m,
          variantCounts: variantsByBucket[bucket] || {},
        };
      });
    } catch (error) {
      logger.error('Error getting metrics:', error);
      throw error;
    }
  }

  /**
   * Get distinct app names used in metrics for a flag
   */
  static async getAppNames(
    environmentId: string,
    flagName: string,
    startDate: Date,
    endDate: Date
  ): Promise<string[]> {
    try {
      const result = await db('g_feature_metrics')
        .where('environmentId', environmentId)
        .where('flagName', flagName)
        .whereBetween('metricsBucket', [startDate, endDate])
        .whereNotNull('appName')
        .distinct('appName')
        .orderBy('appName', 'asc');

      return result.map((r: any) => r.appName);
    } catch (error) {
      logger.error('Error getting app names:', error);
      throw error;
    }
  }

  /**
   * Delete metrics older than the specified date
   * @param cutoffDate Records older than this date will be deleted
   * @returns Number of deleted records
   */
  static async deleteOlderThan(cutoffDate: Date): Promise<number> {
    try {
      const result = await db('g_feature_metrics')
        .where('metricsBucket', '<', cutoffDate)
        .delete();

      return result;
    } catch (error) {
      logger.error('Error deleting old metrics:', error);
      throw error;
    }
  }
}
