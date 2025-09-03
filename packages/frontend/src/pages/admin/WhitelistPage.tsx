import React, { useState, useEffect } from 'react';
import { formatDateTimeDetailed } from '@/utils/dateFormat';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import { useI18n } from '@/contexts/I18nContext';
import { usePageState } from '../../hooks/usePageState';

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
  Save as SaveIcon,
  ContentCopy as ContentCopyIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { WhitelistService, Whitelist, CreateWhitelistData } from '../../services/whitelistService';
import SimplePagination from '../../components/common/SimplePagination';
import IpWhitelistTab from '../../components/admin/IpWhitelistTab';
import WhitelistOverview from '../../components/admin/WhitelistOverview';
import FormDialogHeader from '../../components/common/FormDialogHeader';
import EmptyTableRow from '../../components/common/EmptyTableRow';

const WhitelistPage: React.FC = () => {
  const { t } = useTranslation();
  const { language } = useI18n();
  const { enqueueSnackbar } = useSnackbar();

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

  // Tab state
  const [currentTab, setCurrentTab] = useState(0);

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
    action: () => {},
  });

  // Form data
  const [formData, setFormData] = useState<CreateWhitelistData>({
    accountId: '',
    ipAddress: '',
    startDate: '',
    endDate: '',
    purpose: '',
  });

  const [bulkData, setBulkData] = useState('');

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
      if (pageState.filters?.search) filters.search = pageState.filters.search;
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
      enqueueSnackbar(error.message || t('whitelist.errors.loadFailed'), { variant: 'error' });
      setWhitelists([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWhitelists();
  }, [pageState.page, pageState.limit, pageState.filters]);

  // Handlers
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
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

  // 복사 기능
  const handleCopyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      enqueueSnackbar(`${type}이(가) 복사되었습니다.`, { variant: 'success' });
    } catch (error) {
      console.error('복사 실패:', error);
      enqueueSnackbar('복사에 실패했습니다.', { variant: 'error' });
    }
  };

  const handleAdd = () => {
    setFormData({
      accountId: '',
      ipAddress: '',
      startDate: '',
      endDate: '',
      purpose: '',
    });
    setAddDialog(true);
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
      setEditDialog(true);
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
            enqueueSnackbar(error.message || t('whitelist.errors.deleteFailed'), { variant: 'error' });
          }
          setConfirmDialog(prev => ({ ...prev, open: false }));
        },
      });
    }
    handleMenuClose();
  };

  const handleSave = async () => {
    try {
      // 계정 ID 유효성 검사
      if (!formData.accountId || formData.accountId.trim().length < 4 || formData.accountId.trim().length > 36) {
        enqueueSnackbar(t('whitelist.form.accountIdValidation'), { variant: 'error' });
        return;
      }

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
      enqueueSnackbar(error.message || t('whitelist.errors.saveFailed'), { variant: 'error' });
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
      enqueueSnackbar(error.message || t('whitelist.errors.bulkCreateFailed'), { variant: 'error' });
    }
  };

  // Use shared date-time formatter
  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return formatDateTimeDetailed(dateString);
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
            {t('whitelist.title')}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {t('whitelist.subtitle')}</Typography>
        </Box>
      </Box>

      {/* Main Card with Tabs */}
      <Card>
        <CardContent>
          <Tabs value={currentTab} onChange={handleTabChange} sx={{ mb: 3 }}>
            <Tab label={t('whitelist.tabs.account')} />
            <Tab label={t('whitelist.tabs.ip')} />
            <Tab label="Playground" />
          </Tabs>

          {/* Tab Content */}
          {currentTab === 0 && (
            <>
              {/* Nickname Whitelist Header */}
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

              {/* Search & Filters */}
              <Card variant="outlined" sx={{ mb: 3 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                      <TextField
                        placeholder={t('whitelist.searchPlaceholder')}
                        value={pageState.filters?.search || ''}
                        onChange={handleSearchChange}
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

                    <Tooltip title={t('common.refresh')}>
                      <span>
                        <IconButton onClick={loadWhitelists} disabled={loading} sx={{ ml: 2 }}>
                          <RefreshIcon />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Box>
                </CardContent>
              </Card>

              {/* Nickname Whitelist Table */}
              <Card variant="outlined">
                <CardContent sx={{ p: 0 }}>
                  {loading && <LinearProgress />}

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
                {whitelists.length === 0 ? (
                  <EmptyTableRow
                    colSpan={9}
                    loading={loading}
                    message={t('whitelist.noEntries')}
                    loadingMessage={t('common.loadingWhitelist')}
                  />
                ) : (
                  whitelists.map((whitelist) => (
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
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <SimplePagination
            count={total}
            page={pageState.page - 1} // MUI는 0부터 시작
            rowsPerPage={pageState.limit}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[5, 10, 25, 50]}
          />
                </CardContent>
              </Card>

              {/* Action Menu */}
              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
              >
                <MenuItem onClick={handleEdit}>
                  <EditIcon sx={{ mr: 1 }} />
                  {t('common.edit')}
                </MenuItem>
                <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
                  <DeleteIcon sx={{ mr: 1 }} />
                  {t('common.delete')}
                </MenuItem>
              </Menu>

              {/* Add/Edit Dialog */}
              <Dialog open={addDialog || editDialog} onClose={() => {
                setSelectedWhitelist(null);
                setAddDialog(false);
                setEditDialog(false);
              }} maxWidth="sm" fullWidth>
                <FormDialogHeader
                  title={editDialog ? t('whitelist.dialog.editTitle') : t('whitelist.dialog.addTitle')}
                  description={editDialog
                    ? t('whitelist.dialog.editDescription')
                    : t('whitelist.dialog.addDescription')
                  }
                />
                <DialogContent>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                    <Box>
                      <TextField
                        fullWidth
                        label={t('whitelist.form.accountId')}
                        value={formData.accountId}
                        onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
                        required
                        placeholder={t('whitelist.form.accountIdPlaceholder')}
                        error={formData.accountId && (formData.accountId.trim().length < 4 || formData.accountId.trim().length > 36)}
                        helperText={
                          formData.accountId && (formData.accountId.trim().length < 4 || formData.accountId.trim().length > 36)
                            ? t('whitelist.form.accountIdValidation')
                            : undefined
                        }
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
                        key={`start-date-${language}`}
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
                          }
                        }}
                      />
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                        {t('whitelist.form.startDateHelp')}
                      </Typography>
                    </Box>
                    <Box>
                      <DatePicker
                        key={`end-date-${language}`}
                        label={t('whitelist.form.endDateOpt')}
                        value={formData.endDate ? dayjs(formData.endDate) : null}
                        onChange={(date) => setFormData({ ...formData, endDate: date ? date.format('YYYY-MM-DD') : '' })}
                        slotProps={{ textField: { fullWidth: true } }}
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
                      />
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                        {t('whitelist.form.purposeHelp')}
                      </Typography>
                    </Box>
                  </Box>
                </DialogContent>
                <DialogActions>
                  <Button onClick={() => {
                    setSelectedWhitelist(null);
                    setAddDialog(false);
                    setEditDialog(false);
                  }} startIcon={<CancelIcon />}>
                    {t('common.cancel')}
                  </Button>
                  <Button onClick={handleSave} variant="contained" startIcon={<SaveIcon />}>
                    {(editDialog && selectedWhitelist) ? t('whitelist.dialog.update') : t('whitelist.dialog.add')}
                  </Button>
                </DialogActions>
              </Dialog>

              {/* Bulk Import Dialog */}
              <Dialog open={bulkDialog} onClose={() => setBulkDialog(false)} maxWidth="md" fullWidth>
                <DialogTitle>{t('whitelist.dialog.bulkTitle')}</DialogTitle>
                <DialogContent>
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
                </DialogContent>
                <DialogActions>
                  <Button onClick={() => setBulkDialog(false)}>
                    {t('common.cancel')}
                  </Button>
                  <Button onClick={handleBulkCreate} variant="contained">
                    {t('whitelist.dialog.import')}
                  </Button>
                </DialogActions>
              </Dialog>

              {/* Confirmation Dialog */}
              <Dialog open={confirmDialog.open} onClose={() => setConfirmDialog(prev => ({ ...prev, open: false }))}>
                <DialogTitle>{confirmDialog.title}</DialogTitle>
                <DialogContent>
                  <Typography>{confirmDialog.message}</Typography>
                </DialogContent>
                <DialogActions>
                  <Button onClick={() => setConfirmDialog(prev => ({ ...prev, open: false }))}>
                    {t('common.cancel')}
                  </Button>
                  <Button onClick={confirmDialog.action} color="error" variant="contained">
                    {t('common.confirm')}
                  </Button>
                </DialogActions>
              </Dialog>
            </>
          )}

          {currentTab === 1 && (
            <IpWhitelistTab />
          )}

          {currentTab === 2 && (
            <WhitelistOverview />
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default WhitelistPage;
