import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  CircularProgress,
  Tab,
  Tabs,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Autocomplete,
  Switch,
  FormControlLabel,
  InputAdornment,
  Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Group as GroupIcon,
  People as PeopleIcon,
  Shield as ShieldIcon,
  PersonAdd as PersonAddIcon,
  PersonRemove as PersonRemoveIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import EmptyPagePlaceholder from '@/components/common/EmptyPagePlaceholder';
import { formatRelativeTime } from '@/utils/dateFormat';
import {
  rbacService,
  GroupWithCounts,
  GroupDetail,
  GroupMember,
  GroupRole,
  Role,
} from '@/services/rbacService';
import api from '@/services/api';

// ==================== Tab Panel ====================

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <Box role="tabpanel" hidden={value !== index} sx={{ pt: 2 }}>
    {value === index && children}
  </Box>
);

// ==================== GroupsPage ====================

const GroupsPage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  // Data state
  const [groups, setGroups] = useState<GroupWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  // Dialogs
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Selected group
  const [selectedGroup, setSelectedGroup] = useState<GroupDetail | null>(null);
  const [selectedGroupForDelete, setSelectedGroupForDelete] = useState<GroupWithCounts | null>(null);

  // Form
  const [formData, setFormData] = useState({
    groupName: '',
    description: '',
    addNewUsersByDefault: false,
  });

  // Detail tab
  const [detailTab, setDetailTab] = useState(0);

  // Member/Role add state
  const [allUsers, setAllUsers] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [allRoles, setAllRoles] = useState<Role[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Load groups
  const loadGroups = useCallback(async () => {
    try {
      setLoading(true);
      const data = await rbacService.getGroups();
      setGroups(data);
    } catch (error) {
      console.error('Failed to load groups:', error);
      enqueueSnackbar(t('rbac.groups.loadFailed'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar, t]);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  // Load users for member add
  const loadUsers = useCallback(async () => {
    try {
      const res = await api.get('/admin/users', { params: { limit: 1000 } });
      setAllUsers(
        (res.data?.users || []).map((u: any) => ({
          id: String(u.id),
          name: u.name,
          email: u.email,
        }))
      );
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  }, []);

  // Load roles for role assignment
  const loadRoles = useCallback(async () => {
    try {
      const data = await rbacService.getRoles();
      setAllRoles(data);
    } catch (error) {
      console.error('Failed to load roles:', error);
    }
  }, []);

  // Filtered groups
  const filteredGroups = debouncedSearchTerm
    ? groups.filter(
        (g) =>
          g.groupName.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
          (g.description || '').toLowerCase().includes(debouncedSearchTerm.toLowerCase())
      )
    : groups;

  // ─── Dialog handlers ─────────────────────────

  const openCreateDialog = () => {
    setDialogMode('create');
    setFormData({ groupName: '', description: '', addNewUsersByDefault: false });
    setDialogOpen(true);
  };

  const openEditDialog = (group: GroupWithCounts) => {
    setDialogMode('edit');
    setFormData({
      groupName: group.groupName,
      description: group.description || '',
      addNewUsersByDefault: group.addNewUsersByDefault,
    });
    setSelectedGroupForDelete(group);
    setDialogOpen(true);
  };

  const openDeleteDialog = (group: GroupWithCounts) => {
    setSelectedGroupForDelete(group);
    setDeleteDialogOpen(true);
  };

  const openDetailDialog = async (group: GroupWithCounts) => {
    try {
      const detail = await rbacService.getGroup(group.id);
      setSelectedGroup(detail);
      setDetailTab(0);
      setDetailDialogOpen(true);
      loadUsers();
      loadRoles();
    } catch (error) {
      console.error('Failed to load group detail:', error);
      enqueueSnackbar(t('rbac.groups.loadFailed'), { variant: 'error' });
    }
  };

  const handleSave = async () => {
    if (!formData.groupName.trim()) {
      enqueueSnackbar(t('rbac.groups.nameRequired'), { variant: 'warning' });
      return;
    }

    try {
      setSaving(true);
      if (dialogMode === 'create') {
        await rbacService.createGroup({
          groupName: formData.groupName.trim(),
          description: formData.description.trim() || undefined,
          addNewUsersByDefault: formData.addNewUsersByDefault,
        });
        enqueueSnackbar(t('rbac.groups.createSuccess'), { variant: 'success' });
      } else if (selectedGroupForDelete) {
        await rbacService.updateGroup(selectedGroupForDelete.id, {
          groupName: formData.groupName.trim(),
          description: formData.description.trim() || undefined,
          addNewUsersByDefault: formData.addNewUsersByDefault,
        });
        enqueueSnackbar(t('rbac.groups.updateSuccess'), { variant: 'success' });
      }
      setDialogOpen(false);
      loadGroups();
    } catch (error: any) {
      const message = error?.response?.data?.message || t('rbac.groups.saveFailed');
      enqueueSnackbar(message, { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedGroupForDelete) return;
    try {
      setSaving(true);
      await rbacService.deleteGroup(selectedGroupForDelete.id);
      enqueueSnackbar(t('rbac.groups.deleteSuccess'), { variant: 'success' });
      setDeleteDialogOpen(false);
      loadGroups();
    } catch (error: any) {
      const message = error?.response?.data?.message || t('rbac.groups.deleteFailed');
      enqueueSnackbar(message, { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // ─── Member management ─────────────────────────

  const handleAddMember = async () => {
    if (!selectedGroup || !selectedUserId) return;
    try {
      await rbacService.addGroupMember(selectedGroup.id, selectedUserId);
      enqueueSnackbar(t('rbac.groups.memberAdded'), { variant: 'success' });
      // Refresh group detail
      const detail = await rbacService.getGroup(selectedGroup.id);
      setSelectedGroup(detail);
      setSelectedUserId(null);
      loadGroups();
    } catch (error: any) {
      const message = error?.response?.data?.message || t('rbac.groups.memberAddFailed');
      enqueueSnackbar(message, { variant: 'error' });
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!selectedGroup) return;
    try {
      await rbacService.removeGroupMember(selectedGroup.id, userId);
      enqueueSnackbar(t('rbac.groups.memberRemoved'), { variant: 'success' });
      const detail = await rbacService.getGroup(selectedGroup.id);
      setSelectedGroup(detail);
      loadGroups();
    } catch (error: any) {
      const message = error?.response?.data?.message || t('rbac.groups.memberRemoveFailed');
      enqueueSnackbar(message, { variant: 'error' });
    }
  };

  // ─── Role management ─────────────────────────

  const handleAddRole = async () => {
    if (!selectedGroup || !selectedRoleId) return;
    try {
      await rbacService.addGroupRole(selectedGroup.id, selectedRoleId);
      enqueueSnackbar(t('rbac.groups.roleAdded'), { variant: 'success' });
      const detail = await rbacService.getGroup(selectedGroup.id);
      setSelectedGroup(detail);
      setSelectedRoleId(null);
      loadGroups();
    } catch (error: any) {
      const message = error?.response?.data?.message || t('rbac.groups.roleAddFailed');
      enqueueSnackbar(message, { variant: 'error' });
    }
  };

  const handleRemoveRole = async (roleId: string) => {
    if (!selectedGroup) return;
    try {
      await rbacService.removeGroupRole(selectedGroup.id, roleId);
      enqueueSnackbar(t('rbac.groups.roleRemoved'), { variant: 'success' });
      const detail = await rbacService.getGroup(selectedGroup.id);
      setSelectedGroup(detail);
      loadGroups();
    } catch (error: any) {
      const message = error?.response?.data?.message || t('rbac.groups.roleRemoveFailed');
      enqueueSnackbar(message, { variant: 'error' });
    }
  };

  // Available members (not already in group)
  const availableUsers = selectedGroup
    ? allUsers.filter(
        (u) => !selectedGroup.members.some((m) => m.userId === u.id)
      )
    : allUsers;

  // Available roles (not already assigned)
  const availableRoles = selectedGroup
    ? allRoles.filter(
        (r) => !selectedGroup.roles.some((gr) => gr.roleId === r.id)
      )
    : allRoles;

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box
        sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            {t('rbac.groups.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('rbac.groups.description')}
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}>
          {t('rbac.groups.create')}
        </Button>
      </Box>

      {/* Search */}
      <Box sx={{ mb: 2 }}>
        <TextField
          size="small"
          placeholder={t('rbac.groups.searchPlaceholder')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{ width: 300 }}
        />
      </Box>

      {/* Table */}
      <Card>
        <CardContent sx={{ p: 0 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : filteredGroups.length === 0 ? (
            <EmptyPagePlaceholder
              icon={<GroupIcon sx={{ fontSize: 48 }} />}
              message={t('rbac.groups.emptyTitle')}
              subtitle={t('rbac.groups.emptyDescription')}
            />
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t('rbac.groups.name')}</TableCell>
                    <TableCell>{t('rbac.groups.descriptionColumn')}</TableCell>
                    <TableCell align="center">{t('rbac.groups.members')}</TableCell>
                    <TableCell align="center">{t('rbac.groups.roles')}</TableCell>
                    <TableCell align="center">{t('rbac.groups.autoAdd')}</TableCell>
                    <TableCell>{t('common.createdAt')}</TableCell>
                    <TableCell align="right">{t('common.actions')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredGroups.map((group) => (
                    <TableRow key={group.id} hover>
                      <TableCell>
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 500,
                            cursor: 'pointer',
                            '&:hover': { color: 'primary.main', textDecoration: 'underline' },
                          }}
                          onClick={() => openDetailDialog(group)}
                        >
                          {group.groupName}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{
                            maxWidth: 300,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {group.description || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          icon={<PeopleIcon />}
                          label={group.memberCount}
                          size="small"
                          variant="outlined"
                          color={group.memberCount > 0 ? 'primary' : 'default'}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          icon={<ShieldIcon />}
                          label={group.roleCount}
                          size="small"
                          variant="outlined"
                          color={group.roleCount > 0 ? 'primary' : 'default'}
                        />
                      </TableCell>
                      <TableCell align="center">
                        {group.addNewUsersByDefault ? (
                          <Chip label={t('common.yes')} size="small" color="success" />
                        ) : (
                          <Chip label={t('common.no')} size="small" variant="outlined" />
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatRelativeTime(group.createdAt)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title={t('common.edit')}>
                          <IconButton size="small" onClick={() => openEditDialog(group)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t('common.delete')}>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => openDeleteDialog(group)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {dialogMode === 'create' ? t('rbac.groups.createTitle') : t('rbac.groups.editTitle')}
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label={t('rbac.groups.name')}
              value={formData.groupName}
              onChange={(e) => setFormData({ ...formData, groupName: e.target.value })}
              required
              fullWidth
              autoFocus
              size="small"
            />
            <TextField
              label={t('rbac.groups.descriptionColumn')}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              fullWidth
              multiline
              rows={2}
              size="small"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={formData.addNewUsersByDefault}
                  onChange={(e) =>
                    setFormData({ ...formData, addNewUsersByDefault: e.target.checked })
                  }
                />
              }
              label={t('rbac.groups.autoAddLabel')}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving || !formData.groupName.trim()}
          >
            {saving ? <CircularProgress size={20} /> : t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>{t('rbac.groups.deleteTitle')}</DialogTitle>
        <DialogContent>
          {selectedGroupForDelete && (
            <Typography>
              {t('rbac.groups.deleteConfirm', { name: selectedGroupForDelete.groupName })}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button variant="contained" color="error" onClick={handleDelete} disabled={saving}>
            {saving ? <CircularProgress size={20} /> : t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Detail Dialog (Members & Roles tabs) */}
      <Dialog
        open={detailDialogOpen}
        onClose={() => setDetailDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {selectedGroup?.groupName} — {t('rbac.groups.detail')}
        </DialogTitle>
        <DialogContent dividers>
          <Tabs value={detailTab} onChange={(_, v) => setDetailTab(v)}>
            <Tab
              label={`${t('rbac.groups.members')} (${selectedGroup?.members.length || 0})`}
              icon={<PeopleIcon />}
              iconPosition="start"
            />
            <Tab
              label={`${t('rbac.groups.roles')} (${selectedGroup?.roles.length || 0})`}
              icon={<ShieldIcon />}
              iconPosition="start"
            />
          </Tabs>

          {/* Members Tab */}
          <TabPanel value={detailTab} index={0}>
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <Autocomplete
                size="small"
                sx={{ flex: 1 }}
                options={availableUsers}
                getOptionLabel={(opt) => `${opt.name} (${opt.email})`}
                value={availableUsers.find((u) => u.id === selectedUserId) || null}
                onChange={(_, val) => setSelectedUserId(val?.id || null)}
                renderInput={(params) => (
                  <TextField {...params} placeholder={t('rbac.groups.selectUser')} />
                )}
              />
              <Button
                variant="contained"
                size="small"
                startIcon={<PersonAddIcon />}
                disabled={!selectedUserId}
                onClick={handleAddMember}
              >
                {t('rbac.groups.addMember')}
              </Button>
            </Box>
            {selectedGroup?.members.length === 0 ? (
              <Alert severity="info">{t('rbac.groups.noMembers')}</Alert>
            ) : (
              <List dense>
                {selectedGroup?.members.map((member) => (
                  <ListItem key={member.userId} divider>
                    <ListItemText
                      primary={member.name || member.userId}
                      secondary={member.email}
                    />
                    <ListItemSecondaryAction>
                      <Tooltip title={t('rbac.groups.removeMember')}>
                        <IconButton
                          edge="end"
                          size="small"
                          color="error"
                          onClick={() => handleRemoveMember(member.userId)}
                        >
                          <PersonRemoveIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            )}
          </TabPanel>

          {/* Roles Tab */}
          <TabPanel value={detailTab} index={1}>
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <Autocomplete
                size="small"
                sx={{ flex: 1 }}
                options={availableRoles}
                getOptionLabel={(opt) => opt.roleName}
                value={availableRoles.find((r) => r.id === selectedRoleId) || null}
                onChange={(_, val) => setSelectedRoleId(val?.id || null)}
                renderInput={(params) => (
                  <TextField {...params} placeholder={t('rbac.groups.selectRole')} />
                )}
              />
              <Button
                variant="contained"
                size="small"
                startIcon={<ShieldIcon />}
                disabled={!selectedRoleId}
                onClick={handleAddRole}
              >
                {t('rbac.groups.addRole')}
              </Button>
            </Box>
            {selectedGroup?.roles.length === 0 ? (
              <Alert severity="info">{t('rbac.groups.noRoles')}</Alert>
            ) : (
              <List dense>
                {selectedGroup?.roles.map((role) => (
                  <ListItem key={role.roleId} divider>
                    <ListItemText
                      primary={role.roleName || role.roleId}
                      secondary={role.description}
                    />
                    <ListItemSecondaryAction>
                      <Tooltip title={t('rbac.groups.removeRole')}>
                        <IconButton
                          edge="end"
                          size="small"
                          color="error"
                          onClick={() => handleRemoveRole(role.roleId)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            )}
          </TabPanel>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailDialogOpen(false)}>{t('common.close')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default GroupsPage;
