import express from 'express';
import { authenticate, requireAdmin, requirePermission } from '../../middleware/auth';
import { environmentContextMiddleware } from '../../middleware/environmentMiddleware';
import { orgProjectScope } from '../../middleware/orgProjectScope';
import { PERMISSIONS } from '../../types/permissions';

// Import all admin-related route modules
import adminRoutes from './admin';
import userRoutes from './users';
import whitelistRoutes from './whitelist';
import ipWhitelistRoutes from './ipWhitelist';
import clientVersionRoutes from './clientVersionRoutes';
import auditLogRoutes from './auditLogs';
import tagRoutes from './tags';
import messageTemplateRoutes from './messageTemplates';
import translationRoutes from './translation';
import varsRoutes from './vars';
import gameWorldRoutes from './gameWorlds';
import apiTokenRoutes from './apiTokens';
import notificationRoutes from './notifications';

import environmentRoutes from './environments';
import jobRoutes from './jobs';
import maintenanceRoutes from './maintenance';
import invitationRoutes from './invitations';
import crashEventRoutes from './crashEvents';
import consoleRoutes from './console';
import surveyRoutes from './surveys';
import rewardTemplateRoutes from './rewardTemplates';
import storeProductRoutes from './storeProducts';
import serviceNoticeRoutes from './serviceNotices';
import ingamePopupNoticeRoutes from './ingamePopupNotices';
import planningDataRoutes from './planningData';
import couponSettingsRoutes from './couponSettings';
import serviceDiscoveryRoutes from './serviceDiscovery';
import monitoringAlertRoutes from './monitoringAlerts';
import dataManagementRoutes from './dataManagement';
import bannerRoutes from './banners';
import cmsCashShopRoutes from './cmsCashShop';
import serverLifecycleRoutes from './serverLifecycle';
import changeRequestRoutes from './changeRequests';
import featureRoutes from './features';
import platformDefaultsRoutes from './platformDefaults';
import unknownFlagsRoutes from './unknownFlags';
import integrationRoutes from './integrations';
import releaseFlowRoutes from './releaseFlows';
import serviceAccountRoutes from './serviceAccounts';
import signalEndpointRoutes from './signalEndpoints';
import actionSetRoutes from './actionSets';
import queueMonitorRoutes from './queueMonitor';
import rbacRoutes from './rbac';
import ImpactMetricsController from '../../controllers/ImpactMetricsController';

const router = express.Router();

// Mount routes with SSE endpoints first (before authentication middleware)
// This allows SSE endpoints to use their own authentication (query parameter tokens)
router.use('/notifications', notificationRoutes);
router.use('/services', serviceDiscoveryRoutes);

// Self-service routes for authenticated users (not requiring admin role)
// These must be mounted BEFORE requireAdmin middleware
import { UserController } from '../../controllers/UserController';
router.get('/users/me/environments', authenticate as any, UserController.getMyEnvironmentAccess);

// RBAC management routes (uses its own RBAC middleware, not legacy requireAdmin)
router.use('/rbac', rbacRoutes);

// Apply authentication middleware to all other admin routes
router.use(authenticate as any);
// Note: requireAdmin removed - each route uses its own requirePermission via RBAC

// Apply environment context middleware to set current environment from X-Environment-Id header
router.use(environmentContextMiddleware as any);

// Mount all other admin routes with permission checks
// Dashboard and stats - no special permission required (admin role is enough)
router.use('/', adminRoutes);

// User management - requires users.view or users.manage permission
router.use(
  '/users',
  requirePermission([PERMISSIONS.USERS_VIEW, PERMISSIONS.USERS_MANAGE]) as any,
  userRoutes
);

// Security routes - requires security.view or security.manage permission
router.use(
  '/whitelist',
  requirePermission([PERMISSIONS.SECURITY_VIEW, PERMISSIONS.SECURITY_MANAGE]) as any,
  whitelistRoutes
);
router.use(
  '/ip-whitelist',
  requirePermission([PERMISSIONS.SECURITY_VIEW, PERMISSIONS.SECURITY_MANAGE]) as any,
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
  requirePermission([PERMISSIONS.FEATURE_FLAGS_VIEW, PERMISSIONS.FEATURE_FLAGS_MANAGE]) as any,
  featureRoutes
);

// Tags
projectRouter.use(
  '/tags',
  requirePermission([PERMISSIONS.TAGS_VIEW, PERMISSIONS.TAGS_MANAGE]) as any,
  tagRoutes
);

// Environments
projectRouter.use('/environments', environmentRoutes);

// Unknown Flags
projectRouter.use(
  '/unknown-flags',
  requirePermission([PERMISSIONS.FEATURE_FLAGS_VIEW, PERMISSIONS.FEATURE_FLAGS_MANAGE]) as any,
  unknownFlagsRoutes
);

// Release Flows
projectRouter.use(
  '/release-flows',
  requirePermission([PERMISSIONS.FEATURE_FLAGS_VIEW, PERMISSIONS.FEATURE_FLAGS_MANAGE]) as any,
  releaseFlowRoutes
);

// Change Requests
projectRouter.use(
  '/change-requests',
  requirePermission([PERMISSIONS.CHANGE_REQUESTS_VIEW, PERMISSIONS.CHANGE_REQUESTS_MANAGE]) as any,
  changeRequestRoutes
);

// Impact Metrics
projectRouter.get(
  '/impact-metrics/available',
  requirePermission([PERMISSIONS.FEATURE_FLAGS_VIEW, PERMISSIONS.FEATURE_FLAGS_MANAGE]) as any,
  ImpactMetricsController.getAvailableMetrics as any
);
projectRouter.get(
  '/impact-metrics/labels',
  requirePermission([PERMISSIONS.FEATURE_FLAGS_VIEW, PERMISSIONS.FEATURE_FLAGS_MANAGE]) as any,
  ImpactMetricsController.getMetricLabels as any
);
projectRouter.get(
  '/impact-metrics',
  requirePermission([PERMISSIONS.FEATURE_FLAGS_VIEW, PERMISSIONS.FEATURE_FLAGS_MANAGE]) as any,
  ImpactMetricsController.queryTimeSeries as any
);
projectRouter.get(
  '/impact-metrics/configs/:flagId',
  requirePermission([PERMISSIONS.FEATURE_FLAGS_VIEW, PERMISSIONS.FEATURE_FLAGS_MANAGE]) as any,
  ImpactMetricsController.getConfigs.bind(ImpactMetricsController) as any
);
projectRouter.post(
  '/impact-metrics/configs',
  requirePermission([PERMISSIONS.FEATURE_FLAGS_MANAGE]) as any,
  ImpactMetricsController.createConfig.bind(ImpactMetricsController) as any
);
projectRouter.put(
  '/impact-metrics/configs/layouts',
  requirePermission([PERMISSIONS.FEATURE_FLAGS_MANAGE]) as any,
  ImpactMetricsController.updateLayouts.bind(ImpactMetricsController) as any
);
projectRouter.put(
  '/impact-metrics/configs/:id',
  requirePermission([PERMISSIONS.FEATURE_FLAGS_MANAGE]) as any,
  ImpactMetricsController.updateConfig.bind(ImpactMetricsController) as any
);
projectRouter.delete(
  '/impact-metrics/configs/:id',
  requirePermission([PERMISSIONS.FEATURE_FLAGS_MANAGE]) as any,
  ImpactMetricsController.deleteConfig.bind(ImpactMetricsController) as any
);

// --- Project-Level routes (project.*) ---

// Planning Data
projectRouter.use(
  '/planning-data',
  requirePermission([PERMISSIONS.PLANNING_DATA_VIEW, PERMISSIONS.PLANNING_DATA_MANAGE]) as any,
  planningDataRoutes
);

// Data Management
projectRouter.use(
  '/data-management',
  requirePermission([PERMISSIONS.DATA_MANAGEMENT_VIEW, PERMISSIONS.DATA_MANAGEMENT_MANAGE]) as any,
  dataManagementRoutes
);

// Service Accounts
projectRouter.use(
  '/service-accounts',
  requirePermission([
    PERMISSIONS.SERVICE_ACCOUNTS_VIEW,
    PERMISSIONS.SERVICE_ACCOUNTS_MANAGE,
  ]) as any,
  serviceAccountRoutes
);

// API Tokens
projectRouter.use(
  '/api-tokens',
  requirePermission([PERMISSIONS.SECURITY_VIEW, PERMISSIONS.SECURITY_MANAGE]) as any,
  apiTokenRoutes
);

// Signal Endpoints
projectRouter.use(
  '/signal-endpoints',
  requirePermission([
    PERMISSIONS.SIGNAL_ENDPOINTS_VIEW,
    PERMISSIONS.SIGNAL_ENDPOINTS_MANAGE,
  ]) as any,
  signalEndpointRoutes
);

// Actions
projectRouter.use(
  '/actions',
  requirePermission([PERMISSIONS.ACTIONS_VIEW, PERMISSIONS.ACTIONS_MANAGE]) as any,
  actionSetRoutes
);

// --- Environment-Level routes (env.*) ---

// Client Versions
projectRouter.use(
  '/client-versions',
  requirePermission([PERMISSIONS.CLIENT_VERSIONS_VIEW, PERMISSIONS.CLIENT_VERSIONS_MANAGE]) as any,
  clientVersionRoutes
);

// Game Worlds
projectRouter.use(
  '/game-worlds',
  requirePermission([PERMISSIONS.GAME_WORLDS_VIEW, PERMISSIONS.GAME_WORLDS_MANAGE]) as any,
  gameWorldRoutes
);

// Maintenance
projectRouter.use(
  '/maintenance',
  requirePermission([PERMISSIONS.MAINTENANCE_VIEW, PERMISSIONS.MAINTENANCE_MANAGE]) as any,
  maintenanceRoutes
);

// Message Templates
projectRouter.use(
  '/message-templates',
  requirePermission([
    PERMISSIONS.MAINTENANCE_TEMPLATES_VIEW,
    PERMISSIONS.MAINTENANCE_TEMPLATES_MANAGE,
  ]) as any,
  messageTemplateRoutes
);

// Vars (KV)
projectRouter.use('/vars', varsRoutes);

// Service Notices
projectRouter.use(
  '/service-notices',
  requirePermission([PERMISSIONS.SERVICE_NOTICES_VIEW, PERMISSIONS.SERVICE_NOTICES_MANAGE]) as any,
  serviceNoticeRoutes
);

// Ingame Popup Notices
projectRouter.use(
  '/ingame-popup-notices',
  requirePermission([
    PERMISSIONS.INGAME_POPUP_NOTICES_VIEW,
    PERMISSIONS.INGAME_POPUP_NOTICES_MANAGE,
  ]) as any,
  ingamePopupNoticeRoutes
);

// Surveys
projectRouter.use(
  '/surveys',
  requirePermission([PERMISSIONS.SURVEYS_VIEW, PERMISSIONS.SURVEYS_MANAGE]) as any,
  surveyRoutes
);

// Reward Templates
projectRouter.use(
  '/reward-templates',
  requirePermission([
    PERMISSIONS.REWARD_TEMPLATES_VIEW,
    PERMISSIONS.REWARD_TEMPLATES_MANAGE,
  ]) as any,
  rewardTemplateRoutes
);

// Store Products
projectRouter.use(
  '/store-products',
  requirePermission([PERMISSIONS.STORE_PRODUCTS_VIEW, PERMISSIONS.STORE_PRODUCTS_MANAGE]) as any,
  storeProductRoutes
);

// Banners
projectRouter.use(
  '/banners',
  requirePermission([PERMISSIONS.BANNERS_VIEW, PERMISSIONS.BANNERS_MANAGE]) as any,
  bannerRoutes
);

// Coupon Settings
projectRouter.use(
  '/coupon-settings',
  requirePermission([PERMISSIONS.COUPONS_VIEW, PERMISSIONS.COUPONS_MANAGE]) as any,
  couponSettingsRoutes
);

// CMS CashShop
projectRouter.use(
  '/cms/cash-shop',
  requirePermission([PERMISSIONS.STORE_PRODUCTS_VIEW, PERMISSIONS.STORE_PRODUCTS_MANAGE]) as any,
  cmsCashShopRoutes
);

// Server Lifecycle Events
projectRouter.use(
  '/server-lifecycle',
  requirePermission(PERMISSIONS.SERVERS_VIEW) as any,
  serverLifecycleRoutes
);

// Platform Defaults
projectRouter.use('/platform-defaults', platformDefaultsRoutes);

// Mount project-scoped router
router.use('/orgs/:orgId/projects/:projectId', projectRouter);

// ========================================
// Org-Level routes (flat /admin/*)
// ========================================

// Audit logs
router.use('/audit-logs', requirePermission(PERMISSIONS.AUDIT_LOGS_VIEW) as any, auditLogRoutes);

// Translation
router.use(
  '/translation',
  requirePermission([
    PERMISSIONS.MAINTENANCE_TEMPLATES_VIEW,
    PERMISSIONS.MAINTENANCE_TEMPLATES_MANAGE,
  ]) as any,
  translationRoutes
);

// Jobs and scheduler
router.use(
  '/jobs',
  requirePermission([PERMISSIONS.SCHEDULER_VIEW, PERMISSIONS.SCHEDULER_MANAGE]) as any,
  jobRoutes
);

// Invitations
router.use(
  '/invitations',
  requirePermission([PERMISSIONS.USERS_VIEW, PERMISSIONS.USERS_MANAGE]) as any,
  invitationRoutes
);

// Crash events
router.use(
  '/crash-events',
  requirePermission(PERMISSIONS.CRASH_EVENTS_VIEW) as any,
  crashEventRoutes
);

// Console
router.use('/console', requirePermission(PERMISSIONS.CONSOLE_ACCESS) as any, consoleRoutes);

// Monitoring alerts
router.use(
  '/monitoring/alerts',
  requirePermission(PERMISSIONS.MONITORING_VIEW) as any,
  monitoringAlertRoutes
);

// Integrations
router.use(
  '/integrations',
  requirePermission([PERMISSIONS.SECURITY_VIEW, PERMISSIONS.SECURITY_MANAGE]) as any,
  integrationRoutes
);

// Queue Monitor
router.use(
  '/queue-monitor',
  requirePermission([PERMISSIONS.SCHEDULER_VIEW, PERMISSIONS.SCHEDULER_MANAGE]) as any,
  queueMonitorRoutes
);

export default router;
