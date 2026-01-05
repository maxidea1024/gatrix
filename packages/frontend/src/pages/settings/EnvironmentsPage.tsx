import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { PERMISSIONS } from '../../types/permissions';
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  FormControlLabel,
  Checkbox,
  Switch,
} from '@mui/material';
import {
  ContentCopy as CopyIcon,
  Refresh as RefreshIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Warning as WarningIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { environmentService, Environment, CreateEnvironmentData, UpdateEnvironmentData, EnvironmentRelatedData } from '../../services/environmentService';
import EnvironmentCopyDialog from '../../components/EnvironmentCopyDialog';
import { useEnvironment } from '../../contexts/EnvironmentContext';
import { copyToClipboardWithNotification } from '../../utils/clipboard';

const EnvironmentsPage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { refresh: refreshEnvironments } = useEnvironment();
  const { hasPermission } = useAuth();
  const canManage = hasPermission([PERMISSIONS.ENVIRONMENTS_MANAGE]);

  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [newEnv, setNewEnv] = useState<CreateEnvironmentData>({
    environment: '',
    displayName: '',
    description: '',
    environmentType: 'development',
    color: '#2e7d32',
  });
  const [baseEnvironment, setBaseEnvironment] = useState<string>('');
  const [selectedEnvForDelete, setSelectedEnvForDelete] = useState<Environment | null>(null);
  const [relatedData, setRelatedData] = useState<EnvironmentRelatedData | null>(null);
  const [loadingRelatedData, setLoadingRelatedData] = useState(false);
  const [forceDelete, setForceDelete] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedEnvForEdit, setSelectedEnvForEdit] = useState<Environment | null>(null);
  const [editEnv, setEditEnv] = useState<UpdateEnvironmentData>({});
  const [updating, setUpdating] = useState(false);

  // Refs for focus management
  const addNameFieldRef = useRef<HTMLInputElement>(null);
  const editDisplayNameFieldRef = useRef<HTMLInputElement>(null);

  const loadEnvironments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Include hidden environments in management page so they can be unhidden
      const data = await environmentService.getEnvironments(true);
      setEnvironments(data);
    } catch (err) {
      setError(t('common.loadError'));
      console.error('Failed to load environments:', err);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadEnvironments();
  }, [loadEnvironments]);

  const getEnvironmentTypeColor = (type: string): 'error' | 'warning' | 'success' | 'default' => {
    switch (type) {
      case 'production':
        return 'error';
      case 'staging':
        return 'warning';
      case 'development':
        return 'success';
      default:
        return 'default';
    }
  };

  const handleOpenAddDialog = () => {
    setNewEnv({
      environment: '',
      displayName: '',
      description: '',
      environmentType: 'development',
      color: '#2e7d32',
    });
    setBaseEnvironment('');
    setAddDialogOpen(true);
  };

  const handleCloseAddDialog = () => {
    if (!creating) {
      setAddDialogOpen(false);
    }
  };

  const handleCreateEnvironment = async () => {
    if (!newEnv.environment || !newEnv.displayName) return;

    setCreating(true);
    try {
      // Create the environment with optional base environment for data copy
      await environmentService.createEnvironment({
        ...newEnv,
        baseEnvironment: baseEnvironment || undefined,
      });

      enqueueSnackbar(t('environments.createSuccess'), { variant: 'success' });
      setAddDialogOpen(false);
      loadEnvironments();
      refreshEnvironments(); // Refresh the global environment context
    } catch (err: any) {
      const message = err?.response?.data?.message || t('environments.createFailed');
      enqueueSnackbar(message, { variant: 'error' });
    } finally {
      setCreating(false);
    }
  };

  const getColorByType = (type: string) => {
    switch (type) {
      case 'production': return '#d32f2f';
      case 'staging': return '#ed6c02';
      case 'development': return '#2e7d32';
      default: return '#757575';
    }
  };

  const handleOpenDeleteDialog = async (env: Environment) => {
    setSelectedEnvForDelete(env);
    setForceDelete(false);
    setRelatedData(null);
    setDeleteDialogOpen(true);
    setLoadingRelatedData(true);

    try {
      const data = await environmentService.getRelatedData(env.environment);
      setRelatedData(data);
    } catch (err) {
      console.error('Failed to load related data:', err);
      enqueueSnackbar(t('common.loadError'), { variant: 'error' });
    } finally {
      setLoadingRelatedData(false);
    }
  };

  const handleCloseDeleteDialog = () => {
    if (!deleting) {
      setDeleteDialogOpen(false);
      setSelectedEnvForDelete(null);
      setRelatedData(null);
      setForceDelete(false);
    }
  };

  const handleDeleteEnvironment = async () => {
    if (!selectedEnvForDelete) return;

    setDeleting(true);
    try {
      await environmentService.deleteEnvironment(selectedEnvForDelete.environment, forceDelete);
      enqueueSnackbar(t('environments.deleteSuccess'), { variant: 'success' });
      setDeleteDialogOpen(false);
      setSelectedEnvForDelete(null);
      loadEnvironments();
      refreshEnvironments();
    } catch (err: any) {
      const code = err?.response?.data?.code;
      let message = t('environments.deleteFailed');

      if (code === 'CANNOT_DELETE_SYSTEM_ENVIRONMENT') {
        message = t('environments.cannotDeleteSystem');
      } else if (code === 'CANNOT_DELETE_DEFAULT_ENVIRONMENT') {
        message = t('environments.cannotDeleteDefault');
      } else if (code === 'ENVIRONMENT_HAS_RELATED_DATA') {
        message = t('environments.hasRelatedData');
      }

      enqueueSnackbar(message, { variant: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const getRelatedDataItems = () => {
    if (!relatedData) return [];

    const items: Array<{
      key: string;
      label: string;
      count: number;
      items: Array<{ id: string; displayName: string }>;
    }> = [];
    const { relatedData: rd } = relatedData;

    // Helper to format item display name based on type
    const formatItems = (
      category: typeof rd.templates,
      displayKey: 'name' | 'title' | 'varKey' | 'jobName' | 'worldId' | 'version'
    ) => {
      return category.items.map((item) => {
        let displayName = '';
        if (displayKey === 'worldId' && 'worldId' in item) {
          displayName = `${item.worldId}${item.name ? ` (${item.name})` : ''}`;
        } else if (displayKey === 'version' && 'version' in item) {
          displayName = `${item.version} (${item.platform || 'unknown'})`;
        } else {
          displayName = (item as any)[displayKey] || item.id;
        }
        return { id: item.id, displayName };
      });
    };

    if (rd.templates.count > 0) items.push({ key: 'templates', label: t('environments.relatedData.templates'), count: rd.templates.count, items: formatItems(rd.templates, 'name') });
    if (rd.gameWorlds.count > 0) items.push({ key: 'gameWorlds', label: t('environments.relatedData.gameWorlds'), count: rd.gameWorlds.count, items: formatItems(rd.gameWorlds, 'worldId') });
    if (rd.segments.count > 0) items.push({ key: 'segments', label: t('environments.relatedData.segments'), count: rd.segments.count, items: formatItems(rd.segments, 'name') });
    if (rd.tags.count > 0) items.push({ key: 'tags', label: t('environments.relatedData.tags'), count: rd.tags.count, items: formatItems(rd.tags, 'name') });
    if (rd.vars.count > 0) items.push({ key: 'vars', label: t('environments.relatedData.vars'), count: rd.vars.count, items: formatItems(rd.vars, 'varKey') });
    if (rd.messageTemplates.count > 0) items.push({ key: 'messageTemplates', label: t('environments.relatedData.messageTemplates'), count: rd.messageTemplates.count, items: formatItems(rd.messageTemplates, 'name') });
    if (rd.serviceNotices.count > 0) items.push({ key: 'serviceNotices', label: t('environments.relatedData.serviceNotices'), count: rd.serviceNotices.count, items: formatItems(rd.serviceNotices, 'title') });
    if (rd.ingamePopups.count > 0) items.push({ key: 'ingamePopups', label: t('environments.relatedData.ingamePopups'), count: rd.ingamePopups.count, items: formatItems(rd.ingamePopups, 'title') });
    if (rd.surveys.count > 0) items.push({ key: 'surveys', label: t('environments.relatedData.surveys'), count: rd.surveys.count, items: formatItems(rd.surveys, 'name') });
    if (rd.coupons.count > 0) items.push({ key: 'coupons', label: t('environments.relatedData.coupons'), count: rd.coupons.count, items: formatItems(rd.coupons, 'name') });
    if (rd.banners.count > 0) items.push({ key: 'banners', label: t('environments.relatedData.banners'), count: rd.banners.count, items: formatItems(rd.banners, 'name') });
    if (rd.jobs.count > 0) items.push({ key: 'jobs', label: t('environments.relatedData.jobs'), count: rd.jobs.count, items: formatItems(rd.jobs, 'jobName') });
    if (rd.clientVersions.count > 0) items.push({ key: 'clientVersions', label: t('environments.relatedData.clientVersions'), count: rd.clientVersions.count, items: formatItems(rd.clientVersions, 'version') });
    if (rd.apiTokens.count > 0) items.push({ key: 'apiTokens', label: t('environments.relatedData.apiTokens'), count: rd.apiTokens.count, items: formatItems(rd.apiTokens, 'name') });

    return items;
  };

  const handleOpenEditDialog = (env: Environment) => {
    setSelectedEnvForEdit(env);
    setEditEnv({
      displayName: env.displayName,
      description: env.description || '',
      environmentType: env.environmentType,
      color: env.color || '#2e7d32',
      displayOrder: env.displayOrder,
      requiresApproval: env.requiresApproval || false,
      requiredApprovers: env.requiredApprovers || 1,
    });
    setEditDialogOpen(true);
  };

  const handleCloseEditDialog = () => {
    if (!updating) {
      setEditDialogOpen(false);
      setSelectedEnvForEdit(null);
      setEditEnv({});
    }
  };

  const handleUpdateEnvironment = async () => {
    if (!selectedEnvForEdit) return;

    setUpdating(true);
    try {
      await environmentService.updateEnvironment(selectedEnvForEdit.environment, editEnv);
      enqueueSnackbar(t('environments.updateSuccess'), { variant: 'success' });
      setEditDialogOpen(false);
      setSelectedEnvForEdit(null);
      loadEnvironments();
      refreshEnvironments();
    } catch (err) {
      console.error('Failed to update environment:', err);
      enqueueSnackbar(t('environments.updateFailed'), { variant: 'error' });
    } finally {
      setUpdating(false);
    }
  };

  // Handle toggle visibility
  const handleToggleVisibility = async (env: Environment) => {
    try {
      await environmentService.updateEnvironment(env.environment, { isHidden: !env.isHidden });
      enqueueSnackbar(
        env.isHidden ? t('environments.showSuccess') : t('environments.hideSuccess'),
        { variant: 'success' }
      );
      loadEnvironments();
      refreshEnvironments();
    } catch (err) {
      console.error('Failed to toggle environment visibility:', err);
      enqueueSnackbar(t('environments.toggleVisibilityFailed'), { variant: 'error' });
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            {t('environments.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('environments.subtitle')}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title={t('common.refresh')}>
            <span>
              <IconButton onClick={loadEnvironments} disabled={loading}>
                <RefreshIcon />
              </IconButton>
            </span>
          </Tooltip>
          {canManage && (
            <>
              <Button
                variant="outlined"
                startIcon={<CopyIcon />}
                onClick={() => setCopyDialogOpen(true)}
                disabled={environments.length < 2}
              >
                {t('environments.copyEnvironment')}
              </Button>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleOpenAddDialog}
              >
                {t('environments.add')}
              </Button>
            </>
          )}
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('environments.name')}</TableCell>
                <TableCell>{t('environments.displayName')}</TableCell>
                <TableCell>{t('environments.type')}</TableCell>
                <TableCell>{t('environments.description')}</TableCell>
                <TableCell align="center">{t('environments.isDefault')}</TableCell>
                <TableCell align="center">{t('environments.isSystemDefined')}</TableCell>
                <TableCell align="center">{t('environments.requiresApproval')}</TableCell>
                {canManage && <TableCell align="center">{t('common.visible')}</TableCell>}
                {canManage && <TableCell align="center">{t('common.actions')}</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {environments
                .filter((env) => env.environmentName !== 'gatrix-env')
                .map((env) => (
                  <TableRow key={env.environment}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                          {env.environmentName}
                        </Typography>
                        <Tooltip title={t('common.copy')}>
                          <IconButton
                            size="small"
                            onClick={() => {
                              copyToClipboardWithNotification(
                                env.environmentName,
                                () => enqueueSnackbar(t('common.copiedToClipboard'), { variant: 'success' }),
                                () => enqueueSnackbar(t('common.copyFailed'), { variant: 'error' })
                              );
                            }}
                            sx={{ opacity: 0.5, '&:hover': { opacity: 1 } }}
                          >
                            <CopyIcon fontSize="small" sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {env.color && (
                          <Box
                            sx={{
                              width: 12,
                              height: 12,
                              borderRadius: '50%',
                              backgroundColor: env.color
                            }}
                          />
                        )}
                        {env.displayName}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={t(`environments.types.${env.environmentType}`)}
                        color={getEnvironmentTypeColor(env.environmentType)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{env.description || '-'}</TableCell>
                    <TableCell align="center">
                      {(env as any).isDefault ? <Chip label="✓" color="primary" size="small" /> : '-'}
                    </TableCell>
                    <TableCell align="center">
                      {env.isSystemDefined ? <Chip label="✓" color="default" size="small" /> : '-'}
                    </TableCell>
                    <TableCell align="center">
                      {env.requiresApproval ? (
                        <Chip label={`${env.requiredApprovers || 1}`} color="warning" size="small" />
                      ) : (
                        <Typography variant="body2" color="text.secondary">-</Typography>
                      )}
                    </TableCell>
                    {canManage && (
                      <TableCell align="center">
                        <Tooltip title={env.isHidden ? t('environments.show') : t('environments.hide')}>
                          <IconButton
                            size="small"
                            onClick={() => handleToggleVisibility(env)}
                            sx={{ color: env.isHidden ? 'text.disabled' : 'success.main' }}
                          >
                            {env.isHidden ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    )}
                    {canManage && (
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
                          <Tooltip title={t('common.edit')}>
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => handleOpenEditDialog(env)}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {Boolean(env.isSystemDefined) ? (
                            <Tooltip title={t('environments.cannotDeleteSystem')}>
                              <span>
                                <IconButton size="small" color="error" disabled>
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                          ) : (
                            <Tooltip title={t('common.delete')}>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleOpenDeleteDialog(env)}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <EnvironmentCopyDialog
        open={copyDialogOpen}
        onClose={() => setCopyDialogOpen(false)}
        environments={environments}
        onCopyComplete={loadEnvironments}
      />

      {/* Add Environment Dialog */}
      <Dialog
        open={addDialogOpen}
        onClose={handleCloseAddDialog}
        maxWidth="sm"
        fullWidth
        TransitionProps={{
          onEntered: () => {
            setTimeout(() => addNameFieldRef.current?.focus(), 100);
          },
        }}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AddIcon />
            {t('environments.addNew')}
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {t('environments.addDescription')}
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              inputRef={addNameFieldRef}
              label={t('environments.name')}
              value={newEnv.environment}
              onChange={(e) => setNewEnv({ ...newEnv, environment: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') })}
              placeholder={t('environments.namePlaceholder')}
              helperText={t('environments.nameHelperText')}
              fullWidth
              required
              disabled={creating}
            />

            <TextField
              label={t('environments.displayName')}
              value={newEnv.displayName}
              onChange={(e) => setNewEnv({ ...newEnv, displayName: e.target.value })}
              placeholder={t('environments.displayNamePlaceholder')}
              fullWidth
              required
              disabled={creating}
            />

            <FormControl fullWidth>
              <InputLabel>{t('environments.type')}</InputLabel>
              <Select
                value={newEnv.environmentType}
                label={t('environments.type')}
                onChange={(e) => {
                  const type = e.target.value as 'development' | 'staging' | 'production';
                  setNewEnv({ ...newEnv, environmentType: type, color: getColorByType(type) });
                }}
                disabled={creating}
              >
                <MenuItem value="development">{t('environments.types.development')}</MenuItem>
                <MenuItem value="staging">{t('environments.types.staging')}</MenuItem>
                <MenuItem value="production">{t('environments.types.production')}</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label={t('environments.description')}
              value={newEnv.description}
              onChange={(e) => setNewEnv({ ...newEnv, description: e.target.value })}
              multiline
              rows={2}
              fullWidth
              disabled={creating}
            />

            <FormControl fullWidth>
              <InputLabel>{t('environments.baseEnvironment')}</InputLabel>
              <Select
                value={baseEnvironment}
                label={t('environments.baseEnvironment')}
                onChange={(e) => setBaseEnvironment(e.target.value)}
                disabled={creating}
              >
                <MenuItem value="">
                  <em>{t('environments.noBase')}</em>
                </MenuItem>
                {environments.map((env) => (
                  <MenuItem key={env.environment} value={env.environment}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box
                        sx={{
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          backgroundColor: env.color || getColorByType(env.environmentType),
                        }}
                      />
                      {env.displayName || env.environmentName}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>{t('environments.baseEnvironmentDescription')}</FormHelperText>
            </FormControl>
          </Box>

          {creating && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
              <CircularProgress size={20} />
              <Typography variant="body2" color="text.secondary">
                {baseEnvironmentId ? t('environments.creatingWithCopy') : t('common.creating')}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseAddDialog} disabled={creating}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateEnvironment}
            disabled={!newEnv.environment || !newEnv.displayName || creating}
          >
            {t('environments.create')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Environment Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleCloseDeleteDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'error.main' }}>
            <WarningIcon />
            {t('environments.deleteConfirmTitle')}
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {loadingRelatedData ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : relatedData && (
            <>
              <Typography variant="body1" gutterBottom>
                {t('environments.deleteConfirmMessage', { name: selectedEnvForDelete?.displayName })}
              </Typography>

              {!relatedData.canDelete && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {relatedData.environment.isSystemDefined
                    ? t('environments.cannotDeleteSystem')
                    : t('environments.cannotDeleteDefault')}
                </Alert>
              )}

              {relatedData.canDelete && relatedData.hasData && (
                <>
                  <Alert severity="warning" sx={{ mt: 2 }}>
                    {t('environments.hasRelatedDataWarning')}
                  </Alert>

                  <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
                    {t('environments.relatedDataTitle')}:
                  </Typography>

                  <Paper variant="outlined" sx={{ p: 1.5, maxHeight: 300, overflow: 'auto' }}>
                    {getRelatedDataItems().map((category) => (
                      <Box key={category.key} sx={{ mb: 1.5, '&:last-child': { mb: 0 } }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                          {category.label} ({category.count})
                        </Typography>
                        <Box sx={{ pl: 2 }}>
                          {category.items.map((item) => (
                            <Typography
                              key={item.id}
                              variant="body2"
                              color="text.secondary"
                              sx={{ py: 0.25 }}
                            >
                              • {item.displayName}
                            </Typography>
                          ))}
                          {category.count > category.items.length && (
                            <Typography variant="body2" color="text.disabled" sx={{ py: 0.25, fontStyle: 'italic' }}>
                              ... {t('common.andMore', { count: category.count - category.items.length })}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    ))}
                  </Paper>

                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={forceDelete}
                        onChange={(e) => setForceDelete(e.target.checked)}
                        color="error"
                      />
                    }
                    label={t('environments.forceDeleteConfirm')}
                    sx={{ mt: 2 }}
                  />
                </>
              )}

              {relatedData.canDelete && !relatedData.hasData && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  {t('environments.noRelatedData')}
                </Alert>
              )}

              {deleting && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
                  <CircularProgress size={20} />
                  <Typography variant="body2" color="text.secondary">
                    {t('common.deleting')}
                  </Typography>
                </Box>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog} disabled={deleting}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteEnvironment}
            disabled={!relatedData?.canDelete || (relatedData?.hasData && !forceDelete) || deleting}
          >
            {t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Environment Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={handleCloseEditDialog}
        maxWidth="sm"
        fullWidth
        TransitionProps={{
          onEntered: () => {
            setTimeout(() => editDisplayNameFieldRef.current?.focus(), 100);
          },
        }}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <EditIcon />
            {t('environments.editTitle')}
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {t('environments.editDescription')}
          </Typography>

          <TextField
            label={t('environments.name')}
            value={selectedEnvForEdit?.environmentName || ''}
            fullWidth
            margin="normal"
            disabled
            helperText={t('environments.nameHelperText')}
          />

          <TextField
            inputRef={editDisplayNameFieldRef}
            label={t('environments.displayName')}
            value={editEnv.displayName || ''}
            onChange={(e) => setEditEnv({ ...editEnv, displayName: e.target.value })}
            fullWidth
            margin="normal"
            placeholder={t('environments.displayNamePlaceholder')}
          />

          <TextField
            label={t('environments.description')}
            value={editEnv.description || ''}
            onChange={(e) => setEditEnv({ ...editEnv, description: e.target.value })}
            fullWidth
            margin="normal"
            multiline
            rows={2}
          />

          <FormControl fullWidth margin="normal">
            <InputLabel>{t('environments.type')}</InputLabel>
            <Select
              value={editEnv.environmentType || 'development'}
              onChange={(e) => setEditEnv({ ...editEnv, environmentType: e.target.value as any })}
              label={t('environments.type')}
            >
              <MenuItem value="development">{t('environments.types.development')}</MenuItem>
              <MenuItem value="staging">{t('environments.types.staging')}</MenuItem>
              <MenuItem value="production">{t('environments.types.production')}</MenuItem>
            </Select>
          </FormControl>

          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              {t('environments.color')}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <input
                type="color"
                value={editEnv.color || '#2e7d32'}
                onChange={(e) => setEditEnv({ ...editEnv, color: e.target.value })}
                style={{ width: 50, height: 40, cursor: 'pointer' }}
              />
              <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                {editEnv.color || '#2e7d32'}
              </Typography>
            </Box>
          </Box>

          {/* Change Request Settings */}
          <Box sx={{ mt: 3, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
              {t('environments.changeRequestSettings')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t('environments.changeRequestSettingsDescription')}
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={editEnv.requiresApproval || false}
                  onChange={(e) => setEditEnv({ ...editEnv, requiresApproval: e.target.checked })}
                  color="primary"
                />
              }
              label={t('environments.requiresApproval')}
            />
            {editEnv.requiresApproval && (
              <FormControl fullWidth margin="normal" size="small">
                <InputLabel>{t('environments.requiredApprovers')}</InputLabel>
                <Select
                  value={editEnv.requiredApprovers || 1}
                  label={t('environments.requiredApprovers')}
                  onChange={(e) => setEditEnv({ ...editEnv, requiredApprovers: Number(e.target.value) })}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <MenuItem key={n} value={n}>{n}</MenuItem>
                  ))}
                </Select>
                <FormHelperText>{t('environments.requiredApproversHelperText')}</FormHelperText>
              </FormControl>
            )}
          </Box>

          {updating && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
              <CircularProgress size={20} />
              <Typography variant="body2" color="text.secondary">
                {t('common.saving')}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseEditDialog} disabled={updating}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            onClick={handleUpdateEnvironment}
            disabled={!editEnv.displayName || updating}
          >
            {t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default EnvironmentsPage;

