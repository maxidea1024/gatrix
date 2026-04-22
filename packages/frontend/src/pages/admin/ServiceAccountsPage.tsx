/**
 * Service Accounts Management Page
 *
 * Allows administrators to manage service accounts and their tokens.
 * Uses RBAC system for role assignment.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Tooltip,
  Alert,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  ListItemIcon,
  Tabs,
  Tab,
  Autocomplete,
  Menu,
  MenuItem,
  ButtonBase,
  Popover,
  alpha,
  Collapse,
  ListItemButton,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  ContentCopy as CopyIcon,
  VpnKey as TokenIcon,
  Shield as ShieldIcon,
  MoreVert as MoreVertIcon,
  Public as PublicIcon,
  Business as BusinessIcon,
  Folder as FolderIcon,
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon,
  ArrowDropDown as ArrowDropDownIcon,
  Check as CheckIcon,
  ManageAccounts as ManageAccountsIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { enqueueSnackbar } from 'notistack';
import serviceAccountService, {
  ServiceAccount,
  ServiceAccountToken,
} from '@/services/serviceAccountService';
import { rbacService, Role, UserRole } from '@/services/rbacService';
import { copyToClipboardWithNotification } from '@/utils/clipboard';
import EmptyPagePlaceholder from '@/components/common/EmptyPagePlaceholder';
import ResizableDrawer from '@/components/common/ResizableDrawer';
import PageContentLoader from '@/components/common/PageContentLoader';
import PageHeader from '@/components/common/PageHeader';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import { formatRelativeTime, formatDateTimeDetailed } from '@/utils/dateFormat';
import { useAuth } from '@/hooks/useAuth';
import { P } from '@/types/permissions';
import environmentService from '@/services/environmentService';

// ==================== Tab Panel ====================

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <Box role="tabpanel" hidden={value !== index} sx={{ pt: 2 }}>
    {value === index && children}
  </Box>
);

// ==================== Create/Edit Dialog ====================
interface AccountDialogProps {
  open: boolean;
  account: ServiceAccount | null;
  onClose: () => void;
  onSave: (data: {
    name: string;
    roleIds: string[];
    environmentId: string;
  }) => void;
}

// Environment type to color mapping (same as EnvironmentSelector)
const getEnvTypeColor = (type: string, customColor?: string): string => {
  if (customColor) return customColor;
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

interface CachedEnv {
  environmentId: string;
  displayName: string;
  environmentType: string;
  color?: string;
}

const AccountDialog: React.FC<AccountDialogProps> = ({
  open,
  account,
  onClose,
  onSave,
}) => {
  const { t } = useTranslation();
  const { organisations, projects } = useOrgProject();
  const [name, setName] = useState('');
  const [selectedEnvironmentId, setSelectedEnvironmentId] =
    useState<string>('');
  const [selectedEnvLabel, setSelectedEnvLabel] = useState<string>('');
  const [allRoles, setAllRoles] = useState<Role[]>([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);

  // Environment tree picker state
  const [envPickerAnchor, setEnvPickerAnchor] = useState<HTMLElement | null>(
    null
  );
  const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(new Set());
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(
    new Set()
  );
  const [projectEnvCache, setProjectEnvCache] = useState<
    Record<string, CachedEnv[]>
  >({});
  const [loadingProjectIds, setLoadingProjectIds] = useState<Set<string>>(
    new Set()
  );
  const loadedRef = useRef<Set<string>>(new Set());

  // Lazy-load environments for a project on expand
  const loadProjectEnvs = useCallback(
    async (projectId: string, orgId: string) => {
      if (loadedRef.current.has(projectId)) return;
      loadedRef.current.add(projectId);
      setLoadingProjectIds((prev) => new Set(prev).add(projectId));
      try {
        const apiPath = `/admin/orgs/${orgId}/projects/${projectId}`;
        const envs = await environmentService.getEnvironments(apiPath, true);
        setProjectEnvCache((prev) => ({
          ...prev,
          [projectId]: envs.map((e) => ({
            environmentId: e.environmentId,
            displayName: e.displayName,
            environmentType: e.environmentType,
            color: e.color,
          })),
        }));
      } catch {
        loadedRef.current.delete(projectId);
      } finally {
        setLoadingProjectIds((prev) => {
          const next = new Set(prev);
          next.delete(projectId);
          return next;
        });
      }
    },
    []
  );

  useEffect(() => {
    if (open) {
      setName(account?.name || '');
      setSelectedEnvironmentId(account?.environmentId || '');
      setSelectedEnvLabel(account?.environmentName || '');
      setSelectedRoleIds([]);
      setRolesLoading(true);
      loadedRef.current = new Set();
      setProjectEnvCache({});
      setExpandedOrgs(new Set());
      setExpandedProjects(new Set());

      const loadData = async () => {
        try {
          const roles = await rbacService.getRoles();
          setAllRoles(roles);
          if (account) {
            const userRoles = await rbacService.getUserRoles(
              String(account.id)
            );
            setSelectedRoleIds(userRoles.map((ur) => ur.roleId));
          }
        } catch {
          // silent
        } finally {
          setRolesLoading(false);
        }
      };
      loadData();
    }
  }, [account, open]);

  const handleToggleRole = (roleId: string) => {
    setSelectedRoleIds((prev) =>
      prev.includes(roleId)
        ? prev.filter((id) => id !== roleId)
        : [...prev, roleId]
    );
  };

  const handleSave = () => {
    if (!name.trim() || !selectedEnvironmentId) return;
    onSave({
      name: name.trim(),
      roleIds: selectedRoleIds,
      environmentId: selectedEnvironmentId,
    });
  };

  // Environment tree handlers
  const handleOpenEnvPicker = (e: React.MouseEvent<HTMLElement>) => {
    setEnvPickerAnchor(e.currentTarget);
    // Auto-expand single org and its projects
    if (organisations.length === 1) {
      const orgId = organisations[0].id;
      setExpandedOrgs(new Set([orgId]));
      const orgProjects = projects.filter((p) => p.orgId === orgId);
      setExpandedProjects(new Set(orgProjects.map((p) => p.id)));
      orgProjects.forEach((p) => loadProjectEnvs(p.id, orgId));
    }
  };

  const handleToggleOrg = (orgId: string) => {
    setExpandedOrgs((prev) => {
      const next = new Set(prev);
      if (next.has(orgId)) next.delete(orgId);
      else next.add(orgId);
      return next;
    });
  };

  const handleToggleProject = (projectId: string, orgId: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
        loadProjectEnvs(projectId, orgId);
      }
      return next;
    });
  };

  const handleSelectEnv = (envId: string, envLabel: string) => {
    setSelectedEnvironmentId(envId);
    setSelectedEnvLabel(envLabel);
    setEnvPickerAnchor(null);
  };

  const isMultiOrg = organisations.length > 1;

  // Render environment items for a project
  const renderProjectEnvs = (projectId: string, indent: number) => {
    const envs = projectEnvCache[projectId] || [];
    const isLoadingEnvs = loadingProjectIds.has(projectId);

    if (isLoadingEnvs && envs.length === 0) {
      return (
        <ListItemButton dense disabled sx={{ pl: indent, py: 0.5 }}>
          <ListItemText
            primary={t('common.loading')}
            primaryTypographyProps={{
              variant: 'caption',
              color: 'text.secondary',
              fontStyle: 'italic',
            }}
          />
        </ListItemButton>
      );
    }

    if (envs.length === 0) {
      return (
        <ListItemButton dense disabled sx={{ pl: indent, py: 0.5 }}>
          <ListItemText
            primary={t('environments.noEnvironments')}
            primaryTypographyProps={{
              variant: 'caption',
              color: 'text.secondary',
              fontStyle: 'italic',
            }}
          />
        </ListItemButton>
      );
    }

    return envs.map((env) => {
      const envColor = getEnvTypeColor(env.environmentType, env.color);
      const isSelected = env.environmentId === selectedEnvironmentId;
      return (
        <ListItemButton
          key={env.environmentId}
          onClick={() => handleSelectEnv(env.environmentId, env.displayName)}
          dense
          selected={isSelected}
          sx={{
            pl: indent,
            py: 0.5,
            '&.Mui-selected': {
              backgroundColor: (theme) =>
                alpha(envColor, theme.palette.mode === 'dark' ? 0.2 : 0.1),
              '&:hover': {
                backgroundColor: (theme) =>
                  alpha(envColor, theme.palette.mode === 'dark' ? 0.25 : 0.15),
              },
            },
            '&:hover': {
              backgroundColor: (theme) =>
                alpha(envColor, theme.palette.mode === 'dark' ? 0.15 : 0.08),
            },
          }}
        >
          <ListItemIcon sx={{ minWidth: 24 }}>
            <Box
              sx={{
                width: 10,
                height: 10,
                borderRadius: 0.5,
                backgroundColor: envColor,
                boxShadow: isSelected
                  ? `0 0 6px ${alpha(envColor, 0.6)}`
                  : 'none',
              }}
            />
          </ListItemIcon>
          <ListItemText
            primary={env.displayName}
            primaryTypographyProps={{
              variant: 'body2',
              fontWeight: isSelected ? 600 : 400,
            }}
          />
          {isSelected && (
            <CheckIcon
              sx={{ fontSize: 18, color: 'success.main', ml: 'auto' }}
            />
          )}
        </ListItemButton>
      );
    });
  };

  return (
    <ResizableDrawer
      open={open}
      onClose={onClose}
      title={
        account
          ? t('serviceAccounts.editAccount')
          : t('serviceAccounts.createAccount')
      }
      subtitle={t('serviceAccounts.drawerSubtitle')}
      storageKey="serviceAccountDrawerWidth"
      defaultWidth={500}
      minWidth={400}
      zIndex={1301}
    >
      {/* Content */}
      <Box
        sx={{
          flex: 1,
          p: 3,
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
        }}
      >
        {/* Basic Info */}
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography
            variant="subtitle2"
            sx={{ mb: 2, fontWeight: 600, color: 'primary.main' }}
          >
            {t('serviceAccounts.basicInfo')}
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              autoFocus
              label={t('serviceAccounts.accountName')}
              fullWidth
              size="small"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            {/* Environment picker trigger */}
            <Box>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mb: 0.5, display: 'block' }}
              >
                {t('serviceAccounts.environment')} *
              </Typography>
              <ButtonBase
                onClick={handleOpenEnvPicker}
                sx={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  px: 1.5,
                  py: 1,
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: selectedEnvironmentId
                    ? 'primary.main'
                    : 'divider',
                  bgcolor: selectedEnvironmentId
                    ? (theme) =>
                        alpha(
                          theme.palette.primary.main,
                          theme.palette.mode === 'dark' ? 0.08 : 0.04
                        )
                    : 'transparent',
                  transition: 'all 0.15s',
                  '&:hover': {
                    borderColor: 'primary.main',
                    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.06),
                  },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PublicIcon
                    sx={{
                      fontSize: 18,
                      color: selectedEnvironmentId
                        ? 'primary.main'
                        : 'text.disabled',
                    }}
                  />
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: selectedEnvironmentId ? 600 : 400,
                      color: selectedEnvironmentId
                        ? 'text.primary'
                        : 'text.secondary',
                    }}
                  >
                    {selectedEnvLabel || t('serviceAccounts.selectEnvironment')}
                  </Typography>
                </Box>
                <ArrowDropDownIcon
                  sx={{ fontSize: 20, color: 'text.secondary' }}
                />
              </ButtonBase>

              {/* Environment tree popover */}
              <Popover
                open={Boolean(envPickerAnchor)}
                anchorEl={envPickerAnchor}
                onClose={() => setEnvPickerAnchor(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                slotProps={{
                  paper: {
                    sx: {
                      mt: 0.5,
                      minWidth: 320,
                      maxWidth: 420,
                      maxHeight: 360,
                      borderRadius: 2,
                      boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
                      overflow: 'auto',
                    },
                  },
                }}
              >
                <Box sx={{ py: 0.5 }}>
                  {organisations.map((org) => {
                    const isOrgExpanded =
                      expandedOrgs.has(org.id) || !isMultiOrg;
                    const orgProjects = projects.filter(
                      (p) => p.orgId === org.id
                    );

                    return (
                      <React.Fragment key={org.id}>
                        {/* Org header (multi-org only) */}
                        {isMultiOrg && (
                          <ListItemButton
                            onClick={() => handleToggleOrg(org.id)}
                            dense
                            sx={{ py: 0.5 }}
                          >
                            <ListItemIcon sx={{ minWidth: 28 }}>
                              {isOrgExpanded ? (
                                <ExpandMoreIcon sx={{ fontSize: 18 }} />
                              ) : (
                                <ChevronRightIcon sx={{ fontSize: 18 }} />
                              )}
                            </ListItemIcon>
                            <ListItemIcon sx={{ minWidth: 24 }}>
                              <BusinessIcon
                                sx={{ fontSize: 16, opacity: 0.7 }}
                              />
                            </ListItemIcon>
                            <ListItemText
                              primary={org.displayName || org.orgName}
                              primaryTypographyProps={{
                                variant: 'body2',
                                fontWeight: 500,
                              }}
                            />
                          </ListItemButton>
                        )}

                        {/* Projects */}
                        <Collapse in={isOrgExpanded} timeout="auto">
                          {orgProjects.map((proj) => {
                            const isProjExpanded = expandedProjects.has(
                              proj.id
                            );
                            const projIndent = isMultiOrg ? 4 : 1.5;
                            const envIndent = projIndent + 3.5;

                            return (
                              <React.Fragment key={proj.id}>
                                <ListItemButton
                                  onClick={() =>
                                    handleToggleProject(proj.id, org.id)
                                  }
                                  dense
                                  sx={{ py: 0.5, pl: projIndent }}
                                >
                                  <ListItemIcon sx={{ minWidth: 28 }}>
                                    {isProjExpanded ? (
                                      <ExpandMoreIcon sx={{ fontSize: 18 }} />
                                    ) : (
                                      <ChevronRightIcon sx={{ fontSize: 18 }} />
                                    )}
                                  </ListItemIcon>
                                  <ListItemIcon sx={{ minWidth: 24 }}>
                                    <FolderIcon
                                      sx={{ fontSize: 16, opacity: 0.7 }}
                                    />
                                  </ListItemIcon>
                                  <ListItemText
                                    primary={
                                      proj.displayName || proj.projectName
                                    }
                                    primaryTypographyProps={{
                                      variant: 'body2',
                                      fontWeight: 400,
                                    }}
                                  />
                                </ListItemButton>

                                <Collapse in={isProjExpanded} timeout="auto">
                                  {renderProjectEnvs(proj.id, envIndent)}
                                </Collapse>
                              </React.Fragment>
                            );
                          })}
                        </Collapse>
                      </React.Fragment>
                    );
                  })}
                </Box>
              </Popover>
            </Box>
          </Box>
        </Paper>

        {/* RBAC Role Assignment */}
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography
            variant="subtitle2"
            sx={{ mb: 2, fontWeight: 600, color: 'primary.main' }}
          >
            {t('rbac.roles.title')}
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ mb: 2, display: 'block' }}
          >
            {t('serviceAccounts.roleSelectionGuide')}
          </Typography>

          {rolesLoading ? (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ py: 2, textAlign: 'center' }}
            >
              {t('common.loading')}
            </Typography>
          ) : allRoles.length === 0 ? (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ py: 2, textAlign: 'center' }}
            >
              {t('serviceAccounts.noRolesAvailable')}
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {allRoles.map((role) => {
                const isSelected = selectedRoleIds.includes(role.id);
                return (
                  <Paper
                    key={role.id}
                    variant="outlined"
                    sx={{
                      px: 1.5,
                      py: 1,
                      cursor: 'pointer',
                      borderColor: isSelected ? 'primary.main' : 'divider',
                      bgcolor: isSelected ? 'action.selected' : 'transparent',
                      '&:hover': {
                        bgcolor: isSelected
                          ? 'action.selected'
                          : 'action.hover',
                      },
                      transition: 'all 0.15s',
                    }}
                    onClick={() => handleToggleRole(role.id)}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <ShieldIcon
                        sx={{
                          fontSize: 16,
                          color: isSelected ? 'primary.main' : 'text.disabled',
                        }}
                      />
                      <Typography
                        variant="body2"
                        fontWeight={isSelected ? 600 : 400}
                      >
                        {role.roleName}
                      </Typography>
                      {isSelected && (
                        <Chip
                          label="✓"
                          size="small"
                          color="primary"
                          sx={{ height: 20, ml: 'auto' }}
                        />
                      )}
                    </Box>
                    {role.description && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ ml: 3 }}
                      >
                        {role.description}
                      </Typography>
                    )}
                  </Paper>
                );
              })}
            </Box>
          )}
        </Paper>
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
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={!name.trim() || !selectedEnvironmentId}
        >
          {account ? t('common.update') : t('common.create')}
        </Button>
      </Box>
    </ResizableDrawer>
  );
};

// ==================== Token Dialog ====================
interface TokenDialogProps {
  open: boolean;
  accountId: number | null;
  onClose: () => void;
  onCreated: () => void;
}

const TokenDialog: React.FC<TokenDialogProps> = ({
  open,
  accountId,
  onClose,
  onCreated,
}) => {
  const { t } = useTranslation();
  const { getProjectApiPath } = useOrgProject();
  const projectApiPath = getProjectApiPath();
  const [tokenName, setTokenName] = useState('');
  const [description, setDescription] = useState('');
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setTokenName('');
      setDescription('');
      setCreatedToken(null);
    }
  }, [open]);

  const handleCreate = async () => {
    if (!accountId || !tokenName.trim()) return;
    setLoading(true);
    try {
      const result = await serviceAccountService.createToken(
        projectApiPath,
        accountId,
        {
          name: tokenName.trim(),
          description: description.trim() || undefined,
        }
      );
      setCreatedToken(result.secret);
      onCreated();
      enqueueSnackbar(t('serviceAccounts.tokenCreatedSuccess'), {
        variant: 'success',
      });
    } catch {
      enqueueSnackbar(t('serviceAccounts.tokenCreateFailed'), {
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('serviceAccounts.createToken')}</DialogTitle>
      <DialogContent>
        {!createdToken ? (
          <>
            <TextField
              autoFocus
              margin="dense"
              label={t('serviceAccounts.tokenName')}
              fullWidth
              value={tokenName}
              onChange={(e) => setTokenName(e.target.value)}
              sx={{ mt: 1 }}
            />
            <TextField
              margin="dense"
              label={t('serviceAccounts.tokenDescription')}
              fullWidth
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </>
        ) : (
          <Box>
            <Alert severity="warning" sx={{ mb: 2 }}>
              {t('serviceAccounts.tokenSecurityNotice')}
            </Alert>
            <TextField
              fullWidth
              label={t('serviceAccounts.tokenValue')}
              value={createdToken}
              InputProps={{
                readOnly: true,
                endAdornment: (
                  <IconButton
                    size="small"
                    onClick={() =>
                      copyToClipboardWithNotification(
                        createdToken,
                        () =>
                          enqueueSnackbar(t('common.copiedToClipboard'), {
                            variant: 'success',
                          }),
                        () =>
                          enqueueSnackbar(t('common.copyFailed'), {
                            variant: 'error',
                          })
                      )
                    }
                  >
                    <CopyIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                ),
              }}
            />
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        {!createdToken ? (
          <>
            <Button onClick={onClose}>{t('common.cancel')}</Button>
            <Button
              onClick={handleCreate}
              variant="contained"
              disabled={!tokenName.trim() || loading}
            >
              {t('common.create')}
            </Button>
          </>
        ) : (
          <Button onClick={onClose} variant="contained">
            {t('common.close')}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

// ==================== Delete Confirm Dialog ====================
interface DeleteDialogProps {
  open: boolean;
  title: string;
  message: string;
  onClose: () => void;
  onConfirm: () => void;
}

const DeleteDialog: React.FC<DeleteDialogProps> = ({
  open,
  title,
  message,
  onClose,
  onConfirm,
}) => {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Typography>{message}</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button onClick={onConfirm} color="error" variant="contained">
          {t('common.delete')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ==================== Main Page ====================
const ServiceAccountsPage: React.FC = () => {
  const { t } = useTranslation();
  const { getProjectApiPath } = useOrgProject();
  const projectApiPath = getProjectApiPath();
  const { hasPermission } = useAuth();
  const canCreate = hasPermission(P.SERVICE_ACCOUNTS_CREATE);
  const canUpdate = hasPermission(P.SERVICE_ACCOUNTS_UPDATE);
  const canDelete = hasPermission(P.SERVICE_ACCOUNTS_DELETE);
  const [accounts, setAccounts] = useState<ServiceAccount[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog states
  const [editDialog, setEditDialog] = useState<{
    open: boolean;
    account: ServiceAccount | null;
  }>({ open: false, account: null });

  const [tokenDialog, setTokenDialog] = useState<{
    open: boolean;
    accountId: number | null;
  }>({ open: false, accountId: null });

  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    type: 'account' | 'token';
    accountId: number;
    tokenId?: number;
    name: string;
  } | null>(null);

  // Detail drawer state
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailAccount, setDetailAccount] = useState<ServiceAccount | null>(
    null
  );
  const [detailTab, setDetailTab] = useState(0);
  const [detailTokens, setDetailTokens] = useState<ServiceAccountToken[]>([]);
  const [detailRoles, setDetailRoles] = useState<UserRole[]>([]);
  const [allRoles, setAllRoles] = useState<Role[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);

  // Menu state
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [menuTargetAccount, setMenuTargetAccount] =
    useState<ServiceAccount | null>(null);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await serviceAccountService.getAll(projectApiPath);
      setAccounts(data);
    } catch {
      enqueueSnackbar(t('serviceAccounts.loadFailed'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [t, projectApiPath]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  // Detail drawer logic
  const handleViewDetails = async (account: ServiceAccount) => {
    setDetailAccount(account);
    setDetailOpen(true);
    setDetailTab(0);
    setSelectedRoleId(null);

    try {
      // Load tokens and roles in parallel
      const [accountDetail, userRoles, roles] = await Promise.all([
        serviceAccountService.getById(projectApiPath, account.id),
        rbacService.getUserRoles(String(account.id)),
        rbacService.getRoles(),
      ]);
      setDetailTokens(accountDetail.tokens || []);
      setDetailRoles(userRoles);
      setAllRoles(roles);
    } catch {
      enqueueSnackbar(t('serviceAccounts.loadFailed'), { variant: 'error' });
    }
  };

  const refreshDetail = async () => {
    if (!detailAccount) return;
    try {
      const [accountDetail, userRoles] = await Promise.all([
        serviceAccountService.getById(projectApiPath, detailAccount.id),
        rbacService.getUserRoles(String(detailAccount.id)),
      ]);
      setDetailTokens(accountDetail.tokens || []);
      setDetailRoles(userRoles);
    } catch {
      // silent
    }
  };

  // Role management
  const handleAssignRole = async () => {
    if (!detailAccount || !selectedRoleId) return;
    try {
      await rbacService.assignUserRole(
        String(detailAccount.id),
        selectedRoleId
      );
      enqueueSnackbar(t('serviceAccounts.roleAssignSuccess'), {
        variant: 'success',
      });
      setSelectedRoleId(null);
      refreshDetail();
    } catch (error: any) {
      const msg =
        error?.response?.data?.message || t('serviceAccounts.roleAssignFailed');
      enqueueSnackbar(msg, { variant: 'error' });
    }
  };

  const handleRemoveRole = async (roleId: string) => {
    if (!detailAccount) return;
    try {
      await rbacService.removeUserRole(String(detailAccount.id), roleId);
      enqueueSnackbar(t('serviceAccounts.roleRemoveSuccess'), {
        variant: 'success',
      });
      refreshDetail();
    } catch (error: any) {
      const msg =
        error?.response?.data?.message || t('serviceAccounts.roleRemoveFailed');
      enqueueSnackbar(msg, { variant: 'error' });
    }
  };

  // Account CRUD
  const handleSaveAccount = async (data: {
    name: string;
    roleIds: string[];
    environmentId: string;
  }) => {
    try {
      if (editDialog.account) {
        // Update name
        await serviceAccountService.update(
          projectApiPath,
          editDialog.account.id,
          {
            name: data.name,
            environmentId: data.environmentId,
          }
        );

        // Sync roles: get current roles, compute adds/removes
        const currentRoles = await rbacService.getUserRoles(
          String(editDialog.account.id)
        );
        const currentRoleIds = currentRoles.map((r) => r.roleId);
        const toAdd = data.roleIds.filter((id) => !currentRoleIds.includes(id));
        const toRemove = currentRoleIds.filter(
          (id) => !data.roleIds.includes(id)
        );

        await Promise.all([
          ...toAdd.map((roleId) =>
            rbacService.assignUserRole(String(editDialog.account!.id), roleId)
          ),
          ...toRemove.map((roleId) =>
            rbacService.removeUserRole(String(editDialog.account!.id), roleId)
          ),
        ]);

        enqueueSnackbar(t('serviceAccounts.updateSuccess'), {
          variant: 'success',
        });
      } else {
        // Create account then assign roles
        const created = await serviceAccountService.create(projectApiPath, {
          name: data.name,
          environmentId: data.environmentId,
        });

        if (data.roleIds.length > 0) {
          await Promise.all(
            data.roleIds.map((roleId) =>
              rbacService.assignUserRole(String(created.id), roleId)
            )
          );
        }

        enqueueSnackbar(t('serviceAccounts.createSuccess'), {
          variant: 'success',
        });
      }
      setEditDialog({ open: false, account: null });
      fetchAccounts();
    } catch {
      enqueueSnackbar(
        editDialog.account
          ? t('serviceAccounts.updateFailed')
          : t('serviceAccounts.createFailed'),
        { variant: 'error' }
      );
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteDialog) return;
    try {
      if (deleteDialog.type === 'account') {
        await serviceAccountService.delete(
          projectApiPath,
          deleteDialog.accountId
        );
        enqueueSnackbar(t('serviceAccounts.deleteSuccess'), {
          variant: 'success',
        });
      } else if (deleteDialog.tokenId) {
        await serviceAccountService.deleteToken(
          projectApiPath,
          deleteDialog.accountId,
          deleteDialog.tokenId
        );
        enqueueSnackbar(t('serviceAccounts.tokenDeleteSuccess'), {
          variant: 'success',
        });
        refreshDetail();
      }
      setDeleteDialog(null);
      fetchAccounts();
    } catch {
      enqueueSnackbar(t('serviceAccounts.deleteFailed'), { variant: 'error' });
    }
  };

  // Compute available roles (exclude already assigned)
  const availableRoles = allRoles.filter(
    (r) => !detailRoles.some((ur) => ur.roleId === r.id)
  );

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <PageHeader
        icon={<ManageAccountsIcon />}
        title={t('serviceAccounts.title')}
        subtitle={t('serviceAccounts.subtitle')}
        actions={
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="contained"
              startIcon={<RefreshIcon />}
              onClick={fetchAccounts}
            >
              {t('common.refresh')}
            </Button>
            {accounts.length > 0 && canCreate && (
              <Button
                variant="contained"
                onClick={() => setEditDialog({ open: true, account: null })}
              >
                {t('serviceAccounts.createAccount')}
              </Button>
            )}
          </Box>
        }
      />

      {/* Content */}
      <PageContentLoader loading={loading}>
        {accounts.length === 0 ? (
          <EmptyPagePlaceholder
            message={t('serviceAccounts.noAccounts')}
            onAddClick={
              canCreate
                ? () => setEditDialog({ open: true, account: null })
                : undefined
            }
            addButtonLabel={
              canCreate ? t('serviceAccounts.createAccount') : undefined
            }
          />
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t('serviceAccounts.accountName')}</TableCell>
                  <TableCell>{t('serviceAccounts.environment')}</TableCell>
                  <TableCell align="center">{t('rbac.roles.title')}</TableCell>
                  <TableCell>{t('serviceAccounts.status')}</TableCell>
                  <TableCell align="center">
                    {t('serviceAccounts.tokens')}
                  </TableCell>
                  <TableCell>{t('serviceAccounts.createdAt')}</TableCell>
                  <TableCell align="center">{t('common.actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">
                        {t('common.loading')}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  accounts.map((account) => (
                    <TableRow
                      key={account.id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => handleViewDetails(account)}
                    >
                      <TableCell>
                        <Typography fontWeight="medium">
                          {account.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {account.email}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {account.environmentName ? (
                          <Chip
                            label={account.environmentName}
                            size="small"
                            variant="outlined"
                            sx={{ borderRadius: '8px' }}
                          />
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            —
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={account.tokens?.length || '–'}
                          size="small"
                          variant="outlined"
                          icon={<ShieldIcon sx={{ fontSize: 14 }} />}
                          sx={{ borderRadius: '8px' }}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={
                            account.status === 'active'
                              ? t('serviceAccounts.active')
                              : t('serviceAccounts.inactive')
                          }
                          size="small"
                          color={
                            account.status === 'active' ? 'success' : 'default'
                          }
                          sx={{ borderRadius: '8px' }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={account.tokens?.length || 0}
                          size="small"
                          variant="outlined"
                          icon={<TokenIcon sx={{ fontSize: 14 }} />}
                          sx={{ borderRadius: '8px' }}
                        />
                      </TableCell>
                      <TableCell>
                        <Tooltip
                          title={formatDateTimeDetailed(account.createdAt)}
                        >
                          <Typography variant="body2">
                            {formatRelativeTime(account.createdAt)}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell align="center">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuAnchorEl(e.currentTarget);
                            setMenuTargetAccount(account);
                          }}
                        >
                          <MoreVertIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </PageContentLoader>

      {/* Action Menu */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={() => {
          setMenuAnchorEl(null);
          setMenuTargetAccount(null);
        }}
      >
        {canUpdate && (
          <MenuItem
            onClick={() => {
              if (menuTargetAccount)
                setEditDialog({ open: true, account: menuTargetAccount });
              setMenuAnchorEl(null);
              setMenuTargetAccount(null);
            }}
          >
            <ListItemIcon>
              <EditIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t('common.edit')}</ListItemText>
          </MenuItem>
        )}
        {canDelete && (
          <MenuItem
            onClick={() => {
              if (menuTargetAccount) {
                setDeleteDialog({
                  open: true,
                  type: 'account',
                  accountId: menuTargetAccount.id,
                  name: menuTargetAccount.name,
                });
              }
              setMenuAnchorEl(null);
              setMenuTargetAccount(null);
            }}
          >
            <ListItemIcon>
              <DeleteIcon fontSize="small" color="error" />
            </ListItemIcon>
            <ListItemText>{t('common.delete')}</ListItemText>
          </MenuItem>
        )}
      </Menu>

      {/* Detail Drawer */}
      <ResizableDrawer
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={detailAccount?.name || ''}
        subtitle={detailAccount?.email || ''}
        storageKey="serviceAccountDetailWidth"
        defaultWidth={550}
        minWidth={450}
      >
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
            <Tabs value={detailTab} onChange={(_, v) => setDetailTab(v)}>
              <Tab
                icon={<TokenIcon sx={{ fontSize: 18 }} />}
                iconPosition="start"
                label={t('serviceAccounts.tokens')}
              />
              <Tab
                icon={<ShieldIcon sx={{ fontSize: 18 }} />}
                iconPosition="start"
                label={t('rbac.roles.title')}
              />
            </Tabs>
          </Box>

          <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
            {/* Tokens Tab */}
            <TabPanel value={detailTab} index={0}>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                <Button
                  size="small"
                  variant="contained"
                  onClick={() =>
                    setTokenDialog({
                      open: true,
                      accountId: detailAccount?.id || null,
                    })
                  }
                >
                  {t('serviceAccounts.addToken')}
                </Button>
              </Box>

              {detailTokens.length === 0 ? (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ py: 2, textAlign: 'center' }}
                >
                  {t('serviceAccounts.noTokens')}
                </Typography>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {detailTokens.map((token) => (
                    <Paper key={token.id} variant="outlined" sx={{ p: 1.5 }}>
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                        }}
                      >
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                              mb: 0.5,
                            }}
                          >
                            <TokenIcon
                              sx={{ fontSize: 16, color: 'primary.main' }}
                            />
                            <Typography variant="body2" fontWeight={600} noWrap>
                              {token.name}
                            </Typography>
                          </Box>
                          {token.description && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{ display: 'block', mb: 0.5 }}
                            >
                              {token.description}
                            </Typography>
                          )}
                          <Box
                            sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}
                          >
                            <Tooltip
                              title={formatDateTimeDetailed(token.createdAt)}
                            >
                              <Chip
                                label={`${t('serviceAccounts.createdAt')}: ${formatRelativeTime(token.createdAt)}`}
                                size="small"
                                variant="outlined"
                                sx={{ height: 22, fontSize: '0.7rem' }}
                              />
                            </Tooltip>
                            {token.expiresAt && (
                              <Tooltip
                                title={formatDateTimeDetailed(token.expiresAt)}
                              >
                                <Chip
                                  label={`${t('serviceAccounts.expiresAt')}: ${formatRelativeTime(token.expiresAt)}`}
                                  size="small"
                                  variant="outlined"
                                  color={
                                    new Date(token.expiresAt) < new Date()
                                      ? 'error'
                                      : 'default'
                                  }
                                  sx={{ height: 22, fontSize: '0.7rem' }}
                                />
                              </Tooltip>
                            )}
                          </Box>
                        </Box>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => {
                            if (detailAccount) {
                              setDeleteDialog({
                                open: true,
                                type: 'token',
                                accountId: detailAccount.id,
                                tokenId: token.id,
                                name: token.name,
                              });
                            }
                          }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </Paper>
                  ))}
                </Box>
              )}
            </TabPanel>

            {/* Roles Tab */}
            <TabPanel value={detailTab} index={1}>
              {/* Add Role */}
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <Autocomplete
                  fullWidth
                  size="small"
                  options={availableRoles}
                  getOptionLabel={(opt) => opt.roleName}
                  value={
                    availableRoles.find((r) => r.id === selectedRoleId) || null
                  }
                  onChange={(_, val) => setSelectedRoleId(val?.id || null)}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder={t('serviceAccounts.selectRole')}
                      size="small"
                    />
                  )}
                  renderOption={(props, option) => (
                    <li {...props} key={option.id}>
                      <Box>
                        <Typography variant="body2">
                          {option.roleName}
                        </Typography>
                        {option.description && (
                          <Typography variant="caption" color="text.secondary">
                            {option.description}
                          </Typography>
                        )}
                      </Box>
                    </li>
                  )}
                />
                <Button
                  variant="contained"
                  size="small"
                  disabled={!selectedRoleId}
                  onClick={handleAssignRole}
                  sx={{ minWidth: 80 }}
                >
                  {t('common.add')}
                </Button>
              </Box>

              <Divider sx={{ mb: 1 }} />

              {/* Role List */}
              {detailRoles.length === 0 ? (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ py: 2, textAlign: 'center' }}
                >
                  {t('serviceAccounts.noRoles')}
                </Typography>
              ) : (
                <Box
                  sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}
                >
                  {detailRoles.map((ur) => (
                    <Paper
                      key={ur.id}
                      variant="outlined"
                      sx={{ px: 1.5, py: 1 }}
                    >
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            flex: 1,
                            minWidth: 0,
                          }}
                        >
                          <ShieldIcon
                            sx={{ fontSize: 16, color: 'primary.main' }}
                          />
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="body2" fontWeight={600} noWrap>
                              {ur.roleName}
                            </Typography>
                            {ur.roleDescription && (
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                noWrap
                              >
                                {ur.roleDescription}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleRemoveRole(ur.roleId)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </Paper>
                  ))}
                </Box>
              )}
            </TabPanel>
          </Box>
        </Box>
      </ResizableDrawer>

      {/* Dialogs */}
      <AccountDialog
        open={editDialog.open}
        account={editDialog.account}
        onClose={() => setEditDialog({ open: false, account: null })}
        onSave={handleSaveAccount}
      />

      <TokenDialog
        open={tokenDialog.open}
        accountId={tokenDialog.accountId}
        onClose={() => setTokenDialog({ open: false, accountId: null })}
        onCreated={() => {
          refreshDetail();
          fetchAccounts();
        }}
      />

      {deleteDialog && (
        <DeleteDialog
          open={deleteDialog.open}
          title={
            deleteDialog.type === 'account'
              ? t('serviceAccounts.deleteAccount')
              : t('serviceAccounts.deleteToken')
          }
          message={t('serviceAccounts.deleteConfirmMessage', {
            name: deleteDialog.name,
          })}
          onClose={() => setDeleteDialog(null)}
          onConfirm={handleDeleteConfirm}
        />
      )}
    </Box>
  );
};

export default ServiceAccountsPage;
