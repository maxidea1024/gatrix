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
  Tooltip,
  Drawer,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Paper
} from '@mui/material';
import {
  ContentCopy as CopyIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Schedule as ScheduleIcon,
  Close as CloseIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const [deleteDrawerOpen, setDeleteDrawerOpen] = useState(false);

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
    setDeleteDrawerOpen(true);
  };

  const handleDeleteConfirm = () => {
    setDeleteDrawerOpen(false);
    onDelete();
  };

  const handleDeleteCancel = () => {
    setDeleteDrawerOpen(false);
  };

  return (
    <>
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

    {/* Delete Confirmation Drawer */}
    <Drawer
      anchor="right"
      open={deleteDrawerOpen}
      onClose={handleDeleteCancel}
      sx={{
        zIndex: 1301,
        '& .MuiDrawer-paper': {
          width: { xs: '100%', sm: 400 },
          maxWidth: '100vw',
        }
      }}
    >
      {/* Header */}
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        p: 2,
        borderBottom: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <WarningIcon color="error" />
          <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
            {t('admin.invitations.deleteConfirmTitle')}
          </Typography>
        </Box>
        <IconButton
          onClick={handleDeleteCancel}
          size="small"
          sx={{
            '&:hover': {
              backgroundColor: 'action.hover'
            }
          }}
        >
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
        <Typography variant="body1" sx={{ mb: 3, color: 'text.primary' }}>
          {t('admin.invitations.deleteConfirmMessage')}
        </Typography>

        <Alert
          severity="warning"
          sx={{
            mb: 3,
            '& .MuiAlert-message': {
              fontSize: '0.875rem'
            }
          }}
        >
          {t('admin.invitations.deleteConfirmWarning')}
        </Alert>

        {/* Invitation Details */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 'medium' }}>
            {t('admin.invitations.invitationDetails')}
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableBody>
                <TableRow>
                  <TableCell component="th" scope="row" sx={{ fontWeight: 'medium', width: '40%' }}>
                    {t('admin.invitations.email')}
                  </TableCell>
                  <TableCell>{invitation.email}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell component="th" scope="row" sx={{ fontWeight: 'medium' }}>
                    {t('admin.invitations.createdAt')}
                  </TableCell>
                  <TableCell>{formatDate(invitation.createdAt)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell component="th" scope="row" sx={{ fontWeight: 'medium' }}>
                    {t('admin.invitations.expiresAt')}
                  </TableCell>
                  <TableCell>
                    {invitation.expiresAt ? formatDate(invitation.expiresAt) : t('admin.invitations.noExpiration')}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell component="th" scope="row" sx={{ fontWeight: 'medium' }}>
                    {t('admin.invitations.status')}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={isExpired ? t('admin.invitations.expired') : t('admin.invitations.active')}
                      color={isExpired ? 'error' : 'success'}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      </Box>

      {/* Actions */}
      <Box sx={{
        p: 2,
        borderTop: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        display: 'flex',
        gap: 1,
        justifyContent: 'flex-end'
      }}>
        <Button
          onClick={handleDeleteCancel}
          variant="outlined"
        >
          {t('admin.invitations.cancelButton')}
        </Button>
        <Button
          onClick={handleDeleteConfirm}
          variant="contained"
          color="error"
          startIcon={<DeleteIcon />}
        >
          {t('admin.invitations.deleteConfirmButton')}
        </Button>
      </Box>
    </Drawer>
    </>
  );
};

export default InvitationStatusCard;
