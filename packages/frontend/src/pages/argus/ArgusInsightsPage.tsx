import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import {
  Box,
  Typography,
  Button,
  useTheme,
  Skeleton,
  alpha,
  Divider,
  IconButton,
  CircularProgress,
  Menu,
  MenuItem,
  ListSubheader,
} from '@mui/material';
import {
  Add as AddIcon,
  PlayArrow as RunIcon,
  Close as CloseIcon,
  MoreVert as MoreVertIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
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
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
  ReferenceArea,
} from 'recharts';
import PageHeader from '@/components/common/PageHeader';
import ArgusBreadcrumbs from '@/components/argus/ArgusBreadcrumbs';
import { ArgusAnalyticsDrilldownDrawer } from './components/analytics/ArgusAnalyticsDrilldownDrawer';
import DateRangeSelector, {
  DateRangeValue,
  dateRangeToApiParams,
} from '@/components/common/DateRangeSelector';
import EmptyPagePlaceholder from '@/components/common/EmptyPagePlaceholder';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import argusService from '@/services/argusService';
import { renderLexiconIcon } from '@/utils/lexiconIcons';
import EventLabel from '@/components/argus/EventLabel';
import { useLocalizedLexicon } from '@/pages/argus/hooks/useLocalizedLexicon';
import {
  useFormulaEngine,
  evaluateFormula,
} from '@/pages/argus/hooks/useFormulaEngine';
import {
  useInsightsStore,
  type InsightsEventEntry,
  type EventCondition,
} from '@/hooks/useAnalyticsStore';
import { useGlobalAnalyticsFilter } from '@/hooks/useGlobalAnalyticsFilter';
import { useSharedEventCatalog } from './hooks/useSharedEventCatalog';

import AnalyticsLayout from './components/analytics/AnalyticsLayout';
import EventBlock from './components/analytics/EventBlock';
import InlineSelect from './components/analytics/InlineSelect';
import ChartTypeSelector, {
  ChartType,
} from './components/analytics/ChartTypeSelector';
import PropertyPicker from './components/analytics/PropertyPicker';
import BreakdownSection from './components/analytics/BreakdownSection';
import PropertyValueInput from './components/analytics/PropertyValueInput';
import CsvExportButton from './components/analytics/CsvExportButton';
import CompareSelector, {
  ComparePeriod,
} from './components/analytics/CompareSelector';
import FormulaInput from './components/analytics/FormulaInput';
import { formatCompactNumber } from '@/utils/numberFormat';
import {
  useBreakdownLimit,
  limitBreakdownSeries,
} from './components/analytics/useBreakdownLimit';
import ArgusChartSkeleton from '@/components/argus/ArgusChartSkeleton';
import PageContentLoader from '@/components/common/PageContentLoader';
import {
  formatBreakdownLabel,
  splitBreakdownValue,
} from './components/analytics/breakdownUtils';
import QuickLexiconEditor from './components/analytics/QuickLexiconEditor';

/* ─── Types ─── */

type EventEntry = InsightsEventEntry;

/* ─── Sortable Wrapper ─── */

const SortableEventWrapper: React.FC<{
  id: string;
  children: (props: {
    dragHandleProps: Record<string, any>;
    isDragging: boolean;
  }) => React.ReactNode;
}> = ({ id, children }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <Box ref={setNodeRef} style={style}>
      {children({
        dragHandleProps: { ...attributes, ...listeners },
        isDragging,
      })}
    </Box>
  );
};

/* ─── Constants ─── */

const PROPERTY_AGGREGATIONS = new Set([
  'avg',
  'median',
  'sum',
  'p25',
  'p75',
  'p90',
]);

const SERIES_COLORS = [
  '#6366f1',
  '#f59e0b',
  '#10b981',
  '#ec4899',
  '#3b82f6',
  '#ef4444',
  '#8b5cf6',
  '#14b8a6',
];

const COMPARE_DASH = '6 4';

const FORMULA_COLORS = ['#8b5cf6', '#d946ef', '#ec4899', '#f43f5e', '#a855f7'];

/* ─── Component ─── */

interface ArgusInsightsPageProps {
  embedded?: boolean;
  tabBar?: React.ReactNode;
}

const ArgusInsightsPage: React.FC<ArgusInsightsPageProps> = ({
  embedded = false,
  tabBar,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';
  const { currentProject } = useOrgProject();
  const projectId = currentProject?.id || '1';
  const breakdownLimit = useBreakdownLimit(projectId);

  const AGGREGATIONS = [
    {
      value: 'total',
      label: t('argus.analytics.aggTotalCount', 'Total Count'),
    },
    {
      value: 'unique',
      label: t('argus.analytics.aggUniqueUsers', 'Unique Users'),
    },
    {
      value: 'frequency',
      label: t('argus.analytics.aggFrequency', 'Frequency per User'),
    },
    { value: 'avg', label: t('argus.analytics.aggAverage', 'Average') },
    { value: 'median', label: t('argus.analytics.aggMedian', 'Median') },
    { value: 'sum', label: t('argus.analytics.aggSum', 'Sum') },
    {
      value: 'p25',
      label: t('argus.analytics.aggP25', 'P25 (25th percentile)'),
    },
    {
      value: 'p75',
      label: t('argus.analytics.aggP75', 'P75 (75th percentile)'),
    },
    {
      value: 'p90',
      label: t('argus.analytics.aggP90', 'P90 (90th percentile)'),
    },
  ];

  const OPERATORS = [
    { value: 'is', label: t('argus.analytics.op.is', 'is') },
    { value: 'is_not', label: t('argus.analytics.op.isNot', 'is not') },
    { value: 'contains', label: t('argus.analytics.op.contains', 'contains') },
    {
      value: 'not_contains',
      label: t('argus.analytics.op.notContains', 'does not contain'),
    },
    { value: 'gt', label: '>' },
    { value: 'lt', label: '<' },
    { value: 'gte', label: '≥' },
    { value: 'lte', label: '≤' },
    { value: 'set', label: t('argus.analytics.op.isSet', 'is set') },
    { value: 'not_set', label: t('argus.analytics.op.isNotSet', 'is not set') },
  ];

  // ── Persisted State (survives refresh) ──
  const dateRange = useInsightsStore((s) => s.dateRange);
  const setDateRange = useInsightsStore((s) => s.setDateRange);
  const events = useInsightsStore((s) => s.events);
  const setEvents = useInsightsStore((s) => s.setEvents);
  const breakdownProperties = useInsightsStore((s) => s.breakdownProperties);
  const setBreakdownProperties = useInsightsStore(
    (s) => s.setBreakdownProperties
  );
  const chartType = useInsightsStore((s) => s.chartType);
  const setChartType = useInsightsStore((s) => s.setChartType);
  const comparePeriod = useInsightsStore((s) => s.comparePeriod);
  const setComparePeriod = useInsightsStore((s) => s.setComparePeriod);
  const formulas = useInsightsStore((s) => s.formulas);
  const setFormulas = useInsightsStore((s) => s.setFormulas);
  const globalFilters = useGlobalAnalyticsFilter((s) => s.filters);

  // ── Shared Event Catalog (cached across tab switches) ──
  const {
    availableEvents,
    eventsLoading,
    refetch: refetchEvents,
  } = useSharedEventCatalog(projectId);

  // Lexicon Map for translating keys
  const lexiconMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of availableEvents) {
      if (e.display_name) map.set(e.name, e.display_name);
    }
    return map;
  }, [availableEvents]);

  // Event metadata map for EventLabel
  const eventMetaMap = useMemo(() => {
    const map = new Map<string, any>();
    for (const e of availableEvents) {
      map.set(e.name, e);
    }
    return map;
  }, [availableEvents]);

  const tooltipFormatter = useCallback(
    (value: any, name: string) => {
      let label = name;
      if (name.includes(':')) {
        const [eventName, breakdownVal] = name.split(':');
        const display = lexiconMap.get(eventName) || eventName;
        label = `${display}: ${breakdownVal}`;
      } else {
        label = lexiconMap.get(name) || name;
      }
      return [value, label];
    },
    [lexiconMap]
  );

  const [series, setSeries] = useState<any[]>([]);
  const [compareSeries, setCompareSeries] = useState<any[] | undefined>();
  const [queryLoading, setQueryLoading] = useState(false);
  const [hasQueried, setHasQueried] = useState(false);
  const [hiddenSeriesKeys, setHiddenSeriesKeys] = useState<Set<string>>(
    new Set()
  );
  const [menuAnchor, setMenuAnchor] = useState<{
    el: HTMLElement;
    idx: number;
  } | null>(null);
  const isInitialMount = useRef(true);
  const lastExecutedKeyRef = useRef<string>('');

  // Drilldown & Zoom state
  const [drilldownOpen, setDrilldownOpen] = useState(false);
  const [drilldownParams, setDrilldownParams] = useState<{
    eventName: string;
    dateRange: { start: Date; end: Date };
    breakdownFilters?: { property: string; value: string }[];
  } | null>(null);

  const [refAreaLeft, setRefAreaLeft] = useState<string | null>(null);
  const [refAreaRight, setRefAreaRight] = useState<string | null>(null);

  // Quick lexicon editor state
  const [quickEditOpen, setQuickEditOpen] = useState(false);
  const [quickEditAnchor, setQuickEditAnchor] = useState<HTMLElement | null>(
    null
  );
  const [quickEditEventName, setQuickEditEventName] = useState('');

  const handleZoom = useCallback(() => {
    if (refAreaLeft === refAreaRight || !refAreaLeft || !refAreaRight) {
      setRefAreaLeft(null);
      setRefAreaRight(null);
      return;
    }

    let left = refAreaLeft;
    let right = refAreaRight;

    if (new Date(left) > new Date(right)) {
      left = refAreaRight;
      right = refAreaLeft;
    }

    const start = new Date(left);
    const end = new Date(right);
    end.setHours(23, 59, 59, 999);

    setDateRange({
      type: 'custom',
      start,
      end,
    });

    setRefAreaLeft(null);
    setRefAreaRight(null);
  }, [refAreaLeft, refAreaRight, setDateRange]);

  // Reset hidden keys when series changes
  useEffect(() => {
    setHiddenSeriesKeys(new Set());
  }, [series]);

  // ── Event handlers ──

  const handleAddEvent = useCallback(() => {
    setEvents([...events, { name: '', aggregation: 'total' }]);
  }, [events, setEvents]);

  const handleRemoveEvent = useCallback(
    (index: number) => {
      setEvents(events.filter((_, i) => i !== index));
    },
    [events, setEvents]
  );

  const handleEventChange = useCallback(
    (index: number, field: keyof EventEntry, value: any) => {
      setEvents(
        events.map((e, i) => (i === index ? { ...e, [field]: value } : e))
      );
    },
    [events, setEvents]
  );

  // ── DnD ──
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const eventIds = useMemo(() => events.map((_, i) => `event-${i}`), [events]);
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        const oldIndex = eventIds.indexOf(String(active.id));
        const newIndex = eventIds.indexOf(String(over.id));
        setEvents(arrayMove(events, oldIndex, newIndex));
      }
    },
    [events, eventIds, setEvents]
  );

  const handleOpenMenu = useCallback(
    (e: React.MouseEvent<HTMLElement>, idx: number) => {
      setMenuAnchor({ el: e.currentTarget, idx });
    },
    []
  );

  const handleCloseMenu = useCallback(() => {
    setMenuAnchor(null);
  }, []);

  const handleAddCondition = useCallback(
    (eventIndex: number) => {
      setEvents(
        events.map((e, i) => {
          if (i === eventIndex) {
            const conditions = e.conditions || [];
            return {
              ...e,
              conditions: [
                ...conditions,
                { property: '', operator: 'is', value: '' },
              ],
            };
          }
          return e;
        })
      );
    },
    [events, setEvents]
  );

  const handleConditionChange = useCallback(
    (
      eventIndex: number,
      condIndex: number,
      field: keyof EventCondition,
      value: string
    ) => {
      setEvents(
        events.map((e, i) => {
          if (i === eventIndex && e.conditions) {
            const newConds = [...e.conditions];
            newConds[condIndex] = { ...newConds[condIndex], [field]: value };
            return { ...e, conditions: newConds };
          }
          return e;
        })
      );
    },
    [events, setEvents]
  );

  const handleRemoveCondition = useCallback(
    (eventIndex: number, condIndex: number) => {
      setEvents(
        events.map((e, i) => {
          if (i === eventIndex && e.conditions) {
            return {
              ...e,
              conditions: e.conditions.filter((_, ci) => ci !== condIndex),
            };
          }
          return e;
        })
      );
    },
    [events, setEvents]
  );

  // ── Run Query ──
  const handleRunQuery = useCallback(async () => {
    const validEvents = events.filter((e) => e.name);
    if (validEvents.length === 0) return;

    const queryKey = JSON.stringify({
      projectId,
      events: validEvents,
      breakdownProperties,
      dateRange,
      comparePeriod,
      formulas,
      globalFilters,
    });
    lastExecutedKeyRef.current = queryKey;

    setQueryLoading(true);
    setHasQueried(true);
    try {
      const apiParams = dateRangeToApiParams(dateRange);
      const result = await argusService.getAnalyticsInsights(projectId, {
        events: validEvents.map((e) => ({
          name: e.name,
          aggregation: e.aggregation,
          property: e.property,
          conditions: e.conditions?.filter((c) => c.property),
        })),
        breakdown:
          breakdownProperties.length > 0
            ? { properties: breakdownProperties }
            : undefined,
        period: apiParams.period,
        start: apiParams.start,
        end: apiParams.end,
        compare_period: comparePeriod || undefined,
        global_filters: globalFilters.length > 0 ? globalFilters : undefined,
      });
      setSeries(limitBreakdownSeries(result.series || [], breakdownLimit));
      setCompareSeries(result.compare_series);
    } catch {
      setSeries([]);
      setCompareSeries(undefined);
    } finally {
      setQueryLoading(false);
    }
  }, [
    events,
    dateRange,
    projectId,
    breakdownProperties,
    comparePeriod,
    globalFilters,
    breakdownLimit,
  ]);

  // Debounced auto-query running on settings change
  useEffect(() => {
    const validEvents = events.filter((e) => e.name);
    if (validEvents.length === 0) {
      isInitialMount.current = false;
      return;
    }

    const queryKey = JSON.stringify({
      projectId,
      events: validEvents,
      breakdownProperties,
      dateRange,
      comparePeriod,
      formulas,
      globalFilters,
    });

    if (queryKey === lastExecutedKeyRef.current) {
      return;
    }

    if (isInitialMount.current) {
      isInitialMount.current = false;
      lastExecutedKeyRef.current = queryKey;
      handleRunQuery();
      return;
    }

    const timer = setTimeout(() => {
      lastExecutedKeyRef.current = queryKey;
      handleRunQuery();
    }, 600);

    return () => clearTimeout(timer);
  }, [
    events,
    breakdownProperties,
    dateRange,
    comparePeriod,
    formulas,
    globalFilters,
    projectId,
    handleRunQuery,
  ]);

  // ── Chart data ──
  const chartData = useMemo(() => {
    if (series.length === 0) return [];
    const timeMap = new Map<string, Record<string, number>>();
    series.forEach((s) => {
      const key = s.breakdown_value
        ? `${s.event}:${formatBreakdownLabel(s.breakdown_value, breakdownProperties)}`
        : s.event;
      for (const point of s.data) {
        if (!timeMap.has(point.bucket)) timeMap.set(point.bucket, {});
        timeMap.get(point.bucket)![key] = point.value;
      }
    });
    // Add compare series
    if (compareSeries) {
      compareSeries.forEach((s) => {
        const key = `${s.event} (prev)`;
        for (const point of s.data) {
          if (!timeMap.has(point.bucket)) timeMap.set(point.bucket, {});
          timeMap.get(point.bucket)![key] = point.value;
        }
      });
    }
    // Collect all series keys to fill missing values with 0
    const allKeys = new Set<string>();
    series.forEach((s) => {
      allKeys.add(
        s.breakdown_value
          ? `${s.event}:${formatBreakdownLabel(s.breakdown_value, breakdownProperties)}`
          : s.event
      );
    });
    if (compareSeries) {
      compareSeries.forEach((s) => allKeys.add(`${s.event} (prev)`));
    }

    // Fill missing bucket values with 0 to prevent line gaps
    return Array.from(timeMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([bucket, values]) => {
        const filled: Record<string, any> = { bucket: formatBucket(bucket) };
        for (const k of allKeys) {
          filled[k] = values[k] ?? 0;
        }
        return filled;
      });
  }, [series, compareSeries]);

  const seriesKeys = useMemo(() => {
    const keys = new Set<string>();
    series.forEach((s) => {
      keys.add(
        s.breakdown_value
          ? `${s.event}:${formatBreakdownLabel(s.breakdown_value, breakdownProperties)}`
          : s.event
      );
    });
    return Array.from(keys);
  }, [series]);

  const compareKeys = useMemo(() => {
    if (!compareSeries) return [];
    return compareSeries.map((s) => `${s.event} (prev)`);
  }, [compareSeries]);

  // ── Formula evaluation ──
  const formulaLabels = useMemo(() => {
    return events
      .filter((e) => e.name)
      .map((_, i) => String.fromCharCode(65 + i));
  }, [events]);

  const formulaSeriesMap = useMemo(() => {
    const map: Record<string, { bucket: string; value: number }[]> = {};
    series.forEach((s) => {
      if (!s.breakdown_value) {
        const idx = events.findIndex((e) => e.name === s.event);
        if (idx !== -1) {
          const label = String.fromCharCode(65 + idx);
          map[label] = s.data;
        }
      }
    });
    return map;
  }, [series, events]);

  const formulaResults = useMemo(() => {
    return formulas.map((f, index) => {
      const res = evaluateFormula(f, formulaSeriesMap);
      return {
        formula: f,
        key: f || `Formula ${index + 1}`,
        result: res,
      };
    });
  }, [formulas, formulaSeriesMap]);

  const validFormulaResults = useMemo(() => {
    return formulaResults.filter(
      (r) => r.formula && !r.result.error && r.result.data.length > 0
    );
  }, [formulaResults]);

  // Add formula data to chartData
  const chartDataWithFormula = useMemo(() => {
    if (validFormulaResults.length === 0) return chartData;

    return chartData.map((row) => {
      const updatedRow = { ...row };
      validFormulaResults.forEach((r) => {
        const point = r.result.data.find(
          (d) => formatBucket(d.bucket) === row.bucket
        );
        updatedRow[r.key] = point ? point.value : 0;
      });
      return updatedRow;
    });
  }, [chartData, validFormulaResults]);

  const allSeriesKeys = useMemo(() => {
    const keys = [...seriesKeys, ...compareKeys];
    validFormulaResults.forEach((r) => {
      keys.push(r.key);
    });
    return keys;
  }, [seriesKeys, compareKeys, validFormulaResults]);

  // ── CSV data ──
  const csvData = useMemo(() => chartDataWithFormula, [chartDataWithFormula]);

  const handleChartClick = useCallback(
    (chartState: any) => {
      if (!chartState || !chartState.activeLabel || !chartState.activePayload)
        return;
      if (refAreaLeft && refAreaRight && refAreaLeft !== refAreaRight) {
        return;
      }

      const bucket = chartState.activeLabel;
      const activeItem = chartState.activePayload[0];
      if (!activeItem) return;

      const dataKey = String(activeItem.dataKey);
      if (
        validFormulaResults.some((r) => r.key === dataKey) ||
        dataKey.endsWith(' (prev)')
      ) {
        return;
      }

      let eventName = dataKey;
      let bValue: string | undefined;

      if (dataKey.includes(':')) {
        const parts = dataKey.split(':');
        eventName = parts[0];
        bValue = parts[1];
      }

      const clickedDate = new Date(bucket);
      const start = new Date(
        clickedDate.getFullYear(),
        clickedDate.getMonth(),
        clickedDate.getDate(),
        0,
        0,
        0
      );
      const end = new Date(
        clickedDate.getFullYear(),
        clickedDate.getMonth(),
        clickedDate.getDate(),
        23,
        59,
        59
      );

      // Build breakdownFilters from the breakdown value
      let breakdownFilters: { property: string; value: string }[] | undefined;
      if (bValue && breakdownProperties.length > 0) {
        // bValue was formatted by formatBreakdownLabel, so we need to find the
        // original composite value from series data
        const matchingSeries = series.find((s) => {
          if (!s.breakdown_value) return false;
          return (
            formatBreakdownLabel(s.breakdown_value, breakdownProperties) ===
              bValue && s.event === eventName
          );
        });
        if (matchingSeries) {
          const parts = splitBreakdownValue(matchingSeries.breakdown_value);
          breakdownFilters = breakdownProperties
            .map((prop: string, i: number) => ({
              property: prop,
              value: parts[i] || '',
            }))
            .filter((f: { property: string; value: string }) => f.value !== '');
        } else {
          // Fallback: single property
          breakdownFilters = [
            { property: breakdownProperties[0], value: bValue },
          ];
        }
      }

      setDrilldownParams({
        eventName,
        dateRange: { start, end },
        breakdownFilters,
      });
      setDrilldownOpen(true);
    },
    [breakdownProperties, validFormulaResults, refAreaLeft, refAreaRight]
  );

  // Options
  const { localizeEventName, localizeEventDescription } = useLocalizedLexicon();

  const eventOptions = useMemo(
    () =>
      availableEvents.map((e) => ({
        value: e.name,
        label: localizeEventName(e.name, e.display_name, e.is_reserved),
        icon: renderLexiconIcon(e.icon, 18, e.icon_color || undefined),
        meta: {
          eventKey: e.name,
          description:
            localizeEventDescription(e.name, e.description, e.is_reserved) ||
            undefined,
          category: e.category || undefined,
          count: e.count,
          isReserved: e.is_reserved,
        },
      })),
    [availableEvents, localizeEventName, localizeEventDescription]
  );

  const handleLegendClick = useCallback((e: any) => {
    const { dataKey } = e;
    setHiddenSeriesKeys((prev) => {
      const next = new Set(prev);
      if (next.has(dataKey)) {
        next.delete(dataKey);
      } else {
        next.add(dataKey);
      }
      return next;
    });
  }, []);

  const renderLegendText = useCallback(
    (value: string, entry: any) => {
      const isHidden = hiddenSeriesKeys.has(entry.dataKey || value);
      let label = value;
      if (value.includes(':')) {
        const [eventName, breakdownVal] = value.split(':');
        const display = lexiconMap.get(eventName) || eventName;
        label = `${display}: ${breakdownVal}`;
      } else {
        label = lexiconMap.get(value) || value;
      }
      return (
        <span
          style={{
            color: isHidden ? theme.palette.text.disabled : 'inherit',
            textDecoration: isHidden ? 'line-through' : 'none',
            cursor: 'pointer',
          }}
        >
          {label}
        </span>
      );
    },
    [hiddenSeriesKeys, theme, lexiconMap]
  );

  // ── UI: Left Panel (Query Builder) ──
  const leftPanel = (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {/* Events Section */}
      <Box>
        <Typography
          variant="overline"
          sx={{ fontWeight: 700, color: 'text.secondary', ml: 0.5 }}
        >
          {t('argus.analytics.events', 'Events')}
        </Typography>
        <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <DndContext
            sensors={dndSensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={eventIds}
              strategy={verticalListSortingStrategy}
            >
              {events.map((ev, idx) => (
                <SortableEventWrapper key={eventIds[idx]} id={eventIds[idx]}>
                  {({ dragHandleProps, isDragging }) => (
                    <EventBlock
                      indexLabel={String.fromCharCode(65 + idx)}
                      color={SERIES_COLORS[idx % SERIES_COLORS.length]}
                      dragHandleProps={dragHandleProps}
                      isDragging={isDragging}
                    >
                      {/* Event name & Menu */}
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          width: '100%',
                        }}
                      >
                        <InlineSelect
                          value={ev.name}
                          onChange={(val) =>
                            handleEventChange(idx, 'name', val)
                          }
                          options={eventOptions}
                          emptyLabel={t(
                            'argus.analytics.selectEvent',
                            'Select Event'
                          )}
                          highlightEmpty
                          onEditOption={(val, anchor) => {
                            setQuickEditEventName(val);
                            setQuickEditAnchor(anchor);
                            setQuickEditOpen(true);
                          }}
                        />
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenMenu(e, idx);
                          }}
                          sx={{
                            opacity: 0.6,
                            '&:hover': { opacity: 1 },
                            p: 0.25,
                          }}
                        >
                          <MoreVertIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Box>

                      {/* Measurement summary text or property selector */}
                      {ev.aggregation !== 'total' && (
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                            pl: 0.5,
                          }}
                        >
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ fontSize: '0.7rem' }}
                          >
                            {t('argus.analytics.show', 'show')}:
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{ fontWeight: 600, fontSize: '0.7rem' }}
                          >
                            {AGGREGATIONS.find(
                              (a) => a.value === ev.aggregation
                            )?.label || ev.aggregation}
                          </Typography>
                          {PROPERTY_AGGREGATIONS.has(ev.aggregation) && (
                            <>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ fontSize: '0.7rem' }}
                              >
                                {t('argus.analytics.of', 'of')}
                              </Typography>
                              <PropertyPicker
                                projectId={projectId}
                                eventName={ev.name}
                                value={ev.property ? [ev.property] : []}
                                onChange={(val) =>
                                  handleEventChange(
                                    idx,
                                    'property',
                                    val[0] || ''
                                  )
                                }
                                emptyLabel={t(
                                  'argus.analytics.selectProperty',
                                  'Select Property'
                                )}
                                highlightEmpty
                                maxItems={1}
                                variant="text"
                              />
                            </>
                          )}
                        </Box>
                      )}

                      {/* Conditions (Filters) */}
                      {ev.conditions && ev.conditions.length > 0 && (
                        <Box
                          sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 0.5,
                          }}
                        >
                          {ev.conditions.map((cond, cIdx) => (
                            <Box
                              key={cIdx}
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                flexWrap: 'wrap',
                                gap: 0.5,
                                pl: 0.5,
                              }}
                            >
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ fontSize: '0.7rem' }}
                              >
                                {t('argus.analytics.where', 'where')}
                              </Typography>
                              <PropertyPicker
                                projectId={projectId}
                                eventName={ev.name}
                                value={cond.property ? [cond.property] : []}
                                onChange={(val) =>
                                  handleConditionChange(
                                    idx,
                                    cIdx,
                                    'property',
                                    val[0] || ''
                                  )
                                }
                                emptyLabel={t(
                                  'argus.analytics.property',
                                  'Property'
                                )}
                                highlightEmpty
                                maxItems={1}
                                variant="text"
                              />
                              <InlineSelect
                                value={cond.operator}
                                onChange={(val) =>
                                  handleConditionChange(
                                    idx,
                                    cIdx,
                                    'operator',
                                    val
                                  )
                                }
                                options={OPERATORS}
                              />
                              {!['set', 'not_set'].includes(cond.operator) && (
                                <Box sx={{ flex: 1, minWidth: 60 }}>
                                  <PropertyValueInput
                                    projectId={projectId}
                                    property={cond.property}
                                    value={cond.value}
                                    onChange={(val) =>
                                      handleConditionChange(
                                        idx,
                                        cIdx,
                                        'value',
                                        val
                                      )
                                    }
                                  />
                                </Box>
                              )}
                              <IconButton
                                size="small"
                                onClick={() => handleRemoveCondition(idx, cIdx)}
                                sx={{
                                  p: 0.25,
                                  ml: 0.5,
                                  opacity: 0.6,
                                  '&:hover': { opacity: 1 },
                                }}
                              >
                                <CloseIcon sx={{ fontSize: 14 }} />
                              </IconButton>
                            </Box>
                          ))}
                          <Button
                            size="small"
                            onClick={() => handleAddCondition(idx)}
                            sx={{
                              alignSelf: 'flex-start',
                              textTransform: 'none',
                              opacity: 0.7,
                              pl: 0.5,
                              minWidth: 0,
                              fontSize: '0.75rem',
                              py: 0,
                            }}
                          >
                            {t('argus.analytics.filter', '+ Filter')}
                          </Button>
                        </Box>
                      )}
                    </EventBlock>
                  )}
                </SortableEventWrapper>
              ))}
            </SortableContext>
          </DndContext>
          {events.length < 8 && (
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={handleAddEvent}
              sx={{
                justifyContent: 'flex-start',
                color: 'text.secondary',
                textTransform: 'none',
                borderRadius: 2,
              }}
            >
              {t('argus.analytics.addEvent', 'Add Event')}
            </Button>
          )}
        </Box>
      </Box>

      <Divider sx={{ opacity: isDark ? 0.05 : 0.5 }} />

      {/* Formula Section */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {formulas.length > 0 && (
          <Typography
            variant="overline"
            sx={{ fontWeight: 700, color: 'text.secondary', ml: 0.5 }}
          >
            {t('argus.analytics.formulas', 'Formulas')}
          </Typography>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {formulas.map((form, idx) => (
              <Box
                key={idx}
                sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}
              >
                <Box sx={{ flex: 1 }}>
                  <FormulaInput
                    value={form}
                    onChange={(val) => {
                      const next = [...formulas];
                      next[idx] = val;
                      setFormulas(next);
                    }}
                    availableLabels={formulaLabels}
                  />
                </Box>
                <IconButton
                  size="small"
                  onClick={() => {
                    setFormulas(formulas.filter((_, i) => i !== idx));
                  }}
                  sx={{
                    p: 0.25,
                    opacity: 0.6,
                    '&:hover': { opacity: 1 },
                    mt: '6px', // Align with the center of the 36px high input field
                  }}
                >
                  <CloseIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Box>
            ))}
          </Box>

          {formulas.length < 5 && (
            <Button
              size="small"
              startIcon={<AddIcon sx={{ fontSize: 14 }} />}
              onClick={() => setFormulas([...formulas, ''])}
              sx={{
                justifyContent: 'flex-start',
                color: 'text.secondary',
                textTransform: 'none',
                borderRadius: 2,
              }}
            >
              {t('argus.analytics.addFormula', 'Formula')}
            </Button>
          )}
        </Box>
      </Box>

      <Divider sx={{ opacity: isDark ? 0.05 : 0.5 }} />

      {/* Breakdown Section */}
      <BreakdownSection
        projectId={projectId}
        eventName={events[0]?.name}
        value={breakdownProperties}
        onChange={setBreakdownProperties}
      />

      <Box sx={{ mt: 'auto', pt: 2 }}>
        <Button
          fullWidth
          variant="contained"
          size="small"
          startIcon={
            queryLoading ? (
              <CircularProgress size={16} color="inherit" />
            ) : (
              <RunIcon />
            )
          }
          onClick={handleRunQuery}
          disabled={queryLoading || events.filter((e) => e.name).length === 0}
          sx={{ borderRadius: 1.5, textTransform: 'none', px: 2 }}
        >
          {t('argus.analytics.runQuery', 'Run Query')}
        </Button>
      </Box>
    </Box>
  );

  // ── UI: Toolbar ──
  const toolbar = (
    <>
      <ChartTypeSelector
        value={chartType}
        onChange={setChartType}
        availableTypes={['line', 'bar', 'stacked-bar', 'table']}
      />
      <CompareSelector value={comparePeriod} onChange={setComparePeriod} />
      {!embedded && (
        <DateRangeSelector value={dateRange} onChange={setDateRange} compact />
      )}
      <CsvExportButton
        data={csvData}
        filename="insights"
        disabled={chartDataWithFormula.length === 0}
      />
    </>
  );

  // ── UI: Render chart based on chartType ──
  const renderChart = () => {
    const data = chartDataWithFormula;
    if (data.length === 0) return null;

    const commonTooltipStyle = {
      background: isDark ? '#1e1e2e' : '#fff',
      color: isDark ? '#e4e4e7' : '#1a1a2e',
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
      borderRadius: 8,
      boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      fontSize: 12,
    };
    const commonTooltipItemStyle = { color: isDark ? '#e4e4e7' : '#1a1a2e' };
    const commonTooltipLabelStyle = {
      color: isDark ? '#a1a1aa' : '#52525b',
      fontWeight: 600,
    };

    const gridStroke = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    const tickStyle = { fontSize: 11, fill: theme.palette.text.secondary };

    if (chartType === 'table') {
      return renderDataTable(data, allSeriesKeys);
    }

    return (
      <Box
        sx={{
          minWidth: 0,
          minHeight: 360,
          height: { xs: 360, md: '50vh' },
          maxHeight: 600,
          width: '100%',
          pr: 2,
          userSelect: 'none',
          '& .recharts-wrapper, & .recharts-surface, & svg, & svg *': {
            outline: 'none',
          },
          '& .recharts-responsive-container': { minHeight: '1px !important' },
        }}
      >
        <ResponsiveContainer
          width="100%"
          height="100%"
          minWidth={0}
          minHeight={0}
          debounce={100}
        >
          {chartType === 'line' ? (
            <LineChart
              data={data}
              margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
              onMouseDown={(e) =>
                e &&
                setRefAreaLeft(e.activeLabel ? String(e.activeLabel) : null)
              }
              onMouseMove={(e) =>
                e &&
                refAreaLeft &&
                setRefAreaRight(e.activeLabel ? String(e.activeLabel) : null)
              }
              onMouseUp={handleZoom}
              onClick={handleChartClick}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke={gridStroke}
              />
              {refAreaLeft && refAreaRight && (
                <ReferenceArea
                  x1={refAreaLeft}
                  x2={refAreaRight}
                  strokeOpacity={0.3}
                  fill={theme.palette.primary.main}
                  fillOpacity={0.15}
                />
              )}
              <XAxis
                dataKey="bucket"
                tick={tickStyle}
                tickLine={false}
                axisLine={false}
                tickMargin={16}
              />
              <YAxis
                tick={tickStyle}
                tickLine={false}
                axisLine={false}
                width={50}
              />
              <RechartsTooltip
                wrapperStyle={{ zIndex: 1000 }}
                contentStyle={commonTooltipStyle}
                itemStyle={commonTooltipItemStyle}
                labelStyle={commonTooltipLabelStyle}
                formatter={tooltipFormatter}
              />
              <Legend
                onClick={handleLegendClick}
                formatter={renderLegendText}
                wrapperStyle={{ fontSize: 12, paddingTop: 16 }}
              />
              {seriesKeys.map((key, idx) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  hide={hiddenSeriesKeys.has(key)}
                  stroke={SERIES_COLORS[idx % SERIES_COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                  isAnimationActive={false}
                />
              ))}
              {compareKeys.map((key, idx) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  hide={hiddenSeriesKeys.has(key)}
                  stroke={SERIES_COLORS[idx % SERIES_COLORS.length]}
                  strokeWidth={1.5}
                  strokeDasharray={COMPARE_DASH}
                  strokeOpacity={0.5}
                  dot={false}
                  isAnimationActive={false}
                />
              ))}
              {/* Formulas as special lines */}
              {validFormulaResults.map((r, idx) => (
                <Line
                  key={r.key}
                  type="monotone"
                  dataKey={r.key}
                  name={r.formula}
                  hide={hiddenSeriesKeys.has(r.key)}
                  stroke={FORMULA_COLORS[idx % FORMULA_COLORS.length]}
                  strokeWidth={2.5}
                  strokeDasharray="8 4"
                  dot={false}
                  activeDot={{
                    r: 4,
                    strokeWidth: 0,
                    fill: FORMULA_COLORS[idx % FORMULA_COLORS.length],
                  }}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          ) : (
            <BarChart
              data={data}
              margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
              onMouseDown={(e) =>
                e &&
                setRefAreaLeft(e.activeLabel ? String(e.activeLabel) : null)
              }
              onMouseMove={(e) =>
                e &&
                refAreaLeft &&
                setRefAreaRight(e.activeLabel ? String(e.activeLabel) : null)
              }
              onMouseUp={handleZoom}
              onClick={handleChartClick}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke={gridStroke}
              />
              {refAreaLeft && refAreaRight && (
                <ReferenceArea
                  x1={refAreaLeft}
                  x2={refAreaRight}
                  strokeOpacity={0.3}
                  fill={theme.palette.primary.main}
                  fillOpacity={0.15}
                />
              )}
              <XAxis
                dataKey="bucket"
                tick={tickStyle}
                tickLine={false}
                axisLine={false}
                tickMargin={16}
              />
              <YAxis
                tick={tickStyle}
                tickLine={false}
                axisLine={false}
                width={50}
              />
              <RechartsTooltip
                wrapperStyle={{ zIndex: 1000 }}
                contentStyle={commonTooltipStyle}
                itemStyle={commonTooltipItemStyle}
                labelStyle={commonTooltipLabelStyle}
                formatter={tooltipFormatter}
              />
              <Legend
                onClick={handleLegendClick}
                formatter={renderLegendText}
                wrapperStyle={{ fontSize: 12, paddingTop: 16 }}
              />
              {seriesKeys.map((key, idx) => (
                <Bar
                  key={key}
                  dataKey={key}
                  hide={hiddenSeriesKeys.has(key)}
                  fill={SERIES_COLORS[idx % SERIES_COLORS.length]}
                  radius={[4, 4, 0, 0]}
                  stackId={chartType === 'stacked-bar' ? 'stack' : undefined}
                  isAnimationActive={false}
                />
              ))}
              {validFormulaResults.map((r, idx) => (
                <Bar
                  key={r.key}
                  dataKey={r.key}
                  name={r.formula}
                  hide={hiddenSeriesKeys.has(r.key)}
                  fill={FORMULA_COLORS[idx % FORMULA_COLORS.length]}
                  radius={[4, 4, 0, 0]}
                  stackId={chartType === 'stacked-bar' ? 'stack' : undefined}
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </Box>
    );
  };

  // ── Table view ──
  const renderDataTable = (data: Record<string, any>[], keys: string[]) => {
    const sortableKeys = keys.filter((k) => k !== 'bucket');
    return (
      <Box sx={{ overflowX: 'auto', maxHeight: 500 }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '0.8rem',
          }}
        >
          <thead>
            <tr>
              <th
                style={{
                  textAlign: 'left',
                  padding: '12px 16px',
                  borderBottom: `2px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                  color: theme.palette.text.secondary,
                  fontWeight: 600,
                  position: 'sticky',
                  top: 0,
                  background: theme.palette.background.paper,
                  zIndex: 1,
                }}
              >
                {t('argus.analytics.time', 'Time')}
              </th>
              {sortableKeys.map((key) => (
                <th
                  key={key}
                  style={{
                    textAlign: 'right',
                    padding: '12px 16px',
                    borderBottom: `2px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                    color: theme.palette.text.secondary,
                    fontWeight: 600,
                    position: 'sticky',
                    top: 0,
                    background: theme.palette.background.paper,
                    zIndex: 1,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {(() => {
                    const eventName = key.includes(':')
                      ? key.split(':')[0]
                      : key;
                    return lexiconMap.get(eventName) || eventName;
                  })()}
                  {key.includes(':') && (
                    <span style={{ opacity: 0.6 }}>
                      :{key.split(':').slice(1).join(':')}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIdx) => (
              <tr
                key={rowIdx}
                style={{
                  borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}`,
                }}
              >
                <td
                  style={{
                    padding: '10px 16px',
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {row.bucket}
                </td>
                {sortableKeys.map((key) => (
                  <td
                    key={key}
                    style={{
                      padding: '10px 16px',
                      textAlign: 'right',
                      fontWeight: 600,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {typeof row[key] === 'number'
                      ? formatCompactNumber(row[key])
                      : (row[key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Box>
    );
  };

  // ── Summary table (always shown below chart) ──
  const renderSummaryTable = () => {
    if (series.length === 0) return null;

    return (
      <Box
        sx={{
          overflowX: 'auto',
          borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          mt: 2,
        }}
      >
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '0.8rem',
          }}
        >
          <thead>
            <tr>
              <th
                style={{
                  textAlign: 'left',
                  padding: '12px 16px',
                  borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                  color: theme.palette.text.secondary,
                  fontWeight: 600,
                }}
              >
                {t('argus.analytics.segment', 'Segment')}
              </th>
              <th
                style={{
                  textAlign: 'right',
                  padding: '12px 16px',
                  borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                  color: theme.palette.text.secondary,
                  fontWeight: 600,
                }}
              >
                {t('argus.analytics.total', 'Total')}
              </th>
              <th
                style={{
                  textAlign: 'right',
                  padding: '12px 16px',
                  borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                  color: theme.palette.text.secondary,
                  fontWeight: 600,
                }}
              >
                {t('argus.analytics.avg', 'Avg')}
              </th>
              <th
                style={{
                  textAlign: 'right',
                  padding: '12px 16px',
                  borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                  color: theme.palette.text.secondary,
                  fontWeight: 600,
                }}
              >
                {t('argus.analytics.min', 'Min')}
              </th>
              <th
                style={{
                  textAlign: 'right',
                  padding: '12px 16px',
                  borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                  color: theme.palette.text.secondary,
                  fontWeight: 600,
                }}
              >
                {t('argus.analytics.max', 'Max')}
              </th>
            </tr>
          </thead>
          <tbody>
            {series.map((s, idx) => {
              const label = s.breakdown_value
                ? `${s.event} - ${formatBreakdownLabel(s.breakdown_value, breakdownProperties)}`
                : s.event;
              const values = s.data.map((d: any) => d.value);
              const total = values.reduce(
                (acc: number, v: number) => acc + v,
                0
              );
              const avg = values.length > 0 ? total / values.length : 0;
              const min = values.length > 0 ? Math.min(...values) : 0;
              const max = values.length > 0 ? Math.max(...values) : 0;
              const keyForColor = s.breakdown_value
                ? `${s.event}:${formatBreakdownLabel(s.breakdown_value, breakdownProperties)}`
                : s.event;
              const color =
                SERIES_COLORS[
                  seriesKeys.indexOf(keyForColor) % SERIES_COLORS.length
                ];
              return (
                <tr
                  key={idx}
                  style={{
                    borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}`,
                  }}
                >
                  <td
                    style={{
                      padding: '10px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <Box
                      sx={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        bgcolor: color,
                        flexShrink: 0,
                      }}
                    />
                    {(() => {
                      const meta = eventMetaMap.get(s.event);
                      return (
                        <Box
                          sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 0.75,
                            minWidth: 0,
                          }}
                        >
                          <EventLabel
                            eventName={s.event}
                            displayName={meta?.display_name}
                            icon={meta?.icon}
                            iconColor={meta?.icon_color}
                            isReserved={meta?.is_reserved}
                            size="compact"
                            showIcon={false}
                          />
                          {s.breakdown_value && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{ fontSize: '0.75rem' }}
                            >
                              —{' '}
                              {formatBreakdownLabel(
                                s.breakdown_value,
                                breakdownProperties
                              )}
                            </Typography>
                          )}
                        </Box>
                      );
                    })()}
                  </td>
                  <td
                    style={{
                      padding: '10px 16px',
                      textAlign: 'right',
                      fontWeight: 600,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {formatCompactNumber(total)}
                  </td>
                  <td
                    style={{
                      padding: '10px 16px',
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {formatCompactNumber(Math.round(avg))}
                  </td>
                  <td
                    style={{
                      padding: '10px 16px',
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {formatCompactNumber(min)}
                  </td>
                  <td
                    style={{
                      padding: '10px 16px',
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {formatCompactNumber(max)}
                  </td>
                </tr>
              );
            })}
            {validFormulaResults.map((r, idx) => {
              const label = r.formula;
              const values = r.result.data.map((d: any) => d.value);
              const total = values.reduce(
                (acc: number, v: number) => acc + v,
                0
              );
              const avg = values.length > 0 ? total / values.length : 0;
              const min = values.length > 0 ? Math.min(...values) : 0;
              const max = values.length > 0 ? Math.max(...values) : 0;
              const color = FORMULA_COLORS[idx % FORMULA_COLORS.length];
              return (
                <tr
                  key={`formula-${idx}`}
                  style={{
                    borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}`,
                  }}
                >
                  <td
                    style={{
                      padding: '10px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <Box
                      sx={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        bgcolor: color,
                        flexShrink: 0,
                      }}
                    />
                    {label}
                  </td>
                  <td
                    style={{
                      padding: '10px 16px',
                      textAlign: 'right',
                      fontWeight: 600,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {formatCompactNumber(total)}
                  </td>
                  <td
                    style={{
                      padding: '10px 16px',
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {formatCompactNumber(Math.round(avg))}
                  </td>
                  <td
                    style={{
                      padding: '10px 16px',
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {formatCompactNumber(min)}
                  </td>
                  <td
                    style={{
                      padding: '10px 16px',
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {formatCompactNumber(max)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Box>
    );
  };

  // ── Main render ──
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: embedded ? '100%' : 'calc(100vh - 64px)',
        overflow: 'hidden',
        ...(embedded ? { width: '100%' } : { m: -2 }),
      }}
    >
      {!embedded && (
        <PageHeader
          enableAutoBack
          title={
            <ArgusBreadcrumbs
              paths={[
                {
                  label: t('argus.analytics.title', 'Analytics'),
                  to: '/argus/analytics',
                },
                { label: t('argus.analytics.insights', 'Insights') },
              ]}
              size="title"
            />
          }
        />
      )}
      <Box
        sx={{
          display: 'flex',
          flex: 1,
          overflow: 'hidden',
          minHeight: 0,
        }}
      >
        <AnalyticsLayout
          leftPanel={leftPanel}
          tabBar={tabBar}
          toolbar={toolbar}
          projectId={projectId}
        >
          <PageContentLoader
            loading={
              queryLoading || (events.some((e) => e.name) && !hasQueried)
            }
            skeleton={<ArgusChartSkeleton height={300} />}
          >
            {!hasQueried ? (
              <EmptyPagePlaceholder
                message={t(
                  'argus.analytics.emptyInsights',
                  'Configure your query and click Run to see insights.'
                )}
                minHeight={300}
              />
            ) : chartDataWithFormula.length === 0 ? (
              <EmptyPagePlaceholder
                message={t(
                  'argus.analytics.noData',
                  'No data collected for the selected events.'
                )}
                minHeight={300}
              />
            ) : (
              <Box
                sx={{
                  flexGrow: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                {renderChart()}
                {chartType !== 'table' && renderSummaryTable()}
              </Box>
            )}
          </PageContentLoader>
        </AnalyticsLayout>
      </Box>
      {drilldownParams && (
        <ArgusAnalyticsDrilldownDrawer
          open={drilldownOpen}
          onClose={() => setDrilldownOpen(false)}
          projectId={projectId}
          eventName={drilldownParams.eventName}
          dateRange={drilldownParams.dateRange}
          globalFilters={globalFilters}
          breakdownFilters={drilldownParams.breakdownFilters}
        />
      )}

      <QuickLexiconEditor
        open={quickEditOpen}
        anchorEl={quickEditAnchor}
        eventName={quickEditEventName}
        projectId={projectId}
        onClose={() => setQuickEditOpen(false)}
        onSaved={refetchEvents}
      />

      {menuAnchor && (
        <Menu
          anchorEl={menuAnchor.el}
          open={Boolean(menuAnchor)}
          onClose={handleCloseMenu}
          PaperProps={{
            sx: {
              maxHeight: 320,
              width: '24ch',
            },
          }}
        >
          <MenuItem
            onClick={() => {
              handleAddCondition(menuAnchor.idx);
              handleCloseMenu();
            }}
            sx={{ fontSize: '0.8rem', py: 0.75 }}
          >
            {t('argus.analytics.addFilter', 'Add Filter')}
          </MenuItem>
          <MenuItem
            onClick={() => {
              handleRemoveEvent(menuAnchor.idx);
              handleCloseMenu();
            }}
            disabled={events.length <= 1}
            sx={{
              fontSize: '0.8rem',
              py: 0.75,
              color: events.length > 1 ? 'error.main' : 'text.disabled',
            }}
          >
            {t('argus.analytics.removeEvent', 'Delete Event')}
          </MenuItem>
          <Divider />
          <ListSubheader
            sx={{
              py: 0.5,
              height: 'auto',
              lineHeight: 'normal',
              fontSize: '0.65rem',
              fontWeight: 700,
            }}
          >
            {t('argus.analytics.show', 'Show')}
          </ListSubheader>
          {AGGREGATIONS.map((agg) => (
            <MenuItem
              key={agg.value}
              selected={events[menuAnchor.idx]?.aggregation === agg.value}
              onClick={() => {
                handleEventChange(menuAnchor.idx, 'aggregation', agg.value);
                handleCloseMenu();
              }}
              sx={{ fontSize: '0.75rem', py: 0.5 }}
            >
              {agg.label}
            </MenuItem>
          ))}
        </Menu>
      )}
    </Box>
  );
};

/* ─── Helpers ─── */
function formatBucket(bucket: string): string {
  try {
    const d = new Date(bucket.replace(' ', 'T'));
    if (isNaN(d.getTime())) return bucket;
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hour = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${month}/${day} ${hour}:${min}`;
  } catch {
    return bucket;
  }
}

export default ArgusInsightsPage;
