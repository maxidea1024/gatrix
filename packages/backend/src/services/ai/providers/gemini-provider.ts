/**
 * Google Gemini Provider
 */

import { createLogger } from '../../../config/logger';
import {
  BaseLLMProvider,
  type ChatMessage,
  type StreamChunk,
  type ToolCall,
  type ToolDefinition,
} from '../llm-types';

const logger = createLogger('GeminiProvider');

export class GeminiProvider extends BaseLLMProvider {
  private buildBody(messages: ChatMessage[], tools?: ToolDefinition[]): any {
    const systemMessage = messages.find((m) => m.role === 'system');
    const conversationMessages = messages.filter((m) => m.role !== 'system');

    const body: any = {
      contents: conversationMessages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
    };

    if (systemMessage) {
      body.systemInstruction = { parts: [{ text: systemMessage.content }] };
    }

    if (tools && tools.length > 0) {
      body.tools = [
        {
          functionDeclarations: tools.map((t) => ({
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          })),
        },
      ];
      // Explicitly enable function calling
      body.toolConfig = {
        functionCallingConfig: {
          mode: 'AUTO',
        },
      };
    }

    return body;
  }

  async *createStream(
    messages: ChatMessage[],
    tools?: ToolDefinition[]
  ): AsyncGenerator<StreamChunk> {
    const body = this.buildBody(messages, tools);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.config.model}:streamGenerateContent?key=${this.config.apiKey}&alt=sse`;

    logger.debug('Gemini request', {
      model: this.config.model,
      toolCount: tools?.length || 0,
      toolNames: tools?.map((t) => t.name) || [],
      hasToolConfig: !!body.toolConfig,
    });

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Gemini API error', {
          status: response.status,
          body: errorText,
        });
        // Map HTTP status to user-friendly error codes
        let errorCode = 'AI_PROVIDER_ERROR';
        if (response.status === 429) {
          errorCode = 'AI_RATE_LIMITED';
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
          try {
            const parsed = JSON.parse(data);

            for (const candidate of parsed.candidates || []) {
              // Debug log to verify function call detection
              const parts = candidate.content?.parts || [];
              if (parts.some((p: any) => p.functionCall)) {
                logger.info('Gemini function call detected', {
                  parts: JSON.stringify(parts),
                });
              }

              for (const part of parts) {
                if (part.text) {
                  yield { type: 'content', content: part.text };
                }
                if (part.functionCall) {
                  yield {
                    type: 'tool_call',
                    toolCall: {
                      id: `gemini_${Date.now()}`,
                      name: part.functionCall.name,
                      arguments: part.functionCall.args || {},
                    },
                  };
                }
              }
            }
          } catch (e) {
            // Skip unparseable lines
          }
        }
      }

      yield { type: 'done' };
    } catch (error: any) {
      logger.error('Gemini stream error', { error: error.message });
      yield { type: 'error', error: error.message };
    }
  }

  async createCompletion(
    messages: ChatMessage[],
    tools?: ToolDefinition[]
  ): Promise<{ content: string; toolCalls?: ToolCall[] }> {
    const body = this.buildBody(messages, tools);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.config.model}:generateContent?key=${this.config.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data: any = await response.json();
    let content = '';
    const toolCalls: ToolCall[] = [];

    for (const candidate of data.candidates || []) {
      for (const part of candidate.content?.parts || []) {
        if (part.text) content += part.text;
        if (part.functionCall) {
          toolCalls.push({
            id: `gemini_${Date.now()}`,
            name: part.functionCall.name,
            arguments: part.functionCall.args || {},
          });
        }
      }
    }

    return { content, toolCalls: toolCalls.length > 0 ? toolCalls : undefined };
  }
}
