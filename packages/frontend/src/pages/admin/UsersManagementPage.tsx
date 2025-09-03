import React, { useState, useEffect } from 'react';
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
  InputLabel,
  Select,
  Alert,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
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
  Cancel as CancelIcon,
  Add as AddIcon,
  Save as SaveIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { User } from '@/types';
import { apiService } from '@/services/api';
import { formatDateTimeDetailed } from '../../utils/dateFormat';
import { useAuth } from '@/hooks/useAuth';
import SimplePagination from '../../components/common/SimplePagination';
import FormDialogHeader from '../../components/common/FormDialogHeader';
import EmptyTableRow from '../../components/common/EmptyTableRow';

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

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
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

  const [addUserDialog, setAddUserDialog] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [newUserData, setNewUserData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'user' as 'admin' | 'user',
  });

  // Delete confirmation state
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState({
    open: false,
    user: null as User | null,
    inputValue: '',
  });

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

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: (page + 1).toString(),
        limit: rowsPerPage.toString(),
      });
      
      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter) params.append('status', statusFilter);
      if (roleFilter) params.append('role', roleFilter);

      const response = await apiService.get<UsersResponse>(`/admin/users?${params}`);

      console.log('Loaded users data:', {
        count: response.data.users.length,
        firstUser: response.data.users[0],
        hasCreatedAt: response.data.users.length > 0 && response.data.users[0].createdAt !== undefined,
        hasLastLoginAt: response.data.users.length > 0 && response.data.users[0].lastLoginAt !== undefined
      });

      setUsers(response.data.users);
      setTotal(response.data.total);
    } catch (error: any) {
      enqueueSnackbar(error.message || t('admin.users.fetchError'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page, rowsPerPage, searchTerm, statusFilter, roleFilter]);



  const handleSuspendUser = (user: User) => {
    setConfirmDialog({
      open: true,
      title: t('common.suspendUser'),
      message: t('common.suspendUserConfirm', { name: user.name }),
      action: async () => {
        try {
          await apiService.post(`/admin/users/${user.id}/suspend`);
          enqueueSnackbar(t('common.userSuspended'), { variant: 'success' });
          fetchUsers();
        } catch (error: any) {
          enqueueSnackbar(error.message || t('common.userSuspendFailed'), { variant: 'error' });
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
        try {
          await apiService.post(`/admin/users/${user.id}/activate`);
          enqueueSnackbar(t('common.userActivated'), { variant: 'success' });
          fetchUsers();
        } catch (error: any) {
          enqueueSnackbar(error.message || t('common.userActivateFailed'), { variant: 'error' });
        }
      },
    });
  };



  const handleEditUser = (user: User) => {
    setEditUserData({
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
    });
    setEditUserDialog({
      open: true,
      user,
    });
  };

  const handleSaveEditUser = async () => {
    if (!editUserDialog.user) return;

    try {
      // For own account, only allow name changes
      if (isCurrentUser(editUserDialog.user)) {
        const updateData = {
          name: editUserData.name
        };
        await apiService.put(`/admin/users/${editUserDialog.user.id}`, updateData);
      } else {
        // For other users, allow all changes
        await apiService.put(`/admin/users/${editUserDialog.user.id}`, editUserData);
      }

      enqueueSnackbar(t('admin.users.userUpdated'), { variant: 'success' });
      fetchUsers();
      setEditUserDialog({ open: false, user: null });
    } catch (error: any) {
      enqueueSnackbar(error.message || t('admin.users.updateError'), { variant: 'error' });
    }
  };

  const handleDeleteUser = (user: User) => {
    // Prevent deleting own account
    if (isCurrentUser(user)) {
      enqueueSnackbar(t('admin.users.cannotModifyOwnAccount'), { variant: 'error' });
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
        fetchUsers();
        setDeleteConfirmDialog({ open: false, user: null, inputValue: '' });
      } catch (error: any) {
        enqueueSnackbar(error.message || t('users.deleteError'), { variant: 'error' });
      }
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
    setAddUserDialog(true);

    // 브라우저 자동완성을 방지하기 위해 약간의 지연 후 다시 초기화
    setTimeout(() => {
      setNewUserData({
        name: '',
        email: '',
        password: '',
        role: 'user',
      });
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
  };

  const handleCreateUser = async () => {
    try {
      await apiService.post('/admin/users', newUserData);
      enqueueSnackbar(t('users.userCreated'), { variant: 'success' });
      fetchUsers();
      handleCloseAddUserDialog();
    } catch (error: any) {
      enqueueSnackbar(error.message || t('users.createError'), { variant: 'error' });
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
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
          {t('admin.users.title')}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {t('admin.users.subtitle')}
        </Typography>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                placeholder={t('admin.users.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel shrink={true}>{t('admin.users.statusFilter')}</InputLabel>
                <Select
                  value={statusFilter}
                  label={t('admin.users.statusFilter')}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  displayEmpty
                  sx={{
                    minWidth: 120,
                    '& .MuiSelect-select': {
                      overflow: 'visible',
                      textOverflow: 'clip',
                      whiteSpace: 'nowrap',
                    }
                  }}
                >
                  <MenuItem value="">{t('common.allStatuses')}</MenuItem>
                  <MenuItem value="active">{t('users.statuses.active')}</MenuItem>
                  <MenuItem value="pending">{t('users.statuses.pending')}</MenuItem>
                  <MenuItem value="suspended">{t('users.statuses.suspended')}</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel shrink={true}>{t('admin.users.roleFilter')}</InputLabel>
                <Select
                  value={roleFilter}
                  label={t('admin.users.roleFilter')}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  displayEmpty
                  sx={{
                    minWidth: 120,
                    '& .MuiSelect-select': {
                      overflow: 'visible',
                      textOverflow: 'clip',
                      whiteSpace: 'nowrap',
                    }
                  }}
                >
                  <MenuItem value="">{t('common.allRoles')}</MenuItem>
                  <MenuItem value="admin">{t('users.roles.admin')}</MenuItem>
                  <MenuItem value="user">{t('users.roles.user')}</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <Button
                fullWidth
                variant="contained"
                startIcon={<PersonAddIcon />}
                onClick={handleAddUser}
              >
                {t('admin.users.addUser')}
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardContent sx={{ p: 0 }}>
          {loading && <LinearProgress />}
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t('users.user')}</TableCell>
                  <TableCell>{t('users.email')}</TableCell>
                  <TableCell align="center">{t('users.emailVerified')}</TableCell>
                  <TableCell>{t('users.role')}</TableCell>
                  <TableCell>{t('users.status')}</TableCell>
                  <TableCell>{t('users.joinDate')}</TableCell>
                  <TableCell>{t('users.lastLogin')}</TableCell>
                  <TableCell>{t('users.createdBy')}</TableCell>
                  <TableCell align="center">{t('common.actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.length === 0 ? (
                  <EmptyTableRow
                    colSpan={9}
                    loading={loading}
                    message={t('users.noUsersFound')}
                    loadingMessage={t('common.loadingUsers')}
                  />
                ) : (
                  users.map((user) => (
                  <TableRow key={user.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar src={user.avatarUrl}>
                          {user.name?.charAt(0).toUpperCase()}
                        </Avatar>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {user.name}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell align="center">
                      {user.emailVerified ? (
                        <Chip
                          label="인증됨"
                          color="success"
                          size="small"
                          variant="outlined"
                        />
                      ) : (
                        <Chip
                          label="미인증"
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
                      <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                        <IconButton
                          onClick={() => handleEditUser(user)}
                          size="small"
                          color="primary"
                          title="편집"
                        >
                          <EditIcon />
                        </IconButton>
                        {user.status === 'active' ? (
                          <IconButton
                            onClick={() => handleSuspendUser(user)}
                            size="small"
                            color="warning"
                            title="정지"
                            disabled={isCurrentUser(user)}
                          >
                            <BlockIcon />
                          </IconButton>
                        ) : (
                          <IconButton
                            onClick={() => handleActivateUser(user)}
                            size="small"
                            color="success"
                            title="활성화"
                            disabled={isCurrentUser(user)}
                          >
                            <CheckCircleIcon />
                          </IconButton>
                        )}
                        <IconButton
                          onClick={() => handleDeleteUser(user)}
                          size="small"
                          color="error"
                          title="삭제"
                          disabled={isCurrentUser(user)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Box>
                    </TableCell>
                  </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
          
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
        </CardContent>
      </Card>



      {/* Add User Dialog */}
      <Dialog
        open={addUserDialog}
        onClose={handleCloseAddUserDialog}
        maxWidth="sm"
        fullWidth
        key={addUserDialog ? 'add-user-dialog-open' : 'add-user-dialog-closed'}
      >
        <FormDialogHeader
          title="사용자 추가"
          description="새로운 사용자 계정을 생성하고 권한을 설정할 수 있습니다."
        />
        <DialogContent>
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
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                {t('admin.users.form.nameHelp')}
              </Typography>
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
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                {t('admin.users.form.emailHelp')}
              </Typography>
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
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                        size="small"
                        aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
                      >
                        {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                {t('admin.users.form.passwordHelp')}
              </Typography>
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
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseAddUserDialog} startIcon={<CancelIcon />}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleCreateUser} variant="contained" startIcon={<AddIcon />}>
            사용자 추가
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog.open} onClose={() => setConfirmDialog({ ...confirmDialog, open: false })}>
        <DialogTitle>{confirmDialog.title}</DialogTitle>
        <DialogContent>
          <Typography>{confirmDialog.message}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog({ ...confirmDialog, open: false })}>
            {t('common.cancel')}
          </Button>
          <Button onClick={confirmDialog.action} color="error" variant="contained">
            {t('common.confirm')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmDialog.open}
        onClose={() => setDeleteConfirmDialog({ open: false, user: null, inputValue: '' })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {t('admin.users.deleteUser')}
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            {t('admin.users.deleteConfirmation')}
          </Alert>
          <Typography variant="body2" sx={{ mb: 2 }}>
            {t('admin.users.deleteConfirmationInput')}
            <strong> {deleteConfirmDialog.user?.email}</strong>
          </Typography>
          <TextField
            fullWidth
            label={t('users.email')}
            value={deleteConfirmDialog.inputValue}
            onChange={(e) => setDeleteConfirmDialog(prev => ({ ...prev, inputValue: e.target.value }))}
            placeholder={deleteConfirmDialog.user?.email}
            error={deleteConfirmDialog.inputValue !== '' && deleteConfirmDialog.inputValue !== deleteConfirmDialog.user?.email}
            helperText={deleteConfirmDialog.inputValue !== '' && deleteConfirmDialog.inputValue !== deleteConfirmDialog.user?.email ? t('admin.users.emailDoesNotMatch') : ''}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setDeleteConfirmDialog({ open: false, user: null, inputValue: '' })}
            color="inherit"
            startIcon={<CancelIcon />}
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
        </DialogActions>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editUserDialog.open} onClose={() => setEditUserDialog({ open: false, user: null })} maxWidth="sm" fullWidth>
        <FormDialogHeader
          title="사용자 편집"
          description="기존 사용자의 정보와 권한을 수정할 수 있습니다."
        />
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Box>
              <TextField
                label={t('users.name')}
                value={editUserData.name}
                onChange={(e) => setEditUserData({ ...editUserData, name: e.target.value })}
                fullWidth
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                {t('admin.users.form.nameHelp')}
              </Typography>
            </Box>
            <Box>
              <TextField
                label={t('users.email')}
                value={editUserData.email}
                onChange={(e) => setEditUserData({ ...editUserData, email: e.target.value })}
                fullWidth
                disabled={editUserDialog.user && isCurrentUser(editUserDialog.user)}
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                {t('admin.users.form.emailHelp')}
              </Typography>
            </Box>
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
                </FormControl>
              </>
            )}
            {editUserDialog.user && isCurrentUser(editUserDialog.user) && (
              <Alert severity="info">
                {t('admin.users.canOnlyModifyOwnName')}
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditUserDialog({ open: false, user: null })} startIcon={<CancelIcon />}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleSaveEditUser}
            variant="contained"
            startIcon={<SaveIcon />}
          >
            {t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UsersManagementPage;
