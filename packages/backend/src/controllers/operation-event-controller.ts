import { Response, NextFunction } from 'express';
import { ulid } from 'ulid';
import db from '../config/knex';
import { Knex } from 'knex';
import { pubSubService } from '../services/pub-sub-service';
import { AuthenticatedRequest } from '../types/auth';

import { createLogger } from '../config/logger';
const logger = createLogger('OperationEventController');

const TABLE = 'g_hottime_buff_overrides';

export interface HotTimeBuffOverride {
  id?: string;
  environmentId?: string;
  worldIds?: string[] | null; // null or [] = global (all worlds)
  cmsId: number;
  enabled: boolean;
  startDateOverride?: string | null;
  endDateOverride?: string | null;
  startHourOverride?: number | null;
  endHourOverride?: number | null;
  minLvOverride?: number | null;
  maxLvOverride?: number | null;
  bitFlagDayOfWeekOverride?: number | null;
  worldBuffIdOverride?: number[] | null;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Parse JSON string columns (worldIds, worldBuffIdOverride) from DB row.
 */
function parseRow(row: any): HotTimeBuffOverride {
  const result = { ...row, enabled: !!row.enabled };
  // Parse worldIds
  if (typeof result.worldIds === 'string') {
    try {
      result.worldIds = JSON.parse(result.worldIds);
    } catch {
      result.worldIds = null;
    }
  }
  // Parse worldBuffIdOverride
  if (typeof result.worldBuffIdOverride === 'string') {
    try {
      result.worldBuffIdOverride = JSON.parse(result.worldBuffIdOverride);
    } catch {
      result.worldBuffIdOverride = null;
    }
  }
  return result;
}

export class OperationEventController {
  /**
   * GET /operation-events/hottime-overrides
   *
   * Returns all overrides keyed by cmsId.
   * Game servers filter by worldIds on their side.
   */
  static async getHottimeOverrides(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const environmentId = req.environmentId;
      if (!environmentId) {
        return res
          .status(400)
          .json({ success: false, message: 'Environment is required.' });
      }

      const rows = await db(TABLE).where({ environmentId });
      const overrides: Record<string, HotTimeBuffOverride> = {};
      for (const row of rows) {
        overrides[String(row.cmsId)] = parseRow(row);
      }

      res.json({ success: true, data: overrides });
    } catch (e) {
      next(e);
    }
  }

  /**
   * PUT /operation-events/hottime-overrides
   * Batch apply: save all changed overrides in a single transaction
   * and publish SDK event to propagate to game servers.
   *
   * Body: { overrides: HotTimeBuffOverride[] }
   */
  static async applyHottimeOverrides(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const environmentId = req.environmentId;
      if (!environmentId) {
        return res
          .status(400)
          .json({ success: false, message: 'Environment is required.' });
      }

      const { overrides } = req.body as {
        overrides: HotTimeBuffOverride[];
      };

      if (!Array.isArray(overrides) || overrides.length === 0) {
        return res.status(400).json({
          success: false,
          message: '"overrides" (non-empty array) is required.',
        });
      }

      const userEmail = req.user?.email || req.user?.name || 'unknown';

      // Batch UPSERT within a transaction
      await db.transaction(async (trx: Knex) => {
        for (const item of overrides) {
          const cmsId = Number(item.cmsId);
          if (isNaN(cmsId) || cmsId <= 0) continue;

          // worldIds: null/[] = global, [...] = specific worlds
          const worldIds =
            Array.isArray(item.worldIds) && item.worldIds.length > 0
              ? JSON.stringify(item.worldIds)
              : null;

          const data = {
            environmentId,
            cmsId,
            worldIds,
            enabled: item.enabled ? 1 : 0,
            startDateOverride: item.startDateOverride ?? null,
            endDateOverride: item.endDateOverride ?? null,
            startHourOverride: item.startHourOverride ?? null,
            endHourOverride: item.endHourOverride ?? null,
            minLvOverride: item.minLvOverride ?? null,
            maxLvOverride: item.maxLvOverride ?? null,
            bitFlagDayOfWeekOverride: item.bitFlagDayOfWeekOverride ?? null,
            worldBuffIdOverride: item.worldBuffIdOverride
              ? JSON.stringify(item.worldBuffIdOverride)
              : null,
            updatedBy: userEmail,
          };

          // Upsert by (environmentId, cmsId) — one row per cmsId
          const existing = await trx(TABLE)
            .where({ environmentId, cmsId })
            .first();

          if (existing) {
            await trx(TABLE)
              .where({ id: existing.id })
              .update(data);
          } else {
            await trx(TABLE).insert({ id: ulid(), ...data });
          }
        }
      });

      // Fetch the full override map after save
      const rows = await db(TABLE).where({ environmentId });
      const savedOverrides: Record<string, HotTimeBuffOverride> = {};
      for (const row of rows) {
        savedOverrides[String(row.cmsId)] = parseRow(row);
      }

      // Build changed overrides for SDK event
      const changedOverrides: Record<string, HotTimeBuffOverride | null> = {};
      for (const item of overrides) {
        changedOverrides[String(item.cmsId)] =
          savedOverrides[String(item.cmsId)] || null;
      }

      // Publish single SDK event with all changes
      await pubSubService.publishEvent(
        {
          type: 'hottime_buff.overrides_applied',
          data: {
            id: 'hottime_buff_overrides',
            overrides: changedOverrides,
            environmentId,
          },
        },
        { environmentId }
      );

      logger.info('HotTimeBuff overrides applied (batch)', {
        count: overrides.length,
        environmentId,
        updatedBy: userEmail,
      });

      res.json({
        success: true,
        data: savedOverrides,
        message: `${overrides.length} override(s) applied.`,
      });
    } catch (e) {
      next(e);
    }
  }

  /**
   * DELETE /operation-events/hottime-overrides/:cmsId
   * Remove an individual override (restore to CMS defaults).
   */
  static async deleteHottimeOverride(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const environmentId = req.environmentId;
      if (!environmentId) {
        return res
          .status(400)
          .json({ success: false, message: 'Environment is required.' });
      }

      const cmsId = Number(req.params.cmsId);
      if (isNaN(cmsId) || cmsId <= 0) {
        return res
          .status(400)
          .json({ success: false, message: 'Invalid cmsId.' });
      }

      const userEmail = req.user?.email || req.user?.name || 'unknown';

      const deleted = await db(TABLE)
        .where({ environmentId, cmsId })
        .del();

      // Publish SDK event (override=null signals removal)
      await pubSubService.publishEvent(
        {
          type: 'hottime_buff.overrides_applied',
          data: {
            id: 'hottime_buff_overrides',
            overrides: { [String(cmsId)]: null },
            environmentId,
          },
        },
        { environmentId }
      );

      logger.info('HotTimeBuff override deleted', {
        cmsId,
        environmentId,
        deleted: deleted > 0,
        updatedBy: userEmail,
      });

      res.json({
        success: true,
        message:
          deleted > 0
            ? 'Override removed.'
            : 'No override existed for this cmsId.',
      });
    } catch (e) {
      next(e);
    }
  }
}
