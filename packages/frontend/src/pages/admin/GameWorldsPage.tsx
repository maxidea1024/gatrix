import React, { useState, useEffect } from 'react';
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
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Search as SearchIcon,
  Language as WorldIcon,
  Link as LinkIcon,
  Build as MaintenanceIcon,
  CheckCircle as ActiveIcon,
  KeyboardArrowUp as ArrowUpIcon,
  KeyboardArrowDown as ArrowDownIcon,
  DragIndicator as DragIcon,
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
import { GameWorld, CreateGameWorldData, UpdateGameWorldData } from '../../types/gameWorld';
import { formatDateTimeDetailed } from '../../utils/dateFormat';

// Sortable Row Component
interface SortableRowProps {
  world: GameWorld;
  onEdit: (world: GameWorld) => void;
  onDelete: (id: number) => void;
  onToggleVisibility: (worldId: number) => void;
  onToggleMaintenance: (worldId: number) => void;
  onMoveUp: (world: GameWorld) => void;
  onMoveDown: (world: GameWorld) => void;
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
  t,
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
        </Box>
      </TableCell>
      <TableCell>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WorldIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
          <Typography variant="body2">
            {world.name}
          </Typography>
        </Box>
      </TableCell>
      <TableCell>
        <Chip
          icon={world.isVisible ? <VisibilityIcon /> : <VisibilityOffIcon />}
          label={world.isVisible ? (t('gameWorlds.visible') || 'Visible') : (t('gameWorlds.hidden') || 'Hidden')}
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
          label={world.isMaintenance ? (t('gameWorlds.maintenance') || 'Maintenance') : (t('gameWorlds.active') || 'Active')}
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
        <Typography variant="body2">
          {formatDateTimeDetailed(world.createdAt)}
        </Typography>
      </TableCell>
      <TableCell align="center">
        <Tooltip title={t('gameWorlds.moveUp')}>
          <IconButton size="small" onClick={() => onMoveUp(world)}>
            <ArrowUpIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title={t('gameWorlds.moveDown')}>
          <IconButton size="small" onClick={() => onMoveDown(world)}>
            <ArrowDownIcon />
          </IconButton>
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
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingWorld, setEditingWorld] = useState<GameWorld | null>(null);
  const [formData, setFormData] = useState<CreateGameWorldData>({
    worldId: '',
    name: '',
    isVisible: true,
    isMaintenance: false,
    description: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

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

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      if (isMounted) {
        await loadGameWorlds();
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [search]);

  const loadGameWorlds = async () => {
    // 이미 로딩 중이면 중복 요청 방지
    if (loading) return;

    try {
      setLoading(true);
      const result = await gameWorldService.getGameWorlds({
        search: search || undefined,
      });

      setWorlds(result.worlds);
      setTotal(result.total);
    } catch (error: any) {
      console.error('Failed to load game worlds:', error);

      // 네트워크 오류인 경우에만 toast 표시
      if (error.message?.includes('Network Error') || error.code === 'NETWORK_ERROR') {
        enqueueSnackbar('Failed to load game worlds', { variant: 'error' });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddWorld = () => {
    setEditingWorld(null);
    setFormData({
      worldId: '',
      name: '',
      isVisible: true,
      isMaintenance: false,
      description: '',
    });
    setFormErrors({});
    setDialogOpen(true);
  };

  const handleEditWorld = (world: GameWorld) => {
    setEditingWorld(world);
    setFormData({
      worldId: world.worldId,
      name: world.name,
      isVisible: world.isVisible,
      isMaintenance: world.isMaintenance,
      description: world.description || '',
    });
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

  const handleSaveWorld = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      // Ensure boolean types are correct
      const dataToSend = {
        ...formData,
        isVisible: Boolean(formData.isVisible),
        isMaintenance: Boolean(formData.isMaintenance),
      };



      if (editingWorld) {
        await gameWorldService.updateGameWorld(editingWorld.id, dataToSend);
        enqueueSnackbar(t('gameWorlds.worldUpdated'), { variant: 'success' });
      } else {
        await gameWorldService.createGameWorld(dataToSend);
        enqueueSnackbar(t('gameWorlds.worldCreated'), { variant: 'success' });
      }

      setDialogOpen(false);
      loadGameWorlds();
    } catch (error: any) {
      console.error('Failed to save game world:', error);
      const message = error.response?.data?.message || 'Failed to save game world';
      enqueueSnackbar(message, { variant: 'error' });
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
        enqueueSnackbar('Failed to delete game world', { variant: 'error' });
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
          enqueueSnackbar('Failed to toggle visibility', { variant: 'error' });
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
          enqueueSnackbar('Failed to toggle maintenance status', { variant: 'error' });
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
        enqueueSnackbar('Order updated successfully', { variant: 'success' });
      } catch (error) {
        console.error('Failed to update order:', error);
        enqueueSnackbar('Failed to update order', { variant: 'error' });
        // Reload to get correct order
        loadGameWorlds();
      }
    }
  };

  const handleMoveUp = async (world: GameWorld) => {
    try {
      const moved = await gameWorldService.moveUp(world.id);
      if (moved) {
        enqueueSnackbar('Game world moved up successfully', { variant: 'success' });
        loadGameWorlds();
      } else {
        enqueueSnackbar('Game world is already at the top', { variant: 'info' });
      }
    } catch (error) {
      console.error('Failed to move up:', error);
      enqueueSnackbar('Failed to move world up', { variant: 'error' });
    }
  };

  const handleMoveDown = async (world: GameWorld) => {
    try {
      const moved = await gameWorldService.moveDown(world.id);
      if (moved) {
        enqueueSnackbar('Game world moved down successfully', { variant: 'success' });
        loadGameWorlds();
      } else {
        enqueueSnackbar('Game world is already at the bottom', { variant: 'info' });
      }
    } catch (error) {
      console.error('Failed to move down:', error);
      enqueueSnackbar('Failed to move world down', { variant: 'error' });
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
            {t('gameWorlds.title') || 'Game Worlds Management'}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {t('gameWorlds.subtitle') || 'Manage game world settings'}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAddWorld}
        >
          {t('gameWorlds.addGameWorld') || 'Add Game World'}
        </Button>
      </Box>

      {/* Statistics */}
      <Box sx={{ display: 'flex', gap: 3, mb: 4, justifyContent: 'center', flexWrap: 'wrap' }}>
        <Card sx={{ minWidth: 200, flex: 1 }}>
          <CardContent>
            <Typography variant="h4" color="primary.main" sx={{ fontWeight: 600 }}>
              {total}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('gameWorlds.totalWorlds') || 'Total Worlds'}
            </Typography>
          </CardContent>
        </Card>
        <Card sx={{ minWidth: 200, flex: 1 }}>
          <CardContent>
            <Typography variant="h4" color="success.main" sx={{ fontWeight: 600 }}>
              {worlds.filter(w => w.isVisible && !w.isMaintenance).length}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('gameWorlds.activeWorlds') || 'Active Worlds'}
            </Typography>
          </CardContent>
        </Card>
        <Card sx={{ minWidth: 200, flex: 1 }}>
          <CardContent>
            <Typography variant="h4" color="warning.main" sx={{ fontWeight: 600 }}>
              {worlds.filter(w => w.isMaintenance).length}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('gameWorlds.maintenanceWorlds') || 'Under Maintenance'}
            </Typography>
          </CardContent>
        </Card>
        <Card sx={{ minWidth: 200, flex: 1 }}>
          <CardContent>
            <Typography variant="h4" color="error.main" sx={{ fontWeight: 600 }}>
              {worlds.filter(w => !w.isVisible).length}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('gameWorlds.hiddenWorlds') || 'Hidden Worlds'}
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Search and Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <TextField
            fullWidth
            placeholder={t('gameWorlds.searchPlaceholder') || 'Search by name, world ID, or description...'}
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
          />
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
                    <TableCell>{t('gameWorlds.worldId') || 'World ID'}</TableCell>
                    <TableCell>{t('gameWorlds.name') || 'Name'}</TableCell>
                    <TableCell>{t('gameWorlds.visible') || 'Visible'}</TableCell>
                    <TableCell>{t('gameWorlds.maintenance') || 'Maintenance'}</TableCell>
                    <TableCell>{t('gameWorlds.description') || 'Description'}</TableCell>
                    <TableCell>{t('gameWorlds.created') || 'Created'}</TableCell>
                    <TableCell align="center">{t('gameWorlds.actions') || 'Actions'}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center">
                        {t('gameWorlds.loading') || 'Loading...'}
                      </TableCell>
                    </TableRow>
                  ) : worlds.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center">
                        {t('gameWorlds.noWorldsFound') || 'No game worlds found'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    <SortableContext
                      items={worlds.map(w => w.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {worlds.map((world) => (
                        <SortableRow
                          key={world.id}
                          world={world}
                          onEdit={handleEditWorld}
                          onDelete={handleDeleteWorld}
                          onToggleVisibility={handleToggleVisibility}
                          onToggleMaintenance={handleToggleMaintenance}
                          onMoveUp={handleMoveUp}
                          onMoveDown={handleMoveDown}
                          t={t}
                        />
                      ))}
                    </SortableContext>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </DndContext>


        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingWorld ? t('gameWorlds.editGameWorld') : t('gameWorlds.addGameWorld')}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 1 }}>
            <TextField
              fullWidth
              label={t('gameWorlds.worldId')}
              value={formData.worldId}
              onChange={(e) => setFormData({ ...formData, worldId: e.target.value })}
              error={!!formErrors.worldId}
              helperText={formErrors.worldId}
              required
            />

            <TextField
              fullWidth
              label={t('gameWorlds.name')}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              error={!!formErrors.name}
              helperText={formErrors.name}
              required
            />

            <TextField
              fullWidth
              label={t('gameWorlds.description')}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              multiline
              rows={3}
              placeholder={t('gameWorlds.description')}
            />

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

              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isMaintenance}
                    onChange={(e) => setFormData({ ...formData, isMaintenance: e.target.checked })}
                  />
                }
                label={t('gameWorlds.underMaintenance')}
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>
            {t('gameWorlds.cancel')}
          </Button>
          <Button onClick={handleSaveWorld} variant="contained">
            {t('gameWorlds.save')}
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
            To confirm deletion, please type the game world name: <strong>{deleteConfirmDialog.world?.name}</strong>
          </Typography>
          <TextField
            fullWidth
            label="Game World Name"
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
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default GameWorldsPage;
