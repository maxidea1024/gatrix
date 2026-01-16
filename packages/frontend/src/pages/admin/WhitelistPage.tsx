import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useDebounce } from '../../hooks/useDebounce';
import { formatDateTimeDetailed } from '@/utils/dateFormat';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { usePageState } from '../../hooks/usePageState';
import { useSearchParams } from 'react-router-dom';

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
  TablePagination,
  TextField,
  InputAdornment,
  IconButton,
  Menu,
  MenuItem,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  Pagination,
  Tooltip,
  Tabs,
  Tab,
  Box as MuiBox,
  Checkbox,
  Drawer,
} from '@mui/material';
import {
  Search as SearchIcon,
  MoreVert as MoreVertIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Upload as UploadIcon,
  Refresh as RefreshIcon,
  Cancel as CancelIcon,
  Block as BlockIcon,
  CheckCircle as CheckCircleIcon,
  Close as CloseIcon,
  Save as SaveIcon,
  ContentCopy as ContentCopyIcon,
  Security as SecurityIcon,
} from '@mui/icons-material';

import { useSnackbar } from 'notistack';
import { parseApiErrorMessage } from '../../utils/errorUtils';
import { copyToClipboardWithNotification } from '../../utils/clipboard';
import { WhitelistService, Whitelist, CreateWhitelistData } from '../../services/whitelistService';
import SimplePagination from '../../components/common/SimplePagination';
import IpWhitelistTab from '../../components/admin/IpWhitelistTab';
import WhitelistOverview from '../../components/admin/WhitelistOverview';
import EmptyState from '../../components/common/EmptyState';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/types/permissions';



const WhitelistPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasPermission } = useAuth();

  // Check if user can manage (create/edit/delete) whitelist entries
  const canManage = hasPermission([PERMISSIONS.SECURITY_MANAGE]);

  // Refs for form focus
  const accountIdFieldRef = useRef<HTMLInputElement>(null);

  // 페이지 상태 관리 (localStorage 연동)
  const {
    pageState,
    updatePage,
    updateLimit,
    updateFilters,
  } = usePageState({
    defaultState: {
      page: 1,
      limit: 10,
      sortBy: 'createdAt',
      sortOrder: 'DESC',
      filters: { search: '' },
    },
    storageKey: 'whitelistPage',
  });

  // Tab names for URL mapping (stable)
  const tabNames = React.useMemo(() => ['account', 'ip', 'playground'], []);

  // Get initial tab from URL, localStorage, or default to 0
  const getInitialTab = () => {
    const tabParam = searchParams.get('tab');
    if (tabParam) {
      const tabIndex = tabNames.indexOf(tabParam);
      if (tabIndex >= 0) {
        return tabIndex;
      }
    }

    // Check localStorage for saved tab
    const savedTab = localStorage.getItem('whitelist.lastTab');
    if (savedTab) {
      const tabIndex = tabNames.indexOf(savedTab);
      if (tabIndex >= 0) {
        return tabIndex;
      }
    }

    // Default to first tab
    return 0;
  };

  // Tab state
  const [currentTab, setCurrentTab] = useState(getInitialTab);

  // 디바운싱된 검색어 (500ms 지연)
  const debouncedSearch = useDebounce(pageState.filters?.search || '', 500);


  // State
  const [whitelists, setWhitelists] = useState<Whitelist[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);


  // Menu state
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedWhitelist, setSelectedWhitelist] = useState<Whitelist | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Dialog states
  const [addDialog, setAddDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [bulkDialog, setBulkDialog] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: '',
    message: '',
    action: () => { },
  });

  // Form data
  const [formData, setFormData] = useState<CreateWhitelistData>({
    accountId: '',
    ipAddress: '',
    startDate: '',
    endDate: '',
    purpose: '',
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [bulkData, setBulkData] = useState('');
  const [fullEditingData, setFullEditingData] = useState<any>(null);

  const isDirty = useMemo(() => {
    if (!editDialog || !fullEditingData) return true;

    const currentData = {
      accountId: formData.accountId?.trim(),
      ipAddress: formData.ipAddress?.trim() || '',
      startDate: formData.startDate || '',
      endDate: formData.endDate || '',
      purpose: formData.purpose?.trim() || '',
    };

    const originalData = {
      accountId: fullEditingData.accountId?.trim(),
      ipAddress: fullEditingData.ipAddress?.trim() || '',
      startDate: fullEditingData.startDate ? fullEditingData.startDate.split('T')[0] : '',
      endDate: fullEditingData.endDate ? fullEditingData.endDate.split('T')[0] : '',
      purpose: fullEditingData.purpose?.trim() || '',
    };

    return JSON.stringify(currentData) !== JSON.stringify(originalData);
  }, [editDialog, fullEditingData, formData]);

  // Selection handlers
  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedIds(whitelists.map(w => w.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id)
        ? prev.filter(selectedId => selectedId !== id)
        : [...prev, id]
    );
  };

  // Load whitelists
  const loadWhitelists = async () => {
    try {
      setLoading(true);
      const filters: any = {};
      if (debouncedSearch) filters.search = debouncedSearch;
      const result = await WhitelistService.getWhitelists(pageState.page, pageState.limit, filters);

      console.log('Whitelist load result:', result);

      // 안전한 데이터 접근
      if (result && typeof result === 'object' && Array.isArray(result.whitelists)) {
        setWhitelists(result.whitelists);
        setTotal(result.total || 0);
      } else {
        console.error('Invalid response structure:', result);
        setWhitelists([]);
        setTotal(0);
        // 오류 메시지를 사용자에게 표시하지 않음 (서버 응답 구조 문제일 수 있음)
      }
    } catch (error: any) {
      console.error('Error loading whitelists:', error);
      enqueueSnackbar(parseApiErrorMessage(error, 'whitelist.errors.loadFailed'), { variant: 'error' });
      setWhitelists([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWhitelists();
  }, [pageState.page, pageState.limit, debouncedSearch]);

  // Update tab when URL changes (browser back/forward)
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam) {
      const tabIndex = tabNames.indexOf(tabParam);
      if (tabIndex >= 0 && tabIndex !== currentTab) {
        setCurrentTab(tabIndex);
        localStorage.setItem('whitelist.lastTab', tabParam);
      }
    }
  }, [searchParams, currentTab, tabNames]);

  // Handlers
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    const name = tabNames[newValue];

    // Update URL with new tab (single source of truth)
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set('tab', name);
    setSearchParams(newSearchParams, { replace: true });

    // Persist selection
    localStorage.setItem('whitelist.lastTab', name);
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const searchValue = event.target.value;
    updateFilters({ search: searchValue });
  };

  const handleChangePage = (_event: unknown, newPage: number) => {
    if (typeof newPage === 'number' && !isNaN(newPage)) {
      updatePage(newPage + 1); // MUI는 0부터 시작, 우리는 1부터 시작
    } else {
      console.error('Invalid page number received:', newPage);
      updatePage(1); // Reset to first page
    }
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newLimit = parseInt(event.target.value, 10);
    updateLimit(newLimit);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, whitelist: Whitelist) => {
    setAnchorEl(event.currentTarget);
    setSelectedWhitelist(whitelist);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    // selectedWhitelist는 다이얼로그가 닫힐 때까지 유지
  };

  // Toggle whitelist status
  const handleToggleStatus = async () => {
    if (!selectedWhitelist) return;

    try {
      setLoading(true);
      await WhitelistService.toggleWhitelistStatus(selectedWhitelist.id);
      enqueueSnackbar(
        selectedWhitelist.isEnabled
          ? t('whitelist.statusDisabledSuccess')
          : t('whitelist.statusEnabledSuccess'),
        { variant: 'success' }
      );
      handleMenuClose();
      loadWhitelists();
    } catch (error) {
      console.error('Failed to toggle whitelist status:', error);
      enqueueSnackbar(parseApiErrorMessage(error, 'whitelist.toggleStatusFailed'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // 복사 기능
  const handleCopyToClipboard = (text: string, type: string) => {
    copyToClipboardWithNotification(
      text,
      () => enqueueSnackbar(t('common.copiedToClipboard'), { variant: 'success' }),
      () => enqueueSnackbar(t('common.copyFailed'), { variant: 'error' })
    );
  };

  const handleAdd = () => {
    setFormData({
      accountId: '',
      ipAddress: '',
      startDate: '',
      endDate: '',
      purpose: '',
    });
    setFormErrors({});
    setAddDialog(true);

    // 계정ID 필드에 포커스
    setTimeout(() => {
      accountIdFieldRef.current?.focus();
    }, 100);
  };

  const handleEdit = () => {
    if (selectedWhitelist) {
      setFormData({
        accountId: selectedWhitelist.accountId,
        ipAddress: selectedWhitelist.ipAddress || '',
        startDate: selectedWhitelist.startDate ? selectedWhitelist.startDate.split('T')[0] : '',
        endDate: selectedWhitelist.endDate ? selectedWhitelist.endDate.split('T')[0] : '',
        purpose: selectedWhitelist.purpose || '',
      });
      setFullEditingData(JSON.parse(JSON.stringify(selectedWhitelist)));
      setFormErrors({});
      setEditDialog(true);

      // 계정ID 필드에 포커스
      setTimeout(() => {
        accountIdFieldRef.current?.focus();
      }, 100);
    }
    handleMenuClose();
  };

  const handleDelete = () => {
    if (selectedWhitelist) {
      setConfirmDialog({
        open: true,
        title: t('whitelist.dialog.deleteTitle'),
        message: t('whitelist.dialog.deleteMessage', { name: selectedWhitelist.accountId }),
        action: async () => {
          try {
            await WhitelistService.deleteWhitelist(selectedWhitelist.id);
            enqueueSnackbar(t('whitelist.toast.deleted'), { variant: 'success' });
            loadWhitelists();
          } catch (error: any) {
            enqueueSnackbar(parseApiErrorMessage(error, 'whitelist.errors.deleteFailed'), { variant: 'error' });
          }
          setConfirmDialog(prev => ({ ...prev, open: false }));
        },
      });
    }
    handleMenuClose();
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    // 계정 ID 유효성 검사
    if (!formData.accountId || formData.accountId.trim().length < 4 || formData.accountId.trim().length > 36) {
      errors.accountId = t('whitelist.form.accountIdValidation');
    }

    // 사용목적 필수 검사
    if (!formData.purpose || formData.purpose.trim().length === 0) {
      errors.purpose = t('whitelist.form.purposeRequired');
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    try {

      console.log('handleSave - Debug info:', {
        editDialog,
        selectedWhitelist,
        selectedWhitelistId: selectedWhitelist?.id,
        formData
      });

      if (editDialog && selectedWhitelist) {
        console.log('Executing UPDATE with ID:', selectedWhitelist.id);
        await WhitelistService.updateWhitelist(selectedWhitelist.id, formData);
        enqueueSnackbar(t('whitelist.toast.updated'), { variant: 'success' });
        setEditDialog(false);
        setSelectedWhitelist(null);
        setFullEditingData(null);
      } else {
        console.log('Executing CREATE');
        await WhitelistService.createWhitelist(formData);
        enqueueSnackbar(t('whitelist.toast.created'), { variant: 'success' });
        setAddDialog(false);
      }

      // 안전하게 목록 다시 로드
      setTimeout(() => {
        loadWhitelists();
      }, 100);
    } catch (error: any) {
      console.error('Error saving whitelist:', error);
      enqueueSnackbar(parseApiErrorMessage(error, 'whitelist.errors.saveFailed'), { variant: 'error' });
    }
  };

  const handleBulkCreate = async () => {
    try {
      const lines = bulkData.trim().split('\n').filter(line => line.trim());
      const entries = lines.map(line => {
        const parts = line.split('\t'); // Tab-separated values
        return {
          accountId: parts[0]?.trim() || '',
          ipAddress: parts[1]?.trim() || undefined,
          purpose: parts[2]?.trim() || undefined,
        };
      }).filter(entry => entry.accountId);

      if (entries.length === 0) {
        enqueueSnackbar(t('whitelist.errors.noValidEntries'), { variant: 'warning' });
        return;
      }

      const result = await WhitelistService.bulkCreateWhitelists(entries);
      enqueueSnackbar(t('whitelist.toast.bulkCreated', { count: result.createdCount }), { variant: 'success' });
      setBulkDialog(false);
      setBulkData('');
      loadWhitelists();
    } catch (error: any) {
      enqueueSnackbar(parseApiErrorMessage(error, 'whitelist.errors.bulkCreateFailed'), { variant: 'error' });
    }
  };

  // Use shared date-time formatter
  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return formatDateTimeDetailed(dateString);
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Main Card with Tabs */}
      <Card>
        <CardContent>
          {/* Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <SecurityIcon sx={{ fontSize: 32, color: 'primary.main' }} />
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {t('whitelist.title')}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('whitelist.subtitle')}
                </Typography>
              </Box>
            </Box>
          </Box>

          <Tabs value={currentTab} onChange={handleTabChange} sx={{ mb: 3 }}>
            <Tab label={t('whitelist.tabs.account')} />
            <Tab label={t('whitelist.tabs.ip')} />
            <Tab label={t('whitelist.tabs.playground')} />
          </Tabs>

          {/* Tab Content */}
          <Box sx={{ display: currentTab === 0 ? 'block' : 'none' }}>
            {/* Nickname Whitelist Header */}
            {canManage && (
              <Box sx={{ display: 'flex', gap: 2, mb: 3, justifyContent: 'flex-end' }}>
                <Button
                  variant="outlined"
                  startIcon={<UploadIcon />}
                  onClick={() => setBulkDialog(true)}
                >
                  {t('whitelist.bulkImport')}
                </Button>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={handleAdd}
                >
                  {t('whitelist.addEntry')}
                </Button>
              </Box>
            )}

            {/* Search & Filters */}
            <Card variant="outlined" sx={{ mb: 3 }}>
              <CardContent>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                    <TextField
                      placeholder={t('whitelist.searchPlaceholder')}
                      value={pageState.filters?.search || ''}
                      onChange={handleSearchChange}
                      size="small"
                      slotProps={{
                        input: {
                          startAdornment: (
                            <InputAdornment position="start">
                              <SearchIcon />
                            </InputAdornment>
                          ),
                        },
                      }}
                      sx={{ minWidth: 300 }}
                    />
                  </Box>
                </Box>
              </CardContent>
            </Card>

            {/* Nickname Whitelist Table */}
            <Card variant="outlined">
              <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
                {loading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                    <Typography color="text.secondary">{t('common.loadingWhitelist')}</Typography>
                  </Box>
                ) : whitelists.length === 0 ? (
                  <EmptyState
                    message={t('whitelist.noEntries')}
                    subtitle={canManage ? t('common.addFirstItem') : undefined}
                    onAddClick={canManage ? handleAdd : undefined}
                    addButtonLabel={t('whitelist.addEntry')}
                  />
                ) : (
                  <>
                    <TableContainer>
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell>
                              <Checkbox
                                checked={selectedIds.length > 0 && selectedIds.length === whitelists.length}
                                indeterminate={selectedIds.length > 0 && selectedIds.length < whitelists.length}
                                onChange={handleSelectAll}
                              />
                            </TableCell>
                            <TableCell>{t('whitelist.form.accountId')}</TableCell>
                            <TableCell>{t('whitelist.form.ipAddress')}</TableCell>
                            <TableCell>{t('whitelist.allowedPeriod')}</TableCell>
                            <TableCell>{t('whitelist.form.purpose')}</TableCell>
                            <TableCell>{t('common.status')}</TableCell>
                            <TableCell>{t('common.createdBy')}</TableCell>
                            <TableCell>{t('common.createdAt')}</TableCell>
                            <TableCell align="center">{t('common.actions')}</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {whitelists.map((whitelist) => (
                            <TableRow
                              key={whitelist.id}
                              hover
                              selected={selectedIds.includes(whitelist.id)}
                            >
                              <TableCell>
                                <Checkbox
                                  checked={selectedIds.includes(whitelist.id)}
                                  onChange={() => handleSelectOne(whitelist.id)}
                                />
                              </TableCell>
                              <TableCell>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Typography variant="body2" fontWeight="medium">
                                    {whitelist.accountId}
                                  </Typography>
                                  <Tooltip title={t('whitelist.copyAccountId')}>
                                    <IconButton
                                      size="small"
                                      onClick={() => handleCopyToClipboard(whitelist.accountId, t('whitelist.form.accountId'))}
                                      sx={{ p: 0.5 }}
                                    >
                                      <ContentCopyIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                </Box>
                              </TableCell>
                              <TableCell>
                                {whitelist.ipAddress ? (
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Chip label={whitelist.ipAddress} size="small" />
                                    <Tooltip title={t('whitelist.copyIpAddress')}>
                                      <IconButton
                                        size="small"
                                        onClick={() => handleCopyToClipboard(whitelist.ipAddress!, t('whitelist.form.ipAddress'))}
                                        sx={{ p: 0.5 }}
                                      >
                                        <ContentCopyIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                  </Box>
                                ) : (
                                  <Typography variant="body2" color="text.secondary">
                                    {t('whitelist.anyIp')}
                                  </Typography>
                                )}
                              </TableCell>
                              <TableCell>
                                {whitelist.startDate || whitelist.endDate ? (
                                  <Box>
                                    <Typography variant="body2">
                                      {formatDate(whitelist.startDate)} - {formatDate(whitelist.endDate)}
                                    </Typography>
                                  </Box>
                                ) : (
                                  <Typography variant="body2" color="text.secondary">
                                    {t('whitelist.permanent')}
                                  </Typography>
                                )}
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {whitelist.purpose || '-'}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Chip
                                  label={whitelist.isEnabled ? t('status.active') : t('status.inactive')}
                                  color={whitelist.isEnabled ? 'success' : 'default'}
                                  size="small"
                                />
                              </TableCell>
                              <TableCell>
                                <Box>
                                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                    {whitelist.createdByName || t('dashboard.unknown')}
                                  </Typography>
                                  {whitelist.createdByEmail && (
                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                      {whitelist.createdByEmail}
                                    </Typography>
                                  )}
                                </Box>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2">
                                  {formatDateTimeDetailed(whitelist.createdAt)}
                                </Typography>
                              </TableCell>
                              <TableCell align="center">
                                <IconButton
                                  size="small"
                                  onClick={(e) => handleMenuOpen(e, whitelist)}
                                >
                                  <MoreVertIcon />
                                </IconButton>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                    <SimplePagination
                      count={total}
                      page={pageState.page - 1}
                      rowsPerPage={pageState.limit}
                      onPageChange={handleChangePage}
                      onRowsPerPageChange={handleChangeRowsPerPage}
                      rowsPerPageOptions={[5, 10, 25, 50, 100]}
                    />
                  </>
                )}
              </CardContent>
            </Card>

            {/* Action Menu */}
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleMenuClose}
            >
              {canManage && (
                <MenuItem onClick={handleToggleStatus}>
                  {selectedWhitelist?.isEnabled ? (
                    <>
                      <BlockIcon sx={{ mr: 1 }} />
                      {t('whitelist.disable')}
                    </>
                  ) : (
                    <>
                      <CheckCircleIcon sx={{ mr: 1 }} />
                      {t('whitelist.enable')}
                    </>
                  )}
                </MenuItem>
              )}
              {canManage && (
                <MenuItem onClick={handleEdit}>
                  <EditIcon sx={{ mr: 1 }} />
                  {t('common.edit')}
                </MenuItem>
              )}
              {canManage && (
                <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
                  <DeleteIcon sx={{ mr: 1 }} />
                  {t('common.delete')}
                </MenuItem>
              )}
            </Menu>

            {/* Add/Edit Drawer */}
            <Drawer
              anchor="right"
              open={addDialog || editDialog}
              onClose={() => {
                setSelectedWhitelist(null);
                setFullEditingData(null);
                setAddDialog(false);
                setEditDialog(false);
              }}
              sx={{
                zIndex: 1301,
                '& .MuiDrawer-paper': {
                  width: { xs: '100%', sm: 500 },
                  maxWidth: '100vw',
                  display: 'flex',
                  flexDirection: 'column'
                }
              }}
            >
              {/* Header */}
              <Box sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                p: 2,
                borderBottom: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper'
              }}>
                <Box>
                  <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
                    {editDialog ? t('whitelist.dialog.editTitle') : t('whitelist.dialog.addTitle')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {editDialog
                      ? t('whitelist.dialog.editDescription')
                      : t('whitelist.dialog.addDescription')
                    }
                  </Typography>
                </Box>
                <IconButton
                  onClick={() => {
                    setSelectedWhitelist(null);
                    setAddDialog(false);
                    setEditDialog(false);
                  }}
                  size="small"
                  sx={{
                    '&:hover': {
                      backgroundColor: 'action.hover'
                    }
                  }}
                >
                  <CloseIcon />
                </IconButton>
              </Box>

              {/* Content */}
              <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box>
                    <TextField
                      fullWidth
                      label={t('whitelist.form.accountId')}
                      value={formData.accountId}
                      onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
                      required
                      placeholder={t('whitelist.form.accountIdPlaceholder')}
                      error={!!formErrors.accountId}
                      helperText={formErrors.accountId || t('whitelist.form.accountIdHelp')}
                      inputRef={accountIdFieldRef}
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                      {t('whitelist.form.accountIdHelp')}
                    </Typography>
                  </Box>
                  <Box>
                    <TextField
                      fullWidth
                      label={t('whitelist.form.ipAddressOpt')}
                      value={formData.ipAddress}
                      onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                      placeholder={t('whitelist.form.ipPlaceholder')}
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                      {t('whitelist.form.ipHelp')}
                    </Typography>
                  </Box>
                  <Box>
                    <DatePicker
                      key={`start-date-${i18n.language}`}
                      label={t('whitelist.form.startDateOpt')}
                      value={formData.startDate ? dayjs(formData.startDate) : null}
                      onChange={(date) => {
                        setFormData({
                          ...formData,
                          startDate: date && dayjs.isDayjs(date) ? date.format('YYYY-MM-DD') : ''
                        });
                      }}
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          error: false
                        },
                        popper: {
                          style: {
                            zIndex: 9999
                          }
                        }
                      }}
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                      {t('whitelist.form.startDateHelp')}
                    </Typography>
                  </Box>
                  <Box>
                    <DatePicker
                      key={`end-date-${i18n.language}`}
                      label={t('whitelist.form.endDateOpt')}
                      value={formData.endDate ? dayjs(formData.endDate) : null}
                      onChange={(date) => setFormData({ ...formData, endDate: date ? date.format('YYYY-MM-DD') : '' })}
                      slotProps={{
                        textField: { fullWidth: true },
                        popper: {
                          style: {
                            zIndex: 9999
                          }
                        }
                      }}
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                      {t('whitelist.form.endDateHelp')}
                    </Typography>
                  </Box>
                  <Box>
                    <TextField
                      fullWidth
                      label={t('whitelist.form.purpose')}
                      value={formData.purpose}
                      onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                      multiline
                      rows={3}
                      placeholder={t('whitelist.form.purposePlaceholder')}
                      required
                      error={!!formErrors.purpose}
                      helperText={formErrors.purpose || t('whitelist.form.purposeHelp')}
                    />
                  </Box>
                </Box>
              </Box>

              {/* Footer */}
              <Box sx={{
                p: 2,
                borderTop: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
                display: 'flex',
                gap: 2,
                justifyContent: 'flex-end'
              }}>
                <Button
                  onClick={() => {
                    setSelectedWhitelist(null);
                    setAddDialog(false);
                    setEditDialog(false);
                  }}
                  startIcon={<CancelIcon />}
                  variant="outlined"
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  onClick={handleSave}
                  variant="contained"
                  startIcon={<SaveIcon />}
                  disabled={loading || (editDialog && !!selectedWhitelist && !isDirty)}
                >
                  {(editDialog && selectedWhitelist) ? t('whitelist.dialog.update') : t('whitelist.dialog.add')}
                </Button>
              </Box>
            </Drawer>

            {/* Bulk Import Drawer */}
            <Drawer
              anchor="right"
              open={bulkDialog}
              onClose={() => setBulkDialog(false)}
              sx={{
                zIndex: 1301,
                '& .MuiDrawer-paper': {
                  width: { xs: '100%', sm: 600 },
                  maxWidth: '100vw',
                  display: 'flex',
                  flexDirection: 'column'
                }
              }}
            >
              {/* Header */}
              <Box sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                p: 2,
                borderBottom: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper'
              }}>
                <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
                  {t('whitelist.dialog.bulkTitle')}
                </Typography>
                <IconButton
                  onClick={() => setBulkDialog(false)}
                  size="small"
                  sx={{
                    '&:hover': {
                      backgroundColor: 'action.hover'
                    }
                  }}
                >
                  <CloseIcon />
                </IconButton>
              </Box>

              {/* Content */}
              <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {t('whitelist.dialog.bulkHint1')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {t('whitelist.dialog.bulkHint2')}
                  </Typography>
                </Box>
                <TextField
                  fullWidth
                  multiline
                  rows={10}
                  value={bulkData}
                  onChange={(e) => setBulkData(e.target.value)}
                  placeholder={t('whitelist.dialog.bulkPlaceholder')}
                />
              </Box>

              {/* Footer */}
              <Box sx={{
                p: 2,
                borderTop: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
                display: 'flex',
                gap: 2,
                justifyContent: 'flex-end'
              }}>
                <Button
                  onClick={() => setBulkDialog(false)}
                  variant="outlined"
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  onClick={handleBulkCreate}
                  variant="contained"
                  startIcon={<UploadIcon />}
                >
                  {t('whitelist.dialog.import')}
                </Button>
              </Box>
            </Drawer>

            {/* Confirmation Drawer */}
            <Drawer
              anchor="right"
              open={confirmDialog.open}
              onClose={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
              sx={{
                zIndex: 1301,
                '& .MuiDrawer-paper': {
                  width: { xs: '100%', sm: 400 },
                  maxWidth: '100vw',
                  display: 'flex',
                  flexDirection: 'column'
                }
              }}
            >
              {/* Header */}
              <Box sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                p: 2,
                borderBottom: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper'
              }}>
                <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
                  {confirmDialog.title}
                </Typography>
                <IconButton
                  onClick={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
                  size="small"
                  sx={{
                    '&:hover': {
                      backgroundColor: 'action.hover'
                    }
                  }}
                >
                  <CloseIcon />
                </IconButton>
              </Box>

              {/* Content */}
              <Box sx={{ flex: 1, p: 2 }}>
                <Typography>{confirmDialog.message}</Typography>
              </Box>

              {/* Footer */}
              <Box sx={{
                p: 2,
                borderTop: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
                display: 'flex',
                gap: 2,
                justifyContent: 'flex-end'
              }}>
                <Button
                  onClick={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
                  variant="outlined"
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  onClick={confirmDialog.action}
                  color="error"
                  variant="contained"
                  startIcon={<DeleteIcon />}
                >
                  {t('common.confirm')}
                </Button>
              </Box>
            </Drawer>
          </Box>

          <Box sx={{ display: currentTab === 1 ? 'block' : 'none' }}>
            <IpWhitelistTab canManage={canManage} />
          </Box>

          <Box sx={{ display: currentTab === 2 ? 'block' : 'none' }}>
            <WhitelistOverview />
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default WhitelistPage;
