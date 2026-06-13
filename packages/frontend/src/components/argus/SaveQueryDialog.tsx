import React, { useMemo } from 'react';
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  TextField,
  Typography,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Close as CloseIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { ArgusSavedQuery } from '@/services/argusService';

export interface SaveQueryDialogProps {
  open: boolean;
  onClose: () => void;
  name: string;
  onNameChange: (name: string) => void;
  /** Called with (name, existingQueryId | null). existingQueryId is set when overwriting. */
  onSave: (name: string, existingQueryId: number | null) => void;
  mode: 'new' | 'saveAs';
  savedQueries: ArgusSavedQuery[];
  /** Optional: exclude this query ID from duplicate checking (e.g. the current query itself) */
  currentQueryId?: number | null;
}

const SaveQueryDialog: React.FC<SaveQueryDialogProps> = ({
  open,
  onClose,
  name,
  onNameChange,
  onSave,
  mode,
  savedQueries,
  currentQueryId,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();

  const duplicateQuery = useMemo(() => {
    if (!name.trim()) return null;
    return (
      savedQueries.find(
        (q) =>
          q.name.toLowerCase() === name.trim().toLowerCase() &&
          q.id !== currentQueryId
      ) ?? null
    );
  }, [name, savedQueries, currentQueryId]);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave(name.trim(), duplicateQuery?.id ?? null);
  };

  const title =
    mode === 'new'
      ? t('argus.common.saveQuery', 'Save Query')
      : t('argus.common.saveAsQuery', 'Save As...');

  const saveLabel = duplicateQuery
    ? t('argus.common.overwrite', 'Overwrite')
    : t('common.save', 'Save');

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{ sx: { borderRadius: 2.5 } }}
    >
      <DialogTitle
        sx={{
          fontWeight: 700,
          fontSize: '0.95rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        {title}
        <IconButton size="small" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <TextField
          fullWidth
          size="small"
          autoFocus
          label={t('argus.common.queryName', 'Query Name')}
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
          }}
          sx={{ mt: 1 }}
        />
        {duplicateQuery && (
          <Typography
            variant="caption"
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              mt: 1,
              color: theme.palette.warning.main,
            }}
          >
            <WarningIcon sx={{ fontSize: 14 }} />
            {t(
              'argus.common.overwriteWarning',
              'A query with this name already exists. Saving will overwrite it.'
            )}
          </Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>
          {t('common.cancel', 'Cancel')}
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={!name.trim()}
          color={duplicateQuery ? 'warning' : 'primary'}
          sx={{ textTransform: 'none', fontWeight: 700 }}
        >
          {saveLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SaveQueryDialog;
