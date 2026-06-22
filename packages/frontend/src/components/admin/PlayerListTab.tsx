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
  Alert,
  LinearProgress,
  TableSortLabel,
  Chip,
  MenuItem,
  alpha,
  Menu,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stack,
} from '@mui/material';
import {
  Block as KickIcon,
  ViewColumn as ColumnIcon,
  ErrorOutline as ErrorIcon,
  ContentCopy as CopyIcon,
  UnfoldMore as GroupIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  SmartToy as BotIcon,
  Person as PersonIcon,
  MoreVert as MoreVertIcon,
  Info as InfoIcon,
  Close as CloseIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import {
  formatRelativeTime,
  formatDateTimeDetailed,
  formatDateTime,
} from '../../utils/dateFormat';
import { exportToFile, ExportColumn } from '../../utils/exportImportUtils';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import RelativeTime from '../common/RelativeTime';
import { copyToClipboardWithNotification } from '../../utils/clipboard';
import playerConnectionService from '../../services/playerConnectionService';
import type { ConnectedUser } from '../../services/playerConnectionService';
import EmptyPlaceholder from '../common/EmptyPlaceholder';
import SimplePagination from '../common/SimplePagination';
import SearchTextField from '../common/SearchTextField';
import DynamicFilterBar, {
  FilterDefinition,
  ActiveFilter,
} from '../common/DynamicFilterBar';
import ColumnSettingsDialog, {
  ColumnConfig,
} from '../common/ColumnSettingsDialog';

const COLUMNS_STORAGE_KEY = 'playerConnections.columns';
const GROUPBY_STORAGE_KEY = 'playerConnections.groupBy';

// Detail fields for player info dialog
const DETAIL_FIELDS = [
  { key: 'userId', labelKey: 'playerConnections.players.userId' },
  { key: 'accountId', labelKey: 'playerConnections.players.accountId' },
  { key: 'characterId', labelKey: 'playerConnections.players.characterId' },
  { key: 'userName', labelKey: 'playerConnections.players.userName' },
  { key: 'worldId', labelKey: 'playerConnections.players.worldId' },
  { key: 'worldName', labelKey: 'playerConnections.players.worldName' },
  { key: 'level', labelKey: 'playerConnections.players.level' },
  { key: 'connectedAt', labelKey: 'playerConnections.players.connectedAt' },
  { key: 'ip', labelKey: 'playerConnections.players.ip' },
  { key: 'nationCmsId', labelKey: 'playerConnections.players.nationCmsId' },
  { key: 'isBot', labelKey: 'playerConnections.players.isBot' },
  { key: 'storeCode', labelKey: 'playerConnections.players.storeCode' },
  { key: 'appVersion', labelKey: 'playerConnections.players.appVersion' },
  { key: 'deviceType', labelKey: 'playerConnections.players.deviceType' },
];

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: 'userId', labelKey: 'playerConnections.players.userId', visible: true },
  {
    id: 'accountId',
    labelKey: 'playerConnections.players.accountId',
    visible: true,
  },
  {
    id: 'characterId',
    labelKey: 'playerConnections.players.characterId',
    visible: true,
  },
  {
    id: 'userName',
    labelKey: 'playerConnections.players.userName',
    visible: true,
  },
  {
    id: 'worldId',
    labelKey: 'playerConnections.players.worldId',
    visible: true,
  },
  {
    id: 'worldName',
    labelKey: 'playerConnections.players.worldName',
    visible: true,
  },
  {
    id: 'level',
    labelKey: 'playerConnections.players.level',
    visible: true,
  },
  {
    id: 'connectedAt',
    labelKey: 'playerConnections.players.connectedAt',
    visible: true,
  },
  {
    id: 'isBot',
    labelKey: 'playerConnections.players.isBot',
    visible: true,
  },
  { id: 'ip', labelKey: 'playerConnections.players.ip', visible: false },
  {
    id: 'nationCmsId',
    labelKey: 'playerConnections.players.nationCmsId',
    visible: false,
  },
  {
    id: 'storeCode',
    labelKey: 'playerConnections.players.storeCode',
    visible: false,
  },
  {
    id: 'appVersion',
    labelKey: 'playerConnections.players.appVersion',
    visible: false,
  },
  {
    id: 'deviceType',
    labelKey: 'playerConnections.players.deviceType',
    visible: false,
  },
];

// Columns available for groupBy breakdown
const GROUPABLE_COLUMNS = [
  { value: '', labelKey: 'playerConnections.groupBy.none' },
  { value: 'worldId', labelKey: 'playerConnections.players.worldId' },
  { value: 'worldName', labelKey: 'playerConnections.players.worldName' },
  { value: 'isBot', labelKey: 'playerConnections.players.isBot' },
  { value: 'level', labelKey: 'playerConnections.players.level' },
  { value: 'storeCode', labelKey: 'playerConnections.players.storeCode' },
  { value: 'appVersion', labelKey: 'playerConnections.players.appVersion' },
  { value: 'deviceType', labelKey: 'playerConnections.players.deviceType' },
];

interface GroupedUsers {
  key: string;
  label: string;
  users: ConnectedUser[];
}

interface Props {
  projectApiPath: string;
  worlds: Array<{ worldId: string; name: string; count: number }>;
  onKickUser: (userId: string) => void;
  totalOnline?: number;
  botTotal?: number;
}

const PlayerListTab: React.FC<Props> = ({
  projectApiPath,
  worlds,
  onKickUser,
  totalOnline,
  botTotal,
}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [searchParams, setSearchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [users, setUsers] = useState<ConnectedUser[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(() => {
    const p = searchParams.get('page');
    return p ? parseInt(p, 10) - 1 : 0;
  });
  // List settings
  const [listSettings, setListSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('playerConnections.listSettings');
      if (saved) return JSON.parse(saved);
    } catch {
      /* ignore */
    }
    return { rowsPerPage: 20, sortBy: 'connectedAt', sortDesc: true };
  });

  const [rowsPerPage, setRowsPerPage] = useState(listSettings.rowsPerPage);
  const [sortBy, setSortBy] = useState(
    () => searchParams.get('sortBy') || listSettings.sortBy
  );
  const [sortDesc, setSortDesc] = useState(() => {
    const param = searchParams.get('sortDesc');
    if (param !== null) return param !== 'false';
    return listSettings.sortDesc;
  });
  const [search, setSearch] = useState(() => searchParams.get('search') || '');

  // GroupBy (breakdown)
  const [groupBy, setGroupBy] = useState<string>(() => {
    const param = searchParams.get('groupBy');
    if (param) return param;
    try {
      return localStorage.getItem(GROUPBY_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set()
  );

  // Persist settings
  useEffect(() => {
    localStorage.setItem(
      'playerConnections.listSettings',
      JSON.stringify({ rowsPerPage, sortBy, sortDesc })
    );
  }, [rowsPerPage, sortBy, sortDesc]);

  // Persist groupBy
  useEffect(() => {
    localStorage.setItem(GROUPBY_STORAGE_KEY, groupBy);
  }, [groupBy]);

  const [groupByMenuAnchor, setGroupByMenuAnchor] =
    useState<null | HTMLElement>(null);

  // Filters
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>(() => {
    const filters: ActiveFilter[] = [];
    const worldFilter = searchParams.get('worldId');
    if (worldFilter) {
      filters.push({
        key: 'worldId',
        value: worldFilter,
        label: t('playerConnections.players.worldId'),
      });
    }
    return filters;
  });

  const availableFilters: FilterDefinition[] = [
    {
      key: 'worldId',
      label: t('playerConnections.players.worldId'),
      type: 'select',
      options: worlds.map((w) => ({
        value: w.worldId,
        label: `${w.name || w.worldId} (${w.count})`,
      })),
    },
  ];

  // Column settings
  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    try {
      const saved = localStorage.getItem(COLUMNS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as ColumnConfig[];
        // Merge with defaults: keep saved visibility but add any new columns
        const savedIds = new Set(parsed.map((c) => c.id));
        const merged = [...parsed];
        for (const def of DEFAULT_COLUMNS) {
          if (!savedIds.has(def.id)) {
            merged.push(def);
          }
        }
        return merged;
      }
    } catch {
      /* ignore */
    }
    return DEFAULT_COLUMNS;
  });
  const [columnSettingsAnchor, setColumnSettingsAnchor] =
    useState<null | HTMLElement>(null);

  // Row action menu
  const [rowMenuAnchor, setRowMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedUser, setSelectedUser] = useState<ConnectedUser | null>(null);

  // Detail dialog
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [detailUser, setDetailUser] = useState<ConnectedUser | null>(null);

  // Export state
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportProcessedCount, setExportProcessedCount] = useState(0);
  const [exportMenuAnchor, setExportMenuAnchor] = useState<null | HTMLElement>(
    null
  );
  const exportAbortRef = useRef<AbortController | null>(null);

  const handleRowMenuOpen = (
    e: React.MouseEvent<HTMLElement>,
    user: ConnectedUser
  ) => {
    setRowMenuAnchor(e.currentTarget);
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
  const handleKickFromMenu = () => {
    if (selectedUser) {
      onKickUser(selectedUser.userId);
    }
    handleRowMenuClose();
  };

  const formatDetailValue = (key: string, value: any): string => {
    if (value === null || value === undefined) return '-';
    if (key === 'isBot')
      return value
        ? t('playerConnections.players.botLabel')
        : t('playerConnections.players.playerLabel');
    if (key === 'connectedAt') return formatDateTimeDetailed(value);
    return String(value);
  };

  const handleColumnsChange = (newCols: ColumnConfig[]) => {
    setColumns(newCols);
    localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(newCols));
  };

  const visibleColumns = columns.filter((c) => c.visible);

  // Extract filter values
  const getFilterValue = (key: string) => {
    return activeFilters.find((f) => f.key === key)?.value;
  };

  // Load users
  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await playerConnectionService.getConnectedUsers(
        projectApiPath,
        {
          page: page + 1,
          limit: rowsPerPage,
          worldId: getFilterValue('worldId'),
          search,
          sortBy,
          sortDesc,
        }
      );
      setUsers(data.users);
      setTotal(data.total);
    } catch (err: any) {
      const status = err?.response?.status || err?.status;
      if (status === 502 || status === 504) {
        setError(t('playerConnections.error.unreachable'));
      } else {
        setError(t('playerConnections.error.unknown'));
      }
      console.error('Connected users load failed:', err);
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  }, [
    projectApiPath,
    page,
    rowsPerPage,
    activeFilters,
    search,
    sortBy,
    sortDesc,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Persist to URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    params.set('tab', 'players');
    if (page > 0) params.set('page', String(page + 1));
    else params.delete('page');
    const wf = getFilterValue('worldId');
    if (wf) params.set('worldId', wf);
    else params.delete('worldId');
    if (search) params.set('search', search);
    else params.delete('search');
    if (sortBy !== 'connectedAt') params.set('sortBy', sortBy);
    else params.delete('sortBy');
    if (!sortDesc) params.set('sortDesc', 'false');
    else params.delete('sortDesc');
    if (groupBy) params.set('groupBy', groupBy);
    else params.delete('groupBy');

    setSearchParams(params, { replace: true });
  }, [page, activeFilters, search, sortBy, sortDesc, groupBy]); // eslint-disable-line react-hooks/exhaustive-deps

  // Filter handlers
  const handleFilterAdd = (filter: ActiveFilter) => {
    setActiveFilters((prev) => [
      ...prev.filter((f) => f.key !== filter.key),
      filter,
    ]);
    setPage(0);
  };
  const handleFilterRemove = (key: string) => {
    setActiveFilters((prev) => prev.filter((f) => f.key !== key));
    setPage(0);
  };
  const handleFilterChange = (key: string, value: any) => {
    setActiveFilters((prev) =>
      prev.map((f) => (f.key === key ? { ...f, value } : f))
    );
    setPage(0);
  };
  const handleSearchChange = (newVal: string) => {
    setSearch(newVal);
    setPage(0);
  };

  const handleSortRequest = (colId: string) => {
    if (sortBy === colId) {
      // Same column: toggle direction
      setSortDesc((prev) => !prev);
    } else {
      // New column: default to descending
      setSortBy(colId);
      setSortDesc(true);
    }
    setPage(0);
  };
  // ── Export handler (chunked 500 per API call) ──
  const EXPORT_CHUNK_SIZE = 500;

  const handleExport = useCallback(
    async (format: 'csv' | 'xlsx') => {
      setExportMenuAnchor(null);
      setExporting(true);
      setExportProgress(0);
      setExportProcessedCount(0);
      exportAbortRef.current = new AbortController();

      try {
        const allUsers: ConnectedUser[] = [];
        let currentPage = 1;
        let hasMore = true;

        while (hasMore && !exportAbortRef.current?.signal.aborted) {
          const result = await playerConnectionService.getConnectedUsers(
            projectApiPath,
            {
              page: currentPage,
              limit: EXPORT_CHUNK_SIZE,
              worldId: getFilterValue('worldId'),
              search,
              sortBy,
              sortDesc,
            }
          );

          allUsers.push(...result.users);
          const fetchedTotal = result.total || 0;

          setExportProcessedCount(allUsers.length);
          setExportProgress(
            fetchedTotal > 0
              ? Math.min(
                  100,
                  Math.round((allUsers.length / fetchedTotal) * 100)
                )
              : 100
          );

          hasMore = allUsers.length < fetchedTotal;
          currentPage++;
        }

        if (exportAbortRef.current?.signal.aborted) {
          return;
        }

        if (allUsers.length === 0) {
          enqueueSnackbar(t('playerConnections.players.noUsers'), {
            variant: 'warning',
          });
          return;
        }

        // Build export columns (English headers)
        const exportColumns: ExportColumn[] = [
          { key: 'userId', header: 'User ID' },
          { key: 'accountId', header: 'Account ID' },
          { key: 'characterId', header: 'Character ID' },
          { key: 'userName', header: 'User Name' },
          { key: 'worldId', header: 'World ID' },
          { key: 'worldName', header: 'World Name' },
          { key: 'level', header: 'Level' },
          { key: 'connectedAt', header: 'Connected At' },
          { key: 'isBot', header: 'Is Bot' },
          { key: 'ip', header: 'IP' },
          { key: 'nationCmsId', header: 'Nation CMS ID' },
          { key: 'storeCode', header: 'Store Code' },
          { key: 'appVersion', header: 'App Version' },
          { key: 'deviceType', header: 'Device Type' },
        ];

        const exportData = allUsers.map((user) => ({
          ...user,
          isBot: user.isBot
            ? t('playerConnections.players.botLabel')
            : t('playerConnections.players.playerLabel'),
          connectedAt: user.connectedAt
            ? formatDateTime(user.connectedAt)
            : '-',
        }));

        exportToFile(exportData, exportColumns, 'online-players', format);

        enqueueSnackbar(t('common.exportSuccess'), { variant: 'success' });
      } catch (error: any) {
        if (error.message === 'Export cancelled') return;
        console.error('Export error:', error);
        enqueueSnackbar(
          error?.response?.data?.message ||
            error.message ||
            t('common.exportFailed'),
          { variant: 'error' }
        );
      } finally {
        setExporting(false);
        exportAbortRef.current = null;
      }
    },
    [
      projectApiPath,
      search,
      activeFilters,
      sortBy,
      sortDesc,
      t,
      enqueueSnackbar,
    ]
  ); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCancelExport = useCallback(() => {
    exportAbortRef.current?.abort();
    setExporting(false);
  }, []);

  const handleCopy = (text: string) => {
    copyToClipboardWithNotification(
      text,
      () =>
        enqueueSnackbar(t('common.copied') || 'Copied', { variant: 'success' }),
      () =>
        enqueueSnackbar(t('common.copyFailed') || 'Copy failed', {
          variant: 'error',
        })
    );
  };

  // GroupBy logic
  const handleGroupByChange = (value: string) => {
    setGroupBy(value);
    setCollapsedGroups(new Set());
  };

  const toggleGroupCollapse = (groupKey: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  };

  const getGroupLabel = (colId: string, value: any): string => {
    if (colId === 'isBot') {
      return value
        ? t('playerConnections.players.botLabel')
        : t('playerConnections.players.playerLabel');
    }
    if (value === undefined || value === null || value === '') return '-';
    return String(value);
  };

  const groupedUsers: GroupedUsers[] | null = useMemo(() => {
    if (!groupBy || !users.length) return null;

    const groups = new Map<string, ConnectedUser[]>();
    for (const user of users) {
      const rawVal = user[groupBy];
      const key =
        rawVal === undefined || rawVal === null || rawVal === ''
          ? '__empty__'
          : String(rawVal);
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(user);
    }

    // Sort groups by count descending
    return Array.from(groups.entries())
      .sort((a, b) => b[1].length - a[1].length)
      .map(([key, groupUsers]) => ({
        key,
        label: getGroupLabel(
          groupBy,
          key === '__empty__' ? '' : groupBy === 'isBot' ? key === 'true' : key
        ),
        users: groupUsers,
      }));
  }, [users, groupBy, t]); // eslint-disable-line react-hooks/exhaustive-deps

  const COPY_COLUMNS = [
    'userId',
    'accountId',
    'characterId',
    'userName',
    'worldId',
    'worldName',
    'ip',
    'storeCode',
    'appVersion',
  ];
  const MONO_COLUMNS = [
    'userId',
    'accountId',
    'characterId',
    'ip',
    'nationCmsId',
  ];
  const CLICKABLE_DETAIL_COLUMNS = [
    'userId',
    'accountId',
    'characterId',
    'userName',
  ];

  const renderCell = (user: ConnectedUser, colId: string) => {
    if (colId === 'connectedAt') {
      return (
        <RelativeTime
          date={user.connectedAt}
          variant="body2"
          color="text.primary"
        />
      );
    }

    if (colId === 'isBot') {
      const isBot = user.isBot;
      return (
        <Chip
          icon={isBot ? <BotIcon /> : <PersonIcon />}
          label={
            isBot
              ? t('playerConnections.players.botLabel')
              : t('playerConnections.players.playerLabel')
          }
          size="small"
          color={isBot ? 'warning' : 'success'}
          variant="outlined"
          sx={{ fontWeight: 500, fontSize: '0.75rem' }}
        />
      );
    }

    if (colId === 'level') {
      const level = user.level;
      if (level === undefined || level === null) return '-';
      return (
        <Typography variant="body2" fontWeight={600}>
          Lv.{level}
        </Typography>
      );
    }

    const value = user[colId] ?? '-';
    const hasCopy = COPY_COLUMNS.includes(colId) && value !== '-';
    const isMono = MONO_COLUMNS.includes(colId);

    if (hasCopy) {
      const isClickable = CLICKABLE_DETAIL_COLUMNS.includes(colId);
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography
            variant="body2"
            sx={{
              ...(isMono ? { fontSize: '0.8rem' } : {}),
              ...(isClickable
                ? {
                    cursor: 'pointer',
                    '&:hover': {
                      color: 'primary.main',
                      textDecoration: 'underline',
                    },
                  }
                : {}),
            }}
            onClick={
              isClickable
                ? () => {
                    setDetailUser(user);
                    setDetailDialogOpen(true);
                  }
                : undefined
            }
          >
            {value}
          </Typography>
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              handleCopy(String(value));
            }}
            sx={{ p: 0.25 }}
          >
            <CopyIcon sx={{ fontSize: 13 }} />
          </IconButton>
        </Box>
      );
    }

    return (
      <Typography variant="body2" sx={isMono ? { fontSize: '0.8rem' } : {}}>
        {value}
      </Typography>
    );
  };

  const handlePageChange = (_: unknown, newPage: number) => setPage(newPage);
  const handleRowsPerPageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(e.target.value, 10));
    setPage(0);
  };

  // Render table rows (reusable for flat and grouped modes)
  const renderTableRows = (userList: ConnectedUser[]) =>
    userList.map((user, idx) => (
      <TableRow
        key={user.userId || idx}
        hover
        sx={{ '&:last-child td': { borderBottom: 0 } }}
      >
        {visibleColumns.map((col) => (
          <TableCell key={col.id} sx={{ py: 0.75, px: 1.5 }}>
            {renderCell(user, col.id)}
          </TableCell>
        ))}
        <TableCell align="center" sx={{ py: 0.75, px: 1.5 }}>
          <IconButton size="small" onClick={(e) => handleRowMenuOpen(e, user)}>
            <MoreVertIcon fontSize="small" />
          </IconButton>
        </TableCell>
      </TableRow>
    ));

  // Render group header row
  const renderGroupHeader = (group: GroupedUsers) => {
    const isCollapsed = collapsedGroups.has(group.key);
    return (
      <TableRow
        key={`group-${group.key}`}
        onClick={() => toggleGroupCollapse(group.key)}
        sx={{
          cursor: 'pointer',
          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04),
          '&:hover': {
            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
          },
        }}
      >
        <TableCell
          colSpan={visibleColumns.length + 1}
          sx={{ py: 1, borderBottom: isCollapsed ? undefined : 'none' }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton size="small" sx={{ p: 0.25 }}>
              {isCollapsed ? (
                <ExpandMoreIcon fontSize="small" />
              ) : (
                <ExpandLessIcon fontSize="small" />
              )}
            </IconButton>
            <Typography
              variant="subtitle2"
              fontWeight={700}
              color="primary.main"
            >
              {group.label}
            </Typography>
            <Chip
              label={group.users.length}
              size="small"
              color="primary"
              sx={{
                fontWeight: 700,
                fontSize: '0.75rem',
                height: 22,
                minWidth: 32,
              }}
            />
          </Box>
        </TableCell>
      </TableRow>
    );
  };

  return (
    <Box>
      {/* Filter bar */}
      <Box sx={{ mb: 2 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            width: '100%',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              gap: 1.5,
              alignItems: 'center',
              flexWrap: 'wrap',
              flexGrow: 1,
            }}
          >
            <SearchTextField
              placeholder={t('playerConnections.players.searchPlaceholder')}
              value={search}
              onChange={handleSearchChange}
            />

            {/* Unified Control Group */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                bgcolor: 'background.paper',
                border: 1,
                borderColor: 'divider',
                borderRadius: '8px',
                minHeight: '36px',
                px: 0.5,
                boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
              }}
            >
              <DynamicFilterBar
                availableFilters={availableFilters}
                activeFilters={activeFilters}
                onFilterAdd={handleFilterAdd}
                onFilterRemove={handleFilterRemove}
                onFilterChange={handleFilterChange}
              />

              <Box sx={{ width: '1px', height: '20px', bgcolor: 'divider', mx: 0.5 }} />

              {/* GroupBy Button */}
              <Tooltip title={t('playerConnections.groupBy.label')}>
                <IconButton
                  size="small"
                  onClick={(e) => setGroupByMenuAnchor(e.currentTarget)}
                  sx={{
                    color: groupBy ? 'primary.main' : 'text.secondary',
                    borderRadius: '6px',
                    width: 30,
                    height: 30,
                    bgcolor: groupBy ? 'action.selected' : 'transparent',
                    '&:hover': {
                      bgcolor: groupBy ? 'primary.dark' : 'action.hover',
                      color: groupBy ? 'primary.contrastText' : 'primary.main',
                    },
                  }}
                >
                  <GroupIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
              <Menu
                anchorEl={groupByMenuAnchor}
                open={Boolean(groupByMenuAnchor)}
                onClose={() => setGroupByMenuAnchor(null)}
              >
                {GROUPABLE_COLUMNS.map((opt) => (
                  <MenuItem
                    key={opt.value}
                    selected={groupBy === opt.value}
                    onClick={() => {
                      handleGroupByChange(opt.value);
                      setGroupByMenuAnchor(null);
                    }}
                    sx={{ fontSize: '0.8125rem' }}
                  >
                    {t(opt.labelKey)}
                  </MenuItem>
                ))}
              </Menu>

              <Box sx={{ width: '1px', height: '20px', bgcolor: 'divider', mx: 0.5 }} />

              {/* Column Settings Button */}
              <Tooltip title={t('common.columnSettings')}>
                <IconButton
                  size="small"
                  onClick={(e) => setColumnSettingsAnchor(e.currentTarget)}
                  sx={{
                    color: 'text.secondary',
                    borderRadius: '6px',
                    width: 30,
                    height: 30,
                    '&:hover': {
                      bgcolor: 'action.hover',
                      color: 'primary.main',
                    },
                  }}
                >
                  <ColumnIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          {/* Right side actions */}
          <Stack direction="row" spacing={1.5} alignItems="center" flexShrink={0}>
            {/* Total online counter */}
            {totalOnline !== undefined && (
              <Typography
                variant="body2"
                sx={{
                  color: 'text.secondary',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                }}
              >
                {totalOnline.toLocaleString()}
                <Typography
                  component="span"
                  sx={{
                    fontSize: '0.75rem',
                    color: 'text.disabled',
                    fontWeight: 400,
                  }}
                >
                  ({t('playerConnections.players.playerLabel')}{' '}
                  {((totalOnline ?? 0) - (botTotal ?? 0)).toLocaleString()}
                  {' · '}
                  {t('playerConnections.players.botLabel')}{' '}
                  {(botTotal ?? 0).toLocaleString()})
                </Typography>
              </Typography>
            )}

            <Tooltip title={t('common.export')}>
              <span>
                <IconButton
                  size="small"
                  onClick={(e) => setExportMenuAnchor(e.currentTarget)}
                  disabled={exporting || total === 0}
                  sx={{
                    bgcolor: 'background.paper',
                    border: 1,
                    borderColor: 'divider',
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                >
                  <DownloadIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
          <Menu
            anchorEl={exportMenuAnchor}
            open={Boolean(exportMenuAnchor)}
            onClose={() => setExportMenuAnchor(null)}
          >
            <MenuItem onClick={() => handleExport('csv')}>CSV</MenuItem>
            <MenuItem onClick={() => handleExport('xlsx')}>Excel (XLSX)</MenuItem>
          </Menu>
        </Box>
      </Box>

      {/* Active groupBy indicator */}
      {groupBy && (
        <Box sx={{ mb: 1 }}>
          <Chip
            icon={<GroupIcon />}
            label={`${t('playerConnections.groupBy.label')}: ${t(GROUPABLE_COLUMNS.find((c) => c.value === groupBy)?.labelKey || '')}`}
            onDelete={() => handleGroupByChange('')}
            color="primary"
            variant="outlined"
            size="small"
            sx={{ fontWeight: 500 }}
          />
        </Box>
      )}

      {/* Error banner */}
      {error && (
        <Alert
          severity="error"
          icon={<ErrorIcon />}
          sx={{ mb: 3, borderRadius: 2 }}
        >
          {error}
        </Alert>
      )}

      {/* Table — hide everything until first fetch completes */}
      {isInitialLoad ? null : !error && users.length === 0 ? (
        <EmptyPlaceholder
          message={t('playerConnections.players.noUsers')}
          minHeight={300}
        />
      ) : !error ? (
        <Card variant="outlined" sx={{ position: 'relative' }}>
          <TableContainer
            sx={{
              opacity: !isInitialLoad && loading ? 0.5 : 1,
              transition: 'opacity 0.15s ease-in-out',
              pointerEvents: !isInitialLoad && loading ? 'none' : 'auto',
            }}
          >
            <Table sx={{ tableLayout: 'auto' }}>
              <TableHead>
                <TableRow>
                  {visibleColumns.map((col) => (
                    <TableCell key={col.id}>
                      <TableSortLabel
                        active={sortBy === col.id}
                        direction={
                          sortBy === col.id
                            ? sortDesc
                              ? 'desc'
                              : 'asc'
                            : 'desc'
                        }
                        onClick={() => handleSortRequest(col.id)}
                      >
                        {t(col.labelKey)}
                      </TableSortLabel>
                    </TableCell>
                  ))}
                  <TableCell align="center">{t('common.actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {groupedUsers
                  ? groupedUsers.map((group) => (
                      <React.Fragment key={`frag-${group.key}`}>
                        {renderGroupHeader(group)}
                        {!collapsedGroups.has(group.key) &&
                          renderTableRows(group.users)}
                      </React.Fragment>
                    ))
                  : renderTableRows(users)}
              </TableBody>
            </Table>
          </TableContainer>

          {total > 0 && (
            <SimplePagination
              count={total}
              page={page}
              rowsPerPage={rowsPerPage}
              onPageChange={handlePageChange}
              onRowsPerPageChange={handleRowsPerPageChange}
            />
          )}
        </Card>
      ) : null}

      {/* Row action menu */}
      <Menu
        anchorEl={rowMenuAnchor}
        open={Boolean(rowMenuAnchor)}
        onClose={handleRowMenuClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem onClick={handleViewDetails}>
          <ListItemIcon>
            <InfoIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>
            {t('playerConnections.allPlayers.viewDetails')}
          </ListItemText>
        </MenuItem>
        <MenuItem onClick={handleKickFromMenu}>
          <ListItemIcon>
            <KickIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText sx={{ color: 'error.main' }}>
            {t('common.kick') || 'Kick'}
          </ListItemText>
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
              sx={{ border: 1, borderColor: 'divider', borderRadius: 1, mt: 1 }}
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
                        <TableCell sx={{ borderColor: 'divider' }}>
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
                                fontFamily: [
                                  'characterId',
                                  'accountId',
                                  'ip',
                                ].includes(field.key)
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
                                  handleCopy(String(rawValue ?? ''))
                                }
                                sx={{
                                  opacity: 0.4,
                                  '&:hover': { opacity: 1 },
                                  ml: 1,
                                  flexShrink: 0,
                                }}
                              >
                                <CopyIcon sx={{ fontSize: 13 }} />
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

      <ColumnSettingsDialog
        anchorEl={columnSettingsAnchor}
        onClose={() => setColumnSettingsAnchor(null)}
        columns={columns}
        onColumnsChange={handleColumnsChange}
        onReset={() => handleColumnsChange(DEFAULT_COLUMNS)}
      />

      {/* Export Progress Dialog */}
      <Dialog open={exporting} maxWidth="xs" fullWidth onClose={() => {}}>
        <DialogTitle sx={{ pb: 1 }}>{t('common.exporting')}</DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 1 }}>
            <LinearProgress
              variant="determinate"
              value={exportProgress}
              sx={{ height: 8, borderRadius: 4 }}
            />
          </Box>
          <Typography variant="body2" color="text.secondary">
            {exportProcessedCount.toLocaleString()} / {total.toLocaleString()} (
            {exportProgress}%)
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={handleCancelExport} size="small">
            {t('common.cancel')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PlayerListTab;
