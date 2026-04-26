import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import {
  Box,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  IconButton,
  Tooltip,
  Typography,
  Card,
  CardContent,
  TableSortLabel,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Menu,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  alpha,
} from '@mui/material';
import {
  ContentCopy as CopyIcon,
  Refresh as RefreshIcon,
  UnfoldMore as GroupIcon,
  FiberManualRecord as OnlineIcon,
  ViewColumn as ViewColumnIcon,
  MoreVert as MoreVertIcon,
  Info as InfoIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useSearchParams } from 'react-router-dom';
import SearchTextField from '../common/SearchTextField';
import SimplePagination from '../common/SimplePagination';
import EmptyPlaceholder from '../common/EmptyPlaceholder';
import ColumnSettingsDialog, {
  ColumnConfig,
} from '../common/ColumnSettingsDialog';
import DynamicFilterBar, {
  FilterDefinition,
  ActiveFilter,
} from '../common/DynamicFilterBar';
import { useDebounce } from '../../hooks/useDebounce';
import {
  formatRelativeTime,
  formatDateTimeDetailed,
} from '../../utils/dateFormat';
import playerConnectionService from '../../services/playerConnectionService';
import type {
  AllPlayer,
  AllPlayersResponse,
} from '../../services/playerConnectionService';

// ─── Group By Options ───
const GROUP_BY_OPTIONS = [
  { value: '', labelKey: 'playerConnections.groupBy.none' },
  { value: 'worldId', labelKey: 'playerConnections.allPlayers.worldId' },
  {
    value: 'nationCmsId',
    labelKey: 'playerConnections.allPlayers.nationCmsId',
  },
  { value: 'isOnline', labelKey: 'playerConnections.allPlayers.isOnline' },
  {
    value: 'loginPlatform',
    labelKey: 'playerConnections.allPlayers.platform',
  },
];

// ─── Default Columns ───
const defaultColumns: ColumnConfig[] = [
  {
    id: 'accountId',
    labelKey: 'playerConnections.allPlayers.accountId',
    visible: true,
  },
  {
    id: 'userId',
    labelKey: 'playerConnections.allPlayers.userId',
    visible: true,
  },
  {
    id: 'name',
    labelKey: 'playerConnections.allPlayers.characterName',
    visible: true,
  },
  {
    id: 'characterId',
    labelKey: 'playerConnections.allPlayers.characterId',
    visible: true,
  },
  {
    id: 'worldId',
    labelKey: 'playerConnections.allPlayers.worldId',
    visible: true,
  },
  {
    id: 'nationCmsId',
    labelKey: 'playerConnections.allPlayers.nationCmsId',
    visible: false,
  },
  {
    id: 'isOnline',
    labelKey: 'playerConnections.allPlayers.isOnline',
    visible: true,
  },
  {
    id: 'lastLoginTimeUtc',
    labelKey: 'playerConnections.allPlayers.lastLogin',
    visible: true,
  },
  {
    id: 'createTimeUtc',
    labelKey: 'playerConnections.allPlayers.createdAt',
    visible: true,
  },
  {
    id: 'loginPlatform',
    labelKey: 'playerConnections.allPlayers.platform',
    visible: false,
  },
  {
    id: 'clientVersion',
    labelKey: 'playerConnections.allPlayers.clientVersion',
    visible: false,
  },
  {
    id: 'accessLevel',
    labelKey: 'playerConnections.allPlayers.accessLevel',
    visible: false,
  },
  {
    id: 'actions',
    labelKey: 'common.actions',
    visible: true,
  },
];

// All detail fields for the info dialog
const DETAIL_FIELDS = [
  { key: 'userId', labelKey: 'playerConnections.allPlayers.userId' },
  { key: 'name', labelKey: 'playerConnections.allPlayers.characterName' },
  { key: 'characterId', labelKey: 'playerConnections.allPlayers.characterId' },
  { key: 'accountId', labelKey: 'playerConnections.allPlayers.accountId' },
  { key: 'worldId', labelKey: 'playerConnections.allPlayers.worldId' },
  { key: 'nationCmsId', labelKey: 'playerConnections.allPlayers.nationCmsId' },
  { key: 'isOnline', labelKey: 'playerConnections.allPlayers.isOnline' },
  {
    key: 'lastLoginTimeUtc',
    labelKey: 'playerConnections.allPlayers.lastLogin',
  },
  { key: 'createTimeUtc', labelKey: 'playerConnections.allPlayers.createdAt' },
  { key: 'loginPlatform', labelKey: 'playerConnections.allPlayers.platform' },
  {
    key: 'clientVersion',
    labelKey: 'playerConnections.allPlayers.clientVersion',
  },
  { key: 'lastWorldId', labelKey: 'playerConnections.allPlayers.lastWorldId' },
  { key: 'lastUserId', labelKey: 'playerConnections.allPlayers.lastUserId' },
  { key: 'accessLevel', labelKey: 'playerConnections.allPlayers.accessLevel' },
  {
    key: 'blockTimeUtcByAdmin',
    labelKey: 'playerConnections.allPlayers.blockTime',
  },
  {
    key: 'revokedTimeUtc',
    labelKey: 'playerConnections.allPlayers.revokedTime',
  },
];

const SORTABLE_COLUMNS = new Set([
  'userId',
  'name',
  'worldId',
  'nationCmsId',
  'accountId',
  'isOnline',
  'lastLoginTimeUtc',
  'createTimeUtc',
]);

const COL_STORAGE_KEY = 'allPlayers.columns';
const GROUP_STORAGE_KEY = 'allPlayers.groupBy';
const PAGE_SIZE_STORAGE_KEY = 'allPlayers.pageSize';
const DEFAULT_PAGE_SIZE = 50;
const VALID_PAGE_SIZES = [10, 20, 50, 100, 200, 500];

interface AllPlayersTabProps {
  projectApiPath: string;
  worlds: Array<{ worldId: string; name?: string }>;
}

export default function AllPlayersTab({
  projectApiPath,
  worlds,
}: AllPlayersTabProps) {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [searchParams, setSearchParams] = useSearchParams();

  // ── State from URL query params ──
  const [loading, setLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [data, setData] = useState<AllPlayersResponse>({
    users: [],
    total: 0,
    page: 1,
    limit: DEFAULT_PAGE_SIZE,
  });

  // Pagination - from URL, page size from localStorage
  const [page, setPage] = useState(() => {
    const p = parseInt(searchParams.get('page') || '0', 10);
    return isNaN(p) ? 0 : p;
  });
  const [rowsPerPage, setRowsPerPage] = useState(() => {
    const saved = parseInt(
      localStorage.getItem(PAGE_SIZE_STORAGE_KEY) || '',
      10
    );
    if (!isNaN(saved) && VALID_PAGE_SIZES.includes(saved)) return saved;
    return DEFAULT_PAGE_SIZE;
  });

  // Search - from URL
  const [searchTerm, setSearchTerm] = useState(
    () => searchParams.get('q') || ''
  );
  const debouncedSearch = useDebounce(searchTerm, 500);

  // Sort - from URL
  const [sortBy, setSortBy] = useState(
    () => searchParams.get('sortBy') || 'userId'
  );
  const [sortDesc, setSortDesc] = useState(
    () => searchParams.get('sortDesc') !== 'false'
  );

  // World filter - from URL
  const [worldFilter, setWorldFilter] = useState(
    () => searchParams.get('world') || 'all'
  );

  // isOnline filter - from URL ('', '0', '1')
  const [isOnlineFilter, setIsOnlineFilter] = useState(
    () => searchParams.get('online') || ''
  );

  // loginPlatform filter - from URL
  const [loginPlatformFilter, setLoginPlatformFilter] = useState(
    () => searchParams.get('platform') || ''
  );

  // Group by - from URL, fallback to localStorage
  const [groupBy, setGroupBy] = useState(() => {
    const fromUrl = searchParams.get('group');
    if (fromUrl && fromUrl !== 'none') return fromUrl;
    const stored = localStorage.getItem(GROUP_STORAGE_KEY);
    if (stored && stored !== 'none') return stored;
    return '';
  });

  // Column settings (ColumnConfig[] pattern)
  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    const saved = localStorage.getItem(COL_STORAGE_KEY);
    if (saved) {
      try {
        const savedColumns: ColumnConfig[] = JSON.parse(saved);
        // Merge saved order with defaults
        const merged = savedColumns.map((savedCol) => {
          const def = defaultColumns.find((c) => c.id === savedCol.id);
          return def ? { ...def, ...savedCol } : savedCol;
        });
        // Add any new columns not in saved state
        const savedIds = new Set(savedColumns.map((c) => c.id));
        const newCols = defaultColumns.filter((c) => !savedIds.has(c.id));
        return [...merged, ...newCols];
      } catch {
        return defaultColumns;
      }
    }
    return defaultColumns;
  });

  const [columnSettingsAnchor, setColumnSettingsAnchor] =
    useState<null | HTMLElement>(null);

  // Row action menu
  const [rowMenuAnchor, setRowMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedUser, setSelectedUser] = useState<AllPlayer | null>(null);

  // Detail dialog
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [detailUser, setDetailUser] = useState<AllPlayer | null>(null);

  // ── Fetch ──
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await playerConnectionService.getAllPlayers(
        projectApiPath,
        {
          page: page + 1, // API is 1-indexed
          limit: rowsPerPage,
          search: debouncedSearch || undefined,
          worldId: worldFilter !== 'all' ? worldFilter : undefined,
          isOnline: isOnlineFilter || undefined,
          loginPlatform: loginPlatformFilter || undefined,
          sortBy,
          sortDesc,
        }
      );
      setData(result);
    } catch (err: any) {
      enqueueSnackbar(
        err?.response?.data?.message || err.message || t('common.loadError'),
        { variant: 'error' }
      );
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  }, [
    projectApiPath,
    page,
    rowsPerPage,
    debouncedSearch,
    worldFilter,
    isOnlineFilter,
    loginPlatformFilter,
    sortBy,
    sortDesc,
  ]);

  // ── Sync state to URL query params ──
  const AP_PARAM_KEYS = [
    'q',
    'page',
    'sortBy',
    'sortDesc',
    'world',
    'group',
    'online',
    'platform',
  ];
  const isInitialSync = useRef(true);
  useEffect(() => {
    if (isInitialSync.current) {
      isInitialSync.current = false;
      return;
    }
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        // Clear old AllPlayers params
        for (const key of AP_PARAM_KEYS) next.delete(key);
        // Set non-default values
        if (debouncedSearch) next.set('q', debouncedSearch);
        if (page > 0) next.set('page', String(page));
        if (sortBy !== 'userId') next.set('sortBy', sortBy);
        if (!sortDesc) next.set('sortDesc', 'false');
        if (worldFilter !== 'all') next.set('world', worldFilter);
        if (groupBy) next.set('group', groupBy);
        if (isOnlineFilter) next.set('online', isOnlineFilter);
        if (loginPlatformFilter) next.set('platform', loginPlatformFilter);
        return next;
      },
      { replace: true }
    );
  }, [
    debouncedSearch,
    page,
    sortBy,
    sortDesc,
    worldFilter,
    groupBy,
    isOnlineFilter,
    loginPlatformFilter,
    setSearchParams,
  ]);

  // Persist page size to localStorage
  useEffect(() => {
    localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(rowsPerPage));
  }, [rowsPerPage]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Search handler ──
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setPage(0);
  };

  // ── Sort ──
  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortDesc(!sortDesc);
    } else {
      setSortBy(column);
      setSortDesc(true);
    }
    setPage(0);
  };

  // ── DynamicFilterBar ──
  const availableFilters: FilterDefinition[] = [
    {
      key: 'worldId',
      label: t('playerConnections.allPlayers.worldId'),
      type: 'select',
      options: worlds.map((w) => ({
        value: w.worldId,
        label: w.name || w.worldId,
      })),
    },
    {
      key: 'isOnline',
      label: t('playerConnections.allPlayers.isOnline'),
      type: 'select',
      options: [
        { value: '1', label: t('playerConnections.allPlayers.online') },
        { value: '0', label: t('playerConnections.allPlayers.offline') },
      ],
    },
    {
      key: 'loginPlatform',
      label: t('playerConnections.allPlayers.platform'),
      type: 'text',
    },
  ];

  // Track which filter keys are currently being edited (value not yet selected)
  const [editingFilterKeys, setEditingFilterKeys] = useState<Set<string>>(
    new Set()
  );

  const activeFilters: ActiveFilter[] = useMemo(() => {
    const filters: ActiveFilter[] = [];
    if (worldFilter !== 'all') {
      filters.push({
        key: 'worldId',
        value: worldFilter,
        label: t('playerConnections.allPlayers.worldId'),
      });
    } else if (editingFilterKeys.has('worldId')) {
      filters.push({
        key: 'worldId',
        value: undefined,
        label: t('playerConnections.allPlayers.worldId'),
      });
    }
    if (isOnlineFilter) {
      filters.push({
        key: 'isOnline',
        value: isOnlineFilter,
        label: t('playerConnections.allPlayers.isOnline'),
      });
    } else if (editingFilterKeys.has('isOnline')) {
      filters.push({
        key: 'isOnline',
        value: undefined,
        label: t('playerConnections.allPlayers.isOnline'),
      });
    }
    if (loginPlatformFilter) {
      filters.push({
        key: 'loginPlatform',
        value: loginPlatformFilter,
        label: t('playerConnections.allPlayers.platform'),
      });
    } else if (editingFilterKeys.has('loginPlatform')) {
      filters.push({
        key: 'loginPlatform',
        value: undefined,
        label: t('playerConnections.allPlayers.platform'),
      });
    }
    return filters;
  }, [worldFilter, isOnlineFilter, loginPlatformFilter, editingFilterKeys, t]);

  const handleFilterAdd = (filter: ActiveFilter) => {
    setEditingFilterKeys((prev) => new Set(prev).add(filter.key));
    // Don't set values yet — wait for handleFilterChange when user picks a value
  };
  const handleFilterRemove = (key: string) => {
    if (key === 'worldId') {
      setWorldFilter('all');
      setPage(0);
    }
    if (key === 'isOnline') {
      setIsOnlineFilter('');
      setPage(0);
    }
    if (key === 'loginPlatform') {
      setLoginPlatformFilter('');
      setPage(0);
    }
    setEditingFilterKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };
  const handleFilterChange = (key: string, value: any) => {
    if (key === 'worldId') {
      setWorldFilter(value);
      setPage(0);
    }
    if (key === 'isOnline') {
      setIsOnlineFilter(value);
      setPage(0);
    }
    if (key === 'loginPlatform') {
      setLoginPlatformFilter(value);
      setPage(0);
    }
    setEditingFilterKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  // ── Column settings handlers ──
  const handleColumnsChange = (newColumns: ColumnConfig[]) => {
    setColumns(newColumns);
    localStorage.setItem(COL_STORAGE_KEY, JSON.stringify(newColumns));
  };

  const handleResetColumns = () => {
    setColumns(defaultColumns);
    localStorage.setItem(COL_STORAGE_KEY, JSON.stringify(defaultColumns));
  };

  // ── Row menu handlers ──
  const handleRowMenuOpen = (
    event: React.MouseEvent<HTMLElement>,
    user: AllPlayer
  ) => {
    setRowMenuAnchor(event.currentTarget);
    setSelectedUser(user);
  };

  const handleRowMenuClose = () => {
    setRowMenuAnchor(null);
    setSelectedUser(null);
  };

  const handleViewDetails = () => {
    if (selectedUser) {
      setDetailUser(selectedUser);
      setDetailDialogOpen(true);
    }
    handleRowMenuClose();
  };

  // Format detail value for display
  const DATE_FIELDS = new Set([
    'lastLoginTimeUtc',
    'createTimeUtc',
    'blockTimeUtcByAdmin',
    'revokedTimeUtc',
  ]);
  const formatDetailValue = (key: string, value: any): string => {
    if (value === null || value === undefined) return '-';
    if (key === 'isOnline') {
      return value
        ? t('playerConnections.allPlayers.online')
        : t('playerConnections.allPlayers.offline');
    }
    if (DATE_FIELDS.has(key)) {
      return formatDateTimeDetailed(value);
    }
    return String(value);
  };

  // ── Group By ──
  useEffect(() => {
    localStorage.setItem(GROUP_STORAGE_KEY, groupBy);
  }, [groupBy]);

  // ── Grouped data ──
  const groupedData = useMemo(() => {
    if (!groupBy) return null;
    const groups: Record<string, AllPlayer[]> = {};
    for (const user of data.users) {
      let key = String((user as any)[groupBy] ?? '(empty)');
      if (groupBy === 'isOnline') {
        key = user.isOnline
          ? t('playerConnections.allPlayers.online')
          : t('playerConnections.allPlayers.offline');
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(user);
    }
    return Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
  }, [data.users, groupBy, t]);

  // ── Copy ──
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    enqueueSnackbar(t('common.copied'), {
      variant: 'success',
      autoHideDuration: 1500,
    });
  };

  // ── Visible columns ──
  const visibleColumns = columns.filter((c) => c.visible);

  // ── Render cell ──
  const renderCell = (user: AllPlayer, colId: string) => {
    switch (colId) {
      case 'userId':
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography
              variant="body2"
              sx={{
                fontFamily: 'monospace',
                cursor: 'pointer',
                '&:hover': {
                  color: 'primary.main',
                  textDecoration: 'underline',
                },
              }}
              onClick={() => {
                setDetailUser(user);
                setDetailDialogOpen(true);
              }}
            >
              {user.userId}
            </Typography>
            <IconButton
              size="small"
              onClick={() => copyToClipboard(String(user.userId))}
              sx={{ opacity: 0.5, '&:hover': { opacity: 1 } }}
            >
              <CopyIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Box>
        );
      case 'name':
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 500,
                cursor: 'pointer',
                '&:hover': {
                  color: 'primary.main',
                  textDecoration: 'underline',
                },
              }}
              onClick={() => {
                setDetailUser(user);
                setDetailDialogOpen(true);
              }}
            >
              {user.name || '-'}
            </Typography>
            {user.name && (
              <IconButton
                size="small"
                onClick={() => copyToClipboard(user.name)}
                sx={{ opacity: 0.5, '&:hover': { opacity: 1 } }}
              >
                <CopyIcon sx={{ fontSize: 14 }} />
              </IconButton>
            )}
          </Box>
        );
      case 'characterId':
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography
              variant="body2"
              sx={{
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                cursor: 'pointer',
                '&:hover': {
                  color: 'primary.main',
                  textDecoration: 'underline',
                },
              }}
              onClick={() => {
                setDetailUser(user);
                setDetailDialogOpen(true);
              }}
            >
              {user.characterId || '-'}
            </Typography>
            {user.characterId && (
              <IconButton
                size="small"
                onClick={() => copyToClipboard(user.characterId)}
                sx={{ opacity: 0.5, '&:hover': { opacity: 1 } }}
              >
                <CopyIcon sx={{ fontSize: 14 }} />
              </IconButton>
            )}
          </Box>
        );
      case 'accountId':
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography
              variant="body2"
              sx={{
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                cursor: 'pointer',
                '&:hover': {
                  color: 'primary.main',
                  textDecoration: 'underline',
                },
              }}
              onClick={() => {
                setDetailUser(user);
                setDetailDialogOpen(true);
              }}
            >
              {user.accountId || '-'}
            </Typography>
            {user.accountId && (
              <IconButton
                size="small"
                onClick={() => copyToClipboard(user.accountId)}
                sx={{ opacity: 0.5, '&:hover': { opacity: 1 } }}
              >
                <CopyIcon sx={{ fontSize: 14 }} />
              </IconButton>
            )}
          </Box>
        );
      case 'worldId':
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="body2">{user.worldId || '-'}</Typography>
            {user.worldId && (
              <IconButton
                size="small"
                onClick={() => copyToClipboard(user.worldId)}
                sx={{ opacity: 0.5, '&:hover': { opacity: 1 } }}
              >
                <CopyIcon sx={{ fontSize: 14 }} />
              </IconButton>
            )}
          </Box>
        );
      case 'nationCmsId':
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="body2">{user.nationCmsId || '-'}</Typography>
            {user.nationCmsId !== 0 && user.nationCmsId && (
              <IconButton
                size="small"
                onClick={() => copyToClipboard(String(user.nationCmsId))}
                sx={{ opacity: 0.5, '&:hover': { opacity: 1 } }}
              >
                <CopyIcon sx={{ fontSize: 14 }} />
              </IconButton>
            )}
          </Box>
        );
      case 'isOnline':
        return (
          <Chip
            icon={<OnlineIcon sx={{ fontSize: 10 }} />}
            label={
              user.isOnline
                ? t('playerConnections.allPlayers.online')
                : t('playerConnections.allPlayers.offline')
            }
            size="small"
            color={user.isOnline ? 'success' : 'default'}
            variant={user.isOnline ? 'filled' : 'outlined'}
            sx={{ fontWeight: 500, fontSize: '0.7rem' }}
          />
        );
      case 'lastLoginTimeUtc':
        return (
          <Tooltip title={formatDateTimeDetailed(user.lastLoginTimeUtc)}>
            <Typography
              variant="body2"
              component="span"
              sx={{ fontSize: '0.75rem' }}
            >
              {formatRelativeTime(user.lastLoginTimeUtc)}
            </Typography>
          </Tooltip>
        );
      case 'createTimeUtc':
        return (
          <Tooltip title={formatDateTimeDetailed(user.createTimeUtc)}>
            <Typography
              variant="body2"
              component="span"
              sx={{ fontSize: '0.75rem' }}
            >
              {formatRelativeTime(user.createTimeUtc)}
            </Typography>
          </Tooltip>
        );
      case 'loginPlatform':
        return (
          <Typography variant="body2">{user.loginPlatform || '-'}</Typography>
        );
      case 'clientVersion':
        return (
          <Typography
            variant="body2"
            sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}
          >
            {user.clientVersion || '-'}
          </Typography>
        );
      case 'accessLevel':
        return <Typography variant="body2">{user.accessLevel}</Typography>;
      case 'actions':
        return (
          <IconButton size="small" onClick={(e) => handleRowMenuOpen(e, user)}>
            <MoreVertIcon fontSize="small" />
          </IconButton>
        );
      default:
        return (
          <Typography variant="body2">
            {String((user as any)[colId] ?? '-')}
          </Typography>
        );
    }
  };

  // ── Render table rows ──
  const renderRows = (users: AllPlayer[]) =>
    users.map((user) => (
      <TableRow
        key={`${user.userId}-${user.worldId}`}
        hover
        sx={{ '&:last-child td': { borderBottom: 0 } }}
      >
        {visibleColumns.map((col) => (
          <TableCell
            key={col.id}
            align={
              col.id === 'actions' || col.id === 'isOnline'
                ? 'center'
                : undefined
            }
            sx={{ py: 0.75, px: 1.5 }}
          >
            {renderCell(user, col.id)}
          </TableCell>
        ))}
      </TableRow>
    ));

  return (
    <Box>
      {/* Toolbar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          flexWrap: 'wrap',
          mb: 1.5,
        }}
      >
        <SearchTextField
          placeholder={t('playerConnections.allPlayers.searchPlaceholder')}
          value={searchTerm}
          onChange={handleSearchChange}
          sx={{ minWidth: 250 }}
        />

        <DynamicFilterBar
          availableFilters={availableFilters}
          activeFilters={activeFilters}
          onFilterAdd={handleFilterAdd}
          onFilterRemove={handleFilterRemove}
          onFilterChange={handleFilterChange}
        />

        {/* Group by */}
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel
            id="allplayers-groupby-label"
            sx={{ fontSize: '0.8125rem' }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <GroupIcon sx={{ fontSize: 16 }} />
              {t('playerConnections.groupBy.label')}
            </Box>
          </InputLabel>
          <Select
            labelId="allplayers-groupby-label"
            value={groupBy}
            label={'\u2003' + t('playerConnections.groupBy.label')}
            onChange={(e) => setGroupBy(e.target.value)}
            sx={{
              fontSize: '0.8125rem',
              '& .MuiSelect-select': { py: 0.75 },
            }}
          >
            {GROUP_BY_OPTIONS.map((opt) => (
              <MenuItem
                key={opt.value}
                value={opt.value}
                sx={{ fontSize: '0.8125rem' }}
              >
                {t(opt.labelKey)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Column settings button */}
        <Tooltip title={t('common.columnSettings')}>
          <IconButton
            onClick={(e) => setColumnSettingsAnchor(e.currentTarget)}
            sx={{
              bgcolor: 'background.paper',
              border: 1,
              borderColor: 'divider',
              '&:hover': { bgcolor: 'action.hover' },
            }}
          >
            <ViewColumnIcon />
          </IconButton>
        </Tooltip>

        <Box sx={{ flex: 1 }} />

        {/* Right side */}
        <Typography variant="body2" color="text.secondary">
          {t('playerConnections.allPlayers.totalCount', {
            count: data.total,
          })}
        </Typography>
        <Tooltip title={t('common.refresh')}>
          <span>
            <IconButton size="small" onClick={fetchData} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      {/* Table content — hide everything until first fetch completes */}
      {isInitialLoad ? null : data.users.length === 0 && !loading ? (
        <EmptyPlaceholder
          message={t('playerConnections.allPlayers.noUsers')}
          minHeight={300}
        />
      ) : (
        <Card variant="outlined">
          <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
            <TableContainer
              sx={{
                maxHeight: 'calc(100vh - 380px)',
                position: 'relative',
                opacity: !isInitialLoad && loading ? 0.5 : 1,
                transition: 'opacity 0.15s ease-in-out',
                pointerEvents: !isInitialLoad && loading ? 'none' : 'auto',
              }}
            >
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    {visibleColumns.map((col) => (
                      <TableCell
                        key={col.id}
                        align={
                          col.id === 'actions' || col.id === 'isOnline'
                            ? 'center'
                            : undefined
                        }
                        sx={{
                          fontWeight: 600,
                          fontSize: '0.75rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          bgcolor: (theme) =>
                            theme.palette.mode === 'dark'
                              ? '#1e1e2f'
                              : '#f4f2ff',
                          zIndex: 2,
                          py: 1,
                          px: 1.5,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {SORTABLE_COLUMNS.has(col.id) ? (
                          <TableSortLabel
                            active={sortBy === col.id}
                            direction={
                              sortBy === col.id
                                ? sortDesc
                                  ? 'desc'
                                  : 'asc'
                                : 'asc'
                            }
                            onClick={() => handleSort(col.id)}
                          >
                            {t(col.labelKey)}
                          </TableSortLabel>
                        ) : (
                          t(col.labelKey)
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {groupedData
                    ? groupedData.map(([groupKey, users]) => (
                        <React.Fragment key={groupKey}>
                          <TableRow>
                            <TableCell
                              colSpan={visibleColumns.length}
                              sx={{
                                bgcolor: (theme) =>
                                  alpha(theme.palette.primary.main, 0.06),
                                py: 0.75,
                                px: 1.5,
                                fontWeight: 600,
                                fontSize: '0.8rem',
                                borderBottom: 1,
                                borderColor: 'divider',
                              }}
                            >
                              {groupKey}
                              <Chip
                                label={users.length}
                                size="small"
                                sx={{
                                  ml: 1,
                                  height: 20,
                                  fontSize: '0.7rem',
                                  fontWeight: 600,
                                }}
                              />
                            </TableCell>
                          </TableRow>
                          {renderRows(users)}
                        </React.Fragment>
                      ))
                    : renderRows(data.users)}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Pagination */}
            <SimplePagination
              count={data.total}
              page={page}
              rowsPerPage={rowsPerPage}
              onPageChange={(_, newPage) => setPage(newPage)}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(
                  typeof e.target.value === 'number'
                    ? e.target.value
                    : parseInt(e.target.value, 10)
                );
                setPage(0);
              }}
              rowsPerPageOptions={[10, 20, 50, 100, 200, 500]}
            />
          </CardContent>
        </Card>
      )}

      {/* Row Action Menu */}
      <Menu
        anchorEl={rowMenuAnchor}
        open={Boolean(rowMenuAnchor)}
        onClose={handleRowMenuClose}
      >
        <MenuItem onClick={handleViewDetails}>
          <InfoIcon sx={{ mr: 1, fontSize: 20 }} />
          {t('playerConnections.allPlayers.viewDetails')}
        </MenuItem>
      </Menu>

      {/* Detail Dialog */}
      <Dialog
        open={detailDialogOpen}
        onClose={() => setDetailDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Typography variant="h6" component="span" sx={{ fontWeight: 600 }}>
            {t('playerConnections.allPlayers.viewDetails')}
          </Typography>
          <IconButton size="small" onClick={() => setDetailDialogOpen(false)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 2 }}>
          {detailUser && (
            <TableContainer
              sx={{
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                mt: 1,
              }}
            >
              <Table size="small">
                <TableBody>
                  {DETAIL_FIELDS.map((field) => {
                    const rawValue = (detailUser as any)[field.key];
                    const displayValue = formatDetailValue(field.key, rawValue);
                    return (
                      <TableRow
                        key={field.key}
                        sx={{
                          '&:last-child td, &:last-child th': {
                            borderBottom: 0,
                          },
                        }}
                      >
                        <TableCell
                          component="th"
                          scope="row"
                          sx={{
                            fontWeight: 600,
                            fontSize: '0.8rem',
                            whiteSpace: 'nowrap',
                            width: 160,
                            bgcolor: 'action.hover',
                            borderRight: 1,
                            borderColor: 'divider',
                          }}
                        >
                          {t(field.labelKey)}
                        </TableCell>
                        <TableCell
                          sx={{
                            borderColor: 'divider',
                          }}
                        >
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                            }}
                          >
                            <Typography
                              variant="body2"
                              sx={{
                                fontFamily:
                                  field.key === 'characterId' ||
                                  field.key === 'accountId' ||
                                  field.key === 'clientVersion'
                                    ? 'monospace'
                                    : undefined,
                                wordBreak: 'break-all',
                              }}
                            >
                              {displayValue}
                            </Typography>
                            {displayValue !== '-' && (
                              <IconButton
                                size="small"
                                onClick={() =>
                                  copyToClipboard(String(rawValue ?? ''))
                                }
                                sx={{
                                  opacity: 0.4,
                                  '&:hover': { opacity: 1 },
                                  ml: 1,
                                  flexShrink: 0,
                                }}
                              >
                                <CopyIcon sx={{ fontSize: 14 }} />
                              </IconButton>
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button
            size="small"
            variant="contained"
            startIcon={<CopyIcon />}
            onClick={() => {
              if (detailUser) {
                navigator.clipboard.writeText(
                  JSON.stringify(detailUser, null, 2)
                );
                enqueueSnackbar(t('common.copied'), {
                  variant: 'success',
                  autoHideDuration: 1500,
                });
              }
            }}
          >
            {t('common.copyJson')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Column Settings Dialog */}
      <ColumnSettingsDialog
        anchorEl={columnSettingsAnchor}
        onClose={() => setColumnSettingsAnchor(null)}
        columns={columns.filter((c) => c.id !== 'actions')}
        onColumnsChange={(newCols) => {
          const actionsCol = columns.find((c) => c.id === 'actions');
          handleColumnsChange([...newCols, actionsCol!]);
        }}
        onReset={handleResetColumns}
      />
    </Box>
  );
}
