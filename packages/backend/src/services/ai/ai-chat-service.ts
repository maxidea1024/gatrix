/**
 * AI Chat Service
 *
 * Manages AI chat conversations with SSE streaming,
 * conversation history persistence, and RBAC-aware tool execution.
 */

import db from '../../config/knex';
import { GatrixError } from '../../middleware/error-handler';
import { createLogger } from '../../config/logger';
import { AISettingsService } from './ai-settings-service';
import {
  createLLMProvider,
  type ChatMessage,
  type StreamChunk,
  type ToolDefinition,
  type ToolCall,
} from './llm-provider';
import { getAITools, executeToolCall } from './ai-tools';

const logger = createLogger('AIChat');

const MAX_MESSAGES_PER_CHAT = 100;
const MAX_MESSAGE_LENGTH = 5000;

export interface AIChatRecord {
  id: string;
  userId: string;
  orgId: string;
  title: string | null;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

// System prompt for the AI assistant
function buildSystemPrompt(context?: {
  projectId?: string;
  environmentId?: string;
  projectName?: string;
  environmentName?: string;
}): string {
  let contextInfo = '';
  if (context?.projectId || context?.environmentId) {
    contextInfo = `\n\nCURRENT CONTEXT (use these automatically when calling tools - do NOT ask the user for these):`;
    if (context.projectName) {
      contextInfo += `\n- Project: "${context.projectName}" (ID: ${context.projectId})`;
    } else if (context.projectId) {
      contextInfo += `\n- Project ID: ${context.projectId}`;
    }
    if (context.environmentName) {
      contextInfo += `\n- Environment: "${context.environmentName}" (ID: ${context.environmentId})`;
    } else if (context.environmentId) {
      contextInfo += `\n- Environment ID: ${context.environmentId}`;
    }
  }

  return `You are Gatrix AI, an intelligent assistant for the Gatrix game operation management platform.
You help administrators manage their game services including feature flags, game worlds, maintenance schedules, banners, service notices, and more.

CRITICAL RULES:
- You have access to tools (functions) to query and manage the platform. You MUST use these tools to get real data.
- NEVER make up or imagine data. If asked about feature flags, game worlds, maintenance, banners, or notices, ALWAYS call the appropriate tool first.
- If a tool call requires parameters you don't have (like projectId or environmentId), ASK the user for them instead of guessing.
- After receiving tool results, present the data clearly using Markdown formatting (tables, lists, etc.).
- Be concise and helpful in your responses.
- When performing actions, confirm what you're about to do before executing.
- Always respond in the same language as the user's message.
- Format responses with Markdown when appropriate.${contextInfo}`;
}

export class AIChatService {
  /**
   * Create or continue a chat conversation with SSE streaming.
   * Yields SSE-formatted strings to be sent to the client.
   */
  static async *streamChat(params: {
    chatId?: string;
    message: string;
    userId: any;
    orgId: any;
    userPermissions: string[];
    context?: {
      projectId?: string;
      environmentId?: string;
      projectName?: string;
      environmentName?: string;
    };
  }): AsyncGenerator<string> {
    const { chatId, message, userId, orgId, userPermissions } = params;

    // Validate message
    if (!message || message.trim().length === 0) {
      yield `data: ${JSON.stringify({ type: 'error', error: 'Message cannot be empty' })}\n\n`;
      return;
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      yield `data: ${JSON.stringify({ type: 'error', error: `Message too long (max ${MAX_MESSAGE_LENGTH} chars)` })}\n\n`;
      return;
    }

    // Get AI settings for this org
    const settings = await AISettingsService.getSettings(orgId);
    if (!settings || !settings.enabled || !settings.apiKey) {
      yield `data: ${JSON.stringify({ type: 'error', error: 'AI_CHAT_NOT_CONFIGURED' })}\n\n`;
      return;
    }

    // Load or create chat
    let chat: AIChatRecord;
    if (chatId) {
      chat = await this.getChatById(chatId, userId, orgId);
    } else {
      chat = await this.createChat(userId, orgId);
    }

    // Append user message
    const messages: ChatMessage[] = [...chat.messages];
    messages.push({ role: 'user', content: message });

    // Trim messages if too many
    if (messages.length > MAX_MESSAGES_PER_CHAT) {
      messages.splice(1, messages.length - MAX_MESSAGES_PER_CHAT);
    }

    // Build full message list with system prompt
    const fullMessages: ChatMessage[] = [
      { role: 'system', content: buildSystemPrompt(params.context) },
      ...messages,
    ];

    // Get available tools based on user permissions
    const tools = getAITools(userPermissions);
    logger.info('AI chat tools available', {
      toolCount: tools.length,
      toolNames: tools.map((t) => t.name),
      permissionCount: userPermissions.length,
    });

    // Create LLM provider and stream
    const provider = createLLMProvider({
      provider: settings.provider,
      model: settings.model,
      apiKey: settings.apiKey,
      apiBaseUrl: settings.apiBaseUrl,
    });

    // Send chat ID to client
    yield `data: ${JSON.stringify({ type: 'chat_id', chatId: chat.id })}\n\n`;

    let assistantContent = '';
    let hasToolCalls = false;

    try {
      const stream = provider.createStream(fullMessages, tools);

      for await (const chunk of stream) {
        switch (chunk.type) {
          case 'content':
            assistantContent += chunk.content || '';
            yield `data: ${JSON.stringify({ type: 'content', content: chunk.content })}\n\n`;
            break;

          case 'tool_call':
            hasToolCalls = true;
            yield `data: ${JSON.stringify({ type: 'tool_start', name: chunk.toolCall?.name })}\n\n`;

            // Execute tool call with RBAC check
            const result = await this.executeToolWithRBAC(
              chunk.toolCall!,
              userPermissions,
              orgId
            );

            yield `data: ${JSON.stringify({ type: 'tool_result', name: chunk.toolCall?.name, result })}\n\n`;

            // If we got tool calls, we need to make another LLM call
            // with the tool results to get the final response
            if (result) {
              const toolResultMessages: ChatMessage[] = [
                ...fullMessages,
                {
                  role: 'assistant',
                  content:
                    assistantContent || `Calling tool: ${chunk.toolCall?.name}`,
                },
                {
                  role: 'user',
                  content: `Tool "${chunk.toolCall?.name}" returned: ${JSON.stringify(result)}`,
                },
              ];

              const followUpStream = provider.createStream(toolResultMessages);
              for await (const followUpChunk of followUpStream) {
                if (followUpChunk.type === 'content') {
                  assistantContent += followUpChunk.content || '';
                  yield `data: ${JSON.stringify({ type: 'content', content: followUpChunk.content })}\n\n`;
                }
              }
            }
            break;

          case 'error':
            yield `data: ${JSON.stringify({ type: 'error', error: chunk.error })}\n\n`;
            break;

          case 'done':
            break;
        }
      }

      // Save messages to DB
      if (assistantContent) {
        messages.push({ role: 'assistant', content: assistantContent });
      }
      await this.updateChatMessages(chat.id, messages, message);

      yield `data: ${JSON.stringify({ type: 'done' })}\n\n`;
    } catch (error: any) {
      logger.error('AI chat stream error', {
        error: error.message,
        chatId: chat.id,
      });
      yield `data: ${JSON.stringify({ type: 'error', error: 'An error occurred during AI processing' })}\n\n`;
    }
  }

  /**
   * Execute a tool call with RBAC permission check
   */
  private static async executeToolWithRBAC(
    toolCall: ToolCall,
    userPermissions: string[],
    orgId: number
  ): Promise<any> {
    try {
      return await executeToolCall(toolCall, userPermissions, orgId);
    } catch (error: any) {
      logger.error('Tool execution error', {
        tool: toolCall.name,
        error: error.message,
      });
      return { error: error.message };
    }
  }

  /**
   * Create a new chat
   */
  private static async createChat(
    userId: any,
    orgId: any
  ): Promise<AIChatRecord> {
    const [id] = await db('g_ai_chats').insert({
      userId,
      orgId,
      title: null,
      messages: JSON.stringify([]),
    });

    return {
      id: String(id),
      userId,
      orgId,
      title: null,
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Get chat by ID, ensuring it belongs to the user
   */
  private static async getChatById(
    chatId: string,
    userId: any,
    orgId: any
  ): Promise<AIChatRecord> {
    const row = await db('g_ai_chats')
      .where('id', chatId)
      .where('userId', userId)
      .where('orgId', orgId)
      .first();

    if (!row) {
      throw new GatrixError('Chat not found', 404);
    }

    const messages =
      typeof row.messages === 'string'
        ? JSON.parse(row.messages)
        : row.messages;

    return { ...row, id: String(row.id), messages };
  }

  /**
   * Update chat messages in DB
   */
  private static async updateChatMessages(
    chatId: string,
    messages: ChatMessage[],
    latestUserMessage: string
  ): Promise<void> {
    const updates: Record<string, any> = {
      messages: JSON.stringify(messages),
    };

    // Auto-set title from first user message if not set
    const chat = await db('g_ai_chats').where('id', chatId).first();
    if (chat && !chat.title && latestUserMessage) {
      updates.title = latestUserMessage.substring(0, 100);
    }

    await db('g_ai_chats').where('id', chatId).update(updates);
  }

  /**
   * List chats for a user
   */
  static async listChats(params: {
    userId: any;
    orgId: any;
    page?: number;
    limit?: number;
  }): Promise<{ chats: AIChatRecord[]; total: number }> {
    const page = params.page || 1;
    const limit = Math.min(params.limit || 20, 50);
    const offset = (page - 1) * limit;

    const countResult = await db('g_ai_chats')
      .where('userId', params.userId)
      .where('orgId', params.orgId)
      .count('* as total')
      .first();
    const total = Number(countResult?.total || 0);

    const rows = await db('g_ai_chats')
      .where('userId', params.userId)
      .where('orgId', params.orgId)
      .orderBy('updatedAt', 'desc')
      .limit(limit)
      .offset(offset)
      .select('id', 'userId', 'orgId', 'title', 'createdAt', 'updatedAt');

    const chats = rows.map((r: any) => ({
      ...r,
      id: String(r.id),
      messages: [], // Don't include messages in list
    }));

    return { chats, total };
  }

  /**
   * Get a single chat with full messages
   */
  static async getChat(params: {
    chatId: string;
    userId: any;
    orgId: any;
  }): Promise<AIChatRecord> {
    return this.getChatById(params.chatId, params.userId, params.orgId);
  }

  /**
   * Delete a chat
   */
  static async deleteChat(params: {
    chatId: string;
    userId: any;
    orgId: any;
  }): Promise<void> {
    const affected = await db('g_ai_chats')
      .where('id', params.chatId)
      .where('userId', params.userId)
      .where('orgId', params.orgId)
      .delete();

    if (affected === 0) {
      throw new GatrixError('Chat not found', 404);
    }
  }
}
