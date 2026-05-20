import express from 'express';
import uploadRoutes from './upload';
import invitationRoutes from './invitations';
import serviceNoticeRoutes from './service-notices';
import monitoringRoutes from './monitoring';
import signalRoutes from './signals';
import surveyRendererRoutes from './survey-renderer';
import { SpreadsheetController } from '../../controllers/spreadsheet-controller';

const router = express.Router();

// Public routes that don't require authentication
router.use('/upload', uploadRoutes);
router.use('/invitations', invitationRoutes);
router.use('/service-notices', serviceNoticeRoutes);
router.use('/monitoring', monitoringRoutes);
router.use('/signals', signalRoutes);
router.use('/surveys', surveyRendererRoutes);

// Public spreadsheet share access (no auth required)
router.get('/spreadsheets/shared/:token', SpreadsheetController.getByShareToken as any);

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

// Time endpoint
router.get('/time', (req, res) => {
  const clientLocalTime = req.query.clientLocalTime
    ? parseInt(req.query.clientLocalTime as string)
    : null;
  const serverLocalTime = Date.now();

  res.json({
    success: true,
    data: {
      serverLocalTimeISO: new Date(serverLocalTime).toISOString(),
      serverLocalTime,
      clientLocalTime,
      uptime: process.uptime(),
    },
  });
});

export default router;
