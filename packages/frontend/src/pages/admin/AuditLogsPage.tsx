import React, { useState, useEffect, useCallback } from 'react';
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
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Info as InfoIcon,
} from '@mui/icons-material';

import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { AuditLogService, AuditLogFilters } from '../../services/auditLogService';
import { AuditLog } from '../../types';
import { format } from 'date-fns';

const AuditLogsPage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  // State
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Filters
  const [filters, setFilters] = useState<AuditLogFilters>({});
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Load audit logs
  const loadAuditLogs = useCallback(async () => {
    try {
      setLoading(true);
      
      const dateFilters: AuditLogFilters = { ...filters };
      if (startDate) {
        dateFilters.start_date = new Date(startDate).toISOString();
      }
      if (endDate) {
        dateFilters.end_date = new Date(endDate).toISOString();
      }

      const result = await AuditLogService.getAuditLogs(
        page + 1,
        rowsPerPage,
        dateFilters
      );

      console.log('Audit logs result:', result);

      if (result && Array.isArray(result.logs)) {
        setAuditLogs(result.logs);
        setTotal(result.total || 0);
      } else {
        console.error('Invalid audit logs response:', result);
        setAuditLogs([]);
        setTotal(0);
      }
    } catch (error: any) {
      console.error('Error loading audit logs:', error);
      enqueueSnackbar(error.message || 'Failed to load audit logs', { variant: 'error' });
      setAuditLogs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, filters, startDate, endDate, enqueueSnackbar]);

  useEffect(() => {
    loadAuditLogs();
  }, [loadAuditLogs]);

  // Handlers
  const handlePageChange = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleRowsPerPageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleFilterChange = (key: keyof AuditLogFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value || undefined,
    }));
    setPage(0);
  };

  const handleRefresh = () => {
    loadAuditLogs();
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'yyyy-MM-dd HH:mm:ss');
    } catch {
      return dateString;
    }
  };

  const formatDetails = (details: any) => {
    if (!details) return '-';
    if (typeof details === 'string') return details;
    return JSON.stringify(details, null, 2);
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="h4" sx={{ fontWeight: 600 }}>
            {t('auditLogs.title')}
          </Typography>
          <Tooltip title={t('common.refresh')}>
            <IconButton onClick={handleRefresh} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
        <Typography variant="body1" color="text.secondary">
          {t('auditLogs.subtitle')}
        </Typography>
      </Box>

        {/* Filters */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel shrink={!!filters.action || filters.action === ''}>{t('auditLogs.action')}</InputLabel>
                <Select
                  value={filters.action || ''}
                  label={t('auditLogs.action')}
                  onChange={(e) => handleFilterChange('action', e.target.value)}
                  displayEmpty
                >
                  <MenuItem value="">{t('auditLogs.allActions')}</MenuItem>
                  {AuditLogService.getAvailableActions().map((action) => (
                    <MenuItem key={action} value={action}>
                      {AuditLogService.formatActionName(action)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel shrink={!!filters.resource_type || filters.resource_type === ''}>{t('auditLogs.resourceType')}</InputLabel>
                <Select
                  value={filters.resource_type || ''}
                  label={t('auditLogs.resourceType')}
                  onChange={(e) => handleFilterChange('resource_type', e.target.value)}
                  displayEmpty
                >
                  <MenuItem value="">{t('auditLogs.allTypes')}</MenuItem>
                  {AuditLogService.getAvailableResourceTypes().map((type) => (
                    <MenuItem key={type} value={type}>
                      {AuditLogService.formatResourceType(type)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                label={t('auditLogs.startDate')}
                type="date"
                fullWidth
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                InputLabelProps={{
                  shrink: true,
                }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                label={t('auditLogs.endDate')}
                type="date"
                fullWidth
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                InputLabelProps={{
                  shrink: true,
                }}
              />
            </Grid>
          </Grid>
          </CardContent>
        </Card>

        {/* Audit Logs Table */}
        <Card>
          {loading && <LinearProgress />}
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t('auditLogs.id')}</TableCell>
                  <TableCell>{t('auditLogs.user')}</TableCell>
                  <TableCell>{t('auditLogs.action')}</TableCell>
                  <TableCell>{t('auditLogs.resource')}</TableCell>
                  <TableCell>{t('auditLogs.ipAddress')}</TableCell>
                  <TableCell>{t('auditLogs.date')}</TableCell>
                  <TableCell>{t('auditLogs.details')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {auditLogs.length === 0 && !loading ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 8 }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                        <Typography variant="h6" color="text.secondary">
                          {t('auditLogs.noLogsFound')}
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                ) : (
                  auditLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>{log.id}</TableCell>
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
                        <Chip
                          label={AuditLogService.formatActionName(log.action)}
                          color={AuditLogService.getActionColor(log.action)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {log.resource_type && (
                          <Box>
                            <Typography variant="body2">
                              {AuditLogService.formatResourceType(log.resource_type)}
                            </Typography>
                            {log.resource_id && (
                              <Typography variant="caption" color="text.secondary">
                                ID: {log.resource_id}
                              </Typography>
                            )}
                          </Box>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace">
                          {log.ip_address || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatDate(log.created_at)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Tooltip title={formatDetails(log.details)}>
                          <IconButton size="small">
                            <InfoIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            rowsPerPageOptions={[5, 10, 25, 50]}
            component="div"
            count={total}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handlePageChange}
            onRowsPerPageChange={handleRowsPerPageChange}
          />
        </Card>
      </Box>
  );
};

export default AuditLogsPage;
