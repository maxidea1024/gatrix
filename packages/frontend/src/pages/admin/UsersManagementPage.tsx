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
} from '@mui/material';
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
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { User, Tag } from '@/types';
import { apiService } from '@/services/api';
import { tagService } from '@/services/tagService';
import { UserService } from '@/services/users';
import { formatDateTimeDetailed } from '../../utils/dateFormat';
import { useAuth } from '@/hooks/useAuth';
import SimplePagination from '../../components/common/SimplePagination';
import FormDialogHeader from '../../components/common/FormDialogHeader';
import { invitationService } from '../../services/invitationService';
import { Invitation, CreateInvitationRequest } from '../../types/invitation';
import InvitationForm from '../../components/admin/InvitationForm';
import InvitationStatusCard from '../../components/admin/InvitationStatusCard';
import EmptyTableRow from '../../components/common/EmptyTableRow';
import { useDebounce } from '../../hooks/useDebounce';
import { usePageState } from '../../hooks/usePageState';
import DynamicFilterBar, { FilterDefinition, ActiveFilter } from '../../components/common/DynamicFilterBar';
import { usePaginatedApi, useTags } from '../../hooks/useSWR';
// SSE는 MainLayout에서 전역으로 처리하므로 여기서는 제거

interface UsersResponse {
  users: User[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const UsersManagementPage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { user: currentUser, isLoading: authLoading } = useAuth();

  // Helper function to check if user is current user
  const isCurrentUser = (user: User | null): boolean => {
    return currentUser?.id === user?.id;
  };

  // 클립보드 복사 함수
  const copyToClipboard = async (text: string, type: 'name' | 'email') => {
    try {
      await navigator.clipboard.writeText(text);
      enqueueSnackbar(
        t(type === 'name' ? 'users.nameCopied' : 'users.emailCopied'),
        { variant: 'success' }
      );
    } catch (error) {
      enqueueSnackbar(t('common.copyFailed'), { variant: 'error' });
    }
  };

  // 페이지 상태 관리 (URL params 연동)
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

  // 동적 필터 상태
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);
  const [filtersInitialized, setFiltersInitialized] = useState(false);

  // 디바운싱된 검색어
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  // SWR로 데이터 로딩
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

  // 초기 로딩 상태 추적
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  useEffect(() => {
    if (!loading && isInitialLoad) {
      setIsInitialLoad(false);
    }
  }, [loading, isInitialLoad]);

  // 동적 필터에서 값 추출 (useMemo로 참조 안정화)
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

  // 배열을 문자열로 변환하여 의존성 배열에 사용
  const statusFilterString = useMemo(() => statusFilter.join(','), [statusFilter]);
  const roleFilterString = useMemo(() => roleFilter.join(','), [roleFilter]);
  const tagIdsString = useMemo(() => tagIds.join(','), [tagIds]);

  // 일괄 선택 관련 상태
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
    action: () => {},
  });

  // 초대 관련 상태
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

  // 이메일 인증 관련 상태
  const [emailVerificationLoading, setEmailVerificationLoading] = useState(false);

  // 현재 초대 정보 로드
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

  // SWR이 자동으로 데이터를 로드하므로 fetchUsers 함수 제거

  // 초대링크 이벤트 처리 (MainLayout에서 전달받음)
  useEffect(() => {
    const handleInvitationChange = (event: CustomEvent) => {
      const sseEvent = event.detail;
      if (sseEvent.type === 'invitation_created' || sseEvent.type === 'invitation_deleted') {
        // 초대링크 상태가 변경되면 현재 초대 정보를 다시 로드
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
    loadCurrentInvitation(); // 초대 기능 활성화
  }, []);

  // 동적 필터 정의
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

  // 페이지 로드 시 pageState.filters에서 activeFilters 복원
  useEffect(() => {
    if (filtersInitialized) return;

    if (!pageState.filters || Object.keys(pageState.filters).length === 0) {
      setFiltersInitialized(true);
      return;
    }

    const restoredFilters: ActiveFilter[] = [];
    const filters = pageState.filters;

    // status 필터 복원
    if (filters.status) {
      restoredFilters.push({
        key: 'status',
        value: Array.isArray(filters.status) ? filters.status : [filters.status],
        label: t('users.statusFilter'),
        operator: filters.status_operator || 'any_of',
      });
    }

    // role 필터 복원
    if (filters.role) {
      restoredFilters.push({
        key: 'role',
        value: Array.isArray(filters.role) ? filters.role : [filters.role],
        label: t('users.roleFilter'),
        operator: filters.role_operator || 'any_of',
      });
    }

    // tags 필터 복원
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

  // activeFilters 변경 시 pageState.filters 업데이트
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

  // 동적 필터 핸들러
  const handleFilterAdd = (filter: ActiveFilter) => {
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

  // 체크박스 핸들러
  const handleSelectUser = (userId: number) => {
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

  // 일괄 처리 핸들러
  const handleBulkAction = (actionType: 'status' | 'role' | 'tags' | 'emailVerified' | 'delete') => {
    // 오픈 시 값 초기화 (이전에 선택한 값 유지 방지)
    setBulkActionType(actionType);
    setBulkActionValue('');
    setBulkActionTags([]);
    setBulkActionDialogOpen(true);
  };

  // 일괄 작업 저장 버튼 활성화 조건 확인
  const isBulkActionValid = () => {
    switch (bulkActionType) {
      case 'status':
      case 'role':
      case 'emailVerified':
        return bulkActionValue !== '';
      case 'tags':
        // 태그는 빈 배열도 허용 (태그 제거 목적)
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

      mutateUsers(); // SWR cache 갱신
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
        try {
          await apiService.post(`/admin/users/${user.id}/suspend`);
          enqueueSnackbar(t('common.userSuspended'), { variant: 'success' });
          mutateUsers(); // SWR cache 갱신
        } catch (error: any) {
          enqueueSnackbar(error.message || t('common.userSuspendFailed'), { variant: 'error' });
        }
        setConfirmDialog(prev => ({ ...prev, open: false }));
      },
    });
  };

  const handleActivateUser = (user: User) => {
    setConfirmDialog({
      open: true,
      title: t('common.activateUser'),
      message: t('common.activateUserConfirm', { name: user.name }),
      action: async () => {
        try {
          await apiService.post(`/admin/users/${user.id}/activate`);
          enqueueSnackbar(t('common.userActivated'), { variant: 'success' });
          mutateUsers(); // SWR cache 갱신
        } catch (error: any) {
          enqueueSnackbar(error.message || t('common.userActivateFailed'), { variant: 'error' });
        }
        setConfirmDialog(prev => ({ ...prev, open: false }));
      },
    });
  };

  const handlePromoteUser = (user: User) => {
    setConfirmDialog({
      open: true,
      title: t('common.promoteUser'),
      message: t('common.promoteUserConfirm', { name: user.name }),
      action: async () => {
        try {
          await apiService.post(`/admin/users/${user.id}/promote`);
          enqueueSnackbar(t('common.userPromoted'), { variant: 'success' });
          mutateUsers(); // SWR cache 갱신
        } catch (error: any) {
          enqueueSnackbar(error.message || t('common.userPromoteFailed'), { variant: 'error' });
        }
        setConfirmDialog(prev => ({ ...prev, open: false }));
      },
    });
  };

  const handleDemoteUser = (user: User) => {
    setConfirmDialog({
      open: true,
      title: t('common.demoteUser'),
      message: t('common.demoteUserConfirm', { name: user.name }),
      action: async () => {
        try {
          await apiService.post(`/admin/users/${user.id}/demote`);
          enqueueSnackbar(t('common.userDemoted'), { variant: 'success' });
          mutateUsers(); // SWR cache 갱신
        } catch (error: any) {
          enqueueSnackbar(error.message || t('common.userDemoteFailed'), { variant: 'error' });
        }
        setConfirmDialog(prev => ({ ...prev, open: false }));
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

  const handleEditUser = (user: User) => {
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
    setEditUserDialog({ open: true, user });
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

  const handleSaveEditUser = async () => {
    if (!editUserDialog.user) return;

    // 폼 검증
    if (!validateEditUserForm()) {
      return;
    }

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
      }

      enqueueSnackbar(t('users.userUpdated'), { variant: 'success' });
      mutateUsers(); // SWR cache 갱신
      setEditUserDialog({ open: false, user: null });
    } catch (error: any) {
      // API 오류 응답에서 구체적인 메시지 추출
      const errorMessage = error.error?.message || error.message || t('users.updateError');
      enqueueSnackbar(errorMessage, { variant: 'error' });
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
        mutateUsers(); // SWR cache 갱신
        setDeleteConfirmDialog({ open: false, user: null, inputValue: '' });
      } catch (error: any) {
        // API 오류 응답에서 구체적인 메시지 추출
        const errorMessage = error.error?.message || error.message || t('users.deleteError');
        enqueueSnackbar(errorMessage, { variant: 'error' });
      }
    }
  };

  // 이메일 강제 인증 처리
  const handleVerifyUserEmail = async (userId: number) => {
    try {
      setEmailVerificationLoading(true);
      await UserService.verifyUserEmail(userId);
      enqueueSnackbar(t('users.emailVerified'), { variant: 'success' });
      mutateUsers(); // SWR cache 갱신
      // 편집 폼이 열려있다면 데이터 업데이트
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

  // 이메일 인증 메일 재전송
  const handleResendVerificationEmail = async (userId: number) => {
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
    // 폼 데이터 초기화
    setNewUserData({
      name: '',
      email: '',
      password: '',
      role: 'user',
    });
    setNewUserTags([]);
    setAddUserDialog(true);

    // 브라우저 자동완성을 방지하기 위해 약간의 지연 후 다시 초기화
    setTimeout(() => {
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
    // 폼 검증
    if (!validateNewUserForm()) {
      return;
    }

    try {
      const userData = {
        ...newUserData,
        tagIds: newUserTags.map(tag => tag.id)
      };
      await apiService.post('/admin/users', userData);
      enqueueSnackbar(t('users.userCreated'), { variant: 'success' });
      mutateUsers(); // SWR cache 갱신
      handleCloseAddUserDialog();
    } catch (error: any) {
      // API 오류 응답에서 구체적인 메시지 추출
      const errorMessage = error.error?.message || error.message || t('users.createError');
      enqueueSnackbar(errorMessage, { variant: 'error' });
    }
  };

  // 초대 관련 핸들러
  const handleCreateInvitation = async (data: CreateInvitationRequest) => {
    try {
      const response = await invitationService.createInvitation(data);
      setInvitationDialogOpen(false); // 초대 폼 닫기
      await loadCurrentInvitation(); // 현재 초대 정보 새로고침
      // 성공 토스트는 SSE 이벤트에서 처리 (중복 방지)
    } catch (error: any) {
      console.error('Failed to create invitation:', error);
      enqueueSnackbar(error.message || '초대 링크 생성에 실패했습니다.', { variant: 'error' });
    }
  };

  const handleDeleteInvitation = async () => {
    if (!currentInvitation) return;

    try {
      await invitationService.deleteInvitation(currentInvitation.id);
      setCurrentInvitation(null);
      // 성공 토스트는 SSE 이벤트에서 처리 (중복 방지)
    } catch (error: any) {
      console.error('Failed to delete invitation:', error);
      enqueueSnackbar(error.message || '초대 링크 삭제에 실패했습니다.', { variant: 'error' });
    }
  };

  const handleUpdateInvitation = () => {
    setInvitationDialogOpen(true);
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

        {/* 버튼 그룹 */}
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
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* 일괄 작업 툴바 - 목록 위로 이동 */}
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
        <CardContent sx={{ p: 0 }}>
          <TableContainer
            sx={{
              opacity: !isInitialLoad && loading ? 0.5 : 1,
              transition: 'opacity 0.15s ease-in-out',
              pointerEvents: !isInitialLoad && loading ? 'none' : 'auto',
            }}
          >
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      indeterminate={selectedUsers.size > 0 && selectedUsers.size < users.length}
                      checked={users.length > 0 && selectedUsers.size === users.length}
                      onChange={handleSelectAllUsers}
                    />
                  </TableCell>
                  <TableCell>{t('users.user')}</TableCell>
                  <TableCell>{t('users.email')}</TableCell>
                  <TableCell align="center">{t('users.emailVerified')}</TableCell>
                  <TableCell>{t('users.role')}</TableCell>
                  <TableCell>{t('users.status')}</TableCell>
                  <TableCell>{t('users.tags')}</TableCell>
                  <TableCell>{t('users.joinDate')}</TableCell>
                  <TableCell>{t('users.lastLogin')}</TableCell>
                  <TableCell>{t('users.createdBy')}</TableCell>
                  <TableCell align="center">{t('common.actions')}</TableCell>
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
                    colSpan={11}
                    loading={false}
                    message={t('users.noUsersFound')}
                    loadingMessage={t('common.loadingUsers')}
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
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar src={user.avatarUrl}>
                          {user.name?.charAt(0).toUpperCase()}
                        </Avatar>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
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
                    </TableCell>
                    <TableCell>
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
                    </TableCell>
                    <TableCell align="center">
                      {user.emailVerified ? (
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
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={user.role === 'admin' ? <SecurityIcon /> : <PersonIcon />}
                        label={t(`users.roles.${user.role}`)}
                        color={getRoleColor(user.role)}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={t(`users.statuses.${user.status}`)}
                        color={getStatusColor(user.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {user.tags && user.tags.length > 0 && (
                          user.tags.map((tag: any) => (
                            <Tooltip key={tag.id} title={tag.description || t('tags.noDescription')} arrow>
                              <Chip
                                label={tag.name}
                                size="small"
                                sx={{
                                  backgroundColor: tag.color,
                                  color: 'white',
                                  fontSize: '0.75rem',
                                  cursor: 'help'
                                }}
                              />
                            </Tooltip>
                          ))
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      {formatDateTimeDetailed(user.createdAt)}
                    </TableCell>
                    <TableCell>
                      {formatDateTimeDetailed(user.lastLoginAt)}
                    </TableCell>
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

          {/* 페이지네이션 - 데이터가 있을 때만 표시 */}
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
        <MenuItem onClick={() => handleMenuAction('edit')}>
          <ListItemIcon>
            <EditIcon />
          </ListItemIcon>
          <ListItemText>{t('common.edit')}</ListItemText>
        </MenuItem>



        {selectedUser?.status === 'active' ? (
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
        )}

        {selectedUser?.role === 'user' && selectedUser?.status === 'active' && (
          <MenuItem onClick={() => handleMenuAction('promote')}>
            <ListItemIcon>
              <SecurityIcon />
            </ListItemIcon>
            <ListItemText>{t('common.promoteToAdmin')}</ListItemText>
          </MenuItem>
        )}

        {selectedUser?.role === 'admin' && (
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

        {/* 이메일 인증 관련 메뉴 */}
        {selectedUser && !selectedUser.emailVerified && (
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
      </Menu>

      {/* Add User Drawer */}
      <Drawer
        anchor="right"
        open={addUserDialog}
        onClose={handleCloseAddUserDialog}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: 600 },
            maxWidth: '100vw',
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
              {t('users.addUserDialogTitle')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {t('users.addUserDialogDescription')}
            </Typography>
          </Box>
          <IconButton
            onClick={handleCloseAddUserDialog}
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
                          sx={{ bgcolor: option.color, color: '#fff' }}
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
                        sx={{ bgcolor: option.color, color: '#fff', mr: 1 }}
                      />
                      {option.description || t('common.noDescription')}
                    </Box>
                  );
                }}
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
      </Drawer>

      {/* Confirmation Drawer */}
      <Drawer
        anchor="right"
        open={confirmDialog.open}
        onClose={() => setConfirmDialog({ ...confirmDialog, open: false })}
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
            onClick={() => setConfirmDialog({ ...confirmDialog, open: false })}
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
            onClick={() => setConfirmDialog({ ...confirmDialog, open: false })}
            variant="outlined"
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={confirmDialog.action}
            color="error"
            variant="contained"
          >
            {t('common.confirm')}
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

      {/* Edit User Drawer */}
      <Drawer
        anchor="right"
        open={editUserDialog.open}
        onClose={() => setEditUserDialog({ open: false, user: null })}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: 600 },
            maxWidth: '100vw',
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
              {t('users.editUserDialogTitle')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {t('users.editUserDialogDescription')}
            </Typography>
          </Box>
          <IconButton
            onClick={() => setEditUserDialog({ open: false, user: null })}
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

            {/* 이메일 인증 상태 및 액션 */}
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
                          sx={{ bgcolor: option.color, color: '#fff' }}
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
                        sx={{ bgcolor: option.color, color: '#fff', mr: 1 }}
                      />
                      {option.description || t('common.noDescription')}
                    </Box>
                  );
                }}
              />
            </Box>
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
            onClick={handleSaveEditUser}
            variant="contained"
            startIcon={<SaveIcon />}
          >
            {t('common.save')}
          </Button>
        </Box>
      </Drawer>

      {/* Bulk Action Drawer */}
      <Drawer
        anchor="right"
        open={bulkActionDialogOpen}
        onClose={() => setBulkActionDialogOpen(false)}
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 3, // AppBar(theme.zIndex.drawer+2)보다 높게
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
                      zIndex: 1500 // Drawer보다 높은 zIndex
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
                          sx={{ bgcolor: option.color, color: '#fff' }}
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
                        sx={{ bgcolor: option.color, color: '#fff', mr: 1 }}
                      />
                      {option.description || t('common.noDescription')}
                    </Box>
                  );
                }}
              />
            </Box>
          )}

          {/* 공통 대상 미리보기 (삭제 외 액션에도 표시) */}
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

              {/* 삭제 대상 사용자 목록 */}
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
            height: '100vh', // 전체 화면 높이 사용
            top: 0, // 상단에 붙임
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

        {/* Content - 스크롤 가능 */}
        <Box sx={{
          flex: 1,
          overflow: 'auto',
          '&::-webkit-scrollbar': {
            width: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: '#f1f1f1',
            borderRadius: '4px',
          },
          '&::-webkit-scrollbar-thumb': {
            background: '#c1c1c1',
            borderRadius: '4px',
            '&:hover': {
              background: '#a8a8a8',
            },
          },
        }}>
          <InvitationForm
            onSubmit={handleCreateInvitation}
            onCancel={() => setInvitationDialogOpen(false)}
            isDrawer={true}
          />
        </Box>
      </Drawer>


    </Box>
  );
};

export default UsersManagementPage;
