import React from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Alert,
  Paper,
  Divider,
  Chip,
  Stack,
} from '@mui/material';
import {
  ContentCopy as CopyIcon,
  CheckCircle as CheckIcon,
  Close as CloseIcon,
  Schedule as ScheduleIcon,
  Email as EmailIcon,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { copyToClipboardWithNotification } from '../../utils/clipboard';
import { InvitationResponse } from '../../types/invitation';

interface InvitationSuccessProps {
  invitationData: InvitationResponse;
  onClose: () => void;
}

const InvitationSuccess: React.FC<InvitationSuccessProps> = ({
  invitationData,
  onClose,
}) => {
  const { enqueueSnackbar } = useSnackbar();
  const { t } = useTranslation();

  const handleCopyLink = () => {
    const inviteUrl = invitationData?.inviteUrl || '';
    if (!inviteUrl) {
      enqueueSnackbar(t('invitations.noInviteLink'), { variant: 'error' });
      return;
    }
    copyToClipboardWithNotification(
      inviteUrl,
      () =>
        enqueueSnackbar(t('common.copiedToClipboard'), { variant: 'success' }),
      () => enqueueSnackbar(t('common.copyFailed'), { variant: 'error' })
    );
  };

  const formatExpirationDate = (dateString: string) => {
    try {
      const date = new Date(dateString);

      // Check if the date is valid
      if (isNaN(date.getTime())) {
        return t('invitations.invalidDate');
      }

      const now = new Date();
      const diffTime = date.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 0) {
        return t('invitations.expired');
      } else if (diffDays === 1) {
        return t('invitations.expiresInOneDay');
      } else {
        return t('invitations.expiresInDays', { days: diffDays });
      }
    } catch (error) {
      console.error('Date formatting error:', error);
      return t('invitations.dateError');
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Success notification */}
      <Alert
        severity="success"
        icon={<CheckIcon />}
        sx={{
          bgcolor: 'success.50',
          color: 'success.800',
          border: '1px solid',
          borderColor: 'success.200',
          '& .MuiAlert-icon': {
            color: 'success.600',
          },
        }}
      >
        <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
          {t('invitations.successTitle')}
        </Typography>
        <Typography variant="body2">
          {t('invitations.successDescription')}
        </Typography>
      </Alert>

      {/* Invitation information card */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
        }}
      >
        {/* Invited email */}
        {invitationData?.invitation?.email && (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
            <EmailIcon color="primary" fontSize="small" />
            <Typography variant="body2" color="text.secondary">
              {t('invitations.invitedEmail')}:
            </Typography>
            <Chip
              label={invitationData.invitation.email}
              size="small"
              color="primary"
              variant="outlined"
            />
          </Stack>
        )}

        {/* Expiration information */}
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 3 }}>
          <ScheduleIcon color="warning" fontSize="small" />
          <Typography variant="body2" color="text.secondary">
            {t('invitations.expirationLabel')}:
          </Typography>
          <Chip
            label={
              invitationData?.invitation?.expiresAt
                ? formatExpirationDate(invitationData.invitation.expiresAt)
                : t('invitations.noExpiration')
            }
            size="small"
            color="warning"
            variant="outlined"
          />
        </Stack>

        {/* Invitation link */}
        <Box sx={{ mb: 3 }}>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mb: 1, fontWeight: 500 }}
          >
            {t('invitations.inviteLink')}:
          </Typography>
          <TextField
            value={invitationData?.inviteUrl || ''}
            fullWidth
            multiline
            rows={3}
            variant="outlined"
            InputProps={{
              readOnly: true,
              sx: {
                fontFamily: 'monospace',
                fontSize: '0.875rem',
                bgcolor: 'grey.50',
                borderRadius: 1,
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'grey.300',
                },
              },
            }}
          />
        </Box>

        {/* Action buttons */}
        <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
          <Button
            onClick={handleCopyLink}
            variant="contained"
            startIcon={<CopyIcon />}
            sx={{
              flex: 1,
              bgcolor: 'primary.main',
              '&:hover': {
                bgcolor: 'primary.dark',
              },
            }}
          >
            {t('invitations.copyLink')}
          </Button>

          <Button
            onClick={onClose}
            variant="outlined"
            startIcon={<CloseIcon />}
            sx={{
              flex: 1,
              borderColor: 'grey.300',
              color: 'text.secondary',
              '&:hover': {
                borderColor: 'grey.400',
                bgcolor: 'grey.50',
              },
            }}
          >
            {t('common.close')}
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
};

export default InvitationSuccess;
