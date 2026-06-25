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
import argusService from '@/services/argusService';
import { useRetentionStore } from '@/hooks/useAnalyticsStore';
import { useGlobalAnalyticsFilter } from '@/hooks/useGlobalAnalyticsFilter';
import { useSharedEventCatalog } from './hooks/useSharedEventCatalog';

import AnalyticsLayout from './components/analytics/AnalyticsLayout';
import ChartTypeSelector, {
  ChartType,
} from './components/analytics/ChartTypeSelector';
import CsvExportButton from './components/analytics/CsvExportButton';
import ArgusChartSkeleton from '@/components/argus/ArgusChartSkeleton';
import PageContentLoader from '@/components/common/PageContentLoader';
import { splitBreakdownValue } from './components/analytics/breakdownUtils';
import { ArgusAnalyticsDrilldownDrawer } from './components/analytics/ArgusAnalyticsDrilldownDrawer';
import QuickLexiconEditor from './components/analytics/QuickLexiconEditor';

import { RetentionLeftPanel } from './components/retention/RetentionLeftPanel';
import { RetentionViews } from './components/retention/RetentionViews';

type RetentionViewMode = 'curve' | 'line' | 'bar' | 'table' | 'metric';

interface ArgusRetentionPageProps {
  embedded?: boolean;
  tabBar?: React.ReactNode;
  panelWidth?: number;
  onPanelResizeMouseDown?: (e: React.MouseEvent) => void;
  isPanelDragging?: boolean;
  panelRef?: React.RefObject<HTMLElement | null>;
}

const ArgusRetentionPage: React.FC<ArgusRetentionPageProps> = ({
  embedded = false,
  tabBar,
  panelWidth,
  onPanelResizeMouseDown,
  isPanelDragging,
  panelRef,
}) => {
  const { t } = useTranslation();
  const { currentProject } = useOrgProject();
  const projectId = currentProject?.id || '1';

  // ── Persisted State (survives refresh) ──
  const dateRange = useRetentionStore((s) => s.dateRange);
  const setDateRange = useRetentionStore((s) => s.setDateRange);
  const cohortEvent = useRetentionStore((s) => s.cohortEvent);
  const returnEvent = useRetentionStore((s) => s.returnEvent);
  const retentionType = useRetentionStore((s) => s.retentionType);
  const criteria = useRetentionStore((s) => s.criteria);
  const measurement = useRetentionStore((s) => s.measurement);
  const measurementProperty = useRetentionStore((s) => s.measurementProperty);
  const minFrequency = useRetentionStore((s) => s.minFrequency);
  const breakdownProperties = useRetentionStore((s) => s.breakdownProperties);
  const viewMode = useRetentionStore((s) => s.viewMode);
  const setViewMode = useRetentionStore((s) => s.setViewMode);
  const globalFilters = useGlobalAnalyticsFilter((s) => s.filters);

  // ── Shared Event Catalog (cached across tab switches) ──
  const { refetch: refetchEvents } = useSharedEventCatalog(projectId);

  // ── Transient State ──
  const [cohorts, setCohorts] = useState<any[]>([]);
  const [breakdownCohorts, setBreakdownCohorts] = useState<
    Record<string, any[]> | undefined
  >(undefined);
  const [queryLoading, setQueryLoading] = useState(false);
  const [hasQueried, setHasQueried] = useState(false);

  const isInitialMount = useRef(true);
  const lastExecutedKeyRef = useRef<string>('');

  // Drilldown state
  const [drilldownOpen, setDrilldownOpen] = useState(false);
  const [drilldownParams, setDrilldownParams] = useState<{
    eventName: string;
    dateRange: { start: Date; end: Date };
    breakdownFilters?: { property: string; value: string }[];
  } | null>(null);

  // Quick lexicon editor state
  const [quickEditOpen, setQuickEditOpen] = useState(false);
  const [quickEditAnchor, setQuickEditAnchor] = useState<HTMLElement | null>(
    null
  );
  const [quickEditEventName, setQuickEditEventName] = useState('');

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
        breakdown:
          breakdownProperties.length > 0
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
    handleRun,
  ]);

  const handleCellClick = useCallback(
    (cohortDateStr: string, periodIndex: number) => {
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

      const start = new Date(
        targetDate.getFullYear(),
        targetDate.getMonth(),
        targetDate.getDate(),
        0,
        0,
        0
      );
      const end = new Date(
        targetDate.getFullYear(),
        targetDate.getMonth(),
        targetDate.getDate(),
        23,
        59,
        59
      );

      setDrilldownParams({
        eventName: periodIndex === 0 ? cohortEvent.name : returnEvent.name,
        dateRange: { start, end },
      });
      setDrilldownOpen(true);
    },
    [cohortEvent.name, returnEvent.name, retentionType]
  );

  const handleBreakdownCellClick = useCallback(
    (breakdownValue: string, periodIndex: number) => {
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

      const parts = splitBreakdownValue(breakdownValue);
      const breakdownFilters = breakdownProperties
        .map((prop, i) => ({
          property: prop,
          value: parts[i] || '',
        }))
        .filter((f) => f.value !== '');

      setDrilldownParams({
        eventName: periodIndex === 0 ? cohortEvent.name : returnEvent.name,
        dateRange: { start: startShifted, end: endShifted },
        breakdownFilters,
      });
      setDrilldownOpen(true);
    },
    [
      cohortEvent.name,
      returnEvent.name,
      retentionType,
      dateRange,
      breakdownProperties,
    ]
  );

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

  // ── UI: Toolbar ──
  const toolbar = (
    <>
      <ChartTypeSelector
        value={viewMode as ChartType}
        onChange={(val) => setViewMode(val as RetentionViewMode)}
        availableTypes={['line', 'bar', 'table', 'metric'] as ChartType[]}
      />
      {!embedded && (
        <DateRangeSelector value={dateRange} onChange={setDateRange} compact />
      )}
      <CsvExportButton
        data={csvData}
        filename="retention"
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
                { label: t('argus.analytics.retention', 'Retention') },
              ]}
              size="title"
            />
          }
          subtitle={t(
            'argus.analytics.retentionSubtitle',
            '코호트 기반 사용자 리텐션을 측정하고 분석합니다.'
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
            <RetentionLeftPanel
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
          panelRef={panelRef}
        >
          <PageContentLoader
            loading={
              queryLoading ||
              (!!cohortEvent.name && !!returnEvent.name && !hasQueried)
            }
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
              <RetentionViews
                cohorts={cohorts}
                breakdownCohorts={breakdownCohorts}
                retentionType={retentionType}
                measurement={measurement}
                viewMode={viewMode}
                breakdownProperties={breakdownProperties}
                handleCellClick={handleCellClick}
                handleBreakdownCellClick={handleBreakdownCellClick}
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

export default ArgusRetentionPage;
