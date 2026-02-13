import React, { useState, useEffect, useMemo } from 'react';

import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { PERMISSIONS } from '../../types/permissions';
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
  Card,
  CardContent,
  Paper,
  TableSortLabel,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  Switch,
  Autocomplete,
  Stack,
  CircularProgress,
  Checkbox,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Menu,
  ListItemIcon,
  ListItemText,
  ClickAwayListener,
  Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Flag as FlagIcon,
  Refresh as RefreshIcon,
  Archive as ArchiveIcon,
  Unarchive as UnarchiveIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  Warning as WarningIcon,
  RocketLaunch as ReleaseIcon,
  Science as ExperimentIcon,
  Build as OperationalIcon,
  Security as PermissionIcon,
  PowerOff as KillSwitchIcon,
  ViewColumn as ViewColumnIcon,
  FileUpload as ImportIcon,
  FileDownload as ExportIcon,
  CheckCircle as CheckCircleIcon,
  MoreVert as MoreVertIcon,
  FileCopy as CloneIcon,
  ReportProblem as StaleIcon,
  Cancel as CancelIcon,
  Close as CloseIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  OpenInNew as OpenInNewIcon,
  BarChart as MetricsIcon,
  HelpOutline as HelpOutlineIcon,
  Block as BlockIcon,
  ExpandMore as ExpandMoreIcon,
  PlayArrow as PlaygroundIcon,
  SportsEsports as JoystickIcon,
  SwapVert as ImportExportIcon,
  Tune as RemoteConfigIcon,
  ViewList as ViewListIcon,
  GitHub as GitHubIcon,
} from '@mui/icons-material';
import FieldTypeIcon from '../../components/common/FieldTypeIcon';
import ValueEditorField from '../../components/common/ValueEditorField';
import BooleanSwitch from '../../components/common/BooleanSwitch';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { parseApiErrorMessage } from '../../utils/errorUtils';
import featureFlagService, { FeatureFlag, FlagType } from '../../services/featureFlagService';
import SimplePagination from '../../components/common/SimplePagination';
import EmptyState from '../../components/common/EmptyState';
import DynamicFilterBar, {
  FilterDefinition,
  ActiveFilter,
} from '../../components/common/DynamicFilterBar';
import ColumnSettingsDialog, { ColumnConfig } from '../../components/common/ColumnSettingsDialog';
import { useDebounce } from '../../hooks/useDebounce';
import { useGlobalPageSize } from '../../hooks/useGlobalPageSize';
import { formatDateTimeDetailed, formatRelativeTime } from '../../utils/dateFormat';
import ConfirmDeleteDialog from '../../components/common/ConfirmDeleteDialog';
import { copyToClipboardWithNotification } from '../../utils/clipboard';
import { tagService, Tag } from '../../services/tagService';
import { getContrastColor } from '../../utils/colorUtils';
import { environmentService, Environment } from '../../services/environmentService';
import ResizableDrawer from '../../components/common/ResizableDrawer';
import FeatureSwitch from '../../components/common/FeatureSwitch';
import api from '../../services/api';
import PlaygroundDialog from '../../components/features/PlaygroundDialog';
import { getFlagTypeIcon } from '../../utils/flagTypeIcons';
import FlagStatusIcon from '../../components/common/FlagStatusIcon';

interface FlagTypeInfo {
  flagType: string;
  lifetimeDays: number | null;
}

// Coerce flag value to its proper JS type based on valueType
function coerceValue(value: any, valueType: string): any {
  if (value === null || value === undefined) return value;
  switch (valueType) {
    case 'boolean':
      if (typeof value === 'boolean') return value;
      if (value === 'true') return true;
      if (value === 'false') return false;
      return Boolean(value);
    case 'number':
      if (typeof value === 'number') return value;
      return Number(value) || 0;
    case 'json':
      if (typeof value === 'object') return value;
      try {
        return JSON.parse(value);
      } catch {
        return {};
      }
    default:
      return String(value);
  }
}

// Icon helpers for filter options
const getStatusIcon = (status: string) => <FlagStatusIcon status={status} size={16} />;

// Icon helpers for valueType filter options
const getValueTypeIcon = (type: string) => {
  return <FieldTypeIcon type={type} size={16} />;
};

const getTypeIconSmall = (type: string) => getFlagTypeIcon(type, 16);

const FeatureFlagsPage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { hasPermission } = useAuth();
  const canManage = hasPermission([PERMISSIONS.FEATURE_FLAGS_MANAGE]);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Compact view state - query param overrides localStorage
  const [compactView, setCompactView] = useState<boolean>(() => {
    const queryVal = searchParams.get('compact');
    if (queryVal !== null) return queryVal === 'true' || queryVal === '1';
    return localStorage.getItem('featureFlagsCompactView') === 'true';
  });

  const handleCompactViewToggle = () => {
    const newVal = !compactView;
    setCompactView(newVal);
    localStorage.setItem('featureFlagsCompactView', String(newVal));
  };

  // State
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useGlobalPageSize();
  const [loading, setLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const [staleConfirmOpen, setStaleConfirmOpen] = useState(false);
  const [deletingFlag, setDeletingFlag] = useState<FeatureFlag | null>(null);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [flagTypes, setFlagTypes] = useState<FlagTypeInfo[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [selectedFlags, setSelectedFlags] = useState<Set<string>>(new Set());

  // Create dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createMenuAnchor, setCreateMenuAnchor] = useState<null | HTMLElement>(null);
  const [creating, setCreating] = useState(false);
  const [showCreateDescription, setShowCreateDescription] = useState(false);
  const [showCreateTags, setShowCreateTags] = useState(false);
  const [createFlagTypeMode, setCreateFlagTypeMode] = useState(false);
  const [newFlag, setNewFlag] = useState({
    flagName: '',
    displayName: '',
    description: '',
    flagType: 'release' as
      | 'release'
      | 'experiment'
      | 'operational'
      | 'killSwitch'
      | 'permission'
      | 'remoteConfig',
    tags: [] as string[],
    impressionDataEnabled: false,
    valueType: 'boolean' as 'boolean' | 'string' | 'number' | 'json',
    enabledValue: '' as any,
    disabledValue: '' as any,
  });

  // Sorting state
  const [orderBy, setOrderBy] = useState<string>(() => {
    const saved = localStorage.getItem('featureFlagsSortBy');
    return saved || 'createdAt';
  });
  const [order, setOrder] = useState<'asc' | 'desc'>(() => {
    const saved = localStorage.getItem('featureFlagsSortOrder');
    return (saved as 'asc' | 'desc') || 'desc';
  });

  // Export/Import state
  const [importExportMenuAnchor, setImportExportMenuAnchor] = useState<null | HTMLElement>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importData, setImportData] = useState<string>('');
  const [importing, setImporting] = useState(false);

  // Playground dialog state
  const [playgroundOpen, setPlaygroundOpen] = useState(false);
  const [playgroundInitialFlags, setPlaygroundInitialFlags] = useState<string[]>([]);
  const [playgroundAutoExecute, setPlaygroundAutoExecute] = useState(false);

  // Action menu state
  const [actionMenuAnchor, setActionMenuAnchor] = useState<null | HTMLElement>(null);
  const [actionMenuFlag, setActionMenuFlag] = useState<FeatureFlag | null>(null);

  // Bulk action menu state
  const [envMenuAnchor, setEnvMenuAnchor] = useState<null | HTMLElement>(null);
  const [staleMenuAnchor, setStaleMenuAnchor] = useState<null | HTMLElement>(null);

  // Clone dialog state
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [cloningFlag, setCloningFlag] = useState<FeatureFlag | null>(null);
  const [cloneNewName, setCloneNewName] = useState('');
  const [cloning, setCloning] = useState(false);
  const [newFlagJsonError, setNewFlagJsonError] = useState<string | null>(null);

  // Column settings state
  const [columnSettingsAnchor, setColumnSettingsAnchor] = useState<null | HTMLElement>(null);
  const defaultColumns: ColumnConfig[] = [
    { id: 'flagName', labelKey: 'featureFlags.flagName', visible: true },
    { id: 'status', labelKey: 'featureFlags.status', visible: true },
    { id: 'valueType', labelKey: 'featureFlags.valueType', visible: true },
    { id: 'environments', labelKey: 'featureFlags.enabledByEnv', visible: true },
    { id: 'createdBy', labelKey: 'common.createdBy', visible: true },
    { id: 'createdAt', labelKey: 'featureFlags.createdAt', visible: true },
    { id: 'lastSeenAt', labelKey: 'featureFlags.lastSeenAt', visible: true },
    { id: 'tags', labelKey: 'featureFlags.tags', visible: true },
  ];
  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    const saved = localStorage.getItem('featureFlagsColumns');
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

  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  // Extract filter values with useMemo (as string[] for multiselect)
  const flagTypeFilter = useMemo(() => {
    const filter = activeFilters.find((f) => f.key === 'flagType');
    return filter?.value as string[] | undefined;
  }, [activeFilters]);

  const statusFilter = useMemo(() => {
    const filter = activeFilters.find((f) => f.key === 'status');
    return filter?.value as string[] | undefined;
  }, [activeFilters]);

  const tagFilter = useMemo(() => {
    const filter = activeFilters.find((f) => f.key === 'tag');
    return filter?.value as string[] | undefined;
  }, [activeFilters]);

  const valueTypeFilter = useMemo(() => {
    const filter = activeFilters.find((f) => f.key === 'valueType');
    return filter?.value as string[] | undefined;
  }, [activeFilters]);

  // Filter definitions
  const availableFilterDefinitions: FilterDefinition[] = useMemo(
    () => [
      {
        key: 'status',
        label: t('featureFlags.status'),
        type: 'multiselect',
        options: [
          {
            value: 'active',
            label: t('featureFlags.statusActive'),
            icon: getStatusIcon('active'),
          },
          {
            value: 'archived',
            label: t('featureFlags.statusArchived'),
            icon: getStatusIcon('archived'),
          },
          {
            value: 'stale',
            label: t('featureFlags.statusStale'),
            icon: getStatusIcon('stale'),
          },
          {
            value: 'potentiallyStale',
            label: t('featureFlags.statusPotentiallyStale'),
            icon: getStatusIcon('potentiallyStale'),
          },
        ],
      },

      {
        key: 'flagType',
        label: t('featureFlags.flagType'),
        type: 'multiselect',
        options: [
          {
            value: 'release',
            label: t('featureFlags.types.release'),
            icon: getTypeIconSmall('release'),
          },
          {
            value: 'experiment',
            label: t('featureFlags.types.experiment'),
            icon: getTypeIconSmall('experiment'),
          },
          {
            value: 'operational',
            label: t('featureFlags.types.operational'),
            icon: getTypeIconSmall('operational'),
          },
          {
            value: 'killSwitch',
            label: t('featureFlags.types.killSwitch'),
            icon: getTypeIconSmall('killSwitch'),
          },
          {
            value: 'permission',
            label: t('featureFlags.types.permission'),
            icon: getTypeIconSmall('permission'),
          },
          {
            value: 'remoteConfig',
            label: t('featureFlags.types.remoteConfig'),
            icon: getTypeIconSmall('remoteConfig'),
          },
        ],
      },
      {
        key: 'tag',
        label: t('featureFlags.tags'),
        type: 'multiselect',
        operator: 'any_of',
        allowOperatorToggle: true,
        options: allTags.map((tag) => ({ value: tag.name, label: tag.name })),
      },
      {
        key: 'valueType',
        label: t('featureFlags.valueType'),
        type: 'multiselect',
        options: [
          {
            value: 'boolean',
            label: t('featureFlags.valueTypes.boolean'),
            icon: getValueTypeIcon('boolean'),
          },
          {
            value: 'string',
            label: t('featureFlags.valueTypes.string'),
            icon: getValueTypeIcon('string'),
          },
          {
            value: 'number',
            label: t('featureFlags.valueTypes.number'),
            icon: getValueTypeIcon('number'),
          },
          {
            value: 'json',
            label: t('featureFlags.valueTypes.json'),
            icon: getValueTypeIcon('json'),
          },
        ],
      },
    ],
    [t, allTags]
  );

  // Visible columns
  const visibleColumns = useMemo(() => columns.filter((col) => col.visible), [columns]);

  // Load flags
  const loadFlags = async () => {
    setLoading(true);
    try {
      // Determine isArchived and status based on statusFilter (multiselect)
      let isArchived: boolean | undefined = undefined;
      let status: string | undefined = undefined;

      // For multiselect, if only specific statuses are selected, apply them
      if (statusFilter && statusFilter.length > 0) {
        // If only archived is selected
        if (statusFilter.length === 1 && statusFilter[0] === 'archived') {
          isArchived = true;
        }
        // If only active is selected
        else if (statusFilter.length === 1 && statusFilter[0] === 'active') {
          isArchived = false;
        }
        // If stale or potentiallyStale is selected without archived
        else if (
          !statusFilter.includes('archived') &&
          (statusFilter.includes('stale') || statusFilter.includes('potentiallyStale'))
        ) {
          isArchived = false;
          if (statusFilter.length === 1) {
            status = statusFilter[0];
          }
        }
      }

      // For multiselect flagType, take the first value or undefined
      // TODO: Backend should support multiple flag types in the future
      const selectedFlagType =
        flagTypeFilter && flagTypeFilter.length > 0 ? (flagTypeFilter[0] as FlagType) : undefined;

      const result = await featureFlagService.getFeatureFlags({
        page: page + 1,
        limit: rowsPerPage,
        search: debouncedSearchTerm || undefined,
        flagType: selectedFlagType,
        isArchived,
        sortBy: orderBy,
        sortOrder: order,
      });

      if (
        result &&
        typeof result === 'object' &&
        'flags' in result &&
        Array.isArray(result.flags)
      ) {
        // Apply client-side filtering for multiselect values that server doesn't support
        let filteredFlags = result.flags;

        // Filter by flagType (if any selected)
        if (flagTypeFilter && flagTypeFilter.length > 0) {
          filteredFlags = filteredFlags.filter((f) => flagTypeFilter.includes(f.flagType));
        }

        // Filter by status (if any selected)
        if (statusFilter && statusFilter.length > 0) {
          filteredFlags = filteredFlags.filter((f) => {
            // Determine the flag's status
            let flagStatus: string;
            if (f.isArchived) {
              flagStatus = 'archived';
            } else if (f.stale) {
              flagStatus = 'stale';
            } else if (f.potentiallyStale) {
              flagStatus = 'potentiallyStale';
            } else {
              flagStatus = 'active';
            }
            return statusFilter.includes(flagStatus);
          });
        }

        // Filter by tag
        if (tagFilter && tagFilter.length > 0) {
          filteredFlags = filteredFlags.filter((f) =>
            tagFilter.some((tag) => f.tags?.includes(tag))
          );
        }

        // Filter by valueType
        if (valueTypeFilter && valueTypeFilter.length > 0) {
          filteredFlags = filteredFlags.filter((f) => valueTypeFilter.includes(f.valueType));
        }

        // Sort favorites first (always show favorites at top, then apply normal sort)
        filteredFlags.sort((a, b) => {
          // Favorites first
          if (a.isFavorite && !b.isFavorite) return -1;
          if (!a.isFavorite && b.isFavorite) return 1;
          return 0; // Keep original order for non-favorite sorting (already sorted by server)
        });

        setFlags(filteredFlags);
        const validTotal =
          typeof result.total === 'number' && !isNaN(result.total) ? result.total : 0;
        setTotal(validTotal);
      } else {
        console.error('Invalid response:', result);
        setFlags([]);
        setTotal(0);
      }
    } catch (error: any) {
      console.error('Failed to load feature flags:', error);
      enqueueSnackbar(parseApiErrorMessage(error, 'featureFlags.loadFailed'), {
        variant: 'error',
      });
      setFlags([]);
      setTotal(0);
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  };

  const loadTags = async () => {
    try {
      const tags = await tagService.list();
      setAllTags(tags);
    } catch {
      setAllTags([]);
    }
  };

  // Filter handlers
  const handleFilterAdd = (filter: ActiveFilter) => {
    setActiveFilters([...activeFilters, filter]);
    setPage(0);
  };

  const handleFilterRemove = (filterKey: string) => {
    setActiveFilters(activeFilters.filter((f) => f.key !== filterKey));
    setPage(0);
  };

  const handleFilterChange = (filterKey: string, value: any) => {
    const newFilters = activeFilters.map((f) => (f.key === filterKey ? { ...f, value } : f));
    setActiveFilters(newFilters);
    setPage(0);
  };

  const handleOperatorChange = (filterKey: string, operator: 'any_of' | 'include_all') => {
    const newFilters = activeFilters.map((f) => (f.key === filterKey ? { ...f, operator } : f));
    setActiveFilters(newFilters);
  };

  // Column handlers
  const handleColumnsChange = (newColumns: ColumnConfig[]) => {
    setColumns(newColumns);
    localStorage.setItem('featureFlagsColumns', JSON.stringify(newColumns));
  };

  const handleResetColumns = () => {
    setColumns(defaultColumns);
    localStorage.setItem('featureFlagsColumns', JSON.stringify(defaultColumns));
  };

  // Export/Import handlers
  const handleExport = async (environment: string) => {
    try {
      // Get list of all flags first
      const result = await featureFlagService.getFeatureFlags({
        page: 1,
        limit: 10000, // Get all flags
        isArchived: false,
      });

      if (result && result.flags && result.flags.length > 0) {
        // Fetch detailed info for each flag (includes strategies)
        const detailedFlags = await Promise.all(
          result.flags.map(async (flag) => {
            try {
              return await featureFlagService.getFeatureFlag(flag.flagName);
            } catch {
              return flag; // Fallback to basic info if detail fetch fails
            }
          })
        );

        // Collect all used segment names from strategies
        const usedSegmentNames = new Set<string>();
        detailedFlags.forEach((flag) => {
          // Strategies are on the flag level (already filtered by env from getFeatureFlag)
          (flag as any).strategies?.forEach((strategy: any) => {
            strategy.segments?.forEach((segmentName: string) => {
              usedSegmentNames.add(segmentName);
            });
          });
        });

        // Fetch all segments and filter used ones
        let segments: any[] = [];
        if (usedSegmentNames.size > 0) {
          try {
            const response = await api.get('/admin/features/segments');
            const allSegments = response.data?.segments || [];
            segments = allSegments
              .filter((seg: any) => usedSegmentNames.has(seg.segmentName))
              .map((seg: any) => ({
                segmentName: seg.segmentName,
                description: seg.description,
                constraints: seg.constraints,
              }));
          } catch {
            // Continue without segments if fetch fails
          }
        }

        const exportData = {
          exportedAt: new Date().toISOString(),
          environment,
          segments,
          flags: detailedFlags.map((flag) => {
            // Strategies/variants are already filtered by environment in getFeatureFlag
            const envData = flag.environments?.find((env: any) => env.environment === environment);

            // Clean strategies - remove unnecessary metadata
            const strategies = ((flag as any).strategies ?? []).map((s: any) => ({
              strategyName: s.strategyName,
              parameters: s.parameters,
              constraints: s.constraints,
              segments: s.segments,
              sortOrder: s.sortOrder,
              isEnabled: s.isEnabled,
            }));

            // Clean variants - remove unnecessary metadata
            const variants = ((flag as any).variants ?? []).map((v: any) => ({
              variantName: v.variantName,
              weight: v.weight,
              value: v.value ?? null,
              valueType: v.valueType,
              weightLock: Boolean(v.weightLock),
              overrides: v.overrides ?? null,
            }));

            return {
              flagName: flag.flagName,
              displayName: flag.displayName,
              description: flag.description,
              flagType: flag.flagType || 'release',
              tags: flag.tags,
              impressionDataEnabled: flag.impressionDataEnabled,
              valueType: flag.valueType || 'string',
              enabledValue: flag.enabledValue,
              disabledValue: flag.disabledValue,
              enabled: envData?.isEnabled ?? false,
              strategies,
              variants,
            };
          }),
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
          type: 'application/json',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `feature-flags-${environment}-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        enqueueSnackbar(t('featureFlags.exportSuccess', { count: detailedFlags.length }), {
          variant: 'success',
        });
      } else {
        enqueueSnackbar(t('featureFlags.exportNoFlags'), { variant: 'info' });
      }
    } catch (error: any) {
      enqueueSnackbar(parseApiErrorMessage(error, 'featureFlags.exportFailed'), {
        variant: 'error',
      });
    }
    setExportMenuAnchor(null);
  };

  const handleImport = async () => {
    if (!importData.trim()) {
      enqueueSnackbar(t('featureFlags.importNoData'), { variant: 'warning' });
      return;
    }

    setImporting(true);
    try {
      const data = JSON.parse(importData);

      if (!data.flags || !Array.isArray(data.flags)) {
        enqueueSnackbar(t('featureFlags.importInvalidFormat'), {
          variant: 'error',
        });
        setImporting(false);
        return;
      }

      // Call backend import API
      const response = await api.post('/admin/features/import', {
        segments: data.segments || [],
        flags: data.flags,
      });

      const result = response.data;
      const summary = result.summary;

      // Show result
      if (summary.flagsCreated > 0 || summary.segmentsCreated > 0) {
        let msg = '';
        if (summary.flagsCreated > 0) {
          msg += t('featureFlags.importFlagsCreated', {
            count: summary.flagsCreated,
          });
        }
        if (summary.segmentsCreated > 0) {
          if (msg) msg += ', ';
          msg += t('featureFlags.importSegmentsCreated', {
            count: summary.segmentsCreated,
          });
        }
        enqueueSnackbar(msg, { variant: 'success' });
        loadFlags();
      }

      if (summary.flagsSkipped > 0 || summary.segmentsSkipped > 0) {
        let msg = '';
        if (summary.flagsSkipped > 0) {
          msg += t('featureFlags.importFlagsSkipped', {
            count: summary.flagsSkipped,
          });
        }
        if (summary.segmentsSkipped > 0) {
          if (msg) msg += ', ';
          msg += t('featureFlags.importSegmentsSkipped', {
            count: summary.segmentsSkipped,
          });
        }
        enqueueSnackbar(msg, { variant: 'info' });
      }

      if (summary.errors > 0) {
        enqueueSnackbar(t('featureFlags.importPartialError', { count: summary.errors }), {
          variant: 'warning',
        });
      }

      if (summary.flagsCreated === 0 && summary.segmentsCreated === 0) {
        enqueueSnackbar(t('featureFlags.importNothingNew'), {
          variant: 'info',
        });
      }

      setImportDialogOpen(false);
      setImportData('');
    } catch (error: any) {
      if (error instanceof SyntaxError) {
        enqueueSnackbar(t('featureFlags.importInvalidJson'), {
          variant: 'error',
        });
      } else {
        enqueueSnackbar(parseApiErrorMessage(error, 'featureFlags.importFailed'), {
          variant: 'error',
        });
      }
    } finally {
      setImporting(false);
    }
  };

  const handleImportFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setImportData(content);
      };
      reader.readAsText(file);
    }
  };

  useEffect(() => {
    loadFlags();
  }, [
    page,
    rowsPerPage,
    debouncedSearchTerm,
    orderBy,
    order,
    flagTypeFilter,
    statusFilter,
    tagFilter,
    valueTypeFilter,
  ]);

  useEffect(() => {
    loadTags();
    loadFlagTypes();
    loadEnvironments();
  }, []);

  const loadEnvironments = async () => {
    try {
      const envs = await environmentService.getEnvironments();
      // Filter only visible environments and sort by displayOrder
      setEnvironments(
        envs.filter((e) => !e.isHidden).sort((a, b) => a.displayOrder - b.displayOrder)
      );
    } catch {
      setEnvironments([]);
    }
  };

  const loadFlagTypes = async () => {
    try {
      const response = await api.get('/admin/features/types');
      setFlagTypes(response.data?.types || []);
    } catch {
      setFlagTypes([]);
    }
  };

  // Check if a flag is stale based on its type's lifetime
  const isStale = (flag: FeatureFlag): boolean => {
    if (!flag.createdAt) return false;
    const typeInfo = flagTypes.find((t) => t.flagType === flag.flagType);
    if (!typeInfo || typeInfo.lifetimeDays === null) return false;
    const createdAt = new Date(flag.createdAt);
    const now = new Date();
    const daysSinceCreation = Math.floor(
      (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSinceCreation > typeInfo.lifetimeDays;
  };

  // Sort handler
  const handleSort = (colId: string) => {
    let newOrder: 'asc' | 'desc' = 'asc';
    if (orderBy === colId) {
      newOrder = order === 'asc' ? 'desc' : 'asc';
    }
    setOrderBy(colId);
    setOrder(newOrder);
    localStorage.setItem('featureFlagsSortBy', colId);
    localStorage.setItem('featureFlagsSortOrder', newOrder);
    setPage(0);
  };

  // Toggle flag for a specific environment
  const handleToggle = async (flag: FeatureFlag, environment: string, currentEnabled: boolean) => {
    const newEnabled = !currentEnabled;

    // Optimistic update - ensure environments array exists
    setFlags((prev) =>
      prev.map((f) => {
        if (f.flagName !== flag.flagName) return f;

        // If environments array doesn't exist, create it with the toggled environment
        const existingEnvs = f.environments || [];
        const envExists = existingEnvs.some((e) => e.environment === environment);

        let updatedEnvs;
        if (envExists) {
          updatedEnvs = existingEnvs.map((e) =>
            e.environment === environment ? { ...e, isEnabled: newEnabled } : e
          );
        } else {
          // Add new environment entry
          updatedEnvs = [...existingEnvs, { environment, isEnabled: newEnabled }];
        }

        return {
          ...f,
          environments: updatedEnvs,
        };
      })
    );

    try {
      await featureFlagService.toggleFeatureFlag(flag.flagName, newEnabled, environment);
      const envDisplayName =
        environments.find((e) => e.environment === environment)?.displayName || environment;
      enqueueSnackbar(
        <span>
          <strong>{flag.flagName}</strong> ({envDisplayName}){' '}
          {t(currentEnabled ? 'featureFlags.disabled' : 'featureFlags.enabled')}
        </span>,
        { variant: currentEnabled ? 'warning' : 'success' }
      );
    } catch (error: any) {
      // Rollback on error
      setFlags((prev) =>
        prev.map((f) => {
          if (f.flagName !== flag.flagName) return f;

          const existingEnvs = f.environments || [];
          const updatedEnvs = existingEnvs.map((e) =>
            e.environment === environment ? { ...e, isEnabled: currentEnabled } : e
          );

          return {
            ...f,
            environments: updatedEnvs,
          };
        })
      );
      enqueueSnackbar(parseApiErrorMessage(error, 'featureFlags.toggleFailed'), {
        variant: 'error',
      });
    }
  };

  // Get environment-specific enabled state
  const getEnvEnabled = (flag: FeatureFlag, envName: string): boolean => {
    if (flag.environments) {
      const envData = flag.environments.find((e) => e.environment === envName);
      return envData?.isEnabled ?? false;
    }
    // Fallback to legacy isEnabled
    return flag.isEnabled ?? false;
  };

  // Archive/Revive flag
  const handleArchiveToggle = async (flag: FeatureFlag) => {
    try {
      if (flag.isArchived) {
        await featureFlagService.reviveFeatureFlag(flag.flagName);
        enqueueSnackbar(t('featureFlags.reviveSuccess'), {
          variant: 'success',
        });
      } else {
        await featureFlagService.archiveFeatureFlag(flag.flagName);
        enqueueSnackbar(t('featureFlags.archiveSuccess'), {
          variant: 'success',
        });
      }
      loadFlags();
    } catch (error: any) {
      enqueueSnackbar(parseApiErrorMessage(error, 'featureFlags.archiveFailed'), {
        variant: 'error',
      });
    }
  };

  // Delete flag
  const handleDelete = (flag: FeatureFlag) => {
    setDeletingFlag(flag);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingFlag) return;
    try {
      await featureFlagService.deleteFeatureFlag(deletingFlag.flagName);
      enqueueSnackbar(t('featureFlags.deleteSuccess'), { variant: 'success' });
      loadFlags();
    } catch (error: any) {
      enqueueSnackbar(parseApiErrorMessage(error, 'featureFlags.deleteFailed'), {
        variant: 'error',
      });
    } finally {
      setDeleteConfirmOpen(false);
      setDeletingFlag(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmOpen(false);
    setDeletingFlag(null);
  };

  // Action menu handlers
  const handleActionMenuOpen = (event: React.MouseEvent<HTMLElement>, flag: FeatureFlag) => {
    event.stopPropagation();
    setActionMenuAnchor(event.currentTarget);
    setActionMenuFlag(flag);
  };

  const handleActionMenuClose = () => {
    setActionMenuAnchor(null);
    setActionMenuFlag(null);
  };

  // Copy flag name to clipboard
  const handleCopyName = () => {
    if (actionMenuFlag) {
      copyToClipboardWithNotification(actionMenuFlag.flagName, t, enqueueSnackbar);
    }
    handleActionMenuClose();
  };

  // Clone flag - open clone dialog
  const handleClone = () => {
    if (actionMenuFlag) {
      setCloningFlag(actionMenuFlag);
      setCloneNewName('');
      setCloneDialogOpen(true);
    }
    handleActionMenuClose();
  };

  // Execute clone
  const handleCloneConfirm = async () => {
    if (!cloningFlag || !cloneNewName.trim()) return;

    setCloning(true);
    try {
      // Clone the flag via API
      await api.post('/admin/features/clone', {
        sourceFlagName: cloningFlag.flagName,
        newFlagName: cloneNewName.trim(),
      });
      enqueueSnackbar(t('featureFlags.cloneSuccess'), { variant: 'success' });
      setCloneDialogOpen(false);
      setCloningFlag(null);
      setCloneNewName('');
      loadFlags();
    } catch (error: any) {
      enqueueSnackbar(parseApiErrorMessage(error, 'featureFlags.cloneFailed'), {
        variant: 'error',
      });
    } finally {
      setCloning(false);
    }
  };

  // Toggle stale status - show confirmation
  const handleStaleMenu = () => {
    if (actionMenuFlag) {
      setStaleConfirmOpen(true);
    }
    handleActionMenuClose();
  };

  // Stale confirmation handler
  const handleStaleConfirm = async () => {
    setStaleConfirmOpen(false);
    if (!actionMenuFlag) return;
    try {
      const newStale = !actionMenuFlag.stale;
      await api.put(`/admin/features/${actionMenuFlag.flagName}`, {
        stale: newStale,
      });
      enqueueSnackbar(
        newStale ? t('featureFlags.markStaleSuccess') : t('featureFlags.clearStaleSuccess'),
        { variant: 'success' }
      );
      loadFlags();
    } catch (error: any) {
      enqueueSnackbar(parseApiErrorMessage(error, 'featureFlags.updateFailed'), {
        variant: 'error',
      });
    }
  };

  // Toggle favorite status
  const handleFavoriteToggle = async (flag: FeatureFlag) => {
    try {
      const newFavorite = !flag.isFavorite;
      await featureFlagService.toggleFavorite(flag.flagName, newFavorite);
      enqueueSnackbar(
        newFavorite
          ? t('featureFlags.addFavoriteSuccess')
          : t('featureFlags.removeFavoriteSuccess'),
        { variant: 'success' }
      );
      loadFlags();
    } catch (error: any) {
      enqueueSnackbar(parseApiErrorMessage(error, 'featureFlags.updateFailed'), {
        variant: 'error',
      });
    }
  };

  // Archive from action menu - show confirmation
  const handleArchiveFromMenu = () => {
    if (actionMenuFlag) {
      setArchiveConfirmOpen(true);
    }
    handleActionMenuClose();
  };

  // Archive confirmation handler
  const handleArchiveConfirm = () => {
    setArchiveConfirmOpen(false);
    if (actionMenuFlag) {
      handleArchiveToggle(actionMenuFlag);
    }
  };

  // Delete from action menu
  const handleDeleteFromMenu = () => {
    if (actionMenuFlag) {
      handleDelete(actionMenuFlag);
    }
    handleActionMenuClose();
  };

  // Bulk action handlers
  const handleBulkArchive = async () => {
    const flagNames = Array.from(selectedFlags);
    const nonArchivedFlags = flags.filter((f) => flagNames.includes(f.flagName) && !f.isArchived);

    if (nonArchivedFlags.length === 0) {
      enqueueSnackbar(t('featureFlags.noFlagsToArchive'), {
        variant: 'warning',
      });
      return;
    }

    try {
      for (const flag of nonArchivedFlags) {
        await featureFlagService.archiveFeatureFlag(flag.flagName);
      }
      enqueueSnackbar(
        t('featureFlags.bulkArchiveSuccess', {
          count: nonArchivedFlags.length,
        }),
        { variant: 'success' }
      );
      setSelectedFlags(new Set());
      loadFlags();
    } catch (error: any) {
      enqueueSnackbar(parseApiErrorMessage(error, 'featureFlags.bulkArchiveFailed'), {
        variant: 'error',
      });
    }
  };

  const handleBulkRevive = async () => {
    const flagNames = Array.from(selectedFlags);
    const archivedFlags = flags.filter((f) => flagNames.includes(f.flagName) && f.isArchived);

    if (archivedFlags.length === 0) {
      enqueueSnackbar(t('featureFlags.noFlagsToRevive'), {
        variant: 'warning',
      });
      return;
    }

    try {
      for (const flag of archivedFlags) {
        await featureFlagService.reviveFeatureFlag(flag.flagName);
      }
      enqueueSnackbar(t('featureFlags.bulkReviveSuccess', { count: archivedFlags.length }), {
        variant: 'success',
      });
      setSelectedFlags(new Set());
      loadFlags();
    } catch (error: any) {
      enqueueSnackbar(parseApiErrorMessage(error, 'featureFlags.bulkReviveFailed'), {
        variant: 'error',
      });
    }
  };

  const handleBulkStale = async (markAsStale: boolean) => {
    const flagNames = Array.from(selectedFlags);
    const targetFlags = flags.filter(
      (f) => flagNames.includes(f.flagName) && !f.isArchived && f.stale !== markAsStale
    );

    if (targetFlags.length === 0) {
      enqueueSnackbar(t('featureFlags.noFlagsToUpdate'), {
        variant: 'warning',
      });
      return;
    }

    try {
      for (const flag of targetFlags) {
        await api.put(`/admin/features/${flag.flagName}`, {
          stale: markAsStale,
        });
      }
      enqueueSnackbar(
        markAsStale
          ? t('featureFlags.bulkMarkStaleSuccess', {
            count: targetFlags.length,
          })
          : t('featureFlags.bulkClearStaleSuccess', {
            count: targetFlags.length,
          }),
        { variant: 'success' }
      );
      setSelectedFlags(new Set());
      loadFlags();
    } catch (error: any) {
      enqueueSnackbar(parseApiErrorMessage(error, 'featureFlags.bulkUpdateFailed'), {
        variant: 'error',
      });
    }
  };

  const handleBulkEnable = async (environment: string, enable: boolean) => {
    const flagNames = Array.from(selectedFlags);
    const targetFlags = flags.filter((f) => flagNames.includes(f.flagName) && !f.isArchived);

    if (targetFlags.length === 0) {
      enqueueSnackbar(t('featureFlags.noFlagsToUpdate'), {
        variant: 'warning',
      });
      return;
    }

    try {
      for (const flag of targetFlags) {
        await featureFlagService.toggleFeatureFlag(flag.flagName, enable, environment);
      }
      enqueueSnackbar(
        enable
          ? t('featureFlags.bulkEnableSuccess', {
            count: targetFlags.length,
            env: environment,
          })
          : t('featureFlags.bulkDisableSuccess', {
            count: targetFlags.length,
            env: environment,
          }),
        { variant: enable ? 'success' : 'warning' }
      );
      setSelectedFlags(new Set());
      loadFlags();
    } catch (error: any) {
      enqueueSnackbar(parseApiErrorMessage(error, 'featureFlags.bulkToggleFailed'), {
        variant: 'error',
      });
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedFlags(new Set(flags.map((f) => f.flagName)));
    } else {
      setSelectedFlags(new Set());
    }
  };

  const handleSelectFlag = (flagName: string, checked: boolean) => {
    const newSelected = new Set(selectedFlags);
    if (checked) {
      newSelected.add(flagName);
    } else {
      newSelected.delete(flagName);
    }
    setSelectedFlags(newSelected);
  };

  // Create flag handler
  const handleCreateFlag = async () => {
    if (!newFlag.flagName.trim()) {
      enqueueSnackbar(t('featureFlags.flagNameRequired'), {
        variant: 'warning',
      });
      return;
    }

    setCreating(true);
    try {
      // Create flag with empty strategies - user can add strategies manually
      await api.post('/admin/features', {
        flagName: newFlag.flagName.trim(),
        displayName: newFlag.displayName.trim() || undefined,
        description: newFlag.description.trim(),

        flagType: newFlag.flagType,
        tags: newFlag.tags,
        impressionDataEnabled: newFlag.impressionDataEnabled,
        valueType: newFlag.valueType,
        enabledValue: coerceValue(newFlag.enabledValue, newFlag.valueType),
        disabledValue: coerceValue(newFlag.disabledValue, newFlag.valueType),
        strategies: [],
      });

      const createdFlagName = newFlag.flagName.trim();
      enqueueSnackbar(t('featureFlags.createSuccess'), { variant: 'success' });
      setCreateDialogOpen(false);
      setNewFlag({
        flagName: '',
        displayName: '',
        description: '',
        flagType: 'release',
        tags: [],
        impressionDataEnabled: false,
        valueType: 'boolean',
        enabledValue: true,
        disabledValue: false,
      });
      setNewFlagJsonError(null);
      // Navigate to the newly created flag's detail page
      navigate(`/feature-flags/${encodeURIComponent(createdFlagName)}`);
    } catch (error: any) {
      enqueueSnackbar(parseApiErrorMessage(error, 'featureFlags.createFailed'), {
        variant: 'error',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleOpenCreateDialog = (createFlagType: string = 'featureFlag') => {
    // Generate default flag name with timestamp
    const timestamp = Date.now().toString(36).slice(-4);
    const isRemoteConfig = createFlagType === 'remoteConfig';
    const prefix = isRemoteConfig ? 'config' : 'new-feature';
    // For generic 'featureFlag', default to 'release' as DB type
    const resolvedType = createFlagType === 'featureFlag' ? 'release' : createFlagType;
    setNewFlag({
      flagName: `${prefix}-${timestamp}`,
      displayName: '',
      description: '',
      flagType: resolvedType as FlagType,
      tags: [],
      impressionDataEnabled: false,
      valueType: isRemoteConfig ? 'string' : 'boolean',
      enabledValue: isRemoteConfig ? '' : true,
      disabledValue: isRemoteConfig ? '' : false,
    });
    setNewFlagJsonError(null);
    setCreateMenuAnchor(null);
    setShowCreateDescription(false);
    setShowCreateTags(false);
    // Store whether the type selector should be shown (only for generic featureFlag mode)
    setCreateFlagTypeMode(createFlagType === 'featureFlag');
    setCreateDialogOpen(true);
  };

  // Flag type chip color
  const getTypeColor = (
    type: FlagType
  ): 'default' | 'primary' | 'secondary' | 'warning' | 'error' => {
    switch (type) {
      case 'release':
        return 'primary';
      case 'experiment':
        return 'secondary';
      case 'operational':
        return 'warning';
      case 'killSwitch':
        return 'error';
      case 'permission':
        return 'default';
      default:
        return 'default';
    }
  };

  // Get icon for flag type
  const getTypeIcon = (type: FlagType) => getFlagTypeIcon(type, 18);

  // Get flag status for display
  const getFlagStatus = (
    flag: FeatureFlag
  ): {
    status: string;
    color: 'default' | 'primary' | 'warning' | 'error' | 'success';
  } => {
    if (flag.isArchived) {
      return { status: 'archived', color: 'default' };
    }
    if (flag.stale) {
      return { status: 'stale', color: 'error' };
    }
    // Check potentially stale based on lastSeenAt and flag type lifetime
    const flagTypeInfo = flagTypes.find((ft) => ft.flagType === flag.flagType);
    if (flagTypeInfo?.lifetimeDays && flag.lastSeenAt) {
      const lastSeen = new Date(flag.lastSeenAt);
      const now = new Date();
      const daysSinceLastSeen = (now.getTime() - lastSeen.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceLastSeen > flagTypeInfo.lifetimeDays) {
        return { status: 'potentiallyStale', color: 'warning' };
      }
    }
    return { status: 'active', color: 'success' };
  };

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
            <FlagIcon />
            {t('featureFlags.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('featureFlags.subtitle')}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          {canManage && (
            <>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={(e) => setCreateMenuAnchor(e.currentTarget)}
                endIcon={<ExpandMoreIcon sx={{ ml: -0.5 }} />}
              >
                {t('featureFlags.createFlagOrRemoteConfig')}
              </Button>
              <Menu
                anchorEl={createMenuAnchor}
                open={Boolean(createMenuAnchor)}
                onClose={() => setCreateMenuAnchor(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                transformOrigin={{ vertical: 'top', horizontal: 'left' }}
              >
                <MenuItem onClick={() => handleOpenCreateDialog('featureFlag')}>
                  <ListItemIcon>
                    <FlagIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary={t('featureFlags.createFlagOption')}
                    secondary={t('featureFlags.createFeatureFlagSubtitle')}
                  />
                </MenuItem>
                <Divider />
                <MenuItem onClick={() => handleOpenCreateDialog('release')}>
                  <ListItemIcon>
                    <ReleaseIcon fontSize="small" color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary={t('featureFlags.flagTypes.release')}
                    secondary={t('featureFlags.flagTypes.release.desc')}
                  />
                </MenuItem>
                <MenuItem onClick={() => handleOpenCreateDialog('experiment')}>
                  <ListItemIcon>
                    <ExperimentIcon fontSize="small" color="secondary" />
                  </ListItemIcon>
                  <ListItemText
                    primary={t('featureFlags.flagTypes.experiment')}
                    secondary={t('featureFlags.flagTypes.experiment.desc')}
                  />
                </MenuItem>
                <MenuItem onClick={() => handleOpenCreateDialog('operational')}>
                  <ListItemIcon>
                    <OperationalIcon fontSize="small" color="warning" />
                  </ListItemIcon>
                  <ListItemText
                    primary={t('featureFlags.flagTypes.operational')}
                    secondary={t('featureFlags.flagTypes.operational.desc')}
                  />
                </MenuItem>
                <MenuItem onClick={() => handleOpenCreateDialog('killSwitch')}>
                  <ListItemIcon>
                    <KillSwitchIcon fontSize="small" color="error" />
                  </ListItemIcon>
                  <ListItemText
                    primary={t('featureFlags.flagTypes.killSwitch')}
                    secondary={t('featureFlags.flagTypes.killSwitch.desc')}
                  />
                </MenuItem>
                <MenuItem onClick={() => handleOpenCreateDialog('permission')}>
                  <ListItemIcon>
                    <PermissionIcon fontSize="small" color="action" />
                  </ListItemIcon>
                  <ListItemText
                    primary={t('featureFlags.flagTypes.permission')}
                    secondary={t('featureFlags.flagTypes.permission.desc')}
                  />
                </MenuItem>
                <Divider />
                <MenuItem onClick={() => handleOpenCreateDialog('remoteConfig')}>
                  <ListItemIcon>
                    <RemoteConfigIcon fontSize="small" color="info" />
                  </ListItemIcon>
                  <ListItemText
                    primary={t('featureFlags.flagTypes.remoteConfig')}
                    secondary={t('featureFlags.flagTypes.remoteConfig.desc')}
                  />
                </MenuItem>
              </Menu>
            </>
          )}
          <Button
            variant="outlined"
            startIcon={<ImportExportIcon />}
            onClick={(e) => setImportExportMenuAnchor(e.currentTarget)}
            endIcon={<ExpandMoreIcon sx={{ ml: -0.5 }} />}
          >
            {t('featureFlags.importExport')}
          </Button>
          <Divider orientation="vertical" sx={{ height: 32, mx: 0.5 }} />
          <Tooltip title={t('playground.title')} disableFocusListener>
            <IconButton
              size="small"
              onClick={() => setPlaygroundOpen(true)}
              sx={{
                width: 36,
                height: 36,
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                '&:hover': { bgcolor: 'primary.dark' },
              }}
            >
              <JoystickIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Search and Filters */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              flexWrap: 'nowrap',
              justifyContent: 'space-between',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                gap: 2,
                alignItems: 'center',
                flexWrap: 'nowrap',
                flexGrow: 1,
                minWidth: 0,
              }}
            >
              <TextField
                placeholder={t('featureFlags.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(0);
                }}
                sx={{
                  minWidth: 300,
                  flexGrow: 1,
                  maxWidth: 500,
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
                      '& fieldset': {
                        borderColor: 'primary.main',
                        borderWidth: '1px',
                      },
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
                onFilterChange={handleFilterChange}
                onOperatorChange={handleOperatorChange}
                onRefresh={loadFlags}
                refreshDisabled={loading}
                noWrap={true}
                afterFilterAddActions={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {!compactView && (
                      <Tooltip title={t('common.columnSettings')} disableFocusListener>
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
                    )}
                    <Tooltip title={t('featureFlags.compactView')} disableFocusListener>
                      <IconButton
                        onClick={handleCompactViewToggle}
                        sx={{
                          bgcolor: compactView ? 'primary.main' : 'background.paper',
                          color: compactView ? 'primary.contrastText' : 'text.primary',
                          border: 1,
                          borderColor: compactView ? 'primary.main' : 'divider',
                          '&:hover': {
                            bgcolor: compactView ? 'primary.dark' : 'action.hover',
                          },
                        }}
                      >
                        <ViewListIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                }
              />
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Table / Compact View */}
      <Card>
        <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
          {loading && isInitialLoad ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <Typography color="text.secondary">{t('common.loadingData')}</Typography>
            </Box>
          ) : flags.length === 0 ? (
            <EmptyState
              message={t('featureFlags.noFlagsFound')}
              onAddClick={canManage ? () => navigate('/feature-flags/new') : undefined}
              addButtonLabel={t('featureFlags.createFlag')}
              subtitle={canManage ? t('common.addFirstItem') : undefined}
            />
          ) : compactView ? (
            <>
              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                {flags.map((flag, index) => {
                  // Value preview helper
                  const formatValuePreview = (val: any): string => {
                    if (val === null || val === undefined) return '-';
                    if (typeof val === 'boolean') return val ? 'true' : 'false';
                    if (typeof val === 'object') {
                      const str = JSON.stringify(val);
                      return str.length > 40 ? str.slice(0, 40) + '…' : str;
                    }
                    const str = String(val);
                    return str.length > 40 ? str.slice(0, 40) + '…' : str;
                  };
                  // Get the most recent lastSeenAt across all environments
                  const lastSeen =
                    flag.environments?.reduce((latest, env) => {
                      if (!env.lastSeenAt) return latest;
                      if (!latest) return env.lastSeenAt;
                      return new Date(env.lastSeenAt) > new Date(latest) ? env.lastSeenAt : latest;
                    }, flag.lastSeenAt || '') || flag.lastSeenAt;

                  return (
                    <Box
                      key={flag.id}
                      sx={{
                        px: 2.5,
                        py: 1.5,
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                        cursor: 'pointer',
                        transition: 'background-color 0.15s',
                        bgcolor: index % 2 === 1 ? 'action.hover' : 'transparent',
                        '&:hover': { bgcolor: 'action.selected' },
                        ...(flag.isArchived ? { opacity: 0.6 } : {}),
                      }}
                      onClick={() => navigate(`/feature-flags/${flag.flagName}`)}
                    >
                      {/* Row 1: Flag name + status + action */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Tooltip title={t(`featureFlags.types.${flag.flagType}`)}>
                          {getTypeIcon(flag.flagType)}
                        </Tooltip>
                        {isStale(flag) && (
                          <Tooltip title={t('featureFlags.staleWarning')}>
                            <WarningIcon sx={{ fontSize: 16, color: 'warning.main' }} />
                          </Tooltip>
                        )}
                        <Typography
                          fontWeight={600}
                          variant="body1"
                          noWrap
                          sx={{ flex: 1, minWidth: 0 }}
                        >
                          {flag.flagName}
                        </Typography>
                        {flag.codeReferenceCount !== undefined && flag.codeReferenceCount > 0 && (
                          <Chip
                            icon={<GitHubIcon sx={{ fontSize: 14 }} />}
                            label={flag.codeReferenceCount}
                            size="small"
                            variant="outlined"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/feature-flags/${flag.flagName}?tab=code-references`);
                            }}
                            sx={{
                              height: 20,
                              fontSize: '0.7rem',
                              cursor: 'pointer',
                              mr: 0.5,
                              pl: 0.5,
                              borderRadius: 1,
                              '& .MuiChip-icon': { ml: 0 },
                            }}
                          />
                        )}
                        {flag.isFavorite && (
                          <StarIcon sx={{ fontSize: 16, color: 'warning.main' }} />
                        )}
                        {(() => {
                          const { status: flagStatus, color } = getFlagStatus(flag);
                          return (
                            <Box
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.5,
                                flexShrink: 0,
                              }}
                            >
                              <FlagStatusIcon status={flagStatus} size={16} />
                              <Chip
                                label={t(
                                  `featureFlags.status${flagStatus.charAt(0).toUpperCase() + flagStatus.slice(1)}`
                                )}
                                size="small"
                                color={color}
                                variant={flagStatus === 'active' ? 'outlined' : 'filled'}
                                sx={{ height: 20, fontSize: '0.7rem' }}
                              />
                            </Box>
                          );
                        })()}
                        {canManage && (
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleActionMenuOpen(e, flag);
                            }}
                          >
                            <MoreVertIcon fontSize="small" />
                          </IconButton>
                        )}
                      </Box>

                      {/* Row 2: Display name + description (when available) */}
                      {((flag.displayName && flag.displayName !== flag.flagName) ||
                        flag.description) && (
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1.5,
                              mt: 0.25,
                              pl: 3.5,
                            }}
                          >
                            {flag.displayName && flag.displayName !== flag.flagName && (
                              <Typography variant="body2" color="text.secondary" noWrap>
                                {flag.displayName}
                              </Typography>
                            )}
                            {flag.description && (
                              <Typography
                                variant="body2"
                                color="text.disabled"
                                noWrap
                                sx={{ flex: 1, minWidth: 0 }}
                              >
                                — {flag.description}
                              </Typography>
                            )}
                          </Box>
                        )}

                      {/* Row 3: Env switches + value info + tags + times */}
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.5,
                          mt: 0.75,
                          pl: 3.5,
                        }}
                      >
                        {/* Environment switches */}
                        <Box
                          sx={{ display: 'flex', alignItems: 'center', gap: 0.25, flexShrink: 0 }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {environments.map((env) => {
                            const isEnabled = getEnvEnabled(flag, env.environment);
                            return (
                              <FeatureSwitch
                                key={`${flag.flagName}-${env.environment}-${isEnabled}`}
                                size="small"
                                checked={isEnabled}
                                onChange={() => handleToggle(flag, env.environment, isEnabled)}
                                disabled={flag.isArchived || !canManage}
                                onClick={(e) => e.stopPropagation()}
                                color={env.color}
                                label={env.displayName}
                              />
                            );
                          })}
                        </Box>

                        {/* Divider */}
                        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

                        {/* Value type + value previews */}
                        <Box
                          sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}
                        >
                          <FieldTypeIcon type={flag.valueType || 'string'} size={14} />
                          <Tooltip
                            title={`${t('featureFlags.enabledValue')}: ${formatValuePreview(flag.enabledValue)}`}
                            disableFocusListener
                          >
                            <Chip
                              label={formatValuePreview(flag.enabledValue)}
                              size="small"
                              sx={{
                                height: 20,
                                fontSize: '0.7rem',
                                maxWidth: 120,
                                bgcolor: 'success.main',
                                color: 'success.contrastText',
                                opacity: 0.85,
                              }}
                            />
                          </Tooltip>
                          <Typography variant="caption" color="text.disabled">
                            /
                          </Typography>
                          <Tooltip
                            title={`${t('featureFlags.disabledValue')}: ${formatValuePreview(flag.disabledValue)}`}
                            disableFocusListener
                          >
                            <Chip
                              label={formatValuePreview(flag.disabledValue)}
                              size="small"
                              sx={{
                                height: 20,
                                fontSize: '0.7rem',
                                maxWidth: 120,
                                bgcolor: 'action.disabledBackground',
                                color: 'text.secondary',
                              }}
                            />
                          </Tooltip>
                        </Box>

                        {/* Tags */}
                        {flag.tags && flag.tags.length > 0 && (
                          <>
                            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
                            <Box
                              sx={{ display: 'flex', gap: 0.5, flexShrink: 0, flexWrap: 'wrap' }}
                            >
                              {flag.tags.slice(0, 5).map((tagName) => {
                                const tagObj = allTags.find((tItem) => tItem.tagName === tagName);
                                const color = tagObj?.color || '#888';
                                return (
                                  <Chip
                                    key={tagName}
                                    label={tagName}
                                    size="small"
                                    sx={{
                                      height: 20,
                                      fontSize: '0.7rem',
                                      bgcolor: color,
                                      color: getContrastColor(color),
                                    }}
                                  />
                                );
                              })}
                              {flag.tags.length > 5 && (
                                <Chip
                                  label={`+${flag.tags.length - 5}`}
                                  size="small"
                                  sx={{ height: 20, fontSize: '0.7rem' }}
                                />
                              )}
                            </Box>
                          </>
                        )}

                        {/* Impression data indicator */}
                        {flag.impressionDataEnabled && (
                          <Tooltip title={t('featureFlags.impressionDataOn')} disableFocusListener>
                            <Chip
                              label="📊"
                              size="small"
                              variant="outlined"
                              sx={{ height: 20, fontSize: '0.7rem', borderColor: 'info.main' }}
                            />
                          </Tooltip>
                        )}

                        {/* Spacer */}
                        <Box sx={{ flex: 1 }} />

                        {/* Last seen */}
                        {lastSeen && (
                          <Tooltip
                            title={`${t('featureFlags.lastSeenAt')}: ${formatDateTimeDetailed(lastSeen)}`}
                            disableFocusListener
                          >
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              noWrap
                              sx={{ fontSize: '0.7rem' }}
                            >
                              ⚡ {formatRelativeTime(lastSeen)}
                            </Typography>
                          </Tooltip>
                        )}

                        {/* Created time */}
                        <Tooltip
                          title={formatDateTimeDetailed(flag.createdAt)}
                          disableFocusListener
                        >
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {formatRelativeTime(flag.createdAt)}
                          </Typography>
                        </Tooltip>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', pr: 1 }}>
                <SimplePagination
                  page={page}
                  rowsPerPage={rowsPerPage}
                  count={total}
                  onPageChange={(event, newPage) => setPage(newPage)}
                  onRowsPerPageChange={(event) => {
                    setRowsPerPage(Number(event.target.value));
                    setPage(0);
                  }}
                />
              </Box>
            </>
          ) : (
            <>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox" sx={{ width: 48 }}>
                        <Checkbox
                          indeterminate={
                            selectedFlags.size > 0 && selectedFlags.size < flags.length
                          }
                          checked={flags.length > 0 && selectedFlags.size === flags.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedFlags(new Set(flags.map((f) => f.flagName)));
                            } else {
                              setSelectedFlags(new Set());
                            }
                          }}
                          size="small"
                        />
                      </TableCell>

                      {/* Dynamic columns based on visibleColumns order */}
                      {visibleColumns.map((col) => {
                        switch (col.id) {
                          case 'flagName':
                            return (
                              <TableCell key={col.id}>
                                <TableSortLabel
                                  active={orderBy === 'flagName'}
                                  direction={orderBy === 'flagName' ? order : 'asc'}
                                  onClick={() => handleSort('flagName')}
                                >
                                  {t('featureFlags.flagName')}
                                </TableSortLabel>
                              </TableCell>
                            );
                          case 'status':
                            return <TableCell key={col.id}>{t('featureFlags.status')}</TableCell>;
                          case 'environments':
                            return environments.length > 0 ? (
                              <TableCell
                                key={col.id}
                                align="center"
                                colSpan={environments.length}
                                sx={{ px: 0.5 }}
                              >
                                {t('featureFlags.enabledByEnv')}
                              </TableCell>
                            ) : null;
                          case 'createdBy':
                            return <TableCell key={col.id}>{t('common.createdBy')}</TableCell>;
                          case 'createdAt':
                            return (
                              <TableCell key={col.id}>
                                <TableSortLabel
                                  active={orderBy === 'createdAt'}
                                  direction={orderBy === 'createdAt' ? order : 'asc'}
                                  onClick={() => handleSort('createdAt')}
                                >
                                  {t('featureFlags.createdAt')}
                                </TableSortLabel>
                              </TableCell>
                            );
                          case 'lastSeenAt':
                            return (
                              <TableCell key={col.id}>{t('featureFlags.lastSeenAt')}</TableCell>
                            );
                          case 'tags':
                            return <TableCell key={col.id}>{t('featureFlags.tags')}</TableCell>;
                          case 'valueType':
                            return (
                              <TableCell key={col.id}>{t('featureFlags.valueType')}</TableCell>
                            );

                          default:
                            return null;
                        }
                      })}
                      {canManage && <TableCell align="center">{t('common.actions')}</TableCell>}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {flags.map((flag) => (
                      <TableRow
                        key={flag.id}
                        hover
                        selected={selectedFlags.has(flag.flagName)}
                        sx={{
                          ...(flag.isArchived ? { opacity: 0.6 } : {}),
                        }}
                      >
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={selectedFlags.has(flag.flagName)}
                            onChange={(e) => {
                              const newSelected = new Set(selectedFlags);
                              if (e.target.checked) {
                                newSelected.add(flag.flagName);
                              } else {
                                newSelected.delete(flag.flagName);
                              }
                              setSelectedFlags(newSelected);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            size="small"
                          />
                        </TableCell>

                        {/* Dynamic columns based on visibleColumns order */}
                        {visibleColumns.map((col) => {
                          switch (col.id) {
                            case 'flagName':
                              return (
                                <TableCell key={col.id}>
                                  <Box>
                                    <Box
                                      sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 0.5,
                                      }}
                                    >
                                      <Tooltip title={t(`featureFlags.types.${flag.flagType}`)}>
                                        {getTypeIcon(flag.flagType)}
                                      </Tooltip>
                                      {isStale(flag) && (
                                        <Tooltip title={t('featureFlags.staleWarning')}>
                                          <WarningIcon
                                            sx={{
                                              fontSize: 16,
                                              color: 'warning.main',
                                            }}
                                          />
                                        </Tooltip>
                                      )}
                                      <Typography
                                        fontWeight={500}
                                        sx={{
                                          cursor: 'pointer',
                                          '&:hover': {
                                            textDecoration: 'underline',
                                          },
                                        }}
                                        onClick={() => navigate(`/feature-flags/${flag.flagName}`)}
                                      >
                                        {flag.flagName}
                                      </Typography>
                                      {flag.codeReferenceCount !== undefined &&
                                        flag.codeReferenceCount > 0 && (
                                          <Chip
                                            icon={<GitHubIcon sx={{ fontSize: 14 }} />}
                                            label={flag.codeReferenceCount}
                                            size="small"
                                            variant="outlined"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              navigate(
                                                `/feature-flags/${flag.flagName}?tab=code-references`
                                              );
                                            }}
                                            sx={{
                                              height: 20,
                                              fontSize: '0.7rem',
                                              cursor: 'pointer',
                                              ml: 0.5,
                                              pl: 0.5,
                                              borderRadius: 1,
                                              '& .MuiChip-icon': { ml: 0 },
                                            }}
                                          />
                                        )}
                                      <Tooltip title={t('common.copy')} disableFocusListener>
                                        <IconButton
                                          size="small"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            copyToClipboardWithNotification(
                                              flag.flagName,
                                              enqueueSnackbar,
                                              t
                                            );
                                          }}
                                          sx={{
                                            opacity: 0.5,
                                            '&:hover': { opacity: 1 },
                                          }}
                                        >
                                          <CopyIcon sx={{ fontSize: 14 }} />
                                        </IconButton>
                                      </Tooltip>
                                      <IconButton
                                        size="small"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleFavoriteToggle(flag);
                                        }}
                                        sx={{
                                          color: flag.isFavorite
                                            ? 'warning.main'
                                            : 'action.disabled',
                                          opacity: flag.isFavorite ? 1 : 0.5,
                                          '&:hover': { opacity: 1 },
                                        }}
                                      >
                                        {flag.isFavorite ? (
                                          <StarIcon sx={{ fontSize: 16 }} />
                                        ) : (
                                          <StarBorderIcon sx={{ fontSize: 16 }} />
                                        )}
                                      </IconButton>
                                    </Box>
                                    {flag.displayName && flag.displayName !== flag.flagName && (
                                      <Typography
                                        variant="body2"
                                        color="text.secondary"
                                        sx={{ fontSize: '0.8rem' }}
                                      >
                                        {flag.displayName}
                                      </Typography>
                                    )}
                                  </Box>
                                </TableCell>
                              );
                            case 'status':
                              // Status column followed by environment columns
                              return (
                                <React.Fragment key={col.id}>
                                  <TableCell>
                                    {(() => {
                                      const { status, color } = getFlagStatus(flag);
                                      return (
                                        <Box
                                          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                                        >
                                          <FlagStatusIcon status={status} size={16} />
                                          <Chip
                                            label={t(
                                              `featureFlags.status${status.charAt(0).toUpperCase() + status.slice(1)}`
                                            )}
                                            size="small"
                                            color={color}
                                            variant={status === 'active' ? 'outlined' : 'filled'}
                                            sx={{
                                              height: 20,
                                              fontSize: '0.75rem',
                                            }}
                                          />
                                        </Box>
                                      );
                                    })()}
                                  </TableCell>
                                </React.Fragment>
                              );
                            case 'environments':
                              return (
                                <React.Fragment key={col.id}>
                                  {environments.map((env, envIndex) => {
                                    const isEnabled = getEnvEnabled(flag, env.environment);
                                    return (
                                      <TableCell
                                        key={env.environment}
                                        align="center"
                                        sx={{
                                          px: 0.25,
                                          py: 0.5,
                                          borderLeft: (theme) =>
                                            `1px dashed ${theme.palette.divider}`,
                                          ...(envIndex === environments.length - 1 && {
                                            borderRight: (theme: any) =>
                                              `1px dashed ${theme.palette.divider}`,
                                          }),
                                        }}
                                      >
                                        <Box
                                          sx={{
                                            display: 'flex',
                                            justifyContent: 'center',
                                          }}
                                        >
                                          <FeatureSwitch
                                            key={`${flag.flagName}-${env.environment}-${isEnabled}`}
                                            size="small"
                                            checked={isEnabled}
                                            onChange={() => {
                                              handleToggle(flag, env.environment, isEnabled);
                                            }}
                                            disabled={flag.isArchived || !canManage}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                            }}
                                            color={env.color}
                                            label={env.displayName}
                                          />
                                        </Box>
                                      </TableCell>
                                    );
                                  })}
                                </React.Fragment>
                              );
                            case 'createdBy':
                              return (
                                <TableCell key={col.id}>
                                  <Box>
                                    <Typography variant="body2" fontWeight={500}>
                                      {flag.createdByName || '-'}
                                    </Typography>
                                    {flag.createdByEmail && (
                                      <Typography
                                        variant="body2"
                                        color="text.secondary"
                                        sx={{ fontSize: '0.8rem' }}
                                      >
                                        {flag.createdByEmail}
                                      </Typography>
                                    )}
                                  </Box>
                                </TableCell>
                              );
                            case 'createdAt':
                              return (
                                <TableCell key={col.id}>
                                  <Tooltip title={formatDateTimeDetailed(flag.createdAt)}>
                                    <span>{formatRelativeTime(flag.createdAt)}</span>
                                  </Tooltip>
                                </TableCell>
                              );
                            case 'lastSeenAt':
                              return (
                                <TableCell key={col.id}>
                                  {flag.lastSeenAt ? (
                                    <Tooltip title={formatDateTimeDetailed(flag.lastSeenAt)}>
                                      <span>{formatRelativeTime(flag.lastSeenAt)}</span>
                                    </Tooltip>
                                  ) : (
                                    <Typography variant="body2" color="text.secondary">
                                      -
                                    </Typography>
                                  )}
                                </TableCell>
                              );
                            case 'valueType':
                              return (
                                <TableCell key={col.id}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <FieldTypeIcon type={flag.valueType || 'string'} size={18} />
                                    <Typography variant="body2">
                                      {t(`featureFlags.valueTypes.${flag.valueType || 'string'}`)}
                                    </Typography>
                                  </Box>
                                </TableCell>
                              );

                            case 'tags':
                              return (
                                <TableCell key={col.id}>
                                  <Box
                                    sx={{
                                      display: 'flex',
                                      flexWrap: 'wrap',
                                      gap: 0.5,
                                    }}
                                  >
                                    {flag.tags?.slice(0, 3).map((tagName) => {
                                      const tagData = allTags.find((t) => t.name === tagName);
                                      const color = tagData?.color || '#888888';
                                      return (
                                        <Tooltip
                                          key={tagName}
                                          title={tagData?.description || ''}
                                          arrow
                                        >
                                          <Chip
                                            label={tagName}
                                            size="small"
                                            sx={{
                                              height: 20,
                                              bgcolor: color,
                                              color: getContrastColor(color),
                                            }}
                                          />
                                        </Tooltip>
                                      );
                                    })}
                                    {flag.tags && flag.tags.length > 3 && (
                                      <Chip
                                        label={`+${flag.tags.length - 3}`}
                                        size="small"
                                        sx={{ height: 20 }}
                                      />
                                    )}
                                  </Box>
                                </TableCell>
                              );
                            default:
                              return null;
                          }
                        })}
                        {canManage && (
                          <TableCell align="center">
                            <IconButton size="small" onClick={(e) => handleActionMenuOpen(e, flag)}>
                              <MoreVertIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <SimplePagination
                page={page}
                rowsPerPage={rowsPerPage}
                count={total}
                onPageChange={(event, newPage) => setPage(newPage)}
                onRowsPerPageChange={(event) => {
                  setRowsPerPage(Number(event.target.value));
                  setPage(0);
                }}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Bulk Action Bar */}
      {selectedFlags.size > 0 && canManage && (
        <ClickAwayListener onClickAway={() => setSelectedFlags(new Set())}>
          <Paper
            elevation={8}
            sx={{
              position: 'fixed',
              bottom: 24,
              left: '50%',
              transform: 'translateX(-50%)',
              px: 3,
              py: 1.5,
              borderRadius: 3,
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              zIndex: 1000,
              bgcolor: 'background.paper',
            }}
          >
            <Chip
              label={`${selectedFlags.size} ${t('common.selected')}`}
              color="primary"
              size="small"
            />
            <Divider orientation="vertical" flexItem />

            {/* Environment Enable/Disable Dropdown */}
            <Box>
              <Button
                size="small"
                variant="outlined"
                onClick={(e) => setEnvMenuAnchor(e.currentTarget)}
              >
                {t('common.enable')} / {t('common.disable')}
              </Button>
              <Menu
                anchorEl={envMenuAnchor}
                open={Boolean(envMenuAnchor)}
                onClose={() => setEnvMenuAnchor(null)}
              >
                {environments.map((env) => (
                  <Box key={env.environment}>
                    <MenuItem
                      onClick={() => {
                        handleBulkEnable(env.environment, true);
                        setEnvMenuAnchor(null);
                      }}
                    >
                      <ListItemIcon>
                        <CheckCircleIcon fontSize="small" color="success" />
                      </ListItemIcon>
                      <ListItemText>
                        {t('common.enable')} - {env.displayName}
                      </ListItemText>
                    </MenuItem>
                    <MenuItem
                      onClick={() => {
                        handleBulkEnable(env.environment, false);
                        setEnvMenuAnchor(null);
                      }}
                    >
                      <ListItemIcon>
                        <CancelIcon fontSize="small" color="error" />
                      </ListItemIcon>
                      <ListItemText>
                        {t('common.disable')} - {env.displayName}
                      </ListItemText>
                    </MenuItem>
                  </Box>
                ))}
              </Menu>
            </Box>

            <Button
              size="small"
              variant="outlined"
              startIcon={<ArchiveIcon />}
              onClick={handleBulkArchive}
            >
              {t('featureFlags.archive')}
            </Button>

            <Button
              size="small"
              variant="outlined"
              startIcon={<UnarchiveIcon />}
              onClick={handleBulkRevive}
            >
              {t('featureFlags.revive')}
            </Button>

            {/* Stale Actions Dropdown */}
            <Box>
              <Button
                size="small"
                variant="outlined"
                onClick={(e) => setStaleMenuAnchor(e.currentTarget)}
                startIcon={<StaleIcon />}
              >
                Stale
              </Button>
              <Menu
                anchorEl={staleMenuAnchor}
                open={Boolean(staleMenuAnchor)}
                onClose={() => setStaleMenuAnchor(null)}
              >
                <MenuItem
                  onClick={() => {
                    handleBulkStale(true);
                    setStaleMenuAnchor(null);
                  }}
                >
                  <ListItemIcon>
                    <StaleIcon fontSize="small" color="warning" />
                  </ListItemIcon>
                  <ListItemText>{t('featureFlags.markStale')}</ListItemText>
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    handleBulkStale(false);
                    setStaleMenuAnchor(null);
                  }}
                >
                  <ListItemIcon>
                    <CheckCircleIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>{t('featureFlags.clearStale')}</ListItemText>
                </MenuItem>
              </Menu>
            </Box>

            <Button
              size="small"
              variant="outlined"
              color="primary"
              startIcon={<JoystickIcon />}
              onClick={() => {
                setPlaygroundInitialFlags(Array.from(selectedFlags));
                setPlaygroundOpen(true);
              }}
            >
              {t('featureFlags.testInPlayground')}
            </Button>

            <Divider orientation="vertical" flexItem />

            <IconButton size="small" onClick={() => setSelectedFlags(new Set())}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Paper>
        </ClickAwayListener>
      )}
      {/* Action Menu */}
      <Menu
        anchorEl={actionMenuAnchor}
        open={Boolean(actionMenuAnchor)}
        onClose={handleActionMenuClose}
        onClick={(e) => e.stopPropagation()}
      >
        <MenuItem onClick={handleCopyName}>
          <ListItemIcon>
            <CopyIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('featureFlags.copyName')}</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (actionMenuFlag) {
              navigate(`/feature-flags/${actionMenuFlag.flagName}`);
            }
            handleActionMenuClose();
          }}
        >
          <ListItemIcon>
            <OpenInNewIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('featureFlags.goToOverview')}</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (actionMenuFlag) {
              navigate(`/feature-flags/${actionMenuFlag.flagName}?tab=metrics`);
            }
            handleActionMenuClose();
          }}
        >
          <ListItemIcon>
            <MetricsIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('featureFlags.goToMetrics')}</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (actionMenuFlag) {
              setPlaygroundInitialFlags([actionMenuFlag.flagName]);
              setPlaygroundOpen(true);
            }
            handleActionMenuClose();
          }}
          disabled={!actionMenuFlag}
        >
          <ListItemIcon>
            <JoystickIcon fontSize="small" color="primary" />
          </ListItemIcon>
          <ListItemText>{t('featureFlags.testInPlayground')}</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleClone} disabled={!actionMenuFlag || actionMenuFlag.isArchived}>
          <ListItemIcon>
            <CloneIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('featureFlags.clone')}</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleStaleMenu} disabled={!actionMenuFlag || actionMenuFlag.isArchived}>
          <ListItemIcon>
            <StaleIcon fontSize="small" color={actionMenuFlag?.stale ? 'warning' : 'inherit'} />
          </ListItemIcon>
          <ListItemText>
            {actionMenuFlag?.stale ? t('featureFlags.clearStale') : t('featureFlags.markStale')}
          </ListItemText>
        </MenuItem>
        <MenuItem onClick={handleArchiveFromMenu} disabled={!actionMenuFlag}>
          <ListItemIcon>
            {actionMenuFlag?.isArchived ? (
              <UnarchiveIcon fontSize="small" />
            ) : (
              <ArchiveIcon fontSize="small" />
            )}
          </ListItemIcon>
          <ListItemText>
            {actionMenuFlag?.isArchived ? t('featureFlags.revive') : t('featureFlags.archive')}
          </ListItemText>
        </MenuItem>
        {actionMenuFlag?.isArchived && (
          <>
            <Divider />
            <MenuItem onClick={handleDeleteFromMenu} sx={{ color: 'error.main' }}>
              <ListItemIcon>
                <DeleteIcon fontSize="small" color="error" />
              </ListItemIcon>
              <ListItemText>{t('common.delete')}</ListItemText>
            </MenuItem>
          </>
        )}
      </Menu>

      {/* Delete Confirmation Dialog */}
      <ConfirmDeleteDialog
        open={deleteConfirmOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title={t('featureFlags.deleteConfirmTitle')}
        message={t('featureFlags.deleteConfirmMessage', {
          name: deletingFlag?.flagName || '',
        })}
      />

      {/* Archive Confirmation Dialog */}
      <Dialog
        open={archiveConfirmOpen}
        onClose={() => setArchiveConfirmOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          {actionMenuFlag?.isArchived
            ? t('featureFlags.reviveConfirmTitle')
            : t('featureFlags.archiveConfirmTitle')}
        </DialogTitle>
        <DialogContent>
          <Typography>
            {actionMenuFlag?.isArchived
              ? t('featureFlags.reviveConfirmMessage', { name: actionMenuFlag?.flagName })
              : t('featureFlags.archiveConfirmMessage', { name: actionMenuFlag?.flagName })}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setArchiveConfirmOpen(false)}>{t('common.cancel')}</Button>
          <Button
            variant="contained"
            color={actionMenuFlag?.isArchived ? 'success' : 'warning'}
            onClick={handleArchiveConfirm}
          >
            {actionMenuFlag?.isArchived ? t('featureFlags.revive') : t('featureFlags.archive')}
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
          {actionMenuFlag?.stale
            ? t('featureFlags.unmarkStaleConfirmTitle')
            : t('featureFlags.markStaleConfirmTitle')}
        </DialogTitle>
        <DialogContent>
          <Typography>
            {actionMenuFlag?.stale
              ? t('featureFlags.unmarkStaleConfirmMessage', { name: actionMenuFlag?.flagName })
              : t('featureFlags.markStaleConfirmMessage', { name: actionMenuFlag?.flagName })}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStaleConfirmOpen(false)}>{t('common.cancel')}</Button>
          <Button
            variant="contained"
            color={actionMenuFlag?.stale ? 'info' : 'secondary'}
            onClick={handleStaleConfirm}
          >
            {actionMenuFlag?.stale ? t('featureFlags.unmarkStale') : t('featureFlags.markStale')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Clone Dialog */}
      <Dialog
        open={cloneDialogOpen}
        onClose={() => setCloneDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{t('featureFlags.cloneFlag')}</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t('featureFlags.cloneFlagDescription', {
                name: cloningFlag?.flagName || '',
              })}
            </Typography>
            <TextField
              fullWidth
              required
              autoFocus
              label={t('featureFlags.newFlagName')}
              value={cloneNewName}
              onChange={(e) => setCloneNewName(e.target.value.replace(/[^a-zA-Z0-9_.-]/g, ''))}
              placeholder="new-flag-name"
              helperText={t('featureFlags.flagNameHelp')}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCloneDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button
            variant="contained"
            onClick={handleCloneConfirm}
            disabled={cloning || !cloneNewName.trim()}
          >
            {cloning ? <CircularProgress size={20} /> : t('featureFlags.clone')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Feature Flag Drawer */}
      <ResizableDrawer
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        title={
          createFlagTypeMode
            ? t('featureFlags.createFlag')
            : `${t(`featureFlags.flagTypes.${newFlag.flagType}`)} ${t('featureFlags.createFlagOrRemoteConfig')}`
        }
        subtitle={
          createFlagTypeMode
            ? t('featureFlags.createFlagSubtitle')
            : t(`featureFlags.flagTypes.${newFlag.flagType}.desc`)
        }
        storageKey="featureFlagCreateDrawerWidth"
        defaultWidth={500}
      >
        <Box sx={{ p: 3, flex: 1, overflow: 'auto' }}>
          <Stack spacing={2.5}>
            {/* Flag Name + Display Name on same row */}
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
              <Box sx={{ flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                  <Typography variant="subtitle2">
                    {newFlag.flagType === 'remoteConfig'
                      ? t('featureFlags.remoteConfigFlagName')
                      : t('featureFlags.flagName')}{' '}
                    <Box component="span" sx={{ color: 'error.main' }}>
                      *
                    </Box>
                  </Typography>
                </Box>
                <TextField
                  fullWidth
                  size="small"
                  autoFocus
                  value={newFlag.flagName}
                  onChange={(e) =>
                    setNewFlag({
                      ...newFlag,
                      flagName: e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''),
                    })
                  }
                  helperText={
                    newFlag.flagType === 'remoteConfig'
                      ? t('featureFlags.remoteConfigFlagNameHelp')
                      : t('featureFlags.flagNameHelp')
                  }
                  inputProps={{ maxLength: 100 }}
                />
              </Box>
              <TextField
                sx={{ flex: 1, mt: 3.5 }}
                size="small"
                label={
                  newFlag.flagType === 'remoteConfig'
                    ? t('featureFlags.remoteConfigDisplayName')
                    : t('featureFlags.displayName')
                }
                value={newFlag.displayName || ''}
                onChange={(e) => setNewFlag({ ...newFlag, displayName: e.target.value })}
                helperText={
                  newFlag.flagType === 'remoteConfig'
                    ? t('featureFlags.remoteConfigDisplayNameHelp')
                    : t('featureFlags.displayNameHelp')
                }
              />
            </Box>

            {/* Expandable Description + Tags buttons */}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {!showCreateDescription && !newFlag.description && (
                <Button
                  size="small"
                  onClick={() => setShowCreateDescription(true)}
                  sx={{ textTransform: 'none', color: 'text.secondary', fontSize: '0.8rem' }}
                >
                  {t('common.addDescription')}
                </Button>
              )}
              {!showCreateTags && !newFlag.tags?.length && (
                <Button
                  size="small"
                  onClick={() => setShowCreateTags(true)}
                  sx={{ textTransform: 'none', color: 'text.secondary', fontSize: '0.8rem' }}
                >
                  + {t('common.addTag')}
                </Button>
              )}
            </Box>

            {/* Collapsible Description */}
            {(showCreateDescription || !!newFlag.description) && (
              <TextField
                fullWidth
                multiline
                rows={3}
                label={t('featureFlags.description')}
                value={newFlag.description}
                onChange={(e) => setNewFlag({ ...newFlag, description: e.target.value })}
                helperText={
                  newFlag.flagType === 'remoteConfig'
                    ? t('featureFlags.remoteConfigDescriptionHelp')
                    : t('featureFlags.descriptionHelp')
                }
              />
            )}

            {/* Collapsible Tags */}
            {(showCreateTags || !!newFlag.tags?.length) && (
              <Autocomplete
                multiple
                size="small"
                options={allTags.map((tag) => tag.name)}
                value={newFlag.tags}
                onChange={(_, newValue) => setNewFlag({ ...newFlag, tags: newValue })}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={t('featureFlags.tags')}
                    placeholder={t('featureFlags.selectTags')}
                    helperText={t('featureFlags.tagsHelp')}
                  />
                )}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => {
                    const tag = allTags.find((t) => t.name === option);
                    return (
                      <Chip
                        {...getTagProps({ index })}
                        key={option}
                        label={option}
                        size="small"
                        sx={{
                          bgcolor: tag?.color || '#888',
                          color: getContrastColor(tag?.color || '#888'),
                        }}
                      />
                    );
                  })
                }
              />
            )}

            <Divider />

            {/* Flag Type - only shown for generic feature flag mode */}
            {createFlagTypeMode && (
              <FormControl fullWidth>
                <InputLabel>{t('featureFlags.flagType')}</InputLabel>
                <Select
                  value={newFlag.flagType}
                  label={t('featureFlags.flagType')}
                  onChange={(e) =>
                    setNewFlag({
                      ...newFlag,
                      flagType: e.target.value as FlagType,
                    })
                  }
                >
                  <MenuItem value="release">
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                      <Box sx={{ mt: 0.3 }}>
                        <ReleaseIcon sx={{ fontSize: 18 }} color="primary" />
                      </Box>
                      <Box>
                        <Typography variant="body2" fontWeight={500}>
                          {t('featureFlags.types.release')}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: 'block' }}
                        >
                          {t('featureFlags.flagTypes.release.desc')}
                        </Typography>
                      </Box>
                    </Box>
                  </MenuItem>
                  <MenuItem value="experiment">
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                      <Box sx={{ mt: 0.3 }}>
                        <ExperimentIcon sx={{ fontSize: 18 }} color="secondary" />
                      </Box>
                      <Box>
                        <Typography variant="body2" fontWeight={500}>
                          {t('featureFlags.types.experiment')}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: 'block' }}
                        >
                          {t('featureFlags.flagTypes.experiment.desc')}
                        </Typography>
                      </Box>
                    </Box>
                  </MenuItem>
                  <MenuItem value="operational">
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                      <Box sx={{ mt: 0.3 }}>
                        <OperationalIcon sx={{ fontSize: 18 }} color="warning" />
                      </Box>
                      <Box>
                        <Typography variant="body2" fontWeight={500}>
                          {t('featureFlags.types.operational')}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: 'block' }}
                        >
                          {t('featureFlags.flagTypes.operational.desc')}
                        </Typography>
                      </Box>
                    </Box>
                  </MenuItem>
                  <MenuItem value="killSwitch">
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                      <Box sx={{ mt: 0.3 }}>
                        <KillSwitchIcon sx={{ fontSize: 18 }} color="error" />
                      </Box>
                      <Box>
                        <Typography variant="body2" fontWeight={500}>
                          {t('featureFlags.types.killSwitch')}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: 'block' }}
                        >
                          {t('featureFlags.flagTypes.killSwitch.desc')}
                        </Typography>
                      </Box>
                    </Box>
                  </MenuItem>
                  <MenuItem value="permission">
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                      <Box sx={{ mt: 0.3 }}>
                        <PermissionIcon sx={{ fontSize: 18 }} color="action" />
                      </Box>
                      <Box>
                        <Typography variant="body2" fontWeight={500}>
                          {t('featureFlags.types.permission')}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: 'block' }}
                        >
                          {t('featureFlags.flagTypes.permission.desc')}
                        </Typography>
                      </Box>
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>
            )}

            {/* Value Settings Group */}
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Stack spacing={2}>
                {/* Value Type */}
                <Box>
                  <Typography
                    variant="subtitle2"
                    sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}
                  >
                    {t('featureFlags.valueType')}
                    <Tooltip title={t('featureFlags.valueTypeHelp')}>
                      <HelpOutlineIcon fontSize="small" color="action" />
                    </Tooltip>
                  </Typography>
                  <FormControl size="small" fullWidth>
                    <Select
                      value={newFlag.valueType}
                      onChange={(e) => {
                        const newType = e.target.value as 'boolean' | 'string' | 'json' | 'number';
                        setNewFlag((prev) => ({
                          ...prev,
                          valueType: newType,
                          enabledValue:
                            newType === 'boolean'
                              ? true
                              : newType === 'number'
                                ? 0
                                : newType === 'json'
                                  ? {}
                                  : '',
                          disabledValue:
                            newType === 'boolean'
                              ? false
                              : newType === 'number'
                                ? 0
                                : newType === 'json'
                                  ? {}
                                  : '',
                        }));
                        if (newType !== 'json') {
                          setNewFlagJsonError(null);
                        }
                      }}
                    >
                      <MenuItem value="boolean">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <FieldTypeIcon type="boolean" size={16} />
                          {t('featureFlags.valueTypes.boolean')}
                        </Box>
                      </MenuItem>
                      <MenuItem value="string">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <FieldTypeIcon type="string" size={16} />
                          {t('featureFlags.valueTypes.string')}
                        </Box>
                      </MenuItem>
                      <MenuItem value="number">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <FieldTypeIcon type="number" size={16} />
                          {t('featureFlags.valueTypes.number')}
                        </Box>
                      </MenuItem>
                      <MenuItem value="json">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <FieldTypeIcon type="json" size={16} />
                          {t('featureFlags.valueTypes.json')}
                        </Box>
                      </MenuItem>
                    </Select>
                  </FormControl>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                    {t('featureFlags.valueTypeCannotChange')}
                  </Typography>
                </Box>

                {/* Enabled Value */}
                <Box>
                  <Typography
                    variant="subtitle2"
                    sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}
                  >
                    {t('featureFlags.enabledValue')}
                    <Tooltip title={t('featureFlags.enabledValueHelp')}>
                      <HelpOutlineIcon fontSize="small" color="action" />
                    </Tooltip>
                  </Typography>
                  {newFlag.valueType === 'boolean' ? (
                    <BooleanSwitch
                      checked={newFlag.enabledValue === true || newFlag.enabledValue === 'true'}
                      onChange={(e) =>
                        setNewFlag((prev) => ({ ...prev, enabledValue: e.target.checked }))
                      }
                    />
                  ) : newFlag.valueType === 'number' ? (
                    <TextField
                      fullWidth
                      size="small"
                      type="number"
                      value={newFlag.enabledValue}
                      onChange={(e) =>
                        setNewFlag((prev) => ({
                          ...prev,
                          enabledValue: Number(e.target.value),
                        }))
                      }
                    />
                  ) : (
                    <ValueEditorField
                      value={newFlag.enabledValue}
                      onChange={(val) => setNewFlag((prev) => ({ ...prev, enabledValue: val }))}
                      valueType={newFlag.valueType}
                      label={t('featureFlags.enabledValue')}
                      onValidationError={(err) => setNewFlagJsonError(err)}
                    />
                  )}
                </Box>

                {/* Disabled Value */}
                <Box>
                  <Typography
                    variant="subtitle2"
                    sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}
                  >
                    {t('featureFlags.disabledValue')}
                    <Tooltip title={t('featureFlags.disabledValueHelp')}>
                      <HelpOutlineIcon fontSize="small" color="action" />
                    </Tooltip>
                  </Typography>
                  {newFlag.valueType === 'boolean' ? (
                    <BooleanSwitch
                      checked={newFlag.disabledValue === true || newFlag.disabledValue === 'true'}
                      onChange={(e) =>
                        setNewFlag((prev) => ({ ...prev, disabledValue: e.target.checked }))
                      }
                    />
                  ) : newFlag.valueType === 'number' ? (
                    <TextField
                      fullWidth
                      size="small"
                      type="number"
                      value={newFlag.disabledValue}
                      onChange={(e) =>
                        setNewFlag((prev) => ({
                          ...prev,
                          disabledValue: Number(e.target.value),
                        }))
                      }
                    />
                  ) : (
                    <ValueEditorField
                      value={newFlag.disabledValue}
                      onChange={(val) => setNewFlag((prev) => ({ ...prev, disabledValue: val }))}
                      valueType={newFlag.valueType}
                      label={t('featureFlags.disabledValue')}
                      onValidationError={(err) => setNewFlagJsonError(err)}
                    />
                  )}
                </Box>
              </Stack>
            </Paper>

            {/* Impression Data - hidden for remote config */}
            {newFlag.flagType !== 'remoteConfig' && (
              <Box>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Typography variant="body2">{t('featureFlags.impressionData')}</Typography>
                  <Switch
                    checked={newFlag.impressionDataEnabled}
                    onChange={(e) =>
                      setNewFlag({
                        ...newFlag,
                        impressionDataEnabled: e.target.checked,
                      })
                    }
                  />
                </Box>
                <Typography variant="caption" color="text.secondary">
                  {t('featureFlags.impressionDataHelp')}
                </Typography>
              </Box>
            )}

            {/* Info Alert */}
            <Alert severity="info">
              {newFlag.flagType === 'remoteConfig'
                ? t('featureFlags.remoteConfigCreateDetailSettingsInfo')
                : t('featureFlags.createFlagDetailSettingsInfo')}
            </Alert>
          </Stack>
        </Box>

        {/* Footer Actions */}
        <Box
          sx={{
            p: 2,
            borderTop: 1,
            borderColor: 'divider',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 1,
          }}
        >
          <Button onClick={() => setCreateDialogOpen(false)} disabled={creating}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateFlag}
            disabled={
              creating ||
              !newFlag.flagName.trim() ||
              (newFlag.valueType === 'json' && newFlagJsonError !== null)
            }
            startIcon={creating ? <CircularProgress size={20} /> : undefined}
          >
            {newFlag.flagType === 'remoteConfig'
              ? t('featureFlags.createRemoteConfig')
              : t('featureFlags.createFlag')}
          </Button>
        </Box>
      </ResizableDrawer>

      {/* Column Settings Dialog */}
      <ColumnSettingsDialog
        open={Boolean(columnSettingsAnchor)}
        anchorEl={columnSettingsAnchor}
        columns={columns}
        onColumnsChange={handleColumnsChange}
        onReset={handleResetColumns}
        onClose={() => setColumnSettingsAnchor(null)}
      />

      {/* Import/Export Menu */}
      <Menu
        anchorEl={importExportMenuAnchor}
        open={Boolean(importExportMenuAnchor)}
        onClose={() => setImportExportMenuAnchor(null)}
      >
        {/* Export section */}
        <MenuItem disabled sx={{ opacity: 1, pointerEvents: 'none' }}>
          <ListItemIcon>
            <ExportIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>
            <Typography variant="subtitle2" color="text.secondary">
              {t('featureFlags.export')}
            </Typography>
          </ListItemText>
        </MenuItem>
        {environments.map((env) => (
          <MenuItem
            key={`export-${env.environment}`}
            onClick={() => handleExport(env.environment)}
            sx={{ pl: 4 }}
          >
            <ListItemIcon>
              <Chip
                size="small"
                sx={{
                  bgcolor: env.color || '#888',
                  color: getContrastColor(env.color || '#888'),
                  width: 20,
                  height: 20,
                  '& .MuiChip-label': { display: 'none' },
                }}
              />
            </ListItemIcon>
            <ListItemText>{env.displayName}</ListItemText>
          </MenuItem>
        ))}
        <Divider />
        {/* Import section */}
        <MenuItem
          onClick={() => {
            setImportExportMenuAnchor(null);
            setImportDialogOpen(true);
          }}
          disabled={!canManage}
        >
          <ListItemIcon>
            <ImportIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('featureFlags.import')}</ListItemText>
        </MenuItem>
      </Menu>

      {/* Import Dialog */}
      <Dialog
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>{t('featureFlags.import')}</DialogTitle>
        <DialogContent>
          <Box
            sx={{
              mb: 2,
              mt: 1,
              p: 3,
              border: '2px dashed',
              borderColor: 'divider',
              borderRadius: 2,
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              '&:hover': {
                borderColor: 'primary.main',
                bgcolor: 'action.hover',
              },
              '&.drag-active': {
                borderColor: 'primary.main',
                bgcolor: 'primary.main',
                opacity: 0.1,
              },
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              e.currentTarget.classList.add('drag-active');
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              e.currentTarget.classList.remove('drag-active');
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              e.currentTarget.classList.remove('drag-active');
              const file = e.dataTransfer.files[0];
              if (file && file.name.endsWith('.json')) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                  setImportData(ev.target?.result as string);
                };
                reader.readAsText(file);
              }
            }}
          >
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {t('featureFlags.importDescription')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t('featureFlags.importDragDrop')}
            </Typography>
            <Button variant="outlined" component="label" startIcon={<ImportIcon />}>
              {t('featureFlags.selectFile')}
              <input type="file" accept=".json" hidden onChange={handleImportFileChange} />
            </Button>
          </Box>
          <TextField
            multiline
            rows={10}
            fullWidth
            value={importData}
            onChange={(e) => setImportData(e.target.value)}
            placeholder={t('featureFlags.importPlaceholder')}
            sx={{ fontFamily: 'monospace' }}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setImportDialogOpen(false);
              setImportData('');
            }}
            disabled={importing}
          >
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            onClick={handleImport}
            disabled={importing || !importData.trim()}
            startIcon={importing ? <CircularProgress size={20} /> : undefined}
          >
            {t('featureFlags.import')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Playground Dialog */}
      <PlaygroundDialog
        open={playgroundOpen}
        onClose={() => {
          setPlaygroundOpen(false);
          setPlaygroundInitialFlags([]);
          setPlaygroundAutoExecute(false);
        }}
        initialFlags={playgroundInitialFlags}
        autoExecute={playgroundAutoExecute}
      />
    </Box>
  );
};

export default FeatureFlagsPage;
