import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Button, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions,
  FormControlLabel, Checkbox, TextField, Drawer,
  useTheme, alpha,
} from '@mui/material';
import {
  Close as CloseIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { ArgusSavedQuery } from '@/services/argusService';

const DEFAULT_COLUMNS = ['timestamp', 'severity', 'message'];
const AVAILABLE_COLUMNS = [
  { key: 'timestamp', label: 'TIMESTAMP' },
  { key: 'severity', label: 'SEVERITY' },
  { key: 'message', label: 'MESSAGE' },
  { key: 'service', label: 'SERVICE' },
  { key: 'environment', label: 'ENVIRONMENT' },
  { key: 'logger_name', label: 'LOGGER' },
  { key: 'trace_id', label: 'TRACE ID' },
  { key: 'release', label: 'RELEASE' },
];

/* ─── Edit Table Dialog ─── */

export interface EditTableDialogProps {
  open: boolean;
  tempColumns: string[];
  onClose: () => void;
  onToggleColumn: (col: string) => void;
  onReset: () => void;
  onSave: () => void;
}

export const EditTableDialog: React.FC<EditTableDialogProps> = ({
  open, tempColumns, onClose, onToggleColumn, onReset, onSave,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth
      PaperProps={{ sx: { borderRadius: 2.5 } }}>
      <DialogTitle sx={{ fontWeight: 700, fontSize: '0.95rem', pb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {t('argus.logs.editTable', 'Edit Table')}
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>
      <DialogContent>
        <Typography variant="caption" color="text.disabled" sx={{ mb: 1.5, display: 'block' }}>
          {t('argus.logs.editTableDesc', 'Select columns to display in the log table.')}
        </Typography>
        {AVAILABLE_COLUMNS.map(col => (
          <FormControlLabel key={col.key}
            control={<Checkbox size="small" checked={tempColumns.includes(col.key)} onChange={() => onToggleColumn(col.key)}
              sx={{ '&.Mui-checked': { color: theme.palette.primary.main } }} />}
            label={<Typography sx={{ fontSize: '0.82rem' }}>{col.label}</Typography>}
            sx={{ display: 'flex', mb: 0.3 }}
          />
        ))}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onReset} sx={{ textTransform: 'none', fontSize: '0.78rem' }}>
          {t('argus.logs.resetColumns', 'Reset')}
        </Button>
        <Button variant="contained" onClick={onSave} disabled={tempColumns.length === 0}
          sx={{ textTransform: 'none', fontWeight: 700 }}>
          {t('common.save', 'Save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

/* ─── Save Query Dialog ─── */

export interface SaveQueryDialogProps {
  open: boolean;
  initialName: string;
  onClose: () => void;
  onSave: (name: string) => void;
}

export const SaveQueryDialog: React.FC<SaveQueryDialogProps> = ({
  open, initialName = '', onClose, onSave,
}) => {
  const { t } = useTranslation();
  const [localName, setLocalName] = useState(initialName ?? '');

  useEffect(() => {
    if (open) {
      setLocalName(initialName ?? '');
    }
  }, [open, initialName]);

  const safeName = localName ?? '';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth
      PaperProps={{ sx: { borderRadius: 2.5 } }}>
      <DialogTitle sx={{ fontWeight: 700, fontSize: '0.95rem', pb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {t('argus.logs.saveQuery', 'Save Log Query')}
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>
      <DialogContent>
        <TextField
          fullWidth size="small" autoFocus
          label={t('argus.discover.queryName', 'Query Name')}
          value={safeName}
          onChange={(e) => setLocalName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && safeName.trim()) onSave(safeName); }}
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>
          {t('common.cancel', 'Cancel')}
        </Button>
        <Button variant="contained" onClick={() => onSave(safeName)} disabled={!safeName.trim()}
          sx={{ textTransform: 'none', fontWeight: 700 }}>
          {t('common.save', 'Save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

/* ─── Saved Queries Drawer ─── */

export interface SavedQueriesDrawerProps {
  open: boolean;
  queries: ArgusSavedQuery[];
  isDark: boolean;
  onClose: () => void;
  onLoad: (query: ArgusSavedQuery) => void;
  onDelete: (id: number) => void;
}

export const SavedQueriesDrawer: React.FC<SavedQueriesDrawerProps> = ({
  open, queries, isDark, onClose, onLoad, onDelete,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <Drawer anchor="right" open={open} onClose={onClose}
      PaperProps={{ sx: { width: 340, p: 2 } }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
          {t('argus.logs.savedQueries', 'Saved Log Queries')}
        </Typography>
        <IconButton size="small" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
      {queries.length === 0 ? (
        <Typography sx={{ color: 'text.disabled', fontSize: '0.82rem', textAlign: 'center', py: 4 }}>
          {t('argus.logs.noSavedQueries', 'No saved log queries yet')}
        </Typography>
      ) : (
        queries.map((sq) => (
          <Paper key={sq.id} elevation={0} sx={{
            p: 1.5, mb: 1, borderRadius: 2,
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
            cursor: 'pointer',
            '&:hover': { borderColor: theme.palette.primary.main, bgcolor: alpha(theme.palette.primary.main, 0.02) },
            display: 'flex', alignItems: 'center', gap: 1,
          }}>
            <Box sx={{ flex: 1, minWidth: 0 }} onClick={() => onLoad(sq)}>
              <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {sq.name}
              </Typography>
              <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled' }}>
                {sq.created_by} · {new Date(sq.created_at).toLocaleDateString()}
              </Typography>
            </Box>
            <IconButton size="small" onClick={() => onDelete(sq.id)}
              sx={{ color: 'text.disabled', '&:hover': { color: 'error.main' } }}>
              <DeleteIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Paper>
        ))
      )}
    </Drawer>
  );
};
