import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Collapse,
  alpha,
  Tooltip,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import ArgusVolumeChart from '@/components/argus/ArgusVolumeChart';
import { ChartDataset } from '@/components/argus/InteractiveTimeSeriesChart';
import {
  formatCompactNumber,
  formatWithCommas,
  needsCompactTooltip,
} from '@/utils/numberFormat';

interface StatCard {
  icon: React.ReactElement;
  color: string;
  label: string;
  value: number | string | undefined;
}

interface FeedbackStatsBarProps {
  isDark: boolean;
  statsCollapsed: boolean;
  loading: boolean;
  statCards: StatCard[];
  /** Volume chart data: labels + datasets */
  chartLabels: string[];
  chartRawPeriods?: string[];
  chartDatasets: ChartDataset[];
  /** Drag-select zoom callback */
  onZoom?: (startIndex: number, endIndex: number) => void;
}

const FeedbackStatsBar: React.FC<FeedbackStatsBarProps> = ({
  isDark,
  statsCollapsed,
  loading,
  statCards,
  chartLabels,
  chartRawPeriods,
  chartDatasets,
  onZoom,
}) => {
  const { t } = useTranslation();

  return (
    <Collapse in={!statsCollapsed} sx={{ flexShrink: 0 }}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
          gap: 1.5,
          mb: 1.5,
        }}
      >
        {statCards.map((card, idx) => (
          <Paper
            key={idx}
            elevation={0}
            sx={{
              p: 1.5,
              background: isDark
                ? `linear-gradient(135deg, ${alpha(card.color, 0.12)}, ${alpha(card.color, 0.03)})`
                : `linear-gradient(135deg, ${alpha(card.color, 0.06)}, ${alpha(card.color, 0.01)})`,
              border: `1px solid ${alpha(card.color, 0.2)}`,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: 1.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: alpha(card.color, isDark ? 0.2 : 0.1),
                color: card.color,
              }}
            >
              {React.cloneElement(card.icon, { sx: { fontSize: 16 } })}
            </Box>
            <Box>
              <Tooltip
                title={
                  typeof card.value === 'number' &&
                  needsCompactTooltip(card.value)
                    ? formatWithCommas(card.value)
                    : ''
                }
                arrow
                placement="top"
              >
                <Typography
                  variant="h6"
                  fontWeight={800}
                  sx={{ lineHeight: 1.1, fontSize: '0.95rem' }}
                >
                  {typeof card.value === 'number'
                    ? formatCompactNumber(card.value)
                    : (card.value ?? '-')}
                </Typography>
              </Tooltip>
              <Typography
                variant="caption"
                sx={{
                  color: isDark ? '#888' : '#777',
                  fontWeight: 500,
                  fontSize: '0.58rem',
                }}
              >
                {card.label}
              </Typography>
            </Box>
          </Paper>
        ))}
      </Box>

      {/* Volume Chart — unified ArgusVolumeChart */}
      <ArgusVolumeChart
        datasets={chartDatasets}
        rawPeriods={chartRawPeriods}
        labels={chartLabels}
        loading={loading && chartLabels.length === 0}
        title={t('argus.feedback.volumeChart')}
        emptyMessage={t('argus.feedback.noFeedback', 'No feedback data')}
        onZoom={onZoom}
        storagePrefix="argus_feedback_volume"
        showChartTypeToggle
        showCompactToggle
        mb={1.5}
      />
    </Collapse>
  );
};

export default FeedbackStatsBar;
