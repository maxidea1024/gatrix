import React, { useState, useEffect } from 'react';
import { Box } from '@mui/material';
import {
  GitHub as GitHubIcon,
  BugReport as BugIcon,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import {
  SettingsCard,
  ProviderCard,
  ConnectedItem,
} from './components/SettingsShared';
import {
  ProviderWizardModal,
  WizardProviderConfig,
  WizardFieldDef,
} from '../components/ProviderWizardModal';
import argusService, { ArgusIssueTracker } from '@/services/argusService';
import { TRACKER_HELP_LINKS } from './trackerHelpLinks';
import PageContentLoader from '@/components/common/PageContentLoader';

const TRACKER_PROVIDERS = [
  {
    id: 'jira',
    name: 'Jira',
    color: '#0052CC',
    gradient: 'linear-gradient(160deg, #003087 0%, #0052CC 40%, #2684FF 100%)',
    accentColor: '#2684FF',
    descKey: 'argus.settings.jiraDesc',
    icon: <BugIcon />,
    baseFields: [
      {
        key: 'name',
        labelKey: 'argus.settings.trackerName',
        labelFallback: 'Display Name',
        placeholder: 'My Jira',
      },
      {
        key: 'api_url',
        labelKey: 'argus.settings.trackerApiUrl',
        labelFallback: 'Jira URL',
        placeholder: 'https://myorg.atlassian.net',
      },
      {
        key: 'api_token',
        labelKey: 'argus.settings.trackerApiToken',
        labelFallback: 'API Token',
        placeholder: '',
        type: 'password',
      },
    ],
    configFields: [
      {
        key: 'project_key',
        labelKey: 'argus.settings.jiraProjectKey',
        labelFallback: 'Project Key',
        placeholder: 'PROJ',
      },
      {
        key: 'email',
        labelKey: 'argus.settings.jiraEmail',
        labelFallback: 'Email',
        placeholder: 'user@company.com',
      },
      {
        key: 'issue_type',
        labelKey: 'argus.settings.jiraIssueType',
        labelFallback: 'Issue Type',
        placeholder: 'Bug',
      },
    ],
  },
  {
    id: 'github',
    name: 'GitHub Issues',
    color: '#8b949e',
    gradient: 'linear-gradient(160deg, #0d1117 0%, #161b22 40%, #1a2332 100%)',
    accentColor: '#58a6ff',
    descKey: 'argus.settings.githubIssuesDesc',
    icon: <GitHubIcon />,
    baseFields: [
      {
        key: 'name',
        labelKey: 'argus.settings.trackerName',
        labelFallback: 'Display Name',
        placeholder: 'GitHub Issues',
      },
      {
        key: 'api_url',
        labelKey: 'argus.settings.trackerApiUrl',
        labelFallback: 'API URL',
        placeholder: 'https://api.github.com',
      },
      {
        key: 'api_token',
        labelKey: 'argus.settings.trackerApiToken',
        labelFallback: 'Personal Access Token',
        placeholder: '',
        type: 'password',
      },
    ],
    configFields: [
      {
        key: 'repo',
        labelKey: 'argus.settings.githubRepo',
        labelFallback: 'Repository',
        placeholder: 'owner/repo',
      },
    ],
  },
  {
    id: 'linear',
    name: 'Linear',
    color: '#5E6AD2',
    gradient: 'linear-gradient(160deg, #2E3192 0%, #4A4FC4 40%, #5E6AD2 100%)',
    accentColor: '#818CF8',
    descKey: 'argus.settings.linearDesc',
    icon: <BugIcon />,
    baseFields: [
      {
        key: 'name',
        labelKey: 'argus.settings.trackerName',
        labelFallback: 'Display Name',
        placeholder: 'Linear',
      },
      {
        key: 'api_url',
        labelKey: 'argus.settings.trackerApiUrl',
        labelFallback: 'API URL',
        placeholder: 'https://api.linear.app',
      },
      {
        key: 'api_token',
        labelKey: 'argus.settings.trackerApiToken',
        labelFallback: 'API Key',
        placeholder: '',
        type: 'password',
      },
    ],
    configFields: [
      {
        key: 'team_id',
        labelKey: 'argus.settings.linearTeamId',
        labelFallback: 'Team ID',
        placeholder: 'team-uuid',
      },
    ],
  },
  {
    id: 'clickup',
    name: 'ClickUp',
    color: '#7B68EE',
    gradient: 'linear-gradient(160deg, #4B0082 0%, #7B68EE 40%, #9370DB 100%)',
    accentColor: '#9370DB',
    descKey: 'argus.settings.clickupDesc',
    icon: <BugIcon />,
    baseFields: [
      {
        key: 'name',
        labelKey: 'argus.settings.trackerName',
        labelFallback: 'Display Name',
        placeholder: 'ClickUp',
      },
      {
        key: 'api_url',
        labelKey: 'argus.settings.trackerApiUrl',
        labelFallback: 'API URL',
        placeholder: 'https://api.clickup.com',
      },
      {
        key: 'api_token',
        labelKey: 'argus.settings.trackerApiToken',
        labelFallback: 'API Token',
        placeholder: '',
        type: 'password',
      },
    ],
    configFields: [
      {
        key: 'list_id',
        labelKey: 'argus.settings.clickupListId',
        labelFallback: 'List ID',
        placeholder: '12345678',
      },
    ],
  },
  {
    id: 'asana',
    name: 'Asana',
    color: '#F06A6A',
    gradient: 'linear-gradient(160deg, #B22222 0%, #F06A6A 40%, #FA8072 100%)',
    accentColor: '#FA8072',
    descKey: 'argus.settings.asanaDesc',
    icon: <BugIcon />,
    baseFields: [
      {
        key: 'name',
        labelKey: 'argus.settings.trackerName',
        labelFallback: 'Display Name',
        placeholder: 'Asana',
      },
      {
        key: 'api_url',
        labelKey: 'argus.settings.trackerApiUrl',
        labelFallback: 'API URL',
        placeholder: 'https://app.asana.com/api/1.0',
      },
      {
        key: 'api_token',
        labelKey: 'argus.settings.trackerApiToken',
        labelFallback: 'Personal Access Token',
        placeholder: '',
        type: 'password',
      },
    ],
    configFields: [
      {
        key: 'project_gid',
        labelKey: 'argus.settings.asanaProjectGid',
        labelFallback: 'Project GID',
        placeholder: '123456789012345',
      },
    ],
  },
  {
    id: 'notion',
    name: 'Notion',
    color: '#000000',
    gradient: 'linear-gradient(160deg, #000000 0%, #333333 40%, #666666 100%)',
    accentColor: '#888888',
    descKey: 'argus.settings.notionDesc',
    icon: <BugIcon />,
    baseFields: [
      {
        key: 'name',
        labelKey: 'argus.settings.trackerName',
        labelFallback: 'Display Name',
        placeholder: 'Notion',
      },
      {
        key: 'api_url',
        labelKey: 'argus.settings.trackerApiUrl',
        labelFallback: 'API URL',
        placeholder: 'https://api.notion.com',
      },
      {
        key: 'api_token',
        labelKey: 'argus.settings.trackerApiToken',
        labelFallback: 'Integration Secret',
        placeholder: '',
        type: 'password',
      },
    ],
    configFields: [
      {
        key: 'database_id',
        labelKey: 'argus.settings.notionDbId',
        labelFallback: 'Database ID',
        placeholder: 'abcd1234abcd1234',
      },
      {
        key: 'title_property',
        labelKey: 'argus.settings.notionTitleProp',
        labelFallback: 'Title Property Name',
        placeholder: 'Name',
      },
    ],
  },
  {
    id: 'shortcut',
    name: 'Shortcut',
    color: '#3A9FA0',
    gradient: 'linear-gradient(160deg, #006064 0%, #3A9FA0 40%, #4DD0E1 100%)',
    accentColor: '#4DD0E1',
    descKey: 'argus.settings.shortcutDesc',
    icon: <BugIcon />,
    baseFields: [
      {
        key: 'name',
        labelKey: 'argus.settings.trackerName',
        labelFallback: 'Display Name',
        placeholder: 'Shortcut',
      },
      {
        key: 'api_url',
        labelKey: 'argus.settings.trackerApiUrl',
        labelFallback: 'API URL',
        placeholder: 'https://api.app.shortcut.com',
      },
      {
        key: 'api_token',
        labelKey: 'argus.settings.trackerApiToken',
        labelFallback: 'API Token',
        placeholder: '',
        type: 'password',
      },
    ],
    configFields: [
      {
        key: 'project_id',
        labelKey: 'argus.settings.shortcutProjectId',
        labelFallback: 'Project ID',
        placeholder: '123',
      },
    ],
  },
  {
    id: 'azure_devops',
    name: 'Azure DevOps',
    color: '#0078D7',
    gradient: 'linear-gradient(160deg, #004578 0%, #0078D7 40%, #00BFFF 100%)',
    accentColor: '#00BFFF',
    descKey: 'argus.settings.azureDevOpsDesc',
    icon: <BugIcon />,
    baseFields: [
      {
        key: 'name',
        labelKey: 'argus.settings.trackerName',
        labelFallback: 'Display Name',
        placeholder: 'Azure DevOps',
      },
      {
        key: 'api_url',
        labelKey: 'argus.settings.trackerApiUrl',
        labelFallback: 'API URL',
        placeholder: 'https://dev.azure.com',
      },
      {
        key: 'api_token',
        labelKey: 'argus.settings.trackerApiToken',
        labelFallback: 'Personal Access Token',
        placeholder: '',
        type: 'password',
      },
    ],
    configFields: [
      {
        key: 'organization',
        labelKey: 'argus.settings.azureOrg',
        labelFallback: 'Organization',
        placeholder: 'my-org',
      },
      {
        key: 'project',
        labelKey: 'argus.settings.azureProject',
        labelFallback: 'Project',
        placeholder: 'my-project',
      },
    ],
  },
  {
    id: 'redmine',
    name: 'Redmine',
    color: '#A30000',
    gradient: 'linear-gradient(160deg, #660000 0%, #A30000 40%, #E60000 100%)',
    accentColor: '#E60000',
    descKey: 'argus.settings.redmineDesc',
    icon: <BugIcon />,
    baseFields: [
      {
        key: 'name',
        labelKey: 'argus.settings.trackerName',
        labelFallback: 'Display Name',
        placeholder: 'Redmine',
      },
      {
        key: 'api_url',
        labelKey: 'argus.settings.trackerApiUrl',
        labelFallback: 'API URL',
        placeholder: 'https://redmine.example.com',
      },
      {
        key: 'api_token',
        labelKey: 'argus.settings.trackerApiToken',
        labelFallback: 'API Key',
        placeholder: '',
        type: 'password',
      },
    ],
    configFields: [
      {
        key: 'project_id',
        labelKey: 'argus.settings.redmineProjectId',
        labelFallback: 'Project ID',
        placeholder: '123',
      },
      {
        key: 'tracker_id',
        labelKey: 'argus.settings.redmineTrackerId',
        labelFallback: 'Tracker ID (1 for Bug)',
        placeholder: '1',
      },
    ],
  },
  {
    id: 'youtrack',
    name: 'YouTrack',
    color: '#000000',
    gradient: 'linear-gradient(160deg, #000000 0%, #333333 40%, #666666 100%)',
    accentColor: '#888888',
    descKey: 'argus.settings.youtrackDesc',
    icon: <BugIcon />,
    baseFields: [
      {
        key: 'name',
        labelKey: 'argus.settings.trackerName',
        labelFallback: 'Display Name',
        placeholder: 'YouTrack',
      },
      {
        key: 'api_url',
        labelKey: 'argus.settings.trackerApiUrl',
        labelFallback: 'API URL',
        placeholder: 'https://youtrack.example.com',
      },
      {
        key: 'api_token',
        labelKey: 'argus.settings.trackerApiToken',
        labelFallback: 'Permanent Token',
        placeholder: '',
        type: 'password',
      },
    ],
    configFields: [
      {
        key: 'project_id',
        labelKey: 'argus.settings.youtrackProjectId',
        labelFallback: 'Project Short Name',
        placeholder: 'PROJ',
      },
    ],
  },
  {
    id: 'trello',
    name: 'Trello',
    color: '#0079BF',
    gradient: 'linear-gradient(160deg, #026AA7 0%, #0079BF 40%, #00AECC 100%)',
    accentColor: '#00AECC',
    descKey: 'argus.settings.trelloDesc',
    icon: <BugIcon />,
    baseFields: [
      {
        key: 'name',
        labelKey: 'argus.settings.trackerName',
        labelFallback: 'Display Name',
        placeholder: 'Trello',
      },
      {
        key: 'api_url',
        labelKey: 'argus.settings.trackerApiUrl',
        labelFallback: 'API URL',
        placeholder: 'https://api.trello.com',
      },
      {
        key: 'api_token',
        labelKey: 'argus.settings.trackerApiToken',
        labelFallback: 'Token',
        placeholder: '',
        type: 'password',
      },
    ],
    configFields: [
      {
        key: 'api_key',
        labelKey: 'argus.settings.trelloApiKey',
        labelFallback: 'API Key',
        placeholder: 'abcd1234abcd1234',
      },
      {
        key: 'list_id',
        labelKey: 'argus.settings.trelloListId',
        labelFallback: 'List ID',
        placeholder: 'abcd1234abcd1234',
      },
    ],
  },
];

interface IssueTrackersSettingsProps {
  projectId: string;
  isDark: boolean;
  t: any;
  onChange?: () => void;
}

export const IssueTrackersSettings: React.FC<IssueTrackersSettingsProps> = ({
  projectId,
  isDark,
  t,
  onChange,
}) => {
  const { enqueueSnackbar } = useSnackbar();

  const [trackers, setTrackers] = useState<ArgusIssueTracker[]>([]);
  const [trkLoaded, setTrkLoaded] = useState(false);
  const [addTrkDialog, setAddTrkDialog] = useState<string | null>(null);

  const loadTrackers = async () => {
    try {
      const list = await argusService.listIssueTrackers(projectId);
      setTrackers(list);
      setTrkLoaded(true);
      onChange?.();
    } catch {
      setTrkLoaded(true);
    }
  };

  useEffect(() => {
    loadTrackers();
  }, [projectId]);

  return (
    <PageContentLoader loading={!trkLoaded}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <SettingsCard
          title={t('argus.settings.availableTrackers')}
          desc={t('argus.settings.issueTrackersDesc')}
          isDark={isDark}
        >
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 2,
            }}
          >
            {TRACKER_PROVIDERS.map((prov) => (
              <ProviderCard
                key={prov.id}
                prov={prov}
                isDark={isDark}
                t={t}
                count={trackers.filter((tr) => tr.provider === prov.id).length}
                onAdd={() => {
                  setAddTrkDialog(prov.id);
                }}
              />
            ))}
          </Box>
        </SettingsCard>
        {trkLoaded && trackers.length > 0 && (
          <SettingsCard
            title={t('argus.settings.configuredTrackers')}
            desc={t('argus.settings.configuredTrackersDesc')}
            isDark={isDark}
          >
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: 2,
              }}
            >
              {trackers.map((trk) => {
                const prov = TRACKER_PROVIDERS.find(
                  (p) => p.id === trk.provider
                );
                return (
                  <ConnectedItem
                    key={trk.id}
                    isDark={isDark}
                    color={prov?.color || '#666'}
                    icon={prov?.icon || <BugIcon sx={{ fontSize: 18 }} />}
                    title={trk.name}
                    chipLabel={prov?.name || trk.provider}
                    subtitle={`${trk.api_url}${trk.config?.project_key ? ` · ${trk.config.project_key}` : ''}${trk.config?.repo ? ` · ${trk.config.repo}` : ''}`}
                    active={trk.enabled}
                    t={t}
                    onToggle={async () => {
                      await argusService.updateIssueTracker(projectId, trk.id, {
                        enabled: !trk.enabled,
                      });
                      await loadTrackers();
                    }}
                    onTest={async () => {
                      try {
                        const r = await argusService.testIssueTracker(
                          projectId,
                          trk.id
                        );
                        enqueueSnackbar(
                          r.ok ? r.message : `Failed: ${r.message}`,
                          { variant: r.ok ? 'success' : 'error' }
                        );
                      } catch {
                        enqueueSnackbar(t('argus.settings.testFailed'), {
                          variant: 'error',
                        });
                      }
                    }}
                    onDelete={async () => {
                      await argusService.deleteIssueTracker(projectId, trk.id);
                      setTrackers((p) => p.filter((i) => i.id !== trk.id));
                      enqueueSnackbar(t('common.deleted'), {
                        variant: 'success',
                      });
                    }}
                  />
                );
              })}
            </Box>
          </SettingsCard>
        )}

        {/* ═══ ADD TRACKER WIZARD ═══ */}
        {(() => {
          const tp = TRACKER_PROVIDERS.find((p) => p.id === addTrkDialog);
          if (!tp) return null;
          const wizardCfg: WizardProviderConfig = {
            id: tp.id,
            name: tp.name,
            color: tp.color,
            gradient: tp.gradient,
            accentColor: tp.accentColor,
            icon: tp.icon,
            descKey: tp.descKey,
          };
          const providerHelp = TRACKER_HELP_LINKS[tp.id] || {};
          const allFields: WizardFieldDef[] = [
            ...tp.baseFields,
            ...tp.configFields,
          ].map((f) => ({
            ...f,
            required:
              f.key === 'name' || f.key === 'api_url' || f.key === 'api_token',
            helpTextKey: providerHelp[f.key]?.helpTextKey,
            helpUrl: providerHelp[f.key]?.helpUrl,
          }));
          return (
            <ProviderWizardModal
              open={!!addTrkDialog}
              onClose={() => {
                setAddTrkDialog(null);
              }}
              provider={wizardCfg}
              fields={allFields}
              wizardTitleKey="argus.settings.providerWizard.addTracker"
              onSubmit={async (data) => {
                const config: Record<string, string> = {};
                tp.configFields.forEach((f) => {
                  if (data[f.key]) config[f.key] = data[f.key];
                });
                await argusService.createIssueTracker(projectId, {
                  provider: addTrkDialog as any,
                  name: data.name?.trim() || '',
                  api_url: data.api_url?.trim() || '',
                  api_token: data.api_token?.trim() || '',
                  config: Object.keys(config).length > 0 ? config : undefined,
                });
                await loadTrackers();
                setAddTrkDialog(null);
              }}
            />
          );
        })()}
      </Box>
    </PageContentLoader>
  );
};

export default IssueTrackersSettings;
