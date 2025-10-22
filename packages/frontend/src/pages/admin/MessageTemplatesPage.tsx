import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useDebounce } from '../../hooks/useDebounce';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Stack,
  TextField,
  Switch,
  FormControlLabel,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  LinearProgress,
  Select,
  CircularProgress,
  FormControl,
  InputLabel,
  Skeleton,
  Tooltip,
  Checkbox,
  Alert,
  Autocomplete,
  Drawer,
  InputAdornment,
  Popover,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ClickAwayListener,
} from '@mui/material';
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
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Close as CloseIcon,
  Cancel as CancelIcon,
  Save as SaveIcon,
  Refresh as RefreshIcon,
  LocalOffer as LocalOfferIcon,
  ContentCopy as ContentCopyIcon,
  Search as SearchIcon,
  TextFields as TextFieldsIcon,
  ViewColumn as ViewColumnIcon,
  DragIndicator as DragIndicatorIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { formatDateTimeDetailed } from '@/utils/dateFormat';
import { messageTemplateService, MessageTemplate, MessageTemplateLocale, MessageTemplateType } from '@/services/messageTemplateService';
import { tagService, Tag } from '@/services/tagService';
import translationService from '@/services/translationService';
import { getLanguageDisplayName } from '@/contexts/I18nContext';
import SimplePagination from '@/components/common/SimplePagination';
import FormDialogHeader from '@/components/common/FormDialogHeader';
import EmptyTableRow from '@/components/common/EmptyTableRow';
import MultiLanguageMessageInput, { MessageLocale } from '@/components/common/MultiLanguageMessageInput';
import DynamicFilterBar, { FilterDefinition, ActiveFilter } from '@/components/common/DynamicFilterBar';
import { api } from '@/services/api';

// Column definition interface
interface ColumnConfig {
  id: string;
  labelKey: string;
  visible: boolean;
  width?: string;
}

// Sortable list item component for drag and drop
interface SortableColumnItemProps {
  column: ColumnConfig;
  onToggleVisibility: (id: string) => void;
}

const SortableColumnItem: React.FC<SortableColumnItemProps> = ({ column, onToggleVisibility }) => {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <ListItem
      ref={setNodeRef}
      style={style}
      disablePadding
      secondaryAction={
        <Box {...attributes} {...listeners} sx={{ cursor: 'grab', display: 'flex', alignItems: 'center', '&:active': { cursor: 'grabbing' } }}>
          <DragIndicatorIcon sx={{ color: 'text.disabled', fontSize: 20 }} />
        </Box>
      }
    >
      <ListItemButton
        dense
        onClick={() => onToggleVisibility(column.id)}
        sx={{ pr: 6 }}
      >
        <Checkbox
          edge="start"
          checked={column.visible}
          tabIndex={-1}
          disableRipple
          size="small"
          icon={<VisibilityOffIcon fontSize="small" />}
          checkedIcon={<VisibilityIcon fontSize="small" />}
        />
        <ListItemText
          primary={t(column.labelKey)}
          slotProps={{ primary: { variant: 'body2' } }}
        />
      </ListItemButton>
    </ListItem>
  );
};

const MessageTemplatesPage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [items, setItems] = useState<MessageTemplate[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const loadStartTimeRef = useRef<number>(0);
  // Copy helper with type/label for proper i18n interpolation
  // includeValue=false -> use short toast without the copied value
  const copyWithToast = async (value: string, typeLabel?: string, includeValue: boolean = true) => {
    try {
      await navigator.clipboard.writeText(value);
      const message = includeValue && typeLabel
        ? t('common.copied', { type: typeLabel, value })
        : typeLabel
          ? t('common.copySuccess', { type: typeLabel })
          : t('common.copySuccess', { type: t('common.copy') });
      enqueueSnackbar(message, { variant: 'success' });
    } catch (e) {
      enqueueSnackbar(t('common.copyFailed'), { variant: 'error' });
    }
  };

  const [saving, setSaving] = useState(false);

  // 페이지네이션
  const [page, setPage] = useState(0); // SimplePagination은 0-based
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // 필터
  const [searchQuery, setSearchQuery] = useState('');

  // 디바운싱된 검색어 (500ms 지연)
  const debouncedSearchQuery = useDebounce(searchQuery, 500);

  // 동적 필터 상태 (localStorage에서 복원)
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>(() => {
    try {
      const saved = localStorage.getItem('messageTemplatesPage.activeFilters');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [filtersInitialized, setFiltersInitialized] = useState(false);

  // 동적 필터에서 값 추출 (useMemo로 참조 안정화)
  const isEnabledFilter = useMemo(() => {
    const filter = activeFilters.find(f => f.key === 'isEnabled');
    return filter?.value as boolean | boolean[] | undefined;
  }, [activeFilters]);

  const isEnabledOperator = useMemo(() => {
    const filter = activeFilters.find(f => f.key === 'isEnabled');
    return filter?.operator;
  }, [activeFilters]);

  const tagIds = useMemo(() =>
    activeFilters.find(f => f.key === 'tags')?.value as number[] || [],
    [activeFilters]
  );

  const tagOperator = useMemo(() => {
    const filter = activeFilters.find(f => f.key === 'tags');
    return filter?.operator;
  }, [activeFilters]);

  // 필터를 문자열로 변환하여 의존성 배열에 사용
  const isEnabledFilterString = useMemo(() =>
    Array.isArray(isEnabledFilter) ? isEnabledFilter.join(',') : (isEnabledFilter !== undefined ? String(isEnabledFilter) : ''),
    [isEnabledFilter]
  );
  const tagIdsString = useMemo(() => tagIds.join(','), [tagIds]);

  // 선택 관련
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [selectAll, setSelectAll] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MessageTemplate | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingTemplate, setDeletingTemplate] = useState<MessageTemplate | null>(null);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);

  // 태그 관련 상태
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [selectedTemplateForTags, setSelectedTemplateForTags] = useState<MessageTemplate | null>(null);
  const [templateTags, setTemplateTags] = useState<Tag[]>([]);

  const [form, setForm] = useState<MessageTemplate>({ name: '', type: 'maintenance', isEnabled: true, defaultMessage: '', locales: [] });

  // Column configuration
  const defaultColumns: ColumnConfig[] = [
    { id: 'name', labelKey: 'messageTemplates.name', visible: true },
    { id: 'type', labelKey: 'messageTemplates.type', visible: true },
    { id: 'defaultMessage', labelKey: 'messageTemplates.defaultMessage', visible: true },
    { id: 'isEnabled', labelKey: 'messageTemplates.isEnabled', visible: true },
    { id: 'tags', labelKey: 'common.tags', visible: true },
    { id: 'createdAt', labelKey: 'common.createdAt', visible: true },
  ];

  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    const saved = localStorage.getItem('messageTemplatesColumns');
    if (saved) {
      try {
        const savedColumns = JSON.parse(saved);
        const mergedColumns = savedColumns.map((savedCol: ColumnConfig) => {
          const defaultCol = defaultColumns.find(c => c.id === savedCol.id);
          return defaultCol ? { ...defaultCol, ...savedCol } : savedCol;
        });
        const savedIds = new Set(savedColumns.map((c: ColumnConfig) => c.id));
        const newColumns = defaultColumns.filter(c => !savedIds.has(c.id));
        return [...mergedColumns, ...newColumns];
      } catch (e) {
        return defaultColumns;
      }
    }
    return defaultColumns;
  });

  const [columnSettingsAnchor, setColumnSettingsAnchor] = useState<HTMLButtonElement | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // 폼 필드 ref들
  const nameFieldRef = useRef<HTMLInputElement>(null);
  const defaultMessageFieldRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const offset = page * rowsPerPage;
      const params: any = {
        q: debouncedSearchQuery || undefined,
        limit: rowsPerPage,
        offset
      };

      if (isEnabledFilter !== undefined) {
        params.isEnabled = isEnabledFilter;
        if (isEnabledOperator) params.isEnabled_operator = isEnabledOperator;
      }
      if (tagIds.length > 0) {
        params.tags = tagIds.map(id => id.toString());
        if (tagOperator) params.tags_operator = tagOperator;
      }

      const result = await messageTemplateService.list(params);

      setItems(result.templates);
      setTotal(result.total);
    } catch (error: any) {
      enqueueSnackbar(error.message || t('messageTemplates.loadFailed'), { variant: 'error' });
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  }, [page, rowsPerPage, isEnabledFilterString, isEnabledOperator, tagIdsString, tagOperator, debouncedSearchQuery, enqueueSnackbar, t]);

  // 태그 로딩
  const loadTags = useCallback(async () => {
    try {
      const tags = await tagService.list();
      setAllTags(tags);
    } catch (error) {
      // Error handling
    }
  }, []);

  useEffect(() => {
    load();
    loadTags();
  }, [load, loadTags]);

  // 동적 필터 정의
  const availableFilterDefinitions: FilterDefinition[] = useMemo(() => [
    {
      key: 'isEnabled',
      label: t('common.status'),
      type: 'multiselect',
      operator: 'any_of', // Status can be any of the selected values
      allowOperatorToggle: false, // Single-value field, only 'any_of' makes sense
      options: [
        { value: true, label: t('common.enabled') },
        { value: false, label: t('common.disabled') },
      ],
    },
    {
      key: 'tags',
      label: t('common.tags'),
      type: 'tags',
      operator: 'include_all', // Tags are filtered with AND logic in backend
      allowOperatorToggle: true, // Tags support both 'any_of' and 'include_all'
      options: allTags.map(tag => ({
        value: tag.id,
        label: tag.name,
        color: tag.color,
        description: tag.description,
      })),
    },
  ], [t, allTags]);

  // 동적 필터 핸들러
  const handleFilterAdd = (filter: ActiveFilter) => {
    setActiveFilters([...activeFilters, filter]);
    setPage(0);
  };

  const handleFilterRemove = (filterKey: string) => {
    setActiveFilters(activeFilters.filter(f => f.key !== filterKey));
    setPage(0);
  };

  const handleDynamicFilterChange = (filterKey: string, value: any) => {
    setActiveFilters(activeFilters.map(f =>
      f.key === filterKey ? { ...f, value } : f
    ));
    setPage(0);
  };

  const handleOperatorChange = (filterKey: string, operator: 'any_of' | 'include_all') => {
    setActiveFilters(activeFilters.map(f =>
      f.key === filterKey ? { ...f, operator } : f
    ));
  };

  // 페이지 변경 핸들러
  const handlePageChange = useCallback((_: unknown, newPage: number) => {
    setPage(newPage);
  }, []);

  // 페이지 크기 변경 핸들러
  const handleRowsPerPageChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const newRowsPerPage = parseInt(event.target.value, 10);
    setRowsPerPage(newRowsPerPage);
    setPage(0);
  }, []);

  // 선택 관련 핸들러
  const handleSelectAll = useCallback((checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      setSelectedIds(items.filter(item => item.id).map(item => item.id!));
    } else {
      setSelectedIds([]);
    }
  }, [items]);

  const handleSelectItem = useCallback((id: number, checked: boolean) => {
    setSelectedIds(prev => {
      const newIds = checked
        ? [...prev, id]
        : prev.filter(selectedId => selectedId !== id);

      // 전체 선택 상태 업데이트
      const availableIds = items.filter(item => item.id).map(item => item.id!);
      setSelectAll(newIds.length === availableIds.length && availableIds.length > 0);

      return newIds;
    });
  }, [items]);

  // 일괄 삭제
  const handleBulkDelete = useCallback(() => {
    if (selectedIds.length === 0) return;
    setBulkDeleteDialogOpen(true);
  }, [selectedIds]);

  const confirmBulkDelete = useCallback(async () => {
    try {
      await messageTemplateService.bulkDelete(selectedIds);
      enqueueSnackbar(t('messageTemplates.bulkDeleteSuccess', { count: selectedIds.length }), { variant: 'success' });
      setSelectedIds([]);
      setSelectAll(false);
      setBulkDeleteDialogOpen(false);
      load();
    } catch (error: any) {
      console.error('Error bulk deleting templates:', error);
      enqueueSnackbar(error.message || t('messageTemplates.bulkDeleteFailed'), { variant: 'error' });
    }
  }, [selectedIds, t, enqueueSnackbar, load]);

  // 일괄 사용 가능/불가 변경
  const handleBulkToggleAvailability = useCallback(async (isEnabled: boolean) => {
    if (selectedIds.length === 0) return;

    try {
      await Promise.all(selectedIds.map(async (id) => {
        const template = items.find(item => item.id === id);
        if (template) {
          await messageTemplateService.update(id, { ...template, isEnabled });
        }
      }));

      enqueueSnackbar(
        t('messageTemplates.bulkUpdateSuccess', {
          count: selectedIds.length,
          status: isEnabled ? t('common.available') : t('common.unavailable')
        }),
        { variant: 'success' }
      );
      setSelectedIds([]);
      setSelectAll(false);
      load();
    } catch (error: any) {
      console.error('Error bulk updating templates:', error);
      enqueueSnackbar(error.message || t('messageTemplates.bulkUpdateFailed'), { variant: 'error' });
    }
  }, [selectedIds, items, t, enqueueSnackbar, load]);

  // 개별 삭제
  const openDeleteDialog = useCallback((template: MessageTemplate) => {
    setDeletingTemplate(template);
    setDeleteDialogOpen(true);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deletingTemplate?.id) return;

    try {
      await messageTemplateService.delete(deletingTemplate.id);
      enqueueSnackbar(t('common.deleteSuccess'), { variant: 'success' });
      setDeleteDialogOpen(false);
      setDeletingTemplate(null);
      load();
    } catch (error: any) {
      console.error('Error deleting template:', error);
      enqueueSnackbar(error.message || t('common.deleteFailed'), { variant: 'error' });
    }
  }, [deletingTemplate, t, enqueueSnackbar, load]);

  const handleAdd = () => {
    setEditing(null);
    setForm({ name: '', type: 'maintenance', isEnabled: true, supportsMultiLanguage: false, defaultMessage: '', locales: [], tags: [] });
    setDialogOpen(true);
  };

  const handleEdit = (row: MessageTemplate) => {
    setEditing(row);
    setForm({
      id: row.id,
      name: row.name,
      type: row.type,
      isEnabled: Boolean((row as any).isEnabled),
      supportsMultiLanguage: Boolean((row as any).supportsMultiLanguage),
      defaultMessage: (row as any).defaultMessage || '',
      locales: row.locales || [],
      tags: row.tags || []
    });
    setDialogOpen(true);
  };

  // 태그 관련 핸들러
  const handleOpenTagDialog = useCallback(async (template: MessageTemplate) => {
    try {
      setSelectedTemplateForTags(template);
      const tags = await messageTemplateService.getTags(template.id!);
      setTemplateTags(tags);
      setTagDialogOpen(true);
    } catch (error) {
      console.error('Error loading template tags:', error);
      enqueueSnackbar(t('common.error'), { variant: 'error' });
    }
  }, [t, enqueueSnackbar]);

  const handleSaveTags = useCallback(async (tagIds: number[]) => {
    if (!selectedTemplateForTags?.id) return;

    try {
      await messageTemplateService.setTags(selectedTemplateForTags.id, tagIds);
      setTagDialogOpen(false);
      enqueueSnackbar(t('common.success'), { variant: 'success' });
      // 필요시 목록 새로고침
      load();
    } catch (error) {
      console.error('Error saving template tags:', error);
      enqueueSnackbar(t('common.error'), { variant: 'error' });
    }
  }, [selectedTemplateForTags, t, enqueueSnackbar, load]);



  const handleSave = async () => {
    if (!form.name.trim()) {
      enqueueSnackbar(t('common.nameRequired'), { variant: 'error' });
      nameFieldRef.current?.focus();
      return;
    }

    if (!form.defaultMessage?.trim()) {
      enqueueSnackbar(t('common.defaultMessageRequired'), { variant: 'error' });
      defaultMessageFieldRef.current?.focus();
      return;
    }

    setSaving(true);
    try {
      const payload: MessageTemplate = {
        name: form.name.trim(),
        type: form.type,
        isEnabled: !!form.isEnabled,
        supportsMultiLanguage: !!form.supportsMultiLanguage,
        defaultMessage: form.defaultMessage || null,
        locales: form.locales,
      };

      let templateId: number;

      if (editing?.id) {
        await messageTemplateService.update(editing.id, payload);
        templateId = editing.id;
        enqueueSnackbar(t('common.updateSuccess'), { variant: 'success' });
      } else {
        const created = await messageTemplateService.create(payload);
        templateId = created?.id || (created as any)?.data?.id || (created as any)?.insertId;

        if (!templateId) {
          throw new Error(t('common.cannotGetTemplateId'));
        }
        enqueueSnackbar(t('common.createSuccess'), { variant: 'success' });
      }

      // 태그 설정
      if (form.tags && form.tags.length > 0) {
        await messageTemplateService.setTags(templateId, form.tags.map(tag => tag.id));
      } else {
        // 태그가 없으면 기존 태그 모두 제거
        await messageTemplateService.setTags(templateId, []);
      }

      setDialogOpen(false);
      await load();
    } catch (error: any) {
      // Handle duplicate name error - 두 가지 오류 구조 모두 처리
      const status = error?.response?.status || error?.status;
      const errorData = error?.response?.data?.error || error?.error;

      if (status === 409) {
        if (errorData?.code === 'DUPLICATE_NAME') {
          const templateName = errorData?.value || form.name;
          enqueueSnackbar(t('common.duplicateNameErrorWithValue', { name: templateName }), { variant: 'error' });
        } else {
          enqueueSnackbar(t('common.duplicateNameError'), { variant: 'error' });
        }
      } else {
        const message = error?.response?.data?.error?.message || error?.error?.message || error?.message || t('common.saveFailed');
        enqueueSnackbar(message, { variant: 'error' });
      }
    } finally {
      setSaving(false);
    }
  };

  // Column handlers
  const handleToggleColumnVisibility = (columnId: string) => {
    const newColumns = columns.map(col =>
      col.id === columnId ? { ...col, visible: !col.visible } : col
    );
    setColumns(newColumns);
    localStorage.setItem('messageTemplatesColumns', JSON.stringify(newColumns));
  };

  const handleResetColumns = () => {
    setColumns(defaultColumns);
    localStorage.setItem('messageTemplatesColumns', JSON.stringify(defaultColumns));
  };

  const handleColumnDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = columns.findIndex((col) => col.id === active.id);
      const newIndex = columns.findIndex((col) => col.id === over.id);
      const newColumns = arrayMove(columns, oldIndex, newIndex);
      setColumns(newColumns);
      localStorage.setItem('messageTemplatesColumns', JSON.stringify(newColumns));
    }
  };

  const renderCellContent = (template: MessageTemplate, columnId: string) => {
    switch (columnId) {
      case 'name':
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 500,
                cursor: 'pointer',
                '&:hover': {
                  color: 'primary.main',
                  textDecoration: 'underline'
                }
              }}
              onClick={() => handleEdit(template)}
            >
              {template.name}
            </Typography>
            <Tooltip title={t('common.copy')}>
              <IconButton size="small" onClick={() => copyWithToast(template.name, t('messageTemplates.name'), false)}>
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        );
      case 'type':
        return <Chip label={t(`messageTemplates.types.${template.type}`)} size="small" color="primary" variant="outlined" />;
      case 'defaultMessage':
        return (
          <Typography variant="body2" sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {template.defaultMessage || '-'}
          </Typography>
        );
      case 'isEnabled':
        return <Chip label={template.isEnabled ? t('common.enabled') : t('common.disabled')} size="small" color={template.isEnabled ? 'success' : 'default'} />;
      case 'tags':
        return (
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {template.tags && template.tags.length > 0 ? (
              template.tags.map((tag) => (
                <Chip key={tag.id} label={tag.name} size="small" sx={{ bgcolor: tag.color, color: '#fff' }} />
              ))
            ) : (
              <Typography variant="body2" color="text.secondary">-</Typography>
            )}
          </Box>
        );
      case 'createdAt':
        return <Typography variant="body2">{formatDateTimeDetailed(template.createdAt)}</Typography>;
      default:
        return null;
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <TextFieldsIcon sx={{ fontSize: 32, color: 'primary.main' }} />
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {t('messageTemplates.title')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t('messageTemplates.subtitle')}
              </Typography>
            </Box>
          </Box>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
            {t('messageTemplates.addTemplate')}
          </Button>
        </Box>

      </Box>

      {/* 필터 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
              {/* 검색 컨트롤을 맨 앞으로 이동하고 개선 */}
              <TextField
                placeholder={t('messageTemplates.searchPlaceholderDetailed')}
                size="small"
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
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                      </InputAdornment>
                    ),
                  },
                }}
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

                {/* Column Settings Button */}
                <Tooltip title={t('users.columnSettings')}>
                  <IconButton
                    onClick={(e) => setColumnSettingsAnchor(e.currentTarget)}
                    sx={{
                      bgcolor: 'background.paper',
                      border: 1,
                      borderColor: 'divider',
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                  >
                    <ViewColumnIcon />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* 일괄 작업 툴바 */}
      {selectedIds.length > 0 && (
        <Card sx={{ mb: 2, bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(110, 168, 255, 0.08)' : 'rgba(25, 118, 210, 0.04)' }}>
          <CardContent sx={{ py: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'space-between' }}>
              <Typography variant="body2" color="primary" sx={{ fontWeight: 500 }}>
                {t('messageTemplates.selectedCount', { count: selectedIds.length })}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => handleBulkToggleAvailability(true)}
                  sx={{ minWidth: 'auto' }}
                >
                  {t('messageTemplates.makeAvailable')}
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => handleBulkToggleAvailability(false)}
                  sx={{ minWidth: 'auto' }}
                >
                  {t('messageTemplates.makeUnavailable')}
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  onClick={handleBulkDelete}
                  sx={{ minWidth: 'auto' }}
                >
                  {t('common.delete')}
                </Button>
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}

      <Card sx={{ position: 'relative' }}>
        <CardContent sx={{ p: 0 }}>
          <TableContainer
            sx={{
              opacity: !isInitialLoad && loading ? 0.5 : 1,
              transition: 'opacity 0.15s ease-in-out',
              pointerEvents: !isInitialLoad && loading ? 'none' : 'auto',
            }}
          >
            <Table sx={{ tableLayout: 'auto' }}>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectAll}
                      indeterminate={selectedIds.length > 0 && selectedIds.length < items.filter(item => item.id).length}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                    />
                  </TableCell>
                  {columns.filter(col => col.visible).map((column) => (
                    <TableCell key={column.id} width={column.width}>
                      {t(column.labelKey)}
                    </TableCell>
                  ))}
                  <TableCell align="right" sx={{ width: 100, minWidth: 100 }}>{t('common.actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isInitialLoad && loading ? (
                  // 스켈레톤 로딩 (초기 로딩 시에만)
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={`skeleton-${index}`}>
                      <TableCell padding="checkbox">
                        <Skeleton variant="rectangular" width={24} height={24} />
                      </TableCell>
                      {columns.filter(col => col.visible).map((column) => (
                        <TableCell key={column.id}>
                          <Skeleton variant="text" width="80%" />
                        </TableCell>
                      ))}
                      <TableCell align="right">
                        <Skeleton variant="circular" width={32} height={32} sx={{ display: 'inline-block', mr: 0.5 }} />
                        <Skeleton variant="circular" width={32} height={32} sx={{ display: 'inline-block' }} />
                      </TableCell>
                    </TableRow>
                  ))
                ) : items.length === 0 ? (
                  <EmptyTableRow
                    colSpan={columns.filter(col => col.visible).length + 2}
                    loading={loading}
                    message={t('messageTemplates.noTemplatesFound')}
                    loadingMessage={t('common.loadingData')}
                  />
                ) : (
                  items.map(row => (
                    <TableRow key={row.id} hover>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedIds.includes(row.id!)}
                          onChange={(e) => handleSelectItem(row.id!, e.target.checked)}
                          disabled={!row.id}
                        />
                      </TableCell>
                      {columns.filter(col => col.visible).map((column) => (
                        <TableCell key={column.id}>
                          {renderCellContent(row, column.id)}
                        </TableCell>
                      ))}
                      <TableCell align="right">
                        <IconButton size="small" onClick={() => handleEdit(row)}><EditIcon fontSize="small" /></IconButton>
                        <IconButton size="small" color="error" onClick={() => openDeleteDialog(row)}><DeleteIcon fontSize="small" /></IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* 페이지네이션 - 데이터가 있을 때만 표시 */}
      {total > 0 && (
        <SimplePagination
          count={total}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={handlePageChange}
          onRowsPerPageChange={handleRowsPerPageChange}
        />
      )}

      <Drawer
        anchor="right"
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        sx={{
          zIndex: 1300,
          '& .MuiDrawer-paper': {
            width: { xs: '100%', sm: 600 },
            maxWidth: '100vw',
            display: 'flex',
            flexDirection: 'column'
          }
        }}
        ModalProps={{
          keepMounted: false
        }}
        SlideProps={{
          onEntered: () => {
            // Drawer가 열린 후 이름 필드에 포커스
            setTimeout(() => {
              nameFieldRef.current?.focus();
            }, 100);
          }
        }}
      >
        {/* Header */}
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper'
        }}>
          <Box>
            <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
              {editing ? t('messageTemplates.editTitle') : t('messageTemplates.addTitle')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {editing
                ? t('messageTemplates.editDescription')
                : t('messageTemplates.addDescription')
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
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label={t('common.name')}
              value={form.name}
              onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
              fullWidth
              required
              inputRef={nameFieldRef}
            />
            <FormControlLabel
              control={<Switch checked={form.isEnabled} onChange={(e) => setForm(prev => ({ ...prev, isEnabled: e.target.checked }))} />}
              label={t('messageTemplates.availability')}
            />
            {/* 다국어 메시지 입력 컴포넌트 */}
            <MultiLanguageMessageInput
              defaultMessage={form.defaultMessage || ''}
              onDefaultMessageChange={(message) => setForm(prev => ({ ...prev, defaultMessage: message }))}
              defaultMessageLabel={t('messageTemplates.defaultMessage')}
              defaultMessageHelperText={t('messageTemplates.defaultMessageHelp')}
              defaultMessageRequired={true}
              defaultMessageError={false}

              supportsMultiLanguage={form.supportsMultiLanguage || false}
              onSupportsMultiLanguageChange={(supports) => setForm(prev => ({ ...prev, supportsMultiLanguage: supports }))}
              supportsMultiLanguageLabel={t('messageTemplates.supportsMultiLanguage')}
              supportsMultiLanguageHelperText={t('messageTemplates.supportsMultiLanguageHelp')}

              locales={(form.locales || []).map(l => ({ lang: l.lang as 'ko' | 'en' | 'zh', message: l.message }))}
              onLocalesChange={(locales) => {
                setForm(prev => ({ ...prev, locales: locales.map(l => ({ lang: l.lang, message: l.message })) }));
                // 번역 결과가 있으면 자동으로 다국어 지원 활성화
                const hasNonEmptyLocales = locales.some(l => l.message && l.message.trim() !== '');
                if (hasNonEmptyLocales && !form.supportsMultiLanguage) {
                  setForm(prev => ({ ...prev, supportsMultiLanguage: true }));
                }
              }}
              languageSpecificMessagesLabel={t('messageTemplates.languageSpecificMessages')}

              enableTranslation={true}
              translateButtonLabel={t('common.autoTranslate')}
              translateTooltip={t('maintenance.translateTooltip')}
            />

            {/* 태그 선택 */}
            <TextField
              select
              multiple
              label={t('common.tags')}
              value={form.tags?.map(tag => tag.id) || []}
              onChange={(e) => {
                const selectedIds = Array.isArray(e.target.value) ? e.target.value : [e.target.value];
                const selectedTags = allTags.filter(tag => selectedIds.includes(tag.id));
                setForm(prev => ({ ...prev, tags: selectedTags }));
              }}
              SelectProps={{
                multiple: true,
                MenuProps: {
                  PaperProps: {
                    style: {
                      zIndex: 99999
                    }
                  }
                },
                renderValue: (selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {(selected as number[]).map((id) => {
                      const tag = allTags.find(t => t.id === id);
                      return tag ? (
                        <Chip
                          key={id}
                          label={tag.name}
                          size="small"
                          sx={{ bgcolor: tag.color, color: '#fff' }}
                        />
                      ) : null;
                    })}
                  </Box>
                ),
              }}
              helperText="메시지 템플릿에 적용할 태그를 선택하세요"
            >
              {allTags.map((tag) => (
                <MenuItem key={tag.id} value={tag.id}>
                  <Chip
                    label={tag.name}
                    size="small"
                    sx={{ bgcolor: tag.color, color: '#fff', mr: 1 }}
                  />
                  {tag.description || '설명 없음'}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </Box>

        {/* Footer */}
        <Box sx={{
          p: 2,
          borderTop: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          display: 'flex',
          gap: 2,
          justifyContent: 'flex-end'
        }}>
          <Button
            onClick={() => setDialogOpen(false)}
            disabled={saving}
            startIcon={<CancelIcon />}
            variant="outlined"
          >
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
          >
            {saving ? t('common.saving') : t('common.save')}
          </Button>
        </Box>
      </Drawer>

      {/* 개별 삭제 확인 Drawer */}
      <Drawer
        anchor="right"
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        sx={{
          zIndex: 1301,
          '& .MuiDrawer-paper': {
            width: { xs: '100%', sm: 400 },
            maxWidth: '100vw',
            display: 'flex',
            flexDirection: 'column'
          }
        }}
      >
        {/* Header */}
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper'
        }}>
          <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
            {t('common.confirmDelete')}
          </Typography>
          <IconButton
            onClick={() => setDeleteDialogOpen(false)}
            size="small"
            sx={{
              '&:hover': {
                backgroundColor: 'action.hover'
              }
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, p: 2 }}>
          <Typography>
            {t('messageTemplates.confirmDelete', { name: deletingTemplate?.name })}
          </Typography>
        </Box>

        {/* Footer */}
        <Box sx={{
          p: 2,
          borderTop: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          display: 'flex',
          gap: 2,
          justifyContent: 'flex-end'
        }}>
          <Button
            onClick={() => setDeleteDialogOpen(false)}
            variant="outlined"
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={confirmDelete}
            color="error"
            variant="contained"
            startIcon={<DeleteIcon />}
          >
            {t('common.delete')}
          </Button>
        </Box>
      </Drawer>

      {/* 일괄 삭제 확인 Drawer */}
      <Drawer
        anchor="right"
        open={bulkDeleteDialogOpen}
        onClose={() => setBulkDeleteDialogOpen(false)}
        sx={{
          zIndex: 1301,
          '& .MuiDrawer-paper': {
            width: { xs: '100%', sm: 400 },
            maxWidth: '100vw',
            display: 'flex',
            flexDirection: 'column'
          }
        }}
      >
        {/* Header */}
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper'
        }}>
          <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
            {t('common.confirmDelete')}
          </Typography>
          <IconButton
            onClick={() => setBulkDeleteDialogOpen(false)}
            size="small"
            sx={{
              '&:hover': {
                backgroundColor: 'action.hover'
              }
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, p: 2 }}>
          <Typography>
            {t('messageTemplates.confirmBulkDelete', { count: selectedIds.length })}
          </Typography>
        </Box>

        {/* Footer */}
        <Box sx={{
          p: 2,
          borderTop: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          display: 'flex',
          gap: 2,
          justifyContent: 'flex-end'
        }}>
          <Button
            onClick={() => setBulkDeleteDialogOpen(false)}
            variant="outlined"
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={confirmBulkDelete}
            color="error"
            variant="contained"
            startIcon={<DeleteIcon />}
          >
            {t('common.delete')}
          </Button>
        </Box>
      </Drawer>

      {/* 태그 관리 다이얼로그 */}
      <Dialog open={tagDialogOpen} onClose={() => setTagDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {t('common.tags')} - {selectedTemplateForTags?.name}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <TextField
              select
              multiple
              label={t('common.selectTags')}
              value={templateTags.map(tag => tag.id)}
              onChange={(e) => {
                const selectedIds = Array.isArray(e.target.value) ? e.target.value : [e.target.value];
                const selectedTags = allTags.filter(tag => selectedIds.includes(tag.id));
                setTemplateTags(selectedTags);
              }}
              SelectProps={{
                multiple: true,
                MenuProps: {
                  PaperProps: {
                    style: {
                      zIndex: 99999
                    }
                  }
                },
                renderValue: (selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {(selected as number[]).map((id) => {
                      const tag = allTags.find(t => t.id === id);
                      return tag ? (
                        <Chip
                          key={id}
                          label={tag.name}
                          size="small"
                          sx={{ bgcolor: tag.color, color: '#fff' }}
                        />
                      ) : null;
                    })}
                  </Box>
                ),
              }}
              fullWidth
            >
              {allTags.map((tag) => (
                <MenuItem key={tag.id} value={tag.id}>
                  <Chip
                    label={tag.name}
                    size="small"
                    sx={{ bgcolor: tag.color, color: '#fff', mr: 1 }}
                  />
                  {tag.description || t('tags.noDescription')}
                </MenuItem>
              ))}
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTagDialogOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={() => handleSaveTags(templateTags.map(tag => tag.id))}
            variant="contained"
          >
            {t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Column Settings Popover */}
      <Popover
        open={Boolean(columnSettingsAnchor)}
        anchorEl={columnSettingsAnchor}
        onClose={() => setColumnSettingsAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        hideBackdrop
        disableScrollLock
      >
        <ClickAwayListener onClickAway={() => setColumnSettingsAnchor(null)}>
          <Box sx={{ p: 2, minWidth: 280, maxWidth: 320 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                {t('users.columnSettings')}
              </Typography>
              <Button size="small" onClick={handleResetColumns} color="warning">
                {t('common.reset')}
              </Button>
            </Box>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleColumnDragEnd}
              modifiers={[restrictToVerticalAxis]}
            >
              <SortableContext
                items={columns.map(col => col.id)}
                strategy={verticalListSortingStrategy}
              >
                <List dense disablePadding>
                  {columns.map((column) => (
                    <SortableColumnItem
                      key={column.id}
                      column={column}
                      onToggleVisibility={handleToggleColumnVisibility}
                    />
                  ))}
                </List>
              </SortableContext>
            </DndContext>
          </Box>
        </ClickAwayListener>
      </Popover>
    </Box>
  );
};

export default MessageTemplatesPage;
