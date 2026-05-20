import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  InputAdornment,
  Grid,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  GridView as GridViewIcon,
  ViewList as ViewListIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import spreadsheetService, {
  SpreadsheetListItem,
} from '@/services/spreadsheetService';
import SpreadsheetCard from '@/components/spreadsheet/SpreadsheetCard';
import SpreadsheetEmptyState from '@/components/spreadsheet/SpreadsheetEmptyState';

const SpreadsheetListPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  const [items, setItems] = useState<SpreadsheetListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    return (localStorage.getItem('spreadsheet-view-mode') as any) || 'grid';
  });

  // Delete confirmation dialog
  const [deleteTarget, setDeleteTarget] = useState<SpreadsheetListItem | null>(null);
  // Rename dialog
  const [renameTarget, setRenameTarget] = useState<SpreadsheetListItem | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const loadSpreadsheets = useCallback(async () => {
    try {
      setLoading(true);
      const result = await spreadsheetService.list({
        search: search || undefined,
        sortBy: 'updatedAt',
        sortOrder: 'desc',
        limit: 100,
      });
      setItems(result.items);
    } catch (err) {
      enqueueSnackbar(t('spreadsheets.loadError', 'Failed to load spreadsheets'), {
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [search, enqueueSnackbar, t]);

  useEffect(() => {
    loadSpreadsheets();
  }, [loadSpreadsheets]);

  const handleCreate = useCallback(async () => {
    try {
      const created = await spreadsheetService.create();
      navigate(`/admin/spreadsheets/${created.id}`);
    } catch {
      enqueueSnackbar(t('spreadsheets.createError', 'Failed to create spreadsheet'), {
        variant: 'error',
      });
    }
  }, [navigate, enqueueSnackbar, t]);

  const handleOpen = useCallback(
    (id: string) => navigate(`/admin/spreadsheets/${id}`),
    [navigate]
  );

  const handleTogglePin = useCallback(
    async (item: SpreadsheetListItem) => {
      try {
        await spreadsheetService.updateMeta(item.id, { isPinned: !item.isPinned });
        loadSpreadsheets();
      } catch {
        enqueueSnackbar('Failed to update pin', { variant: 'error' });
      }
    },
    [loadSpreadsheets, enqueueSnackbar]
  );

  const handleDuplicate = useCallback(
    async (id: string) => {
      try {
        await spreadsheetService.duplicate(id);
        enqueueSnackbar(t('spreadsheets.duplicated', 'Spreadsheet duplicated'), {
          variant: 'success',
        });
        loadSpreadsheets();
      } catch {
        enqueueSnackbar('Failed to duplicate', { variant: 'error' });
      }
    },
    [loadSpreadsheets, enqueueSnackbar, t]
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await spreadsheetService.delete(deleteTarget.id);
      enqueueSnackbar(t('spreadsheets.deleted', 'Spreadsheet deleted'), {
        variant: 'success',
      });
      setDeleteTarget(null);
      loadSpreadsheets();
    } catch {
      enqueueSnackbar('Failed to delete', { variant: 'error' });
    }
  }, [deleteTarget, loadSpreadsheets, enqueueSnackbar, t]);

  const handleRenameConfirm = useCallback(async () => {
    if (!renameTarget || !renameValue.trim()) return;
    try {
      await spreadsheetService.updateMeta(renameTarget.id, {
        title: renameValue.trim(),
      });
      setRenameTarget(null);
      loadSpreadsheets();
    } catch {
      enqueueSnackbar('Failed to rename', { variant: 'error' });
    }
  }, [renameTarget, renameValue, loadSpreadsheets, enqueueSnackbar]);

  const handleViewModeChange = (_: any, val: string | null) => {
    if (val) {
      setViewMode(val as any);
      localStorage.setItem('spreadsheet-view-mode', val);
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          {t('spreadsheets.title', 'Spreadsheets')}
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreate}
          sx={{ borderRadius: 2, textTransform: 'none' }}
        >
          {t('spreadsheets.createNew', 'New Spreadsheet')}
        </Button>
      </Box>

      {/* Toolbar */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'center' }}>
        <TextField
          size="small"
          placeholder={t('spreadsheets.search', 'Search spreadsheets...')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{ flex: 1, maxWidth: 400 }}
        />
        <ToggleButtonGroup value={viewMode} exclusive onChange={handleViewModeChange} size="small">
          <ToggleButton value="grid"><GridViewIcon fontSize="small" /></ToggleButton>
          <ToggleButton value="list"><ViewListIcon fontSize="small" /></ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Content */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : items.length === 0 && !search ? (
        <SpreadsheetEmptyState onCreateNew={handleCreate} />
      ) : items.length === 0 && search ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography color="text.secondary">
            {t('spreadsheets.noResults', 'No spreadsheets match your search.')}
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={2}>
          {items.map((item) => (
            <Grid size={{ xs: 12, sm: viewMode === 'grid' ? 6 : 12, md: viewMode === 'grid' ? 4 : 12, lg: viewMode === 'grid' ? 3 : 12 }} key={item.id}>
              <SpreadsheetCard
                item={item}
                onOpen={handleOpen}
                onRename={(item) => {
                  setRenameTarget(item);
                  setRenameValue(item.title);
                }}
                onTogglePin={handleTogglePin}
                onDuplicate={handleDuplicate}
                onDelete={setDeleteTarget}
              />
            </Grid>
          ))}
        </Grid>
      )}

      {/* Delete Dialog */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>{t('spreadsheets.deleteTitle', 'Delete Spreadsheet')}</DialogTitle>
        <DialogContent>
          <Typography>
            {t('spreadsheets.deleteConfirm', 'Are you sure you want to delete "{{title}}"?', {
              title: deleteTarget?.title,
            })}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>{t('common.cancel', 'Cancel')}</Button>
          <Button color="error" variant="contained" onClick={handleDeleteConfirm}>
            {t('common.delete', 'Delete')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={!!renameTarget} onClose={() => setRenameTarget(null)}>
        <DialogTitle>{t('spreadsheets.renameTitle', 'Rename Spreadsheet')}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRenameConfirm()}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenameTarget(null)}>{t('common.cancel', 'Cancel')}</Button>
          <Button variant="contained" onClick={handleRenameConfirm} disabled={!renameValue.trim()}>
            {t('common.save', 'Save')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SpreadsheetListPage;
