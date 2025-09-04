import { Request, Response, NextFunction } from 'express';
import VarsModel from '../models/Vars';

export interface MaintenancePayload {
  isMaintenance: boolean;
  type?: 'regular' | 'emergency';
  endsAt?: string | null; // ISO string
  message?: string; // default message
  messages?: { ko?: string; en?: string; zh?: string };
}

const KEY = 'isMaintenance';
const KEY_DETAIL = 'maintenanceDetail';

export class MaintenanceController {
  static async getStatus(_req: Request, res: Response, next: NextFunction) {
    try {
      const is = await VarsModel.get(KEY);
      const detailRaw = await VarsModel.get(KEY_DETAIL);
      const detail = detailRaw ? JSON.parse(detailRaw) : null;
      res.json({ success: true, data: { isUnderMaintenance: is === 'true', detail } });
    } catch (e) { next(e); }
  }

  static async setStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const payload = req.body as MaintenancePayload;
      await VarsModel.set(KEY, payload.isMaintenance ? 'true' : 'false');
      const detail = {
        type: payload.type || 'regular',
        endsAt: payload.endsAt || null,
        message: payload.message || '',
        messages: payload.messages || {},
        updatedAt: new Date().toISOString(),
      };
      await VarsModel.set(KEY_DETAIL, JSON.stringify(detail));
      res.json({ success: true, message: 'Maintenance setting updated', data: { isUnderMaintenance: payload.isMaintenance, detail } });
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
      await VarsModel.set('maintenanceTemplates', JSON.stringify(templates));
      res.json({ success: true, message: 'Templates saved', data: { templates } });
    } catch (e) { next(e); }
  }
}
