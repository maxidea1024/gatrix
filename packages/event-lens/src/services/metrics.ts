import { clickhouse } from "../config/clickhouse";
import { redis } from "../config/redis";
import logger from "../utils/logger";
import { Metrics, TimeSeriesData, TopPage } from "../types";

export class MetricsService {
  private cachePrefix = "metrics:";
  private cacheTTL = 300; // 5분

  async getMetrics(params: {
    projectId: string;
    startDate: string;
    endDate: string;
  }): Promise<Metrics> {
    const { projectId, startDate, endDate } = params;
    const cacheKey = `${this.cachePrefix}${projectId}:${startDate}:${endDate}`;

    try {
      // 캐시 확인
      const cached = await redis.get(cacheKey);
      if (cached) {
        logger.debug("Metrics cache hit", { projectId });
        return JSON.parse(cached);
      }

      // ClickHouse 쿼리
      const query = `
        SELECT
          uniq(deviceId) as uniqueVisitors,
          uniq(sessionId) as totalSessions,
          countIf(name = 'screen_view') as totalScreenViews,
          avg(duration) as avgSessionDuration,
          countIf(screenViews = 1) / totalSessions * 100 as bounceRate
        FROM events
        WHERE projectId = {projectId:String}
          AND createdAt >= {startDate:DateTime}
          AND createdAt <= {endDate:DateTime}
      `;

      const result = await clickhouse.query({
        query,
        query_params: { projectId, startDate, endDate },
      });

      const data: any = await result.json();
      const metrics: Metrics = data.data?.[0] || {
        uniqueVisitors: 0,
        totalSessions: 0,
        totalScreenViews: 0,
        avgSessionDuration: 0,
        bounceRate: 0,
      };

      // 캐시 저장
      await redis.setex(cacheKey, this.cacheTTL, JSON.stringify(metrics));

      return metrics;
    } catch (error) {
      logger.error("Failed to get metrics", { error, params });
      throw error;
    }
  }

  async getTimeSeries(params: {
    projectId: string;
    startDate: string;
    endDate: string;
    interval?: "hour" | "day" | "week" | "month";
  }): Promise<TimeSeriesData[]> {
    const { projectId, startDate, endDate, interval = "day" } = params;

    try {
      const intervalFunc = {
        hour: "toStartOfHour",
        day: "toDate",
        week: "toMonday",
        month: "toStartOfMonth",
      }[interval];

      const query = `
        SELECT
          ${intervalFunc}(createdAt) as date,
          uniq(deviceId) as uniqueVisitors,
          uniq(sessionId) as totalSessions,
          count() as totalEvents
        FROM events
        WHERE projectId = {projectId:String}
          AND createdAt >= {startDate:DateTime}
          AND createdAt <= {endDate:DateTime}
        GROUP BY date
        ORDER BY date
      `;

      const result = await clickhouse.query({
        query,
        query_params: { projectId, startDate, endDate },
      });

      const data: any = await result.json();
      return data.data || [];
    } catch (error) {
      logger.error("Failed to get time series", { error, params });
      throw error;
    }
  }

  async getTopPages(params: {
    projectId: string;
    startDate: string;
    endDate: string;
    limit?: number;
  }): Promise<TopPage[]> {
    const { projectId, startDate, endDate, limit = 10 } = params;

    try {
      const query = `
        SELECT
          path,
          count() as views,
          uniq(deviceId) as uniqueVisitors
        FROM events
        WHERE projectId = {projectId:String}
          AND createdAt >= {startDate:DateTime}
          AND createdAt <= {endDate:DateTime}
          AND name = 'screen_view'
          AND path IS NOT NULL
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
    } catch (error) {
      logger.error("Failed to get top pages", { error, params });
      throw error;
    }
  }

  async getLiveVisitors(projectId: string): Promise<number> {
    try {
      const query = `
        SELECT uniq(deviceId) as count
        FROM events
        WHERE projectId = {projectId:String}
          AND createdAt >= now() - INTERVAL 5 MINUTE
      `;

      const result = await clickhouse.query({
        query,
        query_params: { projectId },
      });

      const data: any = await result.json();
      return data.data?.[0]?.count || 0;
    } catch (error) {
      logger.error("Failed to get live visitors", { error, projectId });
      throw error;
    }
  }

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
          count() as visits,
          uniq(deviceId) as uniqueVisitors
        FROM events
        WHERE projectId = {projectId:String}
          AND createdAt >= {startDate:DateTime}
          AND createdAt <= {endDate:DateTime}
          AND referrerName IS NOT NULL
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
    } catch (error) {
      logger.error("Failed to get top referrers", { error, params });
      throw error;
    }
  }

  async getDeviceStats(params: {
    projectId: string;
    startDate: string;
    endDate: string;
  }): Promise<any> {
    const { projectId, startDate, endDate } = params;

    try {
      const query = `
        SELECT
          device,
          browser,
          os,
          count() as count,
          uniq(deviceId) as uniqueVisitors
        FROM events
        WHERE projectId = {projectId:String}
          AND createdAt >= {startDate:DateTime}
          AND createdAt <= {endDate:DateTime}
        GROUP BY device, browser, os
        ORDER BY count DESC
      `;

      const result = await clickhouse.query({
        query,
        query_params: { projectId, startDate, endDate },
      });

      const data: any = await result.json();
      return data.data || [];
    } catch (error) {
      logger.error("Failed to get device stats", { error, params });
      throw error;
    }
  }

  async getGeoStats(params: {
    projectId: string;
    startDate: string;
    endDate: string;
  }): Promise<any> {
    const { projectId, startDate, endDate } = params;

    try {
      const query = `
        SELECT
          country,
          city,
          count() as count,
          uniq(deviceId) as uniqueVisitors
        FROM events
        WHERE projectId = {projectId:String}
          AND createdAt >= {startDate:DateTime}
          AND createdAt <= {endDate:DateTime}
          AND country IS NOT NULL
        GROUP BY country, city
        ORDER BY count DESC
      `;

      const result = await clickhouse.query({
        query,
        query_params: { projectId, startDate, endDate },
      });

      return result.json();
    } catch (error) {
      logger.error("Failed to get geo stats", { error, params });
      throw error;
    }
  }
}

export default MetricsService;
