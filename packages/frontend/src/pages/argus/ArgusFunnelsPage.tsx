import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { Box, IconButton, useTheme, alpha } from '@mui/material';
import {
  ViewColumn as VerticalIcon,
  ViewStream as HorizontalIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import PageHeader from '@/components/common/PageHeader';
import ArgusBreadcrumbs from '@/components/argus/ArgusBreadcrumbs';
import { ArgusAnalyticsDrilldownDrawer } from './components/analytics/ArgusAnalyticsDrilldownDrawer';
import DateRangeSelector, {
  dateRangeToApiParams,
} from '@/components/common/DateRangeSelector';
import EmptyPagePlaceholder from '@/components/common/EmptyPagePlaceholder';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import argusService from '@/services/argusService';
import { useLocalizedLexicon } from '@/pages/argus/hooks/useLocalizedLexicon';
import {
  useFunnelsStore,
  type FunnelStepEntry,
} from '@/hooks/useAnalyticsStore';
import { useGlobalAnalyticsFilter } from '@/hooks/useGlobalAnalyticsFilter';
import { useSharedEventCatalog } from './hooks/useSharedEventCatalog';

import AnalyticsLayout from './components/analytics/AnalyticsLayout';
import CsvExportButton from './components/analytics/CsvExportButton';
import ArgusChartSkeleton from '@/components/argus/ArgusChartSkeleton';
import PageContentLoader from '@/components/common/PageContentLoader';
import {
  FunnelsLeftPanel,
  FUNNEL_COLORS,
} from './components/funnels/FunnelsLeftPanel';
import { FunnelsViews } from './components/funnels/FunnelsViews';

/* ─── Types ─── */
type FunnelViewMode = 'steps' | 'trending' | 'time_to_convert';

/* ─── Component ─── */
interface ArgusFunnelsPageProps {
  embedded?: boolean;
  tabBar?: React.ReactNode;
  panelWidth?: number;
  onPanelResizeMouseDown?: (e: React.MouseEvent) => void;
  isPanelDragging?: boolean;
  panelRef?: React.RefObject<HTMLElement | null>;
}

const ArgusFunnelsPage: React.FC<ArgusFunnelsPageProps> = ({
  embedded = false,
  tabBar,
  panelWidth,
  onPanelResizeMouseDown,
  isPanelDragging,
  panelRef,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';
  const { currentProject } = useOrgProject();
  const projectId = currentProject?.id || '1';

  // ── Persisted State (survives refresh) ──
  const dateRange = useFunnelsStore((s) => s.dateRange);
  const setDateRange = useFunnelsStore((s) => s.setDateRange);
  const steps = useFunnelsStore((s) => s.steps);
  const viewMode = useFunnelsStore((s) => s.viewMode);
  const setViewMode = useFunnelsStore((s) => s.setViewMode);
  const conversionWindow = useFunnelsStore((s) => s.conversionWindow);
  const ordering = useFunnelsStore((s) => s.ordering);
  const counting = useFunnelsStore((s) => s.counting);
  const holdConstant = useFunnelsStore((s) => s.holdConstant);
  const chartLayout = useFunnelsStore((s) => s.chartLayout);
  const setChartLayout = useFunnelsStore((s) => s.setChartLayout);
  const breakdownProperties = useFunnelsStore((s) => s.breakdownProperties);
  const exclusionSteps = useFunnelsStore((s) => s.exclusionSteps);
  const segments = useFunnelsStore((s) => s.segments);
  const compareMode = useFunnelsStore((s) => s.compareMode);
  const globalFilters = useGlobalAnalyticsFilter((s) => s.filters);

  // ── Shared Event Catalog (cached across tab switches) ──
  const { availableEvents } = useSharedEventCatalog(projectId);

  // Result
  const [result, setResult] = useState<any | null>(null);
  const [queryLoading, setQueryLoading] = useState(false);
  const [hasQueried, setHasQueried] = useState(false);

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

  const { localizeEventName: lfn } = useLocalizedLexicon();

  // Lexicon Map for translating event keys → localized display name
  const lexiconMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of availableEvents) {
      const localized = lfn(e.name, e.display_name, e.is_reserved);
      if (localized && localized !== e.name) map.set(e.name, localized);
    }
    return map;
  }, [availableEvents, lfn]);

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

  // ── UI: Left Panel ──
  const leftPanel = (
    <FunnelsLeftPanel queryLoading={queryLoading} onRunQuery={handleRun} />
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
        {[
          {
            label: t('argus.analytics.funnelSteps', 'Funnel Steps'),
            apiMode: 'steps',
            sub: 'funnel',
          },
          {
            label: t('argus.analytics.lineChart', 'Line'),
            apiMode: 'trending',
            sub: 'funnel',
          },
          {
            label: t('argus.analytics.metricView', 'Metric'),
            apiMode: 'steps',
            sub: 'metric',
          },
          {
            label: t('argus.analytics.timeToConvert', 'Time to Conv.'),
            apiMode: 'time_to_convert',
            sub: 'funnel',
          },
        ].map(({ label, apiMode, sub }) => {
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
                { label: t('argus.analytics.funnels', 'Funnels') },
              ]}
              size="title"
            />
          }
          subtitle={t(
            'argus.analytics.funnelsSubtitle',
            '단계별 전환율을 측정하고 이탈 구간을 파악합니다.'
          )}
        />
      )}
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
        <AnalyticsLayout
          leftPanel={leftPanel}
          tabBar={tabBar}
          toolbar={toolbar}
          projectId={projectId}
          panelWidth={panelWidth}
          onPanelResizeMouseDown={onPanelResizeMouseDown}
          isPanelDragging={isPanelDragging}
          panelRef={panelRef}
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
              <FunnelsViews
                result={result}
                chartSubType={chartSubType}
                handleBarClick={handleBarClick}
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
        />
      )}
    </Box>
  );
};

export default ArgusFunnelsPage;
