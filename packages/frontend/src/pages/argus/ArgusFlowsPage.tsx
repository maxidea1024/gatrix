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
  Chip,
  IconButton,
  Checkbox,
  Popover,
  CircularProgress,
  Collapse,
} from '@mui/material';
import {
  PlayArrow as RunIcon,
  Add as AddIcon,
  Close as CloseIcon,
  Search as SearchIcon,
  KeyboardArrowDown as ArrowDownIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import {
  Sankey,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Rectangle,
} from 'recharts';
import PageHeader from '@/components/common/PageHeader';
import ArgusBreadcrumbs from '@/components/argus/ArgusBreadcrumbs';
import DateRangeSelector, {
  DateRangeValue,
  dateRangeToApiParams,
} from '@/components/common/DateRangeSelector';
import EmptyPagePlaceholder from '@/components/common/EmptyPagePlaceholder';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import argusService, { type AnalyticsEventNameEntry } from '@/services/argusService';
import { renderLexiconIcon } from '@/utils/lexiconIcons';
import EventLabel from '@/components/argus/EventLabel';
import { useLocalizedLexicon } from '@/pages/argus/hooks/useLocalizedLexicon';
import { useFlowsStore } from '@/hooks/useAnalyticsStore';
import { useGlobalAnalyticsFilter } from '@/hooks/useGlobalAnalyticsFilter';
import { useLocalStorage } from '@/hooks/useLocalStorage';

import AnalyticsLayout from './components/analytics/AnalyticsLayout';
import EventBlock from './components/analytics/EventBlock';
import InlineSelect from './components/analytics/InlineSelect';
import PropertyPicker from './components/analytics/PropertyPicker';
import BreakdownSection from './components/analytics/BreakdownSection';
import CsvExportButton from './components/analytics/CsvExportButton';
import ArgusChartSkeleton from '@/components/argus/ArgusChartSkeleton';
import PageContentLoader from '@/components/common/PageContentLoader';
import { formatCompactNumber } from '@/utils/numberFormat';
import {
  formatBreakdownLabel,
  splitBreakdownValue,
} from './components/analytics/breakdownUtils';
import QuickLexiconEditor from './components/analytics/QuickLexiconEditor';

/* ─── Types ─── */

type FlowViewMode = 'sankey' | 'top_paths';

/* ─── Constants ─── */

const NODE_COLORS = [
  '#6366f1',
  '#ec4899',
  '#f59e0b',
  '#10b981',
  '#3b82f6',
  '#ef4444',
  '#8b5cf6',
  '#14b8a6',
  '#f97316',
  '#a3e635',
];

/* ─── Component ─── */

const ArgusFlowsPage: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';
  const { currentProject } = useOrgProject();
  const projectId = currentProject?.id || '1';

  // ── Persisted State (survives refresh) ──
  const dateRange = useFlowsStore((s) => s.dateRange);
  const setDateRange = useFlowsStore((s) => s.setDateRange);
  const anchorEventA = useFlowsStore((s) => s.anchorEventA);
  const setAnchorEventA = useFlowsStore((s) => s.setAnchorEventA);
  const anchorEventB = useFlowsStore((s) => s.anchorEventB);
  const setAnchorEventB = useFlowsStore((s) => s.setAnchorEventB);
  const showSecondAnchor = useFlowsStore((s) => s.showSecondAnchor);
  const setShowSecondAnchor = useFlowsStore((s) => s.setShowSecondAnchor);
  const direction = useFlowsStore((s) => s.direction);
  const setDirection = useFlowsStore((s) => s.setDirection);
  const stepsBefore = useFlowsStore((s) => s.stepsBefore);
  const setStepsBefore = useFlowsStore((s) => s.setStepsBefore);
  const stepsAfter = useFlowsStore((s) => s.stepsAfter);
  const setStepsAfter = useFlowsStore((s) => s.setStepsAfter);
  const depth = useFlowsStore((s) => s.depth);
  const setDepth = useFlowsStore((s) => s.setDepth);
  const viewMode = useFlowsStore((s) => s.viewMode);
  const setViewMode = useFlowsStore((s) => s.setViewMode);
  const excludeEvents = useFlowsStore((s) => s.excludeEvents);
  const setExcludeEvents = useFlowsStore((s) => s.setExcludeEvents);
  const breakdownProperties = useFlowsStore((s) => s.breakdownProperties);
  const setBreakdownProperties = useFlowsStore((s) => s.setBreakdownProperties);
  const globalFilters = useGlobalAnalyticsFilter((s) => s.filters);

  // ── Transient State ──
  const [availableEvents, setAvailableEvents] = useState<AnalyticsEventNameEntry[]>([]);
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
  const [settingsExpanded, setSettingsExpanded] = useLocalStorage<boolean>(
    'argus_flows_settings_expanded',
    false
  );
  const [selectedBreakdown, setSelectedBreakdown] = useState<string>('');
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const isInitialMount = useRef(true);
  const lastExecutedKeyRef = useRef<string>('');

  // ── Fetch event names ──
  const fetchEventNames = useCallback(async () => {
    try {
      const data = await argusService.getAnalyticsEventNames(
        projectId,
        '30d'
      );
      setAvailableEvents(data);
    } catch {
      setAvailableEvents([]);
    }
  }, [projectId]);

  useEffect(() => {
    fetchEventNames();
  }, [fetchEventNames]);

  // Quick lexicon editor state
  const [quickEditOpen, setQuickEditOpen] = useState(false);
  const [quickEditAnchor, setQuickEditAnchor] = useState<HTMLElement | null>(null);
  const [quickEditEventName, setQuickEditEventName] = useState('');

  // ── Derived direction ──
  useEffect(() => {
    if (showSecondAnchor && anchorEventB) {
      setDirection('between');
    } else if (direction === 'between') {
      setDirection('after');
    }
  }, [showSecondAnchor, anchorEventB]);

  // ── Exclude events toggle ──
  const toggleExclude = useCallback(
    (eventName: string) => {
      setExcludeEvents(
        excludeEvents.includes(eventName)
          ? excludeEvents.filter((e) => e !== eventName)
          : [...excludeEvents, eventName]
      );
    },
    [excludeEvents, setExcludeEvents]
  );

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

  // Event metadata map for EventLabel
  const eventMetaMap = useMemo(() => {
    const map = new Map<string, AnalyticsEventNameEntry>();
    for (const e of availableEvents) {
      map.set(e.name, e);
    }
    return map;
  }, [availableEvents]);

  // ── Sankey data ──
  const sankeyData = useMemo(() => {
    if (!flowData || flowData.nodes.length === 0) return null;

    // Use breakdown-filtered data if a breakdown value is selected
    const activeData =
      selectedBreakdown && flowData.breakdowns?.[selectedBreakdown]
        ? flowData.breakdowns[selectedBreakdown]
        : flowData;

    if (!activeData || activeData.nodes.length === 0) return null;

    const nodeIdxMap = new Map<string, number>();
    activeData.nodes.forEach((n, i) => nodeIdxMap.set(n.id, i));
    const nodes = activeData.nodes.map((n) => ({ name: lexiconMap.get(n.id) || n.id }));
    let links = activeData.links
      .filter(
        (l) =>
          nodeIdxMap.has(l.source) &&
          nodeIdxMap.has(l.target) &&
          nodeIdxMap.get(l.source) !== nodeIdxMap.get(l.target)
      )
      .map((l) => ({
        source: nodeIdxMap.get(l.source)!,
        target: nodeIdxMap.get(l.target)!,
        value: l.value,
      }));

    // Remove cycles using DFS to prevent Recharts Maximum call stack size exceeded error
    const adj = new Map<number, Set<number>>();
    nodes.forEach((_, i) => adj.set(i, new Set()));

    const validLinks: typeof links = [];
    for (const link of links) {
      let hasCycle = false;
      const visited = new Set<number>();
      const stack = [link.target];
      while (stack.length > 0) {
        const curr = stack.pop()!;
        if (curr === link.source) {
          hasCycle = true;
          break;
        }
        if (!visited.has(curr)) {
          visited.add(curr);
          adj.get(curr)?.forEach((next) => stack.push(next));
        }
      }
      if (!hasCycle) {
        adj.get(link.source)?.add(link.target);
        validLinks.push(link);
      }
    }

    if (validLinks.length === 0) return null;
    return { nodes, links: validLinks };
  }, [flowData, selectedBreakdown, lexiconMap]);

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

  const { localizeEventName: lfn, localizeEventDescription: lfd } = useLocalizedLexicon();

  const eventOptions = useMemo(
    () => availableEvents.map((e) => ({ value: e.name, label: lfn(e.name, e.display_name, e.is_reserved), icon: renderLexiconIcon(e.icon, 18, e.icon_color || undefined), meta: { eventKey: e.name, description: lfd(e.name, e.description, e.is_reserved) || undefined, category: e.category || undefined, count: e.count, isReserved: e.is_reserved } })),
    [availableEvents, lfn, lfd]
  );

  // ── UI: Left Panel ──
  const leftPanel = (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {/* Anchor Events */}
      <Box>
        <Typography
          variant="overline"
          sx={{ fontWeight: 700, color: 'text.secondary', ml: 0.5 }}
        >
          {t('argus.analytics.flowConfiguration', 'Flow Configuration')}
        </Typography>
        <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {/* Anchor A */}
          <EventBlock indexLabel="A" color="#ec4899">
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 0.5,
              }}
            >
              <Typography variant="caption" color="text.secondary">
                {t('argus.analytics.anchor', 'Anchor')}
              </Typography>
              <InlineSelect
                value={anchorEventA}
                onChange={setAnchorEventA}
                options={eventOptions}
                emptyLabel={t('argus.analytics.selectEvent', 'Select Event')}
                highlightEmpty
                onEditOption={(val, anchor) => {
                  setQuickEditEventName(val);
                  setQuickEditAnchor(anchor);
                  setQuickEditOpen(true);
                }}
              />
            </Box>
          </EventBlock>

          {/* Anchor B (optional) */}
          {showSecondAnchor && (
            <>
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  my: -1,
                }}
              >
                {/* Dotted line top */}
                <Box
                  sx={{
                    width: 0,
                    height: 14,
                    borderLeft: `2px dashed ${isDark ? 'rgba(236,72,153,0.4)' : 'rgba(236,72,153,0.3)'}`,
                  }}
                />
                {/* Arrow circle */}
                <Box
                  sx={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    border: `2px solid ${isDark ? 'rgba(236,72,153,0.45)' : 'rgba(236,72,153,0.35)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: 'background.paper',
                    zIndex: 2,
                  }}
                >
                  <ArrowDownIcon
                    sx={{
                      fontSize: 14,
                      color: isDark
                        ? 'rgba(236,72,153,0.7)'
                        : 'rgba(236,72,153,0.5)',
                    }}
                  />
                </Box>
                {/* Dotted line bottom */}
                <Box
                  sx={{
                    width: 0,
                    height: 14,
                    borderLeft: `2px dashed ${isDark ? 'rgba(236,72,153,0.4)' : 'rgba(236,72,153,0.3)'}`,
                  }}
                />
              </Box>
              <EventBlock
                indexLabel="B"
                color="#f59e0b"
                onRemove={() => {
                  setShowSecondAnchor(false);
                  setAnchorEventB('');
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 0.5,
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    {t('argus.analytics.anchor', 'Anchor')}
                  </Typography>
                  <InlineSelect
                    value={anchorEventB}
                    onChange={setAnchorEventB}
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
                </Box>
              </EventBlock>
            </>
          )}

          {!showSecondAnchor && (
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={() => setShowSecondAnchor(true)}
              sx={{
                alignSelf: 'flex-start',
                textTransform: 'none',
                borderRadius: 1.5,
                mt: 0.5,
              }}
            >
              {t('argus.analytics.addSecondAnchor', 'Add 2nd Anchor (Between)')}
            </Button>
          )}
        </Box>
      </Box>

      <Divider sx={{ opacity: isDark ? 0.05 : 0.5 }} />

      {/* Settings */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
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
          <Box
            sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 0.5 }}
          >
            {/* Direction */}
            {!showSecondAnchor && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ minWidth: 70, flexShrink: 0, fontSize: '0.75rem' }}
                >
                  {t('argus.analytics.direction', 'Direction')}
                </Typography>
                <InlineSelect
                  value={direction}
                  onChange={(val) => setDirection(val as any)}
                  options={[
                    {
                      value: 'after',
                      label: t('argus.analytics.after', 'After'),
                    },
                    {
                      value: 'before',
                      label: t('argus.analytics.before', 'Before'),
                    },
                  ]}
                />
              </Box>
            )}

            {/* Steps before/after */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ minWidth: 70, flexShrink: 0, fontSize: '0.75rem' }}
              >
                {direction === 'before'
                  ? t('argus.analytics.stepsBefore', 'Steps Before')
                  : t('argus.analytics.stepsAfter', 'Steps After')}
              </Typography>
              <InlineSelect
                value={String(
                  direction === 'before' ? stepsBefore : stepsAfter
                )}
                onChange={(val) => {
                  const n = Number(val);
                  if (direction === 'before') setStepsBefore(n);
                  else setStepsAfter(n);
                }}
                options={[1, 2, 3, 4, 5, 6].map((n) => ({
                  value: String(n),
                  label: String(n),
                }))}
              />
            </Box>

            {/* Depth */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ minWidth: 70, flexShrink: 0, fontSize: '0.75rem' }}
              >
                {t('argus.analytics.depth', 'Depth')}
              </Typography>
              <InlineSelect
                value={String(depth)}
                onChange={(val) => setDepth(Number(val))}
                options={[2, 3, 4, 5, 6, 8].map((n) => ({
                  value: String(n),
                  label: String(n),
                }))}
              />
            </Box>
          </Box>
        </Collapse>
      </Box>

      <Divider sx={{ opacity: isDark ? 0.05 : 0.5 }} />

      {/* Exclude Events */}
      <Box>
        <Typography
          variant="overline"
          sx={{ fontWeight: 700, color: 'text.secondary', ml: 0.5 }}
        >
          {t('argus.analytics.excludeEvents', 'Exclude Events')}
        </Typography>
        <Box
          sx={{
            mt: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 0.5,
            maxHeight: 150,
            overflowY: 'auto',
          }}
        >
          {availableEvents.slice(0, 20).map((e) => (
            <Box
              key={e.name}
              onClick={() => toggleExclude(e.name)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                px: 1,
                py: 0.25,
                borderRadius: 1,
                cursor: 'pointer',
                fontSize: '0.75rem',
                color: excludeEvents.includes(e.name)
                  ? 'error.main'
                  : 'text.primary',
                textDecoration: excludeEvents.includes(e.name)
                  ? 'line-through'
                  : 'none',
                opacity: excludeEvents.includes(e.name) ? 0.5 : 1,
                '&:hover': {
                  bgcolor: isDark
                    ? 'rgba(255,255,255,0.04)'
                    : 'rgba(0,0,0,0.04)',
                },
              }}
            >
              <Checkbox
                size="small"
                checked={!excludeEvents.includes(e.name)}
                sx={{ p: 0.25, '& .MuiSvgIcon-root': { fontSize: 14 } }}
              />
              <EventLabel
                eventName={e.name}
                displayName={e.display_name}
                icon={e.icon}
                iconColor={e.icon_color}
                isReserved={e.is_reserved}
                size="compact"
              />
            </Box>
          ))}
        </Box>
      </Box>

      <Divider sx={{ opacity: isDark ? 0.05 : 0.5 }} />

      {/* Breakdown */}
      <BreakdownSection
        projectId={projectId}
        eventName={anchorEventA}
        value={breakdownProperties}
        onChange={setBreakdownProperties}
      />

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
          onClick={handleRun}
          disabled={queryLoading || !anchorEventA}
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
      <DateRangeSelector value={dateRange} onChange={setDateRange} compact />
      <CsvExportButton
        data={csvData}
        filename="flows"
        disabled={csvData.length === 0}
      />
    </>
  );

  // ── Render: Sankey ──
  const renderSankey = () => {
    if (!sankeyData)
      return (
        <EmptyPagePlaceholder
          message={t('argus.analytics.noFlowData', 'No flow data available.')}
          minHeight={300}
        />
      );

    const BD_COLORS_SANKEY = [
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
    const bdKeys = flowData?.breakdowns ? Object.keys(flowData.breakdowns) : [];
    const selectedBdIdx = selectedBreakdown
      ? bdKeys.indexOf(selectedBreakdown)
      : -1;
    const selectedBdColor =
      selectedBdIdx >= 0
        ? BD_COLORS_SANKEY[selectedBdIdx % BD_COLORS_SANKEY.length]
        : undefined;

    return (
      <Box sx={{ width: '100%' }}>
        {/* Breakdown indicator */}
        {flowData?.breakdowns &&
          Object.keys(flowData.breakdowns).length > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontSize: '0.72rem' }}
              >
                {t('argus.analytics.showing', 'Showing')}:
              </Typography>
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.5,
                  px: 1,
                  py: 0.25,
                  borderRadius: 1,
                  bgcolor: selectedBdColor
                    ? alpha(selectedBdColor, 0.15)
                    : isDark
                      ? 'rgba(255,255,255,0.06)'
                      : 'rgba(0,0,0,0.04)',
                  border: `1px solid ${
                    selectedBdColor
                      ? alpha(selectedBdColor, 0.3)
                      : isDark
                        ? 'rgba(255,255,255,0.1)'
                        : 'rgba(0,0,0,0.08)'
                  }`,
                }}
              >
                {selectedBdColor && (
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      bgcolor: selectedBdColor,
                    }}
                  />
                )}
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 700,
                    fontSize: '0.72rem',
                    color: selectedBdColor || theme.palette.text.primary,
                  }}
                >
                  {selectedBreakdown
                    ? formatBreakdownLabel(
                        selectedBreakdown,
                        breakdownProperties
                      )
                    : t('common.all', 'All')}
                </Typography>
              </Box>
              <Typography
                variant="caption"
                color="text.disabled"
                sx={{ fontSize: '0.68rem', fontStyle: 'italic' }}
              >
                {t(
                  'argus.analytics.clickTableToSwitch',
                  '↑ Click a row above to switch'
                )}
              </Typography>
            </Box>
          )}
        <Box
          sx={{
            height: { xs: 400, md: '60vh' },
            minHeight: 450,
            maxHeight: 750,
            pr: 2,
          }}
        >
          <ResponsiveContainer
            width="100%"
            height="100%"
            minWidth={0}
            minHeight={0}
          >
            <Sankey
              data={sankeyData}
              node={
                <CustomSankeyNode
                  isDark={isDark}
                  theme={theme}
                  onHoverNode={setHoveredNode}
                />
              }
              link={
                <CustomSankeyLink isDark={isDark} hoveredNode={hoveredNode} />
              }
              margin={{ top: 20, right: 100, bottom: 20, left: 100 }}
              nodePadding={24}
              nodeWidth={12}
              iterations={0}
            >
              <RechartsTooltip
                wrapperStyle={{ zIndex: 1000 }}
                contentStyle={{
                  background: isDark ? '#1e1e2e' : '#fff',
                  color: isDark ? '#e4e4e7' : '#1a1a2e',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                  borderRadius: 8,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                  fontSize: 12,
                }}
                itemStyle={{ color: isDark ? '#e4e4e7' : '#1a1a2e' }}
                labelStyle={{
                  color: isDark ? '#a1a1aa' : '#52525b',
                  fontWeight: 600,
                }}
              />
            </Sankey>
          </ResponsiveContainer>
        </Box>
      </Box>
    );
  };

  // ── Render: Top Paths ──
  const renderTopPaths = () => {
    const paths = flowData?.top_paths;
    if (!paths || paths.length === 0) {
      return (
        <EmptyPagePlaceholder
          message={t(
            'argus.analytics.topPathsEmpty',
            'No top paths data available.'
          )}
          minHeight={300}
        />
      );
    }

    return (
      <Box sx={{ overflowX: 'auto' }}>
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
                }}
              >
                #
              </th>
              <th
                style={{
                  textAlign: 'left',
                  padding: '12px 16px',
                  borderBottom: `2px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                  color: theme.palette.text.secondary,
                  fontWeight: 600,
                }}
              >
                Path
              </th>
              <th
                style={{
                  textAlign: 'right',
                  padding: '12px 16px',
                  borderBottom: `2px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
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
                  borderBottom: `2px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                  color: theme.palette.text.secondary,
                  fontWeight: 600,
                }}
              >
                %
              </th>
            </tr>
          </thead>
          <tbody>
            {paths.map((p, idx) => (
              <tr
                key={idx}
                style={{
                  borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}`,
                }}
              >
                <td
                  style={{
                    padding: '10px 16px',
                    fontWeight: 600,
                    color: theme.palette.text.secondary,
                  }}
                >
                  {idx + 1}
                </td>
                <td style={{ padding: '10px 16px' }}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 0.5,
                    }}
                  >
                    {p.path.map((step, sIdx) => (
                      <React.Fragment key={sIdx}>
                        <Chip
                          label={lexiconMap.get(step) || step}
                          size="small"
                          sx={{
                            height: 22,
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            bgcolor: alpha(
                              NODE_COLORS[sIdx % NODE_COLORS.length],
                              isDark ? 0.2 : 0.1
                            ),
                            color: NODE_COLORS[sIdx % NODE_COLORS.length],
                            border: `1px solid ${alpha(
                              NODE_COLORS[sIdx % NODE_COLORS.length],
                              0.3
                            )}`,
                          }}
                        />
                        {sIdx < p.path.length - 1 && (
                          <Typography
                            variant="caption"
                            color="text.disabled"
                            sx={{ px: 0.25 }}
                          >
                            →
                          </Typography>
                        )}
                      </React.Fragment>
                    ))}
                  </Box>
                </td>
                <td
                  style={{
                    padding: '10px 16px',
                    textAlign: 'right',
                    fontWeight: 600,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {p.count.toLocaleString()}
                </td>
                <td
                  style={{
                    padding: '10px 16px',
                    textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {p.percentage}%
                </td>
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
              { label: t('argus.analytics.flows', 'Flows') },
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
        <AnalyticsLayout
          leftPanel={leftPanel}
          toolbar={toolbar}
          projectId={projectId}
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
              <Box sx={{ flexGrow: 1 }}>
                {/* Breakdown summary table + selector */}
                {flowData?.breakdowns &&
                  Object.keys(flowData.breakdowns).length > 0 &&
                  (() => {
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
                    const borderColor = isDark
                      ? 'rgba(255,255,255,0.08)'
                      : 'rgba(0,0,0,0.08)';
                    const hoverBg = isDark
                      ? 'rgba(255,255,255,0.03)'
                      : 'rgba(0,0,0,0.02)';

                    const buildRow = (
                      label: string,
                      data: { nodes: any[]; links: any[] },
                      color: string,
                      isAll: boolean
                    ) => {
                      const totalEvents = data.links.reduce(
                        (s, l) => s + l.value,
                        0
                      );
                      const uniqueNodes = data.nodes.length;
                      // Find top path (highest value link)
                      const topLink =
                        data.links.length > 0
                          ? data.links.reduce(
                              (max, l) => (l.value > max.value ? l : max),
                              data.links[0]
                            )
                          : null;
                      const topPath = topLink
                        ? `${topLink.source} → ${topLink.target}`
                        : '—';
                      return {
                        label,
                        color,
                        totalEvents,
                        uniqueNodes,
                        topPath,
                        isAll,
                      };
                    };

                    const allRow = buildRow(
                      t('common.all', 'All'),
                      flowData,
                      '#94a3b8',
                      true
                    );
                    const bdKeys = Object.keys(flowData.breakdowns!);
                    const bdTableRows = bdKeys
                      .map((bv, idx) =>
                        buildRow(
                          bv,
                          flowData.breakdowns![bv],
                          BD_COLORS[idx % BD_COLORS.length],
                          false
                        )
                      )
                      .sort((a, b) => b.totalEvents - a.totalEvents);

                    const tableRows = [allRow, ...bdTableRows];
                    const maxEvents = Math.max(
                      ...tableRows.map((r) => r.totalEvents),
                      1
                    );

                    const thStyle: React.CSSProperties = {
                      padding: '8px 12px',
                      borderBottom: `1px solid ${borderColor}`,
                      color: theme.palette.text.secondary,
                      fontWeight: 600,
                      fontSize: '0.72rem',
                      whiteSpace: 'nowrap',
                    };

                    return (
                      <Box sx={{ mb: 2 }}>
                        <Typography
                          variant="subtitle2"
                          fontWeight={700}
                          sx={{
                            mb: 1,
                            px: 0.5,
                            color: 'text.secondary',
                            fontSize: '0.78rem',
                          }}
                        >
                          {t(
                            'argus.analytics.breakdownComparison',
                            'Breakdown Comparison'
                          )}
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
                              fontSize: '0.78rem',
                            }}
                          >
                            <thead>
                              <tr>
                                {breakdownProperties.length > 1 ? (
                                  breakdownProperties.map((prop) => (
                                    <th
                                      key={prop}
                                      style={{
                                        ...thStyle,
                                        textAlign: 'left',
                                        minWidth: 90,
                                      }}
                                    >
                                      {prop}
                                    </th>
                                  ))
                                ) : (
                                  <th
                                    style={{
                                      ...thStyle,
                                      textAlign: 'left',
                                      minWidth: 120,
                                    }}
                                  >
                                    {t(
                                      'argus.analytics.breakdownValue',
                                      'Breakdown Value'
                                    )}
                                  </th>
                                )}
                                <th
                                  style={{
                                    ...thStyle,
                                    textAlign: 'left',
                                    minWidth: 180,
                                  }}
                                >
                                  {t(
                                    'argus.analytics.eventCount',
                                    'Event Count'
                                  )}
                                </th>
                                <th
                                  style={{
                                    ...thStyle,
                                    textAlign: 'right',
                                    minWidth: 70,
                                  }}
                                >
                                  {t(
                                    'argus.analytics.uniquePaths',
                                    'Unique Paths'
                                  )}
                                </th>
                                <th
                                  style={{
                                    ...thStyle,
                                    textAlign: 'left',
                                    minWidth: 140,
                                  }}
                                >
                                  {t('argus.analytics.topPath', 'Top Path')}
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {tableRows.map((row, idx) => {
                                const isActive = row.isAll
                                  ? !selectedBreakdown
                                  : selectedBreakdown === row.label;
                                return (
                                  <tr
                                    key={idx}
                                    style={{
                                      borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
                                      cursor: 'pointer',
                                      opacity: row.isAll ? 0.7 : 1,
                                      backgroundColor: isActive
                                        ? isDark
                                          ? 'rgba(99,102,241,0.08)'
                                          : 'rgba(99,102,241,0.04)'
                                        : 'transparent',
                                    }}
                                    onClick={() =>
                                      setSelectedBreakdown(
                                        row.isAll ? '' : row.label
                                      )
                                    }
                                    onMouseEnter={(e) => {
                                      if (!isActive)
                                        (
                                          e.currentTarget as HTMLElement
                                        ).style.backgroundColor = hoverBg;
                                    }}
                                    onMouseLeave={(e) => {
                                      if (!isActive)
                                        (
                                          e.currentTarget as HTMLElement
                                        ).style.backgroundColor = 'transparent';
                                    }}
                                  >
                                    {breakdownProperties.length > 1 &&
                                    !row.isAll ? (
                                      splitBreakdownValue(row.label).map(
                                        (part: string, pIdx: number) => (
                                          <td
                                            key={pIdx}
                                            style={{
                                              padding: '8px 12px',
                                              fontWeight: isActive ? 700 : 500,
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
                                                  maxWidth: 130,
                                                }}
                                              >
                                                {part || '(empty)'}
                                              </span>
                                              {pIdx === 0 && isActive && (
                                                <Box
                                                  sx={{
                                                    width: 6,
                                                    height: 6,
                                                    borderRadius: '50%',
                                                    bgcolor:
                                                      theme.palette.primary
                                                        .main,
                                                    ml: 0.5,
                                                    flexShrink: 0,
                                                  }}
                                                />
                                              )}
                                            </Box>
                                          </td>
                                        )
                                      )
                                    ) : (
                                      <td
                                        style={{
                                          padding: '8px 12px',
                                          fontWeight: isActive ? 700 : 500,
                                        }}
                                        colSpan={
                                          breakdownProperties.length > 1
                                            ? breakdownProperties.length
                                            : 1
                                        }
                                      >
                                        <Box
                                          sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 1,
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
                                              maxWidth: 130,
                                            }}
                                          >
                                            {row.label}
                                          </span>
                                          {isActive && (
                                            <Box
                                              sx={{
                                                width: 6,
                                                height: 6,
                                                borderRadius: '50%',
                                                bgcolor:
                                                  theme.palette.primary.main,
                                                ml: 0.5,
                                                flexShrink: 0,
                                              }}
                                            />
                                          )}
                                        </Box>
                                      </td>
                                    )}
                                    <td style={{ padding: '8px 12px' }}>
                                      <Box
                                        sx={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: 1,
                                        }}
                                      >
                                        <Box
                                          sx={{
                                            flex: 1,
                                            height: 14,
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
                                              width: `${(row.totalEvents / maxEvents) * 100}%`,
                                              bgcolor: alpha(row.color, 0.6),
                                              borderRadius: 0.5,
                                              transition: 'width 0.3s ease',
                                            }}
                                          />
                                        </Box>
                                        <Typography
                                          variant="caption"
                                          sx={{
                                            fontWeight: 600,
                                            minWidth: 40,
                                            textAlign: 'right',
                                            fontVariantNumeric: 'tabular-nums',
                                          }}
                                        >
                                          {formatCompactNumber(row.totalEvents)}
                                        </Typography>
                                      </Box>
                                    </td>
                                    <td
                                      style={{
                                        padding: '8px 12px',
                                        textAlign: 'right',
                                        fontWeight: 500,
                                        fontVariantNumeric: 'tabular-nums',
                                      }}
                                    >
                                      {row.uniqueNodes}
                                    </td>
                                    <td
                                      style={{
                                        padding: '8px 12px',
                                        fontSize: '0.72rem',
                                        color: theme.palette.text.secondary,
                                      }}
                                    >
                                      {row.topPath}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </Box>
                      </Box>
                    );
                  })()}
                {viewMode === 'sankey' && renderSankey()}
                {viewMode === 'top_paths' && renderTopPaths()}
              </Box>
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
        onSaved={fetchEventNames}
      />
    </Box>
  );
};

/* ─── Custom Sankey Node ─── */

interface CustomSankeyNodeProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  index?: number;
  payload?: { name: string; value: number };
  isDark: boolean;
  theme: any;
  onHoverNode?: (name: string | null) => void;
}

const CustomSankeyNode: React.FC<CustomSankeyNodeProps> = ({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  index = 0,
  payload,
  isDark,
  theme,
  onHoverNode,
}) => {
  if (!payload) return null;
  const color = NODE_COLORS[index % NODE_COLORS.length];
  return (
    <g
      onMouseEnter={() => onHoverNode?.(payload.name)}
      onMouseLeave={() => onHoverNode?.(null)}
      style={{ cursor: 'pointer' }}
    >
      <Rectangle
        x={x}
        y={y}
        width={width}
        height={height}
        fill={color}
        fillOpacity={0.9}
        rx={3}
        ry={3}
      />
      <text
        x={x + width + 8}
        y={y + height / 2}
        textAnchor="start"
        dominantBaseline="central"
        fill={isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)'}
        fontSize={11}
        fontWeight={600}
      >
        {payload.name}
      </text>
    </g>
  );
};

/* ─── Custom Sankey Link ─── */

interface CustomSankeyLinkProps {
  sourceX?: number;
  targetX?: number;
  sourceY?: number;
  targetY?: number;
  sourceControlX?: number;
  targetControlX?: number;
  linkWidth?: number;
  index?: number;
  payload?: any;
  isDark: boolean;
  hoveredNode: string | null;
}

const CustomSankeyLink: React.FC<CustomSankeyLinkProps> = ({
  sourceX = 0,
  targetX = 0,
  sourceY = 0,
  targetY = 0,
  sourceControlX = 0,
  targetControlX = 0,
  linkWidth = 0,
  payload,
  isDark,
  hoveredNode,
}) => {
  // Recharts resolves source/target to full node objects with `name`
  const srcName =
    typeof payload?.source === 'object' ? payload.source.name : undefined;
  const tgtName =
    typeof payload?.target === 'object' ? payload.target.name : undefined;

  const isConnected =
    hoveredNode === null || srcName === hoveredNode || tgtName === hoveredNode;

  const baseColor = isDark ? 'rgba(255,255,255,' : 'rgba(0,0,0,';
  const opacity = isConnected ? (hoveredNode !== null ? 0.25 : 0.15) : 0.03;

  return (
    <path
      d={`
        M${sourceX},${sourceY}
        C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}
      `}
      fill="none"
      stroke={`${baseColor}${opacity})`}
      strokeWidth={linkWidth}
      strokeLinecap="butt"
      style={{ transition: 'stroke 0.15s ease' }}
    />
  );
};

export default ArgusFlowsPage;
