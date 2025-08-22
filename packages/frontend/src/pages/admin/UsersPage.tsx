import React, { useState, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  Chip,
  Avatar,
  IconButton,
  Menu,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Pagination,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  // Tooltip,
  CircularProgress,
} from '@mui/material';
import {
  MoreVert,
  Check,
  Close,
  Block,
  PlayArrow,
  Security,
  PersonRemove,
  Delete,
  Refresh,
  Search,
  FilterList,
  HourglassEmpty,
} from '@mui/icons-material';
import { Layout } from '@/components/layout/Layout';
import { useUsers } from '@/hooks/useSWR';
// import { useTranslations } from '@/contexts/I18nContext';
import { User, UserFilters } from '@/types';
import { UserService } from '@/services/users';
import { mutate } from 'swr';

interface UserActionMenuProps {
  user: User;
  onAction: (action: string, user: User) => void;
}

const UserActionMenu: React.FC<UserActionMenuProps> = ({ user, onAction }) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  // const { t } = useTranslations();

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleAction = (action: string) => {
    onAction(action, user);
    handleClose();
  };

  const getAvailableActions = () => {
    const actions = [];

    if (user.status === 'pending') {
      actions.push(
        { key: 'approve', label: 'Approve', icon: <Check />, color: 'success' },
        { key: 'reject', label: 'Reject', icon: <Close />, color: 'error' }
      );
    }

    if (user.status === 'active') {
      actions.push(
        { key: 'suspend', label: 'Suspend', icon: <Block />, color: 'warning' }
      );
    }

    if (user.status === 'suspended') {
      actions.push(
        { key: 'unsuspend', label: 'Unsuspend', icon: <PlayArrow />, color: 'success' }
      );
    }

    if (user.role === 'user' && user.status === 'active') {
      actions.push(
        { key: 'promote', label: 'Promote to Admin', icon: <Security />, color: 'primary' }
      );
    }

    if (user.role === 'admin') {
      actions.push(
        { key: 'demote', label: 'Demote from Admin', icon: <PersonRemove />, color: 'warning' }
      );
    }

    actions.push(
      { key: 'delete', label: 'Delete', icon: <Delete />, color: 'error' }
    );

    return actions;
  };

  return (
    <>
      <IconButton onClick={handleClick}>
        <MoreVert />
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
      >
        {getAvailableActions().map((action) => (
          <MenuItem
            key={action.key}
            onClick={() => handleAction(action.key)}
            sx={{ color: `${action.color}.main` }}
          >
            <ListItemIcon sx={{ color: 'inherit' }}>
              {action.icon}
            </ListItemIcon>
            <ListItemText>{action.label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

const UsersPage: React.FC = () => {
  // const { t } = useTranslations();
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [filters, setFilters] = useState<UserFilters>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    action: string;
    user: User | null;
  }>({ open: false, action: '', user: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { data, error: swrError, mutate: mutateUsers, isLoading } = useUsers(page, limit, {
    ...filters,
    search: searchTerm,
  });

  const users = data?.users || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  const handleSearch = useCallback(() => {
    setPage(1);
    mutateUsers();
  }, [mutateUsers]);

  const handleFilterChange = (key: keyof UserFilters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value || undefined,
    }));
    setPage(1);
  };

  const handleAction = (action: string, user: User) => {
    setConfirmDialog({ open: true, action, user });
  };

  const executeAction = async () => {
    if (!confirmDialog.user) return;

    const { action, user } = confirmDialog;
    setLoading(true);
    setError(null);

    try {
      switch (action) {
        case 'approve':
          await UserService.approveUser(user.id);
          setSuccess('User approved successfully');
          break;
        case 'reject':
          await UserService.rejectUser(user.id);
          setSuccess('User rejected successfully');
          break;
        case 'suspend':
          await UserService.suspendUser(user.id);
          setSuccess('User suspended successfully');
          break;
        case 'unsuspend':
          await UserService.unsuspendUser(user.id);
          setSuccess('User unsuspended successfully');
          break;
        case 'promote':
          await UserService.promoteToAdmin(user.id);
          setSuccess('User promoted to admin successfully');
          break;
        case 'demote':
          await UserService.demoteFromAdmin(user.id);
          setSuccess('User demoted from admin successfully');
          break;
        case 'delete':
          await UserService.deleteUser(user.id);
          setSuccess('User deleted successfully');
          break;
      }

      // Refresh data
      mutateUsers();
      mutate('/users/stats');
    } catch (err: any) {
      setError(err.message || 'Action failed');
    } finally {
      setLoading(false);
      setConfirmDialog({ open: false, action: '', user: null });
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
    return role === 'admin' ? 'primary' : 'default';
  };

  if (isLoading && !data) {
    return (
      <Layout title="User Management">
        <Box sx={{ p: 3 }} display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </Layout>
    );
  }

  return (
    <Layout title="User Management">
      <Box sx={{ p: 3 }}>
        {/* Alerts */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        
        {success && (
          <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        )}

        {/* Filters */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              <FilterList sx={{ mr: 1, verticalAlign: 'middle' }} />
              Filters & Search
            </Typography>
            
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  label="Search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  InputProps={{
                    endAdornment: (
                      <IconButton onClick={handleSearch}>
                        <Search />
                      </IconButton>
                    ),
                  }}
                />
              </Grid>
              
              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth>
                  <InputLabel>Role</InputLabel>
                  <Select
                    value={filters.role || ''}
                    onChange={(e) => handleFilterChange('role', e.target.value)}
                    label="Role"
                  >
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="admin">Admin</MenuItem>
                    <MenuItem value="user">User</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={filters.status || ''}
                    onChange={(e) => handleFilterChange('status', e.target.value)}
                    label="Status"
                  >
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="active">Active</MenuItem>
                    <MenuItem value="pending">Pending</MenuItem>
                    <MenuItem value="suspended">Suspended</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} sm={6} md={2}>
                <Button
                  variant="outlined"
                  startIcon={<Refresh />}
                  onClick={() => {
                    setFilters({});
                    setSearchTerm('');
                    setPage(1);
                    mutateUsers();
                  }}
                  fullWidth
                >
                  Reset
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                Users ({total})
              </Typography>
              <Button
                variant="outlined"
                startIcon={isLoading ? <HourglassEmpty /> : <Refresh />}
                onClick={() => mutateUsers()}
                disabled={isLoading}
              >
                {isLoading ? 'Loading...' : 'Refresh'}
              </Button>
            </Box>

            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>User</TableCell>
                    <TableCell>Role</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Email Verified</TableCell>
                    <TableCell>Last Login</TableCell>
                    <TableCell>Created</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Avatar src={user.avatar_url}>
                            {user.name.charAt(0).toUpperCase()}
                          </Avatar>
                          <Box>
                            <Typography variant="body2" fontWeight="medium">
                              {user.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {user.email}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={user.role.toUpperCase()}
                          color={getRoleColor(user.role) as any}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={user.status.toUpperCase()}
                          color={getStatusColor(user.status) as any}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={user.email_verified ? 'Yes' : 'No'}
                          color={user.email_verified ? 'success' : 'error'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {user.last_login_at
                            ? new Date(user.last_login_at).toLocaleDateString()
                            : 'Never'
                          }
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {new Date(user.created_at).toLocaleDateString()}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <UserActionMenu user={user} onAction={handleAction} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Pagination */}
            {totalPages > 1 && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                <Pagination
                  count={totalPages}
                  page={page}
                  onChange={(_, newPage) => setPage(newPage)}
                  color="primary"
                />
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Confirmation Dialog */}
        <Dialog
          open={confirmDialog.open}
          onClose={() => setConfirmDialog({ open: false, action: '', user: null })}
        >
          <DialogTitle>
            Confirm Action
          </DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to {confirmDialog.action} user "{confirmDialog.user?.name}"?
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => setConfirmDialog({ open: false, action: '', user: null })}
            >
              Cancel
            </Button>
            <Button
              onClick={executeAction}
              variant="contained"
              disabled={loading}
              color={confirmDialog.action === 'delete' ? 'error' : 'primary'}
            >
              {loading ? <CircularProgress size={20} /> : 'Confirm'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Layout>
  );
};

export default UsersPage;
