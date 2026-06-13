import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  useTheme,
  Skeleton,
  alpha,
  Divider,
  IconButton,
} from '@mui/material';
import {
  Add as AddIcon,
  PlayArrow as RunIcon,
  Close as CloseIcon,
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
import { useFormulaEngine } from '@/pages/argus/hooks/useFormulaEngine';
import {
  useInsightsStore,
  type InsightsEventEntry,
  type EventCondition,
} from '@/hooks/useAnalyticsStore';

import AnalyticsLayout from './components/analytics/AnalyticsLayout';
import EventBlock from './components/analytics/EventBlock';
import InlineSelect from './components/analytics/InlineSelect';
import ChartTypeSelector, {
  ChartType,
} from './components/analytics/ChartTypeSelector';
import PropertyPicker from './components/analytics/PropertyPicker';
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

const AGGREGATIONS = [
  { value: 'total', label: 'Total Count' },
  { value: 'unique', label: 'Unique Users' },
  { value: 'frequency', label: 'Frequency per User' },
  { value: 'avg', label: 'Average' },
  { value: 'median', label: 'Median' },
  { value: 'sum', label: 'Sum' },
  { value: 'p25', label: 'P25 (25th percentile)' },
  { value: 'p75', label: 'P75 (75th percentile)' },
  { value: 'p90', label: 'P90 (90th percentile)' },
];

const PROPERTY_AGGREGATIONS = new Set([
  'avg',
  'median',
  'sum',
  'p25',
  'p75',
  'p90',
]);

const OPERATORS = [
  { value: 'is', label: 'is' },
  { value: 'is_not', label: 'is not' },
  { value: 'contains', label: 'contains' },
  { value: 'not_contains', label: 'does not contain' },
  { value: 'gt', label: '>' },
  { value: 'lt', label: '<' },
  { value: 'gte', label: '≥' },
  { value: 'lte', label: '≤' },
  { value: 'set', label: 'is set' },
  { value: 'not_set', label: 'is not set' },
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

const COMPARE_DASH = '6 4';

/* ─── Component ─── */

const ArgusInsightsPage: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';
  const { currentProject } = useOrgProject();
  const projectId = currentProject?.id || '1';
  const breakdownLimit = useBreakdownLimit(projectId);

  // ── Persisted State (survives refresh) ──
  const dateRange = useInsightsStore((s) => s.dateRange);
  const setDateRange = useInsightsStore((s) => s.setDateRange);
  const events = useInsightsStore((s) => s.events);
  const setEvents = useInsightsStore((s) => s.setEvents);
  const breakdownProperty = useInsightsStore((s) => s.breakdownProperty);
  const setBreakdownProperty = useInsightsStore((s) => s.setBreakdownProperty);
  const chartType = useInsightsStore((s) => s.chartType);
  const setChartType = useInsightsStore((s) => s.setChartType);
  const comparePeriod = useInsightsStore((s) => s.comparePeriod);
  const setComparePeriod = useInsightsStore((s) => s.setComparePeriod);
  const formula = useInsightsStore((s) => s.formula);
  const setFormula = useInsightsStore((s) => s.setFormula);

  // ── Transient State (reset on refresh) ──
  const [availableEvents, setAvailableEvents] = useState<string[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);

  const [series, setSeries] = useState<any[]>([]);
  const [compareSeries, setCompareSeries] = useState<any[] | undefined>();
  const [queryLoading, setQueryLoading] = useState(false);
  const [hasQueried, setHasQueried] = useState(false);

  // ── Fetch event names ──
  const fetchEventNames = useCallback(async () => {
    setEventsLoading(true);
    try {
      const data = await argusService.getAnalyticsEventNames(projectId, '30d');
      setAvailableEvents(data.map((e) => e.name));
    } catch {
      setAvailableEvents([]);
    } finally {
      setEventsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchEventNames();
  }, [fetchEventNames]);

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
        breakdown: breakdownProperty
          ? { property: breakdownProperty }
          : undefined,
        period: apiParams.period,
        start: apiParams.start,
        end: apiParams.end,
        compare_period: comparePeriod || undefined,
      });
      setSeries(limitBreakdownSeries(result.series || [], breakdownLimit));
      setCompareSeries(result.compare_series);
    } catch {
      setSeries([]);
      setCompareSeries(undefined);
    } finally {
      setQueryLoading(false);
    }
  }, [events, dateRange, projectId, breakdownProperty, comparePeriod]);

  // ── Chart data ──
  const chartData = useMemo(() => {
    if (series.length === 0) return [];
    const timeMap = new Map<string, Record<string, number>>();
    series.forEach((s) => {
      const key = s.breakdown_value
        ? `${s.event}:${s.breakdown_value}`
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
    return Array.from(timeMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([bucket, values]) => ({ bucket: formatBucket(bucket), ...values }));
  }, [series, compareSeries]);

  const seriesKeys = useMemo(() => {
    const keys = new Set<string>();
    series.forEach((s) => {
      keys.add(s.breakdown_value ? `${s.event}:${s.breakdown_value}` : s.event);
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
    series.forEach((s, idx) => {
      if (!s.breakdown_value) {
        const label = String.fromCharCode(65 + idx);
        map[label] = s.data;
      }
    });
    return map;
  }, [series]);

  const formulaResult = useFormulaEngine(formula, formulaSeriesMap);

  // Add formula data to chartData
  const chartDataWithFormula = useMemo(() => {
    if (!formula || formulaResult.error || formulaResult.data.length === 0)
      return chartData;
    const formulaMap = new Map<string, number>();
    formulaResult.data.forEach((d) =>
      formulaMap.set(formatBucket(d.bucket), d.value)
    );
    return chartData.map((row) => ({
      ...row,
      Formula: formulaMap.get(row.bucket) ?? 0,
    }));
  }, [chartData, formula, formulaResult]);

  // Use formula expression as the display key
  const formulaDisplayKey = formula || 'Formula';

  const allSeriesKeys = useMemo(() => {
    const keys = [...seriesKeys, ...compareKeys];
    if (formula && !formulaResult.error && formulaResult.data.length > 0) {
      keys.push(formulaDisplayKey);
    }
    return keys;
  }, [seriesKeys, compareKeys, formula, formulaResult, formulaDisplayKey]);

  // ── CSV data ──
  const csvData = useMemo(() => chartDataWithFormula, [chartDataWithFormula]);

  // Options
  const eventOptions = useMemo(
    () => availableEvents.map((name) => ({ value: name, label: name })),
    [availableEvents]
  );

  // ── UI: Left Panel (Query Builder) ──
  const leftPanel = (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
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
                      onRemove={
                        events.length > 1
                          ? () => handleRemoveEvent(idx)
                          : undefined
                      }
                      dragHandleProps={dragHandleProps}
                      isDragging={isDragging}
                    >
                      {/* Event name */}
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: 0.5,
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
                        />
                      </Box>

                      {/* Measurement */}
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.5,
                          pl: 0.5,
                        }}
                      >
                        <Typography variant="caption" color="text.secondary">
                          {t('argus.analytics.show', 'show')}
                        </Typography>
                        <InlineSelect
                          value={ev.aggregation}
                          onChange={(val) =>
                            handleEventChange(idx, 'aggregation', val)
                          }
                          options={AGGREGATIONS}
                        />
                      </Box>

                      {/* Property selector for aggregate measurements */}
                      {PROPERTY_AGGREGATIONS.has(ev.aggregation) && (
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                            pl: 0.5,
                          }}
                        >
                          <Typography variant="caption" color="text.secondary">
                            of
                          </Typography>
                          <PropertyPicker
                            projectId={projectId}
                            eventName={ev.name}
                            value={ev.property || ''}
                            onChange={(val) =>
                              handleEventChange(idx, 'property', val)
                            }
                            emptyLabel="Select Property"
                            highlightEmpty
                          />
                        </Box>
                      )}

                      {/* Conditions */}
                      {ev.conditions?.map((cond, cIdx) => (
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
                          <Typography variant="caption" color="text.secondary">
                            {t('argus.analytics.where', 'where')}
                          </Typography>
                          <PropertyPicker
                            projectId={projectId}
                            eventName={ev.name}
                            value={cond.property}
                            onChange={(val) =>
                              handleConditionChange(idx, cIdx, 'property', val)
                            }
                            emptyLabel={t(
                              'argus.analytics.property',
                              'Property'
                            )}
                            highlightEmpty
                          />
                          <InlineSelect
                            value={cond.operator}
                            onChange={(val) =>
                              handleConditionChange(idx, cIdx, 'operator', val)
                            }
                            options={OPERATORS}
                          />
                          {!['set', 'not_set'].includes(cond.operator) && (
                            <input
                              value={cond.value}
                              onChange={(e) =>
                                handleConditionChange(
                                  idx,
                                  cIdx,
                                  'value',
                                  e.target.value
                                )
                              }
                              placeholder="value"
                              style={{
                                background: 'transparent',
                                border: 'none',
                                borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}`,
                                color: 'inherit',
                                outline: 'none',
                                width: 80,
                                fontSize: '0.8rem',
                                fontFamily: 'inherit',
                              }}
                            />
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
      <Box>
        <Typography
          variant="overline"
          sx={{ fontWeight: 700, color: 'text.secondary', ml: 0.5 }}
        >
          Formula
        </Typography>
        <Box sx={{ mt: 1 }}>
          <FormulaInput
            value={formula}
            onChange={setFormula}
            availableLabels={formulaLabels}
          />
        </Box>
      </Box>

      <Divider sx={{ opacity: isDark ? 0.05 : 0.5 }} />

      {/* Breakdown Section */}
      <Box>
        <Typography
          variant="overline"
          sx={{ fontWeight: 700, color: 'text.secondary', ml: 0.5 }}
        >
          {t('argus.analytics.breakdownBy', 'Breakdown By')}
        </Typography>
        <Box
          sx={{
            mt: 1,
            p: 1.5,
            borderRadius: 2,
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          }}
        >
          <PropertyPicker
            projectId={projectId}
            eventName={events[0]?.name}
            value={breakdownProperty}
            onChange={setBreakdownProperty}
            emptyLabel={t('argus.analytics.noBreakdown', 'None')}
          />
        </Box>
      </Box>

      <Box sx={{ mt: 'auto', pt: 2 }}>
        <Button
          fullWidth
          variant="contained"
          size="small"
          startIcon={<RunIcon />}
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
      <DateRangeSelector value={dateRange} onChange={setDateRange} compact />
      <CsvExportButton
        data={csvData}
        filename="insights"
        disabled={chartDataWithFormula.length === 0}
      />
      <Button
        variant="contained"
        size="small"
        startIcon={<RunIcon />}
        onClick={handleRunQuery}
        disabled={queryLoading || events.every((e) => !e.name)}
        sx={{ borderRadius: 1.5, textTransform: 'none', px: 2 }}
      >
        {t('argus.analytics.runQuery', 'Run Query')}
      </Button>
    </>
  );

  // ── UI: Render chart based on chartType ──
  const renderChart = () => {
    const data = chartDataWithFormula;
    if (data.length === 0) return null;

    const commonTooltipStyle = {
      background: isDark ? '#1e1e2e' : '#fff',
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
      borderRadius: 8,
      boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      fontSize: 12,
    };

    const gridStroke = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    const tickStyle = { fontSize: 11, fill: theme.palette.text.secondary };

    if (chartType === 'table') {
      return renderDataTable(data, allSeriesKeys);
    }

    return (
      <Box sx={{ height: 360, width: '100%', pr: 2 }}>
        <ResponsiveContainer
          width="100%"
          height="100%"
          minWidth={0}
          minHeight={0}
        >
          {chartType === 'line' ? (
            <LineChart
              data={data}
              margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke={gridStroke}
              />
              <XAxis
                dataKey="bucket"
                tick={tickStyle}
                tickLine={false}
                axisLine={false}
                tickMargin={10}
              />
              <YAxis
                tick={tickStyle}
                tickLine={false}
                axisLine={false}
                width={50}
              />
              <RechartsTooltip contentStyle={commonTooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 16 }} />
              {seriesKeys.map((key, idx) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={SERIES_COLORS[idx % SERIES_COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 0 }}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                />
              ))}
              {/* Compare series as dashed lines */}
              {compareKeys.map((key, idx) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={SERIES_COLORS[idx % SERIES_COLORS.length]}
                  strokeWidth={1.5}
                  strokeDasharray={COMPARE_DASH}
                  strokeOpacity={0.5}
                  dot={false}
                />
              ))}
              {/* Formula as special line */}
              {allSeriesKeys.includes(formulaDisplayKey) && (
                <Line
                  type="monotone"
                  dataKey={formulaDisplayKey}
                  name={formula}
                  stroke="#8b5cf6"
                  strokeWidth={2.5}
                  strokeDasharray="8 4"
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 0, fill: '#8b5cf6' }}
                />
              )}
            </LineChart>
          ) : (
            <BarChart
              data={data}
              margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke={gridStroke}
              />
              <XAxis
                dataKey="bucket"
                tick={tickStyle}
                tickLine={false}
                axisLine={false}
                tickMargin={10}
              />
              <YAxis
                tick={tickStyle}
                tickLine={false}
                axisLine={false}
                width={50}
              />
              <RechartsTooltip contentStyle={commonTooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 16 }} />
              {seriesKeys.map((key, idx) => (
                <Bar
                  key={key}
                  dataKey={key}
                  fill={SERIES_COLORS[idx % SERIES_COLORS.length]}
                  radius={[4, 4, 0, 0]}
                  stackId={chartType === 'stacked-bar' ? 'stack' : undefined}
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
                  {key}
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
                ? `${s.event} - ${s.breakdown_value}`
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
                ? `${s.event}:${s.breakdown_value}`
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
        height: 'calc(100vh - 64px)',
        overflow: 'hidden',
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
              { label: t('argus.analytics.insights', 'Insights') },
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
          px: 2,
          pb: 2,
        }}
      >
        <AnalyticsLayout leftPanel={leftPanel} toolbar={toolbar}>
          <PageContentLoader
            loading={queryLoading}
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
