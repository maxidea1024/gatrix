import React from 'react';
import { Box, Typography, Stack, Paper, Chip } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { ReleaseFlowTemplate } from '../../services/releaseFlowService';
import StrategyDetail from './StrategyDetail';
import { ContextFieldInfo } from './ConstraintDisplay';

interface ReleaseFlowTemplatePreviewProps {
  template: ReleaseFlowTemplate;
  allSegments: any[];
  contextFields: ContextFieldInfo[];
}

const STRATEGY_TYPES = [
  { name: 'flexibleRollout', titleKey: 'featureFlags.strategies.flexibleRollout.title' },
  { name: 'userWithId', titleKey: 'featureFlags.strategies.userWithId.title' },
  { name: 'gradualRolloutRandom', titleKey: 'featureFlags.strategies.gradualRolloutRandom.title' },
  { name: 'gradualRolloutUserId', titleKey: 'featureFlags.strategies.gradualRolloutUserId.title' },
  { name: 'remoteAddress', titleKey: 'featureFlags.strategies.remoteAddress.title' },
  { name: 'applicationHostname', titleKey: 'featureFlags.strategies.applicationHostname.title' },
];

const ReleaseFlowTemplatePreview: React.FC<ReleaseFlowTemplatePreviewProps> = ({
  template,
  allSegments,
  contextFields,
}) => {
  const { t } = useTranslation();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header Area */}
      <Box>
        <Typography variant="h6" fontWeight={700}>
          {template.displayName || template.flowName}
        </Typography>
        {template.description && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {template.description}
          </Typography>
        )}
      </Box>

      {/* Milestones List */}
      <Stack spacing={3}>
        {template.milestones?.map((milestone, mIdx) => (
          <Paper key={mIdx} variant="outlined" sx={{ p: 2, bgcolor: 'background.paper' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Chip label={mIdx + 1} size="small" color="primary" />
              <Typography variant="subtitle2" fontWeight={700}>
                {milestone.name}
              </Typography>
            </Box>

            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ mb: 1.5, display: 'block', fontWeight: 600 }}
            >
              {t('releaseFlow.strategies').toUpperCase()} ({milestone.strategies?.length || 0})
            </Typography>

            <Stack spacing={2}>
              {milestone.strategies?.map((strategy, sIdx) => {
                const strategyType = STRATEGY_TYPES.find((st) => st.name === strategy.strategyName);
                return (
                  <Paper key={sIdx} variant="outlined" sx={{ p: 0, overflow: 'hidden' }}>
                    {/* Strategy Header - Identical to Editor */}
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        px: 2,
                        py: 1,
                        bgcolor: 'action.hover',
                        borderBottom: 1,
                        borderColor: 'divider',
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip
                          label={sIdx + 1}
                          size="small"
                          color="primary"
                          sx={{ height: 20, minWidth: 20 }}
                        />
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                          {t(
                            strategyType?.titleKey ||
                              'featureFlags.strategies.flexibleRollout.title'
                          )}
                        </Typography>
                        {strategy.strategyName === 'flexibleRollout' && (
                          <Chip
                            label={`${strategy.parameters?.rollout ?? 100}%`}
                            size="small"
                            color="success"
                            variant="outlined"
                            sx={{ height: 20 }}
                          />
                        )}
                      </Box>
                    </Box>

                    {/* Strategy Content - Concise Read-only View matching Editor's visual layout */}
                    <Box sx={{ p: 2 }}>
                      <StrategyDetail
                        strategyName={strategy.strategyName}
                        parameters={strategy.parameters}
                        constraints={strategy.constraints}
                        segments={strategy.segments}
                        allSegments={allSegments}
                        contextFields={contextFields}
                      />
                    </Box>
                  </Paper>
                );
              })}
            </Stack>
          </Paper>
        ))}
      </Stack>
    </Box>
  );
};

export default ReleaseFlowTemplatePreview;
