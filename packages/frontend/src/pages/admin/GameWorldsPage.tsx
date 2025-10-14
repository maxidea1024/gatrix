import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useDebounce } from '../../hooks/useDebounce';
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
  Drawer,
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
  Translate as TranslateIcon,
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
import translationService from '../../services/translationService';
import MultiLanguageMessageInput, { MessageLocale } from '@/components/common/MultiLanguageMessageInput';
import JsonEditor from '@/components/common/JsonEditor';
import DynamicFilterBar, { FilterDefinition, ActiveFilter } from '../../components/common/DynamicFilterBar';
import MaintenanceSettingsInput from '../../components/common/MaintenanceSettingsInput';
import { messageTemplateService, MessageTemplate } from '@/services/messageTemplateService';

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
  onDuplicate: (world: GameWorld) => void;
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
  onDuplicate,
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

  const { t } = useTranslation();

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

        {/* Duplicate world (copy values into new form, worldId cleared) */}
        <Tooltip title={t('common.copy')}>
          <IconButton size="small" onClick={() => onDuplicate(world)}>
            <CopyIcon />
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
  const { t, i18n } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();



  const [worlds, setWorlds] = useState<GameWorld[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  // 디바운싱된 검색어 (500ms 지연)
  const debouncedSearch = useDebounce(search, 500);

  // 동적 필터 상태
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);

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

  // 점검 토글 다이얼로그 상태
  const [maintenanceToggleDialog, setMaintenanceToggleDialog] = useState<{
    open: boolean;
    world: GameWorld | null;
    isActivating: boolean;
    confirmInput: string;
    maintenanceData: {
      maintenanceStartDate: string;
      maintenanceEndDate: string;
      maintenanceMessage: string;
      supportsMultiLanguage: boolean;
      maintenanceLocales: GameWorldMaintenanceLocale[];
    };
  }>({
    open: false,
    world: null,
    isActivating: false,
    confirmInput: '',
    maintenanceData: {
      maintenanceStartDate: '',
      maintenanceEndDate: '',
      maintenanceMessage: '',
      supportsMultiLanguage: false,
      maintenanceLocales: [],
    },
  });
  const [toggleMaintenanceLocales, setToggleMaintenanceLocales] = useState<GameWorldMaintenanceLocale[]>([]);
  const [toggleSupportsMultiLanguage, setToggleSupportsMultiLanguage] = useState(false);

  // 메시지 템플릿 관련 state
  const [messageTemplates, setMessageTemplates] = useState<MessageTemplate[]>([]);
  const [toggleInputMode, setToggleInputMode] = useState<'direct' | 'template'>('direct');
  const [toggleSelectedTemplateId, setToggleSelectedTemplateId] = useState<number | ''>('');

  const worldIdRef = useRef<HTMLInputElement>(null);

  // Custom payload JSON editor state
  const [customPayloadText, setCustomPayloadText] = useState<string>('{}');
  const [customPayloadError, setCustomPayloadError] = useState<string>('');




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
    useSensor(PointerSensor, {
      // Require 8px of movement before drag starts (prevents accidental drags)
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Load registry tags for form use
  const [allRegistryTags, setAllRegistryTags] = useState<Tag[]>([]);
  useEffect(() => {
    tagService.list().then(setAllRegistryTags).catch(() => {});
  }, []);

  // Load message templates
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const result = await messageTemplateService.list({ limit: 1000 });
        console.log('[GameWorldsPage] Message templates loaded:', result);
        const enabledTemplates = result.templates.filter(t => t.isEnabled);
        console.log('[GameWorldsPage] Enabled templates:', enabledTemplates);
        setMessageTemplates(enabledTemplates);
      } catch (error) {
        console.error('[GameWorldsPage] Failed to load message templates:', error);
      }
    };
    loadTemplates();
  }, []);

  // 점검 메시지 로케일 관리 함수들
  const addMaintenanceLocale = (lang: 'ko' | 'en' | 'zh') => {
    if (!maintenanceLocales.find(l => l.lang === lang)) {
      const newLocales = [...maintenanceLocales, { lang, message: '' }];
      setMaintenanceLocales(newLocales);
      setFormData(prev => ({ ...prev, maintenanceLocales: newLocales }));
    }
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
  const availableLanguages = useMemo(() => ([
    { code: 'ko' as const, label: t('gameWorlds.maintenance.korean') },
    { code: 'en' as const, label: t('gameWorlds.maintenance.english') },
    { code: 'zh' as const, label: t('gameWorlds.maintenance.chinese') },
  ]), [t]);

  const usedLanguages = new Set(maintenanceLocales.map(l => l.lang));
  const availableToAdd = availableLanguages.filter(l => !usedLanguages.has(l.code));

  // 날짜 로케일 설정
  const getDateLocale = () => {
    const currentLang = i18n.language || 'ko';
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

  // 동적 필터 정의
  const availableFilterDefinitions: FilterDefinition[] = useMemo(() => [
    {
      key: 'tags',
      label: t('common.tags'),
      type: 'tags',
      operator: 'include_all',
      allowOperatorToggle: true,
      options: allRegistryTags.map(tag => ({
        value: tag.id,
        label: tag.name,
        color: tag.color,
      })),
    },
  ], [t, allRegistryTags]);

  // 동적 필터 핸들러
  const handleFilterAdd = (filter: ActiveFilter) => {
    setActiveFilters(prev => [...prev, filter]);
  };

  const handleFilterRemove = (key: string) => {
    setActiveFilters(prev => prev.filter(f => f.key !== key));
  };

  const handleDynamicFilterChange = (key: string, value: any) => {
    setActiveFilters(prev =>
      prev.map(f => (f.key === key ? { ...f, value } : f))
    );
  };

  const handleOperatorChange = (key: string, operator: 'any_of' | 'include_all') => {
    setActiveFilters(prev =>
      prev.map(f => (f.key === key ? { ...f, operator } : f))
    );
  };



  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      if (isMounted) {
        await loadGameWorlds();
      }
    };

    // allRegistryTags가 로드된 후에만 게임월드를 로드
    const tagFilter = activeFilters.find(f => f.key === 'tags');
    if (allRegistryTags.length > 0 || !tagFilter || (Array.isArray(tagFilter.value) && tagFilter.value.length === 0)) {
      loadData();
    }

    return () => {
      isMounted = false;
    };


  }, [debouncedSearch, activeFilters, allRegistryTags.length]);


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

      // 태그 필터에서 태그 ID 추출
      const tagFilter = activeFilters.find(f => f.key === 'tags');
      const tagIds = tagFilter && Array.isArray(tagFilter.value) && tagFilter.value.length > 0
        ? tagFilter.value
        : [];
      const tagOperator = tagFilter?.operator;

      const result = await gameWorldService.getGameWorlds({
        // 서버 컨트롤러는 tagIds(쉼표구분)를 기대함
        search: debouncedSearch || undefined,
        tagIds: tagIds.length ? tagIds.join(',') : undefined,
        tags_operator: tagOperator,
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
      customPayload: {},
      tagIds: [],
    });

    setCustomPayloadText('{}');
    setCustomPayloadError('');
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
      isVisible: Boolean(world.isVisible),
      isMaintenance: Boolean(world.isMaintenance),
      description: world.description || '',
      maintenanceStartDate: world.maintenanceStartDate || '',
      maintenanceEndDate: world.maintenanceEndDate || '',
      maintenanceMessage: world.maintenanceMessage || '',
      supportsMultiLanguage: shouldEnableMultiLanguage,
      maintenanceLocales: world.maintenanceLocales || [],
      customPayload: world.customPayload || {},
      tagIds: (world.tags || []).map(t => t.id),
    });
    setCustomPayloadText(JSON.stringify(world.customPayload || {}, null, 2));
    setCustomPayloadError('');
    setFormTags((world.tags || []));
    setMaintenanceLocales(world.maintenanceLocales || []);
    setSupportsMultiLanguage(shouldEnableMultiLanguage);
    setFormErrors({});
    setDialogOpen(true);
  };


  const handleDuplicateWorld = (world: GameWorld) => {
    // Duplicate: open in create mode with fields copied, but clear worldId
    setEditingWorld(null);

    const hasMaintenanceLocales = world.maintenanceLocales && world.maintenanceLocales.length > 0;
    const shouldEnableMultiLanguage = (world.supportsMultiLanguage ?? false) || hasMaintenanceLocales;

    setFormData({
      worldId: '', // must be empty for new world
      name: world.name || '',
      isVisible: Boolean(world.isVisible),
      isMaintenance: Boolean(world.isMaintenance),
      description: world.description || '',
      maintenanceStartDate: world.maintenanceStartDate || '',
      maintenanceEndDate: world.maintenanceEndDate || '',
      maintenanceMessage: world.maintenanceMessage || '',
      supportsMultiLanguage: shouldEnableMultiLanguage,
      maintenanceLocales: world.maintenanceLocales || [],
      customPayload: world.customPayload || {},
      tagIds: (world.tags || []).map(t => t.id),
    });

    setCustomPayloadText(JSON.stringify(world.customPayload || {}, null, 2));
    setCustomPayloadError('');
    setFormTags(world.tags || []);
    setMaintenanceLocales(world.maintenanceLocales || []);
    setSupportsMultiLanguage(shouldEnableMultiLanguage);
    setFormErrors({});
    setDialogOpen(true);

    // Focus worldId for quick entry
    setTimeout(() => {
      worldIdRef.current?.focus();
      worldIdRef.current?.select();
    }, 100);
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.worldId.trim()) {
      errors.worldId = t('validation.fieldRequired', { field: t('gameWorlds.worldId') });
    }

    if (!formData.name.trim()) {
      errors.name = t('validation.fieldRequired', { field: t('gameWorlds.name') });
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

      // Parse custom payload JSON
      let parsedCustomPayload: any = {};
      const text = (customPayloadText || '').trim();
      if (text.length > 0) {
        try {
          parsedCustomPayload = JSON.parse(text);
          setCustomPayloadError('');
        } catch (e: any) {
          setCustomPayloadError('Invalid JSON format');
          enqueueSnackbar('Custom payload JSON is invalid', { variant: 'error' });
          setSaving(false);
          return;
        }
      }

      const dataToSend = {
        ...formData,
        customPayload: parsedCustomPayload,
        tagIds,
        isVisible: Boolean(formData.isVisible),
        isMaintenance: Boolean(formData.isMaintenance),
        maintenanceStartDate: formData.maintenanceStartDate || undefined,
        maintenanceEndDate: formData.maintenanceEndDate || undefined,
        maintenanceMessage: formData.maintenanceMessage || undefined,
        supportsMultiLanguage: Boolean(formData.supportsMultiLanguage),
        maintenanceLocales: maintenanceLocales.filter(l => l.message.trim() !== ''),
      };

      let savedWorld: any;
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

    const isActivating = !world.isMaintenance;

    // 점검 활성화시 기존 점검 설정 가져오기
    if (isActivating) {
      setToggleMaintenanceLocales(world.maintenanceLocales || []);
      setToggleSupportsMultiLanguage(world.supportsMultiLanguage || false);
      setToggleInputMode('direct');
      setToggleSelectedTemplateId('');
    }

    setMaintenanceToggleDialog({
      open: true,
      world,
      isActivating,
      confirmInput: '',
      maintenanceData: {
        maintenanceStartDate: world.maintenanceStartDate || '',
        maintenanceEndDate: world.maintenanceEndDate || '',
        maintenanceMessage: world.maintenanceMessage || '',
        supportsMultiLanguage: world.supportsMultiLanguage || false,
        maintenanceLocales: world.maintenanceLocales || [],
      },
    });
  };

  const handleConfirmMaintenanceToggle = async () => {
    if (!maintenanceToggleDialog.world) return;

    try {
      if (maintenanceToggleDialog.isActivating) {
        // 점검 활성화: 점검 전용 API 사용
        const updateData: any = {
          isMaintenance: true,
          maintenanceStartDate: maintenanceToggleDialog.maintenanceData.maintenanceStartDate || undefined,
          maintenanceEndDate: maintenanceToggleDialog.maintenanceData.maintenanceEndDate || undefined,
        };

        // 메시지 소스에 따라 분기
        if (toggleInputMode === 'template') {
          // 템플릿 모드: templateId 전송
          updateData.maintenanceMessageTemplateId = toggleSelectedTemplateId || undefined;
        } else {
          // 직접 입력 모드: 메시지 직접 전송
          updateData.maintenanceMessage = maintenanceToggleDialog.maintenanceData.maintenanceMessage || undefined;
          updateData.supportsMultiLanguage = toggleSupportsMultiLanguage;
          updateData.maintenanceLocales = toggleMaintenanceLocales.filter(l => l.message.trim() !== '');
        }

        await gameWorldService.updateMaintenance(maintenanceToggleDialog.world.id, updateData);
        enqueueSnackbar(t('gameWorlds.maintenanceStarted'), { variant: 'success' });
      } else {
        // 점검 해제: 점검 전용 API 사용
        const updateData = {
          isMaintenance: false,
          maintenanceMessage: '',
          maintenanceLocales: [],
        };
        await gameWorldService.updateMaintenance(maintenanceToggleDialog.world.id, updateData);
        enqueueSnackbar(t('gameWorlds.maintenanceEnded'), { variant: 'success' });
      }
      loadGameWorlds();
      setMaintenanceToggleDialog({
        open: false,
        world: null,
        isActivating: false,
        confirmInput: '',
        maintenanceData: {
          maintenanceStartDate: '',
          maintenanceEndDate: '',
          maintenanceMessage: '',
          supportsMultiLanguage: false,
          maintenanceLocales: [],
        },
      });
      setToggleMaintenanceLocales([]);
      setToggleSupportsMultiLanguage(false);
      setToggleInputMode('direct');
      setToggleSelectedTemplateId('');
    } catch (error: any) {
      console.error('Failed to toggle maintenance:', error);
      enqueueSnackbar(error.message || t('gameWorlds.errors.toggleMaintenanceFailed'), { variant: 'error' });
    }
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
    <Box key={i18n.language} sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <WorldIcon sx={{ fontSize: 32, color: 'primary.main' }} />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {t('gameWorlds.title')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('gameWorlds.subtitle') }
            </Typography>
          </Box>
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
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', flexGrow: 1 }}>
              <TextField
                placeholder={t('gameWorlds.searchPlaceholder')}
                value={search}
                onChange={handleSearchChange}
                sx={{
                  minWidth: 200,
                  flexGrow: 1,
                  maxWidth: 320,
                  '& .MuiOutlinedInput-root': {
                    height: '40px',
                    borderRadius: '20px',
                    bgcolor: 'background.paper',
                    transition: 'all 0.2s ease-in-out',
                    '& fieldset': {
                      borderColor: 'divider',
                    },
                    '&:hover': {
                      bgcolor: 'action.hover',
                      '& fieldset': {
                        borderColor: 'primary.light',
                      }
                    },
                    '&.Mui-focused': {
                      bgcolor: 'background.paper',
                      boxShadow: '0 0 0 2px rgba(25, 118, 210, 0.1)',
                      '& fieldset': {
                        borderColor: 'primary.main',
                        borderWidth: '1px',
                      }
                    }
                  },
                  '& .MuiInputBase-input': {
                    fontSize: '0.875rem',
                  }
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                    </InputAdornment>
                  ),
                }}
                size="small"
              />

              {/* Dynamic Filter Bar */}
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
                <DynamicFilterBar
                  availableFilters={availableFilterDefinitions}
                  activeFilters={activeFilters}
                  onFilterAdd={handleFilterAdd}
                  onFilterRemove={handleFilterRemove}
                  onFilterChange={handleDynamicFilterChange}
                  onOperatorChange={handleOperatorChange}
                />
              </Box>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Game Worlds Table */}
      <Card>
        <CardContent sx={{ p: 0 }}>
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
                      message={t('gameWorlds.noWorldsFound')}
                      loadingMessage={t('common.loadingData')}
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
                          onDuplicate={handleDuplicateWorld}
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

      {/* Add/Edit Drawer */}
      <Drawer
        anchor="right"
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        sx={{
          zIndex: 1300,
          '& .MuiDrawer-paper': {
            width: 700,
            height: '100vh',
            display: 'flex',
            flexDirection: 'column'
          }
        }}
        ModalProps={{
          keepMounted: false
        }}
      >
        {/* Header */}
        <Box sx={{
          p: 3,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'background.paper',
          position: 'sticky',
          top: 0,
          zIndex: 1
        }}>
          <Box>
            <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
              {editingWorld ? t('gameWorlds.editGameWorld') : t('gameWorlds.addGameWorld')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {editingWorld
                ? t('gameWorlds.form.editDescription')
                : t('gameWorlds.form.addDescription')
              }
            </Typography>
          </Box>
          <IconButton
            onClick={() => setDialogOpen(false)}
            size="small"
            sx={{
              '&:hover': {
                backgroundColor: 'action.hover'
              }
            }}
          >
            <CancelIcon />
          </IconButton>
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 1 }}>
            <Box>
              <TextField
                fullWidth
                label={t('gameWorlds.worldId')}
                value={formData.worldId}
                onChange={(e) => {
                  const newWorldId = e.target.value;
                  const newFormData = { ...formData, worldId: newWorldId };

                  // 새 게임월드 추가 시에만 자동 복사 (편집 시에는 하지 않음)
                  // 이름이 비어있거나 이전 worldId와 동일한 경우에만 자동 복사
                  if (!editingWorld && (formData.name === '' || formData.name === formData.worldId)) {
                    newFormData.name = newWorldId;
                  }

                  setFormData(newFormData);
                }}
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
                slotProps={{
                  popper: {}
                }}
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
                        popper: {}
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
                        popper: {}
                      }}
                    />

                    {/* 점검 메시지 입력 컴포넌트 */}
                    <MultiLanguageMessageInput
                      defaultMessage={formData.maintenanceMessage || ''}
                      onDefaultMessageChange={(message) => setFormData({ ...formData, maintenanceMessage: message })}
                      defaultMessageLabel={t('gameWorlds.maintenance.defaultMessage')}
                      defaultMessageHelperText={t('gameWorlds.maintenance.defaultMessageHelp')}
                      defaultMessageRequired={formData.isMaintenance}
                      defaultMessageError={!!formErrors.maintenanceMessage}
                      supportsMultiLanguage={supportsMultiLanguage}
                      onSupportsMultiLanguageChange={handleSupportsMultiLanguageChange}
                      supportsMultiLanguageLabel={t('gameWorlds.maintenance.supportsMultiLanguage')}
                      supportsMultiLanguageHelperText={t('gameWorlds.maintenance.supportsMultiLanguageHelp')}

                      locales={maintenanceLocales.map(l => ({ lang: l.lang as 'ko' | 'en' | 'zh', message: l.message }))}
                      onLocalesChange={(locales) => {
                        const newLocales = locales.map(l => ({ lang: l.lang, message: l.message }));
                        setMaintenanceLocales(newLocales);
                        setFormData(prev => ({ ...prev, maintenanceLocales: newLocales }));
                        // 번역 결과가 있으면 자동으로 언어별 메시지 사용 활성화
                        const hasNonEmptyLocales = locales.some(l => l.message && l.message.trim() !== '');
                        if (hasNonEmptyLocales && !supportsMultiLanguage) {
                          setSupportsMultiLanguage(true);
                          setFormData(prev => ({ ...prev, supportsMultiLanguage: true }));
                        }
                      }}
                      languageSpecificMessagesLabel={t('gameWorlds.maintenance.languageSpecificMessages')}

                      enableTranslation={true}
                      translateButtonLabel={t('common.autoTranslate')}
                      translateTooltip={t('maintenance.translateTooltip')}
                    />
                  </Stack>
                </LocalizationProvider>
              </Paper>
            )}

            {/* Custom Payload */}
            <JsonEditor
              value={customPayloadText}
              onChange={(val) => setCustomPayloadText(val)}
              height="200px"
              label={t('gameWorlds.customPayload') || 'Custom Payload'}
              placeholder='{\n  "key": "value"\n}'
              error={customPayloadError}
              helperText={t('gameWorlds.form.customPayloadHelp') || '게임월드 관련 추가 데이터(JSON). 비워두면 {}로 저장됩니다.'}
            />
          </Box>
        </Box>

        {/* Actions */}
        <Box sx={{
          p: 2,
          borderTop: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          display: 'flex',
          gap: 1,
          justifyContent: 'flex-end'
        }}>
          <Button
            onClick={() => setDialogOpen(false)}
            disabled={saving}
            startIcon={<CancelIcon />}
          >
            {t('gameWorlds.cancel')}
          </Button>
          <Button
            onClick={handleSaveWorld}
            variant="contained"
            disabled={saving}
            startIcon={saving ? <CircularProgress size={20} /> : (editingWorld ? <SaveIcon /> : <AddIcon />)}
          >
            {saving ? t('common.saving') : (editingWorld ? t('gameWorlds.saveWorld') : t('gameWorlds.addGameWorld'))}
          </Button>
        </Box>
      </Drawer>

      {/* Confirmation Drawer */}
      <Drawer
        anchor="right"
        open={confirmDialog.open}
        onClose={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
        sx={{
          zIndex: 1301,
          '& .MuiDrawer-paper': {
            width: 400,
            height: '100vh',
            display: 'flex',
            flexDirection: 'column'
          }
        }}
        ModalProps={{
          keepMounted: false
        }}
      >
        {/* Header */}
        <Box sx={{
          p: 3,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'background.paper',
          position: 'sticky',
          top: 0,
          zIndex: 1
        }}>
          <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
            {confirmDialog.title}
          </Typography>
          <IconButton
            onClick={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
            size="small"
            sx={{
              '&:hover': {
                backgroundColor: 'action.hover'
              }
            }}
          >
            <CancelIcon />
          </IconButton>
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
          <Typography>{confirmDialog.message}</Typography>
        </Box>

        {/* Actions */}
        <Box sx={{
          p: 3,
          borderTop: 1,
          borderColor: 'divider',
          display: 'flex',
          gap: 2,
          justifyContent: 'flex-end'
        }}>
          <Button
            onClick={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
            color="inherit"
            size="small"
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
        </Box>
      </Drawer>

      {/* Maintenance Toggle Drawer */}
      <Drawer
        anchor="right"
        open={maintenanceToggleDialog.open}
        onClose={() => {
          setMaintenanceToggleDialog({
            open: false,
            world: null,
            isActivating: false,
            confirmInput: '',
            maintenanceData: {
              maintenanceStartDate: '',
              maintenanceEndDate: '',
              maintenanceMessage: '',
              supportsMultiLanguage: false,
              maintenanceLocales: [],
            },
          });
          setToggleMaintenanceLocales([]);
          setToggleSupportsMultiLanguage(false);
        }}
        sx={{
          zIndex: 1301,
          '& .MuiDrawer-paper': {
            width: 600,
            height: '100vh',
            display: 'flex',
            flexDirection: 'column'
          }
        }}
        ModalProps={{
          keepMounted: false
        }}
      >
        {/* Header */}
        <Box sx={{
          p: 3,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'background.paper',
          position: 'sticky',
          top: 0,
          zIndex: 1
        }}>
          <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
            {maintenanceToggleDialog.isActivating
              ? t('gameWorlds.confirmMaintenanceStart')
              : t('gameWorlds.confirmMaintenanceEnd')}
          </Typography>
          <IconButton
            onClick={() => {
              setMaintenanceToggleDialog({
                open: false,
                world: null,
                isActivating: false,
                confirmInput: '',
                maintenanceData: {
                  maintenanceStartDate: '',
                  maintenanceEndDate: '',
                  maintenanceMessage: '',
                  supportsMultiLanguage: false,
                  maintenanceLocales: [],
                },
              });
              setToggleMaintenanceLocales([]);
              setToggleSupportsMultiLanguage(false);
            }}
            size="small"
            sx={{
              '&:hover': {
                backgroundColor: 'action.hover'
              }
            }}
          >
            <CancelIcon />
          </IconButton>
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
          {maintenanceToggleDialog.isActivating ? (
            <>
              <Alert severity="warning" sx={{ mb: 3 }}>
                {t('gameWorlds.configureMaintenanceSettings')}
              </Alert>

              {/* 점검 설정 폼 */}
              <Paper elevation={0} sx={{ p: 2, bgcolor: 'background.default', border: '1px solid', borderColor: 'divider', mb: 3 }}>
                <Typography variant="subtitle1" gutterBottom sx={{ color: 'warning.main', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                  🔧 {t('gameWorlds.maintenanceSettings')}
                </Typography>

                <Box sx={{ mt: 2 }}>
                  <MaintenanceSettingsInput
                    startDate={maintenanceToggleDialog.maintenanceData.maintenanceStartDate}
                    endDate={maintenanceToggleDialog.maintenanceData.maintenanceEndDate}
                    onStartDateChange={(date) => setMaintenanceToggleDialog(prev => ({
                      ...prev,
                      maintenanceData: {
                        ...prev.maintenanceData,
                        maintenanceStartDate: date
                      }
                    }))}
                    onEndDateChange={(date) => setMaintenanceToggleDialog(prev => ({
                      ...prev,
                      maintenanceData: {
                        ...prev.maintenanceData,
                        maintenanceEndDate: date
                      }
                    }))}
                    inputMode={toggleInputMode}
                    onInputModeChange={setToggleInputMode}
                    maintenanceMessage={maintenanceToggleDialog.maintenanceData.maintenanceMessage}
                    onMaintenanceMessageChange={(message) => setMaintenanceToggleDialog(prev => ({
                      ...prev,
                      maintenanceData: {
                        ...prev.maintenanceData,
                        maintenanceMessage: message
                      }
                    }))}
                    supportsMultiLanguage={toggleSupportsMultiLanguage}
                    onSupportsMultiLanguageChange={(enabled) => {
                      setToggleSupportsMultiLanguage(enabled);
                      if (enabled) {
                        const availableLanguages = [
                          { code: 'ko' as const, label: t('gameWorlds.maintenance.korean') },
                          { code: 'en' as const, label: t('gameWorlds.maintenance.english') },
                          { code: 'zh' as const, label: t('gameWorlds.maintenance.chinese') },
                        ];
                        const merged = availableLanguages.map((lang) => {
                          const existing = toggleMaintenanceLocales.find(l => l.lang === lang.code);
                          return { lang: lang.code, message: existing?.message || '' };
                        });
                        setToggleMaintenanceLocales(merged);
                      }
                    }}
                    maintenanceLocales={toggleMaintenanceLocales.map(l => ({ lang: l.lang as 'ko' | 'en' | 'zh', message: l.message }))}
                    onMaintenanceLocalesChange={(locales) => {
                      const newLocales = locales.map(l => ({ lang: l.lang, message: l.message }));
                      setToggleMaintenanceLocales(newLocales);
                      const hasNonEmptyLocales = locales.some(l => l.message && l.message.trim() !== '');
                      if (hasNonEmptyLocales && !toggleSupportsMultiLanguage) {
                        setToggleSupportsMultiLanguage(true);
                      }
                    }}
                    templates={messageTemplates}
                    selectedTemplateId={toggleSelectedTemplateId}
                    onSelectedTemplateIdChange={setToggleSelectedTemplateId}
                    messageRequired={true}
                  />
                </Box>
              </Paper>

              {/* 확인 입력 */}
              <Typography variant="body2" sx={{ mb: 2 }}>
                {t('gameWorlds.typeWorldIdToConfirm', { worldId: maintenanceToggleDialog.world?.worldId })}
              </Typography>
              <TextField
                fullWidth
                value={maintenanceToggleDialog.confirmInput}
                onChange={(e) => setMaintenanceToggleDialog(prev => ({ ...prev, confirmInput: e.target.value }))}
                placeholder={maintenanceToggleDialog.world?.worldId}
                autoFocus
              />
            </>
          ) : (
            <>
              <Alert severity="warning" sx={{ mb: 2 }}>
                {t('gameWorlds.confirmEndMaintenance', { name: maintenanceToggleDialog.world?.name })}
              </Alert>
              <Typography variant="body2" sx={{ mb: 2 }}>
                {t('gameWorlds.typeWorldIdToConfirm', { worldId: maintenanceToggleDialog.world?.worldId })}
              </Typography>
              <TextField
                fullWidth
                value={maintenanceToggleDialog.confirmInput}
                onChange={(e) => setMaintenanceToggleDialog(prev => ({ ...prev, confirmInput: e.target.value }))}
                placeholder={maintenanceToggleDialog.world?.worldId}
                autoFocus
              />
            </>
          )}
        </Box>

        {/* Footer */}
        <Box sx={{
          p: 2,
          borderTop: 1,
          borderColor: 'divider',
          display: 'flex',
          gap: 1,
          justifyContent: 'flex-end',
          backgroundColor: 'background.paper'
        }}>
          <Button
            onClick={() => {
              setMaintenanceToggleDialog({
                open: false,
                world: null,
                isActivating: false,
                confirmInput: '',
                maintenanceData: {
                  maintenanceStartDate: '',
                  maintenanceEndDate: '',
                  maintenanceMessage: '',
                  supportsMultiLanguage: false,
                  maintenanceLocales: [],
                },
              });
              setToggleMaintenanceLocales([]);
              setToggleSupportsMultiLanguage(false);
            }}
            color="inherit"
            size="small"
          >
            {t('gameWorlds.cancel')}
          </Button>
          <Button
            onClick={handleConfirmMaintenanceToggle}
            color={maintenanceToggleDialog.isActivating ? 'warning' : 'primary'}
            variant="contained"
            disabled={
              maintenanceToggleDialog.confirmInput !== maintenanceToggleDialog.world?.worldId ||
              (maintenanceToggleDialog.isActivating && (
                toggleInputMode === 'direct'
                  ? !maintenanceToggleDialog.maintenanceData.maintenanceMessage?.trim()
                  : !toggleSelectedTemplateId
              ))
            }
          >
            {maintenanceToggleDialog.isActivating ? t('gameWorlds.startMaintenance') : t('gameWorlds.endMaintenance')}
          </Button>
        </Box>
      </Drawer>

      {/* Delete Confirmation Drawer */}
      <Drawer
        anchor="right"
        open={deleteConfirmDialog.open}
        onClose={() => setDeleteConfirmDialog({ open: false, world: null, inputValue: '' })}
        sx={{
          zIndex: 1301,
          '& .MuiDrawer-paper': {
            width: 500,
            height: '100vh',
            display: 'flex',
            flexDirection: 'column'
          }
        }}
        ModalProps={{
          keepMounted: false
        }}
      >
        {/* Header */}
        <Box sx={{
          p: 3,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'background.paper',
          position: 'sticky',
          top: 0,
          zIndex: 1
        }}>
          <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
            {t('gameWorlds.deleteGameWorld')}
          </Typography>
          <IconButton
            onClick={() => setDeleteConfirmDialog({ open: false, world: null, inputValue: '' })}
            size="small"
            sx={{
              '&:hover': {
                backgroundColor: 'action.hover'
              }
            }}
          >
            <CancelIcon />
          </IconButton>
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
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
            size="small"
          />
        </Box>

        {/* Actions */}
        <Box sx={{
          p: 3,
          borderTop: 1,
          borderColor: 'divider',
          display: 'flex',
          gap: 2,
          justifyContent: 'flex-end'
        }}>
          <Button
            onClick={() => setDeleteConfirmDialog({ open: false, world: null, inputValue: '' })}
            color="inherit"
            size="small"
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
        </Box>
      </Drawer>
    </Box>
  );
};

export default GameWorldsPage;
