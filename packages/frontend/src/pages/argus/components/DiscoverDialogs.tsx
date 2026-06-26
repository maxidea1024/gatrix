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
  Drawer,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Close as CloseIcon,
  Delete as DeleteIcon,
  Bookmark as BookmarkIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { ArgusSavedQuery } from '@/services/argusService';
import { ARGUS_SEMANTIC } from '../argusThemeTokens';

// ─── Save Query Dialog ───

interface DiscoverSaveDialogProps {
  open: boolean;
  onClose: () => void;
  saveName: string;
  onNameChange: (name: string) => void;
  onSave: () => void;
}

export const DiscoverSaveDialog: React.FC<DiscoverSaveDialogProps> = ({
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
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        {t('argus.discover.saveQuery', 'Save Query')}
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
          onClick={onSave}
          variant="contained"
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

interface DiscoverSavedPanelProps {
  open: boolean;
  onClose: () => void;
  savedQueries: ArgusSavedQuery[];
  onLoad: (query: ArgusSavedQuery) => void;
  onDelete: (id: number) => void;
}

export const DiscoverSavedPanel: React.FC<DiscoverSavedPanelProps> = ({
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
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: 340, p: 2.5 } }}
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
        }}
      >
        <Typography
          variant="subtitle1"
          fontWeight={700}
          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
        >
          <BookmarkIcon sx={{ color: theme.palette.primary.main }} />
          {t('argus.discover.savedQueries', 'Saved Queries')}
        </Typography>
        <IconButton size="small" onClick={onClose}>
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>
      {savedQueries.length === 0 ? (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ py: 4, textAlign: 'center' }}
        >
          {t('argus.discover.noSavedQueries', 'No saved queries yet')}
        </Typography>
      ) : (
        savedQueries.map((sq) => (
          <Paper
            key={sq.id}
            elevation={0}
            sx={{
              p: 1.5,
              mb: 1,
              borderRadius: 1.5,
              cursor: 'pointer',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
              transition: 'all 0.15s',
              '&:hover': {
                backgroundColor: alpha(theme.palette.primary.main, 0.04),
                borderColor: alpha(theme.palette.primary.main, 0.2),
              },
            }}
          >
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }} onClick={() => onLoad(sq)}>
                <Typography variant="body2" fontWeight={600} noWrap>
                  {sq.name}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ color: 'text.disabled', fontSize: '0.65rem' }}
                >
                  {(() => {
                    const cfg =
                      typeof sq.query_config === 'string'
                        ? JSON.parse(sq.query_config)
                        : sq.query_config;
                    return (cfg.fields || []).join(', ');
                  })()}
                </Typography>
              </Box>
              <IconButton
                size="small"
                onClick={() => onDelete(sq.id)}
                sx={{
                  color: 'text.disabled',
                  '&:hover': { color: ARGUS_SEMANTIC.negative },
                }}
              >
                <DeleteIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Box>
          </Paper>
        ))
      )}
    </Drawer>
  );
};
