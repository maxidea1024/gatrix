/**
 * useAIChat Hook
 *
 * Manages AI chat state, SSE streaming, and conversation history.
 */

import { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { apiService } from '@/services/api';
import type { AIChatMessage } from '@/services/aiChatService';

interface StreamEvent {
  type: 'chat_id' | 'content' | 'tool_start' | 'tool_result' | 'done' | 'error';
  chatId?: string;
  content?: string;
  name?: string;
  result?: any;
  error?: string;
}

interface UseAIChatOptions {
  projectId?: string | null;
  environmentId?: string | null;
  projectName?: string | null;
  environmentName?: string | null;
}

interface UseAIChatReturn {
  messages: AIChatMessage[];
  isStreaming: boolean;
  currentChatId: string | null;
  error: string | null;
  sendMessage: (message: string) => Promise<void>;
  loadChat: (chatId: string, existingMessages: AIChatMessage[]) => void;
  clearChat: () => void;
  abort: () => void;
}

export function useAIChat(options?: UseAIChatOptions): UseAIChatReturn {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (message: string) => {
      if (isStreaming) return;
      setError(null);
      setIsStreaming(true);

      // Add user message to local state
      const userMessage: AIChatMessage = { role: 'user', content: message };
      setMessages((prev) => [...prev, userMessage]);

      // Prepare SSE streaming via fetch
      const baseURL = (import.meta as any).env?.VITE_API_URL || '/api/v1';
      const url = currentChatId
        ? `${baseURL}/admin/ai/chat/${currentChatId}`
        : `${baseURL}/admin/ai/chat`;

      const accessToken = apiService.getAccessToken();
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      // Add empty assistant message immediately to show typing dots
      setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          credentials: 'include',
          body: JSON.stringify({
            message,
            context: {
              projectId: options?.projectId || null,
              environmentId: options?.environmentId || null,
              projectName: options?.projectName || null,
              environmentName: options?.environmentName || null,
            },
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response body');
        }

        const decoder = new TextDecoder();
        let buffer = '';
        let assistantContent = '';

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
              const event: StreamEvent = JSON.parse(data);

              switch (event.type) {
                case 'chat_id':
                  if (event.chatId) {
                    setCurrentChatId(event.chatId);
                  }
                  break;

                case 'content':
                  assistantContent += event.content || '';
                  setMessages((prev) => {
                    const updated = [...prev];
                    const lastIdx = updated.length - 1;
                    if (lastIdx >= 0 && updated[lastIdx].role === 'assistant') {
                      updated[lastIdx] = {
                        ...updated[lastIdx],
                        content: assistantContent,
                      };
                    }
                    return updated;
                  });
                  break;

                case 'tool_start':
                  // Append tool status to assistant message
                  assistantContent += `\n\n🔧 _${event.name}..._\n\n`;
                  setMessages((prev) => {
                    const updated = [...prev];
                    const lastIdx = updated.length - 1;
                    if (lastIdx >= 0 && updated[lastIdx].role === 'assistant') {
                      updated[lastIdx] = {
                        ...updated[lastIdx],
                        content: assistantContent,
                      };
                    }
                    return updated;
                  });
                  break;

                case 'error': {
                  const errorKey = `aiChat.errors.${event.error}`;
                  const translated = t(errorKey);
                  const errorMsg =
                    translated !== errorKey
                      ? translated
                      : event.error || t('aiChat.errors.unknown');
                  // Show error as assistant message
                  assistantContent = `⚠️ ${errorMsg}`;
                  setMessages((prev) => {
                    const updated = [...prev];
                    const lastIdx = updated.length - 1;
                    if (lastIdx >= 0 && updated[lastIdx].role === 'assistant') {
                      updated[lastIdx] = {
                        ...updated[lastIdx],
                        content: assistantContent,
                      };
                    }
                    return updated;
                  });
                  break;
                }

                case 'done':
                  break;
              }
            } catch (e) {
              // Skip unparseable lines
            }
          }
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          // User cancelled
        } else {
          const errorMsg = `⚠️ ${t('aiChat.errors.connectionFailed')}`;
          // Show error as assistant message bubble
          setMessages((prev) => {
            const updated = [...prev];
            const lastIdx = updated.length - 1;
            if (
              lastIdx >= 0 &&
              updated[lastIdx].role === 'assistant' &&
              !updated[lastIdx].content
            ) {
              updated[lastIdx] = { ...updated[lastIdx], content: errorMsg };
            } else {
              updated.push({ role: 'assistant', content: errorMsg });
            }
            return updated;
          });
        }
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [isStreaming, currentChatId]
  );

  const loadChat = useCallback(
    (chatId: string, existingMessages: AIChatMessage[]) => {
      setCurrentChatId(chatId);
      setMessages(existingMessages);
      setError(null);
    },
    []
  );

  const clearChat = useCallback(() => {
    setCurrentChatId(null);
    setMessages([]);
    setError(null);
  }, []);

  const abort = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  return {
    messages,
    isStreaming,
    currentChatId,
    error,
    sendMessage,
    loadChat,
    clearChat,
    abort,
  };
}
