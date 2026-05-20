import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  IconButton,
  TextField,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Check as CheckIcon,
  ErrorOutline as ErrorIcon,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import spreadsheetService from '@/services/spreadsheetService';
import { useAutoSave, AutoSaveStatus } from '@/hooks/useAutoSave';
import SpreadsheetEditorWrapper from '@/components/spreadsheet/SpreadsheetEditorWrapper';

// ==================== Save Status Indicator ====================

const SaveStatusIndicator: React.FC<{ status: AutoSaveStatus }> = ({ status }) => {
  const { t } = useTranslation();

  const config: Record<AutoSaveStatus, { icon: React.ReactNode; text: string; color: string }> = {
    idle: { icon: null, text: '', color: 'text.secondary' },
    pending: { icon: <SaveIcon sx={{ fontSize: 16 }} />, text: t('spreadsheets.unsaved', 'Unsaved changes'), color: 'warning.main' },
    saving: { icon: <CircularProgress size={14} />, text: t('spreadsheets.saving', 'Saving...'), color: 'info.main' },
    saved: { icon: <CheckIcon sx={{ fontSize: 16 }} />, text: t('spreadsheets.saved', 'Saved'), color: 'success.main' },
    error: { icon: <ErrorIcon sx={{ fontSize: 16 }} />, text: t('spreadsheets.saveError', 'Save failed'), color: 'error.main' },
  };

  const { icon, text, color } = config[status];
  if (!text) return null;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color, mr: 1 }}>
      {icon}
      <Typography variant="caption" sx={{ color: 'inherit', whiteSpace: 'nowrap' }}>
        {text}
      </Typography>
    </Box>
  );
};

// ==================== Editor Page ====================

const SpreadsheetEditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  const [loading, setLoading] = useState(true);
  const [initialData, setInitialData] = useState<string | null>(null);
  const [title, setTitle] = useState('Untitled Spreadsheet');
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');

  // Ref to get current snapshot from Univer
  const getSnapshotRef = useRef<(() => string | null) | null>(null);

  // Auto-save
  const { status: saveStatus, markDirty, saveNow } = useAutoSave({
    delay: 2000,
    onSave: async () => {
      if (!id || !getSnapshotRef.current) return;
      const snapshot = getSnapshotRef.current();
      if (!snapshot) return;
      await spreadsheetService.update(id, { sheetData: snapshot });
    },
  });

  // Load spreadsheet data
  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        const data = await spreadsheetService.getById(id);
        if (cancelled) return;
        setTitle(data.title);
        setInitialData(data.sheetData);
      } catch {
        if (!cancelled) {
          enqueueSnackbar(t('spreadsheets.loadError', 'Failed to load spreadsheet'), {
            variant: 'error',
          });
          navigate('/admin/spreadsheets');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [id, navigate, enqueueSnackbar, t]);

  // Keyboard shortcut: Ctrl+S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveNow();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [saveNow]);

  const handleContentChange = useCallback(() => {
    markDirty();
  }, [markDirty]);

  const handleTitleSave = useCallback(async () => {
    const newTitle = titleDraft.trim();
    if (!newTitle || !id) {
      setEditingTitle(false);
      return;
    }
    setTitle(newTitle);
    setEditingTitle(false);
    try {
      await spreadsheetService.updateMeta(id, { title: newTitle });
    } catch {
      enqueueSnackbar('Failed to rename', { variant: 'error' });
    }
  }, [id, titleDraft, enqueueSnackbar]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Top bar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: 1.5,
          py: 0.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
          minHeight: 48,
          bgcolor: 'background.paper',
        }}
      >
        <Tooltip title={t('common.back', 'Back')}>
          <IconButton onClick={() => navigate('/admin/spreadsheets')} size="small" sx={{ mr: 1 }}>
            <ArrowBackIcon />
          </IconButton>
        </Tooltip>

        {/* Inline title editing */}
        {editingTitle ? (
          <TextField
            autoFocus
            size="small"
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={handleTitleSave}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleTitleSave();
              if (e.key === 'Escape') setEditingTitle(false);
            }}
            sx={{ maxWidth: 400 }}
            variant="standard"
            InputProps={{ sx: { fontSize: '1rem', fontWeight: 600 } }}
          />
        ) : (
          <Typography
            variant="subtitle1"
            sx={{
              fontWeight: 600,
              cursor: 'pointer',
              '&:hover': { bgcolor: 'action.hover', borderRadius: 1 },
              px: 1,
              py: 0.25,
            }}
            onClick={() => {
              setTitleDraft(title);
              setEditingTitle(true);
            }}
          >
            {title}
          </Typography>
        )}

        <Box sx={{ flex: 1 }} />
        <SaveStatusIndicator status={saveStatus} />
      </Box>

      {/* Univer Editor */}
      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        <SpreadsheetEditorWrapper
          initialData={initialData}
          onContentChange={handleContentChange}
          getSnapshotRef={getSnapshotRef}
        />
      </Box>
    </Box>
  );
};

export default SpreadsheetEditorPage;
