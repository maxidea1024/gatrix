import express from 'express';
import { authLimiter } from '../middleware/rate-limiter';
import { ApiAccessToken } from '../models/api-access-token';
import { createLogger } from '../config/logger';

const logger = createLogger('routes');

// Import organized route modules
import clientRoutes from './client';
import serverRoutes from './server';
import adminRoutes from './admin';
import { MonitoringAlertController } from '../controllers/monitoring-alert-controller';
import authRoutes from './auth';
import publicRoutes from './public';
// chatRoutes are handled directly in app.ts before body parsing
import userRoutes from './users';
import linkPreviewRoutes from './link-preview';
import mailRoutes from './mails';
import couponRoutes from './coupons';
import entityLockRoutes from '../controllers/entity-lock-controller';
import signalIngestionRoutes from './public/signals';

const router = express.Router();

// Readiness check endpoint
router.get('/ready', async (req, res) => {
  const responseData: Record<string, any> = {
    status: 'ready',
    timestamp: new Date().toISOString(),
    service: 'gatrix-backend',
  };

  // If API token is provided, resolve and return environment info
  const token = (req.headers['x-api-token'] as string) || (req.query.token as string);
  if (token) {
    try {
      const tokenData = await ApiAccessToken.validateAndUse(token);
      if (tokenData?.environmentId) {
        responseData.environmentId = tokenData.environmentId;
      }
    } catch (error) {
      logger.debug('Failed to resolve token in /ready endpoint', { error });
    }
  }

  res.json({
    success: true,
    data: responseData,
  });
});

// Public webhook endpoint for Grafana alert notifications
router.post('/monitoring/alerts', MonitoringAlertController.receiveAlert as any);

// Mount all route modules
router.use('/client', clientRoutes);
router.use('/server', serverRoutes);
router.use('/admin', adminRoutes);
router.use('/auth', authLimiter as any, authRoutes);
// chat routes are handled directly in app.ts before body parsing
router.use('/users', userRoutes);
router.use('/link-preview', linkPreviewRoutes);
router.use('/mails', mailRoutes);
router.use('/coupons', couponRoutes);
router.use('/public', publicRoutes);
router.use('/entity-locks', entityLockRoutes);
router.use('/signals', signalIngestionRoutes);

export default router;
