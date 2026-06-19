import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { Box, useTheme } from '@mui/material';
import { useTranslation } from 'react-i18next';
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
import { useLocalizedLexicon } from '@/pages/argus/hooks/useLocalizedLexicon';
import { evaluateFormula } from '@/pages/argus/hooks/useFormulaEngine';
import { useInsightsStore } from '@/hooks/useAnalyticsStore';
import { useGlobalAnalyticsFilter } from '@/hooks/useGlobalAnalyticsFilter';
import { useSharedEventCatalog } from './hooks/useSharedEventCatalog';

import AnalyticsLayout from './components/analytics/AnalyticsLayout';
import CsvExportButton from './components/analytics/CsvExportButton';
import ChartTypeSelector from './components/analytics/ChartTypeSelector';
import CompareSelector from './components/analytics/CompareSelector';
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
import { InsightsLeftPanel } from './components/analytics/InsightsLeftPanel';
import { InsightsChartSection } from './components/analytics/InsightsChartSection';

/* ─── Component ─── */
interface ArgusInsightsPageProps {
  embedded?: boolean;
  tabBar?: React.ReactNode;
  panelWidth?: number;
  onPanelResizeMouseDown?: (e: React.MouseEvent) => void;
  isPanelDragging?: boolean;
  /** Called when the chart drag-zoom sets a new date range (so parent UI can sync) */
  onDateRangeChange?: (
    v: import('@/components/common/DateRangeSelector').DateRangeValue
  ) => void;
}

const ArgusInsightsPage: React.FC<ArgusInsightsPageProps> = ({
  embedded = false,
  tabBar,
  panelWidth,
  onPanelResizeMouseDown,
  isPanelDragging,
  onDateRangeChange,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const { currentProject } = useOrgProject();
  const projectId = currentProject?.id || '1';
  const breakdownLimit = useBreakdownLimit(projectId);

  // ── Persisted Store State ──
  const dateRange = useInsightsStore((s) => s.dateRange);
  const setDateRange = useInsightsStore((s) => s.setDateRange);
  const events = useInsightsStore((s) => s.events);
  const breakdownProperties = useInsightsStore((s) => s.breakdownProperties);
  const chartType = useInsightsStore((s) => s.chartType);
  const setChartType = useInsightsStore((s) => s.setChartType);
  const comparePeriod = useInsightsStore((s) => s.comparePeriod);
  const setComparePeriod = useInsightsStore((s) => s.setComparePeriod);
  const formulas = useInsightsStore((s) => s.formulas);
  const globalFilters = useGlobalAnalyticsFilter((s) => s.filters);

  // ── Shared Event Catalog ──
  const { availableEvents } = useSharedEventCatalog(projectId);

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

  const [series, setSeries] = useState<any[]>([]);
  const [compareSeries, setCompareSeries] = useState<any[] | undefined>();
  const [queryLoading, setQueryLoading] = useState(false);
  const [hasQueried, setHasQueried] = useState(false);
  const isInitialMount = useRef(true);
  const lastExecutedKeyRef = useRef<string>('');
  // Maps formatted bucket label ("MM/DD HH:mm") → original ISO bucket string
  const formattedToRawBucketRef = useRef<Map<string, string>>(new Map());

  // Drilldown & Zoom state
  const [drilldownOpen, setDrilldownOpen] = useState(false);
  const [drilldownParams, setDrilldownParams] = useState<{
    eventName: string;
    dateRange: { start: Date; end: Date };
    breakdownFilters?: { property: string; value: string }[];
  } | null>(null);

  const [refAreaLeft, setRefAreaLeft] = useState<string | null>(null);
  const [refAreaRight, setRefAreaRight] = useState<string | null>(null);

  const handleZoom = useCallback(() => {
    if (refAreaLeft === refAreaRight || !refAreaLeft || !refAreaRight) {
      setRefAreaLeft(null);
      setRefAreaRight(null);
      return;
    }

    // activeLabel from Recharts is the *formatted* bucket ("MM/DD HH:mm").
    // new Date("06/19 09:00") → Invalid Date because the format is non-standard.
    // We look up the original ISO string stored in formattedToRawBucketRef.
    const lookup = formattedToRawBucketRef.current;
    const rawLeft = lookup.get(refAreaLeft) ?? refAreaLeft;
    const rawRight = lookup.get(refAreaRight) ?? refAreaRight;

    // Parse the ISO string (replace space separator with 'T' for safety)
    const leftDate = new Date(rawLeft.replace(' ', 'T'));
    const rightDate = new Date(rawRight.replace(' ', 'T'));

    if (isNaN(leftDate.getTime()) || isNaN(rightDate.getTime())) {
      setRefAreaLeft(null);
      setRefAreaRight(null);
      return;
    }

    // Ensure chronological order (user may drag right-to-left)
    const start = leftDate <= rightDate ? leftDate : rightDate;
    const end = leftDate <= rightDate ? rightDate : leftDate;
    end.setHours(23, 59, 59, 999);

    setDateRange({ type: 'custom', start, end });
    // Notify the parent (e.g. ArgusAnalyticsPage) so its DateRangeSelector reflects the zoom
    onDateRangeChange?.({ type: 'custom', start, end });
    setRefAreaLeft(null);
    setRefAreaRight(null);
  }, [refAreaLeft, refAreaRight, setDateRange, onDateRangeChange]);

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
        // _rawBucket preserves the original ISO string so handleZoom can
        // parse it correctly (the formatted "MM/DD HH:mm" label is not parseable by new Date)
        const filled: Record<string, any> = {
          bucket: formatBucket(bucket),
          _rawBucket: bucket,
        };
        for (const k of allKeys) {
          filled[k] = values[k] ?? 0;
        }
        return filled;
      });
  }, [series, compareSeries, breakdownProperties]);

  // Keep the formatted→raw bucket lookup ref in sync whenever chartData changes.
  // Using a ref (not state) so handleZoom can read it without being in its dep array.
  useEffect(() => {
    const map = new Map<string, string>();
    chartData.forEach((d) => {
      if (d._rawBucket) map.set(d.bucket as string, d._rawBucket as string);
    });
    formattedToRawBucketRef.current = map;
  }, [chartData]);

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
  }, [series, breakdownProperties]);

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

      let breakdownFilters: { property: string; value: string }[] | undefined;
      if (bValue && breakdownProperties.length > 0) {
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
    [
      breakdownProperties,
      validFormulaResults,
      refAreaLeft,
      refAreaRight,
      series,
    ]
  );

  // ── UI: Left Panel ──
  const leftPanel = (
    <InsightsLeftPanel
      queryLoading={queryLoading}
      onRunQuery={handleRunQuery}
    />
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
          subtitle={t(
            'argus.analytics.insightsSubtitle',
            '이벤트 데이터를 다양한 차트로 분석합니다.'
          )}
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
          panelWidth={panelWidth}
          onPanelResizeMouseDown={onPanelResizeMouseDown}
          isPanelDragging={isPanelDragging}
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
              <InsightsChartSection
                series={series}
                compareSeries={compareSeries}
                chartDataWithFormula={chartDataWithFormula}
                seriesKeys={seriesKeys}
                compareKeys={compareKeys}
                validFormulaResults={validFormulaResults}
                allSeriesKeys={allSeriesKeys}
                handleChartClick={handleChartClick}
                lexiconMap={lexiconMap}
                eventMetaMap={eventMetaMap}
                refAreaLeft={refAreaLeft}
                refAreaRight={refAreaRight}
                setRefAreaLeft={setRefAreaLeft}
                setRefAreaRight={setRefAreaRight}
                handleZoom={handleZoom}
              />
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
