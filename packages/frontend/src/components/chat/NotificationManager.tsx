import React, { useEffect, useRef } from 'react';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { useChat } from '../../contexts/ChatContext';
import { Message, User } from '../../types/chat';

interface NotificationManagerProps {
  currentUserId: number;
  activeChannelId?: number;
  isWindowFocused: boolean;
}

const NotificationManager: React.FC<NotificationManagerProps> = ({
  currentUserId,
  activeChannelId,
  isWindowFocused,
}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { state } = useChat();
  const audioRef = useRef<HTMLAudioElement>();
  const lastMessageIdRef = useRef<number>();

  // Initialize notification sound
  useEffect(() => {
    audioRef.current = new Audio('/sounds/notification.mp3');
    audioRef.current.volume = 0.5;
  }, []);

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Handle new messages
  useEffect(() => {
    const messages = state.messages;
    if (messages.length === 0) return;

    const latestMessage = messages[messages.length - 1];
    
    // Skip if it's the same message or from current user
    if (
      latestMessage.id === lastMessageIdRef.current ||
      latestMessage.user.id === currentUserId
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
  }, [state.messages, currentUserId, activeChannelId, isWindowFocused]);

  // Handle user join/leave events
  useEffect(() => {
    // This would be triggered by WebSocket events
    // For now, we'll handle it in the WebSocket service
  }, []);

  const showMessageNotification = (message: Message) => {
    const channel = state.channels.find(c => c.id === message.channelId);
    const channelName = channel?.name || t('chat.unknownChannel', 'Unknown Channel');

    // Browser notification
    if (
      'Notification' in window &&
      Notification.permission === 'granted' &&
      !isWindowFocused
    ) {
      const notification = new Notification(
        `${message.user.username} in #${channelName}`,
        {
          body: getMessagePreview(message),
          icon: message.user.avatar || '/icons/chat-notification.png',
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
        `${message.user.username} in #${channelName}: ${getMessagePreview(message)}`,
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
              {t('chat.viewMessage', 'View')}
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
    const channelName = channel?.name || t('chat.unknownChannel', 'Unknown Channel');

    enqueueSnackbar(
      t('chat.userJoined', '{{user}} joined #{{channel}}', {
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
    const channelName = channel?.name || t('chat.unknownChannel', 'Unknown Channel');

    enqueueSnackbar(
      t('chat.userLeft', '{{user}} left #{{channel}}', {
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
        return t('chat.sentImage', 'Sent an image');
      case 'video':
        return t('chat.sentVideo', 'Sent a video');
      case 'audio':
        return t('chat.sentAudio', 'Sent an audio');
      case 'file':
        return t('chat.sentFile', 'Sent a file');
      case 'location':
        return t('chat.sentLocation', 'Shared location');
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

  // Expose methods for parent component to use
  React.useImperativeHandle(
    React.forwardRef(() => null),
    () => ({
      showUserJoinNotification,
      showUserLeaveNotification,
    })
  );

  return null; // This component doesn't render anything
};

export default NotificationManager;
