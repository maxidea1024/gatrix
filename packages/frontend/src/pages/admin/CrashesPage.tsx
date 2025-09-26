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
  TablePagination,
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
  Collapse,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Search as SearchIcon,
  MoreVert as MoreVertIcon,
  BugReport as BugReportIcon,
  Visibility as VisibilityIcon,
  Close as CloseIcon,
  Refresh as RefreshIcon,
  FilterList as FilterListIcon,
  ExpandMore as ExpandMoreIcon,
  GetApp as GetAppIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
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
  const [showFilters, setShowFilters] = useState(false);

  // Date filters
  const [dateFrom, setDateFrom] = useState<Dayjs | null>(null);
  const [dateTo, setDateTo] = useState<Dayjs | null>(null);

  // Menu state
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedCrash, setSelectedCrash] = useState<ClientCrash | null>(null);

  // Load crashes
  const loadCrashes = async () => {
    try {
      setLoading(true);

      const params: GetCrashesRequest = {
        page: page + 1, // Backend uses 1-based pagination
        limit: rowsPerPage,
        search: searchTerm || undefined,
        dateFrom: dateFrom?.toISOString(),
        dateTo: dateTo?.toISOString(),
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
  }, [page, rowsPerPage, searchTerm, filters, dateFrom, dateTo]);

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

  const handleClearFilters = () => {
    setFilters({});
    setDateFrom(null);
    setDateTo(null);
    setSearchTerm('');
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
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                placeholder={t('admin.crashes.searchPlaceholder')}
                value={searchTerm}
                onChange={handleSearchChange}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                <Button
                  variant="outlined"
                  startIcon={<FilterListIcon />}
                  onClick={() => setShowFilters(!showFilters)}
                >
                  {t('admin.crashes.filters.title')}
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<RefreshIcon />}
                  onClick={loadCrashes}
                >
                  {t('common.refresh')}
                </Button>
              </Box>
            </Grid>
          </Grid>

          {/* Advanced Filters */}
          <Collapse in={showFilters}>
            <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={3}>
                  <DatePicker
                    label={t('admin.crashes.filters.dateFrom')}
                    value={dateFrom}
                    onChange={setDateFrom}
                    slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <DatePicker
                    label={t('admin.crashes.filters.dateTo')}
                    value={dateTo}
                    onChange={setDateTo}
                    slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                  />
                </Grid>
                <Grid item xs={12} md={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel>{t('admin.crashes.filters.state')}</InputLabel>
                    <Select
                      value={filters.state ?? ''}
                      onChange={(e) => handleFilterChange('state', e.target.value)}
                      label={t('admin.crashes.filters.state')}
                    >
                      <MenuItem value="">{t('admin.crashes.filters.allStates')}</MenuItem>
                      <MenuItem value={CrashState.OPEN}>{t('admin.crashes.states.open')}</MenuItem>
                      <MenuItem value={CrashState.CLOSED}>{t('admin.crashes.states.closed')}</MenuItem>
                      <MenuItem value={CrashState.DELETED}>{t('admin.crashes.states.deleted')}</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel>{t('admin.crashes.filters.deviceType')}</InputLabel>
                    <Select
                      value={filters.deviceType ?? ''}
                      onChange={(e) => handleFilterChange('deviceType', e.target.value)}
                      label={t('admin.crashes.filters.deviceType')}
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
                </Grid>
                <Grid item xs={12} md={2}>
                  <Button
                    variant="outlined"
                    onClick={handleClearFilters}
                    fullWidth
                    size="small"
                  >
                    {t('admin.crashes.filters.clear')}
                  </Button>
                </Grid>
              </Grid>
            </Box>
          </Collapse>
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
                  <TableCell>{t('admin.crashes.columns.lastCrash')}</TableCell>
                  <TableCell align="center">{t('admin.crashes.columns.actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {crashes.length === 0 && !loading ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
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
                      <TableCell>
                        <Typography variant="body2">
                          {dayjs(crash.lastCrash).format('YYYY-MM-DD HH:mm')}
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
          <TablePagination
            component="div"
            count={total}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[5, 10, 25, 50]}
            labelRowsPerPage={t('common.rowsPerPage')}
            labelDisplayedRows={({ from, to, count }) =>
              `${from}-${to} ${t('common.of')} ${count !== -1 ? count : `${t('common.moreThan')} ${to}`}`
            }
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
