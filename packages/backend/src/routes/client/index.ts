import express from 'express';
import clientRoutes from './client';

const router = express.Router();

// Mount existing client routes (public routes without authentication)
router.use('/', clientRoutes);

export default router;
