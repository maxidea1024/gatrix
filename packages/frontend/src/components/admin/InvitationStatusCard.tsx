import React, { useState } from 'react';
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
import { useTranslation } from 'react-i18next';
import { Invitation } from '../../types/invitation';
import { invitationService } from '../../services/invitationService';
import ConfirmDeleteDialog from '../common/ConfirmDeleteDialog';

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
  const { t } = useTranslation();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

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
    if (!dateString) return t('admin.invitations.invalidDate');

    const date = new Date(dateString);

    // 유효한 날짜인지 확인
    if (isNaN(date.getTime())) {
      return t('admin.invitations.invalidDate');
    }

    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  const getTimeUntilExpiration = () => {
    if (!invitation.expiresAt) return t('admin.invitations.noExpiration');

    const now = new Date();
    const expiresAt = new Date(invitation.expiresAt);

    // 유효한 날짜인지 확인
    if (isNaN(expiresAt.getTime())) {
      return t('admin.invitations.invalidDate');
    }

    const diffMs = expiresAt.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      return t('admin.invitations.expired');
    } else if (diffDays === 1) {
      return t('admin.invitations.expiresInOneDay');
    } else {
      return t('admin.invitations.expiresInDays', { days: diffDays });
    }
  };

  const isExpired = invitation.expiresAt ? new Date(invitation.expiresAt) <= new Date() : false;

  const handleDeleteClick = () => {
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    setDeleteDialogOpen(false);
    onDelete();
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
  };

  return (
    <>
      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title={t('admin.invitations.deleteConfirmTitle')}
        message={t('admin.invitations.deleteConfirmMessage')}
        warning={t('admin.invitations.deleteConfirmWarning')}
        confirmButtonText={t('admin.invitations.deleteConfirmButton')}
        cancelButtonText={t('admin.invitations.cancelButton')}
      />
    <Card
      sx={{
        mb: 1.5,
        border: '1px solid',
        borderColor: isExpired ? 'error.main' : 'info.main',
        bgcolor: isExpired ? 'error.50' : 'info.50',
        borderRadius: 1,
        '& .MuiCardContent-root': {
          '&:last-child': { pb: 1 }
        }
      }}
    >
      <CardContent sx={{ py: 1, px: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0 }}>
            <ScheduleIcon fontSize="small" color="action" />
            <Typography
              variant="body2"
              sx={{
                fontWeight: 500,
                color: 'text.primary',
                whiteSpace: 'nowrap'
              }}
            >
              {t('admin.invitations.inviteLinkCreated', { date: formatDate(invitation.createdAt) })}
            </Typography>
            {!isExpired && (
              <Chip
                label={getTimeUntilExpiration()}
                size="small"
                color="warning"
                variant="outlined"
                sx={{
                  height: 20,
                  fontSize: '0.7rem',
                  '& .MuiChip-label': { px: 1 }
                }}
              />
            )}
            {isExpired && (
              <Chip
                label={t('admin.invitations.expired')}
                size="small"
                color="error"
                variant="filled"
                sx={{
                  height: 20,
                  fontSize: '0.7rem',
                  '& .MuiChip-label': { px: 1 }
                }}
              />
            )}
          </Box>

          <Box sx={{ display: 'flex', gap: 0.5, ml: 1 }}>
            <Tooltip title={t('admin.invitations.copyLink')}>
              <IconButton
                onClick={handleCopyLink}
                size="small"
                color="primary"
                sx={{ p: 0.5 }}
              >
                <CopyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={t('admin.invitations.updateInviteLink')}>
              <IconButton
                onClick={onUpdate}
                size="small"
                color="info"
                sx={{ p: 0.5 }}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={t('admin.invitations.delete')}>
              <IconButton
                onClick={handleDeleteClick}
                size="small"
                color="error"
                sx={{ p: 0.5 }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </CardContent>
    </Card>
    </>
  );
};

export default InvitationStatusCard;
