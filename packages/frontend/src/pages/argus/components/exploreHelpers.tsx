import React, { useState, useMemo, useEffect } from 'react';
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
  BugReport as BugReportIcon,
  MoreHoriz as MoreIcon,
  Schedule as ScheduleIcon,
  Person as PersonIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  FileCopy as FileCopyIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import {
  type ArgusSavedQuery,
  type SavedQueryType,
} from '@/services/argusService';
import { formatRelativeTime } from '@/utils/dateFormat';
import argusService from '@/services/argusService';

/* ─── Dataset Config ─── */

export const DATASET_CONFIG: Partial<
  Record<
    SavedQueryType,
    { label: string; icon: React.ReactNode; color: string; path: string }
  >
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
  issues: {
    label: 'Issues',
    icon: <BugReportIcon sx={{ fontSize: 14 }} />,
    color: '#ef4444',
    path: '/argus/issues',
  },
};

/* ─── Sort type ─── */

export type SortOption = 'newest' | 'oldest' | 'name';

/* ─── Mini Volume Bar ─── */

const MiniVolumeBar: React.FC<{
  data: number[] | null;
  color: string;
  isDark: boolean;
}> = ({ data, color, isDark }) => {
  const width = 200;
  const height = 48;

  // Loading shimmer
  if (!data) {
    return (
      <Box
        sx={{
          height,
          display: 'flex',
          alignItems: 'flex-end',
          gap: '2px',
          px: 0.5,
        }}
      >
        {Array.from({ length: 12 }).map((_, i) => (
          <Box
            key={i}
            sx={{
              flex: 1,
              height: `${20 + (i % 3) * 15}%`,
              borderRadius: '2px',
              backgroundColor: isDark
                ? 'rgba(255,255,255,0.04)'
                : 'rgba(0,0,0,0.04)',
              '@keyframes shimmer': {
                '0%': { opacity: 0.3 },
                '50%': { opacity: 0.6 },
                '100%': { opacity: 0.3 },
              },
              animation: `shimmer 1.5s ease-in-out infinite`,
              animationDelay: `${i * 0.08}s`,
            }}
          />
        ))}
      </Box>
    );
  }

  // No data
  if (data.length === 0) {
    return (
      <Box
        sx={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography sx={{ fontSize: '0.6rem', color: 'text.disabled' }}>
          ···
        </Typography>
      </Box>
    );
  }

  const maxVal = Math.max(...data, 1);
  const barCount = data.length;
  const barW = width / barCount - 2;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
    >
      {data.map((v, i) => {
        const barH = Math.max((v / maxVal) * (height - 4), 1);
        return (
          <rect
            key={i}
            x={i * (barW + 2) + 1}
            y={height - barH}
            width={barW}
            height={barH}
            rx={1.5}
            fill={color}
            opacity={isDark ? 0.4 + (v / maxVal) * 0.6 : 0.25 + (v / maxVal) * 0.55}
          />
        );
      })}
    </svg>
  );
};

export const QueryCard: React.FC<{
  query: ArgusSavedQuery;
  isDark: boolean;
  projectId: string;
  onDelete: (id: number) => void;
  onToggleFavorite: (id: number, favorite: boolean) => void;
  onRename: (id: number, newName: string) => void;
  onClick: (query: ArgusSavedQuery) => void;
  onDuplicate: (query: ArgusSavedQuery) => void;
  onDuplicateAndEdit: (query: ArgusSavedQuery) => void;
}> = ({
  query,
  isDark,
  projectId,
  onDelete,
  onToggleFavorite,
  onRename,
  onClick,
  onDuplicate,
  onDuplicateAndEdit,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const cfg = DATASET_CONFIG[query.query_type] || DATASET_CONFIG.discover;
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(query.name);

  const periodLabel = query.query_config?.period || '24h';

  // Async volume fetch per card
  const [volumeData, setVolumeData] = useState<number[] | null>(null);
  useEffect(() => {
    const QUERY_TYPE_DATASET: Record<string, string> = {
      logs: 'logs',
      traces: 'spans',
      metrics: 'errors',
      discover: 'errors',
    };
    const dataset = QUERY_TYPE_DATASET[query.query_type] || 'errors';
    const conditions = query.query_config?.conditions || '';
    argusService
      .getDiscoverVolume(projectId, {
        period: periodLabel,
        dataset,
        search: conditions || undefined,
      })
      .then((data) => {
        setVolumeData(data.map((d) => Number(d.count)));
      })
      .catch(() => setVolumeData([]));
  }, [query.id, projectId, periodLabel, query.query_type, query.query_config?.conditions]);

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
                {t('argus.explore.duplicateQuery', 'Duplicate')}
              </ListItemText>
            </MenuItem>
            <MenuItem
              onClick={(e) => {
                e.stopPropagation();
                setMenuAnchor(null);
                onDuplicateAndEdit(query);
              }}
              sx={{ fontSize: '0.78rem' }}
            >
              <ListItemIcon>
                <EditIcon sx={{ fontSize: 16 }} />
              </ListItemIcon>
              <ListItemText primaryTypographyProps={{ fontSize: '0.78rem' }}>
                {t('argus.explore.duplicateAndEdit', 'Duplicate & Edit')}
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

      {/* Volume Chart — real data, async per card */}
      <Box sx={{ px: 2, pb: 1.5, height: 56, overflow: 'hidden' }}>
        <MiniVolumeBar data={volumeData} color={cfg.color} isDark={isDark} />
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
