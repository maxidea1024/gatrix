import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Chip,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { usePageState } from '../../hooks/usePageState';
import SimplePagination from '../../components/common/SimplePagination';
import api from '@/services/api';

interface MonitoringAlert {
  id: string;
  alertName: string;
  alertSeverity: string;
  alertStatus: string;
  alertMessage?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
}

const AlertsPage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  const { pageState, updatePage, updateLimit } = usePageState({
    defaultState: {
      page: 1,
      limit: 10,
      filters: {},
    },
    storageKey: 'monitoringAlertsPage',
  });

  const [alerts, setAlerts] = useState<MonitoringAlert[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const loadAlerts = useCallback(async () => {
    try {
      setLoading(true);

      const params = {
        page: pageState.page,
        limit: pageState.limit,
      };

      const result = await api.get('/admin/monitoring/alerts', {
        params,
      });

      const data = result?.data;

      if (data && Array.isArray(data.items)) {
        setAlerts(data.items);
        setTotal(data.pagination?.total || 0);
      } else {
        setAlerts([]);
        setTotal(0);
      }
    } catch (error: any) {
      // eslint-disable-next-line no-console
      console.error('Failed to load monitoring alerts', error);
      enqueueSnackbar(error.message || t('monitoring.alerts.loadFailed'), {
        variant: 'error',
      });
      setAlerts([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar, pageState.limit, pageState.page, t]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const handlePageChange = (_event: unknown, newPage: number) => {
    updatePage(newPage + 1);
  };

  const handleRowsPerPageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    updateLimit(parseInt(event.target.value, 10));
  };

  const renderSeverityChip = (severity: string) => {
    const color: 'default' | 'primary' | 'success' | 'warning' | 'error' =
      severity === 'critical'
        ? 'error'
        : severity === 'warning'
          ? 'warning'
          : severity === 'info'
            ? 'primary'
            : 'default';

    return (
      <Chip
        size="small"
        label={severity}
        color={color}
        variant={color === 'default' ? 'outlined' : 'filled'}
      />
    );
  };

  const renderStatusChip = (status: string) => {
    const color: 'default' | 'primary' | 'success' | 'warning' | 'error' =
      status === 'firing' ? 'error' : status === 'resolved' ? 'success' : 'default';

    return (
      <Chip
        size="small"
        label={status}
        color={color}
        variant={color === 'default' ? 'outlined' : 'filled'}
      />
    );
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {t('monitoring.alerts.title')}
            </Typography>
          </Box>
        </Box>
        <Typography variant="caption" color="text.secondary">
          {t('monitoring.alerts.subtitle')}
        </Typography>
      </Box>

      <Card>
        <CardContent>
          {loading ? (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: 200,
              }}
            >
              <CircularProgress size={32} />
            </Box>
          ) : (
            <>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>{t('monitoring.alerts.fields.name')}</TableCell>
                      <TableCell>{t('monitoring.alerts.fields.severity')}</TableCell>
                      <TableCell>{t('monitoring.alerts.fields.status')}</TableCell>
                      <TableCell>{t('monitoring.alerts.fields.message')}</TableCell>
                      <TableCell>{t('monitoring.alerts.fields.startsAt')}</TableCell>
                      <TableCell>{t('monitoring.alerts.fields.endsAt')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {alerts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} align="center">
                          <Typography variant="body2" color="text.secondary">
                            {t('common.noData')}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      alerts.map((alert) => (
                        <TableRow key={alert.id} hover>
                          <TableCell>{alert.alertName}</TableCell>
                          <TableCell>{renderSeverityChip(alert.alertSeverity)}</TableCell>
                          <TableCell>{renderStatusChip(alert.alertStatus)}</TableCell>
                          <TableCell>{alert.alertMessage}</TableCell>
                          <TableCell>
                            {alert.startsAt ? new Date(alert.startsAt).toLocaleString() : '-'}
                          </TableCell>
                          <TableCell>
                            {alert.endsAt ? new Date(alert.endsAt).toLocaleString() : '-'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              <SimplePagination
                count={total}
                page={pageState.page - 1}
                rowsPerPage={pageState.limit}
                onPageChange={handlePageChange}
                onRowsPerPageChange={handleRowsPerPageChange}
                rowsPerPageOptions={[5, 10, 25, 50, 100]}
              />
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default AlertsPage;
