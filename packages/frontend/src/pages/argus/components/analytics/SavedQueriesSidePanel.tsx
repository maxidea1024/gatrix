import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Drawer,
} from '@mui/material';
import {
  Close as CloseIcon,
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
  /** Whether the drawer is open */
  open: boolean;
  /** Called when the drawer should close */
  onClose: () => void;
}

const DEFAULT_WIDTH = 300;
const MIN_WIDTH = 240;
const MAX_WIDTH = 500;
const STORAGE_KEY = 'argus_saved_queries_drawer_width';

const SavedQueriesSidePanel: React.FC<SavedQueriesSidePanelProps> = ({
  projectId,
  queryType,
  activeQueryId,
  onLoadQuery,
  onNewQuery,
  refreshTrigger = 0,
  open,
  onClose,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [queries, setQueries] = useState<ArgusSavedQuery[]>([]);
  const [loading, setLoading] = useState(false);

  // --- Resizable drawer width ---
  const [drawerWidth, setDrawerWidth] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored
        ? Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Number(stored)))
        : DEFAULT_WIDTH;
    } catch {
      return DEFAULT_WIDTH;
    }
  });
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(DEFAULT_WIDTH);

  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDragging.current = true;
      startX.current = e.clientX;
      startWidth.current = drawerWidth;

      const onMouseMove = (ev: MouseEvent) => {
        if (!isDragging.current) return;
        // Dragging leftward increases width (drawer is on right side)
        const delta = startX.current - ev.clientX;
        const newWidth = Math.max(
          MIN_WIDTH,
          Math.min(MAX_WIDTH, startWidth.current + delta)
        );
        setDrawerWidth(newWidth);
      };

      const onMouseUp = () => {
        isDragging.current = false;
        try {
          localStorage.setItem(STORAGE_KEY, String(drawerWidth));
        } catch {
          // silent
        }
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [drawerWidth]
  );

  // Persist width when it changes
  useEffect(() => {
    if (!isDragging.current) return;
    const id = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, String(drawerWidth));
      } catch {
        // silent
      }
    }, 200);
    return () => clearTimeout(id);
  }, [drawerWidth]);

  // --- Data loading ---
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

  // Load when opened or type/refresh changes
  useEffect(() => {
    if (open) {
      loadQueries();
    }
  }, [open, loadQueries, refreshTrigger]);

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

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      variant="persistent"
      sx={{
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          position: 'fixed',
          top: 48, // Below AppBar
          height: 'calc(100vh - 48px)',
          borderLeft: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
          backgroundColor: isDark
            ? theme.palette.background.default
            : theme.palette.background.paper,
          backgroundImage: 'none',
          boxShadow: open
            ? isDark
              ? '-8px 0 24px rgba(0,0,0,0.3)'
              : '-4px 0 16px rgba(0,0,0,0.08)'
            : 'none',
          overflow: 'hidden',
        },
      }}
    >
      {/* Resize Handle (left edge) */}
      <Box
        onMouseDown={handleResizeMouseDown}
        sx={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: '4px',
          cursor: 'col-resize',
          zIndex: 10,
          '&::after': {
            content: '""',
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: '-3px',
            right: '-3px',
            cursor: 'col-resize',
          },
          '&:hover, &:active': {
            bgcolor: 'primary.main',
          },
          transition: 'background-color 0.15s',
        }}
      />

      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1.25,
          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          flexShrink: 0,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <FolderIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
          <Typography
            variant="subtitle2"
            fontWeight={700}
            sx={{ fontSize: '0.8rem' }}
          >
            {t('argus.analytics.savedQueries', 'Saved Queries')}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 0.25 }}>
          <Tooltip title={t('argus.analytics.newQuery', 'New Query')}>
            <IconButton size="small" onClick={onNewQuery} sx={{ p: 0.4 }}>
              <AddIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title={t('common.close', 'Close')}>
            <IconButton size="small" onClick={onClose} sx={{ p: 0.4 }}>
              <CloseIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Query List */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          '&::-webkit-scrollbar': { width: '5px' },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: isDark
              ? 'rgba(255,255,255,0.1)'
              : 'rgba(0,0,0,0.1)',
            borderRadius: '3px',
          },
        }}
      >
        {loading ? (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <CircularProgress size={22} />
          </Box>
        ) : queries.length === 0 ? (
          <Box sx={{ px: 2, py: 4, textAlign: 'center' }}>
            <FolderIcon
              sx={{ fontSize: 32, color: 'text.disabled', mb: 0.5 }}
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
                    px: 2,
                    py: 0.85,
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
                        fontSize="0.8rem"
                        noWrap
                      >
                        {query.name}
                      </Typography>
                    }
                    secondary={
                      <Typography
                        variant="caption"
                        sx={{
                          fontSize: '0.65rem',
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
    </Drawer>
  );
};

export default SavedQueriesSidePanel;
