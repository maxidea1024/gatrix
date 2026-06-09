import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import { VolumeOff as MuteIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { ArgusAlertRule } from '@/services/argusService';

// ─── Delete Confirmation Dialog ───

interface DeleteConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({
  open,
  onClose,
  onConfirm,
}) => {
  const { t } = useTranslation();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      PaperProps={{ sx: { borderRadius: 2 } }}
    >
      <DialogTitle sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
        {t('argus.alerts.confirmDelete')}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary">
          {t('argus.alerts.confirmDeleteDesc')}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>
          {t('common.cancel')}
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={onConfirm}
          sx={{ textTransform: 'none' }}
        >
          {t('common.delete')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ─── Mute Dialog ───

interface MuteDialogProps {
  open: boolean;
  ruleName: string;
  onClose: () => void;
  onConfirm: (durationSeconds: number) => void;
}

export const MuteDialog: React.FC<MuteDialogProps> = ({
  open,
  ruleName,
  onClose,
  onConfirm,
}) => {
  const { t } = useTranslation();
  const [muteDuration, setMuteDuration] = useState(3600);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      PaperProps={{ sx: { borderRadius: 2 } }}
    >
      <DialogTitle
        sx={{
          fontWeight: 700,
          fontSize: '0.95rem',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <MuteIcon sx={{ fontSize: 20 }} />
        {t('argus.alerts.muteTitle')}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('argus.alerts.muteDesc', { name: ruleName })}
        </Typography>
        <FormControl fullWidth size="small">
          <InputLabel sx={{ fontSize: '0.78rem' }}>
            {t('argus.alerts.muteDuration')}
          </InputLabel>
          <Select
            value={muteDuration}
            onChange={(e) => setMuteDuration(Number(e.target.value))}
            label={t('argus.alerts.muteDuration')}
            sx={{ fontSize: '0.82rem' }}
          >
            <MenuItem value={1800} sx={{ fontSize: '0.82rem' }}>
              {t('argus.alerts.30min')}
            </MenuItem>
            <MenuItem value={3600} sx={{ fontSize: '0.82rem' }}>
              {t('argus.alerts.1hour')}
            </MenuItem>
            <MenuItem value={14400} sx={{ fontSize: '0.82rem' }}>
              {t('argus.alerts.4hours')}
            </MenuItem>
            <MenuItem value={86400} sx={{ fontSize: '0.82rem' }}>
              {t('argus.alerts.1day')}
            </MenuItem>
            <MenuItem value={604800} sx={{ fontSize: '0.82rem' }}>
              {t('argus.alerts.1week')}
            </MenuItem>
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>
          {t('common.cancel')}
        </Button>
        <Button
          variant="contained"
          onClick={() => onConfirm(muteDuration)}
          sx={{ textTransform: 'none', fontWeight: 700 }}
        >
          {t('argus.alerts.muteConfirm')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
