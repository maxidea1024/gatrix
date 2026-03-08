import React from 'react';
import { Box, Typography, Avatar, Chip } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { User } from '../../types/chat';

interface TypingIndicatorProps {
  users: User[];
}

const TypingIndicator: React.FC<TypingIndicatorProps> = ({ users }) => {
  const { t } = useTranslation();

  if (users.length === 0) return null;

  const renderTypingDots = () => (
    <Box
      sx={{
        display: 'flex',
        gap: 0.5,
        alignItems: 'center',
        ml: 1,
      }}
    >
      {[0, 1, 2].map((i) => (
        <Box
          key={i}
          sx={{
            width: 4,
            height: 4,
            borderRadius: '50%',
            backgroundColor: 'text.secondary',
            animation: 'typingDot 1.4s infinite ease-in-out',
            animationDelay: `${i * 0.16}s`,
            '@keyframes typingDot': {
              '0%, 80%, 100%': {
                transform: 'scale(0)',
                opacity: 0.5,
              },
              '40%': {
                transform: 'scale(1)',
                opacity: 1,
              },
            },
          }}
        />
      ))}
    </Box>
  );

  const getTypingText = () => {
    if (users.length === 1) {
      return t('chat.userTyping', { user: users[0].username });
    } else if (users.length === 2) {
      return t('chat.twoUsersTyping', {
        user1: users[0].username,
        user2: users[1].username,
      });
    } else {
      return t('chat.usersTyping', { count: users.length });
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        p: 1,
        mx: 1,
        mb: 1,
        backgroundColor: 'background.paper',
        borderRadius: 0,
        border: 1,
        borderColor: 'divider',
        animation: 'fadeIn 0.2s ease-in',
        '@keyframes fadeIn': {
          from: { opacity: 0, transform: 'translateY(10px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
      }}
    >
      {/* User Avatars */}
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        {users.slice(0, 3).map((user, index) => (
          <Avatar
            key={user.id}
            src={user.avatarUrl}
            sx={{
              width: 20,
              height: 20,
              fontSize: '0.6rem',
              ml: index > 0 ? -0.5 : 0,
              border: 1,
              borderColor: 'background.paper',
              zIndex: 3 - index,
            }}
          >
            {user.username.charAt(0).toUpperCase()}
          </Avatar>
        ))}
        {users.length > 3 && (
          <Chip
            label={`+${users.length - 3}`}
            size="small"
            sx={{
              height: 20,
              fontSize: '0.6rem',
              ml: -0.5,
              zIndex: 0,
            }}
          />
        )}
      </Box>

      {/* Typing Text */}
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ fontStyle: 'italic' }}
      >
        {getTypingText()}
      </Typography>

      {/* Typing Animation Dots */}
      {renderTypingDots()}
    </Box>
  );
};

export default TypingIndicator;
