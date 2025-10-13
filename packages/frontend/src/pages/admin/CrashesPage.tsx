import React, { useState, useEffect } from 'react';
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
  MenuItem,
  Chip,
  Button,
  FormControl,
  InputLabel,
  Select,
  Alert,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  Menu,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Paper,
} from '@mui/material';
import {
  Search as SearchIcon,
  MoreVert as MoreVertIcon,
  BugReport as BugReportIcon,
  Visibility as VisibilityIcon,
  Close as CloseIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  GetApp as GetAppIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useSearchParams } from 'react-router-dom';
import dayjs, { Dayjs } from 'dayjs';

// Types and Services
import {
  ClientCrash,
  CrashFilters,
  GetCrashesRequest,
  CrashState,
  Platform,
  Branch,
  MarketType,
  ServerGroup,
  getPlatformName,
  getBranchName,
  getStateName,
  getVersionString,
} from '@/types/crash';
import crashService from '@/services/crashService';
import SimplePagination from '../../components/common/SimplePagination';
import DateRangePicker, { DateRangePreset } from '../../components/common/DateRangePicker';
import DynamicFilterBar, { FilterDefinition, ActiveFilter } from '../../components/common/DynamicFilterBar';
import EmptyTableRow from '../../components/common/EmptyTableRow';

const CrashesPage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [searchParams, setSearchParams] = useSearchParams();

  // State
  const [crashes, setCrashes] = useState<ClientCrash[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(0);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [filters, setFilters] = useState<CrashFilters>({});
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);

  // Date filters
  const [dateFrom, setDateFrom] = useState<Dayjs | null>(null);
  const [dateTo, setDateTo] = useState<Dayjs | null>(null);
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>('last7d');

  // Sort
  const [sortBy, setSortBy] = useState<'lastCrash' | 'count' | 'createdAt'>('lastCrash');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  const [versionInput, setVersionInput] = useState('');
  const [debouncedVersionInput, setDebouncedVersionInput] = useState('');

  // Menu state
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedCrash, setSelectedCrash] = useState<ClientCrash | null>(null);

  // Define available filters
  const availableFilterDefinitions: FilterDefinition[] = [
    {
      key: 'platform',
      label: t('crashes.platform'),
      type: 'multiselect',
      options: [
        { value: Platform.WINDOWS, label: getPlatformName(Platform.WINDOWS) },
        { value: Platform.MAC, label: getPlatformName(Platform.MAC) },
        { value: Platform.LINUX, label: getPlatformName(Platform.LINUX) },
      ],
    },
    {
      key: 'branch',
      label: t('crashes.branch'),
      type: 'multiselect',
      options: [
        { value: Branch.PRODUCTION, label: getBranchName(Branch.PRODUCTION) },
        { value: Branch.STAGING, label: getBranchName(Branch.STAGING) },
        { value: Branch.DEVELOPMENT, label: getBranchName(Branch.DEVELOPMENT) },
        { value: Branch.EDITOR, label: getBranchName(Branch.EDITOR) },
      ],
    },
    {
      key: 'state',
      label: t('crashes.state'),
      type: 'multiselect',
      options: [
        { value: CrashState.OPEN, label: getStateName(CrashState.OPEN) },
        { value: CrashState.CLOSED, label: getStateName(CrashState.CLOSED) },
        { value: CrashState.DELETED, label: getStateName(CrashState.DELETED) },
      ],
    },
    {
      key: 'version',
      label: t('crashes.version'),
      type: 'text',
      placeholder: 'e.g., 1.2.3.4',
    },
  ];

  // Load crashes
  const loadCrashes = async () => {
    try {
      // Only show loading indicator if there's no data yet
      if (crashes.length === 0) {
        setLoading(true);
      }

      // Clean filters to remove any invalid values (NaN, empty arrays, etc.)
      const cleanedFilters: any = {};
      Object.entries(filters).forEach(([key, value]) => {
        // Skip undefined, null, empty string, NaN, and empty arrays
        if (value !== undefined &&
            value !== null &&
            value !== '' &&
            !Number.isNaN(value) &&
            !(Array.isArray(value) && value.length === 0)) {
          cleanedFilters[key] = value;
        }
      });

      const params: GetCrashesRequest & { sortBy?: string; sortOrder?: 'ASC' | 'DESC' } = {
        page: page + 1, // Backend uses 1-based pagination
        limit: rowsPerPage,
        search: debouncedSearchTerm || undefined,
        dateFrom: dateFrom?.toISOString(),
        dateTo: dateTo?.toISOString(),
        sortBy,
        sortOrder,
        ...cleanedFilters,
      };

      const response = await crashService.getCrashes(params);
      setCrashes(response.data);
      setTotal(response.total);
    } catch (error) {
      console.error('Error loading crashes:', error);
      enqueueSnackbar(t('crashes.loadError'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Initialize from URL parameters on mount
  useEffect(() => {
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');
    const presetParam = searchParams.get('preset') as DateRangePreset;
    const searchParam = searchParams.get('search');
    const platformParam = searchParams.get('platform');
    const branchParam = searchParams.get('branch');
    const stateParam = searchParams.get('state');
    const versionParam = searchParams.get('version');

    // Initialize date range
    if (fromParam && toParam) {
      setDateFrom(dayjs(fromParam));
      setDateTo(dayjs(toParam));
      if (presetParam) {
        setDateRangePreset(presetParam);
      }
    } else {
      // Default to last 7 days
      const now = dayjs();
      setDateFrom(now.subtract(7, 'day'));
      setDateTo(now);
      setDateRangePreset('last7d');
    }

    // Initialize search
    if (searchParam) {
      setSearchTerm(searchParam);
    }

    // Initialize filters
    const newFilters: CrashFilters = {};
    const newActiveFilters: ActiveFilter[] = [];

    if (platformParam) {
      const platformValue = Number(platformParam);
      // Only add if it's a valid number (not NaN)
      if (Number.isFinite(platformValue)) {
        newFilters.platform = platformValue as Platform;
        newActiveFilters.push({
          key: 'platform',
          value: newFilters.platform,
          label: t('crashes.platform'),
        });
      }
    }

    if (branchParam) {
      const branchValue = Number(branchParam);
      // Only add if it's a valid number (not NaN)
      if (Number.isFinite(branchValue)) {
        newFilters.branch = branchValue as Branch;
        newActiveFilters.push({
          key: 'branch',
          value: newFilters.branch,
          label: t('crashes.branch'),
        });
      }
    }

    if (stateParam) {
      const stateValue = Number(stateParam);
      // Only add if it's a valid number (not NaN)
      if (Number.isFinite(stateValue)) {
        newFilters.state = stateValue as CrashState;
        newActiveFilters.push({
          key: 'state',
          value: newFilters.state,
          label: t('crashes.state'),
        });
      }
    }

    if (versionParam) {
      setVersionInput(versionParam);
      const parts = versionParam.split('.').map(p => p.trim()).filter(Boolean);
      const nums = parts.map(p => {
        const n = Number(p);
        return Number.isFinite(n) ? n : undefined;
      });
      newFilters.majorVer = nums[0];
      newFilters.minorVer = nums[1];
      newFilters.buildNum = nums[2];
      newFilters.patchNum = nums[3];
      newActiveFilters.push({
        key: 'version',
        value: versionParam,
        label: t('crashes.version'),
      });
    }

    setFilters(newFilters);
    setActiveFilters(newActiveFilters);
  }, []); // Run only on mount

  // Sync state to URL parameters
  useEffect(() => {
    const params = new URLSearchParams();

    if (dateFrom) params.set('from', dateFrom.format('YYYY-MM-DD'));
    if (dateTo) params.set('to', dateTo.format('YYYY-MM-DD'));
    if (dateRangePreset) params.set('preset', dateRangePreset);
    if (searchTerm) params.set('search', searchTerm);
    if (filters.platform !== undefined) params.set('platform', String(filters.platform));
    if (filters.branch !== undefined) params.set('branch', String(filters.branch));
    if (filters.state !== undefined) params.set('state', String(filters.state));
    if (versionInput) params.set('version', versionInput);

    setSearchParams(params, { replace: true });
  }, [dateFrom, dateTo, dateRangePreset, searchTerm, filters, versionInput]);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500); // 500ms delay

    return () => {
      clearTimeout(timer);
    };
  }, [searchTerm]);

  // Debounce version input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedVersionInput(versionInput);
    }, 500); // 500ms delay

    return () => {
      clearTimeout(timer);
    };
  }, [versionInput]);

  // Update version filters when debounced version input changes
  useEffect(() => {
    if (debouncedVersionInput === '') {
      // Clear version filters
      setFilters(prev => ({
        ...prev,
        majorVer: undefined,
        minorVer: undefined,
        buildNum: undefined,
        patchNum: undefined,
      }));
    } else {
      // Parse and set version filters
      const parts = debouncedVersionInput.split('.').map(p => p.trim()).filter(Boolean);
      const nums = parts.map(p => {
        const n = Number(p);
        return Number.isFinite(n) ? n : undefined;
      });
      setFilters(prev => ({
        ...prev,
        majorVer: nums[0],
        minorVer: nums[1],
        buildNum: nums[2],
        patchNum: nums[3],
      }));
    }
  }, [debouncedVersionInput]);

  // Effects
  useEffect(() => {
    // Only load if date range is initialized
    if (dateFrom && dateTo) {
      loadCrashes();
    }
  }, [page, rowsPerPage, debouncedSearchTerm, filters, dateFrom, dateTo, sortBy, sortOrder]);

  // Handlers
  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
    setPage(0);
  };

  const handleFilterChange = (key: keyof CrashFilters, value: any) => {
    // Handle array values (multiselect filters)
    let processedValue = value;
    if (Array.isArray(value)) {
      // If empty array, set to undefined
      processedValue = value.length > 0 ? value : undefined;
    } else {
      // For non-array values, set to undefined if falsy
      processedValue = value || undefined;
    }

    setFilters(prev => ({
      ...prev,
      [key]: processedValue,
    }));
    setPage(0);
  };

  const updateVersionFilters = (text: string) => {
    // Only update the input value, debouncing will handle the filter update
    setVersionInput(text);
  };

  const handleDateRangeChange = (from: Dayjs | null, to: Dayjs | null, preset: DateRangePreset) => {
    setDateFrom(from);
    setDateTo(to);
    setDateRangePreset(preset);
    setPage(0);
  };

  const handleClearFilters = () => {
    setFilters({});
    setActiveFilters([]);
    const now = dayjs();
    setDateFrom(now.subtract(7, 'day'));
    setDateTo(now);
    setSearchTerm('');
    setVersionInput('');
    setDateRangePreset('last7d');
    setPage(0);
  };

  // Dynamic filter handlers
  const handleFilterAdd = (filter: ActiveFilter) => {
    setActiveFilters(prev => [...prev, filter]);
  };

  const handleFilterRemove = (filterKey: string) => {
    setActiveFilters(prev => prev.filter(f => f.key !== filterKey));

    // Clear the corresponding filter value
    if (filterKey === 'version') {
      setVersionInput('');
      setFilters(prev => ({
        ...prev,
        majorVer: undefined,
        minorVer: undefined,
        buildNum: undefined,
        patchNum: undefined,
      }));
    } else {
      setFilters(prev => ({
        ...prev,
        [filterKey]: undefined,
      }));
    }
    setPage(0);
  };

  const handleDynamicFilterChange = (filterKey: string, value: any) => {
    setActiveFilters(prev =>
      prev.map(f => (f.key === filterKey ? { ...f, value } : f))
    );

    if (filterKey === 'version') {
      updateVersionFilters(value);
    } else {
      handleFilterChange(filterKey as keyof CrashFilters, value);
    }
  };

  const handleOperatorChange = (filterKey: string, operator: 'any_of' | 'include_all') => {
    setActiveFilters(prev =>
      prev.map(f => (f.key === filterKey ? { ...f, operator } : f))
    );
  };

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>, crash: ClientCrash) => {
    setAnchorEl(event.currentTarget);
    setSelectedCrash(crash);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedCrash(null);
  };

  const handleUpdateCrashState = async (crashId: number, newState: CrashState) => {
    try {
      await crashService.updateCrashState(crashId, { state: newState });
      enqueueSnackbar(t('crashes.updateState.success'), { variant: 'success' });
      loadCrashes(); // Reload data
    } catch (error) {
      console.error('Error updating crash state:', error);
      enqueueSnackbar(t('crashes.updateState.error'), { variant: 'error' });
    }
    handleMenuClose();
  };

  const getStateChipColor = (state: CrashState) => {
    switch (state) {
      case CrashState.OPEN: return 'error';
      case CrashState.CLOSED: return 'success';
      case CrashState.DELETED: return 'default';
      default: return 'default';
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <BugReportIcon sx={{ fontSize: 32, color: 'primary.main' }} />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {t('crashes.title')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('crashes.subtitle')}
            </Typography>
          </Box>
        </Box>
      </Box>


      {/* Search and Filters - Single Row */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Date Range Picker */}
            <DateRangePicker
              dateFrom={dateFrom}
              dateTo={dateTo}
              onChange={handleDateRangeChange}
              preset={dateRangePreset}
              availablePresets={['today', 'yesterday', 'last7d', 'last30d', 'custom']}
              size="small"
              showTime={true}
            />

            {/* Search */}
            <TextField
              placeholder={t('crashes.searchPlaceholder')}
              value={searchTerm}
              onChange={handleSearchChange}
              sx={{
                minWidth: 200,
                flexGrow: 1,
                maxWidth: 320,
                '& .MuiOutlinedInput-root': {
                  height: '40px',
                  borderRadius: '20px',
                  bgcolor: 'background.paper',
                  transition: 'all 0.2s ease-in-out',
                  '& fieldset': {
                    borderColor: 'divider',
                  },
                  '&:hover': {
                    bgcolor: 'action.hover',
                    '& fieldset': {
                      borderColor: 'primary.light',
                    }
                  },
                  '&.Mui-focused': {
                    bgcolor: 'background.paper',
                    boxShadow: '0 0 0 2px rgba(25, 118, 210, 0.1)',
                    '& fieldset': {
                      borderColor: 'primary.main',
                      borderWidth: '1px',
                    }
                  }
                },
                '& .MuiInputBase-input': {
                  fontSize: '0.875rem',
                }
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

            {/* Dynamic Filter Bar */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
              <DynamicFilterBar
                availableFilters={availableFilterDefinitions}
                activeFilters={activeFilters}
                onFilterAdd={handleFilterAdd}
                onFilterRemove={handleFilterRemove}
                onFilterChange={handleDynamicFilterChange}
                onOperatorChange={handleOperatorChange}
              />
            </Box>
          </Box>
        </CardContent>
      </Card>


      {/* Crashes Table */}
      <Card>
        <CardContent sx={{ p: 0 }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t('crashes.columns.id')}</TableCell>
                  <TableCell>{t('crashes.columns.firstLine')}</TableCell>
                  <TableCell align="center">{t('crashes.columns.count')}</TableCell>
                  <TableCell align="center">{t('crashes.columns.state')}</TableCell>
                  <TableCell>{t('crashes.columns.platform')}</TableCell>
                  <TableCell>{t('crashes.columns.branch')}</TableCell>
                  <TableCell>{t('crashes.columns.firstCrash')}</TableCell>
                  <TableCell>{t('crashes.columns.lastCrash')}</TableCell>
                  <TableCell>{t('crashes.columns.firstVersion')}</TableCell>
                  <TableCell>{t('crashes.columns.lastVersion')}</TableCell>
                  <TableCell align="center">{t('crashes.columns.actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {crashes.length === 0 ? (
                  <EmptyTableRow
                    colSpan={11}
                    loading={loading}
                    message={t('crashes.noResults')}
                    loadingMessage={t('common.loadingData')}
                  />
                ) : (
                  crashes.map((crash) => (
                    <TableRow key={crash.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace">
                          #{crash.id}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Tooltip title={crash.firstLine} arrow>
                          <Typography
                            variant="body2"
                            sx={{
                              maxWidth: 300,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {crash.firstLine}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={crash.count}
                          size="small"
                          color={crash.count > 10 ? 'error' : crash.count > 5 ? 'warning' : 'default'}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={t(`crashes.states.${getStateName(crash.state).toLowerCase()}`)}
                          size="small"
                          color={getStateChipColor(crash.state)}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {getPlatformName(crash.platform as Platform)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {getBranchName(crash.branch as Branch)}
                        </Typography>
                      </TableCell>
                      {/* First Crash */}
                      <TableCell>
                        <Typography variant="body2">
                          {dayjs(crash.createdAt).format('YYYY-MM-DD HH:mm')}
                        </Typography>
                      </TableCell>

                      {/* Last Crash */}
                      <TableCell>
                        <Typography variant="body2">
                          {dayjs(crash.lastCrash).format('YYYY-MM-DD HH:mm')}
                        </Typography>
                      </TableCell>

                      {/* First/Last Version */}
                      <TableCell>
                        <Typography variant="body2">
                          {crash.firstVersion ?? '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {crash.lastVersion ?? '-'}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <IconButton
                          size="small"
                          onClick={(e) => handleMenuClick(e, crash)}
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

          {/* Pagination */}
          <SimplePagination
            count={total}
            page={page}
            rowsPerPage={rowsPerPage}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage as any}
            rowsPerPageOptions={[5, 10, 25, 50, 100]}
          />
        </CardContent>
      </Card>

      {/* Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <MenuItem onClick={() => console.log('View details', selectedCrash?.id)}>
          <ListItemIcon>
            <VisibilityIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('crashes.actions.viewDetails')}</ListItemText>
        </MenuItem>

        {selectedCrash?.state === CrashState.OPEN && (
          <MenuItem onClick={() => handleUpdateCrashState(selectedCrash.id, CrashState.CLOSED)}>
            <ListItemIcon>
              <CloseIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t('crashes.actions.markClosed')}</ListItemText>
          </MenuItem>
        )}

        {selectedCrash?.state === CrashState.CLOSED && (
          <MenuItem onClick={() => handleUpdateCrashState(selectedCrash.id, CrashState.OPEN)}>
            <ListItemIcon>
              <BugReportIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t('crashes.actions.markOpen')}</ListItemText>
          </MenuItem>
        )}

        {selectedCrash?.state !== CrashState.DELETED && (
          <MenuItem onClick={() => handleUpdateCrashState(selectedCrash.id, CrashState.DELETED)}>
            <ListItemIcon>
              <CloseIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t('crashes.actions.markDeleted')}</ListItemText>
          </MenuItem>
        )}
      </Menu>
    </Box>
  );
};

export default CrashesPage;
