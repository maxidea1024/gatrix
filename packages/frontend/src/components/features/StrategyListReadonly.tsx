/**
 * StrategyListReadonly - Reusable component for displaying a read-only list of strategies
 *
 * Renders each strategy as a StrategyCardReadonly card with OR dividers between them.
 *
 * Used in:
 * - ReleaseFlowTab (active plan milestones, template selection cards)
 * - FeatureFlagDetailPage (environment strategy list - with headerActions for edit/delete)
 */
import React from 'react';
import { Box, Chip, Divider, Stack } from '@mui/material';
import StrategyCardReadonly, {
  StrategyData,
  StrategyCardReadonlyProps,
} from './StrategyCardReadonly';
import { ContextFieldInfo } from './ConstraintDisplay';

export interface StrategyListReadonlyProps {
  /** Array of strategies to display */
  strategies: StrategyData[];
  /** All available segments for lookup */
  allSegments?: any[];
  /** Context fields for constraint display */
  contextFields?: ContextFieldInfo[];
  /** Optional function to render header actions per strategy (edit/delete, etc.) */
  renderHeaderActions?: (strategy: StrategyData, index: number) => React.ReactNode;
  /** Optional function to render header prefix per strategy (drag handle, etc.) */
  renderHeaderPrefix?: (strategy: StrategyData, index: number) => React.ReactNode;
}

const StrategyListReadonly: React.FC<StrategyListReadonlyProps> = ({
  strategies,
  allSegments = [],
  contextFields = [],
  renderHeaderActions,
  renderHeaderPrefix,
}) => {
  if (!strategies || strategies.length === 0) {
    return null;
  }

  return (
    <Stack spacing={0}>
      {strategies.map((strategy, index) => (
        <React.Fragment key={index}>
          {/* OR divider between strategies */}
          {index > 0 && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                my: 0.5,
              }}
            >
              <Divider sx={{ flexGrow: 1, borderStyle: 'dashed' }} />
              <Chip
                label="OR"
                size="small"
                variant="outlined"
                color="secondary"
                sx={{
                  height: 18,
                  fontSize: '0.6rem',
                  fontWeight: 600,
                }}
              />
              <Divider sx={{ flexGrow: 1, borderStyle: 'dashed' }} />
            </Box>
          )}

          <StrategyCardReadonly
            strategy={strategy}
            allSegments={allSegments}
            contextFields={contextFields}
            headerActions={renderHeaderActions?.(strategy, index)}
            headerPrefix={renderHeaderPrefix?.(strategy, index)}
          />
        </React.Fragment>
      ))}
    </Stack>
  );
};

export default StrategyListReadonly;
