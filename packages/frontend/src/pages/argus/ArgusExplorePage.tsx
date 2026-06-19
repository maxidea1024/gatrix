import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Chip,
  IconButton,
  useTheme,
  alpha,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import {
  Explore as ExploreIcon,
  Timeline as TracesIcon,
  Terminal as LogsIcon,
  BarChart as MetricsIcon,
  Search as SearchIcon,
  Close as CloseIcon,
  Add as AddIcon,
  Bookmark as BookmarkIcon,
  BookmarkBorder as BookmarkBorderIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import PageContentLoader from '@/components/common/PageContentLoader';
import EmptyPlaceholder from '@/components/common/EmptyPlaceholder';
import PageHeader from '@/components/common/PageHeader';
import ArgusBreadcrumbs from '@/components/argus/ArgusBreadcrumbs';
import argusService, {
  type ArgusSavedQuery,
  type SavedQueryType,
} from '@/services/argusService';
import MultiSelectFilterChip from '@/components/common/MultiSelectFilterChip';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import FilterChipSelect from '@/components/common/FilterChipSelect';
import DeleteQueryConfirmDialog from '@/components/argus/DeleteQueryConfirmDialog';
import {
  DATASET_CONFIG,
  QueryCard,
  type SortOption,
} from './components/exploreHelpers';

/* ─── Main Component ─── */

const ArgusExplorePage: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();
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
  const [sortAnchor, setSortAnchor] = useState<HTMLElement | null>(null);
  const [duplicateTarget, setDuplicateTarget] =
    useState<ArgusSavedQuery | null>(null);
  const [duplicateName, setDuplicateName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ArgusSavedQuery | null>(
    null
  );

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
      result = result.filter((sq) => sq.is_favorite);
    }

    if (filterTypes.length > 0) {
      result = result.filter((sq) => filterTypes.includes(sq.query_type));
    }

    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(
        (sq) =>
          sq.name.toLowerCase().includes(q) ||
          sq.description?.toLowerCase().includes(q) ||
          sq.query_type.toLowerCase().includes(q)
      );
    }
    result = [...result].sort((a, b) => {
      // Always bubble favorites to the top
      if (a.is_favorite !== b.is_favorite) {
        return a.is_favorite ? -1 : 1;
      }
      if (sort === 'newest')
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      if (sort === 'oldest')
        return (
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      return a.name.localeCompare(b.name);
    });
    return result;
  }, [queries, debouncedSearch, sort, filterTypes, favoritesOnly]);

  // Handlers
  const handleDelete = (id: number) => {
    const target = queries.find((q) => q.id === id);
    if (target) setDeleteTarget(target);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await argusService.deleteSavedQuery(projectId, deleteTarget.id);
      setQueries((prev) => prev.filter((q) => q.id !== deleteTarget.id));
    } catch (err) {
      console.error('Failed to delete query', err);
    }
    setDeleteTarget(null);
  };

  const handleToggleFavorite = async (id: number, favorite: boolean) => {
    setQueries((prev) =>
      prev.map((q) => (q.id === id ? { ...q, is_favorite: favorite } : q))
    );
    try {
      await argusService.toggleSavedQueryFavorite(projectId, id, favorite);
    } catch (err) {
      console.error('Failed to toggle favorite', err);
      // Revert on failure
      setQueries((prev) =>
        prev.map((q) => (q.id === id ? { ...q, is_favorite: !favorite } : q))
      );
    }
  };

  const handleRename = async (id: number, newName: string) => {
    const oldName = queries.find((q) => q.id === id)?.name || '';
    setQueries((prev) =>
      prev.map((q) => (q.id === id ? { ...q, name: newName } : q))
    );
    try {
      await argusService.updateSavedQuery(projectId, id, { name: newName });
    } catch (err) {
      console.error('Failed to rename query', err);
      // Revert on failure
      setQueries((prev) =>
        prev.map((q) => (q.id === id ? { ...q, name: oldName } : q))
      );
    }
  };

  const handleQueryClick = (query: ArgusSavedQuery) => {
    const config = DATASET_CONFIG[query.query_type];
    if (!config) return;
    const cfg =
      typeof query.query_config === 'string'
        ? JSON.parse(query.query_config)
        : query.query_config || {};
    const params = new URLSearchParams();
    if (query.id) params.set('queryId', String(query.id));

    if (query.query_type === 'issues') {
      // Issues page uses its own param names
      if (cfg.search) params.set('search', cfg.search);
      if (cfg.status) params.set('status', cfg.status);
      if (cfg.level) params.set('level', cfg.level);
      if (cfg.sort) params.set('sort', cfg.sort);
      if (cfg.substatus) params.set('substatus', cfg.substatus);
      if (cfg.assignedTo) params.set('assigned_to', cfg.assignedTo);
    } else {
      if (cfg.search) params.set('q', cfg.search);
      else if (cfg.conditions) params.set('q', cfg.conditions);
      if (cfg.period) params.set('period', cfg.period);
      if (cfg.groupBy) params.set('groupBy', cfg.groupBy);
      if (cfg.tab !== undefined) params.set('tab', String(cfg.tab));
      if (cfg.orderBy) params.set('orderBy', cfg.orderBy);
      if (cfg.volumeChartType) params.set('vct', cfg.volumeChartType);
      if (cfg.aggChartTypes) params.set('act', cfg.aggChartTypes);
    }
    const qs = params.toString();
    navigate(`${config.path}${qs ? `?${qs}` : ''}`, {
      state: { queryName: query.name },
    });
  };

  const handleDuplicateInPlace = async (query: ArgusSavedQuery) => {
    try {
      await argusService.createSavedQuery(projectId, {
        name: `${query.name}-Copy`,
        description: query.description || undefined,
        query_type: query.query_type,
        query_config: query.query_config,
        display_type: query.display_type,
      });
      // Refresh list
      const updated = await argusService.listSavedQueries(projectId);
      setQueries(updated);
    } catch (err) {
      console.error('Failed to duplicate query', err);
    }
  };

  const handleDuplicateAndEdit = (query: ArgusSavedQuery) => {
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
        navigate(`${config.path}?queryId=${newQuery.id}`, {
          state: { queryName: duplicateName.trim() },
        });
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

  // ─── Stable callback handlers (for React.memo) ─────────────────
  const handleSortOpen = useCallback(
    (e: React.MouseEvent<HTMLElement>) => setSortAnchor(e.currentTarget),
    []
  );
  const handleSortClose = useCallback(() => setSortAnchor(null), []);
  const handleSortSelect = useCallback(
    (v: string) => setSort(v as SortOption),
    []
  );

  /* ═══ RENDER ═══ */
  return (
    <Box>
      <PageHeader
        icon={<ExploreIcon />}
        title={
          <ArgusBreadcrumbs
            size="title"
            paths={[{ label: t('argus.explore.title') }]}
          />
        }
        subtitle={t('argus.explore.subtitle')}
      />

      {/* ── Quick Actions Row ── */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 1.5,
          mb: 2,
        }}
      >
        {(
          Object.entries(DATASET_CONFIG) as [
            SavedQueryType,
            (typeof DATASET_CONFIG)[SavedQueryType],
          ][]
        ).map(([type, cfg]) => (
          <Box
            key={type}
            onClick={() => navigate(cfg.path)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.2,
              p: 1.5,
              borderRadius: 2,
              cursor: 'pointer',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
              backgroundColor: isDark ? 'rgba(255,255,255,0.015)' : '#fff',
              transition: 'all 0.2s',
              '&:hover': {
                borderColor: cfg.color,
                backgroundColor: alpha(cfg.color, 0.04),
                transform: 'translateY(-1px)',
                boxShadow: `0 4px 12px ${alpha(cfg.color, 0.1)}`,
              },
            }}
          >
            <Box
              sx={{
                width: 32,
                height: 32,
                minWidth: 32,
                borderRadius: '8px',
                backgroundColor: alpha(cfg.color, 0.12),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: cfg.color,
              }}
            >
              {React.cloneElement(cfg.icon as React.ReactElement, {
                sx: { fontSize: 18, color: cfg.color },
              })}
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                sx={{
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  lineHeight: 1.2,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {t(
                  `argus.explore.new${type.charAt(0).toUpperCase() + type.slice(1)}`
                )}
              </Typography>
              <Typography
                sx={{
                  fontSize: '0.65rem',
                  color: 'text.disabled',
                  lineHeight: 1.3,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {type === 'traces' && t('argus.explore.tracesDesc')}
                {type === 'logs' && t('argus.explore.logsDesc')}
                {type === 'metrics' && t('argus.explore.metricsDesc')}
                {type === 'discover' && t('argus.explore.discoverDesc')}
                {type === 'issues' && t('argus.explore.issuesDesc')}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>

      {/* ── Saved Queries Panel ── */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: 2.5,
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          overflow: 'hidden',
        }}
      >
        {/* Filter Toolbar */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            px: 2,
            py: 1,
            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
          }}
        >
          <Typography
            sx={{ fontSize: '0.85rem', fontWeight: 700, whiteSpace: 'nowrap' }}
          >
            {t('argus.explore.savedQueries')}
          </Typography>
          <Chip
            label={filteredQueries.length}
            size="small"
            sx={{
              height: 20,
              fontSize: '0.68rem',
              fontWeight: 700,
              borderRadius: '10px',
            }}
          />
          <Box
            sx={{ ml: 'auto', display: 'flex', gap: 1, alignItems: 'center' }}
          >
            {/* Search */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                px: 1,
                height: 32,
                borderRadius: '6px',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : '#fff',
                minWidth: 220,
              }}
            >
              <SearchIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
              <Box
                component="input"
                value={search}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setSearch(e.target.value)
                }
                placeholder={t('argus.explore.searchQueries')}
                style={{
                  flex: 1,
                  border: 'none',
                  outline: 'none',
                  backgroundColor: 'transparent',
                  color: 'inherit',
                  fontSize: '0.75rem',
                  padding: '4px',
                  fontFamily: 'inherit',
                }}
              />
              {search && (
                <IconButton
                  size="small"
                  onClick={() => setSearch('')}
                  sx={{ p: 0.2 }}
                >
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
                  width: 32,
                  height: 32,
                  backgroundColor: favoritesOnly
                    ? alpha(theme.palette.warning.main, 0.1)
                    : 'transparent',
                  color: favoritesOnly
                    ? theme.palette.warning.main
                    : 'text.disabled',
                  border: `1px solid ${favoritesOnly ? alpha(theme.palette.warning.main, 0.3) : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                  borderRadius: '6px',
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.warning.main, 0.15),
                  },
                }}
              >
                {favoritesOnly ? (
                  <BookmarkIcon sx={{ fontSize: 16 }} />
                ) : (
                  <BookmarkBorderIcon sx={{ fontSize: 16 }} />
                )}
              </IconButton>
            </Tooltip>

            {/* Type Filter */}
            <MultiSelectFilterChip
              label={t('argus.explore.allTypes')}
              options={(
                Object.entries(DATASET_CONFIG) as [
                  SavedQueryType,
                  (typeof DATASET_CONFIG)[SavedQueryType],
                ][]
              ).map(([type, cfg]) => ({
                value: type,
                label: t(
                  `argus.explore.type${type.charAt(0).toUpperCase() + type.slice(1)}`,
                  cfg.label
                ),
              }))}
              selected={filterTypes}
              onChange={setFilterTypes}
              emptyMeansAll
            />

            {/* Sort */}
            <FilterChipSelect
              label={t('argus.issues.sort')}
              value={sort}
              options={[
                { value: 'newest', label: t('argus.explore.sortNewest') },
                { value: 'oldest', label: t('argus.explore.sortOldest') },
                { value: 'name', label: t('argus.explore.sortName') },
              ]}
              anchorEl={sortAnchor}
              onOpen={handleSortOpen}
              onClose={handleSortClose}
              onSelect={handleSortSelect}
            />

            <Menu
              anchorEl={newMenuAnchor}
              open={Boolean(newMenuAnchor)}
              onClose={() => setNewMenuAnchor(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              slotProps={{
                paper: { sx: { minWidth: 200, borderRadius: '8px', mt: 0.5 } },
              }}
            >
              {(
                Object.entries(DATASET_CONFIG) as [
                  SavedQueryType,
                  (typeof DATASET_CONFIG)[SavedQueryType],
                ][]
              ).map(([type, cfg]) => (
                <MenuItem
                  key={type}
                  onClick={() => handleNewQuery(type)}
                  sx={{ fontSize: '0.8rem' }}
                >
                  <ListItemIcon sx={{ color: cfg.color }}>
                    {React.cloneElement(cfg.icon as React.ReactElement, {
                      sx: { fontSize: 16, color: cfg.color },
                    })}
                  </ListItemIcon>
                  <ListItemText primaryTypographyProps={{ fontSize: '0.8rem' }}>
                    {t(
                      `argus.explore.new${type.charAt(0).toUpperCase() + type.slice(1)}`
                    )}
                  </ListItemText>
                </MenuItem>
              ))}
            </Menu>
          </Box>
        </Box>

        {/* Card Grid */}
        <Box sx={{ p: 2 }}>
          <PageContentLoader loading={loading}>
            {filteredQueries.length > 0 ? (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: 2,
                }}
              >
                {filteredQueries.map((query) => (
                  <QueryCard
                    key={query.id}
                    query={query}
                    isDark={isDark}
                    projectId={projectId}
                    onDelete={handleDelete}
                    onToggleFavorite={handleToggleFavorite}
                    onRename={handleRename}
                    onClick={handleQueryClick}
                    onDuplicate={handleDuplicateInPlace}
                    onDuplicateAndEdit={handleDuplicateAndEdit}
                  />
                ))}
              </Box>
            ) : (
              <EmptyPlaceholder
                icon={
                  <ExploreIcon
                    sx={{
                      fontSize: 48,
                      color: alpha(theme.palette.primary.main, 0.15),
                    }}
                  />
                }
                message={
                  search
                    ? t('argus.explore.noMatchingQueries')
                    : t('argus.explore.noSavedQueries')
                }
                description={t('argus.explore.emptyDesc')}
                minHeight={200}
              >
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={(e) => setNewMenuAnchor(e.currentTarget)}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 600,
                    borderRadius: '8px',
                    mt: 1.5,
                  }}
                >
                  {t('argus.explore.createFirstQuery')}
                </Button>
              </EmptyPlaceholder>
            )}
          </PageContentLoader>
        </Box>
      </Paper>

      {/* Duplicate Dialog */}
      <Dialog open={!!duplicateTarget} onClose={() => setDuplicateTarget(null)}>
        <DialogTitle sx={{ fontSize: '1rem', fontWeight: 700 }}>
          {t('argus.explore.duplicateQuery')}
        </DialogTitle>
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
          <Button
            onClick={() => setDuplicateTarget(null)}
            sx={{ textTransform: 'none' }}
          >
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            onClick={handleDuplicateConfirm}
            variant="contained"
            sx={{ textTransform: 'none', boxShadow: 'none' }}
          >
            {t('argus.explore.duplicateQuery')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <DeleteQueryConfirmDialog
        open={!!deleteTarget}
        queryName={deleteTarget?.name || ''}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </Box>
  );
};

export default ArgusExplorePage;
