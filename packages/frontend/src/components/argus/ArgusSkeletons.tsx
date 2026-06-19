import React from 'react';
import { Box, Skeleton, Paper, useTheme } from '@mui/material';
import ArgusChartSkeleton from './ArgusChartSkeleton';

/* ─── Chart Skeleton ─── */
export const ChartSkeleton: React.FC<{ height?: number }> = ({
  height = 180,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: 2,
        mb: 2,
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
      }}
    >
      <Skeleton
        variant="text"
        width={120}
        height={18}
        sx={{ mb: 1, borderRadius: 0.5 }}
      />
      <ArgusChartSkeleton height={height} />
    </Paper>
  );
};


/* ─── Stats Row Skeleton (4 cards) ─── */
export const StatsRowSkeleton: React.FC<{ count?: number }> = ({
  count = 4,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: `repeat(${count}, 1fr)`,
        gap: 2,
        mb: 2,
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <Paper
          key={i}
          elevation={0}
          sx={{
            p: 2,
            borderRadius: 2,
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          }}
        >
          <Skeleton
            variant="text"
            width={80}
            height={14}
            sx={{ mb: 0.5, borderRadius: 0.5 }}
          />
          <Skeleton
            variant="text"
            width={60}
            height={28}
            sx={{ borderRadius: 0.5 }}
          />
        </Paper>
      ))}
    </Box>
  );
};

/* ─── Table Skeleton ─── */
export const TableSkeleton: React.FC<{ rows?: number; cols?: number }> = ({
  rows = 8,
  cols = 4,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: 2,
        overflow: 'hidden',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          gap: 2,
          px: 2,
          py: 1.2,
          backgroundColor: isDark
            ? 'rgba(255,255,255,0.02)'
            : 'rgba(0,0,0,0.01)',
          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        }}
      >
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton
            key={i}
            variant="text"
            width={`${100 / cols}%`}
            height={16}
            sx={{ borderRadius: 0.5 }}
          />
        ))}
      </Box>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, row) => (
        <Box
          key={row}
          sx={{
            display: 'flex',
            gap: 2,
            px: 2,
            py: 1,
            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}`,
          }}
        >
          {Array.from({ length: cols }).map((_, col) => (
            <Skeleton
              key={col}
              variant="text"
              animation="wave"
              width={`${60 + Math.random() * 30}%`}
              height={16}
              sx={{ borderRadius: 0.5, flex: 1 }}
            />
          ))}
        </Box>
      ))}
    </Paper>
  );
};

/* ─── List Skeleton (issues, feedback, alerts) ─── */
export const ListSkeleton: React.FC<{ rows?: number }> = ({ rows = 6 }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <Paper
          key={i}
          elevation={0}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            px: 2,
            py: 1.5,
            borderRadius: 2,
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          }}
        >
          <Skeleton variant="circular" width={32} height={32} />
          <Box sx={{ flex: 1 }}>
            <Skeleton
              variant="text"
              width={`${40 + Math.random() * 40}%`}
              height={18}
              sx={{ borderRadius: 0.5 }}
            />
            <Skeleton
              variant="text"
              width={`${20 + Math.random() * 30}%`}
              height={14}
              sx={{ borderRadius: 0.5 }}
            />
          </Box>
          <Skeleton
            variant="text"
            width={60}
            height={14}
            sx={{ borderRadius: 0.5 }}
          />
        </Paper>
      ))}
    </Box>
  );
};

/* ─── Filter Bar Skeleton ─── */
export const FilterBarSkeleton: React.FC = () => (
  <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'center' }}>
    <Skeleton
      variant="rounded"
      width={70}
      height={30}
      sx={{ borderRadius: 1 }}
    />
    <Skeleton
      variant="rounded"
      width={90}
      height={30}
      sx={{ borderRadius: 1 }}
    />
    <Box sx={{ flex: 1 }} />
    <Skeleton
      variant="rounded"
      width={110}
      height={30}
      sx={{ borderRadius: 1 }}
    />
  </Box>
);

/* ─── Composite page skeletons ─── */

/** Logs page: filter bar + chart + table */
export const LogsPageSkeleton: React.FC = () => (
  <Box>
    <FilterBarSkeleton />
    <ChartSkeleton height={140} />
    <TableSkeleton rows={10} cols={4} />
  </Box>
);

/** Discover page: chart + table */
export const DiscoverPageSkeleton: React.FC = () => (
  <Box>
    <ChartSkeleton height={160} />
    <TableSkeleton rows={6} cols={4} />
  </Box>
);

/** Overview page: stats + chart + list */
export const OverviewPageSkeleton: React.FC = () => (
  <Box>
    <StatsRowSkeleton count={4} />
    <ChartSkeleton height={200} />
    <ListSkeleton rows={5} />
  </Box>
);

/** Issues page: list of issues */
export const IssuesPageSkeleton: React.FC = () => (
  <Box>
    <FilterBarSkeleton />
    <ListSkeleton rows={8} />
  </Box>
);

/** Performance page: stats + chart + table */
export const PerformancePageSkeleton: React.FC = () => (
  <Box>
    <StatsRowSkeleton count={4} />
    <ChartSkeleton height={200} />
    <TableSkeleton rows={6} cols={5} />
  </Box>
);

/** Generic Argus skeleton with chart + table */
export const GenericArgusPageSkeleton: React.FC = () => (
  <Box>
    <StatsRowSkeleton count={3} />
    <ChartSkeleton height={160} />
    <TableSkeleton rows={5} cols={4} />
  </Box>
);
