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
  Paper,
  Button,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import ResizableDrawer from '@/components/common/ResizableDrawer';
import argusService from '@/services/argusService';

interface ArgusAnalyticsDrilldownDrawerProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  eventName: string;
  dateRange: { start: Date; end: Date };
  globalFilters?: { property: string; operator: string; value: string }[];
  breakdownProperty?: string;
  breakdownValue?: string;
}

export const ArgusAnalyticsDrilldownDrawer: React.FC<ArgusAnalyticsDrilldownDrawerProps> = ({
  open,
  onClose,
  projectId,
  eventName,
  dateRange,
  globalFilters,
  breakdownProperty,
  breakdownValue,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Record<string, any>[]>([]);
  const [selectedRow, setSelectedRow] = useState<Record<string, any> | null>(null);

  const fetchDrilldownData = useCallback(async () => {
    if (!open || !eventName) return;
    setLoading(true);
    try {
      const conditionsParts = [`event_name:"${eventName}"`];

      // Append global filters
      if (globalFilters) {
        globalFilters.forEach((f) => {
          if (f.property && f.value) {
            if (f.operator === 'is') {
              conditionsParts.push(`${f.property}:"${f.value}"`);
            } else if (f.operator === 'is_not') {
              conditionsParts.push(`!${f.property}:"${f.value}"`);
            } else if (f.operator === 'contains') {
              conditionsParts.push(`${f.property}:*${f.value}*`);
            } else if (f.operator === 'not_contains') {
              conditionsParts.push(`!${f.property}:*${f.value}*`);
            }
          }
        });
      }

      // Append breakdown filter
      if (breakdownProperty && breakdownValue) {
        conditionsParts.push(`${breakdownProperty}:"${breakdownValue}"`);
      }

      const conditions = conditionsParts.join(' ');

      const result = await argusService.discoverQuery(projectId, {
        fields: ['timestamp', 'user_id', 'event_name', 'level', 'service', 'span_id', 'trace_id', 'message'],
        conditions: conditions || undefined,
        period: 'custom',
        start: dateRange.start.toISOString(),
        end: dateRange.end.toISOString(),
        limit: 100,
        dataset: 'spans',
      });
      setData(result.data || []);
    } catch (err) {
      console.error('Failed to fetch drilldown data', err);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [open, projectId, eventName, dateRange, globalFilters, breakdownProperty, breakdownValue]);

  useEffect(() => {
    fetchDrilldownData();
  }, [fetchDrilldownData]);

  const formatTimestamp = (ts: string) => {
    try {
      const date = new Date(ts);
      return date.toLocaleString();
    } catch {
      return ts;
    }
  };

  const truncateString = (str: string, len: number = 20) => {
    if (!str) return '';
    return str.length > len ? `${str.slice(0, len)}...` : str;
  };

  return (
    <>
      <ResizableDrawer
        open={open}
        onClose={onClose}
        title={t('argus.analytics.drilldown.title', 'Event Drilldown')}
        subtitle={`${eventName} (${formatTimestamp(dateRange.start.toISOString())} ~ ${formatTimestamp(dateRange.end.toISOString())})`}
        storageKey="argus-analytics-drilldown-drawer"
        defaultWidth={650}
      >
        <Box sx={{ p: 2, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
              <CircularProgress size={40} />
            </Box>
          ) : data.length === 0 ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
              <Typography color="text.secondary">
                {t('argus.analytics.drilldown.noData', 'No raw events found for the selected timeframe.')}
              </Typography>
            </Box>
          ) : (
            <TableContainer component={Paper} elevation={0} sx={{ flex: 1, overflowY: 'auto', border: `1px solid ${theme.palette.divider}` }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>{t('argus.analytics.drilldown.colTime', 'Time')}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{t('argus.analytics.drilldown.colUser', 'User ID')}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{t('argus.analytics.drilldown.colLevel', 'Level')}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>{t('argus.analytics.drilldown.colAction', 'Action')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.map((row, idx) => (
                    <TableRow key={row.span_id || idx} hover>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatTimestamp(row.timestamp)}</TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                          {truncateString(row.user_id, 12)}
                        </Typography>
                      </TableCell>
                      <TableCell>{row.level || '-'}</TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => setSelectedRow(row)}
                          sx={{ textTransform: 'none', py: 0 }}
                        >
                          {t('argus.analytics.drilldown.btnView', 'View')}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      </ResizableDrawer>

      {/* Row detail dialog */}
      <Dialog
        open={!!selectedRow}
        onClose={() => setSelectedRow(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 600 }}>
          {t('argus.analytics.drilldown.rowDetailTitle', 'Event Detail')}
        </DialogTitle>
        <DialogContent dividers>
          {selectedRow && (
            <Box
              component="pre"
              sx={{
                m: 0,
                p: 2,
                borderRadius: 1,
                bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                border: `1px solid ${theme.palette.divider}`,
                fontFamily: 'monospace',
                fontSize: '0.85rem',
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              {JSON.stringify(selectedRow, null, 2)}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setSelectedRow(null)} variant="contained" size="small">
            {t('argus.analytics.drilldown.btnClose', 'Close')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
