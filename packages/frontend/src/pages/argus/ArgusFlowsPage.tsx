import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
} from '@mui/material';
import {
  PlayArrow as RunIcon,
  Add as AddIcon,
  Close as CloseIcon,
  Search as SearchIcon,
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
import argusService from '@/services/argusService';
import { useFlowsStore } from '@/hooks/useAnalyticsStore';

import AnalyticsLayout from './components/analytics/AnalyticsLayout';
import EventBlock from './components/analytics/EventBlock';
import InlineSelect from './components/analytics/InlineSelect';
import PropertyPicker from './components/analytics/PropertyPicker';
import CsvExportButton from './components/analytics/CsvExportButton';
import ArgusChartSkeleton from '@/components/argus/ArgusChartSkeleton';
import PageContentLoader from '@/components/common/PageContentLoader';

/* ─── Types ─── */

type FlowViewMode = 'sankey' | 'top_paths';

/* ─── Constants ─── */

const NODE_COLORS = [
  '#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6',
  '#ef4444', '#8b5cf6', '#14b8a6', '#f97316', '#a3e635',
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
  const breakdownProperty = useFlowsStore((s) => s.breakdownProperty);
  const setBreakdownProperty = useFlowsStore((s) => s.setBreakdownProperty);

  // ── Transient State ──
  const [availableEvents, setAvailableEvents] = useState<string[]>([]);
  const [flowData, setFlowData] = useState<{
    nodes: { id: string; count: number }[];
    links: { source: string; target: string; value: number }[];
    top_paths?: { path: string[]; count: number; percentage: number }[];
  } | null>(null);
  const [queryLoading, setQueryLoading] = useState(false);
  const [hasQueried, setHasQueried] = useState(false);

  // ── Fetch event names ──
  useEffect(() => {
    (async () => {
      try {
        const data = await argusService.getAnalyticsEventNames(projectId, '30d');
        setAvailableEvents(data.map((e) => e.name));
      } catch {
        setAvailableEvents([]);
      }
    })();
  }, [projectId]);

  // ── Derived direction ──
  useEffect(() => {
    if (showSecondAnchor && anchorEventB) {
      setDirection('between');
    } else if (direction === 'between') {
      setDirection('after');
    }
  }, [showSecondAnchor, anchorEventB]);

  // ── Exclude events toggle ──
  const toggleExclude = useCallback((eventName: string) => {
    setExcludeEvents(
      excludeEvents.includes(eventName)
        ? excludeEvents.filter((e) => e !== eventName)
        : [...excludeEvents, eventName]
    );
  }, [excludeEvents, setExcludeEvents]);

  // ── Run Query ──
  const handleRun = useCallback(async () => {
    if (!anchorEventA) return;
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
        view: viewMode,
        breakdown: breakdownProperty ? { property: breakdownProperty } : undefined,
        exclude_events: excludeEvents.length > 0 ? excludeEvents : undefined,
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
  }, [anchorEventA, anchorEventB, showSecondAnchor, direction, stepsBefore, stepsAfter, depth, viewMode, breakdownProperty, excludeEvents, dateRange, projectId]);

  // ── Sankey data ──
  const sankeyData = useMemo(() => {
    if (!flowData || flowData.nodes.length === 0) return null;
    const nodeIdxMap = new Map<string, number>();
    flowData.nodes.forEach((n, i) => nodeIdxMap.set(n.id, i));
    const nodes = flowData.nodes.map((n) => ({ name: n.id }));
    let links = flowData.links
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
  }, [flowData]);

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

  const eventOptions = useMemo(
    () => availableEvents.map((name) => ({ value: name, label: name })),
    [availableEvents]
  );

  // ── UI: Left Panel ──
  const leftPanel = (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Anchor Events */}
      <Box>
        <Typography variant="overline" sx={{ fontWeight: 700, color: 'text.secondary', ml: 0.5 }}>
          {t('argus.analytics.flowConfiguration', 'Flow Configuration')}
        </Typography>
        <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {/* Anchor A */}
          <EventBlock indexLabel="A" color="#ec4899">
            <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.5 }}>
              <Typography variant="caption" color="text.secondary">
                {t('argus.analytics.anchor', 'Anchor')}
              </Typography>
              <InlineSelect
                value={anchorEventA}
                onChange={setAnchorEventA}
                options={eventOptions}
                emptyLabel={t('argus.analytics.selectEvent', 'Select Event')}
                highlightEmpty
              />
            </Box>
          </EventBlock>

          {/* Anchor B (optional) */}
          {showSecondAnchor && (
            <>
              <Box sx={{ display: 'flex', justifyContent: 'center', my: -0.5 }}>
                <Box sx={{ width: 2, height: 12, bgcolor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }} />
              </Box>
              <EventBlock
                indexLabel="B"
                color="#f59e0b"
                onRemove={() => {
                  setShowSecondAnchor(false);
                  setAnchorEventB('');
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">
                    {t('argus.analytics.anchor', 'Anchor')}
                  </Typography>
                  <InlineSelect
                    value={anchorEventB}
                    onChange={setAnchorEventB}
                    options={eventOptions}
                    emptyLabel={t('argus.analytics.selectEvent', 'Select Event')}
                    highlightEmpty
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
              sx={{ alignSelf: 'flex-start', textTransform: 'none', borderRadius: 1.5, mt: 0.5 }}
            >
              {t('argus.analytics.addSecondAnchor', 'Add 2nd Anchor (Between)')}
            </Button>
          )}
        </Box>
      </Box>

      <Divider sx={{ opacity: isDark ? 0.05 : 0.5 }} />

      {/* Settings */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Typography variant="overline" sx={{ fontWeight: 700, color: 'text.secondary', ml: 0.5 }}>
          {t('argus.analytics.settings', 'Settings')}
        </Typography>

        {/* Direction */}
        {!showSecondAnchor && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ minWidth: 60 }}>{t('argus.analytics.direction', 'Direction')}</Typography>
            <InlineSelect
              value={direction}
              onChange={(val) => setDirection(val as any)}
              options={[
                { value: 'after', label: t('argus.analytics.after', 'After') },
                { value: 'before', label: t('argus.analytics.before', 'Before') },
              ]}
            />
          </Box>
        )}

        {/* Steps before/after */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography variant="caption" color="text.secondary" sx={{ minWidth: 60 }}>
            {direction === 'before' ? t('argus.analytics.stepsBefore', 'Steps Before') : t('argus.analytics.stepsAfter', 'Steps After')}
          </Typography>
          <InlineSelect
            value={String(direction === 'before' ? stepsBefore : stepsAfter)}
            onChange={(val) => {
              const n = Number(val);
              if (direction === 'before') setStepsBefore(n);
              else setStepsAfter(n);
            }}
            options={[1, 2, 3, 4, 5, 6].map((n) => ({ value: String(n), label: String(n) }))}
          />
        </Box>

        {/* Depth */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography variant="caption" color="text.secondary" sx={{ minWidth: 60 }}>{t('argus.analytics.depth', 'Depth')}</Typography>
          <InlineSelect
            value={String(depth)}
            onChange={(val) => setDepth(Number(val))}
            options={[2, 3, 4, 5, 6, 8].map((n) => ({ value: String(n), label: String(n) }))}
          />
        </Box>
      </Box>

      <Divider sx={{ opacity: isDark ? 0.05 : 0.5 }} />

      {/* Exclude Events */}
      <Box>
        <Typography variant="overline" sx={{ fontWeight: 700, color: 'text.secondary', ml: 0.5 }}>
          {t('argus.analytics.excludeEvents', 'Exclude Events')}
        </Typography>
        <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 0.5, maxHeight: 150, overflowY: 'auto' }}>
          {availableEvents.slice(0, 20).map((name) => (
            <Box
              key={name}
              onClick={() => toggleExclude(name)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                px: 1,
                py: 0.25,
                borderRadius: 1,
                cursor: 'pointer',
                fontSize: '0.75rem',
                color: excludeEvents.includes(name) ? 'error.main' : 'text.primary',
                textDecoration: excludeEvents.includes(name) ? 'line-through' : 'none',
                opacity: excludeEvents.includes(name) ? 0.5 : 1,
                '&:hover': {
                  bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                },
              }}
            >
              <Checkbox
                size="small"
                checked={!excludeEvents.includes(name)}
                sx={{ p: 0.25, '& .MuiSvgIcon-root': { fontSize: 14 } }}
              />
              {name}
            </Box>
          ))}
        </Box>
      </Box>

      <Divider sx={{ opacity: isDark ? 0.05 : 0.5 }} />

      {/* Breakdown */}
      <Box>
        <Typography variant="overline" sx={{ fontWeight: 700, color: 'text.secondary', ml: 0.5 }}>
          {t('argus.analytics.breakdownBy', 'Breakdown By')}
        </Typography>
        <Box sx={{ mt: 1, p: 1.5, borderRadius: 2, border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
          <PropertyPicker
            projectId={projectId}
            eventName={anchorEventA}
            value={breakdownProperty}
            onChange={setBreakdownProperty}
            emptyLabel={t('argus.analytics.noBreakdown', 'None')}
          />
        </Box>
      </Box>

      <Box sx={{ mt: 'auto', pt: 2 }}>
        <Button
          fullWidth variant="contained" size="small" startIcon={<RunIcon />}
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
          { value: 'top_paths', label: t('argus.analytics.topPaths', 'Top Paths') },
        ]}
      />
      <DateRangeSelector value={dateRange} onChange={setDateRange} compact />
      <CsvExportButton data={csvData} filename="flows" disabled={csvData.length === 0} />
    </>
  );

  // ── Render: Sankey ──
  const renderSankey = () => {
    if (!sankeyData) return <EmptyPagePlaceholder message={t('argus.analytics.noFlowData', 'No flow data available.')} minHeight={300} />;

    return (
      <Box sx={{ height: 500, width: '100%', pr: 2 }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          <Sankey
            data={sankeyData}
            node={<CustomSankeyNode isDark={isDark} theme={theme} />}
            link={{ stroke: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)' }}
            margin={{ top: 20, right: 100, bottom: 20, left: 100 }}
            nodePadding={24}
            nodeWidth={12}
            iterations={0}
          >
            <RechartsTooltip
              contentStyle={{
                background: isDark ? '#1e1e2e' : '#fff',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', fontSize: 12,
              }}
            />
          </Sankey>
        </ResponsiveContainer>
      </Box>
    );
  };

  // ── Render: Top Paths ──
  const renderTopPaths = () => {
    const paths = flowData?.top_paths;
    if (!paths || paths.length === 0) {
      return (
        <EmptyPagePlaceholder
          message={t('argus.analytics.topPathsEmpty', 'No top paths data available.')}
          minHeight={300}
        />
      );
    }

    return (
      <Box sx={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '12px 16px', borderBottom: `2px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, color: theme.palette.text.secondary, fontWeight: 600 }}>
                #
              </th>
              <th style={{ textAlign: 'left', padding: '12px 16px', borderBottom: `2px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, color: theme.palette.text.secondary, fontWeight: 600 }}>
                Path
              </th>
              <th style={{ textAlign: 'right', padding: '12px 16px', borderBottom: `2px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, color: theme.palette.text.secondary, fontWeight: 600 }}>
                {t('argus.analytics.users', 'Users')}
              </th>
              <th style={{ textAlign: 'right', padding: '12px 16px', borderBottom: `2px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, color: theme.palette.text.secondary, fontWeight: 600 }}>
                %
              </th>
            </tr>
          </thead>
          <tbody>
            {paths.map((p, idx) => (
              <tr key={idx} style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}` }}>
                <td style={{ padding: '10px 16px', fontWeight: 600, color: theme.palette.text.secondary }}>
                  {idx + 1}
                </td>
                <td style={{ padding: '10px 16px' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.5 }}>
                    {p.path.map((step, sIdx) => (
                      <React.Fragment key={sIdx}>
                        <Chip
                          label={step}
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
                          <Typography variant="caption" color="text.disabled" sx={{ px: 0.25 }}>
                            →
                          </Typography>
                        )}
                      </React.Fragment>
                    ))}
                  </Box>
                </td>
                <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                  {p.count.toLocaleString()}
                </td>
                <td style={{ padding: '10px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
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
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
      <PageHeader
        enableAutoBack
        title={
          <ArgusBreadcrumbs
            paths={[
              { label: t('argus.analytics.title', 'Analytics'), to: '/argus/analytics' },
              { label: t('argus.analytics.flows', 'Flows') },
            ]}
            size="title"
          />
        }
      />
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0, px: 2, pb: 2 }}>
        <AnalyticsLayout leftPanel={leftPanel} toolbar={toolbar}>
          <PageContentLoader
            loading={queryLoading}
            skeleton={<ArgusChartSkeleton height={400} />}
          >
            {!hasQueried ? (
              <EmptyPagePlaceholder
                message={t('argus.analytics.emptyFlows', 'Select an anchor event and click Run to see user flows.')}
                minHeight={300}
              />
            ) : (
              <Box sx={{ flexGrow: 1 }}>
                {viewMode === 'sankey' && renderSankey()}
                {viewMode === 'top_paths' && renderTopPaths()}
              </Box>
            )}
          </PageContentLoader>
        </AnalyticsLayout>
      </Box>
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
}) => {
  if (!payload) return null;
  const color = NODE_COLORS[index % NODE_COLORS.length];
  return (
    <g>
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

export default ArgusFlowsPage;
