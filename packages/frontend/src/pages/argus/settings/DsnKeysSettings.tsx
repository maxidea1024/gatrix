import React, { useState } from 'react';
import {
  Box, Typography, Button, Switch, FormControlLabel, Paper, TextField, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress
} from '@mui/material';
import {
  Add as AddIcon, Edit as EditIcon, Close as CloseIcon, Delete as DeleteIcon,
  VpnKey as KeyIcon, Save as SaveIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { SettingsCard, EmptyState, StatusBadge } from './components/SettingsShared';
import { CopyButton } from '@/components/common/CopyButton';
import { DsnKeySparkline } from '../components/DsnKeySparkline';
import argusService, { ArgusProject } from '@/services/argusService';
import useLocalStorage from '../../../hooks/useLocalStorage';

interface DsnKeysSettingsProps {
  project: ArgusProject | null;
  setProject: React.Dispatch<React.SetStateAction<ArgusProject | null>>;
  projectId: string;
  isDark: boolean;
  t: any;
  fetchProject: () => void;
}

export const DsnKeysSettings: React.FC<DsnKeysSettingsProps> = ({
  project, setProject, projectId, isDark, t, fetchProject
}) => {
  const { enqueueSnackbar } = useSnackbar();
  const bdr = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const bdrSubtle = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)';

  // DSN Key Management State
  const [showActiveKeysOnly, setShowActiveKeysOnly] = useLocalStorage('argus-dsn-active-only', false);
  const [createKeyOpen, setCreateKeyOpen] = useState(false);
  const [newKeyLabel, setNewKeyLabel] = useState('');
  const [newKeyRateCount, setNewKeyRateCount] = useState<number>(0);
  const [newKeyRateWindow, setNewKeyRateWindow] = useState<number>(0);

  const [editKeyDialog, setEditKeyDialog] = useState<{ id: number; label: string; rate_limit_count: number; rate_limit_window: number } | null>(null);
  const [editKeySaving, setEditKeySaving] = useState(false);

  const handleCreateKey = async () => {
    if (!newKeyLabel.trim()) return;
    try {
      await argusService.createDsnKey(projectId, newKeyLabel.trim(), {
        rate_limit_count: newKeyRateCount,
        rate_limit_window: newKeyRateWindow,
      });
      setCreateKeyOpen(false);
      setNewKeyLabel('');
      setNewKeyRateCount(0);
      setNewKeyRateWindow(0);
      fetchProject();
    } catch {
      enqueueSnackbar(t('argus.settings.keyCreateFailed'), { variant: 'error' });
    }
  };

  const handleToggleActive = async (keyId: number, isActive: boolean) => {
    try {
      if (isActive) {
        await argusService.revokeDsnKey(projectId, keyId);
      }
      fetchProject();
    } catch {
      enqueueSnackbar(t('argus.settings.keyRevokeFailed'), { variant: 'error' });
    }
  };

  const handleHardDeleteKey = async (keyId: number) => {
    try {
      await argusService.deleteDsnKey(projectId, keyId);
      setProject(prev => prev ? { ...prev, dsn_keys: prev.dsn_keys?.filter(k => k.id !== keyId) } : prev);
    } catch {
      enqueueSnackbar(t('common.deleteFailed', 'Failed to delete'), { variant: 'error' });
    }
  };

  const openEditKeyDialog = (key: any) => {
    setEditKeyDialog({
      id: key.id,
      label: key.label,
      rate_limit_count: key.rate_limit_count ?? 0,
      rate_limit_window: key.rate_limit_window ?? 0,
    });
  };

  const handleSaveKeyEdit = async () => {
    if (!editKeyDialog || !editKeyDialog.label.trim()) return;
    setEditKeySaving(true);
    const { id, label, rate_limit_count, rate_limit_window } = editKeyDialog;
    try {
      await argusService.updateDsnKey(projectId, id, { label: label.trim(), rate_limit_count, rate_limit_window });
      setProject(prev => prev ? {
        ...prev,
        dsn_keys: prev.dsn_keys?.map(k => k.id === id ? { ...k, label: label.trim(), rate_limit_count, rate_limit_window } : k)
      } : prev);
      setEditKeyDialog(null);
    } catch {
      enqueueSnackbar(t('common.saveFailed', { defaultValue: 'Failed to save' }), { variant: 'error' });
    } finally {
      setEditKeySaving(false);
    }
  };

  return (
    <>
      <SettingsCard title={t('argus.settings.dsnKeys')} desc={t('argus.settings.dsnKeysDesc')} isDark={isDark}
        headerAction={<Button size="small" startIcon={<AddIcon />} onClick={() => setCreateKeyOpen(true)} variant="contained"
          sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600, fontSize: '0.8rem' }}>{t('argus.settings.createKey')}</Button>}
      >
        {!project?.dsn_keys?.length ? (
          <EmptyState icon={<KeyIcon />} text={t('argus.settings.noKeys')} />
        ) : (() => {
          const filteredKeys = showActiveKeysOnly ? project.dsn_keys.filter(k => k.is_active) : project.dsn_keys;
          return (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', mb: 1 }}>
                <FormControlLabel
                  control={<Switch size="small" checked={showActiveKeysOnly} onChange={e => setShowActiveKeysOnly(e.target.checked)} />}
                  label={<Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{showActiveKeysOnly ? t('argus.settings.showingActiveOnly', 'Showing Active Only') : t('argus.settings.activeOnly', 'Active Only')}</Typography>}
                />
              </Box>
              {filteredKeys.length === 0 ? (
                <Typography variant="body2" sx={{ textAlign: 'center', py: 3, color: 'text.disabled' }}>
                  {t('argus.settings.noActiveKeys', '활성화된 키가 없습니다')}
                </Typography>
              ) : filteredKeys.map(key => (
                <Paper key={key.id} elevation={0} sx={{
                  p: 2, border: `1px solid ${bdr}`, borderRadius: '10px', overflow: 'hidden',
                  opacity: key.is_active ? 1 : 0.6,
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                      <Typography sx={{ fontWeight: 600, fontSize: '0.85rem' }}>{key.label}</Typography>
                      <IconButton size="small" onClick={() => openEditKeyDialog(key)} sx={{ opacity: 0.5, '&:hover': { opacity: 1 } }}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Box>
                    <StatusBadge active={key.is_active} t={t} />
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ flex: 1, minWidth: 0, p: 1, borderRadius: '6px', backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.03)' }}>
                      <Typography sx={{
                        fontSize: '0.75rem',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        color: isDark ? '#bbb' : '#555', userSelect: 'all',
                      }}>{key.dsn}</Typography>
                    </Box>
                    <CopyButton text={key.dsn} />
                    {key.is_active ? (
                      <Tooltip title={t('argus.settings.deactivateKey', 'Deactivate')}>
                        <IconButton size="small" color="warning" onClick={() => handleToggleActive(key.id, true)}>
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    ) : (
                      <Tooltip title={t('common.delete', 'Delete')}>
                        <IconButton size="small" color="error" onClick={() => handleHardDeleteKey(key.id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                  <Box sx={{ display: 'flex', gap: 2, mt: 1, px: 0.5 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                      {t('argus.settings.firstSeen', 'First Seen')}: {key.first_seen ? new Date(key.first_seen).toLocaleString() : t('common.never', 'Never')}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                      {t('argus.settings.lastSeen', 'Last Seen')}: {key.last_seen ? new Date(key.last_seen).toLocaleString() : t('common.never', 'Never')}
                    </Typography>
                  </Box>
                  <Box sx={{ mt: 2, pt: 2, borderTop: `1px solid ${bdrSubtle}` }}>
                    <DsnKeySparkline
                      projectId={projectId}
                      keyId={key.id}
                      isActive={key.is_active}
                      isDark={isDark}
                    />
                  </Box>
                </Paper>
              ))}
            </Box>
          );
        })()}
      </SettingsCard>

      {/* Create DSN Key Dialog */}
      <Dialog open={createKeyOpen} onClose={() => setCreateKeyOpen(false)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: '14px' } }}>
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem', pb: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
          <AddIcon sx={{ fontSize: 20, color: '#667eea' }} />
          {t('argus.settings.createKey')}
        </DialogTitle>
        <DialogContent sx={{ pt: '12px !important', display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <TextField
            label={t('argus.settings.keyLabel')}
            value={newKeyLabel}
            onChange={e => setNewKeyLabel(e.target.value)}
            size="small" fullWidth autoFocus
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
          />
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', mb: 1, display: 'block' }}>
              {t('argus.settings.rateLimit', 'Rate Limit')}
            </Typography>
            <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 1.5, fontSize: '0.72rem' }}>
              {t('argus.settings.rateLimitHint', 'Leave as 0 for unlimited')}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <TextField size="small" type="number" label={t('argus.settings.rateLimitCount', 'Count')}
                value={newKeyRateCount}
                onChange={e => setNewKeyRateCount(parseInt(e.target.value) || 0)}
                inputProps={{ min: 0 }}
                sx={{ flex: 1, '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
              />
              <Typography color="text.secondary" sx={{ fontWeight: 600 }}>/</Typography>
              <TextField size="small" type="number" label={t('argus.settings.rateLimitWindow', 'Window (s)')}
                value={newKeyRateWindow}
                onChange={e => setNewKeyRateWindow(parseInt(e.target.value) || 0)}
                inputProps={{ min: 0 }}
                sx={{ flex: 1, '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setCreateKeyOpen(false)}
            sx={{ textTransform: 'none', fontWeight: 600, borderRadius: '8px' }}>
            {t('common.cancel')}
          </Button>
          <Button variant="contained" onClick={handleCreateKey}
            startIcon={<SaveIcon />}
            sx={{ textTransform: 'none', fontWeight: 600, borderRadius: '8px' }}>
            {t('common.create')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit DSN Key Dialog */}
      <Dialog open={!!editKeyDialog} onClose={() => setEditKeyDialog(null)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: '14px' } }}>
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem', pb: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
          <EditIcon sx={{ fontSize: 20, color: '#667eea' }} />
          {t('argus.settings.editKey', 'Edit Key')}
        </DialogTitle>
        <DialogContent sx={{ pt: '12px !important', display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <TextField
            label={t('argus.settings.keyLabel')}
            value={editKeyDialog?.label || ''}
            onChange={e => setEditKeyDialog(prev => prev ? { ...prev, label: e.target.value } : prev)}
            size="small" fullWidth autoFocus
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
          />
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', mb: 1, display: 'block' }}>
              {t('argus.settings.rateLimit', 'Rate Limit')}
            </Typography>
            <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 1.5, fontSize: '0.72rem' }}>
              {t('argus.settings.rateLimitHint', 'Leave as 0 for unlimited')}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <TextField size="small" type="number" label={t('argus.settings.rateLimitCount', 'Count')}
                value={editKeyDialog?.rate_limit_count ?? 0}
                onChange={e => setEditKeyDialog(prev => prev ? { ...prev, rate_limit_count: parseInt(e.target.value) || 0 } : prev)}
                inputProps={{ min: 0 }}
                sx={{ flex: 1, '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
              />
              <Typography color="text.secondary" sx={{ fontWeight: 600 }}>/</Typography>
              <TextField size="small" type="number" label={t('argus.settings.rateLimitWindow', 'Window (s)')}
                value={editKeyDialog?.rate_limit_window ?? 0}
                onChange={e => setEditKeyDialog(prev => prev ? { ...prev, rate_limit_window: parseInt(e.target.value) || 0 } : prev)}
                inputProps={{ min: 0 }}
                sx={{ flex: 1, '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          {(() => {
            const originalKey = project?.dsn_keys?.find(k => k.id === editKeyDialog?.id);
            const hasChanges = !!originalKey && !!editKeyDialog && (
              originalKey.label !== editKeyDialog.label ||
              (originalKey.rate_limit_count ?? 0) !== editKeyDialog.rate_limit_count ||
              (originalKey.rate_limit_window ?? 0) !== editKeyDialog.rate_limit_window
            );
            return (
              <>
                <Button onClick={() => setEditKeyDialog(null)}
                  sx={{ textTransform: 'none', fontWeight: 600, borderRadius: '8px' }}>
                  {t('common.cancel')}
                </Button>
                <Button variant="contained" onClick={handleSaveKeyEdit} disabled={editKeySaving || !hasChanges}
                  startIcon={editKeySaving ? <CircularProgress size={16} /> : <SaveIcon />}
                  sx={{ textTransform: 'none', fontWeight: 600, borderRadius: '8px' }}>
                  {t('common.save')}
                </Button>
              </>
            );
          })()}
        </DialogActions>
      </Dialog>
    </>
  );
};

export default DsnKeysSettings;
