/**
 * Strategy Edit Drawer
 * Extracted from FeatureFlagDetailPage for better maintainability.
 * Handles strategy creation and editing with General and Targeting tabs.
 */

import React, { useState } from 'react';
import {
  Box,
  Stack,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  Paper,
  Chip,
  FormControlLabel,
  Checkbox,
  Alert,
  Autocomplete,
  Button,
  IconButton,
  Divider,
  Tab,
  Tabs,
  Tooltip,
  ListSubheader,
} from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { useTranslation } from 'react-i18next';

import ResizableDrawer from '../common/ResizableDrawer';
import ConstraintEditor, { Constraint, ContextField } from './ConstraintEditor';
import { ConstraintList } from './ConstraintDisplay';

// ==================== Types ====================

export interface Strategy {
  id: string;
  name: string;
  title: string;
  parameters: Record<string, any>;
  constraints: Constraint[];
  segments?: string[];
  variants?: Variant[];
  sortOrder: number;
  disabled?: boolean;
}

export interface Variant {
  name: string;
  weight: number;
  stickiness?: string;
  value?: any;
  valueType: 'boolean' | 'string' | 'json' | 'number';
  overrides?: {
    contextName: string;
    values: string[];
  }[];
}

// ==================== Constants ====================

export const STRATEGY_TYPES = [
  {
    name: 'default',
    titleKey: 'featureFlags.strategies.default.title',
    descKey: 'featureFlags.strategies.default.desc',
  },
  {
    name: 'flexibleRollout',
    titleKey: 'featureFlags.strategies.flexibleRollout.title',
    descKey: 'featureFlags.strategies.flexibleRollout.desc',
  },
  {
    name: 'userWithId',
    titleKey: 'featureFlags.strategies.userWithId.title',
    descKey: 'featureFlags.strategies.userWithId.desc',
  },
  {
    name: 'gradualRolloutRandom',
    titleKey: 'featureFlags.strategies.gradualRolloutRandom.title',
    descKey: 'featureFlags.strategies.gradualRolloutRandom.desc',
  },
  {
    name: 'gradualRolloutUserId',
    titleKey: 'featureFlags.strategies.gradualRolloutUserId.title',
    descKey: 'featureFlags.strategies.gradualRolloutUserId.desc',
  },
  {
    name: 'gradualRolloutSessionId',
    titleKey: 'featureFlags.strategies.gradualRolloutSessionId.title',
    descKey: 'featureFlags.strategies.gradualRolloutSessionId.desc',
  },
  {
    name: 'remoteAddress',
    titleKey: 'featureFlags.strategies.remoteAddress.title',
    descKey: 'featureFlags.strategies.remoteAddress.desc',
  },
  {
    name: 'applicationHostname',
    titleKey: 'featureFlags.strategies.applicationHostname.title',
    descKey: 'featureFlags.strategies.applicationHostname.desc',
  },
];

// ==================== Props ====================

interface StrategyEditDrawerProps {
  open: boolean;
  onClose: () => void;
  strategy: Strategy | null;
  originalStrategy: Strategy | null;
  onStrategyChange: (strategy: Strategy) => void;
  onSave: () => void;
  isAdding: boolean;
  saving: boolean;
  flagName?: string;
  contextFields: ContextField[];
  segments: any[];
  strategyJsonErrors: Record<number, string | null>;
}

// ==================== Component ====================

const StrategyEditDrawer: React.FC<StrategyEditDrawerProps> = ({
  open,
  onClose,
  strategy,
  originalStrategy,
  onStrategyChange,
  onSave,
  isAdding,
  saving,
  flagName,
  contextFields,
  segments,
  strategyJsonErrors,
}) => {
  const { t } = useTranslation();
  const [tabValue, setTabValue] = useState(0);
  const [expandedSegments, setExpandedSegments] = useState<Set<string>>(
    new Set()
  );

  const handleClose = () => {
    setExpandedSegments(new Set());
    setTabValue(0);
    onClose();
  };

  if (!strategy) return null;

  // Determine if save button should be disabled
  const isSaveDisabled = (() => {
    // When editing, require changes to be made
    const strategyUnchanged =
      JSON.stringify(strategy) === JSON.stringify(originalStrategy);
    if (!isAdding && strategyUnchanged) return true;

    // Disable if any JSON errors
    if (Object.values(strategyJsonErrors).some((e) => e !== null)) return true;

    // Disable if any variant has reserved name 'disabled'
    if (strategy.variants?.some((v) => v.name.toLowerCase() === 'disabled'))
      return true;

    // Validate list-based strategies require non-empty lists
    if (strategy.name === 'userWithId') {
      const userIds = strategy.parameters?.userIds;
      if (!userIds || !Array.isArray(userIds) || userIds.length === 0)
        return true;
    }
    if (strategy.name === 'remoteAddress') {
      const ips = strategy.parameters?.IPs;
      if (!ips || !Array.isArray(ips) || ips.length === 0) return true;
    }
    if (strategy.name === 'applicationHostname') {
      const hostNames = strategy.parameters?.hostNames;
      if (!hostNames || !Array.isArray(hostNames) || hostNames.length === 0)
        return true;
    }
    return false;
  })();

  return (
    <ResizableDrawer
      open={open}
      onClose={handleClose}
      title={
        strategy?.id?.startsWith('new-')
          ? t('featureFlags.addStrategy')
          : t('featureFlags.editStrategy')
      }
      storageKey="featureFlagStrategyDrawerWidth"
      defaultWidth={600}
    >
      <>
        {/* Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
          <Tabs
            value={tabValue}
            onChange={(_, v) => setTabValue(v)}
            variant="standard"
          >
            <Tab label={t('featureFlags.strategyTabs.general')} />
            <Tab
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {t('featureFlags.strategyTabs.targeting')}
                  {(strategy.segments?.length || 0) +
                    (strategy.constraints?.length || 0) >
                    0 && (
                    <Chip
                      label={
                        (strategy.segments?.length || 0) +
                        (strategy.constraints?.length || 0)
                      }
                      size="small"
                      color="primary"
                      sx={{ height: 20, fontSize: '0.75rem' }}
                    />
                  )}
                </Box>
              }
            />
          </Tabs>
        </Box>

        <Box sx={{ p: 3, flex: 1, overflow: 'auto' }}>
          {/* General Tab */}
          {tabValue === 0 && (
            <Stack spacing={3}>
              {/* New strategy default disabled notice */}
              {(() => {
                const isNewStrategy = strategy.id?.startsWith('new-');
                const isRolloutStrategy =
                  strategy.name === 'flexibleRollout' ||
                  strategy.name?.includes('Rollout');
                const rolloutValue = strategy.parameters?.rollout ?? 0;
                const isDisabled = strategy.disabled !== false;
                const hasTargeting =
                  (strategy.constraints?.length || 0) > 0 ||
                  (strategy.segments?.length || 0) > 0;

                const shouldShowNotice =
                  isNewStrategy &&
                  ((isRolloutStrategy && (isDisabled || rolloutValue === 0)) ||
                    (!isRolloutStrategy && isDisabled && !hasTargeting));

                return shouldShowNotice ? (
                  <Alert severity="info">
                    {t('featureFlags.newStrategyDefaultDisabledNotice')}
                  </Alert>
                ) : null;
              })()}

              {/* Strategy Type */}
              <FormControl fullWidth>
                <InputLabel>{t('featureFlags.strategyType')}</InputLabel>
                <Select
                  value={strategy.name || 'flexibleRollout'}
                  onChange={(e) =>
                    onStrategyChange({
                      ...strategy,
                      name: e.target.value,
                    })
                  }
                  label={t('featureFlags.strategyType')}
                >
                  {STRATEGY_TYPES.map((type) => (
                    <MenuItem key={type.name} value={type.name}>
                      <Box>
                        <Typography>{t(type.titleKey)}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {t(type.descKey)}
                        </Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Strategy Title (optional) */}
              <TextField
                fullWidth
                label={t('featureFlags.strategyTitle')}
                placeholder={t('featureFlags.strategyTitlePlaceholder')}
                value={strategy.title || ''}
                onChange={(e) =>
                  onStrategyChange({
                    ...strategy,
                    title: e.target.value,
                  })
                }
                helperText={t('featureFlags.strategyTitleHelp')}
              />

              {/* Rollout % for flexible rollout */}
              {(strategy.name === 'flexibleRollout' ||
                strategy.name?.includes('Rollout')) && (
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography
                    variant="subtitle2"
                    gutterBottom
                    sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                  >
                    {t('featureFlags.rollout')}
                    <Tooltip title={t('featureFlags.rolloutTooltip')}>
                      <HelpOutlineIcon fontSize="small" color="action" />
                    </Tooltip>
                  </Typography>
                  <Box sx={{ px: 2, pt: 3 }}>
                    <Slider
                      value={strategy.parameters?.rollout ?? 100}
                      onChange={(_, value) =>
                        onStrategyChange({
                          ...strategy,
                          parameters: {
                            ...strategy.parameters,
                            rollout: value as number,
                          },
                        })
                      }
                      valueLabelDisplay="on"
                      min={0}
                      max={100}
                      marks={[
                        { value: 0, label: '0%' },
                        { value: 25, label: '25%' },
                        { value: 50, label: '50%' },
                        { value: 75, label: '75%' },
                        { value: 100, label: '100%' },
                      ]}
                    />
                  </Box>

                  {/* Stickiness & GroupId */}
                  <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                    <Box sx={{ flex: 1 }}>
                      <FormControl fullWidth size="small">
                        <Typography
                          variant="subtitle2"
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                            mb: 0.5,
                          }}
                        >
                          {t('featureFlags.stickiness')}
                          <Tooltip title={t('featureFlags.stickinessHelp')}>
                            <HelpOutlineIcon
                              fontSize="small"
                              color="action"
                              sx={{ cursor: 'pointer' }}
                            />
                          </Tooltip>
                        </Typography>
                        <Select
                          value={strategy.parameters?.stickiness || 'default'}
                          onChange={(e) =>
                            onStrategyChange({
                              ...strategy,
                              parameters: {
                                ...strategy.parameters,
                                stickiness: e.target.value,
                              },
                            })
                          }
                        >
                          <MenuItem value="default">
                            <Box>
                              <Typography variant="body2">
                                {t('featureFlags.stickinessDefault')}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {t('featureFlags.stickinessDefaultDesc')}
                              </Typography>
                            </Box>
                          </MenuItem>
                          <MenuItem value="userId">
                            <Box>
                              <Typography variant="body2">
                                {t('featureFlags.stickinessUserId')}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {t('featureFlags.stickinessUserIdDesc')}
                              </Typography>
                            </Box>
                          </MenuItem>
                          <MenuItem value="sessionId">
                            <Box>
                              <Typography variant="body2">
                                {t('featureFlags.stickinessSessionId')}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {t('featureFlags.stickinessSessionIdDesc')}
                              </Typography>
                            </Box>
                          </MenuItem>
                          <MenuItem value="random">
                            <Box>
                              <Typography variant="body2">
                                {t('featureFlags.stickinessRandom')}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {t('featureFlags.stickinessRandomDesc')}
                              </Typography>
                            </Box>
                          </MenuItem>
                          {/* Custom stickiness fields from context fields */}
                          {contextFields.filter(
                            (f) => f.stickiness && !f.isDefaultStickinessField
                          ).length > 0 && (
                            <ListSubheader
                              sx={{
                                lineHeight: '32px',
                                fontSize: '0.75rem',
                              }}
                            >
                              {t('featureFlags.customStickinessFields')}
                            </ListSubheader>
                          )}
                          {contextFields
                            .filter(
                              (f) => f.stickiness && !f.isDefaultStickinessField
                            )
                            .map((field) => (
                              <MenuItem
                                key={field.fieldName}
                                value={field.fieldName}
                              >
                                <Box>
                                  <Typography variant="body2">
                                    {field.displayName || field.fieldName}
                                  </Typography>
                                  {field.description && (
                                    <Typography
                                      variant="caption"
                                      color="text.secondary"
                                    >
                                      {field.description}
                                    </Typography>
                                  )}
                                </Box>
                              </MenuItem>
                            ))}
                        </Select>
                      </FormControl>
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Box>
                        <Typography
                          variant="subtitle2"
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                            mb: 0.5,
                          }}
                        >
                          {t('featureFlags.groupId')}
                          <Tooltip title={t('featureFlags.groupIdHelp')}>
                            <HelpOutlineIcon
                              fontSize="small"
                              color="action"
                              sx={{ cursor: 'pointer' }}
                            />
                          </Tooltip>
                        </Typography>
                        <TextField
                          fullWidth
                          size="small"
                          value={strategy.parameters?.groupId || ''}
                          placeholder={flagName || ''}
                          onChange={(e) =>
                            onStrategyChange({
                              ...strategy,
                              parameters: {
                                ...strategy.parameters,
                                groupId: e.target.value,
                              },
                            })
                          }
                        />
                      </Box>
                    </Box>
                  </Box>
                </Paper>
              )}

              {/* User IDs input for userWithId strategy */}
              {strategy.name === 'userWithId' && (
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography
                    variant="subtitle2"
                    gutterBottom
                    sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                  >
                    {t('featureFlags.userIds')}{' '}
                    <Typography component="span" color="error.main">
                      *
                    </Typography>
                    <Tooltip title={t('featureFlags.userIdsTooltip')}>
                      <HelpOutlineIcon fontSize="small" color="action" />
                    </Tooltip>
                  </Typography>
                  <Autocomplete
                    multiple
                    freeSolo
                    options={[]}
                    value={strategy.parameters?.userIds || []}
                    onChange={(_, newValue) =>
                      onStrategyChange({
                        ...strategy,
                        parameters: {
                          ...strategy.parameters,
                          userIds: newValue,
                        },
                      })
                    }
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        size="small"
                        required
                        error={!(strategy.parameters?.userIds?.length > 0)}
                        placeholder={t('featureFlags.userIdsPlaceholder')}
                        helperText={t('featureFlags.userIdsHelp')}
                      />
                    )}
                    renderTags={(value, getTagProps) =>
                      value.map((option, index) => (
                        <Chip
                          {...getTagProps({ index })}
                          key={option}
                          label={option}
                          size="small"
                        />
                      ))
                    }
                  />
                </Paper>
              )}

              {/* Remote addresses input for remoteAddress strategy */}
              {strategy.name === 'remoteAddress' && (
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography
                    variant="subtitle2"
                    gutterBottom
                    sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                  >
                    {t('featureFlags.remoteAddresses')}{' '}
                    <Typography component="span" color="error.main">
                      *
                    </Typography>
                    <Tooltip title={t('featureFlags.remoteAddressesTooltip')}>
                      <HelpOutlineIcon fontSize="small" color="action" />
                    </Tooltip>
                  </Typography>
                  <Autocomplete
                    multiple
                    freeSolo
                    options={[]}
                    value={strategy.parameters?.IPs || []}
                    onChange={(_, newValue) =>
                      onStrategyChange({
                        ...strategy,
                        parameters: {
                          ...strategy.parameters,
                          IPs: newValue,
                        },
                      })
                    }
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        size="small"
                        required
                        error={!(strategy.parameters?.IPs?.length > 0)}
                        placeholder={t(
                          'featureFlags.remoteAddressesPlaceholder'
                        )}
                        helperText={t('featureFlags.remoteAddressesHelp')}
                      />
                    )}
                    renderTags={(value, getTagProps) =>
                      value.map((option, index) => (
                        <Chip
                          {...getTagProps({ index })}
                          key={option}
                          label={option}
                          size="small"
                        />
                      ))
                    }
                  />
                </Paper>
              )}

              {/* Hostnames input for applicationHostname strategy */}
              {strategy.name === 'applicationHostname' && (
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography
                    variant="subtitle2"
                    gutterBottom
                    sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                  >
                    {t('featureFlags.hostnames')}{' '}
                    <Typography component="span" color="error.main">
                      *
                    </Typography>
                    <Tooltip title={t('featureFlags.hostnamesTooltip')}>
                      <HelpOutlineIcon fontSize="small" color="action" />
                    </Tooltip>
                  </Typography>
                  <Autocomplete
                    multiple
                    freeSolo
                    options={[]}
                    value={strategy.parameters?.hostNames || []}
                    onChange={(_, newValue) =>
                      onStrategyChange({
                        ...strategy,
                        parameters: {
                          ...strategy.parameters,
                          hostNames: newValue,
                        },
                      })
                    }
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        size="small"
                        required
                        error={!(strategy.parameters?.hostNames?.length > 0)}
                        placeholder={t('featureFlags.hostnamesPlaceholder')}
                        helperText={t('featureFlags.hostnamesHelp')}
                      />
                    )}
                    renderTags={(value, getTagProps) =>
                      value.map((option, index) => (
                        <Chip
                          {...getTagProps({ index })}
                          key={option}
                          label={option}
                          size="small"
                        />
                      ))
                    }
                  />
                </Paper>
              )}

              {/* Strategy Status */}
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  {t('featureFlags.strategyStatus')}
                </Typography>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={!strategy.disabled}
                      onChange={(e) =>
                        onStrategyChange({
                          ...strategy,
                          disabled: !e.target.checked,
                        })
                      }
                    />
                  }
                  label={
                    <Box>
                      <Typography>
                        {t('featureFlags.strategyActive')}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t('featureFlags.strategyActiveHelp')}
                      </Typography>
                    </Box>
                  }
                />
              </Paper>
            </Stack>
          )}

          {/* Targeting Tab */}
          {tabValue === 1 && (
            <Stack spacing={3}>
              {/* Info Alert */}
              <Alert severity="info" sx={{ borderRadius: 2 }}>
                {t('featureFlags.targetingInfo')}
              </Alert>

              {/* Segments */}
              <Box>
                <Typography
                  variant="subtitle2"
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    mb: 1,
                  }}
                >
                  {t('featureFlags.segments')}
                  <Tooltip title={t('featureFlags.segmentsTooltip')}>
                    <HelpOutlineIcon fontSize="small" color="action" />
                  </Tooltip>
                </Typography>
                <Autocomplete
                  multiple
                  options={Array.isArray(segments) ? segments : []}
                  getOptionLabel={(option) =>
                    option.displayName || option.segmentName || ''
                  }
                  value={(Array.isArray(segments) ? segments : []).filter((s) =>
                    (strategy.segments || []).includes(s.segmentName)
                  )}
                  onChange={(_, newValue) =>
                    onStrategyChange({
                      ...strategy,
                      segments: newValue.map((s) => s.segmentName),
                    })
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder={t('featureFlags.selectSegments')}
                      size="small"
                    />
                  )}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                      <Chip
                        {...getTagProps({ index })}
                        key={option.segmentName}
                        label={option.displayName || option.segmentName}
                        size="small"
                        onDelete={getTagProps({ index }).onDelete}
                      />
                    ))
                  }
                />

                {/* Selected Segments Preview */}
                {(strategy.segments?.length || 0) > 0 && (
                  <Stack spacing={1} sx={{ mt: 2 }}>
                    {strategy.segments?.map((segmentName) => {
                      const segment = segments.find(
                        (s) => s.segmentName === segmentName
                      );
                      if (!segment) return null;
                      return (
                        <Paper
                          key={segmentName}
                          variant="outlined"
                          sx={{
                            p: 1.5,
                            bgcolor: 'action.hover',
                            borderRadius: 1,
                          }}
                        >
                          <Box
                            sx={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              mb: 1,
                            }}
                          >
                            <Typography variant="subtitle2" fontWeight={600}>
                              {segment.displayName || segment.segmentName}
                            </Typography>
                            <IconButton
                              size="small"
                              onClick={() => {
                                setExpandedSegments((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(segmentName)) {
                                    next.delete(segmentName);
                                  } else {
                                    next.add(segmentName);
                                  }
                                  return next;
                                });
                              }}
                            >
                              {expandedSegments.has(segmentName) ? (
                                <KeyboardArrowUpIcon />
                              ) : (
                                <KeyboardArrowDownIcon />
                              )}
                            </IconButton>
                          </Box>
                          {segment.description && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{ display: 'block', mb: 1 }}
                            >
                              {segment.description}
                            </Typography>
                          )}
                          {expandedSegments.has(segmentName) &&
                            segment.constraints &&
                            segment.constraints.length > 0 && (
                              <Box
                                sx={{
                                  pl: 1,
                                  borderLeft: 2,
                                  borderColor: 'primary.main',
                                }}
                              >
                                <ConstraintList
                                  constraints={segment.constraints}
                                  contextFields={contextFields}
                                />
                              </Box>
                            )}
                          {expandedSegments.has(segmentName) &&
                            (!segment.constraints ||
                              segment.constraints.length === 0) && (
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {t('featureFlags.noConstraintsInSegment')}
                              </Typography>
                            )}
                        </Paper>
                      );
                    })}
                  </Stack>
                )}
              </Box>

              {/* AND divider */}
              {(strategy.segments?.length || 0) > 0 && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Divider sx={{ flex: 1 }} />
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
                  <Divider sx={{ flex: 1 }} />
                </Box>
              )}

              {/* Constraints */}
              <Box>
                <Typography
                  variant="subtitle2"
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    mb: 1,
                  }}
                >
                  {t('featureFlags.constraints')}
                  <Tooltip title={t('featureFlags.constraintsTooltip')}>
                    <HelpOutlineIcon fontSize="small" color="action" />
                  </Tooltip>
                </Typography>
                <ConstraintEditor
                  constraints={strategy.constraints || []}
                  onChange={(constraints) =>
                    onStrategyChange({ ...strategy, constraints })
                  }
                  contextFields={
                    Array.isArray(contextFields) ? contextFields : []
                  }
                />
              </Box>
            </Stack>
          )}
        </Box>

        {/* Footer */}
        <Box
          sx={{
            p: 2,
            borderTop: 1,
            borderColor: 'divider',
            display: 'flex',
            gap: 1,
            justifyContent: 'flex-end',
            bgcolor: 'background.paper',
          }}
        >
          <Button onClick={handleClose}>{t('common.cancel')}</Button>
          <Button
            variant="contained"
            onClick={onSave}
            disabled={isSaveDisabled || saving}
          >
            {isAdding ? t('featureFlags.saveStrategy') : t('common.update')}
          </Button>
        </Box>
      </>
    </ResizableDrawer>
  );
};

export default StrategyEditDrawer;
