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
  Checkbox,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
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
  ExpandMore as ExpandMoreIcon,
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
} from '@/services/rbacService';


import ResizableDrawer from '@/components/common/ResizableDrawer';
import PageContentLoader from '@/components/common/PageContentLoader';
import SearchTextField from '@/components/common/SearchTextField';
import { copyToClipboardWithNotification } from '@/utils/clipboard';

// Helper: convert 'resource:action' to i18n key 'rbac.perm.resource.action'
const permLabel = (t: any, perm: string): string => {
  const key = `rbac.perm.${perm.replace(':', '.')}`;
  return t(key, perm);
};

// ==================== Permission Editor ====================

interface PermissionEditorProps {
  permissions: string[];
  onChange: (permissions: string[]) => void;
  availablePermissions: string[];
  permissionCategories: Record<string, { label: string; permissions: string[] }>;
}

const PermissionEditor: React.FC<PermissionEditorProps> = ({
  permissions,
  onChange,
  availablePermissions,
  permissionCategories,
}) => {
  const { t } = useTranslation();

  const handleTogglePermission = (perm: string) => {
    const newPerms = permissions.includes(perm)
      ? permissions.filter((p) => p !== perm)
      : [...permissions, perm];
    onChange(newPerms);
  };

  const handleToggleCategory = (categoryPerms: string[]) => {
    const allChecked = categoryPerms.every((p) => permissions.includes(p));
    if (allChecked) {
      onChange(permissions.filter((p) => !categoryPerms.includes(p)));
    } else {
      const newPerms = [...permissions];
      categoryPerms.forEach((p) => {
        if (!newPerms.includes(p)) newPerms.push(p);
      });
      onChange(newPerms);
    }
  };

  const handleSelectAll = () => {
    const allSelected = availablePermissions.every((p) => permissions.includes(p));
    if (allSelected) {
      onChange(permissions.filter((p) => !availablePermissions.includes(p)));
    } else {
      const newPerms = [...permissions];
      availablePermissions.forEach((p) => {
        if (!newPerms.includes(p)) newPerms.push(p);
      });
      onChange(newPerms);
    }
  };

  const selectedCount = permissions.filter((p) => availablePermissions.includes(p)).length;
  const allSelected = availablePermissions.every((p) => permissions.includes(p));
  const someSelected = selectedCount > 0 && !allSelected;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="subtitle2" color="text.secondary">
          {t('rbac.permissions')} ({selectedCount}/{availablePermissions.length})
        </Typography>
        <FormControlLabel
          control={
            <Checkbox
              checked={allSelected}
              indeterminate={someSelected}
              onChange={handleSelectAll}
              size="small"
            />
          }
          label={<Typography variant="body2">{t('rbac.selectAll')}</Typography>}
        />
      </Box>

      {Object.entries(permissionCategories).map(([key, category]) => {
        const catPerms = category.permissions.filter((p) => availablePermissions.includes(p));
        if (catPerms.length === 0) return null;
        const allCatChecked = catPerms.every((p) => permissions.includes(p));
        const someCatChecked = catPerms.some((p) => permissions.includes(p)) && !allCatChecked;

        return (
          <Accordion
            key={key}
            disableGutters
            elevation={0}
            sx={{
              border: 1,
              borderColor: 'divider',
              '&:before': { display: 'none' },
              mb: 0.5,
            }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 40 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                <Checkbox
                  checked={allCatChecked}
                  indeterminate={someCatChecked}
                  onChange={() => handleToggleCategory(catPerms)}
                  size="small"
                  onClick={(e) => e.stopPropagation()}
                />
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {t(category.label, key)}
                </Typography>
                <Chip
                  label={`${catPerms.filter((p) => permissions.includes(p)).length}/${catPerms.length}`}
                  size="small"
                  variant="outlined"
                  sx={{ ml: 'auto', mr: 1 }}
                />
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0, pb: 1 }}>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0 }}>
                {catPerms.map((perm) => (
                  <FormControlLabel
                    key={perm}
                    control={
                      <Checkbox
                        checked={permissions.includes(perm)}
                        onChange={() => handleTogglePermission(perm)}
                        size="small"
                      />
                    }
                    label={
                      <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                        {permLabel(t, perm)}
                      </Typography>
                    }
                    sx={{ width: '50%', m: 0 }}
                  />
                ))}
              </Box>
            </AccordionDetails>
          </Accordion>
        );
      })}
    </Box>
  );
};


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
  const [availablePermissions, setAvailablePermissions] = useState<string[]>([]);
  const [permissionCategories, setPermissionCategories] = useState<
    Record<string, { label: string; scope?: string; permissions: string[] }>
  >({});

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<RoleWithDetails | null>(null);
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
  const [selectedParentRoleId, setSelectedParentRoleId] = useState<string>('');

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
      () => enqueueSnackbar(t('common.copiedToClipboard'), { variant: 'success' }),
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
        r.roleName.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        (r.description || '').toLowerCase().includes(debouncedSearchTerm.toLowerCase())
    )
    : roles;

  // Dialog handlers
  const openCreateDialog = () => {
    setDialogMode('create');
    setFormData({ roleName: '', description: '' });
    setFormPermissions([]);
    setSelectedRole(null);
    setDialogOpen(true);
  };

  const openEditDialog = async (role: Role) => {
    try {
      const details = await rbacService.getRole(role.id);
      setDialogMode('edit');
      const data = { roleName: details.roleName, description: details.description || '' };
      setFormData(data);
      setInitialFormData(data);
      setFormPermissions(details.permissions);
      setInitialPermissions(details.permissions);
      setSelectedRole(details);
      setDialogOpen(true);

      // Load role inheritance
      try {
        const inheritance = await rbacService.getRoleInheritance(role.id);
        setParentRoles(inheritance);
      } catch {
        setParentRoles([]);
      }
    } catch (error) {
      console.error('Failed to load role details:', error);
      enqueueSnackbar(t('rbac.roles.loadFailed'), { variant: 'error' });
    }
  };

  const isEditDirty =
    dialogMode === 'create' ||
    JSON.stringify(formData) !== JSON.stringify(initialFormData) ||
    JSON.stringify(formPermissions) !== JSON.stringify(initialPermissions);

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
        await rbacService.createRole({
          roleName: formData.roleName.trim(),
          description: formData.description.trim() || undefined,
          permissions: formPermissions,
        });
        enqueueSnackbar(t('rbac.roles.createSuccess'), { variant: 'success' });
      } else if (selectedRole) {
        await rbacService.updateRole(selectedRole.id, {
          roleName: formData.roleName.trim(),
          description: formData.description.trim() || undefined,
          permissions: formPermissions,
        });
        enqueueSnackbar(t('rbac.roles.updateSuccess'), { variant: 'success' });
      }
      setDialogOpen(false);
      loadRoles();
    } catch (error: any) {
      const message = error?.response?.data?.message || t('rbac.roles.saveFailed');
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
      const message = error?.response?.data?.message || t('rbac.roles.deleteFailed');
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
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}>
          {t('rbac.roles.create')}
        </Button>
      </Box>

      {/* Search */}
      <Box sx={{ mb: 2 }}>
        <SearchTextField
          placeholder={t('rbac.roles.searchPlaceholder')}
          value={searchTerm}
          onChange={(value) => setSearchTerm(value)}
          sx={{ width: 300 }}
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
                  <TableCell align="center">{t('rbac.roles.permissions')}</TableCell>
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
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 500,
                            cursor: 'pointer',
                            '&:hover': { color: 'primary.main', textDecoration: 'underline' },
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
                        color={(role as any).userCount > 0 ? 'primary' : 'default'}
                        sx={{ borderRadius: '8px' }}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        icon={<GroupIcon />}
                        label={(role as any).groupCount ?? '-'}
                        size="small"
                        variant="outlined"
                        color={(role as any).groupCount > 0 ? 'primary' : 'default'}
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
                      <IconButton size="small" onClick={(e) => handleMenuOpen(e, role)}>
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
        title={dialogMode === 'create' ? t('rbac.roles.createTitle') : t('rbac.roles.editTitle')}
        storageKey="rolesDrawerWidth"
        defaultWidth={600}
        minWidth={450}
      >
        <Box
          sx={{ flex: 1, p: 3, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}
        >
          <Typography variant="body2" color="text.secondary" sx={{ mt: -1 }}>
            {dialogMode === 'create'
              ? t('rbac.roles.createDescription')
              : t('rbac.roles.editDescription')}
          </Typography>

          <TextField
            label={t('rbac.roles.name')}
            value={formData.roleName}
            onChange={(e) => setFormData({ ...formData, roleName: e.target.value })}
            required
            fullWidth
            autoFocus
            size="small"
            helperText={t('rbac.roles.nameHelp')}
          />
          <TextField
            label={t('rbac.roles.descriptionColumn')}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            fullWidth
            multiline
            rows={2}
            size="small"
          />

          {availablePermissions.length > 0 && (
            <Box>
              <Divider sx={{ mb: 1 }} />
              <PermissionEditor
                permissions={formPermissions}
                onChange={setFormPermissions}
                availablePermissions={availablePermissions}
                permissionCategories={permissionCategories}
              />
            </Box>
          )}

          {/* Role Inheritance Section (edit mode only) */}
          {dialogMode === 'edit' && selectedRole && (
            <Box>
              <Divider sx={{ mb: 1 }} />
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                {t('rbac.roles.inheritance')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
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
                        r.id !== selectedRole.id &&
                        !parentRoles.some((pr) => pr.parentRoleId === r.id)
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
                  onClick={async () => {
                    if (!selectedParentRoleId || !selectedRole) return;
                    try {
                      await rbacService.addRoleInheritance(selectedRole.id, selectedParentRoleId);
                      // Reload inheritance
                      const data = await rbacService.getRoleInheritance(selectedRole.id);
                      setParentRoles(data);
                      setSelectedParentRoleId('');
                      enqueueSnackbar(t('rbac.roles.inheritanceAdded'), { variant: 'success' });
                    } catch (error: any) {
                      const msg =
                        error?.response?.data?.message || t('rbac.roles.inheritanceAddFailed');
                      enqueueSnackbar(msg, { variant: 'error' });
                    }
                  }}
                >
                  {t('common.add')}
                </Button>
              </Box>

              {/* Parent role list */}
              {parentRoles.length === 0 ? (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ textAlign: 'center', py: 2 }}
                >
                  {t('rbac.roles.noParentRoles')}
                </Typography>
              ) : (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {parentRoles.map((pr) => (
                    <Chip
                      key={pr.id}
                      label={pr.parentRoleName}
                      onDelete={async () => {
                        try {
                          await rbacService.removeRoleInheritance(selectedRole.id, pr.id);
                          setParentRoles((prev) => prev.filter((p) => p.id !== pr.id));
                          enqueueSnackbar(t('rbac.roles.inheritanceRemoved'), {
                            variant: 'success',
                          });
                        } catch {
                          enqueueSnackbar(t('rbac.roles.inheritanceRemoveFailed'), {
                            variant: 'error',
                          });
                        }
                      }}
                      size="small"
                      variant="outlined"
                    />
                  ))}
                </Box>
              )}
            </Box>
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
            {saving ? <CircularProgress size={20} /> : t('common.save')}
          </Button>
        </Box>
      </ResizableDrawer>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
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
          <Button variant="contained" color="error" onClick={handleDelete} disabled={saving}>
            {saving ? <CircularProgress size={20} /> : t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RolesPage;
