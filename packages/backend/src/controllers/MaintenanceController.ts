import { Request, Response, NextFunction } from 'express';
import VarsModel from '../models/Vars';
import { pubSubService } from '../services/PubSubService';
import logger from '../config/logger';
import { DEFAULT_CONFIG, SERVER_SDK_ETAG } from '../constants/cacheKeys';
import { respondWithEtagCache } from '../utils/serverSdkEtagCache';
import { EnvironmentRequest } from '../middleware/environmentResolver';

export interface MaintenancePayload {
  isMaintenance: boolean;
  type?: 'regular' | 'emergency';
  startsAt?: string | null; // ISO string (optional)
  endsAt?: string | null; // ISO string (optional)
  message: string; // default message (required when isMaintenance is true)
  localeMessages?: { ko?: string; en?: string; zh?: string };
  kickExistingPlayers?: boolean;
  kickDelayMinutes?: number;
}

const KEY = 'isMaintenance';
const KEY_DETAIL = 'maintenanceDetail';

export class MaintenanceController {
  static async getStatus(req: EnvironmentRequest, res: Response, next: NextFunction) {
    try {
      // Get environment ID from request (set by resolveEnvironment middleware)
      const environmentId = req.environmentId;

      await respondWithEtagCache(res, {
        cacheKey: `${SERVER_SDK_ETAG.MAINTENANCE}:${environmentId}`,
        ttlMs: DEFAULT_CONFIG.MAINTENANCE_TTL,
        requestEtag: req.headers['if-none-match'],
        buildPayload: async () => {
          // Pass environmentId explicitly to avoid AsyncLocalStorage context issues
          const is = await VarsModel.get(KEY, environmentId);
          const detailRaw = await VarsModel.get(KEY_DETAIL, environmentId);
          const detail = detailRaw ? JSON.parse(detailRaw) : null;
          // Return the actual isMaintenance flag value (not computed active status)
          // Frontend will compute the status (active/scheduled/inactive) based on current time
          const hasMaintenanceScheduled = is === 'true';

          // Calculate if maintenance is currently active (time-based check)
          let isMaintenanceActive = false;
          if (hasMaintenanceScheduled && detail) {
            const now = new Date();
            const startsAt = detail.startsAt ? new Date(detail.startsAt) : null;
            const endsAt = detail.endsAt ? new Date(detail.endsAt) : null;

            // Active if: no start time (immediate) or past start time, AND no end time or before end time
            const hasStarted = !startsAt || now >= startsAt;
            const hasNotEnded = !endsAt || now < endsAt;
            isMaintenanceActive = hasStarted && hasNotEnded;
          }

          return {
            success: true,
            data: {
              hasMaintenanceScheduled,
              isMaintenanceActive,
              // Deprecated: kept for backward compatibility
              isUnderMaintenance: hasMaintenanceScheduled,
              ...(hasMaintenanceScheduled && detail ? { detail } : {}),
            },
          };
        },
      });
    } catch (e) {
      next(e);
    }
  }

  static async setStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const payload = req.body as MaintenancePayload;
      // Get environment ID from request (set by environmentContextMiddleware)
      const environmentId = req.environmentId;

      // Validate: when starting maintenance, default message must be provided
      if (payload.isMaintenance) {
        if (!payload.message || !payload.message.trim()) {
          return res.status(400).json({ success: false, message: 'Maintenance message is required to start maintenance.' });
        }

        // Validate time settings
        const startsAt = payload.startsAt ? new Date(payload.startsAt) : null;
        const endsAt = payload.endsAt ? new Date(payload.endsAt) : null;
        const now = new Date();

        logger.info(`[Maintenance Validation] startsAt: ${startsAt}, endsAt: ${endsAt}, now: ${now}, environmentId: ${environmentId}`);

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

        // Validate minimum duration (5 minutes)
        if (endsAt) {
          const effectiveStart = startsAt || now;
          const durationMinutes = (endsAt.getTime() - effectiveStart.getTime()) / 60000;

          if (durationMinutes < 5) {
            logger.warn(`[Maintenance Validation] Duration too short. durationMinutes: ${durationMinutes}`);
            return res.status(400).json({
              success: false,
              message: `Maintenance duration must be at least 5 minutes. (Current: ${Math.max(0, Math.floor(durationMinutes))} min)`
            });
          }

          // Validate grace period (kickDelayMinutes) does not exceed duration
          if (payload.kickExistingPlayers && payload.kickDelayMinutes !== undefined) {
            if (payload.kickDelayMinutes >= durationMinutes) {
              logger.warn(`[Maintenance Validation] Grace period exceeds duration. kickDelayMinutes: ${payload.kickDelayMinutes}, durationMinutes: ${durationMinutes}`);
              return res.status(400).json({
                success: false,
                message: `Grace period must be shorter than maintenance duration. (Duration: ${Math.floor(durationMinutes)} min, Grace period: ${payload.kickDelayMinutes} min)`
              });
            }
          }
        }
      }

      const userId = (req as any).user?.userId || (req as any).user?.id;
      // Pass environmentId explicitly to avoid AsyncLocalStorage context issues
      await VarsModel.set(KEY, payload.isMaintenance ? 'true' : 'false', userId, environmentId);

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
      // Include kick options if provided
      if (payload.kickExistingPlayers !== undefined) {
        detail.kickExistingPlayers = payload.kickExistingPlayers;
      }
      if (payload.kickDelayMinutes !== undefined) {
        detail.kickDelayMinutes = payload.kickDelayMinutes;
      }
      await VarsModel.set(KEY_DETAIL, JSON.stringify(detail), userId, environmentId);

      await pubSubService.invalidateKey(`${SERVER_SDK_ETAG.MAINTENANCE}:${environmentId}`);

      // Return true if maintenance is being set (regardless of whether it's currently active)
      // The actual active status will be computed by computeActive() when needed
      const isUnderMaintenance = payload.isMaintenance;

      // Publish maintenance.settings.updated event to SDK
      await pubSubService.publishEvent({
        type: 'maintenance.settings.updated',
        data: { id: 'maintenance', environment: (req as any).environmentName, timestamp: Date.now() }
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

  static async templatesGet(req: Request, res: Response, next: NextFunction) {
    try {
      const environmentId = req.environmentId;
      const raw = await VarsModel.get('maintenanceTemplates', environmentId);
      const templates = raw ? JSON.parse(raw) : [];
      res.json({ success: true, data: { templates } });
    } catch (e) { next(e); }
  }

  static async templatesSave(req: Request, res: Response, next: NextFunction) {
    try {
      const environmentId = req.environmentId;
      // Each template: { message?: string, messages?: { ko?: string, en?: string, zh?: string } }
      const templates = Array.isArray(req.body?.templates) ? req.body.templates : [];
      const userId = (req as any).user?.userId || (req as any).user?.id;
      await VarsModel.set('maintenanceTemplates', JSON.stringify(templates), userId, environmentId);
      res.json({ success: true, message: 'Templates saved', data: { templates } });
    } catch (e) { next(e); }
  }
}
