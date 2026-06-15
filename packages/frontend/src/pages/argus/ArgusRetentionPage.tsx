import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  useTheme,
  alpha,
  Divider,
  IconButton,
  CircularProgress,
  Collapse,
  Menu,
  MenuItem,
} from '@mui/material';
import {
  PlayArrow as RunIcon,
  Close as CloseIcon,
  DragIndicator as DragIcon,
  KeyboardArrowDown as ArrowDownIcon,
  MoreVert as MoreVertIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
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
} from 'recharts';
import PageHeader from '@/components/common/PageHeader';
import ArgusBreadcrumbs from '@/components/argus/ArgusBreadcrumbs';
import DateRangeSelector, {
  DateRangeValue,
  dateRangeToApiParams,
} from '@/components/common/DateRangeSelector';
import EmptyPagePlaceholder from '@/components/common/EmptyPagePlaceholder';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import argusService from '@/services/argusService';
import {
  useRetentionStore,
  type RetentionEventEntry,
  type EventCondition,
} from '@/hooks/useAnalyticsStore';
import { useGlobalAnalyticsFilter } from '@/hooks/useGlobalAnalyticsFilter';
import { useLocalStorage } from '@/hooks/useLocalStorage';

import AnalyticsLayout from './components/analytics/AnalyticsLayout';
import EventBlock from './components/analytics/EventBlock';
import InlineSelect from './components/analytics/InlineSelect';
import ChartTypeSelector, {
  ChartType,
} from './components/analytics/ChartTypeSelector';
import PropertyPicker from './components/analytics/PropertyPicker';
import PropertyValueInput from './components/analytics/PropertyValueInput';
import CsvExportButton from './components/analytics/CsvExportButton';
import { formatCompactNumber } from '@/utils/numberFormat';
import ArgusChartSkeleton from '@/components/argus/ArgusChartSkeleton';
import PageContentLoader from '@/components/common/PageContentLoader';
import { splitBreakdownValue } from './components/analytics/breakdownUtils';
import { ArgusAnalyticsDrilldownDrawer } from './components/analytics/ArgusAnalyticsDrilldownDrawer';

/* ─── Types ─── */

type RetentionViewMode = 'curve' | 'line' | 'bar' | 'table' | 'metric';
type RetentionEvent = RetentionEventEntry;

/* ─── Component ─── */

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

/* ─── Component ─── */

const ArgusRetentionPage: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';
  const { currentProject } = useOrgProject();
  const projectId = currentProject?.id || '1';

  const OPERATORS = [
    { value: 'is', label: t('argus.analytics.op.is', 'is') },
    { value: 'is_not', label: t('argus.analytics.op.isNot', 'is not') },
    { value: 'contains', label: t('argus.analytics.op.contains', 'contains') },
    { value: 'not_contains', label: t('argus.analytics.op.notContains', 'does not contain') },
    { value: 'gt', label: '>' },
    { value: 'lt', label: '<' },
    { value: 'set', label: t('argus.analytics.op.isSet', 'is set') },
    { value: 'not_set', label: t('argus.analytics.op.isNotSet', 'is not set') },
  ];

  // ── Persisted State (survives refresh) ──
  const dateRange = useRetentionStore((s) => s.dateRange);
  const setDateRange = useRetentionStore((s) => s.setDateRange);
  const cohortEvent = useRetentionStore((s) => s.cohortEvent);
  const setCohortEvent = useRetentionStore((s) => s.setCohortEvent);
  const returnEvent = useRetentionStore((s) => s.returnEvent);
  const setReturnEvent = useRetentionStore((s) => s.setReturnEvent);
  const retentionType = useRetentionStore((s) => s.retentionType);
  const setRetentionType = useRetentionStore((s) => s.setRetentionType);
  const criteria = useRetentionStore((s) => s.criteria);
  const setCriteria = useRetentionStore((s) => s.setCriteria);
  const measurement = useRetentionStore((s) => s.measurement);
  const setMeasurement = useRetentionStore((s) => s.setMeasurement);
  const measurementProperty = useRetentionStore((s) => s.measurementProperty);
  const setMeasurementProperty = useRetentionStore(
    (s) => s.setMeasurementProperty
  );
  const minFrequency = useRetentionStore((s) => s.minFrequency);
  const setMinFrequency = useRetentionStore((s) => s.setMinFrequency);
  const breakdownProperties = useRetentionStore((s) => s.breakdownProperties);
  const setBreakdownProperties = useRetentionStore((s) => s.setBreakdownProperties);
  const viewMode = useRetentionStore((s) => s.viewMode);
  const setViewMode = useRetentionStore((s) => s.setViewMode);
  const globalFilters = useGlobalAnalyticsFilter((s) => s.filters);

  // ── Transient State ──
  const [availableEvents, setAvailableEvents] = useState<string[]>([]);
  const [cohorts, setCohorts] = useState<any[]>([]);
  const [breakdownCohorts, setBreakdownCohorts] = useState<Record<string, any[]> | undefined>(undefined);
  const [queryLoading, setQueryLoading] = useState(false);
  const [hasQueried, setHasQueried] = useState(false);
  const [settingsExpanded, setSettingsExpanded] = useLocalStorage<boolean>(
    'argus_retention_settings_expanded',
    false
  );
  const [menuAnchor, setMenuAnchor] = useState<{ el: HTMLElement; target: 'cohort' | 'return' } | null>(null);

  const handleOpenMenu = useCallback((e: React.MouseEvent<HTMLElement>, target: 'cohort' | 'return') => {
    setMenuAnchor({ el: e.currentTarget, target });
  }, []);

  const handleCloseMenu = useCallback(() => {
    setMenuAnchor(null);
  }, []);
  const [hiddenSeriesKeys, setHiddenSeriesKeys] = useState<Set<string>>(new Set());
  const isInitialMount = useRef(true);
  const lastExecutedKeyRef = useRef<string>('');

  // Drilldown state
  const [drilldownOpen, setDrilldownOpen] = useState(false);
  const [drilldownParams, setDrilldownParams] = useState<{
    eventName: string;
    dateRange: { start: Date; end: Date };
    breakdownProperty?: string;
    breakdownValue?: string;
  } | null>(null);

  // Reset hidden keys when cohorts change
  useEffect(() => {
    setHiddenSeriesKeys(new Set());
  }, [cohorts]);

  // ── Fetch event names ──
  useEffect(() => {
    (async () => {
      try {
        const data = await argusService.getAnalyticsEventNames(
          projectId,
          '30d'
        );
        setAvailableEvents(data.map((e) => e.name));
      } catch {
        setAvailableEvents([]);
      }
    })();
  }, [projectId]);

  // ── Condition handlers ──
  const handleAddCondition = useCallback(
    (target: 'cohort' | 'return') => {
      const event = target === 'cohort' ? cohortEvent : returnEvent;
      const setter = target === 'cohort' ? setCohortEvent : setReturnEvent;
      setter({
        ...event,
        conditions: [
          ...(event.conditions || []),
          { property: '', operator: 'is', value: '' },
        ],
      });
    },
    [cohortEvent, returnEvent, setCohortEvent, setReturnEvent]
  );

  const handleConditionChange = useCallback(
    (
      target: 'cohort' | 'return',
      condIndex: number,
      field: keyof EventCondition,
      value: string
    ) => {
      const event = target === 'cohort' ? cohortEvent : returnEvent;
      const setter = target === 'cohort' ? setCohortEvent : setReturnEvent;
      setter({
        ...event,
        conditions: event.conditions?.map((c, i) =>
          i === condIndex ? { ...c, [field]: value } : c
        ),
      });
    },
    [cohortEvent, returnEvent, setCohortEvent, setReturnEvent]
  );

  const handleRemoveCondition = useCallback(
    (target: 'cohort' | 'return', condIndex: number) => {
      const event = target === 'cohort' ? cohortEvent : returnEvent;
      const setter = target === 'cohort' ? setCohortEvent : setReturnEvent;
      setter({
        ...event,
        conditions: event.conditions?.filter((_, i) => i !== condIndex),
      });
    },
    [cohortEvent, returnEvent, setCohortEvent, setReturnEvent]
  );

  // ── Run Query ──
  const handleRun = useCallback(async () => {
    if (!cohortEvent.name || !returnEvent.name) return;

    const queryKey = JSON.stringify({
      projectId,
      cohortEvent,
      returnEvent,
      retentionType,
      criteria,
      measurement,
      measurementProperty,
      breakdownProperties,
      minFrequency,
      globalFilters,
    });
    lastExecutedKeyRef.current = queryKey;

    setQueryLoading(true);
    setHasQueried(true);
    try {
      const apiParams = dateRangeToApiParams(dateRange);
      const data = await argusService.getAnalyticsRetention(projectId, {
        first_event: {
          name: cohortEvent.name,
          conditions: cohortEvent.conditions?.filter((c) => c.property),
        },
        return_event: {
          name: returnEvent.name,
          conditions: returnEvent.conditions?.filter((c) => c.property),
        },
        retention_type: retentionType,
        criteria,
        measurement,
        measurement_property: ['property_sum', 'property_avg'].includes(
          measurement
        )
          ? measurementProperty
          : undefined,
        breakdown: breakdownProperties.length > 0
          ? { properties: breakdownProperties }
          : undefined,
        min_frequency: minFrequency > 1 ? minFrequency : undefined,
        global_filters: globalFilters.length > 0 ? globalFilters : undefined,
        period: apiParams.period,
        start: apiParams.start,
        end: apiParams.end,
      });
      setCohorts(data.cohorts || []);
      setBreakdownCohorts(data.breakdowns);
    } catch {
      setCohorts([]);
      setBreakdownCohorts(undefined);
    } finally {
      setQueryLoading(false);
    }
  }, [
    cohortEvent,
    returnEvent,
    dateRange,
    projectId,
    retentionType,
    criteria,
    measurement,
    measurementProperty,
    breakdownProperties,
    minFrequency,
    globalFilters,
  ]);

  // Debounced auto-query running on settings change
  useEffect(() => {
    if (!cohortEvent.name || !returnEvent.name) {
      isInitialMount.current = false;
      return;
    }

    const queryKey = JSON.stringify({
      projectId,
      cohortEvent,
      returnEvent,
      retentionType,
      criteria,
      measurement,
      measurementProperty,
      breakdownProperties,
      minFrequency,
      globalFilters,
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
    cohortEvent,
    returnEvent,
    dateRange,
    retentionType,
    criteria,
    measurement,
    measurementProperty,
    breakdownProperties,
    minFrequency,
    globalFilters,
    projectId,
    handleRun
  ]);

  const handleCellClick = useCallback((cohortDateStr: string, periodIndex: number) => {
    if (!returnEvent.name) return;

    const baseDate = new Date(cohortDateStr);
    const targetDate = new Date(baseDate);
    
    if (retentionType === 'day') {
      targetDate.setDate(targetDate.getDate() + periodIndex);
    } else if (retentionType === 'week') {
      targetDate.setDate(targetDate.getDate() + periodIndex * 7);
    } else {
      targetDate.setMonth(targetDate.getMonth() + periodIndex);
    }

    const start = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0);
    const end = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59);

    setDrilldownParams({
      eventName: periodIndex === 0 ? cohortEvent.name : returnEvent.name,
      dateRange: { start, end },
    });
    setDrilldownOpen(true);
  }, [cohortEvent.name, returnEvent.name, retentionType]);

  const handleBreakdownCellClick = useCallback((breakdownValue: string, periodIndex: number) => {
    if (!returnEvent.name) return;

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

    const startShifted = new Date(start);
    const endShifted = new Date(end);
    if (retentionType === 'day') {
      startShifted.setDate(startShifted.getDate() + periodIndex);
      endShifted.setDate(endShifted.getDate() + periodIndex);
    } else if (retentionType === 'week') {
      startShifted.setDate(startShifted.getDate() + periodIndex * 7);
      endShifted.setDate(endShifted.getDate() + periodIndex * 7);
    } else {
      startShifted.setMonth(startShifted.getMonth() + periodIndex);
      endShifted.setMonth(endShifted.getMonth() + periodIndex);
    }

    setDrilldownParams({
      eventName: periodIndex === 0 ? cohortEvent.name : returnEvent.name,
      dateRange: { start: startShifted, end: endShifted },
      breakdownProperty: breakdownProperties[0],
      breakdownValue: breakdownValue,
    });
    setDrilldownOpen(true);
  }, [cohortEvent.name, returnEvent.name, retentionType, dateRange, breakdownProperties]);

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

  const renderLegendText = useCallback((value: string, entry: any) => {
    const isHidden = hiddenSeriesKeys.has(entry.dataKey || value);
    return (
      <span style={{
        color: isHidden ? theme.palette.text.disabled : 'inherit',
        textDecoration: isHidden ? 'line-through' : 'none',
        cursor: 'pointer',
      }}>
        {value}
      </span>
    );
  }, [hiddenSeriesKeys, theme]);

  const eventOptions = useMemo(
    () => availableEvents.map((name) => ({ value: name, label: name })),
    [availableEvents]
  );

  // ── Curve data ──
  const curveData = useMemo(() => {
    if (cohorts.length === 0) return [];
    const maxPeriods = Math.max(
      ...cohorts.map((c) => c.retention?.length || 0)
    );
    const avgRetention: number[] = Array(maxPeriods).fill(0);
    const counts: number[] = Array(maxPeriods).fill(0);

    cohorts.forEach((c) => {
      c.retention?.forEach((pct: number, i: number) => {
        if (pct > 0) {
          avgRetention[i] += pct;
          counts[i]++;
        }
      });
    });

    return Array.from({ length: maxPeriods }, (_, i) => ({
      period: `${retentionType === 'day' ? 'Day' : retentionType === 'week' ? 'Wk' : 'Mo'} ${i}`,
      average:
        counts[i] > 0 ? Math.round((avgRetention[i] / counts[i]) * 10) / 10 : 0,
      ...Object.fromEntries(
        cohorts.map((c, cIdx) => [
          String(c.cohort_date).substring(0, 10),
          c.retention?.[i] ?? 0,
        ])
      ),
    }));
  }, [cohorts, retentionType]);

  // ── Breakdown curve data (one line per breakdown value, averaged) ──
  const breakdownCurveData = useMemo(() => {
    if (!breakdownCohorts || Object.keys(breakdownCohorts).length === 0) return null;

    // Find max periods across all breakdown values
    let maxPeriods = 0;
    for (const bvCohorts of Object.values(breakdownCohorts)) {
      for (const c of bvCohorts) {
        maxPeriods = Math.max(maxPeriods, c.retention?.length || 0);
      }
    }
    if (maxPeriods === 0) return null;

    let breakdownKeys = Object.keys(breakdownCohorts);

    // Limit to top N breakdown values by total cohort size
    const BREAKDOWN_LIMIT = 10;
    if (breakdownKeys.length > BREAKDOWN_LIMIT) {
      breakdownKeys.sort((a, b) => {
        const sumA = breakdownCohorts[a].reduce((s: number, c: any) => s + (c.cohort_size || 0), 0);
        const sumB = breakdownCohorts[b].reduce((s: number, c: any) => s + (c.cohort_size || 0), 0);
        return sumB - sumA;
      });
      breakdownKeys = breakdownKeys.slice(0, BREAKDOWN_LIMIT);
    }

    return Array.from({ length: maxPeriods }, (_, i) => {
      const point: Record<string, any> = {
        period: `${retentionType === 'day' ? 'Day' : retentionType === 'week' ? 'Wk' : 'Mo'} ${i}`,
      };
      for (const bv of breakdownKeys) {
        const bvArr = breakdownCohorts[bv];
        let sum = 0, count = 0;
        for (const c of bvArr) {
          const val = c.retention?.[i] ?? 0;
          if (val > 0) { sum += val; count++; }
        }
        point[bv] = count > 0 ? Math.round((sum / count) * 10) / 10 : 0;
      }
      return point;
    });
  }, [breakdownCohorts, retentionType]);

  // ── CSV data ──
  const csvData = useMemo(() => {
    return cohorts.map((c) => ({
      cohort_date: String(c.cohort_date).substring(0, 10),
      cohort_size: c.cohort_size,
      ...Object.fromEntries(
        (c.retention || []).map((pct: number, i: number) => [
          `${retentionType === 'day' ? 'Day' : retentionType === 'week' ? 'Wk' : 'Mo'} ${i}`,
          `${pct}%`,
        ])
      ),
    }));
  }, [cohorts, retentionType]);

  // ── Render condition block ──
  const renderConditions = (
    target: 'cohort' | 'return',
    event: RetentionEvent
  ) => {
    if (!event.conditions || event.conditions.length === 0) return null;
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {event.conditions.map((cond, cIdx) => (
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
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
              {t('argus.analytics.where', 'where')}
            </Typography>
            <PropertyPicker
              projectId={projectId}
              eventName={event.name}
              value={cond.property ? [cond.property] : []}
              onChange={(val) =>
                handleConditionChange(target, cIdx, 'property', val[0] || '')
              }
              emptyLabel={t('argus.analytics.property', 'Property')}
              highlightEmpty
              maxItems={1}
              variant="text"
            />
            <InlineSelect
              value={cond.operator}
              onChange={(val) =>
                handleConditionChange(target, cIdx, 'operator', val)
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
                    handleConditionChange(target, cIdx, 'value', val)
                  }
                />
              </Box>
            )}
            <IconButton
              size="small"
              onClick={() => handleRemoveCondition(target, cIdx)}
              sx={{ p: 0.25, ml: 0.5, opacity: 0.6, '&:hover': { opacity: 1 } }}
            >
              <CloseIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Box>
        ))}
        <Button
          size="small"
          onClick={() => handleAddCondition(target)}
          sx={{
            alignSelf: 'flex-start',
            textTransform: 'none',
            opacity: 0.7,
            pl: 0.5,
            py: 0,
            minWidth: 0,
            fontSize: '0.75rem',
          }}
        >
          {t('argus.analytics.filter', '+ Filter')}
        </Button>
      </Box>
    );
  };

  // ── UI: Left Panel ──
  const leftPanel = (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Events */}
      <Box>
        <Typography
          variant="overline"
          sx={{ fontWeight: 700, color: 'text.secondary', ml: 0.5 }}
        >
          {t('argus.analytics.cohortDefinition', 'Retention Behavior')}
        </Typography>
        <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {/* Cohort Event */}
          <EventBlock indexLabel="A" color="#6366f1">
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ minWidth: 48 }}
                >
                  {t('argus.analytics.first', 'First')}
                </Typography>
                <InlineSelect
                  value={cohortEvent.name}
                  onChange={(val) =>
                    setCohortEvent({ ...cohortEvent, name: val })
                  }
                  options={eventOptions}
                  emptyLabel={t('argus.analytics.selectEvent', 'Select Event')}
                  highlightEmpty
                />
              </Box>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenMenu(e, 'cohort');
                }}
                sx={{ opacity: 0.6, '&:hover': { opacity: 1 }, p: 0.25 }}
              >
                <MoreVertIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Box>
            {renderConditions('cohort', cohortEvent)}
          </EventBlock>

          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              my: -1, // Negate parent flex gap to pull the connection box flush with event blocks
            }}
          >
            {/* Dotted line top */}
            <Box
              sx={{
                width: 0,
                height: 14,
                borderLeft: `2px dashed ${isDark ? 'rgba(99,102,241,0.4)' : 'rgba(99,102,241,0.3)'}`,
              }}
            />
            {/* Arrow circle */}
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
            {/* Dotted line bottom */}
            <Box
              sx={{
                width: 0,
                height: 14,
                borderLeft: `2px dashed ${isDark ? 'rgba(99,102,241,0.4)' : 'rgba(99,102,241,0.3)'}`,
              }}
            />
          </Box>

          {/* Return Event */}
          <EventBlock indexLabel="B" color="#10b981">
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ minWidth: 48 }}
                >
                  {t('argus.analytics.return', 'Return')}
                </Typography>
                <InlineSelect
                  value={returnEvent.name}
                  onChange={(val) =>
                    setReturnEvent({ ...returnEvent, name: val })
                  }
                  options={eventOptions}
                  emptyLabel={t('argus.analytics.selectEvent', 'Select Event')}
                  highlightEmpty
                />
              </Box>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenMenu(e, 'return');
                }}
                sx={{ opacity: 0.6, '&:hover': { opacity: 1 }, p: 0.25 }}
              >
                <MoreVertIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Box>
            {renderConditions('return', returnEvent)}
          </EventBlock>
        </Box>
      </Box>

      <Divider sx={{ opacity: isDark ? 0.05 : 0.5 }} />

      {/* Settings */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Box
          onClick={() => setSettingsExpanded(!settingsExpanded)}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            userSelect: 'none',
            '&:hover': { opacity: 0.8 },
            ml: 0.5,
          }}
        >
          <Typography
            variant="overline"
            sx={{ fontWeight: 700, color: 'text.secondary', mb: 0 }}
          >
            {t('argus.analytics.settings', 'Settings')}
          </Typography>
          <ArrowDownIcon
            sx={{
              fontSize: 16,
              color: 'text.secondary',
              transition: 'transform 0.2s',
              transform: settingsExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          />
        </Box>

        <Collapse in={settingsExpanded} timeout={200}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 0.5, pl: 1.5 }}>

        {/* Retention Type */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            flexWrap: 'nowrap',
          }}
        >
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ minWidth: 50, flexShrink: 0, fontSize: '0.7rem' }}
          >
            {t('argus.analytics.retentionType', 'Period')}
          </Typography>
          <InlineSelect
            value={retentionType}
            onChange={(val) => setRetentionType(val as any)}
            options={[
              { value: 'day', label: t('argus.analytics.day', 'Day') },
              { value: 'week', label: t('argus.analytics.week', 'Week') },
              { value: 'month', label: t('argus.analytics.month', 'Month') },
            ]}
          />
        </Box>

        {/* Criteria */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            flexWrap: 'nowrap',
          }}
        >
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ minWidth: 50, flexShrink: 0, fontSize: '0.7rem' }}
          >
            {t('argus.analytics.criteria', 'Criteria')}
          </Typography>
          <InlineSelect
            value={criteria}
            onChange={(val) => setCriteria(val as any)}
            options={[
              {
                value: 'on',
                label: t('argus.analytics.criteriaOn', 'On (N-Day)'),
              },
              {
                value: 'on_or_after',
                label: t('argus.analytics.criteriaOnOrAfter', 'On or After'),
              },
            ]}
          />
        </Box>

        {/* Measurement */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            flexWrap: 'nowrap',
          }}
        >
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ minWidth: 50, flexShrink: 0, fontSize: '0.7rem' }}
          >
            {t('argus.analytics.measure', 'Measure')}
          </Typography>
          <InlineSelect
            value={measurement}
            onChange={(val) => setMeasurement(val as any)}
            options={[
              {
                value: 'retention_rate',
                label: t('argus.analytics.retentionRate', 'Retention Rate'),
              },
              {
                value: 'unique_users',
                label: t('argus.analytics.uniqueUsers', 'Unique Users'),
              },
              {
                value: 'property_sum',
                label: t('argus.analytics.propertySum', 'Property Sum'),
              },
              {
                value: 'property_avg',
                label: t('argus.analytics.propertyAvg', 'Property Avg'),
              },
            ]}
          />
        </Box>

        {/* Measurement property */}
        {['property_sum', 'property_avg'].includes(measurement) && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ minWidth: 70 }}
            >
              {t('argus.analytics.property', 'Property')}
            </Typography>
            <PropertyPicker
              projectId={projectId}
              eventName={returnEvent.name}
              value={measurementProperty ? [measurementProperty] : []}
              onChange={(val) => setMeasurementProperty(val[0] || '')}
              emptyLabel={t(
                'argus.analytics.selectProperty',
                'Select Property'
              )}
              highlightEmpty
              maxItems={1}
            />
          </Box>
        )}

        {/* Frequency */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ minWidth: 50, flexShrink: 0, fontSize: '0.7rem' }}
          >
            {t('argus.analytics.atLeast', 'At least')}
          </Typography>
          <input
            type="number"
            value={minFrequency}
            onChange={(e) =>
              setMinFrequency(Math.max(1, parseInt(e.target.value) || 1))
            }
            min={1}
            max={100}
            style={{
              background: 'transparent',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'}`,
              borderRadius: 4,
              color: 'inherit',
              outline: 'none',
              width: 50,
              fontSize: '0.8rem',
              fontFamily: 'inherit',
              padding: '2px 6px',
              textAlign: 'center',
            }}
          />
          <Typography variant="caption" color="text.secondary">
            {t('argus.analytics.times', 'times')}
          </Typography>
        </Box>
          </Box>
        </Collapse>
      </Box>

      <Divider sx={{ opacity: isDark ? 0.05 : 0.5 }} />

      {/* Breakdown */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {breakdownProperties.length > 0 ? (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="overline" sx={{ fontWeight: 700, color: 'text.secondary', ml: 0.5 }}>
                {t('argus.analytics.breakdownBy', 'Breakdown By')}
              </Typography>
              <IconButton
                size="small"
                onClick={() => setBreakdownProperties([])}
                sx={{ p: 0.25, opacity: 0.6, '&:hover': { opacity: 1 } }}
              >
                <CloseIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Box>
            <Box sx={{ pl: 1.5 }}>
              <Box sx={{ mt: 0.5, p: 1.5, borderRadius: 2, border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
                <PropertyPicker
                  projectId={projectId}
                  eventName={cohortEvent.name}
                  value={breakdownProperties}
                  onChange={setBreakdownProperties}
                  emptyLabel={t('argus.analytics.noBreakdown', 'None')}
                />
              </Box>
            </Box>
          </Box>
        ) : (
          <Box sx={{ pl: 1.5 }}>
            <PropertyPicker
              projectId={projectId}
              eventName={cohortEvent.name}
              value={breakdownProperties}
              onChange={setBreakdownProperties}
              emptyLabel={t('argus.analytics.addBreakdown', 'Breakdown')}
              variant="text"
            />
          </Box>
        )}
      </Box>

      <Box sx={{ mt: 'auto', pt: 2 }}>
        <Button
          fullWidth
          variant="contained"
          size="small"
          startIcon={queryLoading ? <CircularProgress size={16} color="inherit" /> : <RunIcon />}
          onClick={handleRun}
          disabled={queryLoading || !cohortEvent.name || !returnEvent.name}
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
        value={viewMode as ChartType}
        onChange={(val) => setViewMode(val as RetentionViewMode)}
        availableTypes={['line', 'bar', 'table', 'metric'] as ChartType[]}
      />
      <DateRangeSelector value={dateRange} onChange={setDateRange} compact />
      <CsvExportButton
        data={csvData}
        filename="retention"
        disabled={csvData.length === 0}
      />
    </>
  );

  // ── Render: Retention Curve ──
  const renderCurveView = () => {
    // Breakdown mode: one line per breakdown value
    if (breakdownCurveData && breakdownCurveData.length > 0 && breakdownCohorts) {
      const breakdownKeys = Object.keys(breakdownCohorts);
      return (
        <Box sx={{ height: { xs: 360, md: '50vh' }, minHeight: 360, maxHeight: 600, width: '100%', pr: 2 }}>
          <ResponsiveContainer
            width="100%"
            height="100%"
            minWidth={0}
            minHeight={0}
          >
            <LineChart
              data={breakdownCurveData}
              margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}
              />
              <XAxis
                dataKey="period"
                tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
                tickLine={false}
                axisLine={false}
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
                labelStyle={{ color: isDark ? '#a1a1aa' : '#52525b', fontWeight: 600 }}
              />
              <Legend onClick={handleLegendClick} formatter={renderLegendText} wrapperStyle={{ fontSize: 11 }} />
              {breakdownKeys.map((key, idx) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  hide={hiddenSeriesKeys.has(key)}
                  stroke={SERIES_COLORS[idx % SERIES_COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  name={key}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </Box>
      );
    }

    // Default: overall cohort curve
    if (curveData.length === 0) return null;
    const cohortKeys = cohorts.map((c) =>
      String(c.cohort_date).substring(0, 10)
    );

    return (
      <Box sx={{ height: { xs: 360, md: '50vh' }, minHeight: 360, maxHeight: 600, width: '100%', pr: 2 }}>
        <ResponsiveContainer
          width="100%"
          height="100%"
          minWidth={0}
          minHeight={0}
        >
          <LineChart
            data={curveData}
            margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}
            />
            <XAxis
              dataKey="period"
              tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
              tickLine={false}
              axisLine={false}
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
              labelStyle={{ color: isDark ? '#a1a1aa' : '#52525b', fontWeight: 600 }}
            />
            <Legend onClick={handleLegendClick} formatter={renderLegendText} wrapperStyle={{ fontSize: 11 }} />
            {/* Average line (bold) */}
            <Line
              type="monotone"
              dataKey="average"
              hide={hiddenSeriesKeys.has('average')}
              stroke="#6366f1"
              strokeWidth={3}
              dot={{ r: 3 }}
              name={t('argus.analytics.average', 'Average')}
            />
            {/* Individual cohorts (thin, transparent) */}
            {cohortKeys.slice(0, 10).map((key, idx) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                hide={hiddenSeriesKeys.has(key)}
                stroke={SERIES_COLORS[idx % SERIES_COLORS.length]}
                strokeWidth={1}
                strokeOpacity={0.4}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </Box>
    );
  };

  // ── Render: Bar Chart ──
  const renderBarView = () => {
    // Breakdown mode: grouped bars
    if (breakdownCurveData && breakdownCurveData.length > 0 && breakdownCohorts) {
      const breakdownKeys = Object.keys(breakdownCohorts).slice(0, 10);
      return (
        <Box sx={{ height: { xs: 360, md: '50vh' }, minHeight: 360, maxHeight: 600, width: '100%', pr: 2 }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <BarChart data={breakdownCurveData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'} />
              <XAxis dataKey="period" tick={{ fontSize: 11, fill: theme.palette.text.secondary }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: theme.palette.text.secondary }} tickLine={false} axisLine={false} width={40} unit="%" />
              <RechartsTooltip
                wrapperStyle={{ zIndex: 1000 }}
                contentStyle={{ background: isDark ? '#1e1e2e' : '#fff', color: isDark ? '#e4e4e7' : '#1a1a2e', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, borderRadius: 8, fontSize: 12 }}
                itemStyle={{ color: isDark ? '#e4e4e7' : '#1a1a2e' }}
                labelStyle={{ color: isDark ? '#a1a1aa' : '#52525b', fontWeight: 600 }}
              />
              <Legend onClick={handleLegendClick} formatter={renderLegendText} wrapperStyle={{ fontSize: 11 }} />
              {breakdownKeys.map((key, idx) => (
                <Bar key={key} dataKey={key} hide={hiddenSeriesKeys.has(key)} fill={SERIES_COLORS[idx % SERIES_COLORS.length]} radius={[4, 4, 0, 0]} name={key} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </Box>
      );
    }

    // Default: overall average bar
    if (curveData.length === 0) return null;
    return (
      <Box sx={{ height: { xs: 360, md: '50vh' }, minHeight: 360, maxHeight: 600, width: '100%', pr: 2 }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          <BarChart data={curveData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'} />
            <XAxis dataKey="period" tick={{ fontSize: 11, fill: theme.palette.text.secondary }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11, fill: theme.palette.text.secondary }} tickLine={false} axisLine={false} width={40} unit="%" />
            <RechartsTooltip
              wrapperStyle={{ zIndex: 1000 }}
              contentStyle={{ background: isDark ? '#1e1e2e' : '#fff', color: isDark ? '#e4e4e7' : '#1a1a2e', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, borderRadius: 8, fontSize: 12 }}
              itemStyle={{ color: isDark ? '#e4e4e7' : '#1a1a2e' }}
              labelStyle={{ color: isDark ? '#a1a1aa' : '#52525b', fontWeight: 600 }}
            />
            <Bar dataKey="average" fill="#6366f1" radius={[4, 4, 0, 0]} name={t('argus.analytics.average', 'Average')} />
          </BarChart>
        </ResponsiveContainer>
      </Box>
    );
  };

  // ── Render: Metric view ──
  const renderMetricView = () => {
    if (cohorts.length === 0) return null;
    const avgRetention =
      cohorts.reduce((sum, c) => sum + (c.retention?.[1] ?? 0), 0) /
      cohorts.length;

    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 300,
        }}
      >
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h2" fontWeight={800} sx={{ color: '#6366f1' }}>
            {Math.round(avgRetention * 10) / 10}%
          </Typography>
          <Typography variant="subtitle1" color="text.secondary" sx={{ mt: 1 }}>
            {t(
              'argus.analytics.avgRetentionLabel',
              'Average {{period}} Retention',
              {
                period:
                  retentionType === 'day'
                    ? t('argus.analytics.day1', 'Day 1')
                    : retentionType === 'week'
                      ? t('argus.analytics.week1', 'Week 1')
                      : t('argus.analytics.month1', 'Month 1'),
              }
            )}
          </Typography>
        </Box>
      </Box>
    );
  };

  // ── Render: Table (heatmap) ──
  const renderHeatmapTable = () => {
    if (cohorts.length === 0) return null;

    const hasBreakdown = breakdownCohorts && Object.keys(breakdownCohorts).length > 0;
    const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
    const periodPrefix = retentionType === 'day' ? 'D' : retentionType === 'week' ? 'W' : 'M';

    // Compute max periods from overall cohorts
    const maxPeriods = cohorts[0]?.retention?.length || 0;

    // ── Breakdown summary table (Mixpanel-style: all values at once) ──
    const renderBreakdownSummary = () => {
      if (!hasBreakdown || maxPeriods === 0) return null;

      const bdKeys = Object.keys(breakdownCohorts!);

      // Calculate weighted average retention per breakdown value
      const summaryRows = bdKeys.map((bv, idx) => {
        const bvCohorts = breakdownCohorts![bv];
        const totalSize = bvCohorts.reduce((s: number, c: any) => s + (c.cohort_size || 0), 0);

        const avgRetention: number[] = [];
        for (let p = 0; p < maxPeriods; p++) {
          let weightedSum = 0, totalWeight = 0;
          for (const c of bvCohorts) {
            const pct = c.retention?.[p] ?? 0;
            const size = c.cohort_size || 0;
            if (pct > 0 && size > 0) {
              weightedSum += pct * size;
              totalWeight += size;
            }
          }
          avgRetention.push(totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 10) / 10 : 0);
        }

        return {
          label: bv,
          parts: splitBreakdownValue(bv),
          color: SERIES_COLORS[idx % SERIES_COLORS.length],
          size: totalSize,
          retention: avgRetention,
        };
      });

      // Sort by D1 retention desc (or overall)
      summaryRows.sort((a, b) => (b.retention[1] ?? b.retention[0] ?? 0) - (a.retention[1] ?? a.retention[0] ?? 0));

      return (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1, px: 0.5, color: 'text.secondary', fontSize: '0.78rem' }}>
            {t('argus.analytics.breakdownComparison', 'Breakdown Comparison')}
            <Typography component="span" variant="caption" sx={{ ml: 1, opacity: 0.6 }}>
              ({breakdownProperties.join(' · ')})
            </Typography>
          </Typography>
          <Box sx={{ overflowX: 'auto', border: `1px solid ${borderColor}`, borderRadius: 1 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <thead>
                <tr>
                {breakdownProperties.length > 1 ? (
                  breakdownProperties.map((prop) => (
                    <th key={prop} style={{ textAlign: 'left', padding: '10px 12px', borderBottom: `1px solid ${borderColor}`, color: theme.palette.text.secondary, fontWeight: 600, position: 'sticky', left: 0, background: theme.palette.background.paper, zIndex: 2, minWidth: 90 }}>
                      {prop}
                    </th>
                  ))
                ) : (
                  <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: `1px solid ${borderColor}`, color: theme.palette.text.secondary, fontWeight: 600, position: 'sticky', left: 0, background: theme.palette.background.paper, zIndex: 2, minWidth: 120 }}>
                    {t('argus.analytics.breakdownValue', 'Segment')}
                  </th>
                )}
                  <th style={{ textAlign: 'right', padding: '10px 12px', borderBottom: `1px solid ${borderColor}`, color: theme.palette.text.secondary, fontWeight: 600, minWidth: 60 }}>
                    {t('argus.analytics.cohortSize', 'Size')}
                  </th>
                  {Array.from({ length: maxPeriods }, (_, i) => (
                    <th key={i} style={{ padding: '8px 6px', textAlign: 'center', borderBottom: `1px solid ${borderColor}`, color: theme.palette.text.secondary, fontWeight: 600, minWidth: 50 }}>
                      {`${periodPrefix}${i}`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summaryRows.map((row, rowIdx) => (
                  <tr
                    key={rowIdx}
                    style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}` }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                  >
                    {breakdownProperties.length > 1 ? (
                      row.parts.map((part: string, pIdx: number) => (
                        <td key={pIdx} style={{ padding: '8px 12px', fontWeight: 600, ...(pIdx === 0 ? { position: 'sticky' as const, left: 0, background: theme.palette.background.paper, zIndex: 1 } : {}) }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {pIdx === 0 && <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: row.color, flexShrink: 0 }} />}
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>
                              {part || '(empty)'}
                            </span>
                          </Box>
                        </td>
                      ))
                    ) : (
                      <td style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, position: 'sticky', left: 0, background: theme.palette.background.paper, zIndex: 1 }}>
                        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: row.color, flexShrink: 0 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>
                          {row.label}
                        </span>
                      </td>
                    )}
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                      {formatCompactNumber(row.size)}
                    </td>
                    {row.retention.map((pct, colIdx) => (
                      <td key={colIdx} style={{ padding: '6px 4px' }}>
                        <Box
                          onClick={() => pct > 0 && handleBreakdownCellClick(row.label, colIdx)}
                          sx={{
                            width: '100%', height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            borderRadius: 0.5,
                            background: pct > 0 ? alpha(row.color, Math.min(0.15 + (pct / 100) * 0.55, 0.7)) : 'transparent',
                            color: pct > 60 ? '#fff' : pct > 0 ? theme.palette.text.primary : theme.palette.text.disabled,
                            fontWeight: pct > 0 ? 600 : 400,
                            fontSize: '0.72rem',
                            cursor: pct > 0 ? 'pointer' : 'default',
                            '&:hover': pct > 0 ? {
                              filter: 'brightness(1.15)',
                              transform: 'scale(1.02)',
                            } : {},
                            transition: 'all 0.1s ease',
                          }}
                        >
                          {pct > 0 ? `${pct}%` : '—'}
                        </Box>
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

    return (
      <Box sx={{ mt: 2 }}>
        {/* Breakdown summary (all values at once) */}
        {renderBreakdownSummary()}

        {/* Cohort-level heatmap (always shown) */}
        <Box
          sx={{
            overflowX: 'auto',
            borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '12px 16px', borderBottom: `1px solid ${borderColor}`, color: theme.palette.text.secondary, fontWeight: 600, position: 'sticky', left: 0, background: theme.palette.background.paper, zIndex: 2 }}>
                  {t('argus.analytics.cohortDate', 'Cohort Date')}
                </th>
                <th style={{ textAlign: 'right', padding: '12px 16px', borderBottom: `1px solid ${borderColor}`, color: theme.palette.text.secondary, fontWeight: 600 }}>
                  {t('argus.analytics.cohortSize', 'Size')}
                </th>
                {cohorts[0]?.retention?.map((_: any, i: number) => (
                  <th key={i} style={{ padding: '8px 8px', textAlign: 'center', borderBottom: `1px solid ${borderColor}`, color: theme.palette.text.secondary, fontWeight: 600, minWidth: 42 }}>
                    {`${periodPrefix}${i}`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cohorts.map((cohort, rowIdx) => (
                <tr key={rowIdx}>
                  <td style={{ padding: '6px 12px', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}`, whiteSpace: 'nowrap', fontWeight: 500, position: 'sticky', left: 0, background: theme.palette.background.paper, zIndex: 1 }}>
                    {String(cohort.cohort_date).substring(0, 10)}
                  </td>
                  <td style={{ padding: '6px 12px', textAlign: 'right', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}`, fontWeight: 700 }}>
                    {formatCompactNumber(cohort.cohort_size)}
                  </td>
                  {cohort.retention?.map((pct: number, colIdx: number) => (
                    <td key={colIdx} style={{ padding: '6px 4px', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}` }}>
                      <Box
                        onClick={() => pct > 0 && handleCellClick(String(cohort.cohort_date), colIdx)}
                        sx={{
                          width: '100%', height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          borderRadius: 1,
                          background: pct > 0 ? alpha(getHeatColor(pct), isDark ? 0.6 : 0.85) : 'transparent',
                          color: pct > 50 ? '#fff' : pct > 0 ? theme.palette.text.primary : theme.palette.text.disabled,
                          fontWeight: pct > 0 ? 600 : 400,
                          cursor: pct > 0 ? 'pointer' : 'default',
                          '&:hover': pct > 0 ? {
                            filter: 'brightness(1.15)',
                            transform: 'scale(1.02)',
                          } : {},
                          transition: 'all 0.1s ease',
                        }}
                      >
                        {pct > 0 ? `${pct}%` : '—'}
                      </Box>
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

  // ── Main render ──
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 64px)',
        overflow: 'hidden',
        m: -2,
      }}
    >
      <PageHeader
        enableAutoBack
        title={
          <ArgusBreadcrumbs
            paths={[
              {
                label: t('argus.analytics.title', 'Analytics'),
                to: '/argus/analytics',
              },
              { label: t('argus.analytics.retention', 'Retention') },
            ]}
            size="title"
          />
        }
      />
      <Box
        sx={{
          display: 'flex',
          flex: 1,
          overflow: 'hidden',
          minHeight: 0,
        }}
      >
        <AnalyticsLayout leftPanel={leftPanel} toolbar={toolbar} projectId={projectId}>
          <PageContentLoader
            loading={queryLoading || (!!cohortEvent.name && !!returnEvent.name && !hasQueried)}
            skeleton={<ArgusChartSkeleton type="line" height={300} />}
          >
            {!hasQueried ? (
              <EmptyPagePlaceholder
                message={t(
                  'argus.analytics.emptyRetention',
                  'Define cohort events and click Run to see retention.'
                )}
                minHeight={300}
              />
            ) : cohorts.length === 0 ? (
              <EmptyPagePlaceholder
                message={t(
                  'argus.analytics.noData',
                  'No retention data for the selected period.'
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
                {viewMode === 'line' && renderCurveView()}
                {viewMode === 'bar' && renderBarView()}
                {viewMode === 'metric' && renderMetricView()}
                {viewMode === 'table' && renderHeatmapTable()}
                {/* Always show heatmap below curve/line/bar views */}
                {(viewMode === 'line' || viewMode === 'bar') &&
                  renderHeatmapTable()}
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
          breakdownProperty={drilldownParams.breakdownProperty}
          breakdownValue={drilldownParams.breakdownValue}
        />
      )}

      {menuAnchor && (
        <Menu
          anchorEl={menuAnchor.el}
          open={Boolean(menuAnchor)}
          onClose={handleCloseMenu}
          PaperProps={{
            sx: {
              maxHeight: 320,
              width: '24ch',
            }
          }}
        >
          <MenuItem
            onClick={() => {
              handleAddCondition(menuAnchor.target);
              handleCloseMenu();
            }}
            sx={{ fontSize: '0.8rem', py: 0.75 }}
          >
            {t('argus.analytics.addFilter', 'Add Filter')}
          </MenuItem>
        </Menu>
      )}
    </Box>
  );
};

/* ─── Helpers ─── */

function getHeatColor(pct: number): string {
  if (pct >= 80) return '#059669';
  if (pct >= 60) return '#10b981';
  if (pct >= 40) return '#34d399';
  if (pct >= 20) return '#6ee7b7';
  if (pct >= 10) return '#a7f3d0';
  return '#d1fae5';
}

export default ArgusRetentionPage;
