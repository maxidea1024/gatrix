/**
 * LLM Provider Types
 *
 * Common types shared across all LLM provider implementations.
 */

export type LLMProvider = 'openai' | 'claude' | 'gemini' | 'deepseek' | 'qwen';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  // Tool call metadata for assistant messages that invoked a tool
  toolCall?: {
    id: string;
    name: string;
    arguments: Record<string, any>;
  };
  // Tool result metadata for user messages that contain a tool result
  toolResult?: {
    toolCallId: string;
    toolName: string;
  };
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface StreamChunk {
  type: 'content' | 'tool_call' | 'done' | 'error';
  content?: string;
  toolCall?: ToolCall;
  error?: string;
}

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  apiKey: string;
  apiBaseUrl?: string | null;
}

/**
 * Abstract base class for LLM provider implementations
 */
export abstract class BaseLLMProvider {
  protected config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  /** Create a streaming chat completion */
  abstract createStream(
    messages: ChatMessage[],
    tools?: ToolDefinition[]
  ): AsyncGenerator<StreamChunk>;

  /** Create a non-streaming chat completion */
  abstract createCompletion(
    messages: ChatMessage[],
    tools?: ToolDefinition[]
  ): Promise<{ content: string; toolCalls?: ToolCall[] }>;

  /**
   * Create a streaming chat completion with automatic retry on rate limit.
   * Retries up to maxRetries times with exponential backoff.
   */
  async *createStreamWithRetry(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    maxRetries = 2
  ): AsyncGenerator<StreamChunk> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const chunks: StreamChunk[] = [];
      let hitRateLimit = false;

      for await (const chunk of this.createStream(messages, tools)) {
        if (
          chunk.type === 'error' &&
          chunk.error === 'AI_RATE_LIMITED' &&
          attempt < maxRetries
        ) {
          hitRateLimit = true;
          break;
        }
        chunks.push(chunk);
      }

      if (hitRateLimit) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      // Yield all collected chunks
      for (const chunk of chunks) {
        yield chunk;
      }
      return;
    }
  }
}
