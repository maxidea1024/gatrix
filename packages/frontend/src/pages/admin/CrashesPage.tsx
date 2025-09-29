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
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
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

const CrashesPage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  // State
  const [crashes, setCrashes] = useState<ClientCrash[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(0);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<CrashFilters>({});

  // Date filters
  const [dateFrom, setDateFrom] = useState<Dayjs | null>(null);
  const [dateTo, setDateTo] = useState<Dayjs | null>(null);
  const [dateRangePreset, setDateRangePreset] = useState<'last15m' | 'last1h' | 'last24h' | 'last7d' | 'last30d' | 'custom'>('last24h');

  // Sort
  const [sortBy, setSortBy] = useState<'lastCrash' | 'count' | 'createdAt'>('lastCrash');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  const [versionInput, setVersionInput] = useState('');

  // Menu state
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedCrash, setSelectedCrash] = useState<ClientCrash | null>(null);

  // Load crashes
  const loadCrashes = async () => {
    try {
      setLoading(true);

      const params: GetCrashesRequest & { sortBy?: string; sortOrder?: 'ASC' | 'DESC' } = {
        page: page + 1, // Backend uses 1-based pagination
        limit: rowsPerPage,
        search: searchTerm || undefined,
        dateFrom: dateFrom?.toISOString(),
        dateTo: dateTo?.toISOString(),
        sortBy,
        sortOrder,
        ...filters,
      };

      const response = await crashService.getCrashes(params);
      setCrashes(response.data);
      setTotal(response.total);
    } catch (error) {
      console.error('Error loading crashes:', error);
      enqueueSnackbar(t('admin.crashes.loadError'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Effects
  useEffect(() => {
    loadCrashes();
  }, [page, rowsPerPage, searchTerm, filters, dateFrom, dateTo, sortBy, sortOrder]);

  // Update date range by preset
  useEffect(() => {
    if (dateRangePreset === 'custom') return;
    const now = dayjs();
    let from = now;
    switch (dateRangePreset) {
      case 'last15m':
        from = now.subtract(15, 'minute');
        break;
      case 'last1h':
        from = now.subtract(1, 'hour');
        break;
      case 'last24h':
        from = now.subtract(24, 'hour');
        break;
      case 'last7d':
        from = now.subtract(7, 'day');
        break;
      case 'last30d':
        from = now.subtract(30, 'day');
        break;
    }
    setDateFrom(from);
    setDateTo(now);
  }, [dateRangePreset]);

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
    setFilters(prev => ({
      ...prev,
      [key]: value || undefined,
    }));
    setPage(0);
  };

  const updateVersionFilters = (text: string) => {
    setVersionInput(text);
    const parts = text.split('.').map(p => p.trim()).filter(Boolean);
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
    setPage(0);
  };

  const handleClearFilters = () => {
    setFilters({});
    setDateFrom(null);
    setDateTo(null);
    setSearchTerm('');
    setVersionInput('');
    setPage(0);
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
      enqueueSnackbar(t('admin.crashes.updateState.success'), { variant: 'success' });
      loadCrashes(); // Reload data
    } catch (error) {
      console.error('Error updating crash state:', error);
      enqueueSnackbar(t('admin.crashes.updateState.error'), { variant: 'error' });
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
      <Typography variant="h4" component="h1" gutterBottom>
        {t('admin.crashes.title')}
      </Typography>

      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        {t('admin.crashes.subtitle')}
      </Typography>

      {/* Search and Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', overflow: 'visible' }}>

            {/* 사용자 닉네임 검색 (왼쪽 첫 번째, 넓게) */}
            <TextField
              placeholder={t('admin.crashes.searchPlaceholder')}
              value={searchTerm}
              onChange={handleSearchChange}
              sx={{ minWidth: 340, width: 420, flexShrink: 0 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
              size="small"
            />

            {/* Date Range Preset */}
            <FormControl size="small" sx={{ minWidth: 160, flexShrink: 0 }}>
              <InputLabel id="crash-date-range-label" shrink>{t('admin.crashes.filters.dateRange')}</InputLabel>
              <Select
                labelId="crash-date-range-label"
                id="crash-date-range"
                value={dateRangePreset}
                label={t('admin.crashes.filters.dateRange')}
                onChange={(e) => setDateRangePreset(e.target.value as any)}
                size="small"
              >
                <MenuItem value="last15m">{t('admin.crashes.filters.presets.last15m')}</MenuItem>
                <MenuItem value="last1h">{t('admin.crashes.filters.presets.last1h')}</MenuItem>
                <MenuItem value="last24h">{t('admin.crashes.filters.presets.last24h')}</MenuItem>
                <MenuItem value="last7d">{t('admin.crashes.filters.presets.last7d')}</MenuItem>
                <MenuItem value="last30d">{t('admin.crashes.filters.presets.last30d')}</MenuItem>
                <MenuItem value="custom">{t('admin.crashes.filters.presets.custom')}</MenuItem>
              </Select>
            </FormControl>

            {/* Custom Date Range (inline) */}
            {dateRangePreset === 'custom' && (
              <>
                <DateTimePicker
                  label={t('admin.crashes.filters.dateFrom')}
                  value={dateFrom}
                  onChange={setDateFrom}
                  slotProps={{ textField: { size: 'small', sx: { minWidth: 220, flexShrink: 0 }, inputProps: { 'aria-label': 'date-from' } } }}
                />
                <DateTimePicker
                  label={t('admin.crashes.filters.dateTo')}
                  value={dateTo}
                  onChange={setDateTo}
                  slotProps={{ textField: { size: 'small', sx: { minWidth: 220, flexShrink: 0 }, inputProps: { 'aria-label': 'date-to' } } }}
                />
                {/* Force wrap after end date so following filters go to next line */}
                <Box sx={{ flexBasis: '100%' }} />
              </>
            )}

            {/* State Filter */}
            <FormControl size="small" sx={{ minWidth: 180, flexShrink: 0 }}>
              <InputLabel id="crash-state-label" shrink>{t('admin.crashes.filters.state')}</InputLabel>
              <Select
                labelId="crash-state-label"
                id="crash-state-select"
                value={filters.state ?? ''}
                onChange={(e) => handleFilterChange('state', e.target.value)}
                label={t('admin.crashes.filters.state')}
                displayEmpty
                size="small"
              >
                <MenuItem value="">{t('admin.crashes.filters.allStates')}</MenuItem>
                <MenuItem value={CrashState.OPEN}>{t('admin.crashes.states.open')}</MenuItem>
                <MenuItem value={CrashState.CLOSED}>{t('admin.crashes.states.closed')}</MenuItem>
                <MenuItem value={CrashState.DELETED}>{t('admin.crashes.states.deleted')}</MenuItem>
              </Select>
            </FormControl>

            {/* Device Type Filter */}
            <FormControl size="small" sx={{ minWidth: 180, flexShrink: 0 }}>
              <InputLabel id="crash-device-label" shrink>{t('admin.crashes.filters.deviceType')}</InputLabel>
              <Select
                labelId="crash-device-label"
                id="crash-device-select"
                value={filters.deviceType ?? ''}
                onChange={(e) => handleFilterChange('deviceType', e.target.value)}
                label={t('admin.crashes.filters.deviceType')}
                displayEmpty
                size="small"
              >
                <MenuItem value="">{t('admin.crashes.filters.allDeviceTypes')}</MenuItem>
                <MenuItem value={Platform.ANDROID}>{t('admin.crashes.platforms.android')}</MenuItem>
                <MenuItem value={Platform.IOS}>{t('admin.crashes.platforms.ios')}</MenuItem>
                <MenuItem value={Platform.WINDOWS}>{t('admin.crashes.platforms.windows')}</MenuItem>
                <MenuItem value={Platform.MAC}>{t('admin.crashes.platforms.mac')}</MenuItem>
                <MenuItem value={Platform.LINUX}>{t('admin.crashes.platforms.linux')}</MenuItem>
                <MenuItem value={Platform.WEB}>{t('admin.crashes.platforms.web')}</MenuItem>
              </Select>
            </FormControl>

            {/* Version Filter */}
            <TextField
              label={t('admin.crashes.filters.version')}
              value={versionInput}
              onChange={(e) => updateVersionFilters(e.target.value)}
              size="small"
              sx={{ minWidth: 160, flexShrink: 0 }}
              inputProps={{ inputMode: 'numeric', 'aria-label': 'version-input' }}
            />

            {/* Branch Filter */}
            <FormControl size="small" sx={{ minWidth: 160, flexShrink: 0 }}>
              <InputLabel id="crash-branch-label" shrink>{t('admin.crashes.filters.branch')}</InputLabel>
              <Select
                labelId="crash-branch-label"
                id="crash-branch-select"
                value={filters.branch ?? ''}
                onChange={(e) => handleFilterChange('branch', e.target.value ? Number(e.target.value) : undefined)}
                label={t('admin.crashes.filters.branch')}
                displayEmpty
                size="small"
              >
                <MenuItem value="">{t('admin.crashes.filters.allBranches')}</MenuItem>
                <MenuItem value={1}>{t('admin.crashes.branches.production')}</MenuItem>
                <MenuItem value={2}>{t('admin.crashes.branches.staging')}</MenuItem>
                <MenuItem value={3}>{t('admin.crashes.branches.development')}</MenuItem>
                <MenuItem value={9}>{t('admin.crashes.branches.editor')}</MenuItem>
              </Select>
            </FormControl>

            {/* Sort Options */}
            <FormControl size="small" sx={{ minWidth: 160, flexShrink: 0 }}>
              <InputLabel id="crash-sortby-label" shrink>{t('admin.crashes.sort.sortBy')}</InputLabel>
              <Select
                labelId="crash-sortby-label"
                id="crash-sortby-select"
                value={sortBy}
                label={t('admin.crashes.sort.sortBy')}
                onChange={(e) => setSortBy(e.target.value as any)}
                size="small"
              >
                <MenuItem value="createdAt">{t('admin.crashes.sort.by.firstCrash')}</MenuItem>
                <MenuItem value="lastCrash">{t('admin.crashes.sort.by.lastCrash')}</MenuItem>
                <MenuItem value="count">{t('admin.crashes.sort.by.count')}</MenuItem>
                <MenuItem value="firstVersion">{t('admin.crashes.sort.by.firstVersion')}</MenuItem>
                <MenuItem value="lastVersion">{t('admin.crashes.sort.by.lastVersion')}</MenuItem>
                <MenuItem value="branch">{t('admin.crashes.sort.by.branch')}</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 140, flexShrink: 0 }}>
              <InputLabel id="crash-sortorder-label" shrink>{t('admin.crashes.sort.sortOrder')}</InputLabel>
              <Select
                labelId="crash-sortorder-label"
                id="crash-sortorder-select"
                value={sortOrder}
                label={t('admin.crashes.sort.sortOrder')}
                onChange={(e) => setSortOrder(e.target.value as any)}
                renderValue={(value) => (value === 'DESC' ? t('common.desc') : t('common.asc'))}
                size="small"
              >
                <MenuItem value="DESC">{t('common.desc')}</MenuItem>
                <MenuItem value="ASC">{t('common.asc')}</MenuItem>
              </Select>
            </FormControl>

            {/* Clear */}
            <Button variant="outlined" onClick={handleClearFilters} size="small" sx={{ flexShrink: 0 }}>
              {t('admin.crashes.filters.clear')}
            </Button>

            {/* Refresh */}
            <IconButton onClick={loadCrashes} sx={{ flexShrink: 0 }}>
              <RefreshIcon />
            </IconButton>
          </Box>

        </CardContent>
      </Card>


      {/* Crashes Table */}
      <Card>
        <CardContent sx={{ p: 0 }}>
          {loading && <LinearProgress />}

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t('admin.crashes.columns.id')}</TableCell>
                  <TableCell>{t('admin.crashes.columns.firstLine')}</TableCell>
                  <TableCell align="center">{t('admin.crashes.columns.count')}</TableCell>
                  <TableCell align="center">{t('admin.crashes.columns.state')}</TableCell>
                  <TableCell>{t('admin.crashes.columns.platform')}</TableCell>
                  <TableCell>{t('admin.crashes.columns.branch')}</TableCell>
                  <TableCell>{t('admin.crashes.columns.firstCrash')}</TableCell>
                  <TableCell>{t('admin.crashes.columns.lastCrash')}</TableCell>
                  <TableCell>{t('admin.crashes.columns.firstVersion')}</TableCell>
                  <TableCell>{t('admin.crashes.columns.lastVersion')}</TableCell>
                  <TableCell align="center">{t('admin.crashes.columns.actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {crashes.length === 0 && !loading ? (
                  <TableRow>
                    <TableCell colSpan={11} align="center" sx={{ py: 4 }}>
                      <Typography variant="body2" color="text.secondary">
                        {t('admin.crashes.noResults')}
                      </Typography>
                    </TableCell>
                  </TableRow>
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
                          label={t(`admin.crashes.states.${getStateName(crash.state).toLowerCase()}`)}
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
          <ListItemText>{t('admin.crashes.actions.viewDetails')}</ListItemText>
        </MenuItem>

        {selectedCrash?.state === CrashState.OPEN && (
          <MenuItem onClick={() => handleUpdateCrashState(selectedCrash.id, CrashState.CLOSED)}>
            <ListItemIcon>
              <CloseIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t('admin.crashes.actions.markClosed')}</ListItemText>
          </MenuItem>
        )}

        {selectedCrash?.state === CrashState.CLOSED && (
          <MenuItem onClick={() => handleUpdateCrashState(selectedCrash.id, CrashState.OPEN)}>
            <ListItemIcon>
              <BugReportIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t('admin.crashes.actions.markOpen')}</ListItemText>
          </MenuItem>
        )}

        {selectedCrash?.state !== CrashState.DELETED && (
          <MenuItem onClick={() => handleUpdateCrashState(selectedCrash.id, CrashState.DELETED)}>
            <ListItemIcon>
              <CloseIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t('admin.crashes.actions.markDeleted')}</ListItemText>
          </MenuItem>
        )}
      </Menu>
    </Box>
  );
};

export default CrashesPage;
