import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  useTheme,
  alpha,
  Divider,
  IconButton,
} from '@mui/material';
import {
  PlayArrow as RunIcon,
  Close as CloseIcon,
  DragIndicator as DragIcon,
  KeyboardArrowDown as ArrowDownIcon,
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

import AnalyticsLayout from './components/analytics/AnalyticsLayout';
import EventBlock from './components/analytics/EventBlock';
import InlineSelect from './components/analytics/InlineSelect';
import ChartTypeSelector, {
  ChartType,
} from './components/analytics/ChartTypeSelector';
import PropertyPicker from './components/analytics/PropertyPicker';
import CsvExportButton from './components/analytics/CsvExportButton';
import { formatCompactNumber } from '@/utils/numberFormat';
import ArgusChartSkeleton from '@/components/argus/ArgusChartSkeleton';
import PageContentLoader from '@/components/common/PageContentLoader';

/* ─── Types ─── */

type RetentionViewMode = 'curve' | 'line' | 'bar' | 'table' | 'metric';
type RetentionEvent = RetentionEventEntry;

/* ─── Constants ─── */

const OPERATORS = [
  { value: 'is', label: 'is' },
  { value: 'is_not', label: 'is not' },
  { value: 'contains', label: 'contains' },
  { value: 'not_contains', label: 'does not contain' },
  { value: 'gt', label: '>' },
  { value: 'lt', label: '<' },
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

/* ─── Component ─── */

const ArgusRetentionPage: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';
  const { currentProject } = useOrgProject();
  const projectId = currentProject?.id || '1';

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
  const breakdownProperty = useRetentionStore((s) => s.breakdownProperty);
  const setBreakdownProperty = useRetentionStore((s) => s.setBreakdownProperty);
  const viewMode = useRetentionStore((s) => s.viewMode);
  const setViewMode = useRetentionStore((s) => s.setViewMode);

  // ── Transient State ──
  const [availableEvents, setAvailableEvents] = useState<string[]>([]);
  const [cohorts, setCohorts] = useState<any[]>([]);
  const [queryLoading, setQueryLoading] = useState(false);
  const [hasQueried, setHasQueried] = useState(false);

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
        breakdown: breakdownProperty
          ? { property: breakdownProperty }
          : undefined,
        min_frequency: minFrequency > 1 ? minFrequency : undefined,
        period: apiParams.period,
        start: apiParams.start,
        end: apiParams.end,
      });
      setCohorts(data.cohorts || []);
    } catch {
      setCohorts([]);
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
    breakdownProperty,
    minFrequency,
  ]);

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
    event: RetentionEvent,
    setEvent: React.Dispatch<React.SetStateAction<RetentionEvent>>
  ) => (
    <>
      {event.conditions?.map((cond, cIdx) => (
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
            eventName={event.name}
            value={cond.property}
            onChange={(val) =>
              handleConditionChange(target, cIdx, 'property', val)
            }
            emptyLabel={t('argus.analytics.property', 'Property')}
            highlightEmpty
          />
          <InlineSelect
            value={cond.operator}
            onChange={(val) =>
              handleConditionChange(target, cIdx, 'operator', val)
            }
            options={OPERATORS}
          />
          {!['set', 'not_set'].includes(cond.operator) && (
            <input
              value={cond.value}
              onChange={(e) =>
                handleConditionChange(target, cIdx, 'value', e.target.value)
              }
              placeholder={t('argus.analytics.valuePlaceholder', 'value')}
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
        {t('argus.analytics.addFilter', '+ Filter')}
      </Button>
    </>
  );

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
            {renderConditions('cohort', cohortEvent, setCohortEvent)}
          </EventBlock>

          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              my: 0.5,
              py: 0.25,
            }}
          >
            {/* Dotted line top */}
            <Box
              sx={{
                width: 0,
                height: 10,
                borderLeft: `2px dashed ${isDark ? 'rgba(99,102,241,0.3)' : 'rgba(99,102,241,0.25)'}`,
              }}
            />
            {/* Arrow circle */}
            <Box
              sx={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                border: `2px solid ${isDark ? 'rgba(99,102,241,0.4)' : 'rgba(99,102,241,0.3)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: isDark
                  ? 'rgba(99,102,241,0.08)'
                  : 'rgba(99,102,241,0.05)',
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
                height: 10,
                borderLeft: `2px dashed ${isDark ? 'rgba(99,102,241,0.3)' : 'rgba(99,102,241,0.25)'}`,
              }}
            />
          </Box>

          {/* Return Event */}
          <EventBlock indexLabel="B" color="#10b981">
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
            {renderConditions('return', returnEvent, setReturnEvent)}
          </EventBlock>
        </Box>
      </Box>

      <Divider sx={{ opacity: isDark ? 0.05 : 0.5 }} />

      {/* Settings */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Typography
          variant="overline"
          sx={{ fontWeight: 700, color: 'text.secondary', ml: 0.5 }}
        >
          {t('argus.analytics.settings', 'Settings')}
        </Typography>

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
              value={measurementProperty}
              onChange={setMeasurementProperty}
              emptyLabel={t(
                'argus.analytics.selectProperty',
                'Select Property'
              )}
              highlightEmpty
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

      <Divider sx={{ opacity: isDark ? 0.05 : 0.5 }} />

      {/* Breakdown */}
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
            eventName={cohortEvent.name}
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
    if (curveData.length === 0) return null;
    const cohortKeys = cohorts.map((c) =>
      String(c.cohort_date).substring(0, 10)
    );

    return (
      <Box sx={{ height: 360, width: '100%', pr: 2 }}>
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
              contentStyle={{
                background: isDark ? '#1e1e2e' : '#fff',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {/* Average line (bold) */}
            <Line
              type="monotone"
              dataKey="average"
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
    if (curveData.length === 0) return null;

    return (
      <Box sx={{ height: 360, width: '100%', pr: 2 }}>
        <ResponsiveContainer
          width="100%"
          height="100%"
          minWidth={0}
          minHeight={0}
        >
          <BarChart
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
              contentStyle={{
                background: isDark ? '#1e1e2e' : '#fff',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Bar
              dataKey="average"
              fill="#6366f1"
              radius={[4, 4, 0, 0]}
              name={t('argus.analytics.average', 'Average')}
            />
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

    return (
      <Box
        sx={{
          overflowX: 'auto',
          mt: 2,
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
                  borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                  color: theme.palette.text.secondary,
                  fontWeight: 600,
                  position: 'sticky',
                  left: 0,
                  background: theme.palette.background.paper,
                  zIndex: 2,
                }}
              >
                {t('argus.analytics.cohortDate', 'Cohort Date')}
              </th>
              <th
                style={{
                  textAlign: 'center',
                  padding: '12px 16px',
                  borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                  color: theme.palette.text.secondary,
                  fontWeight: 600,
                }}
              >
                {t('argus.analytics.cohortSize', 'Size')}
              </th>
              {cohorts[0]?.retention?.map((_: any, i: number) => (
                <th
                  key={i}
                  style={{
                    padding: '8px 8px',
                    textAlign: 'center',
                    borderBottom: `2px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                    color: theme.palette.text.secondary,
                    fontWeight: 600,
                    minWidth: 42,
                  }}
                >
                  {retentionType === 'day'
                    ? `D${i}`
                    : retentionType === 'week'
                      ? `W${i}`
                      : `M${i}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cohorts.map((cohort, rowIdx) => (
              <tr key={rowIdx}>
                <td
                  style={{
                    padding: '6px 12px',
                    borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}`,
                    whiteSpace: 'nowrap',
                    fontWeight: 500,
                    position: 'sticky',
                    left: 0,
                    background: theme.palette.background.paper,
                    zIndex: 1,
                  }}
                >
                  {String(cohort.cohort_date).substring(0, 10)}
                </td>
                <td
                  style={{
                    padding: '6px 12px',
                    textAlign: 'right',
                    borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}`,
                    fontWeight: 700,
                  }}
                >
                  {formatCompactNumber(cohort.cohort_size)}
                </td>
                {cohort.retention?.map((pct: number, colIdx: number) => (
                  <td
                    key={colIdx}
                    style={{
                      padding: '6px 4px',
                      borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}`,
                    }}
                  >
                    <Box
                      sx={{
                        width: '100%',
                        height: 28,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 1,
                        background:
                          pct > 0
                            ? alpha(getHeatColor(pct), isDark ? 0.6 : 0.85)
                            : 'transparent',
                        color:
                          pct > 50
                            ? '#fff'
                            : pct > 0
                              ? theme.palette.text.primary
                              : theme.palette.text.disabled,
                        fontWeight: pct > 0 ? 600 : 400,
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
          px: 2,
          pb: 2,
        }}
      >
        <AnalyticsLayout leftPanel={leftPanel} toolbar={toolbar}>
          <PageContentLoader
            loading={queryLoading}
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
