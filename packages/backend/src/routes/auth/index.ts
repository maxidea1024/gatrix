import express from 'express';
import authRoutes from './auth';

const router = express.Router();

// Mount authentication routes
router.use('/', authRoutes);

export default router;
