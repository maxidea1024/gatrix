import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  TextField,
  Button,
  IconButton,
  Avatar,
  Select,
  MenuItem,
  Divider,
  CircularProgress,
  Tooltip,
  InputAdornment,
} from '@mui/material';
import {
  Close as CloseIcon,
  ContentCopy as CopyIcon,
  PersonAdd as PersonAddIcon,
  Delete as DeleteIcon,
  Public as PublicIcon,
  Check as CheckIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import spreadsheetService, {
  type SpreadsheetShare,
  type SharePermission,
} from '@/services/spreadsheetService';

interface ShareDialogProps {
  open: boolean;
  onClose: () => void;
  spreadsheetId: string;
  spreadsheetTitle: string;
}

const ShareDialog: React.FC<ShareDialogProps> = ({
  open,
  onClose,
  spreadsheetId,
  spreadsheetTitle,
}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  const [shares, setShares] = useState<SpreadsheetShare[]>([]);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [permission, setPermission] = useState<SharePermission>('viewer');
  const [adding, setAdding] = useState(false);
  const [copied, setCopied] = useState(false);
  const [creatingLink, setCreatingLink] = useState(false);
  const [showUserSharing, setShowUserSharing] = useState(false);

  const publicShare = shares.find((s) => s.shareType === 'public');
  const userOrgShares = shares.filter((s) => s.shareType !== 'public');

  const loadShares = useCallback(async () => {
    if (!spreadsheetId) return;
    setLoading(true);
    try {
      setShares(await spreadsheetService.listShares(spreadsheetId));
    } catch {
      setShares([]);
    } finally {
      setLoading(false);
    }
  }, [spreadsheetId]);

  useEffect(() => {
    if (open) {
      loadShares();
      setEmail('');
      setCopied(false);
      setShowUserSharing(false);
    }
  }, [open, loadShares]);

  const handleCreatePublicLink = useCallback(async () => {
    setCreatingLink(true);
    try {
      await spreadsheetService.addShare(spreadsheetId, {
        shareType: 'public',
        permission: 'viewer',
      });
      loadShares();
    } catch {
      enqueueSnackbar(t('spreadsheets.publicLinkCreateFailed'), {
        variant: 'error',
      });
    } finally {
      setCreatingLink(false);
    }
  }, [spreadsheetId, loadShares, enqueueSnackbar, t]);

  const handleRemovePublicLink = useCallback(async () => {
    if (!publicShare) return;
    try {
      await spreadsheetService.removeShare(spreadsheetId, publicShare.id);
      setShares((prev) => prev.filter((s) => s.id !== publicShare.id));
    } catch {
      enqueueSnackbar(t('spreadsheets.publicLinkRemoveFailed'), {
        variant: 'error',
      });
    }
  }, [publicShare, spreadsheetId, enqueueSnackbar, t]);

  const handleCopyLink = useCallback(async () => {
    if (!publicShare?.shareToken) return;
    await navigator.clipboard.writeText(
      `${window.location.origin}/shared/spreadsheet/${publicShare.shareToken}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [publicShare]);

  const handleAddUser = useCallback(async () => {
    if (!email.trim()) return;
    setAdding(true);
    try {
      await spreadsheetService.addShare(spreadsheetId, {
        shareType: 'user',
        targetId: email.trim(),
        permission,
      });
      setEmail('');
      loadShares();
    } catch {
      enqueueSnackbar(t('spreadsheets.shareAddFailed'), { variant: 'error' });
    } finally {
      setAdding(false);
    }
  }, [email, permission, spreadsheetId, loadShares, enqueueSnackbar, t]);

  const handlePermissionChange = useCallback(
    async (shareId: string, p: SharePermission) => {
      try {
        await spreadsheetService.updateSharePermission(
          spreadsheetId,
          shareId,
          p
        );
        setShares((prev) =>
          prev.map((s) => (s.id === shareId ? { ...s, permission: p } : s))
        );
      } catch {
        enqueueSnackbar(t('spreadsheets.permissionUpdateFailed'), {
          variant: 'error',
        });
      }
    },
    [spreadsheetId, enqueueSnackbar, t]
  );

  const handleRemoveShare = useCallback(
    async (shareId: string) => {
      try {
        await spreadsheetService.removeShare(spreadsheetId, shareId);
        setShares((prev) => prev.filter((s) => s.id !== shareId));
      } catch {
        enqueueSnackbar(t('spreadsheets.shareRemoveFailed'), {
          variant: 'error',
        });
      }
    },
    [spreadsheetId, enqueueSnackbar, t]
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3 } }}
    >
      <DialogTitle sx={{ pb: 1.5 }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'start',
          }}
        >
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: '1.1rem' }}>
              {t('spreadsheets.shareTitle', '"{{title}}" 공유', {
                title: spreadsheetTitle,
              })}
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small" sx={{ mt: -0.5 }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 2.5 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          <>
            {/* ── 공개 링크 ── */}
            <Box sx={{ mb: 3 }}>
              <Box
                sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}
              >
                <PublicIcon sx={{ fontSize: 14, color: 'primary.main' }} />
                <Typography
                  variant="overline"
                  sx={{
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    color: 'primary.main',
                    lineHeight: 1,
                  }}
                >
                  {t('spreadsheets.publicLink')}
                </Typography>
              </Box>

              {publicShare ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TextField
                    size="small"
                    fullWidth
                    value={`${window.location.origin}/shared/spreadsheet/${publicShare.shareToken}`}
                    onClick={handleCopyLink}
                    InputProps={{
                      readOnly: true,
                      sx: {
                        fontSize: '0.8rem',
                        fontFamily: 'monospace',
                        color: 'text.primary',
                        cursor: 'pointer',
                      },
                    }}
                  />
                  <Select
                    size="small"
                    value={publicShare.permission}
                    onChange={(e) =>
                      handlePermissionChange(
                        publicShare.id,
                        e.target.value as SharePermission
                      )
                    }
                    sx={{ minWidth: 80, fontSize: '0.8rem' }}
                  >
                    <MenuItem value="viewer">
                      {t('spreadsheets.viewer')}
                    </MenuItem>
                    <MenuItem value="editor">
                      {t('spreadsheets.editor')}
                    </MenuItem>
                  </Select>
                  <Button
                    size="small"
                    variant="contained"
                    color={copied ? 'success' : 'primary'}
                    onClick={handleCopyLink}
                    disableElevation
                    startIcon={
                      copied ? (
                        <CheckIcon sx={{ fontSize: 14 }} />
                      ) : (
                        <CopyIcon sx={{ fontSize: 14 }} />
                      )
                    }
                    sx={{
                      minWidth: 72,
                      textTransform: 'none',
                      fontWeight: 600,
                      borderRadius: 1.5,
                      fontSize: '0.78rem',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {copied ? t('spreadsheets.copied') : t('spreadsheets.copy')}
                  </Button>
                  <Tooltip title={t('spreadsheets.removePublicLink')}>
                    <IconButton
                      size="small"
                      onClick={handleRemovePublicLink}
                      sx={{ '&:hover': { color: 'error.main' } }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              ) : (
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={
                    creatingLink ? (
                      <CircularProgress size={14} />
                    ) : (
                      <PublicIcon sx={{ fontSize: 16 }} />
                    )
                  }
                  onClick={handleCreatePublicLink}
                  disabled={creatingLink}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 500,
                    borderRadius: 1.5,
                  }}
                >
                  {t('spreadsheets.createLink')}
                </Button>
              )}
            </Box>

            <Divider />

            {/* ── 사용자 공유 ── */}
            {publicShare && userOrgShares.length === 0 && !showUserSharing ? (
              <Button
                size="small"
                variant="text"
                startIcon={<PersonAddIcon sx={{ fontSize: 16 }} />}
                onClick={() => setShowUserSharing(true)}
                sx={{
                  textTransform: 'none',
                  mt: 2,
                  color: 'primary.main',
                  fontWeight: 500,
                }}
              >
                {t('spreadsheets.addSpecificUser')}
              </Button>
            ) : (
              <Box sx={{ mt: 2 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.75,
                    mb: 1,
                  }}
                >
                  <PersonAddIcon sx={{ fontSize: 14, color: 'primary.main' }} />
                  <Typography
                    variant="overline"
                    sx={{
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      color: 'primary.main',
                      lineHeight: 1,
                    }}
                  >
                    {t('spreadsheets.sharedWith')}
                  </Typography>
                </Box>
                <Typography sx={{ display: 'none' }}></Typography>

                <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
                  <TextField
                    placeholder={t('spreadsheets.shareEmailPlaceholder')}
                    size="small"
                    fullWidth
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddUser();
                    }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <PersonAddIcon
                            sx={{ fontSize: 18, color: 'text.disabled' }}
                          />
                        </InputAdornment>
                      ),
                    }}
                  />
                  <Select
                    size="small"
                    value={permission}
                    onChange={(e) =>
                      setPermission(e.target.value as SharePermission)
                    }
                    sx={{ minWidth: 80, fontSize: '0.8rem' }}
                  >
                    <MenuItem value="viewer">
                      {t('spreadsheets.viewer')}
                    </MenuItem>
                    <MenuItem value="editor">
                      {t('spreadsheets.editor')}
                    </MenuItem>
                  </Select>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={handleAddUser}
                    disabled={adding || !email.trim()}
                    disableElevation
                    sx={{
                      minWidth: 50,
                      textTransform: 'none',
                      fontWeight: 600,
                      borderRadius: 1.5,
                    }}
                  >
                    {adding ? <CircularProgress size={16} /> : t('common.add')}
                  </Button>
                </Box>

                {/* 목록 */}
                {userOrgShares.length === 0 && !publicShare ? (
                  <Typography
                    variant="body2"
                    color="text.disabled"
                    sx={{ py: 2, textAlign: 'center' }}
                  >
                    {t('spreadsheets.noShares')}
                  </Typography>
                ) : (
                  userOrgShares.map((share) => (
                    <Box
                      key={share.id}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        py: 0.75,
                        '&:hover .delete-btn': { opacity: 1 },
                      }}
                    >
                      <Avatar
                        src={share.targetAvatarUrl || undefined}
                        sx={{ width: 28, height: 28, fontSize: '0.75rem' }}
                      >
                        {(share.targetName ||
                          share.targetEmail ||
                          '?')[0].toUpperCase()}
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography
                          variant="body2"
                          noWrap
                          sx={{ fontWeight: 500, fontSize: '0.85rem' }}
                        >
                          {share.targetName || share.targetId}
                        </Typography>
                        {share.targetEmail && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            noWrap
                            sx={{ fontSize: '0.72rem' }}
                          >
                            {share.targetEmail}
                          </Typography>
                        )}
                      </Box>
                      <Select
                        size="small"
                        value={share.permission}
                        onChange={(e) =>
                          handlePermissionChange(
                            share.id,
                            e.target.value as SharePermission
                          )
                        }
                        variant="standard"
                        disableUnderline
                        sx={{ fontSize: '0.8rem', minWidth: 60 }}
                      >
                        <MenuItem value="viewer">
                          {t('spreadsheets.viewer')}
                        </MenuItem>
                        <MenuItem value="editor">
                          {t('spreadsheets.editor')}
                        </MenuItem>
                      </Select>
                      <IconButton
                        className="delete-btn"
                        size="small"
                        onClick={() => handleRemoveShare(share.id)}
                        sx={{
                          opacity: 0,
                          transition: 'opacity 0.15s',
                          '&:hover': { color: 'error.main' },
                        }}
                      >
                        <DeleteIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Box>
                  ))
                )}
              </Box>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ShareDialog;
