import { useEffect, useRef, useState, useCallback } from 'react';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import apiService from '../services/api';

export interface SSEEvent {
  type: string;
  data: any;
  timestamp: string;
}

export interface SSEOptions {
  autoConnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  onEvent?: (event: SSEEvent) => void;
  skipInvitationNotifications?: boolean; // 초대링크 Notification 스킵 옵션
}

export const useSSENotifications = (options: SSEOptions = {}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const {
    autoConnect = true,
    reconnectInterval = 5000,
    maxReconnectAttempts = 10,
    onConnect,
    onDisconnect,
    onError,
    onEvent,
    skipInvitationNotifications = false,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    'disconnected' | 'connecting' | 'connected' | 'error'
  >('disconnected');
  const [lastEvent, setLastEvent] = useState<SSEEvent | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const maxReconnectReachedRef = useRef(false); // 최대 재연결 시도 도달 여부 추적

  // Stable callback refs to avoid re-creating connect on every render
  const onConnectRef = useRef<typeof onConnect>();
  const onDisconnectRef = useRef<typeof onDisconnect>();
  const onErrorRef = useRef<typeof onError>();
  const onEventRef = useRef<typeof onEvent>();
  const connectRef = useRef<() => void>(() => {});
  const isConnectingRef = useRef(false);

  useEffect(() => {
    onConnectRef.current = onConnect;
  }, [onConnect]);
  useEffect(() => {
    onDisconnectRef.current = onDisconnect;
  }, [onDisconnect]);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  // Connect to SSE
  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      return; // Already connected
    }

    // 최대 재연결 시도에 도달했다면 연결 시도하지 않음
    if (maxReconnectReachedRef.current) {
      return;
    }

    if (isConnectingRef.current) {
      return;
    }

    isConnectingRef.current = true;
    setConnectionStatus('connecting');

    try {
      // Get token from apiService (uses the latest token with auto-refresh)
      const token = apiService.getAccessToken();

      // Use relative URL for SSE - Vite proxy will handle routing to backend
      // This ensures SSE works correctly in both dev and production
      const url = token
        ? `/api/v1/admin/notifications/sse?token=${encodeURIComponent(token)}`
        : `/api/v1/admin/notifications/sse`;

      const eventSource = new EventSource(url);

      eventSource.onopen = () => {
        setIsConnected(true);
        setConnectionStatus('connected');
        reconnectAttemptsRef.current = 0;
        maxReconnectReachedRef.current = false; // 연결 Success 시 플래그 리셋
        isConnectingRef.current = false;
        onConnectRef.current?.();
      };

      eventSource.onmessage = (event) => {
        try {
          const data: SSEEvent = JSON.parse(event.data);
          setLastEvent(data);
          onEventRef.current?.(data);
          handleEvent(data);
        } catch (error) {
          console.error('Error parsing SSE event:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        setIsConnected(false);
        setConnectionStatus('error');
        onErrorRef.current?.(error as any);

        // EventSource가 자동으로 재연결을 시도하므로 여기서는 연결을 닫고 수동으로 재연결 관리
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }

        // 이미 최대 재연결 시도에 도달했다면 더 이상 시도하지 않음
        if (maxReconnectReachedRef.current) {
          return;
        }

        isConnectingRef.current = false;

        // Attempt to reconnect
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          scheduleReconnect();
        } else {
          // 최대 재연결 시도에 도달했을 때 한 번만 에러 토스트 표시
          console.error('Max reconnection attempts reached');
          maxReconnectReachedRef.current = true;
          enqueueSnackbar(t('common.connectionLostRefresh'), {
            variant: 'error',
          });
        }
      };

      // Reset connecting flag on successful open
      eventSource.onopen && eventSource.onopen.bind(eventSource);

      eventSourceRef.current = eventSource;
    } catch (error) {
      console.error('Error creating SSE connection:', error);
      setConnectionStatus('error');
      scheduleReconnect();
    }
  }, [maxReconnectAttempts, reconnectInterval]);

  // Keep a stable ref to the latest connect function
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  // Disconnect from SSE
  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    setIsConnected(false);
    setConnectionStatus('disconnected');
  }, []);

  // 수동으로 연결 재시작 (최대 재연결 시도 플래그 리셋)
  const restart = useCallback(() => {
    disconnect();
    reconnectAttemptsRef.current = 0;
    maxReconnectReachedRef.current = false;
    setTimeout(() => {
      connect();
    }, 1000);
  }, [connect, disconnect]);

  // Schedule reconnection
  const scheduleReconnect = useCallback(() => {
    // 이미 최대 재연결 시도에 도달했다면 더 이상 시도하지 않음
    if (maxReconnectReachedRef.current) {
      return;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    reconnectAttemptsRef.current++;

    reconnectTimeoutRef.current = setTimeout(() => {
      // 재연결 시도 전에 Existing 연결 Cleanup (disconnect 함수 Used하지 않음 - 플래그 리셋 방지)
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      connect();
    }, reconnectInterval);
  }, [connect, reconnectInterval, maxReconnectAttempts]);

  // Handle different event types
  const handleEvent = useCallback(
    (event: SSEEvent) => {
      switch (event.type) {
        case 'connection':
          break;

        case 'ping':
          // Keep-alive ping, no action needed
          break;

        case 'planning_data_updated':
          // Dispatch custom event for PlanningDataContext to listen
          window.dispatchEvent(new CustomEvent('planning-data-updated', { detail: event.data }));
          break;

        case 'maintenance_status_change':
          // Handled by MainLayout via onEvent. We still acknowledge to avoid noisy logs.
          break;

        case 'invitation_created':
          if (!skipInvitationNotifications) {
            handleInvitationCreated(event.data);
          }
          break;

        case 'mail_received':
          handleMailReceived(event.data);
          break;

        case 'invitation_deleted':
          if (!skipInvitationNotifications) {
            handleInvitationDeleted(event.data);
          }
          break;

        case 'user_role_changed':
          // Dispatch custom event for AuthContext or MainLayout to listen
          window.dispatchEvent(new CustomEvent('user-role-changed', { detail: event.data }));
          break;

        case 'user_suspended':
          // Dispatch custom event for immediate redirect to suspended page
          window.dispatchEvent(new CustomEvent('user-suspended', { detail: event.data }));
          break;

        case 'change_request_submitted':
          // Dispatch custom event for CR notification
          window.dispatchEvent(
            new CustomEvent('change-request-notification', {
              detail: { ...event.data, action: 'submitted' },
            })
          );
          break;

        case 'change_request_approved':
          // Dispatch custom event for CR notification
          window.dispatchEvent(
            new CustomEvent('change-request-notification', {
              detail: { ...event.data, action: 'approved' },
            })
          );
          break;

        case 'change_request_rejected':
          // Dispatch custom event for CR notification
          window.dispatchEvent(
            new CustomEvent('change-request-notification', {
              detail: { ...event.data, action: 'rejected' },
            })
          );
          break;

        case 'change_request_executed':
          // Dispatch custom event for CR notification
          window.dispatchEvent(
            new CustomEvent('change-request-notification', {
              detail: { ...event.data, action: 'executed' },
            })
          );
          break;

        case 'entity_lock.released':
          // Dispatch custom event for entity lock release
          window.dispatchEvent(new CustomEvent('entity-lock-released', { detail: event.data }));
          break;

        case 'entity_lock.taken_over':
          // Dispatch custom event for entity lock takeover
          window.dispatchEvent(new CustomEvent('entity-lock-taken-over', { detail: event.data }));
          break;

        case 'release_flow.milestone_started':
        case 'release_flow.milestone_progressed':
        case 'release_flow.plan_paused':
        case 'release_flow.plan_resumed':
        case 'release_flow.plan_completed':
          // Dispatch custom event for release flow updates
          window.dispatchEvent(new CustomEvent('release-flow-updated', { detail: event.data }));
          break;

        default:
          break;
      }
    },
    [t]
  );

  // Handle invitation created notifications
  const handleInvitationCreated = useCallback(
    (data: any) => {
      const { invitation } = data;
      const message = invitation.email
        ? t('users.invitationCreatedForEmail', { email: invitation.email })
        : t('users.invitationCreated');
      enqueueSnackbar(message, { variant: 'success' });
    },
    [enqueueSnackbar, t]
  );

  // Handle invitation deleted notifications
  const handleInvitationDeleted = useCallback(
    (data: any) => {
      const { invitation } = data;
      const message = invitation.email
        ? t('users.invitationDeletedForEmail', { email: invitation.email })
        : t('users.invitationDeleted');
      enqueueSnackbar(message, { variant: 'success' });
    },
    [enqueueSnackbar, t]
  );

  // Handle mail received notifications
  const handleMailReceived = useCallback(
    (data: any) => {
      const { senderName, subject, priority } = data;
      const priorityIcon = priority === 'urgent' || priority === 'high' ? '🔴 ' : '';
      enqueueSnackbar(
        `${priorityIcon}${t('mailbox.newMailFrom', { sender: senderName })}: ${subject}`,
        {
          variant: priority === 'urgent' ? 'warning' : 'info',
          autoHideDuration: 5000,
        }
      );

      // Trigger custom event for mailbox to refresh
      window.dispatchEvent(new CustomEvent('mail-received'));
    },
    [enqueueSnackbar, t]
  );

  // Subscribe to channels
  const subscribe = useCallback(
    async (channels: string[]) => {
      if (!isConnected) {
        console.warn('Cannot subscribe: SSE not connected');
        return false;
      }

      try {
        const response = await fetch('/api/v1/admin/notifications/sse/subscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            clientId: 'current', // Server will identify client by session
            channels,
          }),
        });

        if (response.ok) {
          return true;
        } else {
          console.error('Failed to subscribe to channels');
          return false;
        }
      } catch (error) {
        console.error('Error subscribing to channels:', error);
        return false;
      }
    },
    [isConnected]
  );

  // Unsubscribe from channels
  const unsubscribe = useCallback(
    async (channels: string[]) => {
      if (!isConnected) {
        console.warn('Cannot unsubscribe: SSE not connected');
        return false;
      }

      try {
        const response = await fetch('/api/v1/admin/notifications/sse/unsubscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            clientId: 'current',
            channels,
          }),
        });

        if (response.ok) {
          return true;
        } else {
          console.error('Failed to unsubscribe from channels');
          return false;
        }
      } catch (error) {
        console.error('Error unsubscribing from channels:', error);
        return false;
      }
    },
    [isConnected]
  );

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connectRef.current();
    }

    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, [autoConnect, disconnect]);

  // Handle page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page is hidden, keep connection but reduce activity
      } else {
        // Page is visible, ensure connection is active
        if (!isConnected && autoConnect) {
          connectRef.current();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isConnected, autoConnect]);

  // Clean up SSE connection before page unload to prevent error logs on refresh
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  return {
    isConnected,
    connectionStatus,
    lastEvent,
    connect,
    disconnect,
    restart,
    subscribe,
    unsubscribe,
  };
};

export default useSSENotifications;
