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
  TableSortLabel,
  IconButton,
  Chip,
  TextField,
  FormControl,
  FormLabel,
  RadioGroup,
  Radio,
  FormControlLabel,
  Checkbox,
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
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
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
  const [newTokenValue, setNewTokenValue] = useState<string>('');
  const [newTokenInfo, setNewTokenInfo] = useState<any>(null);
  const [newTokenDialogOpen, setNewTokenDialogOpen] = useState<boolean>(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState<string>('');

  // Bulk selection states
  const [selectedTokenIds, setSelectedTokenIds] = useState<number[]>([]);
  const [selectAll, setSelectAll] = useState<boolean>(false);

  // Bulk delete states
  const [bulkDeleteDrawerOpen, setBulkDeleteDrawerOpen] = useState<boolean>(false);
  const [bulkDeleteConfirmText, setBulkDeleteConfirmText] = useState<string>('');

  // Regenerate confirmation state
  const [regenerateConfirmText, setRegenerateConfirmText] = useState<string>('');

  // Refs for focus management
  const tokenNameRef = useRef<HTMLInputElement>(null);
  const editTokenNameRef = useRef<HTMLInputElement>(null);
  const regenerateConfirmRef = useRef<HTMLInputElement>(null);
  const regenerateConfirmInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadTokens();
  }, [page, rowsPerPage, sortBy, sortOrder]);

  const loadTokens = async () => {
    try {
      setLoading(true);
      const response = await apiTokenService.getTokens({
        page: page + 1,
        limit: rowsPerPage,
        sortBy,
        sortOrder,
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

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setPage(0); // Reset to first page when sorting
  };

  // 토큰 이름 유효성 검사
  const isValidTokenName = (name: string): boolean => {
    return name.trim().length >= 3; // 최소 3자 이상
  };

  const handleCreate = async () => {
    try {
      const response = await apiTokenService.createToken(formData);
      console.log('Create token response:', response); // 디버깅용

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

      // 백엔드 응답 구조 확인 및 토큰 값 추출
      const tokenValue = response?.data?.tokenValue || response?.tokenValue || '';
      console.log('Create response structure:', response); // 디버깅용
      console.log('Extracted token value:', tokenValue); // 디버깅용

      // 상태를 순서대로 설정하여 다이얼로그가 확실히 열리도록 함
      setNewTokenInfo(tokenInfo);
      setNewTokenValue(tokenValue);

      // 다음 렌더링 사이클에서 다이얼로그 열기
      setTimeout(() => {
        setNewTokenDialogOpen(true);
      }, 0);

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
      console.log('Regenerate token response:', response); // 디버깅용

      // 백엔드 응답 구조 확인 및 토큰 값 추출
      const tokenValue = response?.data?.tokenValue || response?.tokenValue || '';
      console.log('Regenerate response structure:', response); // 디버깅용
      console.log('Extracted token value:', tokenValue); // 디버깅용

      const tokenInfo = {
        tokenName: selectedToken.tokenName,
        description: selectedToken.description,
        tokenType: selectedToken.tokenType,
        expiresAt: selectedToken.expiresAt,
        isNew: false
      };

      // 상태를 순서대로 설정하여 다이얼로그가 확실히 열리도록 함
      setNewTokenInfo(tokenInfo);
      setNewTokenValue(tokenValue);

      // 다음 렌더링 사이클에서 다이얼로그 열기
      setTimeout(() => {
        setNewTokenDialogOpen(true);
      }, 0);
      setRegenerateDialogOpen(false);
      setSelectedToken(null);
      setRegenerateConfirmText('');
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
      description: token.description || '',
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

  const openRegenerateDialog = (token: ApiAccessToken) => {
    setSelectedToken(token);
    setRegenerateConfirmText('');
    setRegenerateDialogOpen(true);
    // Focus on confirm input field after dialog opens
    setTimeout(() => {
      if (regenerateConfirmRef.current) {
        // Try to focus on the actual input element inside TextField
        const inputElement = regenerateConfirmRef.current.querySelector('input');
        if (inputElement) {
          inputElement.focus();
        } else {
          // Fallback to the TextField itself
          regenerateConfirmRef.current.focus();
        }
      }
    }, 300);
  };

  const closeRegenerateDialog = () => {
    setRegenerateDialogOpen(false);
    setRegenerateConfirmText('');
    setSelectedToken(null);
  };



  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    enqueueSnackbar(t('apiTokens.tokenCopied', 'Token copied to clipboard'), { variant: 'success' });
  };

  const copyTokenValue = (token: ApiAccessToken) => {
    navigator.clipboard.writeText(token.tokenHash); // tokenHash now contains the plain token
    enqueueSnackbar(t('apiTokens.tokenCopied', 'Token copied to clipboard'), { variant: 'success' });
  };

  const maskToken = (token: string) => {
    if (!token || token.length < 8) return token;
    return `${token.substring(0, 4)}${'•'.repeat(token.length - 8)}${token.substring(token.length - 4)}`;
  };

  // Bulk selection handlers
  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      setSelectedTokenIds(tokens.map(token => token.id));
    } else {
      setSelectedTokenIds([]);
    }
  };

  const handleSelectToken = (tokenId: number, checked: boolean) => {
    if (checked) {
      setSelectedTokenIds(prev => [...prev, tokenId]);
    } else {
      setSelectedTokenIds(prev => prev.filter(id => id !== tokenId));
      setSelectAll(false);
    }
  };

  // Update selectAll state when individual selections change
  React.useEffect(() => {
    if (tokens.length > 0 && selectedTokenIds.length === tokens.length) {
      setSelectAll(true);
    } else {
      setSelectAll(false);
    }
  }, [selectedTokenIds, tokens]);



  // Bulk actions
  const handleBulkDelete = () => {
    setBulkDeleteDrawerOpen(true);
  };

  const confirmBulkDelete = async () => {
    try {
      setLoading(true);

      // Delete selected tokens
      for (const tokenId of selectedTokenIds) {
        await apiTokenService.deleteToken(tokenId);
      }

      enqueueSnackbar(t('apiTokens.bulkDeleteSuccess', 'Selected tokens deleted successfully'), { variant: 'success' });

      // Reset states
      setSelectedTokenIds([]);
      setSelectAll(false);
      setBulkDeleteDrawerOpen(false);
      setBulkDeleteConfirmText('');

      // Reload tokens
      await loadTokens();
    } catch (error) {
      console.error('Bulk delete failed:', error);
      enqueueSnackbar(t('apiTokens.bulkDeleteFailed', 'Failed to delete selected tokens'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const closeBulkDeleteDrawer = () => {
    setBulkDeleteDrawerOpen(false);
    setBulkDeleteConfirmText('');
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



      {/* Bulk Actions */}
      {selectedTokenIds.length > 0 && (
        <Box sx={{
          mb: 2,
          p: 2,
          bgcolor: 'action.hover',
          borderRadius: 1,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <Typography variant="body2" color="text.secondary">
            {t('common.selectedItems', '{{count}} items selected', { count: selectedTokenIds.length })}
          </Typography>
          <Button
            variant="outlined"
            color="error"
            size="small"
            startIcon={<DeleteIcon />}
            onClick={handleBulkDelete}
          >
            {t('apiTokens.bulkDelete', 'Delete Selected')}
          </Button>
        </Box>
      )}

      {/* Tokens Table */}
      <Paper sx={{ width: '100%', overflow: 'hidden' }}>
        <TableContainer>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={selectAll}
                    indeterminate={selectedTokenIds.length > 0 && selectedTokenIds.length < tokens.length}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    disabled={tokens.length === 0}
                  />
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortBy === 'tokenName'}
                    direction={sortBy === 'tokenName' ? sortOrder : 'asc'}
                    onClick={() => handleSort('tokenName')}
                  >
                    {t('apiTokens.tokenName', 'Token Name')}
                  </TableSortLabel>
                </TableCell>
                <TableCell>{t('apiTokens.description', 'Description')}</TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortBy === 'tokenType'}
                    direction={sortBy === 'tokenType' ? sortOrder : 'asc'}
                    onClick={() => handleSort('tokenType')}
                  >
                    {t('apiTokens.tokenType', 'Type')}
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortBy === 'lastUsedAt'}
                    direction={sortBy === 'lastUsedAt' ? sortOrder : 'asc'}
                    onClick={() => handleSort('lastUsedAt')}
                  >
                    {t('apiTokens.lastUsed', 'Last Used')}
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortBy === 'usageCount'}
                    direction={sortBy === 'usageCount' ? sortOrder : 'asc'}
                    onClick={() => handleSort('usageCount')}
                  >
                    {t('apiTokens.usageCount', 'Usage Count')}
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortBy === 'expiresAt'}
                    direction={sortBy === 'expiresAt' ? sortOrder : 'asc'}
                    onClick={() => handleSort('expiresAt')}
                  >
                    {t('apiTokens.expiresAt', 'Expires')}
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortBy === 'creatorName'}
                    direction={sortBy === 'creatorName' ? sortOrder : 'asc'}
                    onClick={() => handleSort('creatorName')}
                  >
                    {t('apiTokens.createdBy', 'Created By')}
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortBy === 'createdAt'}
                    direction={sortBy === 'createdAt' ? sortOrder : 'asc'}
                    onClick={() => handleSort('createdAt')}
                  >
                    {t('apiTokens.createdAt', 'Created Date')}
                  </TableSortLabel>
                </TableCell>
                <TableCell align="center">{t('common.actions', 'Actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {!tokens || tokens.length === 0 ? (
                <EmptyTableRow
                  colSpan={9}
                  loading={loading}
                  message={t('apiTokens.noTokens', 'No API tokens found')}
                  loadingMessage={t('common.loadingData')}
                />
              ) : (
                tokens.map((token) => (
                  <TableRow key={token.id} hover selected={selectedTokenIds.includes(token.id)}>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectedTokenIds.includes(token.id)}
                        onChange={(e) => handleSelectToken(token.id, e.target.checked)}
                      />
                    </TableCell>
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
                      <Box>
                        <Chip
                          label={t(`apiTokens.${token.tokenType}TokenType`, token.tokenType)}
                          color={getTokenTypeColor(token.tokenType)}
                          size="small"
                          variant="outlined"
                          sx={{ mb: 0.5 }}
                        />
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.75rem' }}>
                          {t(`apiTokens.${token.tokenType}TokenDescription`, '')}
                        </Typography>
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
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {(token.usageCount || 0).toLocaleString()}
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
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {token.creator?.name || t('common.unknown', 'Unknown')}
                        </Typography>
                        {token.creator?.email && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.75rem' }}>
                            {token.creator.email}
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {formatDateTimeDetailed(token.createdAt)}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                        <Tooltip title={t('apiTokens.copyToken', 'Copy Token')}>
                          <IconButton size="small" onClick={() => copyTokenValue(token)}>
                            <CopyIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t('common.edit', 'Edit')}>
                          <IconButton size="small" onClick={() => openEditDialog(token)}>
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t('apiTokens.regenerateToken', 'Regenerate Token')}>
                          <IconButton size="small" onClick={() => openRegenerateDialog(token)}>
                            <RefreshIcon />
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
            width: { xs: '100%', sm: 500 },
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 1301 // Ensure it's above the sticky header
          }
        }}
        ModalProps={{
          keepMounted: false,
          sx: {
            zIndex: 1301 // Ensure modal backdrop is also above header
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
              error={formData.tokenName.length > 0 && !isValidTokenName(formData.tokenName)}
              helperText={
                formData.tokenName.length > 0 && !isValidTokenName(formData.tokenName)
                  ? t('apiTokens.tokenNameMinLength', 'Token name must be at least 3 characters')
                  : t('apiTokens.tokenNameHelp', 'Enter a descriptive name for this token')
              }
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
            disabled={!isValidTokenName(formData.tokenName)}
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
            width: { xs: '100%', sm: 500 },
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 1301 // Ensure it's above the sticky header
          }
        }}
        ModalProps={{
          keepMounted: false,
          sx: {
            zIndex: 1301 // Ensure modal backdrop is also above header
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
              error={formData.tokenName.length > 0 && !isValidTokenName(formData.tokenName)}
              helperText={
                formData.tokenName.length > 0 && !isValidTokenName(formData.tokenName)
                  ? t('apiTokens.tokenNameMinLength', 'Token name must be at least 3 characters')
                  : t('apiTokens.tokenNameHelp', 'Enter a descriptive name for this token')
              }
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
            disabled={!isValidTokenName(formData.tokenName)}
          >
            {t('common.save', 'Save')}
          </Button>
        </Box>
      </Drawer>

      {/* Delete Confirmation Drawer */}
      <Drawer
        anchor="right"
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        sx={{
          zIndex: 1301,
          '& .MuiDrawer-paper': {
            width: { xs: '100%', sm: 500 },
            maxWidth: '100vw',
            display: 'flex',
            flexDirection: 'column'
          }
        }}
      >
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
          zIndex: 1301
        }}>
          <Typography variant="h6" component="h2" sx={{ fontWeight: 600, color: 'error.main' }}>
            {t('apiTokens.deleteToken', 'Delete API Token')}
          </Typography>
          <IconButton
            onClick={() => setDeleteDialogOpen(false)}
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

        <Box sx={{ p: 3, flexGrow: 1 }}>
          <Typography variant="body1" sx={{ mb: 3, fontWeight: 500 }}>
            {t('apiTokens.deleteConfirmation', 'Are you sure you want to delete this API token? This action cannot be undone.')}
          </Typography>

          {selectedToken && (
            <>
              <Box sx={{
                mb: 3,
                p: 3,
                bgcolor: 'background.paper',
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider'
              }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                  {t('apiTokens.tokenName', 'Token Name')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {selectedToken.tokenName}
                </Typography>

                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                  {t('apiTokens.tokenType', 'Type')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t(`apiTokens.types.${selectedToken.tokenType}`, selectedToken.tokenType)}
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
                size="medium"
                error={deleteConfirmText.length > 0 && deleteConfirmText !== selectedToken.tokenName}
                helperText={
                  deleteConfirmText.length > 0 && deleteConfirmText !== selectedToken.tokenName
                    ? t('apiTokens.deleteConfirmMismatch', 'Token name does not match')
                    : ''
                }
                sx={{ mb: 2 }}
              />
            </>
          )}
        </Box>

        <Box sx={{
          p: 3,
          borderTop: 1,
          borderColor: 'divider',
          display: 'flex',
          gap: 2,
          justifyContent: 'flex-end'
        }}>
          <Button
            onClick={() => setDeleteDialogOpen(false)}
            variant="outlined"
            startIcon={<CancelIcon />}
          >
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            onClick={handleDelete}
            variant="contained"
            color="error"
            disabled={!selectedToken || deleteConfirmText !== selectedToken.tokenName}
            startIcon={<DeleteIcon />}
          >
            {t('common.delete', 'Delete')}
          </Button>
        </Box>
      </Drawer>

      {/* Regenerate Token Side Panel */}
      <Drawer
        anchor="right"
        open={regenerateDialogOpen}
        onClose={closeRegenerateDialog}
        PaperProps={{
          sx: {
            width: 500,
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 1301 // Ensure it's above the sticky header
          }
        }}
        ModalProps={{
          keepMounted: false,
          sx: {
            zIndex: 1301 // Ensure modal backdrop is also above header
          }
        }}
      >
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
          zIndex: 1300
        }}>
          <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
            {t('apiTokens.regenerateToken', 'Regenerate API Token')}
          </Typography>
          <IconButton
            onClick={closeRegenerateDialog}
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

        <Box sx={{ p: 3, flexGrow: 1 }}>
          <Alert severity="warning" sx={{ mb: 3 }}>
            {t('apiTokens.regenerateWarning', 'This will generate a new token value. The old token will become invalid immediately.')}
          </Alert>

          <Typography variant="body1" sx={{ mb: 3 }}>
            {t('apiTokens.regenerateConfirmation', 'Are you sure you want to regenerate this API token?')}
          </Typography>

          {selectedToken && (
            <>
              <Box sx={{
                p: 3,
                bgcolor: 'background.default',
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                mb: 3
              }}>
                <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                  {selectedToken.tokenName}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {t(`apiTokens.${selectedToken.tokenType}TokenType`, selectedToken.tokenType)}
                </Typography>
                {selectedToken.description && (
                  <Typography variant="body2" color="text.secondary">
                    {selectedToken.description}
                  </Typography>
                )}
              </Box>

              {/* Confirmation Input */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                  {t('apiTokens.regenerateConfirmInstruction', 'To confirm regeneration, please type the token name:')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  <strong>{selectedToken.tokenName}</strong>
                </Typography>
                <TextField
                  fullWidth
                  ref={regenerateConfirmRef}
                  value={regenerateConfirmText}
                  onChange={(e) => setRegenerateConfirmText(e.target.value)}
                  placeholder={t('apiTokens.regenerateConfirmPlaceholder', 'Type token name here...')}
                  size="medium"
                  error={regenerateConfirmText.length > 0 && regenerateConfirmText !== selectedToken.tokenName}
                  helperText={
                    regenerateConfirmText.length > 0 && regenerateConfirmText !== selectedToken.tokenName
                      ? t('apiTokens.regenerateConfirmMismatch', 'Token name does not match')
                      : ''
                  }
                />
              </Box>
            </>
          )}
        </Box>

        <Box sx={{
          p: 3,
          borderTop: 1,
          borderColor: 'divider',
          display: 'flex',
          gap: 2,
          justifyContent: 'flex-end'
        }}>
          <Button
            onClick={closeRegenerateDialog}
            variant="outlined"
            startIcon={<CancelIcon />}
          >
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            onClick={handleRegenerate}
            color="primary"
            variant="contained"
            startIcon={<RefreshIcon />}
            disabled={!selectedToken || regenerateConfirmText !== selectedToken.tokenName || loading}
          >
            {t('apiTokens.regenerate', 'Regenerate')}
          </Button>
        </Box>
      </Drawer>

      {/* Bulk Delete Confirmation Drawer */}
      <Drawer
        anchor="right"
        open={bulkDeleteDrawerOpen}
        onClose={closeBulkDeleteDrawer}
        sx={{
          zIndex: 1301,
          '& .MuiDrawer-paper': {
            width: { xs: '100%', sm: 400 },
            maxWidth: '100vw'
          }
        }}
      >
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
          position: 'sticky',
          top: 0,
          zIndex: 1300
        }}>
          <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
            {t('apiTokens.bulkDeleteConfirmation', 'Delete Selected Tokens')}
          </Typography>
          <IconButton
            onClick={closeBulkDeleteDrawer}
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

        <Box sx={{ p: 3, flexGrow: 1 }}>
          <Alert severity="warning" sx={{ mb: 3 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
              {t('apiTokens.bulkDeleteWarning', 'This action cannot be undone. The following tokens will be permanently deleted:')}
            </Typography>
          </Alert>

          {/* Selected Tokens List */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
              {t('apiTokens.tokensToDelete', 'Tokens to delete ({{count}})', { count: selectedTokenIds.length })}:
            </Typography>
            <Box sx={{
              maxHeight: 200,
              overflowY: 'auto',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              p: 1
            }}>
              {tokens
                .filter(token => selectedTokenIds.includes(token.id))
                .map(token => (
                  <Box key={token.id} sx={{
                    p: 1.5,
                    mb: 1,
                    bgcolor: 'action.hover',
                    borderRadius: 1,
                    '&:last-child': { mb: 0 }
                  }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {token.tokenName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {token.tokenType} • {t('apiTokens.createdBy', 'Created By')}: {token.creator?.name || 'Unknown'}
                    </Typography>
                  </Box>
                ))
              }
            </Box>
          </Box>

          {/* Confirmation Input */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="body2" sx={{ mb: 2 }}>
              {t('apiTokens.bulkDeleteConfirmInstruction', 'To confirm deletion, please type:')}
            </Typography>
            <Typography variant="body2" sx={{
              mb: 2,
              p: 1,
              bgcolor: 'action.hover',
              borderRadius: 1,
              fontFamily: 'monospace',
              fontWeight: 600
            }}>
              {t('apiTokens.deleteSelectedTokensText', 'delete selected tokens')}
            </Typography>
            <TextField
              fullWidth
              value={bulkDeleteConfirmText}
              onChange={(e) => setBulkDeleteConfirmText(e.target.value)}
              placeholder={t('apiTokens.bulkDeleteConfirmPlaceholder', 'Type confirmation text here...')}
              variant="outlined"
              size="small"
            />
            {bulkDeleteConfirmText && bulkDeleteConfirmText !== t('apiTokens.deleteSelectedTokensText', 'delete selected tokens') && (
              <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
                {t('apiTokens.bulkDeleteConfirmMismatch', 'Confirmation text does not match. Please type the exact text above.')}
              </Typography>
            )}
          </Box>
        </Box>

        <Box sx={{
          p: 2,
          borderTop: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          gap: 2,
          justifyContent: 'flex-end'
        }}>
          <Button
            onClick={closeBulkDeleteDrawer}
            variant="outlined"
            startIcon={<CancelIcon />}
          >
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            onClick={confirmBulkDelete}
            color="error"
            variant="contained"
            startIcon={<DeleteIcon />}
            disabled={bulkDeleteConfirmText !== t('apiTokens.deleteSelectedTokensText', 'delete selected tokens') || loading}
          >
            {t('apiTokens.bulkDelete', 'Delete Selected')}
          </Button>
        </Box>
      </Drawer>

      {/* New Token Display Dialog */}
      <Dialog
        open={newTokenDialogOpen && !!newTokenInfo}
        onClose={() => { setNewTokenValue(''); setNewTokenInfo(null); setNewTokenDialogOpen(false); }}
        maxWidth="md"
        fullWidth
        sx={{
          '& .MuiDialog-paper': {
            maxWidth: '700px',
            width: '90%'
          }
        }}
      >
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
              </Box>
            </Box>
          </DialogTitle>
          <DialogContent sx={{ pt: 2 }}>

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
            {newTokenValue ? (
              <Box sx={{
                p: 2,
                bgcolor: 'action.hover',
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
                  bgcolor: 'background.default',
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
            ) : (
              <Alert severity="error" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  {t('apiTokens.tokenValueError', 'Failed to retrieve token value. Please try again.')}
                </Typography>
              </Alert>
            )}
          </DialogContent>
          <DialogActions sx={{ p: 3, pt: 2 }}>
            <Button
              onClick={() => { setNewTokenValue(''); setNewTokenInfo(null); setNewTokenDialogOpen(false); }}
              variant="contained"
              startIcon={<CheckCircleIcon />}
              size="medium"
              sx={{
                px: 3,
                py: 1,
                fontWeight: 600,
                textTransform: 'none'
              }}
            >
              {t('common.confirm', 'Confirm')}
            </Button>
          </DialogActions>
        </Dialog>
    </>
  );
};

export default ApiTokensPage;
