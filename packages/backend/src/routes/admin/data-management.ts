import express from 'express';
import multer from 'multer';
import * as dataManagementController from '../../controllers/data-management-controller';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get('/export', dataManagementController.exportData as any);
router.post('/import', upload.single('file') as any, dataManagementController.importData as any);

export default router;
