import { Request, Response, NextFunction } from 'express';
import VarsModel from '../models/Vars';
import SSENotificationService from '../services/sseNotificationService';
import logger from '../config/logger';

export interface MaintenancePayload {
  isMaintenance: boolean;
  type?: 'regular' | 'emergency';
  startsAt?: string | null; // ISO string (optional)
  endsAt?: string | null; // ISO string (optional)
  message?: string; // default message
  messages?: { ko?: string; en?: string; zh?: string };
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
      res.json({ success: true, data: { isUnderMaintenance, detail } });
    } catch (e) { next(e); }
  }

  static async setStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const payload = req.body as MaintenancePayload;

      // Validate: when starting maintenance, a message must be provided (default or any locale)
      if (payload.isMaintenance) {
        const hasDefault = !!(payload.message && payload.message.trim());
        const hasLocales = !!payload.messages && Object.values(payload.messages).some((v) => !!(v && (v as string).trim()));
        if (!hasDefault && !hasLocales) {
          return res.status(400).json({ success: false, message: 'Maintenance message is required to start maintenance.' });
        }
      }

      const userId = (req as any).user?.userId || (req as any).user?.id;
      const user = (req as any).user;
      await VarsModel.set(KEY, payload.isMaintenance ? 'true' : 'false', userId);
      const detail = {
        type: payload.type || 'regular',
        startsAt: payload.startsAt || null,
        endsAt: payload.endsAt || null,
        message: payload.message || '',
        messages: payload.messages || {},
        updatedAt: new Date().toISOString(),
        updatedBy: user ? {
          id: userId,
          name: user.name || user.email || 'Unknown',
          email: user.email || 'unknown@example.com'
        } : null,
      };
      await VarsModel.set(KEY_DETAIL, JSON.stringify(detail), userId);

      const isUnderMaintenance = computeActive(payload.isMaintenance ? 'true' : 'false', detail);

      // Broadcast via SSE to admins and general channel
      const sse = SSENotificationService.getInstance();
      const sentCount = sse.sendNotification({
        type: 'maintenance_status_change',
        data: { isUnderMaintenance, detail },
        timestamp: new Date(),
        targetChannels: ['admin', 'general']
      });

      logger.info(`Maintenance status change notification sent to ${sentCount} clients`, {
        isUnderMaintenance,
        targetChannels: ['admin', 'general']
      });

      res.json({ success: true, message: 'Maintenance setting updated', data: { isUnderMaintenance, detail } });
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
