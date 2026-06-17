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
  alpha,
  Divider,
  IconButton,
  Collapse,
  CircularProgress,
  Menu,
  MenuItem,
  ListItemIcon,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  PlayArrow as RunIcon,
  Close as CloseIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  ArrowForward as ArrowIcon,
  KeyboardArrowDown as ArrowDownIcon,
  ViewColumn as VerticalIcon,
  ViewStream as HorizontalIcon,
  MoreVert as MoreVertIcon,
  FilterList as FilterListIcon,
  DeleteOutline as DeleteOutlineIcon,
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
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
  Legend,
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
import argusService, {
  type AnalyticsEventNameEntry,
} from '@/services/argusService';
import { renderLexiconIcon } from '@/utils/lexiconIcons';
import EventLabel from '@/components/argus/EventLabel';
import { useLocalizedLexicon } from '@/pages/argus/hooks/useLocalizedLexicon';
import {
  useFunnelsStore,
  type FunnelStepEntry,
  type EventCondition,
  type FunnelSegment,
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
import { formatCompactNumber } from '@/utils/numberFormat';
import ArgusChartSkeleton from '@/components/argus/ArgusChartSkeleton';
import PageContentLoader from '@/components/common/PageContentLoader';
import { splitBreakdownValue } from './components/analytics/breakdownUtils';
import QuickLexiconEditor from './components/analytics/QuickLexiconEditor';

/* ─── Types ─── */

type StepEntry = FunnelStepEntry;
type FunnelViewMode = 'steps' | 'trending' | 'time_to_convert';

/* ─── Sortable Wrapper ─── */

const SortableStepWrapper: React.FC<{
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

const FUNNEL_COLORS = [
  '#6366f1',
  '#818cf8',
  '#a5b4fc',
  '#c7d2fe',
  '#e0e7ff',
  '#eef2ff',
  '#f5f3ff',
  '#faf5ff',
  '#fdf4ff',
  '#fce7f3',
];

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

const SEGMENT_COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981'];

/* ─── Component ─── */

interface ArgusFunnelsPageProps {
  embedded?: boolean;
  tabBar?: React.ReactNode;
}

const ArgusFunnelsPage: React.FC<ArgusFunnelsPageProps> = ({
  embedded = false,
  tabBar,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';
  const { currentProject } = useOrgProject();
  const projectId = currentProject?.id || '1';

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
    { value: 'set', label: t('argus.analytics.op.isSet', 'is set') },
    { value: 'not_set', label: t('argus.analytics.op.isNotSet', 'is not set') },
  ];

  const CONVERSION_WINDOWS = [
    { value: 300, label: t('argus.analytics.window5min', '5 minutes') },
    { value: 3600, label: t('argus.analytics.window1hour', '1 hour') },
    { value: 86400, label: t('argus.analytics.window1day', '1 day') },
    { value: 604800, label: t('argus.analytics.window7days', '7 days') },
    { value: 2592000, label: t('argus.analytics.window30days', '30 days') },
  ];

  // ── Persisted State (survives refresh) ──
  const dateRange = useFunnelsStore((s) => s.dateRange);
  const setDateRange = useFunnelsStore((s) => s.setDateRange);
  const steps = useFunnelsStore((s) => s.steps);
  const setSteps = useFunnelsStore((s) => s.setSteps);
  const viewMode = useFunnelsStore((s) => s.viewMode);
  const setViewMode = useFunnelsStore((s) => s.setViewMode);
  const conversionWindow = useFunnelsStore((s) => s.conversionWindow);
  const setConversionWindow = useFunnelsStore((s) => s.setConversionWindow);
  const ordering = useFunnelsStore((s) => s.ordering);
  const setOrdering = useFunnelsStore((s) => s.setOrdering);
  const counting = useFunnelsStore((s) => s.counting);
  const setCounting = useFunnelsStore((s) => s.setCounting);
  const holdConstant = useFunnelsStore((s) => s.holdConstant);
  const setHoldConstant = useFunnelsStore((s) => s.setHoldConstant);
  const chartLayout = useFunnelsStore((s) => s.chartLayout);
  const setChartLayout = useFunnelsStore((s) => s.setChartLayout);
  const breakdownProperties = useFunnelsStore((s) => s.breakdownProperties);
  const setBreakdownProperties = useFunnelsStore(
    (s) => s.setBreakdownProperties
  );
  const exclusionSteps = useFunnelsStore((s) => s.exclusionSteps);
  const setExclusionSteps = useFunnelsStore((s) => s.setExclusionSteps);
  const segments = useFunnelsStore((s) => s.segments);
  const setSegments = useFunnelsStore((s) => s.setSegments);
  const compareMode = useFunnelsStore((s) => s.compareMode);
  const setCompareMode = useFunnelsStore((s) => s.setCompareMode);
  const globalFilters = useGlobalAnalyticsFilter((s) => s.filters);

  // ── Shared Event Catalog (cached across tab switches) ──
  const { availableEvents, refetch: refetchEvents } = useSharedEventCatalog(projectId);

  // ── Transient State ──
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<{
    el: HTMLElement;
    idx: number;
  } | null>(null);

  const handleOpenMenu = useCallback(
    (e: React.MouseEvent<HTMLElement>, idx: number) => {
      setMenuAnchor({ el: e.currentTarget, idx });
    },
    []
  );

  const handleCloseMenu = useCallback(() => {
    setMenuAnchor(null);
  }, []);

  // Result
  const [result, setResult] = useState<any | null>(null);
  const [queryLoading, setQueryLoading] = useState(false);
  const [hasQueried, setHasQueried] = useState(false);
  const [hiddenSeriesKeys, setHiddenSeriesKeys] = useState<Set<string>>(
    new Set()
  );
  // 'funnel' = visual bar chart, 'metric' = table-only (both use viewMode='steps')
  const [chartSubType, setChartSubType] = useState<'funnel' | 'metric'>(
    'funnel'
  );
  const isInitialMount = useRef(true);
  const lastExecutedKeyRef = useRef<string>('');

  // Drilldown state
  const [drilldownOpen, setDrilldownOpen] = useState(false);
  const [drilldownParams, setDrilldownParams] = useState<{
    eventName: string;
    dateRange: { start: Date; end: Date };
  } | null>(null);

  const handleBarClick = useCallback(
    (eventName: string) => {
      const apiParams = dateRangeToApiParams(dateRange);
      let start = new Date();
      let end = new Date();

      if (apiParams.start && apiParams.end) {
        start = new Date(apiParams.start);
        end = new Date(apiParams.end);
      } else {
        const days = parseInt(apiParams.period || '14d', 10) || 14;
        start.setDate(start.getDate() - days);
      }

      setDrilldownParams({
        eventName,
        dateRange: { start, end },
      });
      setDrilldownOpen(true);
    },
    [dateRange]
  );

  // Quick lexicon editor state

  const [quickEditOpen, setQuickEditOpen] = useState(false);
  const [quickEditAnchor, setQuickEditAnchor] = useState<HTMLElement | null>(
    null
  );
  const [quickEditEventName, setQuickEditEventName] = useState('');

  // ── Event handlers ──
  const handleAddStep = useCallback(() => {
    if (steps.length < 10) setSteps([...steps, { name: '' }]);
  }, [steps, setSteps]);

  const handleRemoveStep = useCallback(
    (index: number) => {
      setSteps(steps.filter((_, i) => i !== index));
    },
    [steps, setSteps]
  );

  const handleStepChange = useCallback(
    (index: number, value: string) => {
      setSteps(steps.map((s, i) => (i === index ? { ...s, name: value } : s)));
    },
    [steps, setSteps]
  );

  // ── DnD ──
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const stepIds = useMemo(() => steps.map((_, i) => `step-${i}`), [steps]);
  const handleStepDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        const oldIndex = stepIds.indexOf(String(active.id));
        const newIndex = stepIds.indexOf(String(over.id));
        setSteps(arrayMove(steps, oldIndex, newIndex));
      }
    },
    [steps, stepIds, setSteps]
  );

  const handleAddCondition = useCallback(
    (stepIndex: number) => {
      setSteps(
        steps.map((s, i) => {
          if (i === stepIndex) {
            const conditions = s.conditions || [];
            return {
              ...s,
              conditions: [
                ...conditions,
                { property: '', operator: 'is', value: '' },
              ],
            };
          }
          return s;
        })
      );
    },
    [steps, setSteps]
  );

  const handleConditionChange = useCallback(
    (
      stepIndex: number,
      condIndex: number,
      field: keyof EventCondition,
      value: string
    ) => {
      setSteps(
        steps.map((s, i) => {
          if (i === stepIndex && s.conditions) {
            const newConds = [...s.conditions];
            newConds[condIndex] = { ...newConds[condIndex], [field]: value };
            return { ...s, conditions: newConds };
          }
          return s;
        })
      );
    },
    [steps, setSteps]
  );

  const handleRemoveCondition = useCallback(
    (stepIndex: number, condIndex: number) => {
      setSteps(
        steps.map((s, i) => {
          if (i === stepIndex && s.conditions) {
            return {
              ...s,
              conditions: s.conditions.filter((_, ci) => ci !== condIndex),
            };
          }
          return s;
        })
      );
    },
    [steps, setSteps]
  );

  const handleAddHoldConstant = useCallback(() => {
    if (holdConstant.length < 3) {
      setHoldConstant([...holdConstant, '']);
    }
  }, [holdConstant, setHoldConstant]);

  const handleRemoveHoldConstant = useCallback(
    (index: number) => {
      setHoldConstant(holdConstant.filter((_, i) => i !== index));
    },
    [holdConstant, setHoldConstant]
  );

  // ── Run Query ──
  const handleRun = useCallback(
    async (modeOverride?: string) => {
      const validSteps = steps.filter((s) => s.name);
      if (validSteps.length < 2) return;
      const effectiveMode = modeOverride || viewMode;

      const queryKey = JSON.stringify({
        projectId,
        steps: validSteps,
        dateRange,
        conversionWindow,
        ordering,
        counting,
        holdConstant,
        breakdownProperties,
        exclusionSteps,
        globalFilters,
        segments,
        compareMode,
        viewMode: effectiveMode,
      });
      lastExecutedKeyRef.current = queryKey;

      setQueryLoading(true);
      setHasQueried(true);
      try {
        const apiParams = dateRangeToApiParams(dateRange);
        const data = await argusService.getAnalyticsFunnels(projectId, {
          steps: validSteps.map((s) => ({
            event_name: s.name,
            conditions: s.conditions?.filter((c) => c.property),
          })),
          conversion_window: conversionWindow,
          ordering,
          counting,
          hold_constant: holdConstant.filter(Boolean),
          breakdown:
            breakdownProperties.length > 0
              ? { properties: breakdownProperties }
              : undefined,
          exclusion_steps:
            exclusionSteps.filter((es) => es.event_name).length > 0
              ? exclusionSteps.filter((es) => es.event_name)
              : undefined,
          mode: effectiveMode as 'steps' | 'trending' | 'time_to_convert',
          global_filters: globalFilters.length > 0 ? globalFilters : undefined,
          segments:
            compareMode && segments.length > 0
              ? segments.filter((s) => s.filters.length > 0)
              : undefined,
          period: apiParams.period,
          start: apiParams.start,
          end: apiParams.end,
        });
        setResult(data);
      } catch {
        setResult(null);
      } finally {
        setQueryLoading(false);
      }
    },
    [
      steps,
      dateRange,
      projectId,
      conversionWindow,
      ordering,
      counting,
      holdConstant,
      breakdownProperties,
      exclusionSteps,
      globalFilters,
      segments,
      compareMode,
      viewMode,
    ]
  );

  // ── Handle view mode change: switch + re-run in same tick (no flash) ──
  const handleViewModeChange = useCallback(
    (newMode: string) => {
      setViewMode(newMode as any);
      if (hasQueried) {
        setQueryLoading(true); // immediately hide stale content

        // Sync query key beforehand to block the debounced useEffect auto-query from running again
        const validSteps = steps.filter((s) => s.name);
        const nextQueryKey = JSON.stringify({
          projectId,
          steps: validSteps,
          dateRange,
          conversionWindow,
          ordering,
          counting,
          holdConstant,
          breakdownProperties,
          exclusionSteps,
          globalFilters,
          segments,
          compareMode,
          viewMode: newMode,
        });
        lastExecutedKeyRef.current = nextQueryKey;

        setTimeout(() => handleRun(newMode), 0);
      }
    },
    [
      setViewMode,
      hasQueried,
      handleRun,
      steps,
      projectId,
      dateRange,
      conversionWindow,
      ordering,
      counting,
      holdConstant,
      breakdownProperties,
      exclusionSteps,
      globalFilters,
      segments,
      compareMode,
    ]
  );

  // Reset hidden keys when result changes
  useEffect(() => {
    setHiddenSeriesKeys(new Set());
  }, [result]);

  // Debounced auto-query running on settings change
  useEffect(() => {
    const validSteps = steps.filter((s) => s.name);
    if (validSteps.length < 2) {
      isInitialMount.current = false;
      return;
    }

    const queryKey = JSON.stringify({
      projectId,
      steps: validSteps,
      dateRange,
      conversionWindow,
      ordering,
      counting,
      holdConstant,
      breakdownProperties,
      exclusionSteps,
      globalFilters,
      segments,
      compareMode,
      viewMode,
    });

    if (queryKey === lastExecutedKeyRef.current) {
      return;
    }

    if (isInitialMount.current) {
      isInitialMount.current = false;
      lastExecutedKeyRef.current = queryKey;
      handleRun();
      return;
    }

    const timer = setTimeout(() => {
      lastExecutedKeyRef.current = queryKey;
      handleRun();
    }, 600);

    return () => clearTimeout(timer);
  }, [
    steps,
    dateRange,
    conversionWindow,
    ordering,
    counting,
    holdConstant,
    breakdownProperties,
    exclusionSteps,
    globalFilters,
    segments,
    compareMode,
    viewMode,
    projectId,
    handleRun,
  ]);

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
      return (
        <span
          style={{
            color: isHidden ? theme.palette.text.disabled : 'inherit',
            textDecoration: isHidden ? 'line-through' : 'none',
            cursor: 'pointer',
          }}
        >
          {value}
        </span>
      );
    },
    [hiddenSeriesKeys, theme]
  );

  const { localizeEventName: lfn, localizeEventDescription: lfd } =
    useLocalizedLexicon();

  // Lexicon Map for translating event keys → localized display name
  const lexiconMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of availableEvents) {
      const localized = lfn(e.name, e.display_name, e.is_reserved);
      if (localized && localized !== e.name) map.set(e.name, localized);
    }
    return map;
  }, [availableEvents, lfn]);

  // Event metadata map for EventLabel
  const eventMetaMap = useMemo(() => {
    const map = new Map<string, AnalyticsEventNameEntry>();
    for (const e of availableEvents) {
      map.set(e.name, e);
    }
    return map;
  }, [availableEvents]);

  // ── Chart Data ──
  const chartData = useMemo(() => {
    if (!result?.steps) return [];
    return result.steps.map((s: any, i: number) => ({
      name: lexiconMap.get(s.name) || s.name,
      count: s.count,
      rate: s.conversion_rate,
      fill: FUNNEL_COLORS[i % FUNNEL_COLORS.length],
    }));
  }, [result, lexiconMap]);

  const trendingData = useMemo(() => {
    if (!result?.trending) return [];
    return result.trending.map((t: any) => ({
      date: t.date,
      conversion_rate: t.conversion_rate,
    }));
  }, [result]);

  const timeToConvertData = useMemo(() => {
    if (!result?.time_to_convert) return [];
    return result.time_to_convert.distribution || [];
  }, [result]);

  // ── CSV Data ──
  const csvData = useMemo(() => {
    if (viewMode === 'steps') return chartData;
    if (viewMode === 'trending') return trendingData;
    if (viewMode === 'time_to_convert') return timeToConvertData;
    return [];
  }, [viewMode, chartData, trendingData, timeToConvertData]);

  const eventOptions = useMemo(
    () =>
      availableEvents.map((e) => ({
        value: e.name,
        label: lfn(e.name, e.display_name, e.is_reserved),
        icon: renderLexiconIcon(e.icon, 18, e.icon_color || undefined),
        meta: {
          eventKey: e.name,
          description: lfd(e.name, e.description, e.is_reserved) || undefined,
          category: e.category || undefined,
          count: e.count,
          isReserved: e.is_reserved,
        },
      })),
    [availableEvents, lfn, lfd]
  );

  // ── UI: Left Panel ──
  const leftPanel = (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {/* Steps */}
      <Box>
        <Typography
          variant="overline"
          sx={{ fontWeight: 700, color: 'text.secondary', ml: 0.5 }}
        >
          {t('argus.analytics.funnelSteps', 'Funnel Steps')}
        </Typography>
        <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <DndContext
            sensors={dndSensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={handleStepDragEnd}
          >
            <SortableContext
              items={stepIds}
              strategy={verticalListSortingStrategy}
            >
              {steps.map((step, idx) => (
                <SortableStepWrapper key={stepIds[idx]} id={stepIds[idx]}>
                  {({ dragHandleProps, isDragging }) => (
                    <React.Fragment>
                      <EventBlock
                        indexLabel={String(idx + 1)}
                        color={FUNNEL_COLORS[idx % FUNNEL_COLORS.length]}
                        dragHandleProps={dragHandleProps}
                        isDragging={isDragging}
                      >
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            width: '100%',
                          }}
                        >
                          <InlineSelect
                            value={step.name}
                            onChange={(val) => handleStepChange(idx, val)}
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

                        {/* Conditions */}
                        {step.conditions && step.conditions.length > 0 && (
                          <Box
                            sx={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 0.5,
                            }}
                          >
                            {step.conditions.map((cond, cIdx) => (
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
                                  eventName={step.name}
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
                                {!['set', 'not_set'].includes(
                                  cond.operator
                                ) && (
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
                                  onClick={() =>
                                    handleRemoveCondition(idx, cIdx)
                                  }
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
                      {idx < steps.length - 1 && (
                        <Box
                          sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            mt: 0,
                            mb: -1, // Negate parent flex gap to pull the connection box flush with the next step
                          }}
                        >
                          <Box
                            sx={{
                              width: 0,
                              height: 14,
                              borderLeft: `2px dashed ${isDark ? 'rgba(99,102,241,0.4)' : 'rgba(99,102,241,0.3)'}`,
                            }}
                          />
                          <Box
                            sx={{
                              width: 20,
                              height: 20,
                              borderRadius: '50%',
                              border: `2px solid ${isDark ? 'rgba(99,102,241,0.45)' : 'rgba(99,102,241,0.35)'}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              bgcolor: 'background.paper', // Prevents dashed line showing behind it
                              zIndex: 2,
                            }}
                          >
                            <ArrowDownIcon
                              sx={{
                                fontSize: 14,
                                color: isDark
                                  ? 'rgba(99,102,241,0.7)'
                                  : 'rgba(99,102,241,0.5)',
                              }}
                            />
                          </Box>
                          <Box
                            sx={{
                              width: 0,
                              height: 14,
                              borderLeft: `2px dashed ${isDark ? 'rgba(99,102,241,0.4)' : 'rgba(99,102,241,0.3)'}`,
                            }}
                          />
                        </Box>
                      )}
                    </React.Fragment>
                  )}
                </SortableStepWrapper>
              ))}
            </SortableContext>
          </DndContext>
          {steps.length < 10 && (
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={handleAddStep}
              sx={{
                alignSelf: 'flex-start',
                mt: 1,
                textTransform: 'none',
                borderRadius: 1.5,
              }}
            >
              {t('argus.analytics.addStep', 'Add Step')}
            </Button>
          )}
        </Box>
      </Box>

      <Divider sx={{ opacity: isDark ? 0.05 : 0.5 }} />

      {/* Advanced Settings (collapsible) */}
      <Box>
        <Button
          size="small"
          onClick={() => setShowAdvanced(!showAdvanced)}
          endIcon={showAdvanced ? <CollapseIcon /> : <ExpandIcon />}
          sx={{
            textTransform: 'none',
            color: 'text.secondary',
            fontWeight: 600,
            fontSize: '0.75rem',
            px: 0.5,
          }}
        >
          {t('argus.analytics.conversionCriteria', 'Conversion Criteria')}
        </Button>
        <Collapse in={showAdvanced}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5,
              mt: 1,
              pl: 1.5,
            }}
          >
            {/* Conversion Window */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ minWidth: 60 }}
              >
                {t('argus.analytics.conversionWindow', 'Window')}
              </Typography>
              <InlineSelect
                value={String(conversionWindow)}
                onChange={(val) => setConversionWindow(Number(val))}
                options={CONVERSION_WINDOWS.map((w) => ({
                  value: String(w.value),
                  label: w.label,
                }))}
              />
            </Box>

            {/* Ordering */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ minWidth: 60 }}
              >
                {t('argus.analytics.ordering', 'Order')}
              </Typography>
              <InlineSelect
                value={ordering}
                onChange={(val) => setOrdering(val as any)}
                options={[
                  {
                    value: 'specific',
                    label: t('argus.analytics.specificOrder', 'Specific Order'),
                  },
                  {
                    value: 'any',
                    label: t('argus.analytics.anyOrder', 'Any Order'),
                  },
                ]}
              />
            </Box>

            {/* Counting */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ minWidth: 60 }}
              >
                {t('argus.analytics.counting', 'Count')}
              </Typography>
              <InlineSelect
                value={counting}
                onChange={(val) => setCounting(val as any)}
                options={[
                  {
                    value: 'uniques',
                    label: t('argus.analytics.uniques', 'Uniques'),
                  },
                  {
                    value: 'totals',
                    label: t('argus.analytics.totals', 'Totals'),
                  },
                ]}
              />
            </Box>

            {/* Hold Constant */}
            <Box>
              <Typography variant="caption" color="text.secondary">
                {t('argus.analytics.holdConstant', 'Hold Constant')}
              </Typography>
              {holdConstant.map((prop, idx) => (
                <Box
                  key={idx}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    mt: 0.5,
                  }}
                >
                  <PropertyPicker
                    projectId={projectId}
                    value={prop ? [prop] : []}
                    onChange={(val) => {
                      setHoldConstant(
                        holdConstant.map((p, i) =>
                          i === idx ? val[0] || '' : p
                        )
                      );
                    }}
                    emptyLabel={t('argus.analytics.property', 'Property')}
                    highlightEmpty
                    maxItems={1}
                  />
                  <IconButton
                    size="small"
                    onClick={() => handleRemoveHoldConstant(idx)}
                    sx={{ p: 0.25, opacity: 0.6 }}
                  >
                    <CloseIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Box>
              ))}
              {holdConstant.length < 3 && (
                <Button
                  size="small"
                  onClick={handleAddHoldConstant}
                  sx={{
                    textTransform: 'none',
                    opacity: 0.7,
                    fontSize: '0.7rem',
                    py: 0,
                    mt: 0.5,
                  }}
                >
                  {t('argus.analytics.addProperty', '+ Add Property')}
                </Button>
              )}
            </Box>

            {/* Exclusion Steps */}
            <Box>
              <Typography variant="caption" color="text.secondary">
                {t('argus.analytics.excludeUsers', 'Exclude users who did')}
              </Typography>
              {exclusionSteps.map((es, idx) => (
                <Box
                  key={idx}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    mt: 0.5,
                    flexWrap: 'wrap',
                  }}
                >
                  <InlineSelect
                    value={es.event_name}
                    onChange={(val) => {
                      setExclusionSteps(
                        exclusionSteps.map((e, i) =>
                          i === idx ? { ...e, event_name: val } : e
                        )
                      );
                    }}
                    options={availableEvents.map((e) => ({
                      value: e.name,
                      label: lfn(e.name, e.display_name, e.is_reserved),
                      icon: renderLexiconIcon(
                        e.icon,
                        18,
                        e.icon_color || undefined
                      ),
                      meta: {
                        eventKey: e.name,
                        description:
                          lfd(e.name, e.description, e.is_reserved) ||
                          undefined,
                        category: e.category || undefined,
                        count: e.count,
                        isReserved: e.is_reserved,
                      },
                    }))}
                    emptyLabel={t(
                      'argus.analytics.selectEvent',
                      'Select Event'
                    )}
                    highlightEmpty
                  />
                  <Typography variant="caption" color="text.secondary">
                    {t('argus.analytics.betweenSteps', 'between step')}
                  </Typography>
                  <InlineSelect
                    value={String(es.between[0])}
                    onChange={(val) => {
                      setExclusionSteps(
                        exclusionSteps.map((e, i) =>
                          i === idx
                            ? { ...e, between: [Number(val), e.between[1]] }
                            : e
                        )
                      );
                    }}
                    options={steps.map((s, si) => ({
                      value: String(si),
                      label: `${si + 1}. ${s.name || '...'}`,
                    }))}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {t('argus.analytics.and', 'and')}
                  </Typography>
                  <InlineSelect
                    value={String(es.between[1])}
                    onChange={(val) => {
                      setExclusionSteps(
                        exclusionSteps.map((e, i) =>
                          i === idx
                            ? { ...e, between: [e.between[0], Number(val)] }
                            : e
                        )
                      );
                    }}
                    options={steps.map((s, si) => ({
                      value: String(si),
                      label: `${si + 1}. ${s.name || '...'}`,
                    }))}
                  />
                  <IconButton
                    size="small"
                    onClick={() =>
                      setExclusionSteps(
                        exclusionSteps.filter((_, i) => i !== idx)
                      )
                    }
                    sx={{ p: 0.25, opacity: 0.6 }}
                  >
                    <CloseIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Box>
              ))}
              {exclusionSteps.length < 5 && (
                <Button
                  size="small"
                  onClick={() =>
                    setExclusionSteps([
                      ...exclusionSteps,
                      {
                        event_name: '',
                        between: [0, Math.min(1, steps.length - 1)],
                      },
                    ])
                  }
                  sx={{
                    textTransform: 'none',
                    opacity: 0.7,
                    fontSize: '0.7rem',
                    py: 0,
                    mt: 0.5,
                  }}
                >
                  {t('argus.analytics.addExclusion', '+ Add Exclusion')}
                </Button>
              )}
            </Box>
          </Box>
        </Collapse>
      </Box>

      <Divider sx={{ opacity: isDark ? 0.05 : 0.5 }} />

      {/* Breakdown */}
      <BreakdownSection
        projectId={projectId}
        eventName={steps[0]?.name}
        value={breakdownProperties}
        onChange={setBreakdownProperties}
      />

      <Divider sx={{ opacity: isDark ? 0.05 : 0.5 }} />

      {/* Segment Comparison */}
      <Box>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Typography
            variant="overline"
            sx={{ fontWeight: 700, color: 'text.secondary', ml: 0.5 }}
          >
            {t('argus.analytics.compareSegments', 'Compare Segments')}
          </Typography>
          <Button
            size="small"
            onClick={() => setCompareMode(!compareMode)}
            sx={{
              textTransform: 'none',
              fontSize: '0.68rem',
              fontWeight: 600,
              color: compareMode ? 'primary.main' : 'text.disabled',
            }}
          >
            {compareMode ? t('common.on', 'ON') : t('common.off', 'OFF')}
          </Button>
        </Box>
        {compareMode && (
          <Box
            sx={{
              mt: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
              pl: 1.5,
            }}
          >
            {segments.map((seg, idx) => (
              <Box
                key={seg.id}
                sx={{
                  p: 1,
                  borderRadius: 1.5,
                  border: `1px solid ${seg.color}33`,
                  bgcolor: `${seg.color}08`,
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    mb: 0.5,
                  }}
                >
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      bgcolor: seg.color,
                      flexShrink: 0,
                    }}
                  />
                  <input
                    value={seg.name}
                    onChange={(e) =>
                      setSegments(
                        segments.map((s, i) =>
                          i === idx ? { ...s, name: e.target.value } : s
                        )
                      )
                    }
                    placeholder={`Segment ${idx + 1}`}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'}`,
                      color: 'inherit',
                      outline: 'none',
                      width: '100%',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      fontFamily: 'inherit',
                    }}
                  />
                  <IconButton
                    size="small"
                    onClick={() =>
                      setSegments(segments.filter((_, i) => i !== idx))
                    }
                    sx={{ p: 0.25, opacity: 0.6 }}
                  >
                    <CloseIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Box>
                {seg.filters.map((f, fIdx) => (
                  <Box
                    key={fIdx}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      mt: 0.5,
                      flexWrap: 'wrap',
                    }}
                  >
                    <PropertyPicker
                      projectId={projectId}
                      value={f.property ? [f.property] : []}
                      onChange={(val) => {
                        const newFilters = [...seg.filters];
                        newFilters[fIdx] = { ...f, property: val[0] || '' };
                        setSegments(
                          segments.map((s, i) =>
                            i === idx ? { ...s, filters: newFilters } : s
                          )
                        );
                      }}
                      emptyLabel={t('argus.analytics.property', 'Property')}
                      highlightEmpty
                      maxItems={1}
                    />
                    <InlineSelect
                      value={f.operator}
                      onChange={(val) => {
                        const newFilters = [...seg.filters];
                        newFilters[fIdx] = { ...f, operator: val };
                        setSegments(
                          segments.map((s, i) =>
                            i === idx ? { ...s, filters: newFilters } : s
                          )
                        );
                      }}
                      options={[
                        { value: 'is', label: 'is' },
                        { value: 'is_not', label: 'is not' },
                        { value: 'contains', label: 'contains' },
                      ]}
                    />
                    <PropertyValueInput
                      projectId={projectId}
                      property={f.property}
                      value={f.value}
                      onChange={(val) => {
                        const newFilters = [...seg.filters];
                        newFilters[fIdx] = { ...f, value: val };
                        setSegments(
                          segments.map((s, i) =>
                            i === idx ? { ...s, filters: newFilters } : s
                          )
                        );
                      }}
                    />
                    <IconButton
                      size="small"
                      onClick={() => {
                        const newFilters = seg.filters.filter(
                          (_, i) => i !== fIdx
                        );
                        setSegments(
                          segments.map((s, i) =>
                            i === idx ? { ...s, filters: newFilters } : s
                          )
                        );
                      }}
                      sx={{ p: 0.25, opacity: 0.5 }}
                    >
                      <CloseIcon sx={{ fontSize: 12 }} />
                    </IconButton>
                  </Box>
                ))}
                <Button
                  size="small"
                  onClick={() => {
                    const newFilters = [
                      ...seg.filters,
                      { property: '', operator: 'is', value: '' },
                    ];
                    setSegments(
                      segments.map((s, i) =>
                        i === idx ? { ...s, filters: newFilters } : s
                      )
                    );
                  }}
                  sx={{
                    textTransform: 'none',
                    fontSize: '0.68rem',
                    py: 0,
                    mt: 0.5,
                    opacity: 0.7,
                  }}
                >
                  + Filter
                </Button>
              </Box>
            ))}
            {segments.length < 4 && (
              <Button
                size="small"
                onClick={() =>
                  setSegments([
                    ...segments,
                    {
                      id: `seg_${Date.now()}`,
                      name: '',
                      filters: [{ property: '', operator: 'is', value: '' }],
                      color:
                        SEGMENT_COLORS[segments.length % SEGMENT_COLORS.length],
                    },
                  ])
                }
                sx={{
                  textTransform: 'none',
                  fontSize: '0.72rem',
                  borderRadius: 1.5,
                  mt: 0.5,
                }}
              >
                {t('argus.analytics.addSegment', '+ Add Segment')}
              </Button>
            )}
          </Box>
        )}
      </Box>

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
          onClick={() => handleRun()}
          disabled={queryLoading || steps.filter((s) => s.name).length < 2}
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
      {/* View mode selector — Mixpanel-style segmented buttons */}
      <Box
        sx={{
          display: 'flex',
          borderRadius: 1,
          overflow: 'hidden',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
          flexShrink: 0,
        }}
      >
        {(
          [
            { label: 'Funnel Steps', apiMode: 'steps', sub: 'funnel' },
            { label: 'Line', apiMode: 'trending', sub: 'funnel' },
            { label: 'Metric', apiMode: 'steps', sub: 'metric' },
            {
              label: 'Time to Conv.',
              apiMode: 'time_to_convert',
              sub: 'funnel',
            },
          ] as const
        ).map(({ label, apiMode, sub }) => {
          const isActive =
            viewMode === apiMode &&
            (apiMode !== 'steps' || chartSubType === sub);
          return (
            <Box
              key={label}
              onClick={() => {
                setChartSubType(sub as 'funnel' | 'metric');
                if (viewMode !== apiMode) handleViewModeChange(apiMode);
              }}
              sx={{
                px: 1.25,
                py: 0.625,
                cursor: 'pointer',
                fontSize: '0.72rem',
                fontWeight: 600,
                bgcolor: isActive ? alpha('#6366f1', 0.15) : 'transparent',
                color: isActive ? '#6366f1' : 'text.secondary',
                '&:hover': { bgcolor: alpha('#6366f1', 0.1) },
                transition: 'background 0.15s ease, color 0.15s ease',
                userSelect: 'none',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                borderRight: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}`,
                '&:last-child': { borderRight: 'none' },
              }}
            >
              {label}
            </Box>
          );
        })}
      </Box>
      {/* Layout toggle — only for Funnel Steps (vertical/horizontal) */}
      {viewMode === 'steps' && chartSubType === 'funnel' && (
        <Box
          sx={{
            display: 'flex',
            borderRadius: 1,
            overflow: 'hidden',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
          }}
        >
          <IconButton
            size="small"
            onClick={() => setChartLayout('horizontal')}
            sx={{
              borderRadius: 0,
              px: 1,
              bgcolor:
                chartLayout === 'horizontal'
                  ? alpha('#6366f1', 0.15)
                  : 'transparent',
              color:
                chartLayout === 'horizontal' ? '#6366f1' : 'text.secondary',
              '&:hover': { bgcolor: alpha('#6366f1', 0.1) },
            }}
            title={t('argus.analytics.horizontalLayout', 'Horizontal')}
          >
            <HorizontalIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => setChartLayout('vertical')}
            sx={{
              borderRadius: 0,
              px: 1,
              bgcolor:
                chartLayout === 'vertical'
                  ? alpha('#6366f1', 0.15)
                  : 'transparent',
              color: chartLayout === 'vertical' ? '#6366f1' : 'text.secondary',
              '&:hover': { bgcolor: alpha('#6366f1', 0.1) },
            }}
            title={t('argus.analytics.verticalLayout', 'Vertical')}
          >
            <VerticalIcon fontSize="small" />
          </IconButton>
        </Box>
      )}
      {!embedded && (
        <DateRangeSelector value={dateRange} onChange={setDateRange} compact />
      )}
      <CsvExportButton
        data={csvData}
        filename="funnels"
        disabled={csvData.length === 0}
      />
    </>
  );

  /* ─── Render: Breakdown Funnel Chart (Mixpanel-style: N bars per step) ─── */
  const renderBreakdownFunnelChart = () => {
    const breakdowns = result!.breakdowns!;
    const bdKeys = Object.keys(breakdowns).slice(0, 10);
    const stepDefs = result!.steps as any[];
    const gridStroke = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    const BDC = [
      '#6366f1',
      '#f59e0b',
      '#10b981',
      '#ec4899',
      '#3b82f6',
      '#ef4444',
      '#8b5cf6',
      '#14b8a6',
      '#f97316',
      '#84cc16',
    ];
    // Height reference: max count across ALL breakdown values at step 0
    const globalMax = Math.max(
      ...bdKeys.flatMap((bk) =>
        ((breakdowns[bk].steps || []) as any[]).map((s: any) => s.count ?? 0)
      ),
      1
    );

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {/* Overall conversion header */}
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, px: 1 }}>
          <Typography variant="h3" fontWeight={800} sx={{ color: '#6366f1' }}>
            {result?.overall_conversion ?? 0}%
          </Typography>
          <Typography
            variant="subtitle1"
            color="text.secondary"
            fontWeight={500}
          >
            {t('argus.analytics.overallConversion', 'Overall Conversion Rate')}
          </Typography>
        </Box>

        {/* Segment legend */}
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', px: 1 }}>
          {bdKeys.map((key, idx) => (
            <Box
              key={key}
              sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
            >
              <Box
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  bgcolor: BDC[idx % BDC.length],
                  flexShrink: 0,
                }}
              />
              <Typography
                variant="caption"
                sx={{ fontSize: '0.72rem', color: 'text.secondary' }}
              >
                {splitBreakdownValue(key).join(' · ') || key || '(empty)'}
              </Typography>
            </Box>
          ))}
        </Box>

        {/* Chart */}
        <Box sx={{ display: 'flex', alignItems: 'stretch' }}>
          {/* Y-axis labels — absolutely positioned to align with gridlines */}
          <Box
            sx={{
              width: 40,
              flexShrink: 0,
              position: 'relative',
              height: 280,
              alignSelf: 'flex-end',
            }}
          >
            {[0, 25, 50, 75, 100].map((tick) => (
              <Typography
                key={tick}
                sx={{
                  position: 'absolute',
                  bottom: `${tick}%`,
                  right: 12,
                  fontSize: '0.6rem',
                  color: 'text.disabled',
                  lineHeight: 1,
                  transform: 'translateY(50%)',
                  whiteSpace: 'nowrap',
                }}
              >
                {tick}%
              </Typography>
            ))}
          </Box>

          <Box sx={{ flex: 1, position: 'relative' }}>
            {/* Background Gridlines */}
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: 0,
                right: 0,
                pointerEvents: 'none',
                zIndex: 0,
              }}
            >
              {[0, 25, 50, 75, 100].map((tick) => (
                <Box
                  key={tick}
                  sx={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: `${tick}%`,
                    borderTop: `1px solid ${gridStroke}`,
                  }}
                />
              ))}
            </Box>

            {/* Step column groups — each group = 1 step, N bars inside */}
            <Box
              sx={{
                display: 'flex',
                height: 280,
                gap: '8px',
                position: 'relative',
                zIndex: 1,
              }}
            >
              {stepDefs.map((step, stepIdx) => {
                return (
                  <Box
                    key={stepIdx}
                    sx={{
                      flex: 1,
                      height: '100%',
                      display: 'flex',
                      alignItems: 'flex-end',
                      gap: '2px',
                      minWidth: 0,
                      position: 'relative',
                    }}
                  >
                    {bdKeys.map((bdKey, bdIdx) => {
                      const bdSteps = (breakdowns[bdKey].steps || []) as any[];
                      const bdStep = bdSteps[stepIdx];
                      const prevBdStep =
                        stepIdx > 0 ? bdSteps[stepIdx - 1] : null;
                      const count = bdStep?.count ?? 0;
                      const rate = bdStep?.conversion_rate ?? 0;
                      const prevCount = prevBdStep?.count ?? 0;
                      const color = BDC[bdIdx % BDC.length];
                      const filledPct =
                        globalMax > 0 ? (count / globalMax) * 100 : 0;
                      const ghostPct =
                        stepIdx > 0 && globalMax > 0
                          ? (prevCount / globalMax) * 100
                          : 0;
                      const dropCount =
                        prevBdStep && prevCount > count ? prevCount - count : 0;

                      return (
                        <Box
                          key={bdKey}
                          sx={{
                            flex: 1,
                            height: '100%',
                            position: 'relative',
                            minWidth: 0,
                          }}
                        >
                          {/* Ghost bar (previous step silhouette) */}
                          {stepIdx > 0 && ghostPct > 0 && (
                            <Box
                              sx={{
                                position: 'absolute',
                                bottom: 0,
                                left: 0,
                                right: 0,
                                height: `${ghostPct}%`,
                                bgcolor: 'background.paper',
                                borderRadius: '4px 4px 0 0',
                                transition: 'height 0.5s ease',
                                zIndex: 1,
                              }}
                            >
                              <Box
                                sx={{
                                  position: 'absolute',
                                  top: 0,
                                  bottom: 0,
                                  left: 0,
                                  right: 0,
                                  bgcolor: `${color}1c`,
                                  borderRadius: 'inherit',
                                }}
                              />
                              {dropCount > 0 &&
                                ghostPct - filledPct > 12 &&
                                (() => {
                                  const pct =
                                    ((ghostPct - filledPct) / 2 / ghostPct) *
                                    100;
                                  return (
                                    <Box
                                      sx={{
                                        position: 'absolute',
                                        top: `${pct}%`,
                                        transform: 'translateY(-50%)',
                                        left: 0,
                                        right: 0,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        pointerEvents: 'none',
                                      }}
                                    >
                                      <Typography
                                        sx={{
                                          fontSize: '0.5rem',
                                          color: '#ef4444',
                                          opacity: 0.7,
                                          fontWeight: 700,
                                        }}
                                      >
                                        −{formatCompactNumber(dropCount)}
                                      </Typography>
                                    </Box>
                                  );
                                })()}
                            </Box>
                          )}
                          {/* Drop boundary dashed line */}
                          {stepIdx > 0 &&
                            ghostPct > filledPct &&
                            filledPct > 1 && (
                              <Box
                                sx={{
                                  position: 'absolute',
                                  bottom: `${filledPct}%`,
                                  left: 0,
                                  right: 0,
                                  borderTop: '1px dashed rgba(239,68,68,0.25)',
                                  pointerEvents: 'none',
                                  zIndex: 2,
                                }}
                              />
                            )}
                          {/* Filled bar */}
                          <Tooltip
                            title={`${splitBreakdownValue(bdKey).join(' · ') || bdKey}: ${formatCompactNumber(count)} (${rate}%)`}
                            placement="top"
                            arrow
                          >
                            <Box
                              onClick={() => handleBarClick(step.name)}
                              sx={{
                                position: 'absolute',
                                bottom: 0,
                                left: 0,
                                right: 0,
                                height:
                                  count > 0
                                    ? `${Math.max(filledPct, 0.5)}%`
                                    : 0,
                                minHeight: count > 0 ? 3 : 0,
                                bgcolor: color,
                                borderRadius: '4px 4px 0 0',
                                cursor: 'pointer',
                                transition:
                                  'height 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.15s ease',
                                '&:hover': {
                                  filter: 'brightness(1.1)',
                                  zIndex: 3,
                                },
                                zIndex: 2,
                              }}
                            />
                          </Tooltip>
                          {/* Floating label chip above bar */}
                          {count > 0 && (
                            <Box
                              sx={{
                                position: 'absolute',
                                bottom: `${Math.max(filledPct, 0.5)}%`,
                                left: '50%',
                                transform: 'translateX(-50%)',
                                mb: '2px',
                                bgcolor: isDark
                                  ? 'rgba(18,18,30,0.92)'
                                  : 'rgba(255,255,255,0.97)',
                                borderRadius: '3px',
                                px: '3px',
                                py: '1px',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
                                border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'}`,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                zIndex: 10,
                                whiteSpace: 'nowrap',
                                pointerEvents: 'none',
                              }}
                            >
                              <Typography
                                sx={{
                                  fontSize: '0.6rem',
                                  fontWeight: 700,
                                  color: 'text.primary',
                                  lineHeight: 1.2,
                                }}
                              >
                                {rate}%
                              </Typography>
                              <Typography
                                sx={{
                                  fontSize: '0.55rem',
                                  color: 'text.secondary',
                                  lineHeight: 1,
                                }}
                              >
                                {formatCompactNumber(count)}
                              </Typography>
                            </Box>
                          )}
                        </Box>
                      );
                    })}
                  </Box>
                );
              })}
            </Box>

            {/* Step name labels row */}
            <Box sx={{ display: 'flex', gap: '8px', mt: 1, height: 44 }}>
              {stepDefs.map((step, stepIdx) => (
                <Tooltip
                  key={stepIdx}
                  title={step.name}
                  placement="bottom"
                  arrow
                >
                  <Box
                    sx={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'flex-start',
                      gap: 0.25,
                      pt: 0.5,
                      minWidth: 0,
                    }}
                  >
                    <Box
                      sx={{
                        width: 18,
                        height: 18,
                        borderRadius: '4px',
                        bgcolor: FUNNEL_COLORS[stepIdx % FUNNEL_COLORS.length],
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.55rem',
                        fontWeight: 800,
                        flexShrink: 0,
                      }}
                    >
                      {stepIdx + 1}
                    </Box>
                    <Typography
                      variant="caption"
                      sx={{
                        fontSize: '0.65rem',
                        fontWeight: 500,
                        maxWidth: '100%',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        color: 'text.secondary',
                        textAlign: 'center',
                        display: 'block',
                      }}
                    >
                      {lexiconMap.get(step.name) || step.name}
                    </Typography>
                  </Box>
                </Tooltip>
              ))}
            </Box>
          </Box>
        </Box>

        {/* Breakdown data table — reuse existing implementation */}
        {renderBreakdownComparison()}
      </Box>
    );
  };

  /* ─── Render: Metric-only view (no chart, table only) ─── */
  const renderMetricOnlyView = () => {
    if (chartData.length === 0) return null;
    const bdLine = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
    const thStyle: React.CSSProperties = {
      textAlign: 'right',
      padding: '12px 16px',
      borderBottom: `1px solid ${bdLine}`,
      color: theme.palette.text.secondary,
      fontWeight: 600,
    };
    const maxCount = Math.max(...chartData.map((d: any) => d.count), 1);

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, px: 1 }}>
          <Typography variant="h3" fontWeight={800} sx={{ color: '#6366f1' }}>
            {result?.overall_conversion ?? 0}%
          </Typography>
          <Typography
            variant="subtitle1"
            color="text.secondary"
            fontWeight={500}
          >
            {t('argus.analytics.overallConversion', 'Overall Conversion Rate')}
          </Typography>
        </Box>
        <Box
          sx={{
            overflowX: 'auto',
            borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
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
                    borderBottom: `1px solid ${bdLine}`,
                    color: theme.palette.text.secondary,
                    fontWeight: 600,
                  }}
                >
                  {t('argus.analytics.step', 'Step')}
                </th>
                <th style={thStyle}>{t('argus.analytics.users', 'Users')}</th>
                <th style={{ ...thStyle, textAlign: 'left', minWidth: 180 }}>
                  {t('argus.analytics.conversion', 'Conversion')}
                </th>
                <th style={thStyle}>
                  {t('argus.analytics.dropOff', 'Drop-off')}
                </th>
                <th style={thStyle}>
                  {t('argus.analytics.stepToStep', 'Step-to-Step')}
                </th>
              </tr>
            </thead>
            <tbody>
              {result?.steps.map((s: any, idx: number) => {
                const prevCount =
                  idx > 0 ? result.steps[idx - 1].count : s.count;
                const dropOff = idx > 0 ? prevCount - s.count : 0;
                const dropPct =
                  idx > 0 && prevCount > 0
                    ? Math.round((1 - s.count / prevCount) * 1000) / 10
                    : 0;
                const stepToStep =
                  idx === 0
                    ? 100
                    : prevCount > 0
                      ? Math.round((s.count / prevCount) * 1000) / 10
                      : 0;
                const convBarWidth =
                  maxCount > 0 ? (s.count / maxCount) * 100 : 0;
                return (
                  <tr
                    key={idx}
                    style={{
                      borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}`,
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor =
                        isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor =
                        'transparent';
                    }}
                    onClick={() => handleBarClick(s.name)}
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
                          width: 20,
                          height: 20,
                          borderRadius: '4px',
                          bgcolor: FUNNEL_COLORS[idx % FUNNEL_COLORS.length],
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.6rem',
                          fontWeight: 800,
                        }}
                      >
                        {idx + 1}
                      </Box>
                      {(() => {
                        const meta = eventMetaMap.get(s.name);
                        return (
                          <EventLabel
                            eventName={s.name}
                            displayName={meta?.display_name}
                            icon={meta?.icon}
                            iconColor={meta?.icon_color}
                            isReserved={meta?.is_reserved}
                            size="compact"
                          />
                        );
                      })()}
                    </td>
                    <td
                      style={{
                        padding: '10px 16px',
                        textAlign: 'right',
                        fontWeight: 600,
                      }}
                    >
                      {formatCompactNumber(s.count)}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                      >
                        <Box
                          sx={{
                            flex: 1,
                            height: 6,
                            borderRadius: 3,
                            bgcolor: isDark
                              ? 'rgba(255,255,255,0.06)'
                              : 'rgba(0,0,0,0.06)',
                            overflow: 'hidden',
                          }}
                        >
                          <Box
        sx={{
          minWidth: 0,
          height: '100%',
                              width: `${convBarWidth}%`,
                              bgcolor:
                                FUNNEL_COLORS[idx % FUNNEL_COLORS.length],
                              borderRadius: 3,
                              transition: 'width 0.4s ease',
                            }}
                          />
                        </Box>
                        <span
                          style={{
                            minWidth: 44,
                            textAlign: 'right',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {s.conversion_rate}%
                        </span>
                      </Box>
                    </td>
                    <td
                      style={{
                        padding: '10px 16px',
                        textAlign: 'right',
                        color: dropOff > 0 ? '#ef4444' : 'inherit',
                      }}
                    >
                      {idx > 0 ? (
                        <>
                          <span>-{formatCompactNumber(dropOff)}</span>
                          <span
                            style={{
                              opacity: 0.7,
                              marginLeft: 4,
                              fontSize: '0.75rem',
                            }}
                          >
                            ({dropPct}%)
                          </span>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td
                      style={{
                        padding: '10px 16px',
                        textAlign: 'right',
                        fontWeight: 500,
                      }}
                    >
                      {idx > 0 ? `${stepToStep}%` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Box>
        {renderBreakdownComparison()}
        {renderSegmentComparison()}
      </Box>
    );
  };

  // ── Render: Steps view ──
  const renderStepsView = () => {
    if (chartData.length === 0) return null;

    // Dispatch to breakdown visual chart when breakdown is configured
    const hasBreakdown =
      breakdownProperties.length > 0 &&
      result?.breakdowns &&
      Object.keys(result.breakdowns).length > 0;
    if (hasBreakdown) return renderBreakdownFunnelChart();

    const gridStroke = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    const maxCount = Math.max(...chartData.map((d: any) => d.count), 1);

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {/* Overall conversion */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 1.5,
            mb: 1,
            px: 1,
          }}
        >
          <Typography variant="h3" fontWeight={800} sx={{ color: '#6366f1' }}>
            {result?.overall_conversion ?? 0}%
          </Typography>
          <Typography
            variant="subtitle1"
            color="text.secondary"
            fontWeight={500}
          >
            {t('argus.analytics.overallConversion', 'Overall Conversion Rate')}
          </Typography>
        </Box>

        {/* ── Visual funnel with drop-off indicators ── */}
        {chartLayout === 'vertical' ? (
          /* ── VERTICAL layout: Mixpanel-style ── */
          <Box sx={{ display: 'flex', alignItems: 'stretch' }}>
            {/* Y-axis labels — absolutely positioned to align with gridlines */}
            <Box
              sx={{
                width: 40,
                flexShrink: 0,
                position: 'relative',
                height: 280,
                alignSelf: 'flex-end',
              }}
            >
              {[0, 25, 50, 75, 100].map((tick) => (
                <Typography
                  key={tick}
                  sx={{
                    position: 'absolute',
                    bottom: `${tick}%`,
                    right: 12,
                    fontSize: '0.6rem',
                    color: 'text.disabled',
                    lineHeight: 1,
                    transform: 'translateY(50%)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {tick}%
                </Typography>
              ))}
            </Box>

            {/* Chart area */}
            <Box sx={{ flex: 1, position: 'relative' }}>
              {/* Background Gridlines */}
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: 0,
                  right: 0,
                  pointerEvents: 'none',
                  zIndex: 0,
                }}
              >
                {[0, 25, 50, 75, 100].map((tick) => (
                  <Box
                    key={tick}
                    sx={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      bottom: `${tick}%`,
                      borderTop: `1px solid ${gridStroke}`,
                    }}
                  />
                ))}
              </Box>

              {/* Bars row */}
              <Box
                sx={{
                  display: 'flex',
                  height: 280,
                  alignItems: 'flex-end',
                  gap: '3px',
                  position: 'relative',
                  zIndex: 1,
                }}
              >
                {chartData.map((entry: any, idx: number) => {
                  const prevEntry = idx > 0 ? chartData[idx - 1] : null;
                  const prevCount = prevEntry ? prevEntry.count : entry.count;
                  const filledPct =
                    maxCount > 0 ? (entry.count / maxCount) * 100 : 0;
                  const ghostPct =
                    prevEntry && maxCount > 0
                      ? (prevCount / maxCount) * 100
                      : 0;
                  const dropCount = prevEntry
                    ? prevEntry.count - entry.count
                    : 0;
                  const dropPct =
                    prevEntry && prevEntry.count > 0
                      ? Math.round((dropCount / prevEntry.count) * 1000) / 10
                      : 0;

                  return (
                    <Box
                      key={idx}
                      sx={{
                        flex: 1,
                        height: '100%',
                        position: 'relative',
                        minWidth: 0,
                      }}
                    >
                      {/* Ghost portion — shows previous step's height */}
                      {idx > 0 && ghostPct > 0 && (
                        <Box
                          sx={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            height: `${ghostPct}%`,
                            bgcolor: 'background.paper',
                            borderRadius: '6px 6px 0 0',
                            transition: 'height 0.5s ease',
                            zIndex: 1,
                          }}
                        >
                          <Box
                            sx={{
                              position: 'absolute',
                              top: 0,
                              bottom: 0,
                              left: 0,
                              right: 0,
                              bgcolor: `${entry.fill}1c`,
                              borderRadius: 'inherit',
                            }}
                          />
                          {/* Drop-off label — centered in the drop-off zone */}
                          {dropCount > 0 &&
                            ghostPct - filledPct > 5 &&
                            (() => {
                              // Position label in the vertical center of the ghost zone above the filled bar
                              const dropZoneTopPct =
                                ((ghostPct - filledPct) / 2 / ghostPct) * 100;
                              return (
                                <Box
                                  sx={{
                                    position: 'absolute',
                                    top: `${dropZoneTopPct}%`,
                                    transform: 'translateY(-50%)',
                                    left: 0,
                                    right: 0,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    pointerEvents: 'none',
                                  }}
                                >
                                  <Typography
                                    sx={{
                                      fontSize: '0.6rem',
                                      color: '#ef4444',
                                      opacity: 0.8,
                                      fontWeight: 700,
                                      lineHeight: 1.2,
                                    }}
                                  >
                                    −{formatCompactNumber(dropCount)}
                                  </Typography>
                                  <Typography
                                    sx={{
                                      fontSize: '0.55rem',
                                      color: '#ef4444',
                                      opacity: 0.55,
                                      lineHeight: 1,
                                    }}
                                  >
                                    −{dropPct}%
                                  </Typography>
                                </Box>
                              );
                            })()}
                        </Box>
                      )}

                      {/* Drop-off boundary line — dashed line at the exact drop point */}
                      {idx > 0 && ghostPct > filledPct && filledPct > 1 && (
                        <Box
                          sx={{
                            position: 'absolute',
                            bottom: `${filledPct}%`,
                            left: 0,
                            right: 0,
                            borderTop: '1.5px dashed rgba(239,68,68,0.3)',
                            pointerEvents: 'none',
                            zIndex: 2,
                          }}
                        />
                      )}

                      {/* Filled bar — actual step count */}
                      <Tooltip
                        title={`${lexiconMap.get(entry.name) || entry.name}: ${formatCompactNumber(entry.count)} (${entry.rate}%)`}
                        placement="top"
                        arrow
                      >
                        <Box
                          onClick={() => handleBarClick(entry.name)}
                          sx={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            height:
                              entry.count > 0
                                ? `${Math.max(filledPct, 1)}%`
                                : 0,
                            minHeight: entry.count > 0 ? 4 : 0,
                            bgcolor: entry.fill,
                            borderRadius: '6px 6px 0 0',
                            cursor: 'pointer',
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            pt: filledPct > 8 ? 1 : 0,
                            transition:
                              'height 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.15s ease',
                            '&:hover': { filter: 'brightness(1.1)', zIndex: 3 },
                            zIndex: 2,
                          }}
                        >
                          {/* Labels INSIDE bar — only when bar is tall enough */}
                          {filledPct > 8 && (
                            <>
                              <Typography
                                sx={{
                                  color: 'rgba(255,255,255,0.95)',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  lineHeight: 1.3,
                                }}
                              >
                                {entry.rate}%
                              </Typography>
                              {filledPct > 18 && (
                                <Typography
                                  sx={{
                                    color: 'rgba(255,255,255,0.75)',
                                    fontSize: '0.65rem',
                                    lineHeight: 1.2,
                                  }}
                                >
                                  {formatCompactNumber(entry.count)}
                                </Typography>
                              )}
                            </>
                          )}
                        </Box>
                      </Tooltip>

                      {/* Labels ABOVE bar — when bar is too small to show labels inside */}
                      {filledPct <= 8 && entry.count > 0 && (
                        <Box
                          sx={{
                            position: 'absolute',
                            bottom: `${Math.max(filledPct, 1) + 1}%`,
                            left: 0,
                            right: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            pointerEvents: 'none',
                            zIndex: 3,
                          }}
                        >
                          <Typography
                            sx={{
                              fontSize: '0.65rem',
                              fontWeight: 700,
                              color: 'text.primary',
                              lineHeight: 1.2,
                            }}
                          >
                            {entry.rate}%
                          </Typography>
                          <Typography
                            sx={{
                              fontSize: '0.6rem',
                              color: 'text.secondary',
                              lineHeight: 1,
                            }}
                          >
                            {formatCompactNumber(entry.count)}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  );
                })}
              </Box>

              {/* Step names row */}
              <Box sx={{ display: 'flex', gap: '3px', mt: 1, height: 44 }}>
                {chartData.map((entry: any, idx: number) => (
                  <Tooltip
                    key={idx}
                    title={entry.name}
                    placement="bottom"
                    arrow
                  >
                    <Box
                      sx={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'flex-start',
                        gap: 0.25,
                        pt: 0.5,
                        minWidth: 0,
                      }}
                    >
                      <Box
                        sx={{
                          width: 18,
                          height: 18,
                          borderRadius: '4px',
                          bgcolor: entry.fill,
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.55rem',
                          fontWeight: 800,
                          flexShrink: 0,
                        }}
                      >
                        {idx + 1}
                      </Box>
                      <Typography
                        variant="caption"
                        sx={{
                          fontSize: '0.65rem',
                          fontWeight: 500,
                          maxWidth: '100%',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          color: 'text.secondary',
                          textAlign: 'center',
                          display: 'block',
                        }}
                      >
                        {lexiconMap.get(entry.name) || entry.name}
                      </Typography>
                    </Box>
                  </Tooltip>
                ))}
              </Box>
            </Box>
          </Box>
        ) : (
          /* ── HORIZONTAL layout: bars go left-to-right, steps top-to-bottom ── */
          <Box sx={{ px: 1, py: 1 }}>
            {chartData.map((entry: any, idx: number) => {
              const barWidth = (entry.count / maxCount) * 100;
              const prevCount =
                idx > 0 ? chartData[idx - 1].count : entry.count;
              const ghostWidth =
                idx > 0 && maxCount > 0 ? (prevCount / maxCount) * 100 : 0;
              const convRate =
                idx === 0
                  ? 100
                  : prevCount > 0
                    ? Math.round((entry.count / prevCount) * 1000) / 10
                    : 0;
              const dropCount = idx > 0 ? prevCount - entry.count : 0;
              const dropPct =
                idx > 0 && prevCount > 0
                  ? Math.round((dropCount / prevCount) * 1000) / 10
                  : 0;
              const convColor =
                convRate >= 70
                  ? '#10b981'
                  : convRate >= 30
                    ? '#f59e0b'
                    : '#ef4444';

              return (
                <React.Fragment key={idx}>
                  {/* Step-to-step connector — Mixpanel style: minimal row */}
                  {idx > 0 && (
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.75,
                        pl: '142px',
                        py: 0.25,
                        minHeight: 20,
                        opacity: 0.75,
                      }}
                    >
                      <ArrowDownIcon
                        sx={{ fontSize: 12, color: 'text.disabled' }}
                      />
                      <Typography
                        sx={{
                          fontWeight: 700,
                          fontSize: '0.75rem',
                          color: convColor,
                        }}
                      >
                        {convRate}%
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ color: 'text.disabled' }}
                      >
                        ·
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ fontSize: '0.65rem', color: '#ef4444' }}
                      >
                        −{formatCompactNumber(dropCount)} (−{dropPct}%)
                      </Typography>
                    </Box>
                  )}
                  {/* Bar row */}
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      px: 1,
                      py: 0.5,
                    }}
                  >
                    {/* Step badge + name */}
                    <Tooltip title={entry.name} placement="left" arrow>
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          minWidth: 130,
                          flexShrink: 0,
                        }}
                      >
                        <Box
                          sx={{
                            width: 22,
                            height: 22,
                            borderRadius: '5px',
                            bgcolor: entry.fill,
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.6rem',
                            fontWeight: 800,
                            flexShrink: 0,
                          }}
                        >
                          {idx + 1}
                        </Box>
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 500,
                            fontSize: '0.8rem',
                            maxWidth: 100,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {lexiconMap.get(entry.name) || entry.name}
                        </Typography>
                      </Box>
                    </Tooltip>
                    {/* Bar */}
                    <Box sx={{ flex: 1, position: 'relative', height: 38 }}>
                      {/* Ghost bar (previous step size) */}
                      {idx > 0 && ghostWidth > 0 && (
                        <Box
                          sx={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            bottom: 0,
                            width: `${ghostWidth}%`,
                            bgcolor: `${entry.fill}1c`,
                            borderRadius: 1.5,
                            transition: 'width 0.6s ease',
                          }}
                        />
                      )}
                      {/* Filled bar */}
                      <Box
                        onClick={() => handleBarClick(entry.name)}
                        sx={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          bottom: 0,
                          width: entry.count > 0 ? `${barWidth}%` : 0,
                          bgcolor: entry.fill,
                          borderRadius: 1.5,
                          transition: 'width 0.6s ease',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          pr: 1,
                          cursor: 'pointer',
                          '&:hover': { filter: 'brightness(1.15)' },
                        }}
                      >
                        {barWidth > 20 && (
                          <Box
                            sx={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'flex-end',
                            }}
                          >
                            <Typography
                              variant="caption"
                              sx={{
                                color: '#fff',
                                fontWeight: 700,
                                fontSize: '0.75rem',
                                lineHeight: 1.2,
                                textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                              }}
                            >
                              {entry.rate}%
                            </Typography>
                            {barWidth > 28 && (
                              <Typography
                                variant="caption"
                                sx={{
                                  color: 'rgba(255,255,255,0.75)',
                                  fontSize: '0.65rem',
                                  lineHeight: 1,
                                  textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                                }}
                              >
                                {formatCompactNumber(entry.count)}
                              </Typography>
                            )}
                          </Box>
                        )}
                      </Box>
                    </Box>
                    {/* Count + Rate */}
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        flexShrink: 0,
                      }}
                    >
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 700,
                          fontSize: '0.85rem',
                          minWidth: 50,
                          textAlign: 'right',
                        }}
                      >
                        {formatCompactNumber(entry.count)}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          fontWeight: 600,
                          fontSize: '0.7rem',
                          color:
                            entry.rate >= 70
                              ? '#10b981'
                              : entry.rate >= 30
                                ? '#f59e0b'
                                : '#ef4444',
                          minWidth: 35,
                          textAlign: 'right',
                        }}
                      >
                        {entry.rate}%
                      </Typography>
                    </Box>
                  </Box>
                </React.Fragment>
              );
            })}
          </Box>
        )}

        {/* Data table with drop-off */}
        <Box sx={{ overflowX: 'auto', borderTop: `1px solid ${gridStroke}` }}>
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
                  {t('argus.analytics.step', 'Step')}
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
                  {t('argus.analytics.users', 'Users')}
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
                  {t('argus.analytics.conversion', 'Conversion')}
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
                  {t('argus.analytics.dropOff', 'Drop-off')}
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
                  {t('argus.analytics.stepToStep', 'Step-to-Step')}
                </th>
              </tr>
            </thead>
            <tbody>
              {result?.steps.map((s: any, idx: number) => {
                const prevCount =
                  idx > 0 ? result.steps[idx - 1].count : s.count;
                const dropOff = idx > 0 ? prevCount - s.count : 0;
                const dropPct =
                  idx > 0 && prevCount > 0
                    ? Math.round((1 - s.count / prevCount) * 1000) / 10
                    : 0;
                const stepToStep =
                  idx === 0
                    ? 100
                    : prevCount > 0
                      ? Math.round((s.count / prevCount) * 1000) / 10
                      : 0;
                const convBarWidth =
                  maxCount > 0 ? (s.count / maxCount) * 100 : 0;
                return (
                  <tr
                    key={idx}
                    style={{
                      borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}`,
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor =
                        isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor =
                        'transparent';
                    }}
                    onClick={() => handleBarClick(s.name)}
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
                          width: 20,
                          height: 20,
                          borderRadius: '4px',
                          bgcolor: FUNNEL_COLORS[idx % FUNNEL_COLORS.length],
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.6rem',
                          fontWeight: 800,
                        }}
                      >
                        {idx + 1}
                      </Box>
                      <Tooltip title={s.name} placement="top" arrow>
                        <span>
                          {(() => {
                            const meta = eventMetaMap.get(s.name);
                            return (
                              <EventLabel
                                eventName={s.name}
                                displayName={meta?.display_name}
                                icon={meta?.icon}
                                iconColor={meta?.icon_color}
                                isReserved={meta?.is_reserved}
                                size="compact"
                              />
                            );
                          })()}
                        </span>
                      </Tooltip>
                    </td>
                    <td
                      style={{
                        padding: '10px 16px',
                        textAlign: 'right',
                        fontWeight: 600,
                      }}
                    >
                      {formatCompactNumber(s.count)}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          gap: 1,
                        }}
                      >
                        <Box
                          sx={{
                            width: 60,
                            height: 6,
                            borderRadius: 3,
                            bgcolor: isDark
                              ? 'rgba(255,255,255,0.06)'
                              : 'rgba(0,0,0,0.06)',
                            overflow: 'hidden',
                            flexShrink: 0,
                          }}
                        >
                          <Box
        sx={{
          minWidth: 0,
          height: '100%',
                              width: `${convBarWidth}%`,
                              bgcolor:
                                FUNNEL_COLORS[idx % FUNNEL_COLORS.length],
                              borderRadius: 3,
                              transition: 'width 0.4s ease',
                            }}
                          />
                        </Box>
                        <span style={{ minWidth: 36, textAlign: 'right' }}>
                          {s.conversion_rate}%
                        </span>
                      </Box>
                    </td>
                    <td
                      style={{
                        padding: '10px 16px',
                        textAlign: 'right',
                        color: dropOff > 0 ? '#ef4444' : 'inherit',
                      }}
                    >
                      {idx > 0 ? (
                        <>
                          -{formatCompactNumber(dropOff)}
                          <span
                            style={{
                              opacity: 0.7,
                              marginLeft: 4,
                              fontSize: '0.75rem',
                            }}
                          >
                            ({dropPct}%)
                          </span>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td
                      style={{
                        padding: '10px 16px',
                        textAlign: 'right',
                        fontWeight: 500,
                      }}
                    >
                      {idx > 0 ? `${stepToStep}%` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Box>
      </Box>
    );
  };

  // ── Render: Segment Comparison ──
  const renderSegmentComparison = () => {
    const segs = result?.segments;
    if (!segs || segs.length === 0) return null;

    // Build deduplicated segment keys to avoid chart key collisions
    const segKeys = segs.map((s, idx) => {
      let label = s.name || `Segment ${idx + 1}`;
      if (label === 'Overall') label = `${label} (${idx + 1})`;
      return label;
    });
    // Handle duplicate names by appending index
    const seen = new Set<string>();
    const uniqueKeys = segKeys.map((k, idx) => {
      if (seen.has(k)) return `${k} (${idx + 1})`;
      seen.add(k);
      return k;
    });

    // Build grouped bar data: one entry per step, with each segment as a bar
    const segChartData = result!.steps.map((step, idx) => {
      const point: Record<string, any> = {
        name: lexiconMap.get(step.name) || step.name,
      };
      point['Overall'] = step.conversion_rate;
      for (let sIdx = 0; sIdx < segs.length; sIdx++) {
        point[uniqueKeys[sIdx]] = segs[sIdx].steps[idx]?.conversion_rate ?? 0;
      }
      return point;
    });

    const allKeys = ['Overall', ...uniqueKeys];
    const allColors = ['#94a3b8', ...segs.map((s) => s.color)];

    return (
      <Box sx={{ mt: 4 }}>
        <Typography
          variant="subtitle2"
          fontWeight={700}
          sx={{ mb: 2, px: 1, color: 'text.secondary' }}
        >
          {t('argus.analytics.segmentComparison', 'Segment Comparison')}
        </Typography>
        <Box
        sx={{
          minWidth: 0,
          height: { xs: 320, md: '45vh' },
            minHeight: 320,
            maxHeight: 550,
            width: '100%',
            pr: 2,
            userSelect: 'none',
            '& .recharts-wrapper, & .recharts-surface, & svg, & svg *': {
              outline: 'none',
            },
          }}
        >
          <ResponsiveContainer
            width="99%"
            height="100%"
            minWidth={1}
            minHeight={1}
          >
            <BarChart
              data={segChartData}
              margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}
              />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
                tickLine={false}
                axisLine={false}
                tickMargin={16}
              />
              <YAxis
                tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
                tickLine={false}
                axisLine={false}
                width={40}
                unit="%"
              />
              <RechartsTooltip
                wrapperStyle={{ zIndex: 1000 }}
                contentStyle={{
                  background: isDark ? '#1e1e2e' : '#fff',
                  color: isDark ? '#e4e4e7' : '#1a1a2e',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                  borderRadius: 8,
                  fontSize: 12,
                }}
                itemStyle={{ color: isDark ? '#e4e4e7' : '#1a1a2e' }}
                labelStyle={{
                  color: isDark ? '#a1a1aa' : '#52525b',
                  fontWeight: 600,
                }}
              />
              <Legend
                onClick={handleLegendClick}
                formatter={renderLegendText}
                wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
              />
              {allKeys.map((key, idx) => (
                <Bar
                  key={key}
                  dataKey={key}
                  hide={hiddenSeriesKeys.has(key)}
                  fill={allColors[idx % allColors.length]}
                  radius={[4, 4, 0, 0]}
                  opacity={key === 'Overall' ? 0.4 : 1}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </Box>
      </Box>
    );
  };

  // ── Render: Breakdown Comparison ──
  const renderBreakdownComparison = () => {
    const breakdowns = result?.breakdowns;
    if (!breakdowns || Object.keys(breakdowns).length === 0) return null;

    const BD_COLORS = [
      '#6366f1',
      '#f59e0b',
      '#10b981',
      '#ef4444',
      '#8b5cf6',
      '#06b6d4',
      '#f97316',
      '#ec4899',
      '#14b8a6',
      '#84cc16',
    ];

    const stepNames = (result!.steps as any[]).map((s: any) => ({
      raw: s.name,
      display: lexiconMap.get(s.name) || s.name,
    }));

    // Build rows: Overall first, then breakdown values sorted by conversion desc
    const overallRow = {
      label: t('argus.analytics.overallConversion', 'Overall'),
      color: '#94a3b8',
      conversion: result!.overall_conversion ?? 0,
      steps: (result!.steps as any[]).map((s: any) => s.count),
      isOverall: true,
    };

    const bdRows = Object.keys(breakdowns)
      .map((bv, idx) => ({
        label: bv,
        parts: splitBreakdownValue(bv),
        color: BD_COLORS[idx % BD_COLORS.length],
        conversion: breakdowns[bv].overall_conversion ?? 0,
        steps: (breakdowns[bv].steps || []).map((s: any) => s.count ?? 0),
        isOverall: false,
      }))
      .sort((a, b) => b.conversion - a.conversion);

    const allRows = [overallRow, ...bdRows];
    const maxConversion = Math.max(...allRows.map((r) => r.conversion), 1);

    const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
    const hoverBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)';
    const thStyle: React.CSSProperties = {
      padding: '10px 12px',
      borderBottom: `1px solid ${borderColor}`,
      color: theme.palette.text.secondary,
      fontWeight: 600,
      fontSize: '0.75rem',
      whiteSpace: 'nowrap',
    };

    return (
      <Box sx={{ mt: 4 }}>
        <Typography
          variant="subtitle2"
          fontWeight={700}
          sx={{ mb: 1.5, px: 1, color: 'text.secondary' }}
        >
          {t('argus.analytics.breakdownComparison', 'Breakdown Comparison')}
          <Typography
            component="span"
            variant="caption"
            sx={{ ml: 1, opacity: 0.6 }}
          >
            ({breakdownProperties.join(' · ')})
          </Typography>
        </Typography>
        <Box
          sx={{
            overflowX: 'auto',
            border: `1px solid ${borderColor}`,
            borderRadius: 1,
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
                {breakdownProperties.length > 1 ? (
                  breakdownProperties.map((prop) => (
                    <th
                      key={prop}
                      style={{ ...thStyle, textAlign: 'left', minWidth: 100 }}
                    >
                      {prop}
                    </th>
                  ))
                ) : (
                  <th style={{ ...thStyle, textAlign: 'left', minWidth: 140 }}>
                    {t('argus.analytics.breakdownValue', 'Breakdown Value')}
                  </th>
                )}
                <th style={{ ...thStyle, textAlign: 'left', minWidth: 200 }}>
                  {t('argus.analytics.totalConversion', 'Overall Conversion')}
                </th>
                {stepNames.map((sn, i) => (
                  <th
                    key={i}
                    style={{ ...thStyle, textAlign: 'right', minWidth: 80 }}
                  >
                    <Tooltip title={sn.raw} placement="top" arrow>
                      <span>
                        {(() => {
                          const meta = eventMetaMap.get(sn.raw);
                          return (
                            <EventLabel
                              eventName={sn.raw}
                              displayName={meta?.display_name}
                              icon={meta?.icon}
                              iconColor={meta?.icon_color}
                              isReserved={meta?.is_reserved}
                              size="compact"
                            />
                          );
                        })()}
                      </span>
                    </Tooltip>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allRows.map((row, rowIdx) => (
                <tr
                  key={rowIdx}
                  style={{
                    borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
                    opacity: row.isOverall ? 0.7 : 1,
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor =
                      hoverBg;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor =
                      'transparent';
                  }}
                >
                  {/* Breakdown value columns */}
                  {breakdownProperties.length > 1 ? (
                    (row as any).parts ? (
                      (row as any).parts.map((part: string, pIdx: number) => (
                        <td
                          key={pIdx}
                          style={{
                            padding: '10px 12px',
                            fontWeight: row.isOverall ? 700 : 500,
                          }}
                        >
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                            }}
                          >
                            {pIdx === 0 && (
                              <Box
                                sx={{
                                  width: 10,
                                  height: 10,
                                  borderRadius: '50%',
                                  bgcolor: row.color,
                                  flexShrink: 0,
                                }}
                              />
                            )}
                            <span
                              style={{
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                maxWidth: 160,
                              }}
                            >
                              {part || '(empty)'}
                            </span>
                          </Box>
                        </td>
                      ))
                    ) : (
                      <td
                        style={{
                          padding: '10px 12px',
                          fontWeight: row.isOverall ? 700 : 500,
                        }}
                        colSpan={breakdownProperties.length}
                      >
                        <Box
                          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                        >
                          <Box
                            sx={{
                              width: 10,
                              height: 10,
                              borderRadius: '50%',
                              bgcolor: row.color,
                              flexShrink: 0,
                            }}
                          />
                          <span>{row.label}</span>
                        </Box>
                      </td>
                    )
                  ) : (
                    <td
                      style={{
                        padding: '10px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        fontWeight: row.isOverall ? 700 : 500,
                      }}
                    >
                      <Box
                        sx={{
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          bgcolor: row.color,
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: 160,
                        }}
                      >
                        {row.label}
                      </span>
                    </td>
                  )}

                  {/* Overall conversion with inline bar */}
                  <td style={{ padding: '10px 12px' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box
                        sx={{
                          flex: 1,
                          height: 16,
                          bgcolor: isDark
                            ? 'rgba(255,255,255,0.06)'
                            : 'rgba(0,0,0,0.04)',
                          borderRadius: 0.5,
                          overflow: 'hidden',
                          position: 'relative',
                        }}
                      >
                        <Box
                          sx={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            height: '100%',
                            width: `${(row.conversion / maxConversion) * 100}%`,
                            bgcolor: alpha(row.color, 0.6),
                            borderRadius: 0.5,
                            transition: 'width 0.3s ease',
                          }}
                        />
                      </Box>
                      <Typography
                        variant="caption"
                        sx={{
                          fontWeight: 700,
                          minWidth: 44,
                          textAlign: 'right',
                          fontSize: '0.78rem',
                        }}
                      >
                        {row.conversion}%
                      </Typography>
                    </Box>
                  </td>

                  {/* Per-step user counts */}
                  {row.steps.map((count: number, sIdx: number) => (
                    <td
                      key={sIdx}
                      style={{
                        padding: '10px 12px',
                        textAlign: 'right',
                        fontWeight: 500,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {formatCompactNumber(count)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Box>
      </Box>
    );
  };

  // ── Render: Trending view ──
  const renderTrendingView = () => {
    if (trendingData.length === 0) {
      if (queryLoading) return null;
      return (
        <EmptyPagePlaceholder
          message="Trending data will appear here. The backend needs to support mode=trending."
          minHeight={300}
        />
      );
    }

    return (
      <Box
        sx={{
          minWidth: 0,
          height: { xs: 360, md: '50vh' },
          minHeight: 360,
          maxHeight: 600,
          width: '100%',
          pr: 2,
          userSelect: 'none',
          '& .recharts-wrapper, & .recharts-surface, & svg, & svg *': {
            outline: 'none',
          },
        }}
      >
        <ResponsiveContainer
          width="99%"
          height="100%"
          minWidth={1}
          minHeight={1}
        >
          <LineChart
            data={trendingData}
            margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}
            />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
              tickLine={false}
              axisLine={false}
              tickMargin={16}
            />
            <YAxis
              tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
              tickLine={false}
              axisLine={false}
              width={40}
              unit="%"
            />
            <RechartsTooltip
              wrapperStyle={{ zIndex: 1000 }}
              contentStyle={{
                background: isDark ? '#1e1e2e' : '#fff',
                color: isDark ? '#e4e4e7' : '#1a1a2e',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                borderRadius: 8,
                fontSize: 12,
              }}
              itemStyle={{ color: isDark ? '#e4e4e7' : '#1a1a2e' }}
              labelStyle={{
                color: isDark ? '#a1a1aa' : '#52525b',
                fontWeight: 600,
              }}
            />
            <Line
              type="monotone"
              dataKey="conversion_rate"
              stroke="#6366f1"
              strokeWidth={2.5}
              dot={{ r: 3 }}
              activeDot={{ r: 6 }}
              name="Conversion %"
            />
          </LineChart>
        </ResponsiveContainer>
      </Box>
    );
  };

  // ── Render: Time to Convert view ──
  const renderTimeToConvertView = () => {
    const ttcData = result?.time_to_convert;
    if (!ttcData) {
      if (queryLoading) return null;
      return (
        <EmptyPagePlaceholder
          message="Time to Convert data will appear here. The backend needs to support mode=time_to_convert."
          minHeight={300}
        />
      );
    }

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Summary cards */}
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          {[
            {
              label: t('argus.analytics.median', 'Median'),
              value: formatDuration(ttcData.median_seconds),
            },
            {
              label: t('argus.analytics.average', 'Average'),
              value: formatDuration(ttcData.avg_seconds),
            },
            {
              label: t('argus.analytics.p25', 'P25'),
              value: formatDuration(ttcData.p25_seconds),
            },
            {
              label: t('argus.analytics.p75', 'P75'),
              value: formatDuration(ttcData.p75_seconds),
            },
          ].map((card) => (
            <Box
              key={card.label}
              sx={{
                flex: 1,
                minWidth: 120,
                p: 2,
                borderRadius: 2,
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                textAlign: 'center',
              }}
            >
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontWeight: 600 }}
              >
                {card.label}
              </Typography>
              <Typography
                variant="h5"
                fontWeight={700}
                sx={{ mt: 0.5, color: '#6366f1' }}
              >
                {card.value}
              </Typography>
            </Box>
          ))}
        </Box>

        {/* Distribution histogram */}
        <Box
        sx={{
          minWidth: 0,
          height: { xs: 280, md: '40vh' },
            minHeight: 280,
            maxHeight: 450,
            width: '100%',
            pr: 2,
            userSelect: 'none',
            '& .recharts-wrapper, & .recharts-surface, & svg, & svg *': {
              outline: 'none',
            },
          }}
        >
          <ResponsiveContainer
            width="99%"
            height="100%"
            minWidth={1}
            minHeight={1}
          >
            <BarChart
              data={ttcData.distribution}
              margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}
              />
              <XAxis
                dataKey="bucket"
                tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
                tickLine={false}
                axisLine={false}
                tickMargin={16}
              />
              <YAxis
                tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
                tickLine={false}
                axisLine={false}
                width={40}
              />
              <RechartsTooltip
                wrapperStyle={{ zIndex: 1000 }}
                cursor={{
                  fill: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                }}
                contentStyle={{
                  background: isDark ? '#1e1e2e' : '#fff',
                  color: isDark ? '#e4e4e7' : '#1a1a2e',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                  borderRadius: 8,
                  fontSize: 12,
                }}
                itemStyle={{ color: isDark ? '#e4e4e7' : '#1a1a2e' }}
                labelStyle={{
                  color: isDark ? '#a1a1aa' : '#52525b',
                  fontWeight: 600,
                }}
              />
              <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Box>
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
                { label: t('argus.analytics.funnels', 'Funnels') },
              ]}
              size="title"
            />
          }
        />
      )}
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
        <AnalyticsLayout
          leftPanel={leftPanel}
          tabBar={tabBar}
          toolbar={toolbar}
          projectId={projectId}
        >
          <PageContentLoader
            loading={
              queryLoading ||
              (steps.filter((s) => s.name).length >= 2 && !hasQueried)
            }
            skeleton={<ArgusChartSkeleton type="bar" height={300} />}
          >
            {!hasQueried ? (
              <EmptyPagePlaceholder
                message={t(
                  'argus.analytics.emptyFunnels',
                  'Define funnel steps and click Run to view conversion.'
                )}
                minHeight={300}
              />
            ) : chartData.length === 0 &&
              !result?.trending &&
              !result?.time_to_convert ? (
              <EmptyPagePlaceholder
                message={t(
                  'argus.analytics.noData',
                  'No funnel data for the selected period.'
                )}
                minHeight={300}
              />
            ) : (
              <Box
                sx={{
                  flexGrow: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                }}
              >
                {viewMode === 'steps' &&
                  chartSubType === 'funnel' &&
                  renderStepsView()}
                {/* renderSegmentComparison only when no breakdown active (breakdown handled inside renderStepsView → renderBreakdownFunnelChart) */}
                {viewMode === 'steps' &&
                  chartSubType === 'funnel' &&
                  !result?.breakdowns &&
                  renderSegmentComparison()}
                {/* renderBreakdownComparison is called from inside renderBreakdownFunnelChart; no top-level call needed */}
                {viewMode === 'steps' &&
                  chartSubType === 'metric' &&
                  renderMetricOnlyView()}
                {viewMode === 'trending' && renderTrendingView()}
                {viewMode === 'time_to_convert' && renderTimeToConvertView()}
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
            <ListItemIcon sx={{ minWidth: 28 }}>
              <FilterListIcon sx={{ fontSize: 16 }} />
            </ListItemIcon>
            {t('argus.analytics.addFilter', 'Add Filter')}
          </MenuItem>
          <MenuItem
            onClick={() => {
              handleRemoveStep(menuAnchor.idx);
              handleCloseMenu();
            }}
            disabled={steps.length <= 2}
            sx={{
              fontSize: '0.8rem',
              py: 0.75,
              color: steps.length > 2 ? 'error.main' : 'text.disabled',
            }}
          >
            <ListItemIcon sx={{ minWidth: 28, color: 'inherit' }}>
              <DeleteOutlineIcon sx={{ fontSize: 16 }} />
            </ListItemIcon>
            {t('argus.analytics.removeStep', 'Delete Step')}
          </MenuItem>
        </Menu>
      )}
    </Box>
  );
};

/* ─── Helpers ─── */

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '—';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86400)}d`;
}

export default ArgusFunnelsPage;
