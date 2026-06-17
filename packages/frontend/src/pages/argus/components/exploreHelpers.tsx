import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  IconButton,
  useTheme,
  alpha,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Explore as ExploreIcon,
  Timeline as TracesIcon,
  Terminal as LogsIcon,
  BarChart as MetricsIcon,
  Delete as DeleteIcon,
  MoreHoriz as MoreIcon,
  Schedule as ScheduleIcon,
  Person as PersonIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  FileCopy as FileCopyIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import {
  type ArgusSavedQuery,
  type SavedQueryType,
} from '@/services/argusService';
import { formatRelativeTime } from '@/utils/dateFormat';

/* ─── Dataset Config ─── */

export const DATASET_CONFIG: Record<
  SavedQueryType,
  { label: string; icon: React.ReactNode; color: string; path: string }
> = {
  traces: {
    label: 'Spans',
    icon: <TracesIcon sx={{ fontSize: 14 }} />,
    color: '#8b5cf6',
    path: '/argus/explore/traces',
  },
  logs: {
    label: 'Logs',
    icon: <LogsIcon sx={{ fontSize: 14 }} />,
    color: '#f59e0b',
    path: '/argus/explore/logs',
  },
  metrics: {
    label: 'Metrics',
    icon: <MetricsIcon sx={{ fontSize: 14 }} />,
    color: '#10b981',
    path: '/argus/explore/metrics',
  },
  discover: {
    label: 'Discover',
    icon: <ExploreIcon sx={{ fontSize: 14 }} />,
    color: '#3b82f6',
    path: '/argus/explore/discover',
  },
};

/* ─── Sort type ─── */

export type SortOption = 'newest' | 'oldest' | 'name';

/* ─── Mini Sparkline ─── */

const MiniSparkline: React.FC<{ color: string; isDark: boolean }> = ({
  color,
  isDark,
}) => {
  const points = useMemo(() => {
    const hash = color
      .split('')
      .reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0);
    const arr: number[] = [];
    let seed = Math.abs(hash);
    for (let i = 0; i < 24; i++) {
      seed = (seed * 16807 + 12345) % 2147483647;
      arr.push(20 + (seed % 60));
    }
    return arr;
  }, [color]);

  const width = 200;
  const height = 48;
  const maxVal = Math.max(...points);
  const minVal = Math.min(...points);
  const range = maxVal - minVal || 1;
  const step = width / (points.length - 1);

  const pathData = points
    .map((v, i) => {
      const x = i * step;
      const y = height - 4 - ((v - minVal) / range) * (height - 8);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const areaPath = `${pathData} L${width},${height} L0,${height} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient
          id={`grad-${color.replace('#', '')}`}
          x1="0"
          y1="0"
          x2="0"
          y2="1"
        >
          <stop
            offset="0%"
            stopColor={color}
            stopOpacity={isDark ? 0.25 : 0.15}
          />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#grad-${color.replace('#', '')})`} />
      <path
        d={pathData}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
};

/* ─── Query Card ─── */

export const QueryCard: React.FC<{
  query: ArgusSavedQuery;
  isDark: boolean;
  onDelete: (id: number) => void;
  onToggleFavorite: (id: number, favorite: boolean) => void;
  onRename: (id: number, newName: string) => void;
  onClick: (query: ArgusSavedQuery) => void;
  onDuplicate: (query: ArgusSavedQuery) => void;
}> = ({
  query,
  isDark,
  onDelete,
  onToggleFavorite,
  onRename,
  onClick,
  onDuplicate,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const cfg = DATASET_CONFIG[query.query_type] || DATASET_CONFIG.discover;
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(query.name);

  const periodLabel = query.query_config?.period || '24h';

  return (
    <Paper
      elevation={0}
      onClick={() => onClick(query)}
      sx={{
        borderRadius: 2.5,
        overflow: 'hidden',
        cursor: 'pointer',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        transition: 'all 0.2s ease',
        display: 'flex',
        flexDirection: 'column',
        '&:hover': {
          borderColor: alpha(cfg.color, 0.4),
          boxShadow: `0 4px 20px ${alpha(cfg.color, isDark ? 0.15 : 0.08)}`,
          transform: 'translateY(-2px)',
        },
      }}
    >
      {/* Card Header */}
      <Box sx={{ p: 2, pb: 1.5 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            mb: 1,
          }}
        >
          <Box
            sx={{ flex: 1, minWidth: 0, mr: 1 }}
            onClick={(e) => {
              if (isEditing) e.stopPropagation();
            }}
          >
            {isEditing ? (
              <input
                autoFocus
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={() => {
                  if (editName.trim() && editName !== query.name)
                    onRename(query.id, editName.trim());
                  setIsEditing(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (editName.trim() && editName !== query.name)
                      onRename(query.id, editName.trim());
                    setIsEditing(false);
                  } else if (e.key === 'Escape') {
                    setEditName(query.name);
                    setIsEditing(false);
                  }
                }}
                style={{
                  width: '100%',
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  color: 'inherit',
                  padding: 0,
                  margin: 0,
                  marginBottom: 4,
                  borderBottom: `1px solid ${theme.palette.primary.main}`,
                }}
              />
            ) : (
              <Typography
                onClick={(e) => {
                  e.stopPropagation();
                  setEditName(query.name);
                  setIsEditing(true);
                }}
                sx={{
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  mb: 0.3,
                  cursor: 'text',
                  '&:hover': { color: theme.palette.primary.main },
                }}
              >
                {query.name}
              </Typography>
            )}
            <Typography
              sx={{
                fontSize: '0.7rem',
                color: 'text.disabled',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '100%',
              }}
            >
              {query.query_config?.conditions ||
                query.query_config?.fields?.join(', ') ||
                '—'}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(query.id, !query.is_favorite);
              }}
              sx={{ p: 0.3, '&:hover': { opacity: 1 } }}
            >
              {query.is_favorite ? (
                <StarIcon sx={{ fontSize: 16, color: '#f59e0b' }} />
              ) : (
                <StarBorderIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
              )}
            </IconButton>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                setMenuAnchor(e.currentTarget);
              }}
              sx={{ p: 0.3, ml: 0.5, opacity: 0.4, '&:hover': { opacity: 1 } }}
            >
              <MoreIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Box>
          <Menu
            anchorEl={menuAnchor}
            open={Boolean(menuAnchor)}
            onClose={(e: any) => {
              e?.stopPropagation?.();
              setMenuAnchor(null);
            }}
            onClick={(e) => e.stopPropagation()}
            slotProps={{
              paper: { sx: { minWidth: 160, borderRadius: '8px' } },
            }}
          >
            <MenuItem
              onClick={(e) => {
                e.stopPropagation();
                setMenuAnchor(null);
                onDuplicate(query);
              }}
              sx={{ fontSize: '0.78rem' }}
            >
              <ListItemIcon>
                <FileCopyIcon sx={{ fontSize: 16 }} />
              </ListItemIcon>
              <ListItemText primaryTypographyProps={{ fontSize: '0.78rem' }}>
                {t('argus.explore.duplicateQuery')}
              </ListItemText>
            </MenuItem>
            <MenuItem
              onClick={(e) => {
                e.stopPropagation();
                setMenuAnchor(null);
                onDelete(query.id);
              }}
              sx={{ fontSize: '0.78rem', color: theme.palette.error.main }}
            >
              <ListItemIcon>
                <DeleteIcon
                  sx={{ fontSize: 16, color: theme.palette.error.main }}
                />
              </ListItemIcon>
              <ListItemText primaryTypographyProps={{ fontSize: '0.78rem' }}>
                {t('argus.explore.deleteQuery', 'Delete Query')}
              </ListItemText>
            </MenuItem>
          </Menu>
        </Box>
      </Box>

      {/* Mini Graph */}
      <Box sx={{ px: 2, pb: 1.5, height: 56, overflow: 'hidden' }}>
        <MiniSparkline color={cfg.color} isDark={isDark} />
      </Box>

      {/* Card Footer */}
      <Box
        sx={{
          px: 2,
          py: 1.2,
          borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            icon={React.cloneElement(cfg.icon as React.ReactElement, {
              sx: { fontSize: 11, color: `${cfg.color} !important` },
            })}
            label={cfg.label}
            size="small"
            sx={{
              height: 20,
              fontSize: '0.62rem',
              fontWeight: 700,
              backgroundColor: alpha(cfg.color, 0.1),
              color: cfg.color,
              borderRadius: '4px',
              '& .MuiChip-icon': { ml: 0.2 },
            }}
          />
          <Chip
            icon={
              <ScheduleIcon
                sx={{ fontSize: 10, color: 'text.disabled !important' }}
              />
            }
            label={periodLabel}
            size="small"
            sx={{
              height: 20,
              fontSize: '0.6rem',
              fontWeight: 600,
              backgroundColor: isDark
                ? 'rgba(255,255,255,0.04)'
                : 'rgba(0,0,0,0.04)',
              color: 'text.secondary',
              borderRadius: '4px',
              '& .MuiChip-icon': { ml: 0.2 },
            }}
          />
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box
            sx={{
              width: 18,
              height: 18,
              borderRadius: '50%',
              backgroundColor: alpha(theme.palette.primary.main, 0.15),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <PersonIcon
              sx={{ fontSize: 11, color: theme.palette.primary.main }}
            />
          </Box>
          <Typography sx={{ fontSize: '0.62rem', color: 'text.disabled' }}>
            {formatRelativeTime(query.updated_at || query.created_at)}
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
};

/* ─── Card Skeleton ─── */

export const CardSkeleton: React.FC<{ isDark: boolean }> = ({ isDark }) => (
  <Box
    sx={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
      gap: 2,
    }}
  >
    {Array.from({ length: 6 }).map((_, i) => (
      <Paper
        key={i}
        elevation={0}
        sx={{
          borderRadius: 2.5,
          height: 160,
          overflow: 'hidden',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        }}
      >
        <Box sx={{ p: 2 }}>
          <Box
            sx={{
              minWidth: 0,
              height: 14,
              width: '60%',
              borderRadius: 1,
              bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
              mb: 1,
            }}
          />
          <Box
            sx={{
              minWidth: 0,
              height: 10,
              width: '80%',
              borderRadius: 1,
              bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
            }}
          />
        </Box>
        <Box
          sx={{
            minWidth: 0,
            height: 48,
            mx: 2,
            borderRadius: 1,
            bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
          }}
        />
        <Box sx={{ display: 'flex', gap: 1, px: 2, py: 1.5 }}>
          <Box
            sx={{
              minWidth: 0,
              height: 18,
              width: 50,
              borderRadius: 1,
              bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
            }}
          />
          <Box
            sx={{
              minWidth: 0,
              height: 18,
              width: 40,
              borderRadius: 1,
              bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
            }}
          />
        </Box>
      </Paper>
    ))}
  </Box>
);
