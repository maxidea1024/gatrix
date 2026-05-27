import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Switch,
  Chip,
  Tooltip,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Alert,
  Badge,
  Divider,
  Checkbox,
  FormControlLabel,
  IconButton,
  Autocomplete,
  Slider,
  Popover,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Refresh as RefreshIcon,
  CloudUpload as ApplyIcon,
  RestorePage as ResetIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  ViewColumn as ViewColumnsIcon,
  DragIndicator as DragIndicatorIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  DateRange as DateRangeIcon,
  CalendarViewDay as CalendarViewDayIcon,
  CalendarMonth as CalendarMonthIcon,
  TableChart as TableChartIcon,
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
import DynamicFilterBar, {
  FilterDefinition,
  ActiveFilter,
} from '@/components/common/DynamicFilterBar';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useAuth } from '@/hooks/useAuth';
import { P } from '@/types/permissions';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import { useHandleApiError } from '@/hooks/useHandleApiError';
import { parseApiErrorMessage } from '@/utils/errorUtils';
import SearchTextField from '@/components/common/SearchTextField';
import PageContentLoader from '@/components/common/PageContentLoader';
import EmptyPagePlaceholder from '@/components/common/EmptyPagePlaceholder';
import SimplePagination from '@/components/common/SimplePagination';
import ResizableDrawer from '@/components/common/ResizableDrawer';
import planningDataService, {
  HotTimeBuffItem,
} from '@/services/planningDataService';
import operationEventService, {
  HotTimeBuffOverride,
} from '@/services/operationEventService';
import { gameWorldService } from '@/services/gameWorldService';
import { GameWorld } from '@/types/gameWorld';

// FullCalendar imports
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import koLocale from '@fullcalendar/core/locales/ko';
import enLocale from '@fullcalendar/core/locales/en-gb';
import zhLocale from '@fullcalendar/core/locales/zh-cn';

import dayjs, { Dayjs } from 'dayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

// Day-of-week bits (Sun=0 .. Sat=6)
const DAY_BITS = [
  { bit: 0, key: 'daySun' },
  { bit: 1, key: 'dayMon' },
  { bit: 2, key: 'dayTue' },
  { bit: 3, key: 'dayWed' },
  { bit: 4, key: 'dayThu' },
  { bit: 5, key: 'dayFri' },
  { bit: 6, key: 'daySat' },
];

function formatDayOfWeek(bitFlag: number, t: (k: string) => string): string {
  if (bitFlag === 127) return t('hotTimeBuffEvent.dayAll');
  return DAY_BITS.filter((d) => bitFlag & (1 << d.bit))
    .map((d) => t(`hotTimeBuffEvent.${d.key}`))
    .join(', ');
}

function formatDateShort(dateStr: string | undefined | null): string {
  if (!dateStr) return '-';
  return dateStr.length > 10 ? dateStr.substring(0, 10) : dateStr;
}

interface RowData {
  cmsId: number;
  cmsItem: HotTimeBuffItem;
  savedOverride?: HotTimeBuffOverride;
  localOverride?: HotTimeBuffOverride;
  isDirty: boolean;
}

/** Normalize worldIds: null and [] are both "global" */
function normalizeWorldIds(ids: string[] | null | undefined): string | null {
  if (!ids || ids.length === 0) return null;
  return JSON.stringify([...ids].sort());
}

// Deep compare two overrides to detect changes
function isOverrideDirty(
  saved: HotTimeBuffOverride | undefined,
  local: HotTimeBuffOverride | undefined
): boolean {
  if (!saved && !local) return false;
  if (!local) return false; // no draft = not dirty
  if (!saved) {
    // No saved override — dirty only if local has non-default fields set
    return (
      local.enabled === false ||
      (Array.isArray(local.worldIds) && local.worldIds.length > 0) ||
      local.startDateOverride != null ||
      local.endDateOverride != null ||
      local.startHourOverride != null ||
      local.endHourOverride != null ||
      local.minLvOverride != null ||
      local.maxLvOverride != null ||
      local.bitFlagDayOfWeekOverride != null ||
      local.worldBuffIdOverride != null
    );
  }
  return (
    saved.enabled !== local.enabled ||
    saved.startDateOverride !== local.startDateOverride ||
    saved.endDateOverride !== local.endDateOverride ||
    saved.startHourOverride !== local.startHourOverride ||
    saved.endHourOverride !== local.endHourOverride ||
    saved.minLvOverride !== local.minLvOverride ||
    saved.maxLvOverride !== local.maxLvOverride ||
    saved.bitFlagDayOfWeekOverride !== local.bitFlagDayOfWeekOverride ||
    normalizeWorldIds(saved.worldIds) !== normalizeWorldIds(local.worldIds) ||
    JSON.stringify(saved.worldBuffIdOverride) !==
      JSON.stringify(local.worldBuffIdOverride)
  );
}

const ROWS_PER_PAGE_OPTIONS = [10, 20, 50, 100];

// Column configuration
interface ColumnConfig {
  id: string;
  label: string;
  visible: boolean;
  width?: string | number;
}

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: 'edit', label: '✎', visible: true, width: 36 },
  { id: 'cmsId', label: 'ID', visible: true, width: 70 },
  { id: 'world', label: '적용 월드', visible: true, width: 90 },
  { id: 'name', label: '이벤트명', visible: true, width: 240 },
  { id: 'enabled', label: '활성', visible: true, width: 70 },
  { id: 'startDate', label: '시작일', visible: true, width: 120 },
  { id: 'endDate', label: '종료일', visible: true, width: 120 },
  { id: 'hours', label: '시간', visible: true, width: 80 },
  { id: 'level', label: 'Lv', visible: true, width: 70 },
  { id: 'dayOfWeek', label: '요일', visible: true, width: 100 },
  { id: 'worldBuffs', label: '월드버프', visible: true, width: 120 },
  { id: 'status', label: '상태', visible: true, width: 90 },
];

const COLUMN_STORAGE_KEY = 'hotTimeBuffEventColumns';
const DATE_RANGE_FILTER_KEY = 'hotTimeBuffEventDateRangeFilter';
const DAY_FILTER_KEY = 'hotTimeBuffEventDayOfWeekFilter';
const VIEW_MODE_KEY = 'hotTimeBuffEventViewMode';

// Sortable column item for DnD
const SortableColumnItem: React.FC<{
  column: ColumnConfig;
  onToggle: (id: string) => void;
}> = ({ column, onToggle }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: column.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <ListItem
      ref={setNodeRef}
      style={style}
      dense
      secondaryAction={
        <IconButton size="small" onClick={() => onToggle(column.id)}>
          {column.visible ? <VisibilityIcon fontSize="small" /> : <VisibilityOffIcon fontSize="small" />}
        </IconButton>
      }
    >
      <ListItemIcon sx={{ minWidth: 28, cursor: 'grab' }} {...attributes} {...listeners}>
        <DragIndicatorIcon fontSize="small" color="action" />
      </ListItemIcon>
      <ListItemText
        primary={column.label}
        primaryTypographyProps={{
          variant: 'body2',
          color: column.visible ? 'text.primary' : 'text.disabled',
        }}
      />
    </ListItem>
  );
};

const HotTimeBuffEventPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { hasPermission } = useAuth();
  const canManage = hasPermission([P.OPERATION_EVENTS_UPDATE]);
  const { getProjectApiPath } = useOrgProject();
  const projectApiPath = getProjectApiPath();
  const { handleApiError, ErrorDialog } = useHandleApiError();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  // State
  const [loading, setLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [rows, setRows] = useState<RowData[]>([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);

  // View mode: table or calendar
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>(() => {
    try {
      const saved = localStorage.getItem(VIEW_MODE_KEY);
      return saved === 'calendar' ? 'calendar' : 'table';
    } catch {
      return 'table';
    }
  });
  const calendarRef = useRef<FullCalendar>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const handleSetViewMode = useCallback((mode: 'table' | 'calendar') => {
    setViewMode(mode);
    localStorage.setItem(VIEW_MODE_KEY, mode);
  }, []);

  // Date range filter: show only events within the current period
  const [showOnlyInPeriod, setShowOnlyInPeriod] = useState(() => {
    try {
      return localStorage.getItem(DATE_RANGE_FILTER_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleDateRangeFilter = useCallback((checked: boolean) => {
    setShowOnlyInPeriod(checked);
    localStorage.setItem(DATE_RANGE_FILTER_KEY, String(checked));
    setPage(0);
  }, []);

  // Day-of-week filter: show only events matching today's day-of-week
  const [showOnlyMatchingDay, setShowOnlyMatchingDay] = useState(() => {
    try {
      return localStorage.getItem(DAY_FILTER_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleDayFilter = useCallback((checked: boolean) => {
    setShowOnlyMatchingDay(checked);
    localStorage.setItem(DAY_FILTER_KEY, String(checked));
    setPage(0);
  }, []);

  // Drawer state — edit a snapshot, commit on "Update"
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerRowKey, setDrawerRowKey] = useState<string | null>(null);
  const [drawerDraft, setDrawerDraft] = useState<HotTimeBuffOverride | null>(
    null
  );

  // Dialogs
  const [applyConfirmOpen, setApplyConfirmOpen] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<string | null>(null);

  // Calendar "more events" popover state
  const [moreEventsOpen, setMoreEventsOpen] = useState(false);
  const [moreEventsDate, setMoreEventsDate] = useState<string>('');
  const [moreEventsRows, setMoreEventsRows] = useState<RowData[]>([]);

  // All world buffs from planning data
  const [allWorldBuffs, setAllWorldBuffs] = useState<Map<number, { name: string; desc: string }>>(new Map());

  // Game worlds for worldId selector
  const [gameWorlds, setGameWorlds] = useState<GameWorld[]>([]);

  // Column configuration (persisted in localStorage)
  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    const saved = localStorage.getItem(COLUMN_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as ColumnConfig[];
        const merged = parsed.map((s) => DEFAULT_COLUMNS.find((d) => d.id === s.id) ? { ...DEFAULT_COLUMNS.find((d) => d.id === s.id)!, visible: s.visible } : s);
        const savedIds = new Set(parsed.map((c) => c.id));
        return [...merged, ...DEFAULT_COLUMNS.filter((d) => !savedIds.has(d.id))];
      } catch { return DEFAULT_COLUMNS; }
    }
    return DEFAULT_COLUMNS;
  });
  const [columnSettingsAnchor, setColumnSettingsAnchor] = useState<HTMLButtonElement | null>(null);
  const visibleColumns = useMemo(() => columns.filter((c) => c.visible), [columns]);

  // DnD sensors for column reordering
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleColumnDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setColumns((prev) => {
        const oldIdx = prev.findIndex((c) => c.id === active.id);
        const newIdx = prev.findIndex((c) => c.id === over.id);
        const next = arrayMove(prev, oldIdx, newIdx);
        localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(next.map((c) => ({ id: c.id, visible: c.visible }))));
        return next;
      });
    }
  }, []);

  const toggleColumnVisibility = useCallback((id: string) => {
    setColumns((prev) => {
      const next = prev.map((c) => c.id === id ? { ...c, visible: !c.visible } : c);
      localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(next.map((c) => ({ id: c.id, visible: c.visible }))));
      return next;
    });
  }, []);

  // Dynamic filter state
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);

  const filterDefinitions: FilterDefinition[] = useMemo(() => [
    {
      key: 'status',
      label: t('hotTimeBuffEvent.status'),
      type: 'multiselect',
      operator: 'any_of',
      allowOperatorToggle: false,
      options: [
        { value: 'dirty', label: '변경됨' },
        { value: 'saved', label: '저장됨' },
        { value: 'default', label: '기본값' },
      ],
    },
    {
      key: 'enabled',
      label: t('hotTimeBuffEvent.enabled'),
      type: 'multiselect',
      operator: 'any_of',
      allowOperatorToggle: false,
      options: [
        { value: 'enabled', label: '활성' },
        { value: 'disabled', label: '비활성' },
      ],
    },
    {
      key: 'world',
      label: '적용 월드',
      type: 'multiselect',
      operator: 'any_of',
      allowOperatorToggle: false,
      options: gameWorlds.map((w) => ({ value: w.worldId, label: w.worldId + (w.name ? ` (${w.name})` : '') })),
    },
  ], [t, gameWorlds]);

  const handleFilterAdd = useCallback((filter: ActiveFilter) => {
    setActiveFilters((prev) => [...prev, filter]);
    setPage(0);
  }, []);

  const handleFilterRemove = useCallback((key: string) => {
    setActiveFilters((prev) => prev.filter((f) => f.key !== key));
    setPage(0);
  }, []);

  const handleDynamicFilterChange = useCallback((key: string, value: any) => {
    setActiveFilters((prev) => prev.map((f) => f.key === key ? { ...f, value } : f));
    setPage(0);
  }, []);

  const handleOperatorChange = useCallback((key: string, operator: 'any_of' | 'include_all') => {
    setActiveFilters((prev) => prev.map((f) => f.key === key ? { ...f, operator } : f));
    setPage(0);
  }, []);

  /** Format world buff label: "ID: name — desc" (truncated if long) */
  const formatWorldBuffLabel = useCallback((id: number, info?: { name: string; desc: string } | null) => {
    const name = info?.name || `WorldBuff #${id}`;
    const desc = info?.desc;
    if (!desc) return `${id}: ${name}`;
    const truncated = desc.length > 40 ? desc.substring(0, 40) + '…' : desc;
    return `${id}: ${name} — ${truncated}`;
  }, []);

  // --------------- Data loading ---------------
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [lookupResult, overrides] = await Promise.all([
        planningDataService.getHotTimeBuffLookup(projectApiPath),
        operationEventService.getHottimeOverrides(projectApiPath),
      ]);
      const items = lookupResult?.items || [];

      // Simple key: one row per cmsId (worldIds is an array inside the override)
      const cmsItemMap = new Map<number, HotTimeBuffItem>();
      for (const item of items) {
        cmsItemMap.set(item.id, item);
      }

      const newRows: RowData[] = [];
      for (const item of items) {
        const saved = overrides[String(item.id)] || undefined;
        newRows.push({
          cmsId: item.id,
          cmsItem: item,
          savedOverride: saved,
          localOverride: saved ? { ...saved } : undefined,
          isDirty: false,
        });
      }
      newRows.sort((a, b) => a.cmsId - b.cmsId);
      setRows(newRows);

      // Load full world buff list from planning data
      try {
        const worldBuffList = await planningDataService.getUIListItems(
          projectApiPath,
          'WORLD_BUFFS'
        );
        const buffMap = new Map<number, { name: string; desc: string }>();
        for (const wb of worldBuffList) {
          buffMap.set(wb.id, {
            name: wb.name || `WorldBuff #${wb.id}`,
            desc: wb.description || '',
          });
        }
        setAllWorldBuffs(buffMap);
      } catch {
        // Fallback: extract from CMS items
        const buffMap = new Map<number, { name: string; desc: string }>();
        for (const item of items) {
          (item.worldBuffId || []).forEach((id: number, i: number) => {
            if (!buffMap.has(id)) {
              buffMap.set(id, { name: item.worldBuffNames?.[i] || `WorldBuff #${id}`, desc: '' });
            }
          });
        }
        setAllWorldBuffs(buffMap);
      }

      // Load game worlds for worldId selector
      try {
        const worldResult = await gameWorldService.getGameWorlds(projectApiPath);
        setGameWorlds(worldResult.worlds || []);
      } catch {
        // Non-fatal: world selector will be empty
      }
    } catch (error: any) {
      enqueueSnackbar(
        parseApiErrorMessage(error, t('hotTimeBuffEvent.loadFailed')),
        { variant: 'error' }
      );
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  }, [projectApiPath]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // --------------- Filtering & pagination ---------------
  const filteredRows = useMemo(() => {
    let result = rows;

    // Date range filter: show only events where today is within startDate~endDate
    if (showOnlyInPeriod) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      result = result.filter((r) => {
        const override = r.localOverride || r.savedOverride;
        const startStr = override?.startDateOverride || r.cmsItem.startDate;
        const endStr = override?.endDateOverride || r.cmsItem.endDate;
        if (!startStr || !endStr) return true; // keep items without dates
        const start = new Date(startStr.substring(0, 10));
        const end = new Date(endStr.substring(0, 10));
        return start <= today && today <= end;
      });
    }

    // Day-of-week filter: show only events matching today's day-of-week
    if (showOnlyMatchingDay) {
      const todayDayBit = 1 << new Date().getDay(); // Sun=0..Sat=6
      result = result.filter((r) => {
        const override = r.localOverride || r.savedOverride;
        const dayOfWeek = override?.bitFlagDayOfWeekOverride ?? r.cmsItem.bitFlagDayOfWeek;
        return (dayOfWeek & todayDayBit) !== 0;
      });
    }

    // Text search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (r) =>
          (r.cmsItem.name || '').toLowerCase().includes(term) ||
          String(r.cmsId).includes(term) ||
          (r.localOverride?.worldIds || []).some(wid => wid.toLowerCase().includes(term)) ||
          r.cmsItem.worldBuffNames?.some((n) => n.toLowerCase().includes(term))
      );
    }

    // Dynamic filters
    for (const filter of activeFilters) {
      if (!filter.value || filter.value.length === 0) continue;
      const vals = new Set(filter.value);

      if (filter.key === 'status') {
        result = result.filter((r) => {
          if (vals.has('dirty') && r.isDirty) return true;
          if (vals.has('saved') && !r.isDirty && r.savedOverride) return true;
          if (vals.has('default') && !r.isDirty && !r.savedOverride) return true;
          return false;
        });
      } else if (filter.key === 'enabled') {
        result = result.filter((r) => {
          const isEnabled = r.localOverride?.enabled !== false;
          if (vals.has('enabled') && isEnabled) return true;
          if (vals.has('disabled') && !isEnabled) return true;
          return false;
        });
      } else if (filter.key === 'world') {
        result = result.filter((r) => {
          const worldIds = r.localOverride?.worldIds;
          // Global (null/[]) matches all filter values
          if (!worldIds || worldIds.length === 0) return true;
          return worldIds.some((wid) => vals.has(wid));
        });
      }
    }

    return result;
  }, [rows, searchTerm, activeFilters, showOnlyInPeriod, showOnlyMatchingDay]);

  const paginatedRows = useMemo(() => {
    const start = page * rowsPerPage;
    return filteredRows.slice(start, start + rowsPerPage);
  }, [filteredRows, page, rowsPerPage]);

  const dirtyCount = useMemo(
    () => rows.filter((r) => r.isDirty).length,
    [rows]
  );

  // --------------- Calendar view helpers ---------------
  const getCalendarLocale = useCallback(() => {
    switch (i18n.language) {
      case 'en': return enLocale;
      case 'zh': return zhLocale;
      default: return koLocale;
    }
  }, [i18n.language]);

  const getCalendarButtonText = useCallback(() => {
    switch (i18n.language) {
      case 'en': return { today: 'Today', month: 'Month', week: 'Week', day: 'Day' };
      case 'zh': return { today: '今天', month: '月', week: '周', day: '日' };
      default: return { today: '오늘', month: '월', week: '주', day: '일' };
    }
  }, [i18n.language]);

  /** Convert filteredRows to FullCalendar events */
  const calendarEvents = useMemo(() => {
    return filteredRows.map((row) => {
      const override = row.localOverride || row.savedOverride;
      const startStr = override?.startDateOverride || row.cmsItem.startDate;
      const endStr = override?.endDateOverride || row.cmsItem.endDate;
      const isEnabled = override?.enabled !== false;

      // FullCalendar end date is exclusive, so add 1 day
      let endExclusive: string | undefined;
      if (endStr) {
        const d = new Date(endStr.substring(0, 10));
        d.setDate(d.getDate() + 1);
        endExclusive = d.toISOString().substring(0, 10);
      }

      // Color coding — balanced: visible but not overwhelming
      let bgColor: string;
      let borderColor: string;
      let textColor: string;
      if (row.isDirty) {
        bgColor = isDark ? '#5c4a22' : '#f0ddb0';
        borderColor = isDark ? '#7a6030' : '#d4b870';
        textColor = isDark ? '#f0ddb0' : '#5c4010';
      } else if (isEnabled) {
        bgColor = isDark ? '#2a4460' : '#d0e2f0';
        borderColor = isDark ? '#3a5878' : '#a8c8e0';
        textColor = isDark ? '#c0d8ee' : '#2a4a6a';
      } else {
        bgColor = isDark ? '#3a3a3a' : '#e4e4e4';
        borderColor = isDark ? '#505050' : '#c8c8c8';
        textColor = isDark ? '#999' : '#666';
      }

      const eventName = row.cmsItem.name || `HotTimeBuff #${row.cmsId}`;
      const eventDesc = row.cmsItem.worldBuffNames?.join(', ') || '';

      return {
        id: String(row.cmsId),
        title: `${row.cmsId}: ${eventName}`,
        start: startStr?.substring(0, 10),
        end: endExclusive,
        allDay: true,
        backgroundColor: bgColor,
        borderColor,
        textColor,
        extendedProps: { row, desc: eventDesc },
      };
    });
  }, [filteredRows, isDark]);

  // --------------- Drawer open/close ---------------
  const openDrawer = useCallback((row: RowData) => {
    setDrawerRowKey(String(row.cmsId));
    // Make a snapshot for editing
    const base: HotTimeBuffOverride = row.localOverride ||
      row.savedOverride || { cmsId: row.cmsId, enabled: true };
    setDrawerDraft({ ...base });
    setDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setDrawerRowKey(null);
    setDrawerDraft(null);
  }, []);

  // Current row for drawer
  const drawerRow = useMemo(
    () => (drawerRowKey !== null ? rows.find((r) => String(r.cmsId) === drawerRowKey) : null),
    [rows, drawerRowKey]
  );

  // Is drawer draft different from saved?
  const drawerIsDirty = useMemo(() => {
    if (!drawerRow || !drawerDraft) return false;
    return isOverrideDirty(drawerRow.savedOverride, drawerDraft);
  }, [drawerRow, drawerDraft]);

  // --------------- Drawer field handlers ---------------
  const updateDraft = useCallback(
    (field: string, value: any) => {
      setDrawerDraft((prev) => (prev ? { ...prev, [field]: value } : prev));
    },
    []
  );

  const toggleDraftDayBit = useCallback(
    (bit: number) => {
      setDrawerDraft((prev) => {
        if (!prev) return prev;
        const current =
          prev.bitFlagDayOfWeekOverride ??
          (drawerRow?.cmsItem.bitFlagDayOfWeek || 127);
        const toggled = current ^ (1 << bit);
        return { ...prev, bitFlagDayOfWeekOverride: toggled };
      });
    },
    [drawerRow]
  );

  const toggleDraftWorldBuff = useCallback(
    (worldBuffId: number) => {
      setDrawerDraft((prev) => {
        if (!prev || !drawerRow) return prev;
        const allIds = drawerRow.cmsItem.worldBuffId || [];
        const current = prev.worldBuffIdOverride || [...allIds];
        const newIds = current.includes(worldBuffId)
          ? current.filter((id) => id !== worldBuffId)
          : [...current, worldBuffId];
        return { ...prev, worldBuffIdOverride: newIds };
      });
    },
    [drawerRow]
  );

  const selectAllWorldBuffs = useCallback(() => {
    setDrawerDraft((prev) => {
      if (!prev || !drawerRow) return prev;
      const cmsIds = drawerRow.cmsItem.worldBuffId || [];
      const currentIds = prev.worldBuffIdOverride || [];
      // Find manually-added buffs (IDs not in CMS)
      const customIds = currentIds.filter((id) => !cmsIds.includes(id));
      if (customIds.length === 0) {
        // No custom buffs — null means "all CMS buffs"
        return { ...prev, worldBuffIdOverride: null };
      }
      // Merge: all CMS + custom
      const merged = [...cmsIds, ...customIds];
      return { ...prev, worldBuffIdOverride: merged };
    });
  }, [drawerRow]);

  const deselectAllWorldBuffs = useCallback(() => {
    setDrawerDraft((prev) => {
      if (!prev || !drawerRow) return prev;
      return { ...prev, worldBuffIdOverride: [] };
    });
  }, [drawerRow]);

  // --------------- Drawer "Update" (commit to local row) ---------------
  const commitDrawerDraft = useCallback(() => {
    if (!drawerRowKey || !drawerDraft) return;
    setRows((prev) =>
      prev.map((r) => {
        if (String(r.cmsId) !== drawerRowKey) return r;
        const isDirty = isOverrideDirty(r.savedOverride, drawerDraft);
        return { ...r, localOverride: { ...drawerDraft }, isDirty };
      })
    );
    closeDrawer();
  }, [drawerRowKey, drawerDraft, closeDrawer]);

  // --------------- Quick table toggle (enabled) ---------------
  const handleQuickToggle = useCallback((cmsId: number, enabled: boolean) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.cmsId !== cmsId) return r;
        const base: HotTimeBuffOverride = r.localOverride ||
          r.savedOverride || { cmsId, enabled: false };
        const updated = { ...base, cmsId, enabled };
        const isDirty = isOverrideDirty(r.savedOverride, updated);
        return { ...r, localOverride: updated, isDirty };
      })
    );
  }, []);

  // --------------- Batch apply ---------------
  const handleApply = async () => {
    setApplyConfirmOpen(false);
    const dirtyRows = rows.filter((r) => r.isDirty && r.localOverride);
    if (dirtyRows.length === 0) {
      enqueueSnackbar(t('hotTimeBuffEvent.noChanges'), { variant: 'info' });
      return;
    }

    // Separate: rows that should be deleted (reset to CMS default) vs upserted
    const toDelete: number[] = [];
    const toUpsert: HotTimeBuffOverride[] = [];

    for (const r of dirtyRows) {
      const lo = r.localOverride!;
      const isDefaultOverride =
        lo.enabled !== false &&
        (!lo.worldIds || lo.worldIds.length === 0) &&
        lo.startDateOverride == null &&
        lo.endDateOverride == null &&
        lo.startHourOverride == null &&
        lo.endHourOverride == null &&
        lo.minLvOverride == null &&
        lo.maxLvOverride == null &&
        lo.bitFlagDayOfWeekOverride == null &&
        lo.worldBuffIdOverride == null;

      if (isDefaultOverride && r.savedOverride) {
        // Was saved, now reset to defaults → delete from DB
        toDelete.push(r.cmsId);
      } else if (!isDefaultOverride) {
        toUpsert.push(lo);
      }
      // else: never saved + default values = no action needed
    }

    try {
      const promises: Promise<any>[] = [];
      if (toUpsert.length > 0) {
        promises.push(
          operationEventService.applyHottimeOverrides(projectApiPath, toUpsert)
        );
      }
      for (const cmsId of toDelete) {
        promises.push(
          operationEventService.deleteHottimeOverride(projectApiPath, cmsId)
        );
      }
      await Promise.all(promises);

      enqueueSnackbar(
        t('hotTimeBuffEvent.applySuccess', { count: toUpsert.length + toDelete.length }),
        { variant: 'success' }
      );
      await loadData();
    } catch (error: any) {
      handleApiError(error, 'hotTimeBuffEvent.applyFailed');
    }
  };

  // --------------- Individual reset ---------------
  const handleReset = async () => {
    if (resetTarget === null) return;
    setResetConfirmOpen(false);
    // resetTarget is just the cmsId
    const cmsId = Number(resetTarget);
    try {
      await operationEventService.deleteHottimeOverride(
        projectApiPath,
        cmsId
      );
      enqueueSnackbar(t('hotTimeBuffEvent.resetSuccess'), {
        variant: 'success',
      });
      setResetTarget(null);
      await loadData();
    } catch (error: any) {
      handleApiError(error, 'hotTimeBuffEvent.applyFailed');
    }
  };

  // --------------- Status chip ---------------
  const getStatusChip = (row: RowData) => {
    if (row.isDirty) {
      return (
        <Chip
          label={t('hotTimeBuffEvent.statusModified')}
          color="warning"
          size="small"
        />
      );
    }
    if (row.savedOverride) {
      return (
        <Chip
          label={t('hotTimeBuffEvent.statusOverridden')}
          color="info"
          size="small"
        />
      );
    }
    return (
      <Chip
        label={t('hotTimeBuffEvent.cmsDefault')}
        color="default"
        size="small"
        variant="outlined"
      />
    );
  };

  // --------------- Drawer content ---------------
  const renderDrawerContent = () => {
    if (!drawerRow || !drawerDraft) return null;
    const cms = drawerRow.cmsItem;
    const draft = drawerDraft;
    const dayBits =
      draft.bitFlagDayOfWeekOverride ?? cms.bitFlagDayOfWeek;
    const activeWorldBuffIds = draft.worldBuffIdOverride || cms.worldBuffId || [];
    // Extra buff IDs: IDs that were ever added to this override but are not in CMS.
    // Derive from savedOverride + localOverride to keep them visible even when unchecked.
    const savedExtraIds = (drawerRow.savedOverride?.worldBuffIdOverride || [])
      .filter((id) => !(cms.worldBuffId || []).includes(id));
    const localExtraIds = (draft.worldBuffIdOverride || [])
      .filter((id) => !(cms.worldBuffId || []).includes(id));
    const extraBuffIds = [...new Set([...savedExtraIds, ...localExtraIds])];

    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
        }}
      >
        {/* Scrollable content area */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
          {/* CMS Info */}
          <Typography
            variant="subtitle2"
            color="text.secondary"
            sx={{ mb: 1 }}
          >
            CMS
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 1,
              mb: 2,
              p: 1.5,
              borderRadius: 1,
              bgcolor: 'action.hover',
            }}
          >
            <Box>
              <Typography variant="caption" color="text.secondary">
                {t('hotTimeBuffEvent.startDate')}
              </Typography>
              <Typography variant="body2">
                {formatDateShort(cms.startDate)}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                {t('hotTimeBuffEvent.endDate')}
              </Typography>
              <Typography variant="body2">
                {formatDateShort(cms.endDate)}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                {t('hotTimeBuffEvent.startHour')} ~{' '}
                {t('hotTimeBuffEvent.endHour')}
              </Typography>
              <Typography variant="body2">
                {cms.startHour} ~ {cms.endHour}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Lv
              </Typography>
              <Typography variant="body2">
                {cms.minLv} ~ {cms.maxLv}
              </Typography>
            </Box>
            <Box sx={{ gridColumn: '1 / -1' }}>
              <Typography variant="caption" color="text.secondary">
                {t('hotTimeBuffEvent.dayOfWeek')}
              </Typography>
              <Typography variant="body2">
                {formatDayOfWeek(cms.bitFlagDayOfWeek, t)}
              </Typography>
            </Box>
          </Box>

          <Divider sx={{ my: 2 }} />

          {/* World selector — checkbox multi-select */}
          {gameWorlds.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
                적용 월드
              </Typography>
              {/* 전역 적용 toggle */}
              <FormControlLabel
                control={
                  <Checkbox
                    checked={!draft.worldIds || draft.worldIds.length === 0}
                    onChange={(_, checked) => {
                      if (checked) {
                        updateDraft('worldIds', null);
                      } else {
                        // Keep previous selection if any; otherwise start empty
                        updateDraft('worldIds', draft.worldIds?.length ? [...draft.worldIds] : []);
                      }
                    }}
                    disabled={!canManage}
                    size="small"
                  />
                }
                label={
                  <Typography variant="body2" fontWeight={600}>
                    전역 적용 (모든 월드)
                  </Typography>
                }
                sx={{ mb: 0.5 }}
              />
              {/* Individual world checkboxes */}
              {Array.isArray(draft.worldIds) && (
                <Box sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 0,
                  pl: 1,
                  maxHeight: 200,
                  overflowY: 'auto',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  p: 1,
                }}>
                  {gameWorlds.map((w) => (
                    <FormControlLabel
                      key={w.worldId}
                      control={
                        <Checkbox
                          size="small"
                          checked={(draft.worldIds || []).includes(w.worldId)}
                          onChange={(_, checked) => {
                            const current = draft.worldIds || [];
                            const updated = checked
                              ? [...current, w.worldId]
                              : current.filter((id: string) => id !== w.worldId);
                            // Stay in individual mode (keep []) — don't fall back to null
                            updateDraft('worldIds', updated);
                          }}
                          disabled={!canManage}
                        />
                      }
                      label={
                        <Typography variant="body2" fontSize="0.8rem">
                          {w.worldId}{w.name ? ` (${w.name})` : ''}
                        </Typography>
                      }
                      sx={{ minWidth: '45%', mr: 0 }}
                    />
                  ))}
                </Box>
              )}
            </Box>
          )}

          {/* Enabled toggle */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              mb: 2,
            }}
          >
            <Typography variant="subtitle2">
              {t('hotTimeBuffEvent.enabled')}
            </Typography>
            <Switch
              checked={draft.enabled}
              onChange={(_, checked) => updateDraft('enabled', checked)}
              disabled={!canManage}
            />
          </Box>

          {/* Date overrides */}
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
            {t('hotTimeBuffEvent.override')}
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <TextField
              label={t('hotTimeBuffEvent.startDate')}
              type="date"
              value={draft.startDateOverride?.substring(0, 10) || ''}
              onChange={(e) =>
                updateDraft('startDateOverride', e.target.value || null)
              }
              size="small"
              fullWidth
              disabled={!canManage}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label={t('hotTimeBuffEvent.endDate')}
              type="date"
              value={draft.endDateOverride?.substring(0, 10) || ''}
              onChange={(e) =>
                updateDraft('endDateOverride', e.target.value || null)
              }
              size="small"
              fullWidth
              disabled={!canManage}
              InputLabelProps={{ shrink: true }}
            />
          </Box>
          <Box sx={{ mb: 2, px: 1 }}>
            <Typography variant="caption" color="text.secondary">
              {t('hotTimeBuffEvent.startHour')} ~ {t('hotTimeBuffEvent.endHour')}: {draft.startHourOverride ?? cms.startHour} ~ {draft.endHourOverride ?? cms.endHour}시
            </Typography>
            <Slider
              value={[draft.startHourOverride ?? cms.startHour, draft.endHourOverride ?? cms.endHour]}
              onChange={(_, val) => {
                const [s, e] = val as number[];
                updateDraft('startHourOverride', s);
                updateDraft('endHourOverride', e);
              }}
              min={0}
              max={24}
              step={1}
              marks={[{ value: 0, label: '0' }, { value: 6, label: '6' }, { value: 12, label: '12' }, { value: 18, label: '18' }, { value: 24, label: '24' }]}
              valueLabelDisplay="auto"
              disabled={!canManage}
              size="small"
            />
          </Box>
          <Box sx={{ mb: 2, px: 1 }}>
            <Typography variant="caption" color="text.secondary">
              {t('hotTimeBuffEvent.minLv')} ~ {t('hotTimeBuffEvent.maxLv')}: {draft.minLvOverride ?? cms.minLv} ~ {draft.maxLvOverride ?? cms.maxLv}
            </Typography>
            <Slider
              value={[draft.minLvOverride ?? cms.minLv ?? 1, draft.maxLvOverride ?? cms.maxLv ?? 200]}
              onChange={(_, val) => {
                const [min, max] = val as number[];
                updateDraft('minLvOverride', min);
                updateDraft('maxLvOverride', max);
              }}
              min={1}
              max={200}
              step={1}
              marks={[{ value: 1, label: '1' }, { value: 50, label: '50' }, { value: 100, label: '100' }, { value: 150, label: '150' }, { value: 200, label: '200' }]}
              valueLabelDisplay="auto"
              disabled={!canManage}
              size="small"
            />
          </Box>

          <Divider sx={{ my: 2 }} />

          {/* Day-of-week toggle */}
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
            {t('hotTimeBuffEvent.dayOfWeek')}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
            {DAY_BITS.map((d) => {
              const isOn = !!(dayBits & (1 << d.bit));
              return (
                <Chip
                  key={d.bit}
                  label={t(`hotTimeBuffEvent.${d.key}`)}
                  onClick={canManage ? () => toggleDraftDayBit(d.bit) : undefined}
                  color={isOn ? 'primary' : 'default'}
                  variant={isOn ? 'filled' : 'outlined'}
                  size="small"
                  sx={{ fontWeight: isOn ? 600 : 400 }}
                />
              );
            })}
          </Box>

          <Divider sx={{ my: 2 }} />

          {/* World buff checkboxes */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              mb: 1,
            }}
          >
            <Typography variant="subtitle2" color="text.secondary">
              {t('hotTimeBuffEvent.worldBuffList')} (
              {cms.worldBuffId?.length || 0})
            </Typography>
            {canManage && (
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <Button
                  size="small"
                  variant="text"
                  onClick={selectAllWorldBuffs}
                >
                  {t('hotTimeBuffEvent.selectAll')}
                </Button>
                <Button
                  size="small"
                  variant="text"
                  onClick={deselectAllWorldBuffs}
                >
                  {t('hotTimeBuffEvent.deselectAll')}
                </Button>
              </Box>
            )}
          </Box>
          <TableContainer sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox" sx={{ width: 42 }} />
                  <TableCell sx={{ width: 56, fontWeight: 600, fontSize: '0.75rem' }}>{t('hotTimeBuffEvent.buffSource')}</TableCell>
                  <TableCell sx={{ width: 90, fontWeight: 600, fontSize: '0.75rem' }}>ID</TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>{t('hotTimeBuffEvent.buffName')}</TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>{t('hotTimeBuffEvent.buffDesc')}</TableCell>
                  {canManage && extraBuffIds.length > 0 && (
                    <TableCell sx={{ width: 40 }} />
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {(cms.worldBuffId || []).map((wbId, i) => {
                  const checked = activeWorldBuffIds.includes(wbId);
                  const buffInfo = allWorldBuffs.get(wbId);
                  const name = buffInfo?.name || cms.worldBuffNames?.[i] || `WorldBuff #${wbId}`;
                  const desc = buffInfo?.desc || '';
                  return (
                    <TableRow key={wbId} sx={{ opacity: checked ? 1 : 0.5 }}>
                      <TableCell padding="checkbox">
                        <Checkbox
                          size="small"
                          checked={checked}
                          onChange={() => toggleDraftWorldBuff(wbId)}
                          disabled={!canManage}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip label="CMS" size="small" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
                      </TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                        {wbId}
                      </TableCell>
                      <TableCell sx={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <Tooltip title={name} placement="top">
                          <Typography variant="body2" noWrap sx={{ fontSize: '0.8rem' }}>
                            {name}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell sx={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'text.secondary' }}>
                        <Tooltip title={desc || '—'} placement="top">
                          <Typography variant="body2" noWrap sx={{ fontSize: '0.75rem' }}>
                            {desc || '—'}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      {canManage && extraBuffIds.length > 0 && (
                        <TableCell />
                      )}
                    </TableRow>
                  );
                })}
                {/* Extra world buffs added via override (not in CMS list) */}
                {extraBuffIds
                  .map((wbId) => {
                    const buffInfo = allWorldBuffs.get(wbId);
                    const name = buffInfo?.name || `WorldBuff #${wbId}`;
                    const desc = buffInfo?.desc || '';
                    const checked = activeWorldBuffIds.includes(wbId);
                    return (
                      <TableRow key={wbId} sx={{ bgcolor: 'action.hover', opacity: checked ? 1 : 0.5 }}>
                        <TableCell padding="checkbox">
                          <Checkbox size="small" checked={checked} disabled={!canManage} onChange={() => toggleDraftWorldBuff(wbId)} />
                        </TableCell>
                        <TableCell>
                          <Chip label={t('hotTimeBuffEvent.buffAdded')} size="small" color="info" variant="filled" sx={{ height: 20, fontSize: '0.65rem' }} />
                        </TableCell>
                        <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                          {wbId}
                        </TableCell>
                        <TableCell sx={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <Tooltip title={name} placement="top">
                            <Typography variant="body2" noWrap sx={{ fontSize: '0.8rem' }}>
                              {name}
                            </Typography>
                          </Tooltip>
                        </TableCell>
                        <TableCell sx={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'text.secondary' }}>
                          <Tooltip title={desc || '—'} placement="top">
                            <Typography variant="body2" noWrap sx={{ fontSize: '0.75rem' }}>
                              {desc || '—'}
                            </Typography>
                          </Tooltip>
                        </TableCell>
                        {canManage && (
                          <TableCell sx={{ px: 0.5 }}>
                            <IconButton size="small" color="error" onClick={() => toggleDraftWorldBuff(wbId)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Add new world buff via selector */}
          {canManage && (() => {
            // Compute available buffs not yet in activeWorldBuffIds
            const availableOptions = Array.from(allWorldBuffs.entries())
              .filter(([id]) => !activeWorldBuffIds.includes(id))
              .map(([id, info]) => ({ id, label: formatWorldBuffLabel(id, info) }));
            if (availableOptions.length === 0) return null;
            return (
              <Autocomplete
                options={availableOptions}
                getOptionLabel={(opt) => opt.label}
                size="small"
                sx={{ mt: 1 }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder={t('hotTimeBuffEvent.addWorldBuff')}
                    size="small"
                  />
                )}
                onChange={(_, val) => {
                  if (val) {
                    setDrawerDraft((prev) => {
                      if (!prev) return prev;
                      const current = prev.worldBuffIdOverride || [...(cms.worldBuffId || [])];
                      return { ...prev, worldBuffIdOverride: [...current, val.id] };
                    });
                  }
                }}
                value={null}
                blurOnSelect
              />
            );
          })()}

          {/* Reset override */}
          {canManage && drawerRow.savedOverride && (
            <Box sx={{ mt: 3 }}>
              <Button
                variant="outlined"
                color="warning"
                startIcon={<ResetIcon />}
                onClick={() => {
                  setResetTarget(String(drawerRow.cmsId));
                  setResetConfirmOpen(true);
                }}
                fullWidth
              >
                {t('hotTimeBuffEvent.resetOverride')}
              </Button>
            </Box>
          )}
        </Box>

        {/* Footer — Cancel / Update */}
        {canManage && (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 1,
              p: 2,
              borderTop: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper',
            }}
          >
            <Button
              variant="contained"
              color="inherit"
              size="small"
              onClick={closeDrawer}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="contained"
              size="small"
              onClick={commitDrawerDraft}
              disabled={!drawerIsDirty}
            >
              {t('hotTimeBuffEvent.update')}
            </Button>
          </Box>
        )}
      </Box>
    );
  };

  // --------------- Table ---------------
  const renderTable = () => (
    <TableContainer sx={{ overflowX: 'auto' }}>
      <Table size="small" stickyHeader sx={{ minWidth: 800 }}>
        <TableHead>
          <TableRow>
            {visibleColumns.map((col) => (
              <TableCell
                key={col.id}
                sx={{
                  width: col.width,
                  fontWeight: 600,
                  ...(col.id === 'edit' ? { px: 0.5 } : {}),
                  ...(col.id === 'name' || col.id === 'worldBuffs' ? { minWidth: col.id === 'name' ? 180 : 140 } : {}),
                }}
                align={col.id === 'edit' ? 'center' : 'left'}
              >
                {col.id === 'edit' ? (
                  <Tooltip title={t('hotTimeBuffEvent.override')}>
                    <span>✎</span>
                  </Tooltip>
                ) : col.label}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {paginatedRows.map((row, idx) => {
            const override = row.localOverride || row.savedOverride;
            const cms = row.cmsItem;
            const eStartDate =
              override?.startDateOverride || cms.startDate;
            const eEndDate = override?.endDateOverride || cms.endDate;
            const eStartHour = override?.startHourOverride ?? cms.startHour;
            const eEndHour = override?.endHourOverride ?? cms.endHour;
            const eDayOfWeek =
              override?.bitFlagDayOfWeekOverride ?? cms.bitFlagDayOfWeek;
            // Active world buff count
            const totalBuffs = cms.worldBuffId?.length || 0;
            const activeBuffs = override?.worldBuffIdOverride
              ? override.worldBuffIdOverride.length
              : totalBuffs;

            const renderCell = (colId: string) => {
              switch (colId) {
                case 'edit':
                  return override ? (
                    <Chip
                      label="✓"
                      size="small"
                      color="info"
                      sx={{ height: 20, minWidth: 32, fontSize: '0.7rem' }}
                    />
                  ) : (
                    <Typography variant="body2" color="text.disabled">—</Typography>
                  );
                case 'cmsId':
                  return (
                    <Typography variant="body2" fontFamily="monospace">
                      {row.cmsId}
                    </Typography>
                  );
                case 'world': {
                  const wids = (override || row.savedOverride)?.worldIds;
                  if (!wids || wids.length === 0) {
                    return (
                      <Typography variant="body2" color="text.disabled" fontSize="0.75rem">
                        전역
                      </Typography>
                    );
                  }
                  return (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.3 }}>
                      {wids.slice(0, 3).map((wid: string) => (
                        <Chip
                          key={wid}
                          label={wid}
                          size="small"
                          color="primary"
                          variant="outlined"
                          sx={{ height: 18, fontSize: '0.65rem' }}
                        />
                      ))}
                      {wids.length > 3 && (
                        <Typography variant="caption" color="text.secondary">
                          +{wids.length - 3}
                        </Typography>
                      )}
                    </Box>
                  );
                }
                case 'name':
                  return (
                    <Tooltip title={cms.name || ''} placement="top-start">
                      <Typography
                        variant="body2"
                        fontWeight={500}
                        noWrap
                        sx={{
                          maxWidth: 200,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          cursor: 'pointer',
                          '&:hover': { textDecoration: 'underline' },
                        }}
                        onClick={() => openDrawer(row)}
                      >
                        {cms.name || `HotTimeBuff #${row.cmsId}`}
                      </Typography>
                    </Tooltip>
                  );
                case 'enabled':
                  return (
                    <Chip
                      label={(override?.enabled ?? true)
                        ? t('hotTimeBuffEvent.statusActive')
                        : t('hotTimeBuffEvent.statusInactive')}
                      size="small"
                      color={(override?.enabled ?? true) ? 'success' : 'default'}
                      variant={(override?.enabled ?? true) ? 'filled' : 'outlined'}
                      sx={{ height: 20, fontSize: '0.7rem' }}
                    />
                  );
                case 'startDate':
                  return (
                    <Typography variant="body2" fontSize="0.8rem">
                      {formatDateShort(eStartDate)}
                    </Typography>
                  );
                case 'endDate':
                  return (
                    <Typography variant="body2" fontSize="0.8rem">
                      {formatDateShort(eEndDate)}
                    </Typography>
                  );
                case 'hours':
                  return (
                    <Typography variant="body2" fontSize="0.8rem">
                      {eStartHour}~{eEndHour}
                    </Typography>
                  );
                case 'level':
                  return (
                    <Typography variant="body2" fontSize="0.8rem">
                      {override?.minLvOverride ?? cms.minLv}~{override?.maxLvOverride ?? cms.maxLv}
                    </Typography>
                  );
                case 'dayOfWeek':
                  return (
                    <Typography variant="body2" fontSize="0.75rem">
                      {formatDayOfWeek(eDayOfWeek, t)}
                    </Typography>
                  );
                case 'worldBuffs': {
                  const activeIds: number[] = override?.worldBuffIdOverride || cms.worldBuffId || [];
                  const allIds: number[] = cms.worldBuffId || [];
                  const mergedIds = [...new Set([...allIds, ...activeIds])];
                  return (
                    <Tooltip
                      title={
                        <Box sx={{ maxWidth: 420 }}>
                          <Table size="small" sx={{
                            '& td, & th': {
                              border: '1px solid rgba(255,255,255,0.15)',
                              px: 1, py: 0.4, fontSize: '0.72rem', color: 'inherit',
                            },
                            '& th': {
                              fontWeight: 700, bgcolor: 'rgba(255,255,255,0.08)', whiteSpace: 'nowrap',
                            },
                          }}>
                            <TableHead>
                              <TableRow>
                                <TableCell component="th" align="center" sx={{ width: 28 }}></TableCell>
                                <TableCell component="th" sx={{ width: 70 }}>ID</TableCell>
                                <TableCell component="th">버프명</TableCell>
                                <TableCell component="th">설명</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {mergedIds.map((id) => {
                                const isActive = activeIds.includes(id);
                                const info = allWorldBuffs.get(id);
                                const wbIdx = cms.worldBuffId?.indexOf(id) ?? -1;
                                const name = info?.name || (wbIdx >= 0 ? cms.worldBuffNames?.[wbIdx] : null) || `#${id}`;
                                const desc = info?.desc || '';
                                const truncDesc = desc.length > 50 ? desc.substring(0, 50) + '…' : desc;
                                return (
                                  <TableRow key={id} sx={{ opacity: isActive ? 1 : 0.45 }}>
                                    <TableCell align="center" sx={{ fontSize: '0.8rem' }}>
                                      {isActive ? '✅' : '⬜'}
                                    </TableCell>
                                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>{id}</TableCell>
                                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{name}</TableCell>
                                    <TableCell sx={{ color: 'rgba(255,255,255,0.65)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {truncDesc || '—'}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </Box>
                      }
                      arrow
                      placement="left"
                      componentsProps={{
                        tooltip: {
                          sx: {
                            bgcolor: 'grey.900',
                            border: '1px solid', borderColor: 'grey.700',
                            borderRadius: 1.5, p: 0.5, maxWidth: 'none',
                          },
                        },
                        arrow: { sx: { color: 'grey.900' } },
                      }}
                    >
                      <Chip
                        label={`${activeBuffs}/${totalBuffs}`}
                        size="small"
                        color={activeBuffs < totalBuffs ? 'warning' : 'default'}
                        variant="outlined"
                      />
                    </Tooltip>
                  );
                }
                case 'status':
                  return getStatusChip(row);
                default:
                  return null;
              }
            };

            return (
              <TableRow
                key={row.cmsId}
                hover
                onClick={() => openDrawer(row)}
                sx={{
                  cursor: 'pointer',
                  bgcolor: row.isDirty
                    ? 'action.selected'
                    : idx % 2 === 1
                      ? 'action.hover'
                      : undefined,
                  '&:hover': { bgcolor: 'action.focus' },
                }}
              >
                {visibleColumns.map((col) => (
                  <TableCell
                    key={col.id}
                    align={col.id === 'edit' || col.id === 'enabled' ? 'center' : 'left'}
                  >
                    {renderCell(col.id)}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );

  return (
    <PageContentLoader loading={isInitialLoad}>
      <Box>
        {/* Toolbar */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            mb: 2,
            flexWrap: 'wrap',
          }}
        >
          <SearchTextField
            value={searchTerm}
            onChange={(v) => {
              setSearchTerm(v);
              setPage(0);
            }}
            sx={{ minWidth: 240 }}
          />
          <DynamicFilterBar
            availableFilters={filterDefinitions}
            activeFilters={activeFilters}
            onFilterAdd={handleFilterAdd}
            onFilterRemove={handleFilterRemove}
            onFilterChange={handleDynamicFilterChange}
            onOperatorChange={handleOperatorChange}
          />
          {/* Column Settings — right after filter bar */}
          <Tooltip title="컬럼 설정">
            <IconButton
              onClick={(e) => setColumnSettingsAnchor(e.currentTarget)}
              sx={{
                bgcolor: 'background.paper',
                border: 1,
                borderColor: 'divider',
                '&:hover': { bgcolor: 'action.hover' },
              }}
              size="small"
            >
              <ViewColumnsIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Popover
            open={Boolean(columnSettingsAnchor)}
            anchorEl={columnSettingsAnchor}
            onClose={() => setColumnSettingsAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            transformOrigin={{ vertical: 'top', horizontal: 'left' }}
          >
            <Box sx={{ p: 2, minWidth: 280, maxWidth: 320 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  {t('users.columnSettings')}
                </Typography>
                <Button size="small" onClick={() => { setColumns(DEFAULT_COLUMNS); localStorage.removeItem(COLUMN_STORAGE_KEY); }}>
                  {t('common.reset')}
                </Button>
              </Box>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                modifiers={[restrictToVerticalAxis]}
                onDragEnd={handleColumnDragEnd}
              >
                <SortableContext
                  items={columns.map((c) => c.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <List dense disablePadding>
                    {columns.map((col) => (
                      <SortableColumnItem
                        key={col.id}
                        column={col}
                        onToggle={toggleColumnVisibility}
                      />
                    ))}
                  </List>
                </SortableContext>
              </DndContext>
            </Box>
          </Popover>

          {/* Date range filter toggle */}
          <Tooltip title="기간 내 이벤트만 표시">
            <IconButton
              onClick={() => handleToggleDateRangeFilter(!showOnlyInPeriod)}
              size="small"
              sx={{
                bgcolor: showOnlyInPeriod ? 'primary.main' : 'background.paper',
                border: 1,
                borderColor: showOnlyInPeriod ? 'primary.main' : 'divider',
                borderRadius: 1,
                color: showOnlyInPeriod ? 'primary.contrastText' : 'action.active',
                '&:hover': {
                  bgcolor: showOnlyInPeriod ? 'primary.dark' : 'action.hover',
                },
              }}
            >
              <DateRangeIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          {/* Day-of-week filter toggle */}
          <Tooltip title="오늘 요일에 해당하는 이벤트만 표시">
            <IconButton
              onClick={() => handleToggleDayFilter(!showOnlyMatchingDay)}
              size="small"
              sx={{
                bgcolor: showOnlyMatchingDay ? 'primary.main' : 'background.paper',
                border: 1,
                borderColor: showOnlyMatchingDay ? 'primary.main' : 'divider',
                borderRadius: 1,
                color: showOnlyMatchingDay ? 'primary.contrastText' : 'action.active',
                '&:hover': {
                  bgcolor: showOnlyMatchingDay ? 'primary.dark' : 'action.hover',
                },
              }}
            >
              <CalendarViewDayIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

          {/* View mode toggle: table ↔ calendar */}
          <Tooltip title={viewMode === 'table' ? t('hotTimeBuffEvent.calendarView') : t('hotTimeBuffEvent.tableView')}>
            <IconButton
              onClick={() => handleSetViewMode(viewMode === 'table' ? 'calendar' : 'table')}
              size="small"
              sx={{
                bgcolor: viewMode === 'calendar' ? 'primary.main' : 'background.paper',
                border: 1,
                borderColor: viewMode === 'calendar' ? 'primary.main' : 'divider',
                borderRadius: 1,
                color: viewMode === 'calendar' ? 'primary.contrastText' : 'action.active',
                '&:hover': {
                  bgcolor: viewMode === 'calendar' ? 'primary.dark' : 'action.hover',
                },
              }}
            >
              {viewMode === 'table' ? <CalendarMonthIcon fontSize="small" /> : <TableChartIcon fontSize="small" />}
            </IconButton>
          </Tooltip>

          {/* Month jump — only visible in calendar mode */}
          {viewMode === 'calendar' && (
            <DatePicker
              views={['year', 'month']}
              value={dayjs(calendarMonth + '-01')}
              onChange={(val: Dayjs | null) => {
                if (val && val.isValid()) {
                  const str = val.format('YYYY-MM');
                  setCalendarMonth(str);
                  calendarRef.current?.getApi().gotoDate(str + '-01');
                }
              }}
              slotProps={{
                textField: {
                  size: 'small',
                  sx: { width: 160, ml: 0.5 },
                  inputProps: { style: { paddingTop: 6, paddingBottom: 6, fontSize: '0.8rem' } },
                },
              }}
            />
          )}

          <Box sx={{ flex: 1 }} />

          {dirtyCount > 0 && (
            <Chip
              label={t('hotTimeBuffEvent.pendingChanges', {
                count: dirtyCount,
              })}
              color="warning"
              size="small"
              sx={{ mr: 1 }}
            />
          )}

          <Button
            startIcon={<RefreshIcon />}
            onClick={loadData}
            disabled={loading}
            size="small"
          >
            {t('common.refresh')}
          </Button>

          {canManage && (
            <Badge badgeContent={dirtyCount} color="warning">
              <Button
                variant="contained"
                startIcon={<ApplyIcon />}
                onClick={() => setApplyConfirmOpen(true)}
                disabled={loading || dirtyCount === 0}
                size="small"
              >
                {t('hotTimeBuffEvent.applyChanges')}
              </Button>
            </Badge>
          )}
        </Box>

        {/* Content: Table or Calendar */}
        {viewMode === 'table' ? (
          // --- Table View ---
          filteredRows.length === 0 && !loading ? (
            <EmptyPagePlaceholder
              message={
                searchTerm
                  ? t('common.noSearchResults')
                  : t('common.noData')
              }
            />
          ) : (
            <Card variant="outlined">
              <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
                {renderTable()}
                <SimplePagination
                  count={filteredRows.length}
                  page={page}
                  rowsPerPage={rowsPerPage}
                  onPageChange={(_, newPage) => setPage(newPage)}
                  onRowsPerPageChange={(e) => {
                    setRowsPerPage(Number(e.target.value));
                    setPage(0);
                  }}
                  rowsPerPageOptions={ROWS_PER_PAGE_OPTIONS}
                />
              </CardContent>
            </Card>
          )
        ) : (
          // --- Calendar View ---
          <Card variant="outlined" sx={{ overflow: 'visible' }}>
            <CardContent sx={{ p: 2, overflow: 'hidden', '& .fc-event': { cursor: 'pointer' }, '& .fc-more-link': { cursor: 'pointer' } }}>
              <FullCalendar
                ref={calendarRef}
                plugins={[dayGridPlugin, interactionPlugin]}
                headerToolbar={{
                  left: 'prev,next today',
                  center: 'title',
                  right: '',
                }}
                initialView="dayGridMonth"
                events={calendarEvents}
                locale={getCalendarLocale()}
                buttonText={getCalendarButtonText()}
                height="auto"
                dayMaxEvents={4}
                eventDisplay="block"
                eventClick={(info) => {
                  const row = info.event.extendedProps.row as RowData;
                  if (row) openDrawer(row);
                }}
                eventTimeFormat={{
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false,
                }}
                nowIndicator={true}
                datesSet={(info) => {
                  const d = info.view.currentStart;
                  setCalendarMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
                }}
                moreLinkClick={(info) => {
                  const dateStr = info.date.toISOString().substring(0, 10);
                  const dayRows = info.allSegs.map((seg: any) => seg.event.extendedProps.row as RowData).filter(Boolean);
                  setMoreEventsDate(dateStr);
                  setMoreEventsRows(dayRows);
                  setMoreEventsOpen(true);
                  return 'none'; // prevent default popover
                }}
              />
              {filteredRows.length === 0 && !loading && (
                <Box sx={{ py: 4, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    {searchTerm ? t('common.noSearchResults') : t('common.noData')}
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        )}

        {/* More Events Dialog (calendar "+N개" click) */}
        <Dialog
          open={moreEventsOpen}
          onClose={() => setMoreEventsOpen(false)}
          maxWidth="lg"
          fullWidth
        >
          <DialogTitle sx={{ pb: 1 }}>
            {moreEventsDate} — {moreEventsRows.length} {t('hotTimeBuffEvent.events')}
          </DialogTitle>
          <DialogContent sx={{ px: 2, pb: 1 }}>
            <TableContainer sx={{ border: 1, borderColor: 'divider', borderRadius: 1, maxHeight: 480 }}>
              <Table size="small" stickyHeader sx={{ '& td, & th': { borderRight: 1, borderColor: 'divider', '&:last-child': { borderRight: 0 } } }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, fontSize: '0.7rem', width: 75, whiteSpace: 'nowrap', bgcolor: 'background.paper' }}>ID</TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: '0.7rem', minWidth: 140, bgcolor: 'background.paper' }}>{t('hotTimeBuffEvent.buffName')}</TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: '0.7rem', whiteSpace: 'nowrap', width: 95, bgcolor: 'background.paper' }}>{t('hotTimeBuffEvent.startDate')}</TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: '0.7rem', whiteSpace: 'nowrap', width: 95, bgcolor: 'background.paper' }}>{t('hotTimeBuffEvent.endDate')}</TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: '0.7rem', whiteSpace: 'nowrap', width: 65, bgcolor: 'background.paper' }}>{t('hotTimeBuffEvent.hours')}</TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: '0.7rem', whiteSpace: 'nowrap', width: 60, bgcolor: 'background.paper' }}>Lv</TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: '0.7rem', whiteSpace: 'nowrap', width: 60, bgcolor: 'background.paper' }}>{t('hotTimeBuffEvent.dayOfWeek')}</TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: '0.7rem', minWidth: 100, bgcolor: 'background.paper' }}>{t('hotTimeBuffEvent.worldBuffs')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {moreEventsRows.map((row) => {
                    const cms = row.cmsItem;
                    const override = row.localOverride || row.savedOverride;
                    const startD = (override?.startDateOverride || cms.startDate)?.substring(0, 10) || '—';
                    const endD = (override?.endDateOverride || cms.endDate)?.substring(0, 10) || '—';
                    const sH = override?.startHourOverride ?? cms.startHour;
                    const eH = override?.endHourOverride ?? cms.endHour;
                    const dayBits = override?.bitFlagDayOfWeekOverride ?? cms.bitFlagDayOfWeek;
                    const dayStr = dayBits === 127 ? t('hotTimeBuffEvent.dayAll')
                      : DAY_BITS.filter((d) => dayBits & (1 << d.bit)).map((d) => t(`hotTimeBuffEvent.${d.key}`).charAt(0)).join('');
                    return (
                      <TableRow
                        key={row.cmsId}
                        hover
                        sx={{ cursor: 'pointer' }}
                        onClick={() => {
                          setMoreEventsOpen(false);
                          openDrawer(row);
                        }}
                      >
                        <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>{row.cmsId}</TableCell>
                        <TableCell sx={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <Tooltip title={cms.name || ''} placement="top">
                            <Typography variant="body2" noWrap sx={{ fontSize: '0.75rem' }}>
                              {cms.name || `HotTimeBuff #${row.cmsId}`}
                            </Typography>
                          </Tooltip>
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.7rem', whiteSpace: 'nowrap' }}>{startD}</TableCell>
                        <TableCell sx={{ fontSize: '0.7rem', whiteSpace: 'nowrap' }}>{endD}</TableCell>
                        <TableCell sx={{ fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
                          {sH}~{eH}
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
                          {cms.minLv}–{cms.maxLv}
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
                          {dayStr}
                        </TableCell>
                        <TableCell sx={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'text.secondary' }}>
                          <Tooltip title={cms.worldBuffNames?.join(', ') || '—'} placement="top">
                            <Typography variant="body2" noWrap sx={{ fontSize: '0.7rem' }}>
                              {cms.worldBuffNames?.join(', ') || '—'}
                            </Typography>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setMoreEventsOpen(false)}>{t('common.close')}</Button>
          </DialogActions>
        </Dialog>

        {/* Detail Drawer */}
        <ResizableDrawer
          open={drawerOpen}
          onClose={closeDrawer}
          title={
            drawerRow?.cmsItem.name ||
            (drawerRow ? `HotTimeBuff #${drawerRow.cmsId}` : '')
          }
          subtitle={drawerRow ? `ID: ${drawerRow.cmsId}` : ''}
          storageKey="hottime-buff-drawer"
          defaultWidth={560}
          minWidth={400}
        >
          {renderDrawerContent()}
        </ResizableDrawer>

        {/* Apply confirmation */}
        <Dialog
          open={applyConfirmOpen}
          onClose={() => setApplyConfirmOpen(false)}
        >
          <DialogTitle>{t('hotTimeBuffEvent.applyChanges')}</DialogTitle>
          <DialogContent>
            <DialogContentText>
              {t('hotTimeBuffEvent.applyConfirm')}
            </DialogContentText>
            <Box sx={{ mt: 1 }}>
              <Alert severity="info">
                {t('hotTimeBuffEvent.pendingChanges', { count: dirtyCount })}
              </Alert>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setApplyConfirmOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="contained" onClick={handleApply} autoFocus>
              {t('hotTimeBuffEvent.applyChanges')}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Reset confirmation */}
        <Dialog
          open={resetConfirmOpen}
          onClose={() => setResetConfirmOpen(false)}
        >
          <DialogTitle>{t('hotTimeBuffEvent.resetOverride')}</DialogTitle>
          <DialogContent>
            <DialogContentText>
              {t('hotTimeBuffEvent.resetConfirm')}
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setResetConfirmOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="contained"
              color="warning"
              onClick={handleReset}
              autoFocus
            >
              {t('hotTimeBuffEvent.resetOverride')}
            </Button>
          </DialogActions>
        </Dialog>

        <ErrorDialog />
      </Box>
    </PageContentLoader>
  );
};

export default HotTimeBuffEventPage;
