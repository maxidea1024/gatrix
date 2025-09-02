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
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { WhitelistService, Whitelist, CreateWhitelistData } from '../../services/whitelistService';
import SimplePagination from '../../components/common/SimplePagination';
import IpWhitelistTab from '../../components/admin/IpWhitelistTab';
import FormDialogHeader from '../../components/common/FormDialogHeader';
import EmptyTableRow from '../../components/common/EmptyTableRow';

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
        enqueueSnackbar('계정 ID는 4~36글자 사이여야 합니다.', { variant: 'error' });
        return;
      }

      if (editDialog && selectedWhitelist) {
        await WhitelistService.updateWhitelist(selectedWhitelist.id, formData);
        enqueueSnackbar('화이트리스트가 수정되었습니다.', { variant: 'success' });
        setEditDialog(false);
      } else {
        await WhitelistService.createWhitelist(formData);
        enqueueSnackbar('화이트리스트가 생성되었습니다.', { variant: 'success' });
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
            화이트리스트 관리
          </Typography>
          <Typography variant="body1" color="text.secondary">
            계정 및 IP 화이트리스트 관리</Typography>
        </Box>
      </Box>

      {/* Main Card with Tabs */}
      <Card>
        <CardContent>
          <Tabs value={currentTab} onChange={handleTabChange} sx={{ mb: 3 }}>
            <Tab label="계정 화이트리스트" />
            <Tab label="IP 화이트리스트" />
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
                          <TableCell>
                            <Checkbox
                              checked={selectedIds.length > 0 && selectedIds.length === whitelists.length}
                              indeterminate={selectedIds.length > 0 && selectedIds.length < whitelists.length}
                              onChange={handleSelectAll}
                            />
                          </TableCell>
                          <TableCell>계정 ID</TableCell>
                          <TableCell>IP 주소</TableCell>
                          <TableCell>허용 기간</TableCell>
                          <TableCell>사용 목적</TableCell>
                          <TableCell>상태</TableCell>
                          <TableCell>생성자</TableCell>
                          <TableCell>생성일</TableCell>
                          <TableCell align="center">작업</TableCell>
                        </TableRow>
                      </TableHead>
              <TableBody>
                {whitelists.length === 0 ? (
                  <EmptyTableRow
                    colSpan={9}
                    loading={loading}
                    message="계정 화이트리스트 항목이 없습니다."
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
                        <Typography variant="body2" fontWeight="medium">
                          {whitelist.accountId}
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
                            영구
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
                          label={whitelist.isActive ? '활성' : '비활성'}
                          color={whitelist.isActive ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {whitelist.createdByName || 'Unknown'}
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
                <FormDialogHeader
                  title={editDialog ? '계정 화이트리스트 편집' : '계정 화이트리스트 추가'}
                  description={editDialog
                    ? '기존 화이트리스트 항목의 정보를 수정할 수 있습니다.'
                    : '새로운 계정을 화이트리스트에 추가하고 접근 권한을 설정할 수 있습니다.'
                  }
                />
                <DialogContent>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                    <Box>
                      <TextField
                        fullWidth
                        label="계정 ID"
                        value={formData.accountId}
                        onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
                        required
                        placeholder="사용자 계정 ID를 입력하세요"
                        error={formData.accountId && (formData.accountId.trim().length < 4 || formData.accountId.trim().length > 36)}
                        helperText={
                          formData.accountId && (formData.accountId.trim().length < 4 || formData.accountId.trim().length > 36)
                            ? '계정 ID는 4~36글자 사이여야 합니다.'
                            : undefined
                        }
                      />
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                        화이트리스트에 추가할 사용자의 계정 ID를 정확히 입력해주세요. (4~36글자)
                      </Typography>
                    </Box>
                    <Box>
                      <TextField
                        fullWidth
                        label="IP 주소 (선택사항)"
                        value={formData.ipAddress}
                        onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                        placeholder="예: 192.168.1.100"
                      />
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                        특정 IP에서만 접근을 허용하려면 입력하세요. 비워두면 모든 IP에서 접근 가능합니다.
                      </Typography>
                    </Box>
                    <Box>
                      <DatePicker
                        label="시작일 (선택사항)"
                        value={formData.startDate ? moment(formData.startDate) : null}
                        onChange={(date) => setFormData({ ...formData, startDate: date ? date.format('YYYY-MM-DD') : '' })}
                        slotProps={{ textField: { fullWidth: true } }}
                      />
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                        화이트리스트가 활성화될 시작 날짜를 선택하세요. 비워두면 즉시 활성화됩니다.
                      </Typography>
                    </Box>
                    <Box>
                      <DatePicker
                        label="종료일 (선택사항)"
                        value={formData.endDate ? moment(formData.endDate) : null}
                        onChange={(date) => setFormData({ ...formData, endDate: date ? date.format('YYYY-MM-DD') : '' })}
                        slotProps={{ textField: { fullWidth: true } }}
                      />
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                        화이트리스트가 만료될 날짜를 선택하세요. 비워두면 영구적으로 유지됩니다.
                      </Typography>
                    </Box>
                    <Box>
                      <TextField
                        fullWidth
                        label="사용 목적"
                        value={formData.purpose}
                        onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                        multiline
                        rows={3}
                        placeholder="화이트리스트 추가 목적을 입력하세요"
                      />
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                        화이트리스트 추가 사유나 목적을 기록해주세요. 관리 및 추적에 도움이 됩니다.
                      </Typography>
                    </Box>
                  </Box>
                </DialogContent>
                <DialogActions>
                  <Button onClick={() => { setAddDialog(false); setEditDialog(false); }} startIcon={<CancelIcon />}>
                    취소
                  </Button>
                  <Button onClick={handleSave} variant="contained" startIcon={<SaveIcon />}>
                    {editDialog ? '수정' : '생성'}
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
