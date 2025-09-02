import React, { useState, useEffect, useCallback } from 'react';
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
  Tooltip,
  Switch,
  FormControlLabel,
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import {
  Search as SearchIcon,
  MoreVert as MoreVertIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Upload as UploadIcon,
  Refresh as RefreshIcon,
  PowerSettingsNew as ToggleIcon,
  Info as InfoIcon,
  Cancel as CancelIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { 
  IpWhitelistService, 
  IpWhitelist, 
  CreateIpWhitelistData,
  BulkCreateIpEntry 
} from '../../services/ipWhitelistService';
import SimplePagination from '../common/SimplePagination';
import { formatDateTimeDetailed } from '../../utils/dateFormat';
import FormDialogHeader from '../common/FormDialogHeader';
import EmptyTableRow from '../common/EmptyTableRow';
import dayjs from 'dayjs';

const IpWhitelistTab: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  // State
  const [ipWhitelists, setIpWhitelists] = useState<IpWhitelist[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [search, setSearch] = useState('');

  // Menu state
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedIpWhitelist, setSelectedIpWhitelist] = useState<IpWhitelist | null>(null);

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
  const [formData, setFormData] = useState<CreateIpWhitelistData>({
    ipAddress: '',
    purpose: '',
    isEnabled: true,
    startDate: undefined,
    endDate: undefined,
  });

  const [bulkData, setBulkData] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Load IP whitelists
  const loadIpWhitelists = useCallback(async () => {
    try {
      setLoading(true);
      const filters: any = {};
      if (search) filters.search = search;
      const result = await IpWhitelistService.getIpWhitelists(page + 1, rowsPerPage, filters);

      if (result && typeof result === 'object' && Array.isArray(result.ipWhitelists)) {
        setIpWhitelists(result.ipWhitelists);
        setTotal(result.total || 0);
      } else {
        console.error('Invalid response structure:', result);
        setIpWhitelists([]);
        setTotal(0);
      }
    } catch (error: any) {
      console.error('Error loading IP whitelists:', error);
      enqueueSnackbar(error.message || t('ipWhitelist.errors.loadFailed'), { variant: 'error' });
      setIpWhitelists([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, search, t, enqueueSnackbar]);

  useEffect(() => {
    loadIpWhitelists();
  }, [loadIpWhitelists]);

  // Handlers
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

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>, ipWhitelist: IpWhitelist) => {
    setAnchorEl(event.currentTarget);
    setSelectedIpWhitelist(ipWhitelist);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedIpWhitelist(null);
  };

  const handleAdd = () => {
    setFormData({
      ipAddress: '',
      purpose: '',
      isEnabled: true,
      startDate: undefined,
      endDate: undefined,
    });
    setFormErrors({});
    setAddDialog(true);
  };

  const handleEdit = () => {
    if (selectedIpWhitelist) {
      setFormData({
        ipAddress: selectedIpWhitelist.ipAddress,
        purpose: selectedIpWhitelist.purpose,
        isEnabled: selectedIpWhitelist.isEnabled,
        startDate: selectedIpWhitelist.startDate,
        endDate: selectedIpWhitelist.endDate,
      });
      setFormErrors({});
      setEditDialog(true);
    }
    handleMenuClose();
  };

  const handleDelete = () => {
    if (selectedIpWhitelist) {
      setConfirmDialog({
        open: true,
        title: t('ipWhitelist.confirmDelete.title'),
        message: t('ipWhitelist.confirmDelete.message', { ipAddress: selectedIpWhitelist.ipAddress }),
        action: async () => {
          try {
            await IpWhitelistService.deleteIpWhitelist(selectedIpWhitelist.id);
            enqueueSnackbar(t('ipWhitelist.deleteSuccess'), { variant: 'success' });
            loadIpWhitelists();
          } catch (error: any) {
            enqueueSnackbar(error.message || t('ipWhitelist.errors.deleteFailed'), { variant: 'error' });
          }
          setConfirmDialog(prev => ({ ...prev, open: false }));
        },
      });
    }
    handleMenuClose();
  };

  const handleToggleStatus = async (ipWhitelist: IpWhitelist) => {
    try {
      await IpWhitelistService.toggleIpWhitelistStatus(ipWhitelist.id);
      enqueueSnackbar(
        t(ipWhitelist.isEnabled ? 'ipWhitelist.disableSuccess' : 'ipWhitelist.enableSuccess'),
        { variant: 'success' }
      );
      loadIpWhitelists();
    } catch (error: any) {
      enqueueSnackbar(error.message || t('ipWhitelist.errors.toggleFailed'), { variant: 'error' });
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    const ipValidation = IpWhitelistService.validateIpOrCidr(formData.ipAddress);
    if (!ipValidation.isValid) {
      errors.ipAddress = ipValidation.error || t('ipWhitelist.errors.invalidIp');
    }

    if (!formData.purpose.trim()) {
      errors.purpose = t('ipWhitelist.errors.purposeRequired');
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      // Clean up form data - only include valid date values
      const cleanFormData: any = {
        ipAddress: formData.ipAddress,
        purpose: formData.purpose,
        isEnabled: formData.isEnabled,
      };

      // Only include dates if they have valid values
      if (formData.startDate && formData.startDate.trim() !== '') {
        cleanFormData.startDate = formData.startDate;
      }

      if (formData.endDate && formData.endDate.trim() !== '') {
        cleanFormData.endDate = formData.endDate;
      }

      console.log('Frontend sending data:', cleanFormData);

      if (editDialog && selectedIpWhitelist) {
        await IpWhitelistService.updateIpWhitelist(selectedIpWhitelist.id, cleanFormData);
        enqueueSnackbar(t('ipWhitelist.updateSuccess'), { variant: 'success' });
      } else {
        await IpWhitelistService.createIpWhitelist(cleanFormData);
        enqueueSnackbar(t('ipWhitelist.createSuccess'), { variant: 'success' });
      }

      setAddDialog(false);
      setEditDialog(false);
      loadIpWhitelists();
    } catch (error: any) {
      enqueueSnackbar(error.message || t('ipWhitelist.errors.saveFailed'), { variant: 'error' });
    }
  };

  const handleBulkImport = async () => {
    try {
      const entries = IpWhitelistService.parseBulkImportText(bulkData);
      
      if (entries.length === 0) {
        enqueueSnackbar(t('ipWhitelist.errors.noBulkEntries'), { variant: 'warning' });
        return;
      }

      const result = await IpWhitelistService.bulkCreateIpWhitelists(entries);
      
      enqueueSnackbar(
        t('ipWhitelist.bulkImportSuccess', { 
          created: result.createdCount, 
          total: result.requestedCount 
        }),
        { variant: 'success' }
      );

      setBulkDialog(false);
      setBulkData('');
      loadIpWhitelists();
    } catch (error: any) {
      enqueueSnackbar(error.message || t('ipWhitelist.errors.bulkImportFailed'), { variant: 'error' });
    }
  };

  const getStatusChip = (isEnabled: boolean) => (
    <Chip
      label={isEnabled ? t('common.enabled') : t('common.disabled')}
      color={isEnabled ? 'success' : 'default'}
      size="small"
    />
  );

  return (
    <>
      {/* Action Buttons */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, justifyContent: 'flex-end' }}>
        <Button
          variant="outlined"
          startIcon={<UploadIcon />}
          onClick={() => setBulkDialog(true)}
        >
          {t('ipWhitelist.bulkImport')}
        </Button>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAdd}
        >
          {t('ipWhitelist.addEntry')}
        </Button>
      </Box>

      {/* Search & Filters */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              <TextField
                placeholder={t('ipWhitelist.searchPlaceholder')}
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
                <IconButton onClick={loadIpWhitelists} disabled={loading} sx={{ ml: 2 }}>
                  <RefreshIcon />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        </CardContent>
      </Card>

      {/* Table */}
      <Card variant="outlined">
        <CardContent sx={{ p: 0 }}>
          {loading && <LinearProgress />}
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t('ipWhitelist.ipAddress')}</TableCell>
                  <TableCell>{t('ipWhitelist.purpose')}</TableCell>
                  <TableCell>{t('ipWhitelist.period')}</TableCell>
                  <TableCell>{t('ipWhitelist.status')}</TableCell>
                  <TableCell>{t('ipWhitelist.createdBy')}</TableCell>
                  <TableCell>{t('ipWhitelist.createdAt')}</TableCell>
                  <TableCell align="center">{t('common.actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {ipWhitelists.length === 0 ? (
                  <EmptyTableRow
                    colSpan={7}
                    loading={loading}
                    message="IP 화이트리스트 항목이 없습니다."
                  />
                ) : (
                  ipWhitelists.map((ipWhitelist) => (
                    <TableRow key={ipWhitelist.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                          {ipWhitelist.ipAddress}
                        </Typography>
                        <Tooltip title={IpWhitelistService.getIpDescription(ipWhitelist.ipAddress)}>
                          <InfoIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                        </Tooltip>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {ipWhitelist.purpose}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {ipWhitelist.startDate || ipWhitelist.endDate ? (
                        <Box>
                          {ipWhitelist.startDate && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                              {t('ipWhitelist.from')}: {formatDateTimeDetailed(ipWhitelist.startDate)}
                            </Typography>
                          )}
                          {ipWhitelist.endDate && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                              {t('ipWhitelist.to')}: {formatDateTimeDetailed(ipWhitelist.endDate)}
                            </Typography>
                          )}
                        </Box>
                      ) : (
                        <Chip label={t('ipWhitelist.unlimited')} size="small" color="primary" variant="outlined" />
                      )}
                    </TableCell>
                    <TableCell>
                      {getStatusChip(ipWhitelist.isEnabled)}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {ipWhitelist.createdByName || `User ${ipWhitelist.createdBy}`}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {formatDateTimeDetailed(ipWhitelist.createdAt)}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title={ipWhitelist.isEnabled ? t('common.disable') : t('common.enable')}>
                        <IconButton
                          size="small"
                          onClick={() => handleToggleStatus(ipWhitelist)}
                          color={ipWhitelist.isEnabled ? 'success' : 'default'}
                        >
                          <ToggleIcon />
                        </IconButton>
                      </Tooltip>
                      <IconButton
                        size="small"
                        onClick={(e) => handleMenuClick(e, ipWhitelist)}
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
      <Dialog 
        open={addDialog || editDialog} 
        onClose={() => { setAddDialog(false); setEditDialog(false); }} 
        maxWidth="sm" 
        fullWidth
      >
        <FormDialogHeader
          title={editDialog ? 'IP 화이트리스트 편집' : 'IP 화이트리스트 추가'}
          description={editDialog
            ? '기존 IP 화이트리스트 항목의 정보를 수정할 수 있습니다.'
            : '새로운 IP 주소를 화이트리스트에 추가하고 접근 권한을 설정할 수 있습니다.'
          }
        />
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Box>
              <TextField
                fullWidth
                label="IP 주소 또는 CIDR"
                value={formData.ipAddress}
                onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                error={!!formErrors.ipAddress}
                helperText={formErrors.ipAddress}
                placeholder="예: 192.168.1.1 또는 192.168.1.0/24"
                required
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                IP 주소(예: 192.168.1.1) 또는 CIDR 표기법(예: 192.168.1.0/24)을 입력하세요.
              </Typography>
            </Box>
            <Box>
              <DateTimePicker
                label="시작일 (선택사항)"
                value={formData.startDate ? dayjs(formData.startDate) : null}
                onChange={(date) => setFormData({
                  ...formData,
                  startDate: date?.isValid() ? date.toISOString() : undefined
                })}
                slotProps={{
                  textField: {
                    fullWidth: true
                  }
                }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                화이트리스트가 활성화될 시작 날짜와 시간을 선택하세요. 비워두면 즉시 활성화됩니다.
              </Typography>
            </Box>
            <Box>
              <DateTimePicker
                label="종료일 (선택사항)"
                value={formData.endDate ? dayjs(formData.endDate) : null}
                onChange={(date) => setFormData({
                  ...formData,
                  endDate: date?.isValid() ? date.toISOString() : undefined
                })}
                minDateTime={formData.startDate ? dayjs(formData.startDate) : undefined}
                slotProps={{
                  textField: {
                    fullWidth: true
                  }
                }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                화이트리스트가 만료될 날짜와 시간을 선택하세요. 비워두면 영구적으로 유지됩니다.
              </Typography>
            </Box>
            <Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isEnabled}
                    onChange={(e) => setFormData({ ...formData, isEnabled: e.target.checked })}
                  />
                }
                label="활성화"
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                화이트리스트 항목의 활성화 상태를 설정합니다. 비활성화하면 접근이 차단됩니다.
              </Typography>
            </Box>
            <Box>
              <TextField
                fullWidth
                label="사용 목적"
                value={formData.purpose}
                onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                error={!!formErrors.purpose}
                helperText={formErrors.purpose}
                placeholder="IP 화이트리스트 추가 목적을 입력하세요"
                multiline
                rows={3}
                required
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                IP 화이트리스트 추가 사유나 목적을 기록해주세요. 관리 및 추적에 도움이 됩니다.
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setAddDialog(false); setEditDialog(false); }} startIcon={<CancelIcon />}>
            취소
          </Button>
          <Button onClick={handleSave} variant="contained" startIcon={<SaveIcon />}>
            {editDialog ? 'IP 화이트리스트 수정' : 'IP 화이트리스트 추가'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Import Dialog */}
      <Dialog open={bulkDialog} onClose={() => setBulkDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>{t('ipWhitelist.bulkImport')}</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t('ipWhitelist.bulkImportHelp')}
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={10}
              value={bulkData}
              onChange={(e) => setBulkData(e.target.value)}
              placeholder={`192.168.1.1,Office network,2024-01-01T09:00:00,2024-12-31T18:00:00
192.168.2.0/24,Branch network,2024-01-01T09:00:00
10.0.0.1,VPN server`}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkDialog(false)} startIcon={<CancelIcon />}>
            취소
          </Button>
          <Button onClick={handleBulkImport} variant="contained" startIcon={<UploadIcon />}>
            가져오기
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirm Dialog */}
      <Dialog open={confirmDialog.open} onClose={() => setConfirmDialog(prev => ({ ...prev, open: false }))}>
        <DialogTitle>{confirmDialog.title}</DialogTitle>
        <DialogContent>
          <Typography>{confirmDialog.message}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog(prev => ({ ...prev, open: false }))} startIcon={<CancelIcon />}>
            취소
          </Button>
          <Button onClick={confirmDialog.action} color="error" variant="contained" startIcon={<DeleteIcon />}>
            확인
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default IpWhitelistTab;
