import React, { useState, useEffect, useCallback } from 'react';
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
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
} from '@mui/material';
import {
  Edit as EditIcon,
  Business as OrgIcon,
  People as PeopleIcon,
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
import dayjs from 'dayjs';

const OrganisationsPage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrg, setSelectedOrg] = useState<OrganisationWithMembers | null>(null);

  // Edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editData, setEditData] = useState({ displayName: '', description: '' });
  const [editOrgId, setEditOrgId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Detail drawer
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailTab, setDetailTab] = useState(0);
  const [detailLoading, setDetailLoading] = useState(false);

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

  // Open edit dialog
  const handleEdit = (org: Organisation) => {
    setEditOrgId(org.id);
    setEditData({
      displayName: org.displayName || '',
      description: org.description || '',
    });
    setEditDialogOpen(true);
  };

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

  // View org details
  const handleViewDetails = async (org: Organisation) => {
    try {
      setDetailLoading(true);
      setDetailOpen(true);
      const detail = await orgProjectService.getOrganisation(org.id);
      setSelectedOrg(detail);
    } catch {
      enqueueSnackbar(t('rbac.orgs.loadFailed'), { variant: 'error' });
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <Box>
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
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : organisations.length === 0 ? (
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
                    {dayjs(org.createdAt).format('YYYY-MM-DD HH:mm')}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title={t('common.edit')}>
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleEdit(org); }}>
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

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('rbac.orgs.editTitle')}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            margin="normal"
            label={t('rbac.orgs.displayName')}
            value={editData.displayName}
            onChange={(e) => setEditData({ ...editData, displayName: e.target.value })}
          />
          <TextField
            fullWidth
            margin="normal"
            label={t('rbac.orgs.descriptionColumn')}
            value={editData.description}
            onChange={(e) => setEditData({ ...editData, description: e.target.value })}
            multiline
            rows={3}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? <CircularProgress size={20} /> : t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Detail Dialog with Members */}
      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {selectedOrg?.displayName || selectedOrg?.orgName} — {t('rbac.orgs.detail')}
        </DialogTitle>
        <DialogContent>
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
                  label={`${t('rbac.orgs.members')} (${selectedOrg.members?.length || 0})`}
                />
              </Tabs>
              {detailTab === 0 && (
                <>
                  {!selectedOrg.members || selectedOrg.members.length === 0 ? (
                    <Alert severity="info">{t('rbac.orgs.noMembers')}</Alert>
                  ) : (
                    <List dense>
                      {selectedOrg.members.map((member: OrgMember) => (
                        <ListItem key={member.id} divider>
                          <ListItemText
                            primary={member.name || member.email || member.userId}
                            secondary={`${t('rbac.orgs.orgRole')}: ${member.orgRole}`}
                          />
                          <ListItemSecondaryAction>
                            <Chip
                              label={member.orgRole}
                              size="small"
                              color={member.orgRole === 'admin' ? 'primary' : 'default'}
                            />
                          </ListItemSecondaryAction>
                        </ListItem>
                      ))}
                    </List>
                  )}
                </>
              )}
            </>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailOpen(false)}>{t('common.close')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default OrganisationsPage;
