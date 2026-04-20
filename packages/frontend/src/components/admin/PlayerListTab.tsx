import React, { useState, useEffect, useCallback } from 'react';
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
  TableSortLabel,
} from '@mui/material';
import {
  Block as KickIcon,
  ViewColumn as ColumnIcon,
  ErrorOutline as ErrorIcon,
  ContentCopy as CopyIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import RelativeTime from '../common/RelativeTime';
import { copyToClipboardWithNotification } from '../../utils/clipboard';
import playerConnectionService from '../../services/playerConnectionService';
import type { ConnectedUser } from '../../services/playerConnectionService';
import PageContentLoader from '../common/PageContentLoader';
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
    id: 'connectedAt',
    labelKey: 'playerConnections.players.connectedAt',
    visible: true,
  },
  { id: 'ip', labelKey: 'playerConnections.players.ip', visible: false },
];

interface Props {
  projectApiPath: string;
  worlds: Array<{ worldId: string; name: string; count: number }>;
  onKickUser: (userId: string) => void;
}

const PlayerListTab: React.FC<Props> = ({
  projectApiPath,
  worlds,
  onKickUser,
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

  // Persist settings
  useEffect(() => {
    localStorage.setItem(
      'playerConnections.listSettings',
      JSON.stringify({ rowsPerPage, sortBy, sortDesc })
    );
  }, [rowsPerPage, sortBy, sortDesc]);

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
      if (saved) return JSON.parse(saved);
    } catch {
      /* ignore */
    }
    return DEFAULT_COLUMNS;
  });
  const [columnSettingsAnchor, setColumnSettingsAnchor] =
    useState<null | HTMLElement>(null);

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
    params.set('tab', '2');
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

    setSearchParams(params, { replace: true });
  }, [page, activeFilters, search, sortBy, sortDesc]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const COPY_COLUMNS = [
    'userId',
    'accountId',
    'characterId',
    'userName',
    'worldId',
    'worldName',
    'ip',
  ];
  const MONO_COLUMNS = ['userId', 'accountId', 'characterId', 'ip'];

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

    const value = user[colId] ?? '-';
    const hasCopy = COPY_COLUMNS.includes(colId) && value !== '-';
    const isMono = MONO_COLUMNS.includes(colId);

    if (hasCopy) {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography
            variant="body2"
            sx={isMono ? { fontFamily: 'monospace', fontSize: '0.8rem' } : {}}
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
            <CopyIcon sx={{ fontSize: 14 }} color="action" />
          </IconButton>
        </Box>
      );
    }

    return (
      <Typography
        variant="body2"
        sx={isMono ? { fontFamily: 'monospace', fontSize: '0.8rem' } : {}}
      >
        {value}
      </Typography>
    );
  };

  const handlePageChange = (_: unknown, newPage: number) => setPage(newPage);
  const handleRowsPerPageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(e.target.value, 10));
    setPage(0);
  };

  return (
    <Box>
      {/* Filter bar */}
      <Box
        sx={{
          display: 'flex',
          gap: 1,
          alignItems: 'center',
          flexWrap: 'wrap',
          mb: 1.5,
        }}
      >
        <SearchTextField
          placeholder={t('playerConnections.players.searchPlaceholder')}
          value={search}
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
            <ColumnIcon />
          </IconButton>
        </Tooltip>
        <Box sx={{ flex: 1 }} />
        <Tooltip title={t('common.refresh')}>
          <IconButton
            onClick={loadUsers}
            disabled={loading}
            sx={{
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              '&:hover': { bgcolor: 'primary.dark' },
              '&.Mui-disabled': { bgcolor: 'action.disabledBackground' },
            }}
          >
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

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

      {/* Table */}
      <PageContentLoader loading={isInitialLoad && loading}>
        {!error && users.length === 0 ? (
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
                  {users.map((user, idx) => (
                    <TableRow key={user.userId || idx} hover>
                      {visibleColumns.map((col) => (
                        <TableCell key={col.id}>
                          {renderCell(user, col.id)}
                        </TableCell>
                      ))}
                      <TableCell align="center">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            onKickUser(user.userId);
                          }}
                        >
                          <KickIcon fontSize="small" color="error" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
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
                rowsPerPageOptions={[10, 20, 50, 100]}
              />
            )}
          </Card>
        ) : null}
      </PageContentLoader>

      <ColumnSettingsDialog
        anchorEl={columnSettingsAnchor}
        onClose={() => setColumnSettingsAnchor(null)}
        columns={columns}
        onColumnsChange={handleColumnsChange}
        onReset={() => handleColumnsChange(DEFAULT_COLUMNS)}
      />
    </Box>
  );
};

export default PlayerListTab;
