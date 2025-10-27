import express from 'express';
import { authenticate, requireAdmin } from '../../middleware/auth';

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
import campaignRoutes from './campaigns';
import contextFieldRoutes from './contextFields';
import notificationRoutes from './notifications';
import platformDefaultRoutes from './platformDefaults';
import remoteConfigRoutes from './remoteConfig';
import remoteConfigV2Routes from './remoteConfigV2';
import jobRoutes from './jobs';
import maintenanceRoutes from './maintenance';
import invitationRoutes from './invitations';
import crashEventRoutes from './crashEvents';
import consoleRoutes from './console';
import surveyRoutes from './surveys';
import serviceNoticeRoutes from './serviceNotices';
import ingamePopupNoticeRoutes from './ingamePopupNotices';
import planningDataRoutes from './planningData';
import couponSettingsRoutes from './couponSettings';
import serviceDiscoveryRoutes from './serviceDiscovery';

const router = express.Router();

// Mount routes with SSE endpoints first (before authentication middleware)
// This allows SSE endpoints to use their own authentication (query parameter tokens)
router.use('/notifications', notificationRoutes);
router.use('/services', serviceDiscoveryRoutes);

// Apply authentication middleware to all other admin routes
router.use(authenticate as any);
router.use(requireAdmin as any);

// Mount all other admin routes
router.use('/', adminRoutes);
router.use('/users', userRoutes);
router.use('/whitelist', whitelistRoutes);
router.use('/ip-whitelist', ipWhitelistRoutes);
router.use('/client-versions', clientVersionRoutes);
router.use('/audit-logs', auditLogRoutes);
router.use('/tags', tagRoutes);
router.use('/message-templates', messageTemplateRoutes);
router.use('/translation', translationRoutes);
router.use('/vars', varsRoutes);
router.use('/game-worlds', gameWorldRoutes);
router.use('/api-tokens', apiTokenRoutes);
router.use('/campaigns', campaignRoutes);
router.use('/context-fields', contextFieldRoutes);
router.use('/platform-defaults', platformDefaultRoutes);
router.use('/remote-config', remoteConfigRoutes);
router.use('/remote-config-v2', remoteConfigV2Routes);
router.use('/jobs', jobRoutes);
router.use('/maintenance', maintenanceRoutes);
router.use('/invitations', invitationRoutes);
router.use('/crash-events', crashEventRoutes);
router.use('/console', consoleRoutes);
router.use('/surveys', surveyRoutes);
router.use('/service-notices', serviceNoticeRoutes);
router.use('/ingame-popup-notices', ingamePopupNoticeRoutes);
router.use('/planning-data', planningDataRoutes);
router.use('/coupon-settings', couponSettingsRoutes);

export default router;
