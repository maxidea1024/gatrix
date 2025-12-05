import express from 'express';
import { serverSDKAuth } from '../../middleware/apiTokenAuth';
import RemoteConfigSDKController from '../../controllers/RemoteConfigSDKController';
import ServerAuthController from '../../controllers/ServerAuthController';
import ServerUserController from '../../controllers/ServerUserController';
import ServerNotificationController from '../../controllers/ServerNotificationController';
import ServerFileController from '../../controllers/ServerFileController';
import ServerChatController from '../../controllers/ServerChatController';
import { CouponRedeemController } from '../../controllers/CouponRedeemController';
import ServerGameWorldController from '../../controllers/ServerGameWorldController';
import IngamePopupNoticeController from '../../controllers/IngamePopupNoticeController';
import { SurveyController } from '../../controllers/SurveyController';
import { MaintenanceController } from '../../controllers/MaintenanceController';
import serviceDiscoveryRoutes, { getWhitelistsHandler } from './serviceDiscovery';
import ServerClientVersionController from '../../controllers/ServerClientVersionController';
import ServerServiceNoticeController from '../../controllers/ServerServiceNoticeController';
import ServerBannerController from '../../controllers/ServerBannerController';

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

// Coupon routes
router.post('/coupons/:code/redeem', serverSDKAuth, CouponRedeemController.redeem);

// Game world routes
router.get('/game-worlds', serverSDKAuth, ServerGameWorldController.getGameWorlds);
router.get('/game-worlds/world/:worldId', serverSDKAuth, ServerGameWorldController.getGameWorldByWorldId);
router.get('/game-worlds/:id', serverSDKAuth, ServerGameWorldController.getGameWorldById);

// Ingame popup notice routes
router.get('/ingame-popup-notices', serverSDKAuth, IngamePopupNoticeController.getServerIngamePopupNotices);
router.get('/ingame-popup-notices/:id', serverSDKAuth, IngamePopupNoticeController.getServerIngamePopupNoticeById);

// Survey routes
router.get('/surveys/settings', serverSDKAuth, SurveyController.getServerSurveySettings);
router.get('/surveys', serverSDKAuth, SurveyController.getServerSurveys);
router.get('/surveys/:id', serverSDKAuth, SurveyController.getServerSurveyById);

// Whitelist routes
router.get('/whitelists', serverSDKAuth, getWhitelistsHandler);

// Maintenance routes
router.get('/maintenance', serverSDKAuth, MaintenanceController.getStatus as any);

// Client version routes (Edge)
router.get('/client-versions', serverSDKAuth, ServerClientVersionController.getClientVersions);
router.get('/client-versions/:id', serverSDKAuth, ServerClientVersionController.getClientVersionById);

// Service notice routes (Edge)
router.get('/service-notices', serverSDKAuth, ServerServiceNoticeController.getServiceNotices);
router.get('/service-notices/:id', serverSDKAuth, ServerServiceNoticeController.getServiceNoticeById);

// Banner routes (Edge)
router.get('/banners', serverSDKAuth, ServerBannerController.getBanners);
router.get('/banners/:bannerId', serverSDKAuth, ServerBannerController.getBannerById);

// Service discovery routes
router.use('/services', serviceDiscoveryRoutes);

export default router;
