import express from 'express';
import { serverSDKAuth } from '../../middleware/apiTokenAuth';
import { resolveEnvironment } from '../../middleware/environmentResolver';
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
import ServerStoreProductController from '../../controllers/ServerStoreProductController';
import ServerEnvironmentController from '../../controllers/ServerEnvironmentController';
import InternalApiTokensController from '../../controllers/InternalApiTokensController';

const router = express.Router();

// ============================================================================
// Internal routes (Edge bypass token only)
// ============================================================================

// Get all valid API tokens for Edge mirroring
router.get('/internal/tokens', serverSDKAuth, InternalApiTokensController.getAllTokens as any);

// Receive token usage report from Edge servers
router.post('/internal/token-usage-report', serverSDKAuth, InternalApiTokensController.receiveUsageReport as any);

// ============================================================================
// Global routes (environment-independent)
// ============================================================================

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

// Environment list (for Edge to discover all environments)
router.get('/environments', serverSDKAuth, ServerEnvironmentController.getEnvironments);

// Authentication routes
router.post('/auth/verify-token', ServerAuthController.verifyToken); // JWT 토큰 검증 (API Token 불필요)
router.get('/auth/user/:id', serverSDKAuth, ServerAuthController.getUserById);

// User routes
router.get('/users/sync', serverSDKAuth, ServerUserController.syncUsers);
router.get('/users/:id', serverSDKAuth, ServerUserController.getUserById);
router.post('/users/batch', serverSDKAuth, ServerUserController.getUsersByIds);

// Notification routes
router.post('/notifications', serverSDKAuth, ServerNotificationController.sendNotification);
router.post('/notifications/bulk', serverSDKAuth, ServerNotificationController.sendBulkNotification);

// File routes
router.post('/files/upload-url', serverSDKAuth, ServerFileController.getUploadUrl);
router.get('/files/:fileId', serverSDKAuth, ServerFileController.getFileInfo);

// Chat server routes
router.post('/chat/register', serverSDKAuth, ServerChatController.registerServer);
router.post('/chat/unregister', serverSDKAuth, ServerChatController.unregisterServer);
router.post('/chat/stats', serverSDKAuth, ServerChatController.reportStats);
router.post('/chat/activity', serverSDKAuth, ServerChatController.reportActivity);
router.get('/chat/servers', serverSDKAuth, ServerChatController.getRegisteredServers);

// Service discovery routes
router.use('/services', serviceDiscoveryRoutes);

// ============================================================================
// Environment-specific routes: /api/v1/server/:env/...
// ============================================================================

// Remote config templates
router.get('/:env/templates', serverSDKAuth, resolveEnvironment, RemoteConfigSDKController.getServerTemplates);
router.post('/:env/metrics', serverSDKAuth, resolveEnvironment, RemoteConfigSDKController.submitMetrics);

// Coupon routes
router.post('/:env/coupons/:code/redeem', serverSDKAuth, resolveEnvironment, CouponRedeemController.redeem);

// Game world routes
router.get('/:env/game-worlds', serverSDKAuth, resolveEnvironment, ServerGameWorldController.getGameWorlds);
router.get('/:env/game-worlds/world/:worldId', serverSDKAuth, resolveEnvironment, ServerGameWorldController.getGameWorldByWorldId);
router.get('/:env/game-worlds/:id', serverSDKAuth, resolveEnvironment, ServerGameWorldController.getGameWorldById);

// Ingame popup notice routes
router.get('/:env/ingame-popup-notices', serverSDKAuth, resolveEnvironment, IngamePopupNoticeController.getServerIngamePopupNotices);
router.get('/:env/ingame-popup-notices/:id', serverSDKAuth, resolveEnvironment, IngamePopupNoticeController.getServerIngamePopupNoticeById);

// Survey routes
router.get('/:env/surveys/settings', serverSDKAuth, resolveEnvironment, SurveyController.getServerSurveySettings);
router.get('/:env/surveys', serverSDKAuth, resolveEnvironment, SurveyController.getServerSurveys);
router.get('/:env/surveys/:id', serverSDKAuth, resolveEnvironment, SurveyController.getServerSurveyById);

// Whitelist routes
router.get('/:env/whitelists', serverSDKAuth, resolveEnvironment, getWhitelistsHandler);

// Maintenance routes
router.get('/:env/maintenance', serverSDKAuth, resolveEnvironment, MaintenanceController.getStatus as any);

// Client version routes
router.get('/:env/client-versions', serverSDKAuth, resolveEnvironment, ServerClientVersionController.getClientVersions);
router.get('/:env/client-versions/:id', serverSDKAuth, resolveEnvironment, ServerClientVersionController.getClientVersionById);

// Service notice routes
router.get('/:env/service-notices', serverSDKAuth, resolveEnvironment, ServerServiceNoticeController.getServiceNotices);
router.get('/:env/service-notices/:id', serverSDKAuth, resolveEnvironment, ServerServiceNoticeController.getServiceNoticeById);

// Banner routes
router.get('/:env/banners', serverSDKAuth, resolveEnvironment, ServerBannerController.getBanners);
router.get('/:env/banners/:bannerId', serverSDKAuth, resolveEnvironment, ServerBannerController.getBannerById);

// Store product routes
router.get('/:env/store-products', serverSDKAuth, resolveEnvironment, ServerStoreProductController.getStoreProducts);
router.get('/:env/store-products/:id', serverSDKAuth, resolveEnvironment, ServerStoreProductController.getStoreProductById);

export default router;
