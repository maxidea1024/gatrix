import express from 'express';
import { serverSDKAuth } from '../../middleware/apiTokenAuth';
import RemoteConfigSDKController from '../../controllers/RemoteConfigSDKController';

const router = express.Router();

// Server SDK routes (require API token authentication)
// These routes are for Server SDK usage

// Test SDK authentication
router.get('/test', serverSDKAuth, RemoteConfigSDKController.testAuth);

// Get templates for server SDK
router.get('/templates', serverSDKAuth, RemoteConfigSDKController.getServerTemplates);

// Submit metrics
router.post('/metrics', serverSDKAuth, RemoteConfigSDKController.submitMetrics);

export default router;
