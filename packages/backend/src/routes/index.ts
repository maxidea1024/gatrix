import express from 'express';
import { authLimiter } from '../middleware/rateLimiter';

// Import organized route modules
import clientRoutes from './client';
import serverRoutes from './server';
import adminRoutes from './admin';
import authRoutes from './auth';
import publicRoutes from './public';
import chatRoutes from './chat';
import userRoutes from './users';

const router = express.Router();

// Readiness check endpoint
router.get('/ready', (req, res) => {
  res.json({
    status: 'ready',
    timestamp: new Date().toISOString(),
    service: 'gatrix-backend'
  });
});

// Mount all route modules
router.use('/client', clientRoutes);
router.use('/server', serverRoutes);
router.use('/admin', adminRoutes);
router.use('/auth', authLimiter as any, authRoutes);
router.use('/chat', chatRoutes);
router.use('/users', userRoutes);
router.use('/', publicRoutes);

export default router;
