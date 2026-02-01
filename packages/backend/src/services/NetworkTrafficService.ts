/**
 * Network Traffic Service
 * Records and retrieves SDK API traffic data with 1-hour buckets
 */

import db from '../config/knex';

export interface TrafficRecord {
    id: number;
    environment: string;
    appName: string;
    endpoint: string;
    trafficBucket: Date;
    requestCount: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface TrafficData {
    bucket: string;
    displayTime: string;
    environment: string;
    appName: string;
    endpoint: string;
    requestCount: number;
}

export interface TrafficSummary {
    totalRequests: number;
    featuresCount: number;
    segmentsCount: number;
    activeApplications: number;
    avgRequestsPerHour: number;
}

class NetworkTrafficService {
    /**
     * Get the 1-hour bucket for a given date
     */
    private getBucket(date: Date = new Date()): string {
        const d = new Date(date);
        d.setMinutes(0, 0, 0);
        return d.toISOString().slice(0, 19).replace('T', ' ');
    }

    /**
     * Record a traffic event (fire-and-forget, non-blocking)
     * Uses INSERT ON DUPLICATE KEY UPDATE for atomic upsert
     */
    async recordTraffic(
        environment: string,
        appName: string,
        endpoint: 'features' | 'segments'
    ): Promise<void> {
        const bucket = this.getBucket();

        try {
            await db.raw(
                `INSERT INTO NetworkTraffic (environment, appName, endpoint, trafficBucket, requestCount, createdAt, updatedAt)
                 VALUES (?, ?, ?, ?, 1, UTC_TIMESTAMP(), UTC_TIMESTAMP())
                 ON DUPLICATE KEY UPDATE requestCount = requestCount + 1, updatedAt = UTC_TIMESTAMP()`,
                [environment, appName || 'unknown', endpoint, bucket]
            );
        } catch (error) {
            // Log but don't throw - this is fire-and-forget
            console.error('[NetworkTrafficService] Failed to record traffic:', error);
        }
    }

    /**
     * Get aggregated traffic data grouped by time bucket
     */
    async getAggregatedTraffic(params: {
        environments?: string[];
        appNames?: string[];
        startDate: Date;
        endDate: Date;
    }): Promise<{ bucket: string; displayTime: string; featuresCount: number; segmentsCount: number; totalCount: number }[]> {
        let query = db('NetworkTraffic')
            .select(
                'trafficBucket as bucket',
                db.raw("DATE_FORMAT(trafficBucket, '%m/%d %H:00') as displayTime"),
                db.raw("SUM(CASE WHEN endpoint = 'features' THEN requestCount ELSE 0 END) as featuresCount"),
                db.raw("SUM(CASE WHEN endpoint = 'segments' THEN requestCount ELSE 0 END) as segmentsCount"),
                db.raw("SUM(requestCount) as totalCount")
            )
            .where('trafficBucket', '>=', params.startDate)
            .where('trafficBucket', '<=', params.endDate);

        if (params.environments && params.environments.length > 0) {
            query = query.whereIn('environment', params.environments);
        }

        if (params.appNames && params.appNames.length > 0) {
            query = query.whereIn('appName', params.appNames);
        }

        const rows = await query.groupBy('trafficBucket').orderBy('trafficBucket', 'asc');

        return rows.map((row: any) => ({
            bucket: row.bucket,
            displayTime: row.displayTime,
            featuresCount: Number(row.featuresCount) || 0,
            segmentsCount: Number(row.segmentsCount) || 0,
            totalCount: Number(row.totalCount) || 0,
        }));
    }

    /**
     * Get aggregated traffic data grouped by time bucket AND appName
     */
    async getAggregatedTrafficByApp(params: {
        environments?: string[];
        appNames?: string[];
        startDate: Date;
        endDate: Date;
    }): Promise<{ bucket: string; displayTime: string; environment: string; appName: string; featuresCount: number; segmentsCount: number; totalCount: number }[]> {
        let query = db('NetworkTraffic')
            .select(
                'trafficBucket as bucket',
                db.raw("DATE_FORMAT(trafficBucket, '%m/%d %H:00') as displayTime"),
                'environment',
                'appName',
                db.raw("SUM(CASE WHEN endpoint = 'features' THEN requestCount ELSE 0 END) as featuresCount"),
                db.raw("SUM(CASE WHEN endpoint = 'segments' THEN requestCount ELSE 0 END) as segmentsCount"),
                db.raw("SUM(requestCount) as totalCount")
            )
            .where('trafficBucket', '>=', params.startDate)
            .where('trafficBucket', '<=', params.endDate);

        if (params.environments && params.environments.length > 0) {
            query = query.whereIn('environment', params.environments);
        }

        if (params.appNames && params.appNames.length > 0) {
            query = query.whereIn('appName', params.appNames);
        }

        const rows = await query.groupBy('trafficBucket', 'environment', 'appName').orderBy('trafficBucket', 'asc');

        return rows.map((row: any) => ({
            bucket: row.bucket,
            displayTime: row.displayTime,
            environment: row.environment,
            appName: row.appName,
            featuresCount: Number(row.featuresCount) || 0,
            segmentsCount: Number(row.segmentsCount) || 0,
            totalCount: Number(row.totalCount) || 0,
        }));
    }

    /**
     * Get detailed traffic data with environment and appName
     */
    async getDetailedTraffic(params: {
        environments?: string[];
        appNames?: string[];
        startDate: Date;
        endDate: Date;
    }): Promise<{ bucket: string; displayTime: string; environment: string; appName: string; featuresCount: number; segmentsCount: number; totalCount: number }[]> {
        let query = db('NetworkTraffic')
            .select(
                'trafficBucket as bucket',
                db.raw("DATE_FORMAT(trafficBucket, '%m/%d %H:00') as displayTime"),
                'environment',
                'appName',
                db.raw("SUM(CASE WHEN endpoint = 'features' THEN requestCount ELSE 0 END) as featuresCount"),
                db.raw("SUM(CASE WHEN endpoint = 'segments' THEN requestCount ELSE 0 END) as segmentsCount"),
                db.raw("SUM(requestCount) as totalCount")
            )
            .where('trafficBucket', '>=', params.startDate)
            .where('trafficBucket', '<=', params.endDate);

        if (params.environments && params.environments.length > 0) {
            query = query.whereIn('environment', params.environments);
        }

        if (params.appNames && params.appNames.length > 0) {
            query = query.whereIn('appName', params.appNames);
        }

        const rows = await query
            .groupBy('trafficBucket', 'environment', 'appName')
            .orderBy('trafficBucket', 'desc');

        return rows.map((row: any) => ({
            bucket: row.bucket,
            displayTime: row.displayTime,
            environment: row.environment,
            appName: row.appName,
            featuresCount: Number(row.featuresCount) || 0,
            segmentsCount: Number(row.segmentsCount) || 0,
            totalCount: Number(row.totalCount) || 0,
        }));
    }

    /**
     * Get list of active applications
     */
    async getActiveApplications(params: {
        environments?: string[];
        startDate: Date;
        endDate: Date;
    }): Promise<string[]> {
        let query = db('NetworkTraffic')
            .distinct('appName')
            .where('trafficBucket', '>=', params.startDate)
            .where('trafficBucket', '<=', params.endDate);

        if (params.environments && params.environments.length > 0) {
            query = query.whereIn('environment', params.environments);
        }

        const rows = await query.orderBy('appName', 'asc');

        return rows.map((row: any) => row.appName);
    }

    /**
     * Get traffic summary
     */
    async getTrafficSummary(params: {
        environments?: string[];
        appNames?: string[];
        startDate: Date;
        endDate: Date;
    }): Promise<TrafficSummary> {
        let query = db('NetworkTraffic')
            .select(
                db.raw('COALESCE(SUM(requestCount), 0) as totalRequests'),
                db.raw("COALESCE(SUM(CASE WHEN endpoint = 'features' THEN requestCount ELSE 0 END), 0) as featuresCount"),
                db.raw("COALESCE(SUM(CASE WHEN endpoint = 'segments' THEN requestCount ELSE 0 END), 0) as segmentsCount"),
                db.raw('COUNT(DISTINCT appName) as activeApplications'),
                db.raw('COUNT(DISTINCT trafficBucket) as bucketCount')
            )
            .where('trafficBucket', '>=', params.startDate)
            .where('trafficBucket', '<=', params.endDate);

        if (params.environments && params.environments.length > 0) {
            query = query.whereIn('environment', params.environments);
        }

        if (params.appNames && params.appNames.length > 0) {
            query = query.whereIn('appName', params.appNames);
        }

        const rows = await query;
        const row = rows[0] || { totalRequests: 0, featuresCount: 0, segmentsCount: 0, activeApplications: 0, bucketCount: 0 };

        const bucketCount = Number(row.bucketCount) || 1;
        const avgRequestsPerHour = Math.round(Number(row.totalRequests) / bucketCount);

        return {
            totalRequests: Number(row.totalRequests) || 0,
            featuresCount: Number(row.featuresCount) || 0,
            segmentsCount: Number(row.segmentsCount) || 0,
            activeApplications: Number(row.activeApplications) || 0,
            avgRequestsPerHour,
        };
    }

    /**
     * Clean up old traffic data (older than specified days)
     */
    async cleanupOldData(retentionDays: number = 30): Promise<number> {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

        const result = await db('NetworkTraffic')
            .where('trafficBucket', '<', cutoffDate)
            .del();

        return result;
    }

    /**
     * Get flag evaluation summary from g_feature_metrics table
     */
    async getFlagEvaluationSummary(params: {
        environments?: string[];
        appNames?: string[];
        startDate: Date;
        endDate: Date;
    }): Promise<{ totalEvaluations: number; yesCount: number; noCount: number }> {
        let query = db('g_feature_metrics')
            .select(
                db.raw('COALESCE(SUM(yesCount + noCount), 0) as totalEvaluations'),
                db.raw('COALESCE(SUM(yesCount), 0) as yesCount'),
                db.raw('COALESCE(SUM(noCount), 0) as noCount')
            )
            .where('metricsBucket', '>=', params.startDate)
            .where('metricsBucket', '<=', params.endDate);

        if (params.environments && params.environments.length > 0) {
            query = query.whereIn('environment', params.environments);
        }

        if (params.appNames && params.appNames.length > 0) {
            query = query.whereIn('appName', params.appNames);
        }

        const rows = await query;
        const row = rows[0] || { totalEvaluations: 0, yesCount: 0, noCount: 0 };

        return {
            totalEvaluations: Number(row.totalEvaluations) || 0,
            yesCount: Number(row.yesCount) || 0,
            noCount: Number(row.noCount) || 0,
        };
    }

    /**
     * Get flag evaluation time series data from g_feature_metrics table
     */
    async getFlagEvaluationTimeSeries(params: {
        environments?: string[];
        appNames?: string[];
        startDate: Date;
        endDate: Date;
    }): Promise<{ bucket: string; displayTime: string; evaluations: number; yesCount: number; noCount: number }[]> {
        let query = db('g_feature_metrics')
            .select(
                'metricsBucket as bucket',
                db.raw("DATE_FORMAT(metricsBucket, '%m/%d %H:00') as displayTime"),
                db.raw('COALESCE(SUM(yesCount + noCount), 0) as evaluations'),
                db.raw('COALESCE(SUM(yesCount), 0) as yesCount'),
                db.raw('COALESCE(SUM(noCount), 0) as noCount')
            )
            .where('metricsBucket', '>=', params.startDate)
            .where('metricsBucket', '<=', params.endDate);

        if (params.environments && params.environments.length > 0) {
            query = query.whereIn('environment', params.environments);
        }

        if (params.appNames && params.appNames.length > 0) {
            query = query.whereIn('appName', params.appNames);
        }

        const rows = await query.groupBy('metricsBucket').orderBy('metricsBucket', 'asc');

        return rows.map((row: any) => ({
            bucket: row.bucket,
            displayTime: row.displayTime,
            evaluations: Number(row.evaluations) || 0,
            yesCount: Number(row.yesCount) || 0,
            noCount: Number(row.noCount) || 0,
        }));
    }

    /**
     * Get flag evaluation time series data grouped by time bucket AND appName
     */
    async getFlagEvaluationTimeSeriesByApp(params: {
        environments?: string[];
        appNames?: string[];
        startDate: Date;
        endDate: Date;
    }): Promise<{ bucket: string; displayTime: string; environment: string; appName: string; evaluations: number; yesCount: number; noCount: number }[]> {
        let query = db('g_feature_metrics')
            .select(
                'metricsBucket as bucket',
                db.raw("DATE_FORMAT(metricsBucket, '%m/%d %H:00') as displayTime"),
                'environment',
                'appName',
                db.raw('COALESCE(SUM(yesCount + noCount), 0) as evaluations'),
                db.raw('COALESCE(SUM(yesCount), 0) as yesCount'),
                db.raw('COALESCE(SUM(noCount), 0) as noCount')
            )
            .where('metricsBucket', '>=', params.startDate)
            .where('metricsBucket', '<=', params.endDate);

        if (params.environments && params.environments.length > 0) {
            query = query.whereIn('environment', params.environments);
        }

        if (params.appNames && params.appNames.length > 0) {
            query = query.whereIn('appName', params.appNames);
        }

        const rows = await query.groupBy('metricsBucket', 'environment', 'appName').orderBy('metricsBucket', 'asc');

        return rows.map((row: any) => ({
            bucket: row.bucket,
            displayTime: row.displayTime,
            environment: row.environment,
            appName: row.appName,
            evaluations: Number(row.evaluations) || 0,
            yesCount: Number(row.yesCount) || 0,
            noCount: Number(row.noCount) || 0,
        }));
    }
}

export const networkTrafficService = new NetworkTrafficService();

