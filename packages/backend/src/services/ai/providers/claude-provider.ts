/**
 * Claude (Anthropic) Provider
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

const logger = createLogger('ClaudeProvider');

export class ClaudeProvider extends BaseLLMProvider {
  private baseUrl: string;

  constructor(config: LLMConfig) {
    super(config);
    this.baseUrl = config.apiBaseUrl || 'https://api.anthropic.com/v1';
  }

  private separateSystemMessage(messages: ChatMessage[]) {
    const systemMessage = messages.find((m) => m.role === 'system');
    const conversationMessages = messages.filter((m) => m.role !== 'system');
    return { systemMessage, conversationMessages };
  }

  private buildBody(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    stream = false
  ): any {
    const { systemMessage, conversationMessages } =
      this.separateSystemMessage(messages);

    const body: any = {
      model: this.config.model,
      max_tokens: 4096,
      messages: conversationMessages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      stream,
    };

    if (systemMessage) {
      body.system = systemMessage.content;
    }

    if (tools && tools.length > 0) {
      body.tools = tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
      }));
      body.tool_choice = { type: 'auto' };
    }

    return body;
  }

  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-api-key': this.config.apiKey,
      'anthropic-version': '2023-06-01',
    };
  }

  async *createStream(
    messages: ChatMessage[],
    tools?: ToolDefinition[]
  ): AsyncGenerator<StreamChunk> {
    const body = this.buildBody(messages, tools, true);

    logger.info('Claude stream request', {
      model: this.config.model,
      baseUrl: this.baseUrl,
      toolCount: tools?.length || 0,
      toolNames: tools?.map((t) => t.name) || [],
      hasToolChoice: !!body.tool_choice,
    });

    try {
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Claude API error', {
          status: response.status,
          body: errorText,
        });
        yield { type: 'error', error: `Claude API error: ${response.status}` };
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        yield { type: 'error', error: 'No response body' };
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let currentToolUseId = '';
      let currentToolName = '';
      let currentToolInput = '';

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

            switch (parsed.type) {
              case 'content_block_delta':
                if (parsed.delta?.type === 'text_delta') {
                  yield { type: 'content', content: parsed.delta.text };
                } else if (parsed.delta?.type === 'input_json_delta') {
                  currentToolInput += parsed.delta.partial_json || '';
                }
                break;

              case 'content_block_start':
                if (parsed.content_block?.type === 'tool_use') {
                  currentToolUseId = parsed.content_block.id;
                  currentToolName = parsed.content_block.name;
                  currentToolInput = '';
                }
                break;

              case 'content_block_stop':
                if (currentToolUseId && currentToolName) {
                  try {
                    yield {
                      type: 'tool_call',
                      toolCall: {
                        id: currentToolUseId,
                        name: currentToolName,
                        arguments: JSON.parse(currentToolInput || '{}'),
                      },
                    };
                  } catch (e) {
                    logger.error('Failed to parse Claude tool call', {
                      input: currentToolInput,
                    });
                  }
                  currentToolUseId = '';
                  currentToolName = '';
                  currentToolInput = '';
                }
                break;

              case 'message_stop':
                yield { type: 'done' };
                return;
            }
          } catch (e) {
            // Skip unparseable lines
          }
        }
      }

      yield { type: 'done' };
    } catch (error: any) {
      logger.error('Claude stream error', { error: error.message });
      yield { type: 'error', error: error.message };
    }
  }

  async createCompletion(
    messages: ChatMessage[],
    tools?: ToolDefinition[]
  ): Promise<{ content: string; toolCalls?: ToolCall[] }> {
    const body = this.buildBody(messages, tools, false);

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Claude API error: ${response.status} - ${errorText}`);
    }

    const data: any = await response.json();
    let content = '';
    const toolCalls: ToolCall[] = [];

    for (const block of data.content || []) {
      if (block.type === 'text') {
        content += block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          name: block.name,
          arguments: block.input,
        });
      }
    }

    return { content, toolCalls: toolCalls.length > 0 ? toolCalls : undefined };
  }
}
