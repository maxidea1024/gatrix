import React from 'react';
import {
  Box, Typography, Paper,
  FormControl, Select, MenuItem,
  Table, TableHead, TableBody, TableRow, TableCell,
  useTheme, alpha,
} from '@mui/material';
import { ViewColumn as ViewIcon } from '@mui/icons-material';
import { Bar } from 'react-chartjs-2';
import { useTranslation } from 'react-i18next';
import PageContentLoader from '@/components/common/PageContentLoader';
import EmptyPlaceholder from '@/components/common/EmptyPlaceholder';

interface AggData {
  groupBy: string;
  topValues: { group_value: string; count: number }[];
  timeSeries: { bucket: string; group_value: string; count: number }[];
}

export interface LogsAggregatePanelProps {
  aggData: AggData | null;
  aggGroupBy: string;
  aggLoading: boolean;
  isDark: boolean;
  onGroupByChange: (val: string) => void;
  onAddFilter: (key: string, val: string) => void;
}

const CHART_COLORS = ['#7c4dff', '#448aff', '#00bcd4', '#ff9800', '#f44336', '#4caf50', '#9c27b0'];

const LogsAggregatePanel: React.FC<LogsAggregatePanelProps> = ({
  aggData,
  aggGroupBy,
  aggLoading,
  isDark,
  onGroupByChange,
  onAddFilter,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <Paper elevation={0} sx={{
      borderRadius: 2, overflow: 'hidden',
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
    }}>
      {/* Toolbar */}
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1,
        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        backgroundColor: isDark ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.01)',
      }}>
        <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'text.secondary' }}>
          {t('argus.logs.groupByLabel', 'Group by')}
        </Typography>
        <FormControl size="small" variant="outlined" sx={{ minWidth: 130 }}>
          <Select value={aggGroupBy} onChange={(e) => onGroupByChange(e.target.value)}
            sx={{ fontSize: '0.75rem', fontWeight: 600, height: 28, '& .MuiSelect-select': { py: 0.5 } }}>
            <MenuItem value="level" sx={{ fontSize: '0.75rem' }}>{t('argus.logs.agg.level', 'Severity')}</MenuItem>
            <MenuItem value="service" sx={{ fontSize: '0.75rem' }}>{t('argus.logs.agg.service', 'Service')}</MenuItem>
            <MenuItem value="environment" sx={{ fontSize: '0.75rem' }}>{t('argus.logs.agg.environment', 'Environment')}</MenuItem>
            <MenuItem value="logger_name" sx={{ fontSize: '0.75rem' }}>{t('argus.logs.agg.logger', 'Logger')}</MenuItem>
            <MenuItem value="release" sx={{ fontSize: '0.75rem' }}>{t('argus.logs.agg.release', 'Release')}</MenuItem>
          </Select>
        </FormControl>
        <Box sx={{ flex: 1 }} />
        {aggData && (
          <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled' }}>
            {aggData.topValues.length} {t('argus.logs.agg.groups', 'groups')}
          </Typography>
        )}
      </Box>

      <PageContentLoader loading={aggLoading}>
        {aggData && aggData.topValues.length > 0 ? (
          <Box>
            {/* Stacked time series chart */}
            {aggData.timeSeries.length > 0 && (
              <Box sx={{ p: 2, pb: 1 }}>
                <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: 'text.secondary', mb: 1 }}>
                  {t('argus.logs.agg.countOverTime', 'Count over time')}
                </Typography>
                <Box sx={{ height: 150 }}>
                  <Bar
                    data={(() => {
                      const groups = [...new Set(aggData.timeSeries.map(d => d.group_value))];
                      const buckets = [...new Set(aggData.timeSeries.map(d => d.bucket))].sort();
                      const labels = buckets.map(b => {
                        const d = new Date(b);
                        return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
                      });
                      const datasets = groups.map((g, gi) => ({
                        label: g || '(empty)',
                        data: buckets.map(b => {
                          const found = aggData.timeSeries.find(d => d.bucket === b && d.group_value === g);
                          return found ? Number(found.count) : 0;
                        }),
                        backgroundColor: alpha(CHART_COLORS[gi % CHART_COLORS.length], 0.7),
                        borderRadius: 1,
                        barPercentage: 0.9,
                        categoryPercentage: 0.92,
                      }));
                      return { labels, datasets };
                    })()}
                    options={{
                      responsive: true, maintainAspectRatio: false,
                      animation: { duration: 300 },
                      plugins: { legend: { display: true, position: 'top', labels: { boxWidth: 10, font: { size: 10 } } }, tooltip: { enabled: true } },
                      scales: {
                        x: { stacked: true, grid: { display: false }, ticks: { font: { size: 9 }, color: isDark ? '#555' : '#bbb', maxTicksLimit: 8 }, border: { display: false } },
                        y: { stacked: true, grid: { color: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 9 }, color: isDark ? '#555' : '#bbb' }, border: { display: false }, beginAtZero: true },
                      },
                    }}
                  />
                </Box>
              </Box>
            )}

            {/* Top values table */}
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', borderBottom: `2px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
                      {aggGroupBy}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', borderBottom: `2px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
                      {t('argus.logs.agg.count', 'Count')}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', borderBottom: `2px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, width: '40%' }}>
                      {t('argus.logs.agg.percentage', '%')}
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(() => {
                    const total = aggData.topValues.reduce((s, v) => s + Number(v.count), 0);
                    return aggData.topValues.map((row, idx) => {
                      const pct = total > 0 ? (Number(row.count) / total) * 100 : 0;
                      return (
                        <TableRow key={idx} hover sx={{ cursor: 'pointer', '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.008)' } }}
                          onClick={() => onAddFilter(aggGroupBy, row.group_value)}
                        >
                          <TableCell sx={{ fontSize: '0.78rem', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}` }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: CHART_COLORS[idx % CHART_COLORS.length], flexShrink: 0 }} />
                              {row.group_value || '(empty)'}
                            </Box>
                          </TableCell>
                          <TableCell align="right" sx={{ fontSize: '0.78rem', fontWeight: 600, borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}` }}>
                            {Number(row.count).toLocaleString()}
                          </TableCell>
                          <TableCell sx={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}` }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Box sx={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', overflow: 'hidden' }}>
                                <Box sx={{ width: `${pct}%`, height: '100%', borderRadius: 3, backgroundColor: CHART_COLORS[idx % CHART_COLORS.length], transition: 'width 0.3s' }} />
                              </Box>
                              <Typography sx={{ fontSize: '0.68rem', color: 'text.disabled', minWidth: 35, textAlign: 'right' }}>
                                {pct.toFixed(1)}%
                              </Typography>
                            </Box>
                          </TableCell>
                        </TableRow>
                      );
                    });
                  })()}
                </TableBody>
              </Table>
            </Box>
          </Box>
        ) : !aggLoading ? (
          <EmptyPlaceholder
            icon={<ViewIcon sx={{ fontSize: 48 }} />}
            message={t('argus.logs.aggregatesTitle', 'Log Aggregates')}
            description={t('argus.logs.aggregatesDesc', 'Group and count logs by attributes to identify patterns.')}
            sx={{ flex: 1 }}
          />
        ) : null}
      </PageContentLoader>
    </Paper>
  );
};

export default LogsAggregatePanel;
