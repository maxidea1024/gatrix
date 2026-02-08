import { clickhouse } from '../config/clickhouse';
import { redis } from '../config/redis';
import logger from '../utils/logger';
import FilterBuilder, { Filter } from './filter-builder';

const filterBuilder = new FilterBuilder();

/**
 * Materialized View를 활용한 최적화된 메트릭 서비스
 * OpenPanel 스타일의 고급 최적화 기술 적용
 */
export class OptimizedMetricsService {
  private cachePrefix = 'optimized_metrics:';
  private cacheTTL = 300; // 5분

  /**
   * 기본 메트릭 조회 (Materialized View 활용)
   * 필터가 없으면 사전 집계된 데이터 사용 (초고속)
   */
  async getMetrics(params: {
    projectId: string;
    startDate: string;
    endDate: string;
    filters?: Filter[];
  }): Promise<any> {
    const { projectId, startDate, endDate, filters } = params;
    const cacheKey = `${this.cachePrefix}${projectId}:${startDate}:${endDate}:${JSON.stringify(filters || [])}`;

    try {
      // 캐시 확인
      const cached = await redis.get(cacheKey);
      if (cached) {
        logger.debug('Optimized metrics cache hit', { projectId });
        return JSON.parse(cached);
      }

      let metrics: any;

      // 필터가 없으면 Materialized View 사용 (10-100배 빠름)
      if (!filters || filters.length === 0) {
        metrics = await this.getMetricsFromMaterializedView(projectId, startDate, endDate);
      } else {
        // 필터가 있으면 원본 테이블 쿼리
        metrics = await this.getMetricsWithFilters(projectId, startDate, endDate, filters);
      }

      // 캐시 저장
      await redis.setex(cacheKey, this.cacheTTL, JSON.stringify(metrics));

      return metrics;
    } catch (error: any) {
      logger.error('Failed to get optimized metrics', {
        error: error.message,
        params,
      });
      throw error;
    }
  }

  /**
   * Materialized View에서 메트릭 조회 (필터 없을 때)
   */
  private async getMetricsFromMaterializedView(
    projectId: string,
    startDate: string,
    endDate: string
  ): Promise<any> {
    const query = `
      SELECT
        uniqMerge(uniqueVisitors) as uniqueVisitors,
        uniqMerge(totalSessions) as totalSessions,
        countMerge(totalEvents) as totalEvents,
        countMerge(totalScreenViews) as totalScreenViews,
        avgMerge(avgDuration) as avgSessionDuration
      FROM event_lens.daily_metrics
      WHERE projectId = {projectId:String}
        AND date >= toDate({startDate:DateTime})
        AND date <= toDate({endDate:DateTime})
    `;

    const result = await clickhouse.query({
      query,
      query_params: { projectId, startDate, endDate },
    });

    const data: any = await result.json();
    const row = data.data?.[0] || {};

    const bounceRate =
      row.totalSessions > 0
        ? parseFloat(((row.totalScreenViews / row.totalSessions) * 100).toFixed(2))
        : 0;

    return {
      uniqueVisitors: row.uniqueVisitors || 0,
      totalSessions: row.totalSessions || 0,
      totalEvents: row.totalEvents || 0,
      totalScreenViews: row.totalScreenViews || 0,
      avgSessionDuration: Math.round(row.avgSessionDuration || 0),
      bounceRate,
    };
  }

  /**
   * 원본 이벤트 테이블에서 메트릭 조회 (필터 있을 때)
   */
  private async getMetricsWithFilters(
    projectId: string,
    startDate: string,
    endDate: string,
    filters: Filter[]
  ): Promise<any> {
    const filterClause = filterBuilder.buildFilterClause(filters);

    const query = `
      SELECT
        uniq(deviceId) as uniqueVisitors,
        uniq(sessionId) as totalSessions,
        count() as totalEvents,
        countIf(name = 'screen_view') as totalScreenViews,
        avg(duration) as avgSessionDuration
      FROM event_lens.events
      WHERE projectId = {projectId:String}
        AND createdAt >= {startDate:DateTime}
        AND createdAt <= {endDate:DateTime}
        ${filterClause}
    `;

    const result = await clickhouse.query({
      query,
      query_params: { projectId, startDate, endDate },
    });

    const data: any = await result.json();
    const row = data.data?.[0] || {};

    const bounceRate =
      row.totalSessions > 0
        ? parseFloat(((row.totalScreenViews / row.totalSessions) * 100).toFixed(2))
        : 0;

    return {
      uniqueVisitors: row.uniqueVisitors || 0,
      totalSessions: row.totalSessions || 0,
      totalEvents: row.totalEvents || 0,
      totalScreenViews: row.totalScreenViews || 0,
      avgSessionDuration: Math.round(row.avgSessionDuration || 0),
      bounceRate,
    };
  }

  /**
   * Top Pages (Materialized View 활용)
   */
  async getTopPages(params: {
    projectId: string;
    startDate: string;
    endDate: string;
    limit?: number;
  }): Promise<any[]> {
    const { projectId, startDate, endDate, limit = 10 } = params;

    try {
      const query = `
        SELECT
          path,
          countMerge(views) as views,
          uniqMerge(uniqueVisitors) as uniqueVisitors,
          avgMerge(avgDuration) as avgDuration
        FROM event_lens.path_metrics
        WHERE projectId = {projectId:String}
          AND date >= toDate({startDate:DateTime})
          AND date <= toDate({endDate:DateTime})
        GROUP BY path
        ORDER BY views DESC
        LIMIT {limit:UInt32}
      `;

      const result = await clickhouse.query({
        query,
        query_params: { projectId, startDate, endDate, limit },
      });

      const data: any = await result.json();
      return data.data || [];
    } catch (error: any) {
      logger.error('Failed to get top pages', { error: error.message, params });
      throw error;
    }
  }

  /**
   * Top Referrers (Materialized View 활용)
   */
  async getTopReferrers(params: {
    projectId: string;
    startDate: string;
    endDate: string;
    limit?: number;
  }): Promise<any[]> {
    const { projectId, startDate, endDate, limit = 10 } = params;

    try {
      const query = `
        SELECT
          referrerName,
          referrerType,
          countMerge(visits) as visits,
          uniqMerge(uniqueVisitors) as uniqueVisitors
        FROM event_lens.referrer_metrics
        WHERE projectId = {projectId:String}
          AND date >= toDate({startDate:DateTime})
          AND date <= toDate({endDate:DateTime})
        GROUP BY referrerName, referrerType
        ORDER BY visits DESC
        LIMIT {limit:UInt32}
      `;

      const result = await clickhouse.query({
        query,
        query_params: { projectId, startDate, endDate, limit },
      });

      const data: any = await result.json();
      return data.data || [];
    } catch (error: any) {
      logger.error('Failed to get top referrers', {
        error: error.message,
        params,
      });
      throw error;
    }
  }

  /**
   * Device Stats (Materialized View 활용)
   */
  async getDeviceStats(params: {
    projectId: string;
    startDate: string;
    endDate: string;
  }): Promise<any[]> {
    const { projectId, startDate, endDate } = params;

    try {
      const query = `
        SELECT
          device,
          browser,
          os,
          countMerge(count) as count,
          uniqMerge(uniqueVisitors) as uniqueVisitors
        FROM event_lens.device_metrics
        WHERE projectId = {projectId:String}
          AND date >= toDate({startDate:DateTime})
          AND date <= toDate({endDate:DateTime})
        GROUP BY device, browser, os
        ORDER BY count DESC
      `;

      const result = await clickhouse.query({
        query,
        query_params: { projectId, startDate, endDate },
      });

      const data: any = await result.json();
      return data.data || [];
    } catch (error: any) {
      logger.error('Failed to get device stats', {
        error: error.message,
        params,
      });
      throw error;
    }
  }

  /**
   * Geo Stats (Materialized View 활용)
   */
  async getGeoStats(params: {
    projectId: string;
    startDate: string;
    endDate: string;
  }): Promise<any[]> {
    const { projectId, startDate, endDate } = params;

    try {
      const query = `
        SELECT
          country,
          city,
          countMerge(count) as count,
          uniqMerge(uniqueVisitors) as uniqueVisitors
        FROM event_lens.geo_metrics
        WHERE projectId = {projectId:String}
          AND date >= toDate({startDate:DateTime})
          AND date <= toDate({endDate:DateTime})
        GROUP BY country, city
        ORDER BY count DESC
      `;

      const result = await clickhouse.query({
        query,
        query_params: { projectId, startDate, endDate },
      });

      const data: any = await result.json();
      return data.data || [];
    } catch (error: any) {
      logger.error('Failed to get geo stats', { error: error.message, params });
      throw error;
    }
  }
}

export default OptimizedMetricsService;
