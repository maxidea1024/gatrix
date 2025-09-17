import express from 'express';
import { authLimiter } from '../middleware/rateLimiter';

// Import organized route modules
import clientRoutes from './client';
import serverRoutes from './server';
import adminRoutes from './admin';
import authRoutes from './auth';
import publicRoutes from './public';

const router = express.Router();

// Mount all route modules
router.use('/client', clientRoutes);
router.use('/server', serverRoutes);
router.use('/admin', adminRoutes);
router.use('/auth', authLimiter as any, authRoutes);
router.use('/', publicRoutes);

export default router;
