import React, { useEffect, useMemo, useState } from 'react';
import { Box, Typography, TextField, MenuItem, Card, CardContent, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, InputAdornment, IconButton, Tooltip, TableSortLabel, Button, Dialog, DialogTitle, DialogContent, DialogActions, LinearProgress, Menu } from '@mui/material';
import { History as HistoryIcon, Search as SearchIcon, ViewColumn as ViewColumnIcon, Download as DownloadIcon, ContentCopy as ContentCopyIcon } from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import SimplePagination from '@/components/common/SimplePagination';
import { copyToClipboardWithNotification } from '@/utils/clipboard';
import { useDebounce } from '@/hooks/useDebounce';
import DynamicFilterBar, { ActiveFilter, FilterDefinition } from '@/components/common/DynamicFilterBar';
import EmptyTableRow from '@/components/common/EmptyTableRow';
import { couponService, CouponSetting, UsageRecord } from '@/services/couponService';
import { formatDateTime, getStoredTimezone } from '@/utils/dateFormat';
import ColumnSettingsDialog, { ColumnConfig } from '@/components/common/ColumnSettingsDialog';

// Coupon Usage page (admin view of redemption records)
const CouponUsagePage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  // settings list
  const [settings, setSettings] = useState<CouponSetting[]>([]);

  // list state
  const [records, setRecords] = useState<UsageRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [loading, setLoading] = useState(false);

  // export state
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportProcessedCount, setExportProcessedCount] = useState(0);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'xlsx'>('csv');
  const [exportMenuAnchor, setExportMenuAnchor] = useState<null | HTMLElement>(null);
  const exportAbortControllerRef = React.useRef<AbortController | null>(null);

  // search & dynamic filters
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);

  // derive individual filter values (stable for deps)
  const settingIdFilter = useMemo(() => activeFilters.find(f => f.key === 'settingId')?.value as string || '', [activeFilters]);
  const platformFilter = useMemo(() => activeFilters.find(f => f.key === 'platform')?.value as string || '', [activeFilters]);
  const channelFilter = useMemo(() => activeFilters.find(f => f.key === 'channel')?.value as string || '', [activeFilters]);
  const subChannelFilter = useMemo(() => activeFilters.find(f => f.key === 'subChannel')?.value as string || '', [activeFilters]);
  const worldFilter = useMemo(() => activeFilters.find(f => f.key === 'gameWorldId')?.value as string || '', [activeFilters]);
  const couponCodeFilter = useMemo(() => activeFilters.find(f => f.key === 'couponCode')?.value as string || '', [activeFilters]);
  const characterIdFilter = useMemo(() => activeFilters.find(f => f.key === 'characterId')?.value as string || '', [activeFilters]);

  // filter definitions
  const availableFilterDefinitions: FilterDefinition[] = [
    { key: 'settingId', label: t('coupons.couponUsage.filters.coupon'), type: 'select', options: settings.map(s => ({ value: s.id, label: `${s.name} (${s.type})` })) },
    { key: 'couponCode', label: t('coupons.couponUsage.filters.couponCode'), type: 'text', placeholder: t('coupons.couponUsage.filters.couponCode') as string },
    { key: 'platform', label: t('coupons.couponUsage.filters.platform'), type: 'text', placeholder: t('coupons.couponUsage.filters.platform') as string },
    { key: 'channel', label: t('coupons.couponUsage.filters.channel'), type: 'text', placeholder: t('coupons.couponUsage.filters.channel') as string },
    { key: 'subChannel', label: t('coupons.couponUsage.filters.subChannel'), type: 'text', placeholder: t('coupons.couponUsage.filters.subChannel') as string },
    { key: 'gameWorldId', label: t('coupons.couponUsage.filters.gameWorldId'), type: 'text', placeholder: t('coupons.couponUsage.filters.gameWorldId') as string },
    { key: 'characterId', label: t('coupons.couponUsage.filters.characterId'), type: 'text', placeholder: t('coupons.couponUsage.filters.characterId') as string },
  ];


  // Column settings
  const defaultColumns: ColumnConfig[] = [
    { id: 'couponName', labelKey: 'coupons.couponUsage.columns.couponName', visible: true },
    { id: 'couponCode', labelKey: 'coupons.couponUsage.columns.couponCode', visible: true },
    { id: 'userId', labelKey: 'coupons.couponUsage.columns.userId', visible: true },
    { id: 'userName', labelKey: 'coupons.couponUsage.columns.userName', visible: true },
    { id: 'characterId', labelKey: 'coupons.couponUsage.columns.characterId', visible: true },
    { id: 'sequence', labelKey: 'coupons.couponUsage.columns.sequence', visible: true },
    { id: 'usedAt', labelKey: 'coupons.couponUsage.columns.usedAt', visible: true },
    { id: 'couponStartsAt', labelKey: 'coupons.couponUsage.columns.couponStartsAt', visible: true },
    { id: 'couponExpiresAt', labelKey: 'coupons.couponUsage.columns.couponExpiresAt', visible: true },
    { id: 'gameWorldId', labelKey: 'coupons.couponUsage.columns.gameWorldId', visible: true },
    { id: 'platform', labelKey: 'coupons.couponUsage.columns.platform', visible: true },
    { id: 'channel', labelKey: 'coupons.couponUsage.columns.channel', visible: true },
    { id: 'subChannel', labelKey: 'coupons.couponUsage.columns.subChannel', visible: true },
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

  // Copy to clipboard handler
  const handleCopy = (text: string | undefined) => {
    if (!text) return;
    copyToClipboardWithNotification(
      text,
      () => enqueueSnackbar(t('common.copiedToClipboard'), { variant: 'success' }),
      () => enqueueSnackbar(t('common.copyFailed'), { variant: 'error' })
    );
  };

  const sortedRecords = useMemo(() => {
    const getVal = (r: UsageRecord) => {
      switch (orderBy) {
        case 'couponName': return r.couponName || '';
        case 'couponCode': return r.couponCode || '';
        case 'userId': return r.userId || '';
        case 'userName': return r.userName || '';
        case 'sequence': return String(r.sequence ?? '');
        case 'usedAt': return r.usedAt || '';
        case 'couponStartsAt': return r.couponStartsAt || '';
        case 'couponExpiresAt': return r.couponExpiresAt || '';
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
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // loader
  const load = useMemo(() => async () => {
    setLoading(true);
    try {
      const res = await couponService.getUsage(settingIdFilter || undefined, {
        page: page + 1,
        limit: rowsPerPage,
        search: debouncedSearchTerm || undefined,
        platform: platformFilter || undefined,
        channel: channelFilter || undefined,
        subChannel: subChannelFilter || undefined,
        gameWorldId: worldFilter || undefined,
        characterId: characterIdFilter || undefined,
      } as any);
      setRecords(res.records || []);
      setTotal(res.total || 0);
    } finally {
      setLoading(false);
    }
  }, [settingIdFilter, page, rowsPerPage, debouncedSearchTerm, platformFilter, channelFilter, subChannelFilter, worldFilter, characterIdFilter]);

  useEffect(() => { load(); }, [load]);

  // Export usage records to CSV or XLSX
  const handleExport = async (format: 'csv' | 'xlsx') => {
    try {
      // Get user's timezone setting
      const userTimezone = getStoredTimezone();

      // Close menu
      setExportMenuAnchor(null);

      // Call backend API to get data with timezone conversion
      const exportResult = await couponService.exportUsage({
        ...(settingIdFilter && { settingId: settingIdFilter }),
        ...(couponCodeFilter && { couponCode: couponCodeFilter }),
        ...(platformFilter && { platform: platformFilter }),
        ...(channelFilter && { channel: channelFilter }),
        ...(subChannelFilter && { subChannel: subChannelFilter }),
        ...(worldFilter && { gameWorldId: worldFilter }),
        ...(characterIdFilter && { characterId: characterIdFilter }),
        timezone: userTimezone,
      });

      const records = exportResult.records || [];
      const filename = exportResult.filename;

      if (format === 'csv') {
        // CSV export
        const headers = Object.keys(records[0] || {});
        const csvContent = [
          headers.join(','),
          ...records.map((r: any) => headers.map(h => {
            const cell = r[h] || '-';
            const str = String(cell);
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          }).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${filename}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } else if (format === 'xlsx') {
        // XLSX export using xlsx library
        const XLSX = await import('xlsx');
        const ws = XLSX.utils.json_to_sheet(records);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Coupon Usage');
        const xlsxBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([xlsxBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${filename}.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }

      enqueueSnackbar(t('coupons.couponSettings.exportSuccess'), { variant: 'success' });
    } catch (error: any) {
      console.error('Export error:', error);
      enqueueSnackbar(error.message || t('coupons.couponSettings.exportError'), { variant: 'error' });
    }
  };

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
        <Box>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={(e) => setExportMenuAnchor(e.currentTarget)}
            disabled={exporting || records.length === 0}
          >
            {exporting ? t('common.exporting') : t('common.export')}
          </Button>
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
        <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
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
                  <EmptyTableRow colSpan={visibleColumns.length} loading={false} message={t('coupons.couponUsage.noRecords') as string} />
                ) : (
                  sortedRecords.map((r) => (
                    <TableRow key={r.id} hover>
                      {visibleColumns.map((col) => {
                        switch (col.id) {
                          case 'couponName':
                            return (
                              <TableCell key="couponName">
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <Typography variant="body2">{r.couponName || '-'}</Typography>
                                  {r.couponName && (
                                    <Tooltip title={t('common.copy')}>
                                      <IconButton size="small" onClick={() => handleCopy(r.couponName)}>
                                        <ContentCopyIcon fontSize="inherit" />
                                      </IconButton>
                                    </Tooltip>
                                  )}
                                </Box>
                              </TableCell>
                            );
                          case 'couponCode':
                            return (
                              <TableCell key="couponCode">
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <Typography variant="body2">{r.couponCode || '-'}</Typography>
                                  {r.couponCode && (
                                    <Tooltip title={t('common.copy')}>
                                      <IconButton size="small" onClick={() => handleCopy(r.couponCode)}>
                                        <ContentCopyIcon fontSize="inherit" />
                                      </IconButton>
                                    </Tooltip>
                                  )}
                                </Box>
                              </TableCell>
                            );
                          case 'userId':
                            return (
                              <TableCell key="userId">
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <Typography variant="body2">{r.userId}</Typography>
                                  <Tooltip title={t('common.copy')}>
                                    <IconButton size="small" onClick={() => handleCopy(r.userId)}>
                                      <ContentCopyIcon fontSize="inherit" />
                                    </IconButton>
                                  </Tooltip>
                                </Box>
                              </TableCell>
                            );
                          case 'userName':
                            return (
                              <TableCell key="userName">
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <Typography variant="body2">{r.userName}</Typography>
                                  <Tooltip title={t('common.copy')}>
                                    <IconButton size="small" onClick={() => handleCopy(r.userName)}>
                                      <ContentCopyIcon fontSize="inherit" />
                                    </IconButton>
                                  </Tooltip>
                                </Box>
                              </TableCell>
                            );
                          case 'characterId':
                            return (
                              <TableCell key="characterId">
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <Typography variant="body2">{r.characterId || '-'}</Typography>
                                  {r.characterId && (
                                    <Tooltip title={t('common.copy')}>
                                      <IconButton size="small" onClick={() => handleCopy(r.characterId)}>
                                        <ContentCopyIcon fontSize="inherit" />
                                      </IconButton>
                                    </Tooltip>
                                  )}
                                </Box>
                              </TableCell>
                            );
                          case 'sequence':
                            return (
                              <TableCell key="sequence"><Typography variant="body2">{r.sequence}</Typography></TableCell>
                            );
                          case 'usedAt':
                            return (
                              <TableCell key="usedAt"><Typography variant="caption">{formatDateTime(r.usedAt)}</Typography></TableCell>
                            );
                          case 'couponStartsAt':
                            return (
                              <TableCell key="couponStartsAt"><Typography variant="caption">{r.couponStartsAt ? formatDateTime(r.couponStartsAt) : '-'}</Typography></TableCell>
                            );
                          case 'couponExpiresAt':
                            return (
                              <TableCell key="couponExpiresAt"><Typography variant="caption">{r.couponExpiresAt ? formatDateTime(r.couponExpiresAt) : '-'}</Typography></TableCell>
                            );
                          case 'gameWorldId':
                            return (
                              <TableCell key="gameWorldId"><Typography variant="body2">{r.gameWorldId || '-'}</Typography></TableCell>
                            );
                          case 'platform':
                            return (
                              <TableCell key="platform"><Typography variant="body2">{r.platform || '-'}</Typography></TableCell>
                            );
                          case 'channel':
                            return (
                              <TableCell key="channel"><Typography variant="body2">{r.channel || '-'}</Typography></TableCell>
                            );
                          case 'subChannel':
                            return (
                              <TableCell key="subChannel"><Typography variant="body2">{r.subchannel || '-'}</Typography></TableCell>
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

      {/* Export Progress Dialog - Only show for large datasets (>1000 records) */}
      <Dialog
        open={(exporting || exportSuccess || exportError !== null) && total > 1000}
        onClose={() => {
          if (!exporting) {
            setExportSuccess(false);
            setExportError(null);
            setExportProgress(0);
            setExportProcessedCount(0);
          }
        }}
        maxWidth="sm"
        fullWidth
        disableEscapeKeyDown={exporting}
      >
        <DialogTitle>
          {exportSuccess
            ? t('coupons.couponUsage.exportDialog.completed')
            : exportError
              ? t('coupons.couponUsage.exportDialog.failed')
              : t('coupons.couponUsage.exportDialog.title')}
        </DialogTitle>
        <DialogContent sx={{ py: 3 }}>
          {exporting ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant="body2" color="text.secondary">
                {t('coupons.couponUsage.exportDialog.processing')}
              </Typography>
              <Box>
                <LinearProgress
                  variant="determinate"
                  value={exportProgress}
                  sx={{ height: 8, borderRadius: 1 }}
                />
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  {t('coupons.couponUsage.exportDialog.progress', {
                    processed: exportProcessedCount,
                    total: total
                  })}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {exportProgress}%
                </Typography>
              </Box>
            </Box>
          ) : exportSuccess ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                {t('coupons.couponUsage.exportDialog.successMessage')}
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant="body2" color="error">
                {exportError}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          {exporting ? (
            <Button
              onClick={() => {
                exportAbortControllerRef.current?.abort();
              }}
              color="error"
            >
              {t('common.cancel')}
            </Button>
          ) : (
            <Button
              onClick={() => {
                setExportSuccess(false);
                setExportError(null);
                setExportProgress(0);
                setExportProcessedCount(0);
              }}
            >
              {t('common.close')}
            </Button>
          )}
        </DialogActions>
      </Dialog>

    </Box>
  );
};

export default CouponUsagePage;
