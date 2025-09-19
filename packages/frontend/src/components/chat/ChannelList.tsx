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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
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
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [channelToLeave, setChannelToLeave] = useState<Channel | null>(null);

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
    // 이미 선택된 채널이면 아무것도 하지 않음
    if (state.currentChannelId === channel.id) {
      return;
    }

    // 새로운 채널 선택
    actions.setCurrentChannel(channel.id);

    // 채널 변경 후 메시지가 로딩되면 자동으로 읽음 처리
    // (ChatElementsMessageList에서 처리하도록 변경)
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

  const handleLeaveChannel = () => {
    if (selectedChannel) {
      setChannelToLeave(selectedChannel);
      setLeaveConfirmOpen(true);
    }
    handleCloseMenu();
  };

  const handleConfirmLeave = async () => {
    if (channelToLeave) {
      try {
        await actions.leaveChannel(channelToLeave.id);
      } catch (error) {
        console.error('Failed to leave channel:', error);
      }
    }
    setLeaveConfirmOpen(false);
    setChannelToLeave(null);
  };

  const handleCancelLeave = () => {
    setLeaveConfirmOpen(false);
    setChannelToLeave(null);
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
    
    return t('chat.noMessages');
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {t('chat.channels')}
          </Typography>
          {onCreateChannel && (
            <Tooltip title={t('chat.createChannel')}>
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
          placeholder={t('chat.searchChannels')}
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
                ? t('chat.noChannelsFound')
                : t('chat.noChannels')
              }
            </Typography>
          </Box>
        ) : (
          <List disablePadding sx={{ pt: 1 }}>
            {filteredChannels.map((channel) => (
              <ListItem key={channel.id} disablePadding>
                <ListItemButton
                  selected={state.currentChannelId === channel.id}
                  onClick={() => handleChannelClick(channel)}
                  sx={{
                    py: 0.5, // 위아래 패딩 더 줄임 (1 → 0.5)
                    px: 1, // 좌우 패딩 설정
                    mx: 1.5, // 좌우 여백 늘림
                    my: 0.25, // 위아래 마진 추가로 간격 조정
                    borderRadius: 1, // 슬랙 스타일 라운드
                    '&.Mui-selected': {
                      backgroundColor: (theme) =>
                        theme.palette.mode === 'dark'
                          ? 'rgba(255, 255, 255, 0.08)' // 다크 테마: 약간 밝게
                          : 'rgba(0, 0, 0, 0.08)', // 라이트 테마: 더 어둡게 (0.04 → 0.08)
                      color: 'inherit', // 기본 텍스트 색상 유지
                      '&:hover': {
                        backgroundColor: (theme) =>
                          theme.palette.mode === 'dark'
                            ? 'rgba(255, 255, 255, 0.12)'
                            : 'rgba(0, 0, 0, 0.12)', // 라이트 테마 호버도 더 어둡게 (0.08 → 0.12)
                      },
                      '& .MuiListItemIcon-root': {
                        color: 'inherit',
                      },
                      '& .MuiListItemText-secondary': {
                        color: 'text.secondary',
                      },
                    },
                    '&:hover': {
                      backgroundColor: (theme) =>
                        theme.palette.mode === 'dark'
                          ? 'rgba(255, 255, 255, 0.04)'
                          : 'rgba(0, 0, 0, 0.04)', // 라이트 테마 일반 호버도 더 어둡게 (0.02 → 0.04)
                      borderRadius: 1, // 호버 시에도 라운드 유지
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
                            label={t('chat.private')}
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
                      {channel.unreadCount > 0 && state.currentChannelId !== channel.id && (
                        <Chip
                          label={channel.unreadCount > 99 ? '99+' : channel.unreadCount}
                          size="small"
                          color="error"
                          sx={{
                            height: 18,
                            fontSize: '0.65rem',
                            fontWeight: 'bold',
                            '& .MuiChip-label': {
                              px: 0.75,
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
          {t('chat.channelSettings')}
        </MenuItem>
        
        {selectedChannel?.type !== 'direct' && (
          <MenuItem onClick={handleLeaveChannel} sx={{ color: 'error.main' }}>
            <LeaveIcon sx={{ mr: 1 }} />
            {t('chat.leaveChannel')}
          </MenuItem>
        )}
      </Menu>

      {/* Leave Channel Confirmation Dialog */}
      <Dialog
        open={leaveConfirmOpen}
        onClose={handleCancelLeave}
        aria-labelledby="leave-channel-dialog-title"
        aria-describedby="leave-channel-dialog-description"
      >
        <DialogTitle id="leave-channel-dialog-title">
          {t('chat.leaveChannelConfirm')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="leave-channel-dialog-description">
            {t('chat.leaveChannelMessage')} "{channelToLeave?.name}"?
            <br />
            {t('chat.leaveChannelWarning')}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelLeave} color="primary">
            {t('common.cancel')}
          </Button>
          <Button onClick={handleConfirmLeave} color="error" variant="contained">
            {t('chat.leaveChannel')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ChannelList;
