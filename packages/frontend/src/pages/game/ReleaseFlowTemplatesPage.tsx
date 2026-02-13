import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  TextField,
  InputAdornment,
  Tooltip,
  Checkbox,
  Card,
  CardContent,
  TableSortLabel,
  Stack,
  Paper,
  FormControl,
  Select,
  MenuItem,
  Slider,
  Autocomplete,
  CircularProgress,
  Grid,
  Alert,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  ViewColumn as ViewColumnIcon,
  LibraryAdd as TemplateIcon,
  Refresh as RefreshIcon,
  ArrowUpward as ArrowUpIcon,
  ArrowDownward as ArrowDownIcon,
  HelpOutline as HelpOutlineIcon,
  Timer as TimerIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/types/permissions';
import { parseApiErrorMessage } from '../../utils/errorUtils';
import releaseFlowService, {
  ReleaseFlowTemplate,
  CreateTemplateInput,
  TransitionCondition,
} from '../../services/releaseFlowService';
import api from '../../services/api';
import ConstraintEditor, {
  Constraint,
  ContextField,
} from '../../components/features/ConstraintEditor';
import SegmentSelector from '../../components/features/SegmentSelector';
import SimplePagination from '../../components/common/SimplePagination';
import EmptyPlaceholder from '../../components/common/EmptyPlaceholder';
import ColumnSettingsDialog, { ColumnConfig } from '../../components/common/ColumnSettingsDialog';
import ConfirmDeleteDialog from '../../components/common/ConfirmDeleteDialog';
import DynamicFilterBar, {
  FilterDefinition,
  ActiveFilter,
} from '../../components/common/DynamicFilterBar';
import ResizableDrawer from '../../components/common/ResizableDrawer';
import { useDebounce } from '../../hooks/useDebounce';
import { useGlobalPageSize } from '../../hooks/useGlobalPageSize';
import { formatRelativeTime } from '../../utils/dateFormat';

// ==================== Strategy Types ====================
const STRATEGY_TYPES = [
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

// ==================== Interfaces ====================
interface MilestoneEditorData {
  id: string;
  name: string;
  transitionCondition?: TransitionCondition | null;
  strategies: StrategyEditorData[];
}

interface StrategyEditorData {
  id: string;
  strategyName: string;
  title: string;
  parameters: Record<string, any>;
  constraints: any[];
  sortOrder: number;
  segments: string[];
}

// ==================== Strategy Editor Component ====================
// Follows Unleash's tab-based strategy form: General | Targeting | Variants
interface StrategyEditorProps {
  strategy: StrategyEditorData;
  onChange: (updated: StrategyEditorData) => void;
  onRemove: () => void;
  index: number;
  segments: any[];
  contextFields: ContextField[];
}

const StrategyEditor: React.FC<StrategyEditorProps> = ({
  strategy,
  onChange,
  onRemove,
  index,
  segments,
  contextFields,
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState(0);

  const isRollout =
    strategy.strategyName === 'flexibleRollout' || strategy.strategyName?.includes('Rollout');

  const constraintCount = strategy.constraints?.length || 0;
  const segmentCount = strategy.segments?.length || 0;
  const targetingCount = constraintCount + segmentCount;

  return (
    <Paper variant="outlined" sx={{ p: 0, overflow: 'hidden' }}>
      {/* Strategy Header */}
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
          <Chip label={index + 1} size="small" color="primary" />
          <Typography variant="subtitle2">
            {t(
              STRATEGY_TYPES.find((st) => st.name === strategy.strategyName)?.titleKey ||
                'featureFlags.strategies.flexibleRollout.title'
            )}
          </Typography>
          {strategy.strategyName === 'flexibleRollout' && (
            <Chip
              label={`${strategy.parameters?.rollout ?? 100}%`}
              size="small"
              color="success"
              variant="outlined"
            />
          )}
        </Box>
        <IconButton size="small" color="error" onClick={onRemove}>
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Tabs: General | Targeting */}
      <Tabs
        value={activeTab}
        onChange={(_, v) => setActiveTab(v)}
        sx={{
          borderBottom: 1,
          borderColor: 'divider',
          minHeight: 40,
          '& .MuiTab-root': { minHeight: 40, py: 0 },
        }}
      >
        <Tab label={t('releaseFlow.generalTab')} />
        <Tab
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {t('releaseFlow.targetingTab')}
              {targetingCount > 0 && (
                <Chip label={targetingCount} size="small" color="info" sx={{ height: 20 }} />
              )}
            </Box>
          }
        />
      </Tabs>

      {/* Tab Content */}
      <Box sx={{ p: 2 }}>
        {/* General Tab */}
        {activeTab === 0 && (
          <Stack spacing={2}>
            {/* Strategy Title */}
            <TextField
              label={t('releaseFlow.strategyTitle')}
              size="small"
              fullWidth
              value={strategy.title || ''}
              onChange={(e) => onChange({ ...strategy, title: e.target.value })}
              placeholder={t('releaseFlow.strategyTitlePlaceholder')}
            />

            {/* Strategy Type */}
            <FormControl fullWidth size="small">
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                {t('releaseFlow.strategyType')}
              </Typography>
              <Select
                value={strategy.strategyName || 'flexibleRollout'}
                onChange={(e) =>
                  onChange({
                    ...strategy,
                    strategyName: e.target.value,
                    parameters:
                      e.target.value === 'flexibleRollout'
                        ? { rollout: 100, stickiness: 'default', groupId: '' }
                        : {},
                  })
                }
              >
                {STRATEGY_TYPES.map((type) => (
                  <MenuItem key={type.name} value={type.name}>
                    <Box>
                      <Typography variant="body2">{t(type.titleKey)}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t(type.descKey)}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Rollout % for flexible rollout */}
            {isRollout && (
              <>
                <Box>
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
                        onChange({
                          ...strategy,
                          parameters: { ...strategy.parameters, rollout: value as number },
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
                </Box>

                {/* Stickiness & GroupId */}
                <Grid container spacing={2}>
                  <Grid size={{ xs: 6 }}>
                    <FormControl fullWidth size="small">
                      <Typography
                        variant="subtitle2"
                        sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}
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
                          onChange({
                            ...strategy,
                            parameters: { ...strategy.parameters, stickiness: e.target.value },
                          })
                        }
                      >
                        <MenuItem value="default">
                          <Box>
                            <Typography variant="body2">
                              {t('featureFlags.stickinessDefault')}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {t('featureFlags.stickinessDefaultDesc')}
                            </Typography>
                          </Box>
                        </MenuItem>
                        <MenuItem value="userId">
                          <Box>
                            <Typography variant="body2">
                              {t('featureFlags.stickinessUserId')}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {t('featureFlags.stickinessUserIdDesc')}
                            </Typography>
                          </Box>
                        </MenuItem>
                        <MenuItem value="sessionId">
                          <Box>
                            <Typography variant="body2">
                              {t('featureFlags.stickinessSessionId')}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {t('featureFlags.stickinessSessionIdDesc')}
                            </Typography>
                          </Box>
                        </MenuItem>
                        <MenuItem value="random">
                          <Box>
                            <Typography variant="body2">
                              {t('featureFlags.stickinessRandom')}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {t('featureFlags.stickinessRandomDesc')}
                            </Typography>
                          </Box>
                        </MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <Box>
                      <Typography
                        variant="subtitle2"
                        sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}
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
                        onChange={(e) =>
                          onChange({
                            ...strategy,
                            parameters: { ...strategy.parameters, groupId: e.target.value },
                          })
                        }
                      />
                    </Box>
                  </Grid>
                </Grid>
              </>
            )}

            {/* User IDs input for userWithId strategy */}
            {strategy.strategyName === 'userWithId' && (
              <Box>
                <Typography
                  variant="subtitle2"
                  gutterBottom
                  sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                >
                  {t('featureFlags.userIds')}{' '}
                  <Typography component="span" color="error.main">
                    *
                  </Typography>
                </Typography>
                <Autocomplete
                  multiple
                  freeSolo
                  options={[]}
                  value={strategy.parameters?.userIds || []}
                  onChange={(_, newValue) =>
                    onChange({
                      ...strategy,
                      parameters: { ...strategy.parameters, userIds: newValue },
                    })
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      size="small"
                      placeholder={t('featureFlags.userIdsPlaceholder')}
                      helperText={t('featureFlags.userIdsHelp')}
                    />
                  )}
                  renderTags={(value, getTagProps) =>
                    value.map((option, idx) => (
                      <Chip
                        {...getTagProps({ index: idx })}
                        key={option}
                        label={option}
                        size="small"
                      />
                    ))
                  }
                />
              </Box>
            )}

            {/* Remote addresses input for remoteAddress strategy */}
            {strategy.strategyName === 'remoteAddress' && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  {t('featureFlags.remoteAddresses')}{' '}
                  <Typography component="span" color="error.main">
                    *
                  </Typography>
                </Typography>
                <Autocomplete
                  multiple
                  freeSolo
                  options={[]}
                  value={strategy.parameters?.IPs || []}
                  onChange={(_, newValue) =>
                    onChange({
                      ...strategy,
                      parameters: { ...strategy.parameters, IPs: newValue },
                    })
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      size="small"
                      placeholder={t('featureFlags.remoteAddressesPlaceholder')}
                    />
                  )}
                  renderTags={(value, getTagProps) =>
                    value.map((option, idx) => (
                      <Chip
                        {...getTagProps({ index: idx })}
                        key={option}
                        label={option}
                        size="small"
                      />
                    ))
                  }
                />
              </Box>
            )}

            {/* Hostnames for applicationHostname strategy */}
            {strategy.strategyName === 'applicationHostname' && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  {t('featureFlags.hostnames')}{' '}
                  <Typography component="span" color="error.main">
                    *
                  </Typography>
                </Typography>
                <Autocomplete
                  multiple
                  freeSolo
                  options={[]}
                  value={strategy.parameters?.hostNames || []}
                  onChange={(_, newValue) =>
                    onChange({
                      ...strategy,
                      parameters: { ...strategy.parameters, hostNames: newValue },
                    })
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      size="small"
                      placeholder={t('featureFlags.hostnamesPlaceholder')}
                    />
                  )}
                  renderTags={(value, getTagProps) =>
                    value.map((option, idx) => (
                      <Chip
                        {...getTagProps({ index: idx })}
                        key={option}
                        label={option}
                        size="small"
                      />
                    ))
                  }
                />
              </Box>
            )}

            {/* Rollout % for gradualRolloutRandom */}
            {strategy.strategyName === 'gradualRolloutRandom' && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  {t('featureFlags.rollout')}
                </Typography>
                <Box sx={{ px: 2, pt: 3 }}>
                  <Slider
                    value={strategy.parameters?.percentage ?? 50}
                    onChange={(_, value) =>
                      onChange({
                        ...strategy,
                        parameters: { ...strategy.parameters, percentage: value as number },
                      })
                    }
                    valueLabelDisplay="on"
                    min={0}
                    max={100}
                    marks={[
                      { value: 0, label: '0%' },
                      { value: 50, label: '50%' },
                      { value: 100, label: '100%' },
                    ]}
                  />
                </Box>
              </Box>
            )}
          </Stack>
        )}

        {/* Targeting Tab: Segments + Constraints */}
        {activeTab === 1 && (
          <Stack spacing={2}>
            <SegmentSelector
              selectedSegments={strategy.segments || []}
              availableSegments={segments}
              onSegmentAdd={(segmentName) =>
                onChange({ ...strategy, segments: [...(strategy.segments || []), segmentName] })
              }
              onSegmentRemove={(segmentName) =>
                onChange({
                  ...strategy,
                  segments: (strategy.segments || []).filter((s) => s !== segmentName),
                })
              }
              t={t}
            />
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                {t('featureFlags.constraints')}
              </Typography>
              <ConstraintEditor
                constraints={strategy.constraints || []}
                onChange={(newConstraints: Constraint[]) =>
                  onChange({ ...strategy, constraints: newConstraints })
                }
                contextFields={contextFields}
              />
            </Box>
          </Stack>
        )}
      </Box>
    </Paper>
  );
};

const generateId = () => crypto.randomUUID();

// ==================== Template Editor Drawer ====================
interface TemplateEditorDrawerProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: CreateTemplateInput) => Promise<void>;
  initialData: ReleaseFlowTemplate | null;
}

const TemplateEditorDrawer: React.FC<TemplateEditorDrawerProps> = ({
  open,
  onClose,
  onSave,
  initialData,
}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [flowName, setFlowName] = useState('');
  const [description, setDescription] = useState('');
  const [milestones, setMilestones] = useState<MilestoneEditorData[]>([]);
  const [saving, setSaving] = useState(false);
  const [segments, setSegments] = useState<any[]>([]);
  const [contextFields, setContextFields] = useState<ContextField[]>([]);

  // Load segments and context fields
  useEffect(() => {
    const loadData = async () => {
      try {
        const segRes = await api.get('/admin/features/segments');
        const segData = segRes.data?.segments || segRes.data?.data?.segments || [];
        setSegments(segData);
      } catch {
        setSegments([]);
      }
      try {
        const cfRes = await api.get('/admin/features/context-fields');
        const fields = cfRes.data?.contextFields || cfRes.data?.data?.contextFields || [];
        setContextFields(
          fields
            .filter((f: any) => f.isEnabled !== false)
            .map((f: any) => {
              let rules = f.validationRules;
              if (typeof rules === 'string' && rules.trim()) {
                try {
                  rules = JSON.parse(rules);
                } catch {
                  rules = null;
                }
              }
              return {
                fieldName: f.fieldName,
                displayName: f.displayName || f.fieldName,
                description: f.description || '',
                fieldType: f.fieldType || 'string',
                validationRules: rules,
              };
            })
        );
      } catch {
        setContextFields([]);
      }
    };
    loadData();
  }, []);

  // Initialize form from initialData
  useEffect(() => {
    if (open) {
      if (initialData) {
        setFlowName(initialData.flowName || '');
        setDescription(initialData.description || '');
        setMilestones(
          (initialData.milestones || []).map((m) => ({
            id: m.id || generateId(),
            name: m.name || '',
            transitionCondition: m.transitionCondition || null,
            strategies: (m.strategies || []).map((s) => ({
              id: s.id || generateId(),
              strategyName: s.strategyName || 'flexibleRollout',
              title: '',
              parameters: s.parameters || { rollout: 100, stickiness: 'default', groupId: '' },
              constraints: s.constraints || [],
              sortOrder: s.sortOrder || 0,
              segments: s.segments || [],
            })),
          }))
        );
      } else {
        // New template: start with one milestone containing one flexibleRollout
        setFlowName('');
        setDescription('');
        setMilestones([
          {
            id: generateId(),
            name: 'Milestone 1',
            strategies: [
              {
                id: generateId(),
                strategyName: 'flexibleRollout',
                title: '',
                parameters: { rollout: 100, stickiness: 'default', groupId: '' },
                constraints: [],
                sortOrder: 0,
                segments: [],
              },
            ],
          },
        ]);
      }
    }
  }, [open, initialData]);

  const handleAddMilestone = () => {
    // New milestone: copy strategies from last milestone (Unleash pattern)
    const lastMilestone = milestones[milestones.length - 1];
    const copiedStrategies = lastMilestone
      ? lastMilestone.strategies.map((s) => ({
          ...s,
          id: generateId(),
        }))
      : [
          {
            id: generateId(),
            strategyName: 'flexibleRollout' as const,
            title: '',
            parameters: { rollout: 100, stickiness: 'default', groupId: '' },
            constraints: [] as any[],
            sortOrder: 0,
            segments: [] as string[],
          },
        ];

    setMilestones((prev) => [
      ...prev,
      {
        id: generateId(),
        name: `Milestone ${prev.length + 1}`,
        strategies: copiedStrategies,
      },
    ]);
  };

  const handleRemoveMilestone = (index: number) => {
    setMilestones((prev) =>
      prev.filter((_, i) => i !== index).map((m, i) => ({ ...m, sortOrder: i }))
    );
  };

  const handleMilestoneNameChange = (index: number, name: string) => {
    setMilestones((prev) => prev.map((m, i) => (i === index ? { ...m, name } : m)));
  };

  const handleMoveMilestone = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= milestones.length) return;
    const newMilestones = [...milestones];
    [newMilestones[index], newMilestones[newIndex]] = [
      newMilestones[newIndex],
      newMilestones[index],
    ];
    setMilestones(newMilestones);
  };

  const handleAddStrategy = (milestoneIndex: number) => {
    setMilestones((prev) =>
      prev.map((m, i) =>
        i === milestoneIndex
          ? {
              ...m,
              strategies: [
                ...m.strategies,
                {
                  id: generateId(),
                  strategyName: 'flexibleRollout',
                  title: '',
                  parameters: { rollout: 100, stickiness: 'default', groupId: '' },
                  constraints: [],
                  sortOrder: m.strategies.length,
                  segments: [],
                },
              ],
            }
          : m
      )
    );
  };

  const handleRemoveStrategy = (milestoneIndex: number, strategyIndex: number) => {
    setMilestones((prev) =>
      prev.map((m, i) =>
        i === milestoneIndex
          ? { ...m, strategies: m.strategies.filter((_, si) => si !== strategyIndex) }
          : m
      )
    );
  };

  const handleStrategyChange = (
    milestoneIndex: number,
    strategyIndex: number,
    updated: StrategyEditorData
  ) => {
    setMilestones((prev) =>
      prev.map((m, i) =>
        i === milestoneIndex
          ? {
              ...m,
              strategies: m.strategies.map((s, si) => (si === strategyIndex ? updated : s)),
            }
          : m
      )
    );
  };

  const handleSave = async () => {
    // Validation
    if (!flowName.trim()) {
      enqueueSnackbar(t('releaseFlow.templateNameRequired'), { variant: 'error' });
      return;
    }
    if (milestones.length === 0) {
      enqueueSnackbar(t('releaseFlow.milestoneRequired'), { variant: 'error' });
      return;
    }
    for (let i = 0; i < milestones.length; i++) {
      if (milestones[i].strategies.length === 0) {
        enqueueSnackbar(t('releaseFlow.strategyRequired'), { variant: 'error' });
        return;
      }
    }

    setSaving(true);
    try {
      await onSave({
        flowName: flowName.trim(),
        description: description.trim() || undefined,
        milestones: milestones.map((m, idx) => ({
          name: m.name || `Milestone ${idx + 1}`,
          sortOrder: idx,
          transitionCondition: m.transitionCondition || null,
          strategies: m.strategies.map((s, sIdx) => ({
            strategyName: s.strategyName,
            parameters: s.parameters,
            constraints: s.constraints || [],
            sortOrder: sIdx,
            segments: s.segments || [],
          })),
        })),
      });
      onClose();
    } catch {
      // Error handled by parent
    } finally {
      setSaving(false);
    }
  };

  return (
    <ResizableDrawer
      open={open}
      onClose={onClose}
      title={initialData ? t('releaseFlow.editTemplate') : t('releaseFlow.createTemplate')}
      subtitle={t('releaseFlow.templatesSubtitle')}
      storageKey="releaseFlowTemplateDrawerWidth"
      defaultWidth={800}
      minWidth={600}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Content */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
          <Stack spacing={3}>
            {/* Basic Info */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                {t('releaseFlow.templateName')}
                <span style={{ color: '#d32f2f', marginLeft: '4px' }}>*</span>
              </Typography>
              <TextField
                value={flowName}
                onChange={(e) => setFlowName(e.target.value)}
                fullWidth
                size="small"
                placeholder={t('releaseFlow.templateNamePlaceholder')}
              />
            </Box>
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                {t('releaseFlow.templateDescription')}
              </Typography>
              <TextField
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                fullWidth
                size="small"
                multiline
                rows={2}
                placeholder={t('releaseFlow.descriptionPlaceholder')}
              />
            </Box>

            {/* Milestones */}
            <Box>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
                {t('releaseFlow.milestones')} ({milestones.length})
              </Typography>

              <Stack spacing={3}>
                {milestones.map((milestone, mIdx) => (
                  <Paper key={milestone.id} variant="outlined" sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <Chip label={mIdx + 1} size="small" color="primary" />
                      <TextField
                        size="small"
                        placeholder={t('releaseFlow.milestoneNamePlaceholder')}
                        value={milestone.name}
                        onChange={(e) => handleMilestoneNameChange(mIdx, e.target.value)}
                        sx={{ flex: 1 }}
                      />
                      <Tooltip title={t('common.moveUp')}>
                        <span>
                          <IconButton
                            size="small"
                            onClick={() => handleMoveMilestone(mIdx, 'up')}
                            disabled={mIdx === 0}
                          >
                            <ArrowUpIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title={t('common.moveDown')}>
                        <span>
                          <IconButton
                            size="small"
                            onClick={() => handleMoveMilestone(mIdx, 'down')}
                            disabled={mIdx === milestones.length - 1}
                          >
                            <ArrowDownIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title={t('common.delete')}>
                        <span>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleRemoveMilestone(mIdx)}
                            disabled={milestones.length <= 1}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Box>

                    {/* Strategies */}
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {t('releaseFlow.strategies')} ({milestone.strategies.length})
                    </Typography>
                    <Stack spacing={2}>
                      {milestone.strategies.map((strategy, sIdx) => (
                        <StrategyEditor
                          key={strategy.id}
                          strategy={strategy}
                          index={sIdx}
                          segments={segments}
                          contextFields={contextFields}
                          onChange={(updated) => handleStrategyChange(mIdx, sIdx, updated)}
                          onRemove={() => handleRemoveStrategy(mIdx, sIdx)}
                        />
                      ))}
                    </Stack>
                    <Button
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={() => handleAddStrategy(mIdx)}
                      sx={{ mt: 1 }}
                    >
                      {t('releaseFlow.addStrategy')}
                    </Button>

                    {/* Transition Condition (auto-progression timer) */}
                    {mIdx < milestones.length - 1 &&
                      (() => {
                        const totalMin = milestone.transitionCondition?.intervalMinutes || 0;
                        // Derive best unit for display
                        let displayUnit: 'minutes' | 'hours' | 'days' = 'minutes';
                        let displayValue = totalMin;
                        if (totalMin > 0) {
                          if (totalMin % 1440 === 0) {
                            displayUnit = 'days';
                            displayValue = totalMin / 1440;
                          } else if (totalMin % 60 === 0) {
                            displayUnit = 'hours';
                            displayValue = totalMin / 60;
                          }
                        }

                        const handleValueChange = (val: number, unit: string) => {
                          let minutes = 0;
                          if (val > 0) {
                            if (unit === 'days') minutes = val * 1440;
                            else if (unit === 'hours') minutes = val * 60;
                            else minutes = val;
                          }
                          const updated = [...milestones];
                          updated[mIdx] = {
                            ...updated[mIdx],
                            transitionCondition: minutes > 0 ? { intervalMinutes: minutes } : null,
                          };
                          setMilestones(updated);
                        };

                        return (
                          <Box
                            sx={{
                              mt: 2,
                              p: 1.5,
                              borderRadius: 1,
                              bgcolor: 'action.hover',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                            }}
                          >
                            <TimerIcon fontSize="small" color="action" />
                            <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
                              {t('releaseFlow.autoProgressAfter')}
                            </Typography>
                            <TextField
                              type="number"
                              size="small"
                              value={totalMin > 0 ? displayValue : ''}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                handleValueChange(isNaN(val) ? 0 : val, displayUnit);
                              }}
                              sx={{ width: 80 }}
                              inputProps={{ min: 0 }}
                              placeholder="0"
                            />
                            <Select
                              size="small"
                              value={displayUnit}
                              onChange={(e) => {
                                handleValueChange(displayValue, e.target.value);
                              }}
                              sx={{ minWidth: 80 }}
                            >
                              <MenuItem value="minutes">{t('releaseFlow.unitMinutes')}</MenuItem>
                              <MenuItem value="hours">{t('releaseFlow.unitHours')}</MenuItem>
                              <MenuItem value="days">{t('releaseFlow.unitDays')}</MenuItem>
                            </Select>
                            {milestone.transitionCondition && (
                              <IconButton
                                size="small"
                                onClick={() => {
                                  const updated = [...milestones];
                                  updated[mIdx] = {
                                    ...updated[mIdx],
                                    transitionCondition: null,
                                  };
                                  setMilestones(updated);
                                }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            )}
                          </Box>
                        );
                      })()}
                  </Paper>
                ))}
              </Stack>
              <Box sx={{ mt: 2, textAlign: 'right' }}>
                <Button size="small" startIcon={<AddIcon />} onClick={handleAddMilestone}>
                  {t('releaseFlow.addMilestone')}
                </Button>
              </Box>
            </Box>
          </Stack>
        </Box>

        {/* Footer */}
        <Box
          sx={{
            p: 2,
            borderTop: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            gap: 1,
            justifyContent: 'flex-end',
          }}
        >
          <Button onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? <CircularProgress size={20} /> : t('common.save')}
          </Button>
        </Box>
      </Box>
    </ResizableDrawer>
  );
};

// ==================== Main Page ====================
const ReleaseFlowTemplatesPage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { hasPermission } = useAuth();
  const canManage = hasPermission([PERMISSIONS.FEATURE_FLAGS_MANAGE]);

  // State
  const [templates, setTemplates] = useState<ReleaseFlowTemplate[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useGlobalPageSize();
  const [loading, setLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ReleaseFlowTemplate | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingTemplate, setDeletingTemplate] = useState<ReleaseFlowTemplate | null>(null);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [columnSettingsAnchor, setColumnSettingsAnchor] = useState<null | HTMLElement>(null);

  // Sorting state with localStorage persistence
  const [orderBy, setOrderBy] = useState<string>(() => {
    const saved = localStorage.getItem('releaseFlowTemplatesSortBy');
    return saved || 'createdAt';
  });
  const [order, setOrder] = useState<'asc' | 'desc'>(() => {
    const saved = localStorage.getItem('releaseFlowTemplatesSortOrder');
    return (saved as 'asc' | 'desc') || 'desc';
  });

  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  // Dynamic filter state
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>(() => {
    try {
      const saved = localStorage.getItem('releaseFlowTemplatesActiveFilters');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Filter definitions
  const availableFilterDefinitions: FilterDefinition[] = useMemo(() => [], []);

  // Default columns
  const defaultColumns: ColumnConfig[] = [
    { id: 'checkbox', labelKey: '', visible: true },
    { id: 'name', labelKey: 'releaseFlow.templateName', visible: true },
    { id: 'description', labelKey: 'releaseFlow.templateDescription', visible: true },
    { id: 'milestones', labelKey: 'releaseFlow.milestones', visible: true },
    { id: 'createdAt', labelKey: 'common.createdAt', visible: true },
    { id: 'actions', labelKey: 'common.actions', visible: true },
  ];

  // Column configuration (persisted in localStorage)
  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    const saved = localStorage.getItem('releaseFlowTemplatesColumns');
    if (saved) {
      try {
        const savedColumns = JSON.parse(saved);
        const mergedColumns = savedColumns.map((savedCol: ColumnConfig) => {
          const defaultCol = defaultColumns.find((c) => c.id === savedCol.id);
          return defaultCol ? { ...defaultCol, ...savedCol } : savedCol;
        });
        const savedIds = new Set(savedColumns.map((c: ColumnConfig) => c.id));
        const newColumns = defaultColumns.filter((c) => !savedIds.has(c.id));
        return [...mergedColumns, ...newColumns];
      } catch {
        return defaultColumns;
      }
    }
    return defaultColumns;
  });

  // Load templates
  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const data = await releaseFlowService.getTemplates(debouncedSearchTerm || undefined);
      const allItems = data || [];

      // Client-side sorting
      const sorted = [...allItems].sort((a, b) => {
        let cmp = 0;
        if (orderBy === 'name') {
          cmp = (a.flowName || '').localeCompare(b.flowName || '');
        } else if (orderBy === 'createdAt') {
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }
        return order === 'asc' ? cmp : -cmp;
      });

      // Client-side pagination
      const start = page * rowsPerPage;
      const paginated = sorted.slice(start, start + rowsPerPage);

      setTemplates(paginated);
      setTotal(sorted.length);
    } catch (error: any) {
      enqueueSnackbar(parseApiErrorMessage(error, 'common.loadFailed'), { variant: 'error' });
      setTemplates([]);
      setTotal(0);
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  }, [debouncedSearchTerm, page, rowsPerPage, orderBy, order, enqueueSnackbar]);

  // Save filters to localStorage
  useEffect(() => {
    localStorage.setItem('releaseFlowTemplatesActiveFilters', JSON.stringify(activeFilters));
  }, [activeFilters]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // Column handlers
  const handleColumnsChange = (newColumns: ColumnConfig[]) => {
    const checkboxCol = columns.find((c) => c.id === 'checkbox');
    const actionsCol = columns.find((c) => c.id === 'actions');
    const updatedColumns = [checkboxCol!, ...newColumns, actionsCol!];
    setColumns(updatedColumns);
    localStorage.setItem('releaseFlowTemplatesColumns', JSON.stringify(updatedColumns));
  };

  const handleResetColumns = () => {
    setColumns(defaultColumns);
    localStorage.setItem('releaseFlowTemplatesColumns', JSON.stringify(defaultColumns));
  };

  // Sort handler
  const handleSort = (colId: string) => {
    let newOrder: 'asc' | 'desc' = 'asc';
    if (orderBy === colId) {
      newOrder = order === 'asc' ? 'desc' : 'asc';
    }
    setOrderBy(colId);
    setOrder(newOrder);
    localStorage.setItem('releaseFlowTemplatesSortBy', colId);
    localStorage.setItem('releaseFlowTemplatesSortOrder', newOrder);
    setPage(0);
  };

  // Filter handlers
  const handleFilterAdd = (filter: ActiveFilter) => {
    setActiveFilters((prev) => [...prev, filter]);
    setPage(0);
  };

  const handleFilterRemove = (key: string) => {
    setActiveFilters((prev) => prev.filter((f) => f.key !== key));
    setPage(0);
  };

  const handleDynamicFilterChange = (key: string, value: any) => {
    setActiveFilters((prev) => prev.map((f) => (f.key === key ? { ...f, value } : f)));
    setPage(0);
  };

  const handleOperatorChange = (key: string, operator: 'any_of' | 'include_all') => {
    setActiveFilters((prev) => prev.map((f) => (f.key === key ? { ...f, operator } : f)));
    setPage(0);
  };

  // CRUD handlers
  const handleCreate = () => {
    setEditingTemplate(null);
    setEditorOpen(true);
  };

  const handleEdit = async (template: ReleaseFlowTemplate) => {
    try {
      const fullTemplate = await releaseFlowService.getTemplate(template.id);
      setEditingTemplate(fullTemplate);
      setEditorOpen(true);
    } catch (error: any) {
      enqueueSnackbar(parseApiErrorMessage(error, 'common.loadFailed'), { variant: 'error' });
    }
  };

  const handleSave = async (data: CreateTemplateInput) => {
    if (editingTemplate) {
      await releaseFlowService.updateTemplate(editingTemplate.id, data);
      enqueueSnackbar(t('releaseFlow.templateUpdated'), { variant: 'success' });
    } else {
      await releaseFlowService.createTemplate(data);
      enqueueSnackbar(t('releaseFlow.templateCreated'), { variant: 'success' });
    }
    setSelectedIds([]);
    loadTemplates();
  };

  const handleDeleteClick = (template: ReleaseFlowTemplate) => {
    setDeletingTemplate(template);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingTemplate) return;
    try {
      await releaseFlowService.deleteTemplate(deletingTemplate.id);
      enqueueSnackbar(t('releaseFlow.templateDeleted'), { variant: 'success' });
      setSelectedIds([]);
      loadTemplates();
    } catch (error: any) {
      enqueueSnackbar(parseApiErrorMessage(error, 'common.deleteFailed'), { variant: 'error' });
    } finally {
      setDeleteDialogOpen(false);
      setDeletingTemplate(null);
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    setBulkDeleteConfirmOpen(true);
  };

  const handleBulkDeleteConfirm = async () => {
    try {
      await Promise.all(selectedIds.map((id) => releaseFlowService.deleteTemplate(id)));
      enqueueSnackbar(t('releaseFlow.templateDeleted'), { variant: 'success' });
      setSelectedIds([]);
      loadTemplates();
    } catch (error: any) {
      enqueueSnackbar(parseApiErrorMessage(error, 'common.deleteFailed'), { variant: 'error' });
    } finally {
      setBulkDeleteConfirmOpen(false);
    }
  };

  // Selection handlers
  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedIds(templates.map((tmpl) => tmpl.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  // Visible columns
  const visibleColumns = columns.filter((col) => col.visible);

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          mb: 3,
        }}
      >
        <Box>
          <Typography
            variant="h4"
            gutterBottom
            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
          >
            <TemplateIcon />
            {t('releaseFlow.templatesTitle')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('releaseFlow.templatesSubtitle')}
          </Typography>
        </Box>
        {canManage && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate}>
            {t('releaseFlow.addTemplate')}
          </Button>
        )}
      </Box>

      {/* Search and Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              flexWrap: 'wrap',
              justifyContent: 'space-between',
            }}
          >
            {/* Left: Search + Filters */}
            <Box
              sx={{
                display: 'flex',
                gap: 2,
                alignItems: 'center',
                flexWrap: 'wrap',
                flex: 1,
              }}
            >
              <TextField
                placeholder={t('releaseFlow.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(0);
                }}
                sx={{
                  minWidth: 200,
                  flexGrow: 1,
                  maxWidth: 320,
                  '& .MuiOutlinedInput-root': {
                    height: '40px',
                    borderRadius: '20px',
                    bgcolor: 'background.paper',
                    transition: 'all 0.2s ease-in-out',
                    '& fieldset': { borderColor: 'divider' },
                    '&:hover': {
                      bgcolor: 'action.hover',
                      '& fieldset': { borderColor: 'primary.light' },
                    },
                    '&.Mui-focused': {
                      bgcolor: 'background.paper',
                      boxShadow: '0 0 0 2px rgba(25, 118, 210, 0.1)',
                      '& fieldset': { borderColor: 'primary.main', borderWidth: '1px' },
                    },
                  },
                  '& .MuiInputBase-input': { fontSize: '0.875rem' },
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                    </InputAdornment>
                  ),
                }}
                size="small"
              />

              {/* Dynamic Filter Bar */}
              <DynamicFilterBar
                availableFilters={availableFilterDefinitions}
                activeFilters={activeFilters}
                onFilterAdd={handleFilterAdd}
                onFilterRemove={handleFilterRemove}
                onFilterChange={handleDynamicFilterChange}
                onOperatorChange={handleOperatorChange}
                afterFilterAddActions={
                  <Tooltip title={t('common.columnSettings')}>
                    <IconButton
                      onClick={(e) => setColumnSettingsAnchor(e.currentTarget)}
                      sx={{
                        bgcolor: 'background.paper',
                        border: 1,
                        borderColor: 'divider',
                        '&:hover': { bgcolor: 'action.hover' },
                      }}
                    >
                      <ViewColumnIcon />
                    </IconButton>
                  </Tooltip>
                }
              />
            </Box>

            {/* Right: Refresh */}
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Tooltip title={t('common.refresh')}>
                <span>
                  <IconButton size="small" onClick={loadTemplates} disabled={loading}>
                    <RefreshIcon />
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {selectedIds.length > 0 && (
        <Box sx={{ mb: 2, display: 'flex', gap: 1, alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            {t('common.selectedCount', { count: selectedIds.length })}
          </Typography>
          <Button
            variant="outlined"
            color="error"
            size="small"
            startIcon={<DeleteIcon />}
            onClick={handleBulkDelete}
          >
            {t('common.deleteSelected')}
          </Button>
        </Box>
      )}

      {/* Table */}
      <Card>
        <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
          {loading && isInitialLoad ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <Typography color="text.secondary">{t('common.loadingData')}</Typography>
            </Box>
          ) : templates.length === 0 ? (
            <EmptyPlaceholder
              message={t('releaseFlow.noTemplatesFound')}
              description={canManage ? t('releaseFlow.templatesSubtitle') : undefined}
              onAddClick={canManage ? handleCreate : undefined}
              addButtonLabel={t('releaseFlow.addTemplate')}
            />
          ) : (
            <>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      {visibleColumns.map((column) => {
                        if (column.id === 'checkbox') {
                          if (!canManage) return null;
                          return (
                            <TableCell key={column.id} padding="checkbox">
                              <Checkbox
                                indeterminate={
                                  selectedIds.length > 0 && selectedIds.length < templates.length
                                }
                                checked={
                                  templates.length > 0 && selectedIds.length === templates.length
                                }
                                onChange={handleSelectAll}
                              />
                            </TableCell>
                          );
                        }
                        if (column.id === 'actions') {
                          if (!canManage) return null;
                          return (
                            <TableCell key={column.id} align="center">
                              {t(column.labelKey)}
                            </TableCell>
                          );
                        }
                        const isSortable = ['name', 'createdAt'].includes(column.id);
                        return (
                          <TableCell key={column.id}>
                            {isSortable ? (
                              <TableSortLabel
                                active={orderBy === column.id}
                                direction={orderBy === column.id ? order : 'asc'}
                                onClick={() => handleSort(column.id)}
                              >
                                {t(column.labelKey)}
                              </TableSortLabel>
                            ) : (
                              t(column.labelKey)
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {templates.map((template) => (
                      <TableRow
                        key={template.id}
                        hover
                        selected={selectedIds.includes(template.id)}
                      >
                        {visibleColumns.map((column) => {
                          if (column.id === 'checkbox') {
                            if (!canManage) return null;
                            return (
                              <TableCell key={column.id} padding="checkbox">
                                <Checkbox
                                  checked={selectedIds.includes(template.id)}
                                  onChange={() => handleSelectOne(template.id)}
                                />
                              </TableCell>
                            );
                          }
                          if (column.id === 'name') {
                            return (
                              <TableCell key={column.id}>
                                <Typography
                                  variant="subtitle2"
                                  sx={{
                                    cursor: 'pointer',
                                    '&:hover': { textDecoration: 'underline' },
                                  }}
                                  onClick={() => handleEdit(template)}
                                >
                                  {template.displayName || template.flowName}
                                </Typography>
                                {template.displayName &&
                                  template.displayName !== template.flowName && (
                                    <Typography variant="caption" color="text.secondary">
                                      {template.flowName}
                                    </Typography>
                                  )}
                              </TableCell>
                            );
                          }
                          if (column.id === 'description') {
                            return (
                              <TableCell key={column.id}>
                                <Typography variant="body2" color="text.secondary">
                                  {template.description || '-'}
                                </Typography>
                              </TableCell>
                            );
                          }
                          if (column.id === 'milestones') {
                            return (
                              <TableCell key={column.id}>
                                <Chip
                                  label={t('releaseFlow.milestonesCount', {
                                    count: template.milestones?.length || 0,
                                  })}
                                  size="small"
                                  variant="outlined"
                                />
                              </TableCell>
                            );
                          }
                          if (column.id === 'createdAt') {
                            return (
                              <TableCell key={column.id}>
                                {formatRelativeTime(template.createdAt)}
                              </TableCell>
                            );
                          }
                          if (column.id === 'actions') {
                            if (!canManage) return null;
                            return (
                              <TableCell key={column.id} align="center">
                                <Box
                                  sx={{
                                    display: 'flex',
                                    gap: 0.5,
                                    justifyContent: 'center',
                                  }}
                                >
                                  <Tooltip title={t('common.edit')}>
                                    <IconButton size="small" onClick={() => handleEdit(template)}>
                                      <EditIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title={t('common.delete')}>
                                    <IconButton
                                      size="small"
                                      onClick={() => handleDeleteClick(template)}
                                    >
                                      <DeleteIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                </Box>
                              </TableCell>
                            );
                          }
                          return null;
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Pagination */}
              <SimplePagination
                page={page}
                rowsPerPage={rowsPerPage}
                count={total}
                onPageChange={(_event, newPage) => setPage(newPage)}
                onRowsPerPageChange={(event) => {
                  setRowsPerPage(Number(event.target.value));
                  setPage(0);
                }}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Column Settings Dialog */}
      <ColumnSettingsDialog
        anchorEl={columnSettingsAnchor}
        onClose={() => setColumnSettingsAnchor(null)}
        columns={columns.filter((col) => col.id !== 'checkbox' && col.id !== 'actions')}
        onColumnsChange={handleColumnsChange}
        onReset={handleResetColumns}
      />

      {/* Template Editor Drawer */}
      <TemplateEditorDrawer
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSave={handleSave}
        initialData={editingTemplate}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false);
          setDeletingTemplate(null);
        }}
        onConfirm={handleDeleteConfirm}
        title={t('releaseFlow.deleteTemplate')}
        message={t('releaseFlow.confirmDeleteTemplate', {
          name: deletingTemplate?.displayName || deletingTemplate?.flowName || '',
        })}
      />

      {/* Bulk Delete Confirmation Dialog */}
      <ConfirmDeleteDialog
        open={bulkDeleteConfirmOpen}
        onClose={() => setBulkDeleteConfirmOpen(false)}
        onConfirm={handleBulkDeleteConfirm}
        title={t('releaseFlow.deleteTemplate')}
        message={t('common.bulkDeleteConfirmMessage', { count: selectedIds.length })}
      />
    </Box>
  );
};

export default ReleaseFlowTemplatesPage;
