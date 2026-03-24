import { Response, NextFunction } from 'express';
import VarsModel from '../models/vars';
import { VarsService } from '../services/vars-service';
import { pubSubService } from '../services/pub-sub-service';
import { SERVER_SDK_ETAG, DEFAULT_CONFIG } from '../constants/cache-keys';
import { AuthenticatedRequest } from '../types/auth';
import { SDKRequest } from '../middleware/api-token-auth';
import { respondWithEtagCache } from '../utils/server-sdk-etag-cache';
import { createLogger } from '../config/logger';

const logger = createLogger('VarsController');

export class VarsController {
  static async getVar(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const key = req.params.key;
      const environmentId = req.environmentId!;
      const value = await VarsModel.get(key, environmentId);
      res.json({ success: true, data: { key, value } });
    } catch (e) {
      next(e);
    }
  }

  static async setVar(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const key = req.params.key;
      const environmentId = req.environmentId!;
      const incoming = req.body?.value ?? null;
      let toStore: string | null = null;
      if (incoming === null || incoming === undefined) {
        toStore = null;
      } else if (typeof incoming === 'string') {
        toStore = incoming;
      } else {
        toStore = JSON.stringify(incoming);
      }
      const userId = req.user?.userId || (req as any).user?.id || 1;
      await VarsModel.set(key, toStore, userId, environmentId);

      // Clear cache
      await VarsService.clearCache(key, environmentId);

      // Publish update event for SDKs
      await pubSubService.publishSDKEvent(
        {
          type: 'vars.updated',
          data: {
            key: key,
            environmentId: environmentId,
          },
        },
        { environmentId: environmentId }
      );

      // Invalidate related caches when specific KV items are updated via setVar
      if (
        key === '$clientVersionPassiveData' ||
        key === 'kv:clientVersionPassiveData'
      ) {
        /**
         * NOTE: This is a temporary workaround for an edge case.
         * When $clientVersionPassiveData is updated, we MUST invalidate all client version caches
         * because this data is merged into the client version metadata.
         * TODO: Refactor this to use a more formal dependency tracking.
         */
        await pubSubService.invalidateByPattern('*client_version:*');
        await pubSubService.invalidateByPattern(
          `${SERVER_SDK_ETAG.CLIENT_VERSIONS}:*`
        );

        // Force all SDKs (Edge, Game Servers) to refresh their client versions
        // by emitting a 'client_version.updated' event for each environment

        try {
          // environment is already the name string
          await pubSubService.publishSDKEvent(
            {
              type: 'client_version.updated',
              data: {
                id: -1, // Dummy ID to trigger refresh of the list for this environmentId
                environmentId: environmentId,
              },
            },
            { environmentId: environmentId }
          );
        } catch (err) {
          // Log error but don't fail the request
          logger.error('Failed to broadcast client version update events', err);
        }
      }
      res.json({
        success: true,
        message: 'Variable saved',
        data: { key, value: incoming },
      });
    } catch (e) {
      next(e);
    }
  }

  // KV Management endpoints

  /**
   * Get all KV items
   * GET /api/v1/admin/vars/kv
   */
  static async getAllKV(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const environmentId = req.environmentId!;
      const items = await VarsService.getAllKV(environmentId);
      res.json({ success: true, data: items });
    } catch (e) {
      next(e);
    }
  }

  /**
   * Get all KV items for Server SDK
   * GET /api/v1/server/vars
   */
  static async getServerVars(
    req: SDKRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const environmentId = req.params.env || req.environmentId!;

      await respondWithEtagCache(res, {
        cacheKey: `${SERVER_SDK_ETAG.VARS}:${environmentId}`,
        ttlMs: DEFAULT_CONFIG.VARS_TTL,
        requestEtag: req.headers['if-none-match'],
        buildPayload: async () => {
          const items = await VarsService.getAllKV(environmentId);
          return { success: true, data: items };
        },
      });
    } catch (e) {
      next(e);
    }
  }

  /**
   * Get a single KV item
   * GET /api/v1/admin/vars/kv/:key
   */
  static async getKV(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const key = req.params.key;
      const environmentId = req.environmentId!;
      const fullKey =
        key.startsWith('kv:') || key.startsWith('$') ? key : `kv:${key}`;
      const item = await VarsModel.getKV(fullKey, environmentId);

      if (!item) {
        return res
          .status(404)
          .json({ success: false, message: 'KV item not found' });
      }

      // Set cache control headers to prevent browser caching
      // This ensures that platform/channel updates are immediately reflected
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');

      res.json({ success: true, data: item });
    } catch (e) {
      next(e);
    }
  }

  /**
   * Create a new KV item
   * POST /api/v1/admin/vars/kv
   */
  static async createKV(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { varKey, varValue, valueType, description } = req.body;
      const environmentId = req.environmentId!;

      if (!varKey || !valueType) {
        return res.status(400).json({
          success: false,
          message: 'varKey and valueType are required',
          errorCode: 'REQUIRED_FIELDS_MISSING',
        });
      }

      const userId = req.user?.userId || (req as any).user?.id || 1;
      const item = await VarsModel.createKV(
        { varKey, varValue, valueType, description },
        userId,
        environmentId
      );

      // Clear cache
      await VarsService.clearCache(item.varKey, environmentId);

      // Publish update event for SDKs
      await pubSubService.publishSDKEvent(
        {
          type: 'vars.updated',
          data: {
            key: item.varKey,
            environmentId: environmentId,
          },
        },
        { environmentId: environmentId }
      );

      res.status(201).json({
        success: true,
        message: 'KV item created successfully',
        data: item,
      });
    } catch (e: any) {
      if (e.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
          success: false,
          message: 'KV item with this key already exists',
          errorCode: 'DUPLICATE_KEY',
        });
      }
      next(e);
    }
  }

  /**
   * Update an existing KV item
   * PUT /api/v1/admin/vars/kv/:key
   */
  static async updateKV(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const key = req.params.key;
      const environmentId = req.environmentId!;
      const fullKey =
        key.startsWith('kv:') || key.startsWith('$') ? key : `kv:${key}`;
      const { varValue, valueType, description } = req.body;

      const userId = req.user?.userId || (req as any).user?.id || 1;
      const item = await VarsModel.updateKV(
        fullKey,
        { varValue, valueType, description },
        userId,
        environmentId
      );

      // Clear cache
      await VarsService.clearCache(fullKey, environmentId);

      // Publish update event for SDKs
      await pubSubService.publishSDKEvent(
        {
          type: 'vars.updated',
          data: {
            key: fullKey,
            environmentId: environmentId,
          },
        },
        { environmentId: environmentId }
      );

      // Invalidate related caches when specific KV items are updated
      if (
        fullKey === '$clientVersionPassiveData' ||
        fullKey === 'kv:clientVersionPassiveData'
      ) {
        /**
         * NOTE: This is a temporary workaround for an edge case.
         * When $clientVersionPassiveData is updated, we MUST invalidate all client version caches
         * because this data is merged into the client version metadata.
         * Without this invalidation, Edge servers or other consumers might serve stale client info.
         * TODO: Refactor this to use a more formal dependency tracking or specific invalidation event.
         */
        // Invalidate all client version caches since meta field includes clientVersionPassiveData
        await pubSubService.invalidateByPattern('*client_version:*');
        // Also invalidate Server SDK ETag cache (Edge)
        await pubSubService.invalidateByPattern(
          `${SERVER_SDK_ETAG.CLIENT_VERSIONS}:*`
        );

        // Force all SDKs (Edge, Game Servers) to refresh their client versions
        // by emitting a 'client_version.updated' event for each environment

        try {
          // environment is already the name string
          await pubSubService.publishSDKEvent(
            {
              type: 'client_version.updated',
              data: {
                id: -1, // Dummy ID to trigger refresh of the list for this environmentId
                environmentId: environmentId,
              },
            },
            { environmentId: environmentId }
          );
        } catch (err) {
          // Log error but don't fail the request
          logger.error('Failed to broadcast client version update events', err);
        }
      }

      // Invalidate platform/channel caches when they are updated
      if (
        fullKey === '$platforms' ||
        fullKey === 'kv:platforms' ||
        fullKey === '$channels' ||
        fullKey === 'kv:channels'
      ) {
        // Broadcast to all frontend instances to refresh platform/channel data
        await pubSubService.publishNotification({
          type: 'system:config:updated',
          data: {
            configType:
              fullKey === '$platforms' || fullKey === 'kv:platforms'
                ? 'platforms'
                : 'channels',
          },
        });
      }

      res.json({
        success: true,
        message: 'KV item updated successfully',
        data: item,
      });
    } catch (e: any) {
      if (e.message === 'KV item not found') {
        return res.status(404).json({
          success: false,
          message: e.message,
          errorCode: 'KV_NOT_FOUND',
        });
      }
      if (e.message === 'Cannot change type of system-defined KV item') {
        return res.status(403).json({
          success: false,
          message: e.message,
          errorCode: 'SYSTEM_DEFINED_TYPE_CHANGE',
        });
      }
      next(e);
    }
  }

  /**
   * Delete a KV item
   * DELETE /api/v1/admin/vars/kv/:key
   */
  static async deleteKV(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const key = req.params.key;
      const environmentId = req.environmentId!;
      const fullKey =
        key.startsWith('kv:') || key.startsWith('$') ? key : `kv:${key}`;

      await VarsModel.deleteKV(fullKey, environmentId);

      // Clear cache
      await VarsService.clearCache(fullKey, environmentId);

      // Publish update event for SDKs
      await pubSubService.publishSDKEvent(
        {
          type: 'vars.updated',
          data: {
            key: fullKey,
            environmentId: environmentId,
          },
        },
        { environmentId: environmentId }
      );

      res.json({
        success: true,
        message: 'KV item deleted successfully',
      });
    } catch (e: any) {
      if (e.message === 'KV item not found') {
        return res.status(404).json({
          success: false,
          message: e.message,
          errorCode: 'KV_NOT_FOUND',
        });
      }
      if (e.message === 'Cannot delete system-defined KV item') {
        return res.status(403).json({
          success: false,
          message: e.message,
          errorCode: 'SYSTEM_DEFINED_DELETE',
        });
      }
      next(e);
    }
  }
}
