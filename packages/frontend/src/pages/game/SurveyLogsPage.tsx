import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  IconButton,
  Tooltip,
  Chip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material';
import {
  History as HistoryIcon,
  ViewColumn as ViewColumnIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import SimplePagination from '@/components/common/SimplePagination';
import SearchTextField from '@/components/common/SearchTextField';
import { CopyButton } from '@/components/common/CopyButton';
import { useDebounce } from '@/hooks/useDebounce';
import { usePageState } from '@/hooks/usePageState';
import RewardDisplay from '@/components/game/RewardDisplay';
import DateRangeSelector, {
  DateRangeValue,
  dateRangeToDatePair,
} from '@/components/common/DateRangeSelector';
import DynamicFilterBar, {
  ActiveFilter,
  FilterDefinition,
} from '@/components/common/DynamicFilterBar';
import ColumnSettingsDialog, {
  ColumnConfig,
} from '@/components/common/ColumnSettingsDialog';
import EmptyPagePlaceholder from '@/components/common/EmptyPagePlaceholder';
import PageContentLoader from '@/components/common/PageContentLoader';

import RecordDetailDialog, {
  DetailField,
} from '@/components/common/RecordDetailDialog';
import {
  formatRelativeTime,
  formatDateTimeDetailed,
  formatDateTime,
} from '@/utils/dateFormat';
import { useI18n } from '@/contexts/I18nContext';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import surveyService, { SurveyLog } from '@/services/surveyService';
import { Survey } from '@/services/surveyService';

const SurveyLogsPage: React.FC = () => {
  const { t } = useTranslation();
  const { language } = useI18n();
  const { enqueueSnackbar } = useSnackbar();
  const { getProjectApiPath } = useOrgProject();
  const projectApiPath = getProjectApiPath();

  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [logs, setLogs] = useState<SurveyLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filtersInitialized, setFiltersInitialized] = useState(false);

  // Sort state
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder(column === 'createdAt' ? 'desc' : 'asc');
    }
  };

  // Detail dialog state
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [detailLog, setDetailLog] = useState<SurveyLog | null>(null);

  const handleOpenDetail = (log: SurveyLog) => {
    setDetailLog(log);
    setDetailDialogOpen(true);
  };

  const DETAIL_FIELDS: DetailField[] = [
    {
      key: 'accountId',
      labelKey: 'surveys.logs.columns.accountId',
      mono: true,
    },
    { key: 'userName', labelKey: 'coupons.couponUsage.columns.userName' },
    { key: 'action', labelKey: 'surveys.logs.columns.action' },
    {
      key: 'characterId',
      labelKey: 'playerConnections.allPlayers.characterId',
      mono: true,
    },
    { key: 'worldId', labelKey: 'surveys.logs.columns.worldId' },
    { key: 'platform', labelKey: 'coupons.couponUsage.columns.platform' },
    { key: 'channel', labelKey: 'coupons.couponUsage.columns.channel' },
    { key: 'subchannel', labelKey: 'coupons.couponUsage.columns.subChannel' },
    {
      key: 'createdAt',
      labelKey: 'surveys.logs.columns.createdAt',
      format: (val) => formatDateTime(val),
    },
  ];

  // usePageState hook
  const { pageState, updatePage, updateLimit, updateFilters } = usePageState({
    defaultState: {
      page: 1,
      limit: 50,
      filters: {},
    },
    storageKey: 'surveyLogsState',
  });

  const page = pageState.page - 1;
  const rowsPerPage = pageState.limit;

  // Search state
  const [searchTerm, setSearchTerm] = useState(pageState.filters?.search || '');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  // Date Range State
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => ({
    type: 'preset',
    preset: '7d',
  }));

  // active filters
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);

  const availableFilterDefinitions = useMemo<FilterDefinition[]>(
    () => [
      {
        key: 'surveyId',
        label: t('surveys.logs.filters.survey'),
        type: 'select',
        options: surveys.map((s) => ({ value: s.id, label: s.surveyTitle })),
      },
      {
        key: 'action',
        label: t('surveys.logs.filters.action'),
        type: 'select',
        options: [
          { value: 'JOINED', label: 'JOINED' },
          { value: 'SENT', label: 'SENT' },
        ],
      },
      {
        key: 'userName',
        label: t('coupons.couponUsage.columns.userName'),
        type: 'text',
      },
      {
        key: 'platform',
        label: t('coupons.couponUsage.columns.platform'),
        type: 'text',
      },
      {
        key: 'channel',
        label: t('coupons.couponUsage.columns.channel'),
        type: 'text',
      },
      {
        key: 'subchannel',
        label: t('coupons.couponUsage.columns.subChannel'),
        type: 'text',
      },
      {
        key: 'worldId',
        label: t('surveys.logs.columns.worldId'),
        type: 'text',
      },
    ],
    [t, surveys]
  );

  // Restore active filters from URL query parameters (pageState)
  useEffect(() => {
    if (filtersInitialized || surveys.length === 0) return;

    const restoredFilters: ActiveFilter[] = [];
    Object.keys(pageState.filters || {}).forEach((key) => {
      if (['startDate', 'endDate', 'dateRangePreset', 'search'].includes(key))
        return;

      const def = availableFilterDefinitions.find((d) => d.key === key);
      if (def) {
        let label = def.label;
        if (def.type === 'select') {
          const opt = def.options?.find(
            (o) => String(o.value) === String(pageState.filters![key])
          );
          if (opt) label += ': ' + opt.label;
        }
        restoredFilters.push({
          key,
          value: pageState.filters![key],
          label: def.label,
          operator: 'any_of',
        });
      }
    });

    setActiveFilters(restoredFilters);
    setFiltersInitialized(true);
  }, [
    surveys,
    pageState.filters,
    filtersInitialized,
    availableFilterDefinitions,
  ]);

  // Sync debounced search term to URL (use ref to prevent infinite loop)
  const lastSyncedSearch = React.useRef(debouncedSearchTerm);
  useEffect(() => {
    if (!filtersInitialized) return;
    if (lastSyncedSearch.current === debouncedSearchTerm) return;
    lastSyncedSearch.current = debouncedSearchTerm;
    updateFilters({
      ...pageState.filters,
      search: debouncedSearchTerm || undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchTerm, filtersInitialized]);

  // Columns state
  const defaultColumns: ColumnConfig[] = useMemo(
    () => [
      {
        id: 'surveyId',
        labelKey: 'surveys.logs.columns.survey',
        visible: true,
      },
      { id: 'action', labelKey: 'surveys.logs.columns.action', visible: true },
      {
        id: 'accountId',
        labelKey: 'surveys.logs.columns.accountId',
        visible: true,
      },
      {
        id: 'userName',
        labelKey: 'coupons.couponUsage.columns.userName',
        visible: true,
      },
      {
        id: 'characterId',
        labelKey: 'surveys.logs.columns.characterId',
        visible: true,
      },
      {
        id: 'worldId',
        labelKey: 'surveys.logs.columns.worldId',
        visible: true,
      },
      {
        id: 'platform',
        labelKey: 'coupons.couponUsage.columns.platform',
        visible: true,
      },
      {
        id: 'channel',
        labelKey: 'coupons.couponUsage.columns.channel',
        visible: true,
      },
      {
        id: 'subchannel',
        labelKey: 'coupons.couponUsage.columns.subChannel',
        visible: true,
      },
      { id: 'rewards', labelKey: 'surveys.rewards', visible: true },
      {
        id: 'createdAt',
        labelKey: 'surveys.logs.columns.createdAt',
        visible: true,
      },
    ],
    []
  );

  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    const saved = localStorage.getItem('surveyLogsColumns');
    if (saved) {
      try {
        const savedColumns = JSON.parse(saved);
        const mergedColumns = savedColumns.map((savedCol: ColumnConfig) => {
          const defaultCol = defaultColumns.find((c) => c.id === savedCol.id);
          return defaultCol ? { ...defaultCol, ...savedCol } : savedCol;
        });
        const savedIds = new Set(savedColumns.map((c: ColumnConfig) => c.id));
        const newColumns = defaultColumns.filter((c) => !savedIds.has(c.id));
        return [...mergedColumns, ...newColumns];
      } catch (e) {
        return defaultColumns;
      }
    }
    return defaultColumns;
  });

  const visibleColumns = columns.filter((col) => col.visible);
  const [columnSettingsAnchor, setColumnSettingsAnchor] =
    useState<null | HTMLElement>(null);

  const handleColumnsChange = (newColumns: ColumnConfig[]) => {
    setColumns(newColumns);
    localStorage.setItem('surveyLogsColumns', JSON.stringify(newColumns));
  };

  const handleResetColumns = () => {
    setColumns(defaultColumns);
    localStorage.setItem('surveyLogsColumns', JSON.stringify(defaultColumns));
  };

  const handleFilterAdd = (filter: ActiveFilter) => {
    setActiveFilters((prev) => [...prev, filter]);
    updateFilters({ ...pageState.filters, [filter.key]: filter.value });
  };
  const handleFilterRemove = (filterKey: string) => {
    setActiveFilters((prev) => prev.filter((f) => f.key !== filterKey));
    const newFilters = { ...pageState.filters };
    delete newFilters[filterKey];
    updateFilters(newFilters);
  };
  const handleFilterChange = (filterKey: string, value: any) => {
    setActiveFilters((prev) =>
      prev.map((f) => (f.key === filterKey ? { ...f, value } : f))
    );
    updateFilters({ ...pageState.filters, [filterKey]: value });
  };

  const handleDateRangeChange = (newDateRange: DateRangeValue) => {
    setDateRange(newDateRange);
    const { start, end } = dateRangeToDatePair(newDateRange);
    updateFilters({
      ...pageState.filters,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    });
  };

  // Fetch all surveys for filter dropdown
  useEffect(() => {
    (async () => {
      try {
        const res = await surveyService.getSurveys(projectApiPath, {
          page: 1,
          limit: 100,
        });
        setSurveys(res.surveys || []);
      } catch (err) {
        console.error('Failed to load surveys', err);
      }
    })();
  }, [projectApiPath]);

  // loader
  const load = useCallback(async () => {
    if (!filtersInitialized) return;
    setLoading(true);
    try {
      const res = await surveyService.getSurveyLogs(projectApiPath, {
        page: pageState.page,
        limit: pageState.limit,
        search: pageState.filters?.search,
        surveyId: pageState.filters?.surveyId,
        action: pageState.filters?.action,
        userName: pageState.filters?.userName,
        worldId: pageState.filters?.worldId,
        platform: pageState.filters?.platform,
        channel: pageState.filters?.channel,
        subchannel: pageState.filters?.subchannel,
        startDate: pageState.filters?.startDate,
        endDate: pageState.filters?.endDate,
        sortBy,
        sortOrder,
      });
      setLogs(res.logs || []);
      setTotal(res.pagination.total || 0);
    } catch (err) {
      console.error('Failed to load survey logs', err);
    } finally {
      setLoading(false);
    }
  }, [
    projectApiPath,
    pageState.page,
    pageState.limit,
    pageState.filters,
    filtersInitialized,
    sortBy,
    sortOrder,
  ]);

  useEffect(() => {
    load();
  }, [load]);

  const getSurvey = (id: string) => surveys.find((survey) => survey.id === id);
  const getSurveyTitle = (id: string) => getSurvey(id)?.surveyTitle || id;

  const renderCellContent = (r: SurveyLog, columnId: string) => {
    switch (columnId) {
      case 'surveyId':
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="body2">
              {getSurveyTitle(r.surveyId)}
            </Typography>
            <CopyButton text={r.surveyId} size={13} />
          </Box>
        );
      case 'action':
        return (
          <Chip
            label={t(`surveys.logsDrawer.action.${r.action}`, r.action)}
            size="small"
            color={r.action === 'JOINED' ? 'success' : 'primary'}
            sx={{ fontWeight: 'bold', fontSize: '0.75rem', height: 24 }}
          />
        );
      case 'accountId':
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography
              variant="body2"
              sx={{
                cursor: 'pointer',
                color: 'primary.main',
                '&:hover': { textDecoration: 'underline' },
              }}
              onClick={() => handleOpenDetail(r)}
            >
              {r.accountId}
            </Typography>
            <CopyButton text={r.accountId} size={13} />
          </Box>
        );
      case 'userName':
        return r.userName ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography
              variant="body2"
              sx={{
                cursor: 'pointer',
                color: 'primary.main',
                '&:hover': { textDecoration: 'underline' },
              }}
              onClick={() => handleOpenDetail(r)}
            >
              {r.userName}
            </Typography>
            <CopyButton text={r.userName || ''} size={13} />
          </Box>
        ) : (
          '-'
        );
      case 'characterId':
        return r.characterId ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography
              variant="body2"
              sx={{
                cursor: 'pointer',
                color: 'primary.main',
                '&:hover': { textDecoration: 'underline' },
              }}
              onClick={() => handleOpenDetail(r)}
            >
              {r.characterId}
            </Typography>
            <CopyButton text={r.characterId!} size={13} />
          </Box>
        ) : (
          '-'
        );
      case 'platform':
        return <Typography variant="body2">{r.platform || '-'}</Typography>;
      case 'channel':
        return <Typography variant="body2">{r.channel || '-'}</Typography>;
      case 'subchannel':
        return <Typography variant="body2">{r.subchannel || '-'}</Typography>;
      case 'worldId':
        return <Typography variant="body2">{r.worldId || '-'}</Typography>;
      case 'rewards':
        return getSurvey(r.surveyId) && r.action === 'JOINED' ? (
          <RewardDisplay
            rewards={getSurvey(r.surveyId)?.participationRewards}
            rewardTemplateId={getSurvey(r.surveyId)?.rewardTemplateId}
            maxDisplay={2}
          />
        ) : (
          '-'
        );
      case 'createdAt':
        return (
          <Tooltip title={formatDateTimeDetailed(r.createdAt)}>
            <Typography variant="caption">
              {formatRelativeTime(r.createdAt, undefined, language)}
            </Typography>
          </Tooltip>
        );
      default:
        return null;
    }
  };

  return (
    <>
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
              placeholder={t('common.search') || ''}
              value={searchTerm}
              onChange={(value) => {
                setSearchTerm(value);
              }}
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
                availableFilters={availableFilterDefinitions}
                activeFilters={activeFilters}
                onFilterAdd={handleFilterAdd}
                onFilterRemove={handleFilterRemove}
                onFilterChange={handleFilterChange}
              />

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
                  <ViewColumnIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          <DateRangeSelector
            value={dateRange}
            onChange={handleDateRangeChange}
            compact
          />
        </Box>
      </Box>

      <PageContentLoader
        loading={!filtersInitialized || (loading && logs.length === 0)}
      >
        {logs.length === 0 && !loading && filtersInitialized ? (
          <EmptyPagePlaceholder message={t('surveys.logs.noRecords')} />
        ) : (
          <Card variant="outlined">
            <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
              <PageContentLoader loading={loading}>
                <Box>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          {visibleColumns.map((column) => (
                            <TableCell
                              key={column.id}
                              sortDirection={
                                sortBy === column.id ? sortOrder : false
                              }
                            >
                              <TableSortLabel
                                active={sortBy === column.id}
                                direction={
                                  sortBy === column.id
                                    ? sortOrder
                                    : column.id === 'createdAt'
                                      ? 'desc'
                                      : 'asc'
                                }
                                onClick={() => handleSort(column.id)}
                              >
                                {t(column.labelKey)}
                              </TableSortLabel>
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {logs.map((r) => (
                          <TableRow key={r.id} hover>
                            {visibleColumns.map((column) => (
                              <TableCell key={column.id}>
                                {renderCellContent(r, column.id)}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              </PageContentLoader>
              {logs.length > 0 && (
                <SimplePagination
                  page={page}
                  count={total}
                  rowsPerPage={rowsPerPage}
                  onPageChange={(event, newPage) => updatePage(newPage + 1)}
                  onRowsPerPageChange={(event: any) => {
                    updateLimit(Number(event.target.value));
                  }}
                />
              )}
            </CardContent>
          </Card>
        )}
      </PageContentLoader>

      {/* Column Settings Dialog */}
      <ColumnSettingsDialog
        anchorEl={columnSettingsAnchor}
        onClose={() => setColumnSettingsAnchor(null)}
        columns={columns}
        onColumnsChange={(newCols) => handleColumnsChange(newCols)}
        onReset={handleResetColumns}
      />

      {/* Detail Dialog */}
      <RecordDetailDialog
        open={detailDialogOpen}
        onClose={() => setDetailDialogOpen(false)}
        title={t('playerConnections.allPlayers.viewDetails')}
        data={detailLog}
        fields={DETAIL_FIELDS}
      />
    </>
  );
};

export default SurveyLogsPage;
