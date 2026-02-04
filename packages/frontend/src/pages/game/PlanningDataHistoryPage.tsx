import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/types/permissions';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Tooltip,
  IconButton,
  Collapse,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Divider,
  InputAdornment,
  TableSortLabel,
} from '@mui/material';
import {
  History as HistoryIcon,
  Refresh as RefreshIcon,
  ContentCopy as CopyIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Computer as WebIcon,
  Terminal as CliIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { copyToClipboardWithNotification } from '@/utils/clipboard';
import planningDataService, { UploadRecord } from '../../services/planningDataService';
import SimplePagination from '../../components/common/SimplePagination';
import { formatRelativeTime, formatDateTimeDetailed } from '../../utils/dateFormat';
import { useDebounce } from '../../hooks/useDebounce';

const PlanningDataHistoryPage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { hasPermission } = useAuth();
  const canView = hasPermission([PERMISSIONS.PLANNING_DATA_VIEW, PERMISSIONS.PLANNING_DATA_MANAGE]);
  const canManage = hasPermission([PERMISSIONS.PLANNING_DATA_MANAGE]);

  const [history, setHistory] = useState<UploadRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  const [orderBy, setOrderBy] = useState<string>('uploadedAt');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const data = await planningDataService.getUploadHistory(100);
      setHistory(data);
    } catch (error: any) {
      console.error('Error loading history:', error);
      enqueueSnackbar(t('planningData.history.loadFailed'), {
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    loadHistory();
  };

  const toggleExpand = (id: number) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  const handleReset = async () => {
    try {
      const result = await planningDataService.resetUploadHistory();
      enqueueSnackbar(t('planningData.history.resetSuccess', { count: result.deletedCount }), {
        variant: 'success',
      });
      setShowResetDialog(false);
      setResetConfirmText('');
      loadHistory();
    } catch (error: any) {
      enqueueSnackbar(t('planningData.history.resetFailed'), {
        variant: 'error',
      });
    }
  };

  const handleSort = (property: string) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const filteredHistory = useMemo(() => {
    let result = [...history];

    if (debouncedSearchTerm) {
      const search = debouncedSearchTerm.toLowerCase();
      result = result.filter(
        (record) =>
          record.uploaderName?.toLowerCase().includes(search) ||
          record.uploadHash?.toLowerCase().includes(search) ||
          record.uploadComment?.toLowerCase().includes(search) ||
          record.changedFiles?.some((f) => f.toLowerCase().includes(search)) ||
          record.uploadSource?.toLowerCase().includes(search)
      );
    }

    result.sort((a, b) => {
      let valA: any = a[orderBy as keyof UploadRecord];
      let valB: any = b[orderBy as keyof UploadRecord];

      if (orderBy === 'changedFilesCount') {
        valA = a.changedFiles?.length || 0;
        valB = b.changedFiles?.length || 0;
      }

      if (valA === undefined || valA === null) valA = '';
      if (valB === undefined || valB === null) valB = '';

      if (valA < valB) return order === 'asc' ? -1 : 1;
      if (valA > valB) return order === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [history, debouncedSearchTerm, orderBy, order]);

  const paginatedHistory = filteredHistory.slice(page * rowsPerPage, (page + 1) * rowsPerPage);

  if (!canView) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="error">{t('common.noPermission')}</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          mb: 3,
        }}
      >
        <Box>
          <Typography
            variant="h4"
            gutterBottom
            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
          >
            <HistoryIcon />
            {t('planningData.history.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('planningData.history.subtitle')}
          </Typography>
        </Box>
        {canManage && history.length > 0 && (
          <Button
            variant="contained"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={() => setShowResetDialog(true)}
          >
            {t('planningData.history.resetAll')}
          </Button>
        )}
      </Box>

      {/* Search Bar */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              flexWrap: 'wrap',
              justifyContent: 'space-between',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                gap: 2,
                alignItems: 'center',
                flexWrap: 'wrap',
                flex: 1,
              }}
            >
              <TextField
                placeholder={t('planningData.history.searchPlaceholder') || t('common.search')}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(0);
                }}
                sx={{
                  minWidth: 200,
                  flexGrow: 1,
                  maxWidth: 400,
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
                      },
                    },
                    '&.Mui-focused': {
                      bgcolor: 'background.paper',
                      boxShadow: '0 0 0 2px rgba(25, 118, 210, 0.1)',
                      '& fieldset': {
                        borderColor: 'primary.main',
                        borderWidth: '1px',
                      },
                    },
                  },
                  '& .MuiInputBase-input': {
                    fontSize: '0.875rem',
                  },
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                    </InputAdornment>
                  ),
                  endAdornment: null,
                }}
                size="small"
              />

              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0,
                  borderRadius: 1,
                  bgcolor: 'background.paper',
                  border: 1,
                  borderColor: 'divider',
                  overflow: 'hidden',
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.75,
                    px: 1.5,
                    py: 0.5,
                  }}
                >
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      bgcolor: 'primary.main',
                    }}
                  />
                  <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                    {t('planningData.history.totalRecords')}{' '}
                    <strong style={{ color: 'inherit' }}>{history.length}</strong>
                  </Typography>
                </Box>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Tooltip title={t('common.refresh')}>
                <span>
                  <IconButton size="small" onClick={handleRefresh} disabled={loading}>
                    <RefreshIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Content */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : history.length === 0 ? (
        <Card>
          <CardContent>
            <Typography color="text.secondary" align="center">
              {t('planningData.history.noRecords')}
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell width={40}></TableCell>
                    <TableCell>
                      <TableSortLabel
                        active={orderBy === 'uploadedAt'}
                        direction={orderBy === 'uploadedAt' ? order : 'asc'}
                        onClick={() => handleSort('uploadedAt')}
                      >
                        {t('planningData.history.uploadedAt')}
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>
                      <TableSortLabel
                        active={orderBy === 'uploaderName'}
                        direction={orderBy === 'uploaderName' ? order : 'asc'}
                        onClick={() => handleSort('uploaderName')}
                      >
                        {t('planningData.history.uploader')}
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>
                      <TableSortLabel
                        active={orderBy === 'uploadSource'}
                        direction={orderBy === 'uploadSource' ? order : 'asc'}
                        onClick={() => handleSort('uploadSource')}
                      >
                        {t('planningData.history.source')}
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>{t('planningData.history.hash')}</TableCell>
                    <TableCell align="center">
                      <TableSortLabel
                        active={orderBy === 'changedFilesCount'}
                        direction={orderBy === 'changedFilesCount' ? order : 'asc'}
                        onClick={() => handleSort('changedFilesCount')}
                      >
                        {t('planningData.history.changedFilesCount')}
                      </TableSortLabel>
                    </TableCell>
                    <TableCell align="center">{t('planningData.history.changes')}</TableCell>
                    <TableCell>{t('planningData.history.comment')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedHistory.map((record, index) => (
                    <React.Fragment key={record.id}>
                      <TableRow
                        hover
                        sx={{
                          cursor:
                            record.fileDiffs && Object.keys(record.fileDiffs).length > 0
                              ? 'pointer'
                              : 'default',
                          bgcolor:
                            index % 2 === 1
                              ? (theme) =>
                                  theme.palette.mode === 'dark'
                                    ? 'rgba(255, 255, 255, 0.04)'
                                    : 'rgba(0, 0, 0, 0.025)'
                              : 'transparent',
                          '&:hover': {
                            bgcolor: (theme) =>
                              theme.palette.mode === 'dark'
                                ? 'rgba(255, 255, 255, 0.08)'
                                : 'rgba(0, 0, 0, 0.05)',
                          },
                          '&.MuiTableRow-root:nth-of-type(even)': {
                            bgcolor:
                              index % 2 === 1
                                ? (theme) =>
                                    theme.palette.mode === 'dark'
                                      ? 'rgba(255, 255, 255, 0.04)'
                                      : 'rgba(0, 0, 0, 0.025)'
                                : 'transparent',
                          },
                          ...(expandedRow === record.id && {
                            bgcolor: 'action.selected',
                            '&:hover': { bgcolor: 'action.selected' },
                          }),
                        }}
                        onClick={() => {
                          // Only toggle if there are diffs to show
                          if (record.fileDiffs && Object.keys(record.fileDiffs).length > 0) {
                            toggleExpand(record.id);
                          }
                        }}
                      >
                        <TableCell>
                          {record.fileDiffs && Object.keys(record.fileDiffs).length > 0 ? (
                            <IconButton size="small">
                              {expandedRow === record.id ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                            </IconButton>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                            }}
                          >
                            <Tooltip title={formatDateTimeDetailed(record.uploadedAt)}>
                              <Typography
                                variant="body2"
                                sx={{
                                  fontWeight: index === 0 ? 'bold' : 'normal',
                                }}
                              >
                                {formatRelativeTime(record.uploadedAt)}
                              </Typography>
                            </Tooltip>
                            {index === 0 && (
                              <Chip
                                size="small"
                                label={t('planningData.history.latest')}
                                color="primary"
                                sx={{
                                  height: 20,
                                  fontSize: '0.625rem',
                                  fontWeight: 'bold',
                                }}
                              />
                            )}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {record.uploaderName || 'Unknown'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            icon={record.uploadSource === 'cli' ? <CliIcon /> : <WebIcon />}
                            label={record.uploadSource.toUpperCase()}
                            color={record.uploadSource === 'cli' ? 'warning' : 'default'}
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          <Tooltip title={t('common.copyToClipboard')}>
                            <Chip
                              size="small"
                              variant="outlined"
                              label={record.uploadHash.substring(0, 8)}
                              onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboardWithNotification(
                                  record.uploadHash,
                                  () =>
                                    enqueueSnackbar(t('common.copiedToClipboard'), {
                                      variant: 'success',
                                    }),
                                  () =>
                                    enqueueSnackbar(t('common.copyFailed'), {
                                      variant: 'error',
                                    })
                                );
                              }}
                              sx={{
                                cursor: 'pointer',
                                fontFamily: 'monospace',
                                borderRadius: 1,
                                bgcolor: 'background.paper',
                                '&:hover': { bgcolor: 'action.hover' },
                              }}
                            />
                          </Tooltip>
                        </TableCell>
                        <TableCell align="center">{record.changedFiles?.length || 0}</TableCell>
                        <TableCell align="center">
                          {record.fileDiffs ? (
                            (() => {
                              // Calculate total changes from all file diffs
                              let totalAdded = 0,
                                totalRemoved = 0,
                                totalModified = 0;
                              Object.values(record.fileDiffs).forEach((diff: any) => {
                                totalAdded += diff.added?.length || 0;
                                totalRemoved += diff.removed?.length || 0;
                                totalModified += diff.modified?.length || 0;
                              });
                              return (
                                <Box
                                  sx={{
                                    display: 'flex',
                                    gap: 0.5,
                                    justifyContent: 'center',
                                  }}
                                >
                                  <Chip
                                    size="small"
                                    label={`${t('planningData.history.added')}:${totalAdded}`}
                                    color="success"
                                    sx={{ height: 20, fontSize: '0.7rem' }}
                                  />
                                  <Chip
                                    size="small"
                                    label={`${t('planningData.history.modified')}:${totalModified}`}
                                    color="warning"
                                    sx={{ height: 20, fontSize: '0.7rem' }}
                                  />
                                  <Chip
                                    size="small"
                                    label={`${t('planningData.history.removed')}:${totalRemoved}`}
                                    color="error"
                                    sx={{ height: 20, fontSize: '0.7rem' }}
                                  />
                                </Box>
                              );
                            })()
                          ) : (
                            <Typography variant="caption" color="text.secondary">
                              -
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                            {record.uploadComment || '-'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                      <TableRow
                        sx={{
                          bgcolor:
                            index % 2 === 1
                              ? (theme) =>
                                  theme.palette.mode === 'dark'
                                    ? 'rgba(255, 255, 255, 0.04)'
                                    : 'rgba(0, 0, 0, 0.025)'
                              : 'transparent',
                          '&:hover': {
                            bgcolor: (theme) =>
                              theme.palette.mode === 'dark'
                                ? 'rgba(255, 255, 255, 0.08)'
                                : 'rgba(0, 0, 0, 0.05)',
                          },
                          '&.MuiTableRow-root:nth-of-type(even)': {
                            bgcolor:
                              index % 2 === 1
                                ? (theme) =>
                                    theme.palette.mode === 'dark'
                                      ? 'rgba(255, 255, 255, 0.04)'
                                      : 'rgba(0, 0, 0, 0.025)'
                                : 'transparent',
                          },
                          ...(expandedRow === record.id && {
                            bgcolor: 'action.selected',
                          }),
                        }}
                      >
                        <TableCell colSpan={8} sx={{ py: 0 }}>
                          <Collapse in={expandedRow === record.id} timeout="auto" unmountOnExit>
                            <Box sx={{ py: 2, px: 4 }}>
                              {record.changedFiles && record.changedFiles.length > 0 ? (
                                <>
                                  <Typography variant="subtitle2" gutterBottom>
                                    {t('planningData.history.changedFiles')} (
                                    {record.changedFiles.length}):
                                  </Typography>
                                  <Box
                                    sx={{
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: 1,
                                    }}
                                  >
                                    {record.changedFiles.map((file) => {
                                      const fileDiff = record.fileDiffs?.[file];
                                      return (
                                        <Box
                                          key={file}
                                          sx={{
                                            p: 1.5,
                                            bgcolor: (theme) =>
                                              theme.palette.mode === 'dark'
                                                ? 'background.default'
                                                : 'action.hover',
                                            borderRadius: 1,
                                          }}
                                        >
                                          <Chip
                                            size="small"
                                            label={file}
                                            color="warning"
                                            sx={{ mb: 1 }}
                                          />
                                          {fileDiff && (
                                            <Box sx={{ mt: 1 }}>
                                              {fileDiff.modified?.length > 0 && (
                                                <Box sx={{ mb: 2 }}>
                                                  <Typography
                                                    variant="caption"
                                                    color="warning.main"
                                                    sx={{
                                                      fontWeight: 'bold',
                                                      display: 'block',
                                                      mb: 0.5,
                                                    }}
                                                  >
                                                    ~ {t('planningData.history.modified')}:{' '}
                                                    {fileDiff.modified.length}
                                                  </Typography>
                                                  <Box
                                                    component="table"
                                                    sx={{
                                                      width: '100%',
                                                      borderCollapse: 'collapse',
                                                      fontSize: '0.75rem',
                                                      fontFamily: 'monospace',
                                                      border: '1px dashed',
                                                      borderColor: 'divider',
                                                      '& th, & td': {
                                                        borderBottom: '1px dashed',
                                                        borderRight: '1px dashed',
                                                        borderColor: 'divider',
                                                        p: 0.5,
                                                        textAlign: 'left',
                                                      },
                                                      '& th:last-child, & td:last-child': {
                                                        borderRight: 'none',
                                                      },
                                                      '& th': {
                                                        bgcolor: 'action.hover',
                                                        fontWeight: 'bold',
                                                      },
                                                      '& tbody tr:nth-of-type(odd)': {
                                                        bgcolor: 'rgba(255, 255, 255, 0.02)',
                                                      },
                                                    }}
                                                  >
                                                    <thead>
                                                      <tr>
                                                        <Box component="th" sx={{ width: '35%' }}>
                                                          {t('planningData.history.path')}
                                                        </Box>
                                                        <Box
                                                          component="th"
                                                          sx={{
                                                            width: '32%',
                                                            color: 'error.main',
                                                          }}
                                                        >
                                                          {t('planningData.history.before')}
                                                        </Box>
                                                        <Box
                                                          component="th"
                                                          sx={{
                                                            width: '32%',
                                                            color: 'success.main',
                                                          }}
                                                        >
                                                          {t('planningData.history.after')}
                                                        </Box>
                                                      </tr>
                                                    </thead>
                                                    <tbody>
                                                      {fileDiff.modified
                                                        .slice(0, 10)
                                                        .map((item, idx) => (
                                                          <tr key={idx}>
                                                            <td>{item.path}</td>
                                                            <Box
                                                              component="td"
                                                              sx={{
                                                                color: 'error.main',
                                                                textDecoration: 'line-through',
                                                                wordBreak: 'break-all',
                                                              }}
                                                            >
                                                              {typeof item.before === 'string'
                                                                ? item.before
                                                                : JSON.stringify(item.before)}
                                                            </Box>
                                                            <Box
                                                              component="td"
                                                              sx={{
                                                                color: 'success.main',
                                                                wordBreak: 'break-all',
                                                              }}
                                                            >
                                                              {typeof item.after === 'string'
                                                                ? item.after
                                                                : JSON.stringify(item.after)}
                                                            </Box>
                                                          </tr>
                                                        ))}
                                                    </tbody>
                                                  </Box>
                                                  {fileDiff.modified.length > 10 && (
                                                    <Typography
                                                      variant="caption"
                                                      color="text.secondary"
                                                      sx={{
                                                        mt: 0.5,
                                                        display: 'block',
                                                      }}
                                                    >
                                                      +{fileDiff.modified.length - 10} more...
                                                    </Typography>
                                                  )}
                                                </Box>
                                              )}
                                              {fileDiff.added?.length > 0 && (
                                                <Box sx={{ mb: 2 }}>
                                                  <Typography
                                                    variant="caption"
                                                    color="success.main"
                                                    sx={{
                                                      fontWeight: 'bold',
                                                      display: 'block',
                                                      mb: 0.5,
                                                    }}
                                                  >
                                                    + {t('planningData.history.added')}:{' '}
                                                    {fileDiff.added.length}
                                                  </Typography>
                                                  <Box
                                                    component="table"
                                                    sx={{
                                                      width: '100%',
                                                      borderCollapse: 'collapse',
                                                      fontSize: '0.75rem',
                                                      fontFamily: 'monospace',
                                                      border: '1px dashed',
                                                      borderColor: 'divider',
                                                      '& th, & td': {
                                                        borderBottom: '1px dashed',
                                                        borderRight: '1px dashed',
                                                        borderColor: 'divider',
                                                        p: 0.5,
                                                        textAlign: 'left',
                                                      },
                                                      '& th:last-child, & td:last-child': {
                                                        borderRight: 'none',
                                                      },
                                                      '& th': {
                                                        bgcolor: 'action.hover',
                                                        fontWeight: 'bold',
                                                      },
                                                      '& tbody tr:nth-of-type(odd)': {
                                                        bgcolor: 'rgba(255, 255, 255, 0.02)',
                                                      },
                                                    }}
                                                  >
                                                    <thead>
                                                      <tr>
                                                        <Box component="th" sx={{ width: '40%' }}>
                                                          {t('planningData.history.path')}
                                                        </Box>
                                                        <Box
                                                          component="th"
                                                          sx={{
                                                            color: 'success.main',
                                                          }}
                                                        >
                                                          {t('planningData.history.value')}
                                                        </Box>
                                                      </tr>
                                                    </thead>
                                                    <tbody>
                                                      {fileDiff.added
                                                        .slice(0, 10)
                                                        .map((item, idx) => (
                                                          <tr key={idx}>
                                                            <td>{item.path}</td>
                                                            <Box
                                                              component="td"
                                                              sx={{
                                                                color: 'success.main',
                                                                wordBreak: 'break-all',
                                                              }}
                                                            >
                                                              {typeof item.value === 'string'
                                                                ? item.value
                                                                : JSON.stringify(item.value)}
                                                            </Box>
                                                          </tr>
                                                        ))}
                                                    </tbody>
                                                  </Box>
                                                  {fileDiff.added.length > 10 && (
                                                    <Typography
                                                      variant="caption"
                                                      color="text.secondary"
                                                      sx={{
                                                        mt: 0.5,
                                                        display: 'block',
                                                      }}
                                                    >
                                                      +{fileDiff.added.length - 10} more...
                                                    </Typography>
                                                  )}
                                                </Box>
                                              )}
                                              {fileDiff.removed?.length > 0 && (
                                                <Box sx={{ mb: 2 }}>
                                                  <Typography
                                                    variant="caption"
                                                    color="error.main"
                                                    sx={{
                                                      fontWeight: 'bold',
                                                      display: 'block',
                                                      mb: 0.5,
                                                    }}
                                                  >
                                                    − {t('planningData.history.removed')}:{' '}
                                                    {fileDiff.removed.length}
                                                  </Typography>
                                                  <Box
                                                    component="table"
                                                    sx={{
                                                      width: '100%',
                                                      borderCollapse: 'collapse',
                                                      fontSize: '0.75rem',
                                                      fontFamily: 'monospace',
                                                      border: '1px dashed',
                                                      borderColor: 'divider',
                                                      '& th, & td': {
                                                        borderBottom: '1px dashed',
                                                        borderRight: '1px dashed',
                                                        borderColor: 'divider',
                                                        p: 0.5,
                                                        textAlign: 'left',
                                                      },
                                                      '& th:last-child, & td:last-child': {
                                                        borderRight: 'none',
                                                      },
                                                      '& th': {
                                                        bgcolor: 'action.hover',
                                                        fontWeight: 'bold',
                                                      },
                                                      '& tbody tr:nth-of-type(odd)': {
                                                        bgcolor: 'rgba(255, 255, 255, 0.02)',
                                                      },
                                                    }}
                                                  >
                                                    <thead>
                                                      <tr>
                                                        <Box component="th" sx={{ width: '40%' }}>
                                                          {t('planningData.history.path')}
                                                        </Box>
                                                        <Box
                                                          component="th"
                                                          sx={{
                                                            color: 'error.main',
                                                          }}
                                                        >
                                                          {t('planningData.history.value')}
                                                        </Box>
                                                      </tr>
                                                    </thead>
                                                    <tbody>
                                                      {fileDiff.removed
                                                        .slice(0, 10)
                                                        .map((item, idx) => (
                                                          <tr key={idx}>
                                                            <td>{item.path}</td>
                                                            <Box
                                                              component="td"
                                                              sx={{
                                                                color: 'error.main',
                                                                textDecoration: 'line-through',
                                                                wordBreak: 'break-all',
                                                              }}
                                                            >
                                                              {typeof item.value === 'string'
                                                                ? item.value
                                                                : JSON.stringify(item.value)}
                                                            </Box>
                                                          </tr>
                                                        ))}
                                                    </tbody>
                                                  </Box>
                                                  {fileDiff.removed.length > 10 && (
                                                    <Typography
                                                      variant="caption"
                                                      color="text.secondary"
                                                      sx={{
                                                        mt: 0.5,
                                                        display: 'block',
                                                      }}
                                                    >
                                                      +{fileDiff.removed.length - 10} more...
                                                    </Typography>
                                                  )}
                                                </Box>
                                              )}
                                            </Box>
                                          )}
                                          {!fileDiff && (
                                            <Typography variant="caption" color="text.secondary">
                                              {t('planningData.history.noDiffAvailable')}
                                            </Typography>
                                          )}
                                        </Box>
                                      );
                                    })}
                                  </Box>
                                </>
                              ) : (
                                <Typography variant="body2" color="text.secondary">
                                  {t('planningData.history.noChanges')}
                                </Typography>
                              )}
                            </Box>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Pagination */}
            <SimplePagination
              count={filteredHistory.length}
              page={page}
              rowsPerPage={rowsPerPage}
              onPageChange={(_, newPage) => setPage(newPage)}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(Number(e.target.value));
                setPage(0);
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* Reset Confirmation Dialog */}
      <Dialog
        open={showResetDialog}
        onClose={() => {
          setShowResetDialog(false);
          setResetConfirmText('');
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle color="error">{t('planningData.history.resetConfirmTitle')}</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            {t('planningData.history.resetWarning')}
          </Alert>
          <Typography variant="body2" sx={{ mb: 2 }}>
            {t('planningData.history.resetConfirmMessage', {
              count: history.length,
            })}
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            {t('planningData.history.resetConfirmInstruction')}
          </Typography>
          <TextField
            fullWidth
            value={resetConfirmText}
            onChange={(e) => setResetConfirmText(e.target.value)}
            placeholder={t('planningData.history.resetConfirmPlaceholder')}
            size="small"
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setShowResetDialog(false);
              setResetConfirmText('');
            }}
          >
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleReset}
            disabled={resetConfirmText !== t('planningData.history.resetConfirmText')}
          >
            {t('planningData.history.resetAll')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PlanningDataHistoryPage;
