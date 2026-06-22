import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  IconButton,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme,
  alpha,
} from '@mui/material';
import { Close as CloseIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { ArgusSavedQuery } from '@/services/argusService';
import ResizableDrawer from '@/components/common/ResizableDrawer';

// ─── Save Query Dialog ───

interface SaveQueryDialogProps {
  open: boolean;
  onClose: () => void;
  saveName: string;
  onNameChange: (name: string) => void;
  onSave: () => void;
}

export const SaveQueryDialog: React.FC<SaveQueryDialogProps> = ({
  open,
  onClose,
  saveName,
  onNameChange,
  onSave,
}) => {
  const { t } = useTranslation();
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
          pb: 1,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        {t('argus.traces.saveQuery', 'Save Trace Query')}
        <IconButton size="small" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <TextField
          fullWidth
          size="small"
          autoFocus
          label={t('argus.discover.queryName', 'Query Name')}
          value={saveName}
          onChange={(e) => onNameChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSave();
          }}
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>
          {t('common.cancel', 'Cancel')}
        </Button>
        <Button
          variant="contained"
          onClick={onSave}
          disabled={!saveName.trim()}
          sx={{ textTransform: 'none', fontWeight: 700 }}
        >
          {t('common.save', 'Save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ─── Saved Queries Panel ───

interface SavedQueriesPanelProps {
  open: boolean;
  onClose: () => void;
  savedQueries: ArgusSavedQuery[];
  onLoad: (query: ArgusSavedQuery) => void;
  onDelete: (id: number) => void;
}

export const SavedQueriesPanel: React.FC<SavedQueriesPanelProps> = ({
  open,
  onClose,
  savedQueries,
  onLoad,
  onDelete,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';

  return (
    <ResizableDrawer
      open={open}
      onClose={onClose}
      title={t('argus.traces.savedQueries', 'Saved Trace Queries')}
      storageKey="argus-saved-queries-drawer-width"
      defaultWidth={380}
      minWidth={300}
      maxWidth={600}
    >
      <Box sx={{ p: 2, overflow: 'auto', flex: 1 }}>
        {savedQueries.length === 0 ? (
          <Typography
            sx={{
              color: 'text.disabled',
              fontSize: '0.82rem',
              textAlign: 'center',
              py: 4,
            }}
          >
            {t('argus.traces.noSavedQueries', 'No saved trace queries yet')}
          </Typography>
        ) : (
          savedQueries.map((sq) => (
            <Paper
              key={sq.id}
              elevation={0}
              sx={{
                p: 1.5,
                mb: 1,
                borderRadius: 2,
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
                cursor: 'pointer',
                '&:hover': {
                  borderColor: theme.palette.primary.main,
                  bgcolor: alpha(theme.palette.primary.main, 0.02),
                },
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }} onClick={() => onLoad(sq)}>
                <Typography
                  sx={{
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {sq.name}
                </Typography>
                <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled' }}>
                  {sq.created_by} ·{' '}
                  {new Date(sq.created_at).toLocaleDateString()}
                </Typography>
              </Box>
              <IconButton
                size="small"
                onClick={() => onDelete(sq.id)}
                sx={{
                  color: 'text.disabled',
                  '&:hover': { color: 'error.main' },
                }}
              >
                <DeleteIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Paper>
          ))
        )}
      </Box>
    </ResizableDrawer>
  );
};
