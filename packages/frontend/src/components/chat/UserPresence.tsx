import React from 'react';
import {
  Box,
  Avatar,
  Typography,
  Badge,
  Tooltip,
  Chip,
} from '@mui/material';
import {
  Circle as OnlineIcon,
  Schedule as AwayIcon,
  DoNotDisturb as BusyIcon,
  VisibilityOff as InvisibleIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { User, UserStatus } from '../../types/chat';
import { format, formatDistanceToNow } from 'date-fns';
import { ko, enUS, zhCN } from 'date-fns/locale';

interface UserPresenceProps {
  user: User;
  showStatus?: boolean;
  showLastSeen?: boolean;
  size?: 'small' | 'medium' | 'large';
  variant?: 'avatar' | 'list' | 'inline';
}

const UserPresence: React.FC<UserPresenceProps> = ({
  user,
  showStatus = true,
  showLastSeen = false,
  size = 'medium',
  variant = 'avatar',
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

  const getStatusColor = (status: UserStatus) => {
    switch (status) {
      case 'online':
        return 'success.main';
      case 'away':
        return 'warning.main';
      case 'busy':
        return 'error.main';
      case 'offline':
      case 'invisible':
        return 'grey.500';
      default:
        return 'grey.500';
    }
  };

  const getStatusIcon = (status: UserStatus) => {
    const iconProps = { fontSize: 'small' as const };
    
    switch (status) {
      case 'online':
        return <OnlineIcon {...iconProps} sx={{ color: 'success.main' }} />;
      case 'away':
        return <AwayIcon {...iconProps} sx={{ color: 'warning.main' }} />;
      case 'busy':
        return <BusyIcon {...iconProps} sx={{ color: 'error.main' }} />;
      case 'invisible':
        return <InvisibleIcon {...iconProps} sx={{ color: 'grey.500' }} />;
      case 'offline':
      default:
        return <OnlineIcon {...iconProps} sx={{ color: 'grey.500' }} />;
    }
  };

  const getStatusText = (status: UserStatus) => {
    switch (status) {
      case 'online':
        return t('chat.online');
      case 'away':
        return t('chat.away');
      case 'busy':
        return t('chat.busy');
      case 'invisible':
        return t('chat.invisible');
      case 'offline':
      default:
        return t('chat.offline');
    }
  };

  const getAvatarSize = () => {
    switch (size) {
      case 'small':
        return { width: 24, height: 24 };
      case 'large':
        return { width: 48, height: 48 };
      case 'medium':
      default:
        return { width: 32, height: 32 };
    }
  };

  const getBadgeSize = () => {
    switch (size) {
      case 'small':
        return 8;
      case 'large':
        return 12;
      case 'medium':
      default:
        return 10;
    }
  };

  const formatLastSeen = (lastSeenAt?: string) => {
    if (!lastSeenAt) return t('chat.neverSeen');
    
    const lastSeen = new Date(lastSeenAt);
    const now = new Date();
    const diffInMinutes = (now.getTime() - lastSeen.getTime()) / (1000 * 60);
    
    if (diffInMinutes < 5) {
      return t('chat.justNow');
    } else if (diffInMinutes < 60) {
      return t('chat.minutesAgo', '{{minutes}} minutes ago', { 
        minutes: Math.floor(diffInMinutes) 
      });
    } else {
      return formatDistanceToNow(lastSeen, { 
        addSuffix: true, 
        locale: getDateLocale() 
      });
    }
  };

  const renderAvatar = () => (
    <Badge
      overlap="circular"
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      badgeContent={
        showStatus ? (
          <Box
            sx={{
              width: getBadgeSize(),
              height: getBadgeSize(),
              borderRadius: '50%',
              backgroundColor: getStatusColor(user.status),
              border: 2,
              borderColor: 'background.paper',
            }}
          />
        ) : undefined
      }
    >
      <Avatar
        src={user.avatar}
        sx={{
          ...getAvatarSize(),
          fontSize: size === 'small' ? '0.75rem' : '1rem',
        }}
      >
        {user.username.charAt(0).toUpperCase()}
      </Avatar>
    </Badge>
  );

  const renderUserInfo = () => (
    <Box sx={{ minWidth: 0, flex: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Typography
          variant={size === 'small' ? 'body2' : 'body1'}
          sx={{ fontWeight: 500 }}
          noWrap
        >
          {user.name || user.username}
        </Typography>
        
        {user.role === 'admin' && (
          <Chip
            label={t('chat.admin')}
            size="small"
            color="primary"
            variant="outlined"
            sx={{ 
              height: size === 'small' ? 16 : 20, 
              fontSize: size === 'small' ? '0.6rem' : '0.7rem' 
            }}
          />
        )}
      </Box>
      
      {user.name && (
        <Typography
          variant="caption"
          color="text.secondary"
          noWrap
        >
          @{user.username}
        </Typography>
      )}
      
      {showStatus && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
          {getStatusIcon(user.status)}
          <Typography variant="caption" color="text.secondary">
            {getStatusText(user.status)}
          </Typography>
        </Box>
      )}
      
      {showLastSeen && user.status === 'offline' && (
        <Typography variant="caption" color="text.secondary">
          {formatLastSeen(user.lastSeenAt)}
        </Typography>
      )}
    </Box>
  );

  switch (variant) {
    case 'list':
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
          {renderAvatar()}
          {renderUserInfo()}
        </Box>
      );
      
    case 'inline':
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {renderAvatar()}
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {user.username}
          </Typography>
          {showStatus && (
            <Tooltip title={getStatusText(user.status)}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                {getStatusIcon(user.status)}
              </Box>
            </Tooltip>
          )}
        </Box>
      );
      
    case 'avatar':
    default:
      return (
        <Tooltip
          title={
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                {user.name || user.username}
              </Typography>
              {user.name && (
                <Typography variant="caption" color="inherit">
                  @{user.username}
                </Typography>
              )}
              <Typography variant="caption" color="inherit" sx={{ display: 'block' }}>
                {getStatusText(user.status)}
              </Typography>
              {showLastSeen && user.status === 'offline' && (
                <Typography variant="caption" color="inherit" sx={{ display: 'block' }}>
                  {formatLastSeen(user.lastSeenAt)}
                </Typography>
              )}
            </Box>
          }
        >
          {renderAvatar()}
        </Tooltip>
      );
  }
};

export default UserPresence;
