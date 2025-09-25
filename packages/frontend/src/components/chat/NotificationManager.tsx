import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { useChat } from '../../contexts/ChatContext';
import { Message, User } from '../../types/chat';
import { getChatWebSocketService } from '../../services/chatWebSocketService';

interface NotificationManagerProps {
  currentUserId: number;
  activeChannelId?: number;
  isWindowFocused: boolean;
}

export interface NotificationManagerRef {
  showUserJoinNotification: (user: User, channelId: number) => void;
  showUserLeaveNotification: (user: User, channelId: number) => void;
}

const NotificationManager = forwardRef<NotificationManagerRef, NotificationManagerProps>(({
  currentUserId,
  activeChannelId,
  isWindowFocused,
}, ref) => {
  const { t } = useTranslation();
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const { state } = useChat();
  const audioRef = useRef<HTMLAudioElement>();
  const lastMessageIdRef = useRef<number>();

  // Initialize notification sound
  useEffect(() => {
    try {
      audioRef.current = new Audio('/sounds/notification.mp3');
      audioRef.current.volume = 0.5;
    } catch (error) {
      console.warn('Notification sound file not found:', error);
    }
  }, []);

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Initialize baseline to avoid notifying for cached/initial messages
  useEffect(() => {
    const allMessages = Object.values(state.messages).flat();
    if (allMessages.length > 0) {
      lastMessageIdRef.current = allMessages[allMessages.length - 1].id;
    }
  // run once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle new messages (skip until users are loaded and baseline set)
  useEffect(() => {
    // Require users to be loaded to resolve usernames/avatars
    if (!state.users || Object.keys(state.users).length === 0) return;

    const allMessages = Object.values(state.messages).flat();
    if (allMessages.length === 0) return;

    const latestMessage = allMessages[allMessages.length - 1];

    // Skip if it's the same message or from current user
    if (
      latestMessage.id === lastMessageIdRef.current ||
      latestMessage.userId === currentUserId
    ) {
      return;
    }

    lastMessageIdRef.current = latestMessage.id;

    // Don't notify if window is focused and user is in the same channel
    if (isWindowFocused && latestMessage.channelId === activeChannelId) {
      return;
    }

    // Show notification
    showMessageNotification(latestMessage);
  }, [state.messages, state.users, currentUserId, activeChannelId, isWindowFocused]);

  // Handle user join/leave events
  useEffect(() => {
    // This would be triggered by WebSocket events
    // For now, we'll handle it in the WebSocket service
  }, []);

  const showMessageNotification = (message: Message) => {
    // Resolve user info from message or global users map
    const user = (message as any).user || state.users[message.userId];
    if (!message || !user) {
      // Skip silently during initialization when users not yet loaded
      return;
    }

    const channel = state.channels.find(c => c.id === message.channelId);
    const channelName = channel?.name || t('chat.unknownChannel');
    const username = user.username || user.name || `User${message.userId}`;

    // Browser notification
    if (
      'Notification' in window &&
      Notification.permission === 'granted' &&
      !isWindowFocused
    ) {
      const notification = new Notification(
        `${username} in #${channelName}`,
        {
          body: getMessagePreview(message),
          icon: user.avatarUrl || '/icons/chat-notification.png',
          tag: `chat-${message.channelId}`,
          requireInteraction: false,
        }
      );

      notification.onclick = () => {
        window.focus();
        // Navigate to channel (this would be handled by the parent component)
        notification.close();
      };

      // Auto close after 5 seconds
      setTimeout(() => notification.close(), 5000);
    }

    // In-app notification (snackbar)
    if (message.channelId !== activeChannelId) {
      enqueueSnackbar(
        `${username} in #${channelName}: ${getMessagePreview(message)}`,
        {
          variant: 'info',
          autoHideDuration: 4000,
          action: (key) => (
            <button
              onClick={() => {
                // Navigate to channel
                window.location.hash = `#/chat?channel=${message.channelId}`;
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'inherit',
                textDecoration: 'underline',
                cursor: 'pointer',
              }}
            >
              {t('chat.viewMessage')}
            </button>
          ),
        }
      );
    }

    // Play sound
    playNotificationSound();
  };

  const showUserJoinNotification = (user: User, channelId: number) => {
    const channel = state.channels.find(c => c.id === channelId);
    const channelName = channel?.name || t('chat.unknownChannel');

    enqueueSnackbar(
      t('chat.userJoined', {
        user: user.username,
        channel: channelName,
      }),
      {
        variant: 'success',
        autoHideDuration: 3000,
      }
    );
  };

  const showUserLeaveNotification = (user: User, channelId: number) => {
    const channel = state.channels.find(c => c.id === channelId);
    const channelName = channel?.name || t('chat.unknownChannel');

    enqueueSnackbar(
      t('chat.userLeft', {
        user: user.username,
        channel: channelName,
      }),
      {
        variant: 'warning',
        autoHideDuration: 3000,
      }
    );
  };

  const getMessagePreview = (message: Message): string => {
    switch (message.type) {
      case 'image':
        return t('chat.sentImage');
      case 'video':
        return t('chat.sentVideo');
      case 'audio':
        return t('chat.sentAudio');
      case 'file':
        return t('chat.sentFile');
      case 'location':
        return t('chat.sentLocation');
      case 'system':
        return message.content;
      default:
        return message.content.length > 50
          ? message.content.substring(0, 50) + '...'
          : message.content;
    }
  };

  const playNotificationSound = () => {
    if (audioRef.current) {
      audioRef.current.play().catch(() => {
        // Ignore errors (e.g., user hasn't interacted with page yet)
      });
    }
  };

  // Handle WebSocket invitation events
  useEffect(() => {
    const webSocketService = getChatWebSocketService();

    // Channel invitation handling is now done in ChatContext to avoid duplicates

    const handleInvitationResponse = (event: any) => {
      const { data } = event;
      console.log('📬 Invitation response received:', data);
      // 토스트 제거 - ChatContext에서 처리하므로 중복 방지
    };

    const handleInvitationCancelled = (event: any) => {
      const { data } = event;
      console.log('❌ Invitation cancelled:', data);

      enqueueSnackbar(
        'An invitation was cancelled',
        { variant: 'warning' }
      );
    };

    // 이벤트 리스너 등록 (channel_invitation은 ChatContext에서 처리)
    webSocketService.on('invitation_response', handleInvitationResponse);
    webSocketService.on('invitation_cancelled', handleInvitationCancelled);

    // 클린업
    return () => {
      webSocketService.off('invitation_response', handleInvitationResponse);
      webSocketService.off('invitation_cancelled', handleInvitationCancelled);
    };
  }, [enqueueSnackbar]);

  // Expose methods for parent component to use
  useImperativeHandle(ref, () => ({
    showUserJoinNotification,
    showUserLeaveNotification,
  }));

  return null; // This component doesn't render anything
});

export default NotificationManager;
