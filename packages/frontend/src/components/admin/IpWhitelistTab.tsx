import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import { useDebounce } from '../../hooks/useDebounce';
import { useGlobalPageSize } from '../../hooks/useGlobalPageSize';
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
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import LocalizedDateTimePicker from '../common/LocalizedDateTimePicker';
import {
  MoreVert as MoreVertIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Upload as UploadIcon,
  Refresh as RefreshIcon,
  Block as BlockIcon,
  CheckCircle as CheckCircleIcon,
  ContentCopy as ContentCopyIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import {
  IpWhitelistService,
  IpWhitelist,
  CreateIpWhitelistData,
  BulkCreateIpEntry,
} from '../../services/ipWhitelistService';
import SimplePagination from '../common/SimplePagination';
import {
  formatDateTimeDetailed,
  formatRelativeTime,
} from '../../utils/dateFormat';
import { copyToClipboardWithNotification } from '../../utils/clipboard';
import FormDialogHeader from '../common/FormDialogHeader';
import ResizableDrawer from '../common/ResizableDrawer';
import EmptyPagePlaceholder from '../common/EmptyPagePlaceholder';
import PageContentLoader from '../common/PageContentLoader';
import SearchTextField from '../common/SearchTextField';

import { exportToFile, ExportColumn } from '../../utils/exportImportUtils';
import ExportImportMenuItems from '../common/ExportImportMenuItems';
import ImportDialog from '../common/ImportDialog';

interface IpWhitelistTabProps {
  canManage?: boolean;
}

const IpWhitelistTab: React.FC<IpWhitelistTabProps> = ({
  canManage = true,
}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  // Refs for form focus
  const ipAddressFieldRef = useRef<HTMLInputElement>(null);

  // State
  const [ipWhitelists, setIpWhitelists] = useState<IpWhitelist[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useGlobalPageSize();
  const [search, setSearch] = useState('');

  // Debounced search (500ms delay)
  const debouncedSearch = useDebounce(search, 500);

  // Menu state
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedIpWhitelist, setSelectedIpWhitelist] =
    useState<IpWhitelist | null>(null);

  // Dialog states
  const [addDialog, setAddDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [bulkDialog, setBulkDialog] = useState(false);
  const [pageMenuAnchor, setPageMenuAnchor] = useState<HTMLElement | null>(
    null
  );
  const [importDialogOpen, setImportDialogOpen] = useState(false);
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

  // Check if form data has changed from original (for edit mode)
  const isDirty = useMemo(() => {
    if (!editDialog || !selectedIpWhitelist) return true; // Always allow submit for add
    return (
      formData.ipAddress !== selectedIpWhitelist.ipAddress ||
      formData.purpose !== selectedIpWhitelist.purpose ||
      formData.isEnabled !== selectedIpWhitelist.isEnabled ||
      (formData.startDate || '') !== (selectedIpWhitelist.startDate || '') ||
      (formData.endDate || '') !== (selectedIpWhitelist.endDate || '')
    );
  }, [formData, editDialog, selectedIpWhitelist]);

  // Load IP whitelists
  const loadIpWhitelists = useCallback(async () => {
    try {
      setLoading(true);
      const filters: any = {};
      if (debouncedSearch) filters.search = debouncedSearch;
      const result = await IpWhitelistService.getIpWhitelists(
        page + 1,
        rowsPerPage,
        filters
      );

      if (
        result &&
        typeof result === 'object' &&
        Array.isArray(result.ipWhitelists)
      ) {
        setIpWhitelists(result.ipWhitelists);
        setTotal(result.total || 0);
      } else {
        console.error('Invalid response structure:', result);
        setIpWhitelists([]);
        setTotal(0);
      }
    } catch (error: any) {
      console.error('Error loading IP whitelists:', error);
      enqueueSnackbar(error.message || t('ipWhitelist.errors.loadFailed'), {
        variant: 'error',
      });
      setIpWhitelists([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, debouncedSearch, t, enqueueSnackbar]);

  useEffect(() => {
    loadIpWhitelists();
  }, [loadIpWhitelists]);

  // Handlers
  const handleSearchChange = (value: string) => {
    setSearch(value);
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

  const handleChangeRowsPerPage = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleMenuClick = (
    event: React.MouseEvent<HTMLElement>,
    ipWhitelist: IpWhitelist
  ) => {
    setAnchorEl(event.currentTarget);
    setSelectedIpWhitelist(ipWhitelist);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedIpWhitelist(null);
  };

  // Copy functionality
  const handleCopyToClipboard = (text: string, type: string) => {
    copyToClipboardWithNotification(
      text,
      () =>
        enqueueSnackbar(t('common.copiedToClipboard'), { variant: 'success' }),
      () => enqueueSnackbar(t('common.copyFailed'), { variant: 'error' })
    );
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

    // IP Address field focus
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

      // IP Address field focus
      setTimeout(() => {
        ipAddressFieldRef.current?.focus();
      }, 100);
    }
    setAnchorEl(null);
  };

  // Direct edit by clicking on IP address
  const handleDirectEdit = (ipWhitelist: IpWhitelist) => {
    setSelectedIpWhitelist(ipWhitelist);
    setFormData({
      ipAddress: ipWhitelist.ipAddress,
      purpose: ipWhitelist.purpose,
      isEnabled: ipWhitelist.isEnabled,
      startDate: ipWhitelist.startDate,
      endDate: ipWhitelist.endDate,
    });
    setFormErrors({});
    setEditDialog(true);

    setTimeout(() => {
      ipAddressFieldRef.current?.focus();
    }, 100);
  };

  const handleDelete = () => {
    if (selectedIpWhitelist) {
      setConfirmDialog({
        open: true,
        title: t('ipWhitelist.confirmDelete.title'),
        message: t('ipWhitelist.confirmDelete.message', {
          ipAddress: selectedIpWhitelist.ipAddress,
        }),
        action: async () => {
          try {
            await IpWhitelistService.deleteIpWhitelist(selectedIpWhitelist.id);
            enqueueSnackbar(t('ipWhitelist.deleteSuccess'), {
              variant: 'success',
            });
            loadIpWhitelists();
          } catch (error: any) {
            enqueueSnackbar(
              error.message || t('ipWhitelist.errors.deleteFailed'),
              {
                variant: 'error',
              }
            );
          }
          setConfirmDialog((prev) => ({ ...prev, open: false }));
        },
      });
    }
    handleMenuClose();
  };

  const handleToggleStatus = async (ipWhitelist: IpWhitelist) => {
    try {
      await IpWhitelistService.toggleIpWhitelistStatus(ipWhitelist.id);
      enqueueSnackbar(
        t(
          ipWhitelist.isEnabled
            ? 'ipWhitelist.disableSuccess'
            : 'ipWhitelist.enableSuccess'
        ),
        { variant: 'success' }
      );
      loadIpWhitelists();
    } catch (error: any) {
      enqueueSnackbar(error.message || t('ipWhitelist.errors.toggleFailed'), {
        variant: 'error',
      });
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    const ipValidation = IpWhitelistService.validateIpOrCidr(
      formData.ipAddress
    );
    if (!ipValidation.isValid) {
      errors.ipAddress =
        ipValidation.error || t('ipWhitelist.errors.invalidIp');
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
        await IpWhitelistService.updateIpWhitelist(
          selectedIpWhitelist.id,
          cleanFormData
        );
        enqueueSnackbar(t('ipWhitelist.updateSuccess'), { variant: 'success' });
      } else {
        await IpWhitelistService.createIpWhitelist(cleanFormData);
        enqueueSnackbar(t('ipWhitelist.createSuccess'), { variant: 'success' });
      }

      setAddDialog(false);
      setEditDialog(false);
      loadIpWhitelists();
    } catch (error: any) {
      enqueueSnackbar(error.message || t('ipWhitelist.errors.saveFailed'), {
        variant: 'error',
      });
    }
  };

  const handleBulkImport = async () => {
    try {
      const entries = IpWhitelistService.parseBulkImportText(bulkData);

      if (entries.length === 0) {
        enqueueSnackbar(t('ipWhitelist.errors.noBulkEntries'), {
          variant: 'warning',
        });
        return;
      }

      const result = await IpWhitelistService.bulkCreateIpWhitelists(entries);

      enqueueSnackbar(
        t('ipWhitelist.bulkImportSuccess', {
          created: result.createdCount,
          total: result.requestedCount,
        }),
        { variant: 'success' }
      );

      setBulkDialog(false);
      setBulkData('');
      loadIpWhitelists();
    } catch (error: any) {
      enqueueSnackbar(
        error.message || t('ipWhitelist.errors.bulkImportFailed'),
        {
          variant: 'error',
        }
      );
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
      {/* Search & Actions Row */}
      <Box
        sx={{
          display: 'flex',
          gap: 2,
          alignItems: 'center',
          mb: 3,
        }}
      >
        <SearchTextField
          placeholder={t('ipWhitelist.searchPlaceholder')}
          value={search}
          onChange={handleSearchChange}
          sx={{ minWidth: 300 }}
        />
        {canManage && (
          <Box sx={{ display: 'flex', gap: 1, ml: 'auto' }}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleAdd}
            >
              {t('ipWhitelist.addEntry')}
            </Button>
            <IconButton
              onClick={(e) => setPageMenuAnchor(e.currentTarget)}
              aria-label="more options"
            >
              <MoreVertIcon />
            </IconButton>
            <Menu
              anchorEl={pageMenuAnchor}
              open={Boolean(pageMenuAnchor)}
              onClose={() => setPageMenuAnchor(null)}
            >
              <ExportImportMenuItems
                onExport={(format) => {
                  setPageMenuAnchor(null);
                  const exportColumns: ExportColumn[] = [
                    { key: 'ipAddress', header: t('ipWhitelist.ipAddress') },
                    { key: 'purpose', header: t('ipWhitelist.purpose') },
                    { key: 'isEnabled', header: t('ipWhitelist.status') },
                    { key: 'createdAt', header: t('ipWhitelist.createdAt') },
                  ];
                  try {
                    exportToFile(
                      ipWhitelists,
                      exportColumns,
                      'ip-whitelist',
                      format
                    );
                    enqueueSnackbar(t('common.exportSuccess'), {
                      variant: 'success',
                    });
                  } catch (err) {
                    enqueueSnackbar(t('common.exportFailed'), {
                      variant: 'error',
                    });
                  }
                }}
                onImportClick={() => {
                  setPageMenuAnchor(null);
                  setImportDialogOpen(true);
                }}
              />
            </Menu>
          </Box>
        )}
      </Box>

      {/* Content */}
      <PageContentLoader loading={loading}>
        {ipWhitelists.length === 0 ? (
          <EmptyPagePlaceholder
            message={t('ipWhitelist.noEntries')}
            subtitle={canManage ? t('common.addFirstItem') : undefined}
            onAddClick={canManage ? handleAdd : undefined}
            addButtonLabel={t('ipWhitelist.addEntry')}
          />
        ) : (
          <Card variant="outlined">
            <CardContent sx={{ p: 0 }}>
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
                      <TableCell align="center">
                        {t('common.actions')}
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {ipWhitelists.map((ipWhitelist) => (
                      <TableRow key={ipWhitelist.id} hover>
                        <TableCell>
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                            }}
                          >
                            <Typography
                              variant="body2"
                              sx={{
                                fontFamily: 'monospace',
                                cursor: 'pointer',
                                '&:hover': {
                                  color: 'primary.main',
                                  textDecoration: 'underline',
                                },
                              }}
                              onClick={() => handleDirectEdit(ipWhitelist)}
                            >
                              {ipWhitelist.ipAddress}
                            </Typography>
                            <Tooltip
                              title={
                                t('common.copy') +
                                ' ' +
                                t('ipWhitelist.ipAddress')
                              }
                            >
                              <IconButton
                                size="small"
                                onClick={() =>
                                  handleCopyToClipboard(
                                    ipWhitelist.ipAddress,
                                    t('ipWhitelist.ipAddress')
                                  )
                                }
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
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  sx={{ display: 'block' }}
                                >
                                  {t('ipWhitelist.from')}:{' '}
                                  <Tooltip
                                    title={formatDateTimeDetailed(
                                      ipWhitelist.startDate
                                    )}
                                  >
                                    <span>
                                      {formatRelativeTime(
                                        ipWhitelist.startDate
                                      )}
                                    </span>
                                  </Tooltip>
                                </Typography>
                              )}
                              {ipWhitelist.endDate && (
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  sx={{ display: 'block' }}
                                >
                                  {t('ipWhitelist.to')}:{' '}
                                  <Tooltip
                                    title={formatDateTimeDetailed(
                                      ipWhitelist.endDate
                                    )}
                                  >
                                    <span>
                                      {formatRelativeTime(ipWhitelist.endDate)}
                                    </span>
                                  </Tooltip>
                                </Typography>
                              )}
                            </Box>
                          ) : (
                            <Chip
                              label={t('ipWhitelist.unlimited')}
                              size="small"
                              color="primary"
                              variant="outlined"
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          {getStatusChip(ipWhitelist.isEnabled)}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {ipWhitelist.createdByName ||
                              t('dashboard.unknown')}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Tooltip
                            title={formatDateTimeDetailed(
                              ipWhitelist.createdAt
                            )}
                          >
                            <Typography variant="body2">
                              {formatRelativeTime(ipWhitelist.createdAt)}
                            </Typography>
                          </Tooltip>
                        </TableCell>
                        <TableCell align="center">
                          <IconButton
                            size="small"
                            onClick={(e) => handleMenuClick(e, ipWhitelist)}
                          >
                            <MoreVertIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              {total > 0 && (
                <SimplePagination
                  count={total}
                  page={page}
                  rowsPerPage={rowsPerPage}
                  onPageChange={handleChangePage}
                  onRowsPerPageChange={handleChangeRowsPerPage}
                  rowsPerPageOptions={[5, 10, 25, 50, 100]}
                />
              )}
            </CardContent>
          </Card>
        )}
      </PageContentLoader>

      {/* Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        {canManage && selectedIpWhitelist && (
          <MenuItem
            onClick={() => {
              handleToggleStatus(selectedIpWhitelist);
              handleMenuClose();
            }}
          >
            {selectedIpWhitelist.isEnabled ? (
              <>
                <BlockIcon sx={{ mr: 1 }} />
                {t('common.disable')}
              </>
            ) : (
              <>
                <CheckCircleIcon sx={{ mr: 1 }} />
                {t('common.enable')}
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
      <ResizableDrawer
        open={addDialog || editDialog}
        onClose={() => {
          setAddDialog(false);
          setEditDialog(false);
        }}
        title={
          editDialog
            ? t('ipWhitelist.dialog.editTitle')
            : t('ipWhitelist.dialog.addTitle')
        }
        subtitle={
          editDialog
            ? t('ipWhitelist.dialog.editDescription')
            : t('ipWhitelist.dialog.addDescription')
        }
        storageKey="ipWhitelistDrawerWidth"
        defaultWidth={500}
        minWidth={400}
      >
        {/* Content */}
        <Box sx={{ flex: 1, p: 3, overflow: 'auto' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              fullWidth
              label={t('ipWhitelist.form.ipAddress')}
              value={formData.ipAddress}
              onChange={(e) =>
                setFormData({ ...formData, ipAddress: e.target.value })
              }
              error={!!formErrors.ipAddress}
              helperText={
                formErrors.ipAddress || t('ipWhitelist.form.ipAddressHelp')
              }
              placeholder={t('ipWhitelist.form.ipAddressPlaceholder')}
              required
              inputRef={ipAddressFieldRef}
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <LocalizedDateTimePicker
                label={t('ipWhitelist.form.startDate')}
                value={formData.startDate || null}
                onChange={(isoString) =>
                  setFormData({
                    ...formData,
                    startDate: isoString || undefined,
                  })
                }
                helperText={t('ipWhitelist.form.startDateHelp')}
              />
              <LocalizedDateTimePicker
                label={t('ipWhitelist.form.endDate')}
                value={formData.endDate || null}
                onChange={(isoString) =>
                  setFormData({ ...formData, endDate: isoString || undefined })
                }
                helperText={t('ipWhitelist.form.endDateHelp')}
              />
            </Box>
            <Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isEnabled}
                    onChange={(e) =>
                      setFormData({ ...formData, isEnabled: e.target.checked })
                    }
                  />
                }
                label={t('ipWhitelist.form.enabled')}
              />
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block' }}
              >
                {t('ipWhitelist.form.enabledHelp')}
              </Typography>
            </Box>
            <TextField
              fullWidth
              label={t('ipWhitelist.form.purpose')}
              value={formData.purpose}
              onChange={(e) =>
                setFormData({ ...formData, purpose: e.target.value })
              }
              error={!!formErrors.purpose}
              helperText={
                formErrors.purpose || t('ipWhitelist.form.purposeHelp')
              }
              placeholder={t('ipWhitelist.form.purposePlaceholder')}
              multiline
              rows={3}
              required
            />
          </Box>
        </Box>

        {/* Footer */}
        <Box
          sx={{
            p: 2,
            borderTop: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            display: 'flex',
            gap: 1,
            justifyContent: 'flex-end',
          }}
        >
          <Button
            onClick={() => {
              setAddDialog(false);
              setEditDialog(false);
            }}
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={
              editDialog
                ? !isDirty
                : !formData.ipAddress.trim() || !formData.purpose.trim()
            }
          >
            {editDialog ? t('common.update') : t('common.add')}
          </Button>
        </Box>
      </ResizableDrawer>

      {/* Bulk Import Dialog */}
      <Dialog
        open={bulkDialog}
        onClose={() => setBulkDialog(false)}
        maxWidth="md"
        fullWidth
      >
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
          <Button onClick={() => setBulkDialog(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleBulkImport}
            variant="contained"
            startIcon={<UploadIcon />}
          >
            {t('common.import')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirm Dialog */}
      <Dialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}
      >
        <DialogTitle>{confirmDialog.title}</DialogTitle>
        <DialogContent>
          <Typography>{confirmDialog.message}</Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() =>
              setConfirmDialog((prev) => ({ ...prev, open: false }))
            }
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
        </DialogActions>
      </Dialog>

      {/* Import Dialog */}
      <ImportDialog
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        title={t('common.import')}
        onImport={async (data) => {
          let successCount = 0;
          let failCount = 0;
          for (const item of data) {
            try {
              await IpWhitelistService.createIpWhitelist({
                ipAddress:
                  item[t('ipWhitelist.ipAddress')] || item.ipAddress || '',
                purpose: item[t('ipWhitelist.purpose')] || item.purpose || '',
                isEnabled: true,
              });
              successCount++;
            } catch (err) {
              failCount++;
            }
          }
          if (successCount > 0) {
            enqueueSnackbar(t('common.importSuccess'), { variant: 'success' });
            loadIpWhitelists();
          }
          if (failCount > 0) {
            enqueueSnackbar(t('common.importFailed'), { variant: 'error' });
          }
        }}
      />
    </>
  );
};

export default IpWhitelistTab;
