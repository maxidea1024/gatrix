import React, { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Alert,
  Divider
} from '@mui/material';
import {
  PersonAdd as PersonAddIcon,
  Cancel as CancelIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { 
  CreateInvitationRequest, 
  InvitationDuration, 
  InvitationDurationLabels 
} from '../../types/invitation';

interface InvitationFormProps {
  onSubmit: (data: CreateInvitationRequest) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
  isDrawer?: boolean;
}

const InvitationForm: React.FC<InvitationFormProps> = ({
  onSubmit,
  onCancel,
  loading = false,
  isDrawer = false
}) => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [expirationHours, setExpirationHours] = useState<number>(InvitationDuration.HOURS_48);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const data: CreateInvitationRequest = {
      expirationHours,
      ...(email.trim() && { email: email.trim() })
    };

    await onSubmit(data);
  };

  if (isDrawer) {
    return (
      <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Content - 스크롤 가능한 영역 */}
        <Box sx={{
          flex: 1,
          overflow: 'auto',
          p: 3,
          display: 'flex',
          flexDirection: 'column',
          gap: 3
        }}>
          <Alert severity="info">
            <Typography variant="body2">
              {t('invitations.info')}
            </Typography>
          </Alert>

          <TextField
            label={`${t('invitations.email')} (${t('common.optional')})`}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            fullWidth
            helperText={t('invitations.emailOptionalHelp')}
            variant="outlined"
            autoFocus
          />

          <FormControl fullWidth>
            <InputLabel>{t('invitations.expirationLabel')}</InputLabel>
            <Select
              value={expirationHours}
              label={t('invitations.expirationLabel')}
              onChange={(e) => setExpirationHours(e.target.value as number)}
              MenuProps={{
                sx: { zIndex: 2000 },
                anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
                transformOrigin: { vertical: 'top', horizontal: 'left' },
              }}
            >
              {Object.entries(InvitationDurationLabels).map(([value]) => (
                <MenuItem key={value} value={Number(value)}>
                  {Number(value) === InvitationDuration.HOURS_48 && t('invitations.duration.48h')}
                  {Number(value) === InvitationDuration.WEEK && t('invitations.duration.1w')}
                  {Number(value) === InvitationDuration.MONTH && t('invitations.duration.1m')}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* 추가 공간을 위한 여백 */}
          <Box sx={{ minHeight: '200px' }} />
        </Box>

        {/* Footer */}
        <Box sx={{
          borderTop: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          p: 2,
          display: 'flex',
          gap: 1,
          justifyContent: 'flex-end'
        }}>
          <Button
            onClick={onCancel}
            startIcon={<CancelIcon />}
            variant="outlined"
            disabled={loading}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            variant="contained"
            startIcon={<PersonAddIcon />}
            disabled={loading}
          >
            {t('invitations.create')}
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Alert severity="info" sx={{ mb: 2 }}>
        <Typography variant="body2">
          {t('invitations.info')}
        </Typography>
      </Alert>

      <TextField
        label={`${t('invitations.email')} (${t('common.optional')})`}
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        fullWidth
        helperText={t('invitations.emailOptionalHelp')}
        variant="outlined"
        autoFocus
      />

      <FormControl fullWidth>
        <InputLabel>{t('invitations.expirationLabel')}</InputLabel>
        <Select
          value={expirationHours}
          label={t('invitations.expirationLabel')}
          onChange={(e) => setExpirationHours(e.target.value as number)}
          MenuProps={{
            sx: { zIndex: 2000 },
            anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
            transformOrigin: { vertical: 'top', horizontal: 'left' },
          }}
        >
          {Object.entries(InvitationDurationLabels).map(([value]) => (
            <MenuItem key={value} value={Number(value)}>
              {Number(value) === InvitationDuration.HOURS_48 && t('invitations.duration.48h')}
              {Number(value) === InvitationDuration.WEEK && t('invitations.duration.1w')}
              {Number(value) === InvitationDuration.MONTH && t('invitations.duration.1m')}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Divider />

      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
        <Button
          onClick={onCancel}
          startIcon={<CancelIcon />}
          variant="outlined"
          disabled={loading}
        >
          {t('common.cancel')}
        </Button>
        <Button
          type="submit"
          variant="contained"
          startIcon={<PersonAddIcon />}
          disabled={loading}
        >
          {t('invitations.create')}
        </Button>
      </Box>
    </Box>
  );
};

export default InvitationForm;
