/**
 * Impact Metrics Controller
 *
 * Handles:
 * - POST /api/v1/server/impact-metrics — Receive impact metrics from SDK
 * - GET /api/v1/admin/impact-metrics — Query Prometheus for time-series data (for charts)
 * - GET /api/v1/admin/impact-metrics/available — List available impact metrics
 */

import { Request, Response } from 'express';
import { impactMetricsService } from '../services/ImpactMetricsService';
import logger from '../config/logger';

class ImpactMetricsController {
    private isInitialized = false;

    /**
     * Ensure the impact metrics registry is initialized (lazy)
     */
    private ensureInitialized(): void {
        if (!this.isInitialized) {
            impactMetricsService.initialize();
            this.isInitialized = true;
        }
    }

    /**
     * Receive impact metrics from SDK
     * POST /api/v1/server/impact-metrics
     */
    async receiveMetrics(req: Request, res: Response): Promise<void> {
        try {
            this.ensureInitialized();
            const { impactMetrics, sdkVersion } = req.body;

            if (!impactMetrics || !Array.isArray(impactMetrics) || impactMetrics.length === 0) {
                res.status(200).json({ success: true }); // No-op for empty metrics
                return;
            }

            logger.debug('[ImpactMetrics] Received metrics from SDK', {
                count: impactMetrics.length,
                sdkVersion,
            });

            impactMetricsService.processImpactMetrics(impactMetrics);

            res.status(202).json({ success: true });
        } catch (error: any) {
            logger.error('[ImpactMetrics] Failed to process metrics', {
                error: error.message,
            });
            res.status(500).json({
                success: false,
                error: { message: 'Failed to process impact metrics' },
            });
        }
    }

    /**
     * Query Prometheus for time-series data
     * GET /api/v1/admin/impact-metrics
     *
     * Query params:
     * - series: metric name (required)
     * - range: hour | day | week | month (default: hour)
     * - aggregationMode: rps | count | avg | sum | p50 | p95 | p99 (default: count)
     * - labels: JSON-encoded label selectors (optional)
     */
    async queryTimeSeries(req: Request, res: Response): Promise<void> {
        try {
            const { series, range, aggregationMode, labels } = req.query;

            if (!series || typeof series !== 'string') {
                res.status(400).json({
                    success: false,
                    error: { message: 'series parameter is required' },
                });
                return;
            }

            let parsedLabels: Record<string, string[]> | undefined;
            if (labels && typeof labels === 'string') {
                try {
                    parsedLabels = JSON.parse(labels);
                } catch {
                    // Ignore invalid labels
                }
            }

            const result = await impactMetricsService.queryTimeSeries({
                series,
                range: ((range as string) || 'hour') as 'hour' | 'day' | 'week' | 'month',
                aggregationMode: ((aggregationMode as string) || 'count') as any,
                labels: parsedLabels,
            });

            res.json({ success: true, data: result });
        } catch (error: any) {
            logger.error('[ImpactMetrics] Failed to query time-series', {
                error: error.message,
            });
            res.status(500).json({
                success: false,
                error: { message: 'Failed to query time-series data' },
            });
        }
    }

    /**
     * List available impact metrics
     * GET /api/v1/admin/impact-metrics/available
     */
    async getAvailableMetrics(req: Request, res: Response): Promise<void> {
        try {
            const metrics = await impactMetricsService.getAvailableMetrics();
            res.json({ success: true, data: metrics });
        } catch (error: any) {
            logger.error('[ImpactMetrics] Failed to get available metrics', {
                error: error.message,
            });
            res.status(500).json({
                success: false,
                error: { message: 'Failed to get available metrics' },
            });
        }
    }
}

export default new ImpactMetricsController();
