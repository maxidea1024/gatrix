import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  IconButton,
  Switch,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  useTheme,
  alpha,
  Tooltip,
  Divider,
  Collapse,
  InputAdornment,
  Checkbox,
  Autocomplete,
} from '@mui/material';
import {
  NotificationsActive as AlertIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PlayArrow as TestIcon,
  Webhook as WebhookIcon,
  Email as EmailIcon,
  History as HistoryIcon,
  BugReport as BugIcon,
  Speed as FrequencyIcon,
  People as UsersIcon,
  Refresh as RegressionIcon,
  Close as CloseIcon,
  ArrowForward as ArrowIcon,
  Warning as WarningIcon,
  CheckCircle as ActiveIcon,
  RemoveCircle as DisabledIcon,
  ExpandMore as ExpandMoreIcon,
  Feedback as FeedbackIcon,
  LocalOffer as TagIcon,
  Search as SearchIcon,
  ContentCopy as DuplicateIcon,
  PriorityHigh as PriorityIcon,
  FilterList as FilterIcon,
  DragIndicator as DragIcon,
  VolumeOff as MuteIcon,
  Schedule as ScheduleIcon,
  Chat as SlackIcon,
  ShowChart as MetricIcon,
  Assignment as JiraIcon,
  ViewKanban as LinearIcon,
  NotificationsActive as PagerDutyIcon,
} from '@mui/icons-material';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { useTranslation } from 'react-i18next';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  Filler,
} from 'chart.js';
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  ChartTooltip,
  Legend,
  Filler
);
import PageContentLoader from '@/components/common/PageContentLoader';
import { ListSkeleton } from '@/components/argus/ArgusSkeletons';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import argusService, {
  ArgusAlertRule,
  ArgusAlertCondition,
  ArgusAlertAction,
  ArgusAlertHistory,
} from '@/services/argusService';
import ArgusBreadcrumbs from '@/components/argus/ArgusBreadcrumbs';
import PageHeader from '@/components/common/PageHeader';
import { useSnackbar } from 'notistack';
import InteractiveTimeSeriesChart from '@/components/argus/InteractiveTimeSeriesChart';
import EmptyPlaceholder from '@/components/common/EmptyPlaceholder';

/* ─── Config ─── */

const getConditionTypes = (
  t: (key: string) => string
): {
  value: ArgusAlertCondition['type'];
  label: string;
  desc: string;
  icon: React.ReactElement;
  color: string;
}[] => [
  {
    value: 'new_issue',
    label: t('argus.alerts.condNewIssue'),
    desc: t('argus.alerts.condNewIssueDesc'),
    icon: <BugIcon sx={{ fontSize: 18 }} />,
    color: '#f44336',
  },
  {
    value: 'event_frequency',
    label: t('argus.alerts.condEventFreq'),
    desc: t('argus.alerts.condEventFreqDesc'),
    icon: <FrequencyIcon sx={{ fontSize: 18 }} />,
    color: '#ff9800',
  },
  {
    value: 'user_count',
    label: t('argus.alerts.condUserCount'),
    desc: t('argus.alerts.condUserCountDesc'),
    icon: <UsersIcon sx={{ fontSize: 18 }} />,
    color: '#2196f3',
  },
  {
    value: 'regression',
    label: t('argus.alerts.condRegression'),
    desc: t('argus.alerts.condRegressionDesc'),
    icon: <RegressionIcon sx={{ fontSize: 18 }} />,
    color: '#9c27b0',
  },
  {
    value: 'new_feedback',
    label: t('argus.alerts.condNewFeedback'),
    desc: t('argus.alerts.condNewFeedbackDesc'),
    icon: <FeedbackIcon sx={{ fontSize: 18 }} />,
    color: '#00bcd4',
  },
  {
    value: 'property_match',
    label: t('argus.alerts.condPropMatch') || 'Event Property Match',
    desc:
      t('argus.alerts.condPropMatchDesc') ||
      'Matches an event property (platform, url, etc.)',
    icon: <FilterIcon sx={{ fontSize: 18 }} />,
    color: '#3f51b5',
  },
  {
    value: 'high_priority_issue',
    label: t('argus.alerts.condHighPriority'),
    desc: t('argus.alerts.condHighPriorityDesc'),
    icon: <PriorityIcon sx={{ fontSize: 18 }} />,
    color: '#e91e63',
  },
  {
    value: 'project_error_rate',
    label: t('argus.alerts.condMetric') || 'Project Error Rate',
    desc:
      t('argus.alerts.condMetricDesc') || 'Global error rate exceeds threshold',
    icon: <MetricIcon sx={{ fontSize: 18 }} />,
    color: '#f44336',
  },
];

const getActionTypes = (
  t: (key: string) => string
): {
  value: ArgusAlertAction['type'];
  label: string;
  icon: React.ReactElement;
  color: string;
}[] => [
  {
    value: 'webhook',
    label: t('argus.alerts.webhook'),
    icon: <WebhookIcon sx={{ fontSize: 18 }} />,
    color: '#7c4dff',
  },
  {
    value: 'email',
    label: t('argus.alerts.email'),
    icon: <EmailIcon sx={{ fontSize: 18 }} />,
    color: '#00bcd4',
  },
  {
    value: 'slack',
    label: 'Slack App',
    icon: <SlackIcon sx={{ fontSize: 18 }} />,
    color: '#36C5F0',
  },
  {
    value: 'jira',
    label: 'Jira Software',
    icon: <JiraIcon sx={{ fontSize: 18 }} />,
    color: '#0052cc',
  },
  {
    value: 'linear',
    label: 'Linear',
    icon: <LinearIcon sx={{ fontSize: 18 }} />,
    color: '#5e6ad2',
  },
  {
    value: 'pagerduty',
    label: 'PagerDuty',
    icon: <PagerDutyIcon sx={{ fontSize: 18 }} />,
    color: '#06ac38',
  },
];

const getIntervals = (t: (key: string) => string) => [
  { value: 60, label: t('argus.alerts.1min') },
  { value: 300, label: t('argus.alerts.5min') },
  { value: 900, label: t('argus.alerts.15min') },
  { value: 1800, label: t('argus.alerts.30min') },
  { value: 3600, label: t('argus.alerts.1hour') },
  { value: 86400, label: t('argus.alerts.1day') },
];

const getFrequencies = (t: (key: string) => string) => [
  { value: 60, label: t('argus.alerts.1min') },
  { value: 300, label: t('argus.alerts.5min') },
  { value: 900, label: t('argus.alerts.15min') },
  { value: 3600, label: t('argus.alerts.1hour') },
  { value: 86400, label: t('argus.alerts.1day') },
];

/* ─── Visual Step Card ─── */

const StepCard: React.FC<{
  step: string;
  label: string;
  color: string;
  isDark: boolean;
  children: React.ReactNode;
}> = ({ step, label, color, isDark, children }) => (
  <Box sx={{ position: 'relative' }}>
    {/* Step badge */}
    <Box
      sx={{
        position: 'absolute',
        top: -10,
        left: 16,
        zIndex: 1,
        px: 1.5,
        py: 0.2,
        borderRadius: 1,
        background: `linear-gradient(135deg, ${color}, ${alpha(color, 0.7)})`,
        color: '#fff',
        fontSize: '0.65rem',
        fontWeight: 800,
        letterSpacing: '0.08em',
      }}
    >
      {step}
    </Box>
    <Paper
      elevation={0}
      sx={{
        p: 2,
        pt: 2.5,
        borderRadius: 2,
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        borderLeft: `3px solid ${color}`,
      }}
    >
      <Typography
        variant="caption"
        sx={{
          color: 'text.disabled',
          fontSize: '0.68rem',
          mb: 1.5,
          display: 'block',
        }}
      >
        {label}
      </Typography>
      {children}
    </Paper>
  </Box>
);

/* ─── Connector Arrow ─── */

const StepConnector: React.FC = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', py: 0.5 }}>
    <Box
      sx={{ width: 2, height: 16, backgroundColor: 'divider', borderRadius: 1 }}
    />
  </Box>
);

/* ─── Condition Selector Card ─── */

const ConditionCard: React.FC<{
  id: string;
  cond: ArgusAlertCondition;
  isDark: boolean;
  onChange: (c: ArgusAlertCondition) => void;
  onRemove: () => void;
}> = ({ id, cond, isDark, onChange, onRemove }) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const { t } = useTranslation();
  const conditionTypes = getConditionTypes(t);
  const intervals = getIntervals(t);
  const config = conditionTypes.find((c) => c.value === cond.type);
  const isMetric = ['project_error_rate'].includes(cond.type);
  const needsThreshold = [
    'event_frequency',
    'user_count',
    'project_error_rate',
  ].includes(cond.type);

  return (
    <Box
      ref={setNodeRef}
      style={style}
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1.5,
        p: 1.5,
        borderRadius: 1.5,
        backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
        position: 'relative',
      }}
    >
      <Box
        {...attributes}
        {...listeners}
        sx={{
          cursor: 'grab',
          mt: 1,
          color: 'text.disabled',
          '&:hover': { color: 'text.primary' },
        }}
      >
        <DragIcon sx={{ fontSize: 18 }} />
      </Box>
      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: alpha(config?.color || '#9e9e9e', 0.1),
          color: config?.color || '#9e9e9e',
        }}
      >
        {config?.icon}
      </Box>
      <Box sx={{ flex: 1 }}>
        <FormControl size="small" fullWidth sx={{ mb: needsThreshold ? 1 : 0 }}>
          <Select
            value={cond.type}
            onChange={(e) => onChange({ ...cond, type: e.target.value as any })}
            sx={{
              fontSize: '0.82rem',
              fontWeight: 600,
              '& .MuiSelect-select': { py: 0.6 },
            }}
          >
            {conditionTypes.map((c) => (
              <MenuItem
                key={c.value}
                value={c.value}
                sx={{ fontSize: '0.82rem' }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ color: c.color }}>{c.icon}</Box>
                  <Box>
                    <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>
                      {c.label}
                    </Typography>
                    <Typography
                      sx={{ fontSize: '0.68rem', color: 'text.disabled' }}
                    >
                      {c.desc}
                    </Typography>
                  </Box>
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {needsThreshold && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              size="small"
              type="number"
              label={t('argus.alerts.threshold')}
              value={cond.value || 10}
              onChange={(e) =>
                onChange({ ...cond, value: Number(e.target.value) })
              }
              sx={{
                width: 100,
                '& .MuiOutlinedInput-root': { fontSize: '0.82rem' },
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment
                    position="start"
                    sx={{ '& .MuiTypography-root': { fontSize: '0.72rem' } }}
                  >
                    {isMetric ? '%' : '≥'}
                  </InputAdornment>
                ),
              }}
            />
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel sx={{ fontSize: '0.75rem' }}>
                {t('argus.alerts.interval')}
              </InputLabel>
              <Select
                value={cond.interval || 3600}
                label={t('argus.alerts.interval')}
                onChange={(e) =>
                  onChange({ ...cond, interval: Number(e.target.value) })
                }
                sx={{ fontSize: '0.82rem' }}
              >
                {intervals.map((i) => (
                  <MenuItem
                    key={i.value}
                    value={i.value}
                    sx={{ fontSize: '0.82rem' }}
                  >
                    {i.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        )}

        {cond.type === 'property_match' && (
          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
            <FormControl size="small" sx={{ minWidth: 110 }}>
              <Select
                value={cond.property || 'platform'}
                onChange={(e) =>
                  onChange({ ...cond, property: e.target.value })
                }
                sx={{ fontSize: '0.82rem', '& .MuiSelect-select': { py: 0.6 } }}
              >
                <MenuItem value="platform" sx={{ fontSize: '0.82rem' }}>
                  Platform
                </MenuItem>
                <MenuItem value="url" sx={{ fontSize: '0.82rem' }}>
                  URL
                </MenuItem>
                <MenuItem value="release" sx={{ fontSize: '0.82rem' }}>
                  Release
                </MenuItem>
                <MenuItem value="environment" sx={{ fontSize: '0.82rem' }}>
                  Environment
                </MenuItem>
                <MenuItem value="level" sx={{ fontSize: '0.82rem' }}>
                  Level
                </MenuItem>
                <MenuItem value="transaction" sx={{ fontSize: '0.82rem' }}>
                  Transaction
                </MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 110 }}>
              <Select
                value={cond.operator || 'equals'}
                onChange={(e) =>
                  onChange({ ...cond, operator: e.target.value })
                }
                sx={{ fontSize: '0.82rem', '& .MuiSelect-select': { py: 0.6 } }}
              >
                <MenuItem value="equals" sx={{ fontSize: '0.82rem' }}>
                  Equals
                </MenuItem>
                <MenuItem value="not_equals" sx={{ fontSize: '0.82rem' }}>
                  Not Equals
                </MenuItem>
                <MenuItem value="contains" sx={{ fontSize: '0.82rem' }}>
                  Contains
                </MenuItem>
                <MenuItem value="starts_with" sx={{ fontSize: '0.82rem' }}>
                  Starts with
                </MenuItem>
                <MenuItem value="ends_with" sx={{ fontSize: '0.82rem' }}>
                  Ends with
                </MenuItem>
              </Select>
            </FormControl>
            <TextField
              size="small"
              sx={{
                flex: 1,
                '& .MuiOutlinedInput-root': { fontSize: '0.82rem' },
              }}
              placeholder="Value"
              value={cond.value || ''}
              onChange={(e) => onChange({ ...cond, value: e.target.value })}
            />
          </Box>
        )}
      </Box>
      <IconButton
        size="small"
        onClick={onRemove}
        sx={{ mt: 0.5, color: 'text.disabled' }}
      >
        <CloseIcon sx={{ fontSize: 16 }} />
      </IconButton>
    </Box>
  );
};

/* ─── Action Selector Card ─── */

const ActionCard: React.FC<{
  id: string;
  action: ArgusAlertAction;
  isDark: boolean;
  onChange: (a: ArgusAlertAction) => void;
  onRemove: () => void;
}> = ({ id, action, isDark, onChange, onRemove }) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const { t } = useTranslation();
  const actionTypes = getActionTypes(t);
  const config = actionTypes.find((a) => a.value === action.type);

  return (
    <Box
      ref={setNodeRef}
      style={style}
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1.5,
        p: 1.5,
        borderRadius: 1.5,
        backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
        position: 'relative',
      }}
    >
      <Box
        {...attributes}
        {...listeners}
        sx={{
          cursor: 'grab',
          mt: 1,
          color: 'text.disabled',
          '&:hover': { color: 'text.primary' },
        }}
      >
        <DragIcon sx={{ fontSize: 18 }} />
      </Box>
      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: alpha(config?.color || '#9e9e9e', 0.1),
          color: config?.color || '#9e9e9e',
        }}
      >
        {config?.icon}
      </Box>
      <Box sx={{ flex: 1 }}>
        <FormControl
          size="small"
          fullWidth
          sx={{ mb: action.type !== 'slack' ? 1 : 0 }}
        >
          <Select
            value={action.type}
            onChange={(e) =>
              onChange({ ...action, type: e.target.value as any })
            }
            sx={{
              fontSize: '0.82rem',
              fontWeight: 600,
              '& .MuiSelect-select': { py: 0.6 },
            }}
          >
            {actionTypes.map((a) => (
              <MenuItem
                key={a.value}
                value={a.value}
                sx={{ fontSize: '0.82rem' }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ color: a.color }}>{a.icon}</Box> {a.label}
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {(action.type === 'webhook' ||
          action.type === 'email' ||
          action.type === 'slack' ||
          action.type === 'jira' ||
          action.type === 'linear' ||
          action.type === 'pagerduty') &&
          (action.type === 'slack' ? (
            <TextField
              size="small"
              fullWidth
              placeholder="e.g. #general, #alerts"
              value={action.channel || ''}
              onChange={(e) => onChange({ ...action, channel: e.target.value })}
              sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.82rem' } }}
            />
          ) : action.type === 'jira' || action.type === 'linear' ? (
            <TextField
              size="small"
              fullWidth
              placeholder="Project Key (e.g. ENG, GAT)"
              value={action.channel || ''}
              onChange={(e) => onChange({ ...action, channel: e.target.value })}
              sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.82rem' } }}
            />
          ) : action.type === 'pagerduty' ? (
            <TextField
              size="small"
              fullWidth
              placeholder="Integration Key"
              value={action.target_url || ''}
              onChange={(e) =>
                onChange({ ...action, target_url: e.target.value })
              }
              sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.82rem' } }}
            />
          ) : (
            <TextField
              size="small"
              fullWidth
              placeholder={
                action.type === 'webhook'
                  ? 'https://hooks.slack.com/services/...'
                  : 'admin@example.com'
              }
              value={action.target_url || ''}
              onChange={(e) =>
                onChange({ ...action, target_url: e.target.value })
              }
              sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.82rem' } }}
            />
          ))}
      </Box>
      <IconButton
        size="small"
        onClick={onRemove}
        sx={{ mt: 0.5, color: 'text.disabled' }}
      >
        <CloseIcon sx={{ fontSize: 16 }} />
      </IconButton>
    </Box>
  );
};

/* ─── Main Component ─── */

interface ArgusAlertRulesPageProps {
  projectId?: string | number;
}

const ArgusAlertRulesPage: React.FC<ArgusAlertRulesPageProps> = ({
  projectId: propProjectId,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';
  const { currentProject } = useOrgProject();
  const { enqueueSnackbar } = useSnackbar();
  const projectId = propProjectId || currentProject?.id;

  // ─── State ───
  const [rules, setRules] = useState<ArgusAlertRule[]>([]);
  const [history, setHistory] = useState<ArgusAlertHistory[]>([]);
  const [stats, setStats] = useState<
    { rule_id: number; bucket: string; count: number }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ArgusAlertRule | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Builder form
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formConditions, setFormConditions] = useState<ArgusAlertCondition[]>([
    { type: 'new_issue' },
  ]);
  const [formActions, setFormActions] = useState<ArgusAlertAction[]>([
    { type: 'webhook', target_url: '' },
  ]);
  const [formFrequency, setFormFrequency] = useState(300);
  const [formEnvironment, setFormEnvironment] = useState('');
  const [formLevel, setFormLevel] = useState('');
  const [formTags, setFormTags] = useState<Record<string, string>>({});
  const [formConditionLogic, setFormConditionLogic] = useState<'any' | 'all'>(
    'any'
  );
  const [newTagKey, setNewTagKey] = useState('');
  const [newTagValue, setNewTagValue] = useState('');
  const [historyFilterRule, setHistoryFilterRule] = useState<number | ''>('');

  // Environments auto-load
  const [availableEnvironments, setAvailableEnvironments] = useState<string[]>(
    []
  );

  // Bulk actions
  const [selectedRules, setSelectedRules] = useState<Set<number>>(new Set());

  // Mute dialog
  const [muteDialogRule, setMuteDialogRule] = useState<ArgusAlertRule | null>(
    null
  );
  const [muteDuration, setMuteDuration] = useState(3600);

  // DnD sensors for condition/action reorder
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const fetchRules = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      setRules(await argusService.listAlertRules(projectId));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const fetchHistory = useCallback(async () => {
    if (!projectId) return;
    try {
      const [h, s] = await Promise.all([
        argusService.getAlertHistory(projectId, { limit: 50 }),
        argusService.getAlertStats(projectId, 7),
      ]);
      setHistory(h);
      setStats(s);
    } catch (e) {
      console.error(e);
    }
  }, [projectId]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  // Fetch available environments
  useEffect(() => {
    if (!projectId) return;
    argusService
      .getFilterOptions(projectId)
      .then((opts) => setAvailableEnvironments(opts.environments || []))
      .catch(() => {});
  }, [projectId]);

  // ─── Bulk Actions ───
  const toggleSelectRule = (id: number) => {
    setSelectedRules((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedRules.size === filteredRules.length) {
      setSelectedRules(new Set());
    } else {
      setSelectedRules(new Set(filteredRules.map((r) => r.id)));
    }
  };

  const handleBulkToggle = async (enable: boolean) => {
    if (!projectId) return;
    try {
      await Promise.all(
        Array.from(selectedRules).map((id) =>
          argusService.updateAlertRule(projectId, id, {
            enabled: enable,
          } as any)
        )
      );
      fetchRules();
      setSelectedRules(new Set());
      enqueueSnackbar(t('argus.alerts.bulkUpdated'), { variant: 'success' });
    } catch {
      enqueueSnackbar(t('common.error'), { variant: 'error' });
    }
  };

  const handleBulkDelete = async () => {
    if (!projectId) return;
    try {
      await Promise.all(
        Array.from(selectedRules).map((id) =>
          argusService.deleteAlertRule(projectId, id)
        )
      );
      fetchRules();
      setSelectedRules(new Set());
      enqueueSnackbar(t('argus.alerts.bulkDeleted'), { variant: 'success' });
    } catch {
      enqueueSnackbar(t('common.error'), { variant: 'error' });
    }
  };

  // ─── Mute ───
  const handleMute = async () => {
    if (!projectId || !muteDialogRule) return;
    try {
      const mutedUntil = new Date(
        Date.now() + muteDuration * 1000
      ).toISOString();
      await argusService.updateAlertRule(projectId, muteDialogRule.id, {
        muted_until: mutedUntil,
      } as any);
      fetchRules();
      setMuteDialogRule(null);
      enqueueSnackbar(t('argus.alerts.muted'), { variant: 'info' });
    } catch {
      enqueueSnackbar(t('common.error'), { variant: 'error' });
    }
  };

  // ─── DnD for conditions/actions ───
  const handleConditionDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = formConditions.findIndex(
      (_, i) => `cond-${i}` === active.id
    );
    const newIndex = formConditions.findIndex(
      (_, i) => `cond-${i}` === over.id
    );
    if (oldIndex !== -1 && newIndex !== -1) {
      setFormConditions(arrayMove(formConditions, oldIndex, newIndex));
    }
  };

  const handleActionDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = formActions.findIndex((_, i) => `act-${i}` === active.id);
    const newIndex = formActions.findIndex((_, i) => `act-${i}` === over.id);
    if (oldIndex !== -1 && newIndex !== -1) {
      setFormActions(arrayMove(formActions, oldIndex, newIndex));
    }
  };

  // ─── Filtered Rules ───
  const filteredRules = useMemo(() => {
    if (!searchQuery.trim()) return rules;
    const q = searchQuery.toLowerCase();
    return rules.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.description && r.description.toLowerCase().includes(q)) ||
        (r.environment && r.environment.toLowerCase().includes(q))
    );
  }, [rules, searchQuery]);

  // ─── Dialog ───
  const openCreate = () => {
    setEditingRule(null);
    setFormName('');
    setFormDescription('');
    setFormConditions([{ type: 'new_issue' }]);
    setFormActions([{ type: 'webhook', target_url: '' }]);
    setFormFrequency(300);
    setFormEnvironment('');
    setFormLevel('');
    setFormTags({});
    setFormConditionLogic('any');
    setNewTagKey('');
    setNewTagValue('');
    setDialogOpen(true);
  };

  const openEdit = (rule: ArgusAlertRule) => {
    setEditingRule(rule);
    setFormName(rule.name);
    setFormDescription(rule.description || '');
    setFormConditions(
      typeof rule.conditions === 'string'
        ? JSON.parse(rule.conditions)
        : rule.conditions
    );
    setFormActions(
      typeof rule.actions === 'string' ? JSON.parse(rule.actions) : rule.actions
    );
    setFormFrequency(rule.frequency);
    setFormEnvironment(rule.environment || '');
    setFormLevel(rule.level || '');
    setFormTags(
      typeof rule.tags === 'string' ? JSON.parse(rule.tags) : rule.tags || {}
    );
    setFormConditionLogic((rule as any).condition_logic || 'any');
    setNewTagKey('');
    setNewTagValue('');
    setDialogOpen(true);
  };

  const openDuplicate = (rule: ArgusAlertRule) => {
    setEditingRule(null);
    setFormName(`${rule.name} (${t('argus.alerts.copy')})`);
    setFormDescription(rule.description || '');
    setFormConditions(
      typeof rule.conditions === 'string'
        ? JSON.parse(rule.conditions)
        : rule.conditions
    );
    setFormActions(
      typeof rule.actions === 'string' ? JSON.parse(rule.actions) : rule.actions
    );
    setFormFrequency(rule.frequency);
    setFormEnvironment(rule.environment || '');
    setFormLevel(rule.level || '');
    setFormTags(
      typeof rule.tags === 'string' ? JSON.parse(rule.tags) : rule.tags || {}
    );
    setFormConditionLogic((rule as any).condition_logic || 'any');
    setNewTagKey('');
    setNewTagValue('');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!projectId) return;
    // Validation
    if (!formName.trim()) {
      enqueueSnackbar(t('argus.alerts.validationNameRequired'), {
        variant: 'warning',
      });
      return;
    }
    if (formConditions.length === 0) {
      enqueueSnackbar(t('argus.alerts.validationConditionRequired'), {
        variant: 'warning',
      });
      return;
    }
    if (formActions.length === 0) {
      enqueueSnackbar(t('argus.alerts.validationActionRequired'), {
        variant: 'warning',
      });
      return;
    }
    // Validate actions
    const invalidWebhook = formActions.find(
      (a) =>
        a.type === 'webhook' &&
        (!a.target_url || !a.target_url.startsWith('http'))
    );
    if (invalidWebhook) {
      enqueueSnackbar(
        t('argus.alerts.validationWebhookUrl') || 'Invalid Webhook URL',
        { variant: 'warning' }
      );
      return;
    }
    const invalidSlack = formActions.find(
      (a) =>
        (a.type === 'slack' || a.type === 'jira' || a.type === 'linear') &&
        !a.channel?.trim()
    );
    if (invalidSlack) {
      enqueueSnackbar('Channel or Project Key is required', {
        variant: 'warning',
      });
      return;
    }
    const invalidEmail = formActions.find(
      (a) =>
        a.type === 'email' && (!a.target_url || !a.target_url.includes('@'))
    );
    if (invalidEmail) {
      enqueueSnackbar('Valid email address is required', {
        variant: 'warning',
      });
      return;
    }
    const invalidPagerDuty = formActions.find(
      (a) => a.type === 'pagerduty' && !a.target_url?.trim()
    );
    if (invalidPagerDuty) {
      enqueueSnackbar('Integration Key is required for PagerDuty', {
        variant: 'warning',
      });
      return;
    }
    try {
      if (editingRule) {
        await argusService.updateAlertRule(projectId, editingRule.id, {
          name: formName,
          description: formDescription || undefined,
          conditions: formConditions,
          actions: formActions,
          frequency: formFrequency,
          environment: formEnvironment || undefined,
          level: formLevel || undefined,
          tags: Object.keys(formTags).length > 0 ? formTags : undefined,
          condition_logic: formConditionLogic,
        } as any);
      } else {
        await argusService.createAlertRule(projectId, {
          name: formName,
          description: formDescription || undefined,
          conditions: formConditions,
          actions: formActions,
          frequency: formFrequency,
          project_id: Number(projectId),
          enabled: true,
          environment: formEnvironment || undefined,
          level: formLevel || undefined,
          tags: Object.keys(formTags).length > 0 ? formTags : undefined,
          condition_logic: formConditionLogic,
        } as any);
      }
      setDialogOpen(false);
      fetchRules();
      enqueueSnackbar(t('argus.alerts.saved'), { variant: 'success' });
    } catch (e) {
      console.error(e);
      enqueueSnackbar(t('argus.alerts.saveFailed'), { variant: 'error' });
    }
  };

  const handleToggle = async (rule: ArgusAlertRule) => {
    if (!projectId) return;
    try {
      await argusService.updateAlertRule(projectId, rule.id, {
        enabled: !rule.enabled,
      } as any);
      fetchRules();
      enqueueSnackbar(
        rule.enabled ? t('argus.alerts.disabled') : t('argus.alerts.enabled'),
        { variant: 'info' }
      );
    } catch (e) {
      console.error(e);
      enqueueSnackbar(t('common.error'), { variant: 'error' });
    }
  };

  const handleDelete = async (ruleId: number) => {
    if (!projectId) return;
    try {
      await argusService.deleteAlertRule(projectId, ruleId);
      setDeleteConfirm(null);
      fetchRules();
      enqueueSnackbar(t('argus.alerts.deleted'), { variant: 'success' });
    } catch (e) {
      console.error(e);
      enqueueSnackbar(t('argus.alerts.deleteFailed'), { variant: 'error' });
    }
  };

  const handleTest = async (ruleId: number) => {
    if (!projectId) return;
    try {
      await argusService.testAlertRule(projectId, ruleId);
      enqueueSnackbar(t('argus.alerts.testSent'), { variant: 'success' });
    } catch (e) {
      console.error(e);
      enqueueSnackbar(t('argus.alerts.testFailed'), { variant: 'error' });
    }
  };

  /* ═══ RENDER ═══ */
  return (
    <Box>
      {/* Header */}
      <PageHeader
        icon={<AlertIcon />}
        title={
          <ArgusBreadcrumbs
            size="title"
            paths={[{ label: t('argus.alerts.title', 'Alerts') }]}
          />
        }
        subtitle={
          rules.length > 0
            ? t('argus.alerts.activeCount', {
                active: rules.filter((r) => r.enabled).length,
                total: rules.length,
              })
            : undefined
        }
        actions={
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<HistoryIcon sx={{ fontSize: 16 }} />}
              onClick={() => {
                setShowHistory(!showHistory);
                if (!showHistory) fetchHistory();
              }}
              sx={{
                textTransform: 'none',
                fontSize: '0.78rem',
                borderRadius: 1.5,
              }}
            >
              {t('argus.alerts.history')}
            </Button>
            {rules.length > 0 && (
              <Button
                variant="contained"
                size="small"
                startIcon={<AddIcon />}
                onClick={openCreate}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  borderRadius: 1.5,
                }}
              >
                {t('argus.alerts.createRule')}
              </Button>
            )}
          </Box>
        }
      />

      <PageContentLoader loading={loading} skeleton={<ListSkeleton rows={5} />}>
        {/* Rules List */}
        {rules.length === 0 ? (
          <EmptyPlaceholder
            message={t('argus.alerts.noRules')}
            description={t('argus.alerts.noRulesDesc')}
            onAddClick={openCreate}
            addButtonLabel={t('argus.alerts.createFirstRule')}
          />
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {/* Search Bar */}
            {rules.length > 3 && (
              <TextField
                size="small"
                fullWidth
                placeholder={t('argus.alerts.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon
                        sx={{ fontSize: 18, color: 'text.disabled' }}
                      />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  mb: 0.5,
                  '& .MuiOutlinedInput-root': {
                    fontSize: '0.82rem',
                    borderRadius: 1.5,
                  },
                }}
              />
            )}

            {/* Bulk Actions Bar */}
            {selectedRules.size > 0 && (
              <Paper
                elevation={0}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 2,
                  py: 0.8,
                  borderRadius: 1.5,
                  backgroundColor: alpha('#ff9800', 0.06),
                  border: `1px solid ${alpha('#ff9800', 0.15)}`,
                }}
              >
                <Checkbox
                  size="small"
                  checked={selectedRules.size === filteredRules.length}
                  indeterminate={
                    selectedRules.size > 0 &&
                    selectedRules.size < filteredRules.length
                  }
                  onChange={toggleSelectAll}
                  color="warning"
                />
                <Typography
                  sx={{ fontSize: '0.78rem', fontWeight: 600, flex: 1 }}
                >
                  {t('argus.alerts.selectedCount', {
                    count: selectedRules.size,
                  })}
                </Typography>
                <Button
                  size="small"
                  onClick={() => handleBulkToggle(true)}
                  sx={{ textTransform: 'none', fontSize: '0.72rem' }}
                >
                  {t('argus.alerts.enableAll')}
                </Button>
                <Button
                  size="small"
                  onClick={() => handleBulkToggle(false)}
                  sx={{ textTransform: 'none', fontSize: '0.72rem' }}
                >
                  {t('argus.alerts.disableAll')}
                </Button>
                <Button
                  size="small"
                  color="error"
                  onClick={handleBulkDelete}
                  sx={{ textTransform: 'none', fontSize: '0.72rem' }}
                >
                  {t('common.delete')}
                </Button>
              </Paper>
            )}

            {filteredRules.map((rule) => {
              const conditions =
                typeof rule.conditions === 'string'
                  ? JSON.parse(rule.conditions)
                  : rule.conditions || [];
              const actions =
                typeof rule.actions === 'string'
                  ? JSON.parse(rule.actions)
                  : rule.actions || [];
              const isMuted =
                !!(rule as any).muted_until &&
                new Date((rule as any).muted_until) > new Date();

              return (
                <Paper
                  key={rule.id}
                  elevation={0}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    px: 2,
                    py: 1.5,
                    borderRadius: 2,
                    transition: 'all 0.15s',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                    borderLeft: `3px solid ${isMuted ? '#9e9e9e' : rule.enabled ? '#ff9800' : 'transparent'}`,
                    opacity: isMuted ? 0.45 : rule.enabled ? 1 : 0.55,
                    '&:hover': { borderColor: alpha('#ff9800', 0.3) },
                  }}
                >
                  {/* Bulk Checkbox */}
                  <Checkbox
                    size="small"
                    checked={selectedRules.has(rule.id)}
                    onChange={() => toggleSelectRule(rule.id)}
                    color="warning"
                    sx={{ p: 0.3 }}
                  />

                  {/* Toggle */}
                  <Tooltip
                    title={
                      rule.enabled
                        ? t('argus.alerts.disable')
                        : t('argus.alerts.enable')
                    }
                  >
                    <Switch
                      size="small"
                      checked={!!rule.enabled}
                      onChange={() => handleToggle(rule)}
                      color="warning"
                    />
                  </Tooltip>

                  {/* Muted badge */}
                  {isMuted && (
                    <Chip
                      icon={<MuteIcon sx={{ fontSize: '12px !important' }} />}
                      label={t('argus.alerts.mutedLabel')}
                      size="small"
                      sx={{
                        height: 18,
                        fontSize: '0.58rem',
                        backgroundColor: alpha('#9e9e9e', 0.1),
                        color: '#9e9e9e',
                        border: 'none',
                      }}
                    />
                  )}

                  {/* Info */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography fontWeight={700} sx={{ fontSize: '0.88rem' }}>
                      {rule.name}
                    </Typography>
                    {rule.description && (
                      <Typography
                        sx={{
                          fontSize: '0.72rem',
                          color: 'text.secondary',
                          mt: 0.2,
                          mb: 0.3,
                        }}
                      >
                        {rule.description}
                      </Typography>
                    )}
                    <Box
                      sx={{
                        display: 'flex',
                        gap: 0.5,
                        mt: 0.5,
                        flexWrap: 'wrap',
                        alignItems: 'center',
                      }}
                    >
                      {/* IF conditions */}
                      <Chip
                        label={t('argus.alerts.stepIf')}
                        size="small"
                        sx={{
                          height: 18,
                          fontSize: '0.58rem',
                          fontWeight: 800,
                          backgroundColor: alpha('#f44336', 0.08),
                          color: '#f44336',
                          border: 'none',
                        }}
                      />
                      {conditions.map((c: ArgusAlertCondition, i: number) => {
                        const cfg = getConditionTypes(t).find(
                          (ct) => ct.value === c.type
                        );
                        return (
                          <React.Fragment key={i}>
                            <Chip
                              icon={cfg?.icon}
                              label={cfg?.label || c.type}
                              size="small"
                              sx={{
                                height: 22,
                                fontSize: '0.68rem',
                                backgroundColor: alpha(
                                  cfg?.color || '#9e9e9e',
                                  0.08
                                ),
                                color: cfg?.color,
                                border: 'none',
                              }}
                            />
                            {c.value && (
                              <Chip
                                label={`≥ ${c.value}`}
                                size="small"
                                sx={{ height: 18, fontSize: '0.62rem' }}
                              />
                            )}
                          </React.Fragment>
                        );
                      })}

                      <ArrowIcon
                        sx={{ fontSize: 14, color: 'text.disabled', mx: 0.3 }}
                      />

                      {/* THEN actions */}
                      <Chip
                        label={t('argus.alerts.stepThen')}
                        size="small"
                        sx={{
                          height: 18,
                          fontSize: '0.58rem',
                          fontWeight: 800,
                          backgroundColor: alpha('#4caf50', 0.08),
                          color: '#4caf50',
                          border: 'none',
                        }}
                      />
                      {actions.map((a: ArgusAlertAction, i: number) => {
                        const cfg = getActionTypes(t).find(
                          (at) => at.value === a.type
                        );
                        return (
                          <Chip
                            key={i}
                            icon={cfg?.icon}
                            label={cfg?.label || a.type}
                            size="small"
                            sx={{
                              height: 22,
                              fontSize: '0.68rem',
                              backgroundColor: alpha(
                                cfg?.color || '#9e9e9e',
                                0.08
                              ),
                              color: cfg?.color,
                              border: 'none',
                            }}
                          />
                        );
                      })}

                      {/* Filters */}
                      {rule.environment && (
                        <Chip
                          label={`env:${rule.environment}`}
                          size="small"
                          variant="outlined"
                          sx={{ height: 18, fontSize: '0.6rem' }}
                        />
                      )}
                      {rule.level && (
                        <Chip
                          label={`level:${rule.level}`}
                          size="small"
                          variant="outlined"
                          sx={{ height: 18, fontSize: '0.6rem' }}
                        />
                      )}
                      {(() => {
                        const tags =
                          typeof rule.tags === 'string'
                            ? JSON.parse(rule.tags || '{}')
                            : rule.tags || {};
                        return Object.entries(tags).map(([k, v]) => (
                          <Chip
                            key={k}
                            icon={
                              <TagIcon sx={{ fontSize: '10px !important' }} />
                            }
                            label={`${k}:${v}`}
                            size="small"
                            sx={{
                              height: 18,
                              fontSize: '0.58rem',
                              backgroundColor: alpha('#00bcd4', 0.08),
                              color: '#00bcd4',
                              border: 'none',
                              '& .MuiChip-icon': { color: '#00bcd4' },
                            }}
                          />
                        ));
                      })()}
                    </Box>
                  </Box>

                  {/* Mini Chart (Trigger Frequency) */}
                  <Box sx={{ width: 100, height: 36, mx: 1 }}>
                    {(() => {
                      const ruleStats = stats.filter(
                        (s) => s.rule_id === rule.id
                      );
                      if (ruleStats.length === 0) return null;

                      // Sort and map buckets
                      const sortedStats = [...ruleStats].sort((a, b) =>
                        a.bucket.localeCompare(b.bucket)
                      );
                      const data = {
                        labels: sortedStats.map((s) => {
                          const d = new Date(
                            s.bucket +
                              (s.bucket.length === 10 ? 'T00:00:00Z' : 'Z')
                          );
                          return d.toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: s.bucket.length > 10 ? '2-digit' : undefined,
                            hour12: false,
                          });
                        }),
                        datasets: [
                          {
                            data: sortedStats.map((s) => s.count),
                            borderColor: isDark
                              ? alpha('#ff9800', 0.8)
                              : alpha('#f57c00', 0.8),
                            backgroundColor: isDark
                              ? alpha('#ff9800', 0.1)
                              : alpha('#f57c00', 0.1),
                            borderWidth: 1.5,
                            pointRadius: 0,
                            fill: true,
                            tension: 0.4,
                          },
                        ],
                      };
                      const options = {
                        plugins: {
                          legend: { display: false },
                          tooltip: { enabled: false },
                        },
                        scales: {
                          x: { display: false },
                          y: { display: false },
                        },
                        maintainAspectRatio: false,
                        animation: { duration: 0 } as const,
                      };
                      return <Line data={data} options={options} />;
                    })()}
                  </Box>

                  {/* Last triggered */}
                  {rule.last_triggered_at && (
                    <Tooltip title={t('argus.alerts.lastTriggered')}>
                      <Typography
                        sx={{
                          fontSize: '0.68rem',
                          color: 'text.disabled',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {new Date(rule.last_triggered_at).toLocaleString()}
                      </Typography>
                    </Tooltip>
                  )}

                  {/* Actions */}
                  <Box sx={{ display: 'flex', gap: 0.3 }}>
                    <Tooltip title={t('argus.alerts.test')}>
                      <IconButton
                        size="small"
                        onClick={() => handleTest(rule.id)}
                      >
                        <TestIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t('common.edit')}>
                      <IconButton size="small" onClick={() => openEdit(rule)}>
                        <EditIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t('common.delete')}>
                      <IconButton
                        size="small"
                        sx={{
                          color: 'text.disabled',
                          '&:hover': { color: '#f44336' },
                        }}
                        onClick={() => setDeleteConfirm(rule.id)}
                      >
                        <DeleteIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t('argus.alerts.mute')}>
                      <IconButton
                        size="small"
                        sx={{ color: 'text.disabled' }}
                        onClick={() => setMuteDialogRule(rule)}
                      >
                        <MuteIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t('argus.alerts.duplicate')}>
                      <IconButton
                        size="small"
                        sx={{ color: 'text.disabled' }}
                        onClick={() => openDuplicate(rule)}
                      >
                        <DuplicateIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Paper>
              );
            })}
          </Box>
        )}

        {/* History */}
        <Collapse in={showHistory}>
          {history.length === 0 ? (
            <Box sx={{ mt: 3 }}>
              <EmptyPlaceholder
                icon={<HistoryIcon sx={{ fontSize: 48 }} />}
                message={t('argus.alerts.noHistory')}
                minHeight={250}
              />
            </Box>
          ) : (
            <Paper
              elevation={0}
              sx={{
                mt: 3,
                p: 2,
                borderRadius: 2,
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  mb: 1.5,
                }}
              >
                <Typography
                  variant="subtitle2"
                  fontWeight={700}
                  sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                >
                  <HistoryIcon sx={{ fontSize: 18, color: '#2196f3' }} />
                  {t('argus.alerts.recentHistory')}
                </Typography>
                {rules.length > 0 && (
                  <FormControl size="small" sx={{ minWidth: 150 }}>
                    <Select
                      value={historyFilterRule}
                      onChange={(e) =>
                        setHistoryFilterRule(e.target.value as number | '')
                      }
                      displayEmpty
                      sx={{ fontSize: '0.72rem', height: 28 }}
                    >
                      <MenuItem value="" sx={{ fontSize: '0.72rem' }}>
                        <em>{t('argus.alerts.allRules')}</em>
                      </MenuItem>
                      {rules.map((r) => (
                        <MenuItem
                          key={r.id}
                          value={r.id}
                          sx={{ fontSize: '0.72rem' }}
                        >
                          {r.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              </Box>

              {/* Timeline Chart */}
              {stats.length > 0 && (
                <Box sx={{ height: 120, mb: 3 }}>
                  {(() => {
                    const filteredStats =
                      historyFilterRule === ''
                        ? stats
                        : stats.filter((s) => s.rule_id === historyFilterRule);
                    const dateMap = new Map<string, number>();
                    filteredStats.forEach((s) =>
                      dateMap.set(
                        s.bucket,
                        (dateMap.get(s.bucket) || 0) + s.count
                      )
                    );
                    const dates = Array.from(dateMap.keys()).sort();
                    const chartData = dates.map((d) => {
                      const dt = new Date(
                        d + (d.length === 10 ? 'T00:00:00Z' : 'Z')
                      );
                      const label = dt.toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: d.length > 10 ? '2-digit' : undefined,
                        hour12: false,
                      });
                      return { label, count: dateMap.get(d) || 0 };
                    });

                    return (
                      <InteractiveTimeSeriesChart
                        data={chartData}
                        type="bar"
                        height={120}
                      />
                    );
                  })()}
                </Box>
              )}

              <Box>
                {history
                  .filter(
                    (h) =>
                      historyFilterRule === '' ||
                      h.rule_id === historyFilterRule
                  )
                  .map((h) => (
                    <Box
                      key={h.id}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        py: 0.8,
                        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
                      }}
                    >
                      <WarningIcon sx={{ fontSize: 14, color: '#ff9800' }} />
                      <Box sx={{ flex: 1 }}>
                        <Typography
                          sx={{ fontSize: '0.78rem', fontWeight: 500 }}
                        >
                          {h.rule_name ||
                            t('argus.alerts.ruleNumber', { id: h.rule_id })}
                        </Typography>
                        {h.message && (
                          <Typography
                            sx={{
                              fontSize: '0.72rem',
                              color: 'text.secondary',
                            }}
                          >
                            {h.message}
                          </Typography>
                        )}
                      </Box>
                      {h.status && (
                        <Tooltip title={h.response_body || 'No details'}>
                          <Chip
                            size="small"
                            label={h.status.toUpperCase()}
                            sx={{
                              height: 18,
                              fontSize: '0.58rem',
                              fontWeight: 700,
                              border: 'none',
                              backgroundColor:
                                h.status === 'success'
                                  ? alpha('#4caf50', 0.1)
                                  : alpha('#f44336', 0.1),
                              color:
                                h.status === 'success' ? '#4caf50' : '#f44336',
                            }}
                          />
                        </Tooltip>
                      )}
                      <Typography
                        sx={{ fontSize: '0.68rem', color: 'text.disabled' }}
                      >
                        {new Date(h.triggered_at).toLocaleString()}
                      </Typography>
                    </Box>
                  ))}
              </Box>
            </Paper>
          )}
        </Collapse>
      </PageContentLoader>

      {/* ═══ Visual Builder Dialog ═══ */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3, maxHeight: '85vh' } }}
      >
        <DialogTitle
          sx={{
            fontWeight: 700,
            fontSize: '1rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            pb: 1.5,
            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          }}
        >
          <Box>
            {editingRule
              ? t('argus.alerts.editRule')
              : t('argus.alerts.createRule')}
            <Typography
              variant="body2"
              sx={{
                fontSize: '0.75rem',
                color: 'text.secondary',
                fontWeight: 400,
                mt: 1,
              }}
            >
              {t('argus.alerts.createRuleSubtitle')}
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setDialogOpen(false)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pt: '24px !important', overflow: 'auto' }}>
          {/* Rule Name */}
          <TextField
            fullWidth
            size="small"
            label={t('argus.alerts.ruleName')}
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder={t('argus.alerts.ruleNamePlaceholder')}
            sx={{
              mb: 1.5,
              '& .MuiOutlinedInput-root': {
                fontSize: '0.88rem',
                fontWeight: 600,
              },
            }}
          />

          {/* Description (optional) */}
          <TextField
            fullWidth
            size="small"
            label={t('argus.alerts.ruleDescription')}
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
            placeholder={t('argus.alerts.ruleDescriptionPlaceholder')}
            multiline
            minRows={2}
            maxRows={4}
            sx={{ mb: 3, '& .MuiOutlinedInput-root': { fontSize: '0.82rem' } }}
          />

          {/* IF Step */}
          <StepCard
            step={t('argus.alerts.stepIf')}
            label={t('argus.alerts.conditionsDesc')}
            color="#f44336"
            isDark={isDark}
          >
            {/* ANY/ALL Toggle */}
            {formConditions.length > 1 && (
              <Box
                sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}
              >
                <Typography
                  sx={{ fontSize: '0.72rem', color: 'text.secondary' }}
                >
                  {t('argus.alerts.conditionMatchLabel')}
                </Typography>
                <Box
                  sx={{
                    display: 'flex',
                    borderRadius: 1,
                    overflow: 'hidden',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
                  }}
                >
                  {(['any', 'all'] as const).map((logic) => (
                    <Button
                      key={logic}
                      size="small"
                      variant={
                        formConditionLogic === logic ? 'contained' : 'text'
                      }
                      onClick={() => setFormConditionLogic(logic)}
                      sx={{
                        textTransform: 'none',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        px: 1.5,
                        py: 0.2,
                        minWidth: 0,
                        borderRadius: 0,
                        ...(formConditionLogic === logic
                          ? {
                              backgroundColor: alpha('#f44336', 0.9),
                              color: '#fff',
                            }
                          : {}),
                      }}
                    >
                      {t(
                        `argus.alerts.conditionLogic${logic === 'any' ? 'Any' : 'All'}`
                      )}
                    </Button>
                  ))}
                </Box>
              </Box>
            )}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleConditionDragEnd}
              >
                <SortableContext
                  items={formConditions.map((_, i) => `cond-${i}`)}
                  strategy={verticalListSortingStrategy}
                >
                  {formConditions.map((cond, i) => (
                    <ConditionCard
                      key={`cond-${i}`}
                      id={`cond-${i}`}
                      cond={cond}
                      isDark={isDark}
                      onChange={(c) => {
                        const next = [...formConditions];
                        next[i] = c;
                        setFormConditions(next);
                      }}
                      onRemove={() =>
                        setFormConditions(
                          formConditions.filter((_, j) => j !== i)
                        )
                      }
                    />
                  ))}
                </SortableContext>
              </DndContext>
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={() =>
                  setFormConditions([...formConditions, { type: 'new_issue' }])
                }
                sx={{
                  textTransform: 'none',
                  fontSize: '0.75rem',
                  alignSelf: 'flex-start',
                  mt: 0.5,
                }}
              >
                {t('argus.alerts.addCondition')}
              </Button>
            </Box>
          </StepCard>

          <StepConnector />

          {/* THEN Step */}
          <StepCard
            step={t('argus.alerts.stepThen')}
            label={t('argus.alerts.actionsDesc')}
            color="#4caf50"
            isDark={isDark}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleActionDragEnd}
              >
                <SortableContext
                  items={formActions.map((_, i) => `act-${i}`)}
                  strategy={verticalListSortingStrategy}
                >
                  {formActions.map((action, i) => (
                    <ActionCard
                      key={`act-${i}`}
                      id={`act-${i}`}
                      action={action}
                      isDark={isDark}
                      onChange={(a) => {
                        const next = [...formActions];
                        next[i] = a;
                        setFormActions(next);
                      }}
                      onRemove={() =>
                        setFormActions(formActions.filter((_, j) => j !== i))
                      }
                    />
                  ))}
                </SortableContext>
              </DndContext>
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={() =>
                  setFormActions([
                    ...formActions,
                    { type: 'webhook', target_url: '' },
                  ])
                }
                sx={{
                  textTransform: 'none',
                  fontSize: '0.75rem',
                  alignSelf: 'flex-start',
                  mt: 0.5,
                }}
              >
                {t('argus.alerts.addAction')}
              </Button>
            </Box>
          </StepCard>

          <StepConnector />

          {/* FILTERS Step */}
          <StepCard
            step={t('argus.alerts.stepFilters')}
            label={t('argus.alerts.filtersDesc')}
            color="#7c4dff"
            isDark={isDark}
          >
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel sx={{ fontSize: '0.75rem' }}>
                  {t('argus.alerts.alertFreq')}
                </InputLabel>
                <Select
                  value={formFrequency}
                  onChange={(e) => setFormFrequency(Number(e.target.value))}
                  label={t('argus.alerts.alertFreq')}
                  sx={{ fontSize: '0.82rem' }}
                >
                  {getFrequencies(t).map((f) => (
                    <MenuItem
                      key={f.value}
                      value={f.value}
                      sx={{ fontSize: '0.82rem' }}
                    >
                      {f.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Autocomplete
                size="small"
                freeSolo
                options={availableEnvironments}
                value={formEnvironment || null}
                onChange={(_, v) =>
                  setFormEnvironment(typeof v === 'string' ? v : v || '')
                }
                onInputChange={(_, v) => setFormEnvironment(v)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={t('argus.alerts.environment')}
                    placeholder={t('argus.alerts.environmentPlaceholder')}
                    sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.82rem' } }}
                  />
                )}
                sx={{ minWidth: 160 }}
              />
              <FormControl size="small" sx={{ minWidth: 100 }}>
                <InputLabel sx={{ fontSize: '0.75rem' }}>
                  {t('argus.alerts.level')}
                </InputLabel>
                <Select
                  value={formLevel}
                  onChange={(e) => setFormLevel(e.target.value)}
                  label={t('argus.alerts.level')}
                  sx={{ fontSize: '0.82rem' }}
                >
                  <MenuItem value="" sx={{ fontSize: '0.82rem' }}>
                    <em>{t('argus.alerts.allLevels')}</em>
                  </MenuItem>
                  <MenuItem value="fatal" sx={{ fontSize: '0.82rem' }}>
                    {t('argus.common.fatal')}
                  </MenuItem>
                  <MenuItem value="error" sx={{ fontSize: '0.82rem' }}>
                    {t('argus.common.error')}
                  </MenuItem>
                  <MenuItem value="warning" sx={{ fontSize: '0.82rem' }}>
                    {t('argus.common.warning')}
                  </MenuItem>
                </Select>
              </FormControl>
            </Box>

            {/* Tag Filters */}
            <Box sx={{ mt: 2 }}>
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                  fontSize: '0.72rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  mb: 1,
                }}
              >
                <TagIcon sx={{ fontSize: 14 }} /> {t('argus.alerts.tagFilters')}
              </Typography>
              {Object.keys(formTags).length > 0 && (
                <Box
                  sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1 }}
                >
                  {Object.entries(formTags).map(([k, v]) => (
                    <Chip
                      key={k}
                      label={`${k}: ${v}`}
                      size="small"
                      onDelete={() => {
                        const next = { ...formTags };
                        delete next[k];
                        setFormTags(next);
                      }}
                      sx={{
                        height: 22,
                        fontSize: '0.68rem',
                        backgroundColor: alpha('#00bcd4', 0.08),
                        color: '#00bcd4',
                        border: 'none',
                        '& .MuiChip-deleteIcon': {
                          fontSize: 14,
                          color: alpha('#00bcd4', 0.5),
                          '&:hover': { color: '#00bcd4' },
                        },
                      }}
                    />
                  ))}
                </Box>
              )}
              <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                <TextField
                  size="small"
                  placeholder={t('argus.alerts.tagKey')}
                  value={newTagKey}
                  onChange={(e) => setNewTagKey(e.target.value)}
                  sx={{
                    width: 100,
                    '& .MuiOutlinedInput-root': { fontSize: '0.78rem' },
                  }}
                />
                <Typography
                  sx={{ color: 'text.disabled', fontSize: '0.78rem' }}
                >
                  :
                </Typography>
                <TextField
                  size="small"
                  placeholder={t('argus.alerts.tagValue')}
                  value={newTagValue}
                  onChange={(e) => setNewTagValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (
                      e.key === 'Enter' &&
                      newTagKey.trim() &&
                      newTagValue.trim()
                    ) {
                      setFormTags({
                        ...formTags,
                        [newTagKey.trim()]: newTagValue.trim(),
                      });
                      setNewTagKey('');
                      setNewTagValue('');
                    }
                  }}
                  sx={{
                    width: 120,
                    '& .MuiOutlinedInput-root': { fontSize: '0.78rem' },
                  }}
                />
                <Button
                  size="small"
                  disabled={!newTagKey.trim() || !newTagValue.trim()}
                  onClick={() => {
                    setFormTags({
                      ...formTags,
                      [newTagKey.trim()]: newTagValue.trim(),
                    });
                    setNewTagKey('');
                    setNewTagValue('');
                  }}
                  sx={{
                    textTransform: 'none',
                    fontSize: '0.72rem',
                    minWidth: 'auto',
                  }}
                >
                  +
                </Button>
              </Box>
            </Box>
          </StepCard>
        </DialogContent>

        <DialogActions
          sx={{
            px: 3,
            pb: 2,
            pt: 1,
            borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          }}
        >
          <Button
            onClick={() => setDialogOpen(false)}
            sx={{ textTransform: 'none' }}
          >
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={
              !formName ||
              formConditions.length === 0 ||
              formActions.length === 0
            }
            sx={{
              textTransform: 'none',
              fontWeight: 700,
            }}
          >
            {editingRule ? t('common.save') : t('argus.alerts.create')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog
        open={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        maxWidth="xs"
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
          {t('argus.alerts.confirmDelete')}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {t('argus.alerts.confirmDeleteDesc')}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setDeleteConfirm(null)}
            sx={{ textTransform: 'none' }}
          >
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
            sx={{ textTransform: 'none' }}
          >
            {t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Mute Dialog */}
      <Dialog
        open={muteDialogRule !== null}
        onClose={() => setMuteDialogRule(null)}
        maxWidth="xs"
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle
          sx={{
            fontWeight: 700,
            fontSize: '0.95rem',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <MuteIcon sx={{ fontSize: 20 }} />
          {t('argus.alerts.muteTitle')}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('argus.alerts.muteDesc', { name: muteDialogRule?.name })}
          </Typography>
          <FormControl fullWidth size="small">
            <InputLabel sx={{ fontSize: '0.78rem' }}>
              {t('argus.alerts.muteDuration')}
            </InputLabel>
            <Select
              value={muteDuration}
              onChange={(e) => setMuteDuration(Number(e.target.value))}
              label={t('argus.alerts.muteDuration')}
              sx={{ fontSize: '0.82rem' }}
            >
              <MenuItem value={1800} sx={{ fontSize: '0.82rem' }}>
                {t('argus.alerts.30min')}
              </MenuItem>
              <MenuItem value={3600} sx={{ fontSize: '0.82rem' }}>
                {t('argus.alerts.1hour')}
              </MenuItem>
              <MenuItem value={14400} sx={{ fontSize: '0.82rem' }}>
                {t('argus.alerts.4hours')}
              </MenuItem>
              <MenuItem value={86400} sx={{ fontSize: '0.82rem' }}>
                {t('argus.alerts.1day')}
              </MenuItem>
              <MenuItem value={604800} sx={{ fontSize: '0.82rem' }}>
                {t('argus.alerts.1week')}
              </MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setMuteDialogRule(null)}
            sx={{ textTransform: 'none' }}
          >
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            onClick={handleMute}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            {t('argus.alerts.muteConfirm')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ArgusAlertRulesPage;
