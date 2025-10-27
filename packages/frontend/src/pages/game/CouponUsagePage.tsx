import React, { useEffect, useMemo, useState } from 'react';
import { Box, Typography, TextField, MenuItem, Card, CardContent, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, InputAdornment, IconButton, Tooltip, TableSortLabel } from '@mui/material';
import { History as HistoryIcon, Search as SearchIcon, ViewColumn as ViewColumnIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import SimplePagination from '@/components/common/SimplePagination';
import { useDebounce } from '@/hooks/useDebounce';
import DynamicFilterBar, { ActiveFilter, FilterDefinition } from '@/components/common/DynamicFilterBar';
import EmptyTableRow from '@/components/common/EmptyTableRow';
import { couponService, CouponSetting, UsageRecord } from '@/services/couponService';
import { formatDateTime } from '@/utils/dateFormat';
import ColumnSettingsDialog, { ColumnConfig } from '@/components/common/ColumnSettingsDialog';

// Coupon Usage page (admin view of redemption records)
const CouponUsagePage: React.FC = () => {
  const { t } = useTranslation();

  // settings selector
  const [settings, setSettings] = useState<CouponSetting[]>([]);
  const [settingId, setSettingId] = useState('');

  // list state
  const [records, setRecords] = useState<UsageRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [loading, setLoading] = useState(false);

  // search & dynamic filters
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);

  // derive individual filter values (stable for deps)
  const platformFilter = useMemo(() => activeFilters.find(f => f.key === 'platform')?.value as string || '', [activeFilters]);
  const worldFilter = useMemo(() => activeFilters.find(f => f.key === 'gameWorldId')?.value as string || '', [activeFilters]);
  const fromFilter = useMemo(() => activeFilters.find(f => f.key === 'from')?.value as string || '', [activeFilters]);
  const toFilter = useMemo(() => activeFilters.find(f => f.key === 'to')?.value as string || '', [activeFilters]);

  // filter definitions
  const availableFilterDefinitions: FilterDefinition[] = [
    { key: 'platform', label: t('coupons.couponUsage.filters.platform'), type: 'text', placeholder: t('coupons.couponUsage.filters.platform') as string },
    { key: 'gameWorldId', label: t('coupons.couponUsage.filters.gameWorldId'), type: 'text', placeholder: t('coupons.couponUsage.filters.gameWorldId') as string },
    { key: 'from', label: t('coupons.couponUsage.filters.from'), type: 'text', placeholder: 'YYYY-MM-DD HH:mm:ss' },
    { key: 'to', label: t('coupons.couponUsage.filters.to'), type: 'text', placeholder: 'YYYY-MM-DD HH:mm:ss' },
  ];


  // Column settings
  const defaultColumns: ColumnConfig[] = [
    { id: 'userId', labelKey: 'coupons.couponUsage.columns.userId', visible: true },
    { id: 'userName', labelKey: 'coupons.couponUsage.columns.userName', visible: true },
    { id: 'sequence', labelKey: 'coupons.couponUsage.columns.sequence', visible: true },
    { id: 'usedAt', labelKey: 'coupons.couponUsage.columns.usedAt', visible: true },
    { id: 'gameWorldId', labelKey: 'coupons.couponUsage.columns.gameWorldId', visible: true },
    { id: 'platform', labelKey: 'coupons.couponUsage.columns.platform', visible: true },
  ];

  const [columnSettingsAnchor, setColumnSettingsAnchor] = useState<HTMLElement | null>(null);

  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    const saved = localStorage.getItem('couponUsageColumns');
    if (saved) {
      try {
        const savedColumns = JSON.parse(saved);
        const mergedColumns = savedColumns.map((savedCol: ColumnConfig) => {
          const defaultCol = defaultColumns.find(c => c.id === savedCol.id);
          return defaultCol ? { ...defaultCol, ...savedCol } : savedCol;
        });
        const savedIds = new Set(savedColumns.map((c: ColumnConfig) => c.id));
        const newColumns = defaultColumns.filter(c => !savedIds.has(c.id));
        return [...mergedColumns, ...newColumns];
      } catch (e) {
        return defaultColumns;
      }
    }
    return defaultColumns;
  });

  const visibleColumns = useMemo(() => columns.filter(c => c.visible), [columns]);

  const handleColumnsChange = (newColumns: ColumnConfig[]) => {
    setColumns(newColumns);
    localStorage.setItem('couponUsageColumns', JSON.stringify(newColumns));
  };

  const handleResetColumns = () => {
    setColumns(defaultColumns);
    localStorage.setItem('couponUsageColumns', JSON.stringify(defaultColumns));
  };


  // Sorting state
  const [orderBy, setOrderBy] = useState<string>('usedAt');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');

  const handleSort = (colId: string) => {
    if (orderBy === colId) {
      setOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setOrderBy(colId);
      setOrder('asc');
    }
  };

  const sortedRecords = useMemo(() => {
    const getVal = (r: UsageRecord) => {
      switch (orderBy) {
        case 'userId': return r.userId || '';
        case 'userName': return r.userName || '';
        case 'sequence': return String(r.sequence ?? '');
        case 'usedAt': return r.usedAt || '';
        case 'gameWorldId': return r.gameWorldId || '';
        case 'platform': return r.platform || '';
        default: return '';
      }
    };
    const arr = [...records];
    arr.sort((a, b) => {
      const av = getVal(a);
      const bv = getVal(b);
      if (av < bv) return order === 'asc' ? -1 : 1;
      if (av > bv) return order === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [records, orderBy, order]);


  const handleFilterAdd = (filter: ActiveFilter) => { setActiveFilters(prev => [...prev, filter]); setPage(0); };
  const handleFilterRemove = (filterKey: string) => { setActiveFilters(prev => prev.filter(f => f.key !== filterKey)); setPage(0); };
  const handleFilterChange = (filterKey: string, value: any) => { setActiveFilters(prev => prev.map(f => f.key === filterKey ? { ...f, value } : f)); setPage(0); };

  // fetch settings list once
  useEffect(() => {
    (async () => {
      const res = await couponService.listSettings({ page: 1, limit: 100 });
      setSettings(res.settings || []);
      if (!settingId && res.settings && res.settings.length > 0) setSettingId(res.settings[0].id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // loader
  const load = useMemo(() => async () => {
    if (!settingId) return;
    setLoading(true);
    try {
      const res = await couponService.getUsage(settingId, {
        page: page + 1,
        limit: rowsPerPage,
        search: debouncedSearchTerm || undefined,
        platform: platformFilter || undefined,
        gameWorldId: worldFilter || undefined,
        from: fromFilter || undefined,
        to: toFilter || undefined,
      });
      setRecords(res.records || []);
      setTotal(res.total || 0);
    } finally {
      setLoading(false);
    }
  }, [settingId, page, rowsPerPage, debouncedSearchTerm, platformFilter, worldFilter, fromFilter, toFilter]);

  useEffect(() => { load(); }, [load]);

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <HistoryIcon />
            {t('coupons.couponUsage.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">{t('coupons.couponUsage.subtitle')}</Typography>
        </Box>
        <Box />
      </Box>

      {/* Search & Filters */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'nowrap', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'nowrap', flexGrow: 1, minWidth: 0 }}>
              <TextField
                placeholder={t('common.search') || ''}
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
                sx={{ minWidth: 300, flexGrow: 1, maxWidth: 500, '& .MuiOutlinedInput-root': { height: '40px', borderRadius: '20px', bgcolor: 'background.paper', transition: 'all 0.2s ease-in-out', '& fieldset': { borderColor: 'divider' }, '&:hover': { bgcolor: 'action.hover', '& fieldset': { borderColor: 'primary.light' } }, '&.Mui-focused': { bgcolor: 'background.paper', boxShadow: '0 0 0 2px rgba(25, 118, 210, 0.1)', '& fieldset': { borderColor: 'primary.main', borderWidth: '1px' } } }, '& .MuiInputBase-input': { fontSize: '0.875rem' } }}
                InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon sx={{ color: 'text.secondary', fontSize: 20 }} /></InputAdornment>) }}
                size="small"
              />

              <DynamicFilterBar
                availableFilters={availableFilterDefinitions}
                activeFilters={activeFilters}
                onFilterAdd={handleFilterAdd}
                onFilterRemove={handleFilterRemove}
                onFilterChange={handleFilterChange}
                onRefresh={load}
                refreshDisabled={loading}
                noWrap
                leftActions={(
                  <TextField select size="small" value={settingId} onChange={(e) => { setSettingId(e.target.value); setPage(0); }} sx={{ minWidth: 240 }} label={t('common.select')}>
                    {settings.map(s => (
                      <MenuItem key={s.id} value={s.id}>{s.name} ({s.type})</MenuItem>
                    ))}
                  </TextField>
                )}
                afterFilterAddActions={(
                  <Tooltip title={t('common.columnSettings')}>
                    <IconButton
                      onClick={(e) => setColumnSettingsAnchor(e.currentTarget)}
                      sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', '&:hover': { bgcolor: 'action.hover' } }}
                    >
                      <ViewColumnIcon />
                    </IconButton>
                  </Tooltip>
                )}
              />
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* List */}
      <Card>
        <CardContent sx={{ p: 0 }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {visibleColumns.map((col) => (
                    <TableCell key={col.id} sortDirection={orderBy === col.id ? order : false as any}>
                      <TableSortLabel
                        active={orderBy === col.id}
                        direction={orderBy === col.id ? order : 'asc'}
                        onClick={() => handleSort(col.id)}
                      >
                        {t(col.labelKey)}
                      </TableSortLabel>
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <EmptyTableRow colSpan={visibleColumns.length} loading message={t('common.loading') as string} />
                ) : records.length === 0 ? (
                  <EmptyTableRow colSpan={visibleColumns.length} loading={false} message={t('common.noData') as string} />
                ) : (
                  sortedRecords.map((r) => (
                    <TableRow key={r.id} hover>
                      {visibleColumns.map((col) => {
                        switch (col.id) {
                          case 'userId':
                            return (
                              <TableCell key="userId"><Typography variant="body2">{r.userId}</Typography></TableCell>
                            );
                          case 'userName':
                            return (
                              <TableCell key="userName"><Typography variant="body2">{r.userName}</Typography></TableCell>
                            );
                          case 'sequence':
                            return (
                              <TableCell key="sequence"><Typography variant="body2">{r.sequence}</Typography></TableCell>
                            );
                          case 'usedAt':
                            return (
                              <TableCell key="usedAt"><Typography variant="caption">{formatDateTime(r.usedAt)}</Typography></TableCell>
                            );
                          case 'gameWorldId':
                            return (
                              <TableCell key="gameWorldId"><Typography variant="body2">{r.gameWorldId || '-'}</Typography></TableCell>
                            );
                          case 'platform':


                            return (
                              <TableCell key="platform"><Typography variant="body2">{r.platform || '-'}</Typography></TableCell>
                            );
                          default:
                            return null;
                        }
                      })}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {!loading && records.length > 0 && (
            <SimplePagination
              count={total}
              page={page}
              rowsPerPage={rowsPerPage}
              onPageChange={(_, newPage) => setPage(newPage)}
              onRowsPerPageChange={(e: any) => { setRowsPerPage(Number(e.target.value)); setPage(0); }}
            />
          )}
        </CardContent>
      </Card>

      {/* Column Settings Dialog */}
      <ColumnSettingsDialog
        anchorEl={columnSettingsAnchor}
        onClose={() => setColumnSettingsAnchor(null)}
        columns={columns}
        onColumnsChange={handleColumnsChange}
        onReset={handleResetColumns}
      />

    </Box>
  );
};

export default CouponUsagePage;
