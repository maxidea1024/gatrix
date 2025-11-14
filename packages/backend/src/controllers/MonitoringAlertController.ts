import { Response } from 'express';
import { asyncHandler, CustomError } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../middleware/auth';
import { MonitoringAlert } from '../models/MonitoringAlert';

export class MonitoringAlertController {
  /**
   * Webhook endpoint for Grafana alert notifications
   * POST /monitoring/alerts
   */
  static receiveAlert = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const payload = req.body;

    // Grafana 9+ alert webhook payload structure
    const alerts = Array.isArray(payload.alerts) ? payload.alerts : [];

    const records = alerts.map((alert: any) => {
      const labels = alert.labels || {};
      const annotations = alert.annotations || {};

      return {
        alertName: alert.labels?.alertname || alert.title || 'unknown',
        alertSeverity: labels.severity || 'info',
        alertStatus: alert.status || 'firing',
        alertMessage: annotations.summary || annotations.description || '',
        alertLabels: labels,
        alertAnnotations: annotations,
        startsAt: alert.startsAt ? new Date(alert.startsAt) : null,
        endsAt: alert.endsAt ? new Date(alert.endsAt) : null,
        generatorUrl: alert.generatorURL || payload.generatorURL || null,
        fingerprint: alert.fingerprint || null,
      };
    });

    if (records.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const created = await MonitoringAlert.query().insert(records);

    res.status(201).json({
      success: true,
      data: Array.isArray(created) ? created : [created],
    });
  });

  /**
   * GET /admin/monitoring/alerts
   * List alerts with basic filters and pagination
   */
  static getAlerts = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const page = parseInt((req.query.page as string) || '1', 10);
    const limit = Math.min(parseInt((req.query.limit as string) || '20', 10), 100);
    const offset = (page - 1) * limit;

    const severity = (req.query.severity as string) || undefined;
    const status = (req.query.status as string) || undefined;

    const baseQuery = MonitoringAlert.query();

    if (severity) {
      baseQuery.where('alertSeverity', severity);
    }

    if (status) {
      baseQuery.where('alertStatus', status);
    }

    const itemsQuery = baseQuery
      .clone()
      .orderBy('startsAt', 'desc')
      .offset(offset)
      .limit(limit);

    const countQuery = baseQuery.clone().count({ count: '*' }).first();

    const [items, total] = await Promise.all([itemsQuery, countQuery]);

    const totalCount = Number((total as any)?.count || 0);

    res.json({
      success: true,
      data: {
        items,
        pagination: {
          page,
          limit,
          total: totalCount,
        },
      },
    });
  });

  /**
   * GET /admin/monitoring/alerts/:id
   */
  static getAlertById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    const alert = await MonitoringAlert.query().findById(id);

    if (!alert) {
      throw new CustomError('Alert not found', 404);
    }

    res.json({ success: true, data: alert });
  });

  /**
   * PATCH /admin/monitoring/alerts/:id
   * Update alert status (acknowledge, resolved, etc.)
   */
  static updateAlertStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { alertStatus } = req.body || {};

    if (!alertStatus) {
      throw new CustomError('alertStatus is required', 400);
    }

    const updated = await MonitoringAlert.query().patchAndFetchById(id, {
      alertStatus,
    });

    if (!updated) {
      throw new CustomError('Alert not found', 404);
    }

    res.json({ success: true, data: updated });
  });
}

