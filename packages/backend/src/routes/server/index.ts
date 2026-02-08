import express from 'express';
import multer from 'multer';
import { serverAuthBase, serverSDKAuth } from '../../middleware/apiTokenAuth';
import { resolveEnvironment } from '../../middleware/environmentResolver';
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
import { PlanningDataController } from '../../controllers/PlanningDataController';
import ServerFeatureFlagController from '../../controllers/ServerFeatureFlagController';

const router = express.Router();

// Configure multer for planning data file uploads (memory storage)
// 100MB file size limit for planning data uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
  },
});

// ============================================================================
// Internal routes (Edge bypass token only) - No environment required
// ============================================================================

// Get all valid API tokens for Edge mirroring
router.get('/internal/tokens', serverAuthBase, InternalApiTokensController.getAllTokens as any);

// Receive token usage report from Edge servers
router.post(
  '/internal/token-usage-report',
  serverAuthBase,
  InternalApiTokensController.receiveUsageReport as any
);

// ============================================================================
// Global routes (environment-independent) - No environment required
// ============================================================================

// Test SDK authentication
router.get('/test', serverAuthBase, (req: any, res: any) => {
  const apiToken = req.apiToken;

  res.json({
    success: true,
    message: 'Server SDK authentication successful',
    data: {
      tokenId: apiToken?.id,
      tokenName: apiToken?.tokenName,
      tokenType: apiToken?.tokenType,
      timestamp: new Date().toISOString(),
    },
  });
});

// Environment list (for Edge to discover all environments) - No environment header required
router.get('/environments', serverAuthBase, ServerEnvironmentController.getEnvironments);

// Authentication routes - No environment required
router.post('/auth/verify-token', ServerAuthController.verifyToken); // JWT 토큰 검증 (API Token 불필요)
router.get('/auth/user/:id', serverAuthBase, ServerAuthController.getUserById);

// User routes - No environment required (global users)
router.get('/users/sync', serverAuthBase, ServerUserController.syncUsers);
router.get('/users/:id', serverAuthBase, ServerUserController.getUserById);
router.post('/users/batch', serverAuthBase, ServerUserController.getUsersByIds);

// Notification routes - No environment required (global notifications)
router.post('/notifications', serverAuthBase, ServerNotificationController.sendNotification);
router.post(
  '/notifications/bulk',
  serverAuthBase,
  ServerNotificationController.sendBulkNotification
);

// File routes - No environment required
router.post('/files/upload-url', serverAuthBase, ServerFileController.getUploadUrl);
router.get('/files/:fileId', serverAuthBase, ServerFileController.getFileInfo);

// Chat server routes - No environment required
router.post('/chat/register', serverAuthBase, ServerChatController.registerServer);
router.post('/chat/unregister', serverAuthBase, ServerChatController.unregisterServer);
router.post('/chat/stats', serverAuthBase, ServerChatController.reportStats);
router.post('/chat/activity', serverAuthBase, ServerChatController.reportActivity);
router.get('/chat/servers', serverAuthBase, ServerChatController.getRegisteredServers);

// Service discovery routes
router.use('/services', serviceDiscoveryRoutes);

// ============================================================================
// Environment-specific routes: /api/v1/server/:env/...
// ============================================================================

// Coupon routes
router.post('/:env/coupons/:code/redeem', serverSDKAuth, CouponRedeemController.redeem);

// Game world routes
router.get('/:env/game-worlds', serverSDKAuth, ServerGameWorldController.getGameWorlds);
router.get(
  '/:env/game-worlds/world/:worldId',
  serverSDKAuth,
  ServerGameWorldController.getGameWorldByWorldId
);
router.get('/:env/game-worlds/:id', serverSDKAuth, ServerGameWorldController.getGameWorldById);

// Ingame popup notice routes
router.get(
  '/:env/ingame-popup-notices',
  serverSDKAuth,
  IngamePopupNoticeController.getServerIngamePopupNotices
);
router.get(
  '/:env/ingame-popup-notices/:id',
  serverSDKAuth,
  IngamePopupNoticeController.getServerIngamePopupNoticeById
);

// Survey routes
router.get('/:env/surveys/settings', serverSDKAuth, SurveyController.getServerSurveySettings);
router.get('/:env/surveys', serverSDKAuth, SurveyController.getServerSurveys);
router.get('/:env/surveys/:id', serverSDKAuth, SurveyController.getServerSurveyById);

// Whitelist routes
router.get('/:env/whitelists', serverSDKAuth, getWhitelistsHandler);

// Maintenance routes
router.get('/:env/maintenance', serverSDKAuth, MaintenanceController.getStatus as any);

// Client version routes
router.get('/:env/client-versions', serverSDKAuth, ServerClientVersionController.getClientVersions);
router.get(
  '/:env/client-versions/:id',
  serverSDKAuth,
  ServerClientVersionController.getClientVersionById
);

// Service notice routes
router.get('/:env/service-notices', serverSDKAuth, ServerServiceNoticeController.getServiceNotices);
router.get(
  '/:env/service-notices/:id',
  serverSDKAuth,
  ServerServiceNoticeController.getServiceNoticeById
);

// Banner routes
router.get('/:env/banners', serverSDKAuth, ServerBannerController.getBanners);
router.get('/:env/banners/:bannerId', serverSDKAuth, ServerBannerController.getBannerById);

// Store product routes
router.get('/:env/store-products', serverSDKAuth, ServerStoreProductController.getStoreProducts);
router.get(
  '/:env/store-products/:id',
  serverSDKAuth,
  ServerStoreProductController.getStoreProductById
);

// Planning data upload route (for external CLI uploads)
router.post(
  '/:env/planning-data/upload',
  serverSDKAuth as any,
  upload.any() as any,
  PlanningDataController.uploadPlanningData as any
);

// Feature flag routes
router.get('/:env/features', serverSDKAuth as any, ServerFeatureFlagController.getFeatureFlags as any);
router.get(
  '/:env/features/:flagName',
  serverSDKAuth as any,
  ServerFeatureFlagController.getFeatureFlag as any
);
router.post(
  '/:env/features/metrics',
  serverSDKAuth as any,
  ServerFeatureFlagController.receiveMetrics as any
);
router.post(
  '/:env/features/unknown',
  serverSDKAuth as any,
  ServerFeatureFlagController.reportUnknownFlag as any
);
router.get('/:env/segments', serverSDKAuth as any, ServerFeatureFlagController.getSegments as any);

export default router;
