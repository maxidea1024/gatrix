import React from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Alert,
  Paper,
  Divider
} from '@mui/material';
import {
  ContentCopy as CopyIcon,
  CheckCircle as CheckIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
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

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(invitationData.inviteUrl);
      enqueueSnackbar('초대 링크가 클립보드에 복사되었습니다.', { variant: 'success' });
    } catch (error) {
      console.error('Failed to copy link:', error);
      enqueueSnackbar('링크 복사에 실패했습니다.', { variant: 'error' });
    }
  };

  const formatExpirationDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Alert severity="success" icon={<CheckIcon />}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          초대 링크가 성공적으로 생성되었습니다!
        </Typography>
      </Alert>

      <Paper sx={{ p: 3, bgcolor: 'grey.50' }}>
        <Typography variant="body1" sx={{ mb: 2, lineHeight: 1.6 }}>
          Using this link, new team members can now sign-up to Gatrix.
        </Typography>
        <Typography variant="body1" sx={{ mb: 3, lineHeight: 1.6 }}>
          Please provide them with the following link to get started. 
          This will allow them to set up their password and get started with their Gatrix account.
        </Typography>

        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            초대 링크:
          </Typography>
          <TextField
            value={invitationData.inviteUrl}
            fullWidth
            multiline
            rows={2}
            variant="outlined"
            InputProps={{
              readOnly: true,
              sx: { 
                fontFamily: 'monospace',
                fontSize: '0.875rem',
                bgcolor: 'background.paper'
              }
            }}
          />
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          유효기간: {formatExpirationDate(invitationData.invitation.expiresAt)}
        </Typography>

        <Button
          onClick={handleCopyLink}
          variant="contained"
          startIcon={<CopyIcon />}
          fullWidth
          sx={{ mb: 2 }}
        >
          링크 복사
        </Button>
      </Paper>

      <Divider />

      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          onClick={onClose}
          variant="outlined"
          startIcon={<CloseIcon />}
        >
          닫기
        </Button>
      </Box>
    </Box>
  );
};

export default InvitationSuccess;
