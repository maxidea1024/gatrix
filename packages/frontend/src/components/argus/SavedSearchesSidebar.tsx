import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  alpha,
  useTheme,
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

export interface SavedSearch {
  id: string;
  name: string;
  query: string;
  sort: string;
  isDefault: boolean;
  isPinned: boolean;
}

interface SavedSearchesSidebarProps {
  currentQuery: string;
  currentSort: string;
  onApply: (search: SavedSearch) => void;
}

const STORAGE_KEY = 'argus.savedSearches';

const DEFAULT_SEARCHES: SavedSearch[] = [
  {
    id: 'default_unresolved',
    name: '',
    query: 'is:unresolved',
    sort: 'last_seen',
    isDefault: true,
    isPinned: false,
  },
  {
    id: 'default_assigned_me',
    name: '',
    query: 'assigned:me is:unresolved',
    sort: 'last_seen',
    isDefault: true,
    isPinned: false,
  },
  {
    id: 'default_bookmarked',
    name: '',
    query: 'is:unresolved bookmarks:me',
    sort: 'last_seen',
    isDefault: true,
    isPinned: false,
  },
  {
    id: 'default_new_today',
    name: '',
    query: 'is:unresolved firstSeen:-24h',
    sort: 'first_seen',
    isDefault: true,
    isPinned: false,
  },
  {
    id: 'default_errors',
    name: '',
    query: 'is:unresolved level:error OR level:fatal',
    sort: 'event_count',
    isDefault: true,
    isPinned: false,
  },
];

function loadSavedSearches(): SavedSearch[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    /* ignore */
  }
  return [];
}

function saveSavedSearches(searches: SavedSearch[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(searches));
}

const SavedSearchesSidebar: React.FC<SavedSearchesSidebarProps> = ({
  currentQuery,
  currentSort,
  onApply,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';

  const [customSearches, setCustomSearches] =
    useState<SavedSearch[]>(loadSavedSearches);
  const [editDialog, setEditDialog] = useState<{
    open: boolean;
    search: SavedSearch | null;
    isNew: boolean;
  }>({
    open: false,
    search: null,
    isNew: false,
  });
  const [editName, setEditName] = useState('');
  const [editQuery, setEditQuery] = useState('');

  useEffect(() => {
    saveSavedSearches(customSearches);
  }, [customSearches]);

  const defaultSearchNames: Record<string, string> = {
    default_unresolved: t('argus.savedSearches.unresolved'),
    default_assigned_me: t('argus.savedSearches.assignedToMe'),
    default_bookmarked: t('argus.savedSearches.bookmarked'),
    default_new_today: t('argus.savedSearches.newToday'),
    default_errors: t('argus.savedSearches.errorsAndFatal'),
  };

  const allSearches = [
    ...DEFAULT_SEARCHES.map((s) => ({
      ...s,
      name: defaultSearchNames[s.id] || s.id,
    })),
    ...customSearches,
  ];

  const handleSaveNew = () => {
    setEditDialog({ open: true, search: null, isNew: true });
    setEditName('');
    setEditQuery(currentQuery);
  };

  const handleEdit = (search: SavedSearch) => {
    setEditDialog({ open: true, search, isNew: false });
    setEditName(search.name);
    setEditQuery(search.query);
  };

  const handleSave = () => {
    if (!editName.trim()) return;
    if (editDialog.isNew) {
      const newSearch: SavedSearch = {
        id: `saved_${Date.now()}`,
        name: editName.trim(),
        query: editQuery.trim(),
        sort: currentSort,
        isDefault: false,
        isPinned: false,
      };
      setCustomSearches((prev) => [...prev, newSearch]);
    } else if (editDialog.search) {
      setCustomSearches((prev) =>
        prev.map((s) =>
          s.id === editDialog.search!.id
            ? { ...s, name: editName.trim(), query: editQuery.trim() }
            : s
        )
      );
    }
    setEditDialog({ open: false, search: null, isNew: false });
  };

  const handleDelete = (id: string) => {
    setCustomSearches((prev) => prev.filter((s) => s.id !== id));
  };

  const handleTogglePin = (id: string) => {
    setCustomSearches((prev) =>
      prev.map((s) => (s.id === id ? { ...s, isPinned: !s.isPinned } : s))
    );
  };

  const isActive = (search: SavedSearch) =>
    currentQuery === search.query && currentSort === search.sort;

  return (
    <Box
      sx={{
        width: 240,
        flexShrink: 0,
        borderRight: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        pr: 1.5,
        mr: 1.5,
        display: { xs: 'none', md: 'block' },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 1,
        }}
      >
        <Typography
          sx={{
            fontSize: '0.72rem',
            fontWeight: 700,
            color: 'text.secondary',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          {t('argus.savedSearches.title')}
        </Typography>
        <Tooltip title={t('argus.savedSearches.saveCurrentSearch')}>
          <IconButton
            size="small"
            onClick={handleSaveNew}
            sx={{ width: 22, height: 22 }}
          >
            <AddIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Search list */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
        {allSearches.map((search) => (
          <Box
            key={search.id}
            onClick={() => onApply(search)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              px: 1,
              py: 0.5,
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.1s',
              backgroundColor: isActive(search)
                ? alpha(theme.palette.primary.main, 0.1)
                : 'transparent',
              '&:hover': {
                backgroundColor: isActive(search)
                  ? alpha(theme.palette.primary.main, 0.15)
                  : isDark
                    ? 'rgba(255,255,255,0.04)'
                    : 'rgba(0,0,0,0.04)',
                '& .saved-search-actions': { opacity: 1 },
              },
            }}
          >
            <SearchIcon
              sx={{
                fontSize: 13,
                color: isActive(search) ? 'primary.main' : 'text.disabled',
                flexShrink: 0,
              }}
            />
            <Typography
              sx={{
                fontSize: '0.76rem',
                fontWeight: isActive(search) ? 700 : 400,
                color: isActive(search) ? 'primary.main' : 'text.primary',
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {search.name}
            </Typography>

            {!search.isDefault && (
              <Box
                className="saved-search-actions"
                sx={{
                  display: 'flex',
                  opacity: 0,
                  transition: 'opacity 0.15s',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <IconButton
                  size="small"
                  onClick={() => handleTogglePin(search.id)}
                  sx={{ width: 18, height: 18, p: 0 }}
                >
                  {search.isPinned ? (
                    <StarIcon sx={{ fontSize: 12, color: 'warning.main' }} />
                  ) : (
                    <StarBorderIcon
                      sx={{ fontSize: 12, color: 'text.disabled' }}
                    />
                  )}
                </IconButton>
                <IconButton
                  size="small"
                  onClick={() => handleEdit(search)}
                  sx={{ width: 18, height: 18, p: 0 }}
                >
                  <EditIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={() => handleDelete(search.id)}
                  sx={{ width: 18, height: 18, p: 0 }}
                >
                  <DeleteIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
                </IconButton>
              </Box>
            )}
          </Box>
        ))}
      </Box>

      {/* Edit/Create Dialog */}
      <Dialog
        open={editDialog.open}
        onClose={() =>
          setEditDialog({ open: false, search: null, isNew: false })
        }
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: '12px' } }}
      >
        <DialogTitle sx={{ fontSize: '0.95rem', fontWeight: 700 }}>
          {editDialog.isNew
            ? t('argus.savedSearches.create')
            : t('argus.savedSearches.edit')}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            size="small"
            label={t('argus.savedSearches.name')}
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            sx={{ mt: 1, mb: 2 }}
          />
          <TextField
            fullWidth
            size="small"
            label={t('argus.savedSearches.query')}
            value={editQuery}
            onChange={(e) => setEditQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
            }}
            placeholder="is:unresolved level:error"
            InputProps={{ sx: { fontSize: '0.85rem' } }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            size="small"
            onClick={() =>
              setEditDialog({ open: false, search: null, isNew: false })
            }
            sx={{ textTransform: 'none' }}
          >
            {t('common.cancel')}
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={handleSave}
            disabled={!editName.trim()}
            sx={{ textTransform: 'none' }}
          >
            {t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SavedSearchesSidebar;
