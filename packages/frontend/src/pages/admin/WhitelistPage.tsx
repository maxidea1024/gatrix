import React, { useState, useEffect } from 'react';
import { formatDateTimeDetailed } from '@/utils/dateFormat';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import moment from 'moment';

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
} from '@mui/material';
import {
  Search as SearchIcon,
  MoreVert as MoreVertIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Upload as UploadIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { WhitelistService, Whitelist, CreateWhitelistData } from '../../services/whitelistService';
import SimplePagination from '../../components/common/SimplePagination';
import IpWhitelistTab from '../../components/admin/IpWhitelistTab';

const WhitelistPage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  // Tab state
  const [currentTab, setCurrentTab] = useState(0);

  // State
  const [whitelists, setWhitelists] = useState<Whitelist[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [search, setSearch] = useState('');


  // Menu state
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedWhitelist, setSelectedWhitelist] = useState<Whitelist | null>(null);

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
    nickname: '',
    ipAddress: '',
    startDate: '',
    endDate: '',
    memo: '',
  });

  const [bulkData, setBulkData] = useState('');

  // Load whitelists
  const loadWhitelists = async () => {
    try {
      setLoading(true);
      const filters: any = {};
      if (search) filters.search = search;
      const result = await WhitelistService.getWhitelists(page + 1, rowsPerPage, filters);

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
  }, [page, rowsPerPage, search]);

  // Handlers
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(event.target.value);
    setPage(0);
  };

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, whitelist: Whitelist) => {
    setAnchorEl(event.currentTarget);
    setSelectedWhitelist(whitelist);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedWhitelist(null);
  };

  const handleAdd = () => {
    setFormData({
      nickname: '',
      ipAddress: '',
      startDate: '',
      endDate: '',
      memo: '',
    });
    setAddDialog(true);
  };

  const handleEdit = () => {
    if (selectedWhitelist) {
      setFormData({
        nickname: selectedWhitelist.nickname,
        ipAddress: selectedWhitelist.ipAddress || '',
        startDate: selectedWhitelist.startDate ? selectedWhitelist.startDate.split('T')[0] : '',
        endDate: selectedWhitelist.endDate ? selectedWhitelist.endDate.split('T')[0] : '',
        memo: selectedWhitelist.memo || '',
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
        message: t('whitelist.dialog.deleteMessage', { name: selectedWhitelist.nickname }),
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
      if (editDialog && selectedWhitelist) {
        await WhitelistService.updateWhitelist(selectedWhitelist.id, formData);
        enqueueSnackbar(t('whitelist.toast.updated'), { variant: 'success' });
        setEditDialog(false);
      } else {
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
          nickname: parts[0]?.trim() || '',
          ipAddress: parts[1]?.trim() || undefined,
          memo: parts[2]?.trim() || undefined,
        };
      }).filter(entry => entry.nickname);

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
            <Tab label={t('whitelist.tabs.nickname')} />
            <Tab label={t('whitelist.tabs.ip')} />
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
                        value={search}
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
                          <TableCell>{t('whitelist.columns.id')}</TableCell>
                          <TableCell>{t('whitelist.columns.nickname')}</TableCell>
                          <TableCell>{t('whitelist.columns.ipAddress')}</TableCell>
                          <TableCell>{t('whitelist.columns.allowPeriod')}</TableCell>
                          <TableCell>{t('whitelist.columns.createdBy')}</TableCell>
                          <TableCell>{t('whitelist.columns.createdAt')}</TableCell>
                          <TableCell>{t('whitelist.columns.memo')}</TableCell>
                          <TableCell align="center">{t('whitelist.columns.actions')}</TableCell>
                        </TableRow>
                      </TableHead>
              <TableBody>
                {whitelists.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      {t('whitelist.noEntries')}
                    </TableCell>
                  </TableRow>
                ) : (
                  whitelists.map((whitelist) => (
                    <TableRow key={whitelist.id}>
                      <TableCell>{whitelist.id}</TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {whitelist.nickname}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {whitelist.ipAddress ? (
                          <Chip label={whitelist.ipAddress} size="small" />
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
                        <Typography variant="body2">
                          {whitelist.createdByName || t('whitelist.userWithId', { id: whitelist.createdBy })}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatDate(whitelist.createdAt)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {whitelist.memo || '-'}
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
            page={page}
            rowsPerPage={rowsPerPage}
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
              <Dialog open={addDialog || editDialog} onClose={() => { setAddDialog(false); setEditDialog(false); }} maxWidth="sm" fullWidth>
                <DialogTitle>
                  {editDialog ? t('whitelist.dialog.editTitle') : t('whitelist.dialog.addTitle')}
                </DialogTitle>
                <DialogContent>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                    <TextField
                      fullWidth
                      label={t('whitelist.form.nickname')}
                      value={formData.nickname}
                      onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                      required
                    />
                    <TextField
                      fullWidth
                      label={t('whitelist.form.ipAddressOpt')}
                      value={formData.ipAddress}
                      onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                      placeholder={t('whitelist.form.anyIpPlaceholder')}
                    />
                    <DatePicker
                      label={t('whitelist.form.startDateOpt')}
                      value={formData.startDate ? moment(formData.startDate) : null}
                      onChange={(date) => setFormData({ ...formData, startDate: date ? date.format('YYYY-MM-DD') : '' })}
                      slotProps={{ textField: { fullWidth: true } }}
                    />
                    <DatePicker
                      label={t('whitelist.form.endDateOpt')}
                      value={formData.endDate ? moment(formData.endDate) : null}
                      onChange={(date) => setFormData({ ...formData, endDate: date ? date.format('YYYY-MM-DD') : '' })}
                      slotProps={{ textField: { fullWidth: true } }}
                    />
                    <TextField
                      fullWidth
                      label={t('whitelist.form.memoOpt')}
                      value={formData.memo}
                      onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
                      multiline
                      rows={3}
                      placeholder={t('whitelist.form.memoPlaceholder')}
                    />
                  </Box>
                </DialogContent>
                <DialogActions>
                  <Button onClick={() => { setAddDialog(false); setEditDialog(false); }}>
                    {t('common.cancel')}
                  </Button>
                  <Button onClick={handleSave} variant="contained">
                    {editDialog ? t('common.update') : t('common.create')}
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
        </CardContent>
      </Card>
    </Box>
  );
};

export default WhitelistPage;
