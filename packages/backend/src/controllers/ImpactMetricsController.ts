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
import { ImpactMetricConfigModel } from '../models/ImpactMetricConfig';
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
      const { series, range, aggregationMode, labels, groupBy } = req.query;

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
        range: ((range as string) || 'hour') as 'hour' | 'sixhour' | 'day' | 'week' | 'month',
        aggregationMode: ((aggregationMode as string) || 'count') as any,
        labels: parsedLabels,
        groupBy: groupBy
          ? Array.isArray(groupBy)
            ? (groupBy as string[])
            : [groupBy as string]
          : undefined,
        from: req.query.from ? Number(req.query.from) : undefined,
        to: req.query.to ? Number(req.query.to) : undefined,
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

  // ==================== Chart Config CRUD ====================

  /**
   * List chart configs for a flag
   * GET /api/v1/admin/impact-metrics/configs/:flagId
   */
  async getConfigs(req: Request, res: Response): Promise<void> {
    try {
      const { flagId } = req.params;
      const configs =
        flagId === 'all'
          ? await ImpactMetricConfigModel.findAll()
          : await ImpactMetricConfigModel.findByFlag(flagId);
      res.json({ success: true, data: configs });
    } catch (error: any) {
      logger.error('[ImpactMetrics] Failed to get configs', { error: error.message });
      res.status(500).json({ success: false, error: { message: 'Failed to get configs' } });
    }
  }

  /**
   * Get available metric labels
   * GET /api/v1/admin/impact-metrics/labels
   */
  async getMetricLabels(req: Request, res: Response): Promise<void> {
    try {
      const { metric } = req.query;
      if (!metric || typeof metric !== 'string') {
        res
          .status(400)
          .json({ success: false, error: { message: 'metric parameter is required' } });
        return;
      }

      const labels = await impactMetricsService.getMetricLabels(metric);
      res.json({ success: true, data: labels });
    } catch (error: any) {
      logger.error('[ImpactMetrics] Failed to get metric labels', { error: error.message });
      res.status(500).json({ success: false, error: { message: 'Failed to get metric labels' } });
    }
  }

  /**
   * Create a chart config
   * POST /api/v1/admin/impact-metrics/configs
   */
  async createConfig(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId;
      const {
        flagId,
        title,
        metricName,
        labelSelectors,
        aggregationMode,
        chartRange,
        displayOrder,
        layoutX,
        layoutY,
        layoutW,
        layoutH,
      } = req.body;

      if (!metricName) {
        res.status(400).json({ success: false, error: { message: 'metricName is required' } });
        return;
      }

      const config = await ImpactMetricConfigModel.create({
        flagId,
        title: title || metricName,
        metricName,
        chartType: req.body.chartType || 'line',
        groupBy: req.body.groupBy || null,
        labelSelectors: labelSelectors || null,
        aggregationMode: aggregationMode || 'count',
        chartRange: chartRange || 'hour',
        displayOrder: displayOrder ?? 0,
        layoutX: layoutX ?? 0,
        layoutY: layoutY ?? 0,
        layoutW: layoutW ?? 6,
        layoutH: layoutH ?? 2,
        createdBy: userId || null,
      });

      res.status(201).json({ success: true, data: config });
    } catch (error: any) {
      logger.error('[ImpactMetrics] Failed to create config', { error: error.message });
      res.status(500).json({ success: false, error: { message: 'Failed to create config' } });
    }
  }

  /**
   * Update a chart config
   * PUT /api/v1/admin/impact-metrics/configs/:id
   */
  async updateConfig(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const config = await ImpactMetricConfigModel.update(id, req.body);
      if (!config) {
        res.status(404).json({ success: false, error: { message: 'Config not found' } });
        return;
      }
      res.json({ success: true, data: config });
    } catch (error: any) {
      logger.error('[ImpactMetrics] Failed to update config', { error: error.message });
      res.status(500).json({ success: false, error: { message: 'Failed to update config' } });
    }
  }

  /**
   * Delete a chart config
   * DELETE /api/v1/admin/impact-metrics/configs/:id
   */
  async deleteConfig(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await ImpactMetricConfigModel.delete(id);
      res.json({ success: true });
    } catch (error: any) {
      logger.error('[ImpactMetrics] Failed to delete config', { error: error.message });
      res.status(500).json({ success: false, error: { message: 'Failed to delete config' } });
    }
  }

  /**
   * Batch update chart layouts
   * PUT /api/v1/admin/impact-metrics/configs/layouts
   */
  async updateLayouts(req: Request, res: Response): Promise<void> {
    try {
      const { layouts } = req.body;
      if (!Array.isArray(layouts)) {
        res.status(400).json({ success: false, error: { message: 'layouts array is required' } });
        return;
      }
      for (const layout of layouts) {
        if (layout.id) {
          await ImpactMetricConfigModel.update(layout.id, {
            layoutX: layout.x,
            layoutY: layout.y,
            layoutW: layout.w,
            layoutH: layout.h,
          });
        }
      }
      res.json({ success: true });
    } catch (error: any) {
      logger.error('[ImpactMetrics] Failed to update layouts', { error: error.message });
      res.status(500).json({ success: false, error: { message: 'Failed to update layouts' } });
    }
  }
}

export default new ImpactMetricsController();
