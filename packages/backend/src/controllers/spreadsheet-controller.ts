import { Request, Response } from 'express';
import SpreadsheetModel from '../models/spreadsheet';
import SpreadsheetShareModel from '../models/spreadsheet-share';
import { UserModel } from '../models/user';
import { createLogger } from '../config/logger';
import { SpreadsheetCollabService } from '../services/spreadsheet-collab-service';
import { SSENotificationService } from '../services/sse-notification-service';
import { nanoid } from 'nanoid';

const logger = createLogger('SpreadsheetController');

/**
 * Default empty Univer IWorkbookData snapshot for new spreadsheets
 */
function getDefaultSheetData(): string {
  return JSON.stringify({
    id: 'workbook-1',
    appVersion: '0.0.0',
    name: 'Untitled Spreadsheet',
    locale: 'enUS',
    styles: {},
    sheetOrder: ['sheet-1'],
    sheets: {
      'sheet-1': {
        id: 'sheet-1',
        name: 'Sheet1',
        rowCount: 100,
        columnCount: 26,
        cellData: {},
        rowData: {},
        columnData: {},
        defaultRowHeight: 24,
        defaultColumnWidth: 88,
      },
    },
  });
}

export class SpreadsheetController {
  /**
   * GET /admin/spreadsheets
   * List spreadsheets for the user's org
   */
  static async list(req: Request, res: Response): Promise<void> {
    try {
      const orgId = (req as any).user?.orgId;
      if (!orgId) {
        res.status(400).json({ success: false, message: 'Missing orgId' });
        return;
      }

      const {
        page = '1',
        limit = '20',
        search,
        sortBy = 'updatedAt',
        sortOrder = 'desc',
      } = req.query as Record<string, string>;

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      const offset = (pageNum - 1) * limitNum;

      const result = await SpreadsheetModel.findAllByOrg({
        orgId,
        limit: limitNum,
        offset,
        search,
        sortBy: sortBy as any,
        sortOrder: sortOrder as any,
      });

      res.json({
        success: true,
        data: {
          items: result.items,
          total: result.total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(result.total / limitNum),
        },
      });
    } catch (error) {
      logger.error('Failed to list spreadsheets', { error });
      res
        .status(500)
        .json({ success: false, message: 'Failed to list spreadsheets' });
    }
  }

  /**
   * GET /admin/spreadsheets/:id
   */
  static async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const spreadsheet = await SpreadsheetModel.findById(id);

      if (!spreadsheet) {
        res
          .status(404)
          .json({ success: false, message: 'Spreadsheet not found' });
        return;
      }

      res.json({ success: true, data: spreadsheet });
    } catch (error) {
      logger.error('Failed to get spreadsheet', { error, id: req.params.id });
      res
        .status(500)
        .json({ success: false, message: 'Failed to get spreadsheet' });
    }
  }

  /**
   * POST /admin/spreadsheets
   */
  static async create(req: Request, res: Response): Promise<void> {
    try {
      const orgId = (req as any).user?.orgId;
      const userId = (req as any).user?.userId || (req as any).user?.id;

      if (!orgId || !userId) {
        res.status(400).json({ success: false, message: 'Missing context' });
        return;
      }

      const { title, description, sheetData } = req.body;

      const defaultTitle = `Untitled-${nanoid(8)}`;

      const spreadsheet = await SpreadsheetModel.create({
        orgId,
        title: title || defaultTitle,
        description: description || null,
        sheetData: sheetData || getDefaultSheetData(),
        createdBy: userId,
      });

      res.status(201).json({ success: true, data: spreadsheet });
    } catch (error) {
      logger.error('Failed to create spreadsheet', { error });
      res
        .status(500)
        .json({ success: false, message: 'Failed to create spreadsheet' });
    }
  }

  /**
   * PUT /admin/spreadsheets/:id
   * Full update (auto-save from editor)
   */
  static async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.userId || (req as any).user?.id;
      const userName =
        (req as any).user?.name || (req as any).user?.username || 'Unknown';
      const {
        title,
        description,
        sheetData,
        thumbnail,
        isPinned,
        expectedVersion,
      } = req.body;

      const existing = await SpreadsheetModel.findById(id);
      if (!existing) {
        res
          .status(404)
          .json({ success: false, message: 'Spreadsheet not found' });
        return;
      }

      const spreadsheet = await SpreadsheetModel.update(id, {
        title,
        description,
        sheetData:
          typeof sheetData === 'string' ? sheetData : JSON.stringify(sheetData),
        thumbnail,
        isPinned,
        expectedVersion,
        updatedBy: userId,
      });

      // Notify other viewers of the new version
      if (sheetData && spreadsheet) {
        const collabService = SpreadsheetCollabService.getInstance();
        collabService.notifyVersionUpdated(id, spreadsheet.version, {
          userId,
          userName,
        });
      }

      res.json({ success: true, data: spreadsheet });
    } catch (error: any) {
      if (error.code === 'VERSION_CONFLICT') {
        res.status(409).json({
          success: false,
          message: 'Version conflict — another user has saved a newer version',
          currentVersion: error.currentVersion,
        });
        return;
      }
      logger.error('Failed to update spreadsheet', {
        error,
        id: req.params.id,
      });
      res
        .status(500)
        .json({ success: false, message: 'Failed to update spreadsheet' });
    }
  }

  /**
   * PATCH /admin/spreadsheets/:id/meta
   * Update metadata only (title, description, isPinned)
   */
  static async updateMeta(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.userId || (req as any).user?.id;
      const { title, description, isPinned } = req.body;

      const existing = await SpreadsheetModel.findById(id);
      if (!existing) {
        res
          .status(404)
          .json({ success: false, message: 'Spreadsheet not found' });
        return;
      }

      const spreadsheet = await SpreadsheetModel.updateMeta(id, {
        title,
        description,
        isPinned,
        updatedBy: userId,
      });

      res.json({ success: true, data: spreadsheet });
    } catch (error) {
      logger.error('Failed to update spreadsheet meta', {
        error,
        id: req.params.id,
      });
      res.status(500).json({
        success: false,
        message: 'Failed to update spreadsheet metadata',
      });
    }
  }

  /**
   * DELETE /admin/spreadsheets/:id
   */
  static async delete(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const existing = await SpreadsheetModel.findById(id);
      if (!existing) {
        res
          .status(404)
          .json({ success: false, message: 'Spreadsheet not found' });
        return;
      }

      await SpreadsheetModel.delete(id);
      res.json({ success: true, message: 'Spreadsheet deleted' });
    } catch (error) {
      logger.error('Failed to delete spreadsheet', {
        error,
        id: req.params.id,
      });
      res
        .status(500)
        .json({ success: false, message: 'Failed to delete spreadsheet' });
    }
  }

  /**
   * POST /admin/spreadsheets/:id/duplicate
   */
  static async duplicate(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.userId || (req as any).user?.id;

      const spreadsheet = await SpreadsheetModel.duplicate(id, userId);
      res.status(201).json({ success: true, data: spreadsheet });
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        res
          .status(404)
          .json({ success: false, message: 'Spreadsheet not found' });
        return;
      }
      logger.error('Failed to duplicate spreadsheet', {
        error,
        id: req.params.id,
      });
      res
        .status(500)
        .json({ success: false, message: 'Failed to duplicate spreadsheet' });
    }
  }

  // ==================== Collaboration ====================

  /**
   * GET /admin/spreadsheets/:id/events
   * SSE stream for real-time collaboration events
   */
  static async streamEvents(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const userId = (req as any).user?.userId || (req as any).user?.id;
    const userName =
      (req as any).user?.name || (req as any).user?.username || 'Unknown';
    const clientId = `ss-${nanoid(10)}`;

    // Verify spreadsheet exists
    const existing = await SpreadsheetModel.findById(id);
    if (!existing) {
      res
        .status(404)
        .json({ success: false, message: 'Spreadsheet not found' });
      return;
    }

    // Set up SSE connection
    const sseService = SSENotificationService.getInstance();
    sseService.addClient(clientId, res, userId);
    sseService.subscribe(clientId, [`spreadsheet:${id}`]);

    // Register as viewer
    const collabService = SpreadsheetCollabService.getInstance();
    collabService.addViewer(id, clientId, userId, userName);

    // Send initial state
    const viewers = collabService.getViewers(id);
    const lock = collabService.getLockInfo(id);
    sseService.sendToClient(clientId, {
      type: 'initial_state',
      data: {
        viewers,
        lock: lock ? { userId: lock.userId, userName: lock.userName } : null,
        version: existing.version,
      },
      timestamp: new Date(),
    });

    // Clean up on disconnect
    res.on('close', () => {
      collabService.removeViewer(id, clientId);
      logger.info(`SSE client ${clientId} disconnected from spreadsheet ${id}`);
    });
  }

  /**
   * POST /admin/spreadsheets/:id/lock
   * Acquire edit lock
   */
  static async acquireLock(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.userId || (req as any).user?.id;
      const userName =
        (req as any).user?.name || (req as any).user?.username || 'Unknown';

      const collabService = SpreadsheetCollabService.getInstance();
      const result = collabService.acquireLock(id, userId, userName);

      if (result.success) {
        res.json({ success: true, data: { lock: result.lock } });
      } else {
        res.status(423).json({
          success: false,
          message: 'Spreadsheet is locked by another user',
          data: {
            lockedBy: {
              userId: result.lock?.userId,
              userName: result.lock?.userName,
            },
          },
        });
      }
    } catch (error) {
      logger.error('Failed to acquire lock', { error, id: req.params.id });
      res
        .status(500)
        .json({ success: false, message: 'Failed to acquire lock' });
    }
  }

  /**
   * DELETE /admin/spreadsheets/:id/lock
   * Release edit lock
   */
  static async releaseLock(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.userId || (req as any).user?.id;

      const collabService = SpreadsheetCollabService.getInstance();
      collabService.releaseLock(id, userId);

      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to release lock', { error, id: req.params.id });
      res
        .status(500)
        .json({ success: false, message: 'Failed to release lock' });
    }
  }

  /**
   * POST /admin/spreadsheets/:id/heartbeat
   * Extend lock TTL
   */
  static async heartbeat(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.userId || (req as any).user?.id;

      const collabService = SpreadsheetCollabService.getInstance();
      const success = collabService.heartbeat(id, userId);

      if (success) {
        res.json({ success: true });
      } else {
        res
          .status(404)
          .json({ success: false, message: 'No active lock found' });
      }
    } catch (error) {
      logger.error('Failed to process heartbeat', { error, id: req.params.id });
      res
        .status(500)
        .json({ success: false, message: 'Failed to process heartbeat' });
    }
  }

  // ==================== Share Methods ====================

  /**
   * GET /:id/shares — List all shares for a spreadsheet
   */
  static async listShares(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const shares = await SpreadsheetShareModel.listShares(id);
      res.json({ success: true, data: shares });
    } catch (error) {
      logger.error('Failed to list shares', { error, id: req.params.id });
      res
        .status(500)
        .json({ success: false, message: 'Failed to list shares' });
    }
  }

  /**
   * POST /:id/shares — Add a share
   */
  static async addShare(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.userId || (req as any).user?.id;
      const { shareType, targetId, permission } = req.body;

      if (!shareType || !permission) {
        res
          .status(400)
          .json({ success: false, message: 'Missing shareType or permission' });
        return;
      }

      // Resolve email → userId for user shares
      let resolvedTargetId = targetId || null;
      if (shareType === 'user' && targetId) {
        // If targetId looks like an email, resolve to user ID
        if (targetId.includes('@')) {
          const user = await UserModel.findByEmail(targetId);
          if (!user) {
            res
              .status(404)
              .json({ success: false, message: `User not found: ${targetId}` });
            return;
          }
          resolvedTargetId = user.id;
        }
      }

      const share = await SpreadsheetShareModel.addShare({
        spreadsheetId: id,
        shareType,
        targetId: resolvedTargetId,
        permission,
        createdBy: userId,
      });

      res.status(201).json({ success: true, data: share });
    } catch (error) {
      logger.error('Failed to add share', { error, id: req.params.id });
      res.status(500).json({ success: false, message: 'Failed to add share' });
    }
  }

  /**
   * PATCH /:id/shares/:shareId — Update share permission
   */
  static async updateSharePermission(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { shareId } = req.params;
      const { permission } = req.body;

      if (!permission || !['viewer', 'editor'].includes(permission)) {
        res.status(400).json({ success: false, message: 'Invalid permission' });
        return;
      }

      const updated = await SpreadsheetShareModel.updatePermission(
        shareId,
        permission
      );
      if (!updated) {
        res.status(404).json({ success: false, message: 'Share not found' });
        return;
      }
      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to update share permission', { error });
      res
        .status(500)
        .json({ success: false, message: 'Failed to update share' });
    }
  }

  /**
   * DELETE /:id/shares/:shareId — Remove a share
   */
  static async removeShare(req: Request, res: Response): Promise<void> {
    try {
      const { shareId } = req.params;
      const deleted = await SpreadsheetShareModel.removeShare(shareId);
      if (!deleted) {
        res.status(404).json({ success: false, message: 'Share not found' });
        return;
      }
      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to remove share', { error });
      res
        .status(500)
        .json({ success: false, message: 'Failed to remove share' });
    }
  }

  /**
   * GET /shared — List spreadsheets shared with me
   */
  static async getSharedWithMe(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId || (req as any).user?.id;
      const orgId = (req as any).user?.orgId;

      if (!userId || !orgId) {
        res.status(400).json({ success: false, message: 'Missing context' });
        return;
      }

      const items = await SpreadsheetShareModel.findAccessibleByUser(
        userId,
        orgId
      );
      res.json({ success: true, data: { items } });
    } catch (error) {
      logger.error('Failed to list shared spreadsheets', { error });
      res
        .status(500)
        .json({
          success: false,
          message: 'Failed to list shared spreadsheets',
        });
    }
  }

  /**
   * GET /public/spreadsheets/shared/:token — Access by share token (no auth)
   */
  static async getByShareToken(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.params;
      const share = await SpreadsheetShareModel.findByToken(token);

      if (!share) {
        res
          .status(404)
          .json({ success: false, message: 'Share not found or expired' });
        return;
      }

      const spreadsheet = await SpreadsheetModel.findById(share.spreadsheetId);
      if (!spreadsheet) {
        res
          .status(404)
          .json({ success: false, message: 'Spreadsheet not found' });
        return;
      }

      res.json({
        success: true,
        data: {
          ...spreadsheet,
          permission: share.permission,
        },
      });
    } catch (error) {
      logger.error('Failed to get spreadsheet by share token', { error });
      res
        .status(500)
        .json({
          success: false,
          message: 'Failed to access shared spreadsheet',
        });
    }
  }
}
