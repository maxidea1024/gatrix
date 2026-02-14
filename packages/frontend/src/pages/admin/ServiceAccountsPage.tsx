/**
 * Service Accounts Management Page
 *
 * Allows administrators to manage service accounts and their tokens.
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
  Collapse,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  ContentCopy as CopyIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  VpnKey as TokenIcon,
  ManageAccounts as AccountIcon,
  Cancel as CancelIcon,
  Save as SaveIcon,
  Security as SecurityIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { enqueueSnackbar } from 'notistack';
import serviceAccountService, {
  ServiceAccount,
  ServiceAccountToken,
} from '@/services/serviceAccountService';
import { copyToClipboardWithNotification } from '@/utils/clipboard';
import EmptyPlaceholder from '@/components/common/EmptyPlaceholder';
import ResizableDrawer from '@/components/common/ResizableDrawer';
import PermissionSelector from '@/components/common/PermissionSelector';
import { useEnvironments } from '@/contexts/EnvironmentContext';
import { Permission } from '@/types';

// ==================== Create/Edit Dialog ====================
interface AccountDialogProps {
  open: boolean;
  account: ServiceAccount | null;
  onClose: () => void;
  onSave: (data: {
    name: string;
    role: string;
    permissions: string[];
    allowAllEnvironments: boolean;
    environments: string[];
  }) => void;
}

const AccountDialog: React.FC<AccountDialogProps> = ({ open, account, onClose, onSave }) => {
  const { t } = useTranslation();
  const { environments } = useEnvironments();
  const [name, setName] = useState('');
  const [role, setRole] = useState('user');
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [allowAllEnvs, setAllowAllEnvs] = useState(false);
  const [selectedEnvs, setSelectedEnvs] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      if (account) {
        setName(account.name);
        setRole(account.role || 'user');
        setPermissions((account.permissions || []) as Permission[]);
        setAllowAllEnvs(account.allowAllEnvironments || false);
        setSelectedEnvs(account.environments || []);
      } else {
        setName('');
        setRole('user');
        setPermissions([]);
        setAllowAllEnvs(false);
        setSelectedEnvs([]);
      }
    }
  }, [account, open]);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      role,
      permissions: permissions as string[],
      allowAllEnvironments: allowAllEnvs,
      environments: selectedEnvs,
    });
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

            <FormControl fullWidth size="small">
              <InputLabel id="role-select-label">{t('users.role')}</InputLabel>
              <Select
                labelId="role-select-label"
                value={role}
                label={t('users.role')}
                onChange={(e) => setRole(e.target.value)}
              >
                <MenuItem value="user">{t('users.roles.user')}</MenuItem>
                <MenuItem value="admin">{t('users.roles.admin')}</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </Paper>

        {/* Permissions & Environment Access */}
        <Box>
          <PermissionSelector
            permissions={permissions}
            onChange={setPermissions}
            showEnvironments={true}
            environments={environments.map((env) => ({
              id: env.environment,
              environment: env.environment,
              name: env.environmentName,
              displayName: env.displayName,
              environmentName: env.environmentName,
            }))}
            allowAllEnvs={allowAllEnvs}
            selectedEnvironments={selectedEnvs}
            onAllowAllEnvsChange={setAllowAllEnvs}
            onEnvironmentsChange={setSelectedEnvs}
          />
        </Box>
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
      const result = await serviceAccountService.createToken(accountId, {
        name: tokenName.trim(),
        description: description.trim() || undefined,
      });
      setCreatedToken(result.secret);
      onCreated();
      enqueueSnackbar(t('serviceAccounts.tokenCreatedSuccess'), { variant: 'success' });
    } catch (error) {
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
  const [accounts, setAccounts] = useState<ServiceAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [accountTokens, setAccountTokens] = useState<Record<number, ServiceAccountToken[]>>({});

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

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await serviceAccountService.getAll();
      setAccounts(data);
    } catch (error) {
      enqueueSnackbar(t('serviceAccounts.loadFailed'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const fetchTokens = useCallback(
    async (accountId: number) => {
      try {
        const account = await serviceAccountService.getById(accountId);
        if (account.tokens) {
          setAccountTokens((prev) => ({ ...prev, [accountId]: account.tokens! }));
        }
      } catch (error) {
        enqueueSnackbar(t('serviceAccounts.tokenLoadFailed'), { variant: 'error' });
      }
    },
    [t]
  );

  const handleExpand = (id: number) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      fetchTokens(id);
    }
  };

  const handleSaveAccount = async (data: {
    name: string;
    role: string;
    permissions: string[];
    allowAllEnvironments: boolean;
    environments: string[];
  }) => {
    try {
      if (editDialog.account) {
        await serviceAccountService.update(editDialog.account.id, data);
        enqueueSnackbar(t('serviceAccounts.updateSuccess'), { variant: 'success' });
      } else {
        await serviceAccountService.create(data);
        enqueueSnackbar(t('serviceAccounts.createSuccess'), { variant: 'success' });
      }
      setEditDialog({ open: false, account: null });
      fetchAccounts();
    } catch (error) {
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
        await serviceAccountService.delete(deleteDialog.accountId);
        enqueueSnackbar(t('serviceAccounts.deleteSuccess'), { variant: 'success' });
      } else if (deleteDialog.tokenId) {
        await serviceAccountService.deleteToken(deleteDialog.accountId, deleteDialog.tokenId);
        enqueueSnackbar(t('serviceAccounts.tokenDeleteSuccess'), { variant: 'success' });
        fetchTokens(deleteDialog.accountId);
      }
      setDeleteDialog(null);
      fetchAccounts();
    } catch (error) {
      enqueueSnackbar(t('serviceAccounts.deleteFailed'), { variant: 'error' });
    }
  };

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
      {!loading && accounts.length === 0 ? (
        <EmptyPlaceholder
          message={t('serviceAccounts.noAccounts')}
          onAddClick={() => setEditDialog({ open: true, account: null })}
          addButtonLabel={t('serviceAccounts.createAccount')}
        />
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell width={40} />
                <TableCell>{t('serviceAccounts.accountName')}</TableCell>
                <TableCell>{t('users.role')}</TableCell>
                <TableCell align="center">{t('users.permissions')}</TableCell>
                <TableCell>{t('serviceAccounts.status')}</TableCell>
                <TableCell align="center">{t('serviceAccounts.tokens')}</TableCell>
                <TableCell>{t('serviceAccounts.createdAt')}</TableCell>
                <TableCell align="right">{t('common.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">{t('common.loading')}</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                accounts.map((account) => (
                  <React.Fragment key={account.id}>
                    <TableRow
                      hover
                      sx={{
                        '& > td': {
                          borderBottom: expandedId === account.id ? 'none' : undefined,
                        },
                      }}
                    >
                      <TableCell>
                        <IconButton size="small" onClick={() => handleExpand(account.id)}>
                          {expandedId === account.id ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </IconButton>
                      </TableCell>
                      <TableCell>
                        <Typography fontWeight="medium">{account.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {account.email}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Tooltip title={t(`users.roles.${account.role || 'user'}`)}>
                          <Chip
                            icon={
                              account.role === 'admin' ? (
                                <SecurityIcon sx={{ fontSize: '14px !important' }} />
                              ) : (
                                <PersonIcon sx={{ fontSize: '14px !important' }} />
                              )
                            }
                            label={t(`users.roles.${account.role || 'user'}`)}
                            size="small"
                            color={account.role === 'admin' ? 'primary' : 'secondary'}
                            variant="outlined"
                          />
                        </Tooltip>
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip
                          title={
                            account.permissions?.length ? (
                              <Box sx={{ p: 0.5 }}>
                                {account.permissions.map((p) => (
                                  <Typography key={p} variant="caption" sx={{ display: 'block' }}>
                                    • {t(`permissions.${p.replace('.', '_')}`)}
                                  </Typography>
                                ))}
                              </Box>
                            ) : (
                              t('users.noPermissionsAssigned')
                            )
                          }
                        >
                          <Chip
                            label={account.permissions?.length || 0}
                            size="small"
                            variant="outlined"
                          />
                        </Tooltip>
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
                        <Typography variant="body2">
                          {new Date(account.createdAt).toLocaleDateString()}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title={t('serviceAccounts.createToken')}>
                          <IconButton
                            size="small"
                            onClick={() => setTokenDialog({ open: true, accountId: account.id })}
                          >
                            <TokenIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t('common.edit')}>
                          <IconButton
                            size="small"
                            onClick={() => setEditDialog({ open: true, account })}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t('common.delete')}>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() =>
                              setDeleteDialog({
                                open: true,
                                type: 'account',
                                accountId: account.id,
                                name: account.name,
                              })
                            }
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>

                    {/* Expanded Token List */}
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        sx={{
                          py: 0,
                          borderBottom: expandedId === account.id ? undefined : 'none',
                        }}
                      >
                        <Collapse in={expandedId === account.id}>
                          <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1, my: 1 }}>
                            <Box
                              sx={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                mb: 1,
                              }}
                            >
                              <Typography variant="subtitle2">
                                {t('serviceAccounts.tokensFor', { name: account.name })}
                              </Typography>
                              <Button
                                size="small"
                                startIcon={<AddIcon />}
                                onClick={() =>
                                  setTokenDialog({ open: true, accountId: account.id })
                                }
                              >
                                {t('serviceAccounts.addToken')}
                              </Button>
                            </Box>
                            <Divider sx={{ mb: 1 }} />
                            {!accountTokens[account.id] ||
                            accountTokens[account.id].length === 0 ? (
                              <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                                {t('serviceAccounts.noTokens')}
                              </Typography>
                            ) : (
                              <List dense disablePadding>
                                {accountTokens[account.id].map((token) => (
                                  <ListItem key={token.id} sx={{ px: 0 }}>
                                    <ListItemText
                                      primary={token.tokenName}
                                      secondary={
                                        <>
                                          {token.description && `${token.description} · `}
                                          {new Date(token.createdAt).toLocaleDateString()}
                                          {token.expiresAt &&
                                            ` · ${t('serviceAccounts.expiresAt')}: ${new Date(
                                              token.expiresAt
                                            ).toLocaleDateString()}`}
                                        </>
                                      }
                                    />
                                    <ListItemSecondaryAction>
                                      <IconButton
                                        edge="end"
                                        size="small"
                                        color="error"
                                        onClick={() =>
                                          setDeleteDialog({
                                            open: true,
                                            type: 'token',
                                            accountId: account.id,
                                            tokenId: token.id,
                                            name: token.tokenName,
                                          })
                                        }
                                      >
                                        <DeleteIcon fontSize="small" />
                                      </IconButton>
                                    </ListItemSecondaryAction>
                                  </ListItem>
                                ))}
                              </List>
                            )}
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

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
          if (tokenDialog.accountId) {
            fetchTokens(tokenDialog.accountId);
          }
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
