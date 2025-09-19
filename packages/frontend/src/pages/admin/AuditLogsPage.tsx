import React, { useState, useEffect, useCallback } from 'react';
import { usePageState } from '../../hooks/usePageState';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Grid,
  Card,
  CardContent,
  IconButton,
  Tooltip,
  Alert,
  LinearProgress,
  Pagination,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Info as InfoIcon,
  ContentCopy as ContentCopyIcon,
} from '@mui/icons-material';

import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { AuditLogService, AuditLogFilters } from '../../services/auditLogService';
import { AuditLog } from '../../types';
import { formatDateTimeDetailed } from '../../utils/dateFormat';
import SimplePagination from '../../components/common/SimplePagination';
import EmptyTableRow from '../../components/common/EmptyTableRow';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { useI18n } from '../../contexts/I18nContext';
import { koKR, zhCN, enUS } from '@mui/x-date-pickers/locales';
import dayjs, { Dayjs } from 'dayjs';



const AuditLogsPage: React.FC = () => {
  const { t } = useTranslation();
  const { language } = useI18n();
  const { enqueueSnackbar } = useSnackbar();

  // 페이지 상태 관리 (localStorage 연동)
  const {
    pageState,
    updatePage,
    updateLimit,
    updateFilters,
  } = usePageState({
    defaultState: {
      page: 1,
      limit: 10,
      sortBy: 'createdAt',
      sortOrder: 'DESC',
      filters: {},
    },
    storageKey: 'auditLogsPage',
  });

  // Get locale text for DateTimePicker
  const getDatePickerLocale = () => {
    switch (language) {
      case 'ko':
        return koKR;
      case 'zh':
        return zhCN;
      default:
        return enUS;
    }
  };

  // State
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  // Filters - localStorage에서 복원
  const [startDate, setStartDate] = useState<Dayjs | null>(
    pageState.filters?.start_date ? dayjs(pageState.filters.start_date) : null
  );
  const [endDate, setEndDate] = useState<Dayjs | null>(
    pageState.filters?.end_date ? dayjs(pageState.filters.end_date) : null
  );
  const [userFilter, setUserFilter] = useState<string>(pageState.filters?.user || '');
  const [ipFilter, setIpFilter] = useState<string>(pageState.filters?.ip || '');

  // Load audit logs
  const loadAuditLogs = useCallback(async () => {
    try {
      setLoading(true);

      const dateFilters: AuditLogFilters = { ...pageState.filters };
      if (startDate) {
        dateFilters.start_date = startDate.toISOString();
      }
      if (endDate) {
        dateFilters.end_date = endDate.toISOString();
      }
      if (userFilter) {
        (dateFilters as any).user = userFilter.trim();
      }
      if (ipFilter) {
        (dateFilters as any).ip_address = ipFilter;
      }

      const result = await AuditLogService.getAuditLogs(
        pageState.page,
        pageState.limit,
        dateFilters
      );

      if (result && Array.isArray(result.logs)) {
        setAuditLogs(result.logs);
        setTotal(result.total || 0);
      } else {
        setAuditLogs([]);
        setTotal(0);
      }
    } catch (error: any) {
      console.error('Error loading audit logs:', error);
      enqueueSnackbar(error.message || t('auditLogs.loadFailed'), { variant: 'error' });
      setAuditLogs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [pageState, startDate, endDate, userFilter, ipFilter, enqueueSnackbar, t]);

  useEffect(() => {
    loadAuditLogs();
  }, [loadAuditLogs]);

  // Handlers
  const handlePageChange = (event: unknown, newPage: number) => {
    updatePage(newPage + 1); // MUI는 0부터 시작, 우리는 1부터 시작
  };

  const handleRowsPerPageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newLimit = parseInt(event.target.value, 10);
    updateLimit(newLimit);
  };

  const handleFilterChange = (key: keyof AuditLogFilters, value: any) => {
    const newFilters = {
      ...pageState.filters,
      [key]: value || undefined,
    };
    updateFilters(newFilters);
  };

  const handleRefresh = () => {
    loadAuditLogs();
  };

  const formatDate = (dateString: string) => {
    return formatDateTimeDetailed(dateString);
  };

  const formatDetails = (details: any) => {
    if (!details) return '-';
    if (typeof details === 'string') return details;
    return JSON.stringify(details, null, 2);
  };

  const handleCopyDetails = async (details: any) => {
    try {
      let text = '';
      if (!details) {
        text = 'No details available';
      } else if (typeof details === 'string') {
        text = details;
      } else {
        text = JSON.stringify(details, null, 2);
      }
      await navigator.clipboard.writeText(text);
      enqueueSnackbar(t('auditLogs.detailsCopied'), { variant: 'success' });
    } catch (error) {
      console.error('Copy failed:', error);
      enqueueSnackbar(t('common.copyFailed'), { variant: 'error' });
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="h4" sx={{ fontWeight: 600 }}>
            {t('auditLogs.title')}
          </Typography>

        </Box>
        <Typography variant="body1" color="text.secondary">
          {t('auditLogs.subtitle')}
        </Typography>
      </Box>

        {/* Filters */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel shrink={true}>{t('auditLogs.action')}</InputLabel>
                  <Select
                    value={pageState.filters?.action || ''}
                    label={t('auditLogs.action')}
                    onChange={(e) => handleFilterChange('action', e.target.value)}
                    displayEmpty
                    size="small"
                  >
                    <MenuItem value="">{t('auditLogs.allActions')}</MenuItem>
                    {AuditLogService.getAvailableActions().map((action) => (
                      <MenuItem key={action} value={action}>
                        {t(`auditLogs.actions.${action}`)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel shrink={true}>{t('auditLogs.resourceType')}</InputLabel>
                  <Select
                    value={pageState.filters?.resource_type || ''}
                    label={t('auditLogs.resourceType')}
                    onChange={(e) => handleFilterChange('resource_type', e.target.value)}
                    displayEmpty
                    size="small"
                  >
                    <MenuItem value="">{t('auditLogs.allTypes')}</MenuItem>
                    {AuditLogService.getAvailableResourceTypes().map((type) => (
                      <MenuItem key={type} value={type}>
                        {t(`auditLogs.resources.${type}`)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <TextField
                  label={t('auditLogs.user')}
                  placeholder={t('auditLogs.searchUserPlaceholder')}
                  size="small"
                  sx={{ minWidth: 120 }}
                  value={userFilter}
                  onChange={(e) => {
                    const value = e.target.value;
                    setUserFilter(value);
                    handleFilterChange('user', value);
                  }}
                />

                <TextField
                  label={t('auditLogs.ipAddress')}
                  size="small"
                  sx={{ minWidth: 120 }}
                  value={ipFilter}
                  onChange={(e) => {
                    const value = e.target.value;
                    setIpFilter(value);
                    handleFilterChange('ip_address', value);
                  }}
                />

                <DateTimePicker
                  key={`start-date-${language}`}
                  label={t('auditLogs.startDate')}
                  value={startDate}
                  onChange={(date) => {
                    setStartDate(date);
                    handleFilterChange('start_date', date ? date.toISOString() : undefined);
                  }}
                  slotProps={{
                    textField: {
                      size: 'small',
                      sx: { minWidth: 160 }
                    },
                    actionBar: {
                      actions: ['cancel', 'accept']
                    },
                    popper: {
                      style: {
                        zIndex: 9999
                      }
                    }
                  }}
                  localeText={getDatePickerLocale()}
                />

                <DateTimePicker
                  key={`end-date-${language}`}
                  label={t('auditLogs.endDate')}
                  value={endDate}
                  onChange={(date) => {
                    setEndDate(date);
                    handleFilterChange('end_date', date ? date.toISOString() : undefined);
                  }}
                  slotProps={{
                    textField: {
                      size: 'small',
                      sx: { minWidth: 160 }
                    },
                    actionBar: {
                      actions: ['cancel', 'accept']
                    },
                    popper: {
                      style: {
                        zIndex: 9999
                      }
                    }
                  }}
                  localeText={getDatePickerLocale()}
                />
              </Box>

              <Tooltip title={t('common.refresh')}>
                <span>
                  <IconButton onClick={handleRefresh} disabled={loading} sx={{ ml: 2 }}>
                    <RefreshIcon />
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
          </CardContent>
        </Card>

        {/* Audit Logs Table */}

        <Card>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t('auditLogs.id')}</TableCell>
                  <TableCell>{t('auditLogs.action')}</TableCell>
                  <TableCell>{t('auditLogs.resource')}</TableCell>
                  <TableCell>{t('auditLogs.user')}</TableCell>
                  <TableCell>{t('auditLogs.ipAddress')}</TableCell>
                  <TableCell>{t('auditLogs.date')}</TableCell>
                  <TableCell>{t('auditLogs.details')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {auditLogs.length === 0 ? (
                  <EmptyTableRow
                    colSpan={7}
                    loading={loading}
                    message={t('auditLogs.noLogsFound')}
                    loadingMessage={t('common.loadingAuditLogs')}
                  />
                ) : (
                  auditLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>{log.id}</TableCell>
                      <TableCell>
                        <Chip label={t(`auditLogs.actions.${log.action}`)} color={AuditLogService.getActionColor(log.action)} size="small" />
                      </TableCell>
                      <TableCell>
                        {((log as any).resourceType || (log as any).resource_type || (log as any).entityType) ? (
                          <Box>
                            <Typography variant="body2" fontWeight="medium">
                              {t(`auditLogs.resources.${(log as any).resourceType || (log as any).resource_type || (log as any).entityType}`, (log as any).resourceType || (log as any).resource_type || (log as any).entityType)}
                            </Typography>
                            {((log as any).resourceId || (log as any).resource_id || (log as any).entityId) && (
                              <Typography variant="caption" color="text.secondary">
                                ID: {(log as any).resourceId || (log as any).resource_id || (log as any).entityId}
                              </Typography>
                            )}
                          </Box>
                        ) : (
                          <Typography variant="body2" color="text.secondary">-</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {log.user_name ? (
                          <Box>
                            <Typography variant="body2" fontWeight="medium">
                              {log.user_name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {log.user_email}
                            </Typography>
                          </Box>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            {t('auditLogs.system')}
                          </Typography>
                        )}
                      </TableCell>


                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace">
                          {log.ip_address || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatDateTimeDetailed((log as any).createdAt || log.created_at)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Tooltip title={formatDetails(log.details)}>
                          <Box sx={{ display: 'inline-flex', gap: 0.5 }}>
                            <IconButton size="small">
                              <InfoIcon />
                            </IconButton>
                            <IconButton size="small" onClick={() => handleCopyDetails(log.details)}>
                              <ContentCopyIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <SimplePagination
            count={total}
            page={pageState.page - 1} // MUI는 0부터 시작
            rowsPerPage={pageState.limit}
            onPageChange={handlePageChange}
            onRowsPerPageChange={handleRowsPerPageChange}
            rowsPerPageOptions={[5, 10, 25, 50, 100]}
          />
        </Card>
      </Box>
    );
};

export default AuditLogsPage;
