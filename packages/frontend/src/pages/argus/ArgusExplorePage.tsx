import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Box, Typography, Paper, Button, Chip, IconButton,
  useTheme, alpha,
  Menu, MenuItem, ListItemIcon, ListItemText, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
} from '@mui/material';
import {
  Explore as ExploreIcon,
  Timeline as TracesIcon,
  Terminal as LogsIcon,
  BarChart as MetricsIcon,
  Search as SearchIcon,
  Close as CloseIcon,
  Add as AddIcon,
  ExpandMore as ExpandMoreIcon,
  Delete as DeleteIcon,
  MoreHoriz as MoreIcon,
  Sort as SortIcon,
  Schedule as ScheduleIcon,
  Person as PersonIcon,
  ArrowBack as ArrowBackIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  Bookmark as BookmarkIcon,
  BookmarkBorder as BookmarkBorderIcon,
  ViewColumn as ColumnsIcon, FileDownload as ExportIcon, Edit as EditIcon, FilterList as FilterIcon,
  FileCopy as FileCopyIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import PageContentLoader from '@/components/common/PageContentLoader';
import PageHeader from '@/components/common/PageHeader';
import ArgusBreadcrumbs from '@/components/argus/ArgusBreadcrumbs';
import argusService, { type ArgusSavedQuery, type SavedQueryType } from '@/services/argusService';
import MultiSelectFilterChip from '@/components/common/MultiSelectFilterChip';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import { formatRelativeTime } from '@/utils/dateFormat';

/* ─── Dataset Config ─── */

const DATASET_CONFIG: Record<SavedQueryType, { label: string; icon: React.ReactNode; color: string; path: string }> = {
  traces: { label: 'Spans', icon: <TracesIcon sx={{ fontSize: 14 }} />, color: '#8b5cf6', path: '/argus/explore/traces' },
  logs:   { label: 'Logs',  icon: <LogsIcon sx={{ fontSize: 14 }} />,   color: '#f59e0b', path: '/argus/explore/logs' },
  metrics:{ label: 'Metrics', icon: <MetricsIcon sx={{ fontSize: 14 }} />, color: '#10b981', path: '/argus/explore/metrics' },
  discover:{ label: 'Discover', icon: <ExploreIcon sx={{ fontSize: 14 }} />, color: '#3b82f6', path: '/argus/explore/discover' },
};

/* ─── Mini Sparkline ─── */

const MiniSparkline: React.FC<{ color: string; isDark: boolean }> = ({ color, isDark }) => {
  const points = useMemo(() => {
    const hash = color.split('').reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0);
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
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={isDark ? 0.25 : 0.15} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#grad-${color.replace('#', '')})`} />
      <path d={pathData} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
};

/* ─── Query Card ─── */

const QueryCard: React.FC<{
  query: ArgusSavedQuery;
  isDark: boolean;
  onDelete: (id: number) => void;
  onToggleFavorite: (id: number, favorite: boolean) => void;
  onRename: (id: number, newName: string) => void;
  onClick: (query: ArgusSavedQuery) => void;
  onDuplicate: (query: ArgusSavedQuery) => void;
}> = ({ query, isDark, onDelete, onToggleFavorite, onRename, onClick, onDuplicate }) => {
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
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
          <Box sx={{ flex: 1, minWidth: 0, mr: 1 }} onClick={(e) => { if (isEditing) e.stopPropagation(); }}>
            {isEditing ? (
              <input
                autoFocus
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onBlur={() => {
                  if (editName.trim() && editName !== query.name) onRename(query.id, editName.trim());
                  setIsEditing(false);
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    if (editName.trim() && editName !== query.name) onRename(query.id, editName.trim());
                    setIsEditing(false);
                  } else if (e.key === 'Escape') {
                    setEditName(query.name);
                    setIsEditing(false);
                  }
                }}
                style={{
                  width: '100%', fontSize: '0.88rem', fontWeight: 700,
                  border: 'none', outline: 'none', background: 'transparent',
                  color: 'inherit', padding: 0, margin: 0, marginBottom: 4,
                  borderBottom: `1px solid ${theme.palette.primary.main}`
                }}
              />
            ) : (
              <Typography
                onClick={(e) => { e.stopPropagation(); setEditName(query.name); setIsEditing(true); }}
                sx={{
                  fontSize: '0.88rem', fontWeight: 700,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  mb: 0.3, cursor: 'text',
                  '&:hover': { color: theme.palette.primary.main }
                }}>
                {query.name}
              </Typography>
            )}
            <Typography sx={{
              fontSize: '0.7rem', fontFamily: 'monospace', color: 'text.disabled',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              maxWidth: '100%',
            }}>
              {query.query_config?.conditions || query.query_config?.fields?.join(', ') || '—'}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <IconButton
              size="small"
              onClick={(e) => { e.stopPropagation(); onToggleFavorite(query.id, !query.is_favorite); }}
              sx={{ p: 0.3, '&:hover': { opacity: 1 } }}
            >
              {query.is_favorite ? <StarIcon sx={{ fontSize: 16, color: '#f59e0b' }} /> : <StarBorderIcon sx={{ fontSize: 16, color: 'text.disabled' }} />}
            </IconButton>
            <IconButton
              size="small"
              onClick={(e) => { e.stopPropagation(); setMenuAnchor(e.currentTarget); }}
              sx={{ p: 0.3, ml: 0.5, opacity: 0.4, '&:hover': { opacity: 1 } }}
            >
              <MoreIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Box>
          <Menu
            anchorEl={menuAnchor}
            open={Boolean(menuAnchor)}
            onClose={(e: any) => { e?.stopPropagation?.(); setMenuAnchor(null); }}
            onClick={(e) => e.stopPropagation()}
            slotProps={{ paper: { sx: { minWidth: 160, borderRadius: '8px' } } }}
          >
            <MenuItem onClick={(e) => { e.stopPropagation(); setMenuAnchor(null); onDuplicate(query); }} sx={{ fontSize: '0.78rem' }}>
              <ListItemIcon><FileCopyIcon sx={{ fontSize: 16 }} /></ListItemIcon>
              <ListItemText primaryTypographyProps={{ fontSize: '0.78rem' }}>{t('argus.explore.duplicateQuery')}</ListItemText>
            </MenuItem>
            <MenuItem onClick={(e) => { e.stopPropagation(); setMenuAnchor(null); onDelete(query.id); }} sx={{ fontSize: '0.78rem', color: theme.palette.error.main }}>
              <ListItemIcon><DeleteIcon sx={{ fontSize: 16, color: theme.palette.error.main }} /></ListItemIcon>
              <ListItemText primaryTypographyProps={{ fontSize: '0.78rem' }}>{t('argus.explore.deleteQuery', 'Delete Query')}</ListItemText>
            </MenuItem>
          </Menu>
        </Box>
      </Box>

      {/* Mini Graph */}
      <Box sx={{ px: 2, pb: 1.5, height: 56, overflow: 'hidden' }}>
        <MiniSparkline color={cfg.color} isDark={isDark} />
      </Box>

      {/* Card Footer */}
      <Box sx={{
        px: 2, py: 1.2,
        borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            icon={React.cloneElement(cfg.icon as React.ReactElement, { sx: { fontSize: 11, color: `${cfg.color} !important` } })}
            label={cfg.label}
            size="small"
            sx={{
              height: 20, fontSize: '0.62rem', fontWeight: 700,
              backgroundColor: alpha(cfg.color, 0.1),
              color: cfg.color,
              borderRadius: '4px',
              '& .MuiChip-icon': { ml: 0.2 },
            }}
          />
          <Chip
            icon={<ScheduleIcon sx={{ fontSize: 10, color: 'text.disabled !important' }} />}
            label={periodLabel}
            size="small"
            sx={{
              height: 20, fontSize: '0.6rem', fontWeight: 600,
              backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
              color: 'text.secondary',
              borderRadius: '4px',
              '& .MuiChip-icon': { ml: 0.2 },
            }}
          />
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{
            width: 18, height: 18, borderRadius: '50%',
            backgroundColor: alpha(theme.palette.primary.main, 0.15),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <PersonIcon sx={{ fontSize: 11, color: theme.palette.primary.main }} />
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

const CardSkeleton: React.FC<{ isDark: boolean }> = ({ isDark }) => (
  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 2 }}>
    {Array.from({ length: 6 }).map((_, i) => (
      <Paper key={i} elevation={0} sx={{
        borderRadius: 2.5, height: 160, overflow: 'hidden',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
      }}>
        <Box sx={{ p: 2 }}>
          <Box sx={{ height: 14, width: '60%', borderRadius: 1, bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', mb: 1 }} />
          <Box sx={{ height: 10, width: '80%', borderRadius: 1, bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }} />
        </Box>
        <Box sx={{ height: 48, mx: 2, borderRadius: 1, bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }} />
        <Box sx={{ display: 'flex', gap: 1, px: 2, py: 1.5 }}>
          <Box sx={{ height: 18, width: 50, borderRadius: 1, bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }} />
          <Box sx={{ height: 18, width: 40, borderRadius: 1, bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }} />
        </Box>
      </Paper>
    ))}
  </Box>
);

/* ─── Sort Options ─── */

type SortOption = 'newest' | 'oldest' | 'name';

/* ─── Main Component ─── */

const ArgusExplorePage: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const isDark = theme.palette.mode === 'dark';
  const { currentProject } = useOrgProject();
  const projectId = currentProject?.id || '1';

  // State
  const [queries, setQueries] = useState<ArgusSavedQuery[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sort, setSort] = useState<SortOption>('newest');
  const [filterTypes, setFilterTypes] = useState<string[]>([]);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [newMenuAnchor, setNewMenuAnchor] = useState<HTMLElement | null>(null);
  const [sortMenuAnchor, setSortMenuAnchor] = useState<HTMLElement | null>(null);
  const [duplicateTarget, setDuplicateTarget] = useState<ArgusSavedQuery | null>(null);
  const [duplicateName, setDuplicateName] = useState('');

  // Fetch
  const fetchQueries = useCallback(async () => {
    setLoading(true);
    try {
      const data = await argusService.listSavedQueries(projectId);
      setQueries(data);
    } catch (err) {
      console.error('Failed to fetch saved queries', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchQueries();
  }, [fetchQueries]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Filter + Sort
  const filteredQueries = useMemo(() => {
    let result = queries;

    if (favoritesOnly) {
      result = result.filter(sq => sq.is_favorite);
    }

    if (filterTypes.length > 0) {
      result = result.filter(sq => filterTypes.includes(sq.query_type));
    }

    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(
        sq => sq.name.toLowerCase().includes(q) ||
              sq.description?.toLowerCase().includes(q) ||
              sq.query_type.toLowerCase().includes(q)
      );
    }
    result = [...result].sort((a, b) => {
      // Always bubble favorites to the top
      if (a.is_favorite !== b.is_favorite) {
        return a.is_favorite ? -1 : 1;
      }
      if (sort === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sort === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return a.name.localeCompare(b.name);
    });
    return result;
  }, [queries, debouncedSearch, sort, filterTypes, favoritesOnly]);

  // Handlers
  const handleDelete = async (id: number) => {
    try {
      await argusService.deleteSavedQuery(projectId, id);
      setQueries(prev => prev.filter(q => q.id !== id));
    } catch (err) {
      console.error('Failed to delete query', err);
    }
  };

  const handleToggleFavorite = async (id: number, favorite: boolean) => {
    setQueries(prev => prev.map(q => q.id === id ? { ...q, is_favorite: favorite } : q));
    try {
      await argusService.updateSavedQuery(projectId, id, { is_favorite: favorite });
    } catch (err) {
      console.error('Failed to toggle favorite', err);
      // Revert on failure
      setQueries(prev => prev.map(q => q.id === id ? { ...q, is_favorite: !favorite } : q));
    }
  };

  const handleRename = async (id: number, newName: string) => {
    const oldName = queries.find(q => q.id === id)?.name || '';
    setQueries(prev => prev.map(q => q.id === id ? { ...q, name: newName } : q));
    try {
      await argusService.updateSavedQuery(projectId, id, { name: newName });
    } catch (err) {
      console.error('Failed to rename query', err);
      // Revert on failure
      setQueries(prev => prev.map(q => q.id === id ? { ...q, name: oldName } : q));
    }
  };

  const handleQueryClick = (query: ArgusSavedQuery) => {
    const config = DATASET_CONFIG[query.query_type];
    if (!config) return;
    const params = new URLSearchParams();
    if (query.id) params.set('queryId', String(query.id));
    if (query.query_config?.conditions) params.set('q', query.query_config.conditions);
    if (query.query_config?.period) params.set('period', query.query_config.period);
    const qs = params.toString();
    navigate(`${config.path}${qs ? `?${qs}` : ''}`, { state: { queryName: query.name } });
  };

  const handleDuplicateClick = (query: ArgusSavedQuery) => {
    setDuplicateTarget(query);
    setDuplicateName(`${query.name}-Copy`);
  };

  const handleDuplicateConfirm = async () => {
    if (!duplicateTarget || !duplicateName.trim()) return;
    try {
      const newQuery = await argusService.createSavedQuery(projectId, {
        name: duplicateName.trim(),
        description: duplicateTarget.description || undefined,
        query_type: duplicateTarget.query_type,
        query_config: duplicateTarget.query_config,
        display_type: duplicateTarget.display_type,
      });
      const config = DATASET_CONFIG[duplicateTarget.query_type];
      if (config) {
        navigate(`${config.path}?queryId=${newQuery.id}`, { state: { queryName: duplicateName.trim() } });
      }
    } catch (err) {
      console.error('Failed to duplicate query', err);
    }
    setDuplicateTarget(null);
  };

  const handleNewQuery = (type: SavedQueryType) => {
    setNewMenuAnchor(null);
    navigate(DATASET_CONFIG[type].path);
  };

  /* ═══ RENDER ═══ */
  return (
    <Box>
      <PageHeader
        icon={<ExploreIcon />}
        title={
          <ArgusBreadcrumbs size="title" paths={[
            { label: t('argus.explore.title') }
          ]} />
        }
        subtitle={t('argus.explore.subtitle')}
      />

      {/* Quick Actions — "New" cards */}
      <Box sx={{ display: 'flex', gap: 1.5, mb: 3, flexWrap: 'wrap' }}>
        {(Object.entries(DATASET_CONFIG) as [SavedQueryType, typeof DATASET_CONFIG[SavedQueryType]][]).map(([type, cfg]) => (
          <Paper
            key={type}
            elevation={0}
            onClick={() => navigate(cfg.path)}
            sx={{
              flex: '1 1 160px', minWidth: 160, maxWidth: 280,
              p: 2, borderRadius: 2, cursor: 'pointer',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
              transition: 'all 0.2s',
              '&:hover': {
                borderColor: cfg.color,
                backgroundColor: alpha(cfg.color, 0.04),
                transform: 'translateY(-1px)',
                boxShadow: `0 4px 12px ${alpha(cfg.color, 0.1)}`,
              },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Box sx={{
                width: 32, height: 32, borderRadius: '8px',
                backgroundColor: alpha(cfg.color, 0.12),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: cfg.color,
              }}>
                {React.cloneElement(cfg.icon as React.ReactElement, { sx: { fontSize: 18, color: cfg.color } })}
              </Box>
              <Typography sx={{ fontSize: '0.85rem', fontWeight: 700 }}>
                {t(`argus.explore.new${type.charAt(0).toUpperCase() + type.slice(1)}`)}
              </Typography>
            </Box>
            <Typography sx={{ fontSize: '0.72rem', color: 'text.disabled', lineHeight: 1.4 }}>
              {type === 'traces' && t('argus.explore.tracesDesc')}
              {type === 'logs' && t('argus.explore.logsDesc')}
              {type === 'metrics' && t('argus.explore.metricsDesc')}
              {type === 'discover' && t('argus.explore.discoverDesc')}
            </Typography>
          </Paper>
        ))}
      </Box>

      {/* Saved Queries Section */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <Typography variant="h6" fontWeight={700} sx={{ fontSize: '1rem' }}>
          {t('argus.explore.savedQueries')}
        </Typography>
        <Chip
          label={filteredQueries.length}
          size="small"
          sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700, borderRadius: '10px' }}
        />
        <Box sx={{ ml: 'auto', display: 'flex', gap: 1, alignItems: 'center' }}>
          {/* Search */}
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 0.5,
            px: 1, py: 0.3, borderRadius: '6px',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
            backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : '#fff',
            minWidth: 260,
          }}>
            <SearchIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
            <Box component="input" value={search}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
              placeholder={t('argus.explore.searchQueries')}
              style={{
                flex: 1, border: 'none', outline: 'none', backgroundColor: 'transparent',
                color: 'inherit', fontSize: '0.75rem', padding: '4px', fontFamily: 'inherit',
              }}
            />
            {search && (
              <IconButton size="small" onClick={() => setSearch('')} sx={{ p: 0.2 }}>
                <CloseIcon sx={{ fontSize: 12 }} />
              </IconButton>
            )}
          </Box>

          {/* Favorites Only Filter */}
          <Tooltip title={t('argus.explore.favoritesOnly')}>
            <IconButton
              size="small"
              onClick={() => setFavoritesOnly(!favoritesOnly)}
              sx={{
                width: 28, height: 28,
                backgroundColor: favoritesOnly ? alpha(theme.palette.warning.main, 0.1) : 'transparent',
                color: favoritesOnly ? theme.palette.warning.main : 'text.disabled',
                border: `1px solid ${favoritesOnly ? alpha(theme.palette.warning.main, 0.3) : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                borderRadius: '6px',
                '&:hover': {
                  backgroundColor: alpha(theme.palette.warning.main, 0.15),
                }
              }}
            >
              {favoritesOnly ? <BookmarkIcon sx={{ fontSize: 16 }} /> : <BookmarkBorderIcon sx={{ fontSize: 16 }} />}
            </IconButton>
          </Tooltip>

          {/* Type Filter */}
          <MultiSelectFilterChip
            label={t('argus.explore.allTypes')}
            options={(Object.entries(DATASET_CONFIG) as [SavedQueryType, typeof DATASET_CONFIG[SavedQueryType]][]).map(([type, cfg]) => ({
              value: type,
              label: t(`argus.explore.type${type.charAt(0).toUpperCase() + type.slice(1)}`, cfg.label)
            }))}
            selected={filterTypes}
            onChange={setFilterTypes}
            emptyMeansAll
          />

          {/* Sort */}
          <Button
            size="small"
            variant="outlined"
            startIcon={<SortIcon sx={{ fontSize: 14 }} />}
            onClick={(e) => setSortMenuAnchor(e.currentTarget)}
            sx={{ textTransform: 'none', fontSize: '0.72rem', height: 28, borderRadius: '6px' }}
          >
            {sort === 'newest' ? t('argus.explore.sortNewest') :
             sort === 'oldest' ? t('argus.explore.sortOldest') :
             t('argus.explore.sortName')}
          </Button>
          <Menu
            anchorEl={sortMenuAnchor}
            open={Boolean(sortMenuAnchor)}
            onClose={() => setSortMenuAnchor(null)}
            slotProps={{ paper: { sx: { minWidth: 140, borderRadius: '8px' } } }}
          >
            <MenuItem onClick={() => { setSort('newest'); setSortMenuAnchor(null); }} selected={sort === 'newest'} sx={{ fontSize: '0.78rem' }}>
              {t('argus.explore.sortNewest')}
            </MenuItem>
            <MenuItem onClick={() => { setSort('oldest'); setSortMenuAnchor(null); }} selected={sort === 'oldest'} sx={{ fontSize: '0.78rem' }}>
              {t('argus.explore.sortOldest')}
            </MenuItem>
            <MenuItem onClick={() => { setSort('name'); setSortMenuAnchor(null); }} selected={sort === 'name'} sx={{ fontSize: '0.78rem' }}>
              {t('argus.explore.sortName')}
            </MenuItem>
          </Menu>

          {/* + New */}
          <Button
            size="small"
            variant="contained"
            startIcon={<AddIcon sx={{ fontSize: 14 }} />}
            endIcon={<ExpandMoreIcon sx={{ fontSize: 14 }} />}
            onClick={(e) => setNewMenuAnchor(e.currentTarget)}
            sx={{
              textTransform: 'none', fontSize: '0.75rem', fontWeight: 700, height: 30,
              borderRadius: '6px', px: 1.5,
            }}
          >
            {t('argus.explore.newQuery')}
          </Button>
          <Menu
            anchorEl={newMenuAnchor}
            open={Boolean(newMenuAnchor)}
            onClose={() => setNewMenuAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            slotProps={{ paper: { sx: { minWidth: 200, borderRadius: '8px', mt: 0.5 } } }}
          >
            {(Object.entries(DATASET_CONFIG) as [SavedQueryType, typeof DATASET_CONFIG[SavedQueryType]][]).map(([type, cfg]) => (
              <MenuItem key={type} onClick={() => handleNewQuery(type)} sx={{ fontSize: '0.8rem' }}>
                <ListItemIcon sx={{ color: cfg.color }}>
                  {React.cloneElement(cfg.icon as React.ReactElement, { sx: { fontSize: 16, color: cfg.color } })}
                </ListItemIcon>
                <ListItemText primaryTypographyProps={{ fontSize: '0.8rem' }}>
                  {t(`argus.explore.new${type.charAt(0).toUpperCase() + type.slice(1)}`)}
                </ListItemText>
              </MenuItem>
            ))}
          </Menu>
        </Box>
      </Box>

      {/* Saved Queries — Card Grid */}
      <PageContentLoader loading={loading} skeleton={<CardSkeleton isDark={isDark} />}>
        {filteredQueries.length > 0 ? (
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 2,
          }}>
            {filteredQueries.map((query) => (
              <QueryCard
                key={query.id}
                query={query}
                isDark={isDark}
                onDelete={handleDelete}
                onToggleFavorite={handleToggleFavorite}
                onRename={handleRename}
                onClick={handleQueryClick}
                onDuplicate={handleDuplicateClick}
              />
            ))}
          </Box>
        ) : (
          <Paper elevation={0} sx={{
            borderRadius: 2, p: 6, textAlign: 'center',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          }}>
            <ExploreIcon sx={{ fontSize: 56, color: alpha(theme.palette.primary.main, 0.15), mb: 1.5 }} />
            <Typography sx={{ fontSize: '1rem', fontWeight: 600, mb: 0.5 }}>
              {search
                ? t('argus.explore.noMatchingQueries')
                : t('argus.explore.noSavedQueries')
              }
            </Typography>
            <Typography color="text.disabled" sx={{ fontSize: '0.82rem', mb: 2 }}>
              {t('argus.explore.emptyDesc')}
            </Typography>
            <Button
              variant="contained"
              size="small"
              startIcon={<AddIcon />}
              onClick={(e) => setNewMenuAnchor(e.currentTarget)}
              sx={{ textTransform: 'none', fontWeight: 600, borderRadius: '8px' }}
            >
              {t('argus.explore.createFirstQuery')}
            </Button>
          </Paper>
        )}
      </PageContentLoader>

      {/* Duplicate Dialog */}
      <Dialog open={!!duplicateTarget} onClose={() => setDuplicateTarget(null)}>
        <DialogTitle sx={{ fontSize: '1rem', fontWeight: 700 }}>{t('argus.explore.duplicateQuery')}</DialogTitle>
        <DialogContent sx={{ minWidth: 320 }}>
          <TextField
            autoFocus
            margin="dense"
            label={t('argus.explore.queryName')}
            fullWidth
            variant="outlined"
            size="small"
            value={duplicateName}
            onChange={(e) => setDuplicateName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleDuplicateConfirm();
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDuplicateTarget(null)} sx={{ textTransform: 'none' }}>{t('common.cancel', 'Cancel')}</Button>
          <Button onClick={handleDuplicateConfirm} variant="contained" sx={{ textTransform: 'none', boxShadow: 'none' }}>{t('argus.explore.duplicateQuery')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ArgusExplorePage;
