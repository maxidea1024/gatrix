/**
 * useAnalyticsStore — Zustand stores with persist for Analytics pages.
 *
 * Persists query configuration (events, date range, chart type, etc.)
 * to localStorage so that refreshing the page does not lose the query state.
 *
 * Each analytics page (Insights, Funnels, Retention, Flows) has its own
 * store slice with independent defaults and reset.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DateRangeValue } from '@/components/common/DateRangeSelector';
import type { ChartType } from '@/pages/argus/components/analytics/ChartTypeSelector';
import type { ComparePeriod } from '@/pages/argus/components/analytics/CompareSelector';

/* ═══════════════════════════════════════════════════════════════════════
   Shared Types
   ═══════════════════════════════════════════════════════════════════════ */

export interface EventCondition {
  property: string;
  operator: string;
  value: string;
}

/* ═══════════════════════════════════════════════════════════════════════
   Insights Store
   ═══════════════════════════════════════════════════════════════════════ */

export interface InsightsEventEntry {
  name: string;
  aggregation: string;
  property?: string;
  conditions?: EventCondition[];
}

interface InsightsState {
  dateRange: DateRangeValue;
  events: InsightsEventEntry[];
  breakdownProperty: string;
  chartType: ChartType;
  comparePeriod: ComparePeriod;
  formula: string;

  setDateRange: (v: DateRangeValue) => void;
  setEvents: (v: InsightsEventEntry[]) => void;
  setBreakdownProperty: (v: string) => void;
  setChartType: (v: ChartType) => void;
  setComparePeriod: (v: ComparePeriod) => void;
  setFormula: (v: string) => void;
  resetStore: () => void;
}

const INSIGHTS_DEFAULTS = {
  dateRange: { type: 'preset' as const, preset: '14d' },
  events: [{ name: '', aggregation: 'total' }] as InsightsEventEntry[],
  breakdownProperty: '',
  chartType: 'line' as ChartType,
  comparePeriod: '' as ComparePeriod,
  formula: '',
};

export const useInsightsStore = create<InsightsState>()(
  persist(
    (set) => ({
      ...INSIGHTS_DEFAULTS,
      setDateRange: (dateRange) => set({ dateRange }),
      setEvents: (events) => set({ events }),
      setBreakdownProperty: (breakdownProperty) => set({ breakdownProperty }),
      setChartType: (chartType) => set({ chartType }),
      setComparePeriod: (comparePeriod) => set({ comparePeriod }),
      setFormula: (formula) => set({ formula }),
      resetStore: () => set({ ...INSIGHTS_DEFAULTS }),
    }),
    {
      name: 'argus-analytics-insights',
      // Only persist query config, not results
      partialize: (state) => ({
        dateRange: state.dateRange,
        events: state.events,
        breakdownProperty: state.breakdownProperty,
        chartType: state.chartType,
        comparePeriod: state.comparePeriod,
        formula: state.formula,
      }),
    }
  )
);

/* ═══════════════════════════════════════════════════════════════════════
   Funnels Store
   ═══════════════════════════════════════════════════════════════════════ */

export interface FunnelStepEntry {
  name: string;
  conditions?: EventCondition[];
}

type FunnelViewMode = 'steps' | 'trending' | 'time_to_convert';

type FunnelChartLayout = 'horizontal' | 'vertical';

interface FunnelsState {
  dateRange: DateRangeValue;
  steps: FunnelStepEntry[];
  viewMode: FunnelViewMode;
  chartLayout: FunnelChartLayout;
  conversionWindow: number;
  ordering: 'specific' | 'any';
  counting: 'uniques' | 'totals';
  holdConstant: string[];
  breakdownProperty: string;

  setDateRange: (v: DateRangeValue) => void;
  setSteps: (v: FunnelStepEntry[]) => void;
  setViewMode: (v: FunnelViewMode) => void;
  setChartLayout: (v: FunnelChartLayout) => void;
  setConversionWindow: (v: number) => void;
  setOrdering: (v: 'specific' | 'any') => void;
  setCounting: (v: 'uniques' | 'totals') => void;
  setHoldConstant: (v: string[]) => void;
  setBreakdownProperty: (v: string) => void;
  resetStore: () => void;
}

const FUNNELS_DEFAULTS = {
  dateRange: { type: 'preset' as const, preset: '14d' },
  steps: [{ name: '' }, { name: '' }] as FunnelStepEntry[],
  viewMode: 'steps' as FunnelViewMode,
  chartLayout: 'horizontal' as FunnelChartLayout,
  conversionWindow: 86400,
  ordering: 'specific' as const,
  counting: 'uniques' as const,
  holdConstant: [] as string[],
  breakdownProperty: '',
};

export const useFunnelsStore = create<FunnelsState>()(
  persist(
    (set) => ({
      ...FUNNELS_DEFAULTS,
      setDateRange: (dateRange) => set({ dateRange }),
      setSteps: (steps) => set({ steps }),
      setViewMode: (viewMode) => set({ viewMode }),
      setChartLayout: (chartLayout) => set({ chartLayout }),
      setConversionWindow: (conversionWindow) => set({ conversionWindow }),
      setOrdering: (ordering) => set({ ordering }),
      setCounting: (counting) => set({ counting }),
      setHoldConstant: (holdConstant) => set({ holdConstant }),
      setBreakdownProperty: (breakdownProperty) => set({ breakdownProperty }),
      resetStore: () => set({ ...FUNNELS_DEFAULTS }),
    }),
    {
      name: 'argus-analytics-funnels',
      partialize: (state) => ({
        dateRange: state.dateRange,
        steps: state.steps,
        viewMode: state.viewMode,
        chartLayout: state.chartLayout,
        conversionWindow: state.conversionWindow,
        ordering: state.ordering,
        counting: state.counting,
        holdConstant: state.holdConstant,
        breakdownProperty: state.breakdownProperty,
      }),
    }
  )
);

/* ═══════════════════════════════════════════════════════════════════════
   Retention Store
   ═══════════════════════════════════════════════════════════════════════ */

export interface RetentionEventEntry {
  name: string;
  conditions?: EventCondition[];
}

type RetentionViewMode = 'curve' | 'line' | 'bar' | 'table' | 'metric';

interface RetentionState {
  dateRange: DateRangeValue;
  cohortEvent: RetentionEventEntry;
  returnEvent: RetentionEventEntry;
  retentionType: 'day' | 'week' | 'month';
  criteria: 'on' | 'on_or_after';
  measurement: 'retention_rate' | 'unique_users' | 'property_sum' | 'property_avg';
  measurementProperty: string;
  minFrequency: number;
  breakdownProperty: string;
  viewMode: RetentionViewMode;

  setDateRange: (v: DateRangeValue) => void;
  setCohortEvent: (v: RetentionEventEntry) => void;
  setReturnEvent: (v: RetentionEventEntry) => void;
  setRetentionType: (v: 'day' | 'week' | 'month') => void;
  setCriteria: (v: 'on' | 'on_or_after') => void;
  setMeasurement: (v: RetentionState['measurement']) => void;
  setMeasurementProperty: (v: string) => void;
  setMinFrequency: (v: number) => void;
  setBreakdownProperty: (v: string) => void;
  setViewMode: (v: RetentionViewMode) => void;
  resetStore: () => void;
}

const RETENTION_DEFAULTS = {
  dateRange: { type: 'preset' as const, preset: '30d' },
  cohortEvent: { name: '' } as RetentionEventEntry,
  returnEvent: { name: '' } as RetentionEventEntry,
  retentionType: 'day' as const,
  criteria: 'on_or_after' as const,
  measurement: 'retention_rate' as const,
  measurementProperty: '',
  minFrequency: 1,
  breakdownProperty: '',
  viewMode: 'curve' as RetentionViewMode,
};

export const useRetentionStore = create<RetentionState>()(
  persist(
    (set) => ({
      ...RETENTION_DEFAULTS,
      setDateRange: (dateRange) => set({ dateRange }),
      setCohortEvent: (cohortEvent) => set({ cohortEvent }),
      setReturnEvent: (returnEvent) => set({ returnEvent }),
      setRetentionType: (retentionType) => set({ retentionType }),
      setCriteria: (criteria) => set({ criteria }),
      setMeasurement: (measurement) => set({ measurement }),
      setMeasurementProperty: (measurementProperty) => set({ measurementProperty }),
      setMinFrequency: (minFrequency) => set({ minFrequency }),
      setBreakdownProperty: (breakdownProperty) => set({ breakdownProperty }),
      setViewMode: (viewMode) => set({ viewMode }),
      resetStore: () => set({ ...RETENTION_DEFAULTS }),
    }),
    {
      name: 'argus-analytics-retention',
      partialize: (state) => ({
        dateRange: state.dateRange,
        cohortEvent: state.cohortEvent,
        returnEvent: state.returnEvent,
        retentionType: state.retentionType,
        criteria: state.criteria,
        measurement: state.measurement,
        measurementProperty: state.measurementProperty,
        minFrequency: state.minFrequency,
        breakdownProperty: state.breakdownProperty,
        viewMode: state.viewMode,
      }),
    }
  )
);

/* ═══════════════════════════════════════════════════════════════════════
   Flows Store
   ═══════════════════════════════════════════════════════════════════════ */

type FlowViewMode = 'sankey' | 'top_paths';

interface FlowsState {
  dateRange: DateRangeValue;
  anchorEventA: string;
  anchorEventB: string;
  showSecondAnchor: boolean;
  direction: 'after' | 'before' | 'between';
  stepsBefore: number;
  stepsAfter: number;
  depth: number;
  viewMode: FlowViewMode;
  excludeEvents: string[];
  breakdownProperty: string;

  setDateRange: (v: DateRangeValue) => void;
  setAnchorEventA: (v: string) => void;
  setAnchorEventB: (v: string) => void;
  setShowSecondAnchor: (v: boolean) => void;
  setDirection: (v: FlowsState['direction']) => void;
  setStepsBefore: (v: number) => void;
  setStepsAfter: (v: number) => void;
  setDepth: (v: number) => void;
  setViewMode: (v: FlowViewMode) => void;
  setExcludeEvents: (v: string[]) => void;
  setBreakdownProperty: (v: string) => void;
  resetStore: () => void;
}

const FLOWS_DEFAULTS = {
  dateRange: { type: 'preset' as const, preset: '14d' },
  anchorEventA: '',
  anchorEventB: '',
  showSecondAnchor: false,
  direction: 'after' as const,
  stepsBefore: 3,
  stepsAfter: 3,
  depth: 4,
  viewMode: 'sankey' as FlowViewMode,
  excludeEvents: [] as string[],
  breakdownProperty: '',
};

export const useFlowsStore = create<FlowsState>()(
  persist(
    (set) => ({
      ...FLOWS_DEFAULTS,
      setDateRange: (dateRange) => set({ dateRange }),
      setAnchorEventA: (anchorEventA) => set({ anchorEventA }),
      setAnchorEventB: (anchorEventB) => set({ anchorEventB }),
      setShowSecondAnchor: (showSecondAnchor) => set({ showSecondAnchor }),
      setDirection: (direction) => set({ direction }),
      setStepsBefore: (stepsBefore) => set({ stepsBefore }),
      setStepsAfter: (stepsAfter) => set({ stepsAfter }),
      setDepth: (depth) => set({ depth }),
      setViewMode: (viewMode) => set({ viewMode }),
      setExcludeEvents: (excludeEvents) => set({ excludeEvents }),
      setBreakdownProperty: (breakdownProperty) => set({ breakdownProperty }),
      resetStore: () => set({ ...FLOWS_DEFAULTS }),
    }),
    {
      name: 'argus-analytics-flows',
      partialize: (state) => ({
        dateRange: state.dateRange,
        anchorEventA: state.anchorEventA,
        anchorEventB: state.anchorEventB,
        showSecondAnchor: state.showSecondAnchor,
        direction: state.direction,
        stepsBefore: state.stepsBefore,
        stepsAfter: state.stepsAfter,
        depth: state.depth,
        viewMode: state.viewMode,
        excludeEvents: state.excludeEvents,
        breakdownProperty: state.breakdownProperty,
      }),
    }
  )
);
