import express from 'express';
import { authenticateServerApiToken } from '../../middleware/apiTokenAuth';
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
// Internal routes (Edge bypass token only) - No environment required
// ============================================================================

// Get all valid API tokens for Edge mirroring
router.get('/internal/tokens', authenticateServerApiToken, InternalApiTokensController.getAllTokens as any);

// Receive token usage report from Edge servers
router.post('/internal/token-usage-report', authenticateServerApiToken, InternalApiTokensController.receiveUsageReport as any);

// ============================================================================
// Global routes (environment-independent) - No environment required
// ============================================================================

// Test SDK authentication
router.get('/test', authenticateServerApiToken, (req: any, res: any) => {
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

// Environment list (for Edge to discover all environments) - No environment header required
router.get('/environments', authenticateServerApiToken, ServerEnvironmentController.getEnvironments);

// Authentication routes - No environment required
router.post('/auth/verify-token', ServerAuthController.verifyToken); // JWT 토큰 검증 (API Token 불필요)
router.get('/auth/user/:id', authenticateServerApiToken, ServerAuthController.getUserById);

// User routes - No environment required (global users)
router.get('/users/sync', authenticateServerApiToken, ServerUserController.syncUsers);
router.get('/users/:id', authenticateServerApiToken, ServerUserController.getUserById);
router.post('/users/batch', authenticateServerApiToken, ServerUserController.getUsersByIds);

// Notification routes - No environment required (global notifications)
router.post('/notifications', authenticateServerApiToken, ServerNotificationController.sendNotification);
router.post('/notifications/bulk', authenticateServerApiToken, ServerNotificationController.sendBulkNotification);

// File routes - No environment required
router.post('/files/upload-url', authenticateServerApiToken, ServerFileController.getUploadUrl);
router.get('/files/:fileId', authenticateServerApiToken, ServerFileController.getFileInfo);

// Chat server routes - No environment required
router.post('/chat/register', authenticateServerApiToken, ServerChatController.registerServer);
router.post('/chat/unregister', authenticateServerApiToken, ServerChatController.unregisterServer);
router.post('/chat/stats', authenticateServerApiToken, ServerChatController.reportStats);
router.post('/chat/activity', authenticateServerApiToken, ServerChatController.reportActivity);
router.get('/chat/servers', authenticateServerApiToken, ServerChatController.getRegisteredServers);

// Service discovery routes
router.use('/services', serviceDiscoveryRoutes);

// ============================================================================
// Environment-specific routes: /api/v1/server/:env/...
// ============================================================================

// Remote config templates
router.get('/:env/templates', authenticateServerApiToken, resolveEnvironment, RemoteConfigSDKController.getServerTemplates);
router.post('/:env/metrics', authenticateServerApiToken, resolveEnvironment, RemoteConfigSDKController.submitMetrics);

// Coupon routes
router.post('/:env/coupons/:code/redeem', authenticateServerApiToken, resolveEnvironment, CouponRedeemController.redeem);

// Game world routes
router.get('/:env/game-worlds', authenticateServerApiToken, resolveEnvironment, ServerGameWorldController.getGameWorlds);
router.get('/:env/game-worlds/world/:worldId', authenticateServerApiToken, resolveEnvironment, ServerGameWorldController.getGameWorldByWorldId);
router.get('/:env/game-worlds/:id', authenticateServerApiToken, resolveEnvironment, ServerGameWorldController.getGameWorldById);

// Ingame popup notice routes
router.get('/:env/ingame-popup-notices', authenticateServerApiToken, resolveEnvironment, IngamePopupNoticeController.getServerIngamePopupNotices);
router.get('/:env/ingame-popup-notices/:id', authenticateServerApiToken, resolveEnvironment, IngamePopupNoticeController.getServerIngamePopupNoticeById);

// Survey routes
router.get('/:env/surveys/settings', authenticateServerApiToken, resolveEnvironment, SurveyController.getServerSurveySettings);
router.get('/:env/surveys', authenticateServerApiToken, resolveEnvironment, SurveyController.getServerSurveys);
router.get('/:env/surveys/:id', authenticateServerApiToken, resolveEnvironment, SurveyController.getServerSurveyById);

// Whitelist routes
router.get('/:env/whitelists', authenticateServerApiToken, resolveEnvironment, getWhitelistsHandler);

// Maintenance routes
router.get('/:env/maintenance', authenticateServerApiToken, resolveEnvironment, MaintenanceController.getStatus as any);

// Client version routes
router.get('/:env/client-versions', authenticateServerApiToken, resolveEnvironment, ServerClientVersionController.getClientVersions);
router.get('/:env/client-versions/:id', authenticateServerApiToken, resolveEnvironment, ServerClientVersionController.getClientVersionById);

// Service notice routes
router.get('/:env/service-notices', authenticateServerApiToken, resolveEnvironment, ServerServiceNoticeController.getServiceNotices);
router.get('/:env/service-notices/:id', authenticateServerApiToken, resolveEnvironment, ServerServiceNoticeController.getServiceNoticeById);

// Banner routes
router.get('/:env/banners', authenticateServerApiToken, resolveEnvironment, ServerBannerController.getBanners);
router.get('/:env/banners/:bannerId', authenticateServerApiToken, resolveEnvironment, ServerBannerController.getBannerById);

// Store product routes
router.get('/:env/store-products', authenticateServerApiToken, resolveEnvironment, ServerStoreProductController.getStoreProducts);
router.get('/:env/store-products/:id', authenticateServerApiToken, resolveEnvironment, ServerStoreProductController.getStoreProductById);

export default router;
