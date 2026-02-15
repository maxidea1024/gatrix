/**
 * StrategyDetail - Reusable component for displaying strategy details (constraints, segments, rollout)
 */
import React, { useState } from 'react';
import { Box, Typography, Chip, Paper, Stack, Collapse, Link } from '@mui/material';
import { useTranslation } from 'react-i18next';
import {
  ArrowForward as AdvanceIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { ConstraintList, ConstraintValue, ContextFieldInfo } from './ConstraintDisplay';

export interface StrategyDetailProps {
  strategyName: string;
  parameters?: any;
  constraints?: ConstraintValue[];
  segments?: string[];
  allSegments?: any[];
  contextFields?: ContextFieldInfo[];
  compact?: boolean;
  /** When true, shows compact summary with expand/collapse for full details */
  expandable?: boolean;
}

const StrategyDetail: React.FC<StrategyDetailProps> = ({
  strategyName,
  parameters,
  constraints = [],
  segments = [],
  allSegments = [],
  contextFields = [],
  compact = false,
  expandable = false,
}) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

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

  const hasStrategyParams =
    (strategyName === 'userWithId' && parameters?.userIds?.length > 0) ||
    (strategyName === 'remoteAddress' && parameters?.IPs?.length > 0) ||
    (strategyName === 'applicationHostname' && parameters?.hostNames?.length > 0);
  const hasDetails =
    segments.length > 0 || constraints.length > 0 || hasStrategyParams || showRollout;

  // Compact mode: inline summary
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
        {hasDetails && (
          <Typography variant="caption" color="text.secondary">
            ({segments.length + constraints.length} {t('featureFlags.conditions')})
          </Typography>
        )}
      </Box>
    );
  }

  // Expandable mode: compact header + collapsible details
  if (expandable) {
    return (
      <Box>
        {/* Header row */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography
              variant="body2"
              sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.5 }}
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
            {strategyName === 'userWithId' && (
              <Typography component="span" variant="body2" color="text.secondary">
                : {parameters?.userIds?.length || 0} {t('featureFlags.users')}
              </Typography>
            )}
            {strategyName === 'remoteAddress' && (
              <Typography component="span" variant="body2" color="text.secondary">
                : {parameters?.IPs?.length || 0} {t('featureFlags.addresses')}
              </Typography>
            )}
            {strategyName === 'applicationHostname' && (
              <Typography component="span" variant="body2" color="text.secondary">
                : {parameters?.hostNames?.length || 0} {t('featureFlags.hosts')}
              </Typography>
            )}
            {hasDetails && !expanded && (
              <Typography variant="caption" color="text.secondary">
                ({segments.length > 0 ? `${segments.length} ${t('featureFlags.segment')}` : ''}
                {segments.length > 0 && constraints.length > 0 ? ', ' : ''}
                {constraints.length > 0
                  ? `${constraints.length} ${t('featureFlags.conditions')}`
                  : ''}
                )
              </Typography>
            )}
          </Box>
          {hasDetails && (
            <Link
              component="button"
              variant="caption"
              underline="hover"
              onClick={() => setExpanded(!expanded)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.25,
                fontWeight: 600,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              {expanded ? (
                <>
                  {t('featureFlags.hide')}
                  <ExpandLessIcon sx={{ fontSize: 16 }} />
                </>
              ) : (
                <>
                  {t('featureFlags.showDetails')}
                  <ExpandMoreIcon sx={{ fontSize: 16 }} />
                </>
              )}
            </Link>
          )}
        </Box>

        {/* Expandable details */}
        <Collapse in={expanded} timeout={200}>
          <Paper
            variant="outlined"
            sx={{
              mt: 1,
              p: 1.5,
              bgcolor: 'action.hover',
              borderColor: 'divider',
              borderRadius: 1.5,
            }}
          >
            <Stack spacing={0.75}>
              {/* Segments */}
              {segments.map((segName, segIdx) => {
                const segData = allSegments.find((s) => s.segmentName === segName);
                return (
                  <React.Fragment key={segName}>
                    <Paper variant="outlined" sx={{ p: 1.25, bgcolor: 'background.paper' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
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
                          sx={{
                            height: 22,
                            fontSize: '0.75rem',
                            bgcolor: 'action.selected',
                            fontWeight: 500,
                          }}
                        />
                      </Box>
                    </Paper>
                    {/* AND marker */}
                    {(segIdx < segments.length - 1 || constraints.length > 0) && (
                      <Box sx={{ display: 'flex', alignItems: 'center', ml: 2 }}>
                        <Chip
                          label="AND"
                          size="small"
                          sx={{
                            height: 16,
                            fontSize: '0.6rem',
                            fontWeight: 700,
                            color: 'text.secondary',
                            border: 1,
                            borderColor: 'divider',
                            bgcolor: 'background.paper',
                          }}
                        />
                      </Box>
                    )}
                  </React.Fragment>
                );
              })}

              {/* Constraints */}
              {constraints.map((constraint, cIdx) => (
                <React.Fragment key={cIdx}>
                  <Paper variant="outlined" sx={{ p: 1.25, bgcolor: 'background.paper' }}>
                    <ConstraintList constraints={[constraint]} contextFields={contextFields} />
                  </Paper>
                  {/* AND marker between constraints */}
                  {cIdx < constraints.length - 1 && (
                    <Box sx={{ display: 'flex', alignItems: 'center', ml: 2 }}>
                      <Chip
                        label="AND"
                        size="small"
                        sx={{
                          height: 16,
                          fontSize: '0.6rem',
                          fontWeight: 700,
                          color: 'text.secondary',
                          border: 1,
                          borderColor: 'divider',
                          bgcolor: 'background.paper',
                        }}
                      />
                    </Box>
                  )}
                </React.Fragment>
              ))}

              {/* Rollout row */}
              {showRollout && (
                <>
                  {(segments.length > 0 || constraints.length > 0) && (
                    <Box sx={{ display: 'flex', alignItems: 'center', ml: 2 }}>
                      <Chip
                        label="AND"
                        size="small"
                        sx={{
                          height: 16,
                          fontSize: '0.6rem',
                          fontWeight: 700,
                          color: 'text.secondary',
                          border: 1,
                          borderColor: 'divider',
                          bgcolor: 'background.paper',
                        }}
                      />
                    </Box>
                  )}
                  <Paper variant="outlined" sx={{ p: 1.25, bgcolor: 'background.paper' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Typography
                        variant="caption"
                        color="warning.main"
                        sx={{ fontWeight: 700, minWidth: 60 }}
                      >
                        {t('featureFlags.rollout')}
                      </Typography>
                      <Chip
                        label={`${rollout}%`}
                        size="small"
                        color="primary"
                        sx={{ height: 22, fontSize: '0.75rem', fontWeight: 700 }}
                      />
                      <Typography variant="caption" color="text.secondary">
                        - {t('featureFlags.rolloutMatchingDesc')}
                      </Typography>
                    </Box>
                  </Paper>
                </>
              )}

              {/* UserIds row */}
              {strategyName === 'userWithId' && parameters?.userIds?.length > 0 && (
                <Paper variant="outlined" sx={{ p: 1.25, bgcolor: 'background.paper' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Typography
                      variant="caption"
                      color="primary.main"
                      sx={{ fontWeight: 700, minWidth: 60 }}
                    >
                      {t('featureFlags.strategies.userWithId.title')}
                    </Typography>
                    {parameters.userIds.map((uid: string) => (
                      <Chip
                        key={uid}
                        label={uid}
                        size="small"
                        sx={{
                          height: 22,
                          fontSize: '0.75rem',
                          bgcolor: 'action.selected',
                          fontWeight: 500,
                        }}
                      />
                    ))}
                  </Box>
                </Paper>
              )}

              {/* IPs row */}
              {strategyName === 'remoteAddress' && parameters?.IPs?.length > 0 && (
                <Paper variant="outlined" sx={{ p: 1.25, bgcolor: 'background.paper' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Typography
                      variant="caption"
                      color="primary.main"
                      sx={{ fontWeight: 700, minWidth: 60 }}
                    >
                      IP
                    </Typography>
                    {parameters.IPs.map((ip: string) => (
                      <Chip
                        key={ip}
                        label={ip}
                        size="small"
                        sx={{
                          height: 22,
                          fontSize: '0.75rem',
                          bgcolor: 'action.selected',
                          fontWeight: 500,
                          fontFamily: 'monospace',
                        }}
                      />
                    ))}
                  </Box>
                </Paper>
              )}

              {/* Hostnames row */}
              {strategyName === 'applicationHostname' && parameters?.hostNames?.length > 0 && (
                <Paper variant="outlined" sx={{ p: 1.25, bgcolor: 'background.paper' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Typography
                      variant="caption"
                      color="primary.main"
                      sx={{ fontWeight: 700, minWidth: 60 }}
                    >
                      Host
                    </Typography>
                    {parameters.hostNames.map((host: string) => (
                      <Chip
                        key={host}
                        label={host}
                        size="small"
                        sx={{
                          height: 22,
                          fontSize: '0.75rem',
                          bgcolor: 'action.selected',
                          fontWeight: 500,
                          fontFamily: 'monospace',
                        }}
                      />
                    ))}
                  </Box>
                </Paper>
              )}
            </Stack>
          </Paper>
        </Collapse>
      </Box>
    );
  }

  // Default full mode
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
      {hasDetails && (
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
