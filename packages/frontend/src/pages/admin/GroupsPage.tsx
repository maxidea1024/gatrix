import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
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
  ListItemIcon,
  Autocomplete,
  Switch,
  FormControlLabel,
  Alert,
  Menu,
  MenuItem,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Group as GroupIcon,
  People as PeopleIcon,
  Shield as ShieldIcon,
  PersonAdd as PersonAddIcon,
  PersonRemove as PersonRemoveIcon,
  MoreVert as MoreVertIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import EmptyPagePlaceholder from '@/components/common/EmptyPagePlaceholder';
import { formatRelativeTime, formatDateTimeDetailed } from '@/utils/dateFormat';
import {
  rbacService,
  GroupWithCounts,
  GroupDetail,
  GroupMember,
  GroupRole,
  Role,
} from '@/services/rbacService';
import api from '@/services/api';
import ResizableDrawer from '@/components/common/ResizableDrawer';
import PageContentLoader from '@/components/common/PageContentLoader';
import SearchTextField from '@/components/common/SearchTextField';
import { copyToClipboardWithNotification } from '@/utils/clipboard';

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
  const [selectedGroupForDelete, setSelectedGroupForDelete] = useState<GroupWithCounts | null>(
    null
  );

  // Form
  const [formData, setFormData] = useState({
    groupName: '',
    description: '',
    addNewUsersByDefault: false,
  });
  const [initialFormData, setInitialFormData] = useState({
    groupName: '',
    description: '',
    addNewUsersByDefault: false,
  });

  // Detail tab
  const [detailTab, setDetailTab] = useState(0);

  // Pending changes for detail drawer (buffered)
  const [pendingMemberAdds, setPendingMemberAdds] = useState<string[]>([]);
  const [pendingMemberRemoves, setPendingMemberRemoves] = useState<string[]>([]);
  const [pendingRoleAdds, setPendingRoleAdds] = useState<string[]>([]);
  const [pendingRoleRemoves, setPendingRoleRemoves] = useState<string[]>([]);

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
    const data = {
      groupName: group.groupName,
      description: group.description || '',
      addNewUsersByDefault: group.addNewUsersByDefault,
    };
    setFormData(data);
    setInitialFormData(data);
    setSelectedGroupForDelete(group);
    setDialogOpen(true);
  };

  const isEditDirty =
    dialogMode === 'create' || JSON.stringify(formData) !== JSON.stringify(initialFormData);

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
      setPendingMemberAdds([]);
      setPendingMemberRemoves([]);
      setPendingRoleAdds([]);
      setPendingRoleRemoves([]);
      setSelectedUserId(null);
      setSelectedRoleId(null);
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

  // ─── Member management (buffered) ─────────────────────────

  const handleAddMember = () => {
    if (!selectedUserId) return;
    // If previously pending remove, just cancel the remove
    if (pendingMemberRemoves.includes(selectedUserId)) {
      setPendingMemberRemoves((prev) => prev.filter((id) => id !== selectedUserId));
    } else {
      setPendingMemberAdds((prev) => [...prev, selectedUserId]);
    }
    setSelectedUserId(null);
  };

  const handleRemoveMember = (userId: string) => {
    // If previously pending add, just cancel the add
    if (pendingMemberAdds.includes(userId)) {
      setPendingMemberAdds((prev) => prev.filter((id) => id !== userId));
    } else {
      setPendingMemberRemoves((prev) => [...prev, userId]);
    }
  };

  // ─── Role management (buffered) ─────────────────────────

  const handleAddRole = () => {
    if (!selectedRoleId) return;
    if (pendingRoleRemoves.includes(selectedRoleId)) {
      setPendingRoleRemoves((prev) => prev.filter((id) => id !== selectedRoleId));
    } else {
      setPendingRoleAdds((prev) => [...prev, selectedRoleId]);
    }
    setSelectedRoleId(null);
  };

  const handleRemoveRole = (roleId: string) => {
    if (pendingRoleAdds.includes(roleId)) {
      setPendingRoleAdds((prev) => prev.filter((id) => id !== roleId));
    } else {
      setPendingRoleRemoves((prev) => [...prev, roleId]);
    }
  };

  // Save all pending detail changes
  const handleSaveDetail = async () => {
    if (!selectedGroup) return;
    try {
      setSaving(true);
      // Process member adds
      for (const userId of pendingMemberAdds) {
        await rbacService.addGroupMember(selectedGroup.id, userId);
      }
      // Process member removes
      for (const userId of pendingMemberRemoves) {
        await rbacService.removeGroupMember(selectedGroup.id, userId);
      }
      // Process role adds
      for (const roleId of pendingRoleAdds) {
        await rbacService.addGroupRole(selectedGroup.id, roleId);
      }
      // Process role removes
      for (const roleId of pendingRoleRemoves) {
        await rbacService.removeGroupRole(selectedGroup.id, roleId);
      }
      enqueueSnackbar(t('rbac.groups.updateSuccess'), { variant: 'success' });
      setDetailDialogOpen(false);
      loadGroups();
    } catch (error: any) {
      const message = error?.response?.data?.message || t('rbac.groups.saveFailed');
      enqueueSnackbar(message, { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const hasDetailChanges =
    pendingMemberAdds.length > 0 ||
    pendingMemberRemoves.length > 0 ||
    pendingRoleAdds.length > 0 ||
    pendingRoleRemoves.length > 0;

  // Menu state
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [menuTarget, setMenuTarget] = useState<GroupWithCounts | null>(null);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, group: GroupWithCounts) => {
    setMenuAnchorEl(event.currentTarget);
    setMenuTarget(group);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setMenuTarget(null);
  };

  const handleCopyText = (text: string) => {
    copyToClipboardWithNotification(
      text,
      () => enqueueSnackbar(t('common.copiedToClipboard'), { variant: 'success' }),
      () => enqueueSnackbar(t('common.copyFailed'), { variant: 'error' })
    );
  };

  // Available members: not already in group AND not pending add; also include pending removes as available again
  const effectiveMembers = selectedGroup
    ? [
      ...selectedGroup.members.filter((m) => !pendingMemberRemoves.includes(m.userId)),
      ...(pendingMemberAdds
        .map((userId) => {
          const u = allUsers.find((u) => u.id === userId);
          return u ? ({ userId: u.id, name: u.name, email: u.email } as GroupMember) : null;
        })
        .filter(Boolean) as GroupMember[]),
    ]
    : [];

  const availableUsers = allUsers.filter((u) => !effectiveMembers.some((m) => m.userId === u.id));

  // Available roles: not already assigned AND not pending add; also include pending removes
  const effectiveRoles = selectedGroup
    ? [
      ...selectedGroup.roles.filter((r) => !pendingRoleRemoves.includes(r.roleId)),
      ...(pendingRoleAdds
        .map((roleId) => {
          const r = allRoles.find((r) => r.id === roleId);
          return r
            ? ({ roleId: r.id, roleName: r.roleName, description: r.description } as GroupRole)
            : null;
        })
        .filter(Boolean) as GroupRole[]),
    ]
    : [];

  const availableRoles = allRoles.filter((r) => !effectiveRoles.some((er) => er.roleId === r.id));

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
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
        <SearchTextField
          placeholder={t('rbac.groups.searchPlaceholder')}
          value={searchTerm}
          onChange={(value) => setSearchTerm(value)}
          sx={{ width: 300 }}
        />
      </Box>

      {/* Table */}
      <PageContentLoader loading={loading}>
        {filteredGroups.length === 0 ? (
          <EmptyPagePlaceholder
            icon={<GroupIcon sx={{ fontSize: 48 }} />}
            message={t('rbac.groups.emptyTitle')}
            subtitle={t('rbac.groups.emptyDescription')}
          />
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t('rbac.groups.name')}</TableCell>
                  <TableCell>{t('rbac.groups.descriptionColumn')}</TableCell>
                  <TableCell align="center">{t('rbac.groups.members')}</TableCell>
                  <TableCell align="center">{t('rbac.groups.roles')}</TableCell>
                  <TableCell align="center">{t('rbac.groups.autoAdd')}</TableCell>
                  <TableCell>{t('common.createdAt')}</TableCell>
                  <TableCell align="center">{t('common.actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredGroups.map((group) => (
                  <TableRow key={group.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
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
                        <Tooltip title={t('common.copy')}>
                          <IconButton
                            size="small"
                            onClick={() => handleCopyText(group.groupName)}
                            sx={{ opacity: 0.4, '&:hover': { opacity: 1 } }}
                          >
                            <CopyIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
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
                        sx={{ borderRadius: '8px' }}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        icon={<ShieldIcon />}
                        label={group.roleCount}
                        size="small"
                        variant="outlined"
                        color={group.roleCount > 0 ? 'primary' : 'default'}
                        sx={{ borderRadius: '8px' }}
                      />
                    </TableCell>
                    <TableCell align="center">
                      {group.addNewUsersByDefault ? (
                        <Chip label={t('common.yes')} size="small" color="success" sx={{ borderRadius: '8px' }} />
                      ) : (
                        <Chip label={t('common.no')} size="small" variant="outlined" sx={{ borderRadius: '8px' }} />
                      )}
                    </TableCell>
                    <TableCell>
                      <Tooltip title={formatDateTimeDetailed(group.createdAt)}>
                        <Typography variant="body2">
                          {formatRelativeTime(group.createdAt)}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell align="center">
                      <IconButton size="small" onClick={(e) => handleMenuOpen(e, group)}>
                        <MoreVertIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </PageContentLoader>

      {/* Action Menu */}
      <Menu anchorEl={menuAnchorEl} open={Boolean(menuAnchorEl)} onClose={handleMenuClose}>
        <MenuItem
          onClick={() => {
            if (menuTarget) openEditDialog(menuTarget);
            handleMenuClose();
          }}
        >
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('common.edit')}</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menuTarget) openDeleteDialog(menuTarget);
            handleMenuClose();
          }}
        >
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>{t('common.delete')}</ListItemText>
        </MenuItem>
      </Menu>

      {/* Create / Edit Drawer */}
      <ResizableDrawer
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={dialogMode === 'create' ? t('rbac.groups.createTitle') : t('rbac.groups.editTitle')}
        storageKey="groupsDrawerWidth"
        defaultWidth={450}
        minWidth={380}
      >
        <Box
          sx={{ flex: 1, p: 3, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}
        >
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
                checked={!!formData.addNewUsersByDefault}
                onChange={(e) =>
                  setFormData({ ...formData, addNewUsersByDefault: e.target.checked })
                }
              />
            }
            label={t('rbac.groups.autoAddLabel')}
          />
        </Box>
        <Box
          sx={{
            p: 2,
            borderTop: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            display: 'flex',
            gap: 1,
            justifyContent: 'flex-end',
          }}
        >
          <Button onClick={() => setDialogOpen(false)} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving || !formData.groupName.trim() || !isEditDirty}
          >
            {saving ? <CircularProgress size={20} /> : t('common.save')}
          </Button>
        </Box>
      </ResizableDrawer>

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

      {/* Detail Drawer (Members & Roles tabs) */}
      <ResizableDrawer
        open={detailDialogOpen}
        onClose={() => setDetailDialogOpen(false)}
        title={`${selectedGroup?.groupName || ''} — ${t('rbac.groups.detail')}`}
        storageKey="groupDetailDrawerWidth"
        defaultWidth={550}
        minWidth={400}
      >
        <Box sx={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
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
          </Box>

          <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
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
              {effectiveMembers.length === 0 ? (
                <Alert severity="info">{t('rbac.groups.noMembers')}</Alert>
              ) : (
                <List dense>
                  {effectiveMembers.map((member) => {
                    const isPendingAdd = pendingMemberAdds.includes(member.userId);
                    const isPendingRemove = pendingMemberRemoves.includes(member.userId);
                    return (
                      <ListItem
                        key={member.userId}
                        divider
                        sx={{
                          opacity: isPendingRemove ? 0.4 : 1,
                          bgcolor: isPendingAdd ? 'action.selected' : 'transparent',
                        }}
                      >
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              {member.name || member.userId}
                              {isPendingAdd && (
                                <Chip
                                  label={t('common.new')}
                                  size="small"
                                  color="success"
                                  variant="outlined"
                                  sx={{ height: 20 }}
                                />
                              )}
                            </Box>
                          }
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
                    );
                  })}
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
              {effectiveRoles.length === 0 ? (
                <Alert severity="info">{t('rbac.groups.noRoles')}</Alert>
              ) : (
                <List dense>
                  {effectiveRoles.map((role) => {
                    const isPendingAdd = pendingRoleAdds.includes(role.roleId);
                    return (
                      <ListItem
                        key={role.roleId}
                        divider
                        sx={{
                          bgcolor: isPendingAdd ? 'action.selected' : 'transparent',
                        }}
                      >
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              {role.roleName || role.roleId}
                              {isPendingAdd && (
                                <Chip
                                  label={t('common.new')}
                                  size="small"
                                  color="success"
                                  variant="outlined"
                                  sx={{ height: 20 }}
                                />
                              )}
                            </Box>
                          }
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
                    );
                  })}
                </List>
              )}
            </TabPanel>
          </Box>
        </Box>

        <Box
          sx={{
            p: 2,
            borderTop: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <Button onClick={() => setDetailDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button
            variant="contained"
            onClick={handleSaveDetail}
            disabled={saving || !hasDetailChanges}
          >
            {saving ? <CircularProgress size={20} /> : t('common.save')}
          </Button>
        </Box>
      </ResizableDrawer>
    </Box>
  );
};

export default GroupsPage;
