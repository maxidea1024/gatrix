import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
  IconButton,
  Chip,
  Tooltip,
  Alert,
  CircularProgress,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  CheckCircle as ResolveIcon,
  Delete as DeleteIcon,
  HelpOutline as UnknownIcon,
  MoreVert as MoreVertIcon,
  Undo as UndoIcon,
  ContentCopy as CopyIcon,
  ViewColumn as ViewColumnIcon,
  AddCircleOutline as CreateFlagIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useEnvironment } from '../../contexts/EnvironmentContext';
import { useOrgProject } from '../../contexts/OrgProjectContext';
import {
  unknownFlagService,
  UnknownFlag,
} from '../../services/unknownFlagService';
import RelativeTime from '../../components/common/RelativeTime';
import DynamicFilterBar, {
  FilterDefinition,
  ActiveFilter,
} from '../../components/common/DynamicFilterBar';
import ColumnSettingsDialog, {
  ColumnConfig,
} from '../../components/common/ColumnSettingsDialog';
import HelpTip from '../../components/common/HelpTip';
import { copyToClipboardWithNotification } from '../../utils/clipboard';
import { useDebounce } from '../../hooks/useDebounce';
import PageContentLoader from '@/components/common/PageContentLoader';
import EmptyPagePlaceholder from '@/components/common/EmptyPagePlaceholder';
import SearchTextField from '@/components/common/SearchTextField';
import SimplePagination from '../../components/common/SimplePagination';

const UnknownFlagsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { currentEnvironmentId } = useEnvironment();
  const { enqueueSnackbar } = useSnackbar();
  const { getProjectApiPath } = useOrgProject();
  const projectApiPath = getProjectApiPath();
  const navigate = useNavigate();

  const [flags, setFlags] = useState<UnknownFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Menu state
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedFlag, setSelectedFlag] = useState<UnknownFlag | null>(null);

  // Dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    type: 'resolve' | 'unresolve' | 'delete';
    flag: UnknownFlag | null;
  }>({ open: false, type: 'resolve', flag: null });

  // Column settings state
  const [columnSettingsAnchor, setColumnSettingsAnchor] =
    useState<null | HTMLElement>(null);
  const defaultColumns: ColumnConfig[] = [
    { id: 'flagName', labelKey: 'featureFlags.flagName', visible: true },
    { id: 'environment', labelKey: 'common.environment', visible: true },
    { id: 'project', labelKey: 'common.project', visible: true },
    { id: 'organisation', labelKey: 'common.organisation', visible: true },
    { id: 'appName', labelKey: 'featureFlags.appName', visible: true },
    { id: 'sdkVersion', labelKey: 'featureFlags.sdkVersion', visible: true },
    { id: 'accessCount', labelKey: 'featureFlags.accessCount', visible: true },
    {
      id: 'lastReportedAt',
      labelKey: 'featureFlags.lastReported',
      visible: true,
    },
    { id: 'status', labelKey: 'common.status', visible: true },
  ];
  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    const saved = localStorage.getItem('unknownFlagsColumns');
    if (saved) {
      try {
        const savedColumns = JSON.parse(saved);
        const mergedColumns = savedColumns.map((savedCol: ColumnConfig) => {
          const defaultCol = defaultColumns.find((c) => c.id === savedCol.id);
          return defaultCol ? { ...defaultCol, ...savedCol } : savedCol;
        });
        const savedIds = new Set(savedColumns.map((c: ColumnConfig) => c.id));
        const newColumns = defaultColumns.filter((c) => !savedIds.has(c.id));
        return [...mergedColumns, ...newColumns];
      } catch {
        return defaultColumns;
      }
    }
    return defaultColumns;
  });

  // Extract filter values
  const statusFilter = useMemo(() => {
    const filter = activeFilters.find((f) => f.key === 'status');
    return filter?.value as string[] | undefined;
  }, [activeFilters]);

  const environmentFilter = useMemo(() => {
    const filter = activeFilters.find((f) => f.key === 'environment');
    return filter?.value as string[] | undefined;
  }, [activeFilters]);

  const projectFilter = useMemo(() => {
    const filter = activeFilters.find((f) => f.key === 'project');
    return filter?.value as string[] | undefined;
  }, [activeFilters]);

  const organisationFilter = useMemo(() => {
    const filter = activeFilters.find((f) => f.key === 'organisation');
    return filter?.value as string[] | undefined;
  }, [activeFilters]);

  const appNameFilter = useMemo(() => {
    const filter = activeFilters.find((f) => f.key === 'appName');
    return filter?.value as string[] | undefined;
  }, [activeFilters]);

  const sdkVersionFilter = useMemo(() => {
    const filter = activeFilters.find((f) => f.key === 'sdkVersion');
    return filter?.value as string[] | undefined;
  }, [activeFilters]);

  // Build dynamic options from loaded flags data
  const environmentOptions = useMemo(() => {
    const unique = new Map<string, string>();
    for (const f of flags) {
      const key = f.environmentId;
      if (key && !unique.has(key)) {
        unique.set(key, f.environmentName || f.environmentId);
      }
    }
    return Array.from(unique.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [flags]);

  const projectOptions = useMemo(() => {
    const unique = new Set<string>();
    for (const f of flags) {
      if (f.projectName) unique.add(f.projectName);
    }
    return Array.from(unique)
      .sort()
      .map((v) => ({ value: v, label: v }));
  }, [flags]);

  const organisationOptions = useMemo(() => {
    const unique = new Set<string>();
    for (const f of flags) {
      if (f.orgName) unique.add(f.orgName);
    }
    return Array.from(unique)
      .sort()
      .map((v) => ({ value: v, label: v }));
  }, [flags]);

  const appNameOptions = useMemo(() => {
    const unique = new Set<string>();
    for (const f of flags) {
      if (f.appName) unique.add(f.appName);
    }
    return Array.from(unique)
      .sort()
      .map((v) => ({ value: v, label: v }));
  }, [flags]);

  const sdkVersionOptions = useMemo(() => {
    const unique = new Set<string>();
    for (const f of flags) {
      if (f.sdkVersion) unique.add(f.sdkVersion);
    }
    return Array.from(unique)
      .sort()
      .map((v) => ({ value: v, label: v }));
  }, [flags]);

  // Filter definitions
  const filterDefinitions: FilterDefinition[] = useMemo(
    () => [
      {
        key: 'status',
        label: t('common.status'),
        type: 'multiselect',
        options: [
          {
            value: 'unresolved',
            label: t('featureFlags.unresolved'),
            icon: (
              <Chip
                size="small"
                color="warning"
                label=""
                sx={{ width: 16, height: 16, p: 0 }}
              />
            ),
          },
          {
            value: 'resolved',
            label: t('featureFlags.resolved'),
            icon: (
              <Chip
                size="small"
                color="success"
                label=""
                sx={{ width: 16, height: 16, p: 0 }}
              />
            ),
          },
        ],
      },
      {
        key: 'environment',
        label: t('common.environment'),
        type: 'multiselect',
        options: environmentOptions,
      },
      {
        key: 'project',
        label: t('common.project'),
        type: 'multiselect',
        options: projectOptions,
      },
      {
        key: 'organisation',
        label: t('common.organisation'),
        type: 'multiselect',
        options: organisationOptions,
      },
      {
        key: 'appName',
        label: t('featureFlags.appName'),
        type: 'multiselect',
        options: appNameOptions,
      },
      {
        key: 'sdkVersion',
        label: t('featureFlags.sdkVersion'),
        type: 'multiselect',
        options: sdkVersionOptions,
      },
    ],
    [
      t,
      environmentOptions,
      projectOptions,
      organisationOptions,
      appNameOptions,
      sdkVersionOptions,
    ]
  );

  const loadFlags = useCallback(async () => {
    setLoading(true);
    try {
      // Determine includeResolved based on filter
      const includeResolved =
        statusFilter?.includes('resolved') ||
        statusFilter?.length === 2 ||
        !statusFilter;
      const result = await unknownFlagService.getUnknownFlags(
        {
          includeResolved,
          environmentId: currentEnvironmentId || undefined,
        },
        projectApiPath
      );
      setFlags(result.flags);
    } catch {
      enqueueSnackbar(String(t('common.loadError')), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, currentEnvironmentId, enqueueSnackbar, t]);

  useEffect(() => {
    loadFlags();
  }, [loadFlags]);

  // Handle filter changes
  const handleFilterChange = useCallback((key: string, value: any) => {
    setActiveFilters((prev) => {
      const existing = prev.find((f) => f.key === key);
      if (existing) {
        if (
          value === undefined ||
          value === null ||
          (Array.isArray(value) && value.length === 0)
        ) {
          return prev.filter((f) => f.key !== key);
        }
        return prev.map((f) => (f.key === key ? { ...f, value } : f));
      }
      if (
        value === undefined ||
        value === null ||
        (Array.isArray(value) && value.length === 0)
      ) {
        return prev;
      }
      return [...prev, { key, value, label: key }];
    });
  }, []);

  const handleRemoveFilter = useCallback((key: string) => {
    setActiveFilters((prev) => prev.filter((f) => f.key !== key));
  }, []);

  const handleFilterAdd = useCallback((filter: ActiveFilter) => {
    setActiveFilters((prev) => {
      const exists = prev.find((f) => f.key === filter.key);
      if (exists) {
        return prev;
      }
      return [...prev, filter];
    });
  }, []);

  const handleClearFilters = useCallback(() => {
    setActiveFilters([]);
    setSearchTerm('');
  }, []);

  // Column settings handlers
  const handleColumnsChange = useCallback((newColumns: ColumnConfig[]) => {
    setColumns(newColumns);
    localStorage.setItem('unknownFlagsColumns', JSON.stringify(newColumns));
  }, []);

  // Filter flags based on search and all active filters
  const filteredFlags = useMemo(() => {
    let result = flags;

    // Apply search
    if (debouncedSearchTerm) {
      const lower = debouncedSearchTerm.toLowerCase();
      result = result.filter(
        (f) =>
          f.flagName.toLowerCase().includes(lower) ||
          f.appName?.toLowerCase().includes(lower)
      );
    }

    // Apply status filter
    if (statusFilter && statusFilter.length > 0 && statusFilter.length < 2) {
      if (statusFilter.includes('resolved')) {
        result = result.filter((f) => f.isResolved);
      } else if (statusFilter.includes('unresolved')) {
        result = result.filter((f) => !f.isResolved);
      }
    }

    // Apply environment filter
    if (environmentFilter && environmentFilter.length > 0) {
      result = result.filter((f) =>
        environmentFilter.includes(f.environmentId)
      );
    }

    // Apply project filter
    if (projectFilter && projectFilter.length > 0) {
      result = result.filter(
        (f) => f.projectName && projectFilter.includes(f.projectName)
      );
    }

    // Apply organisation filter
    if (organisationFilter && organisationFilter.length > 0) {
      result = result.filter(
        (f) => f.orgName && organisationFilter.includes(f.orgName)
      );
    }

    // Apply app name filter
    if (appNameFilter && appNameFilter.length > 0) {
      result = result.filter(
        (f) => f.appName && appNameFilter.includes(f.appName)
      );
    }

    // Apply SDK version filter
    if (sdkVersionFilter && sdkVersionFilter.length > 0) {
      result = result.filter(
        (f) => f.sdkVersion && sdkVersionFilter.includes(f.sdkVersion)
      );
    }

    return result;
  }, [
    flags,
    debouncedSearchTerm,
    statusFilter,
    environmentFilter,
    projectFilter,
    organisationFilter,
    appNameFilter,
    sdkVersionFilter,
  ]);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [
    debouncedSearchTerm,
    statusFilter,
    environmentFilter,
    projectFilter,
    organisationFilter,
    appNameFilter,
    sdkVersionFilter,
  ]);

  // Client-side pagination
  const paginatedFlags = useMemo(() => {
    const start = page * rowsPerPage;
    return filteredFlags.slice(start, start + rowsPerPage);
  }, [filteredFlags, page, rowsPerPage]);

  const handleMenuOpen = (
    event: React.MouseEvent<HTMLElement>,
    flag: UnknownFlag
  ) => {
    setMenuAnchorEl(event.currentTarget);
    setSelectedFlag(flag);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setSelectedFlag(null);
  };

  const handleOpenConfirmDialog = (
    type: 'resolve' | 'unresolve' | 'delete'
  ) => {
    setConfirmDialog({ open: true, type, flag: selectedFlag });
    handleMenuClose();
  };

  const handleCloseConfirmDialog = () => {
    setConfirmDialog({ open: false, type: 'resolve', flag: null });
  };

  const handleConfirmAction = async () => {
    if (!confirmDialog.flag) return;

    try {
      switch (confirmDialog.type) {
        case 'resolve':
          await unknownFlagService.resolveUnknownFlag(
            confirmDialog.flag.id,
            projectApiPath
          );
          enqueueSnackbar(t('featureFlags.resolvedSuccessfully'), {
            variant: 'success',
          });
          break;
        case 'unresolve':
          await unknownFlagService.unresolveUnknownFlag(
            confirmDialog.flag.id,
            projectApiPath
          );
          enqueueSnackbar(t('featureFlags.unresolvedSuccessfully'), {
            variant: 'success',
          });
          break;
        case 'delete':
          await unknownFlagService.deleteUnknownFlag(
            confirmDialog.flag.id,
            projectApiPath
          );
          enqueueSnackbar(t('common.deleted'), { variant: 'success' });
          break;
      }
      loadFlags();
    } catch {
      enqueueSnackbar(t('common.error'), { variant: 'error' });
    } finally {
      handleCloseConfirmDialog();
    }
  };

  const getDialogContent = () => {
    if (!confirmDialog.flag) return { title: '', message: '' };
    const flagName = confirmDialog.flag.flagName;

    switch (confirmDialog.type) {
      case 'resolve':
        return {
          title: t('featureFlags.confirmResolve'),
          message: t('featureFlags.confirmResolveMessage', { flagName }),
        };
      case 'unresolve':
        return {
          title: t('featureFlags.confirmUnresolve'),
          message: t('featureFlags.confirmUnresolveMessage', { flagName }),
        };
      case 'delete':
        return {
          title: t('common.confirmDelete'),
          message: t('featureFlags.confirmDeleteMessage', { flagName }),
        };
    }
  };

  const visibleColumns = columns.filter((c) => c.visible);
  const dialogContent = getDialogContent();

  const handleCopyFlagName = (flagName: string) => {
    copyToClipboardWithNotification(
      flagName,
      () =>
        enqueueSnackbar(t('common.copiedToClipboard'), { variant: 'success' }),
      () => enqueueSnackbar(t('common.copyFailed'), { variant: 'error' })
    );
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
        }}
      >
        <Box>
          <Typography
            variant="h5"
            fontWeight={600}
            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
          >
            <UnknownIcon color="warning" />
            {t('featureFlags.unknownFlags')} ({filteredFlags.length})
            <HelpTip title={t('featureFlags.unknownFlagsInfo')}>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {t('featureFlags.unknownFlagsTypes')}
              </Typography>
              <ul>
                <li>{t('featureFlags.unknownFlagsMissing')}</li>
                <li>{t('featureFlags.unknownFlagsInvalid')}</li>
              </ul>
            </HelpTip>
          </Typography>
          <Typography color="text.secondary" variant="body2">
            {t('featureFlags.unknownFlagsDescription')}
          </Typography>
        </Box>
      </Box>

      {/* Search and Filters */}
      <Box sx={{ mb: 2 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            flexWrap: 'nowrap',
            justifyContent: 'space-between',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              gap: 2,
              alignItems: 'center',
              flexWrap: 'nowrap',
              flexGrow: 1,
              minWidth: 0,
            }}
          >
            <SearchTextField
              placeholder={t('featureFlags.searchUnknownFlags')}
              value={searchTerm}
              onChange={(value) => setSearchTerm(value)}
            />
            <DynamicFilterBar
              availableFilters={filterDefinitions}
              activeFilters={activeFilters}
              onFilterAdd={handleFilterAdd}
              onFilterRemove={handleRemoveFilter}
              onFilterChange={handleFilterChange}
              onRefresh={loadFlags}
              refreshDisabled={loading}
              noWrap={true}
              afterFilterAddActions={
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
              }
            />
          </Box>
        </Box>
      </Box>

      {/* Content */}
      <PageContentLoader loading={loading}>
        {filteredFlags.length === 0 ? (
          <EmptyPagePlaceholder message={t('featureFlags.noUnknownFlags')} />
        ) : (
          <Card variant="outlined">
            <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      {visibleColumns.map((col) => (
                        <TableCell
                          key={col.id}
                          align={
                            col.id === 'accessCount' || col.id === 'status'
                              ? 'center'
                              : 'left'
                          }
                        >
                          {t(col.labelKey)}
                        </TableCell>
                      ))}
                      <TableCell align="center">
                        {t('common.actions')}
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {paginatedFlags.map((flag) => (
                      <TableRow key={flag.id} hover>
                        {visibleColumns.map((col) => {
                          switch (col.id) {
                            case 'flagName':
                              return (
                                <TableCell key={col.id}>
                                  <Box
                                    sx={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 1,
                                    }}
                                  >
                                    <UnknownIcon
                                      fontSize="small"
                                      color="warning"
                                    />
                                    <Typography
                                      fontWeight={500}
                                      sx={{ fontFamily: 'monospace' }}
                                    >
                                      {flag.flagName}
                                    </Typography>
                                    <Tooltip title={t('common.copy')}>
                                      <IconButton
                                        size="small"
                                        onClick={() =>
                                          handleCopyFlagName(flag.flagName)
                                        }
                                        sx={{
                                          opacity: 0.6,
                                          '&:hover': { opacity: 1 },
                                        }}
                                      >
                                        <CopyIcon sx={{ fontSize: 14 }} />
                                      </IconButton>
                                    </Tooltip>
                                  </Box>
                                </TableCell>
                              );
                            case 'environment':
                              return (
                                <TableCell key={col.id}>
                                  <Tooltip title={flag.environmentId}>
                                    <Chip
                                      label={
                                        flag.environmentName ||
                                        flag.environmentId
                                      }
                                      size="small"
                                      sx={{ borderRadius: '16px' }}
                                    />
                                  </Tooltip>
                                </TableCell>
                              );
                            case 'project':
                              return (
                                <TableCell key={col.id}>
                                  <Typography variant="body2">
                                    {flag.projectName || '-'}
                                  </Typography>
                                </TableCell>
                              );
                            case 'organisation':
                              return (
                                <TableCell key={col.id}>
                                  <Typography variant="body2">
                                    {flag.orgName || '-'}
                                  </Typography>
                                </TableCell>
                              );
                            case 'appName':
                              return (
                                <TableCell key={col.id}>
                                  {flag.appName ? (
                                    <Chip
                                      label={flag.appName}
                                      size="small"
                                      variant="outlined"
                                      sx={{ borderRadius: '16px' }}
                                    />
                                  ) : (
                                    <Typography
                                      variant="body2"
                                      color="text.secondary"
                                    >
                                      -
                                    </Typography>
                                  )}
                                </TableCell>
                              );
                            case 'sdkVersion':
                              return (
                                <TableCell key={col.id}>
                                  <Typography
                                    variant="body2"
                                    color="text.secondary"
                                  >
                                    {flag.sdkVersion || '-'}
                                  </Typography>
                                </TableCell>
                              );
                            case 'accessCount':
                              return (
                                <TableCell key={col.id} align="center">
                                  <Typography variant="body2">
                                    {flag.accessCount.toLocaleString()}
                                  </Typography>
                                </TableCell>
                              );
                            case 'lastReportedAt':
                              return (
                                <TableCell key={col.id}>
                                  <RelativeTime date={flag.lastReportedAt} />
                                </TableCell>
                              );
                            case 'status':
                              return (
                                <TableCell key={col.id} align="center">
                                  {flag.isResolved ? (
                                    <Chip
                                      label={t('featureFlags.resolved')}
                                      size="small"
                                      color="success"
                                    />
                                  ) : (
                                    <Chip
                                      label={t('featureFlags.unresolved')}
                                      size="small"
                                      color="warning"
                                    />
                                  )}
                                </TableCell>
                              );
                            default:
                              return <TableCell key={col.id}>-</TableCell>;
                          }
                        })}
                        <TableCell align="center">
                          <IconButton
                            size="small"
                            onClick={(e) => handleMenuOpen(e, flag)}
                          >
                            <MoreVertIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Pagination */}
              <SimplePagination
                page={page}
                rowsPerPage={rowsPerPage}
                count={filteredFlags.length}
                onPageChange={(event, newPage) => setPage(newPage)}
                onRowsPerPageChange={(event) => {
                  setRowsPerPage(Number(event.target.value));
                  setPage(0);
                }}
              />
            </CardContent>
          </Card>
        )}
      </PageContentLoader>

      {/* Action Menu */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
      >
        {selectedFlag && !selectedFlag.isResolved && (
          <MenuItem
            onClick={() => {
              if (selectedFlag) {
                navigate(
                  `/feature-flags?create=${encodeURIComponent(selectedFlag.flagName)}`
                );
              }
              handleMenuClose();
            }}
          >
            <ListItemIcon>
              <CreateFlagIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t('featureFlags.createFlag')}</ListItemText>
          </MenuItem>
        )}
        {selectedFlag && !selectedFlag.isResolved && (
          <MenuItem onClick={() => handleOpenConfirmDialog('resolve')}>
            <ListItemIcon>
              <ResolveIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t('featureFlags.markResolved')}</ListItemText>
          </MenuItem>
        )}
        {selectedFlag && selectedFlag.isResolved && (
          <MenuItem onClick={() => handleOpenConfirmDialog('unresolve')}>
            <ListItemIcon>
              <UndoIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t('featureFlags.markUnresolved')}</ListItemText>
          </MenuItem>
        )}
        <MenuItem onClick={() => handleOpenConfirmDialog('delete')}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('common.delete')}</ListItemText>
        </MenuItem>
      </Menu>

      {/* Column Settings Dialog */}
      <ColumnSettingsDialog
        anchorEl={columnSettingsAnchor}
        columns={columns}
        onColumnsChange={handleColumnsChange}
        onClose={() => setColumnSettingsAnchor(null)}
        onReset={() => handleColumnsChange(defaultColumns)}
      />

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog.open} onClose={handleCloseConfirmDialog}>
        <DialogTitle>{dialogContent.title}</DialogTitle>
        <DialogContent>
          <DialogContentText>{dialogContent.message}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseConfirmDialog}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleConfirmAction}
            color={confirmDialog.type === 'delete' ? 'error' : 'primary'}
            variant="contained"
          >
            {t('common.confirm')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UnknownFlagsPage;
