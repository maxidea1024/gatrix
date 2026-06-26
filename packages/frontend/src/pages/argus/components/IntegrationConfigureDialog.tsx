import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Tabs,
  Tab,
  Paper,
  IconButton,
  alpha,
  Avatar,
  Chip,
  TextField,
  Divider,
  CircularProgress,
  Tooltip,
  InputAdornment,
} from '@mui/material';
import {
  Close as CloseIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  GitHub as GitHubIcon,
  CheckCircle as CheckCircleIcon,
  FolderOpen as FolderIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import argusService from '@/services/argusService';
import type { ArgusIntegration } from '@/services/argusService';
import { GitLabIcon, BitbucketIcon } from './ServiceIcons';
import {
  ProviderAvatar,
  RepoCard,
  EmptyReposBox,
} from './IntegrationConfigureDialog.styles';
import { ARGUS_SEMANTIC } from '../argusThemeTokens';

interface IntegrationConfigureDialogProps {
  open: boolean;
  onClose: () => void;
  provider: string | null;
  projectId: number | string;
  integrations: ArgusIntegration[];
  onIntegrationsChange: (integrations: ArgusIntegration[]) => void;
  isDark: boolean;
}

const PROVIDER_INFO: Record<
  string,
  { name: string; color: string; icon: React.ReactNode }
> = {
  github: { name: 'GitHub', color: '#8b949e', icon: <GitHubIcon /> },
  gitlab: { name: 'GitLab', color: '#fc6d26', icon: <GitLabIcon /> },
  bitbucket: { name: 'Bitbucket', color: '#0052CC', icon: <BitbucketIcon /> },
};

export const IntegrationConfigureDialog: React.FC<
  IntegrationConfigureDialogProps
> = ({
  open,
  onClose,
  provider,
  projectId,
  integrations,
  onIntegrationsChange,
  isDark,
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
  const connectedRepos = integrations.filter((i) => i.provider === provider);

  // Load available repos on open
  useEffect(() => {
    if (open && provider === 'github') {
      setReposLoading(true);
      argusService
        .getGithubRepositories()
        .then((repos) => setAvailableRepos(repos))
        .catch(() => setAvailableRepos([]))
        .finally(() => setReposLoading(false));
    }
    if (open) {
      setTabIdx(0);
      setRepoSearch('');
    }
  }, [open, provider]);

  if (!provider) return null;
  const info = PROVIDER_INFO[provider] || {
    name: provider,
    color: '#667eea',
    icon: <GitHubIcon />,
  };

  const filteredRepos = availableRepos.filter((r) => {
    const name = (r.full_name || r.name || '').toLowerCase();
    return name.includes(repoSearch.toLowerCase());
  });

  const isRepoConnected = (repoUrl: string) =>
    connectedRepos.some((i) => i.repo_url === repoUrl);

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
      enqueueSnackbar(t('argus.settings.repoAdded', 'Repository added'), {
        variant: 'success',
      });
    } catch {
      enqueueSnackbar(
        t('argus.settings.repoAddFailed', 'Failed to add repository'),
        { variant: 'error' }
      );
    } finally {
      setAddingRepo(null);
    }
  };

  const handleDeleteRepo = async (id: number) => {
    try {
      await argusService.deleteIntegration(projectId, id);
      onIntegrationsChange(integrations.filter((i) => i.id !== id));
      enqueueSnackbar(t('common.deleted', 'Deleted'), { variant: 'success' });
    } catch {
      enqueueSnackbar(t('common.saveFailed', 'Failed'), { variant: 'error' });
    }
  };

  const bdr = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { borderRadius: '14px', minHeight: 500 } }}
    >
      <DialogTitle
        sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 1 }}
      >
        <ProviderAvatar isDark={isDark}>{info.icon}</ProviderAvatar>
        <Box sx={{ flex: 1 }}>
          <Typography
            sx={{
              fontWeight: 800,
              fontSize: '1.25rem',
              letterSpacing: '-0.02em',
              mb: 0.5,
            }}
          >
            {info.name}{' '}
            {t('argus.settings.integrationSettings', 'Integration Settings')}
          </Typography>
          <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>
            {t(
              'argus.settings.configureIntegrationDesc',
              'Add repositories and manage integration.'
            )}
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <Box sx={{ px: 3, borderBottom: `1px solid ${bdr}` }}>
        <Tabs
          value={tabIdx}
          onChange={(_, v) => setTabIdx(v)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label={t('argus.settings.repositories', 'Repositories')} />
          <Tab label={t('argus.settings.codeMappings', 'Code Mappings')} />
        </Tabs>
      </Box>

      <DialogContent sx={{ p: 0, overflow: 'auto' }}>
        {tabIdx === 0 && (
          <Box
            sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2.5 }}
          >
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', mb: 2 }}>
                {t('argus.settings.connectedRepos', 'Connected Repositories')}
              </Typography>
              {connectedRepos.length === 0 ? (
                <EmptyReposBox isDark={isDark}>
                  <Typography
                    sx={{ fontSize: '0.85rem', color: 'text.secondary', mb: 1 }}
                  >
                    {t(
                      'argus.settings.noConnectedRepos',
                      'No repositories connected'
                    )}
                  </Typography>
                  <Typography
                    sx={{ fontSize: '0.75rem', color: 'text.disabled' }}
                  >
                    {t(
                      'argus.settings.addRepoHint',
                      'Find a repository from the list below and add it'
                    )}
                  </Typography>
                </EmptyReposBox>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {connectedRepos.map((intg) => (
                    <RepoCard key={intg.id} elevation={0} isDark={isDark}>
                      <CheckCircleIcon
                        sx={{ fontSize: 18, color: ARGUS_SEMANTIC.positive }}
                      />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography
                          sx={{ fontWeight: 600, fontSize: '0.82rem' }}
                          noWrap
                        >
                          {intg.repo_url}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {intg.default_branch}
                        </Typography>
                      </Box>
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}
                      >
                        <Chip
                          label={
                            intg.enabled
                              ? t('common.active', 'Active')
                              : t('common.inactive', 'Inactive')
                          }
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: '0.7rem',
                            backgroundColor: intg.enabled
                              ? alpha(ARGUS_SEMANTIC.positive, 0.15)
                              : undefined,
                            color: intg.enabled ? ARGUS_SEMANTIC.positive : undefined,
                          }}
                        />
                        <Tooltip title={t('common.delete', 'Delete')}>
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteRepo(intg.id)}
                            sx={{ '&:hover': { color: '#ef4444' } }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </RepoCard>
                  ))}
                </Box>
              )}
            </Box>
            <Divider />
            <Box>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  mb: 2,
                }}
              >
                <Typography sx={{ fontWeight: 700, fontSize: '0.9rem' }}>
                  {t('argus.settings.availableRepos', 'Available Repositories')}
                </Typography>
                {provider === 'github' && (
                  <Box sx={{ width: 250 }}>
                    <TextField
                      size="small"
                      fullWidth
                      placeholder={t(
                        'argus.settings.searchRepos',
                        'Search repositories...'
                      )}
                      value={repoSearch}
                      onChange={(e) => setRepoSearch(e.target.value)}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon fontSize="small" />
                          </InputAdornment>
                        ),
                        sx: { borderRadius: '8px', fontSize: '0.85rem' },
                      }}
                    />
                  </Box>
                )}
              </Box>
              {provider === 'github' ? (
                reposLoading ? (
                  <Box sx={{ py: 4, textAlign: 'center' }}>
                    <CircularProgress size={28} />
                  </Box>
                ) : filteredRepos.length === 0 ? (
                  <Box sx={{ py: 4, textAlign: 'center' }}>
                    <Typography
                      sx={{ color: 'text.secondary', fontSize: '0.85rem' }}
                    >
                      {availableRepos.length === 0
                        ? t(
                            'argus.settings.noReposFound',
                            'No repositories available for the GitHub App.'
                          )
                        : t(
                            'argus.settings.noSearchResults',
                            'No search results'
                          )}
                    </Typography>
                  </Box>
                ) : (
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 0.5,
                      maxHeight: 300,
                      overflow: 'auto',
                    }}
                  >
                    {filteredRepos.map((repo: any) => {
                      const url =
                        repo.url || repo.clone_url || repo.html_url || '';
                      const isAdded = connectedRepos.some(
                        (i) => i.repo_url === url
                      );
                      return (
                        <RepoCard
                          key={repo.id || url}
                          elevation={0}
                          isDark={isDark}
                          sx={{ borderRadius: '8px' }}
                        >
                          <GitHubIcon
                            sx={{ fontSize: 18, color: 'text.secondary' }}
                          />
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography
                              sx={{ fontWeight: 600, fontSize: '0.82rem' }}
                              noWrap
                            >
                              {repo.full_name || repo.name}
                            </Typography>
                            {repo.description && (
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                noWrap
                              >
                                {repo.description}
                              </Typography>
                            )}
                          </Box>
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                            }}
                          >
                            {isAdded ? (
                              <Chip
                                label={t(
                                  'argus.settings.connected',
                                  'Connected'
                                )}
                                size="small"
                                sx={{
                                  height: 24,
                                  fontSize: '0.75rem',
                                  backgroundColor: alpha(ARGUS_SEMANTIC.positive, 0.1),
                                  color: ARGUS_SEMANTIC.positive,
                                }}
                              />
                            ) : (
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => handleAddRepo(repo)}
                                disabled={addingRepo === url}
                                startIcon={
                                  addingRepo === url ? (
                                    <CircularProgress size={14} />
                                  ) : (
                                    <AddIcon fontSize="small" />
                                  )
                                }
                                sx={{
                                  textTransform: 'none',
                                  borderRadius: '6px',
                                  py: 0.3,
                                }}
                              >
                                {t('common.add', 'Add')}
                              </Button>
                            )}
                          </Box>
                        </RepoCard>
                      );
                    })}
                  </Box>
                )
              ) : (
                <ManualRepoAdder
                  provider={provider}
                  projectId={projectId}
                  onAdded={(res) =>
                    onIntegrationsChange([res, ...integrations])
                  }
                  isDark={isDark}
                  t={t}
                />
              )}
            </Box>
          </Box>
        )}
        {tabIdx === 1 && (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography sx={{ fontWeight: 700, fontSize: '1rem', mb: 1 }}>
              {t('argus.settings.codeMappings', 'Code Mappings')}
            </Typography>
            <Typography sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>
              {t(
                'argus.settings.codeMappingsComingSoon',
                'Code mapping feature will be supported soon.'
              )}
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2, borderTop: `1px solid ${bdr}` }}>
        <Button
          onClick={onClose}
          sx={{ color: 'text.secondary', fontWeight: 600 }}
        >
          {t('common.close', 'Close')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const ManualRepoAdder: React.FC<{
  provider: string;
  projectId: number | string;
  onAdded: (res: any) => void;
  isDark: boolean;
  t: any;
}> = ({ provider, projectId, onAdded, t }) => {
  const { enqueueSnackbar } = useSnackbar();
  const [localAddUrl, setLocalAddUrl] = useState('');
  const [localAddBranch, setLocalAddBranch] = useState('main');
  const [adding, setAdding] = useState<string | null>(null);

  const handleLocalAdd = async () => {
    if (!localAddUrl.trim()) return;
    setAdding('local');
    try {
      const res = await argusService.createIntegration(projectId, {
        provider,
        repo_url: localAddUrl.trim(),
        default_branch: localAddBranch.trim() || 'main',
      });
      enqueueSnackbar(t('argus.settings.repoAdded', 'Repository added'), {
        variant: 'success',
      });
      setLocalAddUrl('');
      setLocalAddBranch('main');
      onAdded(res);
    } catch {
      enqueueSnackbar(t('argus.settings.repoAddFailed', 'Failed to add'), {
        variant: 'error',
      });
    } finally {
      setAdding(null);
    }
  };

  return (
    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-end' }}>
      <TextField
        size="small"
        label={t('argus.settings.repoUrl', 'Repository URL')}
        placeholder={
          provider === 'gitlab'
            ? 'https://gitlab.com/org/repo'
            : 'https://bitbucket.org/org/repo'
        }
        value={localAddUrl}
        onChange={(e) => setLocalAddUrl(e.target.value)}
        sx={{
          flex: 3,
          '& .MuiOutlinedInput-root': {
            borderRadius: '10px',
            fontSize: '0.85rem',
          },
        }}
      />
      <TextField
        size="small"
        label={t('argus.settings.defaultBranch', 'Branch')}
        placeholder="main"
        value={localAddBranch}
        onChange={(e) => setLocalAddBranch(e.target.value)}
        sx={{
          flex: 1,
          '& .MuiOutlinedInput-root': {
            borderRadius: '10px',
            fontSize: '0.85rem',
          },
        }}
      />
      <Button
        variant="contained"
        disabled={adding === 'local' || !localAddUrl.trim()}
        onClick={handleLocalAdd}
        startIcon={
          adding === 'local' ? (
            <CircularProgress size={14} color="inherit" />
          ) : (
            <AddIcon fontSize="small" />
          )
        }
        sx={{
          textTransform: 'none',
          fontWeight: 600,
          px: 3,
          borderRadius: '8px',
        }}
      >
        {t('common.add', 'Add')}
      </Button>
    </Box>
  );
};

export default IntegrationConfigureDialog;
