import express from 'express';
import {
  authenticate,
  requireOrgPermission,
  requireProjectPermission,
  requireEnvPermission,
} from '../../middleware/auth';
import { environmentContextMiddleware } from '../../middleware/environment-middleware';
import { orgProjectScope } from '../../middleware/org-project-scope';
import { P } from '@gatrix/shared/permissions';

// Import all admin-related route modules
import adminRoutes from './admin';
import userRoutes from './users';
import whitelistRoutes from './whitelist';
import ipWhitelistRoutes from './ip-whitelist';
import clientVersionRoutes from './client-version-routes';
import auditLogRoutes from './audit-logs';
import tagRoutes from './tags';
import messageTemplateRoutes from './message-templates';
import translationRoutes from './translation';
import varsRoutes from './vars';
import gameWorldRoutes from './game-worlds';
import apiTokenRoutes from './api-tokens';
import notificationRoutes from './notifications';

import environmentRoutes from './environments';
import jobRoutes from './jobs';
import maintenanceRoutes from './maintenance';
import invitationRoutes from './invitations';
import crashEventRoutes from './crash-events';
import crashesRoutes from './crashes';
import fileStorageRoutes from './file-storage';
import consoleRoutes from './console';
import surveyRoutes from './surveys';
import rewardTemplateRoutes from './reward-templates';
import storeProductRoutes from './store-products';
import serviceNoticeRoutes from './service-notices';
import ingamePopupNoticeRoutes from './ingame-popup-notices';
import planningDataRoutes from './planning-data';
import couponSettingsRoutes from './coupon-settings';
import serviceDiscoveryRoutes from './service-discovery';
import monitoringAlertRoutes from './monitoring-alerts';
import dataManagementRoutes from './data-management';
import bannerRoutes from './banners';
import cmsCashShopRoutes from './cms-cash-shop';
import serverLifecycleRoutes from './server-lifecycle';
import changeRequestRoutes from './change-requests';
import featureRoutes from './features';
import platformDefaultsRoutes from './platform-defaults';
import unknownFlagsRoutes from './unknown-flags';
import integrationRoutes from './integrations';
import releaseFlowRoutes from './release-flows';
import serviceAccountRoutes from './service-accounts';
import signalEndpointRoutes from './signal-endpoints';
import actionSetRoutes from './action-sets';
import queueMonitorRoutes from './queue-monitor';
import rbacRoutes from './rbac';
import aiChatRoutes from './ai-chat';
import ImpactMetricsController from '../../controllers/impact-metrics-controller';

const router = express.Router();

// Mount routes with SSE endpoints first (before authentication middleware)
// This allows SSE endpoints to use their own authentication (query parameter tokens)
router.use('/notifications', notificationRoutes);
router.use('/services', serviceDiscoveryRoutes);
router.use('/ai', aiChatRoutes);

// Self-service routes for authenticated users (not requiring admin role)

import { permissionService } from '../../services/permission-service';
import { createLogger } from '../../config/logger';

const logger = createLogger('index');
router.get(
  '/users/me/environments',
  authenticate as any,
  async (req: any, res: any) => {
    try {
      const userId = req.user?.userId || req.user?.id;
      if (!userId) {
        return res
          .status(401)
          .json({ success: false, message: 'Unauthorized' });
      }

      const orgId = req.user?.orgId;

      // Check if user is org admin via RBAC (has wildcard permissions)
      const isSuperAdmin = orgId
        ? await permissionService.isOrgAdmin(userId, orgId)
        : false;
      if (isSuperAdmin) {
        return res.json({
          success: true,
          data: { allowAllEnvironments: true, environments: [] },
        });
      }

      // Regular users: return allowAllEnvironments: true for now
      // (granular env-level filtering is done per-project in getEnvironments)
      return res.json({
        success: true,
        data: { allowAllEnvironments: true, environments: [] },
      });
    } catch (error) {
      logger.error('Error getting user environment access:', error);
      res
        .status(500)
        .json({ success: false, message: 'Failed to get environment access' });
    }
  }
);

// Self-service: Get current user's RBAC permissions (no requirePermission needed)
import { UserController } from '../../controllers/user-controller';
router.get(
  '/users/me/permissions',
  authenticate as any,
  UserController.getMyPermissions
);

router.use('/rbac', rbacRoutes);

// Apply authentication middleware to all other admin routes
router.use(authenticate as any);

// Apply environment context middleware to set current environment from X-Environment-Id header
router.use(environmentContextMiddleware as any);

// Mount all other admin routes with permission checks
// Dashboard and stats - no special permission required (admin role is enough)
router.use('/', adminRoutes);

// User management - requires users.view or users.manage permission
router.use(
  '/users',
  requireOrgPermission([P.USERS_READ, P.USERS_UPDATE]) as any,
  userRoutes
);

// Security routes - requires security.view or security.manage permission
router.use(
  '/whitelist',
  requireEnvPermission([
    P.ACCOUNT_WHITELIST_READ,
    P.ACCOUNT_WHITELIST_UPDATE,
  ]) as any,
  whitelistRoutes
);
router.use(
  '/ip-whitelist',
  requireEnvPermission([P.IP_WHITELIST_READ, P.IP_WHITELIST_UPDATE]) as any,
  ipWhitelistRoutes
);

// ========================================
// Project-scoped routes
// /orgs/:orgId/projects/:projectId/...
// ========================================
const projectRouter = express.Router({ mergeParams: true });
projectRouter.use(orgProjectScope as any);

// Feature Flags
projectRouter.use(
  '/features',
  requireProjectPermission([P.FEATURES_READ, P.FEATURES_UPDATE]) as any,
  featureRoutes
);

// Tags
projectRouter.use(
  '/tags',
  requireProjectPermission([P.TAGS_READ, P.TAGS_UPDATE]) as any,
  tagRoutes
);

// Environments
projectRouter.use(
  '/environments',
  requireProjectPermission([P.ENVIRONMENTS_READ, P.ENVIRONMENTS_UPDATE]) as any,
  environmentRoutes
);

// Unknown Flags
projectRouter.use(
  '/unknown-flags',
  requireProjectPermission([P.UNKNOWN_FLAGS_READ]) as any,
  unknownFlagsRoutes
);

// Release Flows
projectRouter.use(
  '/release-flows',
  requireProjectPermission([
    P.RELEASE_FLOWS_READ,
    P.RELEASE_FLOWS_UPDATE,
  ]) as any,
  releaseFlowRoutes
);

// Change Requests
projectRouter.use(
  '/change-requests',
  requireEnvPermission([
    P.CHANGE_REQUESTS_CREATE,
    P.CHANGE_REQUESTS_APPROVE,
  ]) as any,
  changeRequestRoutes
);

// Impact Metrics
projectRouter.get(
  '/impact-metrics/available',
  requireProjectPermission([
    P.IMPACT_METRICS_READ,
    P.IMPACT_METRICS_UPDATE,
  ]) as any,
  ImpactMetricsController.getAvailableMetrics as any
);
projectRouter.get(
  '/impact-metrics/labels',
  requireProjectPermission([
    P.IMPACT_METRICS_READ,
    P.IMPACT_METRICS_UPDATE,
  ]) as any,
  ImpactMetricsController.getMetricLabels as any
);
projectRouter.get(
  '/impact-metrics',
  requireProjectPermission([
    P.IMPACT_METRICS_READ,
    P.IMPACT_METRICS_UPDATE,
  ]) as any,
  ImpactMetricsController.queryTimeSeries as any
);
projectRouter.get(
  '/impact-metrics/configs/:flagId',
  requireProjectPermission([
    P.IMPACT_METRICS_READ,
    P.IMPACT_METRICS_UPDATE,
  ]) as any,
  ImpactMetricsController.getConfigs.bind(ImpactMetricsController) as any
);
projectRouter.post(
  '/impact-metrics/configs',
  requireProjectPermission(P.IMPACT_METRICS_UPDATE) as any,
  ImpactMetricsController.createConfig.bind(ImpactMetricsController) as any
);
projectRouter.put(
  '/impact-metrics/configs/layouts',
  requireProjectPermission(P.IMPACT_METRICS_UPDATE) as any,
  ImpactMetricsController.updateLayouts.bind(ImpactMetricsController) as any
);
projectRouter.put(
  '/impact-metrics/configs/:id',
  requireProjectPermission(P.IMPACT_METRICS_UPDATE) as any,
  ImpactMetricsController.updateConfig.bind(ImpactMetricsController) as any
);
projectRouter.delete(
  '/impact-metrics/configs/:id',
  requireProjectPermission(P.IMPACT_METRICS_UPDATE) as any,
  ImpactMetricsController.deleteConfig.bind(ImpactMetricsController) as any
);

// --- Project-Level routes (project.*) ---

// Planning Data
projectRouter.use(
  '/planning-data',
  requireEnvPermission([P.PLANNING_DATA_READ, P.PLANNING_DATA_UPDATE]) as any,
  planningDataRoutes
);

// Data Management
projectRouter.use(
  '/data-management',
  requireProjectPermission([P.DATA_READ, P.DATA_UPDATE]) as any,
  dataManagementRoutes
);

// Service Accounts
projectRouter.use(
  '/service-accounts',
  requireProjectPermission([
    P.SERVICE_ACCOUNTS_READ,
    P.SERVICE_ACCOUNTS_UPDATE,
  ]) as any,
  serviceAccountRoutes
);

// API Tokens
projectRouter.use(
  '/api-tokens',
  requireProjectPermission([
    P.SERVICE_ACCOUNTS_READ,
    P.SERVICE_ACCOUNTS_UPDATE,
  ]) as any,
  apiTokenRoutes
);

// Signal Endpoints
projectRouter.use(
  '/signal-endpoints',
  requireProjectPermission([
    P.SIGNAL_ENDPOINTS_READ,
    P.SIGNAL_ENDPOINTS_UPDATE,
  ]) as any,
  signalEndpointRoutes
);

// Actions
projectRouter.use(
  '/actions',
  requireProjectPermission([P.ACTIONS_READ, P.ACTIONS_UPDATE]) as any,
  actionSetRoutes
);

// --- Environment-Level routes (env.*) ---

// Client Versions
projectRouter.use(
  '/client-versions',
  requireEnvPermission([
    P.CLIENT_VERSIONS_READ,
    P.CLIENT_VERSIONS_UPDATE,
  ]) as any,
  clientVersionRoutes
);

// Game Worlds
projectRouter.use(
  '/game-worlds',
  requireEnvPermission([P.GAME_WORLDS_READ, P.GAME_WORLDS_UPDATE]) as any,
  gameWorldRoutes
);

// Maintenance
projectRouter.use(
  '/maintenance',
  requireEnvPermission([P.MAINTENANCE_READ, P.MAINTENANCE_UPDATE]) as any,
  maintenanceRoutes
);

// Message Templates
projectRouter.use(
  '/message-templates',
  requireEnvPermission([
    P.MAINTENANCE_TEMPLATES_READ,
    P.MAINTENANCE_TEMPLATES_UPDATE,
  ]) as any,
  messageTemplateRoutes
);

// Vars (KV)
projectRouter.use(
  '/vars',
  requireEnvPermission([P.VARS_READ, P.VARS_UPDATE]) as any,
  varsRoutes
);

// Service Notices
projectRouter.use(
  '/service-notices',
  requireEnvPermission([
    P.SERVICE_NOTICES_READ,
    P.SERVICE_NOTICES_UPDATE,
  ]) as any,
  serviceNoticeRoutes
);

// Ingame Popup Notices
projectRouter.use(
  '/ingame-popup-notices',
  requireEnvPermission([P.INGAME_POPUPS_READ, P.INGAME_POPUPS_UPDATE]) as any,
  ingamePopupNoticeRoutes
);

// Surveys
projectRouter.use(
  '/surveys',
  requireEnvPermission([P.SURVEYS_READ, P.SURVEYS_UPDATE]) as any,
  surveyRoutes
);

// Reward Templates
projectRouter.use(
  '/reward-templates',
  requireEnvPermission([
    P.REWARD_TEMPLATES_READ,
    P.REWARD_TEMPLATES_UPDATE,
  ]) as any,
  rewardTemplateRoutes
);

// Store Products
projectRouter.use(
  '/store-products',
  requireEnvPermission([P.STORE_PRODUCTS_READ, P.STORE_PRODUCTS_UPDATE]) as any,
  storeProductRoutes
);

// Banners
projectRouter.use(
  '/banners',
  requireEnvPermission([P.BANNERS_READ, P.BANNERS_UPDATE]) as any,
  bannerRoutes
);

// Coupon Settings
projectRouter.use(
  '/coupon-settings',
  requireEnvPermission([P.COUPONS_READ, P.COUPONS_UPDATE]) as any,
  couponSettingsRoutes
);

// CMS CashShop
projectRouter.use(
  '/cms/cash-shop',
  requireEnvPermission([P.STORE_PRODUCTS_READ, P.STORE_PRODUCTS_UPDATE]) as any,
  cmsCashShopRoutes
);

// Server Lifecycle Events
projectRouter.use(
  '/server-lifecycle',
  requireEnvPermission(P.SERVERS_READ) as any,
  serverLifecycleRoutes
);

// Platform Defaults (same permission scope as client versions)
projectRouter.use(
  '/platform-defaults',
  requireEnvPermission([
    P.CLIENT_VERSIONS_READ,
    P.CLIENT_VERSIONS_UPDATE,
  ]) as any,
  platformDefaultsRoutes
);

// Mount project-scoped router
router.use('/orgs/:orgId/projects/:projectId', projectRouter);

// ========================================
// Org-Level routes (flat /admin/*)
// ========================================

// Audit logs
router.use(
  '/audit-logs',
  requireOrgPermission(P.AUDIT_LOGS_READ) as any,
  auditLogRoutes
);

// Translation
router.use(
  '/translation',
  requireOrgPermission([P.TRANSLATION_READ, P.TRANSLATION_UPDATE]) as any,
  translationRoutes
);

// Jobs and scheduler
router.use(
  '/jobs',
  requireOrgPermission([P.SCHEDULER_READ, P.SCHEDULER_UPDATE]) as any,
  jobRoutes
);

// Invitations
router.use(
  '/invitations',
  requireOrgPermission([P.INVITATIONS_READ, P.INVITATIONS_CREATE]) as any,
  invitationRoutes
);

// Crashes (grouped)
router.use(
  '/crashes',
  requireOrgPermission(P.CRASH_EVENTS_READ) as any,
  crashesRoutes
);

// Crash events
router.use(
  '/crash-events',
  requireOrgPermission(P.CRASH_EVENTS_READ) as any,
  crashEventRoutes
);

// File Storage
router.use(
  '/file-storage',
  requireOrgPermission(P.CRASH_EVENTS_READ) as any,
  fileStorageRoutes
);

// Console
router.use(
  '/console',
  requireOrgPermission(P.CONSOLE_ACCESS) as any,
  consoleRoutes
);

// Monitoring alerts
router.use(
  '/monitoring/alerts',
  requireOrgPermission(P.MONITORING_READ) as any,
  monitoringAlertRoutes
);

// Integrations
router.use(
  '/integrations',
  requireOrgPermission([P.INTEGRATIONS_READ, P.INTEGRATIONS_UPDATE]) as any,
  integrationRoutes
);

// Queue Monitor
router.use(
  '/queue-monitor',
  requireOrgPermission([P.SCHEDULER_READ, P.SCHEDULER_UPDATE]) as any,
  queueMonitorRoutes
);

export default router;
