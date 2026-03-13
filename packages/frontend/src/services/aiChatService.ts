/**
 * AI Chat Service
 *
 * Frontend service for AI chat API calls (non-streaming).
 * Streaming is handled directly via fetch/EventSource in the useAIChat hook.
 */

import api from './api';

export interface AIChatListItem {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AIChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AIChatRecord {
  id: string;
  title: string | null;
  messages: AIChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface AISettingsData {
  id: number;
  orgId: string;
  enabled: boolean;
  provider: string;
  model: string;
  apiKey: string | null;
  apiBaseUrl: string | null;
}

export interface AIStatus {
  available: boolean;
  provider: string | null;
  model: string | null;
}

export interface AIModel {
  id: string;
  name: string;
  provider: string;
}

class AIChatService {
  /**
   * List user's chat history
   */
  async listChats(params?: {
    page?: number;
    limit?: number;
  }): Promise<{ chats: AIChatListItem[]; total: number }> {
    const response = await api.get('/admin/ai/chats', { params });
    return response.data;
  }

  /**
   * Get a single chat with full messages
   */
  async getChat(chatId: string): Promise<AIChatRecord> {
    const response = await api.get(`/admin/ai/chats/${chatId}`);
    return response.data.chat;
  }

  /**
   * Delete a chat
   */
  async deleteChat(chatId: string): Promise<void> {
    await api.delete(`/admin/ai/chats/${chatId}`);
  }

  /**
   * Get AI settings
   */
  async getSettings(): Promise<AISettingsData> {
    const response = await api.get('/admin/ai/settings');
    return response.data.settings;
  }

  /**
   * Update AI settings
   */
  async updateSettings(data: {
    enabled?: boolean;
    provider?: string;
    model?: string;
    apiKey?: string;
    apiBaseUrl?: string | null;
  }): Promise<AISettingsData> {
    const response = await api.put('/admin/ai/settings', data);
    return response.data.settings;
  }

  /**
   * Check AI availability
   */
  async getStatus(): Promise<AIStatus> {
    const response = await api.get('/admin/ai/status');
    return response.data;
  }

  /**
   * Get available models for a provider
   */
  async getModels(provider: string): Promise<AIModel[]> {
    const response = await api.get('/admin/ai/models', {
      params: { provider },
    });
    return response.data.models;
  }
}

export default new AIChatService();
