import express from 'express';
import { SpreadsheetController } from '../../controllers/spreadsheet-controller';

const router = express.Router();

// GET    /admin/spreadsheets           - List all spreadsheets
// GET    /admin/spreadsheets/:id       - Get single spreadsheet
// POST   /admin/spreadsheets           - Create new spreadsheet
// PUT    /admin/spreadsheets/:id       - Full update (auto-save)
// PATCH  /admin/spreadsheets/:id/meta  - Update metadata only
// DELETE /admin/spreadsheets/:id       - Delete spreadsheet
// POST   /admin/spreadsheets/:id/duplicate - Duplicate spreadsheet

router.get('/', SpreadsheetController.list as any);
router.get('/:id', SpreadsheetController.getById as any);
router.post('/', SpreadsheetController.create as any);
router.put('/:id', SpreadsheetController.update as any);
router.patch('/:id/meta', SpreadsheetController.updateMeta as any);
router.delete('/:id', SpreadsheetController.delete as any);
router.post('/:id/duplicate', SpreadsheetController.duplicate as any);

export default router;
