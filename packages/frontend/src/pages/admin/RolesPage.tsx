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
  Tabs,
  Tab,
  Select,
  MenuItem,
  Switch,
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
  Folder as ProjectIcon,
  Cloud as EnvIcon,
  MoreVert as MoreVertIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useAuth } from '@/hooks/useAuth';
import EmptyPagePlaceholder from '@/components/common/EmptyPagePlaceholder';
import { formatRelativeTime, formatDateTimeDetailed } from '@/utils/dateFormat';
import { rbacService, Role, RoleWithDetails, RolePermissions } from '@/services/rbacService';
import { orgProjectService, Project } from '@/services/orgProjectService';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import ResizableDrawer from '@/components/common/ResizableDrawer';
import PageContentLoader from '@/components/common/PageContentLoader';
import SearchTextField from '@/components/common/SearchTextField';
import { copyToClipboardWithNotification } from '@/utils/clipboard';

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

  const selectedCount = permissions.org.filter((p) => availablePermissions.includes(p)).length;
  const allSelected = availablePermissions.every((p) => permissions.org.includes(p));
  const someSelected = selectedCount > 0 && !allSelected;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="subtitle2" color="text.secondary">
          {t('rbac.orgPermissions')} ({selectedCount}/{availablePermissions.length})
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
                  {t(`rbac.permCategory.${key}`)}
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
                        {t(`rbac.perm.${perm}`, perm)}
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

// ==================== Project Permission Editor ====================

interface ProjectPermissionEditorProps {
  projects: Project[];
  formPermissions: RolePermissions;
  onChange: (permissions: RolePermissions) => void;
  permissionCategories: Record<string, { label: string; permissions: string[] }>;
}

const ProjectPermissionEditor: React.FC<ProjectPermissionEditorProps> = ({
  projects,
  formPermissions,
  onChange,
  permissionCategories,
}) => {
  const { t } = useTranslation();
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  // Get unique projectIds already in permissions
  const assignedProjectIds = Array.from(new Set(formPermissions.project.map((p) => p.projectId)));

  const handleAddProject = (projectId: string) => {
    if (!projectId || assignedProjectIds.includes(projectId)) return;
    // Add project.read by default
    onChange({
      ...formPermissions,
      project: [
        ...formPermissions.project,
        { projectId, permission: 'project.read', isAdmin: false },
      ],
    });
    setSelectedProjectId('');
  };

  const handleRemoveProject = (projectId: string) => {
    onChange({
      ...formPermissions,
      project: formPermissions.project.filter((p) => p.projectId !== projectId),
    });
  };

  const handleToggleAdmin = (projectId: string) => {
    const existing = formPermissions.project.filter((p) => p.projectId === projectId);
    const isCurrentlyAdmin = existing.some((p) => p.isAdmin);
    if (isCurrentlyAdmin) {
      // Remove admin flag
      onChange({
        ...formPermissions,
        project: formPermissions.project.map((p) =>
          p.projectId === projectId ? { ...p, isAdmin: false } : p
        ),
      });
    } else {
      // Set admin flag, keep a single entry
      const filtered = formPermissions.project.filter((p) => p.projectId !== projectId);
      onChange({
        ...formPermissions,
        project: [...filtered, { projectId, permission: 'project.read', isAdmin: true }],
      });
    }
  };

  const handleTogglePermission = (projectId: string, perm: string) => {
    const hasIt = formPermissions.project.some(
      (p) => p.projectId === projectId && p.permission === perm
    );
    if (hasIt) {
      onChange({
        ...formPermissions,
        project: formPermissions.project.filter(
          (p) => !(p.projectId === projectId && p.permission === perm)
        ),
      });
    } else {
      onChange({
        ...formPermissions,
        project: [...formPermissions.project, { projectId, permission: perm, isAdmin: false }],
      });
    }
  };

  const allProjectPerms = Object.values(permissionCategories).flatMap((c) => c.permissions);

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'center' }}>
        <Select
          size="small"
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
          displayEmpty
          sx={{ flex: 1 }}
        >
          <MenuItem value="" disabled>
            {t('rbac.roles.selectProject')}
          </MenuItem>
          {projects
            .filter((p) => !assignedProjectIds.includes(p.id))
            .map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.displayName || p.projectName}
              </MenuItem>
            ))}
        </Select>
        <Button
          variant="contained"
          size="small"
          disabled={!selectedProjectId}
          onClick={() => handleAddProject(selectedProjectId)}
        >
          {t('common.add')}
        </Button>
      </Box>

      {assignedProjectIds.length === 0 ? (
        <Alert severity="info">{t('rbac.roles.noProjectPerms')}</Alert>
      ) : (
        assignedProjectIds.map((projectId) => {
          const project = projects.find((p) => p.id === projectId);
          const isAdmin = formPermissions.project.some(
            (p) => p.projectId === projectId && p.isAdmin
          );
          const projectPerms = formPermissions.project
            .filter((p) => p.projectId === projectId)
            .map((p) => p.permission);

          return (
            <Accordion
              key={projectId}
              disableGutters
              elevation={0}
              sx={{ border: 1, borderColor: 'divider', '&:before': { display: 'none' }, mb: 0.5 }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 40 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                  <ProjectIcon fontSize="small" color="primary" />
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {project?.displayName || project?.projectName || projectId}
                  </Typography>
                  {isAdmin && <Chip label="Admin" size="small" color="warning" />}
                  <Box sx={{ ml: 'auto', mr: 1 }}>
                    <IconButton
                      component="div"
                      size="small"
                      color="error"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveProject(projectId);
                      }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 0 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={isAdmin}
                      onChange={() => handleToggleAdmin(projectId)}
                      size="small"
                    />
                  }
                  label={<Typography variant="body2">{t('rbac.roles.projectAdmin')}</Typography>}
                  sx={{ mb: 1 }}
                />
                {!isAdmin && (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0 }}>
                    {allProjectPerms.map((perm) => (
                      <FormControlLabel
                        key={perm}
                        control={
                          <Checkbox
                            checked={projectPerms.includes(perm)}
                            onChange={() => handleTogglePermission(projectId, perm)}
                            size="small"
                          />
                        }
                        label={
                          <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                            {t(`rbac.perm.${perm}`, perm)}
                          </Typography>
                        }
                        sx={{ width: '50%', m: 0 }}
                      />
                    ))}
                  </Box>
                )}
              </AccordionDetails>
            </Accordion>
          );
        })
      )}
    </Box>
  );
};

// ==================== Environment Permission Editor ====================

interface EnvPermissionEditorProps {
  projects: Project[];
  environments: Record<string, Array<{ environmentId: string; name: string }>>;
  loadEnvironmentsForProject: (projectId: string) => void;
  formPermissions: RolePermissions;
  onChange: (permissions: RolePermissions) => void;
  permissionCategories: Record<string, { label: string; permissions: string[] }>;
}

const EnvPermissionEditor: React.FC<EnvPermissionEditorProps> = ({
  projects,
  environments,
  loadEnvironmentsForProject,
  formPermissions,
  onChange,
  permissionCategories,
}) => {
  const { t } = useTranslation();
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedEnvId, setSelectedEnvId] = useState<string>('');

  // Get unique environmentIds already in permissions
  const assignedEnvIds = Array.from(new Set(formPermissions.env.map((e) => e.environmentId)));

  // Load environments when project selected
  const handleProjectSelect = (projectId: string) => {
    setSelectedProjectId(projectId);
    setSelectedEnvId('');
    if (projectId) {
      loadEnvironmentsForProject(projectId);
    }
  };

  const handleAddEnv = () => {
    if (!selectedEnvId || assignedEnvIds.includes(selectedEnvId)) return;
    onChange({
      ...formPermissions,
      env: [
        ...formPermissions.env,
        { environmentId: selectedEnvId, permission: 'env.read', isAdmin: false },
      ],
    });
    setSelectedEnvId('');
  };

  const handleRemoveEnv = (envId: string) => {
    onChange({
      ...formPermissions,
      env: formPermissions.env.filter((e) => e.environmentId !== envId),
    });
  };

  const handleToggleAdmin = (envId: string) => {
    const isCurrentlyAdmin = formPermissions.env.some(
      (e) => e.environmentId === envId && e.isAdmin
    );
    if (isCurrentlyAdmin) {
      onChange({
        ...formPermissions,
        env: formPermissions.env.map((e) =>
          e.environmentId === envId ? { ...e, isAdmin: false } : e
        ),
      });
    } else {
      const filtered = formPermissions.env.filter((e) => e.environmentId !== envId);
      onChange({
        ...formPermissions,
        env: [...filtered, { environmentId: envId, permission: 'env.read', isAdmin: true }],
      });
    }
  };

  const handleTogglePermission = (envId: string, perm: string) => {
    const hasIt = formPermissions.env.some(
      (e) => e.environmentId === envId && e.permission === perm
    );
    if (hasIt) {
      onChange({
        ...formPermissions,
        env: formPermissions.env.filter(
          (e) => !(e.environmentId === envId && e.permission === perm)
        ),
      });
    } else {
      onChange({
        ...formPermissions,
        env: [...formPermissions.env, { environmentId: envId, permission: perm, isAdmin: false }],
      });
    }
  };

  const allEnvPerms = Object.values(permissionCategories).flatMap((c) => c.permissions);

  // Build env name lookup
  const envLookup: Record<string, string> = {};
  Object.values(environments)
    .flat()
    .forEach((e) => {
      envLookup[e.environmentId] = e.name;
    });

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'center' }}>
        <Select
          size="small"
          value={selectedProjectId}
          onChange={(e) => handleProjectSelect(e.target.value)}
          displayEmpty
          sx={{ flex: 1 }}
        >
          <MenuItem value="" disabled>
            {t('rbac.roles.selectProject')}
          </MenuItem>
          {projects.map((p) => (
            <MenuItem key={p.id} value={p.id}>
              {p.displayName || p.projectName}
            </MenuItem>
          ))}
        </Select>
        <Select
          size="small"
          value={selectedEnvId}
          onChange={(e) => setSelectedEnvId(e.target.value)}
          displayEmpty
          disabled={!selectedProjectId || !environments[selectedProjectId]}
          sx={{ flex: 1 }}
        >
          <MenuItem value="" disabled>
            {t('rbac.roles.selectEnvironment')}
          </MenuItem>
          {(environments[selectedProjectId] || [])
            .filter((e) => !assignedEnvIds.includes(e.environmentId))
            .map((e) => (
              <MenuItem key={e.environmentId} value={e.environmentId}>
                {e.name}
              </MenuItem>
            ))}
        </Select>
        <Button variant="contained" size="small" disabled={!selectedEnvId} onClick={handleAddEnv}>
          {t('common.add')}
        </Button>
      </Box>

      {assignedEnvIds.length === 0 ? (
        <Alert severity="info">{t('rbac.roles.noEnvPerms')}</Alert>
      ) : (
        assignedEnvIds.map((envId) => {
          const isAdmin = formPermissions.env.some((e) => e.environmentId === envId && e.isAdmin);
          const envPerms = formPermissions.env
            .filter((e) => e.environmentId === envId)
            .map((e) => e.permission);

          return (
            <Accordion
              key={envId}
              disableGutters
              elevation={0}
              sx={{ border: 1, borderColor: 'divider', '&:before': { display: 'none' }, mb: 0.5 }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 40 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                  <EnvIcon fontSize="small" color="primary" />
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {envLookup[envId] || envId}
                  </Typography>
                  {isAdmin && <Chip label="Admin" size="small" color="warning" />}
                  <Box sx={{ ml: 'auto', mr: 1 }}>
                    <IconButton
                      component="div"
                      size="small"
                      color="error"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveEnv(envId);
                      }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 0 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={isAdmin}
                      onChange={() => handleToggleAdmin(envId)}
                      size="small"
                    />
                  }
                  label={<Typography variant="body2">{t('rbac.roles.envAdmin')}</Typography>}
                  sx={{ mb: 1 }}
                />
                {!isAdmin && (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0 }}>
                    {allEnvPerms.map((perm) => (
                      <FormControlLabel
                        key={perm}
                        control={
                          <Checkbox
                            checked={envPerms.includes(perm)}
                            onChange={() => handleTogglePermission(envId, perm)}
                            size="small"
                          />
                        }
                        label={
                          <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                            {t(`rbac.perm.${perm}`, perm)}
                          </Typography>
                        }
                        sx={{ width: '50%', m: 0 }}
                      />
                    ))}
                  </Box>
                )}
              </AccordionDetails>
            </Accordion>
          );
        })
      )}
    </Box>
  );
};

// ==================== RolesPage ====================

const RolesPage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuth();
  const orgProject = useOrgProject();

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
  const [formPermissions, setFormPermissions] = useState<RolePermissions>({
    org: [],
    project: [],
    env: [],
  });
  const [initialPermissions, setInitialPermissions] = useState<RolePermissions>({
    org: [],
    project: [],
    env: [],
  });

  // Project/Environment data for permission editors
  const [projects, setProjects] = useState<Project[]>([]);
  const [environments, setEnvironments] = useState<
    Record<string, Array<{ environmentId: string; name: string }>>
  >({});

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
    loadProjects();
  }, [loadRoles, loadPermissions]);

  // Load projects for permission editors
  const loadProjects = async () => {
    try {
      const data = await orgProjectService.getProjects();
      setProjects(data);
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  };

  // Load environments for a project
  const loadEnvironmentsForProject = async (projectId: string) => {
    if (environments[projectId]) return; // Already loaded
    try {
      const orgId = orgProject.currentOrg?.id;
      if (!orgId) return;
      const projectApiPath = `/admin/orgs/${orgId}/projects/${projectId}`;
      const { environmentService } = await import('@/services/environmentService');
      const envs = await environmentService.getEnvironments(projectApiPath, true);
      setEnvironments((prev) => ({
        ...prev,
        [projectId]: envs.map((e) => ({
          environmentId: e.environmentId,
          name: e.displayName || e.environmentId,
        })),
      }));
    } catch (error) {
      console.error('Failed to load environments for project:', error);
    }
  };

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
    setPermTabIndex(0);
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

      // Preload environments for all projects so assigned env names are visible
      if (details.permissions.env.length > 0 && projects.length > 0) {
        for (const project of projects) {
          if (!environments[project.id]) {
            loadEnvironmentsForProject(project.id);
          }
        }
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
              <Tabs
                value={permTabIndex}
                onChange={(_, v) => setPermTabIndex(v)}
                sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
              >
                <Tab
                  icon={<ShieldIcon sx={{ fontSize: 16 }} />}
                  iconPosition="start"
                  label={t('rbac.orgPermissions')}
                  sx={{ minHeight: 40, textTransform: 'none' }}
                />
                <Tab
                  icon={<ProjectIcon sx={{ fontSize: 16 }} />}
                  iconPosition="start"
                  label={t('rbac.projectPermissions')}
                  sx={{ minHeight: 40, textTransform: 'none' }}
                />
                <Tab
                  icon={<EnvIcon sx={{ fontSize: 16 }} />}
                  iconPosition="start"
                  label={t('rbac.envPermissions')}
                  sx={{ minHeight: 40, textTransform: 'none' }}
                />
              </Tabs>

              {/* Org Permissions Tab */}
              {permTabIndex === 0 && (
                <PermissionEditor
                  permissions={formPermissions}
                  onChange={setFormPermissions}
                  availablePermissions={availablePermissions.filter((p) => p.startsWith('org.'))}
                  permissionCategories={Object.fromEntries(
                    Object.entries(permissionCategories).filter(
                      ([, v]) => (v as any).scope === 'org'
                    )
                  )}
                />
              )}

              {/* Project Permissions Tab */}
              {permTabIndex === 1 && (
                <ProjectPermissionEditor
                  projects={projects}
                  formPermissions={formPermissions}
                  onChange={setFormPermissions}
                  permissionCategories={Object.fromEntries(
                    Object.entries(permissionCategories).filter(
                      ([, v]) => (v as any).scope === 'project'
                    )
                  )}
                />
              )}

              {/* Environment Permissions Tab */}
              {permTabIndex === 2 && (
                <EnvPermissionEditor
                  projects={projects}
                  environments={environments}
                  loadEnvironmentsForProject={loadEnvironmentsForProject}
                  formPermissions={formPermissions}
                  onChange={setFormPermissions}
                  permissionCategories={Object.fromEntries(
                    Object.entries(permissionCategories).filter(
                      ([, v]) => (v as any).scope === 'env'
                    )
                  )}
                />
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
