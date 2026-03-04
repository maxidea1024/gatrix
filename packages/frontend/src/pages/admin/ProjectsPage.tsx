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
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Folder as ProjectIcon,
  MoreVert as MoreVertIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import EmptyPlaceholder from '@/components/common/EmptyPlaceholder';
import { orgProjectService, Project, Organisation } from '@/services/orgProjectService';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import { formatRelativeTime, formatDateTimeDetailed } from '@/utils/dateFormat';
import ResizableDrawer from '@/components/common/ResizableDrawer';
import PageContentLoader from '@/components/common/PageContentLoader';
import { copyToClipboardWithNotification } from '@/utils/clipboard';

const ProjectsPage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { refreshProjects } = useOrgProject();

  const [projects, setProjects] = useState<Project[]>([]);
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, proj: Project) => {
    setMenuAnchorEl(event.currentTarget);
    setMenuTarget(proj);
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

  // Load projects
  const loadProjects = useCallback(async () => {
    try {
      setLoading(true);
      const [projectData, orgData] = await Promise.all([
        orgProjectService.getProjects(),
        orgProjectService.getOrganisations(),
      ]);
      setProjects(projectData);
      setOrganisations(orgData);
    } catch {
      enqueueSnackbar(t('rbac.projects.loadFailed'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar, t]);

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
    dialogMode === 'create' || JSON.stringify(formData) !== JSON.stringify(initialFormData);

  // Save
  const handleSave = async () => {
    if (!formData.projectName.trim()) {
      enqueueSnackbar(t('rbac.projects.nameRequired'), { variant: 'warning' });
      return;
    }

    try {
      setSaving(true);
      if (dialogMode === 'create') {
        await orgProjectService.createProject(formData);
        enqueueSnackbar(t('rbac.projects.createSuccess'), { variant: 'success' });
      } else if (editId) {
        await orgProjectService.updateProject(editId, {
          displayName: formData.displayName,
          description: formData.description,
        });
        enqueueSnackbar(t('rbac.projects.updateSuccess'), { variant: 'success' });
      }
      setDialogOpen(false);
      loadProjects();
      refreshProjects();
    } catch (error: any) {
      const message = error?.response?.data?.message || t('rbac.projects.saveFailed');
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
      loadProjects();
      refreshProjects();
    } catch (error: any) {
      const message = error?.response?.data?.message || t('rbac.projects.deleteFailed');
      enqueueSnackbar(message, { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            {t('rbac.projects.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('rbac.projects.description')}
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate}>
          {t('rbac.projects.create')}
        </Button>
      </Box>

      <PageContentLoader loading={loading}>
        {projects.length === 0 ? (
          <EmptyPlaceholder
            message={t('rbac.projects.emptyTitle')}
            description={t('rbac.projects.emptyDescription')}
          />
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t('rbac.projects.name')}</TableCell>
                  <TableCell>{t('rbac.projects.displayName')}</TableCell>
                  <TableCell>{t('common.organisation')}</TableCell>
                  <TableCell>{t('rbac.projects.descriptionColumn')}</TableCell>
                  <TableCell align="center">{t('rbac.projects.default')}</TableCell>
                  <TableCell align="center">{t('rbac.orgs.status')}</TableCell>
                  <TableCell>{t('common.createdAt')}</TableCell>
                  <TableCell align="center">{t('common.actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {projects.map((proj) => (
                  <TableRow key={proj.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <ProjectIcon fontSize="small" sx={{ opacity: 0.6 }} />
                        <Typography variant="body2" fontWeight={600}>
                          {proj.projectName}
                        </Typography>
                        <Tooltip title={t('common.copy')}>
                          <IconButton
                            size="small"
                            onClick={() => handleCopyText(proj.projectName)}
                            sx={{ opacity: 0.4, '&:hover': { opacity: 1 } }}
                          >
                            <CopyIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography variant="body2">
                          {proj.displayName || '—'}
                        </Typography>
                        {proj.displayName && (
                          <Tooltip title={t('common.copy')}>
                            <IconButton
                              size="small"
                              onClick={() => handleCopyText(proj.displayName)}
                              sx={{ opacity: 0.4, '&:hover': { opacity: 1 } }}
                            >
                              <CopyIcon sx={{ fontSize: 14 }} />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {organisations.find((o) => o.id === proj.orgId)?.displayName || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ opacity: 0.7, maxWidth: 300 }} noWrap>
                        {proj.description || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      {proj.isDefault ? (
                        <Chip label={t('common.yes')} size="small" color="primary" sx={{ borderRadius: '8px' }} />
                      ) : (
                        <Chip label={t('common.no')} size="small" variant="outlined" sx={{ borderRadius: '8px' }} />
                      )}
                    </TableCell>
                    <TableCell align="center">
                      {proj.isActive ? (
                        <Chip label={t('common.active')} size="small" color="success" sx={{ borderRadius: '8px' }} />
                      ) : (
                        <Chip label={t('common.inactive')} size="small" variant="outlined" sx={{ borderRadius: '8px' }} />
                      )}
                    </TableCell>
                    <TableCell>
                      <Tooltip title={formatDateTimeDetailed(proj.createdAt)}>
                        <Typography variant="body2">
                          {formatRelativeTime(proj.createdAt)}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell align="center">
                      <IconButton size="small" onClick={(e) => handleMenuOpen(e, proj)}>
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
      </Menu>

      {/* Create/Edit Drawer */}
      <ResizableDrawer
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={
          dialogMode === 'create' ? t('rbac.projects.createTitle') : t('rbac.projects.editTitle')
        }
        storageKey="projectsDrawerWidth"
        defaultWidth={450}
        minWidth={380}
      >
        <Box
          sx={{ flex: 1, p: 3, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}
        >
          <TextField
            fullWidth
            size="small"
            label={t('rbac.projects.name')}
            value={formData.projectName}
            onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
            disabled={dialogMode === 'edit'}
            autoFocus
          />
          <TextField
            fullWidth
            size="small"
            label={t('rbac.projects.displayName')}
            value={formData.displayName}
            onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
          />
          <TextField
            fullWidth
            size="small"
            label={t('rbac.projects.descriptionColumn')}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            multiline
            rows={3}
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
          <Button variant="contained" onClick={handleSave} disabled={saving || !isEditDirty}>
            {saving ? <CircularProgress size={20} /> : t('common.save')}
          </Button>
        </Box>
      </ResizableDrawer>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>{t('rbac.projects.deleteTitle')}</DialogTitle>
        <DialogContent>
          <Typography>
            {t('rbac.projects.deleteConfirm', {
              name: deleteTarget?.displayName || deleteTarget?.projectName,
            })}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" color="error" onClick={handleDelete} disabled={saving}>
            {saving ? <CircularProgress size={20} /> : t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProjectsPage;
