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
  const { enqueueSnackbar } = useSnackbar();
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

  // Handle new messages
  useEffect(() => {
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
  }, [state.messages, currentUserId, activeChannelId, isWindowFocused]);

  // Handle user join/leave events
  useEffect(() => {
    // This would be triggered by WebSocket events
    // For now, we'll handle it in the WebSocket service
  }, []);

  const showMessageNotification = (message: Message) => {
    const channel = state.channels.find(c => c.id === message.channelId);
    const channelName = channel?.name || t('chat.unknownChannel');

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

    const handleChannelInvitation = (event: any) => {
      const { data } = event;
      console.log('📨 Channel invitation received:', data);

      // 브라우저 알림
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(`Channel Invitation`, {
          body: `${data.inviterName} invited you to join "${data.channelName}"`,
          icon: '/favicon.ico',
          tag: `invitation-${data.invitationId}`,
        });
      }

      // 스낵바 알림
      enqueueSnackbar(
        `${data.inviterName} invited you to join "${data.channelName}"`,
        {
          variant: 'info',
          persist: true,
          action: (key) => (
            <div>
              <button onClick={() => {
                // TODO: 초대 수락/거절 처리
                console.log('Accept invitation:', data.invitationId);
              }}>
                Accept
              </button>
              <button onClick={() => {
                console.log('Decline invitation:', data.invitationId);
              }}>
                Decline
              </button>
            </div>
          )
        }
      );

      // 알림음 재생
      playNotificationSound();
    };

    const handleInvitationResponse = (event: any) => {
      const { data } = event;
      console.log('📬 Invitation response received:', data);

      const action = data.action === 'accept' ? 'accepted' : 'declined';
      enqueueSnackbar(
        `Your invitation was ${action}`,
        { variant: data.action === 'accept' ? 'success' : 'info' }
      );
    };

    const handleInvitationCancelled = (event: any) => {
      const { data } = event;
      console.log('❌ Invitation cancelled:', data);

      enqueueSnackbar(
        'An invitation was cancelled',
        { variant: 'warning' }
      );
    };

    // 이벤트 리스너 등록
    webSocketService.on('channel_invitation', handleChannelInvitation);
    webSocketService.on('invitation_response', handleInvitationResponse);
    webSocketService.on('invitation_cancelled', handleInvitationCancelled);

    // 클린업
    return () => {
      webSocketService.off('channel_invitation', handleChannelInvitation);
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
