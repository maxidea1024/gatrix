import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  ButtonGroup,
  Grid,
  Chip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  ToggleButtonGroup,
  ToggleButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CardActionArea,
  Backdrop,
  LinearProgress,
  Fade,
  alpha,
  Tooltip,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Description as FileIcon,
} from '@mui/icons-material';
import {
  Add as AddIcon,
  GridOn as GridOnIcon,
  GridView as GridViewIcon,
  ViewList as ViewListIcon,
  ArrowDropDown as ArrowDropDownIcon,
  NoteAdd as NoteAddIcon,
  FileUpload as ImportIcon,
  MoreVert as MoreVertIcon,
  PushPin as PushPinIcon,
  PushPinOutlined as PushPinOutlinedIcon,
  ContentCopy as ContentCopyIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  FileDownload as ExportIcon,
  Share as ShareIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import PageHeader from '@/components/common/PageHeader';
import SearchTextField from '@/components/common/SearchTextField';
import PageContentLoader from '@/components/common/PageContentLoader';
import EmptyPagePlaceholder from '@/components/common/EmptyPagePlaceholder';
import spreadsheetService, {
  SpreadsheetListItem,
} from '@/services/spreadsheetService';
import SpreadsheetCard from '@/components/spreadsheet/SpreadsheetCard';
import ShareDialog from '@/components/spreadsheet/ShareDialog';
import RelativeTime from '@/components/common/RelativeTime';
import { useDebounce } from '@/hooks/useDebounce';
import {
  exportSnapshotToXlsx,
  importFromXlsx,
} from '@/utils/spreadsheetExcelUtils';
import { useListRestoration } from '@/hooks/useListRestoration';

// ─── SpreadsheetRowMenu (list view context menu) ───

interface RowMenuProps {
  item: SpreadsheetListItem;
  onRename: () => void;
  onTogglePin: () => void;
  onDuplicate: () => void;
  onExportXlsx: () => void;
  onDelete: () => void;
}

const SpreadsheetRowMenu: React.FC<RowMenuProps> = ({
  item,
  onRename,
  onTogglePin,
  onDuplicate,
  onExportXlsx,
  onDelete,
}) => {
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  return (
    <>
      <IconButton size="small" onClick={(e) => setAnchorEl(e.currentTarget)}>
        <MoreVertIcon fontSize="small" />
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        <MenuItem
          onClick={() => {
            setAnchorEl(null);
            onRename();
          }}
        >
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('common.rename', 'Rename')}</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            setAnchorEl(null);
            onDuplicate();
          }}
        >
          <ListItemIcon>
            <ContentCopyIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('common.duplicate', 'Duplicate')}</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            setAnchorEl(null);
            onExportXlsx();
          }}
        >
          <ListItemIcon>
            <ExportIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>
            {t('spreadsheets.exportXlsx', 'Export as XLSX')}
          </ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            setAnchorEl(null);
            onDelete();
          }}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>{t('common.delete', 'Delete')}</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
};

// ─── Main Page ───

const SpreadsheetListPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  const [items, setItems] = useState<SpreadsheetListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    return (localStorage.getItem('spreadsheet-view-mode') as any) || 'grid';
  });

  // 복원할 상태를 하나로 묶음
  const listState = React.useMemo(
    () => ({ search, viewMode }),
    [search, viewMode]
  );

  useListRestoration(
    listState,
    (saved) => {
      if (saved.search !== undefined) setSearch(saved.search);
      if (saved.viewMode !== undefined) setViewMode(saved.viewMode);
    },
    [loading, items] // 로딩이 끝나고 items가 렌더링 된 직후 스크롤 복원
  );

  // Delete confirmation dialog
  const [deleteTarget, setDeleteTarget] = useState<SpreadsheetListItem | null>(
    null
  );
  // Rename dialog
  const [renameTarget, setRenameTarget] = useState<SpreadsheetListItem | null>(
    null
  );
  const [renameValue, setRenameValue] = useState('');

  // Create dropdown
  const [createMenuAnchor, setCreateMenuAnchor] = useState<null | HTMLElement>(
    null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importStep, setImportStep] = useState<
    'reading' | 'parsing' | 'saving' | 'done'
  >('reading');
  const [importFileName, setImportFileName] = useState('');
  const [importFileSize, setImportFileSize] = useState('');

  // Share dialog
  const [shareTarget, setShareTarget] = useState<SpreadsheetListItem | null>(
    null
  );

  const loadSpreadsheets = useCallback(async () => {
    try {
      setLoading(true);
      const result = await spreadsheetService.list({
        search: debouncedSearch || undefined,
        sortBy: 'updatedAt',
        sortOrder: 'desc',
        limit: 100,
      });
      setItems(result.items);
    } catch (err) {
      enqueueSnackbar(
        t('spreadsheets.loadError', 'Failed to load spreadsheets'),
        {
          variant: 'error',
        }
      );
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, enqueueSnackbar, t]);

  useEffect(() => {
    loadSpreadsheets();
  }, [loadSpreadsheets]);

  const handleCreate = useCallback(async () => {
    try {
      const created = await spreadsheetService.create();
      navigate(`/admin/spreadsheets/${created.id}`);
    } catch {
      enqueueSnackbar(
        t('spreadsheets.createError', 'Failed to create spreadsheet'),
        {
          variant: 'error',
        }
      );
    }
  }, [navigate, enqueueSnackbar, t]);

  const handleOpen = useCallback(
    (id: string) => navigate(`/admin/spreadsheets/${id}`),
    [navigate]
  );

  const handleTogglePin = useCallback(
    async (item: SpreadsheetListItem) => {
      const newPinned = !item.isPinned;
      // 낙관적 업데이트(Optimistic Update): UI 즉시 갱신 및 정렬
      setItems((prev) => {
        const updated = prev.map((i) =>
          i.id === item.id ? { ...i, isPinned: newPinned } : i
        );
        return updated.sort((a, b) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          return (
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
        });
      });

      try {
        await spreadsheetService.updateMeta(item.id, { isPinned: newPinned });
        // 서버에서 성공하면 정렬 유지를 위해 굳이 다시 로드하지 않음
      } catch {
        // 실패 시 롤백
        setItems((prev) => {
          const updated = prev.map((i) =>
            i.id === item.id ? { ...i, isPinned: item.isPinned } : i
          );
          return updated.sort((a, b) => {
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
            return (
              new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
            );
          });
        });
        enqueueSnackbar('Failed to update pin', { variant: 'error' });
      }
    },
    [enqueueSnackbar]
  );

  const handleDuplicate = useCallback(
    async (id: string) => {
      try {
        await spreadsheetService.duplicate(id);
        enqueueSnackbar(
          t('spreadsheets.duplicated', 'Spreadsheet duplicated'),
          {
            variant: 'success',
          }
        );
        loadSpreadsheets();
      } catch {
        enqueueSnackbar('Failed to duplicate', { variant: 'error' });
      }
    },
    [loadSpreadsheets, enqueueSnackbar, t]
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    const targetId = deleteTarget.id;
    setDeleteTarget(null);
    // 낙관적 업데이트: UI에서 즉시 제거
    setItems((prev) => prev.filter((i) => i.id !== targetId));
    try {
      await spreadsheetService.delete(targetId);
      enqueueSnackbar(t('spreadsheets.deleted', 'Spreadsheet deleted'), {
        variant: 'success',
      });
    } catch {
      // 실패 시 다시 로드
      loadSpreadsheets();
      enqueueSnackbar('Failed to delete', { variant: 'error' });
    }
  }, [deleteTarget, loadSpreadsheets, enqueueSnackbar, t]);

  const handleRenameConfirm = useCallback(async () => {
    if (!renameTarget) return;
    const target = renameTarget;
    const newTitle = renameValue.trim();

    // 즉시 편집 모드 해제 (중복 호출 방지)
    setRenameTarget(null);

    if (!newTitle || newTitle === target.title) {
      return;
    }

    // 낙관적 업데이트
    setItems((prev) =>
      prev.map((item) =>
        item.id === target.id ? { ...item, title: newTitle } : item
      )
    );

    try {
      await spreadsheetService.updateMeta(target.id, { title: newTitle });
    } catch {
      // 실패 시 원래 이름으로 복원
      setItems((prev) =>
        prev.map((item) =>
          item.id === target.id ? { ...item, title: target.title } : item
        )
      );
      enqueueSnackbar('Failed to rename', { variant: 'error' });
    }
  }, [renameTarget, renameValue, enqueueSnackbar]);

  // XLSX export from card context menu
  const handleExportXlsx = useCallback(
    async (item: SpreadsheetListItem) => {
      try {
        const data = await spreadsheetService.getById(item.id);
        if (!data.sheetData) {
          enqueueSnackbar(t('spreadsheets.exportError', 'Export failed'), {
            variant: 'warning',
          });
          return;
        }
        await exportSnapshotToXlsx(data.sheetData, item.title || 'spreadsheet');
        enqueueSnackbar(
          t('spreadsheets.exportSuccess', 'Exported successfully'),
          { variant: 'success' }
        );
      } catch {
        enqueueSnackbar(t('spreadsheets.exportError', 'Export failed'), {
          variant: 'error',
        });
      }
    },
    [enqueueSnackbar, t]
  );

  // XLSX import → create new spreadsheet
  const handleImportXlsx = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = '';

      // Setup import state
      const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
      };
      setImportFileName(file.name);
      setImportFileSize(formatSize(file.size));
      setImportStep('reading');
      setIsImporting(true);
      const startTime = Date.now();

      try {
        // Step 1: Read & Parse
        setImportStep('parsing');
        const sheetData = await importFromXlsx(file);

        // Step 2: Save to server
        setImportStep('saving');
        const created = await spreadsheetService.create({
          title: file.name.replace(/\.(xlsx|xls)$/i, ''),
          sheetData,
        });

        // Step 3: Done — show completion for 1s so user sees it
        setImportStep('done');
        await new Promise((r) => setTimeout(r, 1000));

        enqueueSnackbar(
          t('spreadsheets.importSuccess', 'Imported successfully'),
          { variant: 'success' }
        );
        navigate(`/admin/spreadsheets/${created.id}`);
      } catch (err) {
        console.error('XLSX import error:', err);
        enqueueSnackbar(t('spreadsheets.importError', 'Import failed'), {
          variant: 'error',
        });
      } finally {
        setIsImporting(false);
      }
    },
    [enqueueSnackbar, navigate, t]
  );

  const handleViewModeChange = (_: any, val: string | null) => {
    if (val) {
      setViewMode(val as any);
      localStorage.setItem('spreadsheet-view-mode', val);
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <PageHeader
        icon={<GridOnIcon />}
        title={t('spreadsheets.title', 'Spreadsheets')}
        subtitle={t(
          'spreadsheets.subtitle',
          'Create and manage spreadsheets with formulas, filters, and formatting.'
        )}
        actions={
          <>
            <ButtonGroup variant="contained">
              <Button startIcon={<AddIcon />} onClick={handleCreate}>
                {t('spreadsheets.createNew', 'New Spreadsheet')}
              </Button>
              <Button
                size="small"
                onClick={(e) => setCreateMenuAnchor(e.currentTarget)}
              >
                <ArrowDropDownIcon />
              </Button>
            </ButtonGroup>
            <Menu
              anchorEl={createMenuAnchor}
              open={Boolean(createMenuAnchor)}
              onClose={() => setCreateMenuAnchor(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
              <MenuItem
                onClick={() => {
                  setCreateMenuAnchor(null);
                  handleCreate();
                }}
              >
                <ListItemIcon>
                  <NoteAddIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>
                  {t('spreadsheets.createEmpty', 'Empty spreadsheet')}
                </ListItemText>
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setCreateMenuAnchor(null);
                  fileInputRef.current?.click();
                }}
              >
                <ListItemIcon>
                  <ImportIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>
                  {t('spreadsheets.importXlsx', 'Import XLSX')}
                </ListItemText>
              </MenuItem>
            </Menu>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              style={{ display: 'none' }}
              onChange={handleImportXlsx}
            />
          </>
        }
      />

      {/* Search & View toggle */}
      <Box sx={{ mb: 2 }}>
        <Box
          sx={{
            display: 'flex',
            gap: 2,
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <SearchTextField
            placeholder={
              t('spreadsheets.search', 'Search spreadsheets...') as string
            }
            value={search}
            onChange={setSearch}
          />
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={handleViewModeChange}
            size="small"
          >
            <ToggleButton value="grid">
              <GridViewIcon fontSize="small" />
            </ToggleButton>
            <ToggleButton value="list">
              <ViewListIcon fontSize="small" />
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>

      {/* Content */}
      <PageContentLoader loading={loading || search !== debouncedSearch}>
        {items.length === 0 && !debouncedSearch && !search ? (
          <EmptyPagePlaceholder
            message={t(
              'spreadsheets.emptyDescription',
              'Create your first spreadsheet to organize data with formulas, filters, and formatting.'
            )}
            onAddClick={handleCreate}
            addButtonLabel={t('spreadsheets.createNew', 'New Spreadsheet')}
          />
        ) : items.length === 0 && debouncedSearch === search && search ? (
          <EmptyPagePlaceholder
            message={t(
              'spreadsheets.noResults',
              'No spreadsheets match your search.'
            )}
          />
        ) : viewMode === 'grid' ? (
          <Grid container spacing={2}>
            {items.map((item) => (
              <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={item.id}>
                <SpreadsheetCard
                  item={item}
                  onOpen={handleOpen}
                  onRename={(item) => {
                    setRenameTarget(item);
                    setRenameValue(item.title);
                  }}
                  onShare={setShareTarget}
                  onTogglePin={handleTogglePin}
                  onDuplicate={handleDuplicate}
                  onExportXlsx={handleExportXlsx}
                  onDelete={setDeleteTarget}
                  isRenaming={renameTarget?.id === item.id}
                  renameValue={renameValue}
                  onRenameChange={setRenameValue}
                  onRenameConfirm={handleRenameConfirm}
                  onRenameCancel={() => setRenameTarget(null)}
                />
              </Grid>
            ))}
          </Grid>
        ) : (
          /* List view — table style matching ClientVersionsPage */
          <TableContainer
            component={Paper}
            variant="outlined"
            sx={{ borderRadius: 2 }}
          >
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, width: 40 }} />
                  <TableCell sx={{ fontWeight: 600 }}>
                    {t('common.title', 'Title')}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600, width: 140 }}>
                    {t('common.createdBy', 'Created by')}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600, width: 150 }}>
                    {t('common.updatedAt', 'Updated')}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600, width: 50 }} />
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item) => (
                  <TableRow
                    key={item.id}
                    hover
                    onClick={() => handleOpen(item.id)}
                    sx={{
                      cursor: 'pointer',
                      '&:last-child td': { borderBottom: 0 },
                    }}
                  >
                    <TableCell
                      sx={{ pr: 0 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTogglePin(item);
                      }}
                    >
                      <Tooltip
                        title={
                          item.isPinned
                            ? t('common.unpin', 'Unpin')
                            : t('common.pin', 'Pin')
                        }
                      >
                        <IconButton
                          size="small"
                          sx={{
                            p: 0.5,
                            color: item.isPinned
                              ? 'primary.main'
                              : 'action.active',
                          }}
                        >
                          {item.isPinned ? (
                            <PushPinIcon
                              sx={{ fontSize: 16, transform: 'rotate(45deg)' }}
                            />
                          ) : (
                            <PushPinOutlinedIcon
                              sx={{ fontSize: 16, transform: 'rotate(45deg)' }}
                            />
                          )}
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                      >
                        <GridOnIcon
                          sx={{
                            fontSize: 18,
                            color: 'action.disabled',
                            flexShrink: 0,
                          }}
                        />
                        {renameTarget?.id === item.id ? (
                          <TextField
                            size="small"
                            variant="standard"
                            autoFocus
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleRenameConfirm();
                              if (e.key === 'Escape') setRenameTarget(null);
                            }}
                            onBlur={handleRenameConfirm}
                            sx={{ minWidth: 250 }}
                            inputProps={{
                              style: { fontSize: '0.875rem', fontWeight: 500 },
                            }}
                          />
                        ) : (
                          <>
                            <Typography
                              variant="body2"
                              noWrap
                              sx={{
                                fontWeight: 500,
                              }}
                            >
                              {item.title}
                            </Typography>
                            <Tooltip title={t('common.rename', 'Rename')}>
                              <IconButton
                                size="small"
                                onClick={() => {
                                  setRenameTarget(item);
                                  setRenameValue(item.title);
                                }}
                                sx={{
                                  width: 22,
                                  height: 22,
                                  color: 'action.active',
                                  '&:hover': { color: 'text.primary' },
                                }}
                              >
                                <EditIcon sx={{ fontSize: 14 }} />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      {item.createdByName && (
                        <Chip
                          label={item.createdByName}
                          size="small"
                          variant="outlined"
                          sx={{ height: 20, fontSize: '0.7rem' }}
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      <RelativeTime date={item.updatedAt} variant="caption" />
                    </TableCell>
                    <TableCell
                      align="right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          gap: 0.5,
                        }}
                      >
                        <Tooltip title={t('spreadsheets.share', '공유')}>
                          <IconButton
                            size="small"
                            onClick={() => setShareTarget(item)}
                          >
                            <ShareIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <SpreadsheetRowMenu
                          item={item}
                          onRename={() => {
                            setRenameTarget(item);
                            setRenameValue(item.title);
                          }}
                          onTogglePin={() => handleTogglePin(item)}
                          onDuplicate={() => handleDuplicate(item.id)}
                          onExportXlsx={() => handleExportXlsx(item)}
                          onDelete={() => setDeleteTarget(item)}
                        />
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </PageContentLoader>

      {/* Delete Dialog */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>
          {t('spreadsheets.deleteTitle', 'Delete Spreadsheet')}
        </DialogTitle>
        <DialogContent>
          <Typography>
            {t(
              'spreadsheets.deleteConfirm',
              'Are you sure you want to delete "{{title}}"?',
              {
                title: deleteTarget?.title,
              }
            )}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleDeleteConfirm}
          >
            {t('common.delete', 'Delete')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Import Progress Overlay */}
      <Backdrop
        sx={{
          zIndex: (theme) => theme.zIndex.modal + 1,
          backdropFilter: 'blur(6px)',
          backgroundColor: 'rgba(0,0,0,0.45)',
        }}
        open={isImporting}
      >
        <Fade in={isImporting}>
          <Box
            sx={{
              width: 300,
              maxWidth: '90vw',
              borderRadius: 3,
              overflow: 'hidden',
              bgcolor: 'background.paper',
              boxShadow:
                '0 20px 60px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.05)',
            }}
          >
            {/* Gradient header with file info */}
            <Box
              sx={{
                background:
                  importStep === 'done'
                    ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)'
                    : 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                px: 2.5,
                py: 2,
                transition: 'background 0.5s ease',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: 'rgba(255,255,255,0.2)',
                    backdropFilter: 'blur(4px)',
                  }}
                >
                  {importStep === 'done' ? (
                    <CheckCircleIcon sx={{ fontSize: 20, color: '#fff' }} />
                  ) : (
                    <FileIcon sx={{ fontSize: 20, color: '#fff' }} />
                  )}
                </Box>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography
                    variant="body2"
                    noWrap
                    sx={{ fontWeight: 600, color: '#fff', lineHeight: 1.3 }}
                  >
                    {importStep === 'done'
                      ? t('spreadsheets.importStepDone', '가져오기 완료')
                      : importFileName}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.7rem' }}
                  >
                    {importFileSize}
                  </Typography>
                </Box>
              </Box>

              {/* Progress bar inside header */}
              {importStep !== 'done' && (
                <LinearProgress
                  variant="indeterminate"
                  sx={{
                    mt: 1.5,
                    height: 3,
                    borderRadius: 2,
                    bgcolor: 'rgba(255,255,255,0.15)',
                    '& .MuiLinearProgress-bar': {
                      borderRadius: 2,
                      bgcolor: 'rgba(255,255,255,0.85)',
                    },
                  }}
                />
              )}
            </Box>

            {/* Steps */}
            <Box sx={{ px: 2.5, py: 1.75 }}>
              {(['parsing', 'saving', 'done'] as const).map(
                (step, idx, arr) => {
                  const stepOrder = { parsing: 0, saving: 1, done: 2 };
                  const currentOrder = stepOrder[importStep] ?? 0;
                  const thisOrder = stepOrder[step];
                  const isActive = importStep === step;
                  const isCompleted = currentOrder > thisOrder;
                  const isLast = idx === arr.length - 1;

                  const labels: Record<string, string> = {
                    parsing: t(
                      'spreadsheets.importStepParsing',
                      '엑셀 파일 분석'
                    ),
                    saving: t('spreadsheets.importStepSaving', '서버에 저장'),
                    done: t('spreadsheets.importStepDone', '가져오기 완료'),
                  };

                  return (
                    <Box key={step} sx={{ display: 'flex', gap: 1.25 }}>
                      {/* Indicator column with connector line */}
                      <Box
                        sx={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          width: 20,
                          flexShrink: 0,
                        }}
                      >
                        <Box
                          sx={{
                            width: 20,
                            height: 20,
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            ...(isCompleted
                              ? { bgcolor: 'success.main', color: '#fff' }
                              : isActive
                                ? {
                                    bgcolor: 'primary.main',
                                    color: '#fff',
                                    boxShadow: '0 0 0 3px rgba(99,102,241,0.2)',
                                  }
                                : {
                                    border: '1.5px solid',
                                    borderColor: 'divider',
                                    color: 'text.disabled',
                                  }),
                            transition: 'all 0.3s ease',
                          }}
                        >
                          {isCompleted ? (
                            <CheckCircleIcon sx={{ fontSize: 14 }} />
                          ) : isActive ? (
                            <CircularProgress
                              size={11}
                              thickness={5}
                              sx={{ color: '#fff' }}
                            />
                          ) : (
                            <Box
                              sx={{
                                width: 5,
                                height: 5,
                                borderRadius: '50%',
                                bgcolor: 'text.disabled',
                              }}
                            />
                          )}
                        </Box>
                        {/* Connector line */}
                        {!isLast && (
                          <Box
                            sx={{
                              width: 1.5,
                              flex: 1,
                              my: 0.25,
                              borderRadius: 1,
                              bgcolor: isCompleted ? 'success.main' : 'divider',
                              transition: 'background-color 0.3s ease',
                            }}
                          />
                        )}
                      </Box>
                      {/* Label */}
                      <Box sx={{ pb: isLast ? 0 : 1.25, pt: 0.1 }}>
                        <Typography
                          variant="body2"
                          sx={{
                            fontSize: '0.8rem',
                            fontWeight: isActive ? 600 : 400,
                            color: isActive
                              ? 'text.primary'
                              : isCompleted
                                ? 'text.secondary'
                                : 'text.disabled',
                            transition: 'all 0.3s',
                            lineHeight: 1.2,
                          }}
                        >
                          {labels[step]}
                        </Typography>
                      </Box>
                    </Box>
                  );
                }
              )}
            </Box>
          </Box>
        </Fade>
      </Backdrop>
      {/* Share Dialog */}
      {shareTarget && (
        <ShareDialog
          open={Boolean(shareTarget)}
          onClose={() => setShareTarget(null)}
          spreadsheetId={shareTarget.id}
          spreadsheetTitle={shareTarget.title}
        />
      )}
    </Box>
  );
};

export default SpreadsheetListPage;
