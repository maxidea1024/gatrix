/**
 * StrategyDetail - Reusable component for displaying strategy details (constraints, segments, rollout)
 */
import React from 'react';
import { Box, Typography, Chip, Paper, Stack } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { ArrowForward as AdvanceIcon } from '@mui/icons-material';
import { ConstraintList, ConstraintValue, ContextFieldInfo } from './ConstraintDisplay';

export interface StrategyDetailProps {
  strategyName: string;
  parameters?: any;
  constraints?: ConstraintValue[];
  segments?: string[];
  allSegments?: any[];
  contextFields?: ContextFieldInfo[];
  compact?: boolean;
}

const StrategyDetail: React.FC<StrategyDetailProps> = ({
  strategyName,
  parameters,
  constraints = [],
  segments = [],
  allSegments = [],
  contextFields = [],
  compact = false,
}) => {
  const { t } = useTranslation();

  const rollout = parameters?.rollout;
  const showRollout =
    rollout !== undefined &&
    (strategyName === 'flexibleRollout' ||
      strategyName === 'gradualRolloutRandom' ||
      strategyName === 'gradualRolloutUserId');

  // Strategy display name mapping (simplified)
  const getStrategyTitle = (name: string) => {
    return t(`featureFlags.strategies.${name}.title`, name);
  };

  if (compact) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.75 }}>
        <Typography
          variant="body2"
          sx={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          <AdvanceIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
          {getStrategyTitle(strategyName)}
        </Typography>
        {showRollout && (
          <Chip
            label={`${rollout}%`}
            size="small"
            color="primary"
            variant="outlined"
            sx={{ height: 18, fontSize: '0.7rem', fontWeight: 700 }}
          />
        )}
        {(segments.length > 0 || constraints.length > 0) && (
          <Typography variant="caption" color="text.secondary">
            ({segments.length + constraints.length} {t('featureFlags.conditions')})
          </Typography>
        )}
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {/* Strategy Header in Card */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography
          variant="body2"
          sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}
        >
          <AdvanceIcon sx={{ fontSize: 16, color: 'primary.main' }} />
          {getStrategyTitle(strategyName)}
        </Typography>
        {showRollout && (
          <Chip
            label={`${t('featureFlags.rollout')}: ${rollout}%`}
            size="small"
            color="primary"
            sx={{ fontWeight: 700, height: 20, fontSize: '0.7rem' }}
          />
        )}
      </Box>

      {/* Segments & Constraints Details */}
      {(segments.length > 0 || constraints.length > 0) && (
        <Paper
          variant="outlined"
          sx={{
            p: 1.5,
            bgcolor: 'action.hover',
            borderColor: 'divider',
            borderRadius: 1.5,
          }}
        >
          <Stack spacing={1}>
            {/* Segments */}
            {segments.map((segName) => {
              const segData = allSegments.find((s) => s.segmentName === segName);
              return (
                <Box key={segName} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography
                    variant="caption"
                    color="primary.main"
                    sx={{ fontWeight: 700, minWidth: 60 }}
                  >
                    {t('featureFlags.segment')}
                  </Typography>
                  <Chip
                    label={segData?.displayName || segName}
                    size="small"
                    sx={{ height: 20, fontSize: '0.7rem', bgcolor: 'background.paper' }}
                  />
                </Box>
              );
            })}

            {/* Constraints */}
            {constraints.length > 0 && (
              <Box>
                <ConstraintList constraints={constraints} contextFields={contextFields} />
              </Box>
            )}
          </Stack>
        </Paper>
      )}
    </Box>
  );
};

export default StrategyDetail;
