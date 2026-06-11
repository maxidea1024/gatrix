import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Box, Typography, useTheme, alpha, Tooltip } from '@mui/material';
import { formatCompactNumber } from '@/utils/numberFormat';

interface TreemapNode {
  name: string;
  value: number;
  originalIndex: number;
}

interface TreemapRect {
  id: string;
  name: string;
  value: number;
  x: number;
  y: number;
  width: number;
  height: number;
  originalIndex: number;
}

interface LogsTreemapChartProps {
  data: { group_value: string; count: number }[];
  onClick: (value: string) => void;
}

const CHART_COLORS = [
  '#7c4dff',
  '#448aff',
  '#00bcd4',
  '#ff9800',
  '#f44336',
  '#4caf50',
  '#9c27b0',
];

/**
 * Recursive binary partition treemap layout algorithm.
 * Splits the nodes array into two halves of roughly equal value sum,
 * and recursively partitions the rectangle along its longest axis.
 */
function layoutTreemap(
  nodes: TreemapNode[],
  x: number,
  y: number,
  w: number,
  h: number
): TreemapRect[] {
  if (nodes.length === 0) return [];
  if (nodes.length === 1) {
    return [
      {
        id: nodes[0].name,
        name: nodes[0].name,
        value: nodes[0].value,
        x,
        y,
        width: w,
        height: h,
        originalIndex: nodes[0].originalIndex,
      },
    ];
  }

  const total = nodes.reduce((sum, n) => sum + n.value, 0);
  if (total === 0) {
    // If all remaining nodes are zero, split them equally in space
    const len = nodes.length;
    const rects: TreemapRect[] = [];
    if (w >= h) {
      const step = w / len;
      for (let i = 0; i < len; i++) {
        rects.push({
          id: nodes[i].name,
          name: nodes[i].name,
          value: nodes[i].value,
          x: x + i * step,
          y,
          width: step,
          height: h,
          originalIndex: nodes[i].originalIndex,
        });
      }
    } else {
      const step = h / len;
      for (let i = 0; i < len; i++) {
        rects.push({
          id: nodes[i].name,
          name: nodes[i].name,
          value: nodes[i].value,
          x,
          y: y + i * step,
          width: w,
          height: step,
          originalIndex: nodes[i].originalIndex,
        });
      }
    }
    return rects;
  }

  // Find split point to balance values
  let leftSum = 0;
  let splitIndex = 0;
  for (let i = 0; i < nodes.length - 1; i++) {
    leftSum += nodes[i].value;
    if (leftSum >= total / 2) {
      splitIndex = i + 1;
      break;
    }
  }
  if (splitIndex === 0) splitIndex = 1;

  const leftNodes = nodes.slice(0, splitIndex);
  const rightNodes = nodes.slice(splitIndex);

  const leftValue = leftNodes.reduce((sum, n) => sum + n.value, 0);

  const rects: TreemapRect[] = [];
  if (w >= h) {
    // Split horizontally (along width)
    const wLeft = (leftValue / total) * w;
    const wRight = w - wLeft;
    rects.push(...layoutTreemap(leftNodes, x, y, wLeft, h));
    rects.push(...layoutTreemap(rightNodes, x + wLeft, y, wRight, h));
  } else {
    // Split vertically (along height)
    const hLeft = (leftValue / total) * h;
    const hRight = h - hLeft;
    rects.push(...layoutTreemap(leftNodes, x, y, w, hLeft));
    rects.push(...layoutTreemap(rightNodes, x, y + hLeft, w, hRight));
  }
  return rects;
}

const LogsTreemapChart: React.FC<LogsTreemapChartProps> = ({
  data,
  onClick,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 180 });

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      setDimensions({ width: width || 600, height: height || 180 });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const totalSum = useMemo(() => {
    return data.reduce((sum, item) => sum + Number(item.count), 0);
  }, [data]);

  const rects = useMemo(() => {
    if (!data || data.length === 0 || totalSum === 0) return [];

    const nodes = data.map((item, index) => ({
      name: item.group_value || '(empty)',
      value: Number(item.count),
      originalIndex: index,
    }));

    return layoutTreemap(nodes, 0, 0, dimensions.width, dimensions.height);
  }, [data, totalSum, dimensions.width, dimensions.height]);

  if (data.length === 0 || totalSum === 0) {
    return null;
  }

  return (
    <Box
      ref={containerRef}
      sx={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {rects.map((rect) => {
        const color = CHART_COLORS[rect.originalIndex % CHART_COLORS.length];
        const pct = totalSum > 0 ? (rect.value / totalSum) * 100 : 0;
        const showTitle = rect.width > 45 && rect.height > 22;
        const showSubtitle = rect.width > 75 && rect.height > 38;

        return (
          <Tooltip
            key={rect.name}
            title={`${rect.name}: ${formatCompactNumber(rect.value)} (${pct.toFixed(1)}%)`}
            placement="top"
            arrow
          >
            <Box
              onClick={() => onClick(rect.name)}
              sx={{
                position: 'absolute',
                left: rect.x,
                top: rect.y,
                width: rect.width,
                height: rect.height,
                padding: '4px 6px',
                boxSizing: 'border-box',
                cursor: 'pointer',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                textAlign: 'center',
                border: `1px solid ${isDark ? '#1a1a2e' : '#fff'}`,
                background: isDark
                  ? `linear-gradient(135deg, ${alpha(color, 0.25)}, ${alpha(color, 0.08)})`
                  : `linear-gradient(135deg, ${alpha(color, 0.18)}, ${alpha(color, 0.05)})`,
                borderColor: alpha(color, 0.35),
                borderRadius: 0,
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  borderColor: alpha(color, 0.75),
                  zIndex: 10,
                  filter: 'brightness(1.12)',
                },
              }}
            >
              {showTitle && (
                <Typography
                  sx={{
                    fontSize: rect.width > 120 ? '0.75rem' : '0.68rem',
                    fontWeight: 700,
                    color: isDark ? '#fff' : 'text.primary',
                    textOverflow: 'ellipsis',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    width: '100%',
                  }}
                >
                  {rect.name}
                </Typography>
              )}
              {showSubtitle && (
                <Typography
                  sx={{
                    fontSize: '0.64rem',
                    color: isDark ? 'rgba(255,255,255,0.7)' : 'text.secondary',
                    fontWeight: 500,
                    mt: 0.25,
                  }}
                >
                  {formatCompactNumber(rect.value)} ({pct.toFixed(1)}%)
                </Typography>
              )}
            </Box>
          </Tooltip>
        );
      })}
    </Box>
  );
};

export default LogsTreemapChart;
