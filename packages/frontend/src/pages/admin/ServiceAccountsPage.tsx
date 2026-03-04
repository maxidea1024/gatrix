/**
 * Service Accounts Management Page
 *
 * Allows administrators to manage service accounts and their tokens.
 * Uses RBAC system for role assignment.
 */
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
  Tabs,
  Tab,
  Autocomplete,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  ContentCopy as CopyIcon,
  VpnKey as TokenIcon,
  Cancel as CancelIcon,
  Save as SaveIcon,
  Shield as ShieldIcon,
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
import { useOrgProject } from '@/contexts/OrgProjectContext';
import { formatRelativeTime, formatDateTimeDetailed } from '@/utils/dateFormat';

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
  onSave: (data: { name: string; roleIds: string[] }) => void;
}

const AccountDialog: React.FC<AccountDialogProps> = ({ open, account, onClose, onSave }) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [allRoles, setAllRoles] = useState<Role[]>([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setName(account?.name || '');
      setSelectedRoleIds([]);
      setRolesLoading(true);

      const loadData = async () => {
        try {
          const roles = await rbacService.getRoles();
          setAllRoles(roles);

          if (account) {
            const userRoles = await rbacService.getUserRoles(String(account.id));
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
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]
    );
  };

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({ name: name.trim(), roleIds: selectedRoleIds });
  };

  return (
    <ResizableDrawer
      open={open}
      onClose={onClose}
      title={account ? t('serviceAccounts.editAccount') : t('serviceAccounts.createAccount')}
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
          <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600, color: 'primary.main' }}>
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
          </Box>
        </Paper>

        {/* RBAC Role Assignment */}
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600, color: 'primary.main' }}>
            {t('rbac.roles.title')}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
            {t('serviceAccounts.roleSelectionGuide')}
          </Typography>

          {rolesLoading ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
              {t('common.loading')}
            </Typography>
          ) : allRoles.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
              {t('serviceAccounts.noRolesAvailable')}
            </Typography>
          ) : (
            <List dense disablePadding>
              {allRoles.map((role) => {
                const isSelected = selectedRoleIds.includes(role.id);
                return (
                  <ListItem
                    key={role.id}
                    sx={{
                      px: 1,
                      py: 0.5,
                      borderRadius: 1,
                      mb: 0.5,
                      cursor: 'pointer',
                      bgcolor: isSelected ? 'action.selected' : 'transparent',
                      '&:hover': { bgcolor: isSelected ? 'action.selected' : 'action.hover' },
                    }}
                    onClick={() => handleToggleRole(role.id)}
                  >
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <ShieldIcon
                            sx={{
                              fontSize: 16,
                              color: isSelected ? 'primary.main' : 'text.disabled',
                            }}
                          />
                          <Typography variant="body2" fontWeight={isSelected ? 600 : 400}>
                            {role.roleName}
                          </Typography>
                          {isSelected && (
                            <Chip label="✓" size="small" color="primary" sx={{ height: 20 }} />
                          )}
                        </Box>
                      }
                      secondary={role.description || null}
                    />
                  </ListItem>
                );
              })}
            </List>
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
        <Button onClick={onClose} startIcon={<CancelIcon />}>
          {t('common.cancel')}
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          startIcon={<SaveIcon />}
          disabled={!name.trim()}
        >
          {account ? t('common.save') : t('common.create')}
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

const TokenDialog: React.FC<TokenDialogProps> = ({ open, accountId, onClose, onCreated }) => {
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
      const result = await serviceAccountService.createToken(projectApiPath, accountId, {
        name: tokenName.trim(),
        description: description.trim() || undefined,
      });
      setCreatedToken(result.secret);
      onCreated();
      enqueueSnackbar(t('serviceAccounts.tokenCreatedSuccess'), { variant: 'success' });
    } catch {
      enqueueSnackbar(t('serviceAccounts.tokenCreateFailed'), { variant: 'error' });
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
                          enqueueSnackbar(t('common.copiedToClipboard'), { variant: 'success' }),
                        () => enqueueSnackbar(t('common.copyFailed'), { variant: 'error' })
                      )
                    }
                  >
                    <CopyIcon fontSize="small" />
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
  const [detailAccount, setDetailAccount] = useState<ServiceAccount | null>(null);
  const [detailTab, setDetailTab] = useState(0);
  const [detailTokens, setDetailTokens] = useState<ServiceAccountToken[]>([]);
  const [detailRoles, setDetailRoles] = useState<UserRole[]>([]);
  const [allRoles, setAllRoles] = useState<Role[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);

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
      await rbacService.assignUserRole(String(detailAccount.id), selectedRoleId);
      enqueueSnackbar(t('serviceAccounts.roleAssignSuccess'), { variant: 'success' });
      setSelectedRoleId(null);
      refreshDetail();
    } catch (error: any) {
      const msg = error?.response?.data?.message || t('serviceAccounts.roleAssignFailed');
      enqueueSnackbar(msg, { variant: 'error' });
    }
  };

  const handleRemoveRole = async (roleId: string) => {
    if (!detailAccount) return;
    try {
      await rbacService.removeUserRole(String(detailAccount.id), roleId);
      enqueueSnackbar(t('serviceAccounts.roleRemoveSuccess'), { variant: 'success' });
      refreshDetail();
    } catch (error: any) {
      const msg = error?.response?.data?.message || t('serviceAccounts.roleRemoveFailed');
      enqueueSnackbar(msg, { variant: 'error' });
    }
  };

  // Account CRUD
  const handleSaveAccount = async (data: { name: string; roleIds: string[] }) => {
    try {
      if (editDialog.account) {
        // Update name
        await serviceAccountService.update(projectApiPath, editDialog.account.id, {
          name: data.name,
        });

        // Sync roles: get current roles, compute adds/removes
        const currentRoles = await rbacService.getUserRoles(String(editDialog.account.id));
        const currentRoleIds = currentRoles.map((r) => r.roleId);
        const toAdd = data.roleIds.filter((id) => !currentRoleIds.includes(id));
        const toRemove = currentRoleIds.filter((id) => !data.roleIds.includes(id));

        await Promise.all([
          ...toAdd.map((roleId) =>
            rbacService.assignUserRole(String(editDialog.account!.id), roleId)
          ),
          ...toRemove.map((roleId) =>
            rbacService.removeUserRole(String(editDialog.account!.id), roleId)
          ),
        ]);

        enqueueSnackbar(t('serviceAccounts.updateSuccess'), { variant: 'success' });
      } else {
        // Create account then assign roles
        const created = await serviceAccountService.create(projectApiPath, {
          name: data.name,
        });

        if (data.roleIds.length > 0) {
          await Promise.all(
            data.roleIds.map((roleId) => rbacService.assignUserRole(String(created.id), roleId))
          );
        }

        enqueueSnackbar(t('serviceAccounts.createSuccess'), { variant: 'success' });
      }
      setEditDialog({ open: false, account: null });
      fetchAccounts();
    } catch {
      enqueueSnackbar(
        editDialog.account ? t('serviceAccounts.updateFailed') : t('serviceAccounts.createFailed'),
        { variant: 'error' }
      );
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteDialog) return;
    try {
      if (deleteDialog.type === 'account') {
        await serviceAccountService.delete(projectApiPath, deleteDialog.accountId);
        enqueueSnackbar(t('serviceAccounts.deleteSuccess'), { variant: 'success' });
      } else if (deleteDialog.tokenId) {
        await serviceAccountService.deleteToken(
          projectApiPath,
          deleteDialog.accountId,
          deleteDialog.tokenId
        );
        enqueueSnackbar(t('serviceAccounts.tokenDeleteSuccess'), { variant: 'success' });
        refreshDetail();
      }
      setDeleteDialog(null);
      fetchAccounts();
    } catch {
      enqueueSnackbar(t('serviceAccounts.deleteFailed'), { variant: 'error' });
    }
  };

  // Compute available roles (exclude already assigned)
  const availableRoles = allRoles.filter((r) => !detailRoles.some((ur) => ur.roleId === r.id));

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
          <Typography variant="h5" fontWeight="bold">
            {t('serviceAccounts.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('serviceAccounts.subtitle')}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchAccounts}>
            {t('common.refresh')}
          </Button>
          {accounts.length > 0 && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setEditDialog({ open: true, account: null })}
            >
              {t('serviceAccounts.createAccount')}
            </Button>
          )}
        </Box>
      </Box>

      {/* Content */}
      <PageContentLoader loading={loading}>
        {accounts.length === 0 ? (
          <EmptyPagePlaceholder
            message={t('serviceAccounts.noAccounts')}
            onAddClick={() => setEditDialog({ open: true, account: null })}
            addButtonLabel={t('serviceAccounts.createAccount')}
          />
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t('serviceAccounts.accountName')}</TableCell>
                  <TableCell align="center">{t('rbac.roles.title')}</TableCell>
                  <TableCell>{t('serviceAccounts.status')}</TableCell>
                  <TableCell align="center">{t('serviceAccounts.tokens')}</TableCell>
                  <TableCell>{t('serviceAccounts.createdAt')}</TableCell>
                  <TableCell align="right">{t('common.actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">{t('common.loading')}</Typography>
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
                        <Typography fontWeight="medium">{account.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {account.email}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={account.tokens?.length || '–'}
                          size="small"
                          variant="outlined"
                          icon={<ShieldIcon sx={{ fontSize: 14 }} />}
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
                          color={account.status === 'active' ? 'success' : 'default'}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={account.tokens?.length || 0}
                          size="small"
                          variant="outlined"
                          icon={<TokenIcon sx={{ fontSize: 14 }} />}
                        />
                      </TableCell>
                      <TableCell>
                        <Tooltip title={formatDateTimeDetailed(account.createdAt)}>
                          <Typography variant="body2">
                            {formatRelativeTime(account.createdAt)}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title={t('common.edit')}>
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditDialog({ open: true, account });
                            }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t('common.delete')}>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteDialog({
                                open: true,
                                type: 'account',
                                accountId: account.id,
                                name: account.name,
                              });
                            }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </PageContentLoader>

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
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
                  startIcon={<AddIcon />}
                  onClick={() =>
                    setTokenDialog({ open: true, accountId: detailAccount?.id || null })
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
                <List dense disablePadding>
                  {detailTokens.map((token) => (
                    <ListItem key={token.id} sx={{ px: 0 }}>
                      <ListItemText
                        primary={token.tokenName}
                        secondary={
                          <>
                            {token.description && `${token.description} · `}
                            <Tooltip title={formatDateTimeDetailed(token.createdAt)}>
                              <span>{formatRelativeTime(token.createdAt)}</span>
                            </Tooltip>
                            {token.expiresAt && (
                              <>
                                {` · ${t('serviceAccounts.expiresAt')}: `}
                                <Tooltip title={formatDateTimeDetailed(token.expiresAt)}>
                                  <span>{formatRelativeTime(token.expiresAt)}</span>
                                </Tooltip>
                              </>
                            )}
                          </>
                        }
                      />
                      <ListItemSecondaryAction>
                        <IconButton
                          edge="end"
                          size="small"
                          color="error"
                          onClick={() => {
                            if (detailAccount) {
                              setDeleteDialog({
                                open: true,
                                type: 'token',
                                accountId: detailAccount.id,
                                tokenId: token.id,
                                name: token.tokenName,
                              });
                            }
                          }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
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
                  value={availableRoles.find((r) => r.id === selectedRoleId) || null}
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
                        <Typography variant="body2">{option.roleName}</Typography>
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
                <List dense disablePadding>
                  {detailRoles.map((ur) => (
                    <ListItem key={ur.id} sx={{ px: 0 }}>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <ShieldIcon sx={{ fontSize: 16, color: 'primary.main' }} />
                            <Typography variant="body2" fontWeight="medium">
                              {ur.roleName}
                            </Typography>
                          </Box>
                        }
                        secondary={ur.roleDescription || null}
                      />
                      <ListItemSecondaryAction>
                        <IconButton
                          edge="end"
                          size="small"
                          color="error"
                          onClick={() => handleRemoveRole(ur.roleId)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
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
          message={t('serviceAccounts.deleteConfirmMessage', { name: deleteDialog.name })}
          onClose={() => setDeleteDialog(null)}
          onConfirm={handleDeleteConfirm}
        />
      )}
    </Box>
  );
};

export default ServiceAccountsPage;
