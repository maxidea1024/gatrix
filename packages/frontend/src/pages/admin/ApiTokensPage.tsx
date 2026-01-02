import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  IconButton,
  Chip,
  TextField,
  FormControl,
  FormLabel,
  RadioGroup,
  Radio,
  FormControlLabel,
  Checkbox,
  Alert,
  Tooltip,
  Drawer,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Popover,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ClickAwayListener,
  Divider,
  InputAdornment,
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
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  ContentCopy as CopyIcon,
  VpnKey as VpnKeyIcon,
  Refresh as RefreshIcon,
  Cancel as CancelIcon,
  Save as SaveIcon,
  Close as CloseIcon,
  CheckCircle as CheckCircleIcon,
  Security as SecurityIcon,
  ViewColumn as ViewColumnIcon,
  DragIndicator as DragIndicatorIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, { Dayjs } from 'dayjs';
import 'dayjs/locale/ko';
import 'dayjs/locale/en';
import 'dayjs/locale/zh-cn';
import { ApiAccessToken, TokenType } from '@/types/apiToken';
import { apiTokenService } from '@/services/apiTokenService';
import { environmentService, Environment } from '@/services/environmentService';
import SimplePagination from '@/components/common/SimplePagination';
import EmptyTableRow from '@/components/common/EmptyTableRow';
import ResizableDrawer from '@/components/common/ResizableDrawer';
import { formatRelativeTime } from '@/utils/dateFormat';
import DynamicFilterBar, { FilterDefinition, ActiveFilter } from '@/components/common/DynamicFilterBar';
import { useI18n } from '@/contexts/I18nContext';
import { copyToClipboardWithNotification } from '@/utils/clipboard';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/types/permissions';

interface CreateTokenData {
  tokenName: string;
  description?: string;
  tokenType: TokenType;
  allowAllEnvironments: boolean;
  environments: string[];
  expiresAt?: string;
}

// Column definition interface
interface ColumnConfig {
  id: string;
  labelKey: string;
  visible: boolean;
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

// Default column configuration
const defaultColumns: ColumnConfig[] = [
  { id: 'tokenName', labelKey: 'apiTokens.tokenName', visible: true },
  { id: 'tokenType', labelKey: 'apiTokens.tokenType', visible: true },
  { id: 'environments', labelKey: 'apiTokens.environments', visible: true },
  { id: 'description', labelKey: 'apiTokens.description', visible: true },
  { id: 'usageCount', labelKey: 'apiTokens.usageCount', visible: true },
  { id: 'lastUsedAt', labelKey: 'apiTokens.lastUsedAt', visible: true },
  { id: 'expiresAt', labelKey: 'apiTokens.expiresAt', visible: true },
  { id: 'createdAt', labelKey: 'common.createdAt', visible: true },
];

// Helper function to get date locale
const getDateLocale = () => {
  const lang = localStorage.getItem('i18nextLng') || 'ko';
  if (lang.startsWith('ko')) return 'ko';
  if (lang.startsWith('zh')) return 'zh-cn';
  return 'en';
};

const ApiTokensPage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { language } = useI18n();
  const { hasPermission } = useAuth();

  // Check if user can manage (create/edit/delete) tokens
  const canManage = hasPermission([PERMISSIONS.SECURITY_MANAGE]);

  const [tokens, setTokens] = useState<ApiAccessToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Column settings state
  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    const saved = localStorage.getItem('apiTokensColumns');
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

  const columnSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Dynamic filter state
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [regenerateDialogOpen, setRegenerateDialogOpen] = useState(false);
  const [selectedToken, setSelectedToken] = useState<ApiAccessToken | null>(null);

  // Environment state
  const [environments, setEnvironments] = useState<Environment[]>([]);

  // Form states
  const [formData, setFormData] = useState<CreateTokenData>({
    tokenName: '',
    description: '',
    tokenType: 'client',
    allowAllEnvironments: false,
    environments: [],
  });

  // UI states
  const [newTokenValue, setNewTokenValue] = useState<string>('');
  const [newTokenInfo, setNewTokenInfo] = useState<any>(null);
  const [newTokenDialogOpen, setNewTokenDialogOpen] = useState<boolean>(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState<string>('');

  // Bulk selection states
  const [selectedTokenIds, setSelectedTokenIds] = useState<number[]>([]);
  const [selectAll, setSelectAll] = useState<boolean>(false);

  // Bulk delete states
  const [bulkDeleteDrawerOpen, setBulkDeleteDrawerOpen] = useState<boolean>(false);
  const [bulkDeleteConfirmText, setBulkDeleteConfirmText] = useState<string>('');

  // Regenerate confirmation state
  const [regenerateConfirmText, setRegenerateConfirmText] = useState<string>('');

  // Refs for focus management
  const tokenNameRef = useRef<HTMLInputElement>(null);
  const editTokenNameRef = useRef<HTMLInputElement>(null);
  const regenerateConfirmRef = useRef<HTMLInputElement>(null);
  const regenerateConfirmInputRef = useRef<HTMLInputElement>(null);

  // Column handlers
  const handleToggleColumnVisibility = (columnId: string) => {
    const newColumns = columns.map(col =>
      col.id === columnId ? { ...col, visible: !col.visible } : col
    );
    setColumns(newColumns);
    localStorage.setItem('apiTokensColumns', JSON.stringify(newColumns));
  };

  const handleResetColumns = () => {
    setColumns(defaultColumns);
    localStorage.removeItem('apiTokensColumns');
  };

  const handleColumnDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = columns.findIndex(col => col.id === active.id);
      const newIndex = columns.findIndex(col => col.id === over.id);
      const newColumns = arrayMove(columns, oldIndex, newIndex);
      setColumns(newColumns);
      localStorage.setItem('apiTokensColumns', JSON.stringify(newColumns));
    }
  };

  // Filter definitions
  const availableFilters: FilterDefinition[] = [
    {
      key: 'tokenType',
      label: t('apiTokens.tokenType'),
      type: 'select',
      options: [
        { value: 'client', label: t('apiTokens.types.client') },
        { value: 'server', label: t('apiTokens.types.server') },
      ],
    },
  ];

  // Filter handlers
  const handleFilterAdd = (filter: ActiveFilter) => {
    setActiveFilters([...activeFilters, filter]);
  };

  const handleFilterRemove = (filterKey: string) => {
    setActiveFilters(activeFilters.filter(f => f.key !== filterKey));
  };

  const handleFilterChange = (filterKey: string, value: any) => {
    setActiveFilters(activeFilters.map(f =>
      f.key === filterKey ? { ...f, value } : f
    ));
  };

  useEffect(() => {
    loadTokens();
  }, [page, rowsPerPage, sortBy, sortOrder, activeFilters]);

  // Load environments on mount
  useEffect(() => {
    const loadEnvironments = async () => {
      try {
        const envs = await environmentService.getEnvironments();
        setEnvironments(envs);
      } catch (error) {
        console.error('Failed to load environments:', error);
      }
    };
    loadEnvironments();
  }, []);

  const loadTokens = async () => {
    try {
      setLoading(true);

      // Build filter params
      const filterParams: any = {};
      activeFilters.forEach(filter => {
        if (filter.value !== undefined && filter.value !== null && filter.value !== '') {
          filterParams[filter.id] = filter.value;
        }
      });

      const response = await apiTokenService.getTokens({
        page: page + 1,
        limit: rowsPerPage,
        sortBy,
        sortOrder,
        ...filterParams,
      });
      setTokens(response.data || []);
      setTotal(response.total || 0);
    } catch (error) {
      console.error('Failed to load tokens:', error);
      enqueueSnackbar(t('apiTokens.loadFailed'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Render cell content based on column ID
  const renderCellContent = (token: ApiAccessToken, columnId: string) => {
    switch (columnId) {
      case 'tokenName':
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 500,
                cursor: 'pointer',
                '&:hover': {
                  color: 'primary.main',
                  textDecoration: 'underline',
                },
              }}
              onClick={() => openEditDialog(token)}
            >
              {token.tokenName}
            </Typography>
            <Tooltip title={t('apiTokens.copyTokenName')}>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  copyToClipboardWithNotification(
                    token.tokenName,
                    () => enqueueSnackbar(t('common.copiedToClipboard'), { variant: 'success' }),
                    () => enqueueSnackbar(t('common.copyFailed'), { variant: 'error' })
                  );
                }}
                sx={{ p: 0.5 }}
              >
                <CopyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        );
      case 'tokenType':
        return (
          <Tooltip
            title={t(token.tokenType === 'client' ? 'apiTokens.clientTokenDescription' : 'apiTokens.serverTokenDescription')}
            arrow
          >
            <Chip
              label={t(`apiTokens.types.${token.tokenType}`)}
              size="small"
              color={token.tokenType === 'server' ? 'primary' : 'success'}
              variant="filled"
            />
          </Tooltip>
        );
      case 'environments':
        if (token.allowAllEnvironments) {
          return (
            <Chip
              label={t('apiTokens.allEnvironments')}
              size="small"
              color="default"
              variant="outlined"
            />
          );
        }
        // Map environment names to environment objects from loaded environments
        const tokenEnvs = (token.environments || [])
          .map((envName: string) => environments.find(e => e.environment === envName))
          .filter(Boolean);
        return (
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {tokenEnvs.length > 0 ? (
              tokenEnvs.map((env) => (
                <Chip
                  key={env!.id}
                  label={env!.displayName || env!.environmentName}
                  size="small"
                  variant="outlined"
                  color="primary"
                />
              ))
            ) : (
              <Typography variant="body2" color="text.secondary">-</Typography>
            )}
          </Box>
        );
      case 'description':
        return (
          <Typography variant="body2" sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {token.description || '-'}
          </Typography>
        );
      case 'usageCount':
        return (
          <Typography variant="body2" sx={{ fontWeight: 500 }} color={!token.usageCount ? 'text.secondary' : 'text.primary'}>
            {token.usageCount ? token.usageCount.toLocaleString() : t('apiTokens.neverUsed')}
          </Typography>
        );
      case 'lastUsedAt':
        return (
          <Typography variant="body2">
            {token.lastUsedAt ? formatRelativeTime(token.lastUsedAt) : t('apiTokens.neverUsed')}
          </Typography>
        );
      case 'expiresAt':
        return (
          <Typography variant="body2">
            {token.expiresAt ? formatRelativeTime(token.expiresAt) : t('apiTokens.noExpiration')}
          </Typography>
        );
      case 'createdAt':
        return <Typography variant="body2">{formatRelativeTime(token.createdAt)}</Typography>;
      default:
        return null;
    }
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setPage(0); // Reset to first page when sorting
  };

  // 토큰 이름 유효성 검사
  const isValidTokenName = (name: string): boolean => {
    return name.trim().length >= 3; // 최소 3자 이상
  };

  // 유효기간 검증 함수
  const validateExpiresAt = (expiresAt: string | undefined): { isValid: boolean; warning: string | null } => {
    if (!expiresAt) {
      return { isValid: true, warning: null }; // No expiration is valid
    }

    const expiresDate = dayjs(expiresAt);
    const now = dayjs();
    const fiveMinutesFromNow = now.add(5, 'minute');

    if (expiresDate.isBefore(now)) {
      return { isValid: false, warning: t('apiTokens.expiresAtPastError') };
    }

    if (expiresDate.isBefore(fiveMinutesFromNow)) {
      return { isValid: false, warning: t('apiTokens.expiresAtTooSoonError') };
    }

    return { isValid: true, warning: null };
  };

  const expiresAtValidation = validateExpiresAt(formData.expiresAt);

  const handleCreate = async () => {
    try {
      const response = await apiTokenService.createToken(formData);
      console.log('Create token response:', response); // 디버깅용

      // 토큰 정보를 먼저 설정
      const tokenInfo = {
        tokenName: formData.tokenName,
        description: formData.description,
        tokenType: formData.tokenType,
        expiresAt: formData.expiresAt,
        allowAllEnvironments: formData.allowAllEnvironments,
        environments: formData.environments,
        isNew: true
      };

      // 생성 다이얼로그를 먼저 닫기
      setCreateDialogOpen(false);
      resetForm();

      // 백엔드 응답 구조 확인 및 토큰 값 추출
      const tokenValue = response?.data?.tokenValue || response?.tokenValue || '';
      console.log('Create response structure:', response); // 디버깅용
      console.log('Extracted token value:', tokenValue); // 디버깅용

      // 상태를 순서대로 설정하여 다이얼로그가 확실히 열리도록 함
      setNewTokenInfo(tokenInfo);
      setNewTokenValue(tokenValue);

      // 다음 렌더링 사이클에서 다이얼로그 열기
      setTimeout(() => {
        setNewTokenDialogOpen(true);
      }, 0);

      // 토큰 목록은 백그라운드에서 새로고침 (await 제거)
      loadTokens().catch(console.error);

      enqueueSnackbar(t('apiTokens.createSuccess'), { variant: 'success' });
    } catch (error: any) {
      console.error('Failed to create token:', error);
      enqueueSnackbar(error.message || t('apiTokens.createFailed'), { variant: 'error' });
    }
  };

  const handleEdit = async () => {
    if (!selectedToken) return;

    try {
      await apiTokenService.updateToken(selectedToken.id, {
        tokenName: formData.tokenName,
        description: formData.description,
        allowAllEnvironments: formData.allowAllEnvironments,
        environments: formData.allowAllEnvironments ? [] : formData.environments,
        expiresAt: formData.expiresAt,
      });
      await loadTokens();
      setEditDialogOpen(false);
      setSelectedToken(null);
      resetForm();
      enqueueSnackbar(t('apiTokens.updateSuccess'), { variant: 'success' });
    } catch (error: any) {
      console.error('Failed to update token:', error);
      enqueueSnackbar(error.message || t('apiTokens.updateFailed'), { variant: 'error' });
    }
  };

  const handleDelete = async () => {
    if (!selectedToken) return;

    // Check if the confirmation text matches the token name
    if (deleteConfirmText !== selectedToken.tokenName) {
      enqueueSnackbar(t('apiTokens.deleteConfirmMismatch'), { variant: 'error' });
      return;
    }

    try {
      await apiTokenService.deleteToken(selectedToken.id);
      await loadTokens();
      setDeleteDialogOpen(false);
      setSelectedToken(null);
      setDeleteConfirmText('');
      enqueueSnackbar(t('apiTokens.deleteSuccess'), { variant: 'success' });
    } catch (error: any) {
      console.error('Failed to delete token:', error);
      enqueueSnackbar(error.message || t('apiTokens.deleteFailed'), { variant: 'error' });
    }
  };

  const handleRegenerate = async () => {
    if (!selectedToken) return;

    try {
      const response = await apiTokenService.regenerateToken(selectedToken.id);
      console.log('Regenerate token response:', response); // 디버깅용

      // 백엔드 응답 구조 확인 및 토큰 값 추출
      const tokenValue = response?.data?.tokenValue || response?.tokenValue || '';
      console.log('Regenerate response structure:', response); // 디버깅용
      console.log('Extracted token value:', tokenValue); // 디버깅용

      const tokenInfo = {
        tokenName: selectedToken.tokenName,
        description: selectedToken.description,
        tokenType: selectedToken.tokenType,
        expiresAt: selectedToken.expiresAt,
        isNew: false
      };

      // 상태를 순서대로 설정하여 다이얼로그가 확실히 열리도록 함
      setNewTokenInfo(tokenInfo);
      setNewTokenValue(tokenValue);

      // 다음 렌더링 사이클에서 다이얼로그 열기
      setTimeout(() => {
        setNewTokenDialogOpen(true);
      }, 0);
      setRegenerateDialogOpen(false);
      setSelectedToken(null);
      setRegenerateConfirmText('');
      loadTokens();
      enqueueSnackbar(t('apiTokens.regenerateSuccess'), { variant: 'success' });
    } catch (error: any) {
      console.error('Failed to regenerate token:', error);
      enqueueSnackbar(error.message || t('apiTokens.regenerateFailed'), { variant: 'error' });
    }
  };

  const resetForm = () => {
    setFormData({
      tokenName: '',
      description: '',
      tokenType: 'client',
      allowAllEnvironments: false,
      environments: [],
    });
  };

  const openCreateDialog = () => {
    resetForm();
    setCreateDialogOpen(true);
    // Focus on token name field after dialog opens
    setTimeout(() => {
      tokenNameRef.current?.focus();
    }, 100);
  };

  const openEditDialog = (token: ApiAccessToken) => {
    setSelectedToken(token);
    setFormData({
      tokenName: token.tokenName,
      description: token.description || '',
      tokenType: token.tokenType,
      allowAllEnvironments: token.allowAllEnvironments ?? false,
      environments: token.environments || [],
      expiresAt: token.expiresAt ? new Date(token.expiresAt).toISOString().slice(0, 16) : undefined,
    });
    setEditDialogOpen(true);
    // Focus on token name field after dialog opens
    setTimeout(() => {
      editTokenNameRef.current?.focus();
    }, 100);
  };

  const openDeleteDialog = (token: ApiAccessToken) => {
    setSelectedToken(token);
    setDeleteConfirmText('');
    setDeleteDialogOpen(true);
  };

  const openRegenerateDialog = (token: ApiAccessToken) => {
    setSelectedToken(token);
    setRegenerateConfirmText('');
    setRegenerateDialogOpen(true);
    // Focus on confirm input field after dialog opens
    setTimeout(() => {
      if (regenerateConfirmRef.current) {
        // Try to focus on the actual input element inside TextField
        const inputElement = regenerateConfirmRef.current.querySelector('input');
        if (inputElement) {
          inputElement.focus();
        } else {
          // Fallback to the TextField itself
          regenerateConfirmRef.current.focus();
        }
      }
    }, 300);
  };

  const closeRegenerateDialog = () => {
    setRegenerateDialogOpen(false);
    setRegenerateConfirmText('');
    setSelectedToken(null);
  };



  const copyToClipboard = async (text: string) => {
    console.log('[ApiTokensPage] copyToClipboard called, text length:', text.length);
    await copyToClipboardWithNotification(
      text,
      () => {
        console.log('[ApiTokensPage] Copy success callback');
        enqueueSnackbar(t('common.copiedToClipboard'), { variant: 'success' });
      },
      () => {
        console.log('[ApiTokensPage] Copy error callback');
        enqueueSnackbar(t('common.copyFailed'), { variant: 'error' });
      }
    );
  };

  const copyTokenValue = async (token: ApiAccessToken) => {
    console.log('[ApiTokensPage] copyTokenValue called, token:', token);
    // Use tokenValue only (original token for copying)
    const tokenToCopy = (token as any).tokenValue;
    console.log('[ApiTokensPage] tokenToCopy:', tokenToCopy ? `${tokenToCopy.substring(0, 10)}...` : 'EMPTY');
    if (!tokenToCopy) {
      console.error('[ApiTokensPage] No token value found');
      enqueueSnackbar(t('apiTokens.tokenValueError'), { variant: 'error' });
      return;
    }
    await copyToClipboardWithNotification(
      tokenToCopy,
      () => {
        console.log('[ApiTokensPage] Token copy success callback');
        enqueueSnackbar(t('common.copiedToClipboard'), { variant: 'success' });
      },
      () => {
        console.log('[ApiTokensPage] Token copy error callback');
        enqueueSnackbar(t('common.copyFailed'), { variant: 'error' });
      }
    );
  };

  const maskToken = (token: string) => {
    if (!token || token.length < 8) return token;
    return `${token.substring(0, 4)}${'•'.repeat(token.length - 8)}${token.substring(token.length - 4)}`;
  };

  // Bulk selection handlers
  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      setSelectedTokenIds(tokens.map(token => token.id));
    } else {
      setSelectedTokenIds([]);
    }
  };

  const handleSelectToken = (tokenId: number, checked: boolean) => {
    if (checked) {
      setSelectedTokenIds(prev => [...prev, tokenId]);
    } else {
      setSelectedTokenIds(prev => prev.filter(id => id !== tokenId));
      setSelectAll(false);
    }
  };

  // Update selectAll state when individual selections change
  React.useEffect(() => {
    if (tokens.length > 0 && selectedTokenIds.length === tokens.length) {
      setSelectAll(true);
    } else {
      setSelectAll(false);
    }
  }, [selectedTokenIds, tokens]);



  // Bulk actions
  const handleBulkDelete = () => {
    setBulkDeleteDrawerOpen(true);
  };

  const confirmBulkDelete = async () => {
    try {
      setLoading(true);

      // Delete selected tokens
      for (const tokenId of selectedTokenIds) {
        await apiTokenService.deleteToken(tokenId);
      }

      enqueueSnackbar(t('apiTokens.bulkDeleteSuccess'), { variant: 'success' });

      // Reset states
      setSelectedTokenIds([]);
      setSelectAll(false);
      setBulkDeleteDrawerOpen(false);
      setBulkDeleteConfirmText('');

      // Reload tokens
      await loadTokens();
    } catch (error) {
      console.error('Bulk delete failed:', error);
      enqueueSnackbar(t('apiTokens.bulkDeleteFailed'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const closeBulkDeleteDrawer = () => {
    setBulkDeleteDrawerOpen(false);
    setBulkDeleteConfirmText('');
  };



  const getTokenTypeColor = (type: TokenType) => {
    switch (type) {
      case 'admin': return 'error';
      case 'server': return 'warning';
      case 'client': return 'primary';
      default: return 'default';
    }
  };

  // Filter tokens based on debounced search term
  const filteredTokens = React.useMemo(() => {
    if (!debouncedSearchTerm.trim()) return tokens;

    const lowerSearch = debouncedSearchTerm.toLowerCase();
    return tokens.filter(token =>
      token.tokenName.toLowerCase().includes(lowerSearch) ||
      (token.description && token.description.toLowerCase().includes(lowerSearch)) ||
      token.tokenType.toLowerCase().includes(lowerSearch)
    );
  }, [tokens, debouncedSearchTerm]);

  return (
    <>
      <Box sx={{ p: 3 }}>
        {/* Header */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <VpnKeyIcon sx={{ fontSize: 32, color: 'primary.main' }} />
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {t('apiTokens.title')}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('apiTokens.subtitle')}
                </Typography>
              </Box>
            </Box>
            {canManage && (
              <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}>
                {t('apiTokens.createToken')}
              </Button>
            )}
          </Box>
        </Box>



        {/* Bulk Actions */}
        {canManage && selectedTokenIds.length > 0 && (
          <Box sx={{
            mb: 2,
            p: 2,
            bgcolor: 'action.hover',
            borderRadius: 1,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <Typography variant="body2" color="text.secondary">
              {t('common.selectedItems', { count: selectedTokenIds.length })}
            </Typography>
            <Button
              variant="outlined"
              color="error"
              size="small"
              startIcon={<DeleteIcon />}
              onClick={handleBulkDelete}
            >
              {t('apiTokens.bulkDelete')}
            </Button>
          </Box>
        )}

        {/* Filter and Column Settings */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Search */}
              <TextField
                placeholder={t('apiTokens.searchPlaceholder')}
                size="small"
                sx={{
                  minWidth: 450,
                  flexGrow: 1,
                  maxWidth: 450,
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
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                    </InputAdornment>
                  ),
                }}
              />

              {/* Column Settings Button */}
              <Tooltip title={t('common.columnSettings')}>
                <IconButton
                  onClick={(e) => setColumnSettingsAnchor(e.currentTarget)}
                  sx={{
                    ml: 1,
                    bgcolor: 'background.paper',
                    border: 1,
                    borderColor: 'divider',
                    '&:hover': {
                      bgcolor: 'action.hover',
                    },
                  }}
                >
                  <ViewColumnIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </CardContent>
        </Card>

        {/* Tokens Table */}
        <Paper sx={{ width: '100%', overflow: 'hidden' }}>
          <TableContainer>
            <Table stickyHeader sx={{ tableLayout: 'auto' }}>
              <TableHead>
                <TableRow>
                  {canManage && (
                    <TableCell padding="checkbox" sx={{ width: 50 }}>
                      <Checkbox
                        checked={selectAll}
                        indeterminate={selectedTokenIds.length > 0 && selectedTokenIds.length < filteredTokens.length}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        disabled={filteredTokens.length === 0}
                      />
                    </TableCell>
                  )}
                  {columns.filter(col => col.visible).map((column) => (
                    <TableCell key={column.id}>
                      {t(column.labelKey)}
                    </TableCell>
                  ))}
                  <TableCell align="center" sx={{ width: 150 }}>{t('common.actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {!filteredTokens || filteredTokens.length === 0 ? (
                  <EmptyTableRow
                    colSpan={columns.filter(col => col.visible).length + (canManage ? 2 : 1)}
                    loading={loading}
                    message={searchTerm ? t('common.noSearchResults') : t('apiTokens.noTokens')}
                    loadingMessage={t('common.loadingData')}
                    subtitle={canManage && !searchTerm ? t('common.addFirstItem') : undefined}
                    onAddClick={canManage && !searchTerm ? openCreateDialog : undefined}
                    addButtonLabel={t('apiTokens.createToken')}
                  />
                ) : (
                  filteredTokens.map((token) => (
                    <TableRow key={token.id} hover selected={selectedTokenIds.includes(token.id)}>
                      {canManage && (
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={selectedTokenIds.includes(token.id)}
                            onChange={(e) => handleSelectToken(token.id, e.target.checked)}
                          />
                        </TableCell>
                      )}
                      {columns.filter(col => col.visible).map((column) => (
                        <TableCell key={column.id}>
                          {renderCellContent(token, column.id)}
                        </TableCell>
                      ))}
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                          <Tooltip title={t('apiTokens.copyToken')}>
                            <IconButton size="small" onClick={async () => await copyTokenValue(token)}>
                              <CopyIcon />
                            </IconButton>
                          </Tooltip>
                          {canManage && (
                            <>
                              <Tooltip title={t('common.edit')}>
                                <IconButton size="small" onClick={() => openEditDialog(token)}>
                                  <EditIcon />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title={t('apiTokens.regenerateToken')}>
                                <IconButton size="small" onClick={() => openRegenerateDialog(token)}>
                                  <RefreshIcon />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title={t('common.delete')}>
                                <IconButton size="small" onClick={() => openDeleteDialog(token)}>
                                  <DeleteIcon />
                                </IconButton>
                              </Tooltip>
                            </>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Pagination */}
          {!loading && tokens.length > 0 && (
            <SimplePagination
              count={total}
              page={page}
              rowsPerPage={rowsPerPage}
              onPageChange={(_, newPage) => setPage(newPage)}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
              rowsPerPageOptions={[5, 10, 25, 50]}
            />
          )}
        </Paper>
      </Box>

      {/* Create Token Side Panel */}
      <ResizableDrawer
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        title={t('apiTokens.createToken')}
        subtitle={t('apiTokens.createTokenSubtitle')}
        storageKey="apiTokenCreateDrawerWidth"
        defaultWidth={550}
        minWidth={450}
        zIndex={1301}
        onEntered={() => tokenNameRef.current?.focus()}
      >
        {/* Content */}
        <Box sx={{
          flex: 1,
          p: 3,
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 3
        }}>
          {/* Basic Information Section */}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600, color: 'primary.main' }}>
              {t('apiTokens.basicInfoSection')}
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                inputRef={tokenNameRef}
                label={t('apiTokens.tokenName')}
                value={formData.tokenName}
                onChange={(e) => setFormData(prev => ({ ...prev, tokenName: e.target.value }))}
                fullWidth
                required
                size="small"
                error={formData.tokenName.length > 0 && !isValidTokenName(formData.tokenName)}
                helperText={
                  formData.tokenName.length > 0 && !isValidTokenName(formData.tokenName)
                    ? t('apiTokens.tokenNameMinLength')
                    : t('apiTokens.tokenNameHelp')
                }
              />

              <TextField
                label={t('apiTokens.description')}
                value={formData.description || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                fullWidth
                multiline
                rows={2}
                size="small"
                placeholder={t('apiTokens.descriptionPlaceholder')}
              />
            </Box>
          </Paper>

          {/* Token Type Section */}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600, color: 'primary.main' }}>
              {t('apiTokens.tokenTypeSection')}
            </Typography>

            <FormControl component="fieldset" fullWidth>
              <FormLabel component="legend" sx={{ mb: 1, fontSize: '0.875rem', fontWeight: 500 }}>
                {t('apiTokens.tokenTypeDescription')}
              </FormLabel>
              <RadioGroup
                value={formData.tokenType}
                onChange={(e) => setFormData(prev => ({ ...prev, tokenType: e.target.value as TokenType }))}
              >
                <FormControlLabel
                  value="client"
                  control={<Radio size="small" />}
                  label={
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {t('apiTokens.clientTokenType')}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t('apiTokens.clientTokenDescription')}
                      </Typography>
                    </Box>
                  }
                />
                <FormControlLabel
                  value="server"
                  control={<Radio size="small" />}
                  label={
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {t('apiTokens.serverTokenType')}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t('apiTokens.serverTokenDescription')}
                      </Typography>
                    </Box>
                  }
                />
                <FormControlLabel
                  value="all"
                  control={<Radio size="small" />}
                  label={
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500, color: 'warning.main' }}>
                        {t('apiTokens.allTokenType')}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t('apiTokens.allTokenDescription')}
                      </Typography>
                    </Box>
                  }
                />

              </RadioGroup>
              {formData.tokenType === 'all' && (
                <Alert severity="warning" sx={{ mt: 1, py: 0.5 }}>
                  <Typography variant="caption">
                    {t('apiTokens.allTokenWarning')}
                  </Typography>
                </Alert>
              )}
            </FormControl>

            {/* Environment Access - Only for non-edge tokens */}
            {formData.tokenType !== 'edge' && (
              <FormControl component="fieldset" fullWidth sx={{ mt: 2 }}>
                <FormLabel component="legend" sx={{ mb: 1, fontSize: '0.875rem', fontWeight: 500 }}>
                  {t('apiTokens.environmentAccess')}
                </FormLabel>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.allowAllEnvironments}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        allowAllEnvironments: e.target.checked,
                        environments: e.target.checked ? [] : prev.environments,
                      }))}
                      size="small"
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {t('apiTokens.allowAllEnvironments')}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t('apiTokens.allowAllEnvironmentsDescription')}
                      </Typography>
                    </Box>
                  }
                />
                {formData.allowAllEnvironments && (
                  <Alert severity="warning" sx={{ mt: 1, py: 0.5 }}>
                    {t('apiTokens.allowAllEnvironmentsWarning')}
                  </Alert>
                )}
                {!formData.allowAllEnvironments && (
                  <Box sx={{ mt: 1, pl: 4 }}>
                    {environments.map((env) => (
                      <FormControlLabel
                        key={env.id}
                        control={
                          <Checkbox
                            checked={formData.environments.includes(env.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData(prev => ({
                                  ...prev,
                                  environments: [...prev.environments, env.id],
                                }));
                              } else {
                                setFormData(prev => ({
                                  ...prev,
                                  environments: prev.environments.filter(id => id !== env.id),
                                }));
                              }
                            }}
                            size="small"
                          />
                        }
                        label={env.displayName || env.environmentName}
                      />
                    ))}
                  </Box>
                )}
              </FormControl>
            )}

            {/* Special Purpose Tokens Section */}
            <Divider sx={{ my: 2 }}>
              <Typography variant="caption" color="text.secondary">
                {t('apiTokens.specialPurposeTokens')}
              </Typography>
            </Divider>

            <FormControl component="fieldset" fullWidth>
              <RadioGroup
                value={formData.tokenType === 'edge' ? 'edge' : ''}
                onChange={(e) => {
                  if (e.target.value === 'edge') {
                    setFormData(prev => ({
                      ...prev,
                      tokenType: 'edge',
                      allowAllEnvironments: false,
                      environments: prev.environments.length > 0 ? [prev.environments[0]] : [],
                    }));
                  }
                }}
              >
                <FormControlLabel
                  value="edge"
                  control={<Radio size="small" />}
                  label={
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500, color: 'info.main' }}>
                        {t('apiTokens.edgeTokenType')}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t('apiTokens.edgeTokenDescription')}
                      </Typography>
                    </Box>
                  }
                />
              </RadioGroup>

              {/* Edge token environment selection - inline */}
              {formData.tokenType === 'edge' && (
                <Box sx={{ mt: 1, ml: 4, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {t('apiTokens.selectSingleEnvironment')}
                  </Typography>
                  <RadioGroup
                    value={formData.environments[0] || ''}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      allowAllEnvironments: false,
                      environments: [e.target.value],
                    }))}
                  >
                    {environments.map((env) => (
                      <FormControlLabel
                        key={env.id}
                        value={env.id}
                        control={<Radio size="small" />}
                        label={env.displayName || env.environmentName}
                      />
                    ))}
                  </RadioGroup>
                </Box>
              )}
            </FormControl>
          </Paper>

          {/* Expiration Section */}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600, color: 'primary.main' }}>
              {t('apiTokens.expirationSection')}
            </Typography>
            <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale={getDateLocale()}>
              <DateTimePicker
                label={t('apiTokens.expiresAt')}
                value={formData.expiresAt ? dayjs(formData.expiresAt) : null}
                onChange={(date) => setFormData(prev => ({ ...prev, expiresAt: date ? date.toISOString() : undefined }))}
                timeSteps={{ minutes: 1 }}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    size: 'small',
                    helperText: expiresAtValidation.warning || t('apiTokens.expiresAtHelp'),
                    error: !expiresAtValidation.isValid,
                    slotProps: { input: { readOnly: true } },
                  },
                  actionBar: {
                    actions: ['clear', 'cancel', 'accept'],
                  },
                }}
              />
            </LocalizationProvider>
            {!expiresAtValidation.isValid && (
              <Alert severity="error" sx={{ mt: 1, py: 0.5 }}>
                <Typography variant="caption">
                  {expiresAtValidation.warning}
                </Typography>
              </Alert>
            )}
          </Paper>
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
            onClick={() => setCreateDialogOpen(false)}
            startIcon={<CancelIcon />}
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleCreate}
            variant="contained"
            startIcon={<VpnKeyIcon />}
            disabled={
              !isValidTokenName(formData.tokenName) ||
              !expiresAtValidation.isValid ||
              // Edge token requires exactly one environment to be selected
              (formData.tokenType === 'edge' && formData.environments.length === 0)
            }
          >
            {t('apiTokens.createToken')}
          </Button>
        </Box>
      </ResizableDrawer>

      {/* Edit Token Side Panel */}
      <ResizableDrawer
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        title={t('apiTokens.editToken')}
        subtitle={t('apiTokens.editTokenSubtitle')}
        storageKey="apiTokenEditDrawerWidth"
        defaultWidth={550}
        minWidth={450}
        zIndex={1301}
        onEntered={() => editTokenNameRef.current?.focus()}
      >
        {/* Content */}
        <Box sx={{
          flex: 1,
          p: 3,
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 3
        }}>
          {/* Basic Information Section */}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600, color: 'primary.main' }}>
              {t('apiTokens.basicInfoSection')}
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                inputRef={editTokenNameRef}
                label={t('apiTokens.tokenName')}
                value={formData.tokenName}
                onChange={(e) => setFormData(prev => ({ ...prev, tokenName: e.target.value }))}
                fullWidth
                required
                size="small"
                error={formData.tokenName.length > 0 && !isValidTokenName(formData.tokenName)}
                helperText={
                  formData.tokenName.length > 0 && !isValidTokenName(formData.tokenName)
                    ? t('apiTokens.tokenNameMinLength')
                    : t('apiTokens.tokenNameHelp')
                }
              />

              <TextField
                label={t('apiTokens.description')}
                value={formData.description || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                fullWidth
                multiline
                rows={2}
                size="small"
                placeholder={t('apiTokens.descriptionPlaceholder')}
              />
            </Box>
          </Paper>

          {/* Token Type Section (Read-only) */}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600, color: 'primary.main' }}>
              {t('apiTokens.tokenTypeSection')}
            </Typography>
            <TextField
              label={t('apiTokens.tokenType')}
              value={t(`apiTokens.${formData.tokenType}TokenType`, formData.tokenType)}
              fullWidth
              size="small"
              disabled
              helperText={t('apiTokens.tokenTypeNotEditable')}
            />

            {/* Environment Access */}
            <FormControl component="fieldset" fullWidth sx={{ mt: 2 }}>
              <FormLabel component="legend" sx={{ mb: 1, fontSize: '0.875rem', fontWeight: 500 }}>
                {t('apiTokens.environmentAccess')}
              </FormLabel>
              {/* Edge tokens can only use single environment */}
              {selectedToken?.tokenType === 'edge' ? (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {t('apiTokens.selectSingleEnvironment')}
                  </Typography>
                  <RadioGroup
                    value={formData.environments[0] || ''}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      allowAllEnvironments: false,
                      environments: [e.target.value],
                    }))}
                  >
                    {environments.map((env) => (
                      <FormControlLabel
                        key={env.id}
                        value={env.id}
                        control={<Radio size="small" />}
                        label={env.displayName || env.environmentName}
                      />
                    ))}
                  </RadioGroup>
                </Box>
              ) : (
                <>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.allowAllEnvironments}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          allowAllEnvironments: e.target.checked,
                          environments: e.target.checked ? [] : prev.environments,
                        }))}
                        size="small"
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {t('apiTokens.allowAllEnvironments')}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {t('apiTokens.allowAllEnvironmentsDescription')}
                        </Typography>
                      </Box>
                    }
                  />
                  {formData.allowAllEnvironments && (
                    <Alert severity="warning" sx={{ mt: 1, py: 0.5 }}>
                      {t('apiTokens.allowAllEnvironmentsWarning')}
                    </Alert>
                  )}
                  {!formData.allowAllEnvironments && (
                    <Box sx={{ mt: 1, pl: 4 }}>
                      {environments.map((env) => (
                        <FormControlLabel
                          key={env.id}
                          control={
                            <Checkbox
                              checked={formData.environments.includes(env.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFormData(prev => ({
                                    ...prev,
                                    environments: [...prev.environments, env.id],
                                  }));
                                } else {
                                  setFormData(prev => ({
                                    ...prev,
                                    environments: prev.environments.filter(id => id !== env.id),
                                  }));
                                }
                              }}
                              size="small"
                            />
                          }
                          label={env.displayName || env.environmentName}
                        />
                      ))}
                    </Box>
                  )}
                </>
              )}
            </FormControl>
          </Paper>

          {/* Expiration Section */}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600, color: 'primary.main' }}>
              {t('apiTokens.expirationSection')}
            </Typography>
            <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale={getDateLocale()}>
              <DateTimePicker
                label={t('apiTokens.expiresAt')}
                value={formData.expiresAt ? dayjs(formData.expiresAt) : null}
                onChange={(date) => setFormData(prev => ({ ...prev, expiresAt: date ? date.toISOString() : undefined }))}
                timeSteps={{ minutes: 1 }}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    size: "small",
                    helperText: expiresAtValidation.warning || t('apiTokens.expiresAtHelp'),
                    error: !expiresAtValidation.isValid,
                    slotProps: { input: { readOnly: true } },
                  },
                  actionBar: {
                    actions: ['clear', 'cancel', 'accept'],
                  },
                }}
              />
            </LocalizationProvider>
            {!expiresAtValidation.isValid && (
              <Alert severity="error" sx={{ mt: 1, py: 0.5 }}>
                <Typography variant="caption">
                  {expiresAtValidation.warning}
                </Typography>
              </Alert>
            )}
          </Paper>
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
            onClick={() => setEditDialogOpen(false)}
            startIcon={<CancelIcon />}
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleEdit}
            variant="contained"
            startIcon={<SaveIcon />}
            disabled={!isValidTokenName(formData.tokenName) || !expiresAtValidation.isValid}
          >
            {t('common.save')}
          </Button>
        </Box>
      </ResizableDrawer>

      {/* Delete Confirmation Drawer */}
      <Drawer
        anchor="right"
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        sx={{
          zIndex: 1301,
          '& .MuiDrawer-paper': {
            width: { xs: '100%', sm: 500 },
            maxWidth: '100vw',
            display: 'flex',
            flexDirection: 'column'
          }
        }}
      >
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
          zIndex: 1301
        }}>
          <Typography variant="h6" component="h2" sx={{ fontWeight: 600, color: 'error.main' }}>
            {t('apiTokens.deleteToken')}
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

        <Box sx={{ p: 3, flexGrow: 1 }}>
          <Typography variant="body1" sx={{ mb: 3, fontWeight: 500 }}>
            {t('apiTokens.deleteConfirmation')}
          </Typography>

          {selectedToken && (
            <>
              <Box sx={{
                mb: 3,
                p: 3,
                bgcolor: 'background.paper',
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider'
              }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                  {t('apiTokens.tokenName')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {selectedToken.tokenName}
                </Typography>

                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                  {t('apiTokens.tokenType')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t(`apiTokens.types.${selectedToken.tokenType}`, selectedToken.tokenType)}
                </Typography>
              </Box>

              <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                {t('apiTokens.deleteConfirmInstruction')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                <strong>{selectedToken.tokenName}</strong>
              </Typography>

              <TextField
                fullWidth
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={t('apiTokens.deleteConfirmPlaceholder')}
                size="medium"
                error={deleteConfirmText.length > 0 && deleteConfirmText !== selectedToken.tokenName}
                helperText={
                  deleteConfirmText.length > 0 && deleteConfirmText !== selectedToken.tokenName
                    ? t('apiTokens.deleteConfirmMismatch')
                    : ''
                }
                sx={{ mb: 2 }}
              />
            </>
          )}
        </Box>

        <Box sx={{
          p: 3,
          borderTop: 1,
          borderColor: 'divider',
          display: 'flex',
          gap: 2,
          justifyContent: 'flex-end'
        }}>
          <Button
            onClick={() => setDeleteDialogOpen(false)}
            variant="outlined"
            startIcon={<CancelIcon />}
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleDelete}
            variant="contained"
            color="error"
            disabled={!selectedToken || deleteConfirmText !== selectedToken.tokenName}
            startIcon={<DeleteIcon />}
          >
            {t('common.delete')}
          </Button>
        </Box>
      </Drawer>

      {/* Regenerate Token Side Panel */}
      <Drawer
        anchor="right"
        open={regenerateDialogOpen}
        onClose={closeRegenerateDialog}
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
          zIndex: 1300
        }}>
          <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
            {t('apiTokens.regenerateToken')}
          </Typography>
          <IconButton
            onClick={closeRegenerateDialog}
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

        <Box sx={{ p: 3, flexGrow: 1 }}>
          <Alert severity="warning" sx={{ mb: 3 }}>
            {t('apiTokens.regenerateWarning')}
          </Alert>

          <Typography variant="body1" sx={{ mb: 3 }}>
            {t('apiTokens.regenerateConfirmation')}
          </Typography>

          {selectedToken && (
            <>
              <Box sx={{
                p: 3,
                bgcolor: 'background.default',
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                mb: 3
              }}>
                <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                  {selectedToken.tokenName}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {t(`apiTokens.${selectedToken.tokenType}TokenType`, selectedToken.tokenType)}
                </Typography>
                {selectedToken.description && (
                  <Typography variant="body2" color="text.secondary">
                    {selectedToken.description}
                  </Typography>
                )}
              </Box>

              {/* Confirmation Input */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                  {t('apiTokens.regenerateConfirmInstruction')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  <strong>{selectedToken.tokenName}</strong>
                </Typography>
                <TextField
                  fullWidth
                  ref={regenerateConfirmRef}
                  value={regenerateConfirmText}
                  onChange={(e) => setRegenerateConfirmText(e.target.value)}
                  placeholder={t('apiTokens.regenerateConfirmPlaceholder')}
                  size="medium"
                  error={regenerateConfirmText.length > 0 && regenerateConfirmText !== selectedToken.tokenName}
                  helperText={
                    regenerateConfirmText.length > 0 && regenerateConfirmText !== selectedToken.tokenName
                      ? t('apiTokens.regenerateConfirmMismatch')
                      : ''
                  }
                />
              </Box>
            </>
          )}
        </Box>

        <Box sx={{
          p: 3,
          borderTop: 1,
          borderColor: 'divider',
          display: 'flex',
          gap: 2,
          justifyContent: 'flex-end'
        }}>
          <Button
            onClick={closeRegenerateDialog}
            variant="outlined"
            startIcon={<CancelIcon />}
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleRegenerate}
            color="primary"
            variant="contained"
            startIcon={<RefreshIcon />}
            disabled={!selectedToken || regenerateConfirmText !== selectedToken.tokenName || loading}
          >
            {t('apiTokens.regenerate')}
          </Button>
        </Box>
      </Drawer>

      {/* Bulk Delete Confirmation Drawer */}
      <Drawer
        anchor="right"
        open={bulkDeleteDrawerOpen}
        onClose={closeBulkDeleteDrawer}
        sx={{
          zIndex: 1301,
          '& .MuiDrawer-paper': {
            width: { xs: '100%', sm: 400 },
            maxWidth: '100vw'
          }
        }}
      >
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
          position: 'sticky',
          top: 0,
          zIndex: 1300
        }}>
          <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
            {t('apiTokens.bulkDeleteConfirmation')}
          </Typography>
          <IconButton
            onClick={closeBulkDeleteDrawer}
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

        <Box sx={{ p: 3, flexGrow: 1 }}>
          <Alert severity="warning" sx={{ mb: 3 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
              {t('apiTokens.bulkDeleteWarning')}
            </Typography>
          </Alert>

          {/* Selected Tokens List */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
              {t('apiTokens.tokensToDelete', { count: selectedTokenIds.length })}:
            </Typography>
            <Box sx={{
              maxHeight: 200,
              overflowY: 'auto',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              p: 1
            }}>
              {tokens
                .filter(token => selectedTokenIds.includes(token.id))
                .map(token => (
                  <Box key={token.id} sx={{
                    p: 1.5,
                    mb: 1,
                    bgcolor: 'action.hover',
                    borderRadius: 1,
                    '&:last-child': { mb: 0 }
                  }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {token.tokenName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {token.tokenType} • {t('apiTokens.createdBy')}: {token.creator?.name || 'Unknown'}
                    </Typography>
                  </Box>
                ))
              }
            </Box>
          </Box>

          {/* Confirmation Input */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="body2" sx={{ mb: 2 }}>
              {t('apiTokens.bulkDeleteConfirmInstruction')}
            </Typography>
            <Typography variant="body2" sx={{
              mb: 2,
              p: 1,
              bgcolor: 'action.hover',
              borderRadius: 1,
              fontFamily: 'monospace',
              fontWeight: 600
            }}>
              {t('apiTokens.deleteSelectedTokensText')}
            </Typography>
            <TextField
              fullWidth
              value={bulkDeleteConfirmText}
              onChange={(e) => setBulkDeleteConfirmText(e.target.value)}
              placeholder={t('apiTokens.bulkDeleteConfirmPlaceholder')}
              variant="outlined"
              size="small"
            />
            {bulkDeleteConfirmText && bulkDeleteConfirmText !== t('apiTokens.deleteSelectedTokensText') && (
              <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
                {t('apiTokens.bulkDeleteConfirmMismatch')}
              </Typography>
            )}
          </Box>
        </Box>

        <Box sx={{
          p: 2,
          borderTop: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          gap: 2,
          justifyContent: 'flex-end'
        }}>
          <Button
            onClick={closeBulkDeleteDrawer}
            variant="outlined"
            startIcon={<CancelIcon />}
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={confirmBulkDelete}
            color="error"
            variant="contained"
            startIcon={<DeleteIcon />}
            disabled={bulkDeleteConfirmText !== t('apiTokens.deleteSelectedTokensText') || loading}
          >
            {t('apiTokens.bulkDelete')}
          </Button>
        </Box>
      </Drawer>

      {/* New Token Display Dialog */}
      <Dialog
        open={newTokenDialogOpen && !!newTokenInfo}
        onClose={() => { setNewTokenValue(''); setNewTokenInfo(null); setNewTokenDialogOpen(false); }}
        maxWidth="md"
        fullWidth
        sx={{
          '& .MuiDialog-paper': {
            maxWidth: '700px',
            width: '90%'
          }
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <CheckCircleIcon color="success" sx={{ fontSize: 32 }} />
            <Box>
              <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
                {newTokenInfo?.isNew
                  ? t('apiTokens.tokenCreated')
                  : t('apiTokens.tokenRegenerated')
                }
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>

          {/* Token Summary */}
          {newTokenInfo && (
            <Box sx={{
              mb: 3,
              p: 3,
              bgcolor: 'background.paper',
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: 'primary.main' }}>
                {t('apiTokens.tokenSummary')}
              </Typography>
              <Box sx={{ display: 'grid', gap: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                    {t('apiTokens.tokenName')}
                  </Typography>
                  <Chip label={newTokenInfo.tokenName} variant="outlined" size="small" />
                </Box>
                {newTokenInfo.description && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                      {t('apiTokens.description')}
                    </Typography>
                    <Typography variant="body2" fontWeight={500} sx={{ maxWidth: '60%', textAlign: 'right' }}>
                      {newTokenInfo.description}
                    </Typography>
                  </Box>
                )}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                    {t('apiTokens.tokenType')}
                  </Typography>
                  <Chip
                    label={t(`apiTokens.types.${newTokenInfo.tokenType}`, newTokenInfo.tokenType)}
                    color="primary"
                    size="small"
                  />
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                    {t('apiTokens.expiresAt')}
                  </Typography>
                  <Typography variant="body2" fontWeight={500}>
                    {newTokenInfo.expiresAt
                      ? formatRelativeTime(newTokenInfo.expiresAt)
                      : t('apiTokens.noExpiration')
                    }
                  </Typography>
                </Box>

                {/* Environment Access */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                    {t('apiTokens.environments')}
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, justifyContent: 'flex-end', maxWidth: '60%' }}>
                    {newTokenInfo.allowAllEnvironments ? (
                      <Chip
                        label={t('apiTokens.allEnvironments')}
                        size="small"
                        color="success"
                      />
                    ) : newTokenInfo.environments && newTokenInfo.environments.length > 0 ? (
                      newTokenInfo.environments.map((envName: string) => {
                        const env = environments.find(e => e.environment === envName);
                        return env ? (
                          <Chip
                            key={envName}
                            label={env.environmentName}
                            size="small"
                            variant="outlined"
                          />
                        ) : null;
                      })
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        {t('apiTokens.noEnvironmentSelected')}
                      </Typography>
                    )}
                  </Box>
                </Box>
              </Box>
            </Box>
          )}

          {/* Token Value */}
          {newTokenValue ? (
            <Box sx={{
              p: 2,
              bgcolor: 'action.hover',
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'divider'
            }}>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                {t('apiTokens.tokenValue')}
              </Typography>

              {/* Token Display with Copy Button */}
              <Box sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                p: 1.5,
                bgcolor: 'background.default',
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider'
              }}>
                <Typography
                  variant="body2"
                  fontFamily="monospace"
                  sx={{
                    flex: 1,
                    fontSize: '0.875rem',
                    letterSpacing: '0.5px',
                    color: 'text.primary'
                  }}
                >
                  {maskToken(newTokenValue)}
                </Typography>
                <Tooltip title={t('apiTokens.copyTokenValue')}>
                  <IconButton
                    onClick={async () => await copyToClipboard(newTokenValue)}
                    size="small"
                    color="primary"
                  >
                    <CopyIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
          ) : (
            <Alert severity="error" sx={{ mb: 2 }}>
              <Typography variant="body2">
                {t('apiTokens.tokenValueError')}
              </Typography>
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 2 }}>
          <Button
            onClick={() => { setNewTokenValue(''); setNewTokenInfo(null); setNewTokenDialogOpen(false); }}
            variant="contained"
            startIcon={<CheckCircleIcon />}
            size="medium"
            sx={{
              px: 3,
              py: 1,
              fontWeight: 600,
              textTransform: 'none'
            }}
          >
            {t('common.confirm')}
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
          <Box sx={{ p: 2, minWidth: 250 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle2">{t('common.columnSettings')}</Typography>
              <Button size="small" onClick={handleResetColumns}>{t('common.reset')}</Button>
            </Box>
            <DndContext
              sensors={columnSensors}
              collisionDetection={closestCenter}
              onDragEnd={handleColumnDragEnd}
              modifiers={[restrictToVerticalAxis]}
            >
              <SortableContext items={columns.map(c => c.id)} strategy={verticalListSortingStrategy}>
                <List dense>
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
    </>
  );
};

export default ApiTokensPage;
