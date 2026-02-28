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
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Folder as ProjectIcon,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import EmptyPlaceholder from '@/components/common/EmptyPlaceholder';
import { orgProjectService, Project } from '@/services/orgProjectService';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import dayjs from 'dayjs';

const ProjectsPage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { refreshProjects } = useOrgProject();

  const [projects, setProjects] = useState<Project[]>([]);
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
  const [editId, setEditId] = useState<string | null>(null);

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);

  // Load projects
  const loadProjects = useCallback(async () => {
    try {
      setLoading(true);
      const data = await orgProjectService.getProjects();
      setProjects(data);
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
    setFormData({
      projectName: proj.projectName,
      displayName: proj.displayName || '',
      description: proj.description || '',
    });
    setEditId(proj.id);
    setDialogOpen(true);
  };

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
    <Box>
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

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : projects.length === 0 ? (
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
                <TableCell>{t('rbac.projects.descriptionColumn')}</TableCell>
                <TableCell align="center">{t('rbac.projects.default')}</TableCell>
                <TableCell align="center">{t('rbac.orgs.status')}</TableCell>
                <TableCell>{t('common.createdAt')}</TableCell>
                <TableCell align="right">{t('common.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {projects.map((proj) => (
                <TableRow key={proj.id} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <ProjectIcon fontSize="small" sx={{ opacity: 0.6 }} />
                      <Typography variant="body2" fontWeight={600}>
                        {proj.projectName}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>{proj.displayName}</TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ opacity: 0.7, maxWidth: 300 }} noWrap>
                      {proj.description || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    {proj.isDefault ? (
                      <Chip label={t('common.yes')} size="small" color="primary" />
                    ) : (
                      <Chip label={t('common.no')} size="small" variant="outlined" />
                    )}
                  </TableCell>
                  <TableCell align="center">
                    {proj.isActive ? (
                      <Chip label={t('common.active')} size="small" color="success" />
                    ) : (
                      <Chip label={t('common.inactive')} size="small" variant="outlined" />
                    )}
                  </TableCell>
                  <TableCell>
                    {dayjs(proj.createdAt).format('YYYY-MM-DD HH:mm')}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title={t('common.edit')}>
                      <IconButton size="small" onClick={() => handleEdit(proj)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {!proj.isDefault && (
                      <Tooltip title={t('common.delete')}>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => {
                            setDeleteTarget(proj);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {dialogMode === 'create' ? t('rbac.projects.createTitle') : t('rbac.projects.editTitle')}
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            margin="normal"
            label={t('rbac.projects.name')}
            value={formData.projectName}
            onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
            disabled={dialogMode === 'edit'}
          />
          <TextField
            fullWidth
            margin="normal"
            label={t('rbac.projects.displayName')}
            value={formData.displayName}
            onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
          />
          <TextField
            fullWidth
            margin="normal"
            label={t('rbac.projects.descriptionColumn')}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            multiline
            rows={3}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? <CircularProgress size={20} /> : t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>{t('rbac.projects.deleteTitle')}</DialogTitle>
        <DialogContent>
          <Typography>
            {t('rbac.projects.deleteConfirm', { name: deleteTarget?.displayName || deleteTarget?.projectName })}
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
