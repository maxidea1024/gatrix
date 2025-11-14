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

function computeActive(isFlag: string | null, detail: any): boolean {
  if (isFlag !== 'true') return false;
  if (!detail) return isFlag === 'true';
  const now = new Date();
  const startsAt = detail.startsAt ? new Date(detail.startsAt) : null;
  const endsAt = detail.endsAt ? new Date(detail.endsAt) : null;
  if (startsAt && now < startsAt) return false;
  if (endsAt && now > endsAt) return false;
  return true;
}

export class MaintenanceController {
  static async getStatus(_req: Request, res: Response, next: NextFunction) {
    try {
      const is = await VarsModel.get(KEY);
      const detailRaw = await VarsModel.get(KEY_DETAIL);
      const detail = detailRaw ? JSON.parse(detailRaw) : null;
      const isUnderMaintenance = computeActive(is, detail);
      res.json({ success: true, data: { isUnderMaintenance, ...(isUnderMaintenance && detail ? { detail } : {}) } });
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

        // If both times are set, endsAt must be after startsAt
        if (startsAt && endsAt && endsAt <= startsAt) {
          return res.status(400).json({ success: false, message: 'End time must be after start time.' });
        }

        // If only endsAt is set, it must be in the future
        if (!startsAt && endsAt) {
          const now = new Date();
          if (endsAt <= now) {
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

      const isUnderMaintenance = computeActive(payload.isMaintenance ? 'true' : 'false', detail);

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
