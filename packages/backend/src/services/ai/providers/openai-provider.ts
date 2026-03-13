/**
 * OpenAI-Compatible Provider
 *
 * Handles OpenAI, DeepSeek, and Qwen (all share the same API format).
 */

import { createLogger } from '../../../config/logger';
import {
  BaseLLMProvider,
  type ChatMessage,
  type LLMConfig,
  type StreamChunk,
  type ToolCall,
  type ToolDefinition,
} from '../llm-types';

const logger = createLogger('OpenAIProvider');

export class OpenAICompatibleProvider extends BaseLLMProvider {
  private baseUrl: string;

  constructor(config: LLMConfig) {
    super(config);
    this.baseUrl = this.getBaseUrl();
  }

  private getBaseUrl(): string {
    // Use custom base URL if provided
    if (this.config.apiBaseUrl) {
      return this.config.apiBaseUrl;
    }
    switch (this.config.provider) {
      case 'deepseek':
        return 'https://api.deepseek.com';
      case 'qwen':
        return 'https://dashscope.aliyuncs.com/compatible-mode/v1';
      default:
        return 'https://api.openai.com/v1';
    }
  }

  private buildBody(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    stream = false
  ): any {
    const body: any = {
      model: this.config.model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream,
    };

    if (tools && tools.length > 0) {
      body.tools = tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
    }

    return body;
  }

  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.config.apiKey}`,
    };
  }

  async *createStream(
    messages: ChatMessage[],
    tools?: ToolDefinition[]
  ): AsyncGenerator<StreamChunk> {
    const body = this.buildBody(messages, tools, true);

    logger.debug('OpenAI-compatible request', {
      provider: this.config.provider,
      model: this.config.model,
      baseUrl: this.baseUrl,
      toolCount: tools?.length || 0,
    });

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('OpenAI API error', {
          status: response.status,
          body: errorText,
        });
        // Map HTTP status to user-friendly error codes
        let errorCode = 'AI_PROVIDER_ERROR';
        if (response.status === 429) {
          errorCode = 'AI_RATE_LIMITED';
        } else if (response.status === 402) {
          errorCode = 'AI_INSUFFICIENT_BALANCE';
        } else if (response.status === 404) {
          errorCode = 'AI_INVALID_MODEL';
        } else if (response.status === 401 || response.status === 403) {
          errorCode = 'AI_AUTH_ERROR';
        }
        yield { type: 'error', error: errorCode };
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        yield { type: 'error', error: 'No response body' };
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';
      const toolCallAccumulator: Map<
        number,
        { id: string; name: string; arguments: string }
      > = new Map();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          const data = trimmed.slice(6);
          if (data === '[DONE]') {
            // Emit accumulated tool calls
            for (const [, tc] of toolCallAccumulator) {
              try {
                yield {
                  type: 'tool_call',
                  toolCall: {
                    id: tc.id,
                    name: tc.name,
                    arguments: JSON.parse(tc.arguments),
                  },
                };
              } catch (e) {
                logger.error('Failed to parse tool call arguments', {
                  arguments: tc.arguments,
                });
              }
            }
            yield { type: 'done' };
            return;
          }

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta;

            if (delta?.content) {
              yield { type: 'content', content: delta.content };
            }

            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index ?? 0;
                if (!toolCallAccumulator.has(idx)) {
                  toolCallAccumulator.set(idx, {
                    id: tc.id || '',
                    name: tc.function?.name || '',
                    arguments: '',
                  });
                }
                const acc = toolCallAccumulator.get(idx)!;
                if (tc.id) acc.id = tc.id;
                if (tc.function?.name) acc.name = tc.function.name;
                if (tc.function?.arguments)
                  acc.arguments += tc.function.arguments;
              }
            }
          } catch (e) {
            // Skip unparseable lines
          }
        }
      }

      yield { type: 'done' };
    } catch (error: any) {
      logger.error('OpenAI stream error', { error: error.message });
      yield { type: 'error', error: error.message };
    }
  }

  async createCompletion(
    messages: ChatMessage[],
    tools?: ToolDefinition[]
  ): Promise<{ content: string; toolCalls?: ToolCall[] }> {
    const body = this.buildBody(messages, tools, false);

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LLM API error: ${response.status} - ${errorText}`);
    }

    const data: any = await response.json();
    const choice = data.choices?.[0];

    const toolCalls = choice?.message?.tool_calls?.map((tc: any) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments),
    }));

    return {
      content: choice?.message?.content || '',
      toolCalls,
    };
  }
}
