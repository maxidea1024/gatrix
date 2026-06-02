import React, { useState, useRef, useEffect } from 'react';
import {
  Box, Typography, Chip, IconButton, Menu, MenuItem,
  ListItemIcon, ListItemText, Divider, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Button, Tooltip,
  alpha, useTheme,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Share as ShareIcon,
  DragIndicator as DragIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  MoreVert as MoreVertIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

export interface IssueView {
  id: string;
  name: string;
  query: string;
  sort: string;
  isDefault: boolean;
  isCustom: boolean;
  urlParams: Record<string, string>;
}

interface IssueViewTabsProps {
  activeViewId: string;
  onViewChange: (view: IssueView) => void;
  onSaveCurrentAsView?: () => void;
  currentUser?: string;
}

const DEFAULT_VIEWS: IssueView[] = [
  {
    id: 'all',
    name: '', // will use t() key
    query: '',
    sort: 'last_seen',
    isDefault: true,
    isCustom: false,
    urlParams: { status: 'all' },
  },
  {
    id: 'unresolved',
    name: '',
    query: 'is:unresolved',
    sort: 'last_seen',
    isDefault: true,
    isCustom: false,
    urlParams: { status: 'unresolved' },
  },
  {
    id: 'for_review',
    name: '',
    query: 'is:unresolved is:for_review',
    sort: 'last_seen',
    isDefault: true,
    isCustom: false,
    urlParams: { status: 'unresolved', substatus: 'new' },
  },
  {
    id: 'regressed',
    name: '',
    query: 'is:unresolved is:regressed',
    sort: 'last_seen',
    isDefault: true,
    isCustom: false,
    urlParams: { status: 'unresolved', substatus: 'regressed' },
  },
  {
    id: 'escalating',
    name: '',
    query: 'is:unresolved is:escalating',
    sort: 'last_seen',
    isDefault: true,
    isCustom: false,
    urlParams: { status: 'unresolved', substatus: 'escalating' },
  },
  {
    id: 'mine',
    name: '',
    query: 'assigned:me',
    sort: 'last_seen',
    isDefault: true,
    isCustom: false,
    urlParams: { status: 'all', assigned_to: '__me__' },
  },
];

const STORAGE_KEY = 'argus.issueViews.custom';

function loadCustomViews(): IssueView[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return [];
}

function saveCustomViews(views: IssueView[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(views));
}

const IssueViewTabs: React.FC<IssueViewTabsProps> = ({
  activeViewId,
  onViewChange,
  onSaveCurrentAsView,
  currentUser,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';

  const [customViews, setCustomViews] = useState<IssueView[]>(loadCustomViews);
  const [contextMenu, setContextMenu] = useState<{ el: HTMLElement; view: IssueView } | null>(null);
  const [editDialog, setEditDialog] = useState<{ open: boolean; view: IssueView | null; isNew: boolean }>({
    open: false, view: null, isNew: false,
  });
  const [editName, setEditName] = useState('');

  useEffect(() => {
    saveCustomViews(customViews);
  }, [customViews]);

  const defaultViewNames: Record<string, string> = {
    all: t('argus.issueViews.all'),
    unresolved: t('argus.issueViews.unresolved'),
    for_review: t('argus.issueViews.forReview'),
    regressed: t('argus.issueViews.regressed'),
    escalating: t('argus.issueViews.escalating'),
    mine: t('argus.issueViews.mine'),
  };

  const allViews = [
    ...DEFAULT_VIEWS.map(v => ({ ...v, name: defaultViewNames[v.id] || v.id })),
    ...customViews,
  ];

  const getViewWithUser = (view: IssueView): IssueView => {
    if (view.id === 'mine' && currentUser) {
      return { ...view, urlParams: { ...view.urlParams, assigned_to: currentUser } };
    }
    return view;
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLElement>, view: IssueView) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ el: e.currentTarget, view });
  };

  const handleCloseMenu = () => setContextMenu(null);

  const handleDeleteView = (viewId: string) => {
    setCustomViews(prev => prev.filter(v => v.id !== viewId));
    handleCloseMenu();
    if (activeViewId === viewId) {
      onViewChange(getViewWithUser(allViews[1])); // fallback to unresolved
    }
  };

  const handleEditView = (view: IssueView) => {
    setEditDialog({ open: true, view, isNew: false });
    setEditName(view.name);
    handleCloseMenu();
  };

  const handleSaveEdit = () => {
    if (!editName.trim()) return;
    if (editDialog.isNew) {
      const newView: IssueView = {
        id: `custom_${Date.now()}`,
        name: editName.trim(),
        query: '',
        sort: 'last_seen',
        isDefault: false,
        isCustom: true,
        urlParams: {},
      };
      setCustomViews(prev => [...prev, newView]);
    } else if (editDialog.view) {
      setCustomViews(prev =>
        prev.map(v => v.id === editDialog.view!.id ? { ...v, name: editName.trim() } : v)
      );
    }
    setEditDialog({ open: false, view: null, isNew: false });
  };

  const handleAddView = () => {
    setEditDialog({ open: true, view: null, isNew: true });
    setEditName('');
  };

  const handleShareView = (view: IssueView) => {
    const params = new URLSearchParams(view.urlParams);
    params.set('view', view.id);
    const shareUrl = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    navigator.clipboard.writeText(shareUrl);
    handleCloseMenu();
  };

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1.5, flexWrap: 'wrap' }}>
        {allViews.map((view) => (
          <Chip
            key={view.id}
            label={view.name}
            size="small"
            onClick={() => onViewChange(getViewWithUser(view))}
            onContextMenu={(e) => handleContextMenu(e, view)}
            deleteIcon={
              view.isCustom ? (
                <MoreVertIcon sx={{ fontSize: '14px !important' }} />
              ) : undefined
            }
            onDelete={
              view.isCustom ? (e) => handleContextMenu(e as any, view) : undefined
            }
            variant={activeViewId === view.id ? 'filled' : 'outlined'}
            sx={{
              fontSize: '0.76rem',
              fontWeight: activeViewId === view.id ? 700 : 500,
              borderRadius: '16px',
              transition: 'all 0.15s',
              ...(activeViewId === view.id ? {
                backgroundColor: alpha(theme.palette.primary.main, 0.15),
                color: theme.palette.primary.main,
                borderColor: 'transparent',
              } : {
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                color: 'text.secondary',
                '&:hover': {
                  borderColor: alpha(theme.palette.primary.main, 0.3),
                  backgroundColor: alpha(theme.palette.primary.main, 0.04),
                },
              }),
            }}
          />
        ))}

        {/* Save current as view button */}
        {onSaveCurrentAsView && (
          <Tooltip title={t('argus.issueViews.saveCurrentView')}>
            <IconButton
              size="small"
              onClick={onSaveCurrentAsView}
              sx={{
                width: 24, height: 24,
                border: '1px dashed',
                borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
                borderRadius: '12px',
                '&:hover': {
                  borderColor: theme.palette.primary.main,
                  backgroundColor: alpha(theme.palette.primary.main, 0.04),
                },
              }}
            >
              <SaveIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
            </IconButton>
          </Tooltip>
        )}

        {/* Add new view button */}
        <Tooltip title={t('argus.issueViews.addView')}>
          <IconButton
            size="small"
            onClick={handleAddView}
            sx={{
              width: 24, height: 24,
              border: '1px dashed',
              borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
              borderRadius: '12px',
              '&:hover': {
                borderColor: theme.palette.primary.main,
                backgroundColor: alpha(theme.palette.primary.main, 0.04),
              },
            }}
          >
            <AddIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Context Menu */}
      <Menu
        open={Boolean(contextMenu)}
        anchorEl={contextMenu?.el}
        onClose={handleCloseMenu}
        slotProps={{
          paper: { sx: { minWidth: 160, borderRadius: '8px', boxShadow: '0 4px 20px rgba(0,0,0,0.12)' } },
        }}
      >
        {contextMenu?.view.isCustom && (
          <MenuItem onClick={() => handleEditView(contextMenu!.view)} dense>
            <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
            <ListItemText primaryTypographyProps={{ fontSize: '0.8rem' }}>
              {t('argus.issueViews.rename')}
            </ListItemText>
          </MenuItem>
        )}
        <MenuItem onClick={() => contextMenu && handleShareView(contextMenu.view)} dense>
          <ListItemIcon><ShareIcon fontSize="small" /></ListItemIcon>
          <ListItemText primaryTypographyProps={{ fontSize: '0.8rem' }}>
            {t('argus.issueViews.share')}
          </ListItemText>
        </MenuItem>
        {contextMenu?.view.isCustom && [
          <Divider key="divider" />,
          <MenuItem key="delete" onClick={() => handleDeleteView(contextMenu!.view.id)} dense>
            <ListItemIcon><DeleteIcon fontSize="small" sx={{ color: 'error.main' }} /></ListItemIcon>
            <ListItemText primaryTypographyProps={{ fontSize: '0.8rem', color: 'error.main' }}>
              {t('argus.issueViews.delete')}
            </ListItemText>
          </MenuItem>,
        ]}
      </Menu>

      {/* Edit/Create Dialog */}
      <Dialog
        open={editDialog.open}
        onClose={() => setEditDialog({ open: false, view: null, isNew: false })}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: '12px' } }}
      >
        <DialogTitle sx={{ fontSize: '0.95rem', fontWeight: 700 }}>
          {editDialog.isNew ? t('argus.issueViews.createView') : t('argus.issueViews.renameView')}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            size="small"
            label={t('argus.issueViews.viewName')}
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(); }}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            size="small"
            onClick={() => setEditDialog({ open: false, view: null, isNew: false })}
            sx={{ textTransform: 'none' }}
          >
            {t('common.cancel')}
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={handleSaveEdit}
            disabled={!editName.trim()}
            sx={{ textTransform: 'none' }}
          >
            {t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default IssueViewTabs;
export { DEFAULT_VIEWS };
