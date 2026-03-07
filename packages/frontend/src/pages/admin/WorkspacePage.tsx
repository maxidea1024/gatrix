import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Alert,
  Tooltip,
  Collapse,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Button,
  TextField,
  CircularProgress,
  Autocomplete,
  Select,
  MenuItem,
  Menu,

} from '@mui/material';
import {
  Business as BusinessIcon,
  People as PeopleIcon,
  CalendarToday as CalendarTodayIcon,
  Folder as ProjectIcon,
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
  PersonAdd as PersonAddIcon,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import {
  orgProjectService,
  Organisation,
  OrganisationWithMembers,
  OrgMember,
  Project,
  AccessTree,
} from '@/services/orgProjectService';
import { rbacService } from '@/services/rbacService';
import { useDebounce } from '@/hooks/useDebounce';
import { useAuth } from '@/contexts/AuthContext';
import { P } from '@/types/permissions';
import { formatRelativeTime, formatDateTimeDetailed } from '@/utils/dateFormat';
import PageContentLoader from '@/components/common/PageContentLoader';
import ResizableDrawer from '@/components/common/ResizableDrawer';
import { useNavigate } from 'react-router-dom';
import { useOrgProject } from '@/contexts/OrgProjectContext';

interface OrgWithMemberCount extends Organisation {
  memberCount: number;
}

interface SearchUser {
  id: string;
  name: string;
  email: string;
}

const WorkspacePage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { user: currentUser, hasPermission } = useAuth();
  const navigate = useNavigate();
  const { currentOrgId, refreshOrgs } = useOrgProject();
  const canManageOrgs = hasPermission([P.ALL]);
  const canInvite = hasPermission([P.INVITATIONS_CREATE]);
  const [organisations, setOrganisations] = useState<OrgWithMemberCount[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accessTree, setAccessTree] = useState<AccessTree>({});
  const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(new Set());

  // Create drawer
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [createData, setCreateData] = useState({ orgName: '', displayName: '', description: '' });
  const [saving, setSaving] = useState(false);

  // Edit drawer
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [editData, setEditData] = useState({ displayName: '', description: '' });
  const [initialEditData, setInitialEditData] = useState({ displayName: '', description: '' });
  const [editOrgId, setEditOrgId] = useState<string | null>(null);

  // Member management drawer
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<OrganisationWithMembers | null>(null);

  // Member management
  const [memberSearchTerm, setMemberSearchTerm] = useState('');
  const debouncedMemberSearch = useDebounce(memberSearchTerm, 300);
  const [searchedUsers, setSearchedUsers] = useState<SearchUser[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SearchUser | null>(null);
  const [pendingMembers, setPendingMembers] = useState<OrgMember[]>([]);
  const [initialMembers, setInitialMembers] = useState<OrgMember[]>([]);
  const [applyingMembers, setApplyingMembers] = useState(false);

  // Context menu
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [menuTarget, setMenuTarget] = useState<OrgWithMemberCount | null>(null);

  const isEditDirty = JSON.stringify(editData) !== JSON.stringify(initialEditData);

  const isMembersDirty = useMemo(() => {
    if (pendingMembers.length !== initialMembers.length) return true;
    for (const pm of pendingMembers) {
      const im = initialMembers.find((m) => m.userId === pm.userId);
      if (!im) return true;
      if (im.orgRole !== pm.orgRole) return true;
    }
    return false;
  }, [pendingMembers, initialMembers]);

  const loadOrganisations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const orgs = await orgProjectService.getOrganisations();

      // Load member counts for each org
      const orgsWithCounts = await Promise.all(
        orgs.map(async (org) => {
          try {
            const members = await rbacService.getOrgMembers(org.id);
            return { ...org, memberCount: members.length };
          } catch {
            return { ...org, memberCount: 0 };
          }
        })
      );

      setOrganisations(orgsWithCounts);

      // Load projects and access tree
      try {
        const [projectData, access] = await Promise.all([
          orgProjectService.getProjects(),
          orgProjectService.getMyAccess(),
        ]);
        setAllProjects(projectData);
        setAccessTree(access);
      } catch {
        console.warn('Failed to load projects/access tree');
      }
    } catch (err) {
      setError(t('workspace.loadFailed'));
      console.error('Failed to load organisations:', err);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadOrganisations();
  }, [loadOrganisations]);

  // Search users for member add
  useEffect(() => {
    if (!debouncedMemberSearch || debouncedMemberSearch.length < 2) {
      setSearchedUsers([]);
      return;
    }
    const search = async () => {
      setSearchingUsers(true);
      try {
        const res = await rbacService.searchUsers(debouncedMemberSearch);
        setSearchedUsers(res);
      } catch {
        setSearchedUsers([]);
      } finally {
        setSearchingUsers(false);
      }
    };
    search();
  }, [debouncedMemberSearch]);

  const handleToggleExpand = (e: React.MouseEvent, orgId: string) => {
    e.stopPropagation();
    setExpandedOrgs((prev) => {
      const next = new Set(prev);
      if (next.has(orgId)) {
        next.delete(orgId);
      } else {
        next.add(orgId);
      }
      return next;
    });
  };

  // Get accessible projects for an org
  const getAccessibleProjects = (orgId: string): Project[] => {
    const orgAccess = accessTree[orgId];
    if (!orgAccess) return [];
    return allProjects.filter((p) => orgAccess.projectIds.includes(p.id));
  };

  // Context menu handlers
  const handleMenuOpen = (e: React.MouseEvent<HTMLElement>, org: OrgWithMemberCount) => {
    e.stopPropagation();
    e.preventDefault();
    setMenuAnchorEl(e.currentTarget);
    setMenuTarget(org);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setMenuTarget(null);
  };

  // Create organisation
  const handleCreate = async () => {
    if (!createData.orgName.trim() || !createData.displayName.trim()) return;
    try {
      setSaving(true);
      await orgProjectService.createOrganisation({
        orgName: createData.orgName.trim(),
        displayName: createData.displayName.trim(),
        description: createData.description.trim() || undefined,
      });
      enqueueSnackbar(t('rbac.orgs.createSuccess'), { variant: 'success' });
      setCreateDrawerOpen(false);
      setCreateData({ orgName: '', displayName: '', description: '' });
      loadOrganisations();
      refreshOrgs();
    } catch (error: any) {
      const message = error?.response?.data?.message || t('rbac.orgs.createFailed');
      enqueueSnackbar(message, { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // Edit organisation
  const handleEdit = (org: Organisation) => {
    setEditOrgId(org.id);
    const data = {
      displayName: org.displayName || '',
      description: org.description || '',
    };
    setEditData(data);
    setInitialEditData(data);
    setEditDrawerOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editOrgId) return;
    try {
      setSaving(true);
      await orgProjectService.updateOrganisation(editOrgId, editData);
      enqueueSnackbar(t('rbac.orgs.updateSuccess'), { variant: 'success' });
      setEditDrawerOpen(false);
      // Update local state for immediate UI feedback
      setOrganisations((prev) =>
        prev.map((o) =>
          o.id === editOrgId ? { ...o, displayName: editData.displayName, description: editData.description } : o
        )
      );
      // Also refresh org context so environment selector shows updated name
      refreshOrgs();
    } catch (error: any) {
      const message = error?.response?.data?.message || t('rbac.orgs.saveFailed');
      enqueueSnackbar(message, { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // View org details (member management)
  const handleViewDetails = async (org: Organisation) => {
    try {
      setDetailLoading(true);
      setDetailOpen(true);
      setSelectedUser(null);
      setMemberSearchTerm('');
      const detail = await orgProjectService.getOrganisation(org.id);
      setSelectedOrg(detail);
      const members = detail.members || [];
      setPendingMembers(JSON.parse(JSON.stringify(members)));
      setInitialMembers(JSON.parse(JSON.stringify(members)));
    } catch {
      enqueueSnackbar(t('rbac.orgs.loadFailed'), { variant: 'error' });
    } finally {
      setDetailLoading(false);
    }
  };

  // Add member (local only)
  const handleAddMember = () => {
    if (!selectedUser) return;
    if (pendingMembers.some((m) => m.userId === selectedUser.id)) return;
    setPendingMembers((prev) => [
      ...prev,
      {
        id: `pending-${selectedUser.id}`,
        userId: selectedUser.id,
        orgRole: 'user',
        name: selectedUser.name,
        email: selectedUser.email,
      } as OrgMember,
    ]);
    setSelectedUser(null);
    setMemberSearchTerm('');
  };

  // Remove member (local only)
  const handleRemoveMember = (userId: string) => {
    setPendingMembers((prev) => prev.filter((m) => m.userId !== userId));
  };

  // Update member role (local only)
  const handleUpdateMemberRole = (userId: string, orgRole: 'admin' | 'user') => {
    setPendingMembers((prev) => prev.map((m) => (m.userId === userId ? { ...m, orgRole } : m)));
  };

  // Apply all pending member changes
  const handleApplyMembers = async () => {
    if (!selectedOrg) return;
    try {
      setApplyingMembers(true);

      const addedMembers = pendingMembers.filter(
        (pm) => !initialMembers.some((im) => im.userId === pm.userId)
      );
      const removedMembers = initialMembers.filter(
        (im) => !pendingMembers.some((pm) => pm.userId === im.userId)
      );
      const roleChangedMembers = pendingMembers.filter((pm) => {
        const im = initialMembers.find((m) => m.userId === pm.userId);
        return im && im.orgRole !== pm.orgRole;
      });

      for (const member of removedMembers) {
        await rbacService.removeOrgMember(selectedOrg.id, member.userId);
      }
      for (const member of addedMembers) {
        await rbacService.addOrgMember(selectedOrg.id, member.userId, member.orgRole);
      }
      for (const member of roleChangedMembers) {
        await rbacService.updateOrgMemberRole(selectedOrg.id, member.userId, member.orgRole);
      }

      enqueueSnackbar(t('rbac.orgs.membersUpdated'), { variant: 'success' });

      // Refresh member data from server
      const detail = await orgProjectService.getOrganisation(selectedOrg.id);
      setSelectedOrg(detail);
      const members = detail.members || [];
      setPendingMembers(JSON.parse(JSON.stringify(members)));
      setInitialMembers(JSON.parse(JSON.stringify(members)));
      // Update member count locally for immediate UI feedback
      setOrganisations((prev) =>
        prev.map((o) =>
          o.id === selectedOrg.id ? { ...o, memberCount: members.length } : o
        )
      );
    } catch (error: any) {
      const msg = error?.response?.data?.message || t('rbac.orgs.memberUpdateFailed');
      enqueueSnackbar(msg, { variant: 'error' });
    } finally {
      setApplyingMembers(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={600} gutterBottom>
            {t('workspace.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('workspace.subtitle')}
          </Typography>
        </Box>
        {canManageOrgs && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setCreateData({ orgName: '', displayName: '', description: '' });
              setCreateDrawerOpen(true);
            }}
          >
            {t('rbac.orgs.create')}
          </Button>
        )}
      </Box>

      <PageContentLoader loading={loading}>
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {organisations.length === 0 ? (
          <Box
            sx={{
              textAlign: 'center',
              py: 8,
              color: 'text.secondary',
            }}
          >
            <BusinessIcon sx={{ fontSize: 64, mb: 2, opacity: 0.3 }} />
            <Typography variant="h6">{t('workspace.noOrganisations')}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {t('workspace.noOrganisationsDesc')}
            </Typography>
          </Box>
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
            {organisations.map((org) => {
              const isExpanded = expandedOrgs.has(org.id);
              const accessibleProjects = getAccessibleProjects(org.id);

              return (
                <Card
                  key={org.id}
                  sx={{
                    borderRadius: 3,
                    border: '1px solid',
                    borderColor: org.id === currentOrgId ? 'primary.main' : 'divider',
                    boxShadow:
                      org.id === currentOrgId
                        ? (theme) =>
                            `0 0 0 2px ${theme.palette.primary.main}40, 0 4px 12px ${theme.palette.primary.main}20`
                        : '0 2px 8px rgba(0, 0, 0, 0.06)',
                    transition: 'all 0.2s ease-in-out',
                    '&:hover': {
                      boxShadow:
                        org.id === currentOrgId
                          ? (theme) =>
                              `0 0 0 2px ${theme.palette.primary.main}60, 0 6px 20px ${theme.palette.primary.main}30`
                          : '0 4px 16px rgba(0, 0, 0, 0.1)',
                      transform: 'translateY(-2px)',
                    },
                  }}
                >
                  <CardContent
                    sx={{ p: 3, cursor: 'pointer' }}
                    onClick={() => navigate(`/admin/projects?orgId=${org.id}`)}
                  >
                      {/* Header */}
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          mb: 2,
                        }}
                      >
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1.5,
                            minWidth: 0,
                            flex: 1,
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
                              bgcolor: 'primary.main',
                              color: 'primary.contrastText',
                              flexShrink: 0,
                            }}
                          >
                            <BusinessIcon fontSize="small" />
                          </Box>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography
                              variant="subtitle1"
                              fontWeight={600}
                              noWrap
                              title={org.displayName}
                            >
                              {org.displayName}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              noWrap
                              sx={{ display: 'block' }}
                              title={org.orgName}
                            >
                              {org.orgName}
                            </Typography>
                          </Box>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0, ml: 1 }}>
                          <Chip
                            label={org.isActive ? t('common.active') : t('common.inactive')}
                            size="small"
                            color={org.isActive ? 'success' : 'default'}
                            variant="outlined"
                          />
                          {(canManageOrgs || canInvite) && (
                            <IconButton
                              size="small"
                              onClick={(e) => handleMenuOpen(e, org)}
                              sx={{ ml: 0.5 }}
                            >
                              <MoreVertIcon fontSize="small" />
                            </IconButton>
                          )}
                        </Box>
                      </Box>

                      {/* Description */}
                      {org.description && (
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
                          {org.description}
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
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <PeopleIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                          <Typography variant="caption" color="text.secondary">
                            {org.memberCount} {t('workspace.members')}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <CalendarTodayIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                          <Tooltip title={formatDateTimeDetailed(org.createdAt)} arrow>
                            <Typography variant="caption" color="text.secondary">
                              {formatRelativeTime(org.createdAt)}
                            </Typography>
                          </Tooltip>
                        </Box>
                      </Box>
                    </CardContent>

                  {/* Expandable project list */}
                  {accessibleProjects.length > 0 && (
                    <Box
                      sx={{
                        borderTop: '1px solid',
                        borderColor: 'divider',
                      }}
                    >
                      <ListItemButton
                        onClick={(e) => handleToggleExpand(e, org.id)}
                        dense
                        sx={{ py: 0.5 }}
                      >
                        <ListItemIcon sx={{ minWidth: 28 }}>
                          {isExpanded ? (
                            <ExpandMoreIcon sx={{ fontSize: 18 }} />
                          ) : (
                            <ChevronRightIcon sx={{ fontSize: 18 }} />
                          )}
                        </ListItemIcon>
                        <ListItemText
                          primary={`${t('common.project')} (${accessibleProjects.length})`}
                          primaryTypographyProps={{
                            variant: 'caption',
                            color: 'text.secondary',
                            fontWeight: 500,
                          }}
                        />
                      </ListItemButton>
                      <Collapse in={isExpanded}>
                        <List dense disablePadding>
                          {accessibleProjects.map((proj) => (
                            <ListItemButton
                              key={proj.id}
                              onClick={() =>
                                navigate(`/admin/environments?orgId=${org.id}&projectId=${proj.id}`)
                              }
                              sx={{ pl: 4, py: 0.25 }}
                            >
                              <ListItemIcon sx={{ minWidth: 24 }}>
                                <ProjectIcon sx={{ fontSize: 16, opacity: 0.7 }} />
                              </ListItemIcon>
                              <ListItemText
                                primary={proj.displayName || proj.projectName}
                                primaryTypographyProps={{
                                  variant: 'body2',
                                  noWrap: true,
                                }}
                              />
                            </ListItemButton>
                          ))}
                        </List>
                      </Collapse>
                    </Box>
                  )}
                </Card>
              );
            })}
          </Box>
        )}
      </PageContentLoader>

      {/* Context Menu */}
      <Menu anchorEl={menuAnchorEl} open={Boolean(menuAnchorEl)} onClose={handleMenuClose}>
        {canManageOrgs && (
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
        )}
        {canManageOrgs && (
          <MenuItem
            onClick={() => {
              if (menuTarget) handleViewDetails(menuTarget);
              handleMenuClose();
            }}
          >
            <ListItemIcon>
              <PeopleIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t('rbac.orgs.memberManageTitle')}</ListItemText>
          </MenuItem>
        )}
        {(canManageOrgs || canInvite) && (
          <MenuItem
            onClick={() => {
              handleMenuClose();
              navigate('/admin/users?openInvite=true');
            }}
          >
            <ListItemIcon>
              <PersonAddIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t('invitations.drawerTitle')}</ListItemText>
          </MenuItem>
        )}
      </Menu>

      {/* Create Organisation Drawer */}
      <ResizableDrawer
        open={createDrawerOpen}
        onClose={() => setCreateDrawerOpen(false)}
        title={t('rbac.orgs.createTitle')}
        storageKey="orgCreateDrawerWidth"
        defaultWidth={450}
        minWidth={380}
        subtitle={t('rbac.orgs.createDescription')}
      >
        <Box
          sx={{ flex: 1, p: 3, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}
        >
          <TextField
            fullWidth
            label={t('rbac.orgs.name')}
            value={createData.orgName}
            onChange={(e) => setCreateData({ ...createData, orgName: e.target.value })}
            required
            autoFocus
            size="small"
            helperText={t('rbac.orgs.orgNameHelp')}
          />
          <TextField
            fullWidth
            label={t('rbac.orgs.displayName')}
            value={createData.displayName}
            onChange={(e) => setCreateData({ ...createData, displayName: e.target.value })}
            required
            size="small"
            helperText={t('rbac.orgs.displayNameHelp')}
          />
          <TextField
            fullWidth
            label={t('rbac.orgs.descriptionColumn')}
            value={createData.description}
            onChange={(e) => setCreateData({ ...createData, description: e.target.value })}
            multiline
            rows={3}
            size="small"
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
          <Button onClick={() => setCreateDrawerOpen(false)}>{t('common.cancel')}</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={saving || !createData.orgName.trim() || !createData.displayName.trim()}
          >
            {saving ? <CircularProgress size={20} /> : t('common.add')}
          </Button>
        </Box>
      </ResizableDrawer>

      {/* Edit Organisation Drawer */}
      <ResizableDrawer
        open={editDrawerOpen}
        onClose={() => setEditDrawerOpen(false)}
        title={t('rbac.orgs.editTitle')}
        storageKey="orgEditDrawerWidth"
        defaultWidth={450}
        minWidth={380}
        subtitle={t('rbac.orgs.editDescription')}
      >
        <Box
          sx={{ flex: 1, p: 3, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}
        >
          <TextField
            fullWidth
            label={t('rbac.orgs.displayName')}
            value={editData.displayName}
            onChange={(e) => setEditData({ ...editData, displayName: e.target.value })}
            size="small"
            required
            helperText={t('rbac.orgs.displayNameHelp')}
          />
          <TextField
            fullWidth
            label={t('rbac.orgs.descriptionColumn')}
            value={editData.description}
            onChange={(e) => setEditData({ ...editData, description: e.target.value })}
            multiline
            rows={3}
            size="small"
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
          <Button onClick={() => setEditDrawerOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={handleSaveEdit} disabled={saving || !isEditDirty}>
            {saving ? <CircularProgress size={20} /> : t('common.save')}
          </Button>
        </Box>
      </ResizableDrawer>

      {/* Member Management Drawer */}
      <ResizableDrawer
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={`${selectedOrg?.displayName || selectedOrg?.orgName || ''} — ${t('rbac.orgs.memberManageTitle')}`}
        storageKey="orgDetailDrawerWidth"
        defaultWidth={550}
        minWidth={400}
        subtitle={t('rbac.orgs.memberManageDescription')}
      >
        <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
          {detailLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : selectedOrg ? (
            <>
              {/* Add member section */}
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                    <Autocomplete
                      size="small"
                      sx={{ flex: 1 }}
                      options={searchedUsers.filter(
                        (u) => !pendingMembers.some((m) => m.userId === u.id)
                      )}
                      getOptionLabel={(opt) => `${opt.name} (${opt.email})`}
                      value={selectedUser}
                      onChange={(_, val) => setSelectedUser(val)}
                      inputValue={memberSearchTerm}
                      onInputChange={(_, val) => setMemberSearchTerm(val)}
                      loading={searchingUsers}
                      noOptionsText={
                        memberSearchTerm.length < 2
                          ? t('rbac.orgs.searchMinChars')
                          : t('common.noResults')
                      }
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          placeholder={t('rbac.orgs.searchMemberPlaceholder')}
                        />
                      )}
                      renderOption={(props, option) => {
                        const { key, ...otherProps } = props;
                        return (
                          <Box component="li" key={key} {...otherProps}>
                            <Box>
                              <Typography variant="body2">{option.name}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {option.email}
                              </Typography>
                            </Box>
                          </Box>
                        );
                      }}
                    />
                    <Button
                      variant="contained"
                      size="small"
                      disabled={!selectedUser}
                      onClick={handleAddMember}
                    >
                      {t('rbac.orgs.addMember')}
                    </Button>
                  </Box>

                  {/* Members list */}
                  {pendingMembers.length === 0 ? (
                    <Alert severity="info">{t('rbac.orgs.noMembers')}</Alert>
                  ) : (
                    <Box
                      sx={{
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 1,
                      }}
                    >
                      {pendingMembers.map((member: OrgMember, index: number) => (
                        <Box
                          key={member.userId}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            px: 2,
                            py: 1,
                            borderBottom: index < pendingMembers.length - 1 ? 1 : 0,
                            borderColor: 'divider',
                          }}
                        >
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="body2" fontWeight={500}>
                              {member.name || member.userId}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {member.email || ''}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Tooltip
                              title={
                                String(member.userId) === String(currentUser?.id)
                                  ? t('rbac.orgs.cannotModifySelf')
                                  : t('rbac.orgs.removeMember')
                              }
                            >
                              <span>
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => handleRemoveMember(member.userId)}
                                  disabled={String(member.userId) === String(currentUser?.id)}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                          </Box>
                        </Box>
                      ))}
                    </Box>
              )}
            </>
          ) : null}
        </Box>
        <Box
          sx={{
            p: 2,
            borderTop: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 1,
          }}
        >
          <Button onClick={() => setDetailOpen(false)}>{t('common.close')}</Button>
          <Button
            variant="contained"
            onClick={handleApplyMembers}
            disabled={!isMembersDirty || applyingMembers}
          >
            {applyingMembers ? <CircularProgress size={20} /> : t('common.apply')}
          </Button>
        </Box>
      </ResizableDrawer>
    </Box>
  );
};

export default WorkspacePage;
