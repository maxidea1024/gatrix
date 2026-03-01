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
  Checkbox,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  InputAdornment,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  Search as SearchIcon,
  Shield as ShieldIcon,
  People as PeopleIcon,
  Group as GroupIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useAuth } from '@/hooks/useAuth';
import EmptyPagePlaceholder from '@/components/common/EmptyPagePlaceholder';
import { formatRelativeTime } from '@/utils/dateFormat';
import {
  rbacService,
  Role,
  RoleWithDetails,
  RolePermissions,
} from '@/services/rbacService';

// ==================== Permission Editor ====================

interface PermissionEditorProps {
  permissions: RolePermissions;
  onChange: (permissions: RolePermissions) => void;
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
    const newOrg = permissions.org.includes(perm)
      ? permissions.org.filter((p) => p !== perm)
      : [...permissions.org, perm];
    onChange({ ...permissions, org: newOrg });
  };

  const handleToggleCategory = (categoryPerms: string[]) => {
    const allChecked = categoryPerms.every((p) => permissions.org.includes(p));
    if (allChecked) {
      onChange({
        ...permissions,
        org: permissions.org.filter((p) => !categoryPerms.includes(p)),
      });
    } else {
      const newOrg = [...permissions.org];
      categoryPerms.forEach((p) => {
        if (!newOrg.includes(p)) newOrg.push(p);
      });
      onChange({ ...permissions, org: newOrg });
    }
  };

  const handleSelectAll = () => {
    const allSelected = availablePermissions.every((p) => permissions.org.includes(p));
    if (allSelected) {
      onChange({ ...permissions, org: [] });
    } else {
      onChange({ ...permissions, org: [...availablePermissions] });
    }
  };

  const allSelected = availablePermissions.every((p) => permissions.org.includes(p));
  const someSelected = permissions.org.length > 0 && !allSelected;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="subtitle2" color="text.secondary">
          {t('rbac.orgPermissions')} ({permissions.org.length}/{availablePermissions.length})
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
          label={
            <Typography variant="body2">{t('rbac.selectAll')}</Typography>
          }
        />
      </Box>

      {Object.entries(permissionCategories).map(([key, category]) => {
        const catPerms = category.permissions.filter((p) =>
          availablePermissions.includes(p)
        );
        if (catPerms.length === 0) return null;
        const allCatChecked = catPerms.every((p) => permissions.org.includes(p));
        const someCatChecked = catPerms.some((p) => permissions.org.includes(p)) && !allCatChecked;

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
                  {t(category.label)}
                </Typography>
                <Chip
                  label={`${catPerms.filter((p) => permissions.org.includes(p)).length}/${catPerms.length}`}
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
                        checked={permissions.org.includes(perm)}
                        onChange={() => handleTogglePermission(perm)}
                        size="small"
                      />
                    }
                    label={
                      <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                        {perm}
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
  const { user } = useAuth();

  // Data state
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  // Permission reference
  const [availablePermissions, setAvailablePermissions] = useState<string[]>([]);
  const [permissionCategories, setPermissionCategories] = useState<
    Record<string, { label: string; permissions: string[] }>
  >({});

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<RoleWithDetails | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    roleName: '',
    description: '',
  });
  const [formPermissions, setFormPermissions] = useState<RolePermissions>({
    org: [],
    project: [],
    env: [],
  });

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
    setFormPermissions({ org: [], project: [], env: [] });
    setSelectedRole(null);
    setDialogOpen(true);
  };

  const openEditDialog = async (role: Role) => {
    try {
      const details = await rbacService.getRole(role.id);
      setDialogMode('edit');
      setFormData({ roleName: details.roleName, description: details.description || '' });
      setFormPermissions(details.permissions);
      setSelectedRole(details);
      setDialogOpen(true);
    } catch (error) {
      console.error('Failed to load role details:', error);
      enqueueSnackbar(t('rbac.roles.loadFailed'), { variant: 'error' });
    }
  };

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
        <TextField
          size="small"
          placeholder={t('rbac.roles.searchPlaceholder')}
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
          ) : filteredRoles.length === 0 ? (
            <EmptyPagePlaceholder
              icon={<ShieldIcon sx={{ fontSize: 48 }} />}
              message={t('rbac.roles.emptyTitle')}
              subtitle={t('rbac.roles.emptyDescription')}
            />
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t('rbac.roles.name')}</TableCell>
                    <TableCell>{t('rbac.roles.descriptionColumn')}</TableCell>
                    <TableCell align="center">{t('rbac.roles.permissions')}</TableCell>
                    <TableCell align="center">{t('rbac.roles.users')}</TableCell>
                    <TableCell align="center">{t('rbac.roles.groups')}</TableCell>
                    <TableCell>{t('common.createdAt')}</TableCell>
                    <TableCell align="right">{t('common.actions')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredRoles.map((role) => (
                    <TableRow
                      key={role.id}
                      hover
                      sx={{ '&:last-child td': { borderBottom: 0 } }}
                    >
                      <TableCell>
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
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          icon={<PeopleIcon />}
                          label={(role as any).userCount ?? '-'}
                          size="small"
                          variant="outlined"
                          color={(role as any).userCount > 0 ? 'primary' : 'default'}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          icon={<GroupIcon />}
                          label={(role as any).groupCount ?? '-'}
                          size="small"
                          variant="outlined"
                          color={(role as any).groupCount > 0 ? 'primary' : 'default'}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatRelativeTime(role.createdAt)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title={t('common.edit')}>
                          <IconButton size="small" onClick={() => openEditDialog(role)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t('common.delete')}>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => openDeleteDialog(role)}
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
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {dialogMode === 'create' ? t('rbac.roles.createTitle') : t('rbac.roles.editTitle')}
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label={t('rbac.roles.name')}
              value={formData.roleName}
              onChange={(e) => setFormData({ ...formData, roleName: e.target.value })}
              required
              fullWidth
              autoFocus
              size="small"
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
              <PermissionEditor
                permissions={formPermissions}
                onChange={setFormPermissions}
                availablePermissions={availablePermissions}
                permissionCategories={permissionCategories}
              />
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving || !formData.roleName.trim()}
          >
            {saving ? <CircularProgress size={20} /> : t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>

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
