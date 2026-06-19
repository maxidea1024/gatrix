import React from 'react';
import {
  Box,
  Typography,
  Paper,
  useTheme,
  alpha,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import PageContentLoader from '@/components/common/PageContentLoader';
import { TableSkeleton } from '@/components/argus/ArgusSkeletons';
import ArgusChartSkeleton from '@/components/argus/ArgusChartSkeleton';
import EmptyPlaceholder from '@/components/common/EmptyPlaceholder';
import { formatDateTimeUI } from '@/utils/dateFormat';
import { ChartDataset } from '@/components/argus/InteractiveTimeSeriesChart';
import {
  MetricChart,
  formatMetricValue,
  parseChDate,
  type MetricQuery,
  type ChartConfig,
} from '../metricsHelpers';

interface MetricsViewsProps {
  viewMode: 'aggregates' | 'samples';
  queryLoading: boolean;
  samplesLoading: boolean;
  displayedData: {
    chartLabels: string[];
    chartDatasets: ChartDataset[];
    buckets: string[];
    queries: MetricQuery[];
    metricUnits: Record<string, string>;
    metricTypes: Record<string, string>;
    totalSamples: number;
  };
  displayedSamplesData: any[];
  chartConfig: ChartConfig;
  onZoom: (start: string, end: string) => void;
  onPointClick: (timestamp: string, label: string) => void;
}

export const MetricsViews: React.FC<MetricsViewsProps> = ({
  viewMode,
  queryLoading,
  samplesLoading,
  displayedData,
  displayedSamplesData,
  chartConfig,
  onZoom,
  onPointClick,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';

  if (viewMode === 'aggregates') {
    return (
      <Box
        sx={{
          position: 'relative',
          opacity: queryLoading ? 0.65 : 1,
          transition: 'opacity 0.15s ease-in-out',
          pointerEvents: queryLoading ? 'none' : 'auto',
        }}
      >
        {/* ═══ Chart ═══ */}
        <PageContentLoader
          loading={queryLoading && displayedData.chartLabels.length === 0}
          skeleton={
            <ArgusChartSkeleton
              type={chartConfig.type === 'bar' ? 'bar' : 'line'}
              height={300}
              color={theme.palette.primary.main}
            />
          }
        >
          <MetricChart
            labels={displayedData.chartLabels}
            datasets={displayedData.chartDatasets}
            isDark={isDark}
            onZoom={onZoom}
            config={chartConfig}
            buckets={displayedData.buckets}
            onPointClick={onPointClick}
          />
        </PageContentLoader>

        {/* ═══ Aggregated Data Table ═══ */}
        {displayedData.chartLabels.length > 0 && (
          <Paper
            elevation={0}
            sx={{
              borderRadius: 2,
              overflow: 'hidden',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            }}
          >
            <Table
              size="small"
              sx={{
                '& td, & th': {
                  borderColor: isDark
                    ? 'rgba(255,255,255,0.04)'
                    : 'rgba(0,0,0,0.04)',
                },
              }}
            >
              <TableHead>
                <TableRow>
                  <TableCell
                    sx={{
                      fontWeight: 700,
                      fontSize: '0.7rem',
                      textTransform: 'uppercase',
                      py: 1,
                    }}
                  >
                    {t('argus.metrics.timestamp', 'TIMESTAMP')}
                  </TableCell>
                  {displayedData.chartDatasets.map((ds) => (
                    <TableCell
                      key={ds.id}
                      sx={{
                        fontWeight: 700,
                        fontSize: '0.7rem',
                        textTransform: 'uppercase',
                        py: 1,
                        color: ds.color,
                      }}
                    >
                      {ds.label}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {displayedData.chartLabels.slice(0, 100).map((label, idx) => {
                  return (
                    <TableRow key={idx} hover>
                      <TableCell sx={{ py: 0.6 }}>
                        <Typography
                          sx={{ fontSize: '0.73rem', color: 'text.secondary' }}
                        >
                          {formatDateTimeUI(
                            parseChDate(displayedData.buckets[idx])
                          )}
                        </Typography>
                      </TableCell>
                      {displayedData.chartDatasets.map((ds) => {
                        const qId = ds.id.split('_')[0];
                        const queryObj = displayedData.queries.find(
                          (q) => q.id === qId
                        );
                        const metricName = queryObj?.metric;
                        const unit = metricName
                          ? displayedData.metricUnits[metricName]
                          : undefined;
                        const metricType = metricName
                          ? displayedData.metricTypes[metricName]
                          : undefined;
                        return (
                          <TableCell key={ds.id} sx={{ py: 0.6 }}>
                            <Typography
                              sx={{ fontSize: '0.73rem', fontWeight: 600 }}
                            >
                              {formatMetricValue(
                                Number(ds.data[idx]),
                                unit,
                                metricType
                              )}
                            </Typography>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Paper>
        )}
      </Box>
    );
  }

  // ─── Samples View ───
  return (
    <Box
      sx={{
        position: 'relative',
        opacity: samplesLoading ? 0.65 : 1,
        transition: 'opacity 0.15s ease-in-out',
        pointerEvents: samplesLoading ? 'none' : 'auto',
      }}
    >
      <PageContentLoader
        loading={samplesLoading && displayedSamplesData.length === 0}
        skeleton={<TableSkeleton rows={10} cols={7} />}
      >
        {displayedSamplesData.length === 0 ? (
          <EmptyPlaceholder
            message={t(
              'argus.metrics.noSamples',
              'No metric samples found. Select a metric to view individual events.'
            )}
            minHeight={200}
          />
        ) : (
          <Paper
            elevation={0}
            sx={{
              borderRadius: 2,
              overflow: 'hidden',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            }}
          >
            <Table
              size="small"
              sx={{
                '& td, & th': {
                  borderColor: isDark
                    ? 'rgba(255,255,255,0.04)'
                    : 'rgba(0,0,0,0.04)',
                },
              }}
            >
              <TableHead>
                <TableRow>
                  {[
                    'Timestamp',
                    'Name',
                    'Type',
                    'Value',
                    'Unit',
                    'Environment',
                    'Release',
                  ].map((h) => (
                    <TableCell
                      key={h}
                      sx={{
                        fontWeight: 700,
                        fontSize: '0.7rem',
                        textTransform: 'uppercase',
                        py: 1,
                      }}
                    >
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {displayedSamplesData.map((row, idx) => {
                  const valRaw =
                    typeof row.value === 'object'
                      ? JSON.stringify(row.value)
                      : row.value;
                  return (
                    <TableRow key={idx} hover>
                      <TableCell sx={{ py: 0.6 }}>
                        <Typography
                          sx={{ fontSize: '0.73rem', color: 'text.secondary' }}
                        >
                          {formatDateTimeUI(row.timestamp)}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ py: 0.6 }}>
                        <Typography
                          sx={{ fontSize: '0.73rem', fontWeight: 600 }}
                        >
                          {row.name}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ py: 0.6 }}>
                        <Typography
                          sx={{
                            fontSize: '0.7rem',
                            px: 0.8,
                            py: 0.2,
                            borderRadius: 1,
                            backgroundColor: alpha(
                              theme.palette.primary.main,
                              0.08
                            ),
                            display: 'inline-block',
                          }}
                        >
                          {row.metric_type}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ py: 0.6 }}>
                        <Typography
                          sx={{ fontSize: '0.73rem', fontWeight: 600 }}
                        >
                          {formatMetricValue(
                            Number(valRaw),
                            row.unit,
                            row.metric_type
                          )}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ py: 0.6 }}>
                        <Typography
                          sx={{ fontSize: '0.73rem', color: 'text.secondary' }}
                        >
                          {row.unit || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ py: 0.6 }}>
                        <Typography sx={{ fontSize: '0.73rem' }}>
                          {row.environment || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ py: 0.6 }}>
                        <Typography sx={{ fontSize: '0.73rem' }}>
                          {row.release || '—'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Paper>
        )}
      </PageContentLoader>
    </Box>
  );
};
