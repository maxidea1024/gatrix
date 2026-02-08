import { clickhouse } from '../config/clickhouse';
import logger from '../utils/logger';
import { RetentionData } from '../types';

export class RetentionService {
  async analyzeRetention(params: {
    projectId: string;
    startDate: string;
    endDate: string;
    period?: 'day' | 'week' | 'month';
  }): Promise<RetentionData[]> {
    const { projectId, startDate, endDate, period = 'day' } = params;

    try {
      const query = `
        WITH
          first_seen AS (
            SELECT
              deviceId,
              toDate(min(createdAt)) as cohortDate
            FROM events
            WHERE projectId = {projectId:String}
              AND createdAt >= {startDate:DateTime}
              AND createdAt <= {endDate:DateTime}
            GROUP BY deviceId
          ),
          activity AS (
            SELECT
              deviceId,
              toDate(createdAt) as activityDate
            FROM events
            WHERE projectId = {projectId:String}
              AND createdAt >= {startDate:DateTime}
              AND createdAt <= {endDate:DateTime}
            GROUP BY deviceId, activityDate
          )
        
        SELECT
          cohortDate,
          dateDiff('${period}', cohortDate, activityDate) as periodNumber,
          count(DISTINCT activity.deviceId) as retainedUsers,
          (SELECT count(DISTINCT deviceId) FROM first_seen fs WHERE fs.cohortDate = first_seen.cohortDate) as cohortSize,
          retainedUsers / cohortSize * 100 as retentionRate
        FROM first_seen
        LEFT JOIN activity ON first_seen.deviceId = activity.deviceId
        GROUP BY cohortDate, periodNumber
        ORDER BY cohortDate, periodNumber
      `;

      const result = await clickhouse.query({
        query,
        query_params: { projectId, startDate, endDate },
      });

      const data: any = await result.json();
      return data.data || [];
    } catch (error) {
      logger.error('Failed to analyze retention', { error, params });
      throw error;
    }
  }

  async getCohortRetention(params: {
    projectId: string;
    cohortDate: string;
    period?: 'day' | 'week' | 'month';
    periods?: number;
  }): Promise<RetentionData[]> {
    const { projectId, cohortDate, period = 'day', periods = 30 } = params;

    try {
      const query = `
        WITH
          cohort AS (
            SELECT DISTINCT deviceId
            FROM events
            WHERE projectId = {projectId:String}
              AND toDate(createdAt) = {cohortDate:Date}
          ),
          activity AS (
            SELECT
              deviceId,
              toDate(createdAt) as activityDate
            FROM events
            WHERE projectId = {projectId:String}
              AND deviceId IN (SELECT deviceId FROM cohort)
              AND createdAt >= {cohortDate:Date}
            GROUP BY deviceId, activityDate
          )
        
        SELECT
          {cohortDate:Date} as cohortDate,
          dateDiff('${period}', {cohortDate:Date}, activityDate) as periodNumber,
          count(DISTINCT deviceId) as retainedUsers,
          (SELECT count(*) FROM cohort) as cohortSize,
          retainedUsers / cohortSize * 100 as retentionRate
        FROM activity
        WHERE periodNumber <= {periods:UInt32}
        GROUP BY periodNumber
        ORDER BY periodNumber
      `;

      const result = await clickhouse.query({
        query,
        query_params: { projectId, cohortDate, periods },
      });

      const data: any = await result.json();
      return data.data || [];
    } catch (error) {
      logger.error('Failed to get cohort retention', { error, params });
      throw error;
    }
  }
}

export default RetentionService;
