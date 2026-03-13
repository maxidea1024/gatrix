/**
 * LLM Provider Factory
 *
 * Re-exports common types and provides a factory function
 * to create the appropriate LLM provider instance.
 */

import { OpenAICompatibleProvider } from './providers/openai-provider';
import { ClaudeProvider } from './providers/claude-provider';
import { GeminiProvider } from './providers/gemini-provider';
import type { LLMConfig } from './llm-types';
import { BaseLLMProvider, type LLMProvider } from './llm-types';

// Re-export all types
export type {
  LLMProvider,
  ChatMessage,
  ToolDefinition,
  ToolCall,
  StreamChunk,
  LLMConfig,
} from './llm-types';

/**
 * Factory function to create an LLM provider instance
 */
export function createLLMProvider(config: LLMConfig): BaseLLMProvider {
  switch (config.provider) {
    case 'openai':
    case 'deepseek':
    case 'qwen':
      return new OpenAICompatibleProvider(config);
    case 'claude':
      return new ClaudeProvider(config);
    case 'gemini':
      return new GeminiProvider(config);
    default:
      throw new Error(`Unsupported LLM provider: ${config.provider}`);
  }
}

/**
 * Get default model for a given provider
 */
export function getDefaultModel(provider: LLMProvider): string {
  switch (provider) {
    case 'openai':
      return 'gpt-4o-mini';
    case 'claude':
      return 'claude-sonnet-4-20250514';
    case 'gemini':
      return 'gemini-2.0-flash';
    case 'deepseek':
      return 'deepseek-chat';
    case 'qwen':
      return 'qwen-plus';
    default:
      return 'gpt-4o-mini';
  }
}
