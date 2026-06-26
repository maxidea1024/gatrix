import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Link,
  Paper,
  Avatar,
  Chip,
  IconButton,
  alpha,
} from '@mui/material';
import {
  GitHub as GitHubIcon,
  Cloud as CloudIcon,
  Storage as StorageIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import {
  SettingsCard,
  ProviderCard,
  ConfigDialog,
  ProviderFieldDef,
  EmptyState,
} from './components/SettingsShared';
import { GlobalIntegrationWizardModal } from '../components/GlobalIntegrationWizardModal';
import argusService, { ArgusIntegration } from '@/services/argusService';
import PageContentLoader from '@/components/common/PageContentLoader';
import { ARGUS_SEMANTIC } from '../argusThemeTokens';

interface RepoProviderDef {
  id: string;
  name: string;
  descKey: string;
  icon: React.ReactNode;
  color: string;
  fields: ProviderFieldDef[];
}

const REPO_PROVIDERS: RepoProviderDef[] = [
  {
    id: 'github',
    name: 'GitHub',
    color: '#8b949e',
    descKey: 'argus.settings.githubDesc',
    icon: <GitHubIcon />,
    fields: [
      {
        key: 'repo_url',
        labelKey: 'argus.settings.repoUrl',
        labelFallback: 'Repository URL',
        placeholder: 'https://github.com/org/repo',
      },
      {
        key: 'default_branch',
        labelKey: 'argus.settings.defaultBranch',
        labelFallback: 'Default Branch',
        placeholder: 'main',
      },
      {
        key: 'access_token',
        labelKey: 'argus.settings.trackerApiToken',
        labelFallback: 'Access Token (Optional)',
        placeholder: '••••••••',
        type: 'password',
      },
    ],
  },
  {
    id: 'gitlab',
    name: 'GitLab',
    color: '#fc6d26',
    descKey: 'argus.settings.gitlabDesc',
    icon: <CloudIcon />,
    fields: [
      {
        key: 'repo_url',
        labelKey: 'argus.settings.repoUrl',
        labelFallback: 'Repository URL',
        placeholder: 'https://gitlab.com/org/repo',
      },
      {
        key: 'default_branch',
        labelKey: 'argus.settings.defaultBranch',
        labelFallback: 'Default Branch',
        placeholder: 'main',
      },
      {
        key: 'access_token',
        labelKey: 'argus.settings.trackerApiToken',
        labelFallback: 'Access Token (Optional)',
        placeholder: '••••••••',
        type: 'password',
      },
    ],
  },
  {
    id: 'bitbucket',
    name: 'Bitbucket',
    color: '#0052CC',
    descKey: 'argus.settings.bitbucketDesc',
    icon: <StorageIcon />,
    fields: [
      {
        key: 'repo_url',
        labelKey: 'argus.settings.repoUrl',
        labelFallback: 'Repository URL',
        placeholder: 'https://bitbucket.org/org/repo',
      },
      {
        key: 'default_branch',
        labelKey: 'argus.settings.defaultBranch',
        labelFallback: 'Default Branch',
        placeholder: 'main',
      },
      {
        key: 'access_token',
        labelKey: 'argus.settings.trackerApiToken',
        labelFallback: 'Access Token (Optional)',
        placeholder: '••••••••',
        type: 'password',
      },
    ],
  },
];

interface IntegrationsSettingsProps {
  projectId: string;
  isDark: boolean;
  t: any;
}

export const IntegrationsSettings: React.FC<IntegrationsSettingsProps> = ({
  projectId,
  isDark,
  t,
}) => {
  const { enqueueSnackbar } = useSnackbar();

  const [integrations, setIntegrations] = useState<ArgusIntegration[]>([]);
  const [globalConfigs, setGlobalConfigs] = useState<
    Record<string, { configured: boolean; name?: string; url?: string }>
  >({});
  const [intLoaded, setIntLoaded] = useState(false);

  const [addIntDialog, setAddIntDialog] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [dynamicFields, setDynamicFields] = useState<ProviderFieldDef[]>([]);

  // Setup Wizard Modal
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardProvider, setWizardProvider] = useState<
    'github' | 'gitlab' | 'bitbucket'
  >('github');

  const loadIntegrations = async () => {
    try {
      const list = await argusService.listIntegrations(projectId);
      setIntegrations(list);

      // Load global configurations for github, gitlab, bitbucket
      const configs: Record<
        string,
        { configured: boolean; name?: string; url?: string }
      > = {};
      for (const prov of ['github', 'gitlab', 'bitbucket']) {
        try {
          const res = await argusService.getGlobalIntegrationConfig(prov);
          configs[prov] = {
            configured: res?.configured || false,
            name: res?.config?.name || undefined,
            url: res?.config?.url || undefined,
          };
        } catch {
          configs[prov] = { configured: false };
        }
      }
      setGlobalConfigs(configs);
      setIntLoaded(true);
    } catch {
      setIntLoaded(true);
    }
  };

  useEffect(() => {
    loadIntegrations();
  }, [projectId]);

  const handleAddIntegration = async () => {
    if (!addIntDialog) return;
    try {
      await argusService.createIntegration(projectId, {
        provider: addIntDialog,
        repo_url: formData.repo_url?.trim() || '',
        default_branch: formData.default_branch?.trim() || 'main',
        access_token: formData.access_token?.trim(),
      });
      await loadIntegrations();
      setAddIntDialog(null);
      setFormData({});
    } catch {
      enqueueSnackbar(t('argus.settings.integrationFailed'), {
        variant: 'error',
      });
    }
  };

  const handleDisconnectGlobal = async (provider: string) => {
    try {
      await argusService.deleteGlobalIntegrationConfig(provider);
      await loadIntegrations();
      enqueueSnackbar(
        t(
          'argus.settings.integrationDisconnected',
          'Global App disconnected successfully.'
        ),
        { variant: 'success' }
      );
    } catch {
      enqueueSnackbar(
        t(
          'argus.settings.integrationDisconnectFailed',
          'Failed to disconnect.'
        ),
        { variant: 'error' }
      );
    }
  };

  const getRepoDisplayName = (url: string) => {
    return url
      .replace(/^https:\/\/github\.com\//, '')
      .replace(/^https:\/\/gitlab\.com\//, '')
      .replace(/^https:\/\/bitbucket\.org\//, '');
  };

  const handleOpenAddRepoDialog = async (provId: string) => {
    const prov = REPO_PROVIDERS.find((p) => p.id === provId);
    if (!prov) return;

    let finalFields = prov.fields;
    if (provId === 'github') {
      try {
        const repos = await argusService.getGithubRepositories();
        finalFields = prov.fields
          .map((f) => {
            if (f.key === 'repo_url') {
              return {
                ...f,
                type: 'select',
                options: repos.map((r) => ({
                  value: r.url,
                  label: r.full_name,
                })),
              };
            }
            if (f.key === 'access_token') return null;
            return f;
          })
          .filter(Boolean) as ProviderFieldDef[];
      } catch (e) {
        console.error('Failed to load GitHub repos', e);
      }
    }
    setDynamicFields(finalFields);
    setAddIntDialog(provId);
    setFormData({ default_branch: 'main' });
  };

  const inpSx = {
    '& .MuiOutlinedInput-root': {
      borderRadius: '8px',
      fontSize: '0.875rem',
    },
  };

  const availableProviders = REPO_PROVIDERS.filter(
    (prov) => !globalConfigs[prov.id]?.configured
  );

  return (
    <PageContentLoader loading={!intLoaded}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* 1. Available Providers - Only show those not globally configured */}
        {availableProviders.length > 0 && (
          <SettingsCard
            title={t(
              'argus.settings.availableProviders',
              'Available Providers'
            )}
            desc={t(
              'argus.settings.availableProvidersDesc',
              'Connect external repository providers.'
            )}
            isDark={isDark}
          >
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: 2,
              }}
            >
              {availableProviders.map((prov) => (
                <ProviderCard
                  key={prov.id}
                  prov={prov}
                  isDark={isDark}
                  t={t}
                  count={0}
                  onAdd={() => {
                    setWizardProvider(
                      prov.id as 'github' | 'gitlab' | 'bitbucket'
                    );
                    setWizardOpen(true);
                  }}
                />
              ))}
            </Box>
          </SettingsCard>
        )}

        {/* 2. Connected Integrations (Sentry Style) */}
        {intLoaded &&
          REPO_PROVIDERS.map((prov) => {
            const configInfo = globalConfigs[prov.id];
            const isConfigured = configInfo?.configured;
            if (!isConfigured) return null;

            const provRepos = integrations.filter(
              (i) => i.provider === prov.id
            );
            const bdr = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';

            return (
              <SettingsCard
                key={prov.id}
                title={`${prov.name} ${t('argus.settings.integration', 'Integration')}`}
                desc={t(
                  'argus.settings.integrationDesc',
                  '{{name}} App is configured. Connect repositories to link commits, PRs, and releases.',
                  { name: prov.name }
                )}
                isDark={isDark}
                headerAction={
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<AddIcon />}
                      onClick={() => handleOpenAddRepoDialog(prov.id)}
                      sx={{
                        textTransform: 'none',
                        borderRadius: '8px',
                        fontWeight: 600,
                        fontSize: '0.78rem',
                      }}
                    >
                      {t(
                        'argus.settings.addRepositoryConnection',
                        'Add Repository'
                      )}
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      variant="outlined"
                      onClick={() => handleDisconnectGlobal(prov.id)}
                      sx={{
                        textTransform: 'none',
                        borderRadius: '8px',
                        fontSize: '0.78rem',
                      }}
                    >
                      {t('argus.settings.disconnect', 'Disconnect')}
                    </Button>
                  </Box>
                }
              >
                {/* Global App installation info box */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    p: 2,
                    mb: 2.5,
                    borderRadius: '8px',
                    border: `1px solid ${bdr}`,
                    backgroundColor: isDark
                      ? 'rgba(255,255,255,0.02)'
                      : 'rgba(0,0,0,0.01)',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Avatar
                      sx={{
                        width: 32,
                        height: 32,
                        backgroundColor: alpha(prov.color, 0.1),
                        color: prov.color,
                      }}
                    >
                      {prov.icon}
                    </Avatar>
                    <Box>
                      <Typography sx={{ fontWeight: 600, fontSize: '0.85rem' }}>
                        {configInfo.name || `${prov.name} App`}
                      </Typography>
                      {configInfo.url && (
                        <Link
                          href={configInfo.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          sx={{
                            fontSize: '0.75rem',
                            color: 'text.secondary',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                            '&:hover': { textDecoration: 'underline' },
                          }}
                        >
                          {configInfo.url}
                        </Link>
                      )}
                    </Box>
                  </Box>
                  <Chip
                    label={t('argus.settings.connectedStatus', 'Connected')}
                    size="small"
                    sx={{
                      height: 22,
                      fontWeight: 600,
                      fontSize: '0.72rem',
                      backgroundColor: alpha(ARGUS_SEMANTIC.positive, 0.12),
                      color: ARGUS_SEMANTIC.positive,
                    }}
                  />
                </Box>

                {/* Repository Table list */}
                {provRepos.length === 0 ? (
                  <EmptyState
                    icon={prov.icon}
                    text={t(
                      'argus.settings.noConnectedRepos',
                      'No repositories connected.'
                    )}
                    hint={t(
                      'argus.settings.addRepoHintGlobal',
                      "Click 'Add Repository' button to select a repository to connect."
                    )}
                  />
                ) : (
                  <TableContainer
                    component={Paper}
                    elevation={0}
                    sx={{
                      border: `1px solid ${bdr}`,
                      borderRadius: '8px',
                      overflow: 'hidden',
                    }}
                  >
                    <Table size="small">
                      <TableHead>
                        <TableRow
                          sx={{
                            backgroundColor: isDark
                              ? 'rgba(255,255,255,0.02)'
                              : 'rgba(0,0,0,0.01)',
                          }}
                        >
                          <TableCell sx={{ fontWeight: 600, py: 1.2 }}>
                            {t('argus.settings.repository', 'Repository')}
                          </TableCell>
                          <TableCell sx={{ fontWeight: 600, py: 1.2 }}>
                            {t(
                              'argus.settings.defaultBranch',
                              'Default Branch'
                            )}
                          </TableCell>
                          <TableCell sx={{ fontWeight: 600, py: 1.2 }}>
                            {t('argus.settings.status', 'Status')}
                          </TableCell>
                          <TableCell sx={{ fontWeight: 600, py: 1.2 }}>
                            {t(
                              'argus.settings.connectedDate',
                              'Connected Date'
                            )}
                          </TableCell>
                          <TableCell
                            align="right"
                            sx={{ fontWeight: 600, py: 1.2, pr: 2 }}
                          >
                            {t('common.actions', 'Actions')}
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {provRepos.map((intg) => (
                          <TableRow
                            key={intg.id}
                            sx={{
                              '&:last-child td, &:last-child th': { border: 0 },
                            }}
                          >
                            <TableCell sx={{ py: 1.2 }}>
                              <Box
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 1.5,
                                }}
                              >
                                <Link
                                  href={intg.repo_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  sx={{
                                    fontWeight: 600,
                                    fontSize: '0.85rem',
                                    textDecoration: 'none',
                                    color: 'primary.main',
                                    '&:hover': { textDecoration: 'underline' },
                                  }}
                                >
                                  {getRepoDisplayName(intg.repo_url)}
                                </Link>
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={intg.default_branch}
                                size="small"
                                sx={{
                                  height: 18,
                                  fontSize: '0.72rem',
                                  backgroundColor: isDark
                                    ? 'rgba(255,255,255,0.06)'
                                    : 'rgba(0,0,0,0.05)',
                                  borderRadius: '4px',
                                }}
                              />
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={
                                  intg.enabled
                                    ? t(
                                        'argus.settings.connectedStatus',
                                        'Connected'
                                      )
                                    : t(
                                        'argus.settings.disabledStatus',
                                        'Disabled'
                                      )
                                }
                                size="small"
                                sx={{
                                  height: 18,
                                  fontSize: '0.72rem',
                                  fontWeight: 600,
                                  backgroundColor: alpha(
                                    intg.enabled
                                      ? ARGUS_SEMANTIC.positive
                                      : '#9e9e9e',
                                    0.12
                                  ),
                                  color: intg.enabled
                                    ? ARGUS_SEMANTIC.positive
                                    : '#9e9e9e',
                                  border: 'none',
                                }}
                              />
                            </TableCell>
                            <TableCell
                              sx={{
                                fontSize: '0.78rem',
                                color: 'text.secondary',
                              }}
                            >
                              {new Date(intg.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell align="right" sx={{ pr: 1.5 }}>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={async () => {
                                  await argusService.deleteIntegration(
                                    projectId,
                                    intg.id
                                  );
                                  setIntegrations((p) =>
                                    p.filter((i) => i.id !== intg.id)
                                  );
                                  enqueueSnackbar(t('common.deleted'), {
                                    variant: 'success',
                                  });
                                }}
                                sx={{
                                  '&:hover': {
                                    backgroundColor: isDark
                                      ? 'rgba(244, 67, 54, 0.12)'
                                      : 'rgba(211, 47, 47, 0.08)',
                                  },
                                }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </SettingsCard>
            );
          })}

        {/* ═══ ADD INTEGRATION DIALOG ═══ */}
        <ConfigDialog
          open={!!addIntDialog}
          onClose={() => {
            setAddIntDialog(null);
            setFormData({});
          }}
          provider={REPO_PROVIDERS.find((p) => p.id === addIntDialog) || null}
          fields={dynamicFields}
          formData={formData}
          setFormData={setFormData}
          onSubmit={handleAddIntegration}
          submitDisabled={!formData.repo_url?.trim()}
          isDark={isDark}
          t={t}
          inpSx={inpSx}
        />

        <GlobalIntegrationWizardModal
          open={wizardOpen}
          provider={wizardProvider}
          onClose={() => setWizardOpen(false)}
          onSuccess={async () => {
            setWizardOpen(false);
            await loadIntegrations();
            enqueueSnackbar(
              t('argus.settings.appConnected', 'App connected successfully.'),
              { variant: 'success' }
            );
          }}
        />
      </Box>
    </PageContentLoader>
  );
};

export default IntegrationsSettings;
