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
  Stack
} from '@mui/material';
import {
  ContentCopy as CopyIcon,
  CheckCircle as CheckIcon,
  Close as CloseIcon,
  Schedule as ScheduleIcon,
  Email as EmailIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { InvitationResponse } from '../../types/invitation';

interface InvitationSuccessProps {
  invitationData: InvitationResponse;
  onClose: () => void;
}

const InvitationSuccess: React.FC<InvitationSuccessProps> = ({
  invitationData,
  onClose
}) => {
  const { enqueueSnackbar } = useSnackbar();
  const { t } = useTranslation();

  const handleCopyLink = async () => {
    try {
      const inviteUrl = invitationData?.inviteUrl || '';
      if (!inviteUrl) {
        enqueueSnackbar(t('admin.invitations.noInviteLink'), { variant: 'error' });
        return;
      }
      await navigator.clipboard.writeText(inviteUrl);
      enqueueSnackbar(t('admin.invitations.linkCopied'), { variant: 'success' });
    } catch (error) {
      console.error('Failed to copy link:', error);
      enqueueSnackbar(t('admin.invitations.copyFailed'), { variant: 'error' });
    }
  };

  const formatExpirationDate = (dateString: string) => {
    try {
      const date = new Date(dateString);

      // 유효한 날짜인지 확인
      if (isNaN(date.getTime())) {
        return t('admin.invitations.invalidDate');
      }

      const now = new Date();
      const diffTime = date.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 0) {
        return t('admin.invitations.expired');
      } else if (diffDays === 1) {
        return t('admin.invitations.expiresInOneDay');
      } else {
        return t('admin.invitations.expiresInDays', { days: diffDays });
      }
    } catch (error) {
      console.error('Date formatting error:', error);
      return t('admin.invitations.dateError');
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* 성공 알림 */}
      <Alert
        severity="success"
        icon={<CheckIcon />}
        sx={{
          bgcolor: 'success.50',
          color: 'success.800',
          border: '1px solid',
          borderColor: 'success.200',
          '& .MuiAlert-icon': {
            color: 'success.600'
          }
        }}
      >
        <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
          {t('admin.invitations.successTitle')}
        </Typography>
        <Typography variant="body2">
          {t('admin.invitations.successDescription')}
        </Typography>
      </Alert>

      {/* 초대 정보 카드 */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2
        }}
      >
        {/* 초대 대상 이메일 */}
        {invitationData?.invitation?.email && (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
            <EmailIcon color="primary" fontSize="small" />
            <Typography variant="body2" color="text.secondary">
              {t('admin.invitations.invitedEmail')}:
            </Typography>
            <Chip
              label={invitationData.invitation.email}
              size="small"
              color="primary"
              variant="outlined"
            />
          </Stack>
        )}

        {/* 만료 정보 */}
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 3 }}>
          <ScheduleIcon color="warning" fontSize="small" />
          <Typography variant="body2" color="text.secondary">
            {t('admin.invitations.expirationLabel')}:
          </Typography>
          <Chip
            label={invitationData?.invitation?.expiresAt ? formatExpirationDate(invitationData.invitation.expiresAt) : t('admin.invitations.noExpiration')}
            size="small"
            color="warning"
            variant="outlined"
          />
        </Stack>

        {/* 초대 링크 */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontWeight: 500 }}>
            {t('admin.invitations.inviteLink')}:
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
                  borderColor: 'grey.300'
                }
              }
            }}
          />
        </Box>

        {/* 액션 버튼들 */}
        <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
          <Button
            onClick={handleCopyLink}
            variant="contained"
            startIcon={<CopyIcon />}
            sx={{
              flex: 1,
              bgcolor: 'primary.main',
              '&:hover': {
                bgcolor: 'primary.dark'
              }
            }}
          >
            {t('admin.invitations.copyLink')}
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
                bgcolor: 'grey.50'
              }
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
