import React from 'react';
import {
  Box,
  Avatar,
  AvatarGroup,
  Tooltip,
  Typography,
  Chip,
} from '@mui/material';
import {
  Done as SentIcon,
  DoneAll as DeliveredIcon,
  Visibility as ReadIcon,
  Schedule as PendingIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { Message, MessageStatus, User } from '../../types/chat';
import { format } from 'date-fns';
import { ko, enUS, zhCN } from 'date-fns/locale';

interface ReadReceiptsProps {
  message: Message;
  isOwnMessage: boolean;
  showReadReceipts?: boolean;
  compact?: boolean;
}

const ReadReceipts: React.FC<ReadReceiptsProps> = ({
  message,
  isOwnMessage,
  showReadReceipts = true,
  compact = false,
}) => {
  const { t, i18n } = useTranslation();

  const getDateLocale = () => {
    switch (i18n.language) {
      case 'ko':
        return ko;
      case 'zh':
        return zhCN;
      default:
        return enUS;
    }
  };

  const getStatusIcon = (status: MessageStatus) => {
    switch (status) {
      case 'sending':
        return <PendingIcon fontSize="small" sx={{ color: 'text.secondary' }} />;
      case 'sent':
        return <SentIcon fontSize="small" sx={{ color: 'text.secondary' }} />;
      case 'delivered':
        return <DeliveredIcon fontSize="small" sx={{ color: 'info.main' }} />;
      case 'read':
        return <ReadIcon fontSize="small" sx={{ color: 'success.main' }} />;
      case 'failed':
        return <ErrorIcon fontSize="small" sx={{ color: 'error.main' }} />;
      default:
        return null;
    }
  };

  const getStatusText = (status: MessageStatus) => {
    switch (status) {
      case 'sending':
        return t('chat.sending');
      case 'sent':
        return t('chat.sent');
      case 'delivered':
        return t('chat.delivered');
      case 'read':
        return t('chat.read');
      case 'failed':
        return t('chat.failed');
      default:
        return '';
    }
  };

  const formatTime = (date: Date) => {
    return format(date, 'HH:mm', { locale: getDateLocale() });
  };

  const readByUsers = message.readBy || [];
  const hasBeenRead = readByUsers.length > 0;

  if (!isOwnMessage && !showReadReceipts) {
    return null;
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: isOwnMessage ? 'flex-end' : 'flex-start',
        gap: 0.5,
        mt: 0.5,
        opacity: 0.7,
      }}
    >
      {/* Message timestamp */}
      <Typography variant="caption" color="text.secondary">
        {formatTime(new Date(message.createdAt))}
      </Typography>

      {/* Status indicator for own messages */}
      {isOwnMessage && (
        <Tooltip title={getStatusText(message.status)}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {getStatusIcon(message.status)}
          </Box>
        </Tooltip>
      )}

      {/* Read receipts for own messages */}
      {isOwnMessage && showReadReceipts && hasBeenRead && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {compact ? (
            <Tooltip
              title={
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
                    {t('chat.readBy')}
                  </Typography>
                  {readByUsers.map((user) => (
                    <Typography key={user.id} variant="caption" sx={{ display: 'block' }}>
                      {user.username}
                    </Typography>
                  ))}
                </Box>
              }
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                <ReadIcon fontSize="small" sx={{ color: 'success.main' }} />
                <Typography variant="caption" color="success.main">
                  {readByUsers.length}
                </Typography>
              </Box>
            </Tooltip>
          ) : (
            <Tooltip
              title={
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
                    {t('chat.readBy')}
                  </Typography>
                  {readByUsers.map((user) => (
                    <Typography key={user.id} variant="caption" sx={{ display: 'block' }}>
                      {user.username} at {formatTime(new Date(user.readAt || message.createdAt))}
                    </Typography>
                  ))}
                </Box>
              }
            >
              <AvatarGroup
                max={3}
                sx={{
                  '& .MuiAvatar-root': {
                    width: 16,
                    height: 16,
                    fontSize: '0.6rem',
                    border: '1px solid',
                    borderColor: 'background.paper',
                  },
                }}
              >
                {readByUsers.map((user) => (
                  <Avatar key={user.id} src={user.avatar} alt={user.username}>
                    {user.username.charAt(0).toUpperCase()}
                  </Avatar>
                ))}
              </AvatarGroup>
            </Tooltip>
          )}
        </Box>
      )}

      {/* Edit indicator */}
      {message.editedAt && (
        <Tooltip title={t('chat.editedAt', 'Edited at {{time}}', {
          time: format(new Date(message.editedAt), 'PPp', { locale: getDateLocale() })
        })}>
          <Chip
            label={t('chat.edited')}
            size="small"
            variant="outlined"
            sx={{
              height: 16,
              fontSize: '0.6rem',
              '& .MuiChip-label': {
                px: 0.5,
              },
            }}
          />
        </Tooltip>
      )}

      {/* Retry button for failed messages */}
      {isOwnMessage && message.status === 'failed' && (
        <Tooltip title={t('chat.retry')}>
          <Box
            component="button"
            onClick={() => {
              // Handle retry logic
              console.log('Retry message:', message.id);
            }}
            sx={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'error.main',
              display: 'flex',
              alignItems: 'center',
              p: 0,
              '&:hover': {
                opacity: 0.7,
              },
            }}
          >
            <Typography variant="caption" color="error">
              {t('chat.retry')}
            </Typography>
          </Box>
        </Tooltip>
      )}
    </Box>
  );
};

export default ReadReceipts;
