import { Request, Response, NextFunction } from 'express';
import VarsModel from '../models/Vars';
import { pubSubService } from '../services/PubSubService';

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
      const fullKey = key.startsWith('kv:') ? key : `kv:${key}`;
      const item = await VarsModel.getKV(fullKey);

      if (!item) {
        return res.status(404).json({ success: false, message: 'KV item not found' });
      }

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
      const fullKey = key.startsWith('kv:') ? key : `kv:${key}`;
      const { varValue, valueType, description } = req.body;

      const userId = (req as any).user?.userId || (req as any).user?.id;
      const item = await VarsModel.updateKV(
        fullKey,
        { varValue, valueType, description },
        userId
      );

      // Invalidate related caches when specific KV items are updated
      if (fullKey === 'kv:clientVersionPassiveData') {
        // Invalidate all client version caches since meta field includes clientVersionPassiveData
        await pubSubService.invalidateByPattern('client_version:*');
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
