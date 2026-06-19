import React, { useState, useMemo, useCallback } from 'react';
import { Box, Typography, Chip, useTheme, alpha } from '@mui/material';
import { Sankey, Tooltip as RechartsTooltip, ResponsiveContainer, Rectangle } from 'recharts';
import { useTranslation } from 'react-i18next';
import EmptyPagePlaceholder from '@/components/common/EmptyPagePlaceholder';
import { formatCompactNumber } from '@/utils/numberFormat';
import { formatBreakdownLabel, splitBreakdownValue } from '../analytics/breakdownUtils';

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

interface FlowsViewsProps {
  flowData: {
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
  } | null;
  viewMode: 'sankey' | 'top_paths';
  selectedBreakdown: string;
  setSelectedBreakdown: (val: string) => void;
  breakdownProperties: string[];
  lexiconMap: Map<string, string>;
}

export const FlowsViews: React.FC<FlowsViewsProps> = ({
  flowData,
  viewMode,
  selectedBreakdown,
  setSelectedBreakdown,
  breakdownProperties,
  lexiconMap,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';

  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  // ── Sankey data ──
  const sankeyData = useMemo(() => {
    if (!flowData || flowData.nodes.length === 0) return null;

    const activeData =
      selectedBreakdown && flowData.breakdowns?.[selectedBreakdown]
        ? flowData.breakdowns[selectedBreakdown]
        : flowData;

    if (!activeData || activeData.nodes.length === 0) return null;

    const nodeIdxMap = new Map<string, number>();
    activeData.nodes.forEach((n, i) => nodeIdxMap.set(n.id, i));
    const nodes = activeData.nodes.map((n) => ({
      name: lexiconMap.get(n.id) || n.id,
    }));
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

    // Remove cycles using DFS to prevent Recharts cycle recursion error
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
    const selectedBdIdx = selectedBreakdown ? bdKeys.indexOf(selectedBreakdown) : -1;
    const selectedBdColor =
      selectedBdIdx >= 0
        ? BD_COLORS_SANKEY[selectedBdIdx % BD_COLORS_SANKEY.length]
        : undefined;

    return (
      <Box sx={{ width: '100%' }}>
        {/* Breakdown indicator */}
        {flowData?.breakdowns && Object.keys(flowData.breakdowns).length > 0 && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }}>
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
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: selectedBdColor }} />
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
                  ? formatBreakdownLabel(selectedBreakdown, breakdownProperties)
                  : t('common.all', 'All')}
              </Typography>
            </Box>
            <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.68rem', fontStyle: 'italic' }}>
              {t('argus.analytics.clickTableToSwitch', '↑ Click a row above to switch')}
            </Typography>
          </Box>
        )}
        <Box
          sx={{
            minWidth: 0,
            height: { xs: 400, md: '60vh' },
            minHeight: 450,
            maxHeight: 750,
            pr: 2,
            userSelect: 'none',
            '& .recharts-wrapper, & .recharts-surface, & svg, & svg *': {
              outline: 'none',
            },
          }}
        >
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <Sankey
              data={sankeyData}
              node={<CustomSankeyNode isDark={isDark} theme={theme} onHoverNode={setHoveredNode} />}
              link={<CustomSankeyLink isDark={isDark} hoveredNode={hoveredNode} />}
              margin={{ top: 20, right: 150, bottom: 20, left: 20 }}
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
                labelStyle={{ color: isDark ? '#a1a1aa' : '#52525b', fontWeight: 600 }}
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
              <tr key={idx} style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}` }}>
                <td style={{ padding: '10px 16px', fontWeight: 600, color: theme.palette.text.secondary }}>{idx + 1}</td>
                <td style={{ padding: '10px 16px' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.5 }}>
                    {p.path.map((step, sIdx) => (
                      <React.Fragment key={sIdx}>
                        <Chip
                          label={lexiconMap.get(step) || step}
                          size="small"
                          sx={{
                            height: 22,
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            bgcolor: alpha(NODE_COLORS[sIdx % NODE_COLORS.length], isDark ? 0.2 : 0.1),
                            color: NODE_COLORS[sIdx % NODE_COLORS.length],
                            border: `1px solid ${alpha(NODE_COLORS[sIdx % NODE_COLORS.length], 0.3)}`,
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
                <td style={{ padding: '10px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{p.percentage}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Box>
    );
  };

  const renderBreakdownComparison = () => {
    if (!flowData?.breakdowns || Object.keys(flowData.breakdowns).length === 0) return null;

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
    const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
    const hoverBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)';

    const buildRow = (label: string, data: { nodes: any[]; links: any[] }, color: string, isAll: boolean) => {
      const totalEvents = data.links.reduce((s, l) => s + l.value, 0);
      const uniqueNodes = data.nodes.length;
      const topLink = data.links.length > 0 ? data.links.reduce((max, l) => (l.value > max.value ? l : max), data.links[0]) : null;
      const topPath = topLink ? `${topLink.source} → ${topLink.target}` : '—';
      return {
        label,
        color,
        totalEvents,
        uniqueNodes,
        topPath,
        isAll,
      };
    };

    const allRow = buildRow(t('common.all', 'All'), flowData, '#94a3b8', true);
    const bdKeys = Object.keys(flowData.breakdowns!);
    const bdTableRows = bdKeys
      .map((bv, idx) => buildRow(bv, flowData.breakdowns![bv], BD_COLORS[idx % BD_COLORS.length], false))
      .sort((a, b) => b.totalEvents - a.totalEvents);

    const tableRows = [allRow, ...bdTableRows];
    const maxEvents = Math.max(...tableRows.map((r) => r.totalEvents), 1);

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
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1, px: 0.5, color: 'text.secondary', fontSize: '0.78rem' }}>
          {t('argus.analytics.breakdownComparison', 'Breakdown Comparison')}
          <Typography component="span" variant="caption" sx={{ ml: 1, opacity: 0.6 }}>
            ({breakdownProperties.join(' · ')})
          </Typography>
        </Typography>
        <Box sx={{ overflowX: 'auto', border: `1px solid ${borderColor}`, borderRadius: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
            <thead>
              <tr>
                {breakdownProperties.length > 1 ? (
                  breakdownProperties.map((prop) => (
                    <th key={prop} style={{ ...thStyle, textAlign: 'left', minWidth: 90 }}>
                      {prop}
                    </th>
                  ))
                ) : (
                  <th style={{ ...thStyle, textAlign: 'left', minWidth: 120 }}>
                    {t('argus.analytics.breakdownValue', 'Breakdown Value')}
                  </th>
                )}
                <th style={{ ...thStyle, textAlign: 'left', minWidth: 180 }}>
                  {t('argus.analytics.eventCount', 'Event Count')}
                </th>
                <th style={{ ...thStyle, textAlign: 'right', minWidth: 70 }}>
                  {t('argus.analytics.uniquePaths', 'Unique Paths')}
                </th>
                <th style={{ ...thStyle, textAlign: 'left', minWidth: 140 }}>
                  {t('argus.analytics.topPath', 'Top Path')}
                </th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, idx) => {
                const isActive = row.isAll ? !selectedBreakdown : selectedBreakdown === row.label;
                return (
                  <tr
                    key={idx}
                    style={{
                      borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
                      cursor: 'pointer',
                      opacity: row.isAll ? 0.7 : 1,
                      backgroundColor: isActive ? (isDark ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.04)') : 'transparent',
                    }}
                    onClick={() => setSelectedBreakdown(row.isAll ? '' : row.label)}
                    onMouseEnter={(e) => {
                      if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = hoverBg;
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                    }}
                  >
                    {breakdownProperties.length > 1 && !row.isAll ? (
                      splitBreakdownValue(row.label).map((part: string, pIdx: number) => (
                        <td key={pIdx} style={{ padding: '8px 12px', fontWeight: isActive ? 700 : 500 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {pIdx === 0 && (
                              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: row.color, flexShrink: 0 }} />
                            )}
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>
                              {part || '(empty)'}
                            </span>
                            {pIdx === 0 && isActive && (
                              <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: theme.palette.primary.main, ml: 0.5, flexShrink: 0 }} />
                            )}
                          </Box>
                        </td>
                      ))
                    ) : (
                      <td
                        style={{ padding: '8px 12px', fontWeight: isActive ? 700 : 500 }}
                        colSpan={breakdownProperties.length > 1 ? breakdownProperties.length : 1}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: row.color, flexShrink: 0 }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>{row.label}</span>
                          {isActive && (
                            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: theme.palette.primary.main, ml: 0.5, flexShrink: 0 }} />
                          )}
                        </Box>
                      </td>
                    )}
                    <td style={{ padding: '8px 12px' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ flex: 1, height: 14, bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', borderRadius: 0.5, overflow: 'hidden', position: 'relative' }}>
                          <Box sx={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${(row.totalEvents / maxEvents) * 100}%`, bgcolor: alpha(row.color, 0.6), borderRadius: 0.5, transition: 'width 0.3s ease' }} />
                        </Box>
                        <Typography variant="caption" sx={{ fontWeight: 600, minWidth: 40, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {formatCompactNumber(row.totalEvents)}
                        </Typography>
                      </Box>
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{row.uniqueNodes}</td>
                    <td style={{ padding: '8px 12px', fontSize: '0.72rem', color: theme.palette.text.secondary }}>{row.topPath}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Box>
      </Box>
    );
  };

  return (
    <Box sx={{ flexGrow: 1 }}>
      {renderBreakdownComparison()}
      {viewMode === 'sankey' && renderSankey()}
      {viewMode === 'top_paths' && renderTopPaths()}
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
  onHoverNode,
}) => {
  if (!payload) return null;
  const color = NODE_COLORS[index % NODE_COLORS.length];
  return (
    <g onMouseEnter={() => onHoverNode?.(payload.name)} onMouseLeave={() => onHoverNode?.(null)} style={{ cursor: 'pointer' }}>
      <Rectangle x={x} y={y} width={width} height={height} fill={color} fillOpacity={0.9} rx={3} ry={3} />
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
  const srcName = typeof payload?.source === 'object' ? payload.source.name : undefined;
  const tgtName = typeof payload?.target === 'object' ? payload.target.name : undefined;

  const isConnected = hoveredNode === null || srcName === hoveredNode || tgtName === hoveredNode;

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
