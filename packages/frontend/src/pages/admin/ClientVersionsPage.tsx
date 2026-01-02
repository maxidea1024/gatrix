import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { devLogger, prodLogger } from '../../utils/logger';
import { usePageState } from '../../hooks/usePageState';
import { useClientVersions, useAvailableVersions, useTags, mutateClientVersions } from '../../hooks/useSWR';
import { useAuth } from '../../hooks/useAuth';
import { PERMISSIONS } from '../../types/permissions';
import * as XLSX from 'xlsx';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Menu,
  Paper,
  IconButton,
  TableSortLabel,
  Checkbox,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  Fab,
  FormControl,
  InputLabel,
  Select,
  LinearProgress,
  Alert,
  Autocomplete,
  TextField,
  Divider,
  Drawer,
  Switch,
  FormControlLabel,
  Stack,
  Skeleton,
  CircularProgress,
  Popover,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ClickAwayListener,
} from '@mui/material';
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
import {
  Add as AddIcon,

  Edit as EditIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  ArrowDropDown as ArrowDropDownIcon,
  TableChart as TableChartIcon,
  Code as JsonIcon,
  Code as CodeIcon,
  Description as ExcelIcon,

  ContentCopy as CopyIcon,
  Cancel as CancelIcon,
  Close as CloseIcon,
  Update as UpdateIcon,
  Settings as SettingsIcon,
  Build as BuildIcon,
  Widgets as WidgetsIcon,
  Search as SearchIcon,
  ViewColumn as ViewColumnIcon,
  DragIndicator as DragIndicatorIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
} from '@mui/icons-material';
import { InputAdornment } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import { messageTemplateService, MessageTemplate } from '@/services/messageTemplateService';
import MultiLanguageMessageInput, { MessageLocale, MultiLanguageMessageInputRef } from '@/components/common/MultiLanguageMessageInput';
import { useTheme } from '@mui/material/styles';
import { tagService, Tag } from '../../services/tagService';
import {
  ClientVersion,
  ClientVersionFilters,
  ClientStatus,
  ClientStatusLabels,
  ClientStatusColors,
  BulkStatusUpdateRequest,
} from '../../types/clientVersion';
import { ClientVersionService } from '../../services/clientVersionService';
import ClientVersionForm from '../../components/admin/ClientVersionForm';
import BulkClientVersionForm from '../../components/admin/BulkClientVersionForm';
import PlatformDefaultsDialog from '../../components/admin/PlatformDefaultsDialog';
import { formatDateTimeDetailed, parseUTCForPicker } from '../../utils/dateFormat';
import { copyToClipboardWithNotification } from '../../utils/clipboard';
import SimplePagination from '../../components/common/SimplePagination';
import EmptyTableRow from '../../components/common/EmptyTableRow';
import DynamicFilterBar, { FilterDefinition, ActiveFilter } from '../../components/common/DynamicFilterBar';
import ClientVersionGuideDrawer from '../../components/admin/ClientVersionGuideDrawer';
import { usePlatformConfig } from '../../contexts/PlatformConfigContext';
import { getContrastColor } from '@/utils/colorUtils';

// HSVÎ•?RGBÎ°?Î≥Ä?òÌïò???®Ïàò
const hsvToRgb = (h: number, s: number, v: number): [number, number, number] => {
  const c = v * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = v - c;

  let r = 0, g = 0, b = 0;

  if (0 <= h && h < 60) {
    r = c; g = x; b = 0;
  } else if (60 <= h && h < 120) {
    r = x; g = c; b = 0;
  } else if (120 <= h && h < 180) {
    r = 0; g = c; b = x;
  } else if (180 <= h && h < 240) {
    r = 0; g = x; b = c;
  } else if (240 <= h && h < 300) {
    r = x; g = 0; b = c;
  } else if (300 <= h && h < 360) {
    r = c; g = 0; b = x;
  }

  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255)
  ];
};

// Î≤ÑÏ†ÑÎ≥??âÏÉÅ??HSV Í∏∞Î∞ò?ºÎ°ú ?§Ïñë?òÍ≤å ?ùÏÑ±?òÎäî ?®Ïàò (?©Í∏àÎπ??úÏö©)
const getVersionColorStyle = (version: string, isDarkMode: boolean = false): { backgroundColor: string; color: string } => {
  // Í∞úÏÑ†???¥Ïãú ?®Ïàò (??Í∑†Îì±??Î∂ÑÌè¨)
  let hash = 0;
  for (let i = 0; i < version.length; i++) {
    const char = version.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 32ÎπÑÌä∏ ?ïÏàòÎ°?Î≥Ä??  }

  // ?©Í∏àÎπ?? ??0.618)Î•??úÏö©???âÏÉÅ Î∂ÑÌè¨Î°???Í∑†Îì±?òÍ≥† ?ÑÎ¶Ñ?§Ïö¥ ?âÏÉÅ ?ùÏÑ±
  const goldenRatio = 0.618033988749;
  const baseHue = (Math.abs(hash) * goldenRatio) % 1; // 0-1 ?¨Ïù¥ Í∞?  const hue = baseHue * 360; // 0-359?ÑÎ°ú Î≥Ä??
  // ?¥Ïãú???§Î•∏ Î∂ÄÎ∂ÑÏùÑ ?úÏö©??Ï±ÑÎèÑ?Ä Î™ÖÎèÑ Î≥Ä??  const saturationSeed = Math.abs(hash >> 8);
  const valueSeed = Math.abs(hash >> 16);

  // ?§ÌÅ¨Î™®Îìú???∞Îùº Ï±ÑÎèÑ?Ä Î™ÖÎèÑ Ï°∞Ï†ï
  let saturation, value;
  if (isDarkMode) {
    // ?§ÌÅ¨Î™®Îìú: ?†Î™Ö?òÎ©¥?úÎèÑ ?àÏóê Î∂Ä???ÜÎäî ?âÏÉÅ
    saturation = 0.75 + (saturationSeed % 20) / 100; // 75-95% Ï±ÑÎèÑ
    value = 0.65 + (valueSeed % 25) / 100; // 65-90% Î™ÖÎèÑ
  } else {
    // ?ºÏù¥?∏Î™®?? Î∞ùÍ≥† ÍπîÎÅî???âÏÉÅ
    saturation = 0.70 + (saturationSeed % 25) / 100; // 70-95% Ï±ÑÎèÑ
    value = 0.80 + (valueSeed % 15) / 100; // 80-95% Î™ÖÎèÑ
  }

  // HSVÎ•?RGBÎ°?Î≥Ä??  const [r, g, b] = hsvToRgb(hue, saturation, value);

  // Î∞∞Í≤Ω???ùÏÑ±
  const backgroundColor = `rgb(${r}, ${g}, ${b})`;

  // WCAG 2.1 Í∏∞Ï????∞Î•∏ ???ïÌôï???ÄÎπ?Í≥ÑÏÇ∞
  const sRGB = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  const luminance = 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2];

  // 4.5:1 ?ÄÎπÑÏú®???ÑÌïú ?çÏä§???âÏÉÅ Í≤∞Ï†ï
  const textColor = luminance > 0.179 ? '#000000' : '#ffffff';

  return {
    backgroundColor,
    color: textColor
  };
};

// Í∏∞Ï°¥ MUI ?âÏÉÅ ?úÏä§?úÍ≥º???∏Ìôò?±ÏùÑ ?ÑÌïú ?®Ïàò (fallback??
const getVersionColor = (version: string): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
  // Í∞ÑÎã®???¥Ïãú ?®Ïàò
  let hash = 0;
  for (let i = 0; i < version.length; i++) {
    const char = version.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 32ÎπÑÌä∏ ?ïÏàòÎ°?Î≥Ä??  }

  // ?¨Ïö© Í∞Ä?•Ìïú ?âÏÉÅ Î∞∞Ïó¥
  const colors: Array<'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'> = [
    'primary', 'secondary', 'error', 'info', 'success', 'warning'
  ];

  // ?¥ÏãúÍ∞íÏùÑ ?âÏÉÅ ?∏Îç±?§Î°ú Î≥Ä??  const colorIndex = Math.abs(hash) % colors.length;
  return colors[colorIndex];
};

// Column definition interface
interface ColumnConfig {
  id: string;
  labelKey: string;
  visible: boolean;
  width?: string;
}

// Sortable list item component for drag and drop
interface SortableColumnItemProps {
  column: ColumnConfig;
  onToggleVisibility: (id: string) => void;
}

const SortableColumnItem: React.FC<SortableColumnItemProps> = ({ column, onToggleVisibility }) => {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <ListItem
      ref={setNodeRef}
      style={style}
      disablePadding
      secondaryAction={
        <Box {...attributes} {...listeners} sx={{ cursor: 'grab', display: 'flex', alignItems: 'center', '&:active': { cursor: 'grabbing' } }}>
          <DragIndicatorIcon sx={{ color: 'text.disabled', fontSize: 20 }} />
        </Box>
      }
    >
      <ListItemButton
        dense
        onClick={() => onToggleVisibility(column.id)}
        sx={{ pr: 6 }}
      >
        <Checkbox
          edge="start"
          checked={column.visible}
          tabIndex={-1}
          disableRipple
          size="small"
          icon={<VisibilityOffIcon fontSize="small" />}
          checkedIcon={<VisibilityIcon fontSize="small" />}
        />
        <ListItemText
          primary={t(column.labelKey)}
          slotProps={{ primary: { variant: 'body2' } }}
        />
      </ListItemButton>
    </ListItem>
  );
};

const ClientVersionsPage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const theme = useTheme();
  const { platforms } = usePlatformConfig();
  const { hasPermission } = useAuth();
  const canManage = hasPermission([PERMISSIONS.CLIENT_VERSIONS_MANAGE]);

  // ?òÏù¥ÏßÄ ?ÅÌÉú Í¥ÄÎ¶?(localStorage ?∞Îèô)
  const {
    pageState,
    updatePage,
    updateLimit,
    updateSort,
    updateFilters,
  } = usePageState({
    defaultState: {
      page: 1,
      limit: 10,
      sortBy: 'clientVersion',
      sortOrder: 'DESC',
      filters: {},
    },
    storageKey: 'clientVersionsPage',
  });

  // SWRÎ°??∞Ïù¥??Î°úÎî©
  const { data: clientVersionsData, error: clientVersionsError, isLoading: isLoadingVersions, mutate: mutateVersions } = useClientVersions(
    pageState.page,
    pageState.limit,
    pageState.sortBy,
    pageState.sortOrder as 'ASC' | 'DESC',
    pageState.filters
  );

  const { data: availableVersions, isLoading: isLoadingAvailableVersions } = useAvailableVersions();
  const { data: allTags, isLoading: isLoadingTags } = useTags();

  // Derived state from SWR
  const clientVersions = useMemo(() => clientVersionsData?.clientVersions || [], [clientVersionsData]);
  const total = useMemo(() => clientVersionsData?.total || 0, [clientVersionsData]);
  const versions = useMemo(() => availableVersions || [], [availableVersions]);
  const loading = isLoadingVersions || isLoadingAvailableVersions || isLoadingTags;

  // Ï¥àÍ∏∞ Î°úÎî© ?ÅÌÉú Ï∂îÏ†Å
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  useEffect(() => {
    if (!loading && isInitialLoad) {
      setIsInitialLoad(false);
    }
  }, [loading, isInitialLoad]);

  // ?†ÌÉù Í¥ÄÎ¶?  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [selectAll, setSelectAll] = useState(false);

  // ?§Ïù¥?ºÎ°úÍ∑?  const [selectedClientVersion, setSelectedClientVersion] = useState<ClientVersion | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bulkStatusDialogOpen, setBulkStatusDialogOpen] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<ClientStatus>(ClientStatus.ONLINE);

  // ?êÍ? Í¥Ä???ÅÌÉú
  const [maintenanceStartDate, setMaintenanceStartDate] = useState<string>('');
  const [maintenanceEndDate, setMaintenanceEndDate] = useState<string>('');

  // Î©îÏãúÏßÄ ?ÖÎ†• Î∞©Ïãù
  const [inputMode, setInputMode] = useState<'direct' | 'template'>('direct');

  // ÏßÅÏ†ë ?ÖÎ†•
  const [maintenanceMessage, setMaintenanceMessage] = useState<string>('');
  const [supportsMultiLanguage, setSupportsMultiLanguage] = useState(false);
  const [maintenanceLocales, setMaintenanceLocales] = useState<MessageLocale[]>([]);

  // ?úÌîåÎ¶??†ÌÉù
  const [messageTemplates, setMessageTemplates] = useState<MessageTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | ''>('');
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [bulkFormDialogOpen, setBulkFormDialogOpen] = useState(false);
  const [platformDefaultsDialogOpen, setPlatformDefaultsDialogOpen] = useState(false);
  const [editingClientVersion, setEditingClientVersion] = useState<ClientVersion | null>(null);
  const [isCopyMode, setIsCopyMode] = useState(false);


  // ?úÍ∑∏ Í¥Ä???ÅÌÉú
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [selectedClientVersionForTags, setSelectedClientVersionForTags] = useState<ClientVersion | null>(null);
  const [clientVersionTags, setClientVersionTags] = useState<Tag[]>([]);

  // ?ôÏ†Å ?ÑÌÑ∞ ?ÅÌÉú
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);
  const [filtersInitialized, setFiltersInitialized] = useState(false);

  // ?¥Î≥¥?¥Í∏∞ Î©îÎâ¥ ?ÅÌÉú
  const [exportMenuAnchor, setExportMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedExportMenuAnchor, setSelectedExportMenuAnchor] = useState<null | HTMLElement>(null);

  // SDK Í∞Ä?¥Îìú ?ÅÌÉú
  const [openSDKGuide, setOpenSDKGuide] = useState(false);

  // Default column configuration
  const defaultColumns: ColumnConfig[] = [
    { id: 'clientVersion', labelKey: 'clientVersions.clientVersion', visible: true },
    { id: 'platform', labelKey: 'clientVersions.platform', visible: true },
    { id: 'clientStatus', labelKey: 'clientVersions.clientStatus', visible: true },
    { id: 'gameServerAddress', labelKey: 'clientVersions.gameServerAddress', visible: true },
    { id: 'patchAddress', labelKey: 'clientVersions.patchAddress', visible: true },
    { id: 'guestModeAllowed', labelKey: 'clientVersions.guestModeAllowed', visible: true },
    { id: 'tags', labelKey: 'clientVersions.tags', visible: true },
    { id: 'createdAt', labelKey: 'clientVersions.createdAt', visible: true },
  ];

  // Column configuration state (persisted in localStorage)
  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    const saved = localStorage.getItem('clientVersionsColumns');
    if (saved) {
      try {
        const savedColumns = JSON.parse(saved);
        const mergedColumns = savedColumns.map((savedCol: ColumnConfig) => {
          const defaultCol = defaultColumns.find(c => c.id === savedCol.id);
          return defaultCol ? { ...defaultCol, ...savedCol } : savedCol;
        });
        const savedIds = new Set(savedColumns.map((c: ColumnConfig) => c.id));
        const newColumns = defaultColumns.filter(c => !savedIds.has(c.id));
        return [...mergedColumns, ...newColumns];
      } catch (e) {
        return defaultColumns;
      }
    }
    return defaultColumns;
  });

  // Column settings popover state
  const [columnSettingsAnchor, setColumnSettingsAnchor] = useState<HTMLButtonElement | null>(null);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Î©îÏãúÏßÄ ?úÌîåÎ¶?Î°úÎìú (SWRÎ°?Î≥ÄÍ≤??àÏ†ï?¥Ï?Îß??ºÎã® ?†Ï?)
  useEffect(() => {
    messageTemplateService.list({ isEnabled: true }).then(response => {
      setMessageTemplates(response.templates || []);
    }).catch(() => {
      setMessageTemplates([]);
    });
  }, []);





  // ?ÑÌÑ∞ Î≥ÄÍ≤??∏Îì§??  const handleFilterChange = useCallback((newFilters: ClientVersionFilters) => {
    updateFilters(newFilters);
  }, [updateFilters]);

  // ?ôÏ†Å ?ÑÌÑ∞ ?ïÏùò
  const availableFilterDefinitions: FilterDefinition[] = useMemo(() => [
    {
      key: 'version',
      label: t('clientVersions.version'),
      type: 'multiselect',
      operator: 'any_of',
      allowOperatorToggle: false,
      options: (versions || []).map(version => ({
        value: version,
        label: version,
      })),
    },
    {
      key: 'platform',
      label: t('clientVersions.platform'),
      type: 'multiselect',
      operator: 'any_of',
      allowOperatorToggle: false,
      options: platforms.map(platform => ({
        value: platform.value,
        label: platform.label,
      })),
    },
    {
      key: 'clientStatus',
      label: t('clientVersions.statusLabel'),
      type: 'multiselect',
      operator: 'any_of',
      allowOperatorToggle: false,
      options: Object.values(ClientStatus).map(status => ({
        value: status,
        label: t(ClientStatusLabels[status]),
      })),
    },
    {
      key: 'guestModeAllowed',
      label: t('clientVersions.guestMode'),
      type: 'multiselect',
      operator: 'any_of',
      allowOperatorToggle: false,
      options: [
        { value: true, label: t('common.yes') },
        { value: false, label: t('common.no') },
      ],
    },
    {
      key: 'tags',
      label: t('common.tags'),
      type: 'tags',
      operator: 'any_of',
      allowOperatorToggle: true,
      options: (allTags || []).map(tag => ({
        value: tag.id.toString(),
        label: tag.name,
        color: tag.color,
        description: tag.description || '',
      })),
    },
  ], [t, versions, allTags, platforms]);

  // ?ôÏ†Å ?ÑÌÑ∞ Ï∂îÍ? ?∏Îì§??  const handleFilterAdd = useCallback((filter: ActiveFilter) => {
    setActiveFilters(prev => [...prev, filter]);
  }, []);

  // ?ôÏ†Å ?ÑÌÑ∞ ?úÍ±∞ ?∏Îì§??  const handleFilterRemove = useCallback((filterKey: string) => {
    setActiveFilters(prev => prev.filter(f => f.key !== filterKey));
  }, []);

  // ?ôÏ†Å ?ÑÌÑ∞ Î≥ÄÍ≤??∏Îì§??  const handleDynamicFilterChange = useCallback((filterKey: string, value: any) => {
    setActiveFilters(prev =>
      prev.map(f => (f.key === filterKey ? { ...f, value } : f))
    );
  }, []);

  // ?ôÏ†Å ?ÑÌÑ∞ ?∞ÏÇ∞??Î≥ÄÍ≤??∏Îì§??  const handleOperatorChange = useCallback((filterKey: string, operator: 'any_of' | 'include_all') => {
    setActiveFilters(prev =>
      prev.map(f => (f.key === filterKey ? { ...f, operator } : f))
    );
  }, []);

  // Í≤Ä?âÏñ¥ Î≥ÄÍ≤??∏Îì§??  const handleSearchChange = useCallback((search: string) => {
    const newFilters: ClientVersionFilters = { search: search || undefined };

    // activeFiltersÎ•?newFilters??Î∞òÏòÅ
    activeFilters.forEach(filter => {
      if (filter.key === 'tags') {
        newFilters.tags = Array.isArray(filter.value) ? filter.value : [];
        newFilters.tagsOperator = filter.operator || 'any_of';
      } else {
        (newFilters as any)[filter.key] = filter.value;
      }
    });

    updateFilters(newFilters);
  }, [activeFilters, updateFilters]);

  // ?òÏù¥ÏßÄ Î°úÎìú ??pageState.filters?êÏÑú activeFilters Î≥µÏõê
  useEffect(() => {
    if (filtersInitialized) return;

    if (!pageState.filters || Object.keys(pageState.filters).length === 0) {
      setFiltersInitialized(true);
      return;
    }

    const restoredFilters: ActiveFilter[] = [];
    const filters = pageState.filters;

    // version ?ÑÌÑ∞ Î≥µÏõê
    if (filters.version) {
      restoredFilters.push({
        key: 'version',
        value: Array.isArray(filters.version) ? filters.version : [filters.version],
        label: t('clientVersions.version'),
        operator: 'any_of',
      });
    }

    // platform ?ÑÌÑ∞ Î≥µÏõê
    if (filters.platform) {
      restoredFilters.push({
        key: 'platform',
        value: Array.isArray(filters.platform) ? filters.platform : [filters.platform],
        label: t('clientVersions.platform'),
        operator: 'any_of',
      });
    }

    // clientStatus ?ÑÌÑ∞ Î≥µÏõê
    if (filters.clientStatus) {
      restoredFilters.push({
        key: 'clientStatus',
        value: Array.isArray(filters.clientStatus) ? filters.clientStatus : [filters.clientStatus],
        label: t('clientVersions.statusLabel'),
        operator: 'any_of',
      });
    }

    // guestModeAllowed ?ÑÌÑ∞ Î≥µÏõê
    if (filters.guestModeAllowed !== undefined) {
      restoredFilters.push({
        key: 'guestModeAllowed',
        value: Array.isArray(filters.guestModeAllowed) ? filters.guestModeAllowed : [filters.guestModeAllowed],
        label: t('clientVersions.guestMode'),
        operator: 'any_of',
      });
    }

    // tags ?ÑÌÑ∞ Î≥µÏõê
    if (filters.tags && filters.tags.length > 0) {
      restoredFilters.push({
        key: 'tags',
        value: Array.isArray(filters.tags) ? filters.tags : [filters.tags],
        label: t('common.tags'),
        operator: filters.tagsOperator || 'any_of',
      });
    }

    if (restoredFilters.length > 0) {
      setActiveFilters(restoredFilters);
    }
    setFiltersInitialized(true);
  }, [filtersInitialized, pageState.filters, t]);

  // activeFiltersÍ∞Ä Î≥ÄÍ≤ΩÎê† ?åÎßà??pageState.filters ?ÖÎç∞?¥Ìä∏
  useEffect(() => {
    if (!filtersInitialized) return; // Ï¥àÍ∏∞???ÑÏóê???§Ìñâ?òÏ? ?äÏùå

    const newFilters: ClientVersionFilters = {
      search: pageState.filters?.search, // Í≤Ä?âÏñ¥???†Ï?
    };

    activeFilters.forEach(filter => {
      if (filter.key === 'tags') {
        newFilters.tags = Array.isArray(filter.value) ? filter.value : [];
        newFilters.tagsOperator = filter.operator || 'any_of';
      } else {
        (newFilters as any)[filter.key] = filter.value;
      }
    });

    // ?ÑÌÑ∞Í∞Ä ?§Ï†úÎ°?Î≥ÄÍ≤ΩÎêò?àÏùÑ ?åÎßå ?ÖÎç∞?¥Ìä∏
    const currentFiltersStr = JSON.stringify(pageState.filters);
    const newFiltersStr = JSON.stringify(newFilters);
    if (currentFiltersStr !== newFiltersStr) {
      updateFilters(newFilters);
    }
  }, [activeFilters, filtersInitialized]); // pageState.filters?Ä updateFiltersÎ•??òÏ°¥?±Ïóê???úÍ±∞

  // ?ïÎ†¨?Ä Í≥†Ï†ï (Î≤ÑÏ†Ñ ?¥Î¶ºÏ∞®Ïàú, ?åÎû´???¥Î¶ºÏ∞®Ïàú)
  // ?ïÎ†¨ Î≥ÄÍ≤?Í∏∞Îä• ÎπÑÌôú?±Ìôî

  // ?òÏù¥ÏßÄ Î≥ÄÍ≤??∏Îì§??  const handlePageChange = useCallback((_: unknown, newPage: number) => {
    updatePage(newPage + 1); // MUI??0Î∂Ä???úÏûë, ?∞Î¶¨??1Î∂Ä???úÏûë
  }, [updatePage]);

  // ?òÏù¥ÏßÄ ?¨Í∏∞ Î≥ÄÍ≤??∏Îì§??  const handleRowsPerPageChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const newLimit = parseInt(event.target.value, 10);
    updateLimit(newLimit);
  }, [updateLimit]);

  // ?†ÌÉù Í¥ÄÎ¶?  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      setSelectedIds(clientVersions.map(cv => cv.id));
    } else {
      setSelectedIds([]);
    }
    setSelectAll(checked);
  }, [clientVersions]);

  const handleSelectOne = useCallback((id: number, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(selectedId => selectedId !== id));
      setSelectAll(false);
    }
  }, []);



  // ??†ú ?∏Îì§??  const handleDelete = useCallback(async () => {
    if (!selectedClientVersion) return;

    try {
      await ClientVersionService.deleteClientVersion(selectedClientVersion.id);
      enqueueSnackbar(t('clientVersions.deleteSuccess'), { variant: 'success' });
      setDeleteDialogOpen(false);
      setSelectedClientVersion(null);
      mutateVersions(); // SWR cache Í∞±Ïã†
      mutateClientVersions(); // Î™®Îì† client versions Ï∫êÏãú Í∞±Ïã†
    } catch (error: any) {
      console.error('Error deleting client version:', error);
      enqueueSnackbar(error.message || t('clientVersions.deleteError'), { variant: 'error' });
    }
  }, [selectedClientVersion, t, enqueueSnackbar, mutateVersions]);

  // ?ºÍ¥Ñ ?ÅÌÉú Î≥ÄÍ≤??∏Îì§??  const handleBulkStatusUpdate = useCallback(async () => {
    if (selectedIds.length === 0) return;

    // ?êÍ? ?ÅÌÉú?????ÑÏàò ?ÑÎìú Í≤ÄÏ¶?    if (bulkStatus === ClientStatus.MAINTENANCE) {
      if (inputMode === 'direct' && !maintenanceMessage.trim()) {
        enqueueSnackbar(t('clientVersions.maintenance.messageRequired'), { variant: 'error' });
        return;
      }
      if (inputMode === 'template' && !selectedTemplateId) {
        enqueueSnackbar(t('maintenance.selectTemplateRequired'), { variant: 'error' });
        return;
      }
    }

    try {
      const request: BulkStatusUpdateRequest = {
        ids: selectedIds,
        clientStatus: bulkStatus,
        // ?êÍ? ?ÅÌÉú???åÎßå ?êÍ? Í¥Ä???∞Ïù¥???¨Ìï®
        ...(bulkStatus === ClientStatus.MAINTENANCE && {
          maintenanceStartDate: maintenanceStartDate || undefined,
          maintenanceEndDate: maintenanceEndDate || undefined,
          ...(inputMode === 'direct' ? {
            maintenanceMessage: maintenanceMessage || undefined,
            supportsMultiLanguage: supportsMultiLanguage,
            maintenanceLocales: maintenanceLocales.filter(l => l.message.trim() !== ''),
          } : {
            messageTemplateId: selectedTemplateId,
          }),
        }),
      };

      const result = await ClientVersionService.bulkUpdateStatus(request);
      console.log('?îç Bulk update result:', result);

      // Î°úÏª¨?ºÏù¥ÏßïÎêú Î©îÏãúÏßÄ ?ùÏÑ±
      const updatedCount = result?.updatedCount || selectedIds.length;
      const successMessage = t('clientVersions.bulkStatusUpdated', { count: updatedCount });

      enqueueSnackbar(successMessage, { variant: 'success' });
      setBulkStatusDialogOpen(false);
      setSelectedIds([]);
      setSelectAll(false);
      // ?êÍ? Í¥Ä???ÅÌÉú Ï¥àÍ∏∞??      setMaintenanceStartDate('');
      setMaintenanceEndDate('');
      setMaintenanceMessage('');
      setSupportsMultiLanguage(false);
      setMaintenanceLocales([]);
      setInputMode('direct');
      setSelectedTemplateId('');
      mutateVersions(); // SWR cache Í∞±Ïã†
      mutateClientVersions(); // Î™®Îì† client versions Ï∫êÏãú Í∞±Ïã†
    } catch (error: any) {
      console.error('Error updating status:', error);
      enqueueSnackbar(error.message || t('clientVersions.statusUpdateError'), { variant: 'error' });
    }
  }, [selectedIds, bulkStatus, inputMode, maintenanceStartDate, maintenanceEndDate, maintenanceMessage, supportsMultiLanguage, maintenanceLocales, selectedTemplateId, enqueueSnackbar, mutateVersions, t]);



  // ?ºÍ¥Ñ ??†ú ?∏Îì§??  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.length === 0) return;

    try {
      await Promise.all(selectedIds.map(id => ClientVersionService.deleteClientVersion(id)));
      enqueueSnackbar(t('clientVersions.bulkDeleteSuccess', { count: selectedIds.length }), { variant: 'success' });
      setSelectedIds([]);
      setSelectAll(false);
      setBulkDeleteDialogOpen(false);
      mutateVersions(); // SWR cache Í∞±Ïã†
      mutateClientVersions(); // Î™®Îì† client versions Ï∫êÏãú Í∞±Ïã†
    } catch (error: any) {
      console.error('Failed to delete client versions:', error);
      enqueueSnackbar(error.message || t('clientVersions.bulkDeleteError'), { variant: 'error' });
    }
  }, [selectedIds, t, enqueueSnackbar, mutateVersions]);



  // ?¥Î≥¥?¥Í∏∞ ?®Ïàò??  const handleExport = useCallback(async (format: 'csv' | 'json' | 'xlsx') => {
    try {
      let blob: Blob;
      let filename: string;
      const now = new Date();
      const dateTimeStr = now.toISOString().replace(/[:.]/g, '-').slice(0, 19); // YYYY-MM-DDTHH-MM-SS

      if (format === 'csv') {
        blob = await ClientVersionService.exportToCSV(pageState.filters || {});
        filename = `client-versions-${dateTimeStr}.csv`;
      } else if (format === 'json') {
        // JSON ?¥Î≥¥?¥Í∏∞
        const result = await ClientVersionService.exportToCSV(pageState.filters || {}); // Í∞ôÏ? ?∞Ïù¥???¨Ïö©
        const text = await result.text();
        const lines = text.split('\n');
        const headers = lines[0].split(',');
        const jsonData = lines.slice(1).filter(line => line.trim()).map(line => {
          const values = line.split(',');
          const obj: any = {};
          headers.forEach((header, index) => {
            obj[header.replace(/"/g, '')] = values[index]?.replace(/"/g, '') || '';
          });
          return obj;
        });
        blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
        filename = `client-versions-${dateTimeStr}.json`;
      } else if (format === 'xlsx') {
        // XLSX ?¥Î≥¥?¥Í∏∞
        const result = await ClientVersionService.exportToCSV(pageState.filters || {});
        const text = await result.text();
        const lines = text.split('\n');
        const headers = lines[0].split(',').map(h => h.replace(/"/g, ''));
        const data = lines.slice(1).filter(line => line.trim()).map(line => {
          const values = line.split(',');
          const obj: any = {};
          headers.forEach((header, index) => {
            obj[header] = values[index]?.replace(/"/g, '') || '';
          });
          return obj;
        });

        // XLSX ?åÌÅ¨Î∂??ùÏÑ±
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Client Versions');

        // Ïª¨Îüº ?àÎπÑ ?êÎèô Ï°∞Ï†ï
        const colWidths = headers.map(header => ({ wch: Math.max(header.length, 15) }));
        worksheet['!cols'] = colWidths;

        // XLSX ?åÏùº ?ùÏÑ±
        const xlsxBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        blob = new Blob([xlsxBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        filename = `client-versions-${dateTimeStr}.xlsx`;
      } else {
        enqueueSnackbar('Unsupported export format', { variant: 'warning' });
        return;
      }

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      enqueueSnackbar(t('clientVersions.exportSuccess'), { variant: 'success' });
      setExportMenuAnchor(null);
    } catch (error: any) {
      console.error('Error exporting:', error);
      enqueueSnackbar(error.message || t('clientVersions.exportError'), { variant: 'error' });
    }
  }, [pageState.filters, t, enqueueSnackbar]);

  // ?†ÌÉù????™© ?¥Î≥¥?¥Í∏∞
  const handleExportSelected = useCallback(async (format: 'csv' | 'json' | 'xlsx') => {
    if (selectedIds.length === 0) return;

    try {
      const selectedVersions = clientVersions.filter(cv => selectedIds.includes(cv.id));
      let blob: Blob;
      let filename: string;
      const now = new Date();
      const dateTimeStr = now.toISOString().replace(/[:.]/g, '-').slice(0, 19); // YYYY-MM-DDTHH-MM-SS

      if (format === 'csv') {
        const csvContent = [
          // CSV ?§Îçî
          [
            'ID', 'Platform', 'Version', 'Status', 'Game Server', 'Game Server (Whitelist)',
            'Patch Address', 'Patch Address (Whitelist)', 'Guest Mode', 'External Click Link',
            'Memo', 'Custom Payload', 'Maintenance Start', 'Maintenance End', 'Maintenance Message',
            'Multi Language', 'Tags', 'Created By', 'Created By Email', 'Created At',
            'Updated By', 'Updated By Email', 'Updated At'
          ].join(','),
          // CSV ?∞Ïù¥??          ...selectedVersions.map(cv => [
            cv.id,
            `"${cv.platform}"`,
            `"${cv.clientVersion}"`,
            `"${cv.clientStatus}"`,
            `"${cv.gameServerAddress}"`,
            `"${cv.gameServerAddressForWhiteList || ''}"`,
            `"${cv.patchAddress}"`,
            `"${cv.patchAddressForWhiteList || ''}"`,
            cv.guestModeAllowed ? 'Yes' : 'No',
            `"${cv.externalClickLink || ''}"`,
            `"${cv.memo || ''}"`,
            `"${cv.customPayload || ''}"`,
            `"${cv.maintenanceStartDate || ''}"`,
            `"${cv.maintenanceEndDate || ''}"`,
            `"${cv.maintenanceMessage || ''}"`,
            cv.supportsMultiLanguage ? 'Yes' : 'No',
            `"${cv.tags ? cv.tags.map(tag => tag.name).join('; ') : ''}"`,
            `"${cv.createdByName || t('dashboard.unknown')}"`,
            `"${cv.createdByEmail || ''}"`,
            `"${new Date(cv.createdAt).toLocaleDateString()}"`,
            `"${cv.updatedByName || ''}"`,
            `"${cv.updatedByEmail || ''}"`,
            `"${new Date(cv.updatedAt).toLocaleDateString()}"`,
          ].join(','))
        ].join('\n');
        blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        filename = `client-versions-selected-${dateTimeStr}.csv`;
      } else if (format === 'json') {
        blob = new Blob([JSON.stringify(selectedVersions, null, 2)], { type: 'application/json' });
        filename = `client-versions-selected-${dateTimeStr}.json`;
      } else if (format === 'xlsx') {
        // XLSX ?¥Î≥¥?¥Í∏∞ - ?†ÌÉù????™©??        const headers = [
          'ID', 'Platform', 'Version', 'Status', 'Game Server', 'Game Server (Whitelist)',
          'Patch Address', 'Patch Address (Whitelist)', 'Guest Mode', 'External Click Link',
          'Memo', 'Custom Payload', 'Maintenance Start', 'Maintenance End', 'Maintenance Message',
          'Multi Language', 'Tags', 'Created By', 'Created By Email', 'Created At',
          'Updated By', 'Updated By Email', 'Updated At'
        ];

        const data = selectedVersions.map(cv => ({
          'ID': cv.id,
          'Platform': cv.platform,
          'Version': cv.clientVersion,
          'Status': cv.clientStatus,
          'Game Server': cv.gameServerAddress,
          'Game Server (Whitelist)': cv.gameServerAddressForWhiteList || '',
          'Patch Address': cv.patchAddress,
          'Patch Address (Whitelist)': cv.patchAddressForWhiteList || '',
          'Guest Mode': cv.guestModeAllowed ? 'Yes' : 'No',
          'External Click Link': cv.externalClickLink || '',
          'Memo': cv.memo || '',
          'Custom Payload': cv.customPayload || '',
          'Maintenance Start': cv.maintenanceStartDate || '',
          'Maintenance End': cv.maintenanceEndDate || '',
          'Maintenance Message': cv.maintenanceMessage || '',
          'Multi Language': cv.supportsMultiLanguage ? 'Yes' : 'No',
          'Tags': cv.tags ? cv.tags.map(tag => tag.name).join('; ') : '',
          'Created By': cv.createdByName || t('dashboard.unknown'),
          'Created By Email': cv.createdByEmail || '',
          'Created At': new Date(cv.createdAt).toLocaleDateString(),
          'Updated By': cv.updatedByName || '',
          'Updated By Email': cv.updatedByEmail || '',
          'Updated At': new Date(cv.updatedAt).toLocaleDateString(),
        }));

        // XLSX ?åÌÅ¨Î∂??ùÏÑ±
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Selected Client Versions');

        // Ïª¨Îüº ?àÎπÑ ?êÎèô Ï°∞Ï†ï
        const colWidths = headers.map(header => ({ wch: Math.max(header.length, 15) }));
        worksheet['!cols'] = colWidths;

        // XLSX ?åÏùº ?ùÏÑ±
        const xlsxBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        blob = new Blob([xlsxBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        filename = `client-versions-selected-${dateTimeStr}.xlsx`;
      } else {
        enqueueSnackbar('Unsupported export format', { variant: 'warning' });
        return;
      }

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      enqueueSnackbar(t('clientVersions.exportSuccess'), { variant: 'success' });
      setSelectedExportMenuAnchor(null);
    } catch (error: any) {
      console.error('Failed to export selected versions:', error);
      enqueueSnackbar(error.message || t('clientVersions.exportSelectedError'), { variant: 'error' });
    }
  }, [selectedIds, clientVersions, t, enqueueSnackbar]);

  // Î≤ÑÏ†Ñ Î≥µÏÇ¨ ?∏Îì§??  const handleCopyVersion = useCallback((clientVersion: ClientVersion) => {
    console.log('Copy button clicked for client version:', {
      id: clientVersion.id,
      clientVersion: clientVersion
    });

    // Î≥µÏÇ¨???∞Ïù¥??Ï§ÄÎπ?(Î≤ÑÏ†Ñ ?ÑÎìú??ÎπÑÏ?)
    const copiedData = {
      id: clientVersion.id, // ?ÅÏÑ∏ ?¨Ï°∞??maintenanceLocales ?¨Ìï®)Î•??ÑÌï¥ ?êÎ≥∏ idÎ•??ÑÎã¨. ?Ä???úÏóê??isCopyModeÎ°??†Í∑ú ?ùÏÑ± Ï≤òÎ¶¨??      platform: clientVersion.platform,
      clientVersion: '', // Î≤ÑÏ†Ñ?Ä ÎπÑÏõå??      clientStatus: clientVersion.clientStatus,
      gameServerAddress: clientVersion.gameServerAddress,
      gameServerAddressForWhiteList: clientVersion.gameServerAddressForWhiteList || '',
      patchAddress: clientVersion.patchAddress,
      patchAddressForWhiteList: clientVersion.patchAddressForWhiteList || '',
      guestModeAllowed: clientVersion.guestModeAllowed,
      externalClickLink: clientVersion.externalClickLink || '',
      memo: clientVersion.memo || '',
      customPayload: clientVersion.customPayload || '',
      maintenanceStartDate: clientVersion.maintenanceStartDate || '',
      maintenanceEndDate: clientVersion.maintenanceEndDate || '',
      maintenanceMessage: clientVersion.maintenanceMessage || '',
      supportsMultiLanguage: clientVersion.supportsMultiLanguage || false,
      maintenanceLocales: clientVersion.maintenanceLocales || [],
      tags: clientVersion.tags || [],
    };

    // ???§Ïù¥?ºÎ°úÍ∑∏Î? ?¥Í≥† Î≥µÏÇ¨???∞Ïù¥?∞Î°ú Ï¥àÍ∏∞??    console.log('Setting copied data:', copiedData);
    setEditingClientVersion(copiedData as any);
    setIsCopyMode(true);
    setFormDialogOpen(true);


  }, [t, enqueueSnackbar]);

  // ?úÍ∑∏ Í¥Ä???∏Îì§??  const handleOpenTagDialog = useCallback(async (clientVersion: ClientVersion) => {
    try {
      setSelectedClientVersionForTags(clientVersion);
      const tags = await ClientVersionService.getTags(clientVersion.id!);
      setClientVersionTags(tags);
      setTagDialogOpen(true);
    } catch (error) {
      console.error('Error loading client version tags:', error);
      enqueueSnackbar(t('common.error'), { variant: 'error' });
    }
  }, [t, enqueueSnackbar]);

  const handleSaveTags = useCallback(async (tagIds: number[]) => {
    if (!selectedClientVersionForTags?.id) return;

    try {
      await ClientVersionService.setTags(selectedClientVersionForTags.id, tagIds);
      setTagDialogOpen(false);
      enqueueSnackbar(t('common.success'), { variant: 'success' });
      // ?ÑÏöî??Î™©Î°ù ?àÎ°úÍ≥†Ïπ®
      mutateVersions(); // SWR cache Í∞±Ïã†
      mutateClientVersions(); // Î™®Îì† client versions Ï∫êÏãú Í∞±Ïã†
    } catch (error) {
      console.error('Error saving client version tags:', error);
      enqueueSnackbar(t('common.error'), { variant: 'error' });
    }
  }, [selectedClientVersionForTags, t, enqueueSnackbar, mutateVersions]);

  // Column settings handlers
  const handleToggleColumnVisibility = useCallback((columnId: string) => {
    const newColumns = columns.map(col =>
      col.id === columnId ? { ...col, visible: !col.visible } : col
    );
    setColumns(newColumns);
    localStorage.setItem('clientVersionsColumns', JSON.stringify(newColumns));
  }, [columns]);

  const handleResetColumns = useCallback(() => {
    setColumns(defaultColumns);
    localStorage.setItem('clientVersionsColumns', JSON.stringify(defaultColumns));
  }, []);

  const handleColumnDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = columns.findIndex((col) => col.id === active.id);
      const newIndex = columns.findIndex((col) => col.id === over.id);
      const newColumns = arrayMove(columns, oldIndex, newIndex);
      setColumns(newColumns);
      localStorage.setItem('clientVersionsColumns', JSON.stringify(newColumns));
    }
  }, [columns]);

  // Render cell content based on column ID
  const renderCellContent = useCallback((clientVersion: ClientVersion, columnId: string) => {
    switch (columnId) {
      case 'platform':
        return (
          <Chip
            label={clientVersion.platform}
            size="small"
            color="primary"
            variant="outlined"
          />
        );
      case 'clientVersion':
        return (
          <Chip
            label={clientVersion.clientVersion}
            size="small"
            variant="filled"
            sx={{
              ...getVersionColorStyle(clientVersion.clientVersion, theme.palette.mode === 'dark'),
              cursor: 'pointer',
              fontWeight: 600,
              borderRadius: '4px',
              '&:hover': {
                opacity: 0.8,
                transform: 'scale(1.05)',
                boxShadow: 2,
              },
              transition: 'all 0.2s ease-in-out',
            }}
            onClick={() => {
              setEditingClientVersion(clientVersion);
              setIsCopyMode(false);
              setFormDialogOpen(true);
            }}
          />
        );
      case 'clientStatus':
        return (
          <Chip
            label={t(ClientStatusLabels[clientVersion.clientStatus])}
            size="small"
            color={ClientStatusColors[clientVersion.clientStatus]}
          />
        );
      case 'gameServerAddress':
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
              {clientVersion.gameServerAddress}
            </Typography>
            <Tooltip title={t('common.copy')}>
              <IconButton
                size="small"
                onClick={async () => {
                  await copyToClipboardWithNotification(
                    clientVersion.gameServerAddress,
                    () => enqueueSnackbar(t('common.copiedToClipboard'), { variant: 'success' }),
                    () => enqueueSnackbar(t('common.copyFailed'), { variant: 'error' })
                  );
                }}
                sx={{ p: 0.5 }}
              >
                <CopyIcon sx={{ fontSize: '1.25rem' }} />
              </IconButton>
            </Tooltip>
          </Box>
        );
      case 'patchAddress':
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
              {clientVersion.patchAddress}
            </Typography>
            <Tooltip title={t('common.copy')}>
              <IconButton
                size="small"
                onClick={async () => {
                  await copyToClipboardWithNotification(
                    clientVersion.patchAddress,
                    () => enqueueSnackbar(t('common.copiedToClipboard'), { variant: 'success' }),
                    () => enqueueSnackbar(t('common.copyFailed'), { variant: 'error' })
                  );
                }}
                sx={{ p: 0.5 }}
              >
                <CopyIcon sx={{ fontSize: '1.25rem' }} />
              </IconButton>
            </Tooltip>
          </Box>
        );
      case 'guestModeAllowed':
        return (
          <Chip
            label={clientVersion.guestModeAllowed ? t('common.yes') : t('common.no')}
            size="small"
            color={clientVersion.guestModeAllowed ? 'success' : 'default'}
            variant="outlined"
          />
        );
      case 'tags':
        return (
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {clientVersion.tags && clientVersion.tags.length > 0 ? (
              clientVersion.tags.map((tag) => (
                <Chip
                  key={tag.id}
                  label={tag.name}
                  size="small"
                  sx={{
                    bgcolor: tag.color,
                    color: theme.palette.getContrastText(tag.color),
                  }}
                />
              ))
            ) : (
              <Typography variant="body2" color="text.secondary">-</Typography>
            )}
          </Box>
        );
      case 'createdAt':
        return (
          <Typography variant="body2">
            {formatDateTimeDetailed(clientVersion.createdAt)}
          </Typography>
        );
      default:
        return null;
    }
  }, [theme, t]);

  return (
    <Box sx={{ p: 3 }}>
      {/* ?§Îçî */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <WidgetsIcon sx={{ fontSize: 32, color: 'primary.main' }} />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {t('clientVersions.title')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('clientVersions.description')}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            endIcon={<ArrowDropDownIcon />}
            onClick={(e) => setExportMenuAnchor(e.currentTarget)}
          >
            {t('common.export')}
          </Button>
          <Menu
            anchorEl={exportMenuAnchor}
            open={Boolean(exportMenuAnchor)}
            onClose={() => setExportMenuAnchor(null)}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'left',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'left',
            }}
          >
            <MenuItem onClick={() => handleExport('csv')}>
              <TableChartIcon sx={{ mr: 1 }} />
              CSV
            </MenuItem>
            <MenuItem onClick={() => handleExport('json')}>
              <JsonIcon sx={{ mr: 1 }} />
              JSON
            </MenuItem>
            <MenuItem onClick={() => handleExport('xlsx')}>
              <ExcelIcon sx={{ mr: 1 }} />
              Excel (XLSX)
            </MenuItem>
          </Menu>
          {canManage && (
            <>
              <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
              <Button
                variant="contained"
                color="primary"
                startIcon={<AddIcon />}
                onClick={() => {
                  setEditingClientVersion(null);
                  setIsCopyMode(false);
                  setFormDialogOpen(true);
                }}
              >
                {t('clientVersions.addIndividual')}
              </Button>
              <Button
                variant="contained"
                color="primary"
                startIcon={<AddIcon />}
                onClick={() => {
                  setBulkFormDialogOpen(true);
                }}
              >
                {t('clientVersions.addBulk')}
              </Button>
              <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
              <Tooltip title={t('platformDefaults.title')}>
                <IconButton
                  aria-label={t('platformDefaults.title')}
                  onClick={() => {
                    setPlatformDefaultsDialogOpen(true);
                  }}
                  size="medium"
                >
                  <SettingsIcon />
                </IconButton>
              </Tooltip>
            </>
          )}
          <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
          <Button
            variant="outlined"
            startIcon={<CodeIcon />}
            onClick={() => setOpenSDKGuide(true)}
          >
            {t('clientVersions.sdkGuide')}
          </Button>
        </Box>
      </Box>

      {/* ?ÑÌÑ∞ */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Search */}
            <TextField
              placeholder={t('common.search')}
              value={pageState.filters?.search || ''}
              onChange={(e) => handleSearchChange(e.target.value)}
              sx={{
                minWidth: 200,
                flexGrow: 1,
                maxWidth: 320,
                '& .MuiOutlinedInput-root': {
                  height: '40px',
                  borderRadius: '20px',
                  bgcolor: 'background.paper',
                  transition: 'all 0.2s ease-in-out',
                  '& fieldset': {
                    borderColor: 'divider',
                  },
                  '&:hover': {
                    bgcolor: 'action.hover',
                    '& fieldset': {
                      borderColor: 'primary.light',
                    }
                  },
                  '&.Mui-focused': {
                    bgcolor: 'background.paper',
                    boxShadow: '0 0 0 2px rgba(25, 118, 210, 0.1)',
                    '& fieldset': {
                      borderColor: 'primary.main',
                      borderWidth: '1px',
                    }
                  }
                },
                '& .MuiInputBase-input': {
                  fontSize: '0.875rem',
                }
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
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
              <DynamicFilterBar
                availableFilters={availableFilterDefinitions}
                activeFilters={activeFilters}
                onFilterAdd={handleFilterAdd}
                onFilterRemove={handleFilterRemove}
                onFilterChange={handleDynamicFilterChange}
                onOperatorChange={handleOperatorChange}
              />

              {/* Column Settings Button */}
              <Tooltip title={t('users.columnSettings')}>
                <IconButton
                  onClick={(e) => setColumnSettingsAnchor(e.currentTarget)}
                  sx={{
                    bgcolor: 'background.paper',
                    border: 1,
                    borderColor: 'divider',
                    '&:hover': {
                      bgcolor: 'action.hover',
                    },
                  }}
                >
                  <ViewColumnIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* ?ºÍ¥Ñ ?ëÏóÖ ?¥Î∞î */}
      {selectedIds.length > 0 && (
        <Card sx={{ mb: 2, bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(110, 168, 255, 0.08)' : 'rgba(25, 118, 210, 0.04)' }}>
          <CardContent sx={{ py: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'space-between' }}>
              <Typography variant="body2" sx={{ fontWeight: 600, color: 'primary.main' }}>
                {t('clientVersions.selectedCount', { count: selectedIds.length })}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {canManage && (
                  <>
                    <Button
                      size="small"
                      variant="contained"
                      color="primary"
                      onClick={() => setBulkStatusDialogOpen(true)}
                      startIcon={<EditIcon />}
                    >
                      {t('clientVersions.changeStatus')}
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      color="error"
                      onClick={() => setBulkDeleteDialogOpen(true)}
                      startIcon={<DeleteIcon />}
                    >
                      {t('common.delete')}
                    </Button>
                  </>
                )}
                <Button
                  size="small"
                  variant="outlined"
                  onClick={(e) => setSelectedExportMenuAnchor(e.currentTarget)}
                  startIcon={<DownloadIcon />}
                  endIcon={<ArrowDropDownIcon />}
                >
                  {t('common.export')}
                </Button>
                <Menu
                  anchorEl={selectedExportMenuAnchor}
                  open={Boolean(selectedExportMenuAnchor)}
                  onClose={() => setSelectedExportMenuAnchor(null)}
                  anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'left',
                  }}
                  transformOrigin={{
                    vertical: 'top',
                    horizontal: 'left',
                  }}
                >
                  <MenuItem onClick={() => handleExportSelected('csv')}>
                    <TableChartIcon sx={{ mr: 1 }} />
                    CSV
                  </MenuItem>
                  <MenuItem onClick={() => handleExportSelected('json')}>
                    <JsonIcon sx={{ mr: 1 }} />
                    JSON
                  </MenuItem>
                  <MenuItem onClick={() => handleExportSelected('xlsx')}>
                    <ExcelIcon sx={{ mr: 1 }} />
                    Excel (XLSX)
                  </MenuItem>
                </Menu>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    setSelectedIds([]);
                    setSelectAll(false);
                  }}
                >
                  {t('common.clearSelection')}
                </Button>
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* ?åÏù¥Î∏?*/}
      <Card sx={{ position: 'relative' }}>
        <TableContainer
          sx={{
            opacity: !isInitialLoad && loading ? 0.5 : 1,
            transition: 'opacity 0.15s ease-in-out',
            pointerEvents: !isInitialLoad && loading ? 'none' : 'auto',
          }}
        >
          <Table sx={{ tableLayout: 'auto' }}>
            <TableHead>
              <TableRow>
                {canManage && (
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectAll}
                      indeterminate={selectedIds.length > 0 && selectedIds.length < clientVersions.length}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                    />
                  </TableCell>
                )}
                {columns.filter(col => col.visible).map((column) => (
                  <TableCell
                    key={column.id}
                    align={column.id === 'guestModeAllowed' ? 'center' : 'left'}
                    width={column.width}
                  >
                    {t(column.labelKey)}
                    {(column.id === 'clientVersion' || column.id === 'platform') && ' ??}
                  </TableCell>
                ))}
                <TableCell>{t('common.createdBy')}</TableCell>
                {canManage && <TableCell align="center">{t('common.actions')}</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {isInitialLoad && loading ? (
                // ?§Ïºà?àÌÜ§ Î°úÎî© (Ï¥àÍ∏∞ Î°úÎî© ?úÏóêÎß?
                Array.from({ length: 5 }).map((_, index) => (
                  <TableRow key={`skeleton-${index}`}>
                    {canManage && (
                      <TableCell padding="checkbox">
                        <Skeleton variant="rectangular" width={24} height={24} />
                      </TableCell>
                    )}
                    <TableCell>
                      <Skeleton variant="rounded" width={80} height={24} />
                    </TableCell>
                    <TableCell>
                      <Skeleton variant="rounded" width={60} height={24} />
                    </TableCell>
                    <TableCell>
                      <Skeleton variant="rounded" width={80} height={24} />
                    </TableCell>
                    <TableCell>
                      <Skeleton variant="text" width="80%" />
                    </TableCell>
                    <TableCell>
                      <Skeleton variant="text" width="70%" />
                    </TableCell>
                    <TableCell align="center">
                      <Skeleton variant="rounded" width={60} height={24} sx={{ mx: 'auto' }} />
                    </TableCell>
                    <TableCell>
                      <Skeleton variant="text" width="70%" />
                    </TableCell>
                    <TableCell>
                      <Skeleton variant="text" width="60%" />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Skeleton variant="rounded" width={60} height={24} />
                        <Skeleton variant="rounded" width={60} height={24} />
                      </Box>
                    </TableCell>
                    {canManage && (
                      <TableCell align="center">
                        <Skeleton variant="circular" width={32} height={32} sx={{ display: 'inline-block', mr: 0.5 }} />
                        <Skeleton variant="circular" width={32} height={32} sx={{ display: 'inline-block' }} />
                      </TableCell>
                    )}
                  </TableRow>
                ))
              ) : clientVersions.length === 0 ? (
                <EmptyTableRow
                  colSpan={canManage ? 12 : 10}
                  loading={false}
                  message={t('clientVersions.noVersionsFound')}
                  loadingMessage={t('common.loadingClientVersions')}
                  subtitle={canManage ? t('common.addFirstItem') : undefined}
                  onAddClick={canManage ? () => {
                    setEditingClientVersion(null);
                    setIsCopyMode(false);
                    setFormDialogOpen(true);
                  } : undefined}
                  addButtonLabel={t('clientVersions.addIndividual')}
                />
              ) : (
                clientVersions.map((clientVersion) => (
                  <TableRow
                    key={clientVersion.id}
                    selected={selectedIds.includes(clientVersion.id)}
                    hover
                  >
                    {canManage && (
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedIds.includes(clientVersion.id)}
                          onChange={(e) => handleSelectOne(clientVersion.id, e.target.checked)}
                        />
                      </TableCell>
                    )}
                    {columns.filter(col => col.visible).map((column) => (
                      <TableCell
                        key={column.id}
                        align={column.id === 'guestModeAllowed' ? 'center' : 'left'}
                        width={column.width}
                      >
                        {renderCellContent(clientVersion, column.id)}
                      </TableCell>
                    ))}
                    <TableCell>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {clientVersion.createdByName || t('dashboard.unknown')}
                        </Typography>
                        {clientVersion.createdByEmail && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            {clientVersion.createdByEmail}
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                        {canManage && (
                          <>
                            <Tooltip title={t('clientVersions.copyVersion')} arrow>
                              <IconButton
                                size="small"
                                onClick={() => handleCopyVersion(clientVersion)}
                                color="primary"
                                sx={{
                                  '&:hover': {
                                    backgroundColor: 'primary.light',
                                    color: 'white',
                                  },
                                }}
                              >
                                <CopyIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={t('common.edit')} arrow>
                              <IconButton
                                size="small"
                                onClick={() => {
                                  console.log('Edit button clicked for client version:', {
                                    id: clientVersion.id,
                                    clientVersion: clientVersion
                                  });
                                  setEditingClientVersion(clientVersion);
                                  setIsCopyMode(false);
                                  setFormDialogOpen(true);
                                }}
                                color="info"
                                sx={{
                                  '&:hover': {
                                    backgroundColor: 'info.light',
                                    color: 'white',
                                  },
                                }}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={t('common.delete')} arrow>
                              <IconButton
                                size="small"
                                onClick={() => {
                                  setSelectedClientVersion(clientVersion);
                                  setDeleteDialogOpen(true);
                                }}
                                color="error"
                                sx={{
                                  '&:hover': {
                                    backgroundColor: 'error.light',
                                    color: 'white',
                                  },
                                }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* ?òÏù¥ÏßÄ?§Ïù¥??- ?∞Ïù¥?∞Í? ?àÏùÑ ?åÎßå ?úÏãú */}
        {total > 0 && (
          <SimplePagination
            count={total}
            page={pageState.page - 1} // MUI??0Î∂Ä???úÏûë
            rowsPerPage={pageState.limit}
            onPageChange={handlePageChange}
            onRowsPerPageChange={handleRowsPerPageChange}
            rowsPerPageOptions={[5, 10, 25, 50, 100]}
          />
        )}
      </Card>



      {/* ??†ú ?ïÏù∏ Drawer */}
      <Drawer
        anchor="right"
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        sx={{
          zIndex: 1301,
          '& .MuiDrawer-paper': {
            width: { xs: '100%', sm: 400 },
            maxWidth: '100vw',
            display: 'flex',
            flexDirection: 'column'
          }
        }}
      >
        {/* Header */}
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper'
        }}>
          <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
            {t('clientVersions.deleteConfirmTitle')}
          </Typography>
          <IconButton
            onClick={() => setDeleteDialogOpen(false)}
            size="small"
            sx={{
              '&:hover': {
                backgroundColor: 'action.hover'
              }
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, p: 2 }}>
          <Typography>
            {t('clientVersions.deleteConfirmMessage', {
              version: selectedClientVersion?.clientVersion
            })}
          </Typography>
        </Box>

        {/* Footer */}
        <Box sx={{
          p: 2,
          borderTop: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          display: 'flex',
          gap: 2,
          justifyContent: 'flex-end'
        }}>
          <Button
            onClick={() => setDeleteDialogOpen(false)}
            variant="outlined"
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleDelete}
            color="error"
            variant="contained"
            startIcon={<DeleteIcon />}
          >
            {t('common.delete')}
          </Button>
        </Box>
      </Drawer>

      {/* ?ºÍ¥Ñ ?ÅÌÉú Î≥ÄÍ≤?Drawer */}
      <Drawer
        anchor="right"
        open={bulkStatusDialogOpen}
        onClose={() => setBulkStatusDialogOpen(false)}
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 3, // AppBar(theme.zIndex.drawer+2)
          '& .MuiDrawer-paper': {
            width: { xs: '100%', sm: 600 },
            maxWidth: '100vw',
            display: 'flex',
            flexDirection: 'column',
          }
        }}
      >
        {/* Header */}
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper'
        }}>
          <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
            {t('clientVersions.bulkStatusTitle')}
          </Typography>
          <IconButton
            onClick={() => setBulkStatusDialogOpen(false)}
            size="small"
            sx={{
              '&:hover': {
                backgroundColor: 'action.hover'
              }
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>{t('clientVersions.statusLabel')}</InputLabel>
            <Select
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value as ClientStatus)}
              label={t('clientVersions.statusLabel')}

            >
              {Object.values(ClientStatus).map((status) => (
                <MenuItem key={status} value={status}>
                  {t(ClientStatusLabels[status])}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* ?êÍ? Í¥Ä???ÑÎìú??*/}
          {bulkStatus === ClientStatus.MAINTENANCE && (
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <Box sx={{ mt: 3, p: 2, border: '1px solid', borderColor: 'warning.light', borderRadius: 1, bgcolor: 'background.default' }}>
                <Typography variant="subtitle1" gutterBottom sx={{ color: 'warning.main', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <BuildIcon fontSize="small" sx={{ mr: 0.5 }} /> {t('clientVersions.maintenance.title')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {t('clientVersions.maintenance.description')}
                </Typography>

                <Stack spacing={2}>
                  {/* ?êÍ? ?úÏûë??*/}
                  <DateTimePicker
                    label={t('clientVersions.maintenance.startDate')}
                    value={parseUTCForPicker(maintenanceStartDate)}
                    onChange={(date) => setMaintenanceStartDate(date ? date.toISOString() : '')}
                    timeSteps={{ minutes: 1 }}
                    slotProps={{
                      textField: {
                        fullWidth: true,
                        helperText: t('clientVersions.maintenance.startDateHelp'),
                        slotProps: { input: { readOnly: true } },
                      },
                    }}
                  />

                  {/* ?êÍ? Ï¢ÖÎ£å??*/}
                  <DateTimePicker
                    label={t('clientVersions.maintenance.endDate')}
                    value={parseUTCForPicker(maintenanceEndDate)}
                    onChange={(date) => setMaintenanceEndDate(date ? date.toISOString() : '')}
                    timeSteps={{ minutes: 1 }}
                    slotProps={{
                      textField: {
                        fullWidth: true,
                        helperText: t('clientVersions.maintenance.endDateHelp'),
                        slotProps: { input: { readOnly: true } },
                      },
                    }}
                  />

                  {/* Íµ¨Î∂Ñ??*/}
                  <Box sx={{ width: '100%', my: 5 }}>
                    <Box sx={{
                      height: '1px',
                      backgroundColor: 'divider',
                      width: '100%'
                    }} />
                  </Box>

                  {/* Î©îÏãúÏßÄ ?åÏä§ ?†ÌÉù */}
                  <TextField
                    select
                    label={t('maintenance.messageSource')}
                    value={inputMode}
                    onChange={(e) => setInputMode(e.target.value as 'direct' | 'template')}
                    fullWidth

                  >
                    <MenuItem value="direct">{t('maintenance.directInput')}</MenuItem>
                    <MenuItem value="template">{t('maintenance.useTemplate')}</MenuItem>
                  </TextField>
                  <Typography variant="caption" sx={{ mt: 0.5, display: 'block', color: 'text.secondary' }}>
                    {t('maintenance.messageSourceHelp')}
                  </Typography>

                  {/* ?úÌîåÎ¶??†ÌÉù */}
                  {inputMode === 'template' && (
                    <Box>
                      <TextField
                        select
                        label={t('maintenance.selectTemplate')}
                        value={selectedTemplateId}
                        onChange={(e) => setSelectedTemplateId(Number(e.target.value))}
                        fullWidth

                      >
                        <MenuItem value="">{t('common.select')}</MenuItem>
                        {messageTemplates.map(tpl => (
                          <MenuItem key={tpl.id} value={tpl.id}>{tpl.name}</MenuItem>
                        ))}
                      </TextField>
                      <Typography variant="caption" sx={{ mt: 0.5, display: 'block', color: 'text.secondary' }}>
                        {t('maintenance.selectTemplateHelp')}
                      </Typography>
                    </Box>
                  )}

                  {/* ÏßÅÏ†ë ?ÖÎ†• */}
                  {inputMode === 'direct' && (
                    <MultiLanguageMessageInput
                      defaultMessage={maintenanceMessage}
                      onDefaultMessageChange={setMaintenanceMessage}
                      defaultMessageLabel={t('clientVersions.maintenance.defaultMessage')}
                      defaultMessageHelperText={t('clientVersions.maintenance.defaultMessageHelp')}
                      defaultMessageRequired={true}
                      supportsMultiLanguage={supportsMultiLanguage}
                      onSupportsMultiLanguageChange={setSupportsMultiLanguage}
                      supportsMultiLanguageLabel={t('clientVersions.maintenance.supportsMultiLanguage')}
                      supportsMultiLanguageHelperText={t('clientVersions.maintenance.supportsMultiLanguageHelp')}
                      locales={maintenanceLocales}
                      onLocalesChange={setMaintenanceLocales}
                      languageSpecificMessagesLabel={t('clientVersions.maintenance.languageSpecificMessages')}
                      enableTranslation={true}
                      translateButtonLabel={t('common.autoTranslate')}
                      translateTooltip={t('maintenance.translateTooltip')}
                    />
                  )}
                </Stack>
              </Box>
            </LocalizationProvider>
          )}
        </Box>

        {/* Footer */}
        <Box sx={{
          p: 2,
          borderTop: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          display: 'flex',
          gap: 2,
          justifyContent: 'flex-end'
        }}>
          <Button
            onClick={() => setBulkStatusDialogOpen(false)}
            startIcon={<CancelIcon />}
            variant="outlined"
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleBulkStatusUpdate}
            variant="contained"
            startIcon={<UpdateIcon />}
          >
            {t('common.update')}
          </Button>
        </Box>
      </Drawer>



      {/* ?¥Îùº?¥Ïñ∏??Î≤ÑÏ†Ñ Ï∂îÍ?/?∏Ïßë ??*/}
      <ClientVersionForm
        open={formDialogOpen}
        onClose={() => {
          setFormDialogOpen(false);
          setEditingClientVersion(null);
          setIsCopyMode(false);
        }}
        onSuccess={() => {
          mutateVersions(); // SWR cache Í∞±Ïã†
          mutateClientVersions(); // Î™®Îì† client versions Ï∫êÏãú Í∞±Ïã†
          setFormDialogOpen(false);
          setEditingClientVersion(null);
          setIsCopyMode(false);
        }}
        clientVersion={editingClientVersion}
        isCopyMode={isCopyMode}
      />

      {/* ?¥Îùº?¥Ïñ∏??Î≤ÑÏ†Ñ Í∞ÑÌé∏ Ï∂îÍ? ??*/}
      <BulkClientVersionForm
        open={bulkFormDialogOpen}
        onClose={() => {
          setBulkFormDialogOpen(false);
        }}
        onSuccess={() => {
          mutateVersions(); // SWR cache Í∞±Ïã†
          mutateClientVersions(); // Î™®Îì† client versions Ï∫êÏãú Í∞±Ïã†
          setBulkFormDialogOpen(false);
        }}
      />

      {/* ?åÎû´??Í∏∞Î≥∏Í∞??§Ï†ï ?§Ïù¥?ºÎ°úÍ∑?*/}
      <PlatformDefaultsDialog
        open={platformDefaultsDialogOpen}
        onClose={() => setPlatformDefaultsDialogOpen(false)}
      />

      {/* ?ºÍ¥Ñ ??†ú ?ïÏù∏ Drawer */}
      <Drawer
        anchor="right"
        open={bulkDeleteDialogOpen}
        onClose={() => setBulkDeleteDialogOpen(false)}
        sx={{
          zIndex: 1301,
          '& .MuiDrawer-paper': {
            width: { xs: '100%', sm: 500 },
            maxWidth: '100vw',
            display: 'flex',
            flexDirection: 'column'
          }
        }}
      >
        {/* Header */}
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <DeleteIcon color="error" />
            <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
              {t('clientVersions.bulkDeleteTitle')}
            </Typography>
          </Box>
          <IconButton
            onClick={() => setBulkDeleteDialogOpen(false)}
            size="small"
            sx={{
              '&:hover': {
                backgroundColor: 'action.hover'
              }
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
          <Alert severity="warning" sx={{ mb: 2 }}>
            {t('clientVersions.bulkDeleteWarning')}
          </Alert>
          <Typography variant="body1">
            {t('clientVersions.bulkDeleteConfirm', { count: selectedIds.length })}
          </Typography>
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              {t('clientVersions.selectedItems')}:
            </Typography>
            <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
              {clientVersions
                .filter(cv => selectedIds.includes(cv.id))
                .map(cv => (
                  <Box key={cv.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
                    <Chip label={cv.platform} size="small" color="primary" variant="outlined" sx={{ width: '100%', justifyContent: 'center', borderRadius: '4px' }} />
                    <Chip label={cv.clientVersion} size="small" color="info" variant="filled" sx={{ width: '100%', justifyContent: 'center', borderRadius: '4px' }} />
                  </Box>
                ))}
            </Box>
          </Box>
        </Box>

        {/* Footer */}
        <Box sx={{
          p: 2,
          borderTop: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          display: 'flex',
          gap: 2,
          justifyContent: 'flex-end'
        }}>
          <Button
            onClick={() => setBulkDeleteDialogOpen(false)}
            startIcon={<CancelIcon />}
            variant="outlined"
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleBulkDelete}
            color="error"
            variant="contained"
            startIcon={<DeleteIcon />}
          >
            {t('common.delete')}
          </Button>
        </Box>
      </Drawer>

      {/* ?úÍ∑∏ Í¥ÄÎ¶?Drawer */}
      <Drawer
        anchor="right"
        open={tagDialogOpen}
        onClose={() => setTagDialogOpen(false)}
        sx={{
          zIndex: 1301,
          '& .MuiDrawer-paper': {
            width: { xs: '100%', sm: 600 },
            maxWidth: '100vw',
            display: 'flex',
            flexDirection: 'column'
          }
        }}
      >
        {/* Header */}
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper'
        }}>
          <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
            {t('common.tags')} - {selectedClientVersionForTags?.clientVersion} ({selectedClientVersionForTags?.platform})
          </Typography>
          <IconButton
            onClick={() => setTagDialogOpen(false)}
            size="small"
            sx={{
              '&:hover': {
                backgroundColor: 'action.hover'
              }
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
          <Autocomplete
            multiple
            options={allTags || []}
            getOptionLabel={(option) => option.name}
            filterSelectedOptions
            isOptionEqualToValue={(option, value) => option.id === value.id}
            value={clientVersionTags}
            onChange={(_, newValue) => setClientVersionTags(newValue)}
            slotProps={{
              popper: {
                style: {
                  zIndex: 9999
                }
              }
            }}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Tooltip key={option.id} title={option.description || t('tags.noDescription')} arrow>
                  <Chip
                    variant="outlined"
                    label={option.name}
                    size="small"
                    sx={{ bgcolor: option.color, color: getContrastColor(option.color), cursor: 'help' }}
                    {...getTagProps({ index })}
                  />
                </Tooltip>
              ))
            }
            renderInput={(params) => (
              <TextField
                {...params}
                label={t('common.tags')}
                placeholder={t('common.selectTags')}
                size="small"
              />
            )}
            renderOption={(props, option) => (
              <li {...props}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip
                    label={option.name}
                    size="small"
                    sx={{ bgcolor: option.color, color: getContrastColor(option.color), cursor: 'help' }}
                  />
                  <Typography variant="body2" color="text.secondary">
                    {option.description || t('tags.noDescription')}
                  </Typography>
                </Box>
              </li>
            )}
          />
        </Box>

        {/* Footer */}
        <Box sx={{
          p: 2,
          borderTop: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          display: 'flex',
          gap: 2,
          justifyContent: 'flex-end'
        }}>
          <Button
            onClick={() => setTagDialogOpen(false)}
            variant="outlined"
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={() => handleSaveTags(clientVersionTags.map(tag => tag.id))}
            variant="contained"
          >
            {t('common.save')}
          </Button>
        </Box>
      </Drawer>

      {/* Column Settings Popover */}
      <Popover
        open={Boolean(columnSettingsAnchor)}
        anchorEl={columnSettingsAnchor}
        onClose={() => setColumnSettingsAnchor(null)}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        hideBackdrop
        disableScrollLock
      >
        <ClickAwayListener onClickAway={() => setColumnSettingsAnchor(null)}>
          <Box sx={{ p: 2, minWidth: 280, maxWidth: 320 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                {t('users.columnSettings')}
              </Typography>
              <Button size="small" onClick={handleResetColumns} color="warning">
                {t('common.reset')}
              </Button>
            </Box>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleColumnDragEnd}
              modifiers={[restrictToVerticalAxis]}
            >
              <SortableContext
                items={columns.map(col => col.id)}
                strategy={verticalListSortingStrategy}
              >
                <List dense disablePadding>
                  {columns.map((column) => (
                    <SortableColumnItem
                      key={column.id}
                      column={column}
                      onToggleVisibility={handleToggleColumnVisibility}
                    />
                  ))}
                </List>
              </SortableContext>
            </DndContext>
          </Box>
        </ClickAwayListener>
      </Popover>

      {/* Client Version Guide Drawer */}
      <ClientVersionGuideDrawer open={openSDKGuide} onClose={() => setOpenSDKGuide(false)} />
    </Box>
  );
};

export default ClientVersionsPage;
