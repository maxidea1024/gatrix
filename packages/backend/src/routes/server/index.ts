import express from 'express';
import { serverSDKAuth } from '../../middleware/apiTokenAuth';
import RemoteConfigSDKController from '../../controllers/RemoteConfigSDKController';
import ServerAuthController from '../../controllers/ServerAuthController';
import ServerUserController from '../../controllers/ServerUserController';
import ServerNotificationController from '../../controllers/ServerNotificationController';
import ServerFileController from '../../controllers/ServerFileController';
import ServerChatController from '../../controllers/ServerChatController';

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

// Authentication routes
router.post('/auth/verify-token', ServerAuthController.verifyToken); // JWT 토큰 검증 (API Token 불필요)
router.get('/auth/user/:id', serverSDKAuth, ServerAuthController.getUserById);

// User routes
router.get('/users/sync', serverSDKAuth, ServerUserController.syncUsers);
router.get('/users/:id', serverSDKAuth, ServerUserController.getUserById);
router.post('/users/batch', serverSDKAuth, ServerUserController.getUsersByIds);

// Notification routes
router.post('/notifications', serverSDKAuth, ServerNotificationController.sendNotification);

// File routes
router.post('/files/upload-url', serverSDKAuth, ServerFileController.getUploadUrl);
router.get('/files/:fileId', serverSDKAuth, ServerFileController.getFileInfo);

// Chat server routes
router.post('/chat/register', serverSDKAuth, ServerChatController.registerServer);
router.post('/chat/unregister', serverSDKAuth, ServerChatController.unregisterServer);
router.post('/chat/stats', serverSDKAuth, ServerChatController.reportStats);
router.post('/chat/activity', serverSDKAuth, ServerChatController.reportActivity);
router.get('/chat/servers', serverSDKAuth, ServerChatController.getRegisteredServers);

// Notification routes (bulk)
router.post('/notifications/bulk', serverSDKAuth, ServerNotificationController.sendBulkNotification);

export default router;
