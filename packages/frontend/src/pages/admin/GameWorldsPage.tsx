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
  FormControl,
  FormControlLabel,
  FormHelperText,
  InputAdornment,
  Tooltip,
  Alert,
  LinearProgress,
  CircularProgress,
  Autocomplete, Chip as MuiChip, TextField as MuiTextField,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Paper,
  Stack,
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
  ExpandMore as ExpandMoreIcon,
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
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import 'dayjs/locale/ko';
import 'dayjs/locale/en';
import 'dayjs/locale/zh-cn';
import { gameWorldService } from '../../services/gameWorldService';
import { tagService, Tag } from '@/services/tagService';
import { GameWorld, CreateGameWorldData, GameWorldMaintenanceLocale } from '../../types/gameWorld';
import { formatDateTimeDetailed } from '../../utils/dateFormat';
import FormDialogHeader from '../../components/common/FormDialogHeader';
import EmptyTableRow from '../../components/common/EmptyTableRow';

// Sortable Row Component
interface SortableRowProps {
  world: GameWorld;
  index: number;
  total: number;
  highlight: boolean;
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
  highlight,
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
    <TableRow ref={setNodeRef} style={style} hover data-world-id={world.id}
      sx={{ bgcolor: highlight ? 'rgba(25,118,210,0.12)' : undefined, transition: 'background-color 1.2s ease' }}>

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
        {world.isMaintenance ? (
          <Tooltip
            title={
              <Box>
                {world.maintenanceMessage && (
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    {world.maintenanceMessage}
                  </Typography>
                )}
                {world.maintenanceStartDate && (
                  <Typography variant="caption" display="block">
                    {t('gameWorlds.maintenance.startDate')}: {new Date(world.maintenanceStartDate).toLocaleString()}
                  </Typography>
                )}
                {world.maintenanceEndDate && (
                  <Typography variant="caption" display="block">
                    {t('gameWorlds.maintenance.endDate')}: {new Date(world.maintenanceEndDate).toLocaleString()}
                  </Typography>
                )}
              </Box>
            }
            arrow
            placement="top"
          >
            <Chip
              icon={<MaintenanceIcon />}
              label={t('gameWorlds.maintenanceLabel')}
              color="warning"
              size="small"
              onClick={() => onToggleMaintenance(world.id)}
              sx={{
                cursor: 'pointer',
                '&:hover': {
                  backgroundColor: 'warning.dark',
                }
              }}
            />
          </Tooltip>
        ) : (
          <Chip
            icon={<MaintenanceIcon />}
            label={t('gameWorlds.active')}
            color="success"
            size="small"
            onClick={() => onToggleMaintenance(world.id)}
            sx={{
              cursor: 'pointer',
              '&:hover': {
                backgroundColor: 'success.dark',
              }
            }}
          />
        )}
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
    maintenanceStartDate: '',
    maintenanceEndDate: '',
    maintenanceMessage: '',
    supportsMultiLanguage: false,
    maintenanceLocales: [],
    tagIds: [],
  });
  const [formTags, setFormTags] = useState<Tag[]>([]);
  const [maintenanceLocales, setMaintenanceLocales] = useState<GameWorldMaintenanceLocale[]>([]);
  const [supportsMultiLanguage, setSupportsMultiLanguage] = useState(false);

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const worldIdRef = useRef<HTMLInputElement>(null);


  // Highlight & scroll for recently moved row
  const [recentlyMovedId, setRecentlyMovedId] = useState<number | null>(null);
  const highlightTimerRef = useRef<number | null>(null);

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

  // 점검 메시지 로케일 관리 함수들
  const addMaintenanceLocale = (lang: 'ko' | 'en' | 'zh') => {
    if (!maintenanceLocales.find(l => l.lang === lang)) {
      const newLocales = [...maintenanceLocales, { lang, message: '' }];
      setMaintenanceLocales(newLocales);
      setFormData(prev => ({ ...prev, maintenanceLocales: newLocales }));
    }
  };

  const updateMaintenanceLocale = (lang: 'ko' | 'en' | 'zh', message: string) => {
    const existingIndex = maintenanceLocales.findIndex(l => l.lang === lang);
    let newLocales;

    if (existingIndex >= 0) {
      // 기존 언어 업데이트
      newLocales = maintenanceLocales.map(l =>
        l.lang === lang ? { ...l, message } : l
      );
    } else {
      // 새 언어 추가
      newLocales = [...maintenanceLocales, { lang, message }];
    }

    setMaintenanceLocales(newLocales);
    setFormData(prev => ({ ...prev, maintenanceLocales: newLocales }));
  };

  const removeMaintenanceLocale = (lang: 'ko' | 'en' | 'zh') => {
    const newLocales = maintenanceLocales.filter(l => l.lang !== lang);
    setMaintenanceLocales(newLocales);
    setFormData(prev => ({ ...prev, maintenanceLocales: newLocales }));
  };

  // 언어별 메시지 사용 여부 변경
  const handleSupportsMultiLanguageChange = (enabled: boolean) => {
    setSupportsMultiLanguage(enabled);
    setFormData(prev => ({ ...prev, supportsMultiLanguage: enabled }));
    if (enabled) {
      // 활성화 시, 기존 값을 보존하면서 누락된 언어만 추가
      const merged = availableLanguages.map((lang) => {
        const existing = maintenanceLocales.find(l => l.lang === lang.code);
        return { lang: lang.code, message: existing?.message || '' };
      });
      setMaintenanceLocales(merged);
      setFormData(prev => ({ ...prev, maintenanceLocales: merged }));
    } else {
      // 비활성화 시, 입력값은 유지하고 UI만 숨김 (state/form 값은 건드리지 않음)
      // no-op
    }
  };

  // 사용 가능한 언어 목록
  const availableLanguages = [
    { code: 'ko' as const, label: t('gameWorlds.maintenance.korean') },
    { code: 'en' as const, label: t('gameWorlds.maintenance.english') },
    { code: 'zh' as const, label: t('gameWorlds.maintenance.chinese') },
  ];

  const usedLanguages = new Set(maintenanceLocales.map(l => l.lang));
  const availableToAdd = availableLanguages.filter(l => !usedLanguages.has(l.code));

  // 날짜 로케일 설정
  const getDateLocale = () => {
    const currentLang = t('language') || 'ko';
    switch (currentLang) {
      case 'en':
        dayjs.locale('en');
        return 'en';


      case 'zh':
        dayjs.locale('zh-cn');
        return 'zh-cn';
      default:
        dayjs.locale('ko');
        return 'ko';
    }
  };

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


  // Scroll moved row into view when worlds reload and highlight is set
  useEffect(() => {
    if (recentlyMovedId != null) {
      const el = document.querySelector(`[data-world-id="${recentlyMovedId}"]`) as HTMLElement | null;
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [recentlyMovedId, worlds]);

  // Cleanup highlight timer on unmount
  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) {
        window.clearTimeout(highlightTimerRef.current);
      }
    };
  }, []);

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
      maintenanceStartDate: '',
      maintenanceEndDate: '',
      maintenanceMessage: '',
      supportsMultiLanguage: false,
      maintenanceLocales: [],
      tagIds: [],
    });


    setFormTags([]);
    setMaintenanceLocales([]);
    setSupportsMultiLanguage(false);
    setFormErrors({});
    setDialogOpen(true);
    setTimeout(() => {
      worldIdRef.current?.focus();
      worldIdRef.current?.select();
    }, 100);
  };

  const handleEditWorld = (world: GameWorld) => {
    setEditingWorld(world);

    // 언어별 메시지가 있는지 확인
    const hasMaintenanceLocales = world.maintenanceLocales && world.maintenanceLocales.length > 0;
    const shouldEnableMultiLanguage = (world.supportsMultiLanguage ?? false) || hasMaintenanceLocales;

    setFormData({
      worldId: world.worldId,
      name: world.name,
      isVisible: world.isVisible,
      isMaintenance: world.isMaintenance,
      description: world.description || '',
      maintenanceStartDate: world.maintenanceStartDate || '',
      maintenanceEndDate: world.maintenanceEndDate || '',
      maintenanceMessage: world.maintenanceMessage || '',
      supportsMultiLanguage: shouldEnableMultiLanguage,
      maintenanceLocales: world.maintenanceLocales || [],
      tagIds: (world.tags || []).map(t => t.id),
    });
    setFormTags((world.tags || []));
    setMaintenanceLocales(world.maintenanceLocales || []);
    setSupportsMultiLanguage(shouldEnableMultiLanguage);
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

    // 점검 모드일 때 기본 점검 메시지 필수 체크
    if (formData.isMaintenance && (!formData.maintenanceMessage || !formData.maintenanceMessage.trim())) {
      errors.maintenanceMessage = t('gameWorlds.maintenance.messageRequired');
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
      // Tag 객체에서 ID 추출
      const tagIds = (formTags || []).map(t => t.id);

      const dataToSend = {
        ...formData,
        tagIds,
        isVisible: Boolean(formData.isVisible),
        isMaintenance: Boolean(formData.isMaintenance),
        maintenanceStartDate: formData.maintenanceStartDate || undefined,
        maintenanceEndDate: formData.maintenanceEndDate || undefined,
        maintenanceMessage: formData.maintenanceMessage || undefined,
        supportsMultiLanguage: formData.supportsMultiLanguage || false,
        maintenanceLocales: maintenanceLocales.filter(l => l.message.trim() !== ''),
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
        // Server lists by displayOrder DESC; assign larger numbers to rows nearer the top
        displayOrder: (newWorlds.length - index) * 10
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
      // UI 기준으로 위로 이동이므로, 서버 정렬이 반대라면 moveDown을 호출해 시각적으로 위로 이동시킵니다.
      const moved = await gameWorldService.moveDown(world.id);
      if (moved) {
        await loadGameWorlds();
        // highlight recently moved row
        setRecentlyMovedId(world.id);
        if (highlightTimerRef.current) window.clearTimeout(highlightTimerRef.current);
        highlightTimerRef.current = window.setTimeout(() => setRecentlyMovedId(null), 1800);
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
      // UI 기준으로 아래로 이동이므로, 서버 정렬이 반대라면 moveUp을 호출해 시각적으로 아래로 이동시킵니다.
      const moved = await gameWorldService.moveUp(world.id);
      if (moved) {
        await loadGameWorlds();
        // highlight recently moved row
        setRecentlyMovedId(world.id);
        if (highlightTimerRef.current) window.clearTimeout(highlightTimerRef.current);
        highlightTimerRef.current = window.setTimeout(() => setRecentlyMovedId(null), 1800);
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
            {t('gameWorlds.subtitle') }
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
                sx={{ minWidth: 400, flexShrink: 0 }}
                options={existingTags}
                getOptionLabel={(option) => option.name}
                filterSelectedOptions
                isOptionEqualToValue={(option, value) => option.id === value.id}
                value={tagsFilter}
                onChange={(_, value) => setTagsFilter(value)}
                slotProps={autocompleteSlotProps as any}
                renderValue={(value, getTagProps) =>
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
                    <TableCell>{t('gameWorlds.maintenanceLabel')}</TableCell>
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
                          highlight={recentlyMovedId === world.id}
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
                options={allRegistryTags.filter(tag => typeof tag !== 'string')} // Tag 객체만 사용
                getOptionLabel={(option) => option.name}
                filterSelectedOptions
                isOptionEqualToValue={(option, value) => option.id === value.id}
                value={formTags}
                onChange={(_, value) => setFormTags(value)}
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
                renderOption={(props, option) => {
                  const { key, ...otherProps } = props;
                  return (
                    <Box component="li" key={key} {...otherProps}>
                      <Chip
                        label={option.name}
                        size="small"
                        sx={{ bgcolor: option.color, color: '#fff', mr: 1 }}
                      />
                      {option.description || t('common.noDescription')}
                    </Box>
                  );
                }}
              />
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {/* 표시 여부 */}
              <FormControl variant="standard">
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.isVisible}
                      onChange={(e) => setFormData({ ...formData, isVisible: e.target.checked })}
                    />
                  }
                  label={t('gameWorlds.visibleToUsers')}
                />
                <FormHelperText sx={{ ml: 6, mt: -0.5, mb: 1 }}>
                  {t('gameWorlds.form.visibleHelp')}
                </FormHelperText>
              </FormControl>

              {/* 점검 중 */}
              <FormControl variant="standard">
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.isMaintenance}
                      onChange={(e) => setFormData({ ...formData, isMaintenance: e.target.checked })}
                    />
                  }
                  label={t('gameWorlds.underMaintenance')}
                />
                <FormHelperText sx={{ ml: 6, mt: -0.5 }}>
                  {t('gameWorlds.form.maintenanceHelp')}
                </FormHelperText>
              </FormControl>
            </Box>

            {/* 점검 설정 섹션 */}
            {!!formData.isMaintenance && (
              <Paper elevation={0} sx={{ p: 2, bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' }}>
                <Typography variant="h6" gutterBottom sx={{ color: 'warning.main', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                  🔧 {t('gameWorlds.maintenance.title')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {t('gameWorlds.maintenance.description')}
                </Typography>

                <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale={getDateLocale()}>
                  <Stack spacing={2}>
                    {/* 점검 시작일 */}
                    <DateTimePicker
                      label={t('gameWorlds.maintenance.startDate')}
                      value={formData.maintenanceStartDate ? dayjs(formData.maintenanceStartDate) : null}
                      onChange={(date) => setFormData({ ...formData, maintenanceStartDate: date ? date.toISOString() : '' })}
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          helperText: t('gameWorlds.maintenance.startDateHelp'),
                        },
                      }}
                    />

                    {/* 점검 종료일 */}
                    <DateTimePicker
                      label={t('gameWorlds.maintenance.endDate')}
                      value={formData.maintenanceEndDate ? dayjs(formData.maintenanceEndDate) : null}
                      onChange={(date) => setFormData({ ...formData, maintenanceEndDate: date ? date.toISOString() : '' })}
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          helperText: t('gameWorlds.maintenance.endDateHelp'),
                        },
                      }}
                    />

                    {/* 기본 점검 메시지 */}
                    <TextField
                      fullWidth
                      multiline
                      rows={3}
                      label={t('gameWorlds.maintenance.defaultMessage')}
                      value={formData.maintenanceMessage}
                      onChange={(e) => setFormData({ ...formData, maintenanceMessage: e.target.value })}
                      helperText={t('gameWorlds.maintenance.defaultMessageHelp')}
                      required={formData.isMaintenance}
                      error={!!formErrors.maintenanceMessage}
                    />

                    {/* 언어별 메시지 사용 여부 */}
                    <FormControlLabel
                      control={
                        <Switch
                          checked={supportsMultiLanguage}
                          onChange={(e) => handleSupportsMultiLanguageChange(e.target.checked)}
                        />
                      }
                      label={t('gameWorlds.maintenance.supportsMultiLanguage')}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {t('gameWorlds.maintenance.supportsMultiLanguageHelp')}
                    </Typography>

                    {/* 언어별 메시지 */}
                    {supportsMultiLanguage && (
                      <Box>
                        <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                          {t('gameWorlds.maintenance.languageSpecificMessages')}
                        </Typography>

                        {/* 모든 언어별 메시지 입력 */}
                        {availableLanguages.map((lang) => {
                          const locale = maintenanceLocales.find(l => l.lang === lang.code);
                          return (
                            <Box key={lang.code} sx={{ mb: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                                {lang.label}
                              </Typography>
                              <TextField
                                fullWidth
                                multiline
                                rows={3}
                                value={locale?.message || ''}
                                onChange={(e) => updateMaintenanceLocale(lang.code, e.target.value)}
                                placeholder={t(`maintenanceMessage.${lang.code}Help`)}
                              />
                            </Box>
                          );
                        })}
                      </Box>
                    )}
                  </Stack>
                </LocalizationProvider>
              </Paper>
            )}
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
