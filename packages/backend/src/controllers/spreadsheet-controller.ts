import { Request, Response } from 'express';
import SpreadsheetModel from '../models/spreadsheet';
import { createLogger } from '../config/logger';

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

      const { title, description } = req.body;

      const spreadsheet = await SpreadsheetModel.create({
        orgId,
        title: title || 'Untitled Spreadsheet',
        description: description || null,
        sheetData: getDefaultSheetData(),
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
      const { title, description, sheetData, thumbnail, isPinned } = req.body;

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
        sheetData: typeof sheetData === 'string' ? sheetData : JSON.stringify(sheetData),
        thumbnail,
        isPinned,
        updatedBy: userId,
      });

      res.json({ success: true, data: spreadsheet });
    } catch (error) {
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
}
