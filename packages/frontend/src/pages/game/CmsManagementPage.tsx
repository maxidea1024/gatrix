import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  ButtonGroup,
  Chip,
  Card,
  TextField,
  CircularProgress,
  IconButton,
  Tooltip,
  Alert,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Stack,
  Switch,
  FormControlLabel,
  ListItemIcon,
  ListItemText,
  TableSortLabel,
  Menu,
  MenuItem,
  Tab,
  Tabs,
  Checkbox,
  Popper,
  Grow,
  ClickAwayListener,
  MenuList,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Refresh as RefreshIcon,
  Upload as UploadIcon,
  History as HistoryIcon,
  Restore as RestoreIcon,
  Storage as StorageIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  CloudSync as CloudSyncIcon,
  RestartAlt as RestartAltIcon,
  TableChart as TableChartIcon,
  MoreVert as MoreVertIcon,
  Visibility as VisibilityIcon,
  ArrowDropDown as ArrowDropDownIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  CompareArrows as CompareArrowsIcon,
  Edit as EditIcon,
  ArrowForward as ArrowForwardIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useSearchParams } from 'react-router-dom';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import { useEnvironment } from '@/contexts/EnvironmentContext';
import PageHeader from '@/components/common/PageHeader';
import PageContentLoader from '@/components/common/PageContentLoader';
import SearchTextField from '@/components/common/SearchTextField';
import EmptyPlaceholder from '@/components/common/EmptyPlaceholder';
import SimplePagination from '@/components/common/SimplePagination';
import ResizableDrawer from '@/components/common/ResizableDrawer';
import RippleTrackingDialog from '@/components/admin/RippleTrackingDialog';
import JsonEditor from '@/components/common/JsonEditor';
import cmsService, {
  CmsTable,
  CmsTableHistoryResponse,
} from '@/services/cmsService';
import rippleService, { RippleHistoryEvent } from '@/services/rippleService';
import { formatRelativeTime } from '@/utils/dateFormat';

/** Compute unified diff in a Web Worker to avoid blocking the UI thread */
const computeDiffInWorker = (
  oldStr: string,
  newStr: string,
  oldTitle: string,
  newTitle: string
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const workerCode = `
      importScripts('https://cdn.jsdelivr.net/npm/diff@5.2.0/dist/diff.min.js');
      self.onmessage = function(e) {
        var patch = Diff.createPatch('', e.data.oldStr, e.data.newStr, e.data.oldTitle, e.data.newTitle, { context: 3 });
        self.postMessage(patch);
      };
    `;
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const worker = new Worker(URL.createObjectURL(blob));
    worker.onmessage = (e) => {
      resolve(e.data);
      worker.terminate();
    };
    worker.onerror = (e) => {
      reject(e);
      worker.terminate();
    };
    worker.postMessage({ oldStr, newStr, oldTitle, newTitle });
  });
};

/** Lightweight unified-diff renderer — accepts pre-computed patch text */
const LightDiff: React.FC<{
  patchText: string;
  dark?: boolean;
  noDiffMessage?: string;
}> = React.memo(({ patchText, dark, noDiffMessage }) => {
  if (!patchText || patchText.trim().length === 0) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          py: 6,
          color: 'text.disabled',
        }}
      >
        <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
          {noDiffMessage || 'No diff available'}
        </Typography>
      </Box>
    );
  }

  const html = React.useMemo(() => {
    const lines = patchText.split('\n').slice(4); // skip header
    return lines
      .map((line) => {
        const escaped = line
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        let bg = 'transparent',
          fg = dark ? '#e0e0e0' : '#24292f';
        if (line.startsWith('+')) {
          bg = dark ? '#1b2e1b' : '#e6ffec';
          fg = dark ? '#a5d6a7' : '#1a7f37';
        } else if (line.startsWith('-')) {
          bg = dark ? '#2e1b1b' : '#ffebe9';
          fg = dark ? '#ef9a9a' : '#cf222e';
        } else if (line.startsWith('@@')) {
          bg = dark ? '#1e1e35' : '#f0f0ff';
          fg = dark ? '#888' : '#6e7781';
        }
        return `<span style="display:block;padding:0 12px;background:${bg};color:${fg};min-height:1.6em">${escaped || ' '}</span>`;
      })
      .join('');
  }, [patchText, dark]);

  return (
    <pre
      style={{
        margin: 0,
        fontFamily: 'monospace',
        fontSize: '0.75rem',
        lineHeight: 1.6,
        whiteSpace: 'pre',
        overflow: 'auto',
        maxHeight: 'calc(100vh - 420px)',
        background: dark ? '#1a1a2e' : '#fafafa',
        color: dark ? '#e0e0e0' : '#24292f',
        borderRadius: 6,
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
});

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

const RELOAD_FILTER_KEY = 'cmsManagement.reloadFilter';
const LS_PAGE_SIZE_KEY = 'cmsManagement.pageSize';

type SortField =
  | 'tableName'
  | 'binaryCode'
  | 'version'
  | 'dataSize'
  | 'uploadedAt'
  | 'reloadability';
type SortOrder = 'asc' | 'desc';

const CmsManagementPage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { getProjectApiPath } = useOrgProject();
  const { currentEnvironmentId } = useEnvironment();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [searchParams, setSearchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [tables, setTables] = useState<CmsTable[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [noAdmind, setNoAdmind] = useState(false);
  const [admindUrl, setAdmindUrl] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [reloadFilter, setReloadFilter] = useState<'all' | 'hot' | 'restart'>(
    () => {
      const saved = localStorage.getItem(RELOAD_FILTER_KEY);
      return (saved as 'all' | 'hot' | 'restart') || 'all';
    }
  );

  // Pagination
  const [page, setPage] = useState(() => {
    const p = searchParams.get('page');
    return p ? Math.max(0, parseInt(p, 10) - 1) : 0;
  });
  const [rowsPerPage, setRowsPerPage] = useState(() => {
    const saved = localStorage.getItem(LS_PAGE_SIZE_KEY);
    return saved ? Number(saved) : 10;
  });

  // Sorting
  const [sortField, setSortField] = useState<SortField>('tableName');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Upload dialog
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadTableName, setUploadTableName] = useState('');
  const [uploadComment, setUploadComment] = useState('');
  const [uploadData, setUploadData] = useState('');
  const [uploadRefresh, setUploadRefresh] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Detail drawer (replaces old history drawer)
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailTableName, setDetailTableName] = useState('');
  const [detailTab, setDetailTab] = useState(0);

  // Inline editor (activated from version context menu)
  const [editorData, setEditorData] = useState('');
  const [editorOriginalData, setEditorOriginalData] = useState('');
  const [editorComment, setEditorComment] = useState('');
  const [editorSaving, setEditorSaving] = useState(false);
  const [editorLoading, setEditorLoading] = useState(false);
  const [editorJsonValid, setEditorJsonValid] = useState(true);
  const [editingVersion, setEditingVersion] = useState<number | null>(null);
  const [saveMenuOpen, setSaveMenuOpen] = useState(false);
  const saveMenuRef = React.useRef<HTMLDivElement>(null);

  // Version context menu (MoreVert)
  const [versionMenuAnchor, setVersionMenuAnchor] =
    useState<HTMLElement | null>(null);
  const [versionMenuEntry, setVersionMenuEntry] = useState<{
    version: number;
    isActive: boolean;
  } | null>(null);

  // Tab 1: History
  const [historyData, setHistoryData] =
    useState<CmsTableHistoryResponse | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  // Data viewer (read-only JSON inspector in history tab)
  const [viewingVersion, setViewingVersion] = useState<number | null>(null);
  const [viewingData, setViewingData] = useState<any>(null);
  const [viewingDataLoading, setViewingDataLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'data' | 'diff'>('data');
  const [diffPatchText, setDiffPatchText] = useState<string>('');
  const [diffLoading, setDiffLoading] = useState(false);

  // Cache for fetched version data (avoids re-fetching when switching Data/Diff)
  const versionDataCache = useRef<Map<string, any>>(new Map());

  // Tab 2: Propagation
  const [propagationData, setPropagationData] = useState<RippleHistoryEvent[]>(
    []
  );
  const [propagationLoading, setPropagationLoading] = useState(false);
  const [propagationLoaded, setPropagationLoaded] = useState(false);
  const [collapsedPropGroups, setCollapsedPropGroups] = useState<Set<string>>(
    new Set()
  );

  // Rollback confirm dialog
  const [rollbackOpen, setRollbackOpen] = useState(false);
  const [rollbackTableName, setRollbackTableName] = useState('');
  const [rollbackVersion, setRollbackVersion] = useState<number>(0);
  const [rollbackRefresh, setRollbackRefresh] = useState(true);
  const [rollbackLoading, setRollbackLoading] = useState(false);
  const [rollbackDiffText, setRollbackDiffText] = useState<string>('');
  const [rollbackDiffLoading, setRollbackDiffLoading] = useState(false);
  const [rollbackComment, setRollbackComment] = useState('');
  const [rollbackCurrentVersion, setRollbackCurrentVersion] =
    useState<number>(0);

  // Unsynced refresh dialog
  const [unsyncedDialogOpen, setUnsyncedDialogOpen] = useState(false);
  const [unsyncedSelected, setUnsyncedSelected] = useState<Set<string>>(
    new Set()
  );
  const [unsyncedRefreshing, setUnsyncedRefreshing] = useState(false);
  const [unsyncedDiffs, setUnsyncedDiffs] = useState<
    Record<string, { loading: boolean; text: string }>
  >({});

  // Row context menu
  const [rowMenuAnchor, setRowMenuAnchor] = useState<HTMLElement | null>(null);
  const [rowMenuTable, setRowMenuTable] = useState<CmsTable | null>(null);

  // Multi-select
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());

  // Refresh confirm dialog
  const [refreshConfirmOpen, setRefreshConfirmOpen] = useState(false);
  const [refreshConfirmTableName, setRefreshConfirmTableName] = useState('');
  const [refreshConfirmDiff, setRefreshConfirmDiff] = useState<{
    loading: boolean;
    text: string;
  }>({ loading: false, text: '' });

  // Discard confirm dialog
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const [pendingDiscardAction, setPendingDiscardAction] = useState<
    (() => void) | null
  >(null);

  // Ripple tracking dialog
  const [trackingDialogOpen, setTrackingDialogOpen] = useState(false);
  const [trackingRequestId, setTrackingRequestId] = useState<string | null>(
    null
  );
  const [trackingPattern, setTrackingPattern] = useState<string | null>(null);
  const [trackingMatchedKeys, setTrackingMatchedKeys] = useState<string[]>([]);
  const [trackingTargetTables, setTrackingTargetTables] = useState<string[]>(
    []
  );

  const handleSetReloadFilter = (val: 'all' | 'hot' | 'restart') => {
    setReloadFilter(val);
    localStorage.setItem(RELOAD_FILTER_KEY, val);
    setPage(0); // Reset page on filter change
  };

  const fetchTables = useCallback(async () => {
    try {
      const projectApiPath = getProjectApiPath();
      const result = await cmsService.getTables(projectApiPath);
      setTables(result?.tables || []);
      setAdmindUrl(result?.admindUrl || null);
      setError(null);
      setNoAdmind(false);
    } catch (err: any) {
      const errorCode = err.error?.code || err.code;
      if (errorCode === 'SERVICE_NOT_FOUND') {
        setNoAdmind(true);
        setError(null);
      } else {
        setNoAdmind(false);
        const msg = err.error?.message || err.message || 'Failed to load';
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [getProjectApiPath]);

  // Re-fetch when environment changes (including hard refresh)
  useEffect(() => {
    // Reset all detail state when environment changes
    setDetailTableName(null);
    setHistoryData(null);
    setViewingVersion(null);
    setDiffPatchText('');
    setViewingData(null);
    setTables([]);
    setLoading(true);
    fetchTables();
  }, [fetchTables, currentEnvironmentId]);

  // Pagination handlers
  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
    setSearchParams((prev) => {
      const next = newSearchParams(prev);
      next.set('page', String(newPage + 1));
      return next;
    });
  };

  const handleChangeRowsPerPage = (event: any) => {
    const newSize = parseInt(event.target.value, 10);
    setRowsPerPage(newSize);
    setPage(0);
    localStorage.setItem(LS_PAGE_SIZE_KEY, String(newSize));
    setSearchParams((prev) => {
      const next = newSearchParams(prev);
      next.delete('page');
      return next;
    });
  };

  const handleSort = (field: SortField) => {
    const isAsc = sortField === field && sortOrder === 'asc';
    setSortOrder(isAsc ? 'desc' : 'asc');
    setSortField(field);
  };

  const newSearchParams = (prev: URLSearchParams) => new URLSearchParams(prev);

  // Filtered tables
  const filteredTables = tables.filter((tbl) => {
    if (
      searchFilter &&
      !tbl.tableName.toLowerCase().includes(searchFilter.toLowerCase())
    )
      return false;
    if (reloadFilter !== 'all' && tbl.reloadability !== reloadFilter)
      return false;
    return true;
  });

  // Sort tables
  const sortedTables = [...filteredTables].sort((a, b) => {
    let aVal: any = a[sortField];
    let bVal: any = b[sortField];

    if (sortField === 'uploadedAt') {
      aVal = aVal ? new Date(aVal).getTime() : 0;
      bVal = bVal ? new Date(bVal).getTime() : 0;
    } else if (
      sortField === 'tableName' ||
      sortField === 'reloadability' ||
      sortField === 'binaryCode'
    ) {
      aVal = aVal?.toString().toLowerCase() || '';
      bVal = bVal?.toString().toLowerCase() || '';
    }

    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  // Paginated tables
  const paginatedTables = sortedTables.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  // Stats
  const hotCount = tables.filter((tbl) => tbl.reloadability === 'hot').length;
  const restartCount = tables.filter(
    (tbl) => tbl.reloadability === 'restart'
  ).length;
  const unsyncedCount = tables.filter(
    (tbl) => tbl.runtime && !tbl.runtime.synced
  ).length;

  const renderInlineEditor = (version: number, isHistorical: boolean) => {
    if (editingVersion !== version) return null;
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          ...(isHistorical
            ? {
                borderBottom: '1px solid',
                borderColor: 'divider',
                bgcolor: isDark ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.02)',
                px: 2,
                py: 1.5,
              }
            : {
                border: '1px solid',
                borderColor: 'primary.main',
                borderTop: 'none',
                borderRadius: '0 0 8px 8px',
                bgcolor: isDark ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.02)',
                px: 2,
                py: 1.5,
                mb: 2,
              }),
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 1.5,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <EditIcon sx={{ fontSize: 16, color: 'primary.main' }} />
            <Typography
              variant="subtitle2"
              sx={{ fontWeight: 600, color: 'primary.main' }}
            >
              v{editingVersion} {t('cms.history.editingBased')}
            </Typography>
          </Box>
          <IconButton
            size="small"
            onClick={() => {
              const doClose = () => {
                setEditingVersion(null);
                setEditorData('');
                setEditorOriginalData('');
                setEditorComment('');
              };

              if (editorData !== editorOriginalData) {
                setPendingDiscardAction(() => doClose);
                setDiscardConfirmOpen(true);
                return;
              }
              doClose();
            }}
          >
            <CancelIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>
        <Alert
          severity="info"
          variant="outlined"
          sx={{
            mb: 1.5,
            py: 0.5,
            '& .MuiAlert-message': {
              fontSize: '0.75rem',
              lineHeight: 1.5,
            },
          }}
        >
          {t('cms.history.editGuide', { version: editingVersion })}
        </Alert>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {editorLoading ? (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                py: 4,
              }}
            >
              <CircularProgress size={28} />
            </Box>
          ) : (
            <Box sx={{ height: 360 }}>
              <JsonEditor
                value={editorData}
                onChange={setEditorData}
                height="100%"
                onValidation={(isValid) => setEditorJsonValid(isValid)}
                helperText={
                  !editorJsonValid
                    ? t('cms.detail.jsonSyntaxError')
                    : editorData !== editorOriginalData
                      ? t('cms.detail.hasChanges')
                      : t('cms.detail.currentData')
                }
              />
            </Box>
          )}
          <TextField
            size="small"
            label="Comment"
            value={editorComment}
            onChange={(e) => setEditorComment(e.target.value)}
            fullWidth
            required
            multiline
            minRows={2}
            placeholder={t('cms.detail.commentPlaceholder')}
          />
          <Box
            sx={{
              display: 'flex',
              gap: 1,
              justifyContent: 'flex-end',
            }}
          >
            <ButtonGroup variant="contained" size="small" ref={saveMenuRef}>
              <Button
                startIcon={
                  editorSaving ? <CircularProgress size={14} /> : <SaveIcon />
                }
                onClick={() => handleSave(false)}
                disabled={
                  editorSaving ||
                  !editorData.trim() ||
                  !editorComment.trim() ||
                  editorData === editorOriginalData ||
                  !editorJsonValid
                }
              >
                {t('cms.detail.save')}
              </Button>
              <Button
                onClick={() => setSaveMenuOpen((prev) => !prev)}
                disabled={
                  editorSaving ||
                  !editorComment.trim() ||
                  editorData === editorOriginalData ||
                  !editorJsonValid
                }
              >
                <ArrowDropDownIcon />
              </Button>
            </ButtonGroup>
            <Popper
              open={saveMenuOpen}
              anchorEl={saveMenuRef.current}
              placement="top-end"
              transition
              sx={{ zIndex: 1300 }}
            >
              {({ TransitionProps }) => (
                <Grow {...TransitionProps}>
                  <Paper elevation={8}>
                    <ClickAwayListener
                      onClickAway={() => setSaveMenuOpen(false)}
                    >
                      <MenuList>
                        <MenuItem onClick={() => handleSave(false)}>
                          <ListItemIcon>
                            <SaveIcon fontSize="small" />
                          </ListItemIcon>
                          <ListItemText>
                            {t('cms.detail.saveOnly')}
                          </ListItemText>
                        </MenuItem>
                        <MenuItem onClick={() => handleSave(true)}>
                          <ListItemIcon>
                            <RefreshIcon fontSize="small" color="primary" />
                          </ListItemIcon>
                          <ListItemText>
                            {t('cms.detail.saveAndRefresh')}
                          </ListItemText>
                        </MenuItem>
                      </MenuList>
                    </ClickAwayListener>
                  </Paper>
                </Grow>
              )}
            </Popper>
          </Box>
        </Box>
      </Box>
    );
  };

  // ── Upload Handler ──
  const handleUpload = async () => {
    if (!uploadTableName.trim() || !uploadComment.trim() || !uploadData.trim())
      return;

    setUploading(true);
    try {
      let parsedData: any;
      try {
        parsedData = JSON.parse(uploadData);
      } catch {
        enqueueSnackbar(t('cms.upload.invalidJson'), { variant: 'error' });
        setUploading(false);
        return;
      }

      const projectApiPath = getProjectApiPath();
      const result = await cmsService.uploadTable(
        projectApiPath,
        uploadTableName,
        parsedData,
        uploadComment,
        { refresh: uploadRefresh }
      );

      if (result.status === 'skipped') {
        enqueueSnackbar(t('cms.upload.skipped', { reason: result.reason }), {
          variant: 'info',
        });
      } else {
        enqueueSnackbar(
          t('cms.upload.success', {
            tableName: result.tableName,
            version: result.version,
          }),
          { variant: 'success' }
        );
      }

      setUploadOpen(false);
      setUploadTableName('');
      setUploadComment('');
      setUploadData('');
      fetchTables();
    } catch (err: any) {
      enqueueSnackbar(
        err.response?.data?.message || err.message || t('cms.upload.failed'),
        { variant: 'error' }
      );
    } finally {
      setUploading(false);
    }
  };

  // ── Detail Drawer ──
  const openDetail = async (tableName: string) => {
    setDetailTableName(tableName);
    setDetailOpen(true);
    setDetailTab(0); // 0 = History tab
    setEditorComment('');
    setEditingVersion(null);
    setHistoryData(null);
    setHistoryLoaded(false);
    setPropagationData([]);
    setPropagationLoaded(false);
    setViewingVersion(null);
    setViewingData(null);

    // Load history immediately (tab 0 = history)
    setHistoryLoading(true);
    try {
      const projectApiPath = getProjectApiPath();
      const result = await cmsService.getTableHistory(
        projectApiPath,
        tableName,
        30
      );
      setHistoryData(result);
      setHistoryLoaded(true);
    } catch {
      enqueueSnackbar(t('cms.history.loadFailed'), { variant: 'error' });
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchHistory = async (force = false) => {
    if (historyLoaded && !force) return;
    setHistoryLoading(true);
    try {
      const projectApiPath = getProjectApiPath();
      const result = await cmsService.getTableHistory(
        projectApiPath,
        detailTableName,
        30
      );
      setHistoryData(result);
      setHistoryLoaded(true);
    } catch {
      enqueueSnackbar(t('cms.history.loadFailed'), { variant: 'error' });
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchPropagation = async (force = false) => {
    if (propagationLoaded && !force) return;
    setPropagationLoading(true);
    try {
      const projectApiPath = getProjectApiPath();
      const result = await rippleService.getHistory(
        projectApiPath,
        undefined,
        200,
        'cms/reload'
      );
      const allItems = result.items || [];
      // Filter: only events related to this table (exact match, wildcard, or no tableName)
      const filtered = allItems.filter((evt) => {
        if (!evt.tableName || evt.tableName === '*') return true;
        const tables = evt.tableName.split(',').map((t) => t.trim());
        return tables.includes(detailTableName);
      });
      setPropagationData(filtered);
      setPropagationLoaded(true);
    } catch {
      // silent
    } finally {
      setPropagationLoading(false);
    }
  };

  const handleDetailTabChange = (_: any, newTab: number) => {
    setDetailTab(newTab);
    if (newTab === 0 && !historyLoaded) fetchHistory();
    if (newTab === 1 && !propagationLoaded) fetchPropagation();
  };

  // ── Start editing a version (inline) ──
  const executeStartEditing = async (version: number) => {
    setEditingVersion(version);
    setEditorComment('');
    setEditorLoading(true);
    setEditorJsonValid(true);
    try {
      const data = await fetchVersionData(detailTableName, version);
      const jsonStr = JSON.stringify(data, null, 2);
      setEditorData(jsonStr);
      setEditorOriginalData(jsonStr);
    } catch {
      setEditorData('');
      setEditorOriginalData('');
      enqueueSnackbar(t('cms.history.dataLoadFailed'), { variant: 'error' });
      setEditingVersion(null);
    } finally {
      setEditorLoading(false);
    }
  };

  const startEditing = async (version: number) => {
    if (
      editingVersion != null &&
      editingVersion !== version &&
      editorData !== editorOriginalData
    ) {
      setPendingDiscardAction(() => () => executeStartEditing(version));
      setDiscardConfirmOpen(true);
      return;
    }
    executeStartEditing(version);
  };

  // ── Fetch version data (with cache) ──
  const fetchVersionData = async (
    tableName: string,
    version: number
  ): Promise<any> => {
    const cacheKey = `${tableName}:${version}`;
    if (versionDataCache.current.has(cacheKey)) {
      return versionDataCache.current.get(cacheKey);
    }
    const projectApiPath = getProjectApiPath();
    const result = await cmsService.getTableVersionData(
      projectApiPath,
      tableName,
      version
    );
    versionDataCache.current.set(cacheKey, result.data);
    return result.data;
  };

  // ── Data Viewer Handler ──
  const viewVersionData = async (version: number) => {
    if (viewingVersion === version) {
      setViewingVersion(null);
      setViewingData(null);
      return;
    }
    setViewingVersion(version);
    setViewingDataLoading(true);
    try {
      const data = await fetchVersionData(detailTableName, version);
      setViewingData(data);
    } catch (err: any) {
      enqueueSnackbar(
        err.response?.data?.message ||
          err.message ||
          t('cms.history.dataLoadFailed'),
        { variant: 'error' }
      );
      setViewingVersion(null);
    } finally {
      setViewingDataLoading(false);
    }
  };

  // ── Toggle history entry (preserves viewMode) ──
  const toggleHistoryEntry = async (version: number, prevVersion?: number) => {
    if (viewingVersion === version) {
      // Close
      setViewingVersion(null);
      setViewingData(null);
      setDiffPatchText('');
      return;
    }
    // Open — always clear stale diff when switching versions
    setViewingVersion(version);
    setDiffPatchText('');
    setViewingDataLoading(true);
    try {
      const data = await fetchVersionData(detailTableName, version);
      setViewingData(data);
    } catch (err: any) {
      enqueueSnackbar(
        err.response?.data?.message ||
          err.message ||
          t('cms.history.dataLoadFailed'),
        { variant: 'error' }
      );
      setViewingVersion(null);
      return;
    } finally {
      setViewingDataLoading(false);
    }
    // If in diff mode and previous version exists, auto-load diff
    if (viewMode === 'diff' && prevVersion != null) {
      switchToDiff(version, prevVersion);
    }
  };

  // ── Switch to diff mode (try server-stored patch, fallback to worker) ──
  const switchToDiff = async (version: number, prevVersion: number) => {
    setViewMode('diff');
    setDiffLoading(true);
    try {
      // 1. Try pre-computed diff from server (instant)
      const projectApiPath = getProjectApiPath();
      const serverPatch = await cmsService.getTableVersionDiff(
        projectApiPath,
        detailTableName,
        version
      );
      if (serverPatch) {
        setDiffPatchText(serverPatch);
        return;
      }
      // 2. Fallback: compute diff client-side in Web Worker
      const [newData, oldData] = await Promise.all([
        fetchVersionData(detailTableName, version),
        fetchVersionData(detailTableName, prevVersion),
      ]);
      const oldStr = JSON.stringify(oldData, null, 2);
      const newStr = JSON.stringify(newData, null, 2);
      const patch = await computeDiffInWorker(
        oldStr,
        newStr,
        `v${prevVersion}`,
        `v${version}`
      );
      setDiffPatchText(patch);
    } catch (err: any) {
      enqueueSnackbar(
        err.response?.data?.message ||
          err.message ||
          'Failed to load diff data',
        { variant: 'error' }
      );
      setViewMode('data');
    } finally {
      setDiffLoading(false);
    }
  };

  // ── Save Handler (editor tab) ──
  const handleSave = async (withRefresh: boolean) => {
    if (!detailTableName || !editorData.trim()) return;
    setEditorSaving(true);
    setSaveMenuOpen(false);
    try {
      let parsedData: any;
      try {
        parsedData = JSON.parse(editorData);
      } catch {
        enqueueSnackbar(t('cms.upload.invalidJson'), { variant: 'error' });
        setEditorSaving(false);
        return;
      }
      const projectApiPath = getProjectApiPath();
      const result = await cmsService.uploadTable(
        projectApiPath,
        detailTableName,
        parsedData,
        editorComment || 'Updated via editor',
        { refresh: withRefresh }
      );
      if (result.status === 'skipped') {
        enqueueSnackbar(t('cms.upload.skipped', { reason: result.reason }), {
          variant: 'info',
        });
      } else {
        enqueueSnackbar(
          t('cms.upload.success', {
            tableName: result.tableName,
            version: result.version,
          }),
          { variant: 'success' }
        );
        setEditingVersion(null); // Close inline editor
        setHistoryLoaded(false); // Force reload history
        fetchHistory(true); // Reload history list
        fetchTables();

        // Open tracking if refresh was triggered
        if (withRefresh && result.refresh?.requestId) {
          setTrackingRequestId(result.refresh.requestId);
          setTrackingPattern(result.refresh.pattern || 'cms/reload');
          setTrackingMatchedKeys([]);
          setTrackingTargetTables([detailTableName]);
          setTrackingDialogOpen(true);
          setPropagationLoaded(false);
          if (detailTab === 1) fetchPropagation(true);
        }
      }
    } catch (err: any) {
      enqueueSnackbar(
        err.response?.data?.message || err.message || t('cms.upload.failed'),
        { variant: 'error' }
      );
    } finally {
      setEditorSaving(false);
    }
  };

  // ── Force Refresh (no data change) ──
  const handleForceRefresh = async () => {
    if (!detailTableName) return;
    try {
      const projectApiPath = getProjectApiPath();
      const result = await rippleService.triggerRefresh(
        projectApiPath,
        'cms/reload',
        false,
        { tableName: detailTableName }
      );
      enqueueSnackbar(t('cms.refreshTable.success', { key: detailTableName }), {
        variant: 'success',
      });
      setTrackingRequestId(result.requestId);
      setTrackingPattern('cms/reload');
      setTrackingMatchedKeys(result.matchedKeys || []);
      setTrackingTargetTables([detailTableName]);
      setTrackingDialogOpen(true);
      setPropagationLoaded(false);
      if (detailTab === 1) fetchPropagation(true);
      // Re-fetch tables after servers reload to update synced status
      setTimeout(() => fetchTables(), 2000);
    } catch (err: any) {
      enqueueSnackbar(
        err.response?.data?.message ||
          err.message ||
          t('cms.refreshTable.failed'),
        { variant: 'error' }
      );
    }
  };

  // ── Bulk Refresh ──
  const handleBulkRefresh = async () => {
    if (selectedTables.size === 0) return;
    try {
      const projectApiPath = getProjectApiPath();
      const tableNameList = Array.from(selectedTables).join(',');
      const result = await rippleService.triggerRefresh(
        projectApiPath,
        'cms/reload',
        false,
        { tableName: tableNameList }
      );
      enqueueSnackbar(
        t('cms.refreshTable.success', { key: `${selectedTables.size} tables` }),
        { variant: 'success' }
      );
      setTrackingRequestId(result.requestId);
      setTrackingPattern('cms/reload');
      setTrackingMatchedKeys(result.matchedKeys || []);
      setTrackingTargetTables(Array.from(selectedTables));
      setTrackingDialogOpen(true);
      // Re-fetch tables after servers reload to update synced status
      setTimeout(() => fetchTables(), 2000);
    } catch {
      enqueueSnackbar(t('cms.refreshTable.failed'), { variant: 'error' });
    }
    setSelectedTables(new Set());
  };

  // ── Refresh All Unsynced ──
  const openUnsyncedDialog = () => {
    const unsyncedTables = tables.filter(
      (tbl) => tbl.runtime && !tbl.runtime.synced
    );
    setUnsyncedSelected(new Set(unsyncedTables.map((t) => t.tableName)));
    setUnsyncedDialogOpen(true);
  };

  const handleRefreshSelectedUnsynced = async () => {
    if (unsyncedSelected.size === 0) return;
    setUnsyncedRefreshing(true);
    try {
      const projectApiPath = getProjectApiPath();
      const tableNameList = Array.from(unsyncedSelected).join(',');
      const result = await rippleService.triggerRefresh(
        projectApiPath,
        'cms/reload',
        false,
        { tableName: tableNameList }
      );
      enqueueSnackbar(
        t('cms.refreshTable.success', {
          key: `${unsyncedSelected.size} tables`,
        }),
        { variant: 'success' }
      );
      setTrackingRequestId(result.requestId);
      setTrackingPattern('cms/reload');
      setTrackingMatchedKeys(result.matchedKeys || []);
      setTrackingTargetTables(Array.from(unsyncedSelected));
      setTrackingDialogOpen(true);
      setUnsyncedDialogOpen(false);
      setTimeout(() => fetchTables(), 2000);
    } catch {
      enqueueSnackbar(t('cms.refreshTable.failed'), { variant: 'error' });
    } finally {
      setUnsyncedRefreshing(false);
    }
  };

  // ── Rollback Handler ──
  const confirmRollback = async (tableName: string, version: number) => {
    setRollbackTableName(tableName);
    setRollbackVersion(version);
    setRollbackDiffText('');
    setRollbackDiffLoading(true);
    setRollbackComment('');
    const tbl = tables.find((t2) => t2.tableName === tableName);
    setRollbackCurrentVersion(tbl?.version || historyData?.activeVersion || 0);
    setRollbackOpen(true);

    try {
      const tbl = tables.find((t2) => t2.tableName === tableName);
      const currentVersion = tbl?.version || historyData?.activeVersion;
      if (currentVersion && currentVersion !== version) {
        const [curData, tgtData] = await Promise.all([
          fetchVersionData(tableName, currentVersion),
          fetchVersionData(tableName, version),
        ]);
        const oldStr = JSON.stringify(curData, null, 2);
        const newStr = JSON.stringify(tgtData, null, 2);
        const patch = await computeDiffInWorker(
          oldStr,
          newStr,
          `v${currentVersion} (current)`,
          `v${version} (rollback target)`
        );
        setRollbackDiffText(patch);
      }
    } catch (err: any) {
      setRollbackDiffText('');
    } finally {
      setRollbackDiffLoading(false);
    }
  };

  const handleRollback = async () => {
    setRollbackLoading(true);
    try {
      const projectApiPath = getProjectApiPath();
      const result = await cmsService.rollbackTable(
        projectApiPath,
        rollbackTableName,
        rollbackVersion,
        { refresh: rollbackRefresh, comment: rollbackComment }
      );
      enqueueSnackbar(
        t('cms.rollback.success', {
          tableName: result.tableName,
          rolledBackToVersion: result.rolledBackToVersion,
          newVersion: result.newVersion,
        }),
        { variant: 'success' }
      );
      setRollbackOpen(false);
      setDetailOpen(false);
      fetchTables();
    } catch (err: any) {
      enqueueSnackbar(
        err.response?.data?.message || err.message || t('cms.rollback.failed'),
        { variant: 'error' }
      );
    } finally {
      setRollbackLoading(false);
    }
  };

  // ── Refresh single table ──
  const handleRefreshTable = async (tableName: string) => {
    try {
      const projectApiPath = getProjectApiPath();
      const result = await rippleService.triggerRefresh(
        projectApiPath,
        'cms/reload',
        false,
        { tableName }
      );
      enqueueSnackbar(t('cms.refreshTable.success', { key: tableName }), {
        variant: 'success',
      });

      // Open tracking dialog
      setTrackingRequestId(result.requestId);
      setTrackingPattern('cms/reload');
      setTrackingMatchedKeys(result.matchedKeys || []);
      setTrackingTargetTables([tableName]);
      setTrackingDialogOpen(true);
      setPropagationLoaded(false);
      if (detailTab === 1) fetchPropagation(true);
      // Re-fetch tables after servers reload to update synced status
      setTimeout(() => fetchTables(), 2000);
    } catch (err: any) {
      enqueueSnackbar(
        err.response?.data?.message ||
          err.message ||
          t('cms.refreshTable.failed'),
        { variant: 'error' }
      );
    }
  };

  const requestRefreshTable = (tableName: string) => {
    setRefreshConfirmTableName(tableName);
    setRefreshConfirmOpen(true);
    // Compute diff for this table
    const tbl = tables.find((t) => t.tableName === tableName);
    if (tbl?.runtime && !tbl.runtime.synced) {
      setRefreshConfirmDiff({ loading: true, text: '' });
      (async () => {
        try {
          const [curData, svrData] = await Promise.all([
            fetchVersionData(tableName, tbl.version),
            fetchVersionData(tableName, tbl.runtime!.loadedVersion),
          ]);
          const patch = await computeDiffInWorker(
            JSON.stringify(svrData, null, 2),
            JSON.stringify(curData, null, 2),
            `v${tbl.runtime!.loadedVersion} (server)`,
            `v${tbl.version} (saved)`
          );
          setRefreshConfirmDiff({ loading: false, text: patch });
        } catch {
          setRefreshConfirmDiff({ loading: false, text: '' });
        }
      })();
    } else {
      setRefreshConfirmDiff({ loading: false, text: '' });
    }
  };

  // ── File upload handler ──
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const name = file.name.replace(/\.json$/i, '');
    if (!uploadTableName) setUploadTableName(name);

    const reader = new FileReader();
    reader.onload = () => {
      setUploadData(reader.result as string);
    };
    reader.readAsText(file);
  };

  return (
    <Box sx={{ p: 2 }}>
      <PageHeader
        icon={<TableChartIcon />}
        title={t('cms.title')}
        subtitle={t('cms.subtitle')}
        actions={
          !loading && !noAdmind ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {admindUrl && (
                <>
                  <Chip
                    label={admindUrl}
                    size="small"
                    variant="outlined"
                    sx={{
                      color: 'text.secondary',
                      borderColor: 'divider',
                    }}
                  />
                  <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
                </>
              )}
              <Button
                variant="contained"
                startIcon={<UploadIcon />}
                onClick={() => setUploadOpen(true)}
              >
                {t('cms.upload.execute')}
              </Button>
              <Button
                variant="contained"
                startIcon={<RefreshIcon />}
                onClick={fetchTables}
              >
                {t('common.refresh')}
              </Button>
            </Box>
          ) : undefined
        }
      />

      <PageContentLoader loading={loading}>
        {noAdmind ? (
          <EmptyPlaceholder
            message={t('cms.noAdmind.title')}
            description={t('cms.noAdmind.description')}
            minHeight={300}
          />
        ) : (
          <>
            {error && (
              <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
                {error}
              </Alert>
            )}

            {/* Compact filter chips + search */}
            <Box
              sx={{ display: 'flex', gap: 1.5, mb: 2, alignItems: 'center' }}
            >
              <SearchTextField
                value={searchFilter}
                onChange={setSearchFilter}
                placeholder={t('cms.searchPlaceholder')}
              />
              <Box
                sx={{
                  display: 'flex',
                  gap: 1,
                  ml: 'auto',
                  alignItems: 'center',
                }}
              >
                <Chip
                  size="small"
                  icon={<StorageIcon sx={{ fontSize: 14 }} />}
                  label={`${t('cms.allTables')} ${tables.length}`}
                  color={reloadFilter === 'all' ? 'primary' : 'default'}
                  variant={reloadFilter === 'all' ? 'filled' : 'outlined'}
                  onClick={() => handleSetReloadFilter('all')}
                  sx={{ fontWeight: 600, cursor: 'pointer' }}
                />
                <Chip
                  size="small"
                  icon={<CloudSyncIcon sx={{ fontSize: 14 }} />}
                  label={`${t('cms.hotReload')} ${hotCount}`}
                  color={reloadFilter === 'hot' ? 'success' : 'default'}
                  variant={reloadFilter === 'hot' ? 'filled' : 'outlined'}
                  onClick={() => handleSetReloadFilter('hot')}
                  sx={{ fontWeight: 600, cursor: 'pointer' }}
                />
                <Chip
                  size="small"
                  icon={<RestartAltIcon sx={{ fontSize: 14 }} />}
                  label={`${t('cms.restartRequired')} ${restartCount}`}
                  color={reloadFilter === 'restart' ? 'warning' : 'default'}
                  variant={reloadFilter === 'restart' ? 'filled' : 'outlined'}
                  onClick={() => handleSetReloadFilter('restart')}
                  sx={{ fontWeight: 600, cursor: 'pointer' }}
                />
                {unsyncedCount > 0 && (
                  <>
                    <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
                    <Button
                      size="small"
                      variant="contained"
                      color="error"
                      startIcon={<RefreshIcon sx={{ fontSize: 14 }} />}
                      onClick={openUnsyncedDialog}
                      sx={{
                        fontWeight: 600,
                        borderRadius: 8,
                        px: 2,
                        height: 24,
                        fontSize: '0.8125rem',
                        textTransform: 'none',
                        boxShadow: 'none',
                      }}
                    >
                      {t('cms.unsyncedCount', { count: unsyncedCount })}
                    </Button>
                  </>
                )}
              </Box>
            </Box>

            {/* Selection Toolbar */}
            {selectedTables.size > 0 && (
              <Paper
                variant="outlined"
                sx={{
                  mb: 1.5,
                  px: 2,
                  py: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  borderColor: 'primary.main',
                  bgcolor: (theme) =>
                    theme.palette.mode === 'dark'
                      ? 'rgba(144,202,249,0.08)'
                      : 'rgba(25,118,210,0.04)',
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {t('cms.selectedCount', { count: selectedTables.size })}
                </Typography>
                <Button
                  size="small"
                  variant="contained"
                  color="primary"
                  startIcon={<RefreshIcon />}
                  onClick={handleBulkRefresh}
                >
                  {t('cms.bulkRefresh')}
                </Button>
                <Button
                  size="small"
                  variant="text"
                  onClick={() => setSelectedTables(new Set())}
                >
                  {t('cms.clearSelection')}
                </Button>
              </Paper>
            )}

            {/* Table */}
            {filteredTables.length === 0 ? (
              <EmptyPlaceholder
                message={
                  searchFilter ? t('cms.noSearchResults') : t('cms.noTables')
                }
                minHeight={200}
              />
            ) : (
              <Paper variant="outlined">
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell padding="checkbox" sx={{ width: 42 }}>
                          <Checkbox
                            size="small"
                            indeterminate={
                              selectedTables.size > 0 &&
                              selectedTables.size < paginatedTables.length
                            }
                            checked={
                              paginatedTables.length > 0 &&
                              paginatedTables.every((t2) =>
                                selectedTables.has(t2.tableName)
                              )
                            }
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedTables(
                                  new Set(
                                    paginatedTables.map((t2) => t2.tableName)
                                  )
                                );
                              } else {
                                setSelectedTables(new Set());
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>
                          <TableSortLabel
                            active={sortField === 'tableName'}
                            direction={
                              sortField === 'tableName' ? sortOrder : 'asc'
                            }
                            onClick={() => handleSort('tableName')}
                          >
                            {t('cms.tableName')}
                          </TableSortLabel>
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>
                          <TableSortLabel
                            active={sortField === 'binaryCode'}
                            direction={
                              sortField === 'binaryCode' ? sortOrder : 'asc'
                            }
                            onClick={() => handleSort('binaryCode')}
                          >
                            {t('cms.binaryCode')}
                          </TableSortLabel>
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>
                          <TableSortLabel
                            active={sortField === 'version'}
                            direction={
                              sortField === 'version' ? sortOrder : 'asc'
                            }
                            onClick={() => handleSort('version')}
                          >
                            {t('cms.version')}
                          </TableSortLabel>
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>
                          {t('cms.hash')}
                        </TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700 }}>
                          <TableSortLabel
                            active={sortField === 'reloadability'}
                            direction={
                              sortField === 'reloadability' ? sortOrder : 'asc'
                            }
                            onClick={() => handleSort('reloadability')}
                          >
                            {t('cms.reload')}
                          </TableSortLabel>
                        </TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700 }}>
                          Sync
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>
                          <TableSortLabel
                            active={sortField === 'dataSize'}
                            direction={
                              sortField === 'dataSize' ? sortOrder : 'asc'
                            }
                            onClick={() => handleSort('dataSize')}
                          >
                            {t('cms.size')}
                          </TableSortLabel>
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>
                          <TableSortLabel
                            active={sortField === 'uploadedAt'}
                            direction={
                              sortField === 'uploadedAt' ? sortOrder : 'asc'
                            }
                            onClick={() => handleSort('uploadedAt')}
                          >
                            {t('cms.uploadedAt')}
                          </TableSortLabel>
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>
                          {t('cms.uploadedBy')}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>
                          {t('cms.comment')}
                        </TableCell>
                        <TableCell
                          sx={{ fontWeight: 700, width: 48 }}
                          align="center"
                        ></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {paginatedTables.map((table) => (
                        <TableRow
                          key={`${table.tableName}-${table.binaryCode || 'base'}`}
                          hover
                          selected={selectedTables.has(table.tableName)}
                        >
                          <TableCell padding="checkbox">
                            <Checkbox
                              size="small"
                              checked={selectedTables.has(table.tableName)}
                              onChange={(e) => {
                                setSelectedTables((prev) => {
                                  const next = new Set(prev);
                                  if (e.target.checked)
                                    next.add(table.tableName);
                                  else next.delete(table.tableName);
                                  return next;
                                });
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Typography
                              variant="body2"
                              sx={{
                                fontWeight: 600,
                                fontFamily: 'monospace',
                                cursor: 'pointer',
                                color: 'primary.main',
                                '&:hover': { textDecoration: 'underline' },
                              }}
                              onClick={() => openDetail(table.tableName)}
                            >
                              {table.tableName}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {table.binaryCode ? (
                              <Chip
                                label={table.binaryCode}
                                size="small"
                                color="secondary"
                                sx={{ fontSize: '0.65rem', height: 18 }}
                              />
                            ) : (
                              <Typography
                                variant="caption"
                                color="text.disabled"
                              >
                                —
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={`v${table.version}`}
                              size="small"
                              variant="filled"
                              color="info"
                              sx={{ fontFamily: 'monospace', fontWeight: 700 }}
                            />
                          </TableCell>
                          <TableCell>
                            <Typography
                              variant="caption"
                              sx={{ fontFamily: 'monospace' }}
                            >
                              {table.contentHash?.slice(0, 8)}..
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              icon={
                                table.reloadability === 'hot' ? (
                                  <CheckCircleIcon />
                                ) : (
                                  <WarningIcon />
                                )
                              }
                              label={
                                table.reloadability === 'hot'
                                  ? t('cms.reloadHot')
                                  : t('cms.reloadRestart')
                              }
                              size="small"
                              color={
                                table.reloadability === 'hot'
                                  ? 'success'
                                  : 'warning'
                              }
                              variant="outlined"
                              sx={{ fontSize: '0.7rem' }}
                            />
                          </TableCell>
                          <TableCell align="center">
                            {table.runtime ? (
                              table.runtime.synced ? (
                                <Chip
                                  label={t('cms.synced')}
                                  size="small"
                                  variant="filled"
                                  sx={{
                                    fontSize: '0.68rem',
                                    height: 22,
                                    bgcolor: '#4caf50',
                                    color: '#fff',
                                  }}
                                />
                              ) : (
                                <Tooltip
                                  title={t('cms.unsyncedTooltip', {
                                    server: table.runtime.loadedVersion,
                                    db: table.version,
                                  })}
                                >
                                  <Chip
                                    label={`v${table.runtime.loadedVersion} ≠ v${table.version}`}
                                    size="small"
                                    color="warning"
                                    variant="filled"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      requestRefreshTable(table.tableName);
                                    }}
                                    sx={{
                                      fontSize: '0.68rem',
                                      fontFamily: 'monospace',
                                      fontWeight: 700,
                                      height: 22,
                                      cursor: 'pointer',
                                      bgcolor: '#ef6c00',
                                      color: '#fff',
                                    }}
                                  />
                                </Tooltip>
                              )
                            ) : (
                              <Typography
                                variant="caption"
                                color="text.disabled"
                              >
                                —
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption">
                              {formatBytes(table.dataSize)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Tooltip
                              title={new Date(table.uploadedAt).toLocaleString(
                                'ko-KR'
                              )}
                            >
                              <Typography
                                variant="caption"
                                sx={{ cursor: 'help' }}
                              >
                                {formatRelativeTime(table.uploadedAt)}
                              </Typography>
                            </Tooltip>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption">
                              {table.uploadedBy || '—'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{
                                maxWidth: 150,
                                display: 'block',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {table.comment || '—'}
                            </Typography>
                          </TableCell>
                          <TableCell align="center" sx={{ px: 0 }}>
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                setRowMenuAnchor(e.currentTarget);
                                setRowMenuTable(table);
                              }}
                            >
                              <MoreVertIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                <SimplePagination
                  count={filteredTables.length}
                  page={page}
                  rowsPerPage={rowsPerPage}
                  onPageChange={handleChangePage}
                  onRowsPerPageChange={handleChangeRowsPerPage}
                />
              </Paper>
            )}
          </>
        )}
      </PageContentLoader>

      {/* Row Context Menu */}
      <Menu
        anchorEl={rowMenuAnchor}
        open={Boolean(rowMenuAnchor)}
        onClose={() => {
          setRowMenuAnchor(null);
          setRowMenuTable(null);
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem
          onClick={() => {
            if (rowMenuTable) openDetail(rowMenuTable.tableName);
            setRowMenuAnchor(null);
          }}
        >
          <ListItemIcon>
            <HistoryIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('cms.history.menuLabel')}</ListItemText>
        </MenuItem>
        {rowMenuTable?.reloadability === 'hot' && (
          <MenuItem
            onClick={() => {
              if (rowMenuTable) requestRefreshTable(rowMenuTable.tableName);
              setRowMenuAnchor(null);
            }}
          >
            <ListItemIcon>
              <RefreshIcon fontSize="small" color="primary" />
            </ListItemIcon>
            <ListItemText>{t('cms.refresh')} (Hot-Reload)</ListItemText>
          </MenuItem>
        )}
      </Menu>

      {/* Upload Dialog */}
      <Dialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>{t('cms.upload.title')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label={t('cms.upload.tableName')}
              value={uploadTableName}
              onChange={(e) => setUploadTableName(e.target.value)}
              fullWidth
              placeholder={t('cms.upload.tableNamePlaceholder')}
            />
            <TextField
              label={t('cms.upload.comment')}
              value={uploadComment}
              onChange={(e) => setUploadComment(e.target.value)}
              fullWidth
              placeholder={t('cms.upload.commentPlaceholder')}
            />
            <Box>
              <Button variant="contained" component="label" size="small">
                {t('cms.upload.selectFile')}
                <input
                  type="file"
                  accept=".json"
                  hidden
                  onChange={handleFileSelect}
                />
              </Button>
              {uploadData && (
                <Typography variant="caption" sx={{ ml: 1 }}>
                  (
                  {t('cms.upload.fileLoaded', {
                    size: formatBytes(uploadData.length),
                  })}
                  )
                </Typography>
              )}
            </Box>
            <TextField
              label={t('cms.upload.jsonData')}
              value={uploadData}
              onChange={(e) => setUploadData(e.target.value)}
              fullWidth
              multiline
              rows={6}
              placeholder={t('cms.upload.jsonDataPlaceholder')}
              sx={{
                '& textarea': {
                  fontFamily: 'monospace',
                  fontSize: '0.8rem',
                },
              }}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={uploadRefresh}
                  onChange={(e) => setUploadRefresh(e.target.checked)}
                />
              }
              label={t('cms.upload.triggerRefresh')}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            onClick={handleUpload}
            disabled={
              uploading ||
              !uploadTableName.trim() ||
              !uploadComment.trim() ||
              !uploadData.trim()
            }
            startIcon={
              uploading ? <CircularProgress size={16} /> : <UploadIcon />
            }
          >
            {t('cms.upload.execute')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Detail Drawer (2-tab: History, Propagation) */}
      <ResizableDrawer
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setViewingVersion(null);
          setViewingData(null);
          setEditingVersion(null);
          setEditorData('');
          setEditorOriginalData('');
          setEditorComment('');
        }}
        title={detailTableName}
        subtitle={(() => {
          const tbl = tables.find((t2) => t2.tableName === detailTableName);
          return tbl
            ? `v${tbl.version} · ${formatBytes(tbl.dataSize)}`
            : undefined;
        })()}
        storageKey="cmsDetail.drawer.width"
        defaultWidth={640}
        minWidth={480}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            minHeight: 0,
          }}
        >
          <Tabs
            value={detailTab}
            onChange={handleDetailTabChange}
            sx={{
              borderBottom: 1,
              borderColor: 'divider',
              flexShrink: 0,
              px: 2,
            }}
          >
            <Tab label={t('cms.detail.tabHistory')} />
            <Tab label={t('cms.detail.tabRipple')} />
          </Tabs>

          {/* ── Tab 0: History (Timeline) ── */}
          {detailTab === 0 && (
            <Box
              sx={{
                p: 2,
                flex: 1,
                minHeight: 0,
                overflow: 'auto',
              }}
            >
              {historyLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                  <CircularProgress />
                </Box>
              ) : historyData?.history?.length ? (
                <>
                  {/* ── Inline Editor used to be here ── */}
                  {/* ── Active (current) version ── */}
                  {(() => {
                    const active = historyData.history[0];
                    const isViewing = viewingVersion === active.version;
                    const prevVersion =
                      historyData.history.length > 1
                        ? historyData.history[1].version
                        : undefined;
                    return (
                      <>
                        <Box
                          onClick={() =>
                            toggleHistoryEntry(active.version, prevVersion)
                          }
                          sx={{
                            border: '1px solid',
                            borderColor: isDark
                              ? 'success.dark'
                              : 'success.light',
                            borderRadius:
                              isViewing || editingVersion === active.version
                                ? '8px 8px 0 0'
                                : 2,
                            cursor: 'pointer',
                            bgcolor: isDark
                              ? 'rgba(76,175,80,0.06)'
                              : 'rgba(76,175,80,0.03)',
                            transition: 'background-color 0.15s',
                            '&:hover': {
                              bgcolor: isDark
                                ? 'rgba(76,175,80,0.1)'
                                : 'rgba(76,175,80,0.06)',
                            },
                            ...(!isViewing &&
                              editingVersion !== active.version && { mb: 2 }),
                            ...(isViewing && {
                              bgcolor: isDark
                                ? 'rgba(25,118,210,0.08)'
                                : 'rgba(25,118,210,0.04)',
                              borderColor: 'primary.main',
                            }),
                          }}
                        >
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              py: 1.25,
                              px: 2,
                            }}
                          >
                            <CheckCircleIcon
                              sx={{
                                fontSize: 18,
                                color: 'success.main',
                                mr: 1.5,
                                flexShrink: 0,
                              }}
                            />
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography
                                variant="body2"
                                sx={{
                                  fontWeight: 500,
                                  fontSize: '0.82rem',
                                  lineHeight: 1.4,
                                  mb: 0.5,
                                  color: active.comment
                                    ? 'text.primary'
                                    : 'text.disabled',
                                  ...(!active.comment && {
                                    fontStyle: 'italic',
                                    fontWeight: 400,
                                  }),
                                }}
                              >
                                {active.comment || t('cms.history.noComment')}
                              </Typography>
                              <Box
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 0.75,
                                }}
                              >
                                <Typography
                                  variant="caption"
                                  sx={{
                                    fontWeight: 600,
                                    color: 'text.secondary',
                                    fontSize: '0.72rem',
                                  }}
                                >
                                  {active.uploadedBy || '—'}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  sx={{
                                    color: 'text.disabled',
                                    fontSize: '0.7rem',
                                  }}
                                >
                                  pushed
                                </Typography>
                                <Tooltip
                                  title={new Date(
                                    active.uploadedAt
                                  ).toLocaleString('ko-KR')}
                                >
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      color: 'text.disabled',
                                      cursor: 'help',
                                      fontSize: '0.7rem',
                                    }}
                                  >
                                    {formatRelativeTime(active.uploadedAt)}
                                  </Typography>
                                </Tooltip>
                              </Box>
                            </Box>
                            <Box
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                                flexShrink: 0,
                                pl: 1,
                              }}
                            >
                              <Tooltip title={active.contentHash || ''}>
                                <Box
                                  sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    borderRadius: 1.5,
                                    px: 1,
                                    py: 0.25,
                                    height: 22,
                                    bgcolor: isDark
                                      ? 'rgba(255,255,255,0.04)'
                                      : 'rgba(0,0,0,0.03)',
                                  }}
                                >
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      fontFamily: 'monospace',
                                      fontWeight: 600,
                                      fontSize: '0.7rem',
                                      color: 'primary.main',
                                      userSelect: 'all',
                                    }}
                                  >
                                    {active.contentHash?.slice(0, 7)}
                                  </Typography>
                                </Box>
                              </Tooltip>
                              <Chip
                                label={`v${active.version}`}
                                size="small"
                                variant="filled"
                                color="success"
                                sx={{
                                  fontWeight: 700,
                                  fontFamily: 'monospace',
                                  fontSize: '0.7rem',
                                  height: 22,
                                  minWidth: 36,
                                }}
                              />
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setVersionMenuAnchor(e.currentTarget);
                                  setVersionMenuEntry({
                                    version: active.version,
                                    isActive: true,
                                  });
                                }}
                                sx={{ p: 0.25 }}
                              >
                                <MoreVertIcon sx={{ fontSize: 17 }} />
                              </IconButton>
                            </Box>
                          </Box>
                        </Box>
                        {/* Expanded panel for active entry */}
                        {isViewing && editingVersion !== active.version && (
                          <Box
                            sx={{
                              ...(viewMode === 'data' ? {} : {}),
                              display: 'flex',
                              flexDirection: 'column',
                              border: '1px solid',
                              borderColor: 'primary.main',
                              borderTop: 'none',
                              borderRadius: '0 0 8px 8px',
                              bgcolor: isDark
                                ? 'rgba(0,0,0,0.15)'
                                : 'rgba(0,0,0,0.02)',
                              px: 2,
                              py: 1.5,
                              mb: 2,
                            }}
                          >
                            {historyData.history.length > 0 && (
                              <Box
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  mb: 1,
                                }}
                              >
                                <ButtonGroup
                                  size="small"
                                  variant="outlined"
                                  sx={{ height: 26 }}
                                >
                                  <Button
                                    variant={
                                      viewMode === 'data'
                                        ? 'contained'
                                        : 'outlined'
                                    }
                                    onClick={() => setViewMode('data')}
                                    sx={{
                                      fontSize: '0.7rem',
                                      px: 1.5,
                                      textTransform: 'none',
                                    }}
                                  >
                                    Data
                                  </Button>
                                  <Button
                                    variant={
                                      viewMode === 'diff'
                                        ? 'contained'
                                        : 'outlined'
                                    }
                                    onClick={() =>
                                      prevVersion != null
                                        ? switchToDiff(
                                            active.version,
                                            prevVersion
                                          )
                                        : setViewMode('diff')
                                    }
                                    startIcon={
                                      <CompareArrowsIcon
                                        sx={{ fontSize: '14px !important' }}
                                      />
                                    }
                                    sx={{
                                      fontSize: '0.7rem',
                                      px: 1.5,
                                      textTransform: 'none',
                                    }}
                                  >
                                    Diff
                                  </Button>
                                </ButtonGroup>
                                {viewMode === 'diff' && prevVersion != null && (
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      ml: 1,
                                      color: 'text.disabled',
                                      fontSize: '0.68rem',
                                    }}
                                  >
                                    v{prevVersion} → v{active.version}
                                  </Typography>
                                )}
                              </Box>
                            )}
                            {viewMode === 'data' &&
                              (viewingDataLoading ? (
                                <Box
                                  sx={{
                                    display: 'flex',
                                    justifyContent: 'center',
                                    py: 2,
                                  }}
                                >
                                  <CircularProgress size={24} />
                                </Box>
                              ) : viewingData ? (
                                <JsonEditor
                                  value={JSON.stringify(viewingData, null, 2)}
                                  onChange={() => {}}
                                  readOnly
                                  height={400}
                                />
                              ) : null)}
                            {viewMode === 'diff' &&
                              (diffLoading ? (
                                <Box
                                  sx={{
                                    display: 'flex',
                                    justifyContent: 'center',
                                    py: 3,
                                  }}
                                >
                                  <CircularProgress size={24} />
                                </Box>
                              ) : (
                                <LightDiff
                                  patchText={diffPatchText}
                                  dark={isDark}
                                  noDiffMessage={t(
                                    'cms.history.noDiffAvailable'
                                  )}
                                />
                              ))}
                          </Box>
                        )}
                        {renderInlineEditor(active.version, false)}
                      </>
                    );
                  })()}

                  {/* ── Past versions ── */}
                  {historyData.history.length > 1 && (
                    <>
                      <Box
                        sx={{
                          border: '1px solid',
                          borderColor: 'divider',
                          borderRadius: 2,
                          overflow: 'hidden',
                          ...(viewingVersion != null &&
                          viewingVersion !== historyData.history[0].version &&
                          viewMode === 'data'
                            ? {
                                flex: 1,
                                minHeight: 0,
                                display: 'flex',
                                flexDirection: 'column',
                                overflow: 'hidden',
                              }
                            : {}),
                        }}
                      >
                        {historyData.history.slice(1).map((entry, idx) => {
                          const realIdx = idx + 1;
                          const isLast =
                            realIdx === historyData.history.length - 1;
                          const isViewing = viewingVersion === entry.version;
                          const prevVersion = !isLast
                            ? historyData.history[realIdx + 1]?.version
                            : undefined;
                          return (
                            <React.Fragment key={entry.version}>
                              {/* ── Commit-style row ── */}
                              <Box
                                onClick={() =>
                                  toggleHistoryEntry(entry.version, prevVersion)
                                }
                                sx={{
                                  display: 'flex',
                                  alignItems: 'stretch',
                                  cursor: 'pointer',
                                  borderBottom:
                                    isLast && !isViewing ? 'none' : '1px solid',
                                  borderColor: 'divider',
                                  transition: 'background-color 0.15s',
                                  '&:hover': {
                                    bgcolor: isDark
                                      ? 'rgba(255,255,255,0.025)'
                                      : 'rgba(0,0,0,0.015)',
                                  },
                                  ...(isViewing && {
                                    bgcolor: isDark
                                      ? 'rgba(25,118,210,0.06)'
                                      : 'rgba(25,118,210,0.04)',
                                  }),
                                }}
                              >
                                {/* Version icon */}
                                <Box
                                  sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    pl: 2,
                                    flexShrink: 0,
                                  }}
                                >
                                  <HistoryIcon
                                    sx={{
                                      fontSize: 18,
                                      color: 'text.disabled',
                                    }}
                                  />
                                </Box>
                                {/* Main content area */}
                                <Box
                                  sx={{
                                    flex: 1,
                                    minWidth: 0,
                                    py: 1.25,
                                    px: 1.5,
                                  }}
                                >
                                  {/* Row 1: Commit message (primary) */}
                                  <Typography
                                    variant="body2"
                                    sx={{
                                      fontWeight: 500,
                                      fontSize: '0.82rem',
                                      lineHeight: 1.4,
                                      color: 'text.primary',
                                      mb: 0.5,
                                      display: '-webkit-box',
                                      WebkitLineClamp: 2,
                                      WebkitBoxOrient: 'vertical',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      ...(!entry.comment && {
                                        color: 'text.disabled',
                                        fontStyle: 'italic',
                                        fontWeight: 400,
                                      }),
                                    }}
                                  >
                                    {entry.comment ||
                                      t('cms.history.noComment')}
                                  </Typography>

                                  {/* Row 2: Metadata line */}
                                  <Box
                                    sx={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 0.75,
                                      flexWrap: 'wrap',
                                    }}
                                  >
                                    <Typography
                                      variant="caption"
                                      sx={{
                                        fontWeight: 600,
                                        color: 'text.secondary',
                                        fontSize: '0.72rem',
                                      }}
                                    >
                                      {entry.uploadedBy || '—'}
                                    </Typography>
                                    <Typography
                                      variant="caption"
                                      sx={{
                                        color: 'text.disabled',
                                        fontSize: '0.7rem',
                                      }}
                                    >
                                      pushed
                                    </Typography>
                                    <Tooltip
                                      title={new Date(
                                        entry.uploadedAt
                                      ).toLocaleString('ko-KR')}
                                    >
                                      <Typography
                                        variant="caption"
                                        sx={{
                                          color: 'text.disabled',
                                          cursor: 'help',
                                          fontSize: '0.7rem',
                                        }}
                                      >
                                        {formatRelativeTime(entry.uploadedAt)}
                                      </Typography>
                                    </Tooltip>
                                  </Box>
                                </Box>

                                {/* Right: version badge + hash + actions */}
                                <Box
                                  sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1,
                                    pr: 1.5,
                                    pl: 1,
                                    flexShrink: 0,
                                  }}
                                >
                                  {/* Hash badge (like GitHub commit SHA) */}
                                  <Tooltip title={entry.contentHash || ''}>
                                    <Box
                                      sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        border: '1px solid',
                                        borderColor: 'divider',
                                        borderRadius: 1.5,
                                        px: 1,
                                        py: 0.25,
                                        height: 22,
                                        bgcolor: isDark
                                          ? 'rgba(255,255,255,0.04)'
                                          : 'rgba(0,0,0,0.03)',
                                      }}
                                    >
                                      <Typography
                                        variant="caption"
                                        sx={{
                                          fontFamily: 'monospace',
                                          fontWeight: 600,
                                          fontSize: '0.7rem',
                                          color: 'primary.main',
                                          userSelect: 'all',
                                        }}
                                      >
                                        {entry.contentHash?.slice(0, 7)}
                                      </Typography>
                                    </Box>
                                  </Tooltip>

                                  {/* Version + MoreVert */}
                                  <Chip
                                    label={`v${entry.version}`}
                                    size="small"
                                    variant={
                                      entry.isActive ? 'filled' : 'outlined'
                                    }
                                    color={
                                      entry.isActive ? 'success' : 'default'
                                    }
                                    sx={{
                                      fontWeight: 700,
                                      fontFamily: 'monospace',
                                      fontSize: '0.7rem',
                                      height: 22,
                                      minWidth: 36,
                                    }}
                                  />

                                  <IconButton
                                    size="small"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setVersionMenuAnchor(e.currentTarget);
                                      setVersionMenuEntry({
                                        version: entry.version,
                                        isActive: !!entry.isActive,
                                      });
                                    }}
                                    sx={{ p: 0.25 }}
                                  >
                                    <MoreVertIcon sx={{ fontSize: 17 }} />
                                  </IconButton>
                                </Box>
                              </Box>

                              {/* ── Expanded panel: Data / Diff toggle ── */}
                              {isViewing &&
                                editingVersion !== entry.version && (
                                  <Box
                                    sx={{
                                      ...(viewMode === 'data'
                                        ? { flex: 1, minHeight: 0 }
                                        : {}),
                                      display: 'flex',
                                      flexDirection: 'column',
                                      borderBottom: '1px solid',
                                      borderColor: 'divider',
                                      bgcolor: isDark
                                        ? 'rgba(0,0,0,0.15)'
                                        : 'rgba(0,0,0,0.02)',
                                      px: 2,
                                      py: 1.5,
                                    }}
                                  >
                                    {/* Mode toggle — always visible for consistency */}
                                    <Box
                                      sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        mb: 1,
                                      }}
                                    >
                                      <ButtonGroup
                                        size="small"
                                        variant="outlined"
                                        sx={{ height: 26 }}
                                      >
                                        <Button
                                          variant={
                                            viewMode === 'data'
                                              ? 'contained'
                                              : 'outlined'
                                          }
                                          onClick={() => setViewMode('data')}
                                          sx={{
                                            fontSize: '0.7rem',
                                            px: 1.5,
                                            textTransform: 'none',
                                          }}
                                        >
                                          Data
                                        </Button>
                                        <Button
                                          variant={
                                            viewMode === 'diff'
                                              ? 'contained'
                                              : 'outlined'
                                          }
                                          onClick={() =>
                                            prevVersion != null
                                              ? switchToDiff(
                                                  entry.version,
                                                  prevVersion
                                                )
                                              : setViewMode('diff')
                                          }
                                          startIcon={
                                            <CompareArrowsIcon
                                              sx={{
                                                fontSize: '14px !important',
                                              }}
                                            />
                                          }
                                          sx={{
                                            fontSize: '0.7rem',
                                            px: 1.5,
                                            textTransform: 'none',
                                          }}
                                        >
                                          Diff
                                        </Button>
                                      </ButtonGroup>
                                      {viewMode === 'diff' &&
                                        prevVersion != null && (
                                          <Typography
                                            variant="caption"
                                            sx={{
                                              ml: 1,
                                              color: 'text.disabled',
                                              fontSize: '0.68rem',
                                            }}
                                          >
                                            v{prevVersion} → v{entry.version}
                                          </Typography>
                                        )}
                                    </Box>

                                    {/* Data view */}
                                    {viewMode === 'data' &&
                                      (viewingDataLoading ? (
                                        <Box
                                          sx={{
                                            display: 'flex',
                                            justifyContent: 'center',
                                            py: 2,
                                          }}
                                        >
                                          <CircularProgress size={24} />
                                        </Box>
                                      ) : viewingData ? (
                                        <JsonEditor
                                          value={JSON.stringify(
                                            viewingData,
                                            null,
                                            2
                                          )}
                                          onChange={() => {}}
                                          readOnly
                                          height={400}
                                        />
                                      ) : null)}

                                    {/* Diff view */}
                                    {viewMode === 'diff' &&
                                      (diffLoading ? (
                                        <Box
                                          sx={{
                                            display: 'flex',
                                            justifyContent: 'center',
                                            py: 3,
                                          }}
                                        >
                                          <CircularProgress size={24} />
                                        </Box>
                                      ) : (
                                        <LightDiff
                                          patchText={diffPatchText}
                                          dark={isDark}
                                          noDiffMessage={t(
                                            'cms.history.noDiffAvailable'
                                          )}
                                        />
                                      ))}
                                  </Box>
                                )}
                              {renderInlineEditor(entry.version, true)}
                            </React.Fragment>
                          );
                        })}
                      </Box>
                    </>
                  )}
                </>
              ) : (
                <EmptyPlaceholder
                  message={t('cms.history.noHistory')}
                  minHeight={120}
                />
              )}
            </Box>
          )}

          {/* ── Tab 1: Propagation ── */}
          {detailTab === 1 && (
            <Box sx={{ p: 2, flex: 1, minHeight: 0, overflowY: 'auto' }}>
              {propagationLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                  <CircularProgress />
                </Box>
              ) : propagationData.length === 0 ? (
                <EmptyPlaceholder
                  message={t('ripple.history.empty')}
                  minHeight={120}
                />
              ) : (
                (() => {
                  const groups = new Map<string, RippleHistoryEvent[]>();
                  for (const evt of propagationData) {
                    const key = evt.requestId || evt.eventId;
                    if (!groups.has(key)) groups.set(key, []);
                    groups.get(key)!.push(evt);
                  }
                  const groupEntries = Array.from(groups.entries());
                  return (
                    <Box
                      sx={{
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 2,
                        overflow: 'hidden',
                      }}
                    >
                      {groupEntries.map(([reqId, events], groupIdx) => {
                        const allSuccess = events.every(
                          (e) => e.status === 'success'
                        );
                        const hasFailure = events.some(
                          (e) =>
                            e.status === 'failure' || e.status === 'timeout'
                        );
                        const isFirstGroup = groupIdx === 0;
                        const isLast = groupIdx === groupEntries.length - 1;
                        const expanded = isFirstGroup
                          ? !collapsedPropGroups.has(reqId)
                          : collapsedPropGroups.has(reqId);
                        const toggleExpanded = () => {
                          setCollapsedPropGroups((prev) => {
                            const next = new Set(prev);
                            if (next.has(reqId)) next.delete(reqId);
                            else next.add(reqId);
                            return next;
                          });
                        };
                        return (
                          <React.Fragment key={reqId}>
                            {/* Commit-style row — matches history tab */}
                            <Box
                              onClick={toggleExpanded}
                              sx={{
                                display: 'flex',
                                alignItems: 'stretch',
                                cursor: 'pointer',
                                borderBottom:
                                  isLast && !expanded ? 'none' : '1px solid',
                                borderColor: 'divider',
                                transition: 'background-color 0.15s',
                                '&:hover': {
                                  bgcolor: isDark
                                    ? 'rgba(255,255,255,0.025)'
                                    : 'rgba(0,0,0,0.015)',
                                },
                                ...(expanded && {
                                  bgcolor: isDark
                                    ? 'rgba(25,118,210,0.06)'
                                    : 'rgba(25,118,210,0.04)',
                                }),
                              }}
                            >
                              {/* Left icon */}
                              <Box
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  pl: 2,
                                  flexShrink: 0,
                                }}
                              >
                                {allSuccess ? (
                                  <CheckCircleIcon
                                    sx={{ fontSize: 18, color: 'success.main' }}
                                  />
                                ) : hasFailure ? (
                                  <CancelIcon
                                    sx={{ fontSize: 18, color: 'error.main' }}
                                  />
                                ) : (
                                  <WarningIcon
                                    sx={{ fontSize: 18, color: 'warning.main' }}
                                  />
                                )}
                              </Box>
                              {/* Main content */}
                              <Box
                                sx={{ flex: 1, minWidth: 0, py: 1.25, px: 1.5 }}
                              >
                                {/* Row 1: Request ID + table names */}
                                <Typography
                                  variant="body2"
                                  sx={{
                                    fontWeight: 500,
                                    fontSize: '0.82rem',
                                    lineHeight: 1.4,
                                    mb: 0.5,
                                  }}
                                >
                                  {reqId.slice(0, 8)}
                                  {events[0].tableName && (
                                    <Typography
                                      component="span"
                                      variant="caption"
                                      sx={{
                                        color: 'text.secondary',
                                        fontFamily: 'monospace',
                                        fontSize: '0.72rem',
                                        ml: 1,
                                      }}
                                    >
                                      {events[0].tableName
                                        .split(',')
                                        .slice(0, 3)
                                        .map((s) => s.trim())
                                        .join(', ')}
                                      {events[0].tableName.split(',').length >
                                        3 &&
                                        ` +${events[0].tableName.split(',').length - 3}`}
                                    </Typography>
                                  )}
                                </Typography>
                                {/* Row 2: Metadata line */}
                                <Box
                                  sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 0.75,
                                  }}
                                >
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      fontWeight: 600,
                                      color: 'text.secondary',
                                      fontSize: '0.72rem',
                                    }}
                                  >
                                    {events.length} servers
                                  </Typography>
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      color: 'text.disabled',
                                      fontSize: '0.7rem',
                                    }}
                                  >
                                    propagated
                                  </Typography>
                                  <Tooltip
                                    title={new Date(
                                      events[0].createdAt
                                    ).toLocaleString('ko-KR')}
                                  >
                                    <Typography
                                      variant="caption"
                                      sx={{
                                        color: 'text.disabled',
                                        cursor: 'help',
                                        fontSize: '0.7rem',
                                      }}
                                    >
                                      {formatRelativeTime(
                                        new Date(
                                          events[0].createdAt
                                        ).toISOString()
                                      )}
                                    </Typography>
                                  </Tooltip>
                                </Box>
                              </Box>
                              {/* Right: expand icon */}
                              <Box
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  pr: 1.5,
                                  pl: 1,
                                  flexShrink: 0,
                                }}
                              >
                                <ExpandMoreIcon
                                  sx={{
                                    fontSize: 18,
                                    color: 'text.disabled',
                                    transform: expanded
                                      ? 'rotate(180deg)'
                                      : 'rotate(0deg)',
                                    transition: 'transform 0.2s',
                                  }}
                                />
                              </Box>
                            </Box>
                            {/* Expanded detail panel */}
                            {expanded && (
                              <Box
                                sx={{
                                  bgcolor: isDark
                                    ? 'rgba(0,0,0,0.15)'
                                    : 'rgba(0,0,0,0.02)',
                                  borderBottom: isLast ? 'none' : '1px solid',
                                  borderColor: 'divider',
                                }}
                              >
                                <Table size="small">
                                  <TableBody>
                                    {events.map((evt, idx) => (
                                      <TableRow
                                        key={evt.eventId || idx}
                                        sx={{
                                          '&:last-child td': { border: 0 },
                                        }}
                                      >
                                        <TableCell
                                          sx={{ py: 0.4, pl: 4.5, width: 24 }}
                                        >
                                          {evt.status === 'success' ? (
                                            <CheckCircleIcon
                                              sx={{
                                                fontSize: 13,
                                                color: 'success.main',
                                              }}
                                            />
                                          ) : (
                                            <CancelIcon
                                              sx={{
                                                fontSize: 13,
                                                color: 'error.main',
                                              }}
                                            />
                                          )}
                                        </TableCell>
                                        <TableCell sx={{ py: 0.4 }}>
                                          <Typography
                                            variant="caption"
                                            sx={{
                                              fontFamily: 'monospace',
                                              fontSize: '0.72rem',
                                            }}
                                          >
                                            {evt.serviceType || '—'}
                                          </Typography>
                                        </TableCell>
                                        <TableCell sx={{ py: 0.4 }}>
                                          <Typography
                                            variant="caption"
                                            color="text.secondary"
                                            sx={{
                                              fontFamily: 'monospace',
                                              fontSize: '0.68rem',
                                            }}
                                          >
                                            {evt.serverId}
                                          </Typography>
                                        </TableCell>
                                        <TableCell
                                          sx={{ py: 0.4 }}
                                          align="right"
                                        >
                                          <Typography
                                            variant="caption"
                                            color="text.secondary"
                                            sx={{ fontSize: '0.68rem' }}
                                          >
                                            {evt.durationMs}ms
                                          </Typography>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </Box>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </Box>
                  );
                })()
              )}
            </Box>
          )}
        </Box>
      </ResizableDrawer>

      {/* Version Context Menu (MoreVert) */}
      <Menu
        anchorEl={versionMenuAnchor}
        open={Boolean(versionMenuAnchor)}
        onClose={() => {
          setVersionMenuAnchor(null);
          setVersionMenuEntry(null);
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem
          onClick={async () => {
            if (versionMenuEntry) {
              startEditing(versionMenuEntry.version);
            }
            setVersionMenuAnchor(null);
            setVersionMenuEntry(null);
          }}
        >
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('cms.history.editVersion')}</ListItemText>
        </MenuItem>
        {versionMenuEntry && !versionMenuEntry.isActive && (
          <MenuItem
            onClick={() => {
              if (versionMenuEntry) {
                confirmRollback(detailTableName, versionMenuEntry.version);
              }
              setVersionMenuAnchor(null);
              setVersionMenuEntry(null);
            }}
          >
            <ListItemIcon>
              <RestoreIcon fontSize="small" color="warning" />
            </ListItemIcon>
            <ListItemText>
              {t('cms.history.rollbackToVersion', {
                version: versionMenuEntry?.version,
              })}
            </ListItemText>
          </MenuItem>
        )}
      </Menu>

      {/* Unsynced Tables Refresh Dialog */}
      <Dialog
        open={unsyncedDialogOpen}
        onClose={() => setUnsyncedDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <RefreshIcon color="error" />
            {t('cms.unsyncedRefresh.title')}
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('cms.unsyncedRefresh.description')}
          </Typography>
          <Box
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox" sx={{ width: 42 }}>
                    <Checkbox
                      size="small"
                      checked={
                        unsyncedSelected.size ===
                        tables.filter(
                          (tbl) => tbl.runtime && !tbl.runtime.synced
                        ).length
                      }
                      indeterminate={
                        unsyncedSelected.size > 0 &&
                        unsyncedSelected.size <
                          tables.filter(
                            (tbl) => tbl.runtime && !tbl.runtime.synced
                          ).length
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          setUnsyncedSelected(
                            new Set(
                              tables
                                .filter(
                                  (tbl) => tbl.runtime && !tbl.runtime.synced
                                )
                                .map((t2) => t2.tableName)
                            )
                          );
                        } else {
                          setUnsyncedSelected(new Set());
                        }
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>
                    {t('cms.tableName')}
                  </TableCell>
                  <TableCell
                    sx={{ fontWeight: 600, fontSize: '0.75rem' }}
                    align="center"
                  >
                    Sync
                  </TableCell>
                  <TableCell
                    sx={{ fontWeight: 600, fontSize: '0.75rem', width: 40 }}
                    align="center"
                  >
                    Diff
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tables
                  .filter((tbl) => tbl.runtime && !tbl.runtime.synced)
                  .map((tbl) => (
                    <React.Fragment key={tbl.tableName}>
                      <TableRow
                        hover
                        selected={unsyncedSelected.has(tbl.tableName)}
                        sx={{ cursor: 'pointer' }}
                        onClick={() => {
                          const next = new Set(unsyncedSelected);
                          if (next.has(tbl.tableName)) {
                            next.delete(tbl.tableName);
                          } else {
                            next.add(tbl.tableName);
                          }
                          setUnsyncedSelected(next);
                        }}
                      >
                        <TableCell padding="checkbox">
                          <Checkbox
                            size="small"
                            checked={unsyncedSelected.has(tbl.tableName)}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: 500,
                              fontFamily: 'monospace',
                              fontSize: '0.8rem',
                            }}
                          >
                            {tbl.tableName}
                          </Typography>
                          {tbl.comment && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{
                                display: 'block',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                maxWidth: 280,
                              }}
                            >
                              {tbl.comment}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={`v${tbl.runtime!.loadedVersion} → v${tbl.version}`}
                            size="small"
                            color="warning"
                            variant="filled"
                            sx={{
                              fontSize: '0.68rem',
                              fontFamily: 'monospace',
                              height: 20,
                            }}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              const key = tbl.tableName;
                              if (unsyncedDiffs[key]?.text) {
                                setUnsyncedDiffs((prev) => {
                                  const next = { ...prev };
                                  delete next[key];
                                  return next;
                                });
                                return;
                              }
                              setUnsyncedDiffs((prev) => ({
                                ...prev,
                                [key]: { loading: true, text: '' },
                              }));
                              (async () => {
                                try {
                                  const [curData, svrData] = await Promise.all([
                                    fetchVersionData(key, tbl.version),
                                    fetchVersionData(
                                      key,
                                      tbl.runtime!.loadedVersion
                                    ),
                                  ]);
                                  const patch = await computeDiffInWorker(
                                    JSON.stringify(svrData, null, 2),
                                    JSON.stringify(curData, null, 2),
                                    `v${tbl.runtime!.loadedVersion} (server)`,
                                    `v${tbl.version} (saved)`
                                  );
                                  setUnsyncedDiffs((prev) => ({
                                    ...prev,
                                    [key]: { loading: false, text: patch },
                                  }));
                                } catch {
                                  setUnsyncedDiffs((prev) => ({
                                    ...prev,
                                    [key]: { loading: false, text: '' },
                                  }));
                                }
                              })();
                            }}
                          >
                            <CompareArrowsIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                      {unsyncedDiffs[tbl.tableName] && (
                        <TableRow>
                          <TableCell colSpan={4} sx={{ p: 0 }}>
                            <Box
                              sx={{
                                maxHeight: 300,
                                overflow: 'auto',
                                px: 1,
                                py: 0.5,
                              }}
                            >
                              {unsyncedDiffs[tbl.tableName].loading ? (
                                <Box
                                  sx={{
                                    display: 'flex',
                                    justifyContent: 'center',
                                    py: 2,
                                  }}
                                >
                                  <CircularProgress size={18} />
                                </Box>
                              ) : (
                                <LightDiff
                                  patchText={unsyncedDiffs[tbl.tableName].text}
                                  dark={isDark}
                                  noDiffMessage="No diff"
                                />
                              )}
                            </Box>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
              </TableBody>
            </Table>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUnsyncedDialogOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleRefreshSelectedUnsynced}
            disabled={unsyncedRefreshing || unsyncedSelected.size === 0}
            startIcon={
              unsyncedRefreshing ? (
                <CircularProgress size={16} />
              ) : (
                <RefreshIcon />
              )
            }
          >
            {t('cms.unsyncedRefresh.execute', { count: unsyncedSelected.size })}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Rollback Confirm Dialog */}
      <Dialog
        open={rollbackOpen}
        onClose={() => setRollbackOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ px: 3, pt: 3, pb: 1 }}>
          <Typography
            variant="subtitle1"
            fontWeight={700}
            sx={{ fontSize: '1.1rem' }}
          >
            {t('cms.rollback.title')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('cms.rollback.description')}
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ px: 3 }}>
          {/* Version Flow — compact inline */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              my: 2,
            }}
          >
            {/* Current */}
            <Paper
              variant="outlined"
              sx={{
                flex: 1,
                p: 1.5,
                borderLeft: '4px solid',
                borderLeftColor: '#ef5350',
                borderRadius: 2,
              }}
            >
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', lineHeight: 1 }}
              >
                Current
              </Typography>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 0.75,
                  mt: 0.5,
                }}
              >
                <Typography
                  variant="h6"
                  sx={{
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    lineHeight: 1,
                  }}
                >
                  v{rollbackCurrentVersion}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontFamily: 'monospace' }}
                >
                  {rollbackTableName}
                </Typography>
              </Box>
            </Paper>

            <ArrowForwardIcon
              sx={{ fontSize: 20, color: 'text.disabled', flexShrink: 0 }}
            />

            {/* Target */}
            <Paper
              variant="outlined"
              sx={{
                flex: 1,
                p: 1.5,
                borderLeft: '4px solid',
                borderLeftColor: '#4caf50',
                borderRadius: 2,
              }}
            >
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', lineHeight: 1 }}
              >
                Rollback Target
              </Typography>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 0.75,
                  mt: 0.5,
                }}
              >
                <Typography
                  variant="h6"
                  sx={{
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    lineHeight: 1,
                  }}
                >
                  v{rollbackVersion}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontFamily: 'monospace' }}
                >
                  {rollbackTableName}
                </Typography>
              </Box>
            </Paper>
          </Box>

          {/* Diff */}
          <Typography
            variant="caption"
            color="text.secondary"
            fontWeight={600}
            sx={{ mb: 0.5, display: 'block' }}
          >
            {t('cms.rollback.diffPreview')}
          </Typography>
          <Box
            sx={{
              maxHeight: 320,
              overflow: 'auto',
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              mb: 2,
            }}
          >
            {rollbackDiffLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress size={20} />
              </Box>
            ) : (
              <LightDiff
                patchText={rollbackDiffText}
                dark={isDark}
                noDiffMessage={t('cms.history.noDiffAvailable')}
              />
            )}
          </Box>

          {/* Comment */}
          <TextField
            fullWidth
            required
            multiline
            rows={3}
            size="small"
            label="Comment *"
            value={rollbackComment}
            onChange={(e) => setRollbackComment(e.target.value)}
            placeholder={t('cms.rollback.commentPlaceholder')}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />

          <FormControlLabel
            control={
              <Switch
                checked={rollbackRefresh}
                onChange={(e) => setRollbackRefresh(e.target.checked)}
                size="small"
              />
            }
            label={
              <Typography variant="body2" color="text.secondary">
                {t('cms.rollback.triggerRefresh')}
              </Typography>
            }
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button
            onClick={() => setRollbackOpen(false)}
            sx={{ borderRadius: 2 }}
          >
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            color="warning"
            onClick={handleRollback}
            disabled={rollbackLoading || !rollbackComment.trim()}
            startIcon={
              rollbackLoading ? <CircularProgress size={16} /> : <RestoreIcon />
            }
            sx={{
              borderRadius: 2,
              px: 3,
              fontWeight: 600,
              textTransform: 'none',
            }}
          >
            {t('cms.rollback.execute')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Refresh Confirm Dialog */}
      <Dialog
        open={refreshConfirmOpen}
        onClose={() => setRefreshConfirmOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{t('cms.refreshTable.confirmTitle')}</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
            {t('cms.refreshTable.warning')}
          </Alert>
          <DialogContentText>
            {t('cms.refreshTable.confirmMessage', {
              tableName: refreshConfirmTableName,
            })}
          </DialogContentText>
          {/* Diff Preview */}
          {refreshConfirmDiff.loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress size={20} />
            </Box>
          ) : refreshConfirmDiff.text ? (
            <Box sx={{ mt: 2, maxHeight: 300, overflow: 'auto' }}>
              <LightDiff
                patchText={refreshConfirmDiff.text}
                dark={isDark}
                noDiffMessage="No diff"
              />
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRefreshConfirmOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            color="warning"
            onClick={() => {
              handleRefreshTable(refreshConfirmTableName);
              setRefreshConfirmOpen(false);
            }}
          >
            {t('cms.refreshTable.confirmButton')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Discard Confirm Dialog */}
      <Dialog
        open={discardConfirmOpen}
        onClose={() => setDiscardConfirmOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {t('cms.detail.discardChangesTitle', 'Unsaved Changes')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('cms.detail.discardChangesConfirm')}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDiscardConfirmOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              if (pendingDiscardAction) pendingDiscardAction();
              setDiscardConfirmOpen(false);
            }}
          >
            {t('common.confirm', 'Confirm')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Ripple Tracking Dialog */}
      <RippleTrackingDialog
        open={trackingDialogOpen}
        onClose={() => setTrackingDialogOpen(false)}
        requestId={trackingRequestId}
        pattern={trackingPattern}
        matchedKeys={trackingMatchedKeys}
        targetTables={trackingTargetTables}
      />
    </Box>
  );
};

export default CmsManagementPage;
