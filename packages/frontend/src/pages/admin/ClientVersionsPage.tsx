import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  InputAdornment,
  IconButton,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TableSortLabel,
  Checkbox,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  Fab,
  Collapse,
  Grid,
  FormControl,
  InputLabel,
  Select,
  FormControlLabel,
  Switch,
  LinearProgress,
  Alert,
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  FilterList as FilterIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Clear as ClearIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { 
  ClientVersion, 
  ClientVersionFilters, 
  ClientStatus,
  ClientStatusLabels,
  ClientStatusColors,
  BulkStatusUpdateRequest,
} from '../../types/clientVersion';
import { ClientVersionService } from '../../services/clientVersionService';
import ClientVersionForm from '../../components/admin/ClientVersionForm';
import { formatDateTimeDetailed } from '../../utils/dateFormat';

const ClientVersionsPage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  // 상태 관리
  const [clientVersions, setClientVersions] = useState<ClientVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(ClientVersionService.getStoredPageSize());
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  
  // 검색 및 필터
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<ClientVersionFilters>({});
  const [showFilters, setShowFilters] = useState(true); // 기본적으로 필터 표시
  
  // 선택 관리
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  
  // 다이얼로그
  const [selectedClientVersion, setSelectedClientVersion] = useState<ClientVersion | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bulkStatusDialogOpen, setBulkStatusDialogOpen] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<ClientStatus>(ClientStatus.ONLINE);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingClientVersion, setEditingClientVersion] = useState<ClientVersion | null>(null);
  const [isCopyMode, setIsCopyMode] = useState(false);

  // 메타데이터
  const [channels, setChannels] = useState<string[]>(['production', 'staging', 'development']);
  const [subChannels, setSubChannels] = useState<string[]>(['live', 'beta', 'alpha']);

  // 클라이언트 버전 목록 로드
  const loadClientVersions = useCallback(async () => {
    try {
      setLoading(true);
      const result = await ClientVersionService.getClientVersions(
        page + 1,
        rowsPerPage,
        { ...filters, search: search || undefined },
        sortBy,
        sortOrder
      );

      if (result && result.clientVersions) {
        console.log('Loaded client versions:', {
          count: result.clientVersions.length,
          firstItem: result.clientVersions[0],
          hasIds: result.clientVersions.every(cv => cv.id !== undefined)
        });
        setClientVersions(result.clientVersions);
        setTotal(result.total || 0);
      } else {
        console.warn('Invalid response structure:', result);
        setClientVersions([]);
        setTotal(0);
      }
    } catch (error: any) {
      console.error('Error loading client versions:', error);
      enqueueSnackbar(error.message || 'Failed to load client versions', { variant: 'error' });
      setClientVersions([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, filters, search, sortBy, sortOrder, enqueueSnackbar]);

  // 메타데이터 로드
  const loadMetadata = useCallback(async () => {
    try {
      const metadata = await ClientVersionService.getMetadata();
      if (metadata) {
        const metadataChannels = Array.isArray(metadata.channels) ? metadata.channels : [];
        const metadataSubChannels = Array.isArray(metadata.subChannels) ? metadata.subChannels : [];

        setChannels([...metadataChannels, 'production', 'staging', 'development']);
        setSubChannels([...metadataSubChannels, 'live', 'beta', 'alpha']);
      }
    } catch (error) {
      console.error('Error loading metadata:', error);
      // API 호출 실패 시 기본값 유지
    }
  }, []);

  // 초기 로드
  useEffect(() => {
    loadClientVersions();
    loadMetadata();
  }, [loadClientVersions, loadMetadata]);

  // 페이지 크기 변경 시 로컬 스토리지에 저장
  useEffect(() => {
    ClientVersionService.setStoredPageSize(rowsPerPage);
  }, [rowsPerPage]);

  // 검색 핸들러
  const handleSearch = useCallback((searchTerm: string) => {
    setSearch(searchTerm);
    setPage(0);
  }, []);

  // 필터 변경 핸들러
  const handleFilterChange = useCallback((newFilters: ClientVersionFilters) => {
    setFilters(newFilters);
    setPage(0);
    ClientVersionService.setStoredFilters(newFilters);
  }, []);

  // 정렬 변경 핸들러
  const handleSort = useCallback((field: string) => {
    const isAsc = sortBy === field && sortOrder === 'ASC';
    const newSortOrder = isAsc ? 'DESC' : 'ASC';
    setSortBy(field);
    setSortOrder(newSortOrder);
    ClientVersionService.setStoredSort(field, newSortOrder);
  }, [sortBy, sortOrder]);

  // 페이지 변경 핸들러
  const handlePageChange = useCallback((event: unknown, newPage: number) => {
    setPage(newPage);
  }, []);

  // 페이지 크기 변경 핸들러
  const handleRowsPerPageChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const newRowsPerPage = parseInt(event.target.value, 10);
    setRowsPerPage(newRowsPerPage);
    setPage(0);
  }, []);

  // 선택 관리
  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      setSelectedIds(clientVersions.map(cv => cv.id));
    } else {
      setSelectedIds([]);
    }
    setSelectAll(checked);
  }, [clientVersions]);

  const handleSelectOne = useCallback((id: number, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(selectedId => selectedId !== id));
      setSelectAll(false);
    }
  }, []);



  // 삭제 핸들러
  const handleDelete = useCallback(async () => {
    if (!selectedClientVersion) return;

    try {
      await ClientVersionService.deleteClientVersion(selectedClientVersion.id);
      enqueueSnackbar(t('clientVersions.deleteSuccess'), { variant: 'success' });
      setDeleteDialogOpen(false);
      setSelectedClientVersion(null);
      loadClientVersions();
    } catch (error: any) {
      console.error('Error deleting client version:', error);
      enqueueSnackbar(error.message || 'Failed to delete client version', { variant: 'error' });
    }
  }, [selectedClientVersion, t, enqueueSnackbar, loadClientVersions]);

  // 일괄 상태 변경 핸들러
  const handleBulkStatusUpdate = useCallback(async () => {
    if (selectedIds.length === 0) return;

    try {
      const request: BulkStatusUpdateRequest = {
        ids: selectedIds,
        clientStatus: bulkStatus,
      };

      const result = await ClientVersionService.bulkUpdateStatus(request);
      console.log('🔍 Bulk update result:', result);
      enqueueSnackbar(result?.message || 'Status updated successfully', { variant: 'success' });
      setBulkStatusDialogOpen(false);
      setSelectedIds([]);
      setSelectAll(false);
      loadClientVersions();
    } catch (error: any) {
      console.error('Error updating status:', error);
      enqueueSnackbar(error.message || 'Failed to update status', { variant: 'error' });
    }
  }, [selectedIds, bulkStatus, enqueueSnackbar, loadClientVersions]);

  // 일괄 삭제 핸들러
  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.length === 0) return;

    try {
      await Promise.all(selectedIds.map(id => ClientVersionService.deleteClientVersion(id)));
      enqueueSnackbar(t('clientVersions.bulkDeleteSuccess', { count: selectedIds.length }), { variant: 'success' });
      setSelectedIds([]);
      setSelectAll(false);
      setBulkDeleteDialogOpen(false);
      await loadClientVersions();
    } catch (error: any) {
      console.error('Failed to delete client versions:', error);
      enqueueSnackbar(error.message || 'Failed to delete client versions', { variant: 'error' });
    }
  }, [selectedIds, t, enqueueSnackbar, loadClientVersions]);

  // 선택된 항목 내보내기
  const handleExportSelected = useCallback(async () => {
    if (selectedIds.length === 0) return;

    try {
      const selectedVersions = clientVersions.filter(cv => selectedIds.includes(cv.id));
      const csvContent = [
        // CSV 헤더
        ['ID', 'Channel', 'Sub Channel', 'Version', 'Status', 'Game Server', 'Patch Address', 'Guest Mode', 'Created By', 'Created At'].join(','),
        // CSV 데이터
        ...selectedVersions.map(cv => [
          cv.id,
          cv.channel,
          cv.subChannel,
          cv.clientVersion,
          cv.clientStatus,
          cv.gameServerAddress,
          cv.patchAddress,
          cv.guestModeAllowed ? 'Yes' : 'No',
          cv.createdByName,
          new Date(cv.createdAt).toLocaleDateString()
        ].join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `client-versions-selected-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      enqueueSnackbar(t('clientVersions.exportSuccess'), { variant: 'success' });
    } catch (error: any) {
      console.error('Failed to export selected versions:', error);
      enqueueSnackbar(error.message || 'Failed to export selected versions', { variant: 'error' });
    }
  }, [selectedIds, clientVersions, t, enqueueSnackbar]);

  // CSV 내보내기
  const handleExportCSV = useCallback(async () => {
    try {
      const blob = await ClientVersionService.exportToCSV(filters);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `client-versions-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      enqueueSnackbar(t('clientVersions.exportSuccess'), { variant: 'success' });
    } catch (error: any) {
      console.error('Error exporting CSV:', error);
      enqueueSnackbar(error.message || 'Failed to export CSV', { variant: 'error' });
    }
  }, [filters, t, enqueueSnackbar]);

  // 버전 복사 핸들러
  const handleCopyVersion = useCallback((clientVersion: ClientVersion) => {
    console.log('Copy button clicked for client version:', {
      id: clientVersion.id,
      clientVersion: clientVersion
    });

    // 복사할 데이터 준비 (버전 필드는 비움)
    const copiedData = {
      channel: clientVersion.channel,
      subChannel: clientVersion.subChannel,
      clientVersion: '', // 버전은 비워둠
      clientStatus: clientVersion.clientStatus,
      gameServerAddress: clientVersion.gameServerAddress,
      gameServerAddressForWhiteList: clientVersion.gameServerAddressForWhiteList || '',
      patchAddress: clientVersion.patchAddress,
      patchAddressForWhiteList: clientVersion.patchAddressForWhiteList || '',
      guestModeAllowed: clientVersion.guestModeAllowed,
      externalClickLink: clientVersion.externalClickLink || '',
      memo: clientVersion.memo || '',
      customPayload: clientVersion.customPayload || '',
    };

    // 폼 다이얼로그를 열고 복사된 데이터로 초기화
    console.log('Setting copied data:', copiedData);
    setEditingClientVersion(copiedData as any);
    setIsCopyMode(true);
    setFormDialogOpen(true);

    enqueueSnackbar(t('clientVersions.copySuccess'), { variant: 'success' });
  }, [t, enqueueSnackbar]);

  return (
    <Box sx={{ p: 3 }}>
      {/* 헤더 */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 600 }}>
          {t('clientVersions.title')}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleExportCSV}
          >
            {t('common.export')}
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setEditingClientVersion(null);
              setIsCopyMode(false);
              setFormDialogOpen(true);
            }}
          >
            {t('clientVersions.addNew')}
          </Button>
        </Box>
      </Box>

      {/* 검색 및 필터 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
            <TextField
              placeholder={t('clientVersions.searchPlaceholder')}
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              helperText={t('clientVersions.searchHelperText')}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Tooltip title={t('clientVersions.searchHelperText')} arrow>
                      <SearchIcon />
                    </Tooltip>
                  </InputAdornment>
                ),
                endAdornment: search && (
                  <InputAdornment position="end">
                    <IconButton onClick={() => handleSearch('')} size="small">
                      <ClearIcon />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{ flexGrow: 1 }}
            />
            <Button
              variant="outlined"
              startIcon={<FilterIcon />}
              endIcon={showFilters ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              onClick={() => setShowFilters(!showFilters)}
            >
              {t('common.filters')}
            </Button>
            <IconButton onClick={loadClientVersions} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Box>

          {/* 활성 검색어 표시 */}
          {search && (
            <Box sx={{ mb: 2 }}>
              <Chip
                label={`검색: "${search}"`}
                onDelete={() => handleSearch('')}
                color="primary"
                variant="outlined"
                size="small"
                sx={{ mr: 1 }}
              />
              <Typography variant="caption" color="text.secondary">
                {total}개의 결과
              </Typography>
            </Box>
          )}

          {/* 필터 패널 */}
          <Collapse in={showFilters}>
            <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                  <FormControl fullWidth size="small" sx={{ minWidth: 150 }}>
                    <InputLabel>{t('clientVersions.channel')}</InputLabel>
                    <Select
                      value={filters.channel || ''}
                      onChange={(e) => handleFilterChange({ ...filters, channel: e.target.value || undefined })}
                      label={t('clientVersions.channel')}
                      MenuProps={{
                        PaperProps: {
                          style: {
                            maxHeight: 200,
                          },
                        },
                      }}
                    >
                      <MenuItem value="">
                        <em>{t('common.all')}</em>
                      </MenuItem>
                      {channels.map((channel) => (
                        <MenuItem key={channel} value={channel}>
                          {channel}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                  <FormControl fullWidth size="small" sx={{ minWidth: 150 }}>
                    <InputLabel>{t('clientVersions.subChannel')}</InputLabel>
                    <Select
                      value={filters.subChannel || ''}
                      onChange={(e) => handleFilterChange({ ...filters, subChannel: e.target.value || undefined })}
                      label={t('clientVersions.subChannel')}
                      MenuProps={{
                        PaperProps: {
                          style: {
                            maxHeight: 200,
                          },
                        },
                      }}
                    >
                      <MenuItem value="">
                        <em>{t('common.all')}</em>
                      </MenuItem>
                      {subChannels.map((subChannel) => (
                        <MenuItem key={subChannel} value={subChannel}>
                          {subChannel}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                  <FormControl fullWidth size="small" sx={{ minWidth: 150 }}>
                    <InputLabel>{t('clientVersions.statusLabel')}</InputLabel>
                    <Select
                      value={filters.clientStatus || ''}
                      onChange={(e) => handleFilterChange({ ...filters, clientStatus: e.target.value as ClientStatus || undefined })}
                      label={t('clientVersions.statusLabel')}
                      MenuProps={{
                        PaperProps: {
                          style: {
                            maxHeight: 200,
                          },
                        },
                      }}
                    >
                      <MenuItem value="">
                        <em>{t('common.all')}</em>
                      </MenuItem>
                      {Object.values(ClientStatus).map((status) => (
                        <MenuItem key={status} value={status}>
                          {t(ClientStatusLabels[status])}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                  <FormControl fullWidth size="small" sx={{ minWidth: 150 }}>
                    <InputLabel>{t('clientVersions.guestMode')}</InputLabel>
                    <Select
                      value={filters.guestModeAllowed?.toString() || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        handleFilterChange({
                          ...filters,
                          guestModeAllowed: value === '' ? undefined : value === 'true'
                        });
                      }}
                      label={t('clientVersions.guestMode')}
                      MenuProps={{
                        PaperProps: {
                          style: {
                            maxHeight: 200,
                          },
                        },
                      }}
                    >
                      <MenuItem value="">
                        <em>{t('common.all')}</em>
                      </MenuItem>
                      <MenuItem value="true">{t('common.yes')}</MenuItem>
                      <MenuItem value="false">{t('common.no')}</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={12}>
                  <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                    <Button
                      size="small"
                      onClick={() => {
                        setFilters({});
                        ClientVersionService.setStoredFilters({});
                      }}
                    >
                      {t('common.clearFilters')}
                    </Button>
                  </Box>
                </Grid>
              </Grid>
            </Box>
          </Collapse>
        </CardContent>
      </Card>

      {/* 일괄 작업 툴바 */}
      {selectedIds.length > 0 && (
        <Card sx={{ mb: 2 }}>
          <CardContent sx={{ py: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'space-between' }}>
              <Typography variant="body2" sx={{ fontWeight: 600, color: 'primary.main' }}>
                {t('clientVersions.selectedCount', { count: selectedIds.length })}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  size="small"
                  variant="contained"
                  color="primary"
                  onClick={() => setBulkStatusDialogOpen(true)}
                  startIcon={<EditIcon />}
                >
                  {t('clientVersions.changeStatus')}
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  color="error"
                  onClick={() => setBulkDeleteDialogOpen(true)}
                  startIcon={<DeleteIcon />}
                >
                  {t('common.delete')}
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={handleExportSelected}
                  startIcon={<DownloadIcon />}
                >
                  {t('common.export')}
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    setSelectedIds([]);
                    setSelectAll(false);
                  }}
                >
                  {t('common.clearSelection')}
                </Button>
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* 테이블 */}
      <Card>
        {loading && <LinearProgress />}
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={selectAll}
                    indeterminate={selectedIds.length > 0 && selectedIds.length < clientVersions.length}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                  />
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortBy === 'channel'}
                    direction={sortBy === 'channel' ? sortOrder.toLowerCase() as 'asc' | 'desc' : 'asc'}
                    onClick={() => handleSort('channel')}
                  >
                    {t('clientVersions.channel')}
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortBy === 'subChannel'}
                    direction={sortBy === 'subChannel' ? sortOrder.toLowerCase() as 'asc' | 'desc' : 'asc'}
                    onClick={() => handleSort('subChannel')}
                  >
                    {t('clientVersions.subChannel')}
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortBy === 'clientVersion'}
                    direction={sortBy === 'clientVersion' ? sortOrder.toLowerCase() as 'asc' | 'desc' : 'asc'}
                    onClick={() => handleSort('clientVersion')}
                  >
                    {t('clientVersions.version')}
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortBy === 'clientStatus'}
                    direction={sortBy === 'clientStatus' ? sortOrder.toLowerCase() as 'asc' | 'desc' : 'asc'}
                    onClick={() => handleSort('clientStatus')}
                  >
                    {t('clientVersions.statusLabel')}
                  </TableSortLabel>
                </TableCell>
                <TableCell>{t('clientVersions.gameServer')}</TableCell>
                <TableCell>{t('clientVersions.patchAddress')}</TableCell>
                <TableCell>{t('clientVersions.guestMode')}</TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortBy === 'createdAt'}
                    direction={sortBy === 'createdAt' ? sortOrder.toLowerCase() as 'asc' | 'desc' : 'asc'}
                    onClick={() => handleSort('createdAt')}
                  >
                    {t('common.createdAt')}
                  </TableSortLabel>
                </TableCell>
                <TableCell>{t('common.createdBy')}</TableCell>
                <TableCell align="center">{t('common.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {clientVersions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} align="center">
                    <Typography variant="body2" color="text.secondary">
                      {loading ? 'Loading...' : 'No client versions found'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                clientVersions.map((clientVersion) => (
                <TableRow
                  key={clientVersion.id}
                  selected={selectedIds.includes(clientVersion.id)}
                  hover
                >
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedIds.includes(clientVersion.id)}
                      onChange={(e) => handleSelectOne(clientVersion.id, e.target.checked)}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={clientVersion.channel}
                      color="primary"
                      variant="outlined"
                      size="small"
                      sx={{ fontWeight: 600 }}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={clientVersion.subChannel}
                      color="secondary"
                      variant="outlined"
                      size="small"
                      sx={{ fontWeight: 600 }}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={clientVersion.clientVersion}
                      color="info"
                      variant="filled"
                      size="small"
                      sx={{
                        fontFamily: 'monospace',
                        fontWeight: 700,
                        fontSize: '0.75rem'
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={t(ClientStatusLabels[clientVersion.clientStatus])}
                      color={ClientStatusColors[clientVersion.clientStatus]}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Tooltip title={clientVersion.gameServerAddress}>
                      <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                        {clientVersion.gameServerAddress}
                      </Typography>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Tooltip title={clientVersion.patchAddress}>
                      <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                        {clientVersion.patchAddress}
                      </Typography>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={clientVersion.guestModeAllowed ? t('common.yes') : t('common.no')}
                      color={clientVersion.guestModeAllowed ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {formatDateTimeDetailed(clientVersion.createdAt)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {clientVersion.createdByName || 'Unknown'}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                      <Tooltip title={t('clientVersions.copyVersion')} arrow>
                        <IconButton
                          size="small"
                          onClick={() => handleCopyVersion(clientVersion)}
                          color="primary"
                          sx={{
                            '&:hover': {
                              backgroundColor: 'primary.light',
                              color: 'white',
                            },
                          }}
                        >
                          <CopyIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('common.edit')} arrow>
                        <IconButton
                          size="small"
                          onClick={() => {
                            console.log('Edit button clicked for client version:', {
                              id: clientVersion.id,
                              clientVersion: clientVersion
                            });
                            setEditingClientVersion(clientVersion);
                            setIsCopyMode(false);
                            setFormDialogOpen(true);
                          }}
                          color="info"
                          sx={{
                            '&:hover': {
                              backgroundColor: 'info.light',
                              color: 'white',
                            },
                          }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('common.delete')} arrow>
                        <IconButton
                          size="small"
                          onClick={() => {
                            setSelectedClientVersion(clientVersion);
                            setDeleteDialogOpen(true);
                          }}
                          color="error"
                          sx={{
                            '&:hover': {
                              backgroundColor: 'error.light',
                              color: 'white',
                            },
                          }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* 페이지네이션 */}
        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={handlePageChange}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleRowsPerPageChange}
          rowsPerPageOptions={[5, 10, 25, 50, 100]}
          labelRowsPerPage={t('common.rowsPerPage')}
          labelDisplayedRows={({ from, to, count }) =>
            t('common.displayedRows', { from, to, count })
          }
        />
      </Card>



      {/* 삭제 확인 다이얼로그 */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>{t('clientVersions.deleteConfirmTitle')}</DialogTitle>
        <DialogContent>
          <Typography>
            {t('clientVersions.deleteConfirmMessage', { 
              version: selectedClientVersion?.clientVersion 
            })}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            {t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 일괄 상태 변경 다이얼로그 */}
      <Dialog open={bulkStatusDialogOpen} onClose={() => setBulkStatusDialogOpen(false)}>
        <DialogTitle>{t('clientVersions.bulkStatusTitle')}</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>{t('clientVersions.statusLabel')}</InputLabel>
            <Select
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value as ClientStatus)}
              label={t('clientVersions.statusLabel')}
            >
              {Object.values(ClientStatus).map((status) => (
                <MenuItem key={status} value={status}>
                  {t(ClientStatusLabels[status])}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkStatusDialogOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleBulkStatusUpdate} variant="contained">
            {t('common.update')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 클라이언트 버전 추가/편집 폼 */}
      <ClientVersionForm
        open={formDialogOpen}
        onClose={() => {
          setFormDialogOpen(false);
          setEditingClientVersion(null);
          setIsCopyMode(false);
        }}
        onSuccess={() => {
          loadClientVersions();
          setFormDialogOpen(false);
          setEditingClientVersion(null);
          setIsCopyMode(false);
        }}
        clientVersion={editingClientVersion}
        isCopyMode={isCopyMode}
        channels={channels}
        subChannels={subChannels}
      />

      {/* 일괄 삭제 확인 다이얼로그 */}
      <Dialog
        open={bulkDeleteDialogOpen}
        onClose={() => setBulkDeleteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <DeleteIcon color="error" />
            {t('clientVersions.bulkDeleteTitle')}
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            {t('clientVersions.bulkDeleteWarning')}
          </Alert>
          <Typography variant="body1">
            {t('clientVersions.bulkDeleteConfirm', { count: selectedIds.length })}
          </Typography>
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              {t('clientVersions.selectedItems')}:
            </Typography>
            <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
              {clientVersions
                .filter(cv => selectedIds.includes(cv.id))
                .map(cv => (
                  <Box key={cv.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
                    <Chip label={cv.channel} size="small" color="primary" variant="outlined" />
                    <Chip label={cv.subChannel} size="small" color="secondary" variant="outlined" />
                    <Chip label={cv.clientVersion} size="small" color="info" variant="filled" />
                  </Box>
                ))}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkDeleteDialogOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleBulkDelete}
            color="error"
            variant="contained"
            startIcon={<DeleteIcon />}
          >
            {t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ClientVersionsPage;
