/**
 * AI Chat Routes
 *
 * Admin routes for AI chat functionality.
 */

import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireOrgPermission } from '../../middleware/rbac-middleware';
import { AIChatController } from '../../controllers/ai-chat-controller';
import { P } from '@gatrix/shared/permissions';

const router = Router();

// All AI routes require authentication
router.use(authenticate as any);

// Chat endpoints - accessible to all authenticated users
router.post('/chat', AIChatController.streamChat);
router.post('/chat/:chatId', AIChatController.streamChat);
router.get('/chats', AIChatController.listChats);
router.get('/chats/:chatId', AIChatController.getChat);
router.delete('/chats/:chatId', AIChatController.deleteChat);

// Status check - accessible to all authenticated users
router.get('/status', AIChatController.getStatus);

// AI name suggestions - accessible to all authenticated users
router.post('/suggest-names', AIChatController.suggestNames);

// Settings - requires system settings permission
router.get(
  '/settings',
  requireOrgPermission(P.SYSTEM_SETTINGS_READ) as any,
  AIChatController.getSettings
);
router.put(
  '/settings',
  requireOrgPermission(P.SYSTEM_SETTINGS_UPDATE) as any,
  AIChatController.updateSettings
);

// Model listing - requires system settings permission
router.get(
  '/models',
  requireOrgPermission(P.SYSTEM_SETTINGS_READ) as any,
  AIChatController.getModels
);

export default router;
