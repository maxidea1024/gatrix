/**
 * AI Chat Controller
 *
 * Handles AI chat HTTP endpoints with SSE streaming support.
 */

import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/error-handler';
import { AIChatService } from '../services/ai/ai-chat-service';
import { AISettingsService } from '../services/ai/ai-settings-service';
import { permissionService } from '../services/permission-service';
import { createLogger } from '../config/logger';

const logger = createLogger('AIChatController');

export class AIChatController {
  /**
   * Stream a chat response (SSE)
   * POST /api/v1/admin/ai/chat
   * POST /api/v1/admin/ai/chat/:chatId
   */
  static streamChat = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { message, context } = req.body;
      const chatId = req.params.chatId;
      const userId = req.user?.userId || req.user?.id;
      const orgId = req.user?.orgId;

      if (!userId || !orgId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      if (!message || typeof message !== 'string') {
        res
          .status(400)
          .json({ success: false, message: 'Message is required' });
        return;
      }

      // Get user permissions for RBAC tool filtering
      const { bindings } = await permissionService.getUserEffectivePermissions(
        String(userId),
        String(orgId)
      );
      const userPermissions = [
        ...new Set(bindings.flatMap((b: any) => b.permissions)),
      ];

      // Set SSE headers
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      // Stream response
      const stream = AIChatService.streamChat({
        chatId,
        message,
        userId,
        orgId,
        userPermissions,
        context: context || {},
      });

      for await (const chunk of stream) {
        if (res.writableEnded) break;
        res.write(chunk);
      }

      if (!res.writableEnded) {
        res.end();
      }
    }
  );

  /**
   * List user's chats
   * GET /api/v1/admin/ai/chats
   */
  static listChats = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const userId = req.user?.userId || req.user?.id;
      const orgId = req.user?.orgId;

      if (!userId || !orgId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      const { page, limit } = req.query;
      const result = await AIChatService.listChats({
        userId,
        orgId,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      });

      res.json({
        success: true,
        data: result,
      });
    }
  );

  /**
   * Get a single chat with messages
   * GET /api/v1/admin/ai/chats/:chatId
   */
  static getChat = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { chatId } = req.params;
      const userId = req.user?.userId || req.user?.id;
      const orgId = req.user?.orgId;

      if (!userId || !orgId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      const chat = await AIChatService.getChat({ chatId, userId, orgId });

      res.json({
        success: true,
        data: { chat },
      });
    }
  );

  /**
   * Delete a chat
   * DELETE /api/v1/admin/ai/chats/:chatId
   */
  static deleteChat = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { chatId } = req.params;
      const userId = req.user?.userId || req.user?.id;
      const orgId = req.user?.orgId;

      if (!userId || !orgId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      await AIChatService.deleteChat({ chatId, userId, orgId });

      res.json({
        success: true,
        message: 'Chat deleted successfully',
      });
    }
  );

  /**
   * Get AI settings for the current org
   * GET /api/v1/admin/ai/settings
   */
  static getSettings = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const orgId = req.user?.orgId;

      if (!orgId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      const settings = await AISettingsService.getOrCreateSettings(orgId);

      // Mask API key for security
      const masked = {
        ...settings,
        apiKey: settings.apiKey
          ? `${settings.apiKey.substring(0, 8)}...${settings.apiKey.substring(settings.apiKey.length - 4)}`
          : null,
      };

      res.json({
        success: true,
        data: { settings: masked },
      });
    }
  );

  /**
   * Update AI settings for the current org
   * PUT /api/v1/admin/ai/settings
   */
  static updateSettings = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const orgId = req.user?.orgId;

      if (!orgId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      const { enabled, provider, model, apiKey, apiBaseUrl } = req.body;

      const settings = await AISettingsService.updateSettings(orgId, {
        enabled,
        provider,
        model,
        apiKey,
        apiBaseUrl,
      });

      // Mask API key
      const masked = {
        ...settings,
        apiKey: settings.apiKey
          ? `${settings.apiKey.substring(0, 8)}...${settings.apiKey.substring(settings.apiKey.length - 4)}`
          : null,
      };

      res.json({
        success: true,
        data: { settings: masked },
        message: 'AI settings updated successfully',
      });
    }
  );

  /**
   * Check AI availability for the current org
   * GET /api/v1/admin/ai/status
   */
  static getStatus = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const orgId = req.user?.orgId;

      if (!orgId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      const available = await AISettingsService.isAvailable(orgId);
      const settings = await AISettingsService.getSettings(orgId);

      res.json({
        success: true,
        data: {
          available,
          provider: settings?.provider || null,
          model: settings?.model || null,
        },
      });
    }
  );

  /**
   * Get available models for a provider
   * GET /api/v1/admin/ai/models?provider=openai
   */
  static getModels = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const orgId = req.user?.orgId;
      if (!orgId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      const provider = req.query.provider as string;
      if (!provider) {
        res
          .status(400)
          .json({ success: false, message: 'Provider is required' });
        return;
      }

      // Try to get API key from DB to fetch live models
      const settings = await AISettingsService.getSettings(orgId);
      // Use API key if available (regardless of current saved provider)
      const apiKey = settings?.apiKey || null;

      const { AIModelService } = await import(
        '../services/ai/ai-model-service'
      );

      // getModels will try API, fallback on failure
      const models = apiKey
        ? await AIModelService.getModels(provider as any, apiKey)
        : AIModelService.getFallbackModels(provider as any);

      res.json({
        success: true,
        data: { models },
      });
    }
  );
}
