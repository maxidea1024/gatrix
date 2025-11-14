import { Request, Response, NextFunction } from 'express';
import VarsModel from '../models/Vars';
import { pubSubService } from '../services/PubSubService';
import logger from '../config/logger';

export interface MaintenancePayload {
  isMaintenance: boolean;
  type?: 'regular' | 'emergency';
  startsAt?: string | null; // ISO string (optional)
  endsAt?: string | null; // ISO string (optional)
  message: string; // default message (required when isMaintenance is true)
  localeMessages?: { ko?: string; en?: string; zh?: string };
}

const KEY = 'isMaintenance';
const KEY_DETAIL = 'maintenanceDetail';

export class MaintenanceController {
  static async getStatus(_req: Request, res: Response, next: NextFunction) {
    try {
      const is = await VarsModel.get(KEY);
      const detailRaw = await VarsModel.get(KEY_DETAIL);
      const detail = detailRaw ? JSON.parse(detailRaw) : null;
      // Return the actual isMaintenance flag value (not computed active status)
      // Frontend will compute the status (active/scheduled/inactive) based on current time
      const isMaintenance = is === 'true';
      res.json({ success: true, data: { isUnderMaintenance: isMaintenance, ...(isMaintenance && detail ? { detail } : {}) } });
    } catch (e) { next(e); }
  }

  static async setStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const payload = req.body as MaintenancePayload;

      // Validate: when starting maintenance, default message must be provided
      if (payload.isMaintenance) {
        if (!payload.message || !payload.message.trim()) {
          return res.status(400).json({ success: false, message: 'Maintenance message is required to start maintenance.' });
        }

        // Validate time settings
        const startsAt = payload.startsAt ? new Date(payload.startsAt) : null;
        const endsAt = payload.endsAt ? new Date(payload.endsAt) : null;
        const now = new Date();

        logger.info(`[Maintenance Validation] startsAt: ${startsAt}, endsAt: ${endsAt}, now: ${now}`);

        // If both times are set, endsAt must be after startsAt
        if (startsAt && endsAt && endsAt <= startsAt) {
          logger.warn(`[Maintenance Validation] End time must be after start time. endsAt: ${endsAt}, startsAt: ${startsAt}`);
          return res.status(400).json({ success: false, message: 'End time must be after start time.' });
        }

        // If only endsAt is set, it must be in the future
        if (!startsAt && endsAt) {
          if (endsAt <= now) {
            logger.warn(`[Maintenance Validation] End time must be in the future. endsAt: ${endsAt}, now: ${now}`);
            return res.status(400).json({ success: false, message: 'End time must be in the future.' });
          }
        }
      }

      const userId = (req as any).user?.userId || (req as any).user?.id;
      await VarsModel.set(KEY, payload.isMaintenance ? 'true' : 'false', userId);

      const detail: any = {
        type: payload.type || 'regular',
        startsAt: payload.startsAt || null,
        endsAt: payload.endsAt || null,
        message: payload.message,
      };
      // Only include localeMessages if provided
      if (payload.localeMessages && Object.keys(payload.localeMessages).length > 0) {
        detail.localeMessages = payload.localeMessages;
      }
      await VarsModel.set(KEY_DETAIL, JSON.stringify(detail), userId);

      // Return true if maintenance is being set (regardless of whether it's currently active)
      // The actual active status will be computed by computeActive() when needed
      const isUnderMaintenance = payload.isMaintenance;

      // Publish maintenance.settings.updated event to SDK
      await pubSubService.publishEvent({
        type: 'maintenance.settings.updated',
        data: { id: 'maintenance', timestamp: Date.now() }
      });

      // Broadcast via PubSub so all instances fan-out to their SSE clients
      await pubSubService.publishNotification({
        type: 'maintenance_status_change',
        data: { isUnderMaintenance, ...(isUnderMaintenance && detail ? { detail } : {}) },
        targetChannels: ['admin', 'general']
      });

      logger.info(`Maintenance settings updated and event published`, {
        isUnderMaintenance,
        targetChannels: ['admin', 'general']
      });

      res.json({ success: true, message: 'Maintenance setting updated', data: { isUnderMaintenance, ...(isUnderMaintenance && detail ? { detail } : {}) } });
    } catch (e) { next(e); }
  }

  static async templatesGet(_req: Request, res: Response, next: NextFunction) {
    try {
      const raw = await VarsModel.get('maintenanceTemplates');
      const templates = raw ? JSON.parse(raw) : [];
      res.json({ success: true, data: { templates } });
    } catch (e) { next(e); }
  }

  static async templatesSave(req: Request, res: Response, next: NextFunction) {
    try {
      // Each template: { message?: string, messages?: { ko?: string, en?: string, zh?: string } }
      const templates = Array.isArray(req.body?.templates) ? req.body.templates : [];
      const userId = (req as any).user?.userId || (req as any).user?.id;
      await VarsModel.set('maintenanceTemplates', JSON.stringify(templates), userId);
      res.json({ success: true, message: 'Templates saved', data: { templates } });
    } catch (e) { next(e); }
  }
}
