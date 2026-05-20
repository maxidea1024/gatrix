import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  IconButton,
  TextField,
  Tooltip,
  CircularProgress,
  Fade,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  FiberManualRecord as DotIcon,
  Check as CheckIcon,
  ErrorOutline as ErrorIcon,
  MoreVert as MoreVertIcon,
  FileDownload as ExportIcon,
  FileUpload as ImportIcon,
  Share as ShareIcon,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import spreadsheetService from '@/services/spreadsheetService';
import { useAutoSave, AutoSaveStatus } from '@/hooks/useAutoSave';
import SpreadsheetEditorWrapper from '@/components/spreadsheet/SpreadsheetEditorWrapper';
import ShareDialog from '@/components/spreadsheet/ShareDialog';
import LottieLoader from '@/components/common/LottieLoader';
import { exportToXlsx, importFromXlsx } from '@/utils/spreadsheetExcelUtils';

// ==================== Save Status Indicator ====================

const SaveStatusIndicator: React.FC<{ status: AutoSaveStatus }> = ({ status }) => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (status === 'idle') {
      setVisible(false);
      return;
    }
    setVisible(true);
    // Auto-hide "saved" after 2s
    if (status === 'saved') {
      const timer = setTimeout(() => setVisible(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  const tooltipMap: Record<AutoSaveStatus, string> = {
    idle: '',
    pending: t('spreadsheets.unsaved', 'Unsaved changes'),
    saving: t('spreadsheets.saving', 'Saving...'),
    saved: t('spreadsheets.saved', 'Saved'),
    error: t('spreadsheets.saveError', 'Save failed'),
  };

  const renderIcon = () => {
    switch (status) {
      case 'pending':
        return <DotIcon sx={{ fontSize: 10, color: 'warning.main', animation: 'pulse 1.5s ease-in-out infinite', '@keyframes pulse': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.3 } } }} />;
      case 'saving':
        return <CircularProgress size={12} sx={{ color: 'text.secondary' }} />;
      case 'saved':
        return <CheckIcon sx={{ fontSize: 14, color: 'success.main' }} />;
      case 'error':
        return <ErrorIcon sx={{ fontSize: 14, color: 'error.main' }} />;
      default:
        return null;
    }
  };

  if (status === 'idle' && !visible) return null;

  return (
    <Fade in={visible} timeout={300}>
      <Tooltip title={tooltipMap[status]} arrow placement="bottom">
        <Box sx={{ display: 'flex', alignItems: 'center', mr: 1, cursor: 'default' }}>
          {renderIcon()}
        </Box>
      </Tooltip>
    </Fade>
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
  // Ref to access Univer API (for XLSX export/import)
  const univerAPIRef = useRef<any>(null);
  // File input ref for XLSX import
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Menu & import dialog state
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

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

  // XLSX Export
  const handleExport = useCallback(() => {
    setMenuAnchor(null);
    try {
      if (!univerAPIRef.current) {
        enqueueSnackbar('Spreadsheet not ready', { variant: 'warning' });
        return;
      }
      exportToXlsx(univerAPIRef.current, title || 'spreadsheet');
      enqueueSnackbar(t('spreadsheets.exportSuccess', 'Exported successfully'), { variant: 'success' });
    } catch (err) {
      console.error('[SpreadsheetEditor] Export failed:', err);
      enqueueSnackbar(t('spreadsheets.exportError', 'Export failed'), { variant: 'error' });
    }
  }, [title, enqueueSnackbar, t]);

  // XLSX Import — file selection
  const handleImportFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so same file can be re-selected
    e.target.value = '';
    setPendingImportFile(file);
    setImportDialogOpen(true);
  }, []);

  // XLSX Import — confirmed
  const handleImportConfirm = useCallback(async () => {
    if (!pendingImportFile || !id) return;
    setImportDialogOpen(false);
    try {
      const newData = await importFromXlsx(pendingImportFile);
      // Save to backend
      await spreadsheetService.update(id, { sheetData: newData });
      // Reload page to re-initialize Univer with new data
      enqueueSnackbar(t('spreadsheets.importSuccess', 'Imported successfully'), { variant: 'success' });
      window.location.reload();
    } catch (err) {
      console.error('[SpreadsheetEditor] Import failed:', err);
      enqueueSnackbar(t('spreadsheets.importError', 'Import failed'), { variant: 'error' });
    } finally {
      setPendingImportFile(null);
    }
  }, [pendingImportFile, id, enqueueSnackbar, t]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <LottieLoader size={80} message={t('spreadsheets.loading', 'Loading spreadsheet...')} />
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

        {/* Share button */}
        <Tooltip title={t('spreadsheets.share', '공유')}>
          <IconButton size="small" onClick={() => setShareOpen(true)} sx={{ mr: 0.5 }}>
            <ShareIcon />
          </IconButton>
        </Tooltip>

        {/* More menu (Export/Import) */}
        <Tooltip title={t('common.more', 'More')}>
          <IconButton size="small" onClick={(e) => setMenuAnchor(e.currentTarget)}>
            <MoreVertIcon />
          </IconButton>
        </Tooltip>
        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={() => setMenuAnchor(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <MenuItem onClick={handleExport}>
            <ListItemIcon><ExportIcon fontSize="small" /></ListItemIcon>
            <ListItemText>{t('spreadsheets.exportXlsx', 'Export as XLSX')}</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => { setMenuAnchor(null); fileInputRef.current?.click(); }}>
            <ListItemIcon><ImportIcon fontSize="small" /></ListItemIcon>
            <ListItemText>{t('spreadsheets.importXlsx', 'Import XLSX')}</ListItemText>
          </MenuItem>
        </Menu>
        {/* Hidden file input for XLSX import */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          style={{ display: 'none' }}
          onChange={handleImportFileSelect}
        />
      </Box>

      {/* Fortune-sheet Editor */}
      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        <SpreadsheetEditorWrapper
          spreadsheetId={id}
          initialData={initialData}
          onContentChange={handleContentChange}
          getSnapshotRef={getSnapshotRef}
          univerAPIRef={univerAPIRef}
        />
      </Box>

      {/* Import confirmation dialog */}
      <Dialog open={importDialogOpen} onClose={() => { setImportDialogOpen(false); setPendingImportFile(null); }}>
        <DialogTitle>{t('spreadsheets.importConfirmTitle', 'Import XLSX')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('spreadsheets.importConfirmMessage', 'This will replace all current data with the imported file. This action cannot be undone. Continue?')}
          </DialogContentText>
          {pendingImportFile && (
            <Typography variant="body2" sx={{ mt: 1, fontWeight: 600 }}>
              {pendingImportFile.name}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setImportDialogOpen(false); setPendingImportFile(null); }}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button onClick={handleImportConfirm} variant="contained" color="primary">
            {t('spreadsheets.importConfirm', 'Import')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Share Dialog */}
      {id && (
        <ShareDialog
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          spreadsheetId={id}
          spreadsheetTitle={title}
        />
      )}
    </Box>
  );
};

export default SpreadsheetEditorPage;
