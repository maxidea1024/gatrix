import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from 'react';
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
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Refresh as RefreshIcon,
  CloudUpload as ApplyIcon,
  RestorePage as ResetIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  ViewColumn as ViewColumnsIcon,
  DateRange as DateRangeIcon,
  CalendarViewDay as CalendarViewDayIcon,
  CalendarMonth as CalendarMonthIcon,
  TableChart as TableChartIcon,
  Event as EventIcon,
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
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
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

// Extracted modules
import {
  RowData,
  ColumnConfig,
  DEFAULT_COLUMNS,
  ROWS_PER_PAGE_OPTIONS,
  DAY_BITS,
  COLUMN_STORAGE_KEY,
  DATE_RANGE_FILTER_KEY,
  DAY_FILTER_KEY,
  VIEW_MODE_KEY,
  ROWS_PER_PAGE_KEY,
} from './types';
import { formatDayOfWeek, formatDateShort, isOverrideDirty } from './utils';
import SortableColumnItem from './SortableColumnItem';
import HotTimeBuffDrawer from './HotTimeBuffDrawer';
import PageHeader from '@/components/common/PageHeader';

const HotTimeBuffEventPage: React.FC<{ embedded?: boolean }> = ({ embedded }) => {
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
  const [rowsPerPage, setRowsPerPage] = useState(() => {
    try {
      const saved = localStorage.getItem(ROWS_PER_PAGE_KEY);
      return saved ? Number(saved) : 20;
    } catch {
      return 20;
    }
  });

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
  const [drawerExtraBuffIds, setDrawerExtraBuffIds] = useState<number[]>([]);

  // Dialogs
  const [applyConfirmOpen, setApplyConfirmOpen] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<string | null>(null);

  // Calendar "more events" popover state
  const [moreEventsOpen, setMoreEventsOpen] = useState(false);
  const [moreEventsDate, setMoreEventsDate] = useState<string>('');
  const [moreEventsRows, setMoreEventsRows] = useState<RowData[]>([]);

  // All world buffs from planning data
  const [allWorldBuffs, setAllWorldBuffs] = useState<
    Map<number, { name: string; desc: string }>
  >(new Map());

  // Game worlds for worldId selector
  const [gameWorlds, setGameWorlds] = useState<GameWorld[]>([]);

  // Column configuration (persisted in localStorage)
  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    const saved = localStorage.getItem(COLUMN_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as ColumnConfig[];
        const merged = parsed.map((s) =>
          DEFAULT_COLUMNS.find((d) => d.id === s.id)
            ? {
                ...DEFAULT_COLUMNS.find((d) => d.id === s.id)!,
                visible: s.visible,
              }
            : s
        );
        const savedIds = new Set(parsed.map((c) => c.id));
        return [
          ...merged,
          ...DEFAULT_COLUMNS.filter((d) => !savedIds.has(d.id)),
        ];
      } catch {
        return DEFAULT_COLUMNS;
      }
    }
    return DEFAULT_COLUMNS;
  });
  const [columnSettingsAnchor, setColumnSettingsAnchor] =
    useState<HTMLButtonElement | null>(null);
  const visibleColumns = useMemo(
    () => columns.filter((c) => c.visible),
    [columns]
  );

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
        localStorage.setItem(
          COLUMN_STORAGE_KEY,
          JSON.stringify(next.map((c) => ({ id: c.id, visible: c.visible })))
        );
        return next;
      });
    }
  }, []);

  const toggleColumnVisibility = useCallback((id: string) => {
    setColumns((prev) => {
      const next = prev.map((c) =>
        c.id === id ? { ...c, visible: !c.visible } : c
      );
      localStorage.setItem(
        COLUMN_STORAGE_KEY,
        JSON.stringify(next.map((c) => ({ id: c.id, visible: c.visible })))
      );
      return next;
    });
  }, []);

  // Dynamic filter state
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);

  const filterDefinitions: FilterDefinition[] = useMemo(
    () => [
      {
        key: 'status',
        label: t('hotTimeBuffEvent.status'),
        type: 'multiselect',
        operator: 'any_of',
        allowOperatorToggle: false,
        options: [
          { value: 'dirty', label: t('hotTimeBuffEvent.filterDirty') },
          { value: 'saved', label: t('hotTimeBuffEvent.filterSaved') },
          { value: 'default', label: t('hotTimeBuffEvent.filterDefault') },
        ],
      },
      {
        key: 'enabled',
        label: t('hotTimeBuffEvent.enabled'),
        type: 'multiselect',
        operator: 'any_of',
        allowOperatorToggle: false,
        options: [
          { value: 'enabled', label: t('hotTimeBuffEvent.filterEnabled') },
          { value: 'disabled', label: t('hotTimeBuffEvent.filterDisabled') },
        ],
      },
      {
        key: 'world',
        label: t('hotTimeBuffEvent.colWorld'),
        type: 'multiselect',
        operator: 'any_of',
        allowOperatorToggle: false,
        options: gameWorlds.map((w) => ({
          value: w.worldId,
          label: w.worldId + (w.name ? ` (${w.name})` : ''),
        })),
      },
    ],
    [t, gameWorlds]
  );

  const handleFilterAdd = useCallback((filter: ActiveFilter) => {
    setActiveFilters((prev) => [...prev, filter]);
    setPage(0);
  }, []);

  const handleFilterRemove = useCallback((key: string) => {
    setActiveFilters((prev) => prev.filter((f) => f.key !== key));
    setPage(0);
  }, []);

  const handleDynamicFilterChange = useCallback((key: string, value: any) => {
    setActiveFilters((prev) =>
      prev.map((f) => (f.key === key ? { ...f, value } : f))
    );
    setPage(0);
  }, []);

  const handleOperatorChange = useCallback(
    (key: string, operator: 'any_of' | 'include_all') => {
      setActiveFilters((prev) =>
        prev.map((f) => (f.key === key ? { ...f, operator } : f))
      );
      setPage(0);
    },
    []
  );

  /** Format world buff label: "ID: name — desc" (truncated if long) */
  const formatWorldBuffLabel = useCallback(
    (id: number, info?: { name: string; desc: string } | null) => {
      const name = info?.name || `WorldBuff #${id}`;
      const desc = info?.desc;
      if (!desc) return `${id}: ${name}`;
      const truncated = desc.length > 40 ? desc.substring(0, 40) + '…' : desc;
      return `${id}: ${name} — ${truncated}`;
    },
    []
  );

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
              buffMap.set(id, {
                name: item.worldBuffNames?.[i] || `WorldBuff #${id}`,
                desc: '',
              });
            }
          });
        }
        setAllWorldBuffs(buffMap);
      }

      // Load game worlds for worldId selector
      try {
        const worldResult =
          await gameWorldService.getGameWorlds(projectApiPath);
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
        const dayOfWeek =
          override?.bitFlagDayOfWeekOverride ?? r.cmsItem.bitFlagDayOfWeek;
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
          (r.localOverride?.worldIds || []).some((wid) =>
            wid.toLowerCase().includes(term)
          ) ||
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
          if (vals.has('default') && !r.isDirty && !r.savedOverride)
            return true;
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
      case 'en':
        return enLocale;
      case 'zh':
        return zhLocale;
      default:
        return koLocale;
    }
  }, [i18n.language]);

  const getCalendarButtonText = useCallback(
    () => ({
      today: t('hotTimeBuffEvent.calToday'),
      month: t('hotTimeBuffEvent.calMonth'),
      week: t('hotTimeBuffEvent.calWeek'),
      day: t('hotTimeBuffEvent.calDay'),
    }),
    [t]
  );

  /** Convert filteredRows to FullCalendar events */
  const calendarEvents = useMemo(() => {
    const events: any[] = [];

    for (const row of filteredRows) {
      const override = row.localOverride || row.savedOverride;
      const startStr = override?.startDateOverride || row.cmsItem.startDate;
      const endStr = override?.endDateOverride || row.cmsItem.endDate;
      const isEnabled = override?.enabled !== false;
      const dayOfWeek =
        override?.bitFlagDayOfWeekOverride ?? row.cmsItem.bitFlagDayOfWeek;
      const startHour = override?.startHourOverride ?? row.cmsItem.startHour;
      const endHour = override?.endHourOverride ?? row.cmsItem.endHour;

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
      const baseTitle = `${row.cmsId}: ${eventName}`;

      const isAllDays = dayOfWeek === 127;

      if (isAllDays) {
        // Continuous bar for all-day events
        let endExclusive: string | undefined;
        if (endStr) {
          const d = new Date(endStr.substring(0, 10));
          d.setDate(d.getDate() + 1);
          endExclusive = d.toISOString().substring(0, 10);
        }
        events.push({
          id: String(row.cmsId),
          title: baseTitle,
          start: startStr?.substring(0, 10),
          end: endExclusive,
          allDay: true,
          backgroundColor: bgColor,
          borderColor,
          textColor,
          extendedProps: { row, desc: eventDesc },
        });
      } else {
        // Per-day events: iterate date range and emit for matching days
        const start = startStr ? new Date(startStr.substring(0, 10)) : null;
        const end = endStr ? new Date(endStr.substring(0, 10)) : null;
        if (start && end) {
          const cursor = new Date(start);
          let idx = 0;
          while (cursor <= end) {
            const dayBit = 1 << cursor.getDay();
            if (dayOfWeek & dayBit) {
              const dateStr = cursor.toISOString().substring(0, 10);
              const next = new Date(cursor);
              next.setDate(next.getDate() + 1);
              events.push({
                id: `${row.cmsId}-${idx}`,
                title: `${baseTitle} (${startHour}~${endHour}h)`,
                start: dateStr,
                end: next.toISOString().substring(0, 10),
                allDay: true,
                backgroundColor: bgColor,
                borderColor,
                textColor,
                extendedProps: { row, desc: eventDesc },
              });
              idx++;
            }
            cursor.setDate(cursor.getDate() + 1);
          }
        }
      }
    }

    return events;
  }, [filteredRows, isDark]);

  // --------------- Drawer open/close ---------------
  const openDrawer = useCallback((row: RowData) => {
    setDrawerRowKey(String(row.cmsId));
    // Make a snapshot for editing
    const base: HotTimeBuffOverride = row.localOverride ||
      row.savedOverride || { cmsId: row.cmsId, enabled: true };
    setDrawerDraft({ ...base });
    setDrawerExtraBuffIds([]);
    setDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setDrawerRowKey(null);
    setDrawerDraft(null);
  }, []);

  // Current row for drawer
  const drawerRow = useMemo(
    () =>
      drawerRowKey !== null
        ? rows.find((r) => String(r.cmsId) === drawerRowKey)
        : null,
    [rows, drawerRowKey]
  );

  // Is drawer draft different from saved?
  const drawerIsDirty = useMemo(() => {
    if (!drawerRow || !drawerDraft) return false;
    // Compare against what was loaded into the drawer (local changes take precedence)
    const base = drawerRow.localOverride || drawerRow.savedOverride;
    return isOverrideDirty(base, drawerDraft);
  }, [drawerRow, drawerDraft]);

  // --------------- Drawer field handlers ---------------
  const updateDraft = useCallback((field: string, value: any) => {
    setDrawerDraft((prev) => (prev ? { ...prev, [field]: value } : prev));
  }, []);

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
      if (drawerExtraBuffIds.length === 0) {
        // No extra buffs — null means "all CMS buffs"
        return { ...prev, worldBuffIdOverride: null };
      }
      // Merge: all CMS + all extra
      const merged = [...cmsIds, ...drawerExtraBuffIds];
      return { ...prev, worldBuffIdOverride: merged };
    });
  }, [drawerRow, drawerExtraBuffIds]);

  const deselectAllWorldBuffs = useCallback(() => {
    setDrawerDraft((prev) => {
      if (!prev || !drawerRow) return prev;
      return { ...prev, worldBuffIdOverride: [] };
    });
  }, [drawerRow]);

  // Reset drawer draft to CMS defaults — no overrides
  const resetDrawerDraft = useCallback(() => {
    if (!drawerRow) return;
    setDrawerDraft({
      cmsId: drawerRow.cmsId,
      enabled: true,
    });
    setDrawerExtraBuffIds([]);
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
        t('hotTimeBuffEvent.applySuccess', {
          count: toUpsert.length + toDelete.length,
        }),
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
      await operationEventService.deleteHottimeOverride(projectApiPath, cmsId);
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
                  ...(col.id === 'name' || col.id === 'worldBuffs'
                    ? { minWidth: col.id === 'name' ? 180 : 140 }
                    : {}),
                }}
                align={
                  col.id === 'edit' ||
                  col.id === 'enabled' ||
                  col.id === 'liveStatus'
                    ? 'center'
                    : 'left'
                }
              >
                {col.id === 'edit' ? (
                  <Tooltip title={t('hotTimeBuffEvent.override')}>
                    <span>✎</span>
                  </Tooltip>
                ) : (
                  t(col.label)
                )}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {paginatedRows.map((row, idx) => {
            const override = row.localOverride || row.savedOverride;
            const cms = row.cmsItem;
            const eStartDate = override?.startDateOverride || cms.startDate;
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
                    <Typography variant="body2" color="text.disabled">
                      —
                    </Typography>
                  );
                case 'cmsId':
                  return <Typography variant="body2">{row.cmsId}</Typography>;
                case 'world': {
                  const wids = (override || row.savedOverride)?.worldIds;
                  if (!wids || wids.length === 0) {
                    return (
                      <Typography
                        variant="body2"
                        color="text.disabled"
                        fontSize="0.75rem"
                      >
                        {t('hotTimeBuffEvent.global')}
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
                case 'enabled': {
                  const eEnabled = override?.enabled ?? true;
                  let isLive = false;
                  if (eEnabled) {
                    const now = new Date();
                    const todayStr = now.toISOString().substring(0, 10);
                    const sd = eStartDate ? eStartDate.substring(0, 10) : null;
                    const ed = eEndDate ? eEndDate.substring(0, 10) : null;
                    const inDate =
                      (!sd || todayStr >= sd) && (!ed || todayStr <= ed);
                    const inDay = (eDayOfWeek & (1 << now.getDay())) !== 0;
                    const inHour =
                      eStartHour <= now.getHours() && now.getHours() < eEndHour;
                    isLive = inDate && inDay && inHour;
                  }
                  return (
                    <Chip
                      label={
                        eEnabled
                          ? t('hotTimeBuffEvent.statusActive')
                          : t('hotTimeBuffEvent.statusInactive')
                      }
                      size="small"
                      color={eEnabled ? 'success' : 'default'}
                      variant={eEnabled ? 'filled' : 'outlined'}
                      sx={{
                        height: 22,
                        fontSize: '0.75rem',
                        ...(eEnabled && !isLive
                          ? {
                              bgcolor: 'rgba(46,125,50,0.25)',
                              color: 'success.light',
                              '& .MuiChip-label': { fontWeight: 500 },
                            }
                          : {}),
                      }}
                    />
                  );
                }
                case 'liveStatus': {
                  const isEnabled = override?.enabled !== false;
                  let liveActive = false;
                  let liveReason = '';
                  if (!isEnabled) {
                    liveReason = t('hotTimeBuffEvent.liveDisabled');
                  } else {
                    const now = new Date();
                    const todayStr = now.toISOString().substring(0, 10);
                    const currentHour = now.getHours();
                    const todayDayBit = 1 << now.getDay();
                    const startDate = eStartDate
                      ? eStartDate.substring(0, 10)
                      : null;
                    const endDate = eEndDate ? eEndDate.substring(0, 10) : null;
                    const inDateRange =
                      (!startDate || todayStr >= startDate) &&
                      (!endDate || todayStr <= endDate);
                    const inDayOfWeek = (eDayOfWeek & todayDayBit) !== 0;
                    const inHourRange =
                      eStartHour <= currentHour && currentHour < eEndHour;
                    if (!inDateRange) {
                      liveReason = t('hotTimeBuffEvent.liveOutOfDate');
                    } else if (!inDayOfWeek) {
                      liveReason = t('hotTimeBuffEvent.liveWrongDay');
                    } else if (!inHourRange) {
                      liveReason = `${t('hotTimeBuffEvent.liveWaiting')} ${eStartHour}~${eEndHour}${t('hotTimeBuffEvent.hourUnit')}`;
                    } else {
                      liveActive = true;
                    }
                  }
                  return (
                    <Chip
                      label={
                        liveActive
                          ? t('hotTimeBuffEvent.liveActive')
                          : liveReason
                      }
                      size="small"
                      color={liveActive ? 'success' : 'default'}
                      sx={{ height: 22, fontSize: '0.7rem' }}
                    />
                  );
                }
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
                      {override?.minLvOverride ?? cms.minLv}~
                      {override?.maxLvOverride ?? cms.maxLv}
                    </Typography>
                  );
                case 'dayOfWeek':
                  return (
                    <Typography variant="body2" fontSize="0.75rem">
                      {formatDayOfWeek(eDayOfWeek, t)}
                    </Typography>
                  );
                case 'worldBuffs': {
                  const activeIds: number[] =
                    override?.worldBuffIdOverride || cms.worldBuffId || [];
                  const allIds: number[] = cms.worldBuffId || [];
                  const mergedIds = [...new Set([...allIds, ...activeIds])];
                  const cmsBuffIds = cms.worldBuffId || [];
                  const overrideIds =
                    override?.worldBuffIdOverride || cmsBuffIds;
                  const cmsTotal = cmsBuffIds.length;
                  const cmsActive = overrideIds.filter((id) =>
                    cmsBuffIds.includes(id)
                  ).length;
                  const extraActive = overrideIds.filter(
                    (id) => !cmsBuffIds.includes(id)
                  ).length;
                  return (
                    <Tooltip
                      title={
                        <Box sx={{ maxWidth: 520, overflow: 'hidden' }}>
                          <Table
                            size="small"
                            sx={{
                              tableLayout: 'fixed',
                              width: '100%',
                              '& td, & th': {
                                border: '1px solid rgba(255,255,255,0.15)',
                                px: 0.8,
                                py: 0.4,
                                fontSize: '0.72rem',
                                color: 'inherit',
                              },
                              '& th': {
                                fontWeight: 700,
                                bgcolor: 'rgba(255,255,255,0.08)',
                                whiteSpace: 'nowrap',
                              },
                            }}
                          >
                            <colgroup>
                              <col style={{ width: 28 }} />
                              <col style={{ width: 36 }} />
                              <col style={{ width: 72 }} />
                              <col style={{ width: 140 }} />
                              <col />
                            </colgroup>
                            <TableHead>
                              <TableRow>
                                <TableCell
                                  component="th"
                                  align="center"
                                ></TableCell>
                                <TableCell component="th">
                                  {t('hotTimeBuffEvent.buffSource')}
                                </TableCell>
                                <TableCell component="th">ID</TableCell>
                                <TableCell component="th">
                                  {t('hotTimeBuffEvent.buffName')}
                                </TableCell>
                                <TableCell component="th">
                                  {t('hotTimeBuffEvent.buffDesc')}
                                </TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {mergedIds.map((id) => {
                                const isActive = activeIds.includes(id);
                                const isCms = cmsBuffIds.includes(id);
                                const info = allWorldBuffs.get(id);
                                const wbIdx =
                                  cms.worldBuffId?.indexOf(id) ?? -1;
                                const name =
                                  info?.name ||
                                  (wbIdx >= 0
                                    ? cms.worldBuffNames?.[wbIdx]
                                    : null) ||
                                  `#${id}`;
                                const desc = info?.desc || '';
                                const truncDesc =
                                  desc.length > 30
                                    ? desc.substring(0, 30) + '…'
                                    : desc;
                                return (
                                  <TableRow
                                    key={id}
                                    sx={{ opacity: isActive ? 1 : 0.45 }}
                                  >
                                    <TableCell
                                      align="center"
                                      sx={{ fontSize: '0.8rem' }}
                                    >
                                      {isActive ? '✅' : '⬜'}
                                    </TableCell>
                                    <TableCell
                                      sx={{
                                        fontSize: '0.65rem',
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      {isCms
                                        ? 'CMS'
                                        : t('hotTimeBuffEvent.buffAdded')}
                                    </TableCell>
                                    <TableCell
                                      sx={{
                                        fontSize: '0.7rem',
                                      }}
                                    >
                                      {id}
                                    </TableCell>
                                    <TableCell
                                      sx={{
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      {name}
                                    </TableCell>
                                    <TableCell
                                      sx={{
                                        color: 'rgba(255,255,255,0.65)',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
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
                            border: '1px solid',
                            borderColor: 'grey.700',
                            borderRadius: 1.5,
                            p: 0.5,
                            maxWidth: 540,
                          },
                        },
                        arrow: { sx: { color: 'grey.900' } },
                      }}
                    >
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                      >
                        <Chip
                          label={`${cmsActive}/${cmsTotal}`}
                          size="small"
                          color={cmsActive < cmsTotal ? 'warning' : 'default'}
                          variant="outlined"
                        />
                        {extraActive > 0 && (
                          <Chip
                            label={`+${extraActive}`}
                            size="small"
                            color="info"
                            variant="filled"
                            sx={{
                              height: 20,
                              fontSize: '0.65rem',
                              '& .MuiChip-label': { px: 0.5 },
                            }}
                          />
                        )}
                      </Box>
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
                    align={
                      col.id === 'edit' ||
                      col.id === 'enabled' ||
                      col.id === 'liveStatus'
                        ? 'center'
                        : 'left'
                    }
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
      {!embedded && (
        <PageHeader
          icon={<EventIcon />}
          title={t('sidebar.operationEvents')}
        />
      )}
      <Box>
        {/* Toolbar */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            mb: 2,
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            width: '100%',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              gap: 1.5,
              alignItems: 'center',
              flexWrap: 'wrap',
              flexGrow: 1,
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

            {/* Unified Control Group */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                bgcolor: 'background.paper',
                border: 1,
                borderColor: 'divider',
                borderRadius: '8px',
                minHeight: '36px',
                px: 0.5,
                boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
              }}
            >
              <DynamicFilterBar
                availableFilters={filterDefinitions}
                activeFilters={activeFilters}
                onFilterAdd={handleFilterAdd}
                onFilterRemove={handleFilterRemove}
                onFilterChange={handleDynamicFilterChange}
                onOperatorChange={handleOperatorChange}
              />

              <Box sx={{ width: '1px', height: '20px', bgcolor: 'divider', mx: 0.5 }} />

              {/* Column Settings Button */}
              <Tooltip title={t('hotTimeBuffEvent.columnSettings')}>
                <IconButton
                  size="small"
                  onClick={(e) => setColumnSettingsAnchor(e.currentTarget)}
                  sx={{
                    color: 'text.secondary',
                    borderRadius: '6px',
                    width: 30,
                    height: 30,
                    '&:hover': {
                      bgcolor: 'action.hover',
                      color: 'primary.main',
                    },
                  }}
                >
                  <ViewColumnsIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>

              <Box sx={{ width: '1px', height: '20px', bgcolor: 'divider', mx: 0.5 }} />

              {/* Date range filter toggle */}
              <Tooltip title={t('hotTimeBuffEvent.filterDateRangeHint')}>
                <IconButton
                  onClick={() => handleToggleDateRangeFilter(!showOnlyInPeriod)}
                  size="small"
                  sx={{
                    borderRadius: '6px',
                    width: 30,
                    height: 30,
                    color: showOnlyInPeriod ? 'primary.main' : 'text.secondary',
                    bgcolor: showOnlyInPeriod ? 'action.selected' : 'transparent',
                    '&:hover': {
                      bgcolor: 'action.hover',
                    },
                  }}
                >
                  <DateRangeIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>

              {/* Day-of-week filter toggle */}
              <Tooltip title={t('hotTimeBuffEvent.filterDayHint')}>
                <IconButton
                  onClick={() => handleToggleDayFilter(!showOnlyMatchingDay)}
                  size="small"
                  sx={{
                    borderRadius: '6px',
                    width: 30,
                    height: 30,
                    color: showOnlyMatchingDay ? 'primary.main' : 'text.secondary',
                    bgcolor: showOnlyMatchingDay ? 'action.selected' : 'transparent',
                    '&:hover': {
                      bgcolor: 'action.hover',
                    },
                  }}
                >
                  <CalendarViewDayIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>

              <Box sx={{ width: '1px', height: '20px', bgcolor: 'divider', mx: 0.5 }} />

              {/* View mode toggle: table ↔ calendar */}
              <Tooltip
                title={
                  viewMode === 'table'
                    ? t('hotTimeBuffEvent.calendarView')
                    : t('hotTimeBuffEvent.tableView')
                }
              >
                <IconButton
                  onClick={() =>
                    handleSetViewMode(viewMode === 'table' ? 'calendar' : 'table')
                  }
                  size="small"
                  sx={{
                    borderRadius: '6px',
                    width: 30,
                    height: 30,
                    color: viewMode === 'calendar' ? 'primary.main' : 'text.secondary',
                    bgcolor: viewMode === 'calendar' ? 'action.selected' : 'transparent',
                    '&:hover': {
                      bgcolor: 'action.hover',
                    },
                  }}
                >
                  {viewMode === 'table' ? (
                    <CalendarMonthIcon sx={{ fontSize: 18 }} />
                  ) : (
                    <TableChartIcon sx={{ fontSize: 18 }} />
                  )}
                </IconButton>
              </Tooltip>

              {/* Month jump — only visible in calendar mode */}
              {viewMode === 'calendar' && (
                <>
                  <Box sx={{ width: '1px', height: '20px', bgcolor: 'divider', mx: 0.5 }} />
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
                        sx: {
                          width: 130,
                          ml: 0.5,
                          '& .MuiOutlinedInput-root': {
                            height: 28,
                            fontSize: '0.75rem',
                          },
                        },
                      },
                    }}
                  />
                </>
              )}
            </Box>
          </Box>

          <Popover
            open={Boolean(columnSettingsAnchor)}
            anchorEl={columnSettingsAnchor}
            onClose={() => setColumnSettingsAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            transformOrigin={{ vertical: 'top', horizontal: 'left' }}
          >
            <Box sx={{ p: 2, minWidth: 280, maxWidth: 320 }}>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mb: 1,
                }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  {t('users.columnSettings')}
                </Typography>
                <Button
                  size="small"
                  onClick={() => {
                    setColumns(DEFAULT_COLUMNS);
                    localStorage.removeItem(COLUMN_STORAGE_KEY);
                  }}
                >
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

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              flexShrink: 0,
            }}
          >
            {dirtyCount > 0 && (
              <Chip
                label={t('hotTimeBuffEvent.pendingChanges', {
                  count: dirtyCount,
                })}
                color="warning"
                size="small"
              />
            )}



            {canManage && (
              <Badge badgeContent={dirtyCount} color="warning">
                <Button
                  variant="contained"
                  startIcon={<ApplyIcon />}
                  onClick={() => setApplyConfirmOpen(true)}
                  disabled={loading || dirtyCount === 0}
                  sx={{
                    height: '36px',
                    borderRadius: '8px',
                    textTransform: 'none',
                    fontWeight: 600,
                  }}
                >
                  {t('hotTimeBuffEvent.applyChanges')}
                </Button>
              </Badge>
            )}
          </Box>
        </Box>

        {/* Content: Table or Calendar */}
        {viewMode === 'table' ? (
          // --- Table View ---
          filteredRows.length === 0 && !loading ? (
            <EmptyPagePlaceholder
              message={
                searchTerm ? t('common.noSearchResults') : t('common.noData')
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
                    const val = Number(e.target.value);
                    setRowsPerPage(val);
                    localStorage.setItem(ROWS_PER_PAGE_KEY, String(val));
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
            <CardContent
              sx={{
                p: 2,
                overflow: 'hidden',
                '& .fc-event': { cursor: 'pointer' },
                '& .fc-more-link': { cursor: 'pointer' },
              }}
            >
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
                eventContent={(arg) => {
                  const row = arg.event.extendedProps.row as
                    | RowData
                    | undefined;
                  if (!row) return { domNodes: [] };
                  const cms = row.cmsItem;
                  const ovr = row.localOverride || row.savedOverride;
                  const evStartDate = formatDateShort(
                    ovr?.startDateOverride || cms.startDate
                  );
                  const evEndDate = formatDateShort(
                    ovr?.endDateOverride || cms.endDate
                  );
                  const evStartHour = ovr?.startHourOverride ?? cms.startHour;
                  const evEndHour = ovr?.endHourOverride ?? cms.endHour;
                  const evDayOfWeek =
                    ovr?.bitFlagDayOfWeekOverride ?? cms.bitFlagDayOfWeek;
                  const evIsEnabled = ovr?.enabled !== false;
                  const minLv = ovr?.minLvOverride ?? cms.minLv;
                  const maxLv = ovr?.maxLvOverride ?? cms.maxLv;
                  const activeIds: number[] =
                    ovr?.worldBuffIdOverride ?? cms.worldBuffId ?? [];
                  return (
                    <Tooltip
                      arrow
                      placement="right"
                      enterDelay={300}
                      componentsProps={{
                        tooltip: {
                          sx: {
                            bgcolor: 'grey.900',
                            border: '1px solid',
                            borderColor: 'grey.700',
                            borderRadius: 1.5,
                            p: 1,
                            maxWidth: 460,
                          },
                        },
                      }}
                      title={
                        <Box>
                          <Typography
                            variant="caption"
                            fontWeight={700}
                            sx={{ display: 'block', mb: 0.5 }}
                          >
                            {cms.name || `HotTimeBuff #${row.cmsId}`}
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{ color: 'grey.400' }}
                          >
                            {evStartDate} ~ {evEndDate} | {evStartHour}~
                            {evEndHour}h | Lv {minLv}~{maxLv}
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{ display: 'block', color: 'grey.400' }}
                          >
                            {t('hotTimeBuffEvent.dayOfWeek')}:{' '}
                            {formatDayOfWeek(evDayOfWeek, t)} |{' '}
                            {evIsEnabled
                              ? t('hotTimeBuffEvent.liveActive')
                              : t('hotTimeBuffEvent.liveDisabled')}
                          </Typography>
                          {activeIds.length > 0 && (
                            <Box
                              sx={{
                                mt: 0.5,
                                borderTop: '1px solid',
                                borderColor: 'grey.700',
                                pt: 0.5,
                              }}
                            >
                              <Typography
                                variant="caption"
                                sx={{ color: 'grey.400', fontWeight: 600 }}
                              >
                                {t('hotTimeBuffEvent.worldBuffList')} (
                                {activeIds.length})
                              </Typography>
                              {activeIds.slice(0, 5).map((id) => {
                                const info = allWorldBuffs.get(id);
                                return (
                                  <Typography
                                    key={id}
                                    variant="caption"
                                    sx={{
                                      display: 'block',
                                      color: 'grey.300',
                                      fontSize: '0.65rem',
                                    }}
                                  >
                                    #{id} {info?.name || ''}
                                  </Typography>
                                );
                              })}
                              {activeIds.length > 5 && (
                                <Typography
                                  variant="caption"
                                  sx={{
                                    color: 'grey.500',
                                    fontSize: '0.65rem',
                                  }}
                                >
                                  +{activeIds.length - 5}{' '}
                                  {t('hotTimeBuffEvent.more')}
                                </Typography>
                              )}
                            </Box>
                          )}
                        </Box>
                      }
                    >
                      <Box
                        sx={{
                          px: 0.5,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontSize: '0.7rem',
                          lineHeight: 1.6,
                          cursor: 'pointer',
                        }}
                      >
                        {arg.event.title}
                      </Box>
                    </Tooltip>
                  );
                }}
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
                  setCalendarMonth(
                    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
                  );
                }}
                moreLinkClick={(info) => {
                  const dateStr = info.date.toISOString().substring(0, 10);
                  const dayRows = info.allSegs
                    .map((seg: any) => seg.event.extendedProps.row as RowData)
                    .filter(Boolean);
                  setMoreEventsDate(dateStr);
                  setMoreEventsRows(dayRows);
                  setMoreEventsOpen(true);
                  return 'none'; // prevent default popover
                }}
              />
              {filteredRows.length === 0 && !loading && (
                <Box sx={{ py: 4, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    {searchTerm
                      ? t('common.noSearchResults')
                      : t('common.noData')}
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
            {moreEventsDate} — {moreEventsRows.length}{' '}
            {t('hotTimeBuffEvent.events')}
          </DialogTitle>
          <DialogContent sx={{ px: 2, pb: 1 }}>
            <TableContainer
              sx={{
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                maxHeight: 480,
              }}
            >
              <Table
                size="small"
                stickyHeader
                sx={{
                  '& td, & th': {
                    borderRight: 1,
                    borderColor: 'divider',
                    '&:last-child': { borderRight: 0 },
                  },
                }}
              >
                <TableHead>
                  <TableRow>
                    <TableCell
                      sx={{
                        fontWeight: 600,
                        fontSize: '0.7rem',
                        width: 75,
                        whiteSpace: 'nowrap',
                        bgcolor: 'background.paper',
                      }}
                    >
                      ID
                    </TableCell>
                    <TableCell
                      sx={{
                        fontWeight: 600,
                        fontSize: '0.7rem',
                        minWidth: 140,
                        bgcolor: 'background.paper',
                      }}
                    >
                      {t('hotTimeBuffEvent.buffName')}
                    </TableCell>
                    <TableCell
                      sx={{
                        fontWeight: 600,
                        fontSize: '0.7rem',
                        whiteSpace: 'nowrap',
                        width: 95,
                        bgcolor: 'background.paper',
                      }}
                    >
                      {t('hotTimeBuffEvent.startDate')}
                    </TableCell>
                    <TableCell
                      sx={{
                        fontWeight: 600,
                        fontSize: '0.7rem',
                        whiteSpace: 'nowrap',
                        width: 95,
                        bgcolor: 'background.paper',
                      }}
                    >
                      {t('hotTimeBuffEvent.endDate')}
                    </TableCell>
                    <TableCell
                      sx={{
                        fontWeight: 600,
                        fontSize: '0.7rem',
                        whiteSpace: 'nowrap',
                        width: 65,
                        bgcolor: 'background.paper',
                      }}
                    >
                      {t('hotTimeBuffEvent.hours')}
                    </TableCell>
                    <TableCell
                      sx={{
                        fontWeight: 600,
                        fontSize: '0.7rem',
                        whiteSpace: 'nowrap',
                        width: 60,
                        bgcolor: 'background.paper',
                      }}
                    >
                      Lv
                    </TableCell>
                    <TableCell
                      sx={{
                        fontWeight: 600,
                        fontSize: '0.7rem',
                        whiteSpace: 'nowrap',
                        width: 60,
                        bgcolor: 'background.paper',
                      }}
                    >
                      {t('hotTimeBuffEvent.dayOfWeek')}
                    </TableCell>
                    <TableCell
                      sx={{
                        fontWeight: 600,
                        fontSize: '0.7rem',
                        minWidth: 100,
                        bgcolor: 'background.paper',
                      }}
                    >
                      {t('hotTimeBuffEvent.worldBuffs')}
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {moreEventsRows.map((row) => {
                    const cms = row.cmsItem;
                    const override = row.localOverride || row.savedOverride;
                    const startD =
                      (override?.startDateOverride || cms.startDate)?.substring(
                        0,
                        10
                      ) || '—';
                    const endD =
                      (override?.endDateOverride || cms.endDate)?.substring(
                        0,
                        10
                      ) || '—';
                    const sH = override?.startHourOverride ?? cms.startHour;
                    const eH = override?.endHourOverride ?? cms.endHour;
                    const dayBits =
                      override?.bitFlagDayOfWeekOverride ??
                      cms.bitFlagDayOfWeek;
                    const dayStr =
                      dayBits === 127
                        ? t('hotTimeBuffEvent.dayAll')
                        : DAY_BITS.filter((d) => dayBits & (1 << d.bit))
                            .map((d) =>
                              t(`hotTimeBuffEvent.${d.key}`).charAt(0)
                            )
                            .join('');
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
                        <TableCell sx={{ fontSize: '0.7rem' }}>
                          {row.cmsId}
                        </TableCell>
                        <TableCell
                          sx={{
                            maxWidth: 180,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <Tooltip title={cms.name || ''} placement="top">
                            <Typography
                              variant="body2"
                              noWrap
                              sx={{ fontSize: '0.75rem' }}
                            >
                              {cms.name || `HotTimeBuff #${row.cmsId}`}
                            </Typography>
                          </Tooltip>
                        </TableCell>
                        <TableCell
                          sx={{ fontSize: '0.7rem', whiteSpace: 'nowrap' }}
                        >
                          {startD}
                        </TableCell>
                        <TableCell
                          sx={{ fontSize: '0.7rem', whiteSpace: 'nowrap' }}
                        >
                          {endD}
                        </TableCell>
                        <TableCell
                          sx={{ fontSize: '0.7rem', whiteSpace: 'nowrap' }}
                        >
                          {sH}~{eH}
                        </TableCell>
                        <TableCell
                          sx={{ fontSize: '0.7rem', whiteSpace: 'nowrap' }}
                        >
                          {cms.minLv}–{cms.maxLv}
                        </TableCell>
                        <TableCell
                          sx={{ fontSize: '0.7rem', whiteSpace: 'nowrap' }}
                        >
                          {dayStr}
                        </TableCell>
                        <TableCell
                          sx={{
                            maxWidth: 140,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            color: 'text.secondary',
                          }}
                        >
                          <Tooltip
                            title={cms.worldBuffNames?.join(', ') || '—'}
                            placement="top"
                          >
                            <Typography
                              variant="body2"
                              noWrap
                              sx={{ fontSize: '0.7rem' }}
                            >
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
            <Button onClick={() => setMoreEventsOpen(false)}>
              {t('common.close')}
            </Button>
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
          <HotTimeBuffDrawer
            drawerRow={drawerRow}
            drawerDraft={drawerDraft}
            drawerExtraBuffIds={drawerExtraBuffIds}
            drawerIsDirty={drawerIsDirty}
            canManage={canManage}
            gameWorlds={gameWorlds}
            allWorldBuffs={allWorldBuffs}
            updateDraft={updateDraft}
            setDrawerDraft={setDrawerDraft}
            setDrawerExtraBuffIds={setDrawerExtraBuffIds}
            toggleDraftDayBit={toggleDraftDayBit}
            toggleDraftWorldBuff={toggleDraftWorldBuff}
            selectAllWorldBuffs={selectAllWorldBuffs}
            deselectAllWorldBuffs={deselectAllWorldBuffs}
            resetDrawerDraft={resetDrawerDraft}
            commitDrawerDraft={commitDrawerDraft}
            closeDrawer={closeDrawer}
            formatWorldBuffLabel={formatWorldBuffLabel}
          />
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
            <Button
              onClick={() => setApplyConfirmOpen(false)}
              variant="contained"
            >
              {t('common.cancel')}
            </Button>
            <Button variant="text" onClick={handleApply} autoFocus>
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
            <Button
              onClick={() => setResetConfirmOpen(false)}
              variant="contained"
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="text"
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
