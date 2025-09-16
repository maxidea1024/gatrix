import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Button,
  Box,
  TextField,
  Chip,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  ContentCopy as CopyIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { Invitation } from '../../types/invitation';
import { invitationService } from '../../services/invitationService';

interface InvitationStatusCardProps {
  invitation: Invitation;
  onUpdate: () => void;
  onDelete: () => void;
}

const InvitationStatusCard: React.FC<InvitationStatusCardProps> = ({
  invitation,
  onUpdate,
  onDelete
}) => {
  const { enqueueSnackbar } = useSnackbar();

  const inviteUrl = invitationService.generateInviteUrl(invitation.token);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      enqueueSnackbar('초대 링크가 클립보드에 복사되었습니다.', { variant: 'success' });
    } catch (error) {
      console.error('Failed to copy link:', error);
      enqueueSnackbar('링크 복사에 실패했습니다.', { variant: 'error' });
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  const getTimeUntilExpiration = () => {
    const now = new Date();
    const expiresAt = new Date(invitation.expiresAt);
    const diffMs = expiresAt.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 0) {
      return '만료됨';
    } else if (diffDays === 1) {
      return '1일';
    } else {
      return `${diffDays}일`;
    }
  };

  const isExpired = new Date(invitation.expiresAt) <= new Date();

  return (
    <Card 
      sx={{ 
        mb: 3, 
        border: '1px solid',
        borderColor: isExpired ? 'error.main' : 'primary.main',
        bgcolor: isExpired ? 'error.light' : 'primary.light',
        '& .MuiCardContent-root': {
          '&:last-child': { pb: 2 }
        }
      }}
    >
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
              <ScheduleIcon />
              You have an invite link created on {formatDate(invitation.createdAt)}
              {!isExpired && (
                <Chip 
                  label={`${getTimeUntilExpiration()} 후 만료`}
                  size="small"
                  color="warning"
                  variant="outlined"
                />
              )}
              {isExpired && (
                <Chip 
                  label="만료됨"
                  size="small"
                  color="error"
                  variant="filled"
                />
              )}
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="링크 복사">
              <IconButton 
                onClick={handleCopyLink}
                size="small"
                color="primary"
              >
                <CopyIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="초대 링크 삭제">
              <IconButton 
                onClick={onDelete}
                size="small"
                color="error"
              >
                <DeleteIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        <TextField
          value={inviteUrl}
          fullWidth
          multiline
          rows={2}
          variant="outlined"
          size="small"
          InputProps={{
            readOnly: true,
            sx: { 
              fontFamily: 'monospace',
              fontSize: '0.75rem',
              bgcolor: 'background.paper'
            }
          }}
          sx={{ mb: 2 }}
        />

        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            onClick={onUpdate}
            variant="contained"
            startIcon={<EditIcon />}
            size="small"
          >
            업데이트 초대 링크
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};

export default InvitationStatusCard;
