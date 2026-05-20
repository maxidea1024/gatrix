import express from 'express';
import { SpreadsheetController } from '../../controllers/spreadsheet-controller';

const router = express.Router();

// GET    /admin/spreadsheets           - List all spreadsheets
// GET    /admin/spreadsheets/shared    - List spreadsheets shared with me
// GET    /admin/spreadsheets/:id       - Get single spreadsheet
// POST   /admin/spreadsheets           - Create new spreadsheet
// PUT    /admin/spreadsheets/:id       - Full update (auto-save)
// PATCH  /admin/spreadsheets/:id/meta  - Update metadata only
// DELETE /admin/spreadsheets/:id       - Delete spreadsheet
// POST   /admin/spreadsheets/:id/duplicate - Duplicate spreadsheet
// --- Sharing ---
// GET    /admin/spreadsheets/:id/shares        - List shares
// POST   /admin/spreadsheets/:id/shares        - Add share
// PATCH  /admin/spreadsheets/:id/shares/:shareId - Update share permission
// DELETE /admin/spreadsheets/:id/shares/:shareId - Remove share
// --- Collaboration ---
// GET    /admin/spreadsheets/:id/events    - SSE event stream
// POST   /admin/spreadsheets/:id/lock      - Acquire edit lock
// DELETE /admin/spreadsheets/:id/lock      - Release edit lock
// POST   /admin/spreadsheets/:id/heartbeat - Extend lock TTL

// "shared" must come before "/:id" to avoid being caught as an ID param
router.get('/shared', SpreadsheetController.getSharedWithMe as any);

router.get('/', SpreadsheetController.list as any);
router.get('/:id', SpreadsheetController.getById as any);
router.post('/', SpreadsheetController.create as any);
router.put('/:id', SpreadsheetController.update as any);
router.patch('/:id/meta', SpreadsheetController.updateMeta as any);
router.delete('/:id', SpreadsheetController.delete as any);
router.post('/:id/duplicate', SpreadsheetController.duplicate as any);

// Sharing
router.get('/:id/shares', SpreadsheetController.listShares as any);
router.post('/:id/shares', SpreadsheetController.addShare as any);
router.patch('/:id/shares/:shareId', SpreadsheetController.updateSharePermission as any);
router.delete('/:id/shares/:shareId', SpreadsheetController.removeShare as any);

// Collaboration
router.get('/:id/events', SpreadsheetController.streamEvents as any);
router.post('/:id/lock', SpreadsheetController.acquireLock as any);
router.delete('/:id/lock', SpreadsheetController.releaseLock as any);
router.post('/:id/heartbeat', SpreadsheetController.heartbeat as any);

export default router;
