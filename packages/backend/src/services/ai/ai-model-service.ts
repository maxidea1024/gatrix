/**
 * AI Model Service
 *
 * Fetches available models from various AI providers.
 * Supports OpenAI, DeepSeek, Qwen, Gemini, and Claude.
 */

import { createLogger } from '../../config/logger';
import type { LLMProvider } from './llm-provider';

const logger = createLogger('AIModelService');

export interface AIModel {
  id: string;
  name: string;
  provider: string;
}

// Fallback model lists when API is unavailable or provider doesn't support listing
const FALLBACK_MODELS: Record<string, AIModel[]> = {
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai' },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openai' },
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'openai' },
  ],
  claude: [
    { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', provider: 'claude' },
    { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', provider: 'claude' },
    { id: 'claude-opus-4-5-20251101', name: 'Claude Opus 4.5', provider: 'claude' },
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: 'claude' },
    { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', provider: 'claude' },
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'claude' },
  ],
  gemini: [
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'gemini' },
    { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite', provider: 'gemini' },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'gemini' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'gemini' },
  ],
  deepseek: [
    { id: 'deepseek-chat', name: 'DeepSeek Chat (V3)', provider: 'deepseek' },
    { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner (R1)', provider: 'deepseek' },
  ],
  qwen: [
    { id: 'qwen-turbo', name: 'Qwen Turbo', provider: 'qwen' },
    { id: 'qwen-plus', name: 'Qwen Plus', provider: 'qwen' },
    { id: 'qwen-max', name: 'Qwen Max', provider: 'qwen' },
  ],
};

export class AIModelService {
  /**
   * Fetch available models from a provider.
   * Falls back to hardcoded list if API call fails.
   */
  static async getModels(
    provider: LLMProvider,
    apiKey: string
  ): Promise<AIModel[]> {
    try {
      const models = await this.fetchModelsFromAPI(provider, apiKey);
      if (models && models.length > 0) {
        return models;
      }
    } catch (error: any) {
      logger.warn('Failed to fetch models from provider API, using fallback', {
        provider,
        error: error.message,
      });
    }

    // Return fallback models
    return FALLBACK_MODELS[provider] || [];
  }

  /**
   * Get fallback models without API call
   */
  static getFallbackModels(provider: LLMProvider): AIModel[] {
    return FALLBACK_MODELS[provider] || [];
  }

  /**
   * Fetch models from provider API
   */
  private static async fetchModelsFromAPI(
    provider: LLMProvider,
    apiKey: string
  ): Promise<AIModel[]> {
    switch (provider) {
      case 'openai':
      case 'deepseek':
      case 'qwen':
        return this.fetchOpenAICompatibleModels(provider, apiKey);
      case 'gemini':
        return this.fetchGeminiModels(apiKey);
      case 'claude':
        // Claude doesn't have a list models API
        return FALLBACK_MODELS.claude;
      default:
        return [];
    }
  }

  /**
   * Fetch models from OpenAI-compatible APIs (OpenAI, DeepSeek, Qwen)
   */
  private static async fetchOpenAICompatibleModels(
    provider: LLMProvider,
    apiKey: string
  ): Promise<AIModel[]> {
    const baseUrls: Record<string, string> = {
      openai: 'https://api.openai.com/v1',
      deepseek: 'https://api.deepseek.com',
      qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    };

    const baseUrl = baseUrls[provider];
    if (!baseUrl) return [];

    const response = await fetch(`${baseUrl}/models`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Models API returned ${response.status}`);
    }

    const data: any = await response.json();
    const models = (data.data || [])
      .filter((m: any) => {
        // Filter to only chat-capable models
        const id = m.id?.toLowerCase() || '';
        if (provider === 'openai') {
          return (
            id.includes('gpt') ||
            id.includes('o1') ||
            id.includes('o3') ||
            id.includes('o4')
          );
        }
        return true;
      })
      .map((m: any) => ({
        id: m.id,
        name: m.id,
        provider,
      }))
      .sort((a: AIModel, b: AIModel) => a.id.localeCompare(b.id));

    return models;
  }

  /**
   * Fetch models from Gemini API
   */
  private static async fetchGeminiModels(apiKey: string): Promise<AIModel[]> {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );

    if (!response.ok) {
      throw new Error(`Gemini Models API returned ${response.status}`);
    }

    const data: any = await response.json();
    return (data.models || [])
      .filter((m: any) => {
        // Only include models that support generateContent
        const methods = m.supportedGenerationMethods || [];
        return methods.includes('generateContent');
      })
      .map((m: any) => ({
        // Gemini returns "models/gemini-2.0-flash" - strip prefix
        id: (m.name || '').replace('models/', ''),
        name: m.displayName || m.name,
        provider: 'gemini',
      }))
      .sort((a: AIModel, b: AIModel) => a.id.localeCompare(b.id));
  }
}
