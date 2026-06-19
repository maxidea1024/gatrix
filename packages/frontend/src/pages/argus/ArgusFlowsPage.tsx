import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { Box } from '@mui/material';
import { useTranslation } from 'react-i18next';
import PageHeader from '@/components/common/PageHeader';
import ArgusBreadcrumbs from '@/components/argus/ArgusBreadcrumbs';
import DateRangeSelector, {
  dateRangeToApiParams,
} from '@/components/common/DateRangeSelector';
import EmptyPagePlaceholder from '@/components/common/EmptyPagePlaceholder';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import argusService, {
  type AnalyticsEventNameEntry,
} from '@/services/argusService';
import { useFlowsStore } from '@/hooks/useAnalyticsStore';
import { useGlobalAnalyticsFilter } from '@/hooks/useGlobalAnalyticsFilter';
import { useSharedEventCatalog } from './hooks/useSharedEventCatalog';

import AnalyticsLayout from './components/analytics/AnalyticsLayout';
import InlineSelect from './components/analytics/InlineSelect';
import CsvExportButton from './components/analytics/CsvExportButton';
import ArgusChartSkeleton from '@/components/argus/ArgusChartSkeleton';
import PageContentLoader from '@/components/common/PageContentLoader';
import QuickLexiconEditor from './components/analytics/QuickLexiconEditor';

import { FlowsLeftPanel } from './components/flows/FlowsLeftPanel';
import { FlowsViews } from './components/flows/FlowsViews';

type FlowViewMode = 'sankey' | 'top_paths';

interface ArgusFlowsPageProps {
  embedded?: boolean;
  tabBar?: React.ReactNode;
  panelWidth?: number;
  onPanelResizeMouseDown?: (e: React.MouseEvent) => void;
  isPanelDragging?: boolean;
}

const ArgusFlowsPage: React.FC<ArgusFlowsPageProps> = ({
  embedded = false,
  tabBar,
  panelWidth,
  onPanelResizeMouseDown,
  isPanelDragging,
}) => {
  const { t } = useTranslation();
  const { currentProject } = useOrgProject();
  const projectId = currentProject?.id || '1';

  // ── Persisted State (survives refresh) ──
  const dateRange = useFlowsStore((s) => s.dateRange);
  const setDateRange = useFlowsStore((s) => s.setDateRange);
  const anchorEventA = useFlowsStore((s) => s.anchorEventA);
  const anchorEventB = useFlowsStore((s) => s.anchorEventB);
  const showSecondAnchor = useFlowsStore((s) => s.showSecondAnchor);
  const direction = useFlowsStore((s) => s.direction);
  const stepsBefore = useFlowsStore((s) => s.stepsBefore);
  const stepsAfter = useFlowsStore((s) => s.stepsAfter);
  const depth = useFlowsStore((s) => s.depth);
  const viewMode = useFlowsStore((s) => s.viewMode);
  const setViewMode = useFlowsStore((s) => s.setViewMode);
  const excludeEvents = useFlowsStore((s) => s.excludeEvents);
  const breakdownProperties = useFlowsStore((s) => s.breakdownProperties);
  const globalFilters = useGlobalAnalyticsFilter((s) => s.filters);

  // ── Shared Event Catalog ──
  const { availableEvents, refetch: refetchEvents } =
    useSharedEventCatalog(projectId);

  // ── Transient State ──
  const [flowData, setFlowData] = useState<{
    nodes: { id: string; count: number }[];
    links: { source: string; target: string; value: number }[];
    top_paths?: { path: string[]; count: number; percentage: number }[];
    breakdowns?: Record<
      string,
      {
        nodes: { id: string; count: number }[];
        links: { source: string; target: string; value: number }[];
      }
    >;
  } | null>(null);
  const [queryLoading, setQueryLoading] = useState(false);
  const [hasQueried, setHasQueried] = useState(false);
  const [selectedBreakdown, setSelectedBreakdown] = useState<string>('');
  const isInitialMount = useRef(true);
  const lastExecutedKeyRef = useRef<string>('');

  // ── Quick lexicon editor state ──
  const [quickEditOpen, setQuickEditOpen] = useState(false);
  const [quickEditAnchor, setQuickEditAnchor] = useState<HTMLElement | null>(
    null
  );
  const [quickEditEventName, setQuickEditEventName] = useState('');

  // ── Run Query ──
  const handleRun = useCallback(async () => {
    if (!anchorEventA) return;

    const queryKey = JSON.stringify({
      projectId,
      anchorEventA,
      anchorEventB,
      showSecondAnchor,
      direction,
      stepsBefore,
      stepsAfter,
      depth,
      breakdownProperties,
      excludeEvents,
      globalFilters,
      dateRange,
    });
    lastExecutedKeyRef.current = queryKey;

    setQueryLoading(true);
    setHasQueried(true);
    try {
      const apiParams = dateRangeToApiParams(dateRange);
      const anchorEvents = [{ name: anchorEventA }];
      if (showSecondAnchor && anchorEventB) {
        anchorEvents.push({ name: anchorEventB });
      }
      const data = await argusService.getAnalyticsFlows(projectId, {
        anchor_event: { name: anchorEventA },
        anchor_events: anchorEvents,
        direction: showSecondAnchor && anchorEventB ? 'between' : direction,
        steps_before: stepsBefore,
        steps_after: stepsAfter,
        depth,
        breakdown:
          breakdownProperties.length > 0
            ? { properties: breakdownProperties }
            : undefined,
        exclude_events: excludeEvents.length > 0 ? excludeEvents : undefined,
        global_filters: globalFilters.length > 0 ? globalFilters : undefined,
        period: apiParams.period,
        start: apiParams.start,
        end: apiParams.end,
      });
      setFlowData(data);
    } catch {
      setFlowData(null);
    } finally {
      setQueryLoading(false);
    }
  }, [
    anchorEventA,
    anchorEventB,
    showSecondAnchor,
    direction,
    stepsBefore,
    stepsAfter,
    depth,
    breakdownProperties,
    excludeEvents,
    globalFilters,
    dateRange,
    projectId,
  ]);

  // Debounced auto-query running on settings change
  useEffect(() => {
    if (!anchorEventA) {
      isInitialMount.current = false;
      return;
    }

    const queryKey = JSON.stringify({
      projectId,
      anchorEventA,
      anchorEventB,
      showSecondAnchor,
      direction,
      stepsBefore,
      stepsAfter,
      depth,
      breakdownProperties,
      excludeEvents,
      globalFilters,
      dateRange,
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
    anchorEventA,
    anchorEventB,
    showSecondAnchor,
    direction,
    stepsBefore,
    stepsAfter,
    depth,
    breakdownProperties,
    excludeEvents,
    globalFilters,
    dateRange,
    projectId,
    handleRun,
  ]);

  // Lexicon Map for translating event keys
  const lexiconMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of availableEvents) {
      if (e.display_name) map.set(e.name, e.display_name);
    }
    return map;
  }, [availableEvents]);

  // ── CSV data ──
  const csvData = useMemo(() => {
    if (viewMode === 'top_paths' && flowData?.top_paths) {
      return flowData.top_paths.map((p, i) => ({
        rank: i + 1,
        path: p.path.join(' → '),
        users: p.count,
        percentage: `${p.percentage}%`,
      }));
    }
    if (flowData?.nodes) {
      return flowData.nodes.map((n) => ({ event: n.id, count: n.count }));
    }
    return [];
  }, [flowData, viewMode]);

  // ── UI: Toolbar ──
  const toolbar = (
    <>
      <InlineSelect
        value={viewMode}
        onChange={(val) => setViewMode(val as FlowViewMode)}
        options={[
          { value: 'sankey', label: t('argus.analytics.sankey', 'Sankey') },
          {
            value: 'top_paths',
            label: t('argus.analytics.topPaths', 'Top Paths'),
          },
        ]}
      />
      {!embedded && (
        <DateRangeSelector value={dateRange} onChange={setDateRange} compact />
      )}
      <CsvExportButton
        data={csvData}
        filename="flows"
        disabled={csvData.length === 0}
      />
    </>
  );

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
                { label: t('argus.analytics.flows', 'Flows') },
              ]}
              size="title"
            />
          }
          subtitle={t(
            'argus.analytics.flowsSubtitle',
            '사용자 이동 경로를 시각화하고 분석합니다.'
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
          leftPanel={
            <FlowsLeftPanel
              projectId={projectId}
              queryLoading={queryLoading}
              onRunQuery={handleRun}
              onEditOption={(val, anchor) => {
                setQuickEditEventName(val);
                setQuickEditAnchor(anchor);
                setQuickEditOpen(true);
              }}
            />
          }
          tabBar={tabBar}
          toolbar={toolbar}
          projectId={projectId}
          panelWidth={panelWidth}
          onPanelResizeMouseDown={onPanelResizeMouseDown}
          isPanelDragging={isPanelDragging}
        >
          <PageContentLoader
            loading={queryLoading || (!!anchorEventA && !hasQueried)}
            skeleton={<ArgusChartSkeleton height={400} />}
          >
            {!hasQueried ? (
              <EmptyPagePlaceholder
                message={t(
                  'argus.analytics.emptyFlows',
                  'Select an anchor event and click Run to see user flows.'
                )}
                minHeight={300}
              />
            ) : (
              <FlowsViews
                flowData={flowData}
                viewMode={viewMode}
                selectedBreakdown={selectedBreakdown}
                setSelectedBreakdown={setSelectedBreakdown}
                breakdownProperties={breakdownProperties}
                lexiconMap={lexiconMap}
              />
            )}
          </PageContentLoader>
        </AnalyticsLayout>
      </Box>
      <QuickLexiconEditor
        open={quickEditOpen}
        anchorEl={quickEditAnchor}
        eventName={quickEditEventName}
        projectId={projectId}
        onClose={() => setQuickEditOpen(false)}
        onSaved={refetchEvents}
      />
    </Box>
  );
};

export default ArgusFlowsPage;
