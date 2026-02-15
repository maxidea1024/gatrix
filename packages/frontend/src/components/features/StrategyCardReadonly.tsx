/**
 * StrategyCardReadonly - Reusable read-only strategy card component
 *
 * Displays a strategy with its full details including:
 * - Strategy header (name, rollout %, user count, etc.)
 * - Segments with expandable preview
 * - AND markers between sections
 * - Constraints with ConstraintDisplay
 * - Rollout percentage
 * - User IDs, IP addresses, hostnames
 *
 * Used in:
 * - FeatureFlagDetailPage (environment strategy list)
 * - ReleaseFlowTab (active plan milestones, template selection cards)
 */
import React, { useState } from 'react';
import { Box, Typography, Chip, Paper, Collapse, Button, IconButton, Tooltip } from '@mui/material';
import { ExpandMore as ExpandMoreIcon, ExpandLess as ExpandLessIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import {
  ConstraintDisplay,
  ConstraintValue,
  ConstraintList,
  ContextFieldInfo,
} from './ConstraintDisplay';

export interface StrategyData {
  /** Strategy name (e.g. 'flexibleRollout', 'userWithId', 'remoteAddress') */
  strategyName: string;
  /** Optional user-defined display name */
  title?: string;
  /** Strategy parameters */
  parameters?: Record<string, any>;
  /** Inline constraints */
  constraints?: ConstraintValue[];
  /** Segment names */
  segments?: string[];
  /** Whether the strategy is disabled */
  disabled?: boolean;
}

export interface StrategyCardReadonlyProps {
  /** Strategy data to display */
  strategy: StrategyData;
  /** All available segments for lookup */
  allSegments?: any[];
  /** Context fields for constraint display */
  contextFields?: ContextFieldInfo[];
  /** Optional header actions (edit/delete buttons, etc.) */
  headerActions?: React.ReactNode;
  /** Optional element to prepend to the header (e.g. drag handle) */
  headerPrefix?: React.ReactNode;
  /** Whether the card body can be collapsed by clicking the header */
  collapsible?: boolean;
  /** Whether the card body starts collapsed (only used when collapsible=true) */
  defaultCollapsed?: boolean;
}

// AND marker chip
const AndMarker: React.FC = () => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'center',
      ml: 2,
      my: -0.5,
      position: 'relative',
      zIndex: 2,
    }}
  >
    <Chip
      label="AND"
      size="small"
      sx={{
        height: 18,
        fontSize: '0.6rem',
        fontWeight: 700,
        bgcolor: 'background.paper',
        color: 'text.secondary',
        border: 1,
        borderColor: 'divider',
      }}
    />
  </Box>
);

const StrategyCardReadonly: React.FC<StrategyCardReadonlyProps> = ({
  strategy,
  allSegments = [],
  contextFields = [],
  headerActions,
  headerPrefix,
  collapsible = false,
  defaultCollapsed = false,
}) => {
  const { t } = useTranslation();
  const [expandedSegments, setExpandedSegments] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState(collapsible && defaultCollapsed);

  const { strategyName, parameters, constraints = [], segments = [] } = strategy;

  // Strategy display name
  const getStrategyTitle = (name: string) => {
    return t(`featureFlags.strategies.${name}.title`, name);
  };

  // Rollout check
  const isRolloutStrategy =
    strategyName === 'flexibleRollout' ||
    strategyName === 'gradualRolloutRandom' ||
    strategyName === 'gradualRolloutUserId';
  const showRollout = isRolloutStrategy && parameters?.rollout !== undefined;

  // Check if body has any content
  const hasSegments = segments.length > 0;
  const hasConstraints = constraints.length > 0;
  const hasUserIds = strategyName === 'userWithId' && parameters?.userIds?.length > 0;
  const hasIPs = strategyName === 'remoteAddress' && parameters?.IPs?.length > 0;
  const hasHostnames = strategyName === 'applicationHostname' && parameters?.hostNames?.length > 0;
  const hasBody =
    hasSegments || hasConstraints || showRollout || hasUserIds || hasIPs || hasHostnames;

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 0,
        overflow: 'hidden',
      }}
    >
      {/* ==================== Strategy Header ==================== */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          p: 1.5,
          bgcolor: 'action.hover',
          borderBottom: (!collapsible || !collapsed) && hasBody ? 1 : 0,
          borderColor: 'divider',
          ...(collapsible && {
            cursor: 'pointer',
            '&:hover': {
              bgcolor: (theme: any) =>
                theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            },
            transition: 'background-color 0.15s',
          }),
        }}
        onClick={collapsible ? () => setCollapsed(!collapsed) : undefined}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
          }}
        >
          {headerPrefix}

          {/* Strategy title with summary */}
          <Box sx={{ minWidth: 0 }}>
            <Tooltip
              title={strategy.title && strategy.title.length > 30 ? strategy.title : ''}
              arrow
            >
              <Typography
                fontWeight={600}
                component="span"
                sx={{
                  display: 'inline-block',
                  maxWidth: 300,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  verticalAlign: 'middle',
                }}
              >
                {strategy.disabled !== undefined && strategy.disabled ? '⏸ ' : ''}
                {strategy.title || getStrategyTitle(strategyName)}
              </Typography>
            </Tooltip>
            {/* Show rollout % for rollout strategies */}
            {showRollout && (
              <Typography component="span" color="text.secondary">
                : {parameters!.rollout}% {t('featureFlags.ofAllUsers')}
              </Typography>
            )}
            {/* Show user count for userWithId strategy */}
            {strategyName === 'userWithId' && (
              <Typography component="span" color="text.secondary">
                : {parameters?.userIds?.length || 0} {t('featureFlags.users')}
              </Typography>
            )}
            {/* Show IP count for remoteAddress strategy */}
            {strategyName === 'remoteAddress' && (
              <Typography component="span" color="text.secondary">
                : {parameters?.IPs?.length || 0} {t('featureFlags.addresses')}
              </Typography>
            )}
            {/* Show hostname count for applicationHostname strategy */}
            {strategyName === 'applicationHostname' && (
              <Typography component="span" color="text.secondary">
                : {parameters?.hostNames?.length || 0} {t('featureFlags.hosts')}
              </Typography>
            )}
          </Box>
        </Box>

        <Box
          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Strategy disabled badge */}
          {strategy.disabled && (
            <Chip
              label={t('featureFlags.strategyDisabled')}
              size="small"
              variant="outlined"
              color="warning"
              sx={{ fontWeight: 500 }}
            />
          )}
          {headerActions}
          {collapsible && hasBody && (
            <IconButton
              size="small"
              tabIndex={-1}
              sx={{ p: 0.25 }}
              onClick={(e) => {
                e.stopPropagation();
                setCollapsed(!collapsed);
              }}
            >
              {collapsed ? (
                <ExpandMoreIcon fontSize="small" />
              ) : (
                <ExpandLessIcon fontSize="small" />
              )}
            </IconButton>
          )}
        </Box>
      </Box>

      {/* ==================== Strategy Body ==================== */}
      <Collapse in={!collapsed} timeout={200}>
        {hasBody && (
          <Box sx={{ px: 2, pt: 2, pb: 2 }}>
            {/* Segments Section */}
            {hasSegments && (
              <Box>
                {segments.map((segmentName: string, segIdx: number) => {
                  const segmentData = allSegments.find((s) => s.segmentName === segmentName);
                  const isExpanded = expandedSegments.has(segmentName);
                  return (
                    <Box key={segmentName} sx={{ position: 'relative' }}>
                      {/* Segment Box */}
                      <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'background.paper' }}>
                        {/* Segment Header */}
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Typography
                              variant="body2"
                              color="primary.main"
                              sx={{ fontWeight: 600, minWidth: 80 }}
                            >
                              {t('featureFlags.segment')}
                            </Typography>
                            <Chip
                              label={segmentData?.displayName || segmentName}
                              size="small"
                              sx={{
                                bgcolor: 'action.selected',
                                color: 'text.primary',
                                fontWeight: 500,
                                borderRadius: '16px',
                              }}
                            />
                          </Box>
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={() => {
                              const newSet = new Set(expandedSegments);
                              if (isExpanded) {
                                newSet.delete(segmentName);
                              } else {
                                newSet.add(segmentName);
                              }
                              setExpandedSegments(newSet);
                            }}
                            sx={{
                              textTransform: 'none',
                              fontWeight: 500,
                              minWidth: 70,
                            }}
                          >
                            {isExpanded ? t('featureFlags.hide') : t('featureFlags.preview')}
                          </Button>
                        </Box>

                        {/* Segment Preview with animation */}
                        <Collapse in={isExpanded && !!segmentData} timeout={200}>
                          <Box
                            sx={{
                              mt: 1.5,
                              pt: 1.5,
                              borderTop: 1,
                              borderColor: 'divider',
                            }}
                          >
                            <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
                              {segmentData?.displayName || segmentName}
                            </Typography>
                            {segmentData?.description && (
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ display: 'block', mb: 1 }}
                              >
                                {segmentData.description}
                              </Typography>
                            )}
                            <Box sx={{ pl: 2 }}>
                              <ConstraintList
                                constraints={segmentData?.constraints || []}
                                contextFields={contextFields}
                              />
                            </Box>
                          </Box>
                        </Collapse>
                      </Paper>

                      {/* AND marker after segment */}
                      {segIdx < segments.length - 1 && <AndMarker />}
                    </Box>
                  );
                })}
              </Box>
            )}

            {/* AND marker between segments and constraints */}
            {hasSegments && hasConstraints && <AndMarker />}

            {/* Constraints Section */}
            {hasConstraints &&
              constraints.map((constraint: ConstraintValue, cIdx: number) => (
                <Box key={cIdx} sx={{ position: 'relative' }}>
                  <Paper variant="outlined" sx={{ p: 1.5 }}>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                      }}
                    >
                      <Typography
                        variant="body2"
                        color="warning.main"
                        sx={{ fontWeight: 600, minWidth: 80 }}
                      >
                        {t('featureFlags.constraint')}
                      </Typography>
                      <ConstraintDisplay
                        constraint={constraint}
                        contextFields={contextFields}
                        noBorder
                      />
                    </Box>
                  </Paper>
                  {/* AND marker after constraint */}
                  {cIdx < constraints.length - 1 && <AndMarker />}
                </Box>
              ))}

            {/* AND marker before rollout */}
            {(hasSegments || hasConstraints) && showRollout && <AndMarker />}

            {/* Rollout % Section */}
            {showRollout && (
              <Box sx={{ mb: 1.5 }}>
                <Paper variant="outlined" sx={{ p: 1.5 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                    }}
                  >
                    <Typography
                      variant="body2"
                      color="info.main"
                      sx={{ fontWeight: 600, minWidth: 80 }}
                    >
                      {t('featureFlags.rollout')}
                    </Typography>
                    <Chip
                      label={`${parameters!.rollout}%`}
                      size="small"
                      sx={{
                        bgcolor: 'action.selected',
                        fontWeight: 600,
                      }}
                    />
                    <Typography variant="body2" color="text.secondary">
                      {t('featureFlags.ofYourBaseMatching')}
                    </Typography>
                  </Box>
                </Paper>
              </Box>
            )}

            {/* AND marker before userIds */}
            {(hasSegments || hasConstraints) && hasUserIds && <AndMarker />}

            {/* User IDs for userWithId strategy */}
            {hasUserIds && (
              <Box sx={{ mb: 1.5 }}>
                <Paper variant="outlined" sx={{ p: 1.5 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      flexWrap: 'wrap',
                    }}
                  >
                    <Typography
                      variant="body2"
                      color="warning.main"
                      sx={{ fontWeight: 600, minWidth: 80 }}
                    >
                      {t('featureFlags.userIds')}
                    </Typography>
                    {(Array.isArray(parameters?.userIds)
                      ? parameters!.userIds
                      : String(parameters?.userIds).split(',')
                    )
                      .filter((id: string) => id.trim())
                      .map((userId: string) => (
                        <Chip
                          key={userId}
                          label={userId.trim()}
                          size="small"
                          sx={{
                            bgcolor: 'action.selected',
                            color: 'text.primary',
                            fontWeight: 500,
                            borderRadius: '16px',
                          }}
                        />
                      ))}
                  </Box>
                </Paper>
              </Box>
            )}

            {/* AND marker before IPs */}
            {(hasSegments || hasConstraints) && hasIPs && <AndMarker />}

            {/* IP Addresses for remoteAddress strategy */}
            {hasIPs && (
              <Box sx={{ mb: 1.5 }}>
                <Paper variant="outlined" sx={{ p: 1.5 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      flexWrap: 'wrap',
                    }}
                  >
                    <Typography
                      variant="body2"
                      color="warning.main"
                      sx={{ fontWeight: 600, minWidth: 80 }}
                    >
                      {t('featureFlags.remoteAddresses')}
                    </Typography>
                    {parameters!.IPs.map((ip: string) => (
                      <Chip
                        key={ip}
                        label={ip}
                        size="small"
                        sx={{
                          bgcolor: 'action.selected',
                          color: 'text.primary',
                          fontWeight: 500,
                          borderRadius: '16px',
                        }}
                      />
                    ))}
                  </Box>
                </Paper>
              </Box>
            )}

            {/* AND marker before hostnames */}
            {(hasSegments || hasConstraints) && hasHostnames && <AndMarker />}

            {/* Hostnames for applicationHostname strategy */}
            {hasHostnames && (
              <Box sx={{ mb: 1.5 }}>
                <Paper variant="outlined" sx={{ p: 1.5 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      flexWrap: 'wrap',
                    }}
                  >
                    <Typography
                      variant="body2"
                      color="warning.main"
                      sx={{ fontWeight: 600, minWidth: 80 }}
                    >
                      {t('featureFlags.hostnames')}
                    </Typography>
                    {parameters!.hostNames.map((hostname: string) => (
                      <Chip
                        key={hostname}
                        label={hostname}
                        size="small"
                        sx={{
                          bgcolor: 'action.selected',
                          color: 'text.primary',
                          fontWeight: 500,
                          borderRadius: '16px',
                        }}
                      />
                    ))}
                  </Box>
                </Paper>
              </Box>
            )}
          </Box>
        )}
      </Collapse>
    </Paper>
  );
};

export default StrategyCardReadonly;
