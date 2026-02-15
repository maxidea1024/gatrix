import React, { useState, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Stack,
  Chip,
  CircularProgress,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  Alert,
  Collapse,
  IconButton,
  Link,
  TextField,
  Select,
  Menu,
  MenuItem,
} from '@mui/material';
import {
  PlayArrow as StartIcon,
  ArrowForward as AdvanceIcon,
  LibraryAdd as TemplateIcon,
  Pause as PauseIcon,
  DoubleArrow as DoubleArrowIcon,
  Shield as ShieldIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Schedule as ScheduleIcon,
  Timer as TimerIcon,
  Close as CloseIcon,
  Add as AddIcon,
  CheckCircle as CompletedIcon,
  ArrowDownward as ArrowDownIcon,
  HelpOutline as HelpOutlineIcon,
  DeleteOutline as DeleteIcon,
  MoreVert as MoreVertIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useReleaseFlowTemplates, useReleaseFlowPlan } from '../../hooks/useReleaseFlows';
import {
  applyTemplate,
  deletePlan,
  startMilestone,
  startPlan,
  pausePlan,
  resumePlan,
  setTransitionCondition,
  removeTransitionCondition,
} from '../../services/releaseFlowService';
import { formatRelativeTime } from '../../utils/dateFormat';
import SafeguardPanel from './SafeguardPanel';
import StrategyListReadonly from './StrategyListReadonly';
import { ContextFieldInfo } from './ConstraintDisplay';
import { ReleaseFlowTemplate } from '../../services/releaseFlowService';
import ConfirmDialog from '../common/ConfirmDialog';

interface ReleaseFlowTabProps {
  flagId: string;
  flagName: string;
  environments: Array<{ environment: string; displayName: string }>;
  canManage: boolean;
  initialShowTemplates?: boolean;
  envEnabled?: boolean;
  allSegments?: any[];
  contextFields?: ContextFieldInfo[];
  onPlanDeleted?: () => void;
  onPlanChange?: () => void;
}

// ==================== Types ====================

type TimeUnit = 'minutes' | 'hours' | 'days';

// ==================== Helpers ====================

/** Format transition interval into human-readable text */
function formatTransitionInterval(
  intervalMinutes: number,
  t: (key: string, options?: any) => string
): string {
  if (intervalMinutes >= 1440 && intervalMinutes % 1440 === 0) {
    return t('releaseFlow.daysInterval', { count: intervalMinutes / 1440 });
  }
  if (intervalMinutes >= 60 && intervalMinutes % 60 === 0) {
    return t('releaseFlow.hoursInterval', { count: intervalMinutes / 60 });
  }
  return t('releaseFlow.minutesInterval', { count: intervalMinutes });
}

/** Convert value + unit to total minutes */
function toMinutes(value: number, unit: TimeUnit): number {
  switch (unit) {
    case 'days':
      return value * 1440;
    case 'hours':
      return value * 60;
    default:
      return value;
  }
}

/** Convert total minutes to best-fit value + unit */
function fromMinutes(totalMinutes: number): { value: number; unit: TimeUnit } {
  if (totalMinutes >= 1440 && totalMinutes % 1440 === 0) {
    return { value: totalMinutes / 1440, unit: 'days' };
  }
  if (totalMinutes >= 60 && totalMinutes % 60 === 0) {
    return { value: totalMinutes / 60, unit: 'hours' };
  }
  return { value: totalMinutes, unit: 'minutes' };
}

/** Calculate when the next milestone is scheduled */
function getScheduledTime(startedAt: string | undefined, intervalMinutes: number): Date | null {
  if (!startedAt) return null;
  const start = new Date(startedAt);
  if (isNaN(start.getTime())) return null;
  return new Date(start.getTime() + intervalMinutes * 60 * 1000);
}

/** Format a Date as localized time string */
function formatScheduledTime(date: Date): string {
  return date.toLocaleString(undefined, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ==================== Component ====================

const ReleaseFlowTab: React.FC<ReleaseFlowTabProps> = ({
  flagId,
  flagName,
  environments,
  canManage,
  initialShowTemplates = false,
  envEnabled = false,
  allSegments = [],
  contextFields = [],
  onPlanDeleted,
  onPlanChange,
}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [selectedEnv, setSelectedEnv] = useState<string>(
    environments.length > 0 ? environments[0].environment : ''
  );

  const { data: templates, isLoading: loadingTemplates } = useReleaseFlowTemplates();
  const {
    data: plan,
    isLoading: loadingPlan,
    mutate: mutatePlan,
  } = useReleaseFlowPlan(flagId, selectedEnv);

  const [applying, setApplying] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showApplyDialog, setShowApplyDialog] = useState(initialShowTemplates);

  const [jumpConfirmOpen, setJumpConfirmOpen] = useState(false);
  const [targetMilestoneId, setTargetMilestoneId] = useState<string | null>(null);
  const [safeguardExpanded, setSafeguardExpanded] = useState(false);
  const [flowExpanded, setFlowExpanded] = useState(true);
  const [expandedMilestones, setExpandedMilestones] = useState<Set<string>>(new Set());
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [expandedTemplates, setExpandedTemplates] = useState<Set<string>>(new Set());
  const [flowMenuAnchor, setFlowMenuAnchor] = useState<null | HTMLElement>(null);

  // Transition editing state: tracks which milestone is being edited
  const [editingTransitionId, setEditingTransitionId] = useState<string | null>(null);
  const [transitionValue, setTransitionValue] = useState<number>(1);
  const [transitionUnit, setTransitionUnit] = useState<TimeUnit>('hours');
  const [transitionSaving, setTransitionSaving] = useState(false);

  // Auto-pause/resume based on environment enabled state
  const prevEnvEnabledRef = React.useRef(envEnabled);

  React.useEffect(() => {
    if (!plan || !canManage) return;
    if (prevEnvEnabledRef.current === envEnabled) return;
    prevEnvEnabledRef.current = envEnabled;

    const handleAutoControl = async () => {
      if (!envEnabled && plan.status === 'active') {
        // Environment disabled -> auto-pause
        try {
          await pausePlan(plan.id);
          enqueueSnackbar(t('releaseFlow.pausedSuccess'), { variant: 'info' });
          mutatePlan();
          if (onPlanChange) onPlanChange();
        } catch (error) {
          console.error('Auto-pause failed', error);
        }
      } else if (envEnabled && plan.status === 'paused') {
        // Environment re-enabled -> auto-resume
        try {
          await resumePlan(plan.id);
          enqueueSnackbar(t('releaseFlow.resumedSuccess'), { variant: 'info' });
          mutatePlan();
          if (onPlanChange) onPlanChange();
        } catch (error) {
          console.error('Auto-resume failed', error);
        }
      } else if (envEnabled && plan.status === 'draft') {
        // Environment enabled with draft plan -> auto-start
        try {
          await startPlan(plan.id);
          enqueueSnackbar(t('releaseFlow.startedSuccess'), { variant: 'success' });
          mutatePlan();
          if (onPlanChange) onPlanChange();
        } catch (error) {
          console.error('Auto-start failed', error);
        }
      }
    };

    handleAutoControl();
  }, [envEnabled, plan?.status, plan?.id, canManage]);

  // ==================== Handlers ====================

  const handleApplyTemplate = async (templateId: string) => {
    try {
      setApplying(true);
      // If a plan already exists, archive it first before applying a new template
      if (plan) {
        await deletePlan(plan.id);
      }
      await applyTemplate({ flagId, environment: selectedEnv, templateId });
      enqueueSnackbar(t('releaseFlow.applySuccess'), { variant: 'success' });
      mutatePlan();
      if (onPlanChange) onPlanChange();
      setShowApplyDialog(false);
    } catch (error: any) {
      enqueueSnackbar(error.message || t('releaseFlow.applyFailed'), { variant: 'error' });
    } finally {
      setApplying(false);
    }
  };

  const handleDeletePlan = async () => {
    if (!plan) return;
    try {
      setActionLoading(true);
      await deletePlan(plan.id);
      enqueueSnackbar(t('releaseFlow.planDeleteSuccess'), { variant: 'success' });
      mutatePlan();
      if (onPlanChange) onPlanChange();
      setDeleteConfirmOpen(false);
      onPlanDeleted?.();
    } catch (error: any) {
      enqueueSnackbar(error.message || t('common.error'), { variant: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartMilestoneClick = (milestoneId: string) => {
    setTargetMilestoneId(milestoneId);
    setJumpConfirmOpen(true);
  };

  const handleConfirmStartMilestone = async () => {
    if (!plan || !targetMilestoneId) return;
    try {
      setActionLoading(true);
      await startMilestone(plan.id, targetMilestoneId);

      // If environment is disabled, immediately pause so it doesn't run
      if (!envEnabled) {
        await pausePlan(plan.id);
      }

      enqueueSnackbar(t('releaseFlow.milestoneStartSuccess'), { variant: 'success' });
      mutatePlan();
      if (onPlanChange) onPlanChange();
      setJumpConfirmOpen(false);
      setTargetMilestoneId(null);
    } catch (error: any) {
      enqueueSnackbar(error.message || t('releaseFlow.milestoneStartFailed'), { variant: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handlePause = async () => {
    if (!plan) return;
    try {
      setActionLoading(true);
      await pausePlan(plan.id);
      enqueueSnackbar(t('releaseFlow.pausedSuccess'), { variant: 'success' });
      mutatePlan();
      if (onPlanChange) onPlanChange();
    } catch (error: any) {
      enqueueSnackbar(error.message || t('releaseFlow.applyFailed'), { variant: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async () => {
    if (!plan || !envEnabled) return;
    try {
      setActionLoading(true);
      await resumePlan(plan.id);
      enqueueSnackbar(t('releaseFlow.resumedSuccess'), { variant: 'success' });
      mutatePlan();
      if (onPlanChange) onPlanChange();
    } catch (error: any) {
      enqueueSnackbar(error.message || t('releaseFlow.applyFailed'), { variant: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  // --- Transition handlers ---

  const handleOpenTransitionEdit = useCallback(
    (milestoneId: string, currentIntervalMinutes?: number) => {
      setEditingTransitionId(milestoneId);
      if (currentIntervalMinutes) {
        const { value, unit } = fromMinutes(currentIntervalMinutes);
        setTransitionValue(value);
        setTransitionUnit(unit);
      } else {
        setTransitionValue(1);
        setTransitionUnit('hours');
      }
    },
    []
  );

  const handleSaveTransition = useCallback(async () => {
    if (!editingTransitionId || transitionValue <= 0) return;
    try {
      setTransitionSaving(true);
      const totalMinutes = toMinutes(transitionValue, transitionUnit);
      await setTransitionCondition(editingTransitionId, totalMinutes);
      mutatePlan();
      if (onPlanChange) onPlanChange();
      setEditingTransitionId(null);
    } catch (error: any) {
      enqueueSnackbar(error.message || t('releaseFlow.applyFailed'), { variant: 'error' });
    } finally {
      setTransitionSaving(false);
    }
  }, [editingTransitionId, transitionValue, transitionUnit, mutatePlan, enqueueSnackbar, t]);

  const handleRemoveTransition = useCallback(
    async (milestoneId: string) => {
      try {
        setTransitionSaving(true);
        await removeTransitionCondition(milestoneId);
        mutatePlan();
        if (onPlanChange) onPlanChange();
        setEditingTransitionId(null);
      } catch (error: any) {
        enqueueSnackbar(error.message || t('releaseFlow.applyFailed'), { variant: 'error' });
      } finally {
        setTransitionSaving(false);
      }
    },
    [mutatePlan, enqueueSnackbar, t]
  );

  // ==================== Derived State ====================

  const milestones = plan?.milestones || [];
  const currentMilestoneIndex = plan
    ? milestones.findIndex((m) => m.id === plan.activeMilestoneId)
    : -1;
  const isCompleted = plan?.activeMilestoneId === 'completed';
  const isPaused = plan?.status === 'paused';
  const isActive = plan?.status === 'active';

  // Resolve the plan display name from the referenced template
  const planDisplayName = useMemo(() => {
    if (!plan) return '';
    const matchedTemplate = templates?.find((t) => t.flowName === plan.flowName);
    if (matchedTemplate) return matchedTemplate.displayName || matchedTemplate.flowName;
    return plan.displayName || plan.flowName;
  }, [plan, templates]);

  // Safeguard: use first milestone ID for flow-level safeguards
  const safeguardMilestoneId = useMemo(() => {
    if (!milestones.length) return '';
    return milestones[0].id;
  }, [milestones]);

  // ==================== Render Helpers ====================

  /** Get milestone visual status */
  const getMilestoneStatus = (index: number): 'completed' | 'active' | 'paused' | 'pending' => {
    if (isCompleted || index < currentMilestoneIndex) return 'completed';
    if (index === currentMilestoneIndex) {
      if (isPaused || !envEnabled) return 'paused';
      return 'active';
    }
    return 'pending';
  };

  /** Controls for each milestone row */
  const renderMilestoneControls = (milestoneId: string, index: number, isScheduled: boolean) => {
    if (!canManage || isCompleted) return null;
    // Draft plans haven't started yet — no jump controls
    if (plan?.status === 'draft') return null;

    // Active milestone: only show pause button when there is an automated transition timer
    if (index === currentMilestoneIndex) {
      const currentMilestone = milestones[index];
      const hasAutomation = !!currentMilestone?.transitionCondition?.intervalMinutes;
      // No pause on last milestone (nothing to transition to), when already paused, or when there's no automation
      if (isPaused || index >= milestones.length - 1 || !hasAutomation) return null;
      return (
        <Button
          variant="outlined"
          color="warning"
          size="small"
          onClick={handlePause}
          startIcon={actionLoading ? <CircularProgress size={14} color="inherit" /> : <PauseIcon />}
          disabled={actionLoading}
          sx={{ whiteSpace: 'nowrap' }}
        >
          {t('releaseFlow.pause')}
        </Button>
      );
    }

    // Other milestones: show "jump to" or "start now" button
    return (
      <Button
        size="small"
        variant="outlined"
        color="primary"
        onClick={() => handleStartMilestoneClick(milestoneId)}
        startIcon={
          actionLoading ? (
            <CircularProgress size={14} color="inherit" />
          ) : isScheduled ? (
            <StartIcon />
          ) : (
            <DoubleArrowIcon />
          )
        }
        disabled={actionLoading}
        sx={{ whiteSpace: 'nowrap' }}
      >
        {isScheduled ? t('releaseFlow.startNow') : t('releaseFlow.goToMilestone')}
      </Button>
    );
  };

  /** Connector + transition info between milestone cards */
  const renderMilestoneConnector = (milestone: any, index: number) => {
    if (index >= milestones.length - 1) return null;

    const hasTransition = !!milestone.transitionCondition?.intervalMinutes;
    const intervalMinutes = milestone.transitionCondition?.intervalMinutes || 0;
    const isEditing = editingTransitionId === milestone.id;

    // Is this the currently active milestone?
    const isCurrentActive = index === currentMilestoneIndex && (isActive || isPaused);
    const status = getMilestoneStatus(index);
    const lineColor = status === 'completed' ? 'success.main' : 'divider';

    // Estimated scheduled time
    const scheduledTime =
      isCurrentActive && hasTransition && milestone.startedAt
        ? getScheduledTime(milestone.startedAt, intervalMinutes)
        : null;
    const isScheduledInFuture = scheduledTime && scheduledTime > new Date();

    return (
      <Box sx={{ display: 'flex', alignItems: 'stretch', py: 0 }}>
        {/* Vertical connector line */}
        <Box
          sx={{
            width: 40,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <Box sx={{ width: 2, flexGrow: 1, bgcolor: lineColor, minHeight: 16 }} />
          <ArrowDownIcon sx={{ fontSize: 16, color: lineColor, my: -0.25 }} />
          <Box sx={{ width: 2, flexGrow: 1, bgcolor: lineColor, minHeight: 16 }} />
        </Box>

        {/* Transition content */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            py: 0.5,
            pl: 1,
          }}
        >
          {isEditing ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TimerIcon sx={{ fontSize: 16, color: 'primary.main' }} />
              <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                {t('releaseFlow.proceedAfter')}
              </Typography>
              <TextField
                type="number"
                size="small"
                value={transitionValue}
                onChange={(e) => setTransitionValue(Math.max(1, parseInt(e.target.value) || 1))}
                inputProps={{
                  min: 1,
                  style: { width: 50, padding: '4px 8px', fontSize: '0.8rem' },
                }}
                sx={{ '& .MuiOutlinedInput-root': { height: 28 } }}
              />
              <Select
                size="small"
                value={transitionUnit}
                onChange={(e) => setTransitionUnit(e.target.value as TimeUnit)}
                sx={{ height: 28, fontSize: '0.8rem', minWidth: 80 }}
              >
                <MenuItem value="minutes">{t('releaseFlow.unitMinutes')}</MenuItem>
                <MenuItem value="hours">{t('releaseFlow.unitHours')}</MenuItem>
                <MenuItem value="days">{t('releaseFlow.unitDays')}</MenuItem>
              </Select>
              <Button
                size="small"
                variant="contained"
                onClick={handleSaveTransition}
                disabled={transitionSaving || transitionValue <= 0}
                sx={{ minWidth: 0, px: 1.5, height: 28, fontSize: '0.75rem' }}
              >
                {transitionSaving ? <CircularProgress size={14} /> : t('common.save')}
              </Button>
              <IconButton
                size="small"
                onClick={() => setEditingTransitionId(null)}
                disabled={transitionSaving}
              >
                <CloseIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Box>
          ) : hasTransition ? (
            <Chip
              icon={<TimerIcon sx={{ fontSize: 14 }} />}
              label={formatTransitionInterval(intervalMinutes, t)}
              size="small"
              variant="outlined"
              color="primary"
              sx={{ height: 24, '& .MuiChip-label': { fontSize: '0.75rem' } }}
              onClick={
                canManage && !isCompleted && !envEnabled
                  ? () => handleOpenTransitionEdit(milestone.id, intervalMinutes)
                  : undefined
              }
              onDelete={
                canManage && !isCompleted && !envEnabled
                  ? () => handleRemoveTransition(milestone.id)
                  : undefined
              }
            />
          ) : (
            canManage &&
            !isCompleted &&
            !envEnabled && (
              <Link
                component="button"
                variant="caption"
                color="text.secondary"
                underline="hover"
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  cursor: 'pointer',
                  '&:hover': { color: 'primary.main' },
                }}
                onClick={() => handleOpenTransitionEdit(milestone.id)}
              >
                <AddIcon sx={{ fontSize: 14 }} />
                {t('releaseFlow.addTransition')}
              </Link>
            )
          )}
        </Box>
      </Box>
    );
  };

  // ==================== Loading ====================

  if (loadingPlan && !plan) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  // ==================== Render ====================

  return (
    <Box>
      {/* Environment Selector */}
      {environments.length > 1 && (
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="subtitle2">{t('featureFlags.environment')}:</Typography>
          <Stack direction="row" spacing={1}>
            {environments.map((env) => (
              <Chip
                key={env.environment}
                label={env.displayName}
                onClick={() => setSelectedEnv(env.environment)}
                color={selectedEnv === env.environment ? 'primary' : 'default'}
                variant={selectedEnv === env.environment ? 'filled' : 'outlined'}
                size="small"
              />
            ))}
          </Stack>
        </Box>
      )}

      {plan && (
        /* ==================== Active Plan ==================== */
        <Box>
          {/* Environment disabled warning */}
          {!envEnabled && !isCompleted && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {t('releaseFlow.envDisabledWarning')}
            </Alert>
          )}

          <Card variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
            {/* ---- Header ---- */}
            <Box
              sx={{
                px: 2.5,
                py: 1.5,
                bgcolor: 'action.hover',
                borderBottom: flowExpanded ? 1 : 0,
                borderColor: 'divider',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                '&:hover': {
                  bgcolor: (theme) =>
                    theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                },
                transition: 'background-color 0.15s',
              }}
              onClick={() => setFlowExpanded(!flowExpanded)}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
                <Tooltip title={planDisplayName} enterDelay={500}>
                  <Typography
                    variant="subtitle1"
                    sx={{
                      fontWeight: 700,
                      maxWidth: 200,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {planDisplayName}
                  </Typography>
                </Tooltip>
                {(() => {
                  const statusMap: Record<
                    string,
                    { label: string; color: 'default' | 'success' | 'primary' | 'warning' }
                  > = {
                    draft: { label: t('releaseFlow.statusDraft'), color: 'default' },
                    active: { label: t('releaseFlow.statusActive'), color: 'primary' },
                    paused: { label: t('releaseFlow.statusPaused'), color: 'warning' },
                  };
                  const status = isCompleted
                    ? { label: t('releaseFlow.statusCompleted'), color: 'success' as const }
                    : statusMap[plan?.status || 'draft'];
                  return status ? (
                    <Chip
                      label={status.label}
                      color={status.color}
                      size="small"
                      sx={{
                        height: 22,
                        '& .MuiChip-label': { px: 0.75, fontSize: '0.7rem', fontWeight: 600 },
                      }}
                    />
                  ) : null;
                })()}
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {canManage && !isCompleted && (
                  <>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFlowMenuAnchor(e.currentTarget);
                      }}
                    >
                      <MoreVertIcon fontSize="small" />
                    </IconButton>
                    <Menu
                      anchorEl={flowMenuAnchor}
                      open={Boolean(flowMenuAnchor)}
                      onClose={() => setFlowMenuAnchor(null)}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MenuItem
                        onClick={() => {
                          setFlowMenuAnchor(null);
                          setShowApplyDialog(true);
                        }}
                        disabled={envEnabled || applying}
                      >
                        <AdvanceIcon fontSize="small" sx={{ mr: 1 }} />
                        {t('releaseFlow.switchTemplate')}
                      </MenuItem>
                      <MenuItem
                        onClick={() => {
                          setFlowMenuAnchor(null);
                          setDeleteConfirmOpen(true);
                        }}
                        disabled={envEnabled || actionLoading}
                        sx={{ color: 'error.main' }}
                      >
                        <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
                        {t('releaseFlow.deleteTemplate')}
                      </MenuItem>
                    </Menu>
                  </>
                )}
                <IconButton size="small" tabIndex={-1}>
                  {flowExpanded ? (
                    <ExpandLessIcon fontSize="small" />
                  ) : (
                    <ExpandMoreIcon fontSize="small" />
                  )}
                </IconButton>
              </Box>
            </Box>

            <Collapse in={flowExpanded}>
              {/* ---- Safeguard Section (flow-level, collapsible) ---- */}
              {safeguardMilestoneId && (
                <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                  <Box
                    sx={{
                      px: 2.5,
                      py: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      '&:hover': { bgcolor: 'action.hover' },
                      transition: 'background-color 0.15s',
                    }}
                    onClick={() => setSafeguardExpanded(!safeguardExpanded)}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <ShieldIcon fontSize="small" color="primary" />
                      <Typography variant="subtitle2">{t('releaseFlow.safeguards')}</Typography>
                      <Tooltip
                        title={t('releaseFlow.safeguard.helpTooltip').replace(/\\n/g, '\n')}
                        arrow
                        placement="right"
                        slotProps={{
                          tooltip: {
                            sx: { maxWidth: 360, whiteSpace: 'pre-line', fontSize: '0.8rem' },
                          },
                        }}
                      >
                        <HelpOutlineIcon
                          sx={{ color: 'text.secondary', cursor: 'help', fontSize: 16 }}
                          onClick={(e: React.MouseEvent) => e.stopPropagation()}
                        />
                      </Tooltip>
                    </Box>
                    <IconButton size="small" tabIndex={-1}>
                      {safeguardExpanded ? (
                        <ExpandLessIcon fontSize="small" />
                      ) : (
                        <ExpandMoreIcon fontSize="small" />
                      )}
                    </IconButton>
                  </Box>
                  <Collapse in={safeguardExpanded}>
                    <Box sx={{ px: 2.5, pb: 2 }}>
                      <SafeguardPanel
                        flowId={plan.id}
                        milestoneId={safeguardMilestoneId}
                        canManage={canManage}
                        hideHeader
                      />
                    </Box>
                  </Collapse>
                </Box>
              )}

              {/* ---- Milestone Cards ---- */}
              <CardContent sx={{ p: 2.5 }}>
                {milestones.map((milestone, index) => {
                  const status = getMilestoneStatus(index);
                  const borderColorMap = {
                    completed: 'success.main',
                    active: 'primary.main',
                    paused: 'warning.main',
                    pending: 'grey.300',
                  };
                  const bgMap = {
                    completed: 'success.main',
                    active: 'primary.main',
                    paused: 'warning.main',
                    pending: 'grey.400',
                  };

                  const prevMilestone = index > 0 ? milestones[index - 1] : null;
                  const prevInterval = prevMilestone?.transitionCondition?.intervalMinutes;
                  const scheduledTime =
                    prevInterval && prevMilestone?.startedAt
                      ? getScheduledTime(prevMilestone.startedAt, prevInterval)
                      : null;
                  const isScheduled = !!(prevInterval && status === 'pending');

                  return (
                    <React.Fragment key={milestone.id}>
                      {/* Milestone Card */}
                      <Paper
                        variant="outlined"
                        sx={{
                          borderLeft: 4,
                          borderLeftColor: borderColorMap[status],
                          borderRadius: 2,
                          overflow: 'hidden',
                          transition: 'all 0.2s',
                          ...(status === 'active' && {
                            boxShadow: '0 0 18px 4px rgba(25, 118, 210, 0.45)',
                          }),
                          ...(status === 'paused' && {
                            boxShadow: '0 0 14px 3px rgba(237, 108, 2, 0.3)',
                          }),
                        }}
                      >
                        {/* Card Header */}
                        <Box
                          onClick={() => {
                            setExpandedMilestones((prev) => {
                              const next = new Set(prev);
                              if (next.has(milestone.id)) {
                                next.delete(milestone.id);
                              } else {
                                next.add(milestone.id);
                              }
                              return next;
                            });
                          }}
                          sx={{
                            px: 2,
                            py: 1.25,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            bgcolor:
                              status === 'active' || status === 'paused'
                                ? (theme) =>
                                    theme.palette.mode === 'dark'
                                      ? 'rgba(255,255,255,0.03)'
                                      : 'rgba(0,0,0,0.015)'
                                : 'transparent',
                            cursor: 'pointer',
                            '&:hover': {
                              bgcolor: (theme) =>
                                theme.palette.mode === 'dark'
                                  ? 'rgba(255,255,255,0.05)'
                                  : 'rgba(0,0,0,0.03)',
                            },
                          }}
                        >
                          <Box
                            sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}
                          >
                            {/* Step number badge */}
                            <Box
                              sx={{
                                position: 'relative',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              {status === 'active' && (
                                <CircularProgress
                                  variant="indeterminate"
                                  size={32}
                                  thickness={2.5}
                                  sx={{
                                    position: 'absolute',
                                    color: 'primary.main',
                                    opacity: 0.5,
                                  }}
                                />
                              )}
                              {status === 'completed' ? (
                                <CompletedIcon sx={{ fontSize: 24, color: 'success.main' }} />
                              ) : (
                                <Box
                                  sx={{
                                    bgcolor: bgMap[status],
                                    color: 'white',
                                    width: 24,
                                    height: 24,
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '0.75rem',
                                    fontWeight: 'bold',
                                  }}
                                >
                                  {status === 'paused' ? (
                                    <PauseIcon sx={{ fontSize: '0.85rem' }} />
                                  ) : (
                                    index + 1
                                  )}
                                </Box>
                              )}
                            </Box>

                            <Box sx={{ minWidth: 0 }}>
                              <Typography
                                variant="subtitle2"
                                fontWeight={status === 'active' || status === 'paused' ? 700 : 500}
                                color={status === 'pending' ? 'text.secondary' : 'text.primary'}
                                noWrap
                              >
                                {milestone.name}
                              </Typography>
                              {milestone.startedAt &&
                                envEnabled &&
                                (isCompleted || index <= currentMilestoneIndex) && (
                                  <Typography variant="caption" color="text.secondary">
                                    {t('common.started')}: {formatRelativeTime(milestone.startedAt)}
                                  </Typography>
                                )}
                              {/* Estimated start time for next-up milestone */}
                              {(() => {
                                if (!envEnabled) return null;
                                if (index <= 0 || status !== 'pending') return null;
                                const prevMilestone = milestones[index - 1];
                                const prevInterval =
                                  prevMilestone?.transitionCondition?.intervalMinutes;
                                if (!prevInterval || !prevMilestone.startedAt) return null;
                                const scheduled =
                                  prevInterval && prevMilestone?.startedAt
                                    ? getScheduledTime(prevMilestone.startedAt, prevInterval)
                                    : null;
                                if (!scheduled || scheduled <= new Date()) return null;
                                return (
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <ScheduleIcon sx={{ fontSize: 13, color: 'info.main' }} />
                                    <Typography
                                      variant="caption"
                                      color="info.main"
                                      sx={{ fontWeight: 600 }}
                                    >
                                      {t('releaseFlow.estimatedStart')}:{' '}
                                      {formatScheduledTime(scheduled)}
                                    </Typography>
                                  </Box>
                                );
                              })()}
                            </Box>
                          </Box>

                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            {/* Paused badge on the milestone itself */}
                            {status === 'paused' &&
                              (() => {
                                const pausedTime = milestone.pausedAt;
                                return (
                                  <Chip
                                    icon={<PauseIcon sx={{ fontSize: 14 }} />}
                                    label={
                                      pausedTime
                                        ? `${t('releaseFlow.pausedAt')}: ${formatRelativeTime(pausedTime)}`
                                        : t('releaseFlow.pausedAt')
                                    }
                                    color="warning"
                                    size="small"
                                    sx={{
                                      height: 22,
                                      '& .MuiChip-label': { px: 0.75, fontSize: '0.7rem' },
                                    }}
                                  />
                                );
                              })()}
                            <Box
                              onClick={(e: React.MouseEvent) => e.stopPropagation()}
                              sx={{ flexShrink: 0 }}
                            >
                              {renderMilestoneControls(milestone.id, index, isScheduled)}
                            </Box>
                            {expandedMilestones.has(milestone.id) ? (
                              <ExpandLessIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                            ) : (
                              <ExpandMoreIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                            )}
                          </Box>
                        </Box>

                        {/* Card Body */}
                        <Collapse in={expandedMilestones.has(milestone.id)} timeout={200}>
                          <Box sx={{ px: 2, py: 1.5 }}>
                            {milestone.description && (
                              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                                {milestone.description}
                              </Typography>
                            )}

                            {/* Strategies */}
                            <Box sx={{ pl: 1.5, borderLeft: 2, borderColor: 'divider' }}>
                              <Typography
                                variant="caption"
                                fontWeight={600}
                                display="block"
                                sx={{ mb: 0.5 }}
                              >
                                {t('releaseFlow.appliedStrategies')}
                              </Typography>
                              <StrategyListReadonly
                                strategies={(milestone.strategies || []).map((s: any) => ({
                                  strategyName: s.strategyName,
                                  parameters: s.parameters,
                                  constraints: s.constraints,
                                  segments: s.segments,
                                }))}
                                allSegments={allSegments}
                                contextFields={contextFields}
                              />
                            </Box>
                          </Box>
                        </Collapse>
                      </Paper>

                      {/* Connector between milestones */}
                      {renderMilestoneConnector(milestone, index)}
                    </React.Fragment>
                  );
                })}
              </CardContent>
            </Collapse>
          </Card>
        </Box>
      )}

      {/* ==================== Dialogs ==================== */}

      {/* Apply Template Dialog */}
      <Dialog
        open={showApplyDialog}
        onClose={() => !applying && setShowApplyDialog(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 2, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' },
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 2 }}>
          <TemplateIcon color="primary" />
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {t('releaseFlow.selectTemplate')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('releaseFlow.selectTemplateDesc')}
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent dividers sx={{ bgcolor: 'action.hover', py: 3 }}>
          {loadingTemplates ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
                gap: 2,
              }}
            >
              {templates?.map((template) => {
                const isCurrentTemplate = plan?.flowName === template.flowName;
                return (
                  <Card
                    key={template.id}
                    variant="outlined"
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      transition: 'all 0.2s',
                      position: 'relative',
                      overflow: 'visible',
                      opacity: isCurrentTemplate ? 0.6 : 1,
                      '&:hover':
                        !applying && !isCurrentTemplate
                          ? {
                              borderColor: 'primary.main',
                              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                            }
                          : {},
                    }}
                  >
                    <CardContent sx={{ flexGrow: 1, p: 2.5, pb: 1.5 }}>
                      {/* Template header */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Box
                          sx={{
                            p: 0.8,
                            borderRadius: 1,
                            bgcolor: 'primary.main',
                            color: 'primary.contrastText',
                            display: 'flex',
                          }}
                        >
                          <TemplateIcon fontSize="small" />
                        </Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                          {template.displayName || template.flowName}
                        </Typography>
                        {isCurrentTemplate && (
                          <Chip
                            label={t('releaseFlow.currentTemplate')}
                            size="small"
                            color="primary"
                            variant="outlined"
                            sx={{
                              height: 20,
                              '& .MuiChip-label': { px: 0.75, fontSize: '0.65rem' },
                            }}
                          />
                        )}
                      </Box>
                      {template.description && (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                          {template.description}
                        </Typography>
                      )}

                      {/* Milestone summary + collapsible details */}
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          cursor: 'pointer',
                          py: 0.5,
                          '&:hover': { opacity: 0.8 },
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedTemplates((prev) => {
                            const next = new Set(prev);
                            if (next.has(template.id)) {
                              next.delete(template.id);
                            } else {
                              next.add(template.id);
                            }
                            return next;
                          });
                        }}
                      >
                        <Typography variant="caption" color="text.secondary">
                          {template.milestones?.length || 0}{' '}
                          {t('releaseFlow.milestones').toLowerCase()}
                        </Typography>
                        <IconButton size="small" tabIndex={-1} sx={{ p: 0 }}>
                          {expandedTemplates.has(template.id) ? (
                            <ExpandLessIcon sx={{ fontSize: 16 }} />
                          ) : (
                            <ExpandMoreIcon sx={{ fontSize: 16 }} />
                          )}
                        </IconButton>
                      </Box>

                      <Collapse in={expandedTemplates.has(template.id)}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 0.5 }}>
                          {template.milestones?.map((m: any, idx: number) => (
                            <Paper
                              key={idx}
                              variant="outlined"
                              sx={{
                                overflow: 'hidden',
                                bgcolor: 'background.paper',
                              }}
                            >
                              {/* Milestone header */}
                              <Box
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 1,
                                  px: 1.5,
                                  py: 0.8,
                                  bgcolor: 'action.hover',
                                  borderBottom: 1,
                                  borderColor: 'divider',
                                }}
                              >
                                <Chip
                                  label={`${idx + 1}`}
                                  size="small"
                                  sx={{
                                    width: 20,
                                    height: 20,
                                    fontSize: '0.65rem',
                                    bgcolor: 'primary.light',
                                    color: 'primary.contrastText',
                                    '& .MuiChip-label': { px: 0 },
                                  }}
                                />
                                <Typography variant="caption" sx={{ fontWeight: 700 }}>
                                  {m.name}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  sx={{ ml: 'auto' }}
                                >
                                  {m.strategies?.length || 0}{' '}
                                  {t('releaseFlow.strategies').toLowerCase()}
                                </Typography>
                              </Box>

                              {/* Strategies */}
                              <Box sx={{ p: 1.5 }}>
                                <StrategyListReadonly
                                  strategies={(m.strategies || []).map((s: any) => ({
                                    strategyName: s.strategyName,
                                    parameters: s.parameters,
                                    constraints: s.constraints,
                                    segments: s.segments,
                                  }))}
                                  allSegments={allSegments}
                                  contextFields={contextFields}
                                />
                              </Box>
                            </Paper>
                          ))}
                        </Box>
                      </Collapse>
                    </CardContent>

                    {/* Apply button */}
                    <Box
                      sx={{
                        p: 1.5,
                        borderTop: 1,
                        borderColor: 'divider',
                        display: 'flex',
                        justifyContent: 'flex-end',
                      }}
                    >
                      <Button
                        size="small"
                        variant="contained"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleApplyTemplate(template.id);
                        }}
                        disabled={applying || isCurrentTemplate}
                      >
                        {isCurrentTemplate
                          ? t('releaseFlow.currentTemplate')
                          : t('releaseFlow.useThisTemplate')}
                      </Button>
                    </Box>

                    {applying && (
                      <Box
                        sx={{
                          position: 'absolute',
                          inset: 0,
                          bgcolor: 'rgba(255,255,255,0.6)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: 1,
                          zIndex: 1,
                        }}
                      >
                        <CircularProgress size={24} />
                      </Box>
                    )}
                  </Card>
                );
              })}
              {templates?.length === 0 && (
                <Box sx={{ gridColumn: '1 / -1', py: 4, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    {t('releaseFlow.noTemplatesFound')}
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button
            onClick={() => {
              setShowApplyDialog(false);
              // If no plan exists, go back to the original view
              if (!plan) onPlanDeleted?.();
            }}
            disabled={applying}
            color="inherit"
          >
            {t('common.cancel')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Milestone Jump Confirmation */}
      <ConfirmDialog
        open={jumpConfirmOpen}
        onClose={() => setJumpConfirmOpen(false)}
        onConfirm={handleConfirmStartMilestone}
        title={t('releaseFlow.moveToMilestone')}
        message={t('releaseFlow.jumpConfirmMessage', {
          name: milestones.find((m) => m.id === targetMilestoneId)?.name || '',
        })}
        confirmLabel={t('common.confirm')}
      />

      {/* Delete Plan Confirmation */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDeletePlan}
        title={t('releaseFlow.deletePlanTitle')}
        message={t('releaseFlow.deletePlanMessage')}
        confirmLabel={t('common.delete')}
        confirmColor="error"
      />
    </Box>
  );
};

export default ReleaseFlowTab;
