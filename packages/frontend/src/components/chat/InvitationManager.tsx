import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  Box,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  Avatar,
  Button,
  IconButton,
  Typography,
  Chip,
  CircularProgress,
  Divider,
} from '@mui/material';
import {
  Check as CheckIcon,
  Close as CloseIcon,
  Cancel as CancelIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { formatDistanceToNow } from 'date-fns';

interface Invitation {
  id: number;
  channelId: number;
  inviterId: number;
  inviteeId: number;
  status: 'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled';
  message?: string;
  createdAt: string;
  channel?: {
    id: number;
    name: string;
    description?: string;
  };
  inviter?: {
    id: number;
    name: string;
    email: string;
  };
  invitee?: {
    id: number;
    name: string;
    email: string;
  };
}

interface InvitationManagerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  onInvitationAccepted?: (channelId: number) => void;
}

const InvitationManager: React.FC<InvitationManagerProps> = ({ open, onClose, title, subtitle, onInvitationAccepted }) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  const [currentTab, setCurrentTab] = useState(0);
  const [receivedInvitations, setReceivedInvitations] = useState<Invitation[]>([]);
  const [sentInvitations, setSentInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingInvitations, setProcessingInvitations] = useState<Set<number>>(new Set());

  // 받은 초대 목록 조회
  const fetchReceivedInvitations = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/v1/invitations/received', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setReceivedInvitations(data.data);
        }
      } else {
        console.error('Failed to fetch received invitations:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Failed to fetch received invitations:', error);
    }
  };

  // 보낸 초대 목록 조회
  const fetchSentInvitations = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/v1/invitations/sent', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSentInvitations(data.data);
        }
      } else {
        console.error('Failed to fetch sent invitations:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Failed to fetch sent invitations:', error);
    }
  };

  // 초대 응답 (수락/거절)
  const respondToInvitation = async (invitationId: number, action: 'accept' | 'decline') => {
    setProcessingInvitations(prev => new Set(prev).add(invitationId));

    try {
      const response = await fetch(`http://localhost:3001/api/v1/invitations/${invitationId}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
        body: JSON.stringify({ action }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          enqueueSnackbar(`Invitation ${action}ed successfully`, { variant: 'success' });
          await fetchReceivedInvitations();

          // 초대 수락 시 해당 채널로 자동 이동
          if (action === 'accept' && data.channelId) {
            // 채널 목록 새로고침을 위해 부모 컴포넌트에 알림
            if (onInvitationAccepted) {
              onInvitationAccepted(data.channelId);
            }

            // 채팅 페이지로 이동하면서 해당 채널 선택
            window.location.href = `/chat?channel=${data.channelId}`;
          }
        } else {
          enqueueSnackbar(data.error || `Failed to ${action} invitation`, { variant: 'error' });
        }
      } else {
        enqueueSnackbar(`Failed to ${action} invitation`, { variant: 'error' });
      }
    } catch (error) {
      console.error(`Failed to ${action} invitation:`, error);
      enqueueSnackbar(`Failed to ${action} invitation`, { variant: 'error' });
    } finally {
      setProcessingInvitations(prev => {
        const newSet = new Set(prev);
        newSet.delete(invitationId);
        return newSet;
      });
    }
  };

  // 초대 취소
  const cancelInvitation = async (invitationId: number) => {
    setProcessingInvitations(prev => new Set(prev).add(invitationId));

    try {
      const response = await fetch(`http://localhost:3001/api/v1/invitations/${invitationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          enqueueSnackbar('Invitation cancelled successfully', { variant: 'success' });
          await fetchSentInvitations();
        } else {
          enqueueSnackbar(data.error || 'Failed to cancel invitation', { variant: 'error' });
        }
      } else {
        enqueueSnackbar('Failed to cancel invitation', { variant: 'error' });
      }
    } catch (error) {
      console.error('Failed to cancel invitation:', error);
      enqueueSnackbar('Failed to cancel invitation', { variant: 'error' });
    } finally {
      setProcessingInvitations(prev => {
        const newSet = new Set(prev);
        newSet.delete(invitationId);
        return newSet;
      });
    }
  };

  // 다이얼로그 열릴 때 데이터 로드
  useEffect(() => {
    if (open) {
      setLoading(true);
      Promise.all([fetchReceivedInvitations(), fetchSentInvitations()])
        .finally(() => setLoading(false));
    }
  }, [open]);

  // 상태별 색상 및 아이콘
  const getStatusChip = (status: string) => {
    switch (status) {
      case 'pending':
        return <Chip label={t('chat.pending')} color="warning" size="small" icon={<ScheduleIcon />} />;
      case 'accepted':
        return <Chip label={t('chat.accepted')} color="success" size="small" icon={<CheckIcon />} />;
      case 'declined':
        return <Chip label={t('chat.declined')} color="error" size="small" icon={<CloseIcon />} />;
      case 'cancelled':
        return <Chip label={t('chat.cancelled')} color="default" size="small" icon={<CancelIcon />} />;
      case 'expired':
        return <Chip label={t('chat.expired')} color="default" size="small" />;
      default:
        return <Chip label={status} size="small" />;
    }
  };

  // 받은 초대 렌더링
  const renderReceivedInvitation = (invitation: Invitation) => (
    <ListItem key={invitation.id} divider>
      <ListItemAvatar>
        <Avatar>
          {invitation.channel?.name?.charAt(0).toUpperCase() || 'C'}
        </Avatar>
      </ListItemAvatar>
      
      <ListItemText
        primary={
          <Box display="flex" alignItems="center" gap={1}>
            <Typography variant="subtitle2">
              {invitation.channel?.name || 'Unknown Channel'}
            </Typography>
            {getStatusChip(invitation.status)}
          </Box>
        }
        secondary={
          <Box>
            <Typography variant="body2" color="text.secondary">
              {t('chat.invitedBy')}: {invitation.inviter?.name || t('chat.unknownUser')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatDistanceToNow(new Date(invitation.createdAt), { addSuffix: true })}
            </Typography>
            {invitation.message && (
              <Typography variant="body2" sx={{ mt: 0.5, fontStyle: 'italic' }}>
                "{invitation.message}"
              </Typography>
            )}
          </Box>
        }
      />
      
      {invitation.status === 'pending' && (
        <ListItemSecondaryAction>
          <Box display="flex" gap={1}>
            <Button
              size="small"
              variant="contained"
              color="success"
              onClick={() => respondToInvitation(invitation.id, 'accept')}
              disabled={processingInvitations.has(invitation.id)}
              startIcon={processingInvitations.has(invitation.id) ? <CircularProgress size={16} /> : <CheckIcon />}
            >
              {t('chat.accept')}
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="error"
              onClick={() => respondToInvitation(invitation.id, 'decline')}
              disabled={processingInvitations.has(invitation.id)}
              startIcon={<CloseIcon />}
            >
              {t('chat.decline')}
            </Button>
          </Box>
        </ListItemSecondaryAction>
      )}
    </ListItem>
  );

  // 보낸 초대 렌더링
  const renderSentInvitation = (invitation: Invitation) => (
    <ListItem key={invitation.id} divider>
      <ListItemAvatar>
        <Avatar>
          {invitation.invitee?.name?.charAt(0).toUpperCase() || 'U'}
        </Avatar>
      </ListItemAvatar>
      
      <ListItemText
        primary={
          <Box display="flex" alignItems="center" gap={1}>
            <Typography variant="subtitle2">
              {invitation.invitee?.name || 'Unknown User'}
            </Typography>
            {getStatusChip(invitation.status)}
          </Box>
        }
        secondary={
          <Box>
            <Typography variant="body2" color="text.secondary">
              {t('chat.invitedTo')}: {invitation.channel?.name || t('chat.unknownChannel')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatDistanceToNow(new Date(invitation.createdAt), { addSuffix: true })}
            </Typography>
            {invitation.message && (
              <Typography variant="body2" sx={{ mt: 0.5, fontStyle: 'italic' }}>
                "{invitation.message}"
              </Typography>
            )}
          </Box>
        }
      />
      
      {invitation.status === 'pending' && (
        <ListItemSecondaryAction>
          <Button
            size="small"
            variant="outlined"
            color="error"
            onClick={() => cancelInvitation(invitation.id)}
            disabled={processingInvitations.has(invitation.id)}
            startIcon={processingInvitations.has(invitation.id) ? <CircularProgress size={16} /> : <CancelIcon />}
          >
            {t('chat.cancel')}
          </Button>
        </ListItemSecondaryAction>
      )}
    </ListItem>
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography variant="h6">{title || t('chat.manageInvitations')}</Typography>
            {subtitle && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {subtitle}
              </Typography>
            )}
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Tabs value={currentTab} onChange={(_, newValue) => setCurrentTab(newValue)}>
          <Tab label={`${t('chat.receivedInvitations')} (${receivedInvitations.length})`} />
          <Tab label={`${t('chat.sentInvitations')} (${sentInvitations.length})`} />
        </Tabs>

        <Box sx={{ mt: 2 }}>
          {loading ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              {currentTab === 0 && (
                <List>
                  {receivedInvitations.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                      {t('chat.noReceivedInvitations')}
                    </Typography>
                  ) : (
                    receivedInvitations.map(renderReceivedInvitation)
                  )}
                </List>
              )}

              {currentTab === 1 && (
                <List>
                  {sentInvitations.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                      {t('chat.noSentInvitations')}
                    </Typography>
                  ) : (
                    sentInvitations.map(renderSentInvitation)
                  )}
                </List>
              )}
            </>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default InvitationManager;
