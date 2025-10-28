import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Box, Typography, Button, TextField, IconButton, Chip, MenuItem, Stack, Card, CardContent, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, InputAdornment, Tooltip, TableSortLabel, FormControlLabel, Checkbox, Snackbar, LinearProgress } from '@mui/material';
import { Settings as SettingsIcon, Delete as DeleteIcon, Edit as EditIcon, Add as AddIcon, Search as SearchIcon, ViewColumn as ViewColumnIcon, List as ListIcon, ContentCopy as ContentCopyIcon, Code as CodeIcon, CardGiftcard as CardGiftcardIcon, HourglassEmpty as HourglassEmptyIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useDebounce } from '@/hooks/useDebounce';
import SimplePagination from '@/components/common/SimplePagination';
import { couponService, CouponSetting, CouponStatus, CouponType, IssuedCouponCode } from '@/services/couponService';

import DynamicFilterBar, { FilterDefinition, ActiveFilter } from '@/components/common/DynamicFilterBar';
import EmptyTableRow from '@/components/common/EmptyTableRow';
import { formatDateTime, parseUTCForPicker } from '@/utils/dateFormat';
import ColumnSettingsDialog, { ColumnConfig } from '@/components/common/ColumnSettingsDialog';
import ResizableDrawer from '@/components/common/ResizableDrawer';
import SDKGuideDrawer from '@/components/coupons/SDKGuideDrawer';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { Dayjs } from 'dayjs';
// Coupon Settings page (list and management of coupon definitions)
const CouponSettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  // list state
  const [items, setItems] = useState<CouponSetting[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [loading, setLoading] = useState(false);


  // selection state for table rows
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // filters
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);

  const typeFilter = useMemo(() => {
    const f = activeFilters.find((f) => f.key === 'type');
    return f?.value as CouponType | undefined;
  }, [activeFilters]);

  const statusFilter = useMemo(() => {
    const f = activeFilters.find((f) => f.key === 'status');
    return f?.value as CouponStatus | undefined;
  }, [activeFilters]);

  const typeFilterString = useMemo(() => typeFilter || '', [typeFilter]);
  const statusFilterString = useMemo(() => statusFilter || '', [statusFilter]);


  // Issued codes drawer state
  const [openCodes, setOpenCodes] = useState(false);
  const [codesSetting, setCodesSetting] = useState<CouponSetting | null>(null);
  const [codesSearch, setCodesSearch] = useState('');
  const debouncedCodesSearch = useDebounce(codesSearch, 500);
  const [codesLoading, setCodesLoading] = useState(false);
  const [codesItems, setCodesItems] = useState<IssuedCouponCode[]>([]);
  const [codesTotal, setCodesTotal] = useState(0);
  const [codesPage, setCodesPage] = useState(0);
  const [codesRowsPerPage, setCodesRowsPerPage] = useState(20);

  // SDK Guide drawer state
  const [openSDKGuide, setOpenSDKGuide] = useState(false);

  const [copyOpen, setCopyOpen] = useState(false);
  const [copyMessage, setCopyMessage] = useState('');

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopyMessage(t('coupons.couponSettings.codeCopied') as string);
      setCopyOpen(true);
    } catch (e) {
      // noop: clipboard may not be available in some contexts
      console.error('Failed to copy coupon code', e);
    }
  };

  const handleCopyName = async (name: string) => {
    try {
      await navigator.clipboard.writeText(name);
      setCopyMessage(t('coupons.couponSettings.nameCopied') as string);
      setCopyOpen(true);
    } catch (e) {
      // noop: clipboard may not be available in some contexts
      console.error('Failed to copy coupon name', e);
    }
  };

  const handleOpenCodes = (it: CouponSetting) => {
    setCodesSetting(it);
    setOpenCodes(true);
    setCodesPage(0);
  };

  // form dialog state
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<CouponSetting | null>(null);
  const [form, setForm] = useState<any>({
    code: '',
    type: 'NORMAL' as CouponType,
    name: '',
    description: '',
    quantity: 1,
    perUserLimit: 1,
    maxTotalUses: null as any,
    startsAt: null as Dayjs | null,
    expiresAt: null as Dayjs | null,
    status: 'ACTIVE' as CouponStatus,
  });

  const resetForm = () => {
    setEditing(null);
    setForm({ code: '', type: 'NORMAL', name: '', description: '', quantity: 1, perUserLimit: 1, maxTotalUses: null, startsAt: null, expiresAt: null, status: 'ACTIVE' });
  };

  const availableFilterDefinitions: FilterDefinition[] = [
    {
      key: 'type',
      label: t('common.type'),
      type: 'select',
      options: [
        { value: 'SPECIAL', label: 'SPECIAL' },
        { value: 'NORMAL', label: 'NORMAL' },
      ],
    },
    {
      key: 'status',
      label: t('common.status'),
      type: 'select',
      options: [
        { value: 'ACTIVE', label: t('common.enabled') },
        { value: 'DISABLED', label: t('common.disabled') },
        { value: 'DELETED', label: t('status.deleted') },
      ],
    },
  ];


  // Column settings (visible columns with localStorage persistence)
  const defaultColumns: ColumnConfig[] = [
    { id: 'name', labelKey: 'common.name', visible: true },
    { id: 'code', labelKey: 'coupons.couponSettings.columns.code', visible: true },
    { id: 'type', labelKey: 'common.type', visible: true },
    { id: 'status', labelKey: 'common.status', visible: true },
    { id: 'usageRate', labelKey: 'coupons.couponSettings.columns.usageRate', visible: true },
    { id: 'start', labelKey: 'common.start', visible: true },
    { id: 'end', labelKey: 'common.end', visible: true },
    { id: 'createdAt', labelKey: 'common.createdAt', visible: true },
    { id: 'description', labelKey: 'common.description', visible: true },
  ];

  const [columnSettingsAnchor, setColumnSettingsAnchor] = useState<HTMLElement | null>(null);

  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    const saved = localStorage.getItem('couponSettingsColumns');
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

  const visibleColumns = useMemo(() => columns.filter(col => col.visible), [columns]);

  // Sorting state
  const [orderBy, setOrderBy] = useState<string>('name');
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');

  const handleSort = (colId: string) => {
    if (orderBy === colId) {
      setOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setOrderBy(colId);
      setOrder('asc');
    }
  };

  const sortedItems = useMemo(() => {
    const getVal = (it: CouponSetting) => {
      switch (orderBy) {
        case 'name':
          return (it.name || '').toLowerCase();
        case 'type':
          return it.type || '';
        case 'status':
          return it.status || '';
        case 'start':
          return it.startsAt || '';
        case 'end':
          return it.expiresAt || '';
        case 'description':
          return ((it as any).description || '').toLowerCase();
        case 'usageRate': {
          // Calculate usage rate percentage for sorting
          if (it.type === 'SPECIAL') {
            return it.maxTotalUses ? (it.usedCount || 0) / it.maxTotalUses * 100 : 0;
          } else {
            const totalIssued = it.generatedCount || it.issuedCount || 0;
            return totalIssued > 0 ? (it.usedCount || 0) / totalIssued * 100 : 0;
          }
        }
        default:
          return '';
      }
    };
    const arr = [...items];
    arr.sort((a, b) => {
      const av = getVal(a);
      const bv = getVal(b);
      if (av < bv) return order === 'asc' ? -1 : 1;
      if (av > bv) return order === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;


  }, [items, orderBy, order]);
  const isSpecial = form.type === 'SPECIAL';
  const codeError = isSpecial && (!form.code || String(form.code).trim().length < 4);
  const quantityError = form.type === 'NORMAL' && (!form.quantity || Number(form.quantity) < 1);
  const maxTotalUsesError = isSpecial && form.maxTotalUses !== null && Number(form.maxTotalUses) < 1;
  const perUserLimitError = form.type === 'NORMAL' && (form.perUserLimit == null || Number(form.perUserLimit) < 1);



  const handleColumnsChange = (newColumns: ColumnConfig[]) => {
    setColumns(newColumns);
    localStorage.setItem('couponSettingsColumns', JSON.stringify(newColumns));
  };

  const handleResetColumns = () => {


    setColumns(defaultColumns);
    localStorage.setItem('couponSettingsColumns', JSON.stringify(defaultColumns));
  };


  const handleFilterAdd = (filter: ActiveFilter) => {
    setActiveFilters((prev) => [...prev, filter]);
    setPage(0);
  };

  const handleFilterRemove = (filterKey: string) => {
    setActiveFilters((prev) => prev.filter((f) => f.key !== filterKey));
    setPage(0);
  };

  const handleDynamicFilterChange = (filterKey: string, value: any) => {
    setActiveFilters((prev) => prev.map((f) => (f.key === filterKey ? { ...f, value } : f)));
    setPage(0);
  };

  const colCount = visibleColumns.length + 2; // +1 for actions, +1 for selection checkbox

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(sortedItems.map((it) => it.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)));
  };


  const load = useMemo(() => async () => {
    setLoading(true);
    try {
      const res = await couponService.listSettings({
        page: page + 1,
        limit: rowsPerPage,
        search: debouncedSearchTerm || undefined,
        type: typeFilter || undefined,
        status: statusFilter || undefined,
      });
      setItems(res.settings || []);
      setTotal(res.total || 0);
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, debouncedSearchTerm, typeFilterString, statusFilterString]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh for items with IN_PROGRESS generation status (partial update only)
  useEffect(() => {
    const inProgressItems = items.filter(it => it.generationStatus === 'IN_PROGRESS' || it.generationStatus === 'PENDING');
    if (inProgressItems.length === 0) return;

    const interval = setInterval(async () => {
      try {
        // Fetch only the in-progress items to update their progress
        const updatedItems = await Promise.all(
          inProgressItems.map(async (it) => {
            const res = await couponService.getSetting(it.id);
            return res.setting;
          })
        );

        // Update only the changed items in the list
        setItems(prevItems =>
          prevItems.map(item => {
            const updated = updatedItems.find(u => u.id === item.id);
            return updated ? { ...item, ...updated } : item;
          })
        );
      } catch (error) {
        console.error('Failed to update progress', error);
      }
    }, 5000); // Refresh every 5 seconds

    return () => clearInterval(interval);
  }, [items]);

  const loadCodes = useMemo(() => async () => {
    if (!codesSetting) return;
    setCodesLoading(true);
    try {
      const res = await couponService.getIssuedCodes(codesSetting.id, {
        page: codesPage + 1,
        limit: codesRowsPerPage,
        search: debouncedCodesSearch || undefined,
      });
      const data: any = (res as any).data ? (res as any).data : res;
      setCodesItems(data.codes || []);
      setCodesTotal(data.total || 0);
    } finally {
      setCodesLoading(false);
    }
  }, [codesSetting, codesPage, codesRowsPerPage, debouncedCodesSearch]);

  useEffect(() => {
    if (openCodes) {
      loadCodes();
    }
  }, [openCodes, loadCodes]);


  const handleSave = async () => {
    // Basic validation
    if (!form.name || !form.startsAt || !form.expiresAt) return;
    if (codeError || quantityError || maxTotalUsesError || perUserLimitError) return;

    const payload: any = {
      ...form,
      startsAt: (form.startsAt as Dayjs).toDate().toISOString(),
      expiresAt: (form.expiresAt as Dayjs).toDate().toISOString(),
    };

    // Debug: log payload to inspect server-side validation issues
    console.log('[CouponSettings] create/update payload', { editing: !!editing, payload });

    if (payload.type === 'SPECIAL') {
      // SPECIAL: per-user limit forced to 1
      payload.perUserLimit = 1;
    } else if (payload.type === 'NORMAL') {
      // NORMAL: backend autogenerates code; ignore maxTotalUses
      payload.code = null;
      payload.maxTotalUses = null;
      payload.quantity = form.quantity || 1;
      // Ensure numeric and >= 1
      payload.perUserLimit = Math.max(1, Number(form.perUserLimit ?? 1));
    }

    if (payload.maxTotalUses === '') payload.maxTotalUses = null;

    // quantity only for create
    if (editing) {
      delete payload.quantity;
    }

    try {
      if (editing) {
        await couponService.updateSetting(editing.id, payload);
        setOpenForm(false);
        resetForm();
        await load();
      } else {
        // For create: close form immediately and load in background
        const result = await couponService.createSetting(payload);
        setOpenForm(false);
        resetForm();

        // Show success message
        const isLargeQuantity = payload.type === 'NORMAL' && (payload.quantity || 1) >= 10000;
        if (isLargeQuantity) {
          enqueueSnackbar(t('coupons.couponSettings.generatingInBackground') as string, { variant: 'info' });
        } else {
          enqueueSnackbar(t('common.saveSuccess') as string, { variant: 'success' });
        }

        // Load list in background (don't await)
        load();
      }
    } catch (e) {
      const err: any = e;
      const errorMessage = err?.response?.data?.error?.message || err?.message || t('common.saveFailed');
      console.error('[CouponSettings] save failed', err?.response?.status, err?.response?.data || err?.message || err);
      enqueueSnackbar(errorMessage, { variant: 'error' });
    }
  };

  const handleEdit = (it: CouponSetting) => {
    setEditing(it);
    setForm({
      code: it.code || '',
      type: it.type,
      name: (it as any).name,
      description: (it as any).description || '',
      quantity: 1,
      perUserLimit: it.perUserLimit || 1,
      maxTotalUses: it.maxTotalUses ?? null,
      startsAt: parseUTCForPicker(it.startsAt),
      expiresAt: parseUTCForPicker(it.expiresAt),
      status: it.status,
    });
    setOpenForm(true);
  };

  const handleDelete = async (it: CouponSetting) => {
    if (!confirm(t('common.confirmDelete') || 'Delete?')) return;
    await couponService.deleteSetting(it.id);
    await load();
  };



  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SettingsIcon />
            {t('coupons.couponSettings.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('coupons.couponSettings.subtitle')}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" startIcon={<CodeIcon />} onClick={() => setOpenSDKGuide(true)}>
            {t('coupons.couponSettings.sdkGuide')}
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => { resetForm(); setOpenForm(true); }}>
            {t('coupons.couponSettings.createCoupon')}
          </Button>
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
                sx={{
                  minWidth: 300,
                  flexGrow: 1,
                  maxWidth: 500,
                  '& .MuiOutlinedInput-root': {
                    height: '40px',
                    borderRadius: '20px',
                    bgcolor: 'background.paper',
                    transition: 'all 0.2s ease-in-out',
                    '& fieldset': { borderColor: 'divider' },
                    '&:hover': { bgcolor: 'action.hover', '& fieldset': { borderColor: 'primary.light' } },
                    '&.Mui-focused': {
                      bgcolor: 'background.paper',
                      boxShadow: '0 0 0 2px rgba(25, 118, 210, 0.1)',
                      '& fieldset': { borderColor: 'primary.main', borderWidth: '1px' },
                    },
                  },
                  '& .MuiInputBase-input': { fontSize: '0.875rem' },
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                    </InputAdornment>
                  ),
                }}
                size="small"
              />

              <DynamicFilterBar
                availableFilters={availableFilterDefinitions}
                activeFilters={activeFilters}

                onFilterAdd={handleFilterAdd}
                onFilterRemove={handleFilterRemove}
                onFilterChange={handleDynamicFilterChange}
                onRefresh={load}
                refreshDisabled={loading}
                noWrap={true}
                afterFilterAddActions={(
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
                )}
              />
            </Box>
          </Box>
        </CardContent>
      </Card>

            {selectedIds.length > 0 && (
              <Typography variant="body2" sx={{ px: 2, pb: 1 }}>
                {t('common.selectedCount', { count: selectedIds.length })}
              </Typography>
            )}

      {/* List */}
      <Card>
        <CardContent sx={{ p: 0 }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox" sx={{ width: 48 }}>
                    <Checkbox
                      indeterminate={sortedItems.some((it) => selectedIds.includes(it.id)) && !sortedItems.every((it) => selectedIds.includes(it.id))}
                      checked={sortedItems.length > 0 && sortedItems.every((it) => selectedIds.includes(it.id))}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                    />
                  </TableCell>
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
                  <TableCell align="center">{t('common.actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <EmptyTableRow colSpan={colCount} loading={true} message={t('common.loading') as string} />
                ) : items.length === 0 ? (
                  <EmptyTableRow colSpan={colCount} loading={false} message={t('common.noData') as string} />
                ) : (
                  sortedItems.map((it) => (
                    <TableRow key={it.id} hover>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedIds.includes(it.id)}
                          onChange={(e) => handleSelectOne(it.id, e.target.checked)}
                        />
                      </TableCell>
                      {visibleColumns.map((col) => {
                        switch (col.id) {
                          case 'name':
                            return (
                              <TableCell key="name">
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <Typography variant="body2">{it.name}</Typography>
                                  <Tooltip title={t('coupons.couponSettings.copyName')}>
                                    <IconButton size="small" onClick={() => handleCopyName(it.name)}>
                                      <ContentCopyIcon fontSize="inherit" />
                                    </IconButton>
                                  </Tooltip>
                                </Box>
                              </TableCell>
                            );
                          case 'code':
                            return (
                              <TableCell key="code">
                                {it.type === 'SPECIAL' ? (
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                                      {it.code || '-'}
                                    </Typography>
                                    {it.code && (
                                      <Tooltip title={t('coupons.couponSettings.copyCode')}>
                                        <IconButton size="small" onClick={() => handleCopyCode(it.code!)}>
                                          <ContentCopyIcon fontSize="inherit" />
                                        </IconButton>
                                      </Tooltip>
                                    )}
                                  </Box>
                                ) : (
                                  <Box>
                                    {it.generationStatus === 'IN_PROGRESS' || it.generationStatus === 'PENDING' ? (
                                      <Box sx={{ width: '100%', minWidth: 200 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                          <HourglassEmptyIcon
                                            fontSize="small"
                                            sx={{
                                              animation: 'spin 1s linear infinite',
                                              '@keyframes spin': {
                                                '0%': { transform: 'rotate(0deg)' },
                                                '100%': { transform: 'rotate(360deg)' },
                                              },
                                              flexShrink: 0,
                                            }}
                                          />
                                          <LinearProgress
                                            variant="determinate"
                                            value={it.totalCount ? Math.round((it.generatedCount || 0) / it.totalCount * 100) : 0}
                                            sx={{ flex: 1 }}
                                          />
                                        </Box>
                                        <Typography variant="caption" color="text.secondary">
                                          {t('coupons.couponSettings.generatingCodes')} ({(it.generatedCount || 0).toLocaleString()} / {(it.totalCount || 0).toLocaleString()})
                                        </Typography>
                                      </Box>
                                    ) : (
                                      <Box>
                                        <Button size="small" color="secondary" onClick={() => handleOpenCodes(it)} startIcon={<ListIcon fontSize="small" />}>
                                          {t('coupons.couponSettings.viewIssuedCodes')}
                                        </Button>
                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                          {t('coupons.couponSettings.issuedCount')}: {(it.generatedCount || it.issuedCount || 0).toLocaleString()}
                                        </Typography>
                                      </Box>
                                    )}
                                  </Box>
                                )}
                              </TableCell>
                            );
                          case 'type':
                            return (
                              <TableCell key="type" align="center">
                                <Tooltip title={it.type}>
                                  <CardGiftcardIcon
                                    fontSize="small"
                                    sx={{
                                      color: it.type === 'SPECIAL' ? 'primary.main' : 'action.disabled',
                                    }}
                                  />
                                </Tooltip>
                              </TableCell>
                            );
                          case 'status':
                            return (
                              <TableCell key="status">
                                <Chip
                                  size="small"
                                  color={it.status === 'ACTIVE' ? 'success' : it.status === 'DISABLED' ? 'default' : 'warning'}
                                  label={it.status === 'ACTIVE' ? t('common.enabled') : it.status === 'DISABLED' ? t('common.disabled') : t('status.deleted')}
                                />
                              </TableCell>
                            );
                          case 'usageRate': {
                            let numerator = it.usedCount || 0;
                            let denominator: number | string;
                            let percentage: string | number = '0.0';
                            let tooltipText = '';

                            if (it.type === 'SPECIAL') {
                              denominator = it.maxTotalUses ?? t('coupons.couponSettings.form.unlimited');
                              if (it.maxTotalUses && it.maxTotalUses > 0) {
                                percentage = ((numerator / it.maxTotalUses) * 100).toFixed(1);
                                tooltipText = `${numerator.toLocaleString()} / ${denominator.toLocaleString()}`;
                              } else {
                                tooltipText = `${numerator.toLocaleString()} / ${denominator}`;
                              }
                            } else {
                              const totalIssued = it.generatedCount || it.issuedCount || 0;
                              denominator = totalIssued;
                              if (totalIssued > 0) {
                                percentage = ((numerator / totalIssued) * 100).toFixed(1);
                              }
                              tooltipText = `${numerator.toLocaleString()} / ${denominator.toLocaleString()}`;
                            }

                            return (
                              <TableCell key="usageRate">
                                <Tooltip title={tooltipText}>
                                  <Typography variant="caption" color="text.secondary" sx={{ cursor: 'help' }}>
                                    {percentage}%
                                  </Typography>
                                </Tooltip>
                              </TableCell>
                            );
                          }
                          case 'start':
                            return (
                              <TableCell key="start">
                                <Typography variant="caption">{formatDateTime(it.startsAt)}</Typography>
                              </TableCell>
                            );
                          case 'end':
                            return (
                              <TableCell key="end">
                                <Typography variant="caption">{formatDateTime(it.expiresAt)}</Typography>
                              </TableCell>
                            );
                          case 'createdAt':
                            return (
                              <TableCell key="createdAt">
                                <Typography variant="caption">{formatDateTime((it as any).createdAt)}</Typography>
                              </TableCell>
                            );
                          case 'description':
                            return (
                              <TableCell key="description" sx={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                <Typography variant="body2">{(it as any).description || '-'}</Typography>
                              </TableCell>
                            );
                          default:


                            return null;
                        }
                      })}
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>

                          <IconButton size="small" onClick={() => handleEdit(it)} color="primary">
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" onClick={() => handleDelete(it)} color="error">
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {!loading && items.length > 0 && (
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

      {/* Create/Edit Drawer */}
      <ResizableDrawer
        open={openForm}
        onClose={() => setOpenForm(false)}
        title={editing ? (t('coupons.couponSettings.editCoupon') as string) : (t('coupons.couponSettings.createCoupon') as string)}
        subtitle={t('coupons.couponSettings.subtitle') as string}
        storageKey="couponSettings.drawer.width"
        defaultWidth={720}
        minWidth={560}
      >
        {/* Body */}
        <Box sx={{ p: 3, overflowY: 'auto', flex: 1 }}>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {/* 1. Name */}
            <TextField
              required
              autoFocus
              label={t('coupons.couponSettings.form.name')}
              value={form.name}
              onChange={(e) => setForm((s: any) => ({ ...s, name: e.target.value }))}
              helperText={t('coupons.couponSettings.form.nameHelp')}
              fullWidth
            />
            {/* 2. Description */}
            <TextField
              label={t('coupons.couponSettings.form.description')}
              value={form.description}
              onChange={(e) => setForm((s: any) => ({ ...s, description: e.target.value }))}
              helperText={t('coupons.couponSettings.form.descriptionHelp')}
              fullWidth
            />
            {/* 3. Type */}
            <TextField
              select
              required
              fullWidth
              label={t('coupons.couponSettings.form.type')}
              value={form.type}
              disabled={!!editing}
              onChange={(e) => setForm((s: any) => ({
                ...s,
                type: e.target.value,
                perUserLimit: e.target.value === 'SPECIAL' ? 1 : s.perUserLimit,
                maxTotalUses: e.target.value === 'NORMAL' ? null : s.maxTotalUses,
                code: e.target.value === 'NORMAL' ? '' : s.code,
                quantity: e.target.value === 'NORMAL' ? (s.quantity || 1) : 1,
              }))}
              helperText={!!editing ? t('coupons.couponSettings.form.typeCannotBeChanged') : undefined}
            >
              <MenuItem value="SPECIAL">SPECIAL</MenuItem>
              <MenuItem value="NORMAL">NORMAL</MenuItem>
            </TextField>
            {/* 4. Code (SPECIAL only) */}
            {form.type === 'SPECIAL' && (
              <TextField
                required
                fullWidth
                label={t('coupons.couponSettings.form.code')}
                value={form.code}
                onChange={(e) => setForm((s: any) => ({ ...s, code: e.target.value }))}
                error={codeError}
                helperText={codeError ? t('coupons.couponSettings.form.codeMinError') : t('coupons.couponSettings.form.codeHelp')}
              />
            )}
            {/* 5. Quantity (NORMAL only) */}
            {form.type === 'NORMAL' && !editing && (
              <TextField
                type="number"
                fullWidth
                label={t('coupons.couponSettings.form.quantity')}
                value={form.quantity}
                onChange={(e) => setForm((s: any) => ({ ...s, quantity: Number(e.target.value) }))}
                error={quantityError}
                helperText={quantityError ? t('coupons.couponSettings.form.quantityMinError') : t('coupons.couponSettings.form.quantityHelp')}
                sx={{
                  '& input[type=number]': { MozAppearance: 'textfield' },
                  '& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button': { WebkitAppearance: 'none', margin: 0 },
                }}
              />


            )}
            {/* 6. PerUserLimit (NORMAL only) */}
            {form.type === 'NORMAL' && (
              <TextField
                type="number"
                fullWidth
                label={t('coupons.couponSettings.form.perUserLimit')}
                value={form.perUserLimit}
                onChange={(e) => setForm((s: any) => ({ ...s, perUserLimit: Number(e.target.value) }))}
                error={perUserLimitError}
                helperText={perUserLimitError ? t('coupons.couponSettings.form.perUserLimitMinError') : t('coupons.couponSettings.form.perUserLimitHelp')}
                sx={{
                  '& input[type=number]': { MozAppearance: 'textfield' },
                  '& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button': { WebkitAppearance: 'none', margin: 0 },
                }}
              />
            )}
            {/* 7. MaxTotalUses + Unlimited (SPECIAL only) */}
            {form.type === 'SPECIAL' && (
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <TextField
                  type="number"
                  fullWidth
                  label={t('coupons.couponSettings.form.maxTotalUses')}
                  value={form.maxTotalUses ?? ''}
                  onChange={(e) => setForm((s: any) => ({ ...s, maxTotalUses: e.target.value === '' ? null : Number(e.target.value) }))}
                  error={maxTotalUsesError}
                  helperText={maxTotalUsesError ? t('coupons.couponSettings.form.maxTotalUsesMinError') : t('coupons.couponSettings.form.maxTotalUsesHelp')}
                  disabled={form.maxTotalUses === null}
                  sx={{
                    '& input[type=number]': { MozAppearance: 'textfield' },
                    '& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button': { WebkitAppearance: 'none', margin: 0 },
                  }}
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={form.maxTotalUses === null}
                      onChange={(e) => setForm((s: any) => ({ ...s, maxTotalUses: e.target.checked ? null : (s.maxTotalUses ?? 0) }))}
                    />
                  }
                  label={t('coupons.couponSettings.form.unlimited')}
                />
              </Box>
            )}
            {/* 8-10. Date Range + Applicable Period */}
            <Box sx={{ display: 'flex', gap: 2, flexDirection: 'column' }}>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <DateTimePicker
                  label={t('coupons.couponSettings.form.startsAt')}
                  value={form.startsAt}
                  onChange={(date) => setForm((s: any) => ({ ...s, startsAt: date }))}
                  slotProps={{ textField: { fullWidth: true, required: true } }}
                />
                <DateTimePicker
                  label={t('coupons.couponSettings.form.expiresAt')}
                  value={form.expiresAt}
                  onChange={(date) => setForm((s: any) => ({ ...s, expiresAt: date }))}
                  minDateTime={form.startsAt || undefined}
                  slotProps={{ textField: { fullWidth: true, required: true } }}
                />
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ ml: 1.75 }}>
                {t('coupons.couponSettings.form.startsAtHelp')} / {t('coupons.couponSettings.form.expiresAtHelp')}
              </Typography>
              {form.startsAt && form.expiresAt && (
                <Typography variant="body2" color="text.secondary" sx={{ ml: 1.75 }}>
                  {(() => {
                    const s = form.startsAt as Dayjs;
                    const e = form.expiresAt as Dayjs;
                    const startStr = s.format('YYYY-MM-DD HH:mm');
                    const endStr = e.format('YYYY-MM-DD HH:mm');
                    const days = Math.max(0, Math.ceil(e.diff(s, 'hour') / 24));
                    return `${t('coupons.couponSettings.form.applicablePeriod')}: ${startStr} ~ ${endStr} (${days}${t('common.day')})`;
                  })()}
                </Typography>
              )}
            </Box>
            {/* 11. Status */}
            <TextField
              select
              fullWidth
              label={t('common.status')}
              value={form.status}
              onChange={(e) => setForm((s: any) => ({ ...s, status: e.target.value }))}
            >
              <MenuItem value="ACTIVE">{t('common.enabled')}</MenuItem>
              <MenuItem value="DISABLED">{t('common.disabled')}</MenuItem>
            </TextField>
          </Stack>
        </Box>

        {/* Footer */}
        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper', display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Button onClick={() => setOpenForm(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleSave} variant="contained">{t('common.save')}</Button>
        </Box>
      </ResizableDrawer>

      {/* Issued Codes Drawer */}
      <ResizableDrawer
        open={openCodes}
        onClose={() => setOpenCodes(false)}
        title={t('coupons.couponSettings.issuedCodesDrawer.title') as string}
        subtitle={codesSetting ? `${t('coupons.couponSettings.issuedCodesDrawer.subtitlePrefix')} ${(codesSetting as any).name}` : ''}
        storageKey="couponSettings.issuedCodes.drawer.width"
        defaultWidth={720}
        minWidth={560}
      >
        <Box sx={{ p: 3, overflowY: 'auto', flex: 1 }}>
          <Stack spacing={2}>
            <TextField
              fullWidth
              placeholder={t('coupons.couponSettings.issuedCodesDrawer.searchPlaceholder') as string}
              value={codesSearch}
              onChange={(e) => setCodesSearch(e.target.value)}
              size="small"
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                    </InputAdornment>
                  ),
                },
              }}
            />

            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t('coupons.issuedCodes.code')}</TableCell>
                    <TableCell>{t('coupons.issuedCodes.status')}</TableCell>
                    <TableCell>{t('coupons.issuedCodes.issuedAt')}</TableCell>
                    <TableCell>{t('coupons.issuedCodes.usedAt')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {codesLoading ? (
                    <EmptyTableRow colSpan={4} loading={true} message={t('common.loading') as string} />
                  ) : codesItems.length === 0 ? (
                    <EmptyTableRow colSpan={4} loading={false} message={t('common.noData') as string} />
                  ) : (
                    codesItems.map((c) => (
                      <TableRow key={c.id} hover>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{c.code}</Typography>
                            <Tooltip title={t('coupons.couponSettings.copyCode')}>
                              <IconButton size="small" onClick={() => handleCopyCode(c.code)}>
                                <ContentCopyIcon fontSize="inherit" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            color={c.status === 'USED' ? 'success' : c.status === 'REVOKED' ? 'warning' : 'default'}
                            label={
                              c.status === 'USED'
                                ? t('coupons.issuedCodes.statusUsed')
                                : c.status === 'REVOKED'
                                ? t('coupons.issuedCodes.statusRevoked')
                                : t('coupons.issuedCodes.statusIssued')
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption">{formatDateTime(c.createdAt)}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption">{c.usedAt ? formatDateTime(c.usedAt) : '-'}</Typography>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Stack>
        </Box>
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'center', gap: 2, bgcolor: 'background.paper', borderTop: 1, borderColor: 'divider' }}>
          <SimplePagination
            count={codesTotal}
            page={codesPage}
            rowsPerPage={codesRowsPerPage}
            onPageChange={(_, p) => setCodesPage(p)}
            onRowsPerPageChange={(e) => {
              const val = Number(e.target.value);
              setCodesRowsPerPage(val);
              setCodesPage(0);
            }}
          />
        </Box>
      </ResizableDrawer>
      <Snackbar
        open={copyOpen}
        autoHideDuration={2000}
        onClose={() => setCopyOpen(false)}
        message={copyMessage}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />

      {/* SDK Guide Drawer */}
      <SDKGuideDrawer open={openSDKGuide} onClose={() => setOpenSDKGuide(false)} />
    </Box>
  );
};

export default CouponSettingsPage;
