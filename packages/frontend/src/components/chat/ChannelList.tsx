import React, { useState } from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Typography,
  Badge,
  Avatar,
  IconButton,
  Tooltip,
  Chip,
  TextField,
  InputAdornment,
  Divider,
  Menu,
  MenuItem,
} from '@mui/material';
import {
  Tag as PublicIcon,
  Lock as PrivateIcon,
  Person as DirectIcon,
  Search as SearchIcon,
  Add as AddIcon,
  MoreVert as MoreIcon,
  Settings as SettingsIcon,
  ExitToApp as LeaveIcon,
  Archive as ArchiveIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useChat } from '../../contexts/ChatContext';
import { Channel } from '../../types/chat';
import { formatDistanceToNow } from 'date-fns';
import { ko, enUS, zhCN } from 'date-fns/locale';

interface ChannelListProps {
  onCreateChannel?: () => void;
  onChannelSettings?: (channel: Channel) => void;
}

const ChannelList: React.FC<ChannelListProps> = ({
  onCreateChannel,
  onChannelSettings,
}) => {
  const { t, i18n } = useTranslation();
  const { state, actions } = useChat();
  const [searchQuery, setSearchQuery] = useState('');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);

  const getDateLocale = () => {
    switch (i18n.language) {
      case 'ko': return ko;
      case 'zh': return zhCN;
      default: return enUS;
    }
  };

  const filteredChannels = state.channels.filter(channel =>
    channel.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (channel.description && channel.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleChannelClick = (channel: Channel) => {
    actions.setCurrentChannel(channel.id);
    actions.markAsRead(channel.id);
  };

  const handleChannelMenu = (event: React.MouseEvent<HTMLElement>, channel: Channel) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
    setSelectedChannel(channel);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
    setSelectedChannel(null);
  };

  const handleLeaveChannel = async () => {
    if (selectedChannel) {
      try {
        await actions.leaveChannel(selectedChannel.id);
      } catch (error) {
        console.error('Failed to leave channel:', error);
      }
    }
    handleCloseMenu();
  };

  const handleChannelSettings = () => {
    if (selectedChannel && onChannelSettings) {
      onChannelSettings(selectedChannel);
    }
    handleCloseMenu();
  };

  const getChannelIcon = (channel: Channel) => {
    switch (channel.type) {
      case 'public':
        return <PublicIcon />;
      case 'private':
        return <PrivateIcon />;
      case 'direct':
        return <DirectIcon />;
      default:
        return <PublicIcon />;
    }
  };

  const getChannelSubtitle = (channel: Channel) => {
    if (channel.lastMessage) {
      const timeAgo = formatDistanceToNow(new Date(channel.lastMessage.createdAt), {
        addSuffix: true,
        locale: getDateLocale(),
      });
      
      const content = channel.lastMessage.content.length > 30 
        ? `${channel.lastMessage.content.substring(0, 30)}...`
        : channel.lastMessage.content;
      
      return `${channel.lastMessage.user.username}: ${content} • ${timeAgo}`;
    }
    
    if (channel.description) {
      return channel.description;
    }
    
    return t('chat.noMessages', 'No messages yet');
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {t('chat.channels', 'Channels')}
          </Typography>
          {onCreateChannel && (
            <Tooltip title={t('chat.createChannel', 'Create Channel')}>
              <IconButton size="small" onClick={onCreateChannel}>
                <AddIcon />
              </IconButton>
            </Tooltip>
          )}
        </Box>
        
        {/* Search */}
        <TextField
          fullWidth
          size="small"
          placeholder={t('chat.searchChannels', 'Search channels...')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      {/* Channel List */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {filteredChannels.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              {searchQuery 
                ? t('chat.noChannelsFound', 'No channels found')
                : t('chat.noChannels', 'No channels available')
              }
            </Typography>
          </Box>
        ) : (
          <List disablePadding>
            {filteredChannels.map((channel) => (
              <ListItem key={channel.id} disablePadding>
                <ListItemButton
                  selected={state.currentChannelId === channel.id}
                  onClick={() => handleChannelClick(channel)}
                  sx={{
                    py: 1.5,
                    '&.Mui-selected': {
                      backgroundColor: 'primary.main',
                      color: 'primary.contrastText',
                      '&:hover': {
                        backgroundColor: 'primary.dark',
                      },
                      '& .MuiListItemIcon-root': {
                        color: 'primary.contrastText',
                      },
                      '& .MuiListItemText-secondary': {
                        color: 'primary.contrastText',
                        opacity: 0.8,
                      },
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    {channel.type === 'direct' ? (
                      <Avatar sx={{ width: 24, height: 24, fontSize: '0.75rem' }}>
                        {channel.name.charAt(0).toUpperCase()}
                      </Avatar>
                    ) : (
                      getChannelIcon(channel)
                    )}
                  </ListItemIcon>
                  
                  <ListItemText
                    primary={
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 500 }}>
                          {channel.name}
                        </span>
                        {channel.type === 'private' && (
                          <Chip
                            label={t('chat.private', 'Private')}
                            size="small"
                            variant="outlined"
                            sx={{ height: 16, fontSize: '0.6rem' }}
                          />
                        )}
                      </span>
                    }
                    secondary={getChannelSubtitle(channel)}
                    primaryTypographyProps={{
                      variant: 'body2',
                      noWrap: true,
                    }}
                    secondaryTypographyProps={{
                      variant: 'caption',
                      noWrap: true,
                    }}
                  />
                  
                  <ListItemSecondaryAction>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {channel.unreadCount && channel.unreadCount > 0 && (
                        <Badge
                          badgeContent={channel.unreadCount > 99 ? '99+' : channel.unreadCount}
                          color="error"
                          sx={{
                            '& .MuiBadge-badge': {
                              fontSize: '0.6rem',
                              height: 16,
                              minWidth: 16,
                            },
                          }}
                        />
                      )}
                      
                      <IconButton
                        size="small"
                        onClick={(e) => handleChannelMenu(e, channel)}
                        sx={{ 
                          opacity: 0.7,
                          '&:hover': { opacity: 1 },
                        }}
                      >
                        <MoreIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </ListItemSecondaryAction>
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}
      </Box>

      {/* Channel Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleCloseMenu}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <MenuItem onClick={handleChannelSettings}>
          <SettingsIcon sx={{ mr: 1 }} />
          {t('chat.channelSettings', 'Channel Settings')}
        </MenuItem>
        
        {selectedChannel?.type !== 'direct' && (
          <MenuItem onClick={handleLeaveChannel} sx={{ color: 'error.main' }}>
            <LeaveIcon sx={{ mr: 1 }} />
            {t('chat.leaveChannel', 'Leave Channel')}
          </MenuItem>
        )}
      </Menu>
    </Box>
  );
};

export default ChannelList;
