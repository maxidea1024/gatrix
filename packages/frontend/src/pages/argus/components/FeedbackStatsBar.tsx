import React, { useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  Collapse,
  alpha,
  Tooltip,
} from '@mui/material';
import { Bar } from 'react-chartjs-2';
import { useTranslation } from 'react-i18next';
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
  /** Chart ref forwarded from parent for drag selection */
  chartRef: React.MutableRefObject<any>;
  trendChartData: any;
  chartOpts: any;
  isDragging: boolean;
  dragStart: number | null;
  dragEnd: number | null;
  onChartMouseDown: (e: React.MouseEvent<HTMLElement>) => void;
  onChartMouseMove: (e: React.MouseEvent<HTMLElement>) => void;
  onChartMouseUp: () => void;
  onChartReset: () => void;
}

const FeedbackStatsBar: React.FC<FeedbackStatsBarProps> = ({
  isDark,
  statsCollapsed,
  loading,
  statCards,
  chartRef,
  trendChartData,
  chartOpts,
  isDragging,
  dragStart,
  dragEnd,
  onChartMouseDown,
  onChartMouseMove,
  onChartMouseUp,
  onChartReset,
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
      {/* Volume Chart */}
      <Paper
        elevation={0}
        sx={{
          p: 1.5,
          mb: 1.5,
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          borderRadius: 2,
          position: 'relative',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 0.5,
          }}
        >
          <Typography
            variant="caption"
            sx={{
              fontSize: '0.68rem',
              color: 'text.secondary',
              fontWeight: 600,
            }}
          >
            {t('argus.feedback.volumeChart')}
          </Typography>
          {dragStart !== null && dragEnd !== null && (
            <Chip
              label={t('argus.feedback.clearSelection')}
              size="small"
              onDelete={onChartReset}
              sx={{
                height: 18,
                fontSize: '0.6rem',
                '& .MuiChip-deleteIcon': { fontSize: 12 },
              }}
            />
          )}
        </Box>
        <Box
          sx={{ height: 80, cursor: 'crosshair', userSelect: 'none' }}
          onMouseDown={onChartMouseDown}
          onMouseMove={onChartMouseMove}
          onMouseUp={onChartMouseUp}
          onMouseLeave={() => {
            if (isDragging) onChartMouseUp();
          }}
        >
          <Bar
            ref={chartRef}
            data={trendChartData}
            options={chartOpts as any}
          />
        </Box>
        {isDragging && (
          <Typography
            variant="caption"
            sx={{
              position: 'absolute',
              bottom: 4,
              right: 8,
              fontSize: '0.58rem',
              color: 'text.disabled',
            }}
          >
            {t('argus.feedback.dragToSelect')}
          </Typography>
        )}
      </Paper>
    </Collapse>
  );
};

export default FeedbackStatsBar;
