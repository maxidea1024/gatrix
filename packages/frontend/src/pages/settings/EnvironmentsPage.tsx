import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import { isValidResourceName } from '../../utils/validation';
import { useAuth } from '../../hooks/useAuth';
import { P } from '@/types/permissions';
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
  Menu,
  ListItemIcon,
  ListItemText,
  Breadcrumbs,
  Link,
  Divider,
} from '@mui/material';
import {
  ContentCopy as CopyIcon,
  Refresh as RefreshIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Warning as WarningIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  MoreVert as MoreVertIcon,
  NavigateNext as NavigateNextIcon,
  SwapHoriz as SwapHorizIcon,
  Check as CheckIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import {
  environmentService,
  Environment,
  CreateEnvironmentData,
  UpdateEnvironmentData,
  EnvironmentRelatedData,
} from '../../services/environmentService';
import { apiService } from '../../services/api';
import EnvironmentCopyDialog from '../../components/EnvironmentCopyDialog';
import { useEnvironment } from '../../contexts/EnvironmentContext';
import { useOrgProject } from '../../contexts/OrgProjectContext';
import { copyToClipboardWithNotification } from '../../utils/clipboard';
import PageContentLoader from '../../components/common/PageContentLoader';
import EmptyPagePlaceholder from '../../components/common/EmptyPagePlaceholder';
import ResizableDrawer from '../../components/common/ResizableDrawer';

interface EnvironmentsPageProps {
  /** When true, renders without outer padding and breadcrumbs */
  embedded?: boolean;
  /** Callback to navigate back to organisations tab */
  onNavigateToOrgs?: () => void;
  /** Callback to navigate to projects tab */
  onNavigateToProjects?: (orgId: string) => void;
}

const EnvironmentsPage: React.FC<EnvironmentsPageProps> = ({
  embedded = false,
  onNavigateToOrgs,
  onNavigateToProjects,
}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const {
    refresh: refreshEnvironments,
    switchEnvironment,
    currentEnvironmentId,
  } = useEnvironment();
  const {
    getProjectApiPath,
    currentOrg,
    currentProject,
    projects,
    organisations,
  } = useOrgProject();
  const [searchParams] = useSearchParams();
  const { hasPermission } = useAuth();
  const canManage = hasPermission([P.ENVIRONMENTS_UPDATE]);

  // Resolve the effective project from URL param or current context
  const urlProjectId = searchParams.get('projectId');
  const urlOrgId = searchParams.get('orgId');
  const effectiveProject = urlProjectId
    ? projects.find((p) => p.id === urlProjectId) || currentProject
    : currentProject;
  const effectiveOrg = urlOrgId
    ? organisations.find((o) => o.id === urlOrgId) || currentOrg
    : effectiveProject
      ? organisations.find((o) => o.id === effectiveProject.orgId) || currentOrg
      : currentOrg;

  // Build API path: prefer URL params directly if both orgId and projectId are given
  const projectApiPath = (() => {
    if (urlOrgId && urlProjectId) {
      return `/admin/orgs/${urlOrgId}/projects/${urlProjectId}`;
    }
    if (effectiveOrg && effectiveProject) {
      return `/admin/orgs/${effectiveOrg.id}/projects/${effectiveProject.id}`;
    }
    return getProjectApiPath();
  })();

  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [newEnv, setNewEnv] = useState<CreateEnvironmentData>({
    displayName: '',
    description: '',
    environmentType: 'development',
    color: '#2e7d32',
  });
  const [baseEnvironment, setBaseEnvironment] = useState<string>('');
  const [selectedEnvForDelete, setSelectedEnvForDelete] =
    useState<Environment | null>(null);
  const [relatedData, setRelatedData] = useState<EnvironmentRelatedData | null>(
    null
  );
  const [loadingRelatedData, setLoadingRelatedData] = useState(false);
  const [forceDelete, setForceDelete] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedEnvForEdit, setSelectedEnvForEdit] =
    useState<Environment | null>(null);
  const [editEnv, setEditEnv] = useState<UpdateEnvironmentData>({});
  const [updating, setUpdating] = useState(false);

  // Refs for focus management
  const addNameFieldRef = useRef<HTMLInputElement>(null);
  const editDisplayNameFieldRef = useRef<HTMLInputElement>(null);

  // Menu state
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [menuTargetEnv, setMenuTargetEnv] = useState<Environment | null>(null);

  const handleMenuOpen = (
    event: React.MouseEvent<HTMLElement>,
    env: Environment
  ) => {
    setMenuAnchorEl(event.currentTarget);
    setMenuTargetEnv(env);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setMenuTargetEnv(null);
  };

  const loadEnvironments = useCallback(async () => {
    if (!projectApiPath) {
      setEnvironments([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Include hidden environments in management page so they can be unhidden
      const data = await environmentService.getEnvironments(
        projectApiPath,
        true
      );

      // Apply RBAC filtering: only show environments user has access to
      if (canManage) {
        // Managers can see all environments
        setEnvironments(data);
      } else {
        try {
          const accessResponse = await apiService.get<{
            allowAllEnvironments: boolean;
            environments: string[];
          }>('/admin/users/me/environments');
          const userAccess = accessResponse.data;
          if (userAccess.allowAllEnvironments) {
            setEnvironments(data);
          } else {
            const accessList = userAccess.environments || [];
            setEnvironments(
              data.filter((env) => accessList.includes(env.environmentId))
            );
          }
        } catch {
          // If access check fails, show all (fail-open for usability)
          setEnvironments(data);
        }
      }
    } catch (err) {
      setError(t('common.loadError'));
      console.error('Failed to load environments:', err);
    } finally {
      setLoading(false);
    }
  }, [t, projectApiPath, canManage]);

  useEffect(() => {
    loadEnvironments();
  }, [loadEnvironments]);

  const getEnvironmentTypeColor = (
    type: string
  ): 'error' | 'warning' | 'success' | 'default' => {
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
      name: '',
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
    if (!newEnv.displayName) return;

    setCreating(true);
    try {
      // Create the environment with optional base environment for data copy
      await environmentService.createEnvironment(projectApiPath, {
        ...newEnv,
        baseEnvironment: baseEnvironment || undefined,
      });

      enqueueSnackbar(t('environments.createSuccess'), { variant: 'success' });
      setAddDialogOpen(false);
      loadEnvironments();
      refreshEnvironments(); // Refresh the global environmentId context
    } catch (err: any) {
      const message =
        err?.response?.data?.message || t('environments.createFailed');
      enqueueSnackbar(message, { variant: 'error' });
    } finally {
      setCreating(false);
    }
  };

  const getColorByType = (type: string) => {
    switch (type) {
      case 'production':
        return '#d32f2f';
      case 'staging':
        return '#ed6c02';
      case 'development':
        return '#2e7d32';
      default:
        return '#757575';
    }
  };

  const handleOpenDeleteDialog = async (env: Environment) => {
    setSelectedEnvForDelete(env);
    setForceDelete(false);
    setRelatedData(null);
    setDeleteDialogOpen(true);
    setLoadingRelatedData(true);

    try {
      const data = await environmentService.getRelatedData(
        projectApiPath,
        env.environmentId
      );
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
      await environmentService.deleteEnvironment(
        projectApiPath,
        selectedEnvForDelete.environmentId,
        forceDelete
      );
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
      displayKey:
        | 'name'
        | 'title'
        | 'varKey'
        | 'jobName'
        | 'worldId'
        | 'version'
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

    if (rd.templates?.count > 0)
      items.push({
        key: 'templates',
        label: t('environments.relatedData.templates'),
        count: rd.templates.count,
        items: formatItems(rd.templates, 'name'),
      });
    if (rd.gameWorlds?.count > 0)
      items.push({
        key: 'gameWorlds',
        label: t('environments.relatedData.gameWorlds'),
        count: rd.gameWorlds.count,
        items: formatItems(rd.gameWorlds, 'worldId'),
      });
    if (rd.segments?.count > 0)
      items.push({
        key: 'segments',
        label: t('environments.relatedData.segments'),
        count: rd.segments.count,
        items: formatItems(rd.segments, 'name'),
      });
    if (rd.tags?.count > 0)
      items.push({
        key: 'tags',
        label: t('environments.relatedData.tags'),
        count: rd.tags.count,
        items: formatItems(rd.tags, 'name'),
      });
    if (rd.vars?.count > 0)
      items.push({
        key: 'vars',
        label: t('environments.relatedData.vars'),
        count: rd.vars.count,
        items: formatItems(rd.vars, 'varKey'),
      });
    if (rd.messageTemplates?.count > 0)
      items.push({
        key: 'messageTemplates',
        label: t('environments.relatedData.messageTemplates'),
        count: rd.messageTemplates.count,
        items: formatItems(rd.messageTemplates, 'name'),
      });
    if (rd.serviceNotices?.count > 0)
      items.push({
        key: 'serviceNotices',
        label: t('environments.relatedData.serviceNotices'),
        count: rd.serviceNotices.count,
        items: formatItems(rd.serviceNotices, 'title'),
      });
    if (rd.ingamePopups?.count > 0)
      items.push({
        key: 'ingamePopups',
        label: t('environments.relatedData.ingamePopups'),
        count: rd.ingamePopups.count,
        items: formatItems(rd.ingamePopups, 'title'),
      });
    if (rd.surveys?.count > 0)
      items.push({
        key: 'surveys',
        label: t('environments.relatedData.surveys'),
        count: rd.surveys.count,
        items: formatItems(rd.surveys, 'name'),
      });
    if (rd.coupons?.count > 0)
      items.push({
        key: 'coupons',
        label: t('environments.relatedData.coupons'),
        count: rd.coupons.count,
        items: formatItems(rd.coupons, 'name'),
      });
    if (rd.banners?.count > 0)
      items.push({
        key: 'banners',
        label: t('environments.relatedData.banners'),
        count: rd.banners.count,
        items: formatItems(rd.banners, 'name'),
      });
    if (rd.jobs?.count > 0)
      items.push({
        key: 'jobs',
        label: t('environments.relatedData.jobs'),
        count: rd.jobs.count,
        items: formatItems(rd.jobs, 'jobName'),
      });
    if (rd.clientVersions?.count > 0)
      items.push({
        key: 'clientVersions',
        label: t('environments.relatedData.clientVersions'),
        count: rd.clientVersions.count,
        items: formatItems(rd.clientVersions, 'version'),
      });
    if (rd.apiTokens?.count > 0)
      items.push({
        key: 'apiTokens',
        label: t('environments.relatedData.apiTokens'),
        count: rd.apiTokens.count,
        items: formatItems(rd.apiTokens, 'name'),
      });

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
      enableSoftLock: env.enableSoftLock || false,
      enableHardLock: env.enableHardLock || false,
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

  // Check if edit form is dirty
  const isEditDirty = useMemo(() => {
    if (!selectedEnvForEdit) return false;

    return (
      editEnv.displayName !== selectedEnvForEdit.displayName ||
      (editEnv.description || '') !== (selectedEnvForEdit.description || '') ||
      editEnv.environmentType !== selectedEnvForEdit.environmentType ||
      (editEnv.color || '#2e7d32') !==
        (selectedEnvForEdit.color || '#2e7d32') ||
      editEnv.displayOrder !== selectedEnvForEdit.displayOrder ||
      (editEnv.requiresApproval || false) !==
        (selectedEnvForEdit.requiresApproval || false) ||
      (editEnv.requiredApprovers || 1) !==
        (selectedEnvForEdit.requiredApprovers || 1) ||
      (editEnv.enableSoftLock || false) !==
        (selectedEnvForEdit.enableSoftLock || false) ||
      (editEnv.enableHardLock || false) !==
        (selectedEnvForEdit.enableHardLock || false)
    );
  }, [selectedEnvForEdit, editEnv]);

  const handleUpdateEnvironment = async () => {
    if (!selectedEnvForEdit) return;

    setUpdating(true);
    try {
      await environmentService.updateEnvironment(
        projectApiPath,
        selectedEnvForEdit.environmentId,
        editEnv
      );
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
      await environmentService.updateEnvironment(
        projectApiPath,
        env.environmentId,
        {
          isHidden: !env.isHidden,
        }
      );
      enqueueSnackbar(
        env.isHidden
          ? t('environments.showSuccess')
          : t('environments.hideSuccess'),
        { variant: 'success' }
      );
      loadEnvironments();
      refreshEnvironments();
    } catch (err) {
      console.error('Failed to toggle environment visibility:', err);
      enqueueSnackbar(t('environments.toggleVisibilityFailed'), {
        variant: 'error',
      });
    }
  };

  return (
    <Box sx={embedded ? { pt: 2 } : { p: 3 }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
        }}
      >
        <Box>
          {!embedded && (
            <Breadcrumbs
              separator={<NavigateNextIcon fontSize="small" />}
              sx={{ mb: 1 }}
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
              <Link
                component={RouterLink}
                to={`/admin/projects?orgId=${effectiveOrg?.id || ''}`}
                underline="hover"
                color="inherit"
                sx={{ display: 'flex', alignItems: 'center' }}
              >
                {effectiveOrg?.displayName ||
                  effectiveOrg?.orgName ||
                  t('common.organisation')}
              </Link>
              <Typography color="text.primary" fontWeight={500}>
                {effectiveProject?.displayName ||
                  effectiveProject?.projectName ||
                  t('common.project')}
              </Typography>
            </Breadcrumbs>
          )}
          {!embedded && (
            <>
              <Typography variant="h4" gutterBottom sx={{ mt: 1 }}>
                {t('environments.title')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('environments.subtitle')}
              </Typography>
            </>
          )}
          {embedded && effectiveOrg && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  cursor: onNavigateToOrgs ? 'pointer' : 'default',
                  '&:hover': onNavigateToOrgs
                    ? { color: 'primary.main', textDecoration: 'underline' }
                    : {},
                }}
                onClick={onNavigateToOrgs}
              >
                {effectiveOrg.displayName || effectiveOrg.orgName}
              </Typography>
              {effectiveProject && (
                <>
                  <Typography variant="body2" color="text.secondary">
                    /
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      cursor: onNavigateToProjects ? 'pointer' : 'default',
                      '&:hover': onNavigateToProjects
                        ? { color: 'primary.main', textDecoration: 'underline' }
                        : {},
                    }}
                    onClick={() => onNavigateToProjects?.(effectiveOrg.id)}
                  >
                    {effectiveProject.displayName ||
                      effectiveProject.projectName}
                  </Typography>
                </>
              )}
            </Box>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
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
              <Button variant="contained" onClick={handleOpenAddDialog}>
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

      <PageContentLoader loading={loading}>
        {environments.filter((env) => env.environmentName !== 'gatrix-env')
          .length === 0 ? (
          <EmptyPagePlaceholder
            message={t('environments.noEnvironmentsRegistered')}
            onAddClick={canManage ? handleOpenAddDialog : undefined}
            addButtonLabel={t('environments.addEnvironment')}
            subtitle={canManage ? t('common.addFirstItem') : undefined}
          />
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 40, p: 0.5 }} />
                  <TableCell>{t('environments.name')}</TableCell>
                  <TableCell>{t('environments.displayName')}</TableCell>
                  <TableCell>{t('common.project')}</TableCell>
                  <TableCell>{t('common.organisation')}</TableCell>
                  <TableCell>{t('environments.type')}</TableCell>
                  <TableCell>{t('environments.description')}</TableCell>
                  <TableCell align="center">
                    {t('environments.isDefault')}
                  </TableCell>
                  <TableCell align="center">
                    {t('environments.isSystemDefined')}
                  </TableCell>
                  <TableCell align="center">
                    {t('environments.requiresApproval')}
                  </TableCell>
                  {canManage && (
                    <TableCell align="center">{t('common.visible')}</TableCell>
                  )}
                  {canManage && (
                    <TableCell align="center">{t('common.actions')}</TableCell>
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {environments
                  .filter((env) => env.environmentName !== 'gatrix-env')
                  .map((env) => (
                    <TableRow key={env.environmentId} hover>
                      <TableCell
                        sx={{ width: 40, p: 0.5, textAlign: 'center' }}
                      >
                        {env.environmentId === currentEnvironmentId && (
                          <CheckIcon
                            sx={{ fontSize: 18, color: 'primary.main' }}
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                          }}
                        >
                          <Typography
                            variant="body2"
                            sx={{
                              fontFamily: 'monospace',
                              cursor: 'pointer',
                              '&:hover': {
                                color: 'primary.main',
                                textDecoration: 'underline',
                              },
                            }}
                            onClick={() => handleOpenEditDialog(env)}
                          >
                            {env.environmentName}
                          </Typography>
                          <Tooltip title={t('common.copy')}>
                            <IconButton
                              size="small"
                              onClick={() => {
                                copyToClipboardWithNotification(
                                  env.environmentName,
                                  () =>
                                    enqueueSnackbar(
                                      t('common.copiedToClipboard'),
                                      {
                                        variant: 'success',
                                      }
                                    ),
                                  () =>
                                    enqueueSnackbar(t('common.copyFailed'), {
                                      variant: 'error',
                                    })
                                );
                              }}
                              sx={{ opacity: 0.4, '&:hover': { opacity: 1 } }}
                            >
                              <CopyIcon sx={{ fontSize: 14 }} />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box
                          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                        >
                          {env.color && (
                            <Box
                              sx={{
                                width: 12,
                                height: 12,
                                borderRadius: '50%',
                                backgroundColor: env.color,
                                flexShrink: 0,
                              }}
                            />
                          )}
                          <Typography
                            variant="body2"
                            sx={{
                              cursor: 'pointer',
                              '&:hover': {
                                color: 'primary.main',
                                textDecoration: 'underline',
                              },
                            }}
                            onClick={() => handleOpenEditDialog(env)}
                          >
                            {env.displayName}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Link
                          component={RouterLink}
                          to={`/admin/projects?orgId=${effectiveOrg?.id || ''}`}
                          underline="hover"
                          color="inherit"
                        >
                          <Typography variant="body2" color="text.secondary">
                            {effectiveProject?.displayName ||
                              effectiveProject?.projectName ||
                              '-'}
                          </Typography>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link
                          component={RouterLink}
                          to="/admin/workspace"
                          underline="hover"
                          color="inherit"
                        >
                          <Typography variant="body2" color="text.secondary">
                            {effectiveOrg?.displayName ||
                              effectiveOrg?.orgName ||
                              '-'}
                          </Typography>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={t(`environments.types.${env.environmentType}`)}
                          color={getEnvironmentTypeColor(env.environmentType)}
                          size="small"
                          sx={{ borderRadius: '8px' }}
                        />
                      </TableCell>
                      <TableCell>{env.description || '-'}</TableCell>
                      <TableCell align="center">
                        {(env as any).isDefault ? (
                          <Chip
                            label="✓"
                            color="primary"
                            size="small"
                            sx={{ borderRadius: '8px' }}
                          />
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell align="center">
                        {env.isSystemDefined ? (
                          <Chip
                            label="✓"
                            color="default"
                            size="small"
                            sx={{ borderRadius: '8px' }}
                          />
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell align="center">
                        {env.requiresApproval ? (
                          <Chip
                            label={`${env.requiredApprovers || 1}`}
                            color="warning"
                            size="small"
                            sx={{ borderRadius: '8px' }}
                          />
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            -
                          </Typography>
                        )}
                      </TableCell>
                      {canManage && (
                        <TableCell align="center">
                          <Tooltip
                            title={
                              env.isHidden
                                ? t('environments.show')
                                : t('environments.hide')
                            }
                          >
                            <IconButton
                              size="small"
                              onClick={() => handleToggleVisibility(env)}
                              sx={{
                                color: env.isHidden
                                  ? 'text.disabled'
                                  : 'success.main',
                              }}
                            >
                              {env.isHidden ? (
                                <VisibilityOffIcon fontSize="small" />
                              ) : (
                                <VisibilityIcon fontSize="small" />
                              )}
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      )}
                      {canManage && (
                        <TableCell align="center">
                          <IconButton
                            size="small"
                            onClick={(e) => handleMenuOpen(e, env)}
                          >
                            <MoreVertIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </TableContainer>
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
            if (menuTargetEnv && effectiveOrg && effectiveProject) {
              switchEnvironment(
                effectiveOrg.id,
                effectiveProject.id,
                menuTargetEnv.environmentId
              );
            }
            handleMenuClose();
          }}
          disabled={menuTargetEnv?.environmentId === currentEnvironmentId}
        >
          <ListItemIcon>
            <SwapHorizIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>
            {t('environments.switchTo', {
              name: menuTargetEnv?.displayName || '',
            })}
          </ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menuTargetEnv) handleOpenEditDialog(menuTargetEnv);
            handleMenuClose();
          }}
        >
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('common.edit')}</ListItemText>
        </MenuItem>
        {canManage && (
          <MenuItem
            onClick={() => {
              if (menuTargetEnv) handleToggleVisibility(menuTargetEnv);
              handleMenuClose();
            }}
          >
            <ListItemIcon>
              {menuTargetEnv?.isHidden ? (
                <VisibilityIcon fontSize="small" />
              ) : (
                <VisibilityOffIcon fontSize="small" />
              )}
            </ListItemIcon>
            <ListItemText>
              {menuTargetEnv?.isHidden
                ? t('environments.show')
                : t('environments.hide')}
            </ListItemText>
          </MenuItem>
        )}
        <Divider />
        <MenuItem
          onClick={() => {
            if (menuTargetEnv) handleOpenDeleteDialog(menuTargetEnv);
            handleMenuClose();
          }}
          disabled={Boolean(menuTargetEnv?.isSystemDefined)}
        >
          <ListItemIcon>
            <DeleteIcon
              fontSize="small"
              color={menuTargetEnv?.isSystemDefined ? 'disabled' : 'error'}
            />
          </ListItemIcon>
          <ListItemText>{t('common.delete')}</ListItemText>
        </MenuItem>
      </Menu>

      <EnvironmentCopyDialog
        open={copyDialogOpen}
        onClose={() => setCopyDialogOpen(false)}
        environments={environments}
        onCopyComplete={loadEnvironments}
      />

      {/* Add Environment Drawer */}
      <ResizableDrawer
        open={addDialogOpen}
        onClose={handleCloseAddDialog}
        title={t('environments.addNew')}
        subtitle={t('environments.addDescription')}
        storageKey="environmentAddDrawerWidth"
        defaultWidth={500}
        minWidth={400}
        zIndex={1300}
      >
        {/* Content */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              inputRef={addNameFieldRef}
              label={t('environments.name')}
              value={newEnv.name || ''}
              onChange={(e) => setNewEnv({ ...newEnv, name: e.target.value })}
              placeholder={t('environments.namePlaceholder')}
              fullWidth
              required
              disabled={creating}
              autoFocus
              error={
                (newEnv.name || '').length > 0 &&
                !isValidResourceName(newEnv.name || '')
              }
              helperText={t('environments.nameHelperText')}
            />

            <TextField
              label={t('environments.displayName')}
              value={newEnv.displayName}
              onChange={(e) =>
                setNewEnv({ ...newEnv, displayName: e.target.value })
              }
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
                  const type = e.target.value as
                    | 'development'
                    | 'staging'
                    | 'production';
                  setNewEnv({
                    ...newEnv,
                    environmentType: type,
                    color: getColorByType(type),
                  });
                }}
                disabled={creating}
              >
                <MenuItem value="development">
                  {t('environments.types.development')}
                </MenuItem>
                <MenuItem value="staging">
                  {t('environments.types.staging')}
                </MenuItem>
                <MenuItem value="production">
                  {t('environments.types.production')}
                </MenuItem>
              </Select>
            </FormControl>

            <TextField
              label={t('environments.description')}
              value={newEnv.description}
              onChange={(e) =>
                setNewEnv({ ...newEnv, description: e.target.value })
              }
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
                  <MenuItem key={env.environmentId} value={env.environmentId}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box
                        sx={{
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          backgroundColor:
                            env.color || getColorByType(env.environmentType),
                        }}
                      />
                      {env.displayName || env.environmentName}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>
                {t('environments.baseEnvironmentDescription')}
              </FormHelperText>
            </FormControl>

            {/* Change Request Settings */}
            <Box
              sx={{
                mt: 1,
                p: 2,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
              }}
            >
              <Typography
                variant="subtitle2"
                gutterBottom
                sx={{ fontWeight: 600 }}
              >
                {t('environments.changeRequestSettings')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('environments.changeRequestSettingsDescription')}
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={newEnv.requiresApproval || false}
                    onChange={(e) =>
                      setNewEnv({
                        ...newEnv,
                        requiresApproval: e.target.checked,
                      })
                    }
                    color="primary"
                    disabled={creating}
                  />
                }
                label={t('environments.requiresApproval')}
              />
              {newEnv.requiresApproval && (
                <FormControl fullWidth margin="normal" size="small">
                  <InputLabel>{t('environments.requiredApprovers')}</InputLabel>
                  <Select
                    value={newEnv.requiredApprovers || 1}
                    label={t('environments.requiredApprovers')}
                    onChange={(e) =>
                      setNewEnv({
                        ...newEnv,
                        requiredApprovers: Number(e.target.value),
                      })
                    }
                    disabled={creating}
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <MenuItem key={n} value={n}>
                        {n}
                      </MenuItem>
                    ))}
                  </Select>
                  <FormHelperText>
                    {t('environments.requiredApproversHelperText')}
                  </FormHelperText>
                </FormControl>
              )}
            </Box>
          </Box>

          {creating && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
              <CircularProgress size={20} />
              <Typography variant="body2" color="text.secondary">
                {baseEnvironment
                  ? t('environments.creatingWithCopy')
                  : t('common.creating')}
              </Typography>
            </Box>
          )}
        </Box>

        {/* Actions */}
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
          <Button onClick={handleCloseAddDialog} disabled={creating}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateEnvironment}
            disabled={
              !newEnv.displayName ||
              !newEnv.name ||
              !isValidResourceName(newEnv.name || '') ||
              creating
            }
          >
            {t('environments.create')}
          </Button>
        </Box>
      </ResizableDrawer>

      {/* Delete Environment Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleCloseDeleteDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              color: 'error.main',
            }}
          >
            <WarningIcon />
            {t('environments.deleteConfirmTitle')}
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {loadingRelatedData ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            relatedData && (
              <>
                <Typography variant="body1" gutterBottom>
                  {t('environments.deleteConfirmMessage', {
                    name: selectedEnvForDelete?.displayName,
                  })}
                </Typography>

                {!relatedData.canDelete && (
                  <Alert severity="error" sx={{ mt: 2 }}>
                    {relatedData.environmentId.isSystemDefined
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

                    <Paper
                      variant="outlined"
                      sx={{ p: 1.5, maxHeight: 300, overflow: 'auto' }}
                    >
                      {getRelatedDataItems().map((category) => (
                        <Box
                          key={category.key}
                          sx={{ mb: 1.5, '&:last-child': { mb: 0 } }}
                        >
                          <Typography
                            variant="subtitle2"
                            sx={{ fontWeight: 600, mb: 0.5 }}
                          >
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
                              <Typography
                                variant="body2"
                                color="text.disabled"
                                sx={{ py: 0.25, fontStyle: 'italic' }}
                              >
                                ...{' '}
                                {t('common.andMore', {
                                  count: category.count - category.items.length,
                                })}
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
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      mt: 2,
                    }}
                  >
                    <CircularProgress size={20} />
                    <Typography variant="body2" color="text.secondary">
                      {t('common.deleting')}
                    </Typography>
                  </Box>
                )}
              </>
            )
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
            disabled={
              !relatedData?.canDelete ||
              (relatedData?.hasData && !forceDelete) ||
              deleting
            }
          >
            {t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Environment Drawer */}
      <ResizableDrawer
        open={editDialogOpen}
        onClose={handleCloseEditDialog}
        title={t('environments.editTitle')}
        subtitle={t('environments.editDescription')}
        storageKey="environmentEditDrawerWidth"
        defaultWidth={500}
        minWidth={400}
        zIndex={1300}
      >
        {/* Content */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              inputRef={editDisplayNameFieldRef}
              label={t('environments.displayName')}
              value={editEnv.displayName || ''}
              onChange={(e) =>
                setEditEnv({ ...editEnv, displayName: e.target.value })
              }
              fullWidth
              placeholder={t('environments.displayNamePlaceholder')}
              required
              autoFocus
            />

            <TextField
              label={t('environments.description')}
              value={editEnv.description || ''}
              onChange={(e) =>
                setEditEnv({ ...editEnv, description: e.target.value })
              }
              fullWidth
              multiline
              rows={2}
            />

            <FormControl fullWidth>
              <InputLabel>{t('environments.type')}</InputLabel>
              <Select
                value={editEnv.environmentType || 'development'}
                onChange={(e) =>
                  setEditEnv({
                    ...editEnv,
                    environmentType: e.target.value as any,
                  })
                }
                label={t('environments.type')}
              >
                <MenuItem value="development">
                  {t('environments.types.development')}
                </MenuItem>
                <MenuItem value="staging">
                  {t('environments.types.staging')}
                </MenuItem>
                <MenuItem value="production">
                  {t('environments.types.production')}
                </MenuItem>
              </Select>
            </FormControl>

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                {t('environments.color')}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <input
                  type="color"
                  value={editEnv.color || '#2e7d32'}
                  onChange={(e) =>
                    setEditEnv({ ...editEnv, color: e.target.value })
                  }
                  style={{ width: 50, height: 40, cursor: 'pointer' }}
                />
                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                  {editEnv.color || '#2e7d32'}
                </Typography>
              </Box>
            </Box>

            {/* Change Request Settings */}
            <Box
              sx={{
                mt: 1,
                p: 2,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
              }}
            >
              <Typography
                variant="subtitle2"
                gutterBottom
                sx={{ fontWeight: 600 }}
              >
                {t('environments.changeRequestSettings')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('environments.changeRequestSettingsDescription')}
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={editEnv.requiresApproval || false}
                    onChange={(e) =>
                      setEditEnv({
                        ...editEnv,
                        requiresApproval: e.target.checked,
                      })
                    }
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
                    onChange={(e) =>
                      setEditEnv({
                        ...editEnv,
                        requiredApprovers: Number(e.target.value),
                      })
                    }
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <MenuItem key={n} value={n}>
                        {n}
                      </MenuItem>
                    ))}
                  </Select>
                  <FormHelperText>
                    {t('environments.requiredApproversHelperText')}
                  </FormHelperText>
                </FormControl>
              )}
            </Box>

            {/* Lock Settings - only show when CR is enabled */}
            {editEnv.requiresApproval && (
              <Box
                sx={{
                  p: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                }}
              >
                <Typography
                  variant="subtitle2"
                  gutterBottom
                  sx={{ fontWeight: 600 }}
                >
                  {t('environments.lockSettings')}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 2 }}
                >
                  {t('environments.lockSettingsDescription')}
                </Typography>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={(editEnv as any).enableSoftLock || false}
                        onChange={(e) =>
                          setEditEnv({
                            ...editEnv,
                            enableSoftLock: e.target.checked,
                          } as any)
                        }
                        color="primary"
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body2">
                          {t('environments.enableSoftLock')}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {t('environments.enableSoftLockDescription')}
                        </Typography>
                      </Box>
                    }
                  />

                  <FormControlLabel
                    control={
                      <Switch
                        checked={(editEnv as any).enableHardLock || false}
                        onChange={(e) =>
                          setEditEnv({
                            ...editEnv,
                            enableHardLock: e.target.checked,
                          } as any)
                        }
                        color="primary"
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body2">
                          {t('environments.enableHardLock')}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {t('environments.enableHardLockDescription')}
                        </Typography>
                      </Box>
                    }
                  />
                </Box>
              </Box>
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
        </Box>

        {/* Actions */}
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
          <Button onClick={handleCloseEditDialog} disabled={updating}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            onClick={handleUpdateEnvironment}
            disabled={!editEnv.displayName || updating || !isEditDirty}
          >
            {t('common.update')}
          </Button>
        </Box>
      </ResizableDrawer>
    </Box>
  );
};

export default EnvironmentsPage;
