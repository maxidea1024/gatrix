import { useEffect, useRef, useState, useCallback } from 'react';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';

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
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [lastEvent, setLastEvent] = useState<SSEEvent | null>(null);
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Connect to SSE
  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      return; // Already connected
    }

    setConnectionStatus('connecting');

    try {
      // Get token from localStorage
      const token = localStorage.getItem('token');
      const url = token
        ? `/api/v1/notifications/sse?token=${encodeURIComponent(token)}`
        : '/api/v1/notifications/sse';

      const eventSource = new EventSource(url, {
        withCredentials: true,
      });

      eventSource.onopen = () => {
        setIsConnected(true);
        setConnectionStatus('connected');
        reconnectAttemptsRef.current = 0;
        onConnect?.();
        console.log('SSE connection established');
      };

      eventSource.onmessage = (event) => {
        try {
          const data: SSEEvent = JSON.parse(event.data);
          setLastEvent(data);
          onEvent?.(data);
          handleEvent(data);
        } catch (error) {
          console.error('Error parsing SSE event:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        setIsConnected(false);
        setConnectionStatus('error');
        onError?.(error);
        
        // Attempt to reconnect
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          scheduleReconnect();
        } else {
          console.error('Max reconnection attempts reached');
          enqueueSnackbar('Connection lost. Please refresh the page.', { variant: 'error' });
        }
      };

      eventSource.onclose = () => {
        setIsConnected(false);
        setConnectionStatus('disconnected');
        onDisconnect?.();
        console.log('SSE connection closed');
      };

      eventSourceRef.current = eventSource;

    } catch (error) {
      console.error('Error creating SSE connection:', error);
      setConnectionStatus('error');
      scheduleReconnect();
    }
  }, [maxReconnectAttempts, onConnect, onDisconnect, onError, onEvent]);

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

  // Schedule reconnection
  const scheduleReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    reconnectAttemptsRef.current++;
    console.log(`Scheduling reconnection attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts}`);

    reconnectTimeoutRef.current = setTimeout(() => {
      disconnect();
      connect();
    }, reconnectInterval);
  }, [connect, disconnect, reconnectInterval, maxReconnectAttempts]);

  // Handle different event types
  const handleEvent = useCallback((event: SSEEvent) => {
    switch (event.type) {
      case 'connection':
        console.log('SSE connection confirmed:', event.data);
        break;

      case 'ping':
        // Keep-alive ping, no action needed
        break;

      case 'remote_config_change':
        handleRemoteConfigChange(event.data);
        break;

      case 'remote_config_deployment':
        handleRemoteConfigDeployment(event.data);
        break;

      case 'campaign_status_change':
        handleCampaignStatusChange(event.data);
        break;

      default:
        console.log('Unknown SSE event type:', event.type, event.data);
    }
  }, [t]);

  // Handle remote config change notifications
  const handleRemoteConfigChange = useCallback((data: any) => {
    const { action, config } = data;

    switch (action) {
      case 'created':
        enqueueSnackbar(t('admin.remoteConfig.createSuccess'), { variant: 'success' });
        break;
      case 'updated':
        enqueueSnackbar(`Config "${config.keyName}" updated`, { variant: 'info' });
        break;
      case 'deleted':
        enqueueSnackbar(`Config "${config.keyName}" deleted`, { variant: 'info' });
        break;
    }
  }, [t, enqueueSnackbar]);

  // Handle deployment notifications
  const handleRemoteConfigDeployment = useCallback((data: any) => {
    const { configCount } = data;
    enqueueSnackbar(`${configCount} configs deployed successfully`, { variant: 'success' });
  }, [enqueueSnackbar]);

  // Handle campaign status change notifications
  const handleCampaignStatusChange = useCallback((data: any) => {
    const { campaignId, isActive, reason } = data;
    const status = isActive ? 'activated' : 'deactivated';
    toast.info(`Campaign ${campaignId} ${status} (${reason})`);
  }, []);

  // Subscribe to channels
  const subscribe = useCallback(async (channels: string[]) => {
    if (!isConnected) {
      console.warn('Cannot subscribe: SSE not connected');
      return false;
    }

    try {
      const response = await fetch('/api/v1/notifications/sse/subscribe', {
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
        console.log('Subscribed to channels:', channels);
        return true;
      } else {
        console.error('Failed to subscribe to channels');
        return false;
      }
    } catch (error) {
      console.error('Error subscribing to channels:', error);
      return false;
    }
  }, [isConnected]);

  // Unsubscribe from channels
  const unsubscribe = useCallback(async (channels: string[]) => {
    if (!isConnected) {
      console.warn('Cannot unsubscribe: SSE not connected');
      return false;
    }

    try {
      const response = await fetch('/api/v1/notifications/sse/unsubscribe', {
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
        console.log('Unsubscribed from channels:', channels);
        return true;
      } else {
        console.error('Failed to unsubscribe from channels');
        return false;
      }
    } catch (error) {
      console.error('Error unsubscribing from channels:', error);
      return false;
    }
  }, [isConnected]);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  // Handle page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page is hidden, keep connection but reduce activity
      } else {
        // Page is visible, ensure connection is active
        if (!isConnected && autoConnect) {
          connect();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isConnected, autoConnect, connect]);

  return {
    isConnected,
    connectionStatus,
    lastEvent,
    connect,
    disconnect,
    subscribe,
    unsubscribe,
  };
};

export default useSSENotifications;
