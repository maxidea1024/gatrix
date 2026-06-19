import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  ListItemSecondaryAction,
  CircularProgress,
  Tooltip,
  alpha,
  useTheme,
  Divider,
} from '@mui/material';
import {
  ChevronLeft as CollapseIcon,
  ChevronRight as ExpandIcon,
  Delete as DeleteIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  Add as AddIcon,
  FolderOpen as FolderIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import argusService, {
  type ArgusSavedQuery,
  type SavedQueryType,
} from '@/services/argusService';
import { formatRelativeTime } from '@/utils/dateFormat';

export interface SavedQueriesSidePanelProps {
  projectId: string | number;
  /** Which analytics sub-type to filter by */
  queryType: SavedQueryType;
  /** Currently loaded query ID (for highlighting) */
  activeQueryId: number | null;
  /** Called when a query is selected to load */
  onLoadQuery: (query: ArgusSavedQuery) => void;
  /** Called when user clicks "New Query" */
  onNewQuery: () => void;
  /** External refresh trigger (bump to reload list) */
  refreshTrigger?: number;
}

const PANEL_WIDTH = 260;

const SavedQueriesSidePanel: React.FC<SavedQueriesSidePanelProps> = ({
  projectId,
  queryType,
  activeQueryId,
  onLoadQuery,
  onNewQuery,
  refreshTrigger = 0,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [collapsed, setCollapsed] = useState(true);
  const [queries, setQueries] = useState<ArgusSavedQuery[]>([]);
  const [loading, setLoading] = useState(false);

  const loadQueries = useCallback(async () => {
    setLoading(true);
    try {
      const data = await argusService.listSavedQueries(projectId, queryType);
      setQueries(data || []);
    } catch {
      setQueries([]);
    } finally {
      setLoading(false);
    }
  }, [projectId, queryType]);

  // Load on mount, type change, or external refresh
  useEffect(() => {
    if (!collapsed) {
      loadQueries();
    }
  }, [collapsed, loadQueries, refreshTrigger]);

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await argusService.deleteSavedQuery(projectId, id);
      setQueries((prev) => prev.filter((q) => q.id !== id));
    } catch {
      // silent
    }
  };

  const handleToggleFavorite = async (
    id: number,
    favorite: boolean,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    try {
      await argusService.updateSavedQuery(projectId, id, {
        is_favorite: favorite,
      });
      setQueries((prev) =>
        prev.map((q) => (q.id === id ? { ...q, is_favorite: favorite } : q))
      );
    } catch {
      // silent
    }
  };

  // Collapsed state: thin vertical strip
  if (collapsed) {
    return (
      <Box
        sx={{
          width: 36,
          minWidth: 36,
          flexShrink: 0,
          borderRight: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          pt: 1,
        }}
      >
        <Tooltip
          title={t('argus.analytics.savedQueries', 'Saved Queries')}
          placement="right"
        >
          <IconButton
            size="small"
            onClick={() => setCollapsed(false)}
            sx={{ p: 0.5 }}
          >
            <ExpandIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
        <Tooltip
          title={t('argus.analytics.savedQueries', 'Saved Queries')}
          placement="right"
        >
          <IconButton
            size="small"
            onClick={() => setCollapsed(false)}
            sx={{
              p: 0.5,
              mt: 0.5,
              color: 'text.disabled',
              writing: 'vertical-rl',
            }}
          >
            <FolderIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Box>
    );
  }

  // Expanded state
  return (
    <Box
      sx={{
        width: PANEL_WIDTH,
        minWidth: PANEL_WIDTH,
        flexShrink: 0,
        borderRight: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        backgroundColor: isDark
          ? 'rgba(255,255,255,0.01)'
          : 'rgba(0,0,0,0.008)',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 1.5,
          py: 1,
          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        }}
      >
        <Typography
          variant="caption"
          fontWeight={700}
          sx={{ fontSize: '0.75rem', color: 'text.secondary' }}
        >
          {t('argus.analytics.savedQueries', 'Saved Queries')}
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.25 }}>
          <Tooltip title={t('argus.analytics.newQuery', 'New Query')}>
            <IconButton size="small" onClick={onNewQuery} sx={{ p: 0.3 }}>
              <AddIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
          <IconButton
            size="small"
            onClick={() => setCollapsed(true)}
            sx={{ p: 0.3 }}
          >
            <CollapseIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
      </Box>

      {/* Query List */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {loading ? (
          <Box sx={{ py: 3, textAlign: 'center' }}>
            <CircularProgress size={20} />
          </Box>
        ) : queries.length === 0 ? (
          <Box sx={{ px: 2, py: 3, textAlign: 'center' }}>
            <FolderIcon
              sx={{ fontSize: 28, color: 'text.disabled', mb: 0.5 }}
            />
            <Typography
              variant="caption"
              sx={{ color: 'text.disabled', display: 'block' }}
            >
              {t('argus.analytics.noSavedQueries', 'No saved queries')}
            </Typography>
          </Box>
        ) : (
          <List dense disablePadding>
            {/* Favorites first */}
            {queries
              .sort((a, b) => {
                if (a.is_favorite && !b.is_favorite) return -1;
                if (!a.is_favorite && b.is_favorite) return 1;
                return (
                  new Date(b.updated_at).getTime() -
                  new Date(a.updated_at).getTime()
                );
              })
              .map((query) => (
                <ListItemButton
                  key={query.id}
                  selected={activeQueryId === query.id}
                  onClick={() => onLoadQuery(query)}
                  sx={{
                    px: 1.5,
                    py: 0.75,
                    borderLeft: `3px solid ${
                      activeQueryId === query.id
                        ? theme.palette.primary.main
                        : 'transparent'
                    }`,
                    '&.Mui-selected': {
                      backgroundColor: alpha(theme.palette.primary.main, 0.06),
                    },
                    '&:hover .query-actions': { opacity: 1 },
                  }}
                >
                  <ListItemText
                    primary={
                      <Typography
                        variant="body2"
                        fontWeight={activeQueryId === query.id ? 700 : 500}
                        fontSize="0.78rem"
                        noWrap
                      >
                        {query.name}
                      </Typography>
                    }
                    secondary={
                      <Typography
                        variant="caption"
                        sx={{
                          fontSize: '0.62rem',
                          color: 'text.disabled',
                        }}
                      >
                        {formatRelativeTime(
                          query.updated_at || query.created_at
                        )}
                      </Typography>
                    }
                  />
                  <ListItemSecondaryAction
                    className="query-actions"
                    sx={{
                      opacity: activeQueryId === query.id ? 1 : 0,
                      transition: 'opacity 0.15s',
                      display: 'flex',
                      gap: 0,
                    }}
                  >
                    <IconButton
                      size="small"
                      onClick={(e) =>
                        handleToggleFavorite(query.id, !query.is_favorite, e)
                      }
                      sx={{ p: 0.25 }}
                    >
                      {query.is_favorite ? (
                        <StarIcon sx={{ fontSize: 14, color: '#f59e0b' }} />
                      ) : (
                        <StarBorderIcon
                          sx={{ fontSize: 14, color: 'text.disabled' }}
                        />
                      )}
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={(e) => handleDelete(query.id, e)}
                      sx={{
                        p: 0.25,
                        '&:hover': { color: '#f44336' },
                      }}
                    >
                      <DeleteIcon
                        sx={{ fontSize: 14, color: 'text.disabled' }}
                      />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItemButton>
              ))}
          </List>
        )}
      </Box>
    </Box>
  );
};

export default SavedQueriesSidePanel;
