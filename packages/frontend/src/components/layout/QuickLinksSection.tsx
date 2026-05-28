import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  Collapse,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  useTheme,
  alpha,
  CircularProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Close as CloseIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ExpandLess,
  ExpandMore,
  OpenInNew as OpenInNewIcon,
  BookmarkBorder as BookmarkBorderIcon,
  DragIndicator as DragIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  QuickLinkService,
  QuickLink,
  CreateQuickLinkData,
  UpdateQuickLinkData,
} from '@/services/quickLinkService';
import MuiIconPicker, {
  getQuickLinkIcon,
} from '@/components/common/MuiIconPicker';

// Preset color palette
const COLOR_PRESETS = [
  null, // default (theme color)
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#84cc16', // lime
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#f43f5e', // rose
  '#6b7280', // gray
];

// Common tooltip style for modern look + delayed appearance
const TOOLTIP_ENTER_DELAY = 600;
const TOOLTIP_ENTER_NEXT_DELAY = 400;
const TOOLTIP_SLOT_PROPS = {
  tooltip: {
    sx: {
      bgcolor: 'rgba(15, 15, 20, 0.92)',
      backdropFilter: 'blur(8px)',
      borderRadius: '8px',
      px: 1.5,
      py: 1,
      fontSize: '0.75rem',
      boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
      '& .MuiTooltip-arrow': {
        color: 'rgba(15, 15, 20, 0.92)',
      },
    },
  },
};

// Module-level cache to prevent flicker on remount
let _cachedLinks: QuickLink[] | null = null;

// Sortable link item component
interface SortableLinkItemProps {
  link: QuickLink;
  isDark: boolean;
  theme: any;
  onLinkClick: (url: string) => void;
  onEdit: (link: QuickLink) => void;
  onDelete: (link: QuickLink) => void;
  t: (key: string) => string;
}

const SortableLinkItem: React.FC<SortableLinkItemProps> = ({
  link,
  isDark,
  theme,
  onLinkClick,
  onEdit,
  onDelete,
  t,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: link.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <Box
      ref={setNodeRef}
      style={style}
      onClick={() => onLinkClick(link.url)}
      sx={{
        display: 'flex',
        alignItems: 'center',
        borderRadius: '6px',
        py: 0.6,
        px: 0.5,
        cursor: 'pointer',
        color: theme.palette.text.secondary,
        transition: 'background-color 0.15s ease',
        '&:hover': {
          bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
          '& .quick-link-actions': { opacity: 1 },
          '& .quick-link-drag': { opacity: 0.4 },
        },
      }}
    >
      {/* Drag handle */}
      <Box
        {...attributes}
        {...listeners}
        className="quick-link-drag"
        onClick={(e) => e.stopPropagation()}
        sx={{
          display: 'flex',
          alignItems: 'center',
          cursor: 'grab',
          opacity: 0,
          transition: 'opacity 0.15s',
          mr: 0.25,
          flexShrink: 0,
          color: 'text.disabled',
          '&:active': { cursor: 'grabbing' },
        }}
      >
        <DragIcon sx={{ fontSize: 14 }} />
      </Box>

      {/* Icon */}
      <Box
        sx={{
          width: 22,
          height: 22,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mr: 0.75,
          flexShrink: 0,
          color: link.color || theme.palette.text.disabled,
          '& .MuiSvgIcon-root': { fontSize: 16 },
        }}
      >
        {getQuickLinkIcon(link.iconName)}
      </Box>

      {/* Title */}
      <Tooltip
        title={
          <Box>
            <Typography variant="body2" fontWeight={600}>
              {link.title}
            </Typography>
            {link.description && (
              <Typography
                variant="caption"
                sx={{ opacity: 0.8, display: 'block' }}
              >
                {link.description}
              </Typography>
            )}
            <Typography
              variant="caption"
              sx={{
                opacity: 0.6,
                display: 'block',
                mt: 0.25,
                fontFamily: 'monospace',
                fontSize: '0.65rem',
              }}
            >
              {link.url}
            </Typography>
          </Box>
        }
        placement="right"
        enterDelay={TOOLTIP_ENTER_DELAY}
        enterNextDelay={TOOLTIP_ENTER_NEXT_DELAY}
        slotProps={TOOLTIP_SLOT_PROPS}
      >
        <Typography
          variant="body2"
          noWrap
          sx={{
            flex: 1,
            fontSize: '0.8rem',
            fontWeight: 400,
          }}
        >
          {link.title}
        </Typography>
      </Tooltip>

      {/* Actions */}
      <Box
        className="quick-link-actions"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          opacity: 0,
          transition: 'opacity 0.15s',
        }}
      >
        <Tooltip
          title={t('common.edit')}
          enterDelay={TOOLTIP_ENTER_DELAY}
          enterNextDelay={TOOLTIP_ENTER_NEXT_DELAY}
          slotProps={TOOLTIP_SLOT_PROPS}
        >
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(link);
            }}
            sx={{ p: 0.35 }}
          >
            <EditIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
        <Tooltip
          title={t('common.delete')}
          enterDelay={TOOLTIP_ENTER_DELAY}
          enterNextDelay={TOOLTIP_ENTER_NEXT_DELAY}
          slotProps={TOOLTIP_SLOT_PROPS}
        >
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(link);
            }}
            sx={{ p: 0.35 }}
          >
            <DeleteIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
};

const MemoizedSortableLinkItem = React.memo(SortableLinkItem);

interface QuickLinksSectionProps {
  /** Whether the sub-panel is in compact mode */
  compact?: boolean;
}

const QuickLinksSection: React.FC<QuickLinksSectionProps> = ({
  compact = false,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const isDark = theme.palette.mode === 'dark';

  // Data state — initialize from cache to prevent flicker
  const [links, setLinks] = useState<QuickLink[]>(() => _cachedLinks ?? []);
  const [loading, setLoading] = useState(() => _cachedLinks === null);

  // UI state
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('quickLinksCollapsed') === 'true';
    } catch {
      return false;
    }
  });

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<QuickLink | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formIconName, setFormIconName] = useState('Link');
  const [formColor, setFormColor] = useState<string | null>(null);

  // Real-time URL validation
  const urlError = useMemo(() => {
    const trimmed = formUrl.trim();
    if (!trimmed) return ''; // empty is handled by required
    try {
      new URL(trimmed);
      return '';
    } catch {
      return t('quickLinks.invalidUrl');
    }
  }, [formUrl, t]);
  const isUrlValid = !urlError;

  // Icon picker state
  const [iconPickerOpen, setIconPickerOpen] = useState(false);

  // Delete confirm state
  const [deleteConfirm, setDeleteConfirm] = useState<QuickLink | null>(null);

  // Dirty check for edit mode
  const hasChanges = useMemo(() => {
    if (!editingLink) return true; // new link — always allow save
    return (
      formTitle.trim() !== editingLink.title ||
      formUrl.trim() !== editingLink.url ||
      (formDescription.trim() || null) !== (editingLink.description || null) ||
      formIconName !== editingLink.iconName ||
      (formColor || null) !== (editingLink.color || null)
    );
  }, [
    editingLink,
    formTitle,
    formUrl,
    formDescription,
    formIconName,
    formColor,
  ]);

  // Drag-and-drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = links.findIndex((l) => l.id === active.id);
      const newIndex = links.findIndex((l) => l.id === over.id);
      const reordered = arrayMove(links, oldIndex, newIndex);

      // Optimistic update
      _cachedLinks = reordered;
      setLinks(reordered);

      try {
        await QuickLinkService.reorderQuickLinks(reordered.map((l) => l.id));
      } catch (error: any) {
        // Revert on failure
        setLinks(links);
        enqueueSnackbar(error?.message || 'Failed to reorder', {
          variant: 'error',
          autoHideDuration: 3000,
        });
      }
    },
    [links, enqueueSnackbar]
  );

  // Load links on mount (only once, even if remounted)
  const loadLinks = useCallback(async () => {
    try {
      if (_cachedLinks === null) setLoading(true);
      const data = await QuickLinkService.getQuickLinks();
      _cachedLinks = data;
      setLinks(data);
    } catch (error: any) {
      console.warn('Failed to load quick links:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (_cachedLinks === null) {
      loadLinks();
    }
  }, [loadLinks]);

  // Collapse toggle
  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('quickLinksCollapsed', String(next));
      } catch {}
      return next;
    });
  }, []);

  // Open add dialog
  const openAddDialog = useCallback(() => {
    setEditingLink(null);
    setFormTitle('');
    setFormUrl('');
    setFormDescription('');
    setFormIconName('Link');
    setFormColor(null);
    setDialogOpen(true);
  }, []);

  // Open edit dialog
  const openEditDialog = useCallback((link: QuickLink) => {
    setEditingLink(link);
    setFormTitle(link.title);
    setFormUrl(link.url);
    setFormDescription(link.description || '');
    setFormIconName(link.iconName);
    setFormColor(link.color || null);
    setDialogOpen(true);
  }, []);

  // Close dialog
  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    setEditingLink(null);
  }, []);

  // Save (create or update)
  const handleSave = useCallback(async () => {
    if (!formTitle.trim() || !formUrl.trim() || !isUrlValid) return;

    try {
      setSaving(true);
      if (editingLink) {
        // Update
        const updateData: UpdateQuickLinkData = {
          title: formTitle.trim(),
          url: formUrl.trim(),
          description: formDescription.trim() || null,
          iconName: formIconName,
          color: formColor,
        };
        await QuickLinkService.updateQuickLink(editingLink.id, updateData);
      } else {
        // Create
        const createData: CreateQuickLinkData = {
          title: formTitle.trim(),
          url: formUrl.trim(),
          description: formDescription.trim() || undefined,
          iconName: formIconName,
          color: formColor || undefined,
        };
        await QuickLinkService.createQuickLink(createData);
      }
      closeDialog();
      await loadLinks();
    } catch (error: any) {
      const msg =
        error?.message ||
        (editingLink ? 'Failed to update' : 'Failed to create');
      enqueueSnackbar(msg, { variant: 'error', autoHideDuration: 4000 });
    } finally {
      setSaving(false);
    }
  }, [
    editingLink,
    formTitle,
    formUrl,
    formDescription,
    formIconName,
    formColor,
    closeDialog,
    loadLinks,
    enqueueSnackbar,
  ]);

  // Delete
  const handleDelete = useCallback(
    async (link: QuickLink) => {
      try {
        await QuickLinkService.deleteQuickLink(link.id);
        setDeleteConfirm(null);
        await loadLinks();
      } catch (error: any) {
        const msg = error?.message || 'Failed to delete';
        enqueueSnackbar(msg, { variant: 'error', autoHideDuration: 4000 });
      }
    },
    [loadLinks, enqueueSnackbar]
  );

  // Click link (open in new tab)
  const handleLinkClick = useCallback(
    (url: string) => {
      try {
        new URL(url); // validate first
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } catch {
        enqueueSnackbar(t('quickLinks.invalidUrl'), {
          variant: 'error',
          autoHideDuration: 3000,
        });
      }
    },
    [enqueueSnackbar, t]
  );

  // If loading and no links yet, show nothing (avoid layout shift)
  if (loading && links.length === 0) {
    return null;
  }

  return (
    <>
      <Box sx={{ px: 1, pt: 0.75, pb: 0.5 }}>
        {/* Header */}
        <Box
          onClick={links.length > 0 ? toggleCollapsed : undefined}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 0.75,
            cursor: links.length > 0 ? 'pointer' : 'default',
            userSelect: 'none',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <BookmarkBorderIcon
              sx={{ fontSize: 11, color: 'text.disabled', opacity: 0.7 }}
            />
            <Typography
              variant="caption"
              sx={{
                fontWeight: 600,
                color: 'text.disabled',
                fontSize: '0.575rem',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
              }}
            >
              {t('sidebar.quickLinks')}
            </Typography>
            {links.length > 0 &&
              (collapsed ? (
                <ExpandMore
                  sx={{
                    fontSize: 13,
                    color: 'text.disabled',
                    opacity: 0.5,
                  }}
                />
              ) : (
                <ExpandLess
                  sx={{
                    fontSize: 13,
                    color: 'text.disabled',
                    opacity: 0.5,
                  }}
                />
              ))}
          </Box>
          <Tooltip
            title={t('sidebar.addQuickLink')}
            enterDelay={TOOLTIP_ENTER_DELAY}
            enterNextDelay={TOOLTIP_ENTER_NEXT_DELAY}
            slotProps={TOOLTIP_SLOT_PROPS}
          >
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                openAddDialog();
              }}
              sx={{
                p: 0.25,
                opacity: 0.4,
                '&:hover': { opacity: 1 },
              }}
            >
              <AddIcon sx={{ fontSize: 13 }} />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Links list */}
        {links.length > 0 ? (
          <Collapse in={!collapsed} timeout={200}>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
              modifiers={[restrictToVerticalAxis]}
            >
              <SortableContext
                items={links.map((l) => l.id)}
                strategy={verticalListSortingStrategy}
              >
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1px',
                    mt: 0.5,
                  }}
                >
                  {links.map((link) => (
                    <MemoizedSortableLinkItem
                      key={link.id}
                      link={link}
                      isDark={isDark}
                      theme={theme}
                      onLinkClick={handleLinkClick}
                      onEdit={openEditDialog}
                      onDelete={setDeleteConfirm}
                      t={t}
                    />
                  ))}
                </Box>
              </SortableContext>
            </DndContext>
          </Collapse>
        ) : (
          !loading && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                py: 0.75,
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  color: 'text.disabled',
                  fontSize: '0.65rem',
                  fontStyle: 'italic',
                }}
              >
                {t('sidebar.quickLinksEmpty')}
              </Typography>
            </Box>
          )
        )}
      </Box>

      {/* Add/Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={closeDialog}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 3 },
        }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            pb: 1,
          }}
        >
          <Typography
            component="span"
            variant="h6"
            fontWeight={600}
            fontSize="1rem"
          >
            {editingLink
              ? t('quickLinks.editDialog.title')
              : t('quickLinks.createDialog.title')}
          </Typography>
          <IconButton
            size="small"
            onClick={closeDialog}
            sx={{ color: 'text.disabled' }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 0 }}>
          {/* Icon + Color row */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
            {/* Icon selector */}
            <Tooltip title={t('quickLinks.selectIcon')} arrow>
              <Box
                onClick={() => setIconPickerOpen(true)}
                sx={{
                  width: 48,
                  height: 48,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 2,
                  border: `2px dashed ${theme.palette.divider}`,
                  cursor: 'pointer',
                  color: formColor || theme.palette.text.secondary,
                  transition: 'all 0.15s',
                  '&:hover': {
                    borderColor: theme.palette.primary.main,
                    bgcolor: alpha(theme.palette.primary.main, 0.05),
                  },
                  '& .MuiSvgIcon-root': { fontSize: 24 },
                }}
              >
                {getQuickLinkIcon(formIconName)}
              </Box>
            </Tooltip>

            {/* Color presets */}
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', flex: 1 }}>
              {COLOR_PRESETS.map((color, idx) => (
                <Tooltip
                  key={idx}
                  title={color ? color : t('quickLinks.defaultColor')}
                  arrow
                >
                  <Box
                    onClick={() => setFormColor(color)}
                    sx={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      cursor: 'pointer',
                      bgcolor: color || (isDark ? 'grey.600' : 'grey.400'),
                      border:
                        formColor === color
                          ? `2px solid ${theme.palette.primary.main}`
                          : '2px solid transparent',
                      transition: 'all 0.15s',
                      '&:hover': {
                        transform: 'scale(1.2)',
                      },
                    }}
                  />
                </Tooltip>
              ))}
            </Box>
          </Box>

          {/* Title */}
          <TextField
            fullWidth
            size="small"
            label={t('quickLinks.title')}
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            sx={{ mb: 1.5 }}
            autoFocus
            required
          />

          {/* URL */}
          <TextField
            fullWidth
            size="small"
            label={t('quickLinks.url')}
            value={formUrl}
            onChange={(e) => setFormUrl(e.target.value)}
            placeholder="https://..."
            sx={{ mb: 1.5 }}
            required
            error={!!formUrl.trim() && !isUrlValid}
            helperText={formUrl.trim() ? urlError : ''}
          />

          {/* Description */}
          <TextField
            fullWidth
            size="small"
            label={t('quickLinks.description')}
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
            sx={{ mb: 0 }}
            multiline
            rows={2}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            variant="contained"
            onClick={closeDialog}
            size="small"
            sx={{ textTransform: 'none' }}
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            size="small"
            disabled={
              !formTitle.trim() ||
              !formUrl.trim() ||
              !isUrlValid ||
              saving ||
              !hasChanges
            }
            sx={{ textTransform: 'none', minWidth: 80 }}
          >
            {saving ? (
              <CircularProgress size={16} color="inherit" />
            ) : editingLink ? (
              t('common.save')
            ) : (
              t('common.add')
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Icon Picker Dialog */}
      <MuiIconPicker
        open={iconPickerOpen}
        onClose={() => setIconPickerOpen(false)}
        onSelect={(iconName) => setFormIconName(iconName)}
        selectedIcon={formIconName}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        maxWidth="xs"
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Typography
            component="span"
            variant="h6"
            fontWeight={600}
            fontSize="1rem"
          >
            {t('quickLinks.confirmDelete')}
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {t('quickLinks.confirmDeleteMessage', {
              title: deleteConfirm?.title,
            })}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            variant="contained"
            onClick={() => setDeleteConfirm(null)}
            size="small"
            sx={{ textTransform: 'none' }}
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
            variant="contained"
            color="error"
            size="small"
            sx={{ textTransform: 'none' }}
          >
            {t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default React.memo(QuickLinksSection);
