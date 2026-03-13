/**
 * AI Settings Service
 *
 * Manages per-organisation AI configuration stored in g_ai_settings.
 */

import db from '../../config/knex';
import { GatrixError } from '../../middleware/error-handler';
import { createLogger } from '../../config/logger';
import type { LLMProvider } from './llm-provider';

const logger = createLogger('AISettings');

export interface AISettings {
  id: number;
  orgId: string;
  enabled: boolean;
  provider: LLMProvider;
  model: string;
  apiKey: string | null;
  apiBaseUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateAISettingsInput {
  enabled?: boolean;
  provider?: LLMProvider;
  model?: string;
  apiKey?: string;
  apiBaseUrl?: string | null;
}

export class AISettingsService {
  /**
   * Get AI settings for an organisation.
   * Returns null if no settings exist (not yet configured).
   */
  static async getSettings(orgId: string): Promise<AISettings | null> {
    const row = await db('g_ai_settings').where('orgId', orgId).first();
    if (!row) return null;

    return {
      ...row,
      enabled: Boolean(row.enabled),
    };
  }

  /**
   * Get AI settings or create default ones if they don't exist.
   */
  static async getOrCreateSettings(orgId: string): Promise<AISettings> {
    const existing = await this.getSettings(orgId);
    if (existing) return existing;

    // Create default settings (disabled by default)
    await db('g_ai_settings').insert({
      orgId,
      enabled: false,
      provider: 'openai',
      model: 'gpt-4o-mini',
      apiKey: null,
    });

    const created = await this.getSettings(orgId);
    if (!created) {
      throw new GatrixError('Failed to create AI settings', 500);
    }
    return created;
  }

  /**
   * Update AI settings for an organisation.
   */
  static async updateSettings(
    orgId: string,
    input: UpdateAISettingsInput
  ): Promise<AISettings> {
    // Ensure settings row exists
    await this.getOrCreateSettings(orgId);

    const updates: Record<string, any> = {};

    if (input.enabled !== undefined) updates.enabled = input.enabled ? 1 : 0;
    if (input.provider !== undefined) updates.provider = input.provider;
    if (input.model !== undefined) updates.model = input.model;
    if (input.apiKey !== undefined) updates.apiKey = input.apiKey;
    if (input.apiBaseUrl !== undefined)
      updates.apiBaseUrl = input.apiBaseUrl || null;

    if (Object.keys(updates).length > 0) {
      await db('g_ai_settings').where('orgId', orgId).update(updates);
      logger.info('AI settings updated', {
        orgId,
        fields: Object.keys(updates),
      });
    }

    const settings = await this.getSettings(orgId);
    if (!settings) {
      throw new GatrixError('Failed to retrieve updated AI settings', 500);
    }
    return settings;
  }

  /**
   * Check if AI chat is available for an organisation
   */
  static async isAvailable(orgId: string): Promise<boolean> {
    const settings = await this.getSettings(orgId);
    return Boolean(settings?.enabled && settings?.apiKey);
  }
}
