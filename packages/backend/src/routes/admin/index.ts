import express from 'express';
import { authenticate, requireAdmin, requirePermission } from '../../middleware/auth';
import { environmentContextMiddleware } from '../../middleware/environmentMiddleware';
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

const router = express.Router();

// Mount routes with SSE endpoints first (before authentication middleware)
// This allows SSE endpoints to use their own authentication (query parameter tokens)
router.use('/notifications', notificationRoutes);
router.use('/services', serviceDiscoveryRoutes);

// Self-service routes for authenticated users (not requiring admin role)
// These must be mounted BEFORE requireAdmin middleware
import { UserController } from '../../controllers/UserController';
router.get('/users/me/environments', authenticate as any, UserController.getMyEnvironmentAccess);

// Apply authentication middleware to all other admin routes
router.use(authenticate as any);
router.use(requireAdmin as any);

// Apply environment context middleware to set current environment from X-Environment-Id header
router.use(environmentContextMiddleware as any);

// Mount all other admin routes with permission checks
// Dashboard and stats - no special permission required (admin role is enough)
router.use('/', adminRoutes);

// User management - requires users.view or users.manage permission
router.use('/users', requirePermission([PERMISSIONS.USERS_VIEW, PERMISSIONS.USERS_MANAGE]) as any, userRoutes);

// Security routes - requires security.view or security.manage permission
router.use('/whitelist', requirePermission([PERMISSIONS.SECURITY_VIEW, PERMISSIONS.SECURITY_MANAGE]) as any, whitelistRoutes);
router.use('/ip-whitelist', requirePermission([PERMISSIONS.SECURITY_VIEW, PERMISSIONS.SECURITY_MANAGE]) as any, ipWhitelistRoutes);
router.use('/api-tokens', requirePermission([PERMISSIONS.SECURITY_VIEW, PERMISSIONS.SECURITY_MANAGE]) as any, apiTokenRoutes);

// Client versions - requires client-versions.view or client-versions.manage permission
router.use('/client-versions', requirePermission([PERMISSIONS.CLIENT_VERSIONS_VIEW, PERMISSIONS.CLIENT_VERSIONS_MANAGE]) as any, clientVersionRoutes);

// Audit logs - requires audit-logs.view permission
router.use('/audit-logs', requirePermission(PERMISSIONS.AUDIT_LOGS_VIEW) as any, auditLogRoutes);

// Tags - requires tags.view or tags.manage permission
router.use('/tags', requirePermission([PERMISSIONS.TAGS_VIEW, PERMISSIONS.TAGS_MANAGE]) as any, tagRoutes);

// Message templates and translation - part of maintenance templates
router.use('/message-templates', requirePermission([PERMISSIONS.MAINTENANCE_TEMPLATES_VIEW, PERMISSIONS.MAINTENANCE_TEMPLATES_MANAGE]) as any, messageTemplateRoutes);
router.use('/translation', requirePermission([PERMISSIONS.MAINTENANCE_TEMPLATES_VIEW, PERMISSIONS.MAINTENANCE_TEMPLATES_MANAGE]) as any, translationRoutes);
// vars (KV) - no permission required, used by many components for basic data like platform, channels
router.use('/vars', varsRoutes);

// Game worlds - requires game-worlds.view or game-worlds.manage permission
router.use('/game-worlds', requirePermission([PERMISSIONS.GAME_WORLDS_VIEW, PERMISSIONS.GAME_WORLDS_MANAGE]) as any, gameWorldRoutes);



// Environments - no permission required for listing (returns only user's accessible environments)
// Managing environments (create/update/delete) requires permission check inside routes
router.use('/environments', environmentRoutes);

// Jobs and scheduler - requires scheduler.view or scheduler.manage permission
router.use('/jobs', requirePermission([PERMISSIONS.SCHEDULER_VIEW, PERMISSIONS.SCHEDULER_MANAGE]) as any, jobRoutes);

// Maintenance - requires maintenance.view or maintenance.manage permission
router.use('/maintenance', requirePermission([PERMISSIONS.MAINTENANCE_VIEW, PERMISSIONS.MAINTENANCE_MANAGE]) as any, maintenanceRoutes);

// Invitations (part of user management)
router.use('/invitations', requirePermission([PERMISSIONS.USERS_VIEW, PERMISSIONS.USERS_MANAGE]) as any, invitationRoutes);

// Crash events - requires crash-events.view permission
router.use('/crash-events', requirePermission(PERMISSIONS.CRASH_EVENTS_VIEW) as any, crashEventRoutes);

// Console - requires console.access permission
router.use('/console', requirePermission(PERMISSIONS.CONSOLE_ACCESS) as any, consoleRoutes);

// Surveys - requires surveys.view or surveys.manage permission
router.use('/surveys', requirePermission([PERMISSIONS.SURVEYS_VIEW, PERMISSIONS.SURVEYS_MANAGE]) as any, surveyRoutes);

// Reward templates - requires reward-templates.view or reward-templates.manage permission
router.use('/reward-templates', requirePermission([PERMISSIONS.REWARD_TEMPLATES_VIEW, PERMISSIONS.REWARD_TEMPLATES_MANAGE]) as any, rewardTemplateRoutes);

// Store products - requires store-products.view or store-products.manage permission
router.use('/store-products', requirePermission([PERMISSIONS.STORE_PRODUCTS_VIEW, PERMISSIONS.STORE_PRODUCTS_MANAGE]) as any, storeProductRoutes);

// Service notices - requires service-notices.view or service-notices.manage permission
router.use('/service-notices', requirePermission([PERMISSIONS.SERVICE_NOTICES_VIEW, PERMISSIONS.SERVICE_NOTICES_MANAGE]) as any, serviceNoticeRoutes);

// Ingame popup notices - requires ingame-popup-notices.view or ingame-popup-notices.manage permission
router.use('/ingame-popup-notices', requirePermission([PERMISSIONS.INGAME_POPUP_NOTICES_VIEW, PERMISSIONS.INGAME_POPUP_NOTICES_MANAGE]) as any, ingamePopupNoticeRoutes);

// Monitoring alerts - requires monitoring.view permission
router.use('/monitoring/alerts', requirePermission(PERMISSIONS.MONITORING_VIEW) as any, monitoringAlertRoutes);

// Planning data - requires planning-data.view or planning-data.manage permission
router.use('/planning-data', requirePermission([PERMISSIONS.PLANNING_DATA_VIEW, PERMISSIONS.PLANNING_DATA_MANAGE]) as any, planningDataRoutes);

// Coupon settings - requires coupons.view or coupons.manage permission
router.use('/coupon-settings', requirePermission([PERMISSIONS.COUPONS_VIEW, PERMISSIONS.COUPONS_MANAGE]) as any, couponSettingsRoutes);

// Data management - requires data-management.view or data-management.manage permission
router.use('/data-management', requirePermission([PERMISSIONS.DATA_MANAGEMENT_VIEW, PERMISSIONS.DATA_MANAGEMENT_MANAGE]) as any, dataManagementRoutes);

// Banners - requires banners.view or banners.manage permission
router.use('/banners', requirePermission([PERMISSIONS.BANNERS_VIEW, PERMISSIONS.BANNERS_MANAGE]) as any, bannerRoutes);

// CMS CashShop - requires store-products.view or store-products.manage permission
router.use('/cms/cash-shop', requirePermission([PERMISSIONS.STORE_PRODUCTS_VIEW, PERMISSIONS.STORE_PRODUCTS_MANAGE]) as any, cmsCashShopRoutes);

// Server Lifecycle Events - requires servers.view permission
router.use('/server-lifecycle', requirePermission(PERMISSIONS.SERVERS_VIEW) as any, serverLifecycleRoutes);

// Change Requests - requires change-requests.view or change-requests.manage permission
router.use('/change-requests', requirePermission([PERMISSIONS.CHANGE_REQUESTS_VIEW, PERMISSIONS.CHANGE_REQUESTS_MANAGE]) as any, changeRequestRoutes);

// Feature Flags - requires feature-flags.view or feature-flags.manage permission
router.use('/features', requirePermission([PERMISSIONS.FEATURE_FLAGS_VIEW, PERMISSIONS.FEATURE_FLAGS_MANAGE]) as any, featureRoutes);

export default router;
