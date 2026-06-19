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

/** Persist migration: breakdownProperty (string) → breakdownProperties (string[]) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function migrateBreakdown(persisted: any): any {
  if (persisted && typeof persisted.breakdownProperty === 'string') {
    persisted.breakdownProperties = persisted.breakdownProperty
      ? [persisted.breakdownProperty]
      : [];
    delete persisted.breakdownProperty;
  }
  return persisted;
}

/** Persist migration: breakdownProperty (string) → breakdownProperties (string[]) and formula (string) → formulas (string[]) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function migrateInsights(persisted: any): any {
  if (persisted) {
    persisted = migrateBreakdown(persisted);
    if (typeof persisted.formula === 'string') {
      persisted.formulas = persisted.formula ? [persisted.formula] : [];
      delete persisted.formula;
    }
  }
  return persisted;
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
  breakdownProperties: string[];
  chartType: ChartType;
  comparePeriod: ComparePeriod;
  formulas: string[];

  setDateRange: (v: DateRangeValue) => void;
  setEvents: (v: InsightsEventEntry[]) => void;
  setBreakdownProperties: (v: string[]) => void;
  setChartType: (v: ChartType) => void;
  setComparePeriod: (v: ComparePeriod) => void;
  setFormulas: (v: string[]) => void;
  resetStore: () => void;
}

const INSIGHTS_DEFAULTS = {
  dateRange: { type: 'preset' as const, preset: '14d' },
  events: [{ name: '', aggregation: 'total' }] as InsightsEventEntry[],
  breakdownProperties: [] as string[],
  chartType: 'line' as ChartType,
  comparePeriod: '' as ComparePeriod,
  formulas: [] as string[],
};

export const useInsightsStore = create<InsightsState>()(
  persist(
    (set) => ({
      ...INSIGHTS_DEFAULTS,
      setDateRange: (dateRange) => set({ dateRange }),
      setEvents: (events) => set({ events }),
      setBreakdownProperties: (breakdownProperties) =>
        set({ breakdownProperties }),
      setChartType: (chartType) => set({ chartType }),
      setComparePeriod: (comparePeriod) => set({ comparePeriod }),
      setFormulas: (formulas) => set({ formulas }),
      resetStore: () => set({ ...INSIGHTS_DEFAULTS }),
    }),
    {
      name: 'argus-analytics-insights',
      version: 2,
      migrate: (persisted) => migrateInsights(persisted) as InsightsState,
      partialize: (state) => ({
        dateRange: state.dateRange,
        events: state.events,
        breakdownProperties: state.breakdownProperties,
        chartType: state.chartType,
        comparePeriod: state.comparePeriod,
        formulas: state.formulas,
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

export interface FunnelExclusionStep {
  event_name: string;
  between: [number, number]; // [afterStepIdx, beforeStepIdx] (0-indexed)
}

type FunnelViewMode = 'steps' | 'trending' | 'time_to_convert';

type FunnelChartLayout = 'horizontal' | 'vertical';

export interface FunnelSegment {
  id: string;
  name: string;
  filters: { property: string; operator: string; value: string }[];
  color: string;
}

interface FunnelsState {
  dateRange: DateRangeValue;
  steps: FunnelStepEntry[];
  viewMode: FunnelViewMode;
  chartLayout: FunnelChartLayout;
  conversionWindow: number;
  ordering: 'specific' | 'any';
  counting: 'uniques' | 'totals';
  holdConstant: string[];
  breakdownProperties: string[];
  exclusionSteps: FunnelExclusionStep[];
  segments: FunnelSegment[];
  compareMode: boolean;

  setDateRange: (v: DateRangeValue) => void;
  setSteps: (v: FunnelStepEntry[]) => void;
  setViewMode: (v: FunnelViewMode) => void;
  setChartLayout: (v: FunnelChartLayout) => void;
  setConversionWindow: (v: number) => void;
  setOrdering: (v: 'specific' | 'any') => void;
  setCounting: (v: 'uniques' | 'totals') => void;
  setHoldConstant: (v: string[]) => void;
  setBreakdownProperties: (v: string[]) => void;
  setExclusionSteps: (v: FunnelExclusionStep[]) => void;
  setSegments: (v: FunnelSegment[]) => void;
  setCompareMode: (v: boolean) => void;
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
  breakdownProperties: [] as string[],
  exclusionSteps: [] as FunnelExclusionStep[],
  segments: [] as FunnelSegment[],
  compareMode: false,
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
      setBreakdownProperties: (breakdownProperties) =>
        set({ breakdownProperties }),
      setExclusionSteps: (exclusionSteps) => set({ exclusionSteps }),
      setSegments: (segments) => set({ segments }),
      setCompareMode: (compareMode) => set({ compareMode }),
      resetStore: () => set({ ...FUNNELS_DEFAULTS }),
    }),
    {
      name: 'argus-analytics-funnels',
      version: 2,
      migrate: (persisted) => migrateBreakdown(persisted) as FunnelsState,
      partialize: (state) => ({
        dateRange: state.dateRange,
        steps: state.steps,
        viewMode: state.viewMode,
        chartLayout: state.chartLayout,
        conversionWindow: state.conversionWindow,
        ordering: state.ordering,
        counting: state.counting,
        holdConstant: state.holdConstant,
        breakdownProperties: state.breakdownProperties,
        exclusionSteps: state.exclusionSteps,
        segments: state.segments,
        compareMode: state.compareMode,
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
  measurement:
    | 'retention_rate'
    | 'unique_users'
    | 'property_sum'
    | 'property_avg';
  measurementProperty: string;
  minFrequency: number;
  breakdownProperties: string[];
  viewMode: RetentionViewMode;

  setDateRange: (v: DateRangeValue) => void;
  setCohortEvent: (v: RetentionEventEntry) => void;
  setReturnEvent: (v: RetentionEventEntry) => void;
  setRetentionType: (v: 'day' | 'week' | 'month') => void;
  setCriteria: (v: 'on' | 'on_or_after') => void;
  setMeasurement: (v: RetentionState['measurement']) => void;
  setMeasurementProperty: (v: string) => void;
  setMinFrequency: (v: number) => void;
  setBreakdownProperties: (v: string[]) => void;
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
  breakdownProperties: [] as string[],
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
      setMeasurementProperty: (measurementProperty) =>
        set({ measurementProperty }),
      setMinFrequency: (minFrequency) => set({ minFrequency }),
      setBreakdownProperties: (breakdownProperties) =>
        set({ breakdownProperties }),
      setViewMode: (viewMode) => set({ viewMode }),
      resetStore: () => set({ ...RETENTION_DEFAULTS }),
    }),
    {
      name: 'argus-analytics-retention',
      version: 2,
      migrate: (persisted) => migrateBreakdown(persisted) as RetentionState,
      partialize: (state) => ({
        dateRange: state.dateRange,
        cohortEvent: state.cohortEvent,
        returnEvent: state.returnEvent,
        retentionType: state.retentionType,
        criteria: state.criteria,
        measurement: state.measurement,
        measurementProperty: state.measurementProperty,
        minFrequency: state.minFrequency,
        breakdownProperties: state.breakdownProperties,
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
  breakdownProperties: string[];

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
  setBreakdownProperties: (v: string[]) => void;
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
  breakdownProperties: [] as string[],
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
      setBreakdownProperties: (breakdownProperties) =>
        set({ breakdownProperties }),
      resetStore: () => set({ ...FLOWS_DEFAULTS }),
    }),
    {
      name: 'argus-analytics-flows',
      version: 2,
      migrate: (persisted) => migrateBreakdown(persisted) as FlowsState,
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
        breakdownProperties: state.breakdownProperties,
      }),
    }
  )
);

/* ═══════════════════════════════════════════════════════════════════════
   Event Catalog Store (Shared across all analytics pages)
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * AvailableEvent — shape returned by argusService.getAnalyticsEventNames().
 * Using `any` to avoid coupling to the service type; pages cast as needed.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AvailableEvent = any;

interface EventCatalogState {
  /** Cached event list from the last successful fetch. */
  availableEvents: AvailableEvent[];
  /** True while a fetch is in-flight. */
  eventsLoading: boolean;
  /** The projectId for which the cache is valid. */
  cachedProjectId: string | null;

  setAvailableEvents: (events: AvailableEvent[], projectId: string) => void;
  setEventsLoading: (loading: boolean) => void;
  /**
   * Invalidate the cache when the project changes.
   * Returns true if the cache was valid for this projectId (no fetch needed).
   */
  isCacheValid: (projectId: string) => boolean;
  clearCache: () => void;
}

export const useEventCatalogStore = create<EventCatalogState>()((set, get) => ({
  availableEvents: [],
  eventsLoading: false,
  cachedProjectId: null,

  setAvailableEvents: (events, projectId) =>
    set({ availableEvents: events, cachedProjectId: projectId }),

  setEventsLoading: (eventsLoading) => set({ eventsLoading }),

  isCacheValid: (projectId) => {
    const { cachedProjectId, availableEvents } = get();
    return cachedProjectId === projectId && availableEvents.length > 0;
  },

  clearCache: () =>
    set({ availableEvents: [], cachedProjectId: null, eventsLoading: false }),
}));

/* ═══════════════════════════════════════════════════════════════════════
   Analytics Query Serialize / Restore Utilities
   ═══════════════════════════════════════════════════════════════════════ */

type AnalyticsTab = 'insights' | 'funnels' | 'retention' | 'flows';

/**
 * Serialize a Zustand store state into a plain JSON object for saving.
 * Strips out setter functions and keeps only data fields.
 */
export function serializeAnalyticsQuery(
  tab: AnalyticsTab,
  storeState: Record<string, any>
): Record<string, any> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { resetStore, ...data } = Object.fromEntries(
    Object.entries(storeState).filter(([, v]) => typeof v !== 'function')
  );
  return { analytics_sub_type: tab, ...data };
}

/**
 * Restore a serialized query config into the corresponding store setters.
 * Returns an object of { setterName: value } pairs to be called by the consumer.
 */
export function deserializeAnalyticsQuery(
  config: Record<string, any>
): Record<string, any> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { analytics_sub_type, ...data } = config;
  return data;
}

/**
 * Apply a deserialized query config to the corresponding Zustand store.
 */
export function restoreInsightsQuery(
  config: Record<string, any>,
  store: ReturnType<typeof useInsightsStore.getState>
) {
  const data = deserializeAnalyticsQuery(config);
  if (data.dateRange) store.setDateRange(data.dateRange);
  if (data.events) store.setEvents(data.events);
  if (data.breakdownProperties)
    store.setBreakdownProperties(data.breakdownProperties);
  if (data.chartType) store.setChartType(data.chartType);
  if (data.comparePeriod !== undefined)
    store.setComparePeriod(data.comparePeriod);
  if (data.formulas) store.setFormulas(data.formulas);
}

export function restoreFunnelsQuery(
  config: Record<string, any>,
  store: ReturnType<typeof useFunnelsStore.getState>
) {
  const data = deserializeAnalyticsQuery(config);
  if (data.dateRange) store.setDateRange(data.dateRange);
  if (data.steps) store.setSteps(data.steps);
  if (data.viewMode) store.setViewMode(data.viewMode);
  if (data.chartLayout) store.setChartLayout(data.chartLayout);
  if (data.conversionWindow !== undefined)
    store.setConversionWindow(data.conversionWindow);
  if (data.ordering) store.setOrdering(data.ordering);
  if (data.counting) store.setCounting(data.counting);
  if (data.holdConstant) store.setHoldConstant(data.holdConstant);
  if (data.breakdownProperties)
    store.setBreakdownProperties(data.breakdownProperties);
  if (data.exclusionSteps) store.setExclusionSteps(data.exclusionSteps);
  if (data.segments) store.setSegments(data.segments);
  if (data.compareMode !== undefined) store.setCompareMode(data.compareMode);
}

export function restoreRetentionQuery(
  config: Record<string, any>,
  store: ReturnType<typeof useRetentionStore.getState>
) {
  const data = deserializeAnalyticsQuery(config);
  if (data.dateRange) store.setDateRange(data.dateRange);
  if (data.cohortEvent) store.setCohortEvent(data.cohortEvent);
  if (data.returnEvent) store.setReturnEvent(data.returnEvent);
  if (data.retentionType) store.setRetentionType(data.retentionType);
  if (data.criteria) store.setCriteria(data.criteria);
  if (data.measurement) store.setMeasurement(data.measurement);
  if (data.measurementProperty !== undefined)
    store.setMeasurementProperty(data.measurementProperty);
  if (data.minFrequency !== undefined) store.setMinFrequency(data.minFrequency);
  if (data.breakdownProperties)
    store.setBreakdownProperties(data.breakdownProperties);
  if (data.viewMode) store.setViewMode(data.viewMode);
}

export function restoreFlowsQuery(
  config: Record<string, any>,
  store: ReturnType<typeof useFlowsStore.getState>
) {
  const data = deserializeAnalyticsQuery(config);
  if (data.dateRange) store.setDateRange(data.dateRange);
  if (data.anchorEventA !== undefined) store.setAnchorEventA(data.anchorEventA);
  if (data.anchorEventB !== undefined) store.setAnchorEventB(data.anchorEventB);
  if (data.showSecondAnchor !== undefined)
    store.setShowSecondAnchor(data.showSecondAnchor);
  if (data.direction) store.setDirection(data.direction);
  if (data.stepsBefore !== undefined) store.setStepsBefore(data.stepsBefore);
  if (data.stepsAfter !== undefined) store.setStepsAfter(data.stepsAfter);
  if (data.depth !== undefined) store.setDepth(data.depth);
  if (data.viewMode) store.setViewMode(data.viewMode);
  if (data.excludeEvents) store.setExcludeEvents(data.excludeEvents);
  if (data.breakdownProperties)
    store.setBreakdownProperties(data.breakdownProperties);
}

/* ═══════════════════════════════════════════════════════════════════════
   Analytics Save State Store (shared across tabs)
   ═══════════════════════════════════════════════════════════════════════ */

interface AnalyticsSaveState {
  /** ID of the currently loaded saved query (null = unsaved/new) */
  currentQueryId: number | null;
  /** Name of the currently loaded saved query */
  currentQueryName: string;
  /** Whether the current query has been modified since last save */
  isDirty: boolean;

  setCurrentQuery: (id: number | null, name: string) => void;
  setDirty: (dirty: boolean) => void;
  clearSaveState: () => void;
}

export const useAnalyticsSaveState = create<AnalyticsSaveState>()((set) => ({
  currentQueryId: null,
  currentQueryName: '',
  isDirty: false,

  setCurrentQuery: (currentQueryId, currentQueryName) =>
    set({ currentQueryId, currentQueryName, isDirty: false }),
  setDirty: (isDirty) => set({ isDirty }),
  clearSaveState: () =>
    set({ currentQueryId: null, currentQueryName: '', isDirty: false }),
}));
