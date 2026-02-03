import express from 'express';
import multer from 'multer';
import * as dataManagementController from '../../controllers/DataManagementController';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * @swagger
 * /admin/data-management/export:
 *   get:
 *     summary: Export all system data (DB, Planning Data, Uploads)
 *     tags: [Data Management]
 *     responses:
 *       200:
 *         description: ZIP file containing all data
 *         content:
 *           application/zip:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get('/export', dataManagementController.exportData as any);

/**
 * @swagger
 * /admin/data-management/import:
 *   post:
 *     summary: Import system data from ZIP file
 *     tags: [Data Management]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Import successful
 */
router.post('/import', upload.single('file') as any, dataManagementController.importData as any);

export default router;
