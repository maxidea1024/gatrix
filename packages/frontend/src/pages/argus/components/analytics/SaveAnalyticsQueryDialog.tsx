import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  IconButton,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

export interface SaveAnalyticsQueryDialogProps {
  open: boolean;
  onClose: () => void;
  /** 'create' = first save, 'save_as' = copy with new name */
  mode: 'create' | 'save_as';
  /** Pre-filled name (for save_as) */
  defaultName?: string;
  /** Pre-filled description */
  defaultDescription?: string;
  /** Called with name/description on confirm */
  onSave: (name: string, description: string) => Promise<void>;
  saving?: boolean;
}

const SaveAnalyticsQueryDialog: React.FC<SaveAnalyticsQueryDialogProps> = ({
  open,
  onClose,
  mode,
  defaultName = '',
  defaultDescription = '',
  onSave,
  saving = false,
}) => {
  const { t } = useTranslation();
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState(defaultDescription);

  useEffect(() => {
    if (open) {
      setName(
        mode === 'save_as' && defaultName
          ? `${defaultName} (copy)`
          : defaultName
      );
      setDescription(defaultDescription);
    }
  }, [open, mode, defaultName, defaultDescription]);

  const handleSave = async () => {
    if (!name.trim()) return;
    await onSave(name.trim(), description.trim());
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{ sx: { borderRadius: 2 } }}
    >
      <DialogTitle
        sx={{
          fontWeight: 700,
          fontSize: '0.95rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          pb: 1,
        }}
      >
        {mode === 'save_as'
          ? t('argus.analytics.saveAs', 'Save As')
          : t('argus.analytics.saveQuery', 'Save Query')}
        <IconButton size="small" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          size="small"
          label={t('argus.analytics.queryName', 'Query Name')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          sx={{ mt: 1, mb: 2 }}
          slotProps={{
            htmlInput: { maxLength: 100 },
          }}
        />
        <TextField
          fullWidth
          size="small"
          multiline
          rows={2}
          label={t(
            'argus.analytics.queryDescription',
            'Description (optional)'
          )}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          slotProps={{
            htmlInput: { maxLength: 500 },
          }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          onClick={onClose}
          sx={{ textTransform: 'none', fontSize: '0.82rem' }}
        >
          {t('common.cancel', 'Cancel')}
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={!name.trim() || saving}
          sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.82rem' }}
        >
          {saving
            ? '...'
            : mode === 'save_as'
              ? t('argus.analytics.saveAs', 'Save As')
              : t('argus.analytics.save', 'Save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SaveAnalyticsQueryDialog;
