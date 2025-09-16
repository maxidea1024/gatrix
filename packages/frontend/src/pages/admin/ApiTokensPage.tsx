import React, { useState, useEffect, useRef } from 'react';
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
  TextField,
  FormControl,
  FormLabel,
  RadioGroup,
  Radio,
  FormControlLabel,
  Alert,
  Tooltip,
  Drawer,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  ContentCopy as CopyIcon,
  VpnKey as VpnKeyIcon,
  Refresh as RefreshIcon,
  Cancel as CancelIcon,
  Save as SaveIcon,
  Close as CloseIcon,
  CheckCircle as CheckCircleIcon,
  Security as SecurityIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { ApiAccessToken, TokenType } from '@/types/apiToken';
import { apiTokenService } from '@/services/apiTokenService';
import SimplePagination from '@/components/common/SimplePagination';
import EmptyTableRow from '@/components/common/EmptyTableRow';
import { formatDateTimeDetailed } from '@/utils/dateFormat';

interface CreateTokenData {
  tokenName: string;
  description?: string;
  tokenType: TokenType;
  environmentId?: number;
  expiresAt?: string;
}

const ApiTokensPage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [tokens, setTokens] = useState<ApiAccessToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  
  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [regenerateDialogOpen, setRegenerateDialogOpen] = useState(false);
  const [selectedToken, setSelectedToken] = useState<ApiAccessToken | null>(null);
  
  // Form states
  const [formData, setFormData] = useState<CreateTokenData>({
    tokenName: '',
    description: '',
    tokenType: 'client',
    environmentId: 1,
  });
  
  // UI states
  const [visibleTokens, setVisibleTokens] = useState<Set<number>>(new Set());
  const [newTokenValue, setNewTokenValue] = useState<string>('');
  const [newTokenInfo, setNewTokenInfo] = useState<any>(null);
  const [newTokenDialogOpen, setNewTokenDialogOpen] = useState<boolean>(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState<string>('');

  // Refs for focus management
  const tokenNameRef = useRef<HTMLInputElement>(null);
  const editTokenNameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadTokens();
  }, [page, rowsPerPage]);

  const loadTokens = async () => {
    try {
      setLoading(true);
      const response = await apiTokenService.getTokens({
        page: page + 1,
        limit: rowsPerPage,
      });
      setTokens(response.data || []);
      setTotal(response.total || 0);
    } catch (error) {
      console.error('Failed to load tokens:', error);
      enqueueSnackbar(t('apiTokens.loadFailed', 'Failed to load API tokens'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };



  const handleCreate = async () => {
    try {
      const response = await apiTokenService.createToken(formData);
      // 토큰 정보를 먼저 설정
      const tokenInfo = {
        tokenName: formData.tokenName,
        description: formData.description,
        tokenType: formData.tokenType,
        expiresAt: formData.expiresAt,
        isNew: true
      };

      // 생성 다이얼로그를 먼저 닫기
      setCreateDialogOpen(false);
      resetForm();

      // 토큰 정보 설정과 다이얼로그 표시를 동시에
      setNewTokenValue(response.tokenValue);
      setNewTokenInfo(tokenInfo);
      setNewTokenDialogOpen(true);

      // 토큰 목록은 백그라운드에서 새로고침 (await 제거)
      loadTokens().catch(console.error);

      enqueueSnackbar(t('apiTokens.createSuccess', 'API token created successfully'), { variant: 'success' });
    } catch (error: any) {
      console.error('Failed to create token:', error);
      enqueueSnackbar(error.message || t('apiTokens.createFailed', 'Failed to create API token'), { variant: 'error' });
    }
  };

  const handleEdit = async () => {
    if (!selectedToken) return;
    
    try {
      await apiTokenService.updateToken(selectedToken.id, {
        tokenName: formData.tokenName,
        expiresAt: formData.expiresAt,
      });
      await loadTokens();
      setEditDialogOpen(false);
      setSelectedToken(null);
      resetForm();
      enqueueSnackbar(t('apiTokens.updateSuccess', 'API token updated successfully'), { variant: 'success' });
    } catch (error: any) {
      console.error('Failed to update token:', error);
      enqueueSnackbar(error.message || t('apiTokens.updateFailed', 'Failed to update API token'), { variant: 'error' });
    }
  };

  const handleDelete = async () => {
    if (!selectedToken) return;

    // Check if the confirmation text matches the token name
    if (deleteConfirmText !== selectedToken.tokenName) {
      enqueueSnackbar(t('apiTokens.deleteConfirmMismatch', 'Token name does not match. Please type the exact token name to confirm deletion.'), { variant: 'error' });
      return;
    }

    try {
      await apiTokenService.deleteToken(selectedToken.id);
      await loadTokens();
      setDeleteDialogOpen(false);
      setSelectedToken(null);
      setDeleteConfirmText('');
      enqueueSnackbar(t('apiTokens.deleteSuccess', 'API token deleted successfully'), { variant: 'success' });
    } catch (error: any) {
      console.error('Failed to delete token:', error);
      enqueueSnackbar(error.message || t('apiTokens.deleteFailed', 'Failed to delete API token'), { variant: 'error' });
    }
  };

  const handleRegenerate = async () => {
    if (!selectedToken) return;

    try {
      const response = await apiTokenService.regenerateToken(selectedToken.id);
      setNewTokenValue(response.data.tokenValue);
      setNewTokenInfo({
        tokenName: selectedToken.tokenName,
        description: selectedToken.description,
        tokenType: selectedToken.tokenType,
        expiresAt: selectedToken.expiresAt,
        isNew: false
      });
      setNewTokenDialogOpen(true);
      setRegenerateDialogOpen(false);
      setSelectedToken(null);
      loadTokens();
      enqueueSnackbar(t('apiTokens.regenerateSuccess', 'API token regenerated successfully'), { variant: 'success' });
    } catch (error: any) {
      console.error('Failed to regenerate token:', error);
      enqueueSnackbar(error.message || t('apiTokens.regenerateFailed', 'Failed to regenerate API token'), { variant: 'error' });
    }
  };

  const resetForm = () => {
    setFormData({
      tokenName: '',
      description: '',
      tokenType: 'client',
      environmentId: 1,
    });
  };

  const openCreateDialog = () => {
    resetForm();
    setCreateDialogOpen(true);
    // Focus on token name field after dialog opens
    setTimeout(() => {
      tokenNameRef.current?.focus();
    }, 100);
  };

  const openEditDialog = (token: ApiAccessToken) => {
    setSelectedToken(token);
    setFormData({
      tokenName: token.tokenName,
      tokenType: token.tokenType,
      environmentId: token.environmentId,
      expiresAt: token.expiresAt ? new Date(token.expiresAt).toISOString().slice(0, 16) : undefined,
    });
    setEditDialogOpen(true);
    // Focus on token name field after dialog opens
    setTimeout(() => {
      editTokenNameRef.current?.focus();
    }, 100);
  };

  const openDeleteDialog = (token: ApiAccessToken) => {
    setSelectedToken(token);
    setDeleteConfirmText('');
    setDeleteDialogOpen(true);
  };

  const toggleTokenVisibility = (tokenId: number) => {
    setVisibleTokens(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tokenId)) {
        newSet.delete(tokenId);
      } else {
        newSet.add(tokenId);
      }
      return newSet;
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    enqueueSnackbar(t('apiTokens.tokenCopied', 'Token copied to clipboard'), { variant: 'success' });
  };

  const maskToken = (token: string) => {
    if (!token || token.length < 8) return token;
    return `${token.substring(0, 4)}${'•'.repeat(token.length - 8)}${token.substring(token.length - 4)}`;
  };

  const formatTokenValue = (token: ApiAccessToken) => {
    const isVisible = visibleTokens.has(token.id);
    if (isVisible) {
      return token.tokenHash.slice(0, 8) + '...';
    }
    return '••••••••••••••••';
  };

  const getTokenTypeColor = (type: TokenType) => {
    switch (type) {
      case 'admin': return 'error';
      case 'server': return 'warning';
      case 'client': return 'primary';
      default: return 'default';
    }
  };



  return (
    <>
      <Box sx={{ p: 3 }}>
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="h4" sx={{ fontWeight: 600 }}>
              {t('apiTokens.title', 'API Access Tokens')}
            </Typography>
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}>
              {t('apiTokens.createToken', 'Create Token')}
            </Button>
          </Box>
          <Typography variant="body1" color="text.secondary">
            {t('apiTokens.subtitle', 'Manage API access tokens for external integrations and services')}
          </Typography>
        </Box>



      {/* Tokens Table */}
      <Paper sx={{ width: '100%', overflow: 'hidden' }}>
        <TableContainer>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>{t('apiTokens.tokenName', 'Token Name')}</TableCell>
                <TableCell>{t('apiTokens.description', 'Description')}</TableCell>
                <TableCell>{t('apiTokens.tokenType', 'Type')}</TableCell>
                <TableCell>{t('apiTokens.tokenValue', 'Token Value')}</TableCell>
                <TableCell>{t('apiTokens.lastUsed', 'Last Used')}</TableCell>
                <TableCell>{t('apiTokens.expiresAt', 'Expires')}</TableCell>
                <TableCell>{t('apiTokens.status', 'Status')}</TableCell>
                <TableCell align="center">{t('common.actions', 'Actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <EmptyTableRow colSpan={9} message={t('common.loading', 'Loading...')} />
              ) : !tokens || tokens.length === 0 ? (
                <EmptyTableRow
                  colSpan={9}
                  message={t('apiTokens.noTokens', 'No API tokens found')}
                  action={
                    <Button variant="outlined" startIcon={<AddIcon />} onClick={openCreateDialog}>
                      {t('apiTokens.createFirstToken', 'Create your first token')}
                    </Button>
                  }
                />
              ) : (
                tokens.map((token) => (
                  <TableRow key={token.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>
                        {token.tokenName}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {token.description || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={token.tokenType}
                        color={getTokenTypeColor(token.tokenType)}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" fontFamily="monospace">
                          {formatTokenValue(token)}
                        </Typography>
                        <Tooltip title={visibleTokens.has(token.id) ? t('apiTokens.hideToken', 'Hide Token') : t('apiTokens.showToken', 'Show Token')}>
                          <IconButton
                            size="small"
                            onClick={() => toggleTokenVisibility(token.id)}
                          >
                            {visibleTokens.has(token.id) ? <VisibilityOffIcon /> : <VisibilityIcon />}
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t('apiTokens.regenerateToken', 'Regenerate Token')}>
                          <IconButton
                            size="small"
                            onClick={() => {
                              setSelectedToken(token);
                              setRegenerateDialogOpen(true);
                            }}
                          >
                            <RefreshIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {token.lastUsedAt
                          ? formatDateTimeDetailed(token.lastUsedAt)
                          : t('apiTokens.neverUsed', 'Never')
                        }
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {token.expiresAt
                          ? formatDateTimeDetailed(token.expiresAt)
                          : t('apiTokens.noExpiration', 'No Expiration')
                        }
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={token.isActive ? t('common.active', 'Active') : t('common.inactive', 'Inactive')}
                        color={token.isActive ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Tooltip title={t('common.edit', 'Edit')}>
                          <IconButton size="small" onClick={() => openEditDialog(token)}>
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t('common.delete', 'Delete')}>
                          <IconButton size="small" onClick={() => openDeleteDialog(token)}>
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination */}
        {!loading && tokens.length > 0 && (
          <SimplePagination
            count={total}
            page={page}
            rowsPerPage={rowsPerPage}
            onPageChange={(_, newPage) => setPage(newPage)}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={[5, 10, 25, 50]}
          />
        )}
      </Paper>
    </Box>

      {/* Create Token Side Panel */}
      <Drawer
        anchor="right"
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: 400 },
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 1300 // Ensure it's above the sticky header
          }
        }}
        ModalProps={{
          keepMounted: false,
          sx: {
            zIndex: 1300 // Ensure modal backdrop is also above header
          }
        }}
      >
        {/* Header */}
        <Box sx={{
          p: 3,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'background.paper',
          position: 'sticky',
          top: 0,
          zIndex: 1
        }}>
          <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
            {t('apiTokens.createToken', 'Create API Token')}
          </Typography>
          <IconButton
            onClick={() => setCreateDialogOpen(false)}
            size="small"
            sx={{
              '&:hover': {
                backgroundColor: 'action.hover'
              }
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Content */}
        <Box sx={{
          flex: 1,
          p: 3,
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 2
        }}>
          <TextField
              inputRef={tokenNameRef}
              label={t('apiTokens.tokenName', 'Token Name')}
              value={formData.tokenName}
              onChange={(e) => setFormData(prev => ({ ...prev, tokenName: e.target.value }))}
              fullWidth
              required
              size="small"
            />

            <TextField
              label={t('apiTokens.description', 'Description')}
              value={formData.description || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              fullWidth
              multiline
              rows={2}
              size="small"
              placeholder={t('apiTokens.descriptionPlaceholder', 'Optional description for this token')}
            />

            <FormControl component="fieldset" fullWidth>
              <FormLabel component="legend" sx={{ mb: 1, fontSize: '0.875rem', fontWeight: 500 }}>
                {t('apiTokens.tokenTypeDescription', 'Select a token type')}
              </FormLabel>
              <RadioGroup
                value={formData.tokenType}
                onChange={(e) => setFormData(prev => ({ ...prev, tokenType: e.target.value as TokenType }))}
              >
                <FormControlLabel
                  value="client"
                  control={<Radio size="small" />}
                  label={
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {t('apiTokens.clientTokenType', 'Client Token')}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t('apiTokens.clientTokenDescription', 'Token for client applications to read remote configurations. Has read-only permissions.')}
                      </Typography>
                    </Box>
                  }
                />
                <FormControlLabel
                  value="server"
                  control={<Radio size="small" />}
                  label={
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {t('apiTokens.serverTokenType', 'Server Token')}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t('apiTokens.serverTokenDescription', 'Token for server applications to read and evaluate remote configurations. Has access to advanced features.')}
                      </Typography>
                    </Box>
                  }
                />
              </RadioGroup>
            </FormControl>

            <TextField
              label={t('apiTokens.expiresAt', 'Expires At')}
              type="datetime-local"
              value={formData.expiresAt || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, expiresAt: e.target.value }))}
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
              helperText={t('apiTokens.expiresAtHelp', 'Leave empty for no expiration')}
            />
        </Box>

        {/* Actions */}
        <Box sx={{
          p: 3,
          borderTop: 1,
          borderColor: 'divider',
          display: 'flex',
          gap: 2,
          justifyContent: 'flex-end'
        }}>
          <Button
            onClick={() => setCreateDialogOpen(false)}
            startIcon={<CancelIcon />}
            size="small"
          >
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            onClick={handleCreate}
            variant="contained"
            startIcon={<VpnKeyIcon />}
            size="small"
          >
            {t('apiTokens.createToken', 'Create Token')}
          </Button>
        </Box>
      </Drawer>

      {/* Edit Token Side Panel */}
      <Drawer
        anchor="right"
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: 400 },
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 1300 // Ensure it's above the sticky header
          }
        }}
        ModalProps={{
          keepMounted: false,
          sx: {
            zIndex: 1300 // Ensure modal backdrop is also above header
          }
        }}
      >
        {/* Header */}
        <Box sx={{
          p: 3,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'background.paper',
          position: 'sticky',
          top: 0,
          zIndex: 1
        }}>
          <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
            {t('apiTokens.editToken', 'Edit API Token')}
          </Typography>
          <IconButton
            onClick={() => setEditDialogOpen(false)}
            size="small"
            sx={{
              '&:hover': {
                backgroundColor: 'action.hover'
              }
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Content */}
        <Box sx={{
          flex: 1,
          p: 3,
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 2
        }}>
            <TextField
              inputRef={editTokenNameRef}
              label={t('apiTokens.tokenName', 'Token Name')}
              value={formData.tokenName}
              onChange={(e) => setFormData(prev => ({ ...prev, tokenName: e.target.value }))}
              fullWidth
              required
              size="small"
            />

            <TextField
              label={t('apiTokens.tokenType', 'Token Type')}
              value={t(`apiTokens.${formData.tokenType}TokenType`, formData.tokenType)}
              fullWidth
              size="small"
              disabled
              helperText={t('apiTokens.tokenTypeNotEditable', 'Token type cannot be changed after creation')}
            />

            <TextField
              label={t('apiTokens.expiresAt', 'Expires At')}
              type="datetime-local"
              value={formData.expiresAt || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, expiresAt: e.target.value }))}
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
              helperText={t('apiTokens.expiresAtHelp', 'Leave empty for no expiration')}
            />
        </Box>

        {/* Actions */}
        <Box sx={{
          p: 3,
          borderTop: 1,
          borderColor: 'divider',
          display: 'flex',
          gap: 2,
          justifyContent: 'flex-end'
        }}>
          <Button
            onClick={() => setEditDialogOpen(false)}
            startIcon={<CancelIcon />}
            size="small"
          >
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            onClick={handleEdit}
            variant="contained"
            startIcon={<SaveIcon />}
            size="small"
          >
            {t('common.save', 'Save')}
          </Button>
        </Box>
      </Drawer>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('apiTokens.deleteToken', 'Delete API Token')}</DialogTitle>
        <DialogContent>
          <Alert severity="error" sx={{ mb: 2 }}>
            {t('apiTokens.deleteWarning', 'This action cannot be undone. The token will be permanently deleted.')}
          </Alert>

          <Typography sx={{ mb: 2 }}>
            {t('apiTokens.deleteConfirmation', 'Are you sure you want to delete this API token?')}
          </Typography>

          {selectedToken && (
            <>
              <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
                <Typography variant="body2" fontWeight={500}>
                  {selectedToken.tokenName}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t(`apiTokens.${selectedToken.tokenType}TokenType`, selectedToken.tokenType)}
                </Typography>
              </Box>

              <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                {t('apiTokens.deleteConfirmInstruction', 'To confirm deletion, please type the token name:')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                <strong>{selectedToken.tokenName}</strong>
              </Typography>

              <TextField
                fullWidth
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={t('apiTokens.deleteConfirmPlaceholder', 'Type token name here...')}
                size="small"
                error={deleteConfirmText.length > 0 && deleteConfirmText !== selectedToken.tokenName}
                helperText={
                  deleteConfirmText.length > 0 && deleteConfirmText !== selectedToken.tokenName
                    ? t('apiTokens.deleteConfirmMismatch', 'Token name does not match')
                    : ''
                }
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            onClick={handleDelete}
            variant="contained"
            color="error"
            disabled={!selectedToken || deleteConfirmText !== selectedToken.tokenName}
          >
            {t('common.delete', 'Delete')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Regenerate Confirmation Dialog */}
      <Dialog open={regenerateDialogOpen} onClose={() => setRegenerateDialogOpen(false)}>
        <DialogTitle>{t('apiTokens.regenerateToken', 'Regenerate API Token')}</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            {t('apiTokens.regenerateWarning', 'This will generate a new token value. The old token will become invalid immediately.')}
          </Alert>
          <Typography>
            {t('apiTokens.regenerateConfirmation', 'Are you sure you want to regenerate this API token?')}
          </Typography>
          {selectedToken && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
              <Typography variant="body2" fontWeight={500}>
                {selectedToken.tokenName}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t(`apiTokens.${selectedToken.tokenType}TokenType`, selectedToken.tokenType)}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRegenerateDialogOpen(false)}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button onClick={handleRegenerate} color="primary" variant="contained">
            {t('apiTokens.regenerate', 'Regenerate')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* New Token Display Dialog */}
      <Dialog open={newTokenDialogOpen && !!newTokenValue && !!newTokenInfo} onClose={() => { setNewTokenValue(''); setNewTokenInfo(null); setNewTokenDialogOpen(false); }} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ pb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <CheckCircleIcon color="success" sx={{ fontSize: 32 }} />
              <Box>
                <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
                  {newTokenInfo?.isNew
                    ? t('apiTokens.tokenCreated', 'API Token Created')
                    : t('apiTokens.tokenRegenerated', 'API Token Regenerated')
                  }
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('apiTokens.tokenReady', 'Your API token is ready to use')}
                </Typography>
              </Box>
            </Box>
          </DialogTitle>
          <DialogContent sx={{ pt: 2 }}>
            {/* Security Notice */}
            <Alert
              severity="error"
              icon={<SecurityIcon />}
              sx={{
                mb: 3,
                '& .MuiAlert-message': { fontWeight: 500 }
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                {t('apiTokens.tokenWarning', 'Please copy this token now. You won\'t be able to see it again!')}
              </Typography>
              <Typography variant="body2">
                {t('apiTokens.tokenSecurityNotice', 'For security reasons, this token value cannot be viewed again. Please copy it now and store it in a safe place.')}
              </Typography>
            </Alert>

            {/* Token Summary */}
            {newTokenInfo && (
              <Box sx={{
                mb: 3,
                p: 3,
                bgcolor: 'background.paper',
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: 'primary.main' }}>
                  {t('apiTokens.tokenSummary', 'Token Summary')}
                </Typography>
                <Box sx={{ display: 'grid', gap: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                      {t('apiTokens.tokenName', 'Token Name')}
                    </Typography>
                    <Chip label={newTokenInfo.tokenName} variant="outlined" size="small" />
                  </Box>
                  {newTokenInfo.description && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                        {t('apiTokens.description', 'Description')}
                      </Typography>
                      <Typography variant="body2" fontWeight={500} sx={{ maxWidth: '60%', textAlign: 'right' }}>
                        {newTokenInfo.description}
                      </Typography>
                    </Box>
                  )}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                      {t('apiTokens.tokenType', 'Type')}
                    </Typography>
                    <Chip
                      label={t(`apiTokens.types.${newTokenInfo.tokenType}`, newTokenInfo.tokenType)}
                      color="primary"
                      size="small"
                    />
                  </Box>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                      {t('apiTokens.expiresAt', 'Expires')}
                    </Typography>
                    <Typography variant="body2" fontWeight={500}>
                      {newTokenInfo.expiresAt
                        ? formatDateTimeDetailed(newTokenInfo.expiresAt)
                        : t('apiTokens.noExpiration', 'No Expiration')
                      }
                    </Typography>
                  </Box>
                </Box>
              </Box>
            )}

            {/* Token Value */}
            {newTokenValue && (
              <Box sx={{
                p: 2,
                bgcolor: 'grey.50',
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider'
              }}>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                  {t('apiTokens.tokenValue', 'Token Value')}
                </Typography>

                {/* Token Display with Copy Button */}
                <Box sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  p: 1.5,
                  bgcolor: 'background.paper',
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: 'divider'
                }}>
                  <Typography
                    variant="body2"
                    fontFamily="monospace"
                    sx={{
                      flex: 1,
                      fontSize: '0.875rem',
                      letterSpacing: '0.5px',
                      color: 'text.primary'
                    }}
                  >
                    {maskToken(newTokenValue)}
                  </Typography>
                  <Tooltip title={t('apiTokens.copyTokenValue', 'Copy Token Value')}>
                    <IconButton
                      onClick={() => copyToClipboard(newTokenValue)}
                      size="small"
                      color="primary"
                    >
                      <CopyIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
            )}
          </DialogContent>
          <DialogActions sx={{ p: 3, pt: 2 }}>
            <Button
              onClick={() => { setNewTokenValue(''); setNewTokenInfo(null); setNewTokenDialogOpen(false); }}
              variant="contained"
              startIcon={<CheckCircleIcon />}
              size="large"
              sx={{
                px: 4,
                py: 1.5,
                fontWeight: 600,
                textTransform: 'none',
                fontSize: '1rem'
              }}
            >
              {t('apiTokens.confirmAndClose', 'Confirm & Close')}
            </Button>
          </DialogActions>
        </Dialog>
    </>
  );
};

export default ApiTokensPage;
