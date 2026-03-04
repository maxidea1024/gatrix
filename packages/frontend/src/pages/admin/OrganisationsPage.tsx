import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
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
  Alert,
  Tabs,
  Tab,
  Autocomplete,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Edit as EditIcon,
  Add as AddIcon,
  Business as OrgIcon,
  People as PeopleIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import EmptyPlaceholder from '@/components/common/EmptyPlaceholder';
import {
  orgProjectService,
  Organisation,
  OrganisationWithMembers,
  OrgMember,
} from '@/services/orgProjectService';
import { rbacService } from '@/services/rbacService';
import { useDebounce } from '@/hooks/useDebounce';
import { useAuth } from '@/contexts/AuthContext';
import ResizableDrawer from '@/components/common/ResizableDrawer';
import PageContentLoader from '@/components/common/PageContentLoader';
import { formatRelativeTime, formatDateTimeDetailed } from '@/utils/dateFormat';

interface SearchUser {
  id: string;
  name: string;
  email: string;
}

const OrganisationsPage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { user: currentUser } = useAuth();

  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrg, setSelectedOrg] = useState<OrganisationWithMembers | null>(null);

  // Edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editData, setEditData] = useState({ displayName: '', description: '' });
  const [initialEditData, setInitialEditData] = useState({ displayName: '', description: '' });
  const [editOrgId, setEditOrgId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Create dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createData, setCreateData] = useState({ orgName: '', displayName: '', description: '' });

  // Detail drawer
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailTab, setDetailTab] = useState(0);
  const [detailLoading, setDetailLoading] = useState(false);

  // Member add state
  const [memberSearchTerm, setMemberSearchTerm] = useState('');
  const debouncedMemberSearch = useDebounce(memberSearchTerm, 300);
  const [searchedUsers, setSearchedUsers] = useState<SearchUser[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SearchUser | null>(null);

  // Pending member changes (local state for batch apply)
  const [pendingMembers, setPendingMembers] = useState<OrgMember[]>([]);
  const [initialMembers, setInitialMembers] = useState<OrgMember[]>([]);
  const [applyingMembers, setApplyingMembers] = useState(false);

  // Load organisations
  const loadOrganisations = useCallback(async () => {
    try {
      setLoading(true);
      const data = await orgProjectService.getOrganisations();
      setOrganisations(data);
    } catch {
      enqueueSnackbar(t('rbac.orgs.loadFailed'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar, t]);

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

  // Open edit dialog
  const handleEdit = (org: Organisation) => {
    setEditOrgId(org.id);
    const data = {
      displayName: org.displayName || '',
      description: org.description || '',
    };
    setEditData(data);
    setInitialEditData(data);
    setEditDialogOpen(true);
  };

  const isEditDirty = JSON.stringify(editData) !== JSON.stringify(initialEditData);

  // Save edit
  const handleSave = async () => {
    if (!editOrgId) return;
    try {
      setSaving(true);
      await orgProjectService.updateOrganisation(editOrgId, editData);
      enqueueSnackbar(t('rbac.orgs.updateSuccess'), { variant: 'success' });
      setEditDialogOpen(false);
      loadOrganisations();
    } catch (error: any) {
      const message = error?.response?.data?.message || t('rbac.orgs.saveFailed');
      enqueueSnackbar(message, { variant: 'error' });
    } finally {
      setSaving(false);
    }
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
      setCreateDialogOpen(false);
      setCreateData({ orgName: '', displayName: '', description: '' });
      loadOrganisations();
    } catch (error: any) {
      const message = error?.response?.data?.message || t('rbac.orgs.createFailed');
      enqueueSnackbar(message, { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // View org details
  const handleViewDetails = async (org: Organisation) => {
    try {
      setDetailLoading(true);
      setDetailOpen(true);
      setDetailTab(0);
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

  // Check if member list has pending changes
  const isMembersDirty = useMemo(() => {
    if (pendingMembers.length !== initialMembers.length) return true;
    for (const pm of pendingMembers) {
      const im = initialMembers.find((m) => m.userId === pm.userId);
      if (!im) return true;
      if (im.orgRole !== pm.orgRole) return true;
    }
    return false;
  }, [pendingMembers, initialMembers]);

  // Add member (local only)
  const handleAddMember = () => {
    if (!selectedUser) return;
    // Prevent duplicate
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

      // Compute diff: added, removed, role changed
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

      // Execute API calls sequentially
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

      // Refresh from server
      const detail = await orgProjectService.getOrganisation(selectedOrg.id);
      setSelectedOrg(detail);
      const members = detail.members || [];
      setPendingMembers(JSON.parse(JSON.stringify(members)));
      setInitialMembers(JSON.parse(JSON.stringify(members)));
      loadOrganisations();
    } catch (error: any) {
      const msg = error?.response?.data?.message || t('rbac.orgs.memberUpdateFailed');
      enqueueSnackbar(msg, { variant: 'error' });
    } finally {
      setApplyingMembers(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            {t('rbac.orgs.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('rbac.orgs.description')}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            setCreateData({ orgName: '', displayName: '', description: '' });
            setCreateDialogOpen(true);
          }}
        >
          {t('rbac.orgs.create')}
        </Button>
      </Box>

      <PageContentLoader loading={loading}>
        {organisations.length === 0 ? (
          <EmptyPlaceholder
            message={t('rbac.orgs.emptyTitle')}
            description={t('rbac.orgs.emptyDescription')}
          />
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t('rbac.orgs.name')}</TableCell>
                  <TableCell>{t('rbac.orgs.displayName')}</TableCell>
                  <TableCell>{t('rbac.orgs.descriptionColumn')}</TableCell>
                  <TableCell align="center">{t('rbac.orgs.status')}</TableCell>
                  <TableCell>{t('common.createdAt')}</TableCell>
                  <TableCell align="right">{t('common.actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {organisations.map((org) => (
                  <TableRow
                    key={org.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => handleViewDetails(org)}
                  >
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <OrgIcon fontSize="small" sx={{ opacity: 0.6 }} />
                        <Typography variant="body2" fontWeight={600}>
                          {org.orgName}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>{org.displayName}</TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ opacity: 0.7, maxWidth: 300 }} noWrap>
                        {org.description || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      {org.isActive ? (
                        <Chip label={t('common.active')} size="small" color="success" />
                      ) : (
                        <Chip label={t('common.inactive')} size="small" variant="outlined" />
                      )}
                    </TableCell>
                    <TableCell>
                      <Tooltip title={formatDateTimeDetailed(org.createdAt)}>
                        <Typography variant="body2">{formatRelativeTime(org.createdAt)}</Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title={t('common.edit')}>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(org);
                          }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </PageContentLoader>

      {/* Edit Drawer */}
      <ResizableDrawer
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        title={t('rbac.orgs.editTitle')}
        storageKey="orgEditDrawerWidth"
        defaultWidth={450}
        minWidth={380}
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
          <Button onClick={() => setEditDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || !isEditDirty}>
            {saving ? <CircularProgress size={20} /> : t('common.save')}
          </Button>
        </Box>
      </ResizableDrawer>

      {/* Create Organisation Drawer */}
      <ResizableDrawer
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        title={t('rbac.orgs.createTitle')}
        storageKey="orgCreateDrawerWidth"
        defaultWidth={450}
        minWidth={380}
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
          <Button onClick={() => setCreateDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={saving || !createData.orgName.trim() || !createData.displayName.trim()}
          >
            {saving ? <CircularProgress size={20} /> : t('common.create')}
          </Button>
        </Box>
      </ResizableDrawer>

      {/* Detail Drawer with Member Management */}
      <ResizableDrawer
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={`${selectedOrg?.displayName || selectedOrg?.orgName || ''} — ${t('rbac.orgs.detail')}`}
        storageKey="orgDetailDrawerWidth"
        defaultWidth={550}
        minWidth={400}
      >
        <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
          {detailLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : selectedOrg ? (
            <>
              <Tabs value={detailTab} onChange={(_, v) => setDetailTab(v)} sx={{ mb: 2 }}>
                <Tab
                  icon={<PeopleIcon />}
                  iconPosition="start"
                  label={`${t('rbac.orgs.members')} (${pendingMembers.length})`}
                />
              </Tabs>
              {detailTab === 0 && (
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
                            <Select
                              size="small"
                              value={member.orgRole}
                              onChange={(e) =>
                                handleUpdateMemberRole(
                                  member.userId,
                                  e.target.value as 'admin' | 'user'
                                )
                              }
                              sx={{ minWidth: 100 }}
                              disabled={String(member.userId) === String(currentUser?.id)}
                            >
                              <MenuItem value="admin">{t('rbac.orgs.roleAdmin')}</MenuItem>
                              <MenuItem value="user">{t('rbac.orgs.roleUser')}</MenuItem>
                            </Select>
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

export default OrganisationsPage;
