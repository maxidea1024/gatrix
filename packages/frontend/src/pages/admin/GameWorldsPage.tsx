import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Switch,
  FormControlLabel,
  InputAdornment,
  Tooltip,
  Alert,
  LinearProgress,
  CircularProgress,
  Autocomplete, Chip as MuiChip, TextField as MuiTextField,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Search as SearchIcon,
  Language as WorldIcon,
  Build as MaintenanceIcon,
  KeyboardArrowUp as ArrowUpIcon,
  KeyboardArrowDown as ArrowDownIcon,
  DragIndicator as DragIcon,
  Cancel as CancelIcon,
  Save as SaveIcon,
  ContentCopy as CopyIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { gameWorldService } from '../../services/gameWorldService';
import { tagService, Tag } from '@/services/tagService';
import { GameWorld, CreateGameWorldData } from '../../types/gameWorld';
import { formatDateTimeDetailed } from '../../utils/dateFormat';
import FormDialogHeader from '../../components/common/FormDialogHeader';
import EmptyTableRow from '../../components/common/EmptyTableRow';

// Sortable Row Component
interface SortableRowProps {
  world: GameWorld;
  index: number;
  total: number;
  onEdit: (world: GameWorld) => void;
  onDelete: (id: number) => void;
  onToggleVisibility: (worldId: number) => void;
  onToggleMaintenance: (worldId: number) => void;
  onMoveUp: (world: GameWorld) => void;
  onMoveDown: (world: GameWorld) => void;
  onCopy: (text: string, type: string) => void;
  t: (key: string) => string;
}

const SortableRow: React.FC<SortableRowProps> = ({
  world,
  onEdit,
  onDelete,
  onToggleVisibility,
  onToggleMaintenance,
  onMoveUp,
  onMoveDown,
  onCopy,
  t,
  index,
  total,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: world.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const renderTags = (tags?: Tag[] | null) => {
    const items = (tags || []).slice(0, 6);
    if (items.length === 0) return '-';
    return (
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', maxWidth: 220 }}>
        {items.map((tag, idx) => (
          <Tooltip key={`${tag.id}-${idx}`} title={tag.description || t('tags.noDescription')} arrow>
            <Chip label={tag.name} size="small" sx={{ bgcolor: tag.color, color: '#fff', cursor: 'help' }} />
          </Tooltip>
        ))}
      </Box>
    );
  };


  return (
    <TableRow ref={setNodeRef} style={style} hover>
      <TableCell>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton
            size="small"
            {...attributes}
            {...listeners}
            sx={{ cursor: 'grab', '&:active': { cursor: 'grabbing' } }}
          >
            <DragIcon />
          </IconButton>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {world.worldId}
          </Typography>
          <Tooltip title={t('common.copy')}>
            <IconButton
              size="small"
              onClick={() => onCopy(world.worldId, t('gameWorlds.worldId'))}
              sx={{ opacity: 0.7, '&:hover': { opacity: 1 } }}
            >
              <CopyIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </TableCell>
      <TableCell>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WorldIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
          <Typography variant="body2">
            {world.name}
          </Typography>
          <Tooltip title={t('common.copy')}>
            <IconButton
              size="small"
              onClick={() => onCopy(world.name, t('gameWorlds.name'))}
              sx={{ opacity: 0.7, '&:hover': { opacity: 1 } }}
            >
              <CopyIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </TableCell>
      <TableCell>
        <Chip
          icon={world.isVisible ? <VisibilityIcon /> : <VisibilityOffIcon />}
          label={world.isVisible ? (t('gameWorlds.visible')) : (t('gameWorlds.hidden'))}
          color={world.isVisible ? "success" : "default"}
          size="small"
          onClick={() => onToggleVisibility(world.id)}
          sx={{
            cursor: 'pointer',
            '&:hover': {
              backgroundColor: world.isVisible ? 'success.dark' : 'grey.600',
            }
          }}
        />
      </TableCell>
      <TableCell>
        <Chip
          icon={<MaintenanceIcon />}
          label={world.isMaintenance ? (t('gameWorlds.maintenance')) : (t('gameWorlds.active'))}
          color={world.isMaintenance ? "warning" : "success"}
          size="small"
          onClick={() => onToggleMaintenance(world.id)}
          sx={{
            cursor: 'pointer',
            '&:hover': {
              backgroundColor: world.isMaintenance ? 'warning.dark' : 'success.dark',
            }
          }}
        />
      </TableCell>
      <TableCell>
        <Typography variant="body2" sx={{ maxWidth: 200 }} noWrap>
          {world.description || '-'}
        </Typography>
      </TableCell>
      <TableCell>
        {renderTags(world.tags)}
      </TableCell>
      <TableCell>
        {world.createdByName ? (
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {world.createdByName}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
              {world.createdByEmail}
            </Typography>
          </Box>
        ) : (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            -
          </Typography>
        )}
      </TableCell>
      <TableCell>
        <Typography variant="body2">
          {formatDateTimeDetailed(world.createdAt)}
        </Typography>
      </TableCell>
      <TableCell align="center">
        <Tooltip title={t('gameWorlds.moveUp')}>
          <span>
            <IconButton size="small" onClick={() => onMoveUp(world)} disabled={index === 0}>
              <ArrowUpIcon />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={t('gameWorlds.moveDown')}>
          <span>
            <IconButton size="small" onClick={() => onMoveDown(world)} disabled={index === total - 1}>
              <ArrowDownIcon />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title={t('gameWorlds.editGameWorld')}>
          <IconButton size="small" onClick={() => onEdit(world)}>
            <EditIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title={t('gameWorlds.deleteGameWorld')}>
          <IconButton
            size="small"
            onClick={() => onDelete(world.id)}
            color="error"
          >
            <DeleteIcon />
          </IconButton>
        </Tooltip>
      </TableCell>
    </TableRow>
  );
};

const GameWorldsPage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();



  const [worlds, setWorlds] = useState<GameWorld[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [tagsFilter, setTagsFilter] = useState<Tag[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingWorld, setEditingWorld] = useState<GameWorld | null>(null);
  const [formData, setFormData] = useState<CreateGameWorldData>({
    worldId: '',
    name: '',
    isVisible: true,
    isMaintenance: false,
    description: '',
    tagIds: [],
  });
  const [formTags, setFormTags] = useState<(string | Tag)[]>([]);

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const worldIdRef = useRef<HTMLInputElement>(null);

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    open: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Delete confirmation state
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState({
    open: false,
    world: null as GameWorld | null,
    inputValue: '',
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Load registry tags for form use
  const [allRegistryTags, setAllRegistryTags] = useState<Tag[]>([]);
  useEffect(() => {
    tagService.list().then(setAllRegistryTags).catch(() => {});
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      if (isMounted) {
        await loadGameWorlds();
      }
    };

    // allRegistryTags가 로드된 후에만 게임월드를 로드
    if (allRegistryTags.length > 0 || tagsFilter.length === 0) {
      loadData();
    }

    return () => {
      isMounted = false;
    };
  }, [search, tagsFilter.map(t => t.id).join(','), allRegistryTags.length]);

  // Avoid mobile viewport scroll zoom/focus issues by disabling autoScroll and portal for Autocomplete
  const autocompleteSlotProps = {
    popper: { modifiers: [{ name: 'preventOverflow', options: { altAxis: true, tether: true } }] },
    paper: { sx: { maxHeight: 280 } },
  } as const;

  const loadGameWorlds = async () => {
    // 이미 로딩 중이면 중복 요청 방지
    if (loading) return;

    try {
      setLoading(true);

      // 태그 ID 추출
      const tagIds = tagsFilter.length > 0 ? tagsFilter.map(tag => tag.id) : [];

      const result = await gameWorldService.getGameWorlds({
        // 페이징 파라미터 제거: page/limit 미전송
        search: search || undefined,
        tagIds: tagIds.length ? tagIds.join(',') : undefined,
      });

      setWorlds(result.worlds);
    } catch (error: any) {
      console.error('Failed to load game worlds:', error);

      // 네트워크 오류인 경우에만 toast 표시
      if (error.message?.includes('Network Error') || error.code === 'NETWORK_ERROR') {
        enqueueSnackbar(t('gameWorlds.errors.loadFailed'), { variant: 'error' });
      }
    } finally {
      setLoading(false);
    }
  };

  // Pagination handlers removed

  const handleAddWorld = () => {
    setEditingWorld(null);
    setFormData({
      worldId: '',
      name: '',
      isVisible: true,
      isMaintenance: false,
      description: '',
      tagIds: [],
    });
    setFormTags([]);
    setFormErrors({});
    setDialogOpen(true);
    setTimeout(() => {
      worldIdRef.current?.focus();
      worldIdRef.current?.select();
    }, 100);
  };

  const handleEditWorld = (world: GameWorld) => {
    setEditingWorld(world);
    setFormData({
      worldId: world.worldId,
      name: world.name,
      isVisible: world.isVisible,
      isMaintenance: world.isMaintenance,
      description: world.description || '',
      tagIds: (world.tags || []).map(t => t.id),
    });
    setFormTags((world.tags || []));
    setFormErrors({});
    setDialogOpen(true);
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.worldId.trim()) {
      errors.worldId = 'World ID is required';
    }

    if (!formData.name.trim()) {
      errors.name = 'Name is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const allTags = useMemo(() => {
    const list = new Map<string, Tag>();
    worlds.forEach(w => (w.tags || []).forEach(t => list.set(t.name.toLowerCase(), t)));
    // merge with registry
    allRegistryTags.forEach(t => list.set(t.name.toLowerCase(), t));
    return Array.from(list.values());
  }, [worlds, allRegistryTags]);

  const existingTags = allTags;

  const handleSaveWorld = async () => {
    if (!validateForm()) {
      return;
    }

    setSaving(true);
    try {
      // Ensure boolean types and tag IDs are correct
      const names = (formTags || []).map(t => (typeof t === 'string' ? t : t.name)).map(s => s.trim()).filter(Boolean);
      // Create missing tags first and get ids
      const ensuredTags: Tag[] = [];
      for (const name of names) {
        const existing = allRegistryTags.find(rt => rt.name.toLowerCase() === name.toLowerCase());
        if (existing) {
          ensuredTags.push(existing);
        } else {
          try {
            const created = await tagService.create({ name });
            ensuredTags.push(created);
            setAllRegistryTags(prev => [...prev, created].sort((a,b)=>a.name.localeCompare(b.name)));
          } catch (e) {}
        }
      }
      const tagIds = ensuredTags.map(t => t.id);

      const dataToSend = {
        ...formData,
        tagIds,
        isVisible: Boolean(formData.isVisible),
        isMaintenance: Boolean(formData.isMaintenance),
      };



      let savedWorld;
      if (editingWorld) {
        savedWorld = await gameWorldService.updateGameWorld(editingWorld.id, dataToSend);
        enqueueSnackbar(t('gameWorlds.worldUpdated'), { variant: 'success' });
      } else {
        savedWorld = await gameWorldService.createGameWorld(dataToSend);
        enqueueSnackbar(t('gameWorlds.worldCreated'), { variant: 'success' });
      }

      setDialogOpen(false);
      loadGameWorlds();
    } catch (error: any) {
      console.error('Failed to save game world:', error);
      const status = error?.status || error?.response?.status;
      let message = error?.error?.message || error?.response?.data?.error?.message || error?.response?.data?.message;
      if (status === 409) {
        message = t('gameWorlds.errors.alreadyExists');
        // Focus the World ID field for quick correction
        setTimeout(() => {
          worldIdRef.current?.focus();
          worldIdRef.current?.select();
        }, 0);
      }
      if (!message) message = t('gameWorlds.errors.saveFailed');
      enqueueSnackbar(message, { variant: 'error', autoHideDuration: 4000 });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteWorld = (id: number) => {
    const world = worlds.find(w => w.id === id);
    if (world) {
      setDeleteConfirmDialog({
        open: true,
        world,
        inputValue: '',
      });
    }
  };

  const handleConfirmDelete = async () => {
    if (deleteConfirmDialog.world && deleteConfirmDialog.inputValue === deleteConfirmDialog.world.name) {
      try {
        await gameWorldService.deleteGameWorld(deleteConfirmDialog.world.id);
        enqueueSnackbar(t('gameWorlds.worldDeleted'), { variant: 'success' });
        loadGameWorlds();
        setDeleteConfirmDialog({ open: false, world: null, inputValue: '' });
      } catch (error) {
        console.error('Failed to delete game world:', error);
        enqueueSnackbar(t('gameWorlds.errors.deleteFailed'), { variant: 'error' });
      }
    }
  };

  const handleToggleVisibility = (worldId: number) => {
    const world = worlds.find(w => w.id === worldId);
    if (!world) return;

    setConfirmDialog({
      open: true,
      title: world.isVisible ? t('gameWorlds.hideGameWorld') : t('gameWorlds.showGameWorld'),
      message: world.isVisible
        ? t('gameWorlds.confirmHide', { name: world.name })
        : t('gameWorlds.confirmShow', { name: world.name }),
      onConfirm: async () => {
        try {
          await gameWorldService.toggleVisibility(world.id);
          enqueueSnackbar(t('gameWorlds.visibilityToggled'), { variant: 'success' });
          loadGameWorlds();
        } catch (error) {
          console.error('Failed to toggle visibility:', error);
          enqueueSnackbar(t('gameWorlds.errors.toggleVisibilityFailed'), { variant: 'error' });
        }
        setConfirmDialog(prev => ({ ...prev, open: false }));
      }
    });
  };

  const handleToggleMaintenance = (worldId: number) => {
    const world = worlds.find(w => w.id === worldId);
    if (!world) return;

    setConfirmDialog({
      open: true,
      title: world.isMaintenance ? t('gameWorlds.endMaintenance') : t('gameWorlds.startMaintenance'),
      message: world.isMaintenance
        ? t('gameWorlds.confirmEndMaintenance', { name: world.name })
        : t('gameWorlds.confirmStartMaintenance', { name: world.name }),
      onConfirm: async () => {
        try {
          await gameWorldService.toggleMaintenance(world.id);
          enqueueSnackbar(t('gameWorlds.maintenanceToggled'), { variant: 'success' });
          loadGameWorlds();
        } catch (error) {
          console.error('Failed to toggle maintenance:', error);
          enqueueSnackbar(t('gameWorlds.errors.toggleMaintenanceFailed'), { variant: 'error' });
        }
        setConfirmDialog(prev => ({ ...prev, open: false }));
      }
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = worlds.findIndex((world) => world.id === active.id);
      const newIndex = worlds.findIndex((world) => world.id === over?.id);

      console.log('Drag and drop:', {
        activeId: active.id,
        overId: over?.id,
        oldIndex,
        newIndex
      });

      const newWorlds = arrayMove(worlds, oldIndex, newIndex);
      setWorlds(newWorlds);

      // Update display orders
      const orderUpdates = newWorlds.map((world, index) => ({
        id: world.id,
        displayOrder: (index + 1) * 10
      }));

      console.log('Order updates to send:', orderUpdates);

      try {
        await gameWorldService.updateDisplayOrders(orderUpdates);
        console.log('Display orders updated successfully');
        const movedWorld = worlds.find(w => w.id === active.id);
        enqueueSnackbar(t('gameWorlds.orderUpdated', { name: movedWorld?.name || 'Unknown' }), { variant: 'success' });
      } catch (error) {
        console.error('Failed to update order:', error);
        enqueueSnackbar(t('gameWorlds.errors.orderUpdateFailed'), { variant: 'error' });
        // Reload to get correct order
        loadGameWorlds();
      }
    }
  };

  const handleMoveUp = async (world: GameWorld) => {
    try {
      const moved = await gameWorldService.moveUp(world.id);
      if (moved) {
        // Update local state instead of reloading
        setWorlds(prevWorlds => {
          const currentIndex = prevWorlds.findIndex(w => w.id === world.id);
          if (currentIndex <= 0) return prevWorlds;

          const newWorlds = [...prevWorlds];
          [newWorlds[currentIndex - 1], newWorlds[currentIndex]] =
            [newWorlds[currentIndex], newWorlds[currentIndex - 1]];

          return newWorlds;
        });
        enqueueSnackbar(t('gameWorlds.movedUp', { name: world.name }), { variant: 'success' });
      } else {
        enqueueSnackbar(t('gameWorlds.alreadyTop'), { variant: 'info' });
      }
    } catch (error) {
      console.error('Failed to move up:', error);
      enqueueSnackbar(t('gameWorlds.errors.moveUpFailed'), { variant: 'error' });
    }
  };

  const handleMoveDown = async (world: GameWorld) => {
    try {
      const moved = await gameWorldService.moveDown(world.id);
      if (moved) {
        // Update local state instead of reloading
        setWorlds(prevWorlds => {
          const currentIndex = prevWorlds.findIndex(w => w.id === world.id);
          if (currentIndex >= prevWorlds.length - 1) return prevWorlds;

          const newWorlds = [...prevWorlds];
          [newWorlds[currentIndex], newWorlds[currentIndex + 1]] =
            [newWorlds[currentIndex + 1], newWorlds[currentIndex]];

          return newWorlds;
        });
        enqueueSnackbar(t('gameWorlds.movedDown', { name: world.name }), { variant: 'success' });
      } else {
        enqueueSnackbar(t('gameWorlds.alreadyBottom'), { variant: 'info' });
      }
    } catch (error) {
      console.error('Failed to move down:', error);
      enqueueSnackbar(t('gameWorlds.errors.moveDownFailed'), { variant: 'error' });
    }
  };

  const handleCopy = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      enqueueSnackbar(t('common.copied', { type, value: text }), { variant: 'success' });
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      enqueueSnackbar(t('common.copyFailed'), { variant: 'error' });
    }
  };



  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(event.target.value);
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
            {t('gameWorlds.title')}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {t('gameWorlds.description')}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAddWorld}
        >
          {t('gameWorlds.addGameWorld')}
        </Button>
      </Box>



      {/* Search and Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              <TextField
                placeholder={t('gameWorlds.searchPlaceholder')}
                value={search}
                onChange={handleSearchChange}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                    ),
                  },
                }}
                sx={{ minWidth: 300 }}
              />
              <Autocomplete
                multiple
                sx={{ minWidth: 320, flexShrink: 0 }}
                options={existingTags}
                getOptionLabel={(option) => option.name}
                filterSelectedOptions
                value={tagsFilter}
                onChange={(_, value) => setTagsFilter(value)}
                slotProps={autocompleteSlotProps as any}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => {
                    const { key, ...chipProps } = getTagProps({ index });
                    return (
                      <Tooltip key={option.id} title={option.description || t('tags.noDescription')} arrow>
                        <Chip
                          variant="outlined"
                          label={option.name}
                          size="small"
                          sx={{ bgcolor: option.color, color: '#fff' }}
                          {...chipProps}
                        />
                      </Tooltip>
                    );
                  })
                }
                renderInput={(params) => (
                  <TextField {...params} label={t('gameWorlds.tags')} />
                )}
                renderOption={(props, option) => (
                  <Box component="li" {...props}>
                    <Chip
                      label={option.name}
                      size="small"
                      sx={{ bgcolor: option.color, color: '#fff', mr: 1 }}
                    />
                    {option.description || t('common.noDescription')}
                  </Box>
                )}
              />
            </Box>

            <Tooltip title={t('common.refresh')}>
              <span>
                <IconButton onClick={loadGameWorlds} disabled={loading} sx={{ ml: 2 }}>
                  <RefreshIcon />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        </CardContent>
      </Card>

      {/* Game Worlds Table */}
      <Card>
        <CardContent sx={{ p: 0 }}>
          {loading && <LinearProgress />}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>{t('gameWorlds.worldId')}</TableCell>
                    <TableCell>{t('gameWorlds.name')}</TableCell>
                    <TableCell>{t('gameWorlds.visible')}</TableCell>
                    <TableCell>{t('gameWorlds.maintenance')}</TableCell>
                    <TableCell>{t('gameWorlds.description')}</TableCell>
                    <TableCell>{t('gameWorlds.tags')}</TableCell>
                    <TableCell>{t('gameWorlds.creator')}</TableCell>
                    <TableCell>{t('gameWorlds.created')}</TableCell>
                    <TableCell align="center">{t('gameWorlds.actions')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {worlds.length === 0 ? (
                    <EmptyTableRow
                      colSpan={9}
                      loading={loading}
                      message="등록된 게임 월드가 없습니다."
                    />
                  ) : (
                    <SortableContext
                      items={worlds.map(w => w.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {worlds.map((world, idx) => (
                        <SortableRow
                          key={world.id}
                          world={world}
                          index={idx}
                          total={worlds.length}
                          onEdit={handleEditWorld}
                          onDelete={handleDeleteWorld}
                          onToggleVisibility={handleToggleVisibility}
                          onToggleMaintenance={handleToggleMaintenance}
                          onMoveUp={handleMoveUp}
                          onMoveDown={handleMoveDown}
                          onCopy={handleCopy}
                          t={t}
                        />
                      ))}
                    </SortableContext>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </DndContext>

        {/* Pagination removed (no server/client paging) */}

        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <FormDialogHeader
          title={editingWorld ? '게임 월드 편집' : '게임 월드 추가'}
          description={editingWorld
            ? '기존 게임 월드의 설정을 수정하고 업데이트할 수 있습니다.'
            : '새로운 게임 월드를 생성하고 서버 설정 및 접속 정보를 구성할 수 있습니다.'
          }
        />
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 1 }}>
            <Box>
              <TextField
                fullWidth
                label={t('gameWorlds.worldId')}
                value={formData.worldId}
                onChange={(e) => setFormData({ ...formData, worldId: e.target.value })}
                error={!!formErrors.worldId}
                helperText={formErrors.worldId}
                required
                inputRef={worldIdRef}
                autoFocus
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                {t('gameWorlds.form.worldIdHelp')}
              </Typography>
            </Box>

            <Box>
              <TextField
                fullWidth
                label={t('gameWorlds.name')}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                error={!!formErrors.name}
                helperText={formErrors.name}
                required
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                {t('gameWorlds.form.nameHelp')}
              </Typography>
            </Box>

            <Box>
              <TextField
                fullWidth
                label={t('gameWorlds.description')}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                multiline
                rows={3}
                placeholder={t('gameWorlds.description')}
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                {t('gameWorlds.form.descriptionHelp')}
              </Typography>
            </Box>

            <Box>
              <Autocomplete
                multiple
                freeSolo
                options={allRegistryTags}
                getOptionLabel={(opt) => (typeof opt === 'string' ? opt : opt.name)}
                filterSelectedOptions
                value={formTags}
                onChange={(_, value) => setFormTags(value as (string | Tag)[])}
                renderTags={(value: readonly (string | Tag)[], getTagProps) =>
                  value.map((option: string | Tag, index: number) => {
                    const name = typeof option === 'string' ? option : option.name;
                    const color = typeof option === 'string' ? '#607D8B' : option.color;
                    const description = typeof option === 'string' ? t('tags.noDescription') : (option.description || t('tags.noDescription'));
                    return (
                      <Tooltip key={name + index} title={description} arrow>
                        <Chip variant="outlined" size="small" label={name} sx={{ bgcolor: color, color: '#fff', cursor: 'help' }} {...getTagProps({ index })} />
                      </Tooltip>
                    );
                  })
                }
                renderInput={(params) => (
                  <TextField {...params} label={t('gameWorlds.tags')} />
                )}
              />
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isVisible}
                    onChange={(e) => setFormData({ ...formData, isVisible: e.target.checked })}
                  />
                }
                label={t('gameWorlds.visibleToUsers')}
              />
              <Typography variant="caption" color="text.secondary" sx={{ ml: 6, mt: -0.5, mb: 1 }}>
                {t('gameWorlds.form.visibleHelp')}
              </Typography>

              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isMaintenance}
                    onChange={(e) => setFormData({ ...formData, isMaintenance: e.target.checked })}
                  />
                }
                label={t('gameWorlds.underMaintenance')}
              />
              <Typography variant="caption" color="text.secondary" sx={{ ml: 6, mt: -0.5 }}>
                {t('gameWorlds.form.maintenanceHelp')}
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={saving} startIcon={<CancelIcon />}>
            {t('gameWorlds.cancel')}
          </Button>
          <Button
            onClick={handleSaveWorld}
            variant="contained"
            disabled={saving}
            startIcon={saving ? <CircularProgress size={20} /> : (editingWorld ? <SaveIcon /> : <AddIcon />)}
          >
            {saving ? t('common.saving') : (editingWorld ? '게임 월드 수정' : '게임 월드 추가')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{confirmDialog.title}</DialogTitle>
        <DialogContent>
          <Typography>{confirmDialog.message}</Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
            color="inherit"
          >
            {t('gameWorlds.cancel')}
          </Button>
          <Button
            onClick={confirmDialog.onConfirm}
            color="primary"
            variant="contained"
          >
            {t('gameWorlds.confirm')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmDialog.open}
        onClose={() => setDeleteConfirmDialog({ open: false, world: null, inputValue: '' })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {t('gameWorlds.deleteGameWorld')}
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            {t('gameWorlds.confirmDelete', { name: deleteConfirmDialog.world?.name })}
          </Alert>
          <Typography variant="body2" sx={{ mb: 2 }}>
            {t('gameWorlds.deleteTypeToConfirm', { name: deleteConfirmDialog.world?.name })}
            <strong>{deleteConfirmDialog.world?.name}</strong>
          </Typography>
          <TextField
            fullWidth
            label={t('gameWorlds.worldName')}
            value={deleteConfirmDialog.inputValue}
            onChange={(e) => setDeleteConfirmDialog(prev => ({ ...prev, inputValue: e.target.value }))}
            placeholder={deleteConfirmDialog.world?.name}
            error={deleteConfirmDialog.inputValue !== '' && deleteConfirmDialog.inputValue !== deleteConfirmDialog.world?.name}
            helperText={deleteConfirmDialog.inputValue !== '' && deleteConfirmDialog.inputValue !== deleteConfirmDialog.world?.name ? 'Name does not match' : ''}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setDeleteConfirmDialog({ open: false, world: null, inputValue: '' })}
            color="inherit"
          >
            {t('gameWorlds.cancel')}
          </Button>
          <Button
            onClick={handleConfirmDelete}
            color="error"
            variant="contained"
            disabled={deleteConfirmDialog.inputValue !== deleteConfirmDialog.world?.name}
          >
            {t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default GameWorldsPage;
