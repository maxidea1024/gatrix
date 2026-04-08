/**
 * Feature Flag Detail Page - Unleash Style Layout
 *
 * Layout:
 * - Left sidebar: Flag details (type, created, tags, etc.)
 * - Right main area: Environment cards (expandable with strategies)
 *
 * Tabs: Overview, Metrics, Settings, Event Log
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useOrgProject } from '../../contexts/OrgProjectContext';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Stack,
  Paper,
  Chip,
  IconButton,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Menu,
  ListItemIcon,
  Tooltip,
  Tabs,
  Tab,
  Alert,
  List,
  ListItem,
  ListItemText,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  CircularProgress,
  FormControlLabel,
  Checkbox,
  Slider,
  Autocomplete,
  Switch,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Collapse,
  Link as MuiLink,
  ListSubheader,
  useTheme,
  alpha,
} from '@mui/material';
// @ts-ignore - Grid from MUI
const Grid = ({ children, ...props }: any) => <Box {...props}>{children}</Box>;
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Delete as DeleteIcon,
  Archive as ArchiveIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
  ContentCopy as CopyIcon,
  ExpandMore as ExpandMoreIcon,
  Edit as EditIcon,
  DragIndicator as DragIcon,
  ArrowUpward as ArrowUpIcon,
  ArrowDownward as ArrowDownIcon,
  Tune as TuneIcon,
  Timeline as TimelineIcon,
  Settings as SettingsIcon,
  History as HistoryIcon,
  MoreVert as MoreIcon,
  HelpOutline as HelpOutlineIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
  KeyboardArrowUp as KeyboardArrowUpIcon,
  Link as LinkIcon,
  RocketLaunch as ReleaseIcon,
  Science as ExperimentIcon,
  Build as OperationalIcon,
  Security as PermissionIcon,
  PowerOff as KillSwitchIcon,
  ReportProblem as StaleIcon,
  Block as BlockIcon,
  Flag as FlagIcon,
  SportsEsports as JoystickIcon,
  Close as CloseIcon,
  LibraryAdd as TemplateIcon,
  Shield as ShieldIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import FieldTypeIcon from '../../components/common/FieldTypeIcon';
import { useAuth } from '../../contexts/AuthContext';
import { P } from '@/types/permissions';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { parseApiErrorMessage } from '../../utils/errorUtils';
import api from '../../services/api';
import ConfirmDeleteDialog from '../../components/common/ConfirmDeleteDialog';
import ConstraintEditor, {
  Constraint,
  ContextField,
} from '../../components/features/ConstraintEditor';
import {
  ConstraintList,
  ConstraintDisplay,
  ConstraintValue,
} from '../../components/features/ConstraintDisplay';
import {
  formatDateTimeDetailed,
  formatRelativeTime,
} from '../../utils/dateFormat';
import { copyToClipboardWithNotification } from '../../utils/clipboard';
import ResizableDrawer from '../../components/common/ResizableDrawer';
import { tagService, Tag } from '../../services/tagService';
import { getContrastColor } from '../../utils/colorUtils';
import TagSelector from '../../components/common/TagSelector';
import TagChips from '../../components/common/TagChips';
import JsonEditor from '../../components/common/JsonEditor';
import ValueEditorField from '../../components/common/ValueEditorField';
import BooleanSwitch from '../../components/common/BooleanSwitch';
import EmptyPagePlaceholder from '../../components/common/EmptyPagePlaceholder';
import EmptyPlaceholder from '../../components/common/EmptyPlaceholder';
import {
  environmentService,
  Environment,
} from '../../services/environmentService';
import { useEnvironment } from '../../contexts/EnvironmentContext';
import FeatureSwitch from '../../components/common/FeatureSwitch';
import FeatureFlagMetrics from '../../components/features/FeatureFlagMetrics';
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
import EnvironmentVariantsEditor, {
  Variant as EditorVariant,
} from '../../components/features/EnvironmentVariantsEditor';
import FeatureFlagAuditLogs from '../../components/features/FeatureFlagAuditLogs';
import ReleaseFlowTab from '../../components/features/ReleaseFlowTab';
import StrategyCardReadonly from '../../components/features/StrategyCardReadonly';
import StrategyEditDrawer, {
  Strategy,
  Variant,
  STRATEGY_TYPES,
} from '../../components/features/StrategyEditDrawer';
import { useReleaseFlowPlansByFlag } from '../../hooks/useReleaseFlows';
import FeatureFlagCodeReferences from '../../components/features/FeatureFlagCodeReferences';
import PlaygroundDialog from '../../components/features/PlaygroundDialog';
import ValidationRulesEditor from '../../components/features/ValidationRulesEditor';
import featureFlagService, {
  ValidationRules,
} from '../../services/featureFlagService';
import { getFlagTypeIcon } from '../../utils/flagTypeIcons';
import PageContentLoader from '../../components/common/PageContentLoader';

import changeRequestService from '../../services/changeRequestService';

// Strategy context menu component for edit/delete actions
const StrategyContextMenu: React.FC<{
  onEdit: () => void;
  onDelete: () => void;
}> = ({ onEdit, onDelete }) => {
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  return (
    <>
      <IconButton
        size="small"
        onClick={(e) => {
          e.stopPropagation();
          setAnchorEl(e.currentTarget);
        }}
      >
        <MoreIcon fontSize="small" />
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        onClick={(e) => e.stopPropagation()}
        slotProps={{
          paper: { sx: { minWidth: 140 } },
        }}
      >
        <MenuItem
          onClick={() => {
            setAnchorEl(null);
            onEdit();
          }}
        >
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('common.edit')}</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            setAnchorEl(null);
            onDelete();
          }}
        >
          <ListItemIcon>
            <DeleteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('common.delete')}</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
};

// Deep equality check for draft coalescing
function deepEqualDraft(a: any, b: any): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a == b;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((key) => deepEqualDraft(a[key], b[key]));
}

// Playground panel constants (outside component for stable references)
const PLAYGROUND_VISIBLE_KEY = 'gatrix.embeddedPlaygroundVisible';
const PLAYGROUND_WIDTH_KEY = 'gatrix.playgroundPanelWidth';
const DEFAULT_PLAYGROUND_WIDTH = 300;
const MIN_PLAYGROUND_WIDTH = 300;
const MAX_PLAYGROUND_WIDTH = 700;

/**
 * Custom SVG Icon for Release Flow Active Status - Premium Professional Design
 */
const ReleaseFlowActiveIcon = (props: any) => (
  <Box
    component="svg"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    sx={{ width: '1em', height: '1em', ...props.sx }}
  >
    <path
      d="M2 17L6 13L10 17L15 12L18.5 15.5L22 12"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M22 12L19 12M22 12L22 15"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="2" cy="17" r="1.5" fill="currentColor" />
    <circle cx="10" cy="17" r="1.5" fill="currentColor" />
    <circle cx="15" cy="12" r="1.5" fill="currentColor" />
  </Box>
);

// Strategy, Variant, STRATEGY_TYPES imported from StrategyEditDrawer

interface FeatureFlagEnvironment {
  id: string;
  flagId: string;
  environmentId: string;
  isEnabled: boolean;
  overrideEnabledValue?: boolean;
  overrideDisabledValue?: boolean;
  enabledValue?: any;
  disabledValue?: any;
  lastSeenAt?: string;
}

interface FlagLink {
  url: string;
  title?: string;
}

interface FeatureFlag {
  id: string;
  environmentId: string;
  flagName: string;
  displayName?: string;
  description?: string;
  flagType:
    | 'release'
    | 'experiment'
    | 'operational'
    | 'permission'
    | 'killswitch'
    | 'remoteConfig';
  isEnabled: boolean;
  isArchived: boolean;
  impressionDataEnabled: boolean;
  tags?: string[];
  links?: FlagLink[];
  strategies?: Strategy[];
  variants?: Variant[];
  valueType: 'boolean' | 'string' | 'json' | 'number';
  enabledValue?: any;
  disabledValue?: any;
  validationRules?: ValidationRules;
  environments?: FeatureFlagEnvironment[];
  lastSeenAt?: string;
  archivedAt?: string;
  stale?: boolean;
  useFixedWeightVariants?: boolean;

  createdBy?: number;
  createdByName?: string;
  updatedBy?: number;
  createdAt: string;
  updatedAt?: string;
}

const FLAG_TYPES = [
  {
    value: 'release',
    labelKey: 'featureFlags.types.release',
    descKey: 'featureFlags.flagTypes.release.desc',
  },
  {
    value: 'experiment',
    labelKey: 'featureFlags.types.experiment',
    descKey: 'featureFlags.flagTypes.experiment.desc',
  },
  {
    value: 'operational',
    labelKey: 'featureFlags.types.operational',
    descKey: 'featureFlags.flagTypes.operational.desc',
  },
  {
    value: 'killSwitch',
    labelKey: 'featureFlags.types.killSwitch',
    descKey: 'featureFlags.flagTypes.killSwitch.desc',
  },
  {
    value: 'permission',
    labelKey: 'featureFlags.types.permission',
    descKey: 'featureFlags.flagTypes.permission.desc',
  },
];

// Get icon for flag type
const getTypeIcon = (type: string, size: number = 16) =>
  getFlagTypeIcon(type, size);

// ==================== Components ====================

interface TabPanelProps {
  children?: React.ReactNode;
  value: number;
  index: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <Box role="tabpanel" hidden={value !== index} sx={{ py: 0 }}>
    {value === index && children}
  </Box>
);

// Sortable wrapper component for strategy items
interface SortableStrategyItemProps {
  id: string;
  children: (props: { dragHandleProps: object | null }) => React.ReactNode;
  isDraggable: boolean;
}

const SortableStrategyItem: React.FC<SortableStrategyItemProps> = ({
  id,
  children,
  isDraggable,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1 : 0,
    position: 'relative' as const,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {children({
        dragHandleProps: isDraggable ? { ...attributes, ...listeners } : null,
      })}
    </div>
  );
};

// ==================== Main Page ====================

const FeatureFlagDetailPage: React.FC = () => {
  const { flagName } = useParams<{ flagName: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useTranslation();
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const { hasPermission } = useAuth();
  const { getProjectApiPath } = useOrgProject();
  const projectApiPath = getProjectApiPath();
  const { currentEnvironmentId: selectedEnvironment } = useEnvironment();
  const canManage = hasPermission([P.FEATURES_UPDATE]);

  const isCreating = flagName === 'new';

  const generateDefaultFlagName = () => {
    const timestamp = Date.now().toString(36).slice(-4);
    return `new-feature-${timestamp}`;
  };

  // Get tab from URL query parameter, default to 0 (overview)
  const tabParam = searchParams.get('tab');
  const tabValue =
    tabParam === 'payload'
      ? 1
      : tabParam === 'metrics'
        ? 2
        : tabParam === 'code-references'
          ? 3
          : tabParam === 'history'
            ? 4
            : 0;

  const setTabValue = (newValue: number) => {
    // Reset payload changes when leaving payload tab (tab 1)
    if (tabValue === 1 && newValue !== 1 && originalFlag) {
      setFlag((prev) =>
        prev
          ? {
              ...prev,
              valueType: originalFlag.valueType,
              enabledValue: originalFlag.enabledValue,
              disabledValue: originalFlag.disabledValue,
            }
          : prev
      );
    }
    const newParams = new URLSearchParams(searchParams);
    if (newValue === 1) {
      newParams.set('tab', 'payload');
    } else if (newValue === 2) {
      newParams.set('tab', 'metrics');
    } else if (newValue === 3) {
      newParams.set('tab', 'code-references');
    } else if (newValue === 4) {
      newParams.set('tab', 'history');
    } else {
      newParams.delete('tab');
    }
    setSearchParams(newParams, { replace: true });
  };

  // State
  const [flag, setFlag] = useState<FeatureFlag | null>(
    isCreating
      ? {
          id: '',
          environmentId: '',
          flagName: generateDefaultFlagName(),
          displayName: '',
          description: '',
          flagType: 'release',
          isEnabled: false,
          isArchived: false,
          impressionDataEnabled: false,
          tags: [],
          strategies: [],
          variants: [],
          valueType: 'string',
          enabledValue: '',
          disabledValue: '',
          createdAt: new Date().toISOString(),
        }
      : null
  );
  const [loading, setLoading] = useState(!isCreating);
  const [envLoading, setEnvLoading] = useState(!isCreating);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [saving, setSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const [staleConfirmOpen, setStaleConfirmOpen] = useState(false);
  const [strategyDialogOpen, setStrategyDialogOpen] = useState(false);
  const [strategyDeleteConfirm, setStrategyDeleteConfirm] = useState<{
    open: boolean;
    strategyId?: string;
    index?: number;
    envId?: string;
  }>({ open: false });
  const [strategyTabValue, setStrategyTabValue] = useState(0);
  const [editingStrategy, setEditingStrategy] = useState<Strategy | null>(null);
  const [originalEditingStrategy, setOriginalEditingStrategy] =
    useState<Strategy | null>(null);
  const [strategyJsonErrors, setStrategyJsonErrors] = useState<
    Record<number, string | null>
  >({});
  const [editingEnv, setEditingEnv] = useState<string | null>(null); // Track which environmentId we're editing strategy for
  const [isAddingStrategy, setIsAddingStrategy] = useState(false); // Explicitly track if we're adding a new strategy
  const [variantDialogOpen, setVariantDialogOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState<Variant | null>(null);
  const [contextFields, setContextFields] = useState<ContextField[]>([]);
  const [segments, setSegments] = useState<any[]>([]);
  const [expandedSegments, setExpandedSegments] = useState<Set<string>>(
    new Set()
  ); // For environmentId cards
  const [expandedSegmentsDialog, setExpandedSegmentsDialog] = useState<
    Set<string>
  >(new Set()); // For strategy editor dialog
  const [expandedConstraints, setExpandedConstraints] = useState<Set<string>>(
    new Set()
  );
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [originalFlag, setOriginalFlag] = useState<FeatureFlag | null>(null);
  const [valueJsonError, setValueJsonError] = useState<string | null>(null);
  // Environment-specific strategies - key is environmentId, value is array of strategies
  const [envStrategies, setEnvStrategies] = useState<
    Record<string, Strategy[]>
  >({});
  // Environment-specific variants - key is environmentId, value is array of variants
  const [envVariants, setEnvVariants] = useState<Record<string, Variant[]>>({});
  const [codeReferenceCount, setCodeReferenceCount] = useState<number | null>(
    null
  );
  // Track environments where the user chose to use Release Flow (but no plan exists yet)
  const [envManualReleaseFlow, setEnvManualReleaseFlow] = useState<Set<string>>(
    new Set()
  );

  // Draft status at flag level - single draft per flag
  const [flagDraftStatus, setFlagDraftStatus] = useState<{
    hasDraft: boolean;
    updatedAt?: string;
    draftEnvIds?: Set<string>;
  }>({ hasDraft: false });

  // Release flow plan summaries - to detect environments managed by release flow
  const { data: releaseFlowPlans, mutate: mutateReleaseFlowPlans } =
    useReleaseFlowPlansByFlag(flag?.id || null);
  const releaseFlowEnvs = new Set(
    (releaseFlowPlans || []).map((p) => p.environmentId)
  );

  const activeMilestoneByEnv = React.useMemo(() => {
    if (!releaseFlowPlans) return {};
    const map: Record<string, string> = {};
    releaseFlowPlans.forEach((plan) => {
      if (plan.activeMilestoneName) {
        map[plan.environmentId] = plan.activeMilestoneName;
      }
    });
    return map;
  }, [releaseFlowPlans]);

  // Fetch code reference count on mount
  useEffect(() => {
    if (flagName) {
      api
        .get(`${projectApiPath}/features/${flagName}/code-references`)
        .then((response) => {
          if (response.success && response.data?.references) {
            setCodeReferenceCount(response.data.references.length);
          }
        })
        // limit fetch frequency or error handling? silent fail is fine for badge
        .catch(() => setCodeReferenceCount(null));
    }
  }, [flagName]);

  // Playground dialog state
  const [playgroundOpen, setPlaygroundOpen] = useState(false);
  const [playgroundInitialEnvironments, setPlaygroundInitialEnvironments] =
    useState<string[]>([]);
  // Embedded playground visibility (for inline testing in overview tab)
  const [embeddedPlaygroundVisible, setEmbeddedPlaygroundVisibleState] =
    useState(() => {
      const saved = localStorage.getItem(PLAYGROUND_VISIBLE_KEY);
      return saved === 'true';
    });
  // Wrapper to update localStorage when visibility changes
  const setEmbeddedPlaygroundVisible = (visible: boolean) => {
    setEmbeddedPlaygroundVisibleState(visible);
    localStorage.setItem(PLAYGROUND_VISIBLE_KEY, visible.toString());
  };
  // Embedded playground panel width with localStorage persistence
  const [playgroundPanelWidth, setPlaygroundPanelWidth] = useState(() => {
    const saved = localStorage.getItem(PLAYGROUND_WIDTH_KEY);
    return saved
      ? Math.min(
          MAX_PLAYGROUND_WIDTH,
          Math.max(MIN_PLAYGROUND_WIDTH, parseInt(saved, 10))
        )
      : DEFAULT_PLAYGROUND_WIDTH;
  });

  // Drag and drop sensors for strategy reordering
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Environment states
  const [environments, setEnvironments] = useState<Environment[]>([]);
  // Auto-expansion is handled by useEffect below
  const [expandedEnvs, setExpandedEnvs] = useState<Set<string>>(new Set());
  const [selectedEnvForEdit, setSelectedEnvForEdit] = useState<string | null>(
    null
  );
  const [envSettingsDrawerOpen, setEnvSettingsDrawerOpen] = useState(false);

  // Edit flag dialog states
  const [editFlagDialogOpen, setEditFlagDialogOpen] = useState(false);
  const [editingFlagData, setEditingFlagData] = useState<{
    displayName: string;
    description: string;
    impressionDataEnabled: boolean;
    tags: string[];
  } | null>(null);
  const [editTagSelection, setEditTagSelection] = useState<Tag[]>([]);

  // Link dialog states
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<FlagLink>({
    url: '',
    title: '',
  });
  const [editingLinkIndex, setEditingLinkIndex] = useState<number | null>(null);

  // Environment metrics for summary display in environment cards
  const [envMetrics, setEnvMetrics] = useState<
    Record<string, { totalYes: number; totalNo: number; total: number }>
  >({});

  // ==================== Data Loading ====================

  const loadFlag = useCallback(
    async (targetFlagName?: string, showLoading = true) => {
      const name = targetFlagName || flagName;
      if (isCreating || !name) return;
      try {
        if (showLoading) setLoading(true);
        const response = await api.get(`${projectApiPath}/features/${name}`);
        // Backend returns { success: true, data: { flag } }
        // api.request() returns response.data, so we get { flag }
        const data = response.data?.flag || response.data;
        // Transform backend strategy format to frontend format
        if (data.strategies) {
          data.strategies = data.strategies.map((s: any) => ({
            ...s,
            name: s.strategyName || s.name, // Backend uses strategyName, frontend uses name
            disabled: s.isEnabled === false,
          }));
        }
        setFlag(data);
        setOriginalFlag(JSON.parse(JSON.stringify(data)));
      } catch (error: any) {
        enqueueSnackbar(
          parseApiErrorMessage(error, 'featureFlags.loadFailed'),
          {
            variant: 'error',
          }
        );
        navigate('/feature-flags');
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [flagName, isCreating, navigate, enqueueSnackbar, projectApiPath]
  );

  const loadContextFields = useCallback(async () => {
    try {
      const response = await api.get(
        `${projectApiPath}/features/context-fields`
      );
      // API returns { success: true, data: { contextFields } }
      const fields =
        response.data?.contextFields ||
        response.data?.data?.contextFields ||
        [];

      setContextFields(
        fields
          .filter((f: any) => f.isEnabled !== false)
          .map((f: any) => {
            let rules = f.validationRules;
            if (typeof rules === 'string' && rules.trim()) {
              try {
                rules = JSON.parse(rules);
              } catch (e) {
                rules = null;
              }
            }

            return {
              fieldName: f.fieldName,
              displayName: f.displayName || f.fieldName,
              description: f.description || '',
              fieldType: f.fieldType || 'string',
              stickiness: f.stickiness === true,
              isDefaultStickinessField: f.isDefaultStickinessField === true,
              validationRules: rules,
            };
          })
      );
    } catch {
      setContextFields([]);
    }
  }, [projectApiPath]);

  const loadSegments = useCallback(async () => {
    try {
      const response = await api.get(`${projectApiPath}/features/segments`);
      // API returns { success: true, data: { segments } }
      const segmentsData =
        response.data?.segments || response.data?.data?.segments || [];
      setSegments(segmentsData);
    } catch {
      setSegments([]);
    }
  }, [projectApiPath]);

  const loadTags = useCallback(async () => {
    try {
      const tags = await tagService.list(projectApiPath);
      setAllTags(tags);
    } catch {
      setAllTags([]);
    }
  }, [projectApiPath]);

  const loadEnvironments = useCallback(async () => {
    try {
      const envs = await environmentService.getEnvironments(projectApiPath);
      setEnvironments(envs);
      // Auto-expand selected environment card immediately after loading
      if (
        selectedEnvironment &&
        envs.some((e) => e.environmentId === selectedEnvironment)
      ) {
        setExpandedEnvs((prev) => {
          const newSet = new Set(prev);
          newSet.add(selectedEnvironment);
          return newSet;
        });
      }
    } catch {
      setEnvironments([]);
    }
  }, [selectedEnvironment, projectApiPath]);

  // Load metrics summary for each environment (24h period for quick summary)
  const loadEnvMetrics = useCallback(
    async (targetFlagName: string, envList: Environment[]) => {
      if (!targetFlagName || envList.length === 0) return;

      const metricsMap: Record<
        string,
        { totalYes: number; totalNo: number; total: number }
      > = {};
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000); // Last 24 hours

      for (const env of envList) {
        try {
          const response = await api.get<{
            metrics: Array<{ yesCount: number; noCount: number }>;
          }>(`${projectApiPath}/features/${targetFlagName}/metrics`, {
            params: {
              startDate: startDate.toISOString(),
              endDate: endDate.toISOString(),
            },
            headers: {
              'x-environment-id': env.environmentId,
            },
          });
          const metrics = response.data?.metrics || [];
          const aggregated = metrics.reduce(
            (acc, m) => ({
              totalYes: acc.totalYes + (m.yesCount || 0),
              totalNo: acc.totalNo + (m.noCount || 0),
              total: acc.total + (m.yesCount || 0) + (m.noCount || 0),
            }),
            { totalYes: 0, totalNo: 0, total: 0 }
          );
          metricsMap[env.environmentId] = aggregated;
        } catch {
          metricsMap[env.environmentId] = { totalYes: 0, totalNo: 0, total: 0 };
        }
      }

      setEnvMetrics(metricsMap);
    },
    [projectApiPath]
  );

  // Load strategies for all environments
  const loadEnvStrategies = useCallback(
    async (envList: Environment[], targetFlagName: string) => {
      if (!targetFlagName || envList.length === 0) return;

      const strategiesMap: Record<string, Strategy[]> = {};
      const variantsMap: Record<string, Variant[]> = {};
      for (const env of envList) {
        try {
          const response = await api.get(
            `${projectApiPath}/features/${targetFlagName}`,
            {
              headers: { 'x-environment-id': env.environmentId },
            }
          );
          const data = response.data?.flag || response.data;

          // Get variants from flag level (they're stored at flag level, not strategy level)
          const flagVariants = (data.variants || []).map((v: any) => ({
            name: v.variantName || v.name,
            weight: v.weight,
            value: v.value,
            valueType: v.valueType || 'string',
            stickiness: v.stickiness || 'default',
          }));

          // Store variants separately for environment-specific management
          variantsMap[env.environmentId] = flagVariants;

          const strategies = (data.strategies || []).map(
            (s: any, index: number) => ({
              ...s,
              name: s.strategyName || s.name,
              disabled: s.isEnabled === false,
              // Attach variants to the first strategy (for UI editing purposes)
              variants: index === 0 ? flagVariants : [],
            })
          );
          strategiesMap[env.environmentId] = strategies;
        } catch {
          strategiesMap[env.environmentId] = [];
          variantsMap[env.environmentId] = [];
        }
      }

      setEnvStrategies(strategiesMap);
      setEnvVariants(variantsMap);
    },
    [projectApiPath]
  );

  useEffect(() => {
    if (!isCreating) {
      loadFlag();
    }
    loadContextFields();
    loadSegments();
    loadTags();
    loadEnvironments();
  }, [
    loadFlag,
    loadContextFields,
    loadSegments,
    loadTags,
    loadEnvironments,
    isCreating,
  ]);

  // Check draft status and apply draft data to UI
  const loadFlagDraftStatus = useCallback(
    async (_flagId: string) => {
      if (!flag?.flagName || !projectApiPath) return;
      try {
        const result = await changeRequestService.getPendingFlagDraft(
          flag.flagName,
          projectApiPath
        );
        const hasDraft = !!result;
        const draftData = result?.draftData;
        const draftEnvIds = new Set<string>();
        if (hasDraft && draftData) {
          for (const envId of Object.keys(draftData)) {
            if (!envId.startsWith('_')) draftEnvIds.add(envId);
          }
        }
        setFlagDraftStatus({
          hasDraft,
          updatedAt: undefined,
          draftEnvIds,
        });

        // If draft exists, overlay draft data onto the UI
        if (hasDraft && draftData) {
          for (const [envId, envData] of Object.entries(draftData) as [
            string,
            any,
          ][]) {
            // Handle global key (flag-level settings like impressionDataEnabled)
            if (envId === '_global') {
              if (envData.impressionDataEnabled !== undefined) {
                setFlag((prev) => {
                  if (!prev) return prev;
                  return {
                    ...prev,
                    impressionDataEnabled: envData.impressionDataEnabled,
                  };
                });
              }
              continue;
            }

            // Apply isEnabled and value overrides to flag.environments
            if (
              envData.isEnabled !== undefined ||
              envData.overrideEnabledValue !== undefined ||
              envData.overrideDisabledValue !== undefined ||
              envData.enabledValue !== undefined ||
              envData.disabledValue !== undefined
            ) {
              setFlag((prev) => {
                if (!prev) return prev;
                const updatedEnvs = (prev.environments || []).map((e) =>
                  e.environmentId === envId
                    ? {
                        ...e,
                        ...(envData.isEnabled !== undefined
                          ? { isEnabled: envData.isEnabled }
                          : {}),
                        ...(envData.overrideEnabledValue !== undefined
                          ? {
                              overrideEnabledValue:
                                envData.overrideEnabledValue,
                            }
                          : {}),
                        ...(envData.overrideDisabledValue !== undefined
                          ? {
                              overrideDisabledValue:
                                envData.overrideDisabledValue,
                            }
                          : {}),
                        ...(envData.enabledValue !== undefined
                          ? { enabledValue: envData.enabledValue }
                          : {}),
                        ...(envData.disabledValue !== undefined
                          ? { disabledValue: envData.disabledValue }
                          : {}),
                      }
                    : e
                );
                return { ...prev, environments: updatedEnvs };
              });
            }

            if (envData.strategies) {
              const localStrategies = envData.strategies.map((s: any) => ({
                id: s.id || s.strategyName,
                name: s.strategyName || s.name,
                title: s.title || '',
                parameters: s.parameters || {},
                constraints: s.constraints || [],
                segments: s.segments || [],
                sortOrder: s.sortOrder ?? 0,
                disabled: s.isEnabled === false,
              }));
              setEnvStrategies((prev) => ({
                ...prev,
                [envId]: localStrategies,
              }));
            }
            if (envData.variants) {
              const localVariants = envData.variants.map((v: any) => ({
                name: v.variantName || v.name,
                weight: v.weight,
                value: v.value,
                valueType: v.valueType,
                stickiness: v.stickiness || 'default',
              }));
              setEnvVariants((prev) => ({
                ...prev,
                [envId]: localVariants,
              }));
            }
          }
        }
      } catch {
        // Silently fail - draft status is non-critical
      }
    },
    [projectApiPath, flag?.flagName]
  );

  // Load environment-specific strategies after environments and flag are loaded
  // Then overlay draft data if a draft exists
  useEffect(() => {
    if (!isCreating && flag?.flagName && flag?.id && environments.length > 0) {
      setEnvLoading(true);
      loadEnvStrategies(environments, flag.flagName)
        .then(() => loadFlagDraftStatus(flag.id))
        .finally(() => setEnvLoading(false));
    }
  }, [
    isCreating,
    flag?.flagName,
    flag?.id,
    environments,
    loadEnvStrategies,
    loadFlagDraftStatus,
    refreshCounter, // Added refreshCounter to dependencies
  ]); // Load environment metrics for summary display in environment cards
  useEffect(() => {
    if (!isCreating && flag?.flagName && environments.length > 0) {
      loadEnvMetrics(flag.flagName, environments);
    }
  }, [isCreating, flag?.flagName, environments, loadEnvMetrics]);

  // Auto-expand environment card when selectedEnvironment and environments are both ready
  // If ?env= query parameter exists, use it instead of selectedEnvironment
  const hasAutoExpandedRef = React.useRef(false);
  useEffect(() => {
    // Only auto-expand once when both selectedEnvironment and environments are available
    if (!hasAutoExpandedRef.current && environments.length > 0) {
      const envParam = searchParams.get('env');
      const targetEnv = envParam || selectedEnvironment;
      if (targetEnv) {
        const envExists = environments.some(
          (e) => e.environmentId === targetEnv
        );
        if (envExists) {
          hasAutoExpandedRef.current = true;
          setExpandedEnvs(new Set([targetEnv]));
        }
      }
    }
  }, [selectedEnvironment, environments, searchParams]);

  // ==================== Playground Panel Resize ====================

  const playgroundPanelRef = useRef<HTMLDivElement>(null);
  const resizeHandleRef = useRef<HTMLDivElement>(null);
  const currentWidthRef = useRef(playgroundPanelWidth);

  // Keep ref in sync with state
  useEffect(() => {
    currentWidthRef.current = playgroundPanelWidth;
  }, [playgroundPanelWidth]);

  // Sync DOM style with state when panel becomes visible
  // This fixes the issue where inline styles set during resize persist incorrectly
  useEffect(() => {
    if (embeddedPlaygroundVisible && playgroundPanelRef.current) {
      playgroundPanelRef.current.style.width = `${playgroundPanelWidth}px`;
    }
  }, [embeddedPlaygroundVisible, playgroundPanelWidth]);

  const handlePlaygroundResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = currentWidthRef.current;
    let currentWidth = startWidth;

    // Show resize indicator
    if (resizeHandleRef.current) {
      resizeHandleRef.current.style.backgroundColor =
        'var(--mui-palette-primary-main, #1976d2)';
    }

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = startX - moveEvent.clientX;
      currentWidth = Math.min(
        MAX_PLAYGROUND_WIDTH,
        Math.max(MIN_PLAYGROUND_WIDTH, startWidth + deltaX)
      );
      // Update DOM directly without state update
      if (playgroundPanelRef.current) {
        playgroundPanelRef.current.style.width = `${currentWidth}px`;
      }
    };

    const handleMouseUp = () => {
      // Reset resize indicator
      if (resizeHandleRef.current) {
        resizeHandleRef.current.style.backgroundColor = '';
      }
      // Update state and ref
      currentWidthRef.current = currentWidth;
      setPlaygroundPanelWidth(currentWidth);
      localStorage.setItem(PLAYGROUND_WIDTH_KEY, currentWidth.toString());
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, []);

  // ==================== Handlers ====================

  const handleToggle = async () => {
    if (!flag || !canManage) return;

    if (isCreating) {
      setFlag({ ...flag, isEnabled: !flag.isEnabled });
      return;
    }

    try {
      await api.post(`${projectApiPath}/features/${flag.flagName}/toggle`, {
        isEnabled: !flag.isEnabled,
      });
      setFlag({ ...flag, isEnabled: !flag.isEnabled });
      enqueueSnackbar(
        t(`featureFlags.${!flag.isEnabled ? 'enabled' : 'disabled'}`),
        {
          variant: 'success',
        }
      );
    } catch (error: any) {
      enqueueSnackbar(
        parseApiErrorMessage(error, 'featureFlags.toggleFailed'),
        {
          variant: 'error',
        }
      );
    }
  };

  const handleEnvToggle = async (envKey: string, currentEnabled: boolean) => {
    if (!flag || !canManage) return;

    // Optimistic update - update UI immediately
    const updatedEnvironments = (flag.environments || []).map((env) =>
      env.environmentId === envKey
        ? { ...env, isEnabled: !currentEnabled }
        : env
    );

    // If environment doesn't exist in the array yet, add it
    if (!updatedEnvironments.find((env) => env.environmentId === envKey)) {
      updatedEnvironments.push({
        id: `temp-${envKey}`,
        flagId: flag.id,
        environmentId: envKey,
        isEnabled: !currentEnabled,
      });
    }

    setFlag({ ...flag, environments: updatedEnvironments });

    try {
      // Save to draft instead of directly toggling
      await saveChangesToDraft(envKey, { isEnabled: !currentEnabled });
    } catch (error: any) {
      // Rollback on error
      setFlag({ ...flag, environments: flag.environments });
      enqueueSnackbar(
        parseApiErrorMessage(error, 'featureFlags.toggleFailed'),
        {
          variant: 'error',
        }
      );
    }
  };

  const handleSave = async () => {
    if (!flag || !canManage) return;
    setSaving(true);
    try {
      if (isCreating) {
        await api.post(`${projectApiPath}/features`, flag);
        enqueueSnackbar(t('featureFlags.createSuccess'), {
          variant: 'success',
        });
        navigate('/feature-flags');
      } else {
        await api.put(`${projectApiPath}/features/${flag.flagName}`, {
          displayName: flag.displayName,
          description: flag.description,
          impressionDataEnabled: flag.impressionDataEnabled,
          tags: flag.tags,
        });
        setOriginalFlag(JSON.parse(JSON.stringify(flag)));
        enqueueSnackbar(t('featureFlags.updateSuccess'), {
          variant: 'success',
        });
      }
    } catch (error: any) {
      enqueueSnackbar(parseApiErrorMessage(error, 'featureFlags.saveFailed'), {
        variant: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleArchiveClick = () => {
    setArchiveConfirmOpen(true);
  };

  const handleArchiveConfirm = async () => {
    setArchiveConfirmOpen(false);
    if (!flag || !canManage) return;
    try {
      const endpoint = flag.isArchived ? 'revive' : 'archive';
      await api.post(`${projectApiPath}/features/${flag.flagName}/${endpoint}`);
      setFlag({ ...flag, isArchived: !flag.isArchived });
      enqueueSnackbar(
        t(`featureFlags.${!flag.isArchived ? 'archived' : 'revived'}`),
        {
          variant: 'success',
        }
      );
    } catch (error: any) {
      enqueueSnackbar(
        parseApiErrorMessage(error, 'featureFlags.archiveFailed'),
        {
          variant: 'error',
        }
      );
    }
  };

  const handleStaleClick = () => {
    setStaleConfirmOpen(true);
  };

  const handleStaleConfirm = async () => {
    setStaleConfirmOpen(false);
    if (!flag || !canManage) return;
    try {
      const endpoint = flag.stale ? 'unmark-stale' : 'mark-stale';
      await api.post(`${projectApiPath}/features/${flag.flagName}/${endpoint}`);
      setFlag({ ...flag, stale: !flag.stale });
      enqueueSnackbar(
        t(`featureFlags.${!flag.stale ? 'markedAsStale' : 'unmarkedAsStale'}`),
        {
          variant: 'success',
        }
      );
    } catch (error: any) {
      enqueueSnackbar(
        parseApiErrorMessage(error, 'featureFlags.staleToggleFailed'),
        {
          variant: 'error',
        }
      );
    }
  };

  const handleDelete = async () => {
    if (!flag || !canManage) return;
    try {
      await api.delete(`${projectApiPath}/features/${flag.flagName}`);
      enqueueSnackbar(t('featureFlags.deleteSuccess'), { variant: 'success' });
      navigate('/feature-flags');
    } catch (error: any) {
      enqueueSnackbar(
        parseApiErrorMessage(error, 'featureFlags.deleteFailed'),
        {
          variant: 'error',
        }
      );
    }
  };

  // Link handlers
  const handleOpenAddLink = () => {
    setEditingLink({ url: '', title: '' });
    setEditingLinkIndex(null);
    setLinkDialogOpen(true);
  };

  const handleOpenEditLink = (link: FlagLink, index: number) => {
    setEditingLink({ ...link });
    setEditingLinkIndex(index);
    setLinkDialogOpen(true);
  };

  const handleSaveLink = async () => {
    if (!flag || !editingLink.url) return;

    const currentLinks = flag.links || [];
    let updatedLinks: FlagLink[];

    if (editingLinkIndex !== null) {
      // Editing existing link
      updatedLinks = currentLinks.map((link, i) =>
        i === editingLinkIndex ? editingLink : link
      );
    } else {
      // Adding new link
      updatedLinks = [...currentLinks, editingLink];
    }

    try {
      if (!isCreating) {
        await api.put(`${projectApiPath}/features/${flag.flagName}`, {
          links: updatedLinks,
        });
      }
      setFlag({ ...flag, links: updatedLinks });
      setLinkDialogOpen(false);
      enqueueSnackbar(t('common.saveSuccess'), { variant: 'success' });
    } catch (error: any) {
      enqueueSnackbar(parseApiErrorMessage(error, 'common.saveFailed'), {
        variant: 'error',
      });
    }
  };

  const handleDeleteLink = async (index: number) => {
    if (!flag) return;

    const updatedLinks = (flag.links || []).filter((_, i) => i !== index);

    try {
      if (!isCreating) {
        await api.put(`${projectApiPath}/features/${flag.flagName}`, {
          links: updatedLinks,
        });
      }
      setFlag({ ...flag, links: updatedLinks });
      enqueueSnackbar(t('common.deleteSuccess'), { variant: 'success' });
    } catch (error: any) {
      enqueueSnackbar(parseApiErrorMessage(error, 'common.deleteFailed'), {
        variant: 'error',
      });
    }
  };

  // Helper function to distribute weights equally among variants
  const distributeWeights = (variants: Variant[]): Variant[] => {
    if (variants.length === 0) return variants;

    const baseWeight = Math.floor(100 / variants.length);
    const remainder = 100 % variants.length;

    return variants.map((v, i) => ({
      ...v,
      weight: baseWeight + (i < remainder ? 1 : 0),
    }));
  };

  // Helper function to add a new variant with auto weight distribution
  const addVariantWithAutoDistribution = () => {
    const currentVariants = editingStrategy?.variants || [];
    const lastVariant = currentVariants[currentVariants.length - 1];
    const variantType = flag?.valueType || 'string';

    // Determine default value based on type and existing variants
    let defaultValue: any = undefined;
    if (lastVariant?.value !== undefined) {
      // Copy last variant's value
      defaultValue = lastVariant.value;
    } else if (variantType === 'number') {
      defaultValue = 0;
    } else if (variantType === 'json') {
      defaultValue = '{}';
    } else if (variantType === 'boolean') {
      defaultValue = 'true';
    } else {
      defaultValue = '';
    }

    const newVariant: Variant = {
      name: `variant-${currentVariants.length + 1}`,
      weight: 0, // Will be recalculated
      stickiness: 'default',
      value: defaultValue,
      valueType: variantType as 'boolean' | 'string' | 'json' | 'number',
    };
    const updatedVariants = distributeWeights([...currentVariants, newVariant]);
    setEditingStrategy({
      ...editingStrategy!,
      variants: updatedVariants,
    });
  };

  // Helper function to remove a variant with auto weight redistribution
  const removeVariantWithAutoDistribution = (index: number) => {
    const currentVariants = editingStrategy?.variants || [];
    const remainingVariants = currentVariants.filter((_, i) => i !== index);
    const updatedVariants = distributeWeights(remainingVariants);
    setEditingStrategy({
      ...editingStrategy!,
      variants: updatedVariants,
    });
    // Clear JSON error for this index
    setStrategyJsonErrors((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  };

  // Helper function to update a variant's weight
  const updateVariantWeight = (index: number, weight: number) => {
    const currentVariants = [...(editingStrategy?.variants || [])];
    currentVariants[index] = {
      ...currentVariants[index],
      weight: Math.min(100, Math.max(0, weight)),
    };
    setEditingStrategy({
      ...editingStrategy!,
      variants: currentVariants,
    });
  };

  // Strategy handlers
  const handleAddStrategy = (envId: string) => {
    const envStrategyList = envStrategies[envId] || [];
    const newStrategy: Strategy = {
      id: `new-${Date.now()}`,
      name: 'flexibleRollout',
      title: '',
      parameters: {
        rollout: 0,
        stickiness: 'default',
        groupId: flag?.flagName || '',
      },
      constraints: [],
      segments: [],
      sortOrder: envStrategyList.length,
      disabled: true, // New strategies are disabled by default
    };
    setEditingStrategy(newStrategy);
    setOriginalEditingStrategy(JSON.parse(JSON.stringify(newStrategy)));
    setStrategyJsonErrors({});
    setStrategyTabValue(0);
    setEditingEnv(envId);
    setIsAddingStrategy(true);
    setStrategyDialogOpen(true);
  };

  const handleEditStrategy = (strategy: Strategy, envId: string) => {
    setEditingStrategy({ ...strategy });
    setOriginalEditingStrategy(JSON.parse(JSON.stringify(strategy)));
    setStrategyJsonErrors({});
    setStrategyTabValue(0);
    setEditingEnv(envId);
    setIsAddingStrategy(false);
    setStrategyDialogOpen(true);
  };

  // Helper: save environment-specific changes
  // If the environment requires CR approval, save to CR draft.
  // Otherwise, apply changes directly via API.
  const saveChangesToDraft = async (
    envId: string,
    updates: {
      strategies?: any[];
      variants?: any[];
      isEnabled?: boolean;
      overrideEnabledValue?: boolean;
      overrideDisabledValue?: boolean;
      enabledValue?: any;
      disabledValue?: any;
    }
  ) => {
    if (!flag) return;

    const env = environments.find((e) => e.environmentId === envId);
    const requiresCR = env?.requiresApproval ?? false;

    if (requiresCR) {
      // CR-enabled environment: save to change request draft
      const pendingCR = await changeRequestService.getPendingFlagDraft(
        flag.flagName,
        projectApiPath
      );
      const draftData = pendingCR?.draftData || {};

      // Merge updates into the specific environment's data within the draft
      const currentEnvData = draftData[envId] || {};
      const mergedEnvData = { ...currentEnvData, ...updates };

      // Build draft with merged env data
      const mergedDraft = { ...draftData };
      if (Object.keys(mergedEnvData).length > 0) {
        mergedDraft[envId] = mergedEnvData;
      } else {
        delete mergedDraft[envId];
      }

      await changeRequestService.saveFlagDraft(
        flag.flagName,
        mergedDraft,
        projectApiPath,
        envId
      );
      setFlagDraftStatus((prev) => ({
        hasDraft: true,
        draftEnvIds: new Set([...(prev.draftEnvIds || []), envId]),
      }));
      // Notify MainLayout to refresh floating CR banner
      window.dispatchEvent(new CustomEvent('cr-draft-changed'));
    } else {
      // Non-CR environment: apply changes directly via API
      if (updates.isEnabled !== undefined) {
        await featureFlagService.toggleFeatureFlag(
          flag.flagName,
          updates.isEnabled,
          envId,
          projectApiPath
        );
      }
      if (updates.strategies) {
        await featureFlagService.updateStrategies(
          flag.flagName,
          envId,
          updates.strategies,
          projectApiPath
        );
      }
      if (updates.variants) {
        await featureFlagService.updateVariants(
          flag.flagName,
          envId,
          updates.variants,
          projectApiPath
        );
      }
      if (
        updates.enabledValue !== undefined ||
        updates.disabledValue !== undefined
      ) {
        await featureFlagService.updateFlagValues(
          flag.flagName,
          envId,
          {
            enabledValue: updates.enabledValue,
            disabledValue: updates.disabledValue,
            overrideEnabledValue: updates.overrideEnabledValue,
            overrideDisabledValue: updates.overrideDisabledValue,
          },
          projectApiPath
        );
      }
    }

    // Update parent state to keep props in sync with editing state
    if (updates.strategies) {
      const localStrategies = updates.strategies.map((s: any) => ({
        id: s.id || s.strategyName,
        name: s.strategyName || s.name,
        title: s.title || '',
        parameters: s.parameters || {},
        constraints: s.constraints || [],
        segments: s.segments || [],
        sortOrder: s.sortOrder ?? 0,
        disabled: s.isEnabled === false,
      }));
      setEnvStrategies((prev) => ({
        ...prev,
        [envId]: localStrategies,
      }));
    }

    if (updates.variants) {
      const localVariants = updates.variants.map((v: any) => ({
        name: v.variantName || v.name,
        weight: v.weight,
        value: v.value,
        valueType: v.valueType,
        stickiness: v.stickiness || 'default',
      }));
      setEnvVariants((prev) => ({
        ...prev,
        [envId]: localVariants,
      }));
    }
  };

  // Save global (flag-level) settings to draft under the _global key
  // Only saves to CR draft if at least one environment requires approval;
  // otherwise applies the change directly via API.
  const saveGlobalChangesToDraft = async (updates: Record<string, any>) => {
    if (!flag) return;

    // Check if any environment requires approval
    const anyEnvRequiresApproval = environments.some(
      (env) => env.requiresApproval
    );

    if (!anyEnvRequiresApproval) {
      // No environment requires approval → apply directly via API
      await api.put(`${projectApiPath}/features/${flag.flagName}`, updates);
      return;
    }

    // At least one environment requires approval → save to CR draft
    const pendingCR = await changeRequestService.getPendingFlagDraft(
      flag.flagName,
      projectApiPath
    );
    const draftData = pendingCR?.draftData || {};

    const currentGlobal = draftData._global || {};
    const mergedDraft = {
      ...draftData,
      _global: { ...currentGlobal, ...updates },
    };

    await changeRequestService.saveFlagDraft(
      flag.flagName,
      mergedDraft,
      projectApiPath
    );

    setFlagDraftStatus((prev) => ({ ...prev, hasDraft: true }));
    // Notify MainLayout to refresh floating CR banner
    window.dispatchEvent(new CustomEvent('cr-draft-changed'));
  };

  const handleSaveStrategy = async () => {
    if (!flag || !editingStrategy || !editingEnv) return;

    const currentEnvStrategies = envStrategies[editingEnv] || [];
    const isNew = editingStrategy.id?.startsWith('new-');
    let updatedStrategies: Strategy[];

    if (isNew) {
      const newStrategy = { ...editingStrategy, id: undefined as any };
      updatedStrategies = [...currentEnvStrategies, newStrategy];
    } else {
      updatedStrategies = currentEnvStrategies.map((s) =>
        s.id === editingStrategy.id ? editingStrategy : s
      );
    }

    try {
      if (!isCreating) {
        // Convert frontend Strategy format to backend API format
        const apiStrategies = updatedStrategies.map((s) => ({
          strategyName: s.name,
          title: s.title,
          parameters: {
            ...s.parameters,
            // Ensure groupId is populated with flag name when empty
            groupId: s.parameters?.groupId || flag.flagName || '',
          },
          constraints: s.constraints,
          segments: s.segments,
          sortOrder: s.sortOrder,
          isEnabled: !s.disabled,
        }));
        // Save to draft instead of directly to backend
        await saveChangesToDraft(editingEnv, { strategies: apiStrategies });
      } else {
        // Update environment-specific strategies for create mode
        setEnvStrategies((prev) => ({
          ...prev,
          [editingEnv]: updatedStrategies,
        }));
      }
      setStrategyDialogOpen(false);
      setEditingStrategy(null);
      setEditingEnv(null);
      setIsAddingStrategy(false);
      setExpandedSegmentsDialog(new Set());
    } catch (error: any) {
      enqueueSnackbar(parseApiErrorMessage(error, 'common.saveFailed'), {
        variant: 'error',
      });
    }
  };

  const handleDeleteStrategy = async (
    strategyId: string | undefined,
    index: number,
    envId: string
  ) => {
    if (!flag) return;
    const currentEnvStrategies = envStrategies[envId] || [];
    const updatedStrategies = currentEnvStrategies.filter(
      (_, i) => i !== index
    );

    try {
      if (!isCreating) {
        const apiStrategies = updatedStrategies.map((s) => ({
          strategyName: s.name,
          title: s.title,
          parameters: s.parameters,
          constraints: s.constraints,
          segments: s.segments,
          sortOrder: s.sortOrder,
          isEnabled: !s.disabled,
        }));
        // Save to draft instead of directly to backend
        await saveChangesToDraft(envId, { strategies: apiStrategies });
      } else {
        setEnvStrategies((prev) => ({
          ...prev,
          [envId]: updatedStrategies,
        }));
      }
    } catch (error: any) {
      enqueueSnackbar(parseApiErrorMessage(error, 'common.deleteFailed'), {
        variant: 'error',
      });
    }
  };

  // Handler for saving environment-specific variants from EnvironmentVariantsEditor
  const handleSaveEnvVariants = async (
    envId: string,
    variants: EditorVariant[]
  ) => {
    if (!flag) return;

    try {
      if (!isCreating) {
        const apiVariants = variants.map((v) => ({
          variantName: v.name,
          weight: v.weight,
          value: v.value,
          valueType: v.valueType,
          stickiness: v.stickiness || 'default',
        }));
        // Save to draft instead of directly to backend
        await saveChangesToDraft(envId, { variants: apiVariants });
      } else {
        setEnvVariants((prev) => ({
          ...prev,
          [envId]: variants as Variant[],
        }));
        enqueueSnackbar(t('featureFlags.variantsSaved'), {
          variant: 'success',
        });
      }
    } catch (error: any) {
      enqueueSnackbar(
        parseApiErrorMessage(error, 'featureFlags.variantsSaveFailed'),
        {
          variant: 'error',
        }
      );
    }
  };

  // Handler for toggling useFixedWeightVariants flag-level setting
  const handleUseFixedWeightVariantsChange = async (value: boolean) => {
    if (!flag) return;

    try {
      if (!isCreating) {
        await saveGlobalChangesToDraft({ useFixedWeightVariants: value });
        setFlag((prev) =>
          prev ? { ...prev, useFixedWeightVariants: value } : prev
        );
      } else {
        setFlag((prev) =>
          prev ? { ...prev, useFixedWeightVariants: value } : prev
        );
      }
    } catch (error: any) {
      enqueueSnackbar(parseApiErrorMessage(error, 'common.saveFailed'), {
        variant: 'error',
      });
    }
  };

  // Handler for saving environment-specific fallback value (enabledValue/disabledValue)
  const handleSaveEnvFallbackValue = async (
    envId: string,
    enabledValue: any,
    disabledValue: any,
    overrideEnabledValue: boolean,
    overrideDisabledValue: boolean
  ) => {
    if (!flag || isCreating) return;

    try {
      // Compare with current env state and only include actually changed fields
      const currentEnv = flag.environments?.find(
        (e) => e.environmentId === envId
      );
      const updates: Record<string, any> = {};

      if (
        JSON.stringify(enabledValue) !==
        JSON.stringify(currentEnv?.enabledValue ?? flag.enabledValue)
      ) {
        updates.enabledValue = enabledValue;
      }
      if (
        JSON.stringify(disabledValue) !==
        JSON.stringify(currentEnv?.disabledValue ?? flag.disabledValue)
      ) {
        updates.disabledValue = disabledValue;
      }
      // eslint-disable-next-line eqeqeq
      if (overrideEnabledValue != (currentEnv?.overrideEnabledValue ?? false)) {
        updates.overrideEnabledValue = overrideEnabledValue;
      }
      // eslint-disable-next-line eqeqeq
      if (
        overrideDisabledValue != (currentEnv?.overrideDisabledValue ?? false)
      ) {
        updates.overrideDisabledValue = overrideDisabledValue;
      }

      if (Object.keys(updates).length === 0) return;

      await saveChangesToDraft(envId, updates);
    } catch (error: any) {
      enqueueSnackbar(
        parseApiErrorMessage(error, 'featureFlags.fallbackValueSaveFailed'),
        {
          variant: 'error',
        }
      );
    }
  };

  const handleOpenDeleteStrategyConfirm = (
    strategyId: string | undefined,
    index: number,
    envId: string
  ) => {
    setStrategyDeleteConfirm({
      open: true,
      strategyId,
      index,
      envId,
    });
  };

  const handleCloseDeleteStrategyConfirm = () => {
    setStrategyDeleteConfirm({ open: false });
  };

  const handleConfirmDeleteStrategy = () => {
    if (
      strategyDeleteConfirm.index !== undefined &&
      strategyDeleteConfirm.envId
    ) {
      handleDeleteStrategy(
        strategyDeleteConfirm.strategyId,
        strategyDeleteConfirm.index,
        strategyDeleteConfirm.envId
      );
    }
    handleCloseDeleteStrategyConfirm();
  };

  const handleReorderStrategies = async (
    envId: string,
    oldIndex: number,
    newIndex: number
  ) => {
    if (!flag || oldIndex === newIndex) return;

    const currentEnvStrategies = envStrategies[envId] || [];
    const reorderedStrategies = arrayMove(
      currentEnvStrategies,
      oldIndex,
      newIndex
    );

    // Update sortOrder for all strategies
    const updatedStrategies = reorderedStrategies.map((s, idx) => ({
      ...s,
      sortOrder: idx,
    }));

    // Optimistically update UI
    setEnvStrategies((prev) => ({
      ...prev,
      [envId]: updatedStrategies,
    }));

    try {
      if (!isCreating) {
        const apiStrategies = updatedStrategies.map((s) => ({
          strategyName: s.name,
          title: s.title,
          parameters: s.parameters,
          constraints: s.constraints,
          segments: s.segments,
          sortOrder: s.sortOrder,
          isEnabled: !s.disabled,
        }));
        // Save to draft instead of directly to backend
        await saveChangesToDraft(envId, { strategies: apiStrategies });
      }
    } catch (error: any) {
      // Revert on error
      setEnvStrategies((prev) => ({
        ...prev,
        [envId]: currentEnvStrategies,
      }));
      enqueueSnackbar(parseApiErrorMessage(error, 'common.saveFailed'), {
        variant: 'error',
      });
    }
  };

  const [valueJsonErrors, setValueJsonErrors] = useState<{
    enabledValue?: string | null;
    disabledValue?: string | null;
  }>({});

  const setJsonError = (
    field: 'enabledValue' | 'disabledValue',
    error: string | null
  ) => {
    setValueJsonErrors((prev) => ({ ...prev, [field]: error }));
  };

  const renderValueInput = (field: 'enabledValue' | 'disabledValue') => {
    if (!flag) return null;

    const value = flag[field];
    const type = flag.valueType || 'boolean';
    const error = valueJsonErrors[field];

    if (type === 'boolean') {
      return (
        <BooleanSwitch
          checked={value === true || value === 'true'}
          onChange={(e) => {
            setFlag((prev) =>
              prev ? { ...prev, [field]: e.target.checked } : prev
            );
          }}
          disabled={!canManage}
        />
      );
    }

    if (type === 'number') {
      return (
        <TextField
          fullWidth
          size="small"
          type="number"
          value={value ?? ''}
          onChange={(e) => {
            // Allow empty string during typing to avoid stuck-at-0 issue
            const raw = e.target.value;
            setFlag((prev) =>
              prev ? { ...prev, [field]: raw === '' ? '' : Number(raw) } : prev
            );
          }}
          onBlur={() => {
            // Normalize empty to 0 when leaving the field
            setFlag((prev) => {
              if (!prev) return prev;
              const cur = (prev as any)[field];
              if (cur === '' || cur === undefined || cur === null) {
                return { ...prev, [field]: 0 };
              }
              return prev;
            });
          }}
          disabled={!canManage}
        />
      );
    }

    // string and json types both use ValueEditorField (same as create form)
    return (
      <ValueEditorField
        value={(() => {
          if (type === 'json') {
            if (
              value === null ||
              value === undefined ||
              value === '[object Object]'
            )
              return '{}';
            if (typeof value === 'object')
              return JSON.stringify(value, null, 2);
            return String(value);
          }
          return value ?? '';
        })()}
        onChange={(val) => {
          if (type === 'json') {
            // val can be an already-parsed object (from dialog) or a string (from inline)
            if (typeof val === 'object' && val !== null) {
              setFlag((prev) => (prev ? { ...prev, [field]: val } : prev));
              setJsonError(field, null);
            } else {
              try {
                const parsed = JSON.parse(val);
                setFlag((prev) => (prev ? { ...prev, [field]: parsed } : prev));
                setJsonError(field, null);
              } catch (e: any) {
                setJsonError(field, e.message || 'Invalid JSON');
              }
            }
          } else {
            setFlag((prev) => (prev ? { ...prev, [field]: val } : prev));
          }
        }}
        valueType={type}
        label={
          field === 'enabledValue'
            ? t('featureFlags.enabledValue')
            : t('featureFlags.disabledValue')
        }
        onValidationError={
          type === 'json' ? (err) => setJsonError(field, err) : undefined
        }
        disabled={!canManage}
      />
    );
  };

  // Variant handlers
  const handleAddVariant = () => {
    if (!flag) return;
    setEditingVariant({
      name: `variant-${(flag.variants || []).length + 1}`,
      weight: 50,
      value:
        flag.valueType === 'boolean'
          ? false
          : flag.valueType === 'number'
            ? 0
            : flag.valueType === 'json'
              ? {}
              : '',
      valueType: flag.valueType || 'boolean',
    });
    setVariantDialogOpen(true);
  };

  const handleEditVariant = (variant: Variant) => {
    setEditingVariant({ ...variant });
    setVariantDialogOpen(true);
  };

  const handleSaveVariants = async () => {
    if (!flag || !editingVariant) return;

    let updatedVariants: Variant[];
    const existingIndex = (flag.variants || []).findIndex(
      (v) => v.name === editingVariant.name
    );

    if (existingIndex >= 0) {
      updatedVariants = (flag.variants || []).map((v, i) =>
        i === existingIndex ? editingVariant : v
      );
    } else {
      updatedVariants = [...(flag.variants || []), editingVariant];
    }

    try {
      if (!isCreating) {
        await saveGlobalChangesToDraft({
          variants: updatedVariants.map((v) => ({
            variantName: v.name,
            weight: v.weight,
            value: v.value,
            valueType: v.valueType,
            stickiness: v.stickiness || 'default',
          })),
        });
      }
      setFlag({ ...flag, variants: updatedVariants });
      setVariantDialogOpen(false);
      setEditingVariant(null);
    } catch (error: any) {
      enqueueSnackbar(parseApiErrorMessage(error, 'common.saveFailed'), {
        variant: 'error',
      });
    }
  };

  const handleDeleteVariant = async (index: number) => {
    if (!flag) return;
    const updatedVariants = (flag.variants || []).filter((_, i) => i !== index);

    try {
      if (!isCreating) {
        await saveGlobalChangesToDraft({
          variants: updatedVariants.map((v) => ({
            variantName: v.name,
            weight: v.weight,
            value: v.value,
            valueType: v.valueType,
          })),
        });
      }
      setFlag({ ...flag, variants: updatedVariants });
    } catch (error: any) {
      enqueueSnackbar(parseApiErrorMessage(error, 'common.deleteFailed'), {
        variant: 'error',
      });
    }
  };

  // Helper functions
  const getStrategyTitle = (name: string) => {
    const strategyType = STRATEGY_TYPES.find((st) => st.name === name);
    return strategyType ? t(strategyType.titleKey) : name;
  };

  const getSegmentNames = (segmentIds: string[] = []) => {
    const segmentsArray = Array.isArray(segments) ? segments : [];
    return segmentIds
      .map((id) => segmentsArray.find((s) => s.id === id)?.name || id)
      .join(', ');
  };

  // ==================== Render ====================

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '50vh',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!flag) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{t('featureFlags.notFound')}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <IconButton onClick={() => navigate('/feature-flags')}>
          <ArrowBackIcon />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h5" fontWeight={600}>
              {flag.flagName}
            </Typography>
            {flag.isArchived && (
              <Chip
                label={t('featureFlags.archived')}
                size="small"
                color="warning"
              />
            )}
            <Tooltip title={t('common.copyToClipboard')}>
              <IconButton
                size="small"
                onClick={() =>
                  copyToClipboardWithNotification(
                    flag.flagName,
                    () =>
                      enqueueSnackbar(t('common.copySuccess'), {
                        variant: 'success',
                      }),
                    () =>
                      enqueueSnackbar(t('common.copyFailed'), {
                        variant: 'error',
                      })
                  )
                }
              >
                <CopyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
          {flag.description && (
            <Typography variant="body2" color="text.secondary">
              {flag.description}
            </Typography>
          )}
        </Box>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
          <Tab label={t('featureFlags.overview')} />
          <Tab label={t('featureFlags.flagValues')} disabled={isCreating} />
          <Tab label={t('featureFlags.metrics')} disabled={isCreating} />
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {t('featureFlags.tabs.codeReferences')}
                {codeReferenceCount !== null && codeReferenceCount > 0 && (
                  <Chip
                    label={codeReferenceCount}
                    size="small"
                    variant="filled"
                    sx={{
                      height: 20,
                      minWidth: 20,
                      fontSize: '0.7rem',
                      bgcolor: 'action.selected',
                    }}
                  />
                )}
              </Box>
            }
            disabled={isCreating}
          />
          <Tab label={t('featureFlags.tabs.history')} disabled={isCreating} />
        </Tabs>
      </Box>

      {/* Overview Tab */}
      <TabPanel value={tabValue} index={0}>
        <Box
          sx={{
            display: 'flex',
            gap: 3,
            flexDirection: { xs: 'column', md: 'row' },
          }}
        >
          {/* Left Sidebar - Flag Details */}
          <Box sx={{ width: { xs: '100%', md: 320 }, flexShrink: 0 }}>
            {/* Flag Details Card */}
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                mb: 2,
                borderRadius: 1,
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              }}
            >
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                {t('featureFlags.flagDetails')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {flag.flagName}
              </Typography>

              <Stack spacing={1.5}>
                {/* Flag Type */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">
                    {t('featureFlags.flagType')}
                  </Typography>
                  {isCreating ? (
                    <FormControl size="small" sx={{ minWidth: 200 }}>
                      <Select
                        value={flag.flagType}
                        onChange={(e) =>
                          setFlag({ ...flag, flagType: e.target.value as any })
                        }
                      >
                        {FLAG_TYPES.map((type) => (
                          <MenuItem key={type.value} value={type.value}>
                            <Box
                              sx={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: 1,
                              }}
                            >
                              <Box sx={{ mt: 0.3 }}>
                                {getTypeIcon(type.value)}
                              </Box>
                              <Box>
                                <Typography variant="body2" fontWeight={500}>
                                  {t(type.labelKey)}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  sx={{ display: 'block' }}
                                >
                                  {t(type.descKey)}
                                </Typography>
                              </Box>
                            </Box>
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  ) : (
                    <Box
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                    >
                      {getTypeIcon(flag.flagType)}
                      <Typography variant="body2">
                        {t(`featureFlags.types.${flag.flagType}`)}
                      </Typography>
                    </Box>
                  )}
                </Box>

                {/* Value Type */}
                {!isCreating && (
                  <Box
                    sx={{ display: 'flex', justifyContent: 'space-between' }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      {t('featureFlags.valueType')}
                    </Typography>
                    <Box
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                    >
                      <FieldTypeIcon
                        type={flag.valueType || 'boolean'}
                        size={16}
                      />
                      <Typography variant="body2">
                        {t(
                          `featureFlags.valueTypes.${flag.valueType || 'boolean'}`
                        )}
                      </Typography>
                    </Box>
                  </Box>
                )}

                {/* Created By */}
                {flag.createdByName && (
                  <Box
                    sx={{ display: 'flex', justifyContent: 'space-between' }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      {t('featureFlags.createdBy')}
                    </Typography>
                    <Typography variant="body2">
                      {flag.createdByName}
                    </Typography>
                  </Box>
                )}

                {/* Created At */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">
                    {t('featureFlags.createdAt')}
                  </Typography>
                  <Tooltip title={formatDateTimeDetailed(flag.createdAt)} arrow>
                    <Typography variant="body2">
                      {formatRelativeTime(flag.createdAt)}
                    </Typography>
                  </Tooltip>
                </Box>

                {/* Updated At */}
                {flag.updatedAt && (
                  <Box
                    sx={{ display: 'flex', justifyContent: 'space-between' }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      {t('featureFlags.updatedAt')}
                    </Typography>
                    <Tooltip
                      title={formatDateTimeDetailed(flag.updatedAt)}
                      arrow
                    >
                      <Typography variant="body2">
                        {formatRelativeTime(flag.updatedAt)}
                      </Typography>
                    </Tooltip>
                  </Box>
                )}

                {/* Last Seen At */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">
                    {t('featureFlags.lastSeenAt')}
                  </Typography>
                  {flag.lastSeenAt ? (
                    <Tooltip
                      title={formatDateTimeDetailed(flag.lastSeenAt)}
                      arrow
                    >
                      <Typography variant="body2">
                        {formatRelativeTime(flag.lastSeenAt)}
                      </Typography>
                    </Tooltip>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      -
                    </Typography>
                  )}
                </Box>

                <Divider />

                {/* Tags */}
                <Box>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    gutterBottom
                  >
                    {t('featureFlags.tags')}
                  </Typography>
                  <TagChips
                    tags={(flag.tags || [])
                      .map((tagName) => allTags.find((t) => t.name === tagName))
                      .filter((t): t is Tag => !!t)}
                    emptyText={t('featureFlags.noTags')}
                  />
                </Box>

                {/* Settings Info - only in view mode */}
                {!isCreating && (
                  <>
                    <Divider />
                    <Box>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        gutterBottom
                      >
                        {t('common.settings')}
                      </Typography>
                      <Stack spacing={1}>
                        {/* Display Name */}
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                          }}
                        >
                          <Typography variant="caption" color="text.secondary">
                            {t('featureFlags.displayName')}
                          </Typography>
                          <Typography variant="body2">
                            {flag.displayName || '-'}
                          </Typography>
                        </Box>
                        {/* Description */}
                        {flag.description && (
                          <Box>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {t('featureFlags.description')}
                            </Typography>
                            <Typography variant="body2" sx={{ mt: 0.5 }}>
                              {flag.description}
                            </Typography>
                          </Box>
                        )}
                        {/* Impression Data */}
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <Typography variant="caption" color="text.secondary">
                            {t('featureFlags.impressionData')}
                          </Typography>
                          <Chip
                            label={
                              flag.impressionDataEnabled
                                ? t('common.enabled')
                                : t('common.disabled')
                            }
                            size="small"
                            color={
                              flag.impressionDataEnabled ? 'success' : 'default'
                            }
                            variant="outlined"
                          />
                        </Box>
                      </Stack>
                    </Box>
                  </>
                )}

                {/* Actions */}
                {canManage && !isCreating && (
                  <>
                    <Divider />
                    <Button
                      variant="outlined"
                      color={flag.isArchived ? 'success' : 'warning'}
                      startIcon={<ArchiveIcon />}
                      onClick={handleArchiveClick}
                      fullWidth
                      size="small"
                    >
                      {flag.isArchived
                        ? t('featureFlags.revive')
                        : t('featureFlags.archive')}
                    </Button>
                    <Button
                      variant="outlined"
                      color={flag.stale ? 'info' : 'secondary'}
                      startIcon={<StaleIcon />}
                      onClick={handleStaleClick}
                      fullWidth
                      size="small"
                    >
                      {flag.stale
                        ? t('featureFlags.unmarkStale')
                        : t('featureFlags.markStale')}
                    </Button>
                    <Button
                      variant="outlined"
                      color="primary"
                      startIcon={<EditIcon />}
                      onClick={() => {
                        setEditingFlagData({
                          displayName: flag.displayName || '',
                          description: flag.description || '',
                          impressionDataEnabled: flag.impressionDataEnabled,
                          tags: flag.tags || [],
                        });

                        const matchingTags = (flag.tags || [])
                          .map((tagName) =>
                            allTags.find((t) => t.name === tagName)
                          )
                          .filter((t): t is Tag => !!t);
                        setEditTagSelection(matchingTags);

                        setEditFlagDialogOpen(true);
                      }}
                      fullWidth
                      size="small"
                    >
                      {t('common.edit')}
                    </Button>
                    {flag.isArchived && (
                      <Button
                        variant="outlined"
                        color="error"
                        startIcon={<DeleteIcon />}
                        onClick={() => setDeleteDialogOpen(true)}
                        fullWidth
                        size="small"
                      >
                        {t('common.delete')}
                      </Button>
                    )}
                  </>
                )}
              </Stack>
            </Paper>

            {/* Basic Info - only in create mode */}
            {isCreating && (
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                  {t('featureFlags.basicInfo')}
                </Typography>
                <Stack spacing={2}>
                  <TextField
                    fullWidth
                    size="small"
                    required
                    label={t('featureFlags.flagName')}
                    value={flag.flagName || ''}
                    onChange={(e) =>
                      setFlag({
                        ...flag,
                        flagName: e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''),
                      })
                    }
                    helperText={t('featureFlags.flagNameHelp')}
                  />
                  <TextField
                    fullWidth
                    size="small"
                    label={t('featureFlags.displayName')}
                    value={flag.displayName || ''}
                    onChange={(e) =>
                      setFlag({ ...flag, displayName: e.target.value })
                    }
                  />
                  <TextField
                    fullWidth
                    size="small"
                    multiline
                    rows={2}
                    label={t('featureFlags.description')}
                    value={flag.description || ''}
                    onChange={(e) =>
                      setFlag({ ...flag, description: e.target.value })
                    }
                  />
                </Stack>
              </Paper>
            )}

            {/* Links Section */}
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                borderRadius: 1,
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              }}
            >
              <Typography
                variant="subtitle2"
                color="text.secondary"
                gutterBottom
              >
                {t('featureFlags.links.title')}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mb: 2 }}
              >
                {t('featureFlags.links.helpText')}
              </Typography>

              {(flag.links?.length || 0) > 0 ? (
                <Stack spacing={1}>
                  {flag.links?.map((link, index) => (
                    <Box
                      key={index}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        py: 0.5,
                        '&:hover .link-actions': { opacity: 1 },
                      }}
                    >
                      <Box
                        component="a"
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          textDecoration: 'none',
                          color: 'primary.main',
                          '&:hover': { textDecoration: 'underline' },
                          overflow: 'hidden',
                        }}
                      >
                        <LinkIcon
                          fontSize="small"
                          sx={{ color: 'text.secondary', mr: 0.5 }}
                        />
                        <Typography
                          variant="body2"
                          noWrap
                          title={link.title || link.url}
                        >
                          {link.title || link.url}
                        </Typography>
                      </Box>
                      {canManage && (
                        <Box
                          className="link-actions"
                          sx={{
                            opacity: 0,
                            transition: 'opacity 0.2s',
                            display: 'flex',
                            gap: 0,
                          }}
                        >
                          <Tooltip title={t('common.edit')}>
                            <IconButton
                              size="small"
                              onClick={() => handleOpenEditLink(link, index)}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={t('common.delete')}>
                            <IconButton
                              size="small"
                              onClick={() => handleDeleteLink(index)}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      )}
                    </Box>
                  ))}
                </Stack>
              ) : null}

              {canManage && (
                <Box
                  sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}
                >
                  <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={handleOpenAddLink}
                  >
                    {t('featureFlags.links.addLink')}
                  </Button>
                </Box>
              )}
            </Paper>
          </Box>

          {/* Right Main Area - Environment Cards */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <PageContentLoader loading={envLoading}>
              <Stack spacing={2} sx={{ minWidth: 0 }}>
                {environments.map((env, envIndex) => {
                  // Get environment-specific isEnabled from flag.environments
                  const envSettings = flag.environments?.find(
                    (e) => e.environmentId === env.environmentId
                  );
                  const isEnabled = envSettings?.isEnabled ?? false;
                  // Use environment-specific strategies
                  const strategies = envStrategies[env.environmentId] || [];
                  const strategiesCount = strategies.length;
                  const isExpanded = expandedEnvs.has(env.environmentId);

                  return (
                    <React.Fragment key={env.environmentId}>
                      {envIndex > 0 && (
                        <Divider sx={{ borderStyle: 'dashed', my: 1 }} />
                      )}
                      <Box
                        sx={{
                          display: 'flex',
                          border: 1,
                          borderColor: 'divider',
                          overflow: 'hidden',
                          borderRadius: 1,
                          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                        }}
                      >
                        {/* Content */}
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Accordion
                            expanded={isExpanded}
                            onChange={(_, expanded) => {
                              setExpandedEnvs((prev) => {
                                const next = new Set(prev);
                                if (expanded) {
                                  next.add(env.environmentId);
                                } else {
                                  next.delete(env.environmentId);
                                }
                                return next;
                              });
                            }}
                            disableGutters
                            sx={{
                              '&:before': { display: 'none' },
                              bgcolor: 'background.paper',
                            }}
                          >
                            <AccordionSummary
                              expandIcon={<ExpandMoreIcon />}
                              sx={{
                                px: 2,
                                '& .MuiAccordionSummary-content': {
                                  alignItems: 'center',
                                  gap: 2,
                                },
                              }}
                            >
                              {/* Toggle switch */}
                              <Tooltip
                                title={
                                  isEnabled
                                    ? t('common.disable')
                                    : t('common.enable')
                                }
                                disableFocusListener
                                enterDelay={500}
                                leaveDelay={0}
                              >
                                <Box onClick={(e) => e.stopPropagation()}>
                                  <FeatureSwitch
                                    size="small"
                                    checked={isEnabled}
                                    onChange={() => {
                                      handleEnvToggle(
                                        env.environmentId,
                                        isEnabled
                                      );
                                    }}
                                    disabled={!canManage || flag.isArchived}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      (e.currentTarget as any).blur();
                                    }}
                                    color={env.color}
                                  />
                                </Box>
                              </Tooltip>

                              {/* Environment info */}
                              <Box sx={{ flex: 1 }}>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  {t('common.environment')}
                                </Typography>
                                <Box
                                  sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1,
                                  }}
                                >
                                  <Typography
                                    variant="subtitle1"
                                    fontWeight={600}
                                  >
                                    {env.displayName}
                                  </Typography>
                                  {flagDraftStatus.draftEnvIds?.has(
                                    env.environmentId
                                  ) && (
                                    <Tooltip
                                      title={t('changeRequest.pendingChanges')}
                                      arrow
                                    >
                                      <ScheduleIcon
                                        sx={{
                                          fontSize: 14,
                                          color: 'warning.main',
                                          animation: 'pulse 2s infinite',
                                          '@keyframes pulse': {
                                            '0%, 100%': { opacity: 1 },
                                            '50%': { opacity: 0.4 },
                                          },
                                        }}
                                      />
                                    </Tooltip>
                                  )}
                                  {releaseFlowEnvs.has(env.environmentId) ? (
                                    <Typography
                                      variant="caption"
                                      sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 0.5,
                                        px: 1,
                                        py: 0.25,
                                        bgcolor: 'action.hover',
                                        borderRadius: '4px',
                                        color: 'text.secondary',
                                        mt: 0.5,
                                        width: 'fit-content',
                                        fontSize: '0.75rem',
                                      }}
                                    >
                                      <ReleaseFlowActiveIcon
                                        sx={{ fontSize: 13 }}
                                      />
                                      {activeMilestoneByEnv[env.environmentId]
                                        ? `${t('releaseFlow.tabTitle')}: ${activeMilestoneByEnv[env.environmentId]}`
                                        : t('releaseFlow.tabTitle')}
                                    </Typography>
                                  ) : (
                                    strategiesCount > 0 && (
                                      <Typography
                                        variant="caption"
                                        sx={{
                                          px: 1,
                                          py: 0.25,
                                          bgcolor: 'action.hover',
                                          borderRadius: '4px',
                                          color: 'text.secondary',
                                        }}
                                      >
                                        {t('featureFlags.strategiesCount', {
                                          count: strategiesCount,
                                        })}
                                      </Typography>
                                    )
                                  )}
                                </Box>
                              </Box>

                              {/* Metrics mini pie chart */}
                              {(() => {
                                const metrics = envMetrics[env.environmentId];
                                // Only show chart if we have actual metrics data
                                if (metrics && metrics.total > 0) {
                                  const yesPercent = Math.round(
                                    (metrics.totalYes / metrics.total) * 100
                                  );
                                  const noPercent = 100 - yesPercent;

                                  // SVG-based mini pie chart - filled style
                                  const radius = 24;
                                  const cx = 26;
                                  const cy = 26;

                                  // Calculate arc path for pie chart
                                  const getArcPath = (
                                    startAngle: number,
                                    endAngle: number,
                                    r: number
                                  ) => {
                                    const startRad =
                                      ((startAngle - 90) * Math.PI) / 180;
                                    const endRad =
                                      ((endAngle - 90) * Math.PI) / 180;
                                    const x1 = cx + r * Math.cos(startRad);
                                    const y1 = cy + r * Math.sin(startRad);
                                    const x2 = cx + r * Math.cos(endRad);
                                    const y2 = cy + r * Math.sin(endRad);
                                    const largeArc =
                                      endAngle - startAngle > 180 ? 1 : 0;
                                    return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
                                  };

                                  const yesAngle = (yesPercent / 100) * 360;

                                  return (
                                    <Tooltip
                                      title={`${t('featureFlags.metrics.exposedTrue')}: ${metrics.totalYes} (${yesPercent}%) / ${t('featureFlags.metrics.exposedFalse')}: ${metrics.totalNo} (${noPercent}%)`}
                                      arrow
                                    >
                                      <Box
                                        sx={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: 1,
                                          mr: 1,
                                        }}
                                      >
                                        <svg
                                          width="52"
                                          height="52"
                                          viewBox="0 0 52 52"
                                        >
                                          {/* No (red) - full circle background */}
                                          <circle
                                            cx={cx}
                                            cy={cy}
                                            r={radius}
                                            fill="#ef5350"
                                          />
                                          {/* Yes (green) - pie slice */}
                                          {yesPercent > 0 &&
                                            yesPercent < 100 && (
                                              <path
                                                d={getArcPath(
                                                  0,
                                                  yesAngle,
                                                  radius
                                                )}
                                                fill="#4caf50"
                                              />
                                            )}
                                          {yesPercent >= 100 && (
                                            <circle
                                              cx={cx}
                                              cy={cy}
                                              r={radius}
                                              fill="#4caf50"
                                            />
                                          )}
                                          {/* Center text */}
                                          <text
                                            x={cx}
                                            y={cy}
                                            textAnchor="middle"
                                            dominantBaseline="central"
                                            fontSize="14"
                                            fontWeight="bold"
                                            fontFamily="system-ui, -apple-system, sans-serif"
                                            fill="white"
                                            style={{
                                              textShadow:
                                                '0 1px 2px rgba(0,0,0,0.8)',
                                            }}
                                          >
                                            {yesPercent}%
                                          </text>
                                        </svg>
                                      </Box>
                                    </Tooltip>
                                  );
                                }
                                return (
                                  <Tooltip
                                    title={t('featureFlags.noMetricsYetHint')}
                                    arrow
                                  >
                                    <Box
                                      sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        mr: 1,
                                      }}
                                    >
                                      <svg
                                        width="52"
                                        height="52"
                                        viewBox="0 0 52 52"
                                      >
                                        {/* Donut ring for no metrics */}
                                        <circle
                                          cx={26}
                                          cy={26}
                                          r={20}
                                          fill="none"
                                          stroke={
                                            theme.palette.mode === 'dark'
                                              ? 'rgba(255,255,255,0.08)'
                                              : 'rgba(0,0,0,0.06)'
                                          }
                                          strokeWidth={6}
                                        />
                                      </svg>
                                    </Box>
                                  </Tooltip>
                                );
                              })()}
                            </AccordionSummary>

                            <AccordionDetails sx={{ px: 2, pt: 0, pb: 2 }}>
                              {releaseFlowEnvs.has(env.environmentId) ? (
                                <>
                                  <ReleaseFlowTab
                                    flagId={flag.id}
                                    flagName={flag.flagName}
                                    environments={[
                                      {
                                        environmentId: env.environmentId,
                                        displayName: env.displayName,
                                      },
                                    ]}
                                    canManage={canManage}
                                    envEnabled={isEnabled}
                                    allSegments={segments}
                                    contextFields={contextFields}
                                    onPlanChange={() => {
                                      mutateReleaseFlowPlans();
                                      // Refresh strategies (release flow changes them)
                                      loadFlag();
                                      setRefreshCounter((c) => c + 1);
                                    }}
                                    onPlanDeleted={() => {
                                      mutateReleaseFlowPlans();
                                      const nextManual = new Set(
                                        envManualReleaseFlow
                                      );
                                      nextManual.delete(env.environmentId);
                                      setEnvManualReleaseFlow(nextManual);
                                    }}
                                  />

                                  <Divider sx={{ my: 2 }} />

                                  <EnvironmentVariantsEditor
                                    environmentId={env.environmentId}
                                    variants={
                                      (envVariants[env.environmentId] ||
                                        []) as EditorVariant[]
                                    }
                                    valueType={flag.valueType || 'boolean'}
                                    flagType={flag.flagType || 'release'}
                                    enabledValue={flag.enabledValue}
                                    disabledValue={flag.disabledValue}
                                    envEnabledValue={
                                      flag.environments?.find(
                                        (e) =>
                                          e.environmentId === env.environmentId
                                      )?.enabledValue
                                    }
                                    envDisabledValue={
                                      flag.environments?.find(
                                        (e) =>
                                          e.environmentId === env.environmentId
                                      )?.disabledValue
                                    }
                                    overrideEnabledValue={
                                      flag.environments?.find(
                                        (e) =>
                                          e.environmentId === env.environmentId
                                      )?.overrideEnabledValue ?? false
                                    }
                                    overrideDisabledValue={
                                      flag.environments?.find(
                                        (e) =>
                                          e.environmentId === env.environmentId
                                      )?.overrideDisabledValue ?? false
                                    }
                                    canManage={canManage}
                                    isArchived={flag.isArchived}
                                    useFixedWeightVariants={
                                      flag.useFixedWeightVariants
                                    }
                                    onUseFixedWeightVariantsChange={
                                      handleUseFixedWeightVariantsChange
                                    }
                                    onSave={(variants) =>
                                      handleSaveEnvVariants(
                                        env.environmentId,
                                        variants
                                      )
                                    }
                                    onSaveValues={(
                                      enabledValue,
                                      disabledValue,
                                      overrideEnabled,
                                      overrideDisabled
                                    ) =>
                                      handleSaveEnvFallbackValue(
                                        env.environmentId,
                                        enabledValue,
                                        disabledValue,
                                        overrideEnabled,
                                        overrideDisabled
                                      )
                                    }
                                    onChangeDetected={() =>
                                      setFlagDraftStatus({ hasDraft: true })
                                    }
                                    onGoToPayloadTab={() => setTabValue(1)}
                                    defaultExpanded={true}
                                  />
                                </>
                              ) : strategies.length === 0 ? (
                                <>
                                  <EmptyPlaceholder
                                    message={t(
                                      'featureFlags.noStrategiesTitle'
                                    )}
                                    description={t(
                                      'featureFlags.noStrategiesDescription'
                                    )}
                                  >
                                    {canManage && (
                                      <Box
                                        sx={{
                                          display: 'flex',
                                          justifyContent: 'center',
                                          gap: 2,
                                          mt: 1.5,
                                        }}
                                      >
                                        <Button
                                          variant="contained"
                                          size="small"
                                          startIcon={<AddIcon />}
                                          onClick={() =>
                                            handleAddStrategy(env.environmentId)
                                          }
                                        >
                                          {t('featureFlags.addFirstStrategy')}
                                        </Button>
                                        <Button
                                          variant="contained"
                                          size="small"
                                          startIcon={
                                            <ReleaseFlowActiveIcon
                                              sx={{ fontSize: 18 }}
                                            />
                                          }
                                          onClick={() => {
                                            setEnvManualReleaseFlow((prev) =>
                                              new Set(prev).add(
                                                env.environmentId
                                              )
                                            );
                                          }}
                                        >
                                          {t('releaseFlow.tabTitle')}
                                        </Button>
                                      </Box>
                                    )}
                                  </EmptyPlaceholder>

                                  {envManualReleaseFlow.has(
                                    env.environmentId
                                  ) && (
                                    <ReleaseFlowTab
                                      flagId={flag.id}
                                      flagName={flag.flagName}
                                      environments={[
                                        {
                                          environmentId: env.environmentId,
                                          displayName: env.displayName,
                                        },
                                      ]}
                                      canManage={canManage}
                                      initialShowTemplates={true}
                                      envEnabled={isEnabled}
                                      allSegments={segments}
                                      contextFields={contextFields}
                                      onPlanChange={() => {
                                        mutateReleaseFlowPlans();
                                        // Refresh strategies (release flow changes them)
                                        loadFlag();
                                        setRefreshCounter((c) => c + 1);
                                      }}
                                      onPlanDeleted={() => {
                                        const nextManual = new Set(
                                          envManualReleaseFlow
                                        );
                                        nextManual.delete(env.environmentId);
                                        setEnvManualReleaseFlow(nextManual);
                                      }}
                                    />
                                  )}

                                  <Divider sx={{ my: 2 }} />

                                  <EnvironmentVariantsEditor
                                    environmentId={env.environmentId}
                                    variants={
                                      (envVariants[env.environmentId] ||
                                        []) as EditorVariant[]
                                    }
                                    valueType={flag.valueType || 'boolean'}
                                    flagType={flag.flagType || 'release'}
                                    enabledValue={flag.enabledValue}
                                    disabledValue={flag.disabledValue}
                                    envEnabledValue={
                                      flag.environments?.find(
                                        (e) =>
                                          e.environmentId === env.environmentId
                                      )?.enabledValue
                                    }
                                    envDisabledValue={
                                      flag.environments?.find(
                                        (e) =>
                                          e.environmentId === env.environmentId
                                      )?.disabledValue
                                    }
                                    overrideEnabledValue={
                                      flag.environments?.find(
                                        (e) =>
                                          e.environmentId === env.environmentId
                                      )?.overrideEnabledValue ?? false
                                    }
                                    overrideDisabledValue={
                                      flag.environments?.find(
                                        (e) =>
                                          e.environmentId === env.environmentId
                                      )?.overrideDisabledValue ?? false
                                    }
                                    canManage={canManage}
                                    isArchived={flag.isArchived}
                                    useFixedWeightVariants={
                                      flag.useFixedWeightVariants
                                    }
                                    onUseFixedWeightVariantsChange={
                                      handleUseFixedWeightVariantsChange
                                    }
                                    onSave={(variants) =>
                                      handleSaveEnvVariants(
                                        env.environmentId,
                                        variants
                                      )
                                    }
                                    onSaveValues={(
                                      enabledValue,
                                      disabledValue,
                                      overrideEnabled,
                                      overrideDisabled
                                    ) =>
                                      handleSaveEnvFallbackValue(
                                        env.environmentId,
                                        enabledValue,
                                        disabledValue,
                                        overrideEnabled,
                                        overrideDisabled
                                      )
                                    }
                                    onChangeDetected={() =>
                                      setFlagDraftStatus({ hasDraft: true })
                                    }
                                    onGoToPayloadTab={() => setTabValue(1)}
                                    defaultExpanded={true}
                                  />
                                </>
                              ) : (
                                <>
                                  <DndContext
                                    sensors={sensors}
                                    collisionDetection={closestCenter}
                                    onDragEnd={(event: DragEndEvent) => {
                                      const { active, over } = event;
                                      if (over && active.id !== over.id) {
                                        const oldIndex = strategies.findIndex(
                                          (s) => s.id === active.id
                                        );
                                        const newIndex = strategies.findIndex(
                                          (s) => s.id === over.id
                                        );
                                        handleReorderStrategies(
                                          env.environmentId,
                                          oldIndex,
                                          newIndex
                                        );
                                      }
                                    }}
                                  >
                                    <SortableContext
                                      items={strategies.map((s) => s.id)}
                                      strategy={verticalListSortingStrategy}
                                    >
                                      <Stack spacing={2}>
                                        {strategies.map((strategy, index) => (
                                          <React.Fragment
                                            key={strategy.id || index}
                                          >
                                            {/* OR divider */}
                                            {index > 0 && (
                                              <Box
                                                sx={{
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  gap: 1,
                                                }}
                                              >
                                                <Divider sx={{ flexGrow: 1 }} />
                                                <Chip
                                                  label="OR"
                                                  size="small"
                                                  variant="outlined"
                                                  color="secondary"
                                                  sx={{
                                                    fontWeight: 600,
                                                    fontSize: '0.7rem',
                                                  }}
                                                />
                                                <Divider sx={{ flexGrow: 1 }} />
                                              </Box>
                                            )}

                                            {/* Strategy card wrapped with sortable */}
                                            <SortableStrategyItem
                                              id={strategy.id}
                                              isDraggable={
                                                strategies.length > 1
                                              }
                                            >
                                              {({ dragHandleProps }) => (
                                                <StrategyCardReadonly
                                                  strategy={{
                                                    strategyName: strategy.name,
                                                    title: strategy.title,
                                                    parameters:
                                                      strategy.parameters,
                                                    constraints:
                                                      strategy.constraints,
                                                    segments: strategy.segments,
                                                    disabled: strategy.disabled,
                                                  }}
                                                  allSegments={segments}
                                                  contextFields={contextFields}
                                                  headerPrefix={
                                                    dragHandleProps ? (
                                                      <Box
                                                        {...dragHandleProps}
                                                        sx={{
                                                          color:
                                                            'text.disabled',
                                                          cursor: 'grab',
                                                          display: 'flex',
                                                          alignItems: 'center',
                                                          '&:active': {
                                                            cursor: 'grabbing',
                                                          },
                                                        }}
                                                      >
                                                        <DragIcon fontSize="small" />
                                                      </Box>
                                                    ) : undefined
                                                  }
                                                  headerActions={
                                                    canManage ? (
                                                      <StrategyContextMenu
                                                        onEdit={() =>
                                                          handleEditStrategy(
                                                            strategy,
                                                            env.environmentId
                                                          )
                                                        }
                                                        onDelete={() =>
                                                          handleOpenDeleteStrategyConfirm(
                                                            strategy.id,
                                                            index,
                                                            env.environmentId
                                                          )
                                                        }
                                                      />
                                                    ) : undefined
                                                  }
                                                  collapsible
                                                />
                                              )}
                                            </SortableStrategyItem>
                                          </React.Fragment>
                                        ))}
                                      </Stack>
                                    </SortableContext>
                                  </DndContext>

                                  {/* Add strategy button */}
                                  {canManage && (
                                    <Box
                                      sx={{
                                        display: 'flex',
                                        justifyContent: 'flex-end',
                                        gap: 1,
                                        mt: 2,
                                      }}
                                    >
                                      <Button
                                        variant="contained"
                                        startIcon={<AddIcon />}
                                        onClick={() =>
                                          handleAddStrategy(env.environmentId)
                                        }
                                        size="small"
                                      >
                                        {t('featureFlags.addStrategy')}
                                      </Button>
                                    </Box>
                                  )}

                                  {/* Divider between strategies and variants */}
                                  <Divider sx={{ my: 2 }} />

                                  {/* Environment-specific Variants Editor */}
                                  <EnvironmentVariantsEditor
                                    environmentId={env.environmentId}
                                    variants={
                                      (envVariants[env.environmentId] ||
                                        []) as EditorVariant[]
                                    }
                                    valueType={flag.valueType || 'boolean'}
                                    flagType={flag.flagType || 'release'}
                                    enabledValue={flag.enabledValue}
                                    disabledValue={flag.disabledValue}
                                    envEnabledValue={
                                      flag.environments?.find(
                                        (e) =>
                                          e.environmentId === env.environmentId
                                      )?.enabledValue
                                    }
                                    envDisabledValue={
                                      flag.environments?.find(
                                        (e) =>
                                          e.environmentId === env.environmentId
                                      )?.disabledValue
                                    }
                                    overrideEnabledValue={
                                      flag.environments?.find(
                                        (e) =>
                                          e.environmentId === env.environmentId
                                      )?.overrideEnabledValue ?? false
                                    }
                                    overrideDisabledValue={
                                      flag.environments?.find(
                                        (e) =>
                                          e.environmentId === env.environmentId
                                      )?.overrideDisabledValue ?? false
                                    }
                                    canManage={canManage}
                                    isArchived={flag.isArchived}
                                    useFixedWeightVariants={
                                      flag.useFixedWeightVariants
                                    }
                                    onUseFixedWeightVariantsChange={
                                      handleUseFixedWeightVariantsChange
                                    }
                                    onSave={(variants) =>
                                      handleSaveEnvVariants(
                                        env.environmentId,
                                        variants
                                      )
                                    }
                                    onSaveValues={(
                                      enabledValue,
                                      disabledValue,
                                      overrideEnabled,
                                      overrideDisabled
                                    ) =>
                                      handleSaveEnvFallbackValue(
                                        env.environmentId,
                                        enabledValue,
                                        disabledValue,
                                        overrideEnabled,
                                        overrideDisabled
                                      )
                                    }
                                    onChangeDetected={() => {
                                      if (env.requiresApproval) {
                                        setFlagDraftStatus((prev) => ({
                                          hasDraft: true,
                                          draftEnvIds: new Set([
                                            ...(prev.draftEnvIds || []),
                                            env.environmentId,
                                          ]),
                                        }));
                                      }
                                    }}
                                    onGoToPayloadTab={() => setTabValue(1)}
                                    defaultExpanded={true}
                                  />
                                </>
                              )}
                            </AccordionDetails>
                          </Accordion>
                        </Box>
                      </Box>
                    </React.Fragment>
                  );
                })}
              </Stack>
            </PageContentLoader>
          </Box>

          {/* Right Playground Panel - inline embedded playground */}
          {!isCreating && embeddedPlaygroundVisible && (
            <Box
              ref={playgroundPanelRef}
              sx={{
                width: playgroundPanelWidth,
                flexShrink: 0,
                position: 'relative',
                ml: 1,
              }}
            >
              {/* Resize Handle */}
              <Box
                ref={resizeHandleRef}
                onMouseDown={handlePlaygroundResizeStart}
                sx={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: 6,
                  cursor: 'col-resize',
                  bgcolor: 'transparent',
                  transition: 'background-color 0.2s',
                  '&:hover': {
                    bgcolor: 'action.hover',
                  },
                  zIndex: 10,
                }}
              />
              <Box
                sx={{
                  borderLeft: 1,
                  borderColor: 'divider',
                  pl: 1.5,
                  height: '100%',
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      mb: 1,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <JoystickIcon color="primary" fontSize="small" />
                      <Typography variant="subtitle1" fontWeight={600}>
                        {t('playground.title')}
                      </Typography>
                    </Box>
                    <IconButton
                      size="small"
                      onClick={() => setEmbeddedPlaygroundVisible(false)}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mb: 2 }}
                  >
                    {t('playground.subtitle')}
                  </Typography>
                  <Box sx={{ flex: 1, overflow: 'auto' }}>
                    <PlaygroundDialog
                      open={true}
                      onClose={() => setEmbeddedPlaygroundVisible(false)}
                      initialFlags={[flag.flagName]}
                      embedded={true}
                      initialFlagDetails={flag}
                    />
                  </Box>
                </Box>
              </Box>
            </Box>
          )}
        </Box>
      </TabPanel>

      {/* Flag Values Tab */}
      <TabPanel value={tabValue} index={1}>
        <PageContentLoader loading={false}>
          <Box>
            <Paper
              variant="outlined"
              sx={{
                p: 3,
                borderRadius: 2,
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              }}
            >
              <Typography variant="h6" gutterBottom>
                {t('featureFlags.valueSettings')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                {t('featureFlags.valueSettingsDescription')}
              </Typography>

              <Stack spacing={3}>
                {/* Value Type Display (read-only) */}
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
                    {t('featureFlags.valueType')}
                    <Tooltip title={t('featureFlags.valueTypeHelp')}>
                      <HelpOutlineIcon fontSize="small" color="action" />
                    </Tooltip>
                  </Typography>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      p: 1.5,
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: 1,
                      bgcolor: 'action.hover',
                    }}
                  >
                    <FieldTypeIcon
                      type={flag.valueType || 'boolean'}
                      size={18}
                    />
                    <Typography variant="body2" fontWeight={500}>
                      {t(
                        `featureFlags.valueTypes.${flag.valueType || 'boolean'}`
                      )}
                    </Typography>
                  </Box>
                </Box>

                {/* Validation Rules - component has internal toggle, returns null for boolean */}
                <ValidationRulesEditor
                  valueType={flag.valueType || 'boolean'}
                  rules={flag.validationRules}
                  onChange={(rules) =>
                    setFlag((prev) =>
                      prev ? { ...prev, validationRules: rules } : prev
                    )
                  }
                  disabled={saving || !canManage}
                />

                {/* Flag Values */}
                <Stack spacing={2}>
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 1,
                      border: '1px solid',
                      borderColor: 'divider',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                    }}
                  >
                    <Typography
                      variant="subtitle2"
                      sx={{
                        fontWeight: 600,
                        flexShrink: 0,
                        whiteSpace: 'nowrap',
                        minWidth: 120,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                      }}
                    >
                      {t('featureFlags.enabledValue')}
                      <Tooltip title={t('featureFlags.enabledValueHelp')}>
                        <HelpOutlineIcon fontSize="small" color="action" />
                      </Tooltip>
                    </Typography>
                    <Box sx={{ flex: 1 }}>
                      {renderValueInput('enabledValue')}
                    </Box>
                  </Box>

                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 1,
                      border: '1px solid',
                      borderColor: 'divider',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                    }}
                  >
                    <Typography
                      variant="subtitle2"
                      sx={{
                        fontWeight: 600,
                        flexShrink: 0,
                        whiteSpace: 'nowrap',
                        minWidth: 120,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                      }}
                    >
                      {t('featureFlags.disabledValue')}
                      <Tooltip title={t('featureFlags.disabledValueHelp')}>
                        <HelpOutlineIcon fontSize="small" color="action" />
                      </Tooltip>
                    </Typography>
                    <Box sx={{ flex: 1 }}>
                      {renderValueInput('disabledValue')}
                    </Box>
                  </Box>
                </Stack>

                {/* Action Buttons - only show for users with edit permission */}
                {canManage && (
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'flex-end',
                      gap: 1,
                      pt: 2,
                    }}
                  >
                    <Button
                      variant="outlined"
                      onClick={() => {
                        if (originalFlag) {
                          setFlag((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  enabledValue: originalFlag.enabledValue,
                                  disabledValue: originalFlag.disabledValue,
                                  validationRules: originalFlag.validationRules,
                                }
                              : prev
                          );
                        }
                      }}
                      disabled={
                        saving ||
                        (JSON.stringify(flag.enabledValue) ===
                          JSON.stringify(originalFlag?.enabledValue) &&
                          JSON.stringify(flag.disabledValue) ===
                            JSON.stringify(originalFlag?.disabledValue) &&
                          JSON.stringify(flag.validationRules) ===
                            JSON.stringify(originalFlag?.validationRules))
                      }
                    >
                      {t('common.cancel')}
                    </Button>
                    <Button
                      variant="contained"
                      onClick={async () => {
                        if (!flag) return;
                        try {
                          setSaving(true);
                          // Only include changed values in draft
                          const updates: Record<string, any> = {};
                          if (
                            JSON.stringify(flag.enabledValue) !==
                            JSON.stringify(originalFlag?.enabledValue)
                          ) {
                            updates.enabledValue = flag.enabledValue;
                          }
                          if (
                            JSON.stringify(flag.disabledValue) !==
                            JSON.stringify(originalFlag?.disabledValue)
                          ) {
                            updates.disabledValue = flag.disabledValue;
                          }
                          if (
                            JSON.stringify(flag.validationRules) !==
                            JSON.stringify(originalFlag?.validationRules)
                          ) {
                            updates.validationRules =
                              flag.validationRules ?? null;
                          }
                          await saveGlobalChangesToDraft(updates);
                          // Sync originalFlag so the update button becomes disabled
                          setOriginalFlag((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  enabledValue: flag.enabledValue,
                                  disabledValue: flag.disabledValue,
                                  validationRules: flag.validationRules,
                                }
                              : prev
                          );
                        } catch (error: any) {
                          enqueueSnackbar(
                            parseApiErrorMessage(error, 'common.saveFailed'),
                            {
                              variant: 'error',
                            }
                          );
                        } finally {
                          setSaving(false);
                        }
                      }}
                      disabled={
                        saving ||
                        !!valueJsonErrors.enabledValue ||
                        !!valueJsonErrors.disabledValue ||
                        // Disable if nothing changed
                        (JSON.stringify(flag.enabledValue) ===
                          JSON.stringify(originalFlag?.enabledValue) &&
                          JSON.stringify(flag.disabledValue) ===
                            JSON.stringify(originalFlag?.disabledValue) &&
                          JSON.stringify(flag.validationRules) ===
                            JSON.stringify(originalFlag?.validationRules))
                      }
                    >
                      {saving ? (
                        <CircularProgress size={20} />
                      ) : (
                        t('common.update')
                      )}
                    </Button>
                  </Box>
                )}
              </Stack>
            </Paper>
          </Box>
        </PageContentLoader>
      </TabPanel>

      {/* Metrics Tab */}
      <TabPanel value={tabValue} index={2}>
        <PageContentLoader loading={false}>
          <FeatureFlagMetrics
            flagName={flag.flagName}
            environments={(flag.environments || []).map((e) => ({
              environmentId: e.environmentId,
              isEnabled: e.isEnabled,
            }))}
            currentEnvironment={
              flag.environments?.[0]?.environmentId || 'production'
            }
          />
        </PageContentLoader>
      </TabPanel>
      <TabPanel value={tabValue} index={3}>
        <PageContentLoader loading={false}>
          <FeatureFlagCodeReferences
            flagName={flag.flagName}
            onLoad={(count) => setCodeReferenceCount(count)}
          />
        </PageContentLoader>
      </TabPanel>
      <TabPanel value={tabValue} index={4}>
        <PageContentLoader loading={false}>
          <FeatureFlagAuditLogs flagName={flag.flagName} flagId={flag.id} />
        </PageContentLoader>
      </TabPanel>

      {/* Delete Confirmation Dialog */}
      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        title={t('featureFlags.deleteConfirmTitle')}
        message={t('featureFlags.deleteConfirmMessage', {
          name: flag.flagName,
        })}
        onConfirm={handleDelete}
        onClose={() => setDeleteDialogOpen(false)}
        confirmButtonText={t('common.delete')}
      />

      {/* Strategy Delete Confirmation Dialog */}
      <Dialog
        open={strategyDeleteConfirm.open}
        onClose={handleCloseDeleteStrategyConfirm}
      >
        <DialogTitle>{t('featureFlags.deleteStrategyTitle')}</DialogTitle>
        <DialogContent>
          <Typography>{t('featureFlags.deleteStrategyDescription')}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteStrategyConfirm}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleConfirmDeleteStrategy}
            color="error"
            variant="contained"
            disabled={saving}
          >
            {t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Flag Settings Drawer */}
      <ResizableDrawer
        open={editFlagDialogOpen}
        onClose={() => setEditFlagDialogOpen(false)}
        title={t('featureFlags.editFlagSettings')}
        subtitle={t('featureFlags.editFlagSettingsSubtitle')}
        storageKey="featureFlagEditDrawerWidth"
        defaultWidth={500}
      >
        {editingFlagData && (
          <>
            <Box sx={{ p: 3, flex: 1, overflow: 'auto' }}>
              <Stack spacing={2.5}>
                {/* Flag Name + Display Name on same row */}
                <Box
                  sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}
                >
                  <TextField
                    sx={{ flex: 1 }}
                    label={t('featureFlags.flagName')}
                    value={flag?.flagName || ''}
                    InputProps={{ readOnly: true }}
                    helperText={t('featureFlags.flagNameHelp')}
                    slotProps={{
                      input: {
                        sx: {
                          color: 'text.secondary',
                          cursor: 'default',
                        },
                      },
                    }}
                  />
                  <TextField
                    sx={{ flex: 1 }}
                    label={t('featureFlags.displayName')}
                    value={editingFlagData.displayName}
                    onChange={(e) =>
                      setEditingFlagData({
                        ...editingFlagData,
                        displayName: e.target.value,
                      })
                    }
                    helperText={t('featureFlags.displayNameHelp')}
                  />
                </Box>

                {/* Expandable Description + Tags buttons */}
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {!editingFlagData.description && (
                    <Button
                      size="small"
                      onClick={() =>
                        setEditingFlagData({
                          ...editingFlagData,
                          description: ' ',
                        })
                      }
                      sx={{
                        textTransform: 'none',
                        color: 'text.secondary',
                        fontSize: '0.8rem',
                      }}
                    >
                      {t('common.addDescription')}
                    </Button>
                  )}
                  {!editingFlagData.tags?.length && (
                    <Button
                      size="small"
                      onClick={() =>
                        setEditingFlagData({
                          ...editingFlagData,
                          tags: [],
                          _showTags: true,
                        } as any)
                      }
                      sx={{
                        textTransform: 'none',
                        color: 'text.secondary',
                        fontSize: '0.8rem',
                      }}
                    >
                      + {t('common.addTag')}
                    </Button>
                  )}
                </Box>

                {/* Collapsible Description */}
                {!!editingFlagData.description && (
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label={t('featureFlags.description')}
                    value={
                      editingFlagData.description.trim() === ''
                        ? ''
                        : editingFlagData.description
                    }
                    onChange={(e) =>
                      setEditingFlagData({
                        ...editingFlagData,
                        description: e.target.value || ' ',
                      })
                    }
                    helperText={t('featureFlags.descriptionHelp')}
                  />
                )}

                {/* Collapsible Tags */}
                {(!!editingFlagData.tags?.length ||
                  (editingFlagData as any)._showTags) && (
                  <TagSelector
                    value={editTagSelection}
                    onChange={(tags) => {
                      setEditTagSelection(tags);
                      setEditingFlagData({
                        ...editingFlagData,
                        tags: tags.map((t) => t.name),
                      });
                    }}
                  />
                )}

                <Box>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={editingFlagData.impressionDataEnabled}
                        onChange={(e) =>
                          setEditingFlagData({
                            ...editingFlagData,
                            impressionDataEnabled: e.target.checked,
                          })
                        }
                      />
                    }
                    label={t('featureFlags.impressionData')}
                  />
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', ml: 6 }}
                  >
                    {t('featureFlags.impressionDataHelp')}
                  </Typography>
                </Box>
              </Stack>
            </Box>
            <Box
              sx={{
                p: 2,
                borderTop: 1,
                borderColor: 'divider',
                display: 'flex',
                gap: 1,
                justifyContent: 'flex-end',
              }}
            >
              <Button onClick={() => setEditFlagDialogOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="contained"
                onClick={async () => {
                  if (!flag || !editingFlagData) return;
                  try {
                    setSaving(true);
                    // Save metadata (displayName, description, tags) directly
                    await api.put(
                      `${projectApiPath}/features/${flag.flagName}`,
                      {
                        displayName: editingFlagData.displayName,
                        description: editingFlagData.description,
                        tags: editingFlagData.tags,
                      }
                    );
                    // impressionDataEnabled affects SDK → save to draft
                    if (
                      editingFlagData.impressionDataEnabled !==
                      flag.impressionDataEnabled
                    ) {
                      await saveGlobalChangesToDraft({
                        impressionDataEnabled:
                          editingFlagData.impressionDataEnabled,
                      });
                    }
                    setFlag({
                      ...flag,
                      displayName: editingFlagData.displayName,
                      description: editingFlagData.description,
                      impressionDataEnabled:
                        editingFlagData.impressionDataEnabled,
                      tags: editingFlagData.tags,
                    });
                    setEditFlagDialogOpen(false);
                    enqueueSnackbar(t('common.saveSuccess'), {
                      variant: 'success',
                    });
                  } catch (error: any) {
                    enqueueSnackbar(error.message || t('common.saveFailed'), {
                      variant: 'error',
                    });
                  } finally {
                    setSaving(false);
                  }
                }}
                disabled={
                  saving ||
                  (editingFlagData?.displayName === (flag?.displayName || '') &&
                    editingFlagData?.description ===
                      (flag?.description || '') &&
                    editingFlagData?.impressionDataEnabled ===
                      flag?.impressionDataEnabled &&
                    JSON.stringify(editingFlagData?.tags || []) ===
                      JSON.stringify(flag?.tags || []))
                }
              >
                {saving ? <CircularProgress size={20} /> : t('common.update')}
              </Button>
            </Box>
          </>
        )}
      </ResizableDrawer>

      {/* Strategy Edit Drawer */}
      <StrategyEditDrawer
        open={strategyDialogOpen}
        onClose={() => {
          setStrategyDialogOpen(false);
          setExpandedSegmentsDialog(new Set());
        }}
        strategy={editingStrategy}
        originalStrategy={originalEditingStrategy}
        onStrategyChange={setEditingStrategy}
        onSave={handleSaveStrategy}
        isAdding={isAddingStrategy}
        saving={saving}
        flagName={flag?.flagName}
        contextFields={contextFields}
        segments={segments}
        strategyJsonErrors={strategyJsonErrors}
      />
      {/* Variant Edit Drawer */}
      <ResizableDrawer
        open={variantDialogOpen}
        onClose={() => setVariantDialogOpen(false)}
        title={t('featureFlags.editVariant')}
        storageKey="featureFlagVariantDrawerWidth"
        defaultWidth={500}
      >
        <Box sx={{ p: 3, flex: 1, overflow: 'auto' }}>
          {editingVariant && (
            <Stack spacing={3}>
              <TextField
                fullWidth
                required
                label={t('featureFlags.variantName')}
                value={editingVariant.name}
                onChange={(e) =>
                  setEditingVariant({ ...editingVariant, name: e.target.value })
                }
              />
              <Box>
                <Typography gutterBottom>{t('featureFlags.weight')}</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Slider
                    value={editingVariant.weight}
                    onChange={(_, value) =>
                      setEditingVariant({
                        ...editingVariant,
                        weight: value as number,
                      })
                    }
                    valueLabelDisplay="auto"
                    min={0}
                    max={100}
                    sx={{ flex: 1 }}
                  />
                  <Typography sx={{ width: 50 }}>
                    {editingVariant.weight}%
                  </Typography>
                </Box>
              </Box>
            </Stack>
          )}
        </Box>
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
          <Button onClick={() => setVariantDialogOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button variant="contained" onClick={handleSaveVariants}>
            {t('common.update')}
          </Button>
        </Box>
      </ResizableDrawer>

      {/* Link Add/Edit Dialog */}
      <Dialog
        open={linkDialogOpen}
        onClose={() => setLinkDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editingLinkIndex !== null
            ? t('featureFlags.links.editLink')
            : t('featureFlags.links.addLink')}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              size="small"
              autoFocus
              label={t('featureFlags.links.url')}
              placeholder="https://example.com"
              value={editingLink.url}
              onChange={(e) =>
                setEditingLink({ ...editingLink, url: e.target.value })
              }
              required
            />
            <TextField
              fullWidth
              size="small"
              label={t('featureFlags.links.titleLabel')}
              placeholder={t('featureFlags.links.titlePlaceholder')}
              value={editingLink.title || ''}
              onChange={(e) =>
                setEditingLink({ ...editingLink, title: e.target.value })
              }
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLinkDialogOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveLink}
            disabled={!editingLink.url}
          >
            {editingLinkIndex !== null ? t('common.update') : t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Archive/Revive Confirmation Dialog */}
      <Dialog
        open={archiveConfirmOpen}
        onClose={() => setArchiveConfirmOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          {flag?.isArchived
            ? t('featureFlags.reviveConfirmTitle')
            : t('featureFlags.archiveConfirmTitle')}
        </DialogTitle>
        <DialogContent>
          <Typography>
            {flag?.isArchived
              ? t('featureFlags.reviveConfirmMessage', { name: flag?.flagName })
              : t('featureFlags.archiveConfirmMessage', {
                  name: flag?.flagName,
                })}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setArchiveConfirmOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            color={flag?.isArchived ? 'success' : 'warning'}
            onClick={handleArchiveConfirm}
          >
            {flag?.isArchived
              ? t('featureFlags.revive')
              : t('featureFlags.archive')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Stale Confirmation Dialog */}
      <Dialog
        open={staleConfirmOpen}
        onClose={() => setStaleConfirmOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          {flag?.stale
            ? t('featureFlags.unmarkStaleConfirmTitle')
            : t('featureFlags.markStaleConfirmTitle')}
        </DialogTitle>
        <DialogContent>
          <Typography>
            {flag?.stale
              ? t('featureFlags.unmarkStaleConfirmMessage', {
                  name: flag?.flagName,
                })
              : t('featureFlags.markStaleConfirmMessage', {
                  name: flag?.flagName,
                })}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStaleConfirmOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            color={flag?.stale ? 'info' : 'secondary'}
            onClick={handleStaleConfirm}
          >
            {flag?.stale
              ? t('featureFlags.unmarkStale')
              : t('featureFlags.markStale')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Floating Playground Toggle Button - positioned on right edge, only when panel is hidden */}
      {!isCreating && flag && !embeddedPlaygroundVisible && tabValue === 0 && (
        <Tooltip title={t('playground.title')} placement="left">
          <IconButton
            onClick={() => setEmbeddedPlaygroundVisible(true)}
            sx={{
              position: 'fixed',
              right: 0,
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 1000,
              width: 40,
              height: 40,
              bgcolor: 'background.paper',
              color: 'primary.main',
              opacity: 0.7,
              boxShadow: 3,
              borderTopRightRadius: 0,
              borderBottomRightRadius: 0,
              borderTopLeftRadius: 20,
              borderBottomLeftRadius: 20,
              transition: 'all 0.3s ease',
              '&:hover': {
                opacity: 1,
                bgcolor: 'background.paper',
              },
            }}
          >
            <JoystickIcon />
          </IconButton>
        </Tooltip>
      )}

      {/* Playground Dialog */}
      <PlaygroundDialog
        open={playgroundOpen}
        onClose={() => {
          setPlaygroundOpen(false);
          setPlaygroundInitialEnvironments([]);
        }}
        initialFlags={flag?.flagName ? [flag.flagName] : []}
        initialEnvironments={playgroundInitialEnvironments}
      />
    </Box>
  );
};

export default FeatureFlagDetailPage;
