import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CircularProgress,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  InputAdornment,
  IconButton,
  MenuItem,
  Chip,
  Avatar,
  Button,
  FormControl,
  FormHelperText,
  InputLabel,
  Select,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  Menu,
  ListItemIcon,
  ListItemText,
  Autocomplete,
  Tooltip,
  Checkbox,
  Drawer,
  Skeleton,
  Popover,
  List,
  ListItem,
  ListItemButton,
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
  Search as SearchIcon,
  MoreVert as MoreVertIcon,
  PersonAdd as PersonAddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Block as BlockIcon,
  CheckCircle as CheckCircleIcon,
  Security as SecurityIcon,
  Person as PersonIcon,
  People as PeopleIcon,
  Cancel as CancelIcon,
  Close as CloseIcon,
  Email as EmailIcon,
  VerifiedUser as VerifiedUserIcon,
  Send as SendIcon,
  Add as AddIcon,
  Save as SaveIcon,
  ContentCopy as ContentCopyIcon,
  LocalOffer as TagIcon,
  SelectAll as SelectAllIcon,
  AdminPanelSettings as AdminIcon,
  PersonRemove as PersonRemoveIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Refresh as RefreshIcon,
  ViewColumn as ViewColumnIcon,
  DragIndicator as DragIndicatorIcon,
  Preview as PreviewIcon,
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { User, Tag, Permission } from '@/types';
import { apiService } from '@/services/api';
import { copyToClipboardWithNotification } from '@/utils/clipboard';
import { tagService } from '@/services/tagService';
import { UserService } from '@/services/users';
import { formatDateTimeDetailed } from '../../utils/dateFormat';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/types/permissions';
import SimplePagination from '../../components/common/SimplePagination';
import FormDialogHeader from '../../components/common/FormDialogHeader';
import ResizableDrawer from '../../components/common/ResizableDrawer';
import { invitationService } from '../../services/invitationService';
import { Invitation, CreateInvitationRequest } from '../../types/invitation';
import InvitationForm from '../../components/admin/InvitationForm';
import InvitationStatusCard from '../../components/admin/InvitationStatusCard';
import EmptyTableRow from '../../components/common/EmptyTableRow';
import { useDebounce } from '../../hooks/useDebounce';
import { usePageState } from '../../hooks/usePageState';
import DynamicFilterBar, { FilterDefinition, ActiveFilter } from '../../components/common/DynamicFilterBar';
import { usePaginatedApi, useTags } from '../../hooks/useSWR';
import { useEnvironments } from '../../contexts/EnvironmentContext';
import PermissionSelector from '../../components/common/PermissionSelector';
import { getContrastColor } from '@/utils/colorUtils';
// SSE??MainLayout?êÏÑú ?ÑÏó≠?ºÎ°ú Ï≤òÎ¶¨?òÎ?Î°??¨Í∏∞?úÎäî ?úÍ±∞

interface UsersResponse {
  users: User[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

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

// Role chip with permissions tooltip for admin users
interface RoleChipWithTooltipProps {
  user: User;
}

const RoleChipWithTooltip: React.FC<RoleChipWithTooltipProps> = ({ user }) => {
  const { t } = useTranslation();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const handleMouseEnter = async () => {
    if (user.role !== 'admin' || loaded) return;

    setLoading(true);
    try {
      const response = await apiService.get<{ userId: number; permissions: Permission[] }>(
        `/admin/users/${user.id}/permissions`
      );
      setPermissions(response.data?.permissions || []);
      setLoaded(true);
    } catch (error) {
      console.error('Failed to load user permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTooltipContent = () => {
    if (user.role !== 'admin') {
      return t('users.noPermissionsForUser');
    }

    if (loading) {
      return t('common.loading');
    }

    if (!loaded) {
      return t('users.hoverToLoadPermissions');
    }

    if (permissions.length === 0) {
      return t('users.noPermissionsAssigned');
    }

    const maxDisplay = 5;
    const displayPermissions = permissions.slice(0, maxDisplay);
    const remaining = permissions.length - maxDisplay;

    return (
      <Box sx={{ maxWidth: 300 }}>
        <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
          {t('users.assignedPermissions')} ({permissions.length})
        </Typography>
        {displayPermissions.map((perm) => (
          <Typography key={perm} variant="caption" sx={{ display: 'block', color: 'inherit' }}>
            ??{t(`permissions.${perm.replace('.', '_')}`)}
          </Typography>
        ))}
        {remaining > 0 && (
          <Typography variant="caption" sx={{ display: 'block', fontStyle: 'italic', mt: 0.5 }}>
            +{remaining} {t('users.morePermissions')}
          </Typography>
        )}
      </Box>
    );
  };

  return (
    <Tooltip
      title={getTooltipContent()}
      arrow
      placement="top"
      enterDelay={300}
      onOpen={handleMouseEnter}
    >
      <Chip
        icon={user.role === 'admin' ? <SecurityIcon /> : <PersonIcon />}
        label={t(`users.roles.${user.role}`)}
        color={user.role === 'admin' ? 'primary' : 'secondary'}
        size="small"
        variant="outlined"
        sx={{ cursor: user.role === 'admin' ? 'help' : 'default' }}
      />
    </Tooltip>
  );
};

const UsersManagementPage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { user: currentUser, isLoading: authLoading, hasPermission } = useAuth();
  const { environments } = useEnvironments();
  const canManage = hasPermission([PERMISSIONS.USERS_MANAGE]);

  // Helper function to check if user is current user
  const isCurrentUser = (user: User | null): boolean => {
    return currentUser?.id === user?.id;
  };

  // Helper function to check if user is super admin (admin@gatrix.com)
  // Super admin cannot be modified by anyone except themselves (name only)
  const isSuperAdmin = (user: User | null): boolean => {
    return user?.email === 'admin@gatrix.com';
  };

  // Check if the target user can be modified
  // Returns true if the user CAN be modified, false if they should be protected
  const canModifyUser = (user: User | null): boolean => {
    if (!user) return false;
    // Super admin can only be modified by themselves
    if (isSuperAdmin(user) && !isCurrentUser(user)) return false;
    return true;
  };

  // ?¥Î¶ΩÎ≥¥Îìú Î≥µÏÇ¨ ?®Ïàò
  const copyToClipboard = async (text: string, type: 'name' | 'email') => {
    copyToClipboardWithNotification(
      text,
      () => enqueueSnackbar(
        t('common.copiedToClipboard'),
        { variant: 'success' }
      ),
      () => enqueueSnackbar(t('common.copyFailed'), { variant: 'error' })
    );
  };

  // ?òÏù¥ÏßÄ ?ÅÌÉú Í¥ÄÎ¶?(URL params ?∞Îèô)
  const {
    pageState,
    updatePage,
    updateLimit,
    updateFilters,
  } = usePageState({
    defaultState: {
      page: 1,
      limit: 10,
      filters: {},
    },
    storageKey: 'usersPage',
  });

  const [searchTerm, setSearchTerm] = useState('');

  // ?ôÏ†Å ?ÑÌÑ∞ ?ÅÌÉú
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);
  const [filtersInitialized, setFiltersInitialized] = useState(false);

  // ?îÎ∞î?¥Ïã±??Í≤Ä?âÏñ¥
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  // SWRÎ°??∞Ïù¥??Î°úÎî©
  const { data: usersData, error: usersError, isLoading: isLoadingUsers, mutate: mutateUsers } = usePaginatedApi<UsersResponse>(
    '/admin/users',
    pageState.page,
    pageState.limit,
    {
      ...pageState.filters,
      search: debouncedSearchTerm || undefined,
    }
  );

  const { data: allTags, isLoading: isLoadingTags } = useTags();

  // Derived state from SWR
  const users = useMemo(() => usersData?.users || [], [usersData]);
  const total = useMemo(() => usersData?.total || 0, [usersData]);
  const loading = isLoadingUsers || isLoadingTags;

  // Ï¥àÍ∏∞ Î°úÎî© ?ÅÌÉú Ï∂îÏ†Å
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  useEffect(() => {
    if (!loading && isInitialLoad) {
      setIsInitialLoad(false);
    }
  }, [loading, isInitialLoad]);

  // ?ôÏ†Å ?ÑÌÑ∞?êÏÑú Í∞?Ï∂îÏ∂ú (useMemoÎ°?Ï∞∏Ï°∞ ?àÏ†ï??
  const statusFilter = useMemo(() =>
    activeFilters.find(f => f.key === 'status')?.value as string[] || [],
    [activeFilters]
  );
  const statusOperator = useMemo(() =>
    activeFilters.find(f => f.key === 'status')?.operator,
    [activeFilters]
  );
  const roleFilter = useMemo(() =>
    activeFilters.find(f => f.key === 'role')?.value as string[] || [],
    [activeFilters]
  );
  const roleOperator = useMemo(() =>
    activeFilters.find(f => f.key === 'role')?.operator,
    [activeFilters]
  );
  const tagIds = useMemo(() =>
    activeFilters.find(f => f.key === 'tags')?.value as number[] || [],
    [activeFilters]
  );
  const tagOperator = useMemo(() =>
    activeFilters.find(f => f.key === 'tags')?.operator,
    [activeFilters]
  );

  // Î∞∞Ïó¥??Î¨∏Ïûê?¥Î°ú Î≥Ä?òÌïò???òÏ°¥??Î∞∞Ïó¥???¨Ïö©
  const statusFilterString = useMemo(() => statusFilter.join(','), [statusFilter]);
  const roleFilterString = useMemo(() => roleFilter.join(','), [roleFilter]);
  const tagIdsString = useMemo(() => tagIds.join(','), [tagIds]);

  // ?ºÍ¥Ñ ?†ÌÉù Í¥Ä???ÅÌÉú
  const [selectedUsers, setSelectedUsers] = useState<Set<number>>(new Set());
  const [bulkActionDialogOpen, setBulkActionDialogOpen] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<'status' | 'role' | 'tags' | 'emailVerified' | 'delete'>('status');
  const [bulkActionValue, setBulkActionValue] = useState<any>('');
  const [bulkActionTags, setBulkActionTags] = useState<Tag[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    action: () => void;
  }>({
    open: false,
    title: '',
    message: '',
    action: () => { },
  });
  const [confirmDialogLoading, setConfirmDialogLoading] = useState(false);

  // Ï¥àÎ? Í¥Ä???ÅÌÉú
  const [invitationDialogOpen, setInvitationDialogOpen] = useState(false);
  const [currentInvitation, setCurrentInvitation] = useState<Invitation | null>(null);

  const [addUserDialog, setAddUserDialog] = useState(false);
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [newUserData, setNewUserData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'user' as 'admin' | 'user',
  });
  const [newUserTags, setNewUserTags] = useState<Tag[]>([]);
  const [newUserErrors, setNewUserErrors] = useState({
    name: '',
    email: '',
    password: '',
  });

  // Environment access state for new user
  const [newUserAllowAllEnvs, setNewUserAllowAllEnvs] = useState(false);
  const [newUserEnvIds, setNewUserEnvIds] = useState<string[]>([]);

  // Delete confirmation state
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState({
    open: false,
    user: null as User | null,
    inputValue: '',
  });

  // Tags state
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);

  // Edit user dialog state
  const [editUserDialog, setEditUserDialog] = useState({
    open: false,
    user: null as User | null,
  });
  const [editUserData, setEditUserData] = useState({
    name: '',
    email: '',
    role: 'user' as 'admin' | 'user',
    status: 'active' as 'pending' | 'active' | 'suspended' | 'deleted',
  });
  const [editUserTags, setEditUserTags] = useState<Tag[]>([]);
  const [editUserErrors, setEditUserErrors] = useState({
    name: '',
    email: '',
  });

  // Environment access state
  const [editUserAllowAllEnvs, setEditUserAllowAllEnvs] = useState(false);
  const [editUserEnvIds, setEditUserEnvIds] = useState<string[]>([]);

  // Permission state
  const [editUserPermissions, setEditUserPermissions] = useState<Permission[]>([]);
  const [permissionsLoading, setPermissionsLoading] = useState(false);

  // Original user data for comparison in review
  const [originalUserData, setOriginalUserData] = useState<{
    name: string;
    email: string;
    role: 'admin' | 'user';
    status: 'pending' | 'active' | 'suspended' | 'deleted';
    tags: Tag[];
    allowAllEnvs: boolean;
    selectedEnvironments: string[];
    permissions: Permission[];
  } | null>(null);

  // Review dialog state
  const [reviewDialog, setReviewDialog] = useState<{
    open: boolean;
    saving: boolean;
  }>({
    open: false,
    saving: false,
  });

  // Promote user dialog state
  const [promoteDialog, setPromoteDialog] = useState<{
    open: boolean;
    user: User | null;
    permissions: Permission[];
    loading: boolean;
    showReview: boolean;
    allowAllEnvs: boolean;
    selectedEnvironments: string[];
  }>({
    open: false,
    user: null,
    permissions: [],
    loading: false,
    showReview: false,
    allowAllEnvs: false,
    selectedEnvironments: [],
  });

  // ?¥Î©î???∏Ï¶ù Í¥Ä???ÅÌÉú
  const [emailVerificationLoading, setEmailVerificationLoading] = useState(false);

  // Default column configuration
  const defaultColumns: ColumnConfig[] = [
    { id: 'user', labelKey: 'users.user', visible: true },
    { id: 'email', labelKey: 'users.email', visible: true },
    { id: 'emailVerified', labelKey: 'users.emailVerified', visible: true },
    { id: 'role', labelKey: 'users.role', visible: true },
    { id: 'status', labelKey: 'users.status', visible: true },
    { id: 'environments', labelKey: 'users.environmentAccess', visible: true },
    { id: 'tags', labelKey: 'users.tags', visible: true },
    { id: 'joinDate', labelKey: 'users.joinDate', visible: true },
    { id: 'lastLogin', labelKey: 'users.lastLogin', visible: true },
  ];

  // Column configuration state (persisted in localStorage)
  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    const saved = localStorage.getItem('usersColumns');
    if (saved) {
      try {
        const savedColumns = JSON.parse(saved);
        // Merge saved columns with defaults, preserving saved order
        const mergedColumns = savedColumns.map((savedCol: ColumnConfig) => {
          const defaultCol = defaultColumns.find(c => c.id === savedCol.id);
          return defaultCol ? { ...defaultCol, ...savedCol } : savedCol;
        });

        // Add any new columns from defaults that aren't in saved
        const savedIds = new Set(savedColumns.map((c: ColumnConfig) => c.id));
        const newColumns = defaultColumns.filter(c => !savedIds.has(c.id));

        return [...mergedColumns, ...newColumns];
      } catch (e) {
        return defaultColumns;
      }
    }
    return defaultColumns;
  });

  // Column settings popover state
  const [columnSettingsAnchor, setColumnSettingsAnchor] = useState<HTMLButtonElement | null>(null);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // ?ÑÏû¨ Ï¥àÎ? ?ïÎ≥¥ Î°úÎìú
  const loadCurrentInvitation = async () => {
    try {
      const invitation = await invitationService.getCurrentInvitation();
      setCurrentInvitation(invitation);
    } catch (error: any) {
      console.error('Failed to load current invitation:', error);
      // Error loading invitation - set to null
      setCurrentInvitation(null);
    }
  };

  // SWR???êÎèô?ºÎ°ú ?∞Ïù¥?∞Î? Î°úÎìú?òÎ?Î°?fetchUsers ?®Ïàò ?úÍ±∞

  // Ï¥àÎ?ÎßÅÌÅ¨ ?¥Î≤§??Ï≤òÎ¶¨ (MainLayout?êÏÑú ?ÑÎã¨Î∞õÏùå)
  useEffect(() => {
    const handleInvitationChange = (event: CustomEvent) => {
      const sseEvent = event.detail;
      if (sseEvent.type === 'invitation_created' || sseEvent.type === 'invitation_deleted') {
        // Ï¥àÎ?ÎßÅÌÅ¨ ?ÅÌÉúÍ∞Ä Î≥ÄÍ≤ΩÎêòÎ©??ÑÏû¨ Ï¥àÎ? ?ïÎ≥¥Î•??§Ïãú Î°úÎìú
        loadCurrentInvitation();
      }
    };

    window.addEventListener('invitation-change', handleInvitationChange as EventListener);

    return () => {
      window.removeEventListener('invitation-change', handleInvitationChange as EventListener);
    };
  }, []);

  // Load available tags
  useEffect(() => {
    const loadTags = async () => {
      try {
        const tags = await tagService.list();
        setAvailableTags(tags);
      } catch (error) {
        console.error('Failed to load tags:', error);
      }
    };
    loadTags();
    loadCurrentInvitation(); // Ï¥àÎ? Í∏∞Îä• ?úÏÑ±??  }, []);

  // ?ôÏ†Å ?ÑÌÑ∞ ?ïÏùò
  const availableFilterDefinitions: FilterDefinition[] = useMemo(() => [
    {
      key: 'status',
      label: t('users.statusFilter'),
      type: 'multiselect',
      operator: 'any_of', // Status can be any of the selected values
      allowOperatorToggle: false, // Single-value field, only 'any_of' makes sense
      options: [
        { value: 'active', label: t('users.statuses.active') },
        { value: 'pending', label: t('users.statuses.pending') },
        { value: 'suspended', label: t('users.statuses.suspended') },
      ],
    },
    {
      key: 'role',
      label: t('users.roleFilter'),
      type: 'multiselect',
      operator: 'any_of', // Role can be any of the selected values
      allowOperatorToggle: false, // Single-value field, only 'any_of' makes sense
      options: [
        { value: 'admin', label: t('users.roles.admin') },
        { value: 'user', label: t('users.roles.user') },
      ],
    },
    {
      key: 'tags',
      label: t('common.tags'),
      type: 'tags',
      operator: 'include_all', // Tags are filtered with AND logic in backend
      allowOperatorToggle: true, // Tags support both 'any_of' and 'include_all'
      options: availableTags.map(tag => ({
        value: tag.id,
        label: tag.name,
        color: tag.color,
        description: tag.description,
      })),
    },
  ], [t, availableTags]);

  // ?òÏù¥ÏßÄ Î°úÎìú ??pageState.filters?êÏÑú activeFilters Î≥µÏõê
  useEffect(() => {
    if (filtersInitialized) return;

    if (!pageState.filters || Object.keys(pageState.filters).length === 0) {
      setFiltersInitialized(true);
      return;
    }

    const restoredFilters: ActiveFilter[] = [];
    const filters = pageState.filters;

    // status ?ÑÌÑ∞ Î≥µÏõê
    if (filters.status) {
      restoredFilters.push({
        key: 'status',
        value: Array.isArray(filters.status) ? filters.status : [filters.status],
        label: t('users.statusFilter'),
        operator: filters.status_operator || 'any_of',
      });
    }

    // role ?ÑÌÑ∞ Î≥µÏõê
    if (filters.role) {
      restoredFilters.push({
        key: 'role',
        value: Array.isArray(filters.role) ? filters.role : [filters.role],
        label: t('users.roleFilter'),
        operator: filters.role_operator || 'any_of',
      });
    }

    // tags ?ÑÌÑ∞ Î≥µÏõê
    if (filters.tags) {
      restoredFilters.push({
        key: 'tags',
        value: Array.isArray(filters.tags) ? filters.tags.map(Number) : [Number(filters.tags)],
        label: t('common.tags'),
        operator: filters.tags_operator || 'include_all',
      });
    }

    if (restoredFilters.length > 0) {
      setActiveFilters(restoredFilters);
    }
    setFiltersInitialized(true);
  }, [filtersInitialized, pageState.filters, t]);

  // activeFilters Î≥ÄÍ≤???pageState.filters ?ÖÎç∞?¥Ìä∏
  useEffect(() => {
    if (!filtersInitialized) return;

    const filters: Record<string, any> = {};

    activeFilters.forEach(filter => {
      if (filter.key === 'status') {
        filters.status = filter.value;
        filters.status_operator = filter.operator;
      } else if (filter.key === 'role') {
        filters.role = filter.value;
        filters.role_operator = filter.operator;
      } else if (filter.key === 'tags') {
        filters.tags = filter.value;
        filters.tags_operator = filter.operator;
      }
    });

    const currentFiltersString = JSON.stringify(pageState.filters || {});
    const newFiltersString = JSON.stringify(filters);

    if (currentFiltersString !== newFiltersString) {
      updateFilters(filters);
    }
  }, [activeFilters, filtersInitialized, pageState.filters, updateFilters]);

  // ?ôÏ†Å ?ÑÌÑ∞ ?∏Îì§??  const handleFilterAdd = (filter: ActiveFilter) => {
    setActiveFilters([...activeFilters, filter]);
  };

  const handleFilterRemove = (filterKey: string) => {
    setActiveFilters(activeFilters.filter(f => f.key !== filterKey));
  };

  const handleDynamicFilterChange = (filterKey: string, value: any) => {
    setActiveFilters(activeFilters.map(f =>
      f.key === filterKey ? { ...f, value } : f
    ));
  };

  const handleOperatorChange = (filterKey: string, operator: 'any_of' | 'include_all') => {
    setActiveFilters(activeFilters.map(f =>
      f.key === filterKey ? { ...f, operator } : f
    ));
  };

  // Ï≤¥ÌÅ¨Î∞ïÏä§ ?∏Îì§??  const handleSelectUser = (userId: number) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
  };

  const handleSelectAllUsers = () => {
    if (selectedUsers.size === users.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(users.map(user => user.id)));
    }
  };

  // ?ºÍ¥Ñ Ï≤òÎ¶¨ ?∏Îì§??  const handleBulkAction = (actionType: 'status' | 'role' | 'tags' | 'emailVerified' | 'delete') => {
    // ?§Ìîà ??Í∞?Ï¥àÍ∏∞??(?¥Ï†Ñ???†ÌÉù??Í∞??†Ï? Î∞©Ï?)
    setBulkActionType(actionType);
    setBulkActionValue('');
    setBulkActionTags([]);
    setBulkActionDialogOpen(true);
  };

  // ?ºÍ¥Ñ ?ëÏóÖ ?Ä??Î≤ÑÌäº ?úÏÑ±??Ï°∞Í±¥ ?ïÏù∏
  const isBulkActionValid = () => {
    switch (bulkActionType) {
      case 'status':
      case 'role':
      case 'emailVerified':
        return bulkActionValue !== '';
      case 'tags':
        // ?úÍ∑∏??Îπ?Î∞∞Ïó¥???àÏö© (?úÍ∑∏ ?úÍ±∞ Î™©Ï†Å)
        return true;
      case 'delete':
        return true;
      default:
        return false;
    }
  };

  const executeBulkAction = async () => {
    if (selectedUsers.size === 0) return;

    try {
      const userIds = Array.from(selectedUsers);

      switch (bulkActionType) {
        case 'status':
          await apiService.post('/admin/users/bulk/status', {
            userIds,
            status: bulkActionValue
          });
          enqueueSnackbar(t('users.bulkStatusUpdated'), { variant: 'success' });
          break;
        case 'role':
          await apiService.post('/admin/users/bulk/role', {
            userIds,
            role: bulkActionValue
          });
          enqueueSnackbar(t('users.bulkRoleUpdated'), { variant: 'success' });
          break;
        case 'emailVerified':
          await apiService.post('/admin/users/bulk/email-verified', {
            userIds,
            emailVerified: bulkActionValue === 'true'
          });
          enqueueSnackbar(t('users.bulkEmailVerifiedUpdated'), { variant: 'success' });
          break;
        case 'tags':
          await apiService.post('/admin/users/bulk/tags', {
            userIds,
            tagIds: bulkActionTags.map(tag => tag.id)
          });
          enqueueSnackbar(t('users.bulkTagsUpdated'), { variant: 'success' });
          break;
        case 'delete':
          await apiService.post('/admin/users/bulk/delete', { userIds });
          enqueueSnackbar(t('users.bulkDeleted'), { variant: 'success' });
          break;
      }

      mutateUsers(); // SWR cache Í∞±Ïã†
      setSelectedUsers(new Set());
      setBulkActionDialogOpen(false);
      setBulkActionValue('');
      setBulkActionTags([]);
    } catch (error: any) {
      enqueueSnackbar(error.message || t('users.bulkActionFailed'), { variant: 'error' });
    }
  };

  const handleSuspendUser = (user: User) => {
    setConfirmDialog({
      open: true,
      title: t('common.suspendUser'),
      message: t('common.suspendUserConfirm', { name: user.name }),
      action: async () => {
        if (confirmDialogLoading) return; // Prevent double click
        setConfirmDialogLoading(true);
        try {
          await apiService.post(`/admin/users/${user.id}/suspend`);
          enqueueSnackbar(t('common.userSuspended'), { variant: 'success' });
          mutateUsers(); // SWR cache Í∞±Ïã†
        } catch (error: any) {
          enqueueSnackbar(error.message || t('common.userSuspendFailed'), { variant: 'error' });
        } finally {
          setConfirmDialogLoading(false);
          setConfirmDialog(prev => ({ ...prev, open: false }));
        }
      },
    });
  };

  const handleActivateUser = (user: User) => {
    setConfirmDialog({
      open: true,
      title: t('common.activateUser'),
      message: t('common.activateUserConfirm', { name: user.name }),
      action: async () => {
        if (confirmDialogLoading) return; // Prevent double click
        setConfirmDialogLoading(true);
        try {
          await apiService.post(`/admin/users/${user.id}/activate`);
          enqueueSnackbar(t('common.userActivated'), { variant: 'success' });
          mutateUsers(); // SWR cache Í∞±Ïã†
        } catch (error: any) {
          enqueueSnackbar(error.message || t('common.userActivateFailed'), { variant: 'error' });
        } finally {
          setConfirmDialogLoading(false);
          setConfirmDialog(prev => ({ ...prev, open: false }));
        }
      },
    });
  };

  const handlePromoteUser = (user: User) => {
    // Open promote dialog with permission selector
    setPromoteDialog({
      open: true,
      user,
      permissions: [],
      loading: false,
      showReview: false,
      allowAllEnvs: false,
      selectedEnvironments: [],
    });
  };

  // Show review step for promotion
  const handlePromoteReview = () => {
    setPromoteDialog(prev => ({ ...prev, showReview: true }));
  };

  // Go back to permission selection
  const handlePromoteBackToEdit = () => {
    setPromoteDialog(prev => ({ ...prev, showReview: false }));
  };

  const handlePromoteConfirm = async () => {
    if (!promoteDialog.user || promoteDialog.loading) return;

    setPromoteDialog(prev => ({ ...prev, loading: true }));
    try {
      // First promote the user
      await apiService.post(`/admin/users/${promoteDialog.user.id}/promote`);

      // Then set the permissions
      if (promoteDialog.permissions.length > 0) {
        await apiService.put(`/admin/users/${promoteDialog.user.id}/permissions`, {
          permissions: promoteDialog.permissions
        });
      }

      // Set environment access
      const promoteAllowAll = Boolean(promoteDialog.allowAllEnvs);
      await apiService.put(`/admin/users/${promoteDialog.user.id}/environments`, {
        allowAllEnvironments: promoteAllowAll,
        environments: promoteAllowAll ? [] : promoteDialog.selectedEnvironments
      });

      enqueueSnackbar(t('common.userPromoted'), { variant: 'success' });
      mutateUsers();
      setPromoteDialog({ open: false, user: null, permissions: [], loading: false, showReview: false, allowAllEnvs: false, selectedEnvironments: [] });
    } catch (error: any) {
      enqueueSnackbar(error.message || t('common.userPromoteFailed'), { variant: 'error' });
      setPromoteDialog(prev => ({ ...prev, loading: false }));
    }
  };

  const handlePromoteCancel = () => {
    setPromoteDialog({ open: false, user: null, permissions: [], loading: false, showReview: false, allowAllEnvs: false, selectedEnvironments: [] });
  };

  const handleDemoteUser = (user: User) => {
    setConfirmDialog({
      open: true,
      title: t('common.demoteUser'),
      message: t('common.demoteUserConfirm', { name: user.name }),
      action: async () => {
        if (confirmDialogLoading) return; // Prevent double click
        setConfirmDialogLoading(true);
        try {
          await apiService.post(`/admin/users/${user.id}/demote`);
          enqueueSnackbar(t('common.userDemoted'), { variant: 'success' });
          mutateUsers(); // SWR cache Í∞±Ïã†
        } catch (error: any) {
          enqueueSnackbar(error.message || t('common.userDemoteFailed'), { variant: 'error' });
        } finally {
          setConfirmDialogLoading(false);
          setConfirmDialog(prev => ({ ...prev, open: false }));
        }
      },
    });
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, user: User) => {
    setMenuAnchorEl(event.currentTarget);
    setSelectedUser(user);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setSelectedUser(null);
  };

  const handleMenuAction = (action: string) => {
    if (!selectedUser) return;

    switch (action) {
      case 'edit':
        handleEditUser(selectedUser);
        break;
      case 'suspend':
        handleSuspendUser(selectedUser);
        break;
      case 'activate':
        handleActivateUser(selectedUser);
        break;
      case 'promote':
        handlePromoteUser(selectedUser);
        break;
      case 'demote':
        handleDemoteUser(selectedUser);
        break;
      case 'delete':
        handleDeleteUser(selectedUser);
        break;
      case 'verifyEmail':
        handleVerifyUserEmail(selectedUser.id);
        break;
      case 'resendVerification':
        handleResendVerificationEmail(selectedUser.id);
        break;
    }
    handleMenuClose();
  };

  const handleEditUser = async (user: User) => {
    const userWithEnv = user as User & { allowAllEnvironments?: boolean; environments?: string[] };

    setEditUserData({
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
    });
    setEditUserTags(user.tags || []);
    setEditUserErrors({
      name: '',
      email: '',
    });

    // Load environment access from user data (already included in list response)
    setEditUserAllowAllEnvs(userWithEnv.allowAllEnvironments || false);
    setEditUserEnvIds(userWithEnv.environments || []);

    // Load user permissions
    let loadedPermissions: Permission[] = [];
    setEditUserPermissions([]);
    if (user.role === 'admin') {
      setPermissionsLoading(true);
      try {
        const response = await apiService.get<{ userId: number; permissions: Permission[] }>(
          `/admin/users/${user.id}/permissions`
        );
        loadedPermissions = response.data?.permissions || [];
        setEditUserPermissions(loadedPermissions);
      } catch (error) {
        console.error('Failed to load user permissions:', error);
        setEditUserPermissions([]);
      } finally {
        setPermissionsLoading(false);
      }
    }

    // Save original data for comparison
    setOriginalUserData({
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      tags: user.tags || [],
      allowAllEnvs: userWithEnv.allowAllEnvironments || false,
      selectedEnvironments: userWithEnv.environments || [],
      permissions: loadedPermissions,
    });

    setEditUserDialog({
      open: true,
      user,
    });
  };

  const validateEditUserForm = () => {
    const errors = {
      name: '',
      email: '',
    };

    if (!editUserData.name.trim()) {
      errors.name = t('users.form.nameRequired');
    }
    if (!editUserData.email.trim()) {
      errors.email = t('users.form.emailRequired');
    }

    setEditUserErrors(errors);
    return !errors.name && !errors.email;
  };

  // Open review dialog (called when "Review" button is clicked)
  const handleOpenReview = () => {
    if (!editUserDialog.user) return;
    if (!validateEditUserForm()) return;
    setReviewDialog({ open: true, saving: false });
  };

  // Close review dialog and go back to edit
  const handleCloseReview = () => {
    setReviewDialog({ open: false, saving: false });
  };

  // Change item type with optional details
  interface ChangeItem {
    field: string;
    from: string;
    to: string;
    details?: {
      added?: string[];
      removed?: string[];
      addedKeys?: string[];  // Original permission keys for tooltip
      removedKeys?: string[];
    };
  }

  // Get changes for review
  const getChanges = (): ChangeItem[] => {
    if (!originalUserData || !editUserDialog.user) return [];

    const changes: ChangeItem[] = [];
    const isOwnAccount = isCurrentUser(editUserDialog.user);

    if (editUserData.name !== originalUserData.name) {
      changes.push({ field: t('users.name'), from: originalUserData.name, to: editUserData.name });
    }

    if (!isOwnAccount) {
      if (editUserData.email !== originalUserData.email) {
        changes.push({ field: t('users.email'), from: originalUserData.email, to: editUserData.email });
      }
      if (editUserData.role !== originalUserData.role) {
        changes.push({
          field: t('users.role'),
          from: t(`users.roles.${originalUserData.role}`),
          to: t(`users.roles.${editUserData.role}`)
        });
      }
      if (editUserData.status !== originalUserData.status) {
        changes.push({
          field: t('users.status'),
          from: t(`users.statuses.${originalUserData.status}`),
          to: t(`users.statuses.${editUserData.status}`)
        });
      }

      // Tags
      const origTagNames = originalUserData.tags.map(tag => tag.name).sort().join(', ') || '-';
      const newTagNames = editUserTags.map(tag => tag.name).sort().join(', ') || '-';
      if (origTagNames !== newTagNames) {
        changes.push({ field: t('users.tags'), from: origTagNames, to: newTagNames });
      }

      // Environment access
      if (editUserAllowAllEnvs !== originalUserData.allowAllEnvs) {
        changes.push({
          field: t('users.environmentAccess'),
          from: originalUserData.allowAllEnvs ? t('common.all') : t('users.specificEnvironments'),
          to: editUserAllowAllEnvs ? t('common.all') : t('users.specificEnvironments')
        });
      } else if (!editUserAllowAllEnvs) {
        const origEnvs = originalUserData.selectedEnvironments.sort().join(',');
        const newEnvs = editUserEnvIds.sort().join(',');
        if (origEnvs !== newEnvs) {
          const getEnvNames = (ids: string[]) =>
            ids.map(id => {
              const env = environments.find(e => e.id === id);
              return env?.displayName || env?.environmentName || id;
            }).join(', ') || '-';
          changes.push({
            field: t('users.environmentAccess'),
            from: getEnvNames(originalUserData.selectedEnvironments),
            to: getEnvNames(editUserEnvIds)
          });
        }
      }

      // Permissions (only for admin role)
      if (editUserData.role === 'admin') {
        const origPerms = [...originalUserData.permissions].sort().join(',');
        const newPerms = [...editUserPermissions].sort().join(',');
        if (origPerms !== newPerms) {
          const addedPerms = editUserPermissions.filter(p => !originalUserData.permissions.includes(p));
          const removedPerms = originalUserData.permissions.filter(p => !editUserPermissions.includes(p));

          // Build change description - if original is 0, just show "added", not "0 -> X"
          const origCount = originalUserData.permissions.length;
          const newCount = editUserPermissions.length;

          let fromText = '';
          let toText = '';

          if (origCount === 0 && addedPerms.length > 0) {
            // No previous permissions - just show what's being added
            fromText = '-';
            toText = `${newCount} ${t('users.permissionsCount')} (+${addedPerms.length} ${t('users.added')})`;
          } else if (newCount === 0 && removedPerms.length > 0) {
            // All permissions removed
            fromText = `${origCount} ${t('users.permissionsCount')}`;
            toText = `- (-${removedPerms.length} ${t('users.removed')})`;
          } else {
            // Mixed changes
            let permChange = '';
            if (addedPerms.length > 0) {
              permChange += `+${addedPerms.length} ${t('users.added')}`;
            }
            if (removedPerms.length > 0) {
              if (permChange) permChange += ', ';
              permChange += `-${removedPerms.length} ${t('users.removed')}`;
            }
            fromText = `${origCount} ${t('users.permissionsCount')}`;
            toText = `${newCount} ${t('users.permissionsCount')} (${permChange})`;
          }

          changes.push({
            field: t('users.permissions'),
            from: fromText,
            to: toText,
            details: {
              added: addedPerms.map(p => t(`permissions.${p.replace('.', '_')}`)),
              removed: removedPerms.map(p => t(`permissions.${p.replace('.', '_')}`)),
              addedKeys: addedPerms,
              removedKeys: removedPerms
            }
          });
        }
      }
    }

    return changes;
  };

  // Confirm and save from review dialog
  const handleConfirmSave = async () => {
    if (!editUserDialog.user) return;

    setReviewDialog(prev => ({ ...prev, saving: true }));

    try {
      // For own account, only allow name changes
      if (isCurrentUser(editUserDialog.user)) {
        const updateData = {
          name: editUserData.name
        };
        await apiService.put(`/admin/users/${editUserDialog.user.id}`, updateData);
      } else {
        // For other users, allow all changes including tags
        const updateData = {
          ...editUserData,
          tagIds: editUserTags.map(tag => tag.id)
        };
        await apiService.put(`/admin/users/${editUserDialog.user.id}`, updateData);

        // Update environment access separately
        const allowAll = Boolean(editUserAllowAllEnvs);
        await apiService.put(`/admin/users/${editUserDialog.user.id}/environments`, {
          allowAllEnvironments: allowAll,
          environments: allowAll ? [] : editUserEnvIds
        });

        // Update permissions for admin users
        if (editUserData.role === 'admin') {
          await apiService.put(`/admin/users/${editUserDialog.user.id}/permissions`, {
            permissions: editUserPermissions
          });
        }
      }

      enqueueSnackbar(t('users.userUpdated'), { variant: 'success' });
      mutateUsers(); // SWR cache Í∞±Ïã†
      setReviewDialog({ open: false, saving: false });
      setEditUserDialog({ open: false, user: null });
    } catch (error: any) {
      // API ?§Î•ò ?ëÎãµ?êÏÑú Íµ¨Ï≤¥?ÅÏù∏ Î©îÏãúÏßÄ Ï∂îÏ∂ú
      const errorMessage = error.error?.message || error.message || t('users.updateError');
      enqueueSnackbar(errorMessage, { variant: 'error' });
      setReviewDialog(prev => ({ ...prev, saving: false }));
    }
  };

  const handleDeleteUser = (user: User) => {
    // Prevent deleting own account
    if (isCurrentUser(user)) {
      enqueueSnackbar(t('users.cannotModifyOwnAccount'), { variant: 'error' });
      return;
    }

    setDeleteConfirmDialog({
      open: true,
      user,
      inputValue: '',
    });
  };

  const handleConfirmDeleteUser = async () => {
    if (deleteConfirmDialog.user && deleteConfirmDialog.inputValue === deleteConfirmDialog.user.email) {
      try {
        await apiService.delete(`/admin/users/${deleteConfirmDialog.user.id}`);
        enqueueSnackbar(t('users.userDeleted'), { variant: 'success' });
        mutateUsers(); // SWR cache Í∞±Ïã†
        setDeleteConfirmDialog({ open: false, user: null, inputValue: '' });
      } catch (error: any) {
        // API ?§Î•ò ?ëÎãµ?êÏÑú Íµ¨Ï≤¥?ÅÏù∏ Î©îÏãúÏßÄ Ï∂îÏ∂ú
        const errorMessage = error.error?.message || error.message || t('users.deleteError');
        enqueueSnackbar(errorMessage, { variant: 'error' });
      }
    }
  };

  // ?¥Î©î??Í∞ïÏ†ú ?∏Ï¶ù Ï≤òÎ¶¨
  const handleVerifyUserEmail = async (userId: number) => {
    try {
      setEmailVerificationLoading(true);
      await UserService.verifyUserEmail(userId);
      enqueueSnackbar(t('users.emailVerified'), { variant: 'success' });
      mutateUsers(); // SWR cache Í∞±Ïã†
      // ?∏Ïßë ?ºÏù¥ ?¥Î†§?àÎã§Î©??∞Ïù¥???ÖÎç∞?¥Ìä∏
      if (editUserDialog.open && editUserDialog.user?.id === userId) {
        setEditUserDialog(prev => ({
          ...prev,
          user: prev.user ? { ...prev.user, emailVerified: true } : prev.user,
        }));
      }
    } catch (error: any) {
      const errorMessage = error.message || t('users.emailVerificationError');
      enqueueSnackbar(errorMessage, { variant: 'error' });
    } finally {
      setEmailVerificationLoading(false);
    }
  };

  // ?¥Î©î???∏Ï¶ù Î©îÏùº ?¨Ï†Ñ??  const handleResendVerificationEmail = async (userId: number) => {
    try {
      setEmailVerificationLoading(true);
      await UserService.resendVerificationEmail(userId);
      enqueueSnackbar(t('users.verificationEmailSent'), { variant: 'success' });
    } catch (error: any) {
      const errorMessage = error.message || t('users.verificationEmailError');
      enqueueSnackbar(errorMessage, { variant: 'error' });
    } finally {
      setEmailVerificationLoading(false);
    }
  };

  const handleAddUser = () => {
    // ???∞Ïù¥??Ï¥àÍ∏∞??    setNewUserData({
      name: '',
      email: '',
      password: '',
      role: 'user',
    });
    setNewUserTags([]);
    setNewUserAllowAllEnvs(false);
    setNewUserEnvIds([]);
    setAddUserDialog(true);

    // Î∏åÎùº?∞Ï? ?êÎèô?ÑÏÑ±??Î∞©Ï??òÍ∏∞ ?ÑÌï¥ ?ΩÍ∞Ñ??ÏßÄ?????§Ïãú Ï¥àÍ∏∞??    setTimeout(() => {
      setNewUserData({
        name: '',
        email: '',
        password: '',
        role: 'user',
      });
      setNewUserTags([]);
    }, 100);
  };

  const handleCloseAddUserDialog = () => {
    setAddUserDialog(false);
    setShowPassword(false);
    setNewUserData({
      name: '',
      email: '',
      password: '',
      role: 'user',
    });
    setNewUserTags([]);
    setNewUserAllowAllEnvs(false);
    setNewUserEnvIds([]);
    setNewUserErrors({
      name: '',
      email: '',
      password: '',
    });
  };

  const validateNewUserForm = () => {
    const errors = {
      name: '',
      email: '',
      password: '',
    };

    if (!newUserData.name.trim()) {
      errors.name = t('users.form.nameRequired');
    }
    if (!newUserData.email.trim()) {
      errors.email = t('users.form.emailRequired');
    }
    if (!newUserData.password.trim()) {
      errors.password = t('users.form.passwordRequired');
    }

    setNewUserErrors(errors);
    return !errors.name && !errors.email && !errors.password;
  };

  const handleCreateUser = async () => {
    // ??Í≤ÄÏ¶?    if (!validateNewUserForm()) {
      return;
    }

    try {
      const userData = {
        ...newUserData,
        tagIds: newUserTags.map(tag => tag.id),
        allowAllEnvironments: newUserAllowAllEnvs,
        environments: newUserAllowAllEnvs ? [] : newUserEnvIds,
      };
      await apiService.post('/admin/users', userData);
      enqueueSnackbar(t('users.userCreated'), { variant: 'success' });
      mutateUsers(); // SWR cache Í∞±Ïã†
      handleCloseAddUserDialog();
    } catch (error: any) {
      // API ?§Î•ò ?ëÎãµ?êÏÑú Íµ¨Ï≤¥?ÅÏù∏ Î©îÏãúÏßÄ Ï∂îÏ∂ú
      const errorMessage = error.error?.message || error.message || t('users.createError');
      enqueueSnackbar(errorMessage, { variant: 'error' });
    }
  };

  // Ï¥àÎ? Í¥Ä???∏Îì§??  const handleCreateInvitation = async (data: CreateInvitationRequest) => {
    try {
      const response = await invitationService.createInvitation(data);
      setInvitationDialogOpen(false); // Ï¥àÎ? ???´Í∏∞
      await loadCurrentInvitation(); // ?ÑÏû¨ Ï¥àÎ? ?ïÎ≥¥ ?àÎ°úÍ≥†Ïπ®
      // ?±Í≥µ ?†Ïä§?∏Îäî SSE ?¥Î≤§?∏Ïóê??Ï≤òÎ¶¨ (Ï§ëÎ≥µ Î∞©Ï?)
    } catch (error: any) {
      console.error('Failed to create invitation:', error);
      enqueueSnackbar(error.message || 'Ï¥àÎ? ÎßÅÌÅ¨ ?ùÏÑ±???§Ìå®?àÏäµ?àÎã§.', { variant: 'error' });
    }
  };

  const handleDeleteInvitation = async () => {
    if (!currentInvitation) return;

    try {
      await invitationService.deleteInvitation(currentInvitation.id);
      setCurrentInvitation(null);
      // ?±Í≥µ ?†Ïä§?∏Îäî SSE ?¥Î≤§?∏Ïóê??Ï≤òÎ¶¨ (Ï§ëÎ≥µ Î∞©Ï?)
    } catch (error: any) {
      console.error('Failed to delete invitation:', error);
      enqueueSnackbar(error.message || 'Ï¥àÎ? ÎßÅÌÅ¨ ??†ú???§Ìå®?àÏäµ?àÎã§.', { variant: 'error' });
    }
  };

  const handleUpdateInvitation = () => {
    setInvitationDialogOpen(true);
  };

  // Column configuration handlers
  const handleToggleColumnVisibility = (columnId: string) => {
    const newColumns = columns.map(col =>
      col.id === columnId ? { ...col, visible: !col.visible } : col
    );
    setColumns(newColumns);
    localStorage.setItem('usersColumns', JSON.stringify(newColumns));
  };

  const handleResetColumns = () => {
    setColumns(defaultColumns);
    localStorage.setItem('usersColumns', JSON.stringify(defaultColumns));
  };

  const handleColumnDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = columns.findIndex((col) => col.id === active.id);
      const newIndex = columns.findIndex((col) => col.id === over.id);

      const newColumns = arrayMove(columns, oldIndex, newIndex);
      setColumns(newColumns);
      localStorage.setItem('usersColumns', JSON.stringify(newColumns));
    }
  };

  // Render cell content based on column ID
  const renderCellContent = (user: User, columnId: string) => {
    switch (columnId) {
      case 'user':
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar src={user.avatarUrl}>
              {user.name?.charAt(0).toUpperCase()}
            </Avatar>
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
                onClick={() => handleEditUser(user)}
              >
                {user.name}
              </Typography>
              <IconButton
                size="small"
                onClick={() => copyToClipboard(user.name, 'name')}
                sx={{ opacity: 0.7, '&:hover': { opacity: 1 } }}
              >
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>
        );
      case 'email':
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2">
              {user.email}
            </Typography>
            <IconButton
              size="small"
              onClick={() => copyToClipboard(user.email, 'email')}
              sx={{ opacity: 0.7, '&:hover': { opacity: 1 } }}
            >
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          </Box>
        );
      case 'emailVerified':
        return user.emailVerified ? (
          <Chip
            label={t('users.verified')}
            color="success"
            size="small"
            variant="outlined"
          />
        ) : (
          <Chip
            label={t('users.unverified')}
            color="warning"
            size="small"
            variant="outlined"
          />
        );
      case 'role':
        return <RoleChipWithTooltip user={user} />;
      case 'status':
        return (
          <Chip
            label={t(`users.statuses.${user.status}`)}
            color={getStatusColor(user.status)}
            size="small"
          />
        );
      case 'environments': {
        const userWithEnv = user as User & { allowAllEnvironments?: boolean; environments?: string[] };
        if (userWithEnv.allowAllEnvironments) {
          return (
            <Chip
              label={t('users.allEnvironments')}
              color="warning"
              size="small"
              sx={{ borderRadius: 1 }}
            />
          );
        }
        const userEnvIds = userWithEnv.environments || [];
        if (userEnvIds.length === 0) {
          return (
            <Typography variant="body2" color="text.secondary">
              {t('users.noEnvironments')}
            </Typography>
          );
        }
        return (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {userEnvIds.slice(0, 3).map((envName) => {
              const env = environments.find(e => e.environment === envName);
              return (
                <Chip
                  key={envName}
                  label={env?.displayName || env?.environmentName || envName}
                  size="small"
                  sx={{
                    borderRadius: 1,
                    bgcolor: env?.color || '#666',
                    color: '#fff',
                  }}
                />
              );
            })}
            {userEnvIds.length > 3 && (
              <Chip
                label={`+${userEnvIds.length - 3}`}
                size="small"
                sx={{ borderRadius: 1 }}
              />
            )}
          </Box>
        );
      }
      case 'tags':
        return (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {user.tags && user.tags.length > 0 && (
              user.tags.map((tag: any) => (
                <Chip
                  key={tag.id}
                  label={tag.name}
                  size="small"
                  variant="outlined"
                  sx={{
                    bgcolor: tag.color ? `${tag.color}15` : undefined,
                    borderColor: tag.color || undefined,
                    color: tag.color || undefined,
                  }}
                />
              ))
            )}
          </Box>
        );
      case 'joinDate':
        return (
          <Typography variant="body2">
            {formatDateTimeDetailed(user.createdAt)}
          </Typography>
        );
      case 'lastLogin':
        return (
          <Typography variant="body2">
            {user.lastLoginAt ? formatDateTimeDetailed(user.lastLoginAt) : '-'}
          </Typography>
        );
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'pending': return 'warning';
      case 'suspended': return 'error';
      default: return 'default';
    }
  };

  const getRoleColor = (role: string) => {
    return role === 'admin' ? 'primary' : 'secondary';
  };

  // Show loading while auth is loading
  if (authLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <PeopleIcon sx={{ fontSize: 32, color: 'primary.main' }} />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {t('users.title')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('users.subtitle')}
            </Typography>
          </Box>
        </Box>

        {/* Î≤ÑÌäº Í∑∏Î£π */}
        {canManage && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="contained"
              startIcon={<PersonAddIcon />}
              onClick={handleAddUser}
            >
              {t('users.addUser')}
            </Button>
            <Button
              variant="outlined"
              startIcon={<SendIcon />}
              onClick={() => setInvitationDialogOpen(true)}
              disabled={!!currentInvitation}
            >
              {t('invitations.createInvitation')}
            </Button>
          </Box>
        )}
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Search */}
            <TextField
              placeholder={t('users.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
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

              {/* Column Settings Button */}
              <Tooltip title={t('users.columnSettings')}>
                <IconButton
                  onClick={(e) => setColumnSettingsAnchor(e.currentTarget)}
                  sx={{
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
          </Box>
        </CardContent>
      </Card>

      {/* ?ºÍ¥Ñ ?ëÏóÖ ?¥Î∞î - Î™©Î°ù ?ÑÎ°ú ?¥Îèô */}
      {selectedUsers.size > 0 && (
        <Card sx={{ mb: 2, bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(110, 168, 255, 0.08)' : 'rgba(25, 118, 210, 0.04)' }}>
          <CardContent sx={{ py: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'space-between' }}>
              <Typography variant="body2" sx={{ fontWeight: 600, color: 'primary.main' }}>
                {selectedUsers.size} {t('users.selectedUsers')}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  size="small"
                  variant="contained"
                  color="primary"
                  onClick={() => handleBulkAction('status')}
                  startIcon={<PersonIcon />}
                >
                  {t('users.bulkUpdateStatus')}
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  color="primary"
                  onClick={() => handleBulkAction('role')}
                  startIcon={<AdminIcon />}
                >
                  {t('users.bulkUpdateRole')}
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  color="primary"
                  onClick={() => handleBulkAction('emailVerified')}
                  startIcon={<CheckCircleIcon />}
                >
                  {t('users.bulkVerifyEmail')}
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  color="primary"
                  onClick={() => handleBulkAction('tags')}
                  startIcon={<TagIcon />}
                >
                  {t('users.bulkUpdateTags')}
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  color="error"
                  onClick={() => handleBulkAction('delete')}
                  startIcon={<DeleteIcon />}
                >
                  {t('users.bulkDelete')}
                </Button>
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Current Invitation Status */}
      {currentInvitation && (
        <InvitationStatusCard
          invitation={currentInvitation}
          onUpdate={handleUpdateInvitation}
          onDelete={handleDeleteInvitation}
        />
      )}

      {/* Users Table */}
      <Card sx={{ position: 'relative' }}>
        <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
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
                      indeterminate={selectedUsers.size > 0 && selectedUsers.size < users.length}
                      checked={users.length > 0 && selectedUsers.size === users.length}
                      onChange={handleSelectAllUsers}
                    />
                  </TableCell>
                  {columns.filter(col => col.visible).map((column) => (
                    <TableCell
                      key={column.id}
                      align={column.id === 'emailVerified' ? 'center' : 'left'}
                      width={column.width}
                    >
                      {t(column.labelKey)}
                    </TableCell>
                  ))}
                  <TableCell>{t('users.createdBy')}</TableCell>
                  <TableCell align="center">{t('common.actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isInitialLoad && loading ? (
                  // ?§Ïºà?àÌÜ§ Î°úÎî© (Ï¥àÍ∏∞ Î°úÎî© ?úÏóêÎß?
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={`skeleton-${index}`}>
                      <TableCell padding="checkbox">
                        <Skeleton variant="rectangular" width={24} height={24} />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Skeleton variant="circular" width={40} height={40} />
                          <Box>
                            <Skeleton variant="text" width={120} />
                            <Skeleton variant="text" width={180} sx={{ fontSize: '0.75rem' }} />
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Skeleton variant="text" width={100} />
                      </TableCell>
                      <TableCell>
                        <Skeleton variant="rounded" width={80} height={24} />
                      </TableCell>
                      <TableCell>
                        <Skeleton variant="rounded" width={70} height={24} />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <Skeleton variant="rounded" width={60} height={24} />
                          <Skeleton variant="rounded" width={60} height={24} />
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Skeleton variant="text" width="70%" />
                      </TableCell>
                      <TableCell>
                        <Skeleton variant="text" width="70%" />
                      </TableCell>
                      <TableCell>
                        <Skeleton variant="text" width="60%" />
                      </TableCell>
                      <TableCell align="center">
                        <Skeleton variant="circular" width={32} height={32} sx={{ mx: 'auto' }} />
                      </TableCell>
                    </TableRow>
                  ))
                ) : users.length === 0 ? (
                  <EmptyTableRow
                    colSpan={columns.filter(col => col.visible).length + 2} // +2 for checkbox and actions columns
                    loading={false}
                    message={t('users.noUsersFound')}
                    loadingMessage={t('common.loadingUsers')}
                    subtitle={canManage ? t('common.addFirstItem') : undefined}
                    onAddClick={canManage ? handleAddUser : undefined}
                    addButtonLabel={t('users.addUser')}
                  />
                ) : (
                  users.map((user) => (
                    <TableRow key={user.id} hover>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedUsers.has(user.id)}
                          onChange={() => handleSelectUser(user.id)}
                        />
                      </TableCell>
                      {columns.filter(col => col.visible).map((column) => (
                        <TableCell
                          key={column.id}
                          align={column.id === 'emailVerified' ? 'center' : 'left'}
                          width={column.width}
                        >
                          {renderCellContent(user, column.id)}
                        </TableCell>
                      ))}
                      <TableCell>
                        {user.createdByName ? (
                          <Box>
                            <Typography variant="body2" fontWeight="medium">
                              {user.createdByName}
                            </Typography>
                            {user.createdByEmail && (
                              <Typography variant="caption" color="text.secondary">
                                {user.createdByEmail}
                              </Typography>
                            )}
                          </Box>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <IconButton
                          onClick={(event) => handleMenuOpen(event, user)}
                          size="small"
                          title={t('common.actions')}
                        >
                          <MoreVertIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {/* ?òÏù¥ÏßÄ?§Ïù¥??- ?∞Ïù¥?∞Í? ?àÏùÑ ?åÎßå ?úÏãú */}
          {total > 0 && (
            <SimplePagination
              count={total}
              page={pageState.page - 1}
              rowsPerPage={pageState.limit}
              onPageChange={(_, newPage) => updatePage(newPage + 1)}
              onRowsPerPageChange={(e) => {
                updateLimit(parseInt(e.target.value, 10));
              }}
              rowsPerPageOptions={[5, 10, 25, 50, 100]}
            />
          )}
        </CardContent>
      </Card>


      {/* Actions Menu */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        {/* Edit: allowed for super admin only if it's their own account */}
        {canManage && (isCurrentUser(selectedUser) || canModifyUser(selectedUser)) && (
          <MenuItem onClick={() => handleMenuAction('edit')}>
            <ListItemIcon>
              <EditIcon />
            </ListItemIcon>
            <ListItemText>{t('common.edit')}</ListItemText>
          </MenuItem>
        )}

        {/* Suspend/Activate: not allowed for own account or super admin */}
        {canManage && canModifyUser(selectedUser) && (selectedUser?.status === 'active' ? (
          <MenuItem
            onClick={() => handleMenuAction('suspend')}
            disabled={isCurrentUser(selectedUser)}
          >
            <ListItemIcon>
              <BlockIcon />
            </ListItemIcon>
            <ListItemText>{t('common.suspend')}</ListItemText>
          </MenuItem>
        ) : (
          <MenuItem
            onClick={() => handleMenuAction('activate')}
            disabled={isCurrentUser(selectedUser)}
          >
            <ListItemIcon>
              <CheckCircleIcon />
            </ListItemIcon>
            <ListItemText>{t('common.activate')}</ListItemText>
          </MenuItem>
        ))}

        {/* Promote: not shown for super admin */}
        {canManage && canModifyUser(selectedUser) && selectedUser?.role === 'user' && selectedUser?.status === 'active' && (
          <MenuItem onClick={() => handleMenuAction('promote')}>
            <ListItemIcon>
              <SecurityIcon />
            </ListItemIcon>
            <ListItemText>{t('common.promoteToAdmin')}</ListItemText>
          </MenuItem>
        )}

        {/* Demote: not allowed for own account or super admin */}
        {canManage && canModifyUser(selectedUser) && selectedUser?.role === 'admin' && (
          <MenuItem
            onClick={() => handleMenuAction('demote')}
            disabled={isCurrentUser(selectedUser)}
          >
            <ListItemIcon>
              <PersonIcon />
            </ListItemIcon>
            <ListItemText>{t('common.demoteFromAdmin')}</ListItemText>
          </MenuItem>
        )}

        {/* Email verification: not shown for super admin (unless own account) */}
        {canManage && canModifyUser(selectedUser) && selectedUser && !selectedUser.emailVerified && (
          <>
            <MenuItem onClick={() => handleMenuAction('verifyEmail')}>
              <ListItemIcon>
                <VerifiedUserIcon />
              </ListItemIcon>
              <ListItemText>{t('users.verifyEmail')}</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => handleMenuAction('resendVerification')}>
              <ListItemIcon>
                <SendIcon />
              </ListItemIcon>
              <ListItemText>{t('users.resendVerification')}</ListItemText>
            </MenuItem>
          </>
        )}

        {/* Delete: not allowed for own account or super admin */}
        {canManage && canModifyUser(selectedUser) && (
          <MenuItem
            onClick={() => handleMenuAction('delete')}
            disabled={isCurrentUser(selectedUser)}
            sx={{ color: 'error.main' }}
          >
            <ListItemIcon sx={{ color: 'inherit' }}>
              <DeleteIcon />
            </ListItemIcon>
            <ListItemText>{t('common.delete')}</ListItemText>
          </MenuItem>
        )}
      </Menu>

      {/* Add User Drawer */}
      <ResizableDrawer
        open={addUserDialog}
        onClose={handleCloseAddUserDialog}
        title={t('users.addUserDialogTitle')}
        subtitle={t('users.addUserDialogDescription')}
        storageKey="usersAddFormDrawerWidth"
        defaultWidth={600}
        minWidth={450}
        zIndex={1300}
      >
        {/* Content */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
          <Box
            component="form"
            autoComplete="off"
            sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}
          >
            <Box>
              <TextField
                fullWidth
                label={t('users.name')}
                value={newUserData.name}
                onChange={(e) => setNewUserData({ ...newUserData, name: e.target.value })}
                autoComplete="new-name"
                placeholder=""
                required
                error={!!newUserErrors.name}
                helperText={newUserErrors.name || t('users.form.nameHelp')}
                autoFocus
              />
            </Box>
            <Box>
              <TextField
                fullWidth
                label={t('users.email')}
                type="email"
                value={newUserData.email}
                onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                autoComplete="new-email"
                placeholder=""
                required
                error={!!newUserErrors.email}
                helperText={newUserErrors.email || t('users.form.emailHelp')}
              />
            </Box>
            <Box>
              <TextField
                fullWidth
                label={t('users.password')}
                type={showPassword ? 'text' : 'password'}
                value={newUserData.password}
                onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
                autoComplete="new-password"
                placeholder=""
                required
                error={!!newUserErrors.password}
                helperText={newUserErrors.password || t('users.form.passwordHelp')}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                        size="small"
                        aria-label={showPassword ? t('users.hidePassword') : t('users.showPassword')}
                      >
                        {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
            <FormControl fullWidth>
              <InputLabel>{t('users.role')}</InputLabel>
              <Select
                value={newUserData.role}
                label={t('users.role')}
                onChange={(e) => setNewUserData({ ...newUserData, role: e.target.value as 'admin' | 'user' })}

              >
                <MenuItem value="user">{t('users.roles.user')}</MenuItem>
                <MenuItem value="admin">{t('users.roles.admin')}</MenuItem>
              </Select>
              <FormHelperText>{t('users.roleHelp')}</FormHelperText>
            </FormControl>

            {/* Tags Selection */}
            <Box>
              <Autocomplete
                multiple
                options={availableTags}
                getOptionLabel={(option) => option.name}
                filterSelectedOptions
                isOptionEqualToValue={(option, value) => option.id === value.id}
                value={newUserTags}
                onChange={(_, value) => setNewUserTags(value)}
                slotProps={{
                  popper: {
                    style: {
                      zIndex: 9999
                    }
                  }
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
                          sx={{ bgcolor: option.color, color: getContrastColor(option.color) }}
                          {...chipProps}
                        />
                      </Tooltip>
                    );
                  })
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={t('users.tags')}
                    helperText={t('users.tagsHelp')}
                  />
                )}
                renderOption={(props, option) => {
                  const { key, ...otherProps } = props;
                  return (
                    <Box component="li" key={key} {...otherProps}>
                      <Chip
                        label={option.name}
                        size="small"
                        sx={{ bgcolor: option.color, color: getContrastColor(option.color), mr: 1 }}
                      />
                      {option.description || t('common.noDescription')}
                    </Box>
                  );
                }}
              />
            </Box>

            {/* Environment Access */}
            <Box sx={{ mt: 2 }}>
              <PermissionSelector
                permissions={[]}
                onChange={() => { }}
                showTitle={false}
                showSelectAll={false}
                showEnvironments={true}
                environments={environments.map(env => ({
                  id: env.id,
                  name: env.environmentName,
                  displayName: env.displayName,
                  environmentName: env.environmentName
                }))}
                allowAllEnvs={newUserAllowAllEnvs}
                selectedEnvironments={newUserEnvIds}
                onAllowAllEnvsChange={setNewUserAllowAllEnvs}
                onEnvironmentsChange={setNewUserEnvIds}
              />
            </Box>
          </Box>
        </Box>

        {/* Footer */}
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
            onClick={handleCloseAddUserDialog}
            startIcon={<CancelIcon />}
            variant="outlined"
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleCreateUser}
            variant="contained"
            startIcon={<AddIcon />}
          >
            {t('users.addUser')}
          </Button>
        </Box>
      </ResizableDrawer>

      {/* Confirmation Drawer */}
      <Drawer
        anchor="right"
        open={confirmDialog.open}
        onClose={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
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
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, p: 2 }}>
          <Typography>{confirmDialog.message}</Typography>
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
            onClick={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
            variant="outlined"
            disabled={confirmDialogLoading}
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={confirmDialog.action}
            color="error"
            variant="contained"
            disabled={confirmDialogLoading}
          >
            {confirmDialogLoading ? <CircularProgress size={20} color="inherit" /> : t('common.confirm')}
          </Button>
        </Box>
      </Drawer>

      {/* Delete Confirmation Drawer */}
      <Drawer
        anchor="right"
        open={deleteConfirmDialog.open}
        onClose={() => setDeleteConfirmDialog({ open: false, user: null, inputValue: '' })}
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
            {t('users.deleteUser')}
          </Typography>
          <IconButton
            onClick={() => setDeleteConfirmDialog({ open: false, user: null, inputValue: '' })}
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
          <Alert severity="warning" sx={{ mb: 2 }}>
            {t('users.deleteConfirmation')}
          </Alert>
          <Typography variant="body2" sx={{ mb: 2 }}>
            {t('users.deleteConfirmationInput')}
            <strong> {deleteConfirmDialog.user?.email}</strong>
          </Typography>
          <TextField
            fullWidth
            label={t('users.email')}
            value={deleteConfirmDialog.inputValue}
            onChange={(e) => setDeleteConfirmDialog(prev => ({ ...prev, inputValue: e.target.value }))}
            placeholder={deleteConfirmDialog.user?.email}
            error={deleteConfirmDialog.inputValue !== '' && deleteConfirmDialog.inputValue !== deleteConfirmDialog.user?.email}
            helperText={deleteConfirmDialog.inputValue !== '' && deleteConfirmDialog.inputValue !== deleteConfirmDialog.user?.email ? t('users.emailDoesNotMatch') : ''}
          />
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
            onClick={() => setDeleteConfirmDialog({ open: false, user: null, inputValue: '' })}
            color="inherit"
            startIcon={<CancelIcon />}
            variant="outlined"
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleConfirmDeleteUser}
            color="error"
            variant="contained"
            disabled={deleteConfirmDialog.inputValue !== deleteConfirmDialog.user?.email}
            startIcon={<DeleteIcon />}
          >
            {t('common.delete')}
          </Button>
        </Box>
      </Drawer>

      {/* Promote User Drawer */}
      <ResizableDrawer
        open={promoteDialog.open}
        onClose={handlePromoteCancel}
        title={promoteDialog.showReview ? t('users.reviewChanges') : t('common.promoteUser')}
        subtitle={promoteDialog.showReview ? t('users.reviewChangesDesc') : t('users.selectPermissionsDesc')}
        storageKey="usersPromoteFormDrawerWidth"
        defaultWidth={600}
        minWidth={450}
        zIndex={1301}
      >
        {/* Content */}
        <Box sx={{ flex: 1, p: 2, overflow: 'auto' }}>
          {promoteDialog.user && !promoteDialog.showReview && (
            <>
              <Alert severity="info" sx={{ mb: 2 }}>
                {t('common.promoteUserConfirm', { name: promoteDialog.user.name })}
              </Alert>

              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                {t('users.selectPermissions')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('users.selectPermissionsDesc')}
              </Typography>

              <PermissionSelector
                permissions={promoteDialog.permissions}
                onChange={(permissions) => setPromoteDialog(prev => ({ ...prev, permissions }))}
                showTitle={false}
                showEnvironments={true}
                environments={environments.map(env => ({
                  id: env.id,
                  name: env.environmentName,
                  displayName: env.displayName,
                  environmentName: env.environmentName
                }))}
                allowAllEnvs={promoteDialog.allowAllEnvs}
                selectedEnvironments={promoteDialog.selectedEnvironments}
                onAllowAllEnvsChange={(allowAll) => setPromoteDialog(prev => ({ ...prev, allowAllEnvs: allowAll }))}
                onEnvironmentsChange={(environments) => setPromoteDialog(prev => ({ ...prev, selectedEnvironments: environments }))}
              />
            </>
          )}

          {promoteDialog.user && promoteDialog.showReview && (
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('users.reviewChangesDesc')}
              </Typography>
              <Box sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                p: 2,
                bgcolor: 'background.default',
                borderRadius: 1,
                border: 1,
                borderColor: 'divider',
              }}>
                {/* User Info */}
                <Box sx={{ pb: 2, borderBottom: 1, borderColor: 'divider' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    {t('users.user')}
                  </Typography>
                  <Typography variant="body2" fontWeight={500}>
                    {promoteDialog.user.name} ({promoteDialog.user.email})
                  </Typography>
                </Box>

                {/* Role Change */}
                <Box sx={{ pb: 2, borderBottom: 1, borderColor: 'divider' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    {t('users.role')}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" color="text.disabled" sx={{ textDecoration: 'line-through' }}>
                      {t('users.roles.user')}
                    </Typography>
                    <ArrowForwardIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                    <Chip
                      label={t('users.roles.admin')}
                      size="small"
                      color="primary"
                      variant="filled"
                    />
                  </Box>
                </Box>

                {/* Permissions */}
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    {t('users.permissions')} ({promoteDialog.permissions.length} {t('users.permissionsCount')})
                  </Typography>
                  {promoteDialog.permissions.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" fontStyle="italic">
                      {t('users.noPermissionsSelected')}
                    </Typography>
                  ) : (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {promoteDialog.permissions.map(perm => {
                        const permKey = perm.replace('.', '_');
                        const tooltipText = t(`permissions.${permKey}_desc`, { defaultValue: '' });
                        return (
                          <Tooltip key={perm} title={tooltipText} arrow placement="top" enterDelay={200}>
                            <Chip
                              label={t(`permissions.${permKey}`)}
                              size="small"
                              color="success"
                              variant="outlined"
                              sx={{ fontSize: '0.75rem' }}
                            />
                          </Tooltip>
                        );
                      })}
                    </Box>
                  )}
                </Box>

                {/* Environment Access */}
                <Box sx={{ pt: 2, borderTop: 1, borderColor: 'divider' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    {t('users.environmentAccess')}
                  </Typography>
                  {promoteDialog.allowAllEnvs ? (
                    <Chip
                      label={t('users.allowAllEnvironments')}
                      size="small"
                      color="warning"
                      variant="filled"
                      sx={{ fontSize: '0.75rem' }}
                    />
                  ) : promoteDialog.selectedEnvironments.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" fontStyle="italic">
                      {t('users.noEnvironmentsSelected')}
                    </Typography>
                  ) : (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {promoteDialog.selectedEnvironments.map(envName => {
                        const env = environments.find(e => e.environment === envName);
                        const displayName = env?.displayName || env?.environmentName || envName;
                        return (
                          <Tooltip key={envName} title={t('users.environmentAccessDesc', { name: displayName })} arrow placement="top" enterDelay={200}>
                            <Chip
                              label={displayName}
                              size="small"
                              color="success"
                              variant="outlined"
                              sx={{ fontSize: '0.75rem' }}
                            />
                          </Tooltip>
                        );
                      })}
                    </Box>
                  )}
                </Box>
              </Box>
            </Box>
          )}
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
          {!promoteDialog.showReview ? (
            <>
              <Button
                onClick={handlePromoteCancel}
                variant="outlined"
                disabled={promoteDialog.loading}
              >
                {t('common.cancel')}
              </Button>
              <Button
                onClick={handlePromoteReview}
                color="primary"
                variant="contained"
                startIcon={<PreviewIcon />}
              >
                {t('common.review')}
              </Button>
            </>
          ) : (
            <>
              <Button
                onClick={handlePromoteBackToEdit}
                variant="outlined"
                disabled={promoteDialog.loading}
                startIcon={<ArrowBackIcon />}
              >
                {t('common.reReview')}
              </Button>
              <Button
                onClick={handlePromoteConfirm}
                color="primary"
                variant="contained"
                disabled={promoteDialog.loading}
                startIcon={promoteDialog.loading ? <CircularProgress size={16} color="inherit" /> : <SecurityIcon />}
              >
                {promoteDialog.loading ? t('common.saving') : t('common.apply')}
              </Button>
            </>
          )}
        </Box>
      </ResizableDrawer>

      {/* Edit User Drawer */}
      <ResizableDrawer
        open={editUserDialog.open}
        onClose={() => setEditUserDialog({ open: false, user: null })}
        title={t('users.editUserDialogTitle')}
        subtitle={t('users.editUserDialogDescription')}
        storageKey="usersEditFormDrawerWidth"
        defaultWidth={600}
        minWidth={450}
        zIndex={1300}
      >
        {/* Content */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Box>
              <TextField
                label={t('users.name')}
                value={editUserData.name}
                onChange={(e) => setEditUserData({ ...editUserData, name: e.target.value })}
                fullWidth
                error={!!editUserErrors.name}
                helperText={editUserErrors.name || t('users.form.nameHelp')}
                autoFocus
              />
            </Box>
            <Box>
              <TextField
                label={t('users.email')}
                value={editUserData.email}
                onChange={(e) => setEditUserData({ ...editUserData, email: e.target.value })}
                fullWidth
                disabled={editUserDialog.user && isCurrentUser(editUserDialog.user)}
                error={!!editUserErrors.email}
                helperText={editUserErrors.email || t('users.form.emailHelp')}
              />
            </Box>

            {/* ?¥Î©î???∏Ï¶ù ?ÅÌÉú Î∞??°ÏÖò */}
            {editUserDialog.user && !isCurrentUser(editUserDialog.user) && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: 1, borderColor: 'divider' }}>
                <EmailIcon color={editUserDialog.user.emailVerified ? 'success' : 'warning'} />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" fontWeight="medium">
                    {t('users.emailVerification')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {editUserDialog.user.emailVerified
                      ? t('users.emailVerified')
                      : t('users.emailNotVerified')
                    }
                  </Typography>
                </Box>
                {!editUserDialog.user.emailVerified && (
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => handleVerifyUserEmail(editUserDialog.user!.id)}
                      disabled={emailVerificationLoading}
                      startIcon={emailVerificationLoading ? <CircularProgress size={16} /> : <VerifiedUserIcon />}
                    >
                      {t('users.verifyEmail')}
                    </Button>
                    <Button
                      size="small"
                      variant="text"
                      onClick={() => handleResendVerificationEmail(editUserDialog.user!.id)}
                      disabled={emailVerificationLoading}
                      startIcon={emailVerificationLoading ? <CircularProgress size={16} /> : <SendIcon />}
                    >
                      {t('users.resendVerification')}
                    </Button>
                  </Box>
                )}
              </Box>
            )}

            {!(editUserDialog.user && isCurrentUser(editUserDialog.user)) && (
              <>
                <FormControl fullWidth>
                  <InputLabel>{t('users.role')}</InputLabel>
                  <Select
                    value={editUserData.role}
                    onChange={(e) => setEditUserData({ ...editUserData, role: e.target.value as 'admin' | 'user' })}
                    label={t('users.role')}

                  >
                    <MenuItem value="user">{t('users.roles.user')}</MenuItem>
                    <MenuItem value="admin">{t('users.roles.admin')}</MenuItem>
                  </Select>
                  <FormHelperText>{t('users.roleHelp')}</FormHelperText>
                </FormControl>
                <FormControl fullWidth>
                  <InputLabel>{t('users.status')}</InputLabel>
                  <Select
                    value={editUserData.status}
                    onChange={(e) => setEditUserData({ ...editUserData, status: e.target.value as any })}
                    label={t('users.status')}

                  >
                    <MenuItem value="pending">{t('users.statuses.pending')}</MenuItem>
                    <MenuItem value="active">{t('users.statuses.active')}</MenuItem>
                    <MenuItem value="suspended">{t('users.statuses.suspended')}</MenuItem>
                  </Select>
                  <FormHelperText>{t('users.statusHelp')}</FormHelperText>
                </FormControl>
              </>
            )}

            {/* Tags Selection for Edit */}
            <Box>
              <Autocomplete
                multiple
                options={availableTags}
                getOptionLabel={(option) => option.name}
                filterSelectedOptions
                isOptionEqualToValue={(option, value) => option.id === value.id}
                value={editUserTags}
                onChange={(_, value) => setEditUserTags(value)}
                slotProps={{
                  popper: {
                    style: {
                      zIndex: 9999
                    }
                  }
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
                          sx={{ bgcolor: option.color, color: getContrastColor(option.color) }}
                          {...chipProps}
                        />
                      </Tooltip>
                    );
                  })
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={t('users.tags')}
                    helperText={t('users.tagsHelp')}
                  />
                )}
                renderOption={(props, option) => {
                  const { key, ...otherProps } = props;
                  return (
                    <Box component="li" key={key} {...otherProps}>
                      <Chip
                        label={option.name}
                        size="small"
                        sx={{ bgcolor: option.color, color: getContrastColor(option.color), mr: 1 }}
                      />
                      {option.description || t('common.noDescription')}
                    </Box>
                  );
                }}
              />
            </Box>

            {/* Permissions & Environment Access Section - Only for admin users */}
            {!(editUserDialog.user && isCurrentUser(editUserDialog.user)) && editUserData.role === 'admin' && (
              <Box sx={{ mt: 2 }}>
                <PermissionSelector
                  permissions={editUserPermissions}
                  onChange={setEditUserPermissions}
                  loading={permissionsLoading}
                  showEnvironments={true}
                  environments={environments.map(env => ({
                    id: env.id,
                    name: env.environmentName,
                    displayName: env.displayName,
                    environmentName: env.environmentName
                  }))}
                  allowAllEnvs={editUserAllowAllEnvs}
                  selectedEnvironments={editUserEnvIds}
                  onAllowAllEnvsChange={setEditUserAllowAllEnvs}
                  onEnvironmentsChange={setEditUserEnvIds}
                />
              </Box>
            )}

            {/* Non-admin users cannot access environments */}
            {!(editUserDialog.user && isCurrentUser(editUserDialog.user)) && editUserData.role !== 'admin' && (
              <Alert severity="info" sx={{ mt: 2 }}>
                {t('users.noEnvironmentAccessForUser')}
              </Alert>
            )}

            {editUserDialog.user && isCurrentUser(editUserDialog.user) && (
              <Alert severity="info">
                {t('users.canOnlyModifyOwnName')}
              </Alert>
            )}
          </Box>
        </Box>

        {/* Footer */}
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
            onClick={() => setEditUserDialog({ open: false, user: null })}
            startIcon={<CancelIcon />}
            variant="outlined"
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleOpenReview}
            variant="contained"
            startIcon={<PreviewIcon />}
          >
            {t('common.review')}
          </Button>
        </Box>
      </ResizableDrawer>

      {/* Review Changes Dialog */}
      <Dialog
        open={reviewDialog.open}
        onClose={handleCloseReview}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 2 }
        }}
      >
        <DialogTitle sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          borderBottom: 1,
          borderColor: 'divider',
        }}>
          <PreviewIcon color="primary" />
          {t('users.reviewChanges')}
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          {(() => {
            const changes = getChanges();
            if (changes.length === 0) {
              return (
                <Alert severity="info" sx={{ mt: 1 }}>
                  {t('users.noChanges')}
                </Alert>
              );
            }
            return (
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {t('users.reviewChangesDesc')}
                </Typography>
                <Box sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1.5,
                  p: 2,
                  bgcolor: 'background.default',
                  borderRadius: 1,
                  border: 1,
                  borderColor: 'divider',
                }}>
                  {changes.map((change, index) => (
                    <Box key={index} sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 0.5,
                      pb: index < changes.length - 1 ? 1.5 : 0,
                      borderBottom: index < changes.length - 1 ? 1 : 0,
                      borderColor: 'divider',
                    }}>
                      <Typography variant="subtitle2" fontWeight={600} color="text.primary">
                        {change.field}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Typography
                          variant="body2"
                          sx={{
                            textDecoration: 'line-through',
                            color: 'error.main',
                            bgcolor: 'error.main',
                            backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(211, 47, 47, 0.15)' : 'rgba(211, 47, 47, 0.08)',
                            px: 1,
                            py: 0.25,
                            borderRadius: 0.5,
                          }}
                        >
                          {change.from}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">??/Typography>
                        <Typography
                          variant="body2"
                          sx={{
                            color: 'success.main',
                            bgcolor: 'success.main',
                            backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(46, 125, 50, 0.15)' : 'rgba(46, 125, 50, 0.08)',
                            px: 1,
                            py: 0.25,
                            borderRadius: 0.5,
                            fontWeight: 500,
                          }}
                        >
                          {change.to}
                        </Typography>
                      </Box>
                      {/* Show permission details if available */}
                      {change.details && (
                        <Box sx={{ mt: 1, pl: 1, borderLeft: 2, borderColor: 'divider' }}>
                          {change.details.added && change.details.added.length > 0 && (
                            <Box sx={{ mb: 0.5 }}>
                              <Typography variant="caption" color="success.main" sx={{ display: 'block', mb: 0.5, fontWeight: 600 }}>
                                + {t('users.added')}:
                              </Typography>
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                {change.details.added.map((perm, i) => {
                                  const permKey = change.details?.addedKeys?.[i];
                                  const tooltipText = permKey ? t(`permissions.${permKey.replace('.', '_')}_desc`, { defaultValue: '' }) : '';
                                  return (
                                    <Tooltip key={i} title={tooltipText} arrow placement="top" enterDelay={200}>
                                      <Chip label={perm} size="small" color="success" variant="outlined" sx={{ fontSize: '0.7rem', height: 22 }} />
                                    </Tooltip>
                                  );
                                })}
                              </Box>
                            </Box>
                          )}
                          {change.details.removed && change.details.removed.length > 0 && (
                            <Box>
                              <Typography variant="caption" color="error.main" sx={{ display: 'block', mb: 0.5, fontWeight: 600 }}>
                                - {t('users.removed')}:
                              </Typography>
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                {change.details.removed.map((perm, i) => {
                                  const permKey = change.details?.removedKeys?.[i];
                                  const tooltipText = permKey ? t(`permissions.${permKey.replace('.', '_')}_desc`, { defaultValue: '' }) : '';
                                  return (
                                    <Tooltip key={i} title={tooltipText} arrow placement="top" enterDelay={200}>
                                      <Chip label={perm} size="small" color="error" variant="outlined" sx={{ fontSize: '0.7rem', height: 22 }} />
                                    </Tooltip>
                                  );
                                })}
                              </Box>
                            </Box>
                          )}
                        </Box>
                      )}
                    </Box>
                  ))}
                </Box>
              </Box>
            );
          })()}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, borderTop: 1, borderColor: 'divider' }}>
          <Button
            onClick={handleCloseReview}
            startIcon={<ArrowBackIcon />}
            variant="outlined"
            disabled={reviewDialog.saving}
          >
            {t('common.reReview')}
          </Button>
          <Button
            onClick={handleConfirmSave}
            variant="contained"
            startIcon={reviewDialog.saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
            disabled={reviewDialog.saving || getChanges().length === 0}
          >
            {reviewDialog.saving ? t('common.saving') : t('common.apply')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Action Drawer */}
      <Drawer
        anchor="right"
        open={bulkActionDialogOpen}
        onClose={() => setBulkActionDialogOpen(false)}
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 3, // AppBar(theme.zIndex.drawer+2)Î≥¥Îã§ ?íÍ≤å
          '& .MuiDrawer-paper': {
            width: { xs: '100%', sm: 500 },
            maxWidth: '100vw',
            display: 'flex',
            flexDirection: 'column',
          }
        }}
      >
        {/* Header */}
        <Box sx={{
          p: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper'
        }}>
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 1
          }}>
            <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
              {t(`users.bulk${bulkActionType.charAt(0).toUpperCase() + bulkActionType.slice(1)}`)} ({selectedUsers.size} {t('users.selectedUsers')})
            </Typography>
            <IconButton
              onClick={() => setBulkActionDialogOpen(false)}
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
          <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>
            {t(`users.bulk${bulkActionType.charAt(0).toUpperCase() + bulkActionType.slice(1)}Subtitle`)}
          </Typography>
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
          {bulkActionType === 'status' && (
            <FormControl fullWidth sx={{ mt: 2 }}>
              <InputLabel>{t('users.status')}</InputLabel>
              <Select
                value={bulkActionValue}
                label={t('users.status')}
                onChange={(e) => setBulkActionValue(e.target.value)}
              >
                <MenuItem value="active">{t('users.statuses.active')}</MenuItem>
                <MenuItem value="pending">{t('users.statuses.pending')}</MenuItem>
                <MenuItem value="suspended">{t('users.statuses.suspended')}</MenuItem>
              </Select>
            </FormControl>
          )}
          {bulkActionType === 'role' && (
            <FormControl fullWidth sx={{ mt: 2 }}>
              <InputLabel>{t('users.role')}</InputLabel>
              <Select
                value={bulkActionValue}
                label={t('users.role')}
                onChange={(e) => setBulkActionValue(e.target.value)}
              >
                <MenuItem value="user">{t('users.roles.user')}</MenuItem>
                <MenuItem value="admin">{t('users.roles.admin')}</MenuItem>
              </Select>
            </FormControl>
          )}
          {bulkActionType === 'emailVerified' && (
            <FormControl fullWidth sx={{ mt: 2 }}>
              <InputLabel>{t('users.emailVerified')}</InputLabel>
              <Select
                value={bulkActionValue}
                label={t('users.emailVerified')}
                onChange={(e) => setBulkActionValue(e.target.value)}
              >
                <MenuItem value="true">{t('users.verified')}</MenuItem>
                <MenuItem value="false">{t('users.unverified')}</MenuItem>
              </Select>
            </FormControl>
          )}
          {bulkActionType === 'tags' && (
            <Box sx={{ mt: 2 }}>
              <Autocomplete
                multiple
                options={availableTags}
                getOptionLabel={(option) => option.name}
                filterSelectedOptions
                isOptionEqualToValue={(option, value) => option.id === value.id}
                value={bulkActionTags}
                onChange={(_, value) => setBulkActionTags(value)}
                slotProps={{
                  popper: {
                    style: {
                      zIndex: 1500 // DrawerÎ≥¥Îã§ ?íÏ? zIndex
                    }
                  }
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
                          sx={{ bgcolor: option.color, color: getContrastColor(option.color) }}
                          {...chipProps}
                        />
                      </Tooltip>
                    );
                  })
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={t('users.tags')}
                    helperText={t('users.bulkTagsHelperText')}
                  />
                )}
                renderOption={(props, option) => {
                  const { key, ...otherProps } = props;
                  return (
                    <Box component="li" key={key} {...otherProps}>
                      <Chip
                        label={option.name}
                        size="small"
                        sx={{ bgcolor: option.color, color: getContrastColor(option.color), mr: 1 }}
                      />
                      {option.description || t('common.noDescription')}
                    </Box>
                  );
                }}
              />
            </Box>
          )}

          {/* Í≥µÌÜµ ?Ä??ÎØ∏Î¶¨Î≥¥Í∏∞ (??†ú ???°ÏÖò?êÎèÑ ?úÏãú) */}
          {bulkActionType !== 'delete' && selectedUsers.size > 0 && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'medium' }}>
                {t('users.targetList')}:
              </Typography>
              <Box sx={{
                maxHeight: 300,
                overflow: 'auto',
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                bgcolor: 'background.paper'
              }}>
                {users
                  .filter(user => selectedUsers.has(user.id))
                  .map(user => (
                    <Box
                      key={user.id}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        p: 2,
                        borderBottom: 1,
                        borderColor: 'divider',
                        '&:last-child': { borderBottom: 0 }
                      }}
                    >
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                          {user.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {user.email}
                        </Typography>
                      </Box>
                      <Chip
                        label={t(`users.statuses.${user.status}`)}
                        size="small"
                        variant="outlined"
                        sx={{ mr: 1 }}
                      />
                      <Chip
                        label={t(`users.roles.${user.role}`)}
                        size="small"
                        color={user.role === 'admin' ? 'error' : 'default'}
                        variant="outlined"
                      />
                    </Box>
                  ))
                }
              </Box>
            </Box>
          )}

          {bulkActionType === 'delete' && (
            <Box sx={{ mt: 2 }}>
              <Typography sx={{ mb: 2, fontWeight: 'medium' }}>
                {t('users.bulkDeleteConfirm', { count: selectedUsers.size })}
              </Typography>

              {/* ??†ú ?Ä???¨Ïö©??Î™©Î°ù */}
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'medium' }}>
                {t('users.deleteTargetUsers')}:
              </Typography>
              <Box sx={{
                maxHeight: 300,
                overflow: 'auto',
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                bgcolor: 'background.paper'
              }}>
                {users
                  .filter(user => selectedUsers.has(user.id))
                  .map(user => (
                    <Box
                      key={user.id}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        p: 2,
                        borderBottom: 1,
                        borderColor: 'divider',
                        '&:last-child': { borderBottom: 0 }
                      }}
                    >
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                          {user.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {user.email}
                        </Typography>
                      </Box>
                      <Chip
                        label={t(`users.roles.${user.role}`)}
                        size="small"
                        color={user.role === 'admin' ? 'error' : 'default'}
                        variant="outlined"
                      />
                    </Box>
                  ))
                }
              </Box>
            </Box>
          )}
        </Box>

        {/* Footer */}
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
            onClick={() => setBulkActionDialogOpen(false)}
            startIcon={<CancelIcon />}
            variant="outlined"
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={executeBulkAction}
            variant="contained"
            color={bulkActionType === 'delete' ? 'error' : 'primary'}
            startIcon={bulkActionType === 'delete' ? <DeleteIcon /> : <SaveIcon />}
            disabled={!isBulkActionValid()}
          >
            {t('common.save')}
          </Button>
        </Box>
      </Drawer>

      {/* Invitation Form Drawer */}
      <Drawer
        anchor="right"
        open={invitationDialogOpen}
        onClose={() => setInvitationDialogOpen(false)}
        sx={{
          zIndex: 1300,
          '& .MuiDrawer-paper': {
            width: { xs: '100%', sm: 400 },
            maxWidth: '100vw',
            height: '100vh', // ?ÑÏ≤¥ ?îÎ©¥ ?íÏù¥ ?¨Ïö©
            top: 0, // ?ÅÎã®??Î∂ôÏûÑ
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
            {t('invitations.drawerTitle')}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton
              onClick={loadCurrentInvitation}
              size="small"
              sx={{
                '&:hover': {
                  backgroundColor: 'action.hover'
                }
              }}
              title={t('common.refresh')}
            >
              <RefreshIcon />
            </IconButton>
            <IconButton
              onClick={() => setInvitationDialogOpen(false)}
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
        </Box>

        {/* Content - ?§ÌÅ¨Î°?Í∞Ä??*/}
        <Box sx={{
          flex: 1,
          overflow: 'auto',
        }}>
          <InvitationForm
            onSubmit={handleCreateInvitation}
            onCancel={() => setInvitationDialogOpen(false)}
            isDrawer={true}
          />
        </Box>
      </Drawer>

      {/* Column Settings Popover */}
      <Popover
        open={Boolean(columnSettingsAnchor)}
        anchorEl={columnSettingsAnchor}
        onClose={() => setColumnSettingsAnchor(null)}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
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

export default UsersManagementPage;
