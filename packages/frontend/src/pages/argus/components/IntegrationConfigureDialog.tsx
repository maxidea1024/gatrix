import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography,
  Tabs, Tab, Paper, IconButton, alpha, Avatar, Chip, TextField, Divider,
  CircularProgress, Tooltip,
} from '@mui/material';
import {
  Close as CloseIcon, Add as AddIcon, Delete as DeleteIcon,
  GitHub as GitHubIcon, CheckCircle as CheckCircleIcon,
  FolderOpen as FolderIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import argusService from '@/services/argusService';
import type { ArgusIntegration } from '@/services/argusService';
import { GitLabIcon, BitbucketIcon } from './ServiceIcons';

interface IntegrationConfigureDialogProps {
  open: boolean;
  onClose: () => void;
  provider: string | null;
  projectId: number | string;
  integrations: ArgusIntegration[];
  onIntegrationsChange: (integrations: ArgusIntegration[]) => void;
  isDark: boolean;
}

const PROVIDER_INFO: Record<string, { name: string; color: string; icon: React.ReactNode }> = {
  github: { name: 'GitHub', color: '#8b949e', icon: <GitHubIcon /> },
  gitlab: { name: 'GitLab', color: '#fc6d26', icon: <GitLabIcon /> },
  bitbucket: { name: 'Bitbucket', color: '#0052CC', icon: <BitbucketIcon /> },
};

export const IntegrationConfigureDialog: React.FC<IntegrationConfigureDialogProps> = ({
  open, onClose, provider, projectId, integrations, onIntegrationsChange, isDark,
}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [tabIdx, setTabIdx] = useState(0);

  // Repository tab state
  const [availableRepos, setAvailableRepos] = useState<any[]>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [addingRepo, setAddingRepo] = useState<string | null>(null);
  const [repoSearch, setRepoSearch] = useState('');

  // Connected repos for this provider
  const connectedRepos = integrations.filter(i => i.provider === provider);

  // Load available repos on open
  useEffect(() => {
    if (open && provider === 'github') {
      setReposLoading(true);
      argusService.getGithubRepositories()
        .then(repos => setAvailableRepos(repos))
        .catch(() => setAvailableRepos([]))
        .finally(() => setReposLoading(false));
    }
    if (open) { setTabIdx(0); setRepoSearch(''); }
  }, [open, provider]);

  if (!provider) return null;
  const info = PROVIDER_INFO[provider] || { name: provider, color: '#667eea', icon: <GitHubIcon /> };

  const filteredRepos = availableRepos.filter(r => {
    const name = (r.full_name || r.name || '').toLowerCase();
    return name.includes(repoSearch.toLowerCase());
  });

  const isRepoConnected = (repoUrl: string) =>
    connectedRepos.some(i => i.repo_url === repoUrl);

  const handleAddRepo = async (repo: any) => {
    const url = repo.url || repo.clone_url || repo.html_url || '';
    if (!url || isRepoConnected(url)) return;
    setAddingRepo(url);
    try {
      await argusService.createIntegration(projectId, {
        provider,
        repo_url: url,
        default_branch: repo.default_branch || 'main',
      });
      const updated = await argusService.listIntegrations(projectId);
      onIntegrationsChange(updated);
      enqueueSnackbar(t('argus.settings.repoAdded', '리포지토리가 추가되었습니다'), { variant: 'success' });
    } catch {
      enqueueSnackbar(t('argus.settings.repoAddFailed', '리포지토리 추가에 실패했습니다'), { variant: 'error' });
    } finally {
      setAddingRepo(null);
    }
  };

  const handleRemoveRepo = async (intgId: number) => {
    try {
      await argusService.deleteIntegration(projectId, intgId);
      onIntegrationsChange(integrations.filter(i => i.id !== intgId));
      enqueueSnackbar(t('common.deleted', '삭제되었습니다'), { variant: 'success' });
    } catch {
      enqueueSnackbar(t('common.saveFailed', 'Failed'), { variant: 'error' });
    }
  };

  const bdr = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth
      PaperProps={{ sx: { borderRadius: '14px', minHeight: 500 } }}>
      {/* Header */}
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 1 }}>
        <Avatar sx={{ width: 36, height: 36, backgroundColor: alpha('#667eea', isDark ? 0.2 : 0.08), color: '#667eea' }}>
          {info.icon}
        </Avatar>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '1.05rem' }}>
            {info.name} {t('argus.settings.integrationSettings', '연동 설정')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('argus.settings.configureIntegrationDesc', '리포지토리를 추가하고 연동을 관리합니다')}
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose}><CloseIcon /></IconButton>
      </DialogTitle>

      {/* Tabs */}
      <Box sx={{ px: 3, borderBottom: `1px solid ${bdr}` }}>
        <Tabs value={tabIdx} onChange={(_, v) => setTabIdx(v)}
          sx={{ minHeight: 40, '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, fontSize: '0.85rem', minHeight: 40, py: 1 } }}>
          <Tab label={t('argus.settings.repositories', '리포지토리')} />
          <Tab label={t('argus.settings.codeMappings', '코드 매핑')} />
        </Tabs>
      </Box>

      <DialogContent sx={{ p: 0, overflow: 'auto' }}>
        {/* ─── REPOSITORIES TAB ─── */}
        {tabIdx === 0 && (
          <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            {/* Connected Repos */}
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', mb: 1.5 }}>
                {t('argus.settings.connectedRepos', '연결된 리포지토리')}
                <Chip label={connectedRepos.length} size="small" sx={{ ml: 1, height: 20, fontSize: '0.7rem', fontWeight: 700 }} />
              </Typography>
              {connectedRepos.length === 0 ? (
                <Paper elevation={0} sx={{ p: 3, textAlign: 'center', border: `1px dashed ${bdr}`, borderRadius: '10px' }}>
                  <FolderIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                  <Typography color="text.secondary" sx={{ fontSize: '0.85rem' }}>
                    {t('argus.settings.noConnectedRepos', '아직 연결된 리포지토리가 없습니다')}
                  </Typography>
                  <Typography variant="caption" color="text.disabled">
                    {t('argus.settings.addRepoHint', '아래에서 리포지토리를 검색하여 추가하세요')}
                  </Typography>
                </Paper>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {connectedRepos.map(intg => (
                    <Paper key={intg.id} elevation={0} sx={{
                      p: 1.5, px: 2, display: 'flex', alignItems: 'center', gap: 1.5,
                      border: `1px solid ${bdr}`, borderRadius: '10px',
                    }}>
                      <CheckCircleIcon sx={{ fontSize: 18, color: '#4caf50' }} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 600, fontSize: '0.82rem' }} noWrap>{intg.repo_url}</Typography>
                        <Typography variant="caption" color="text.secondary">{intg.default_branch}</Typography>
                      </Box>
                      <Chip label={intg.enabled ? t('common.active', '활성') : t('common.inactive', '비활성')} size="small"
                        sx={{ height: 20, fontSize: '0.65rem', fontWeight: 600,
                          backgroundColor: alpha(intg.enabled ? '#4caf50' : '#9e9e9e', 0.1),
                          color: intg.enabled ? '#4caf50' : '#9e9e9e', border: 'none' }}
                      />
                      <Tooltip title={t('common.delete', '삭제')}>
                        <IconButton size="small" onClick={() => handleRemoveRepo(intg.id)}
                          sx={{ '&:hover': { color: '#ef4444' } }}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Paper>
                  ))}
                </Box>
              )}
            </Box>

            <Divider />

            {/* Available Repos */}
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', mb: 1.5 }}>
                {t('argus.settings.availableRepos', '사용 가능한 리포지토리')}
              </Typography>

              {provider === 'github' ? (
                <>
                  <TextField
                    size="small" fullWidth placeholder={t('argus.settings.searchRepos', '리포지토리 검색...')}
                    value={repoSearch} onChange={e => setRepoSearch(e.target.value)}
                    sx={{ mb: 1.5, '& .MuiOutlinedInput-root': { borderRadius: '10px', fontSize: '0.85rem' } }}
                  />
                  {reposLoading ? (
                    <Box sx={{ py: 4, textAlign: 'center' }}><CircularProgress size={28} /></Box>
                  ) : filteredRepos.length === 0 ? (
                    <Typography color="text.secondary" sx={{ py: 2, textAlign: 'center', fontSize: '0.85rem' }}>
                      {availableRepos.length === 0
                        ? t('argus.settings.noReposFound', 'GitHub App에서 접근 가능한 리포지토리가 없습니다')
                        : t('argus.settings.noSearchResults', '검색 결과가 없습니다')}
                    </Typography>
                  ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, maxHeight: 300, overflow: 'auto' }}>
                      {filteredRepos.map((repo: any) => {
                        const url = repo.url || repo.clone_url || repo.html_url || '';
                        const connected = isRepoConnected(url);
                        return (
                          <Paper key={repo.id || url} elevation={0} sx={{
                            p: 1.5, px: 2, display: 'flex', alignItems: 'center', gap: 1.5,
                            border: `1px solid ${bdr}`, borderRadius: '8px',
                            opacity: connected ? 0.5 : 1,
                          }}>
                            <GitHubIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography sx={{ fontWeight: 600, fontSize: '0.82rem' }} noWrap>
                                {repo.full_name || repo.name}
                              </Typography>
                              {repo.description && (
                                <Typography variant="caption" color="text.secondary" noWrap>
                                  {repo.description}
                                </Typography>
                              )}
                            </Box>
                            {connected ? (
                              <Chip label={t('argus.settings.connected', '연결됨')} size="small"
                                sx={{ height: 22, fontSize: '0.65rem', fontWeight: 600, backgroundColor: alpha('#4caf50', 0.1), color: '#4caf50', border: 'none' }}
                              />
                            ) : (
                              <Button size="small" variant="outlined" startIcon={
                                addingRepo === url ? <CircularProgress size={14} color="inherit" /> : <AddIcon />
                              }
                                onClick={() => handleAddRepo(repo)}
                                disabled={!!addingRepo}
                                sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.75rem', borderRadius: '8px', minWidth: 70 }}>
                                {t('common.add', '추가')}
                              </Button>
                            )}
                          </Paper>
                        );
                      })}
                    </Box>
                  )}
                </>
              ) : (
                /* GitLab / Bitbucket — manual URL entry */
                <ManualRepoAdder provider={provider} projectId={projectId}
                  onAdded={async () => {
                    const updated = await argusService.listIntegrations(projectId);
                    onIntegrationsChange(updated);
                  }}
                  isDark={isDark} t={t}
                />
              )}
            </Box>
          </Box>
        )}

        {/* ─── CODE MAPPINGS TAB ─── */}
        {tabIdx === 1 && (
          <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
            <FolderIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
            <Typography sx={{ fontWeight: 700, fontSize: '1rem', mb: 0.5 }}>
              {t('argus.settings.codeMappings', '코드 매핑')}
            </Typography>
            <Typography color="text.secondary" sx={{ fontSize: '0.85rem', textAlign: 'center', maxWidth: 400 }}>
              {t('argus.settings.codeMappingsComingSoon', '코드 매핑 기능은 준비 중입니다. 스택 트레이스와 소스 코드를 연결하여 정확한 위치로 이동할 수 있습니다.')}
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ textTransform: 'none', fontWeight: 600, borderRadius: '8px' }}>
          {t('common.close', '닫기')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

/** Manual repo URL entry for GitLab/Bitbucket */
const ManualRepoAdder: React.FC<{
  provider: string; projectId: number | string;
  onAdded: () => void; isDark: boolean; t: any;
}> = ({ provider, projectId, onAdded, t }) => {
  const { enqueueSnackbar } = useSnackbar();
  const [url, setUrl] = useState('');
  const [branch, setBranch] = useState('main');
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!url.trim()) return;
    setSaving(true);
    try {
      await argusService.createIntegration(projectId, {
        provider, repo_url: url.trim(), default_branch: branch.trim() || 'main',
      });
      enqueueSnackbar(t('argus.settings.repoAdded', '리포지토리가 추가되었습니다'), { variant: 'success' });
      setUrl(''); setBranch('main');
      onAdded();
    } catch {
      enqueueSnackbar(t('argus.settings.repoAddFailed', '추가 실패'), { variant: 'error' });
    } finally { setSaving(false); }
  };

  const placeholder = provider === 'gitlab' ? 'https://gitlab.com/org/repo' : 'https://bitbucket.org/org/repo';

  return (
    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-end' }}>
      <TextField size="small" label={t('argus.settings.repoUrl', 'Repository URL')}
        placeholder={placeholder}
        value={url} onChange={e => setUrl(e.target.value)} sx={{ flex: 3, '& .MuiOutlinedInput-root': { borderRadius: '10px', fontSize: '0.85rem' } }}
      />
      <TextField size="small" label={t('argus.settings.defaultBranch', 'Branch')}
        placeholder="main"
        value={branch} onChange={e => setBranch(e.target.value)} sx={{ flex: 1, '& .MuiOutlinedInput-root': { borderRadius: '10px', fontSize: '0.85rem' } }}
      />
      <Button variant="contained" size="small" onClick={handleAdd} disabled={!url.trim() || saving}
        startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <AddIcon />}
        sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 600, height: 40 }}>
        {t('common.add', '추가')}
      </Button>
    </Box>
  );
};

export default IntegrationConfigureDialog;
