import express from 'express';
import { serverSDKAuth } from '../../middleware/apiTokenAuth';
import RemoteConfigSDKController from '../../controllers/RemoteConfigSDKController';

const router = express.Router();

// Server SDK routes (require API token authentication)
// These routes are for Server SDK usage

// Test SDK authentication
router.get('/test', serverSDKAuth, (req: any, res: any) => {
  const apiToken = req.apiToken;

  res.json({
    success: true,
    message: 'Server SDK authentication successful',
    data: {
      tokenId: apiToken?.id,
      tokenName: apiToken?.tokenName,
      tokenType: apiToken?.tokenType,
      timestamp: new Date().toISOString()
    }
  });
});

// Get templates for server SDK
router.get('/templates', serverSDKAuth, RemoteConfigSDKController.getServerTemplates);

// Submit metrics
router.post('/metrics', serverSDKAuth, RemoteConfigSDKController.submitMetrics);

export default router;
