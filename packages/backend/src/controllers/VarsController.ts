import { Request, Response, NextFunction } from 'express';
import VarsModel from '../models/Vars';
import Environment from '../models/Environment';
import { pubSubService } from '../services/PubSubService';
import { SERVER_SDK_ETAG } from '../constants/cacheKeys';

export class VarsController {
  static async getVar(req: Request, res: Response, next: NextFunction) {
    try {
      const key = req.params.key;
      const value = await VarsModel.get(key);
      res.json({ success: true, data: { key, value } });
    } catch (e) { next(e); }
  }

  static async setVar(req: Request, res: Response, next: NextFunction) {
    try {
      const key = req.params.key;
      const incoming = req.body?.value ?? null;
      let toStore: string | null = null;
      if (incoming === null || incoming === undefined) {
        toStore = null;
      } else if (typeof incoming === 'string') {
        toStore = incoming;
      } else {
        toStore = JSON.stringify(incoming);
      }
      const userId = (req as any).user?.userId || (req as any).user?.id;
      await VarsModel.set(key, toStore, userId);

      // Invalidate related caches when specific KV items are updated via setVar
      if (key === '$clientVersionPassiveData' || key === 'kv:clientVersionPassiveData') {
        /**
         * NOTE: This is a temporary workaround for an edge case.
         * When $clientVersionPassiveData is updated, we MUST invalidate all client version caches
         * because this data is merged into the client version metadata.
         * TODO: Refactor this to use a more formal dependency tracking.
         */
        await pubSubService.invalidateByPattern('client_version:*');
        await pubSubService.invalidateByPattern(`${SERVER_SDK_ETAG.CLIENT_VERSIONS}:*`);

        // Force all SDKs (Edge, Game Servers) to refresh their client versions
        // by emitting a 'client_version.updated' event for each environment

        try {
          // Only emit event for the current environment
          const currentEnvId = (req as any).environment?.id || await import('../utils/environmentContext').then(m => m.getCurrentEnvironmentId());
          const currentEnv = await Environment.query().findById(currentEnvId);

          if (currentEnv) {
            await pubSubService.publishSDKEvent({
              type: 'client_version.updated',
              data: {
                id: -1, // Dummy ID to trigger refresh of the list for this environment
                environment: currentEnv.environmentName
              }
            });
          }
        } catch (err) {
          // Log error but don't fail the request
          console.error('Failed to broadcast client version update events', err);
        }
      }
      res.json({ success: true, message: 'Variable saved', data: { key, value: incoming } });
    } catch (e) { next(e); }
  }

  // KV Management endpoints

  /**
   * Get all KV items
   * GET /api/v1/admin/vars/kv
   */
  static async getAllKV(req: Request, res: Response, next: NextFunction) {
    try {
      const items = await VarsModel.getAllKV();
      res.json({ success: true, data: items });
    } catch (e) {
      next(e);
    }
  }

  /**
   * Get a single KV item
   * GET /api/v1/admin/vars/kv/:key
   */
  static async getKV(req: Request, res: Response, next: NextFunction) {
    try {
      const key = req.params.key;
      const fullKey = key.startsWith('kv:') || key.startsWith('$') ? key : `kv:${key}`;
      const item = await VarsModel.getKV(fullKey);

      if (!item) {
        return res.status(404).json({ success: false, message: 'KV item not found' });
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
  static async createKV(req: Request, res: Response, next: NextFunction) {
    try {
      const { varKey, varValue, valueType, description } = req.body;

      if (!varKey || !valueType) {
        return res.status(400).json({
          success: false,
          message: 'varKey and valueType are required',
          errorCode: 'REQUIRED_FIELDS_MISSING'
        });
      }

      const userId = (req as any).user?.userId || (req as any).user?.id;
      const item = await VarsModel.createKV(
        { varKey, varValue, valueType, description },
        userId
      );

      res.status(201).json({
        success: true,
        message: 'KV item created successfully',
        data: item
      });
    } catch (e: any) {
      if (e.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
          success: false,
          message: 'KV item with this key already exists',
          errorCode: 'DUPLICATE_KEY'
        });
      }
      next(e);
    }
  }

  /**
   * Update an existing KV item
   * PUT /api/v1/admin/vars/kv/:key
   */
  static async updateKV(req: Request, res: Response, next: NextFunction) {
    try {
      const key = req.params.key;
      const fullKey = key.startsWith('kv:') || key.startsWith('$') ? key : `kv:${key}`;
      const { varValue, valueType, description } = req.body;

      const userId = (req as any).user?.userId || (req as any).user?.id;
      const item = await VarsModel.updateKV(
        fullKey,
        { varValue, valueType, description },
        userId
      );

      // Invalidate related caches when specific KV items are updated
      if (fullKey === '$clientVersionPassiveData' || fullKey === 'kv:clientVersionPassiveData') {
        /**
         * NOTE: This is a temporary workaround for an edge case.
         * When $clientVersionPassiveData is updated, we MUST invalidate all client version caches
         * because this data is merged into the client version metadata.
         * Without this invalidation, Edge servers or other consumers might serve stale client info.
         * TODO: Refactor this to use a more formal dependency tracking or specific invalidation event.
         */
        // Invalidate all client version caches since meta field includes clientVersionPassiveData
        await pubSubService.invalidateByPattern('client_version:*');
        // Also invalidate Server SDK ETag cache (Edge)
        await pubSubService.invalidateByPattern(`${SERVER_SDK_ETAG.CLIENT_VERSIONS}:*`);

        // Force all SDKs (Edge, Game Servers) to refresh their client versions
        // by emitting a 'client_version.updated' event for each environment

        try {
          // Only emit event for the current environment
          const currentEnvId = (req as any).environment?.id || await import('../utils/environmentContext').then(m => m.getCurrentEnvironmentId());
          const currentEnv = await Environment.query().findById(currentEnvId);

          if (currentEnv) {
            await pubSubService.publishSDKEvent({
              type: 'client_version.updated',
              data: {
                id: -1, // Dummy ID to trigger refresh of the list for this environment
                environment: currentEnv.environmentName
              }
            });
          }
        } catch (err) {
          // Log error but don't fail the request
          console.error('Failed to broadcast client version update events', err);
        }
      }

      // Invalidate platform/channel caches when they are updated
      if (fullKey === '$platforms' || fullKey === 'kv:platforms' || fullKey === '$channels' || fullKey === 'kv:channels') {
        // Broadcast to all frontend instances to refresh platform/channel data
        await pubSubService.publishNotification({
          type: 'system:config:updated',
          data: {
            configType: (fullKey === '$platforms' || fullKey === 'kv:platforms') ? 'platforms' : 'channels',
          },
        });
      }

      res.json({
        success: true,
        message: 'KV item updated successfully',
        data: item
      });
    } catch (e: any) {
      if (e.message === 'KV item not found') {
        return res.status(404).json({
          success: false,
          message: e.message,
          errorCode: 'KV_NOT_FOUND'
        });
      }
      if (e.message === 'Cannot change type of system-defined KV item') {
        return res.status(403).json({
          success: false,
          message: e.message,
          errorCode: 'SYSTEM_DEFINED_TYPE_CHANGE'
        });
      }
      next(e);
    }
  }

  /**
   * Delete a KV item
   * DELETE /api/v1/admin/vars/kv/:key
   */
  static async deleteKV(req: Request, res: Response, next: NextFunction) {
    try {
      const key = req.params.key;
      const fullKey = key.startsWith('kv:') ? key : `kv:${key}`;

      await VarsModel.deleteKV(fullKey);

      res.json({
        success: true,
        message: 'KV item deleted successfully'
      });
    } catch (e: any) {
      if (e.message === 'KV item not found') {
        return res.status(404).json({
          success: false,
          message: e.message,
          errorCode: 'KV_NOT_FOUND'
        });
      }
      if (e.message === 'Cannot delete system-defined KV item') {
        return res.status(403).json({
          success: false,
          message: e.message,
          errorCode: 'SYSTEM_DEFINED_DELETE'
        });
      }
      next(e);
    }
  }
}
