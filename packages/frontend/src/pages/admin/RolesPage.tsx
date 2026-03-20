import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Alert,
  Select,
  MenuItem,
  Divider,
  Menu,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Shield as ShieldIcon,
  People as PeopleIcon,
  Group as GroupIcon,
  MoreVert as MoreVertIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';

import EmptyPagePlaceholder from '@/components/common/EmptyPagePlaceholder';
import { formatRelativeTime, formatDateTimeDetailed } from '@/utils/dateFormat';
import rbacService, {
  type RoleWithDetails,
  type Role,
  type RoleInheritance,
  type EffectivePermissions,
} from '@/services/rbacService';

import ResizableDrawer from '@/components/common/ResizableDrawer';
import PageContentLoader from '@/components/common/PageContentLoader';
import SearchTextField from '@/components/common/SearchTextField';
import { copyToClipboardWithNotification } from '@/utils/clipboard';
import PermissionTreeEditor from '@/components/rbac/PermissionTreeEditor';
import EffectivePermissionsViewer from '@/components/rbac/EffectivePermissionsViewer';

// ==================== RolesPage ====================

const RolesPage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  // Data state
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  // Permission reference
  const [availablePermissions, setAvailablePermissions] = useState<string[]>(
    []
  );
  const [permissionCategories, setPermissionCategories] = useState<
    Record<string, { label: string; scope?: string; permissions: string[] }>
  >({});

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<RoleWithDetails | null>(
    null
  );
  const [saving, setSaving] = useState(false);
  const [permTabIndex, setPermTabIndex] = useState(0);

  // Form state
  const [formData, setFormData] = useState({
    roleName: '',
    description: '',
  });
  const [initialFormData, setInitialFormData] = useState({
    roleName: '',
    description: '',
  });
  const [formPermissions, setFormPermissions] = useState<string[]>([]);
  const [initialPermissions, setInitialPermissions] = useState<string[]>([]);

  const [parentRoles, setParentRoles] = useState<RoleInheritance[]>([]);
  const [initialParentRoleIds, setInitialParentRoleIds] = useState<string[]>(
    []
  );
  const [pendingInheritanceAdds, setPendingInheritanceAdds] = useState<
    string[]
  >([]);
  const [pendingInheritanceRemoves, setPendingInheritanceRemoves] = useState<
    string[]
  >([]);
  const [selectedParentRoleId, setSelectedParentRoleId] = useState<string>('');
  const [effectivePerms, setEffectivePerms] =
    useState<EffectivePermissions | null>(null);
  const [effectivePermsLoading, setEffectivePermsLoading] = useState(false);

  // Menu state
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [menuTarget, setMenuTarget] = useState<Role | null>(null);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, role: Role) => {
    setMenuAnchorEl(event.currentTarget);
    setMenuTarget(role);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setMenuTarget(null);
  };

  const handleCopyText = (text: string) => {
    copyToClipboardWithNotification(
      text,
      () =>
        enqueueSnackbar(t('common.copiedToClipboard'), { variant: 'success' }),
      () => enqueueSnackbar(t('common.copyFailed'), { variant: 'error' })
    );
  };

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Load data
  const loadRoles = useCallback(async () => {
    try {
      setLoading(true);
      const data = await rbacService.getRoles();
      setRoles(data);
    } catch (error) {
      console.error('Failed to load roles:', error);
      enqueueSnackbar(t('rbac.roles.loadFailed'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar, t]);

  const loadPermissions = useCallback(async () => {
    try {
      const data = await rbacService.getPermissions();
      setAvailablePermissions(data.all);
      setPermissionCategories(data.categories);
    } catch (error) {
      console.error('Failed to load permissions:', error);
    }
  }, []);

  useEffect(() => {
    loadRoles();
    loadPermissions();
  }, [loadRoles, loadPermissions]);

  // Filtered roles
  const filteredRoles = debouncedSearchTerm
    ? roles.filter(
        (r) =>
          r.roleName
            .toLowerCase()
            .includes(debouncedSearchTerm.toLowerCase()) ||
          (r.description || '')
            .toLowerCase()
            .includes(debouncedSearchTerm.toLowerCase())
      )
    : roles;

  // Dialog handlers
  const openCreateDialog = () => {
    setDialogMode('create');
    setFormData({ roleName: '', description: '' });
    setFormPermissions([]);
    setSelectedRole(null);
    setParentRoles([]);
    setInitialParentRoleIds([]);
    setPendingInheritanceAdds([]);
    setPendingInheritanceRemoves([]);
    setSelectedParentRoleId('');
    setEffectivePerms(null);
    setDialogOpen(true);
  };

  const openEditDialog = async (role: Role) => {
    try {
      const details = await rbacService.getRole(role.id);
      setDialogMode('edit');
      const data = {
        roleName: details.roleName,
        description: details.description || '',
      };
      setFormData(data);
      setInitialFormData(data);
      setFormPermissions(details.permissions);
      setInitialPermissions(details.permissions);
      setSelectedRole(details);
      setPendingInheritanceAdds([]);
      setPendingInheritanceRemoves([]);
      setSelectedParentRoleId('');
      setDialogOpen(true);

      // Load role inheritance
      try {
        const inheritance = await rbacService.getRoleInheritance(role.id);
        setParentRoles(inheritance);
        setInitialParentRoleIds(inheritance.map((pr) => pr.parentRoleId));
      } catch {
        setParentRoles([]);
        setInitialParentRoleIds([]);
      }

      // Load effective permissions
      setEffectivePermsLoading(true);
      try {
        const ep = await rbacService.getEffectivePermissions(role.id);
        setEffectivePerms(ep);
      } catch {
        setEffectivePerms(null);
      } finally {
        setEffectivePermsLoading(false);
      }
    } catch (error) {
      console.error('Failed to load role details:', error);
      enqueueSnackbar(t('rbac.roles.loadFailed'), { variant: 'error' });
    }
  };

  const isEditDirty =
    dialogMode === 'create' ||
    JSON.stringify(formData) !== JSON.stringify(initialFormData) ||
    JSON.stringify(formPermissions) !== JSON.stringify(initialPermissions) ||
    pendingInheritanceAdds.length > 0 ||
    pendingInheritanceRemoves.length > 0;

  const openDeleteDialog = async (role: Role) => {
    try {
      const details = await rbacService.getRole(role.id);
      setSelectedRole(details);
      setDeleteDialogOpen(true);
    } catch (error) {
      console.error('Failed to load role details:', error);
      enqueueSnackbar(t('rbac.roles.loadFailed'), { variant: 'error' });
    }
  };

  const handleSave = async () => {
    if (!formData.roleName.trim()) {
      enqueueSnackbar(t('rbac.roles.nameRequired'), { variant: 'warning' });
      return;
    }

    try {
      setSaving(true);
      if (dialogMode === 'create') {
        const created = await rbacService.createRole({
          roleName: formData.roleName.trim(),
          description: formData.description.trim() || undefined,
          permissions: formPermissions,
        });
        // Apply pending inheritance for newly created role
        const newRoleId = (created as any)?.id;
        if (newRoleId && pendingInheritanceAdds.length > 0) {
          for (const parentId of pendingInheritanceAdds) {
            try {
              await rbacService.addRoleInheritance(newRoleId, parentId);
            } catch {
              /* ignore inheritance errors on create */
            }
          }
        }
        enqueueSnackbar(t('rbac.roles.createSuccess'), { variant: 'success' });
      } else if (selectedRole) {
        await rbacService.updateRole(selectedRole.id, {
          roleName: formData.roleName.trim(),
          description: formData.description.trim() || undefined,
          permissions: formPermissions,
        });
        // Apply pending inheritance changes
        for (const parentId of pendingInheritanceAdds) {
          try {
            await rbacService.addRoleInheritance(selectedRole.id, parentId);
          } catch {
            /* ignore */
          }
        }
        for (const parentId of pendingInheritanceRemoves) {
          try {
            // Find the inheritance record id
            const record = parentRoles.find(
              (pr) => pr.parentRoleId === parentId
            );
            if (record) {
              await rbacService.removeRoleInheritance(
                selectedRole.id,
                record.id
              );
            }
          } catch {
            /* ignore */
          }
        }
        enqueueSnackbar(t('rbac.roles.updateSuccess'), { variant: 'success' });
      }
      setDialogOpen(false);
      loadRoles();
    } catch (error: any) {
      const message =
        error?.response?.data?.message || t('rbac.roles.saveFailed');
      enqueueSnackbar(message, { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedRole) return;
    try {
      setSaving(true);
      await rbacService.deleteRole(selectedRole.id);
      enqueueSnackbar(t('rbac.roles.deleteSuccess'), { variant: 'success' });
      setDeleteDialogOpen(false);
      setSelectedRole(null);
      loadRoles();
    } catch (error: any) {
      const message =
        error?.response?.data?.message || t('rbac.roles.deleteFailed');
      enqueueSnackbar(message, { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
        }}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            {t('rbac.roles.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('rbac.roles.description')}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openCreateDialog}
        >
          {t('rbac.roles.create')}
        </Button>
      </Box>

      {/* Search */}
      <Box sx={{ mb: 2 }}>
        <SearchTextField
          placeholder={t('rbac.roles.searchPlaceholder')}
          value={searchTerm}
          onChange={(value) => setSearchTerm(value)}
        />
      </Box>

      {/* Table */}
      <PageContentLoader loading={loading}>
        {filteredRoles.length === 0 ? (
          <EmptyPagePlaceholder
            icon={<ShieldIcon sx={{ fontSize: 48 }} />}
            message={t('rbac.roles.emptyTitle')}
            subtitle={t('rbac.roles.emptyDescription')}
          />
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t('rbac.roles.name')}</TableCell>
                  <TableCell>{t('rbac.roles.descriptionColumn')}</TableCell>
                  <TableCell align="center">
                    {t('rbac.roles.permissions')}
                  </TableCell>
                  <TableCell align="center">{t('rbac.roles.users')}</TableCell>
                  <TableCell align="center">{t('rbac.roles.groups')}</TableCell>
                  <TableCell>{t('common.createdAt')}</TableCell>
                  <TableCell align="center">{t('common.actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredRoles.map((role) => (
                  <TableRow key={role.id} hover>
                    <TableCell>
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                      >
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
                          onClick={() => openEditDialog(role)}
                        >
                          {role.roleName}
                        </Typography>
                        <Tooltip title={t('common.copy')}>
                          <IconButton
                            size="small"
                            onClick={() => handleCopyText(role.roleName)}
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
                        {role.description || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        icon={<ShieldIcon />}
                        label={(role as any).permissionCount ?? '-'}
                        size="small"
                        variant="outlined"
                        sx={{ borderRadius: '8px' }}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        icon={<PeopleIcon />}
                        label={(role as any).userCount ?? '-'}
                        size="small"
                        variant="outlined"
                        color={
                          (role as any).userCount > 0 ? 'primary' : 'default'
                        }
                        sx={{ borderRadius: '8px' }}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        icon={<GroupIcon />}
                        label={(role as any).groupCount ?? '-'}
                        size="small"
                        variant="outlined"
                        color={
                          (role as any).groupCount > 0 ? 'primary' : 'default'
                        }
                        sx={{ borderRadius: '8px' }}
                      />
                    </TableCell>
                    <TableCell>
                      <Tooltip title={formatDateTimeDetailed(role.createdAt)}>
                        <Typography variant="body2">
                          {formatRelativeTime(role.createdAt)}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        onClick={(e) => handleMenuOpen(e, role)}
                      >
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
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
      >
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
        title={
          dialogMode === 'create'
            ? t('rbac.roles.createTitle')
            : t('rbac.roles.editTitle')
        }
        subtitle={
          dialogMode === 'create'
            ? t('rbac.roles.createDescription')
            : t('rbac.roles.editDescription')
        }
        storageKey="rolesDrawerWidth"
        defaultWidth={600}
        minWidth={450}
      >
        <Box
          sx={{
            flex: 1,
            p: 3,
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          <TextField
            label={t('rbac.roles.name')}
            value={formData.roleName}
            onChange={(e) =>
              setFormData({ ...formData, roleName: e.target.value })
            }
            required
            fullWidth
            autoFocus
            size="small"
            helperText={t('rbac.roles.nameHelp')}
          />
          <TextField
            label={t('rbac.roles.descriptionColumn')}
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            fullWidth
            multiline
            rows={2}
            size="small"
          />

          {formPermissions.includes('*:*') ? (
            /* Wildcard role — no need for granular permission editing */
            <Box>
              <Divider sx={{ mb: 1 }} />
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 2,
                  py: 1.5,
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  borderRadius: 1,
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  ✦ {t('rbac.roles.wildcardPermission')}
                </Typography>
              </Box>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 1, fontSize: '0.8rem' }}
              >
                {t(
                  'rbac.roles.wildcardPermissionDesc',
                  'This role has unrestricted access to all resources and actions.'
                )}
              </Typography>
            </Box>
          ) : (
            <>
              {availablePermissions.length > 0 && (
                <Box>
                  <Divider sx={{ mb: 1 }} />
                  <PermissionTreeEditor
                    permissions={formPermissions}
                    onChange={setFormPermissions}
                    availablePermissions={availablePermissions}
                    permissionCategories={permissionCategories}
                  />
                </Box>
              )}

              {/* Role Inheritance Section */}
              <Box>
                <Divider sx={{ mb: 1 }} />
                <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                  {t('rbac.roles.inheritance')}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 1 }}
                >
                  {t('rbac.roles.inheritanceHelp')}
                </Typography>

                {/* Add parent role */}
                <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                  <Select
                    value={selectedParentRoleId}
                    onChange={(e) => setSelectedParentRoleId(e.target.value)}
                    size="small"
                    displayEmpty
                    sx={{ flex: 1 }}
                  >
                    <MenuItem value="" disabled>
                      {t('rbac.roles.selectParentRole')}
                    </MenuItem>
                    {roles
                      .filter(
                        (r) =>
                          (dialogMode === 'create' ||
                            r.id !== selectedRole?.id) &&
                          !parentRoles.some((pr) => pr.parentRoleId === r.id) &&
                          !pendingInheritanceAdds.includes(r.id)
                      )
                      .map((r) => (
                        <MenuItem key={r.id} value={r.id}>
                          {r.roleName}
                        </MenuItem>
                      ))}
                  </Select>
                  <Button
                    variant="contained"
                    size="small"
                    disabled={!selectedParentRoleId}
                    onClick={() => {
                      if (!selectedParentRoleId) return;
                      // Buffer locally — do not call server
                      if (
                        pendingInheritanceRemoves.includes(selectedParentRoleId)
                      ) {
                        // Cancel pending remove
                        setPendingInheritanceRemoves((prev) =>
                          prev.filter((id) => id !== selectedParentRoleId)
                        );
                      } else {
                        setPendingInheritanceAdds((prev) => [
                          ...prev,
                          selectedParentRoleId,
                        ]);
                      }
                      setSelectedParentRoleId('');
                    }}
                  >
                    {t('common.add')}
                  </Button>
                </Box>

                {/* Parent role list */}
                {(() => {
                  const effectiveParents = [
                    ...parentRoles
                      .filter(
                        (pr) =>
                          !pendingInheritanceRemoves.includes(pr.parentRoleId)
                      )
                      .map((pr) => ({
                        id: pr.parentRoleId,
                        name: pr.parentRoleName,
                        isPending: false,
                      })),
                    ...pendingInheritanceAdds.map((id) => {
                      const r = roles.find((r) => r.id === id);
                      return { id, name: r?.roleName || id, isPending: true };
                    }),
                  ];
                  if (effectiveParents.length === 0) {
                    return (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ textAlign: 'center', py: 2 }}
                      >
                        {t('rbac.roles.noParentRoles')}
                      </Typography>
                    );
                  }
                  return (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {effectiveParents.map((pr) => (
                        <Chip
                          key={pr.id}
                          label={pr.name}
                          onDelete={() => {
                            if (pr.isPending) {
                              // Remove from pending adds
                              setPendingInheritanceAdds((prev) =>
                                prev.filter((id) => id !== pr.id)
                              );
                            } else {
                              // Add to pending removes
                              setPendingInheritanceRemoves((prev) => [
                                ...prev,
                                pr.id,
                              ]);
                            }
                          }}
                          size="small"
                          variant="outlined"
                          color={pr.isPending ? 'success' : 'default'}
                        />
                      ))}
                    </Box>
                  );
                })()}
              </Box>

              {/* Effective Permissions — reflects current form state */}
              <Box>
                <Divider sx={{ mb: 1 }} />
                <Typography
                  variant="subtitle2"
                  fontWeight={600}
                  sx={{ mb: 0.5 }}
                >
                  {t('rbac.roles.effectivePermissions')}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 1, fontSize: '0.8rem' }}
                >
                  {t('rbac.roles.effectivePermissionsDesc')}
                </Typography>
                <EffectivePermissionsViewer
                  data={{
                    own: formPermissions,
                    inherited: (effectivePerms?.inherited || []).filter(
                      (ip) => !pendingInheritanceRemoves.includes(ip.fromRoleId)
                    ),
                  }}
                  loading={effectivePermsLoading}
                />
              </Box>
            </>
          )}
        </Box>

        {/* Footer Actions */}
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
            disabled={saving || !formData.roleName.trim() || !isEditDirty}
          >
            {saving ? (
              <CircularProgress size={20} />
            ) : dialogMode === 'edit' ? (
              t('common.update')
            ) : (
              t('common.save')
            )}
          </Button>
        </Box>
      </ResizableDrawer>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>{t('rbac.roles.deleteTitle')}</DialogTitle>
        <DialogContent>
          {selectedRole && (
            <Box>
              <Typography>
                {t('rbac.roles.deleteConfirm', { name: selectedRole.roleName })}
              </Typography>
              {(selectedRole.userCount > 0 || selectedRole.groupCount > 0) && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  {t('rbac.roles.deleteWarning', {
                    users: selectedRole.userCount,
                    groups: selectedRole.groupCount,
                  })}
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDelete}
            disabled={saving}
          >
            {saving ? <CircularProgress size={20} /> : t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RolesPage;
