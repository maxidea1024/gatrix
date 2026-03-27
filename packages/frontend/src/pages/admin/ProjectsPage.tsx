import React, { useState, useEffect, useCallback } from 'react';
import { isValidResourceName } from '../../utils/validation';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActionArea,
  IconButton,
  Tooltip,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  CircularProgress,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Breadcrumbs,
  Link,
  Collapse,
  List,
  ListItemButton,
  Autocomplete,
  Select,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Folder as ProjectIcon,
  MoreVert as MoreVertIcon,
  CalendarToday as CalendarTodayIcon,
  NavigateNext as NavigateNextIcon,
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon,
  Public as EnvironmentIcon,
  People as PeopleIcon,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import {
  useNavigate,
  useSearchParams,
  Link as RouterLink,
} from 'react-router-dom';
import EmptyPlaceholder from '@/components/common/EmptyPlaceholder';
import {
  orgProjectService,
  Project,
  AccessTree,
} from '@/services/orgProjectService';
import { environmentService, Environment } from '@/services/environmentService';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import { formatRelativeTime, formatDateTimeDetailed } from '@/utils/dateFormat';
import ResizableDrawer from '@/components/common/ResizableDrawer';
import PageHeader from '@/components/common/PageHeader';
import PageContentLoader from '@/components/common/PageContentLoader';
import { rbacService } from '@/services/rbacService';
import { useDebounce } from '@/hooks/useDebounce';

const ProjectsPage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refreshProjects, currentOrg, currentProjectId, organisations } =
    useOrgProject();

  // Resolve the parent org from URL param or current context
  const urlOrgId = searchParams.get('orgId');
  const effectiveOrg = urlOrgId
    ? organisations.find((o) => o.id === urlOrgId) || currentOrg
    : currentOrg;

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [accessTree, setAccessTree] = useState<AccessTree>({});
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(
    new Set()
  );
  const [projectEnvMap, setProjectEnvMap] = useState<
    Record<string, Environment[]>
  >({});
  const [loadingEnvProjects, setLoadingEnvProjects] = useState<Set<string>>(
    new Set()
  );

  // Create/Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [formData, setFormData] = useState({
    projectName: '',
    displayName: '',
    description: '',
  });
  const [initialFormData, setInitialFormData] = useState({
    projectName: '',
    displayName: '',
    description: '',
  });
  const [editId, setEditId] = useState<string | null>(null);

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);

  // Menu state
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [menuTarget, setMenuTarget] = useState<Project | null>(null);

  const handleMenuOpen = (
    event: React.MouseEvent<HTMLElement>,
    proj: Project
  ) => {
    setMenuAnchorEl(event.currentTarget);
    setMenuTarget(proj);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setMenuTarget(null);
  };

  // ─── Member Management ─────────────────────────
  const [memberDrawerOpen, setMemberDrawerOpen] = useState(false);
  const [memberProject, setMemberProject] = useState<Project | null>(null);
  const [memberLoading, setMemberLoading] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [pendingChanges, setPendingChanges] = useState<{
    add: {
      userId: string;
      name: string;
      email: string;
      projectRole: 'admin' | 'member';
    }[];
    remove: string[];
    roleChanges: Record<string, 'admin' | 'member'>;
  }>({ add: [], remove: [], roleChanges: {} });
  const [userSearchInput, setUserSearchInput] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<
    { id: string; name: string; email: string }[]
  >([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const debouncedUserSearch = useDebounce(userSearchInput, 300);
  const [memberApplying, setMemberApplying] = useState(false);

  // Search users for autocomplete
  useEffect(() => {
    if (!debouncedUserSearch || debouncedUserSearch.length < 2) {
      setUserSearchResults([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setUserSearchLoading(true);
      try {
        const results = await rbacService.searchUsers(
          debouncedUserSearch,
          effectiveOrg?.id
        );
        if (!cancelled) setUserSearchResults(results);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setUserSearchLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedUserSearch, effectiveOrg?.id]);

  const handleOpenMemberDrawer = async (proj: Project) => {
    setMemberProject(proj);
    setMemberDrawerOpen(true);
    setMemberLoading(true);
    setPendingChanges({ add: [], remove: [], roleChanges: {} });
    try {
      const data = await rbacService.getProjectMembers(proj.id);
      setMembers(data);
    } catch {
      enqueueSnackbar(t('rbac.projects.memberUpdateFailed'), {
        variant: 'error',
      });
    } finally {
      setMemberLoading(false);
    }
  };

  const handleApplyMembers = async () => {
    if (!memberProject) return;
    setMemberApplying(true);
    try {
      // Apply removals
      for (const userId of pendingChanges.remove) {
        await rbacService.removeProjectMember(memberProject.id, userId);
      }
      // Apply additions
      for (const m of pendingChanges.add) {
        await rbacService.addProjectMember(
          memberProject.id,
          m.userId,
          m.projectRole
        );
      }
      // Apply role changes
      for (const [userId, role] of Object.entries(pendingChanges.roleChanges)) {
        await rbacService.updateProjectMemberRole(
          memberProject.id,
          userId,
          role
        );
      }
      enqueueSnackbar(t('rbac.projects.membersUpdated'), {
        variant: 'success',
      });
      // Reload members
      const data = await rbacService.getProjectMembers(memberProject.id);
      setMembers(data);
      setPendingChanges({ add: [], remove: [], roleChanges: {} });
    } catch {
      enqueueSnackbar(t('rbac.projects.memberUpdateFailed'), {
        variant: 'error',
      });
    } finally {
      setMemberApplying(false);
    }
  };

  const hasPendingMemberChanges =
    pendingChanges.add.length > 0 ||
    pendingChanges.remove.length > 0 ||
    Object.keys(pendingChanges.roleChanges).length > 0;

  // Load projects and filter by effective org
  const loadProjects = useCallback(
    async (silent = false) => {
      try {
        if (!silent) setLoading(true);
        const projectData = await orgProjectService.getProjects();
        // Filter by the effective org (URL param or current context)
        const orgId = effectiveOrg?.id;
        setProjects(
          orgId ? projectData.filter((p) => p.orgId === orgId) : projectData
        );

        // Load access tree (non-blocking)
        try {
          const access = await orgProjectService.getMyAccess();
          setAccessTree(access);
        } catch {
          console.warn('Failed to load access tree');
        }
      } catch {
        enqueueSnackbar(t('rbac.projects.loadFailed'), { variant: 'error' });
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [enqueueSnackbar, t, effectiveOrg?.id]
  );

  // Toggle project expansion and load environments
  const handleToggleProjectExpand = useCallback(
    async (e: React.MouseEvent, proj: Project) => {
      e.stopPropagation();
      const projId = proj.id;

      setExpandedProjects((prev) => {
        const next = new Set(prev);
        if (next.has(projId)) {
          next.delete(projId);
        } else {
          next.add(projId);
        }
        return next;
      });

      // Load environments if not already loaded
      if (!projectEnvMap[projId]) {
        setLoadingEnvProjects((prev) => new Set(prev).add(projId));
        try {
          const orgId = proj.orgId;
          const apiPath = `/admin/orgs/${orgId}/projects/${projId}`;
          const envs = await environmentService.getEnvironments(apiPath);

          // Filter by RBAC access
          const orgAccess = accessTree[orgId];
          const accessibleEnvIds = orgAccess?.environments?.[projId];
          const filteredEnvs = accessibleEnvIds
            ? envs.filter((e) => accessibleEnvIds.includes(e.environmentId))
            : envs;

          setProjectEnvMap((prev) => ({ ...prev, [projId]: filteredEnvs }));
        } catch {
          console.warn('Failed to load environments for project', projId);
        } finally {
          setLoadingEnvProjects((prev) => {
            const next = new Set(prev);
            next.delete(projId);
            return next;
          });
        }
      }
    },
    [projectEnvMap, accessTree]
  );

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Open create dialog
  const handleCreate = () => {
    setDialogMode('create');
    setFormData({ projectName: '', displayName: '', description: '' });
    setEditId(null);
    setDialogOpen(true);
  };

  // Open edit dialog
  const handleEdit = (proj: Project) => {
    setDialogMode('edit');
    const data = {
      projectName: proj.projectName,
      displayName: proj.displayName || '',
      description: proj.description || '',
    };
    setFormData(data);
    setInitialFormData(data);
    setEditId(proj.id);
    setDialogOpen(true);
  };

  const isEditDirty =
    dialogMode === 'create' ||
    JSON.stringify(formData) !== JSON.stringify(initialFormData);

  // Save
  const handleSave = async () => {
    if (!formData.projectName.trim()) {
      enqueueSnackbar(t('rbac.projects.nameRequired'), { variant: 'warning' });
      return;
    }

    try {
      setSaving(true);
      if (dialogMode === 'create') {
        await orgProjectService.createProject({
          ...formData,
          orgId: effectiveOrg?.id,
        });
        enqueueSnackbar(t('rbac.projects.createSuccess'), {
          variant: 'success',
        });
      } else if (editId) {
        await orgProjectService.updateProject(editId, {
          displayName: formData.displayName,
          description: formData.description,
        });
        enqueueSnackbar(t('rbac.projects.updateSuccess'), {
          variant: 'success',
        });
      }
      setDialogOpen(false);
      loadProjects(true);
      refreshProjects();
    } catch (error: any) {
      const message =
        error?.response?.data?.message || t('rbac.projects.saveFailed');
      enqueueSnackbar(message, { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // Delete
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setSaving(true);
      await orgProjectService.deleteProject(deleteTarget.id);
      enqueueSnackbar(t('rbac.projects.deleteSuccess'), { variant: 'success' });
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
      loadProjects(true);
      refreshProjects();
    } catch (error: any) {
      const message =
        error?.response?.data?.message || t('rbac.projects.deleteFailed');
      enqueueSnackbar(message, { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Breadcrumb */}
      <Breadcrumbs
        separator={<NavigateNextIcon fontSize="small" />}
        sx={{ mb: 2 }}
      >
        <Link
          component={RouterLink}
          to="/admin/workspace"
          underline="hover"
          color="inherit"
          sx={{ display: 'flex', alignItems: 'center' }}
        >
          {t('workspace.title')}
        </Link>
        <Typography color="text.primary" fontWeight={500}>
          {effectiveOrg?.displayName ||
            effectiveOrg?.orgName ||
            t('common.organisation')}
        </Typography>
      </Breadcrumbs>

      {/* Header */}
      <PageHeader
        title={t('rbac.projects.title')}
        subtitle={t('rbac.projects.description')}
        actions={
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreate}
          >
            {t('rbac.projects.create')}
          </Button>
        }
      />

      <PageContentLoader loading={loading}>
        {projects.length === 0 ? (
          <EmptyPlaceholder
            message={t('rbac.projects.emptyTitle')}
            description={t('rbac.projects.emptyDescription')}
          />
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, 1fr)',
                md: 'repeat(3, 1fr)',
              },
              gap: 3,
            }}
          >
            {projects.map((proj) => (
              <Card
                key={proj.id}
                sx={{
                  borderRadius: 3,
                  border: '1px solid',
                  borderColor:
                    proj.id === currentProjectId ? 'primary.main' : 'divider',
                  boxShadow:
                    proj.id === currentProjectId
                      ? (theme) =>
                          `0 0 0 2px ${theme.palette.primary.main}40, 0 4px 12px ${theme.palette.primary.main}20`
                      : '0 2px 8px rgba(0, 0, 0, 0.06)',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    boxShadow:
                      proj.id === currentProjectId
                        ? (theme) =>
                            `0 0 0 2px ${theme.palette.primary.main}60, 0 6px 20px ${theme.palette.primary.main}30`
                        : '0 4px 16px rgba(0, 0, 0, 0.1)',
                    transform: 'translateY(-2px)',
                  },
                  position: 'relative',
                }}
              >
                {/* MoreVert button */}
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMenuOpen(e, proj);
                  }}
                  sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1 }}
                >
                  <MoreVertIcon fontSize="small" />
                </IconButton>

                <CardActionArea
                  disableRipple
                  onClick={() => {
                    navigate(
                      `/admin/environments?orgId=${proj.orgId}&projectId=${proj.id}`
                    );
                  }}
                >
                  <CardContent sx={{ p: 3 }}>
                    {/* Header */}
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 1.5,
                        mb: 2,
                        pr: 4,
                      }}
                    >
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: 2,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          bgcolor: 'info.main',
                          color: 'info.contrastText',
                          flexShrink: 0,
                        }}
                      >
                        <ProjectIcon fontSize="small" />
                      </Box>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography
                          variant="subtitle1"
                          fontWeight={600}
                          noWrap
                          title={proj.displayName || proj.projectName}
                        >
                          {proj.displayName || proj.projectName}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          noWrap
                          sx={{ display: 'block' }}
                          title={proj.projectName}
                        >
                          {proj.projectName}
                        </Typography>
                      </Box>
                    </Box>

                    {/* Chips */}
                    <Box
                      sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}
                    >
                      <Chip
                        label={
                          proj.isActive
                            ? t('common.active')
                            : t('common.inactive')
                        }
                        size="small"
                        color={proj.isActive ? 'success' : 'default'}
                        variant="outlined"
                      />
                      {proj.isDefault && (
                        <Chip
                          label={t('rbac.projects.default')}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                      )}
                    </Box>

                    {/* Description */}
                    {proj.description && (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          mb: 2,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          lineHeight: 1.6,
                        }}
                      >
                        {proj.description}
                      </Typography>
                    )}

                    {/* Footer info */}
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        pt: 2,
                        borderTop: '1px solid',
                        borderColor: 'divider',
                      }}
                    >
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                      >
                        <PeopleIcon
                          sx={{ fontSize: 16, color: 'text.secondary' }}
                        />
                        <Typography variant="caption" color="text.secondary">
                          {proj.memberCount ?? 0}
                        </Typography>
                      </Box>
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                      >
                        <CalendarTodayIcon
                          sx={{ fontSize: 16, color: 'text.secondary' }}
                        />
                        <Tooltip
                          title={formatDateTimeDetailed(proj.createdAt)}
                          arrow
                        >
                          <Typography variant="caption" color="text.secondary">
                            {formatRelativeTime(proj.createdAt)}
                          </Typography>
                        </Tooltip>
                      </Box>
                    </Box>
                  </CardContent>
                </CardActionArea>

                {/* Expandable environment list */}
                <Box
                  sx={{
                    borderTop: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <ListItemButton
                    onClick={(e) => handleToggleProjectExpand(e, proj)}
                    dense
                    sx={{ py: 0.5 }}
                  >
                    <ListItemIcon sx={{ minWidth: 28 }}>
                      {expandedProjects.has(proj.id) ? (
                        <ExpandMoreIcon sx={{ fontSize: 18 }} />
                      ) : (
                        <ChevronRightIcon sx={{ fontSize: 18 }} />
                      )}
                    </ListItemIcon>
                    <ListItemText
                      primary={`${t('common.environment')} (${projectEnvMap[proj.id]?.length ?? '...'})`}
                      primaryTypographyProps={{
                        variant: 'caption',
                        color: 'text.secondary',
                        fontWeight: 500,
                      }}
                    />
                  </ListItemButton>
                  <Collapse in={expandedProjects.has(proj.id)}>
                    {loadingEnvProjects.has(proj.id) ? (
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'center',
                          py: 1,
                        }}
                      >
                        <CircularProgress size={16} />
                      </Box>
                    ) : (
                      <List dense disablePadding>
                        {(projectEnvMap[proj.id] || []).map((env) => (
                          <ListItemButton
                            key={env.environmentId}
                            sx={{ pl: 4, py: 0.25 }}
                            onClick={() => {
                              navigate(
                                `/admin/environments?orgId=${proj.orgId}&projectId=${proj.id}`
                              );
                            }}
                          >
                            {' '}
                            <ListItemIcon sx={{ minWidth: 24 }}>
                              <EnvironmentIcon
                                sx={{ fontSize: 16, opacity: 0.7 }}
                              />
                            </ListItemIcon>
                            <ListItemText
                              primary={env.displayName || env.environmentName}
                              primaryTypographyProps={{
                                variant: 'body2',
                                noWrap: true,
                              }}
                            />
                          </ListItemButton>
                        ))}
                        {(projectEnvMap[proj.id] || []).length === 0 && (
                          <ListItemButton
                            sx={{ pl: 4, py: 0.25 }}
                            onClick={() => {
                              navigate(
                                `/admin/environments?orgId=${proj.orgId}&projectId=${proj.id}`
                              );
                            }}
                          >
                            <ListItemText
                              primary={t('environments.noEnvironments')}
                              primaryTypographyProps={{
                                variant: 'caption',
                                color: 'warning.main',
                                fontStyle: 'italic',
                              }}
                            />
                          </ListItemButton>
                        )}
                      </List>
                    )}
                  </Collapse>
                </Box>
              </Card>
            ))}
          </Box>
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
            if (menuTarget) handleEdit(menuTarget);
            handleMenuClose();
          }}
        >
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('common.edit')}</ListItemText>
        </MenuItem>
        {menuTarget && !menuTarget.isDefault && (
          <MenuItem
            onClick={() => {
              if (menuTarget) {
                setDeleteTarget(menuTarget);
                setDeleteDialogOpen(true);
              }
              handleMenuClose();
            }}
          >
            <ListItemIcon>
              <DeleteIcon fontSize="small" color="error" />
            </ListItemIcon>
            <ListItemText>{t('common.delete')}</ListItemText>
          </MenuItem>
        )}
        <MenuItem
          onClick={() => {
            if (menuTarget) handleOpenMemberDrawer(menuTarget);
            handleMenuClose();
          }}
        >
          <ListItemIcon>
            <PeopleIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('rbac.projects.memberManageTitle')}</ListItemText>
        </MenuItem>
      </Menu>

      {/* Create/Edit Drawer */}
      <ResizableDrawer
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={
          dialogMode === 'create'
            ? t('rbac.projects.createTitle')
            : t('rbac.projects.editTitle')
        }
        storageKey="projectsDrawerWidth"
        defaultWidth={450}
        minWidth={380}
        subtitle={
          dialogMode === 'create'
            ? t('rbac.projects.createDescription')
            : t('rbac.projects.editDescription')
        }
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
            fullWidth
            size="small"
            label={t('rbac.projects.name')}
            value={formData.projectName}
            onChange={(e) =>
              setFormData({ ...formData, projectName: e.target.value })
            }
            disabled={dialogMode === 'edit'}
            autoFocus
            required
            error={
              dialogMode === 'create' &&
              formData.projectName.length > 0 &&
              !isValidResourceName(formData.projectName)
            }
            helperText={t('rbac.projects.nameHelp')}
          />
          <TextField
            fullWidth
            size="small"
            label={t('rbac.projects.displayName')}
            value={formData.displayName}
            onChange={(e) =>
              setFormData({ ...formData, displayName: e.target.value })
            }
            required
            helperText={t('rbac.projects.displayNameHelp')}
          />
          <TextField
            fullWidth
            size="small"
            label={t('rbac.projects.descriptionColumn')}
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            multiline
            rows={3}
            helperText={t('rbac.projects.descriptionHelp')}
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
            disabled={
              saving ||
              (dialogMode === 'create'
                ? !formData.projectName.trim() ||
                  !formData.displayName.trim() ||
                  !isValidResourceName(formData.projectName)
                : !isEditDirty)
            }
          >
            {saving ? (
              <CircularProgress size={20} />
            ) : dialogMode === 'create' ? (
              t('common.add')
            ) : (
              t('common.update')
            )}
          </Button>
        </Box>
      </ResizableDrawer>

      {/* Delete Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>{t('rbac.projects.deleteTitle')}</DialogTitle>
        <DialogContent>
          <Typography>
            {t('rbac.projects.deleteConfirm', {
              name: deleteTarget?.displayName || deleteTarget?.projectName,
            })}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>
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

      {/* Member Management Drawer */}
      <ResizableDrawer
        open={memberDrawerOpen}
        onClose={() => setMemberDrawerOpen(false)}
        title={t('rbac.projects.memberManageTitle')}
        subtitle={t('rbac.projects.memberManageDescription')}
        storageKey="projectMemberDrawerWidth"
        defaultWidth={550}
        minWidth={400}
      >
        <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
          {memberLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : memberProject ? (
            <>
              {/* Add member section */}
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <Autocomplete
                  sx={{ flex: 1 }}
                  size="small"
                  options={userSearchResults}
                  getOptionLabel={(option) =>
                    `${option.name} (${option.email})`
                  }
                  loading={userSearchLoading}
                  onInputChange={(_, value) => setUserSearchInput(value)}
                  onChange={(_, value) => {
                    if (!value) return;
                    // Check if already a member or already pending add
                    const alreadyMember = members.some(
                      (m) => m.userId === value.id
                    );
                    const alreadyPending = pendingChanges.add.some(
                      (m) => m.userId === value.id
                    );
                    if (alreadyMember || alreadyPending) return;
                    setPendingChanges((prev) => ({
                      ...prev,
                      add: [
                        ...prev.add,
                        {
                          userId: value.id,
                          name: value.name,
                          email: value.email,
                          projectRole: 'member',
                        },
                      ],
                      remove: prev.remove.filter((id) => id !== value.id),
                    }));
                  }}
                  renderInput={(params) => (
                    <TextField {...params} placeholder={t('common.search')} />
                  )}
                  value={null}
                  isOptionEqualToValue={(option, value) =>
                    option.id === value.id
                  }
                  filterOptions={(x) => x}
                  noOptionsText={t('common.noResults')}
                />
              </Box>

              {/* Member list */}
              {pendingChanges.add.length > 0 || members.length > 0 ? (
                <Box
                  sx={{
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                  }}
                >
                  {/* Pending additions */}
                  {pendingChanges.add.map((m, index) => (
                    <Box
                      key={`add-${m.userId}`}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        px: 2,
                        py: 1,
                        borderBottom: 1,
                        borderColor: 'divider',
                      }}
                    >
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={500} noWrap>
                          {m.name}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          noWrap
                        >
                          {m.email}
                        </Typography>
                      </Box>
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                      >
                        <IconButton
                          size="small"
                          onClick={() => {
                            setPendingChanges((prev) => ({
                              ...prev,
                              add: prev.add.filter(
                                (a) => a.userId !== m.userId
                              ),
                            }));
                          }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </Box>
                  ))}

                  {/* Existing members */}
                  {members
                    .filter((m) => !pendingChanges.remove.includes(m.userId))
                    .map((m, index, arr) => (
                      <Box
                        key={m.userId}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          px: 2,
                          py: 1,
                          borderBottom:
                            index < arr.length - 1 ||
                            members.some((rm) =>
                              pendingChanges.remove.includes(rm.userId)
                            )
                              ? 1
                              : 0,
                          borderColor: 'divider',
                        }}
                      >
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={500} noWrap>
                            {m.name}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            noWrap
                          >
                            {m.email}
                          </Typography>
                        </Box>
                        <Box
                          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                        >
                          <IconButton
                            size="small"
                            onClick={() => {
                              setPendingChanges((prev) => ({
                                ...prev,
                                remove: [...prev.remove, m.userId],
                                roleChanges: Object.fromEntries(
                                  Object.entries(prev.roleChanges).filter(
                                    ([k]) => k !== m.userId
                                  )
                                ),
                              }));
                            }}
                          >
                            <DeleteIcon fontSize="small" color="error" />
                          </IconButton>
                        </Box>
                      </Box>
                    ))}

                  {/* Pending removals */}
                  {members
                    .filter((m) => pendingChanges.remove.includes(m.userId))
                    .map((m, index, arr) => (
                      <Box
                        key={`rm-${m.userId}`}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          px: 2,
                          py: 1,
                          borderBottom: index < arr.length - 1 ? 1 : 0,
                          borderColor: 'divider',
                          opacity: 0.5,
                        }}
                      >
                        <Box
                          sx={{
                            flex: 1,
                            minWidth: 0,
                            textDecoration: 'line-through',
                          }}
                        >
                          <Typography variant="body2" fontWeight={500} noWrap>
                            {m.name}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            noWrap
                          >
                            {m.email}
                          </Typography>
                        </Box>
                        <Button
                          size="small"
                          onClick={() => {
                            setPendingChanges((prev) => ({
                              ...prev,
                              remove: prev.remove.filter(
                                (id) => id !== m.userId
                              ),
                            }));
                          }}
                        >
                          {t('common.restore')}
                        </Button>
                      </Box>
                    ))}
                </Box>
              ) : (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ textAlign: 'center', py: 4 }}
                >
                  {t('rbac.projects.noMembers')}
                </Typography>
              )}
            </>
          ) : null}
        </Box>
        {/* Apply Button */}
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
          <Button onClick={() => setMemberDrawerOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            onClick={handleApplyMembers}
            disabled={memberApplying || !hasPendingMemberChanges}
          >
            {memberApplying ? (
              <CircularProgress size={20} />
            ) : (
              t('common.apply')
            )}
          </Button>
        </Box>
      </ResizableDrawer>
    </Box>
  );
};

export default ProjectsPage;
