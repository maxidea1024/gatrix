import express from 'express';
import { clientSDKAuth, serverSDKAuth } from '../middleware/apiTokenAuth';
import RemoteConfigSDKController from '../controllers/RemoteConfigSDKController';

const router = express.Router();

// Client SDK routes
router.get('/client/templates', clientSDKAuth, RemoteConfigSDKController.getClientTemplates);
router.post('/client/evaluate', clientSDKAuth, RemoteConfigSDKController.evaluateConfig);
router.post('/client/metrics', clientSDKAuth, RemoteConfigSDKController.submitMetrics);

// Server SDK routes
router.get('/server/templates', serverSDKAuth, RemoteConfigSDKController.getServerTemplates);
router.post('/server/metrics', serverSDKAuth, RemoteConfigSDKController.submitMetrics);

export default router;
