import express from 'express';
import { clientSDKAuth } from '../../middleware/apiTokenAuth';
import RemoteConfigSDKController from '../../controllers/RemoteConfigSDKController';
import clientRoutes from './client';

const router = express.Router();

// Mount existing client routes (public routes without authentication)
router.use('/', clientRoutes);

// SDK routes (require API token authentication)
// These routes are for Client SDK usage

// Test SDK authentication (handled in client routes)

// Get templates for client SDK
router.get('/templates', clientSDKAuth, RemoteConfigSDKController.getClientTemplates);

// Evaluate configuration
router.post('/evaluate', clientSDKAuth, RemoteConfigSDKController.evaluateConfig);

// Submit metrics
router.post('/metrics', clientSDKAuth, RemoteConfigSDKController.submitMetrics);

export default router;
