/**
 * AI Suggest Service
 *
 * Generic AI-powered name suggestion service.
 * Uses LLM to generate descriptive, specific names based on description and context.
 * Designed to be reusable across different entity types (feature flags, segments, etc.).
 */

import { createLogger } from '../../config/logger';
import { AISettingsService } from './ai-settings-service';
import { createLLMProvider, type ChatMessage } from './llm-provider';

const logger = createLogger('AISuggest');

const MAX_SUGGESTIONS = 10;
const DEFAULT_SUGGESTIONS = 5;

export interface SuggestNamesParams {
  type: string;
  description: string;
  context?: Record<string, string>;
  count?: number;
}

export interface SuggestNamesResult {
  names: string[];
}

/**
 * Build a type-specific system prompt for name suggestion
 */
function buildSuggestPrompt(
  type: string,
  context?: Record<string, string>
): string {
  switch (type) {
    case 'feature-flag': {
      const flagType = context?.flagType || 'release';
      return `You are a feature flag naming expert. Generate concise, descriptive feature flag names following these best practices:

NAMING RULES:
- Use kebab-case (lowercase letters, numbers, hyphens only)
- Must start with a lowercase letter
- Must match pattern: ^[a-z][a-z0-9-]*$
- Keep names concise but descriptive (2-5 words connected by hyphens)
- The name alone should clearly convey the flag's purpose

NAMING GUIDELINES:
- Use a category prefix when appropriate: release-, experiment-, ops-, perm-, config-
- The current flag type is "${flagType}", so prefer the matching prefix when it fits
- Be specific: "release-dark-mode-v2" is better than "new-feature"
- Include the action or feature area: "enable-bulk-export", "show-premium-badge"
- Avoid generic names like "new-feature", "test-flag", "flag-1"

RESPONSE FORMAT:
Return ONLY a JSON array of strings. No explanation, no markdown, no code blocks.
Example: ["release-dark-mode","enable-user-dashboard","experiment-checkout-flow"]`;
    }

    default:
      return `You are a naming expert. Generate concise, descriptive names following these rules:
- Use kebab-case (lowercase letters, numbers, hyphens only)
- Must start with a lowercase letter
- Keep names concise but descriptive
- Be specific and meaningful

RESPONSE FORMAT:
Return ONLY a JSON array of strings. No explanation, no markdown, no code blocks.
Example: ["my-suggested-name","another-suggestion"]`;
  }
}

export class AISuggestService {
  /**
   * Generate name suggestions using AI
   */
  static async suggestNames(
    orgId: string,
    params: SuggestNamesParams
  ): Promise<SuggestNamesResult> {
    const { type, description, context } = params;
    const count = Math.min(params.count || DEFAULT_SUGGESTIONS, MAX_SUGGESTIONS);

    // Get AI settings
    const settings = await AISettingsService.getSettings(orgId);
    if (!settings || !settings.enabled || !settings.apiKey) {
      throw new Error('AI_NOT_CONFIGURED');
    }

    // Build messages
    const systemPrompt = buildSuggestPrompt(type, context);
    const userMessage = `Generate exactly ${count} name suggestions for the following description:\n\n"${description}"${
      context
        ? '\n\nAdditional context:\n' +
          Object.entries(context)
            .map(([k, v]) => `- ${k}: ${v}`)
            .join('\n')
        : ''
    }`;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ];

    // Create provider and get completion (non-streaming)
    const provider = createLLMProvider({
      provider: settings.provider,
      model: settings.model,
      apiKey: settings.apiKey,
      apiBaseUrl: settings.apiBaseUrl,
    });

    logger.info('Generating name suggestions', {
      type,
      descriptionLength: description.length,
      count,
      provider: settings.provider,
      model: settings.model,
    });

    const result = await provider.createCompletion(messages);

    // Parse AI response as JSON array
    const names = this.parseNamesFromResponse(result.content, count);

    logger.info('Name suggestions generated', {
      type,
      nameCount: names.length,
    });

    return { names };
  }

  /**
   * Parse names array from LLM response text
   */
  private static parseNamesFromResponse(
    content: string,
    maxCount: number
  ): string[] {
    try {
      // Try to extract JSON array from response
      const trimmed = content.trim();

      // Remove markdown code block wrapper if present
      let jsonStr = trimmed;
      const codeBlockMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (codeBlockMatch) {
        jsonStr = codeBlockMatch[1].trim();
      }

      // Find JSON array in the text
      const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        const parsed = JSON.parse(arrayMatch[0]);
        if (Array.isArray(parsed)) {
          return parsed
            .filter((n): n is string => typeof n === 'string')
            .map((n) => n.trim().toLowerCase())
            .filter((n) => /^[a-z][a-z0-9-]*$/.test(n))
            .slice(0, maxCount);
        }
      }

      // Fallback: split by newlines and clean up
      return trimmed
        .split('\n')
        .map((l) => l.replace(/^[\d.\-*)\s]+/, '').trim().toLowerCase())
        .filter((n) => /^[a-z][a-z0-9-]*$/.test(n))
        .slice(0, maxCount);
    } catch (error: any) {
      logger.error('Failed to parse AI name suggestions', {
        error: error.message,
        content: content.substring(0, 200),
      });
      return [];
    }
  }
}
