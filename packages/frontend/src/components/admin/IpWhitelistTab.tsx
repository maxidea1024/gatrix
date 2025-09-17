import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Drawer,
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
  Cancel as CancelIcon,
  Save as SaveIcon,
  ContentCopy as ContentCopyIcon,
  Close as CloseIcon,
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

  // Refs for form focus
  const ipAddressFieldRef = useRef<HTMLInputElement>(null);

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
    if (typeof newPage === 'number' && !isNaN(newPage)) {
      setPage(newPage);
    } else {
      console.error('Invalid page number received:', newPage);
      setPage(0); // Reset to first page
    }
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

  // 복사 기능
  const handleCopyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      enqueueSnackbar(t('common.copySuccess', { type }), { variant: 'success' });
    } catch (error) {
      console.error('복사 실패:', error);
      enqueueSnackbar(t('common.copyFailed'), { variant: 'error' });
    }
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

    // IP Address 필드에 포커스
    setTimeout(() => {
      ipAddressFieldRef.current?.focus();
    }, 100);
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

      // IP Address 필드에 포커스
      setTimeout(() => {
        ipAddressFieldRef.current?.focus();
      }, 100);
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
                    message={t('ipWhitelist.noEntries')}
                    loadingMessage={t('common.loadingWhitelist')}
                  />
                ) : (
                  ipWhitelists.map((ipWhitelist) => (
                    <TableRow key={ipWhitelist.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                          {ipWhitelist.ipAddress}
                        </Typography>
                        <Tooltip title={t('common.copy') + ' ' + t('ipWhitelist.ipAddress')}>
                          <IconButton
                            size="small"
                            onClick={() => handleCopyToClipboard(ipWhitelist.ipAddress, t('ipWhitelist.ipAddress'))}
                            sx={{ p: 0.5 }}
                          >
                            <ContentCopyIcon fontSize="small" />
                          </IconButton>
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
                        {ipWhitelist.createdByName || t('dashboard.unknown')}
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
            rowsPerPageOptions={[5, 10, 25, 50, 100]}
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

      {/* Add/Edit Drawer */}
      <Drawer
        anchor="right"
        open={addDialog || editDialog}
        onClose={() => { setAddDialog(false); setEditDialog(false); }}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: 600 },
            maxWidth: '100vw',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 1300
          }
        }}
        ModalProps={{
          keepMounted: false,
          sx: {
            zIndex: 1300
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
              {editDialog ? t('ipWhitelist.dialog.editTitle') : t('ipWhitelist.dialog.addTitle')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {editDialog
                ? t('ipWhitelist.dialog.editDescription')
                : t('ipWhitelist.dialog.addDescription')
              }
            </Typography>
          </Box>
          <IconButton
            onClick={() => { setAddDialog(false); setEditDialog(false); }}
            size="small"
          >
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, p: 3, overflow: 'auto' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box>
              <TextField
                fullWidth
                label={t('ipWhitelist.form.ipAddress')}
                value={formData.ipAddress}
                onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                error={!!formErrors.ipAddress}
                helperText={formErrors.ipAddress}
                placeholder={t('ipWhitelist.form.ipAddressPlaceholder')}
                required
                inputRef={ipAddressFieldRef}
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                {t('ipWhitelist.form.ipAddressHelp')}
              </Typography>
            </Box>
            <Box>
              <DateTimePicker
                label={t('ipWhitelist.form.startDate')}
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
                {t('ipWhitelist.form.startDateHelp')}
              </Typography>
            </Box>
            <Box>
              <DateTimePicker
                label={t('ipWhitelist.form.endDate')}
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
                {t('ipWhitelist.form.endDateHelp')}
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
                label={t('ipWhitelist.form.enabled')}
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                {t('ipWhitelist.form.enabledHelp')}
              </Typography>
            </Box>
            <Box>
              <TextField
                fullWidth
                label={t('ipWhitelist.form.purpose')}
                value={formData.purpose}
                onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                error={!!formErrors.purpose}
                helperText={formErrors.purpose}
                placeholder={t('ipWhitelist.form.purposePlaceholder')}
                multiline
                rows={3}
                required
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                {t('ipWhitelist.form.purposeHelp')}
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Footer */}
        <Box sx={{
          p: 3,
          borderTop: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          display: 'flex',
          gap: 2,
          justifyContent: 'flex-end'
        }}>
          <Button onClick={() => { setAddDialog(false); setEditDialog(false); }} startIcon={<CancelIcon />}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSave} variant="contained" startIcon={<SaveIcon />}>
            {editDialog ? t('ipWhitelist.dialog.editTitle') : t('ipWhitelist.dialog.addTitle')}
          </Button>
        </Box>
      </Drawer>

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
            {t('common.cancel')}
          </Button>
          <Button onClick={handleBulkImport} variant="contained" startIcon={<UploadIcon />}>
            {t('common.import')}
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
            {t('common.cancel')}
          </Button>
          <Button onClick={confirmDialog.action} color="error" variant="contained" startIcon={<DeleteIcon />}>
            {t('common.confirm')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default IpWhitelistTab;
