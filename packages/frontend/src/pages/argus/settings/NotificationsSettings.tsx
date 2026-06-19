import React, { useState, useEffect } from 'react';
import { Box } from '@mui/material';
import {
  Chat as ChatIcon,
  Webhook as WebhookIcon,
  Email as EmailIcon,
  Notifications as NotificationsIcon,
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
import argusService from '@/services/argusService';
import PageContentLoader from '@/components/common/PageContentLoader';

const NOTIFICATION_PROVIDERS = [
  {
    id: 'slack',
    name: 'Slack',
    color: '#4A154B',
    gradient: 'linear-gradient(160deg, #2C0E31 0%, #4A154B 40%, #611f69 100%)',
    accentColor: '#36C5F0',
    guideUrl: 'https://api.slack.com/messaging/webhooks',
    guideButtonKey: 'argus.settings.providerWizard.slackGuideBtn',
    guideDescKey: 'argus.settings.providerWizard.slackGuideDesc',
    descKey: 'argus.settings.slackDesc',
    icon: <ChatIcon />,
    fields: [
      {
        key: 'name',
        labelKey: 'argus.settings.channelName',
        labelFallback: 'Name',
        placeholder: '#error-alerts',
      },
      {
        key: 'webhook_url',
        labelKey: 'argus.settings.webhookUrl',
        labelFallback: 'Webhook URL',
        placeholder: 'https://hooks.slack.com/services/...',
      },
      {
        key: 'channel',
        labelKey: 'argus.settings.slackChannel',
        labelFallback: 'Channel',
        placeholder: '#general',
      },
    ],
  },
  {
    id: 'discord',
    name: 'Discord',
    color: '#5865F2',
    gradient: 'linear-gradient(160deg, #2C2F86 0%, #4752C4 40%, #5865F2 100%)',
    accentColor: '#7289DA',
    guideUrl: 'https://support.discord.com/hc/en-us/articles/228383668',
    guideButtonKey: 'argus.settings.providerWizard.discordGuideBtn',
    guideDescKey: 'argus.settings.providerWizard.discordGuideDesc',
    descKey: 'argus.settings.discordDesc',
    icon: <ChatIcon />,
    fields: [
      {
        key: 'name',
        labelKey: 'argus.settings.channelName',
        labelFallback: 'Name',
        placeholder: 'Error Alerts',
      },
      {
        key: 'webhook_url',
        labelKey: 'argus.settings.webhookUrl',
        labelFallback: 'Webhook URL',
        placeholder: 'https://discord.com/api/webhooks/...',
      },
    ],
  },
  {
    id: 'msteams',
    name: 'Microsoft Teams',
    color: '#6264A7',
    gradient: 'linear-gradient(160deg, #32335C 0%, #4B4D80 40%, #6264A7 100%)',
    accentColor: '#7B83EB',
    descKey: 'argus.settings.msteamsDesc',
    icon: <ChatIcon />,
    fields: [
      {
        key: 'name',
        labelKey: 'argus.settings.channelName',
        labelFallback: 'Name',
        placeholder: 'Argus Alerts',
      },
      {
        key: 'webhook_url',
        labelKey: 'argus.settings.webhookUrl',
        labelFallback: 'Webhook URL',
        placeholder: 'https://outlook.office.com/webhook/...',
      },
    ],
  },
  {
    id: 'webhook',
    name: 'Webhook',
    color: '#FF6B35',
    gradient: 'linear-gradient(160deg, #8B3A1D 0%, #CC5429 40%, #FF6B35 100%)',
    accentColor: '#FF9966',
    descKey: 'argus.settings.webhookDesc',
    icon: <WebhookIcon />,
    fields: [
      {
        key: 'name',
        labelKey: 'argus.settings.channelName',
        labelFallback: 'Name',
        placeholder: 'Custom Hook',
      },
      {
        key: 'webhook_url',
        labelKey: 'argus.settings.webhookUrl',
        labelFallback: 'URL',
        placeholder: 'https://api.example.com/hook',
      },
      {
        key: 'secret',
        labelKey: 'argus.settings.webhookSecret',
        labelFallback: 'Secret',
        placeholder: '',
        type: 'password',
      },
    ],
  },
  {
    id: 'email',
    name: 'Email',
    color: '#EA4335',
    gradient: 'linear-gradient(160deg, #8B2920 0%, #C4372C 40%, #EA4335 100%)',
    accentColor: '#FF6B6B',
    descKey: 'argus.settings.emailDesc',
    icon: <EmailIcon />,
    fields: [
      {
        key: 'name',
        labelKey: 'argus.settings.channelName',
        labelFallback: 'Name',
        placeholder: 'Dev Team Email',
      },
      {
        key: 'recipients',
        labelKey: 'argus.settings.emailRecipients',
        labelFallback: 'Recipients',
        placeholder: 'dev@company.com, ops@company.com',
      },
    ],
  },
  {
    id: 'pagerduty',
    name: 'PagerDuty',
    color: '#06AC38',
    gradient: 'linear-gradient(160deg, #045D1F 0%, #058F2E 40%, #06AC38 100%)',
    accentColor: '#4ADE80',
    descKey: 'argus.settings.pagerdutyDesc',
    icon: <NotificationsIcon />,
    fields: [
      {
        key: 'name',
        labelKey: 'argus.settings.channelName',
        labelFallback: 'Name',
        placeholder: 'On-Call Alerts',
      },
      {
        key: 'api_token',
        labelKey: 'argus.settings.trackerApiToken',
        labelFallback: 'Integration Key',
        placeholder: '',
        type: 'password',
      },
      {
        key: 'severity',
        labelKey: 'argus.settings.pdSeverity',
        labelFallback: 'Default Severity',
        placeholder: 'critical',
      },
    ],
  },
];

interface NotificationsSettingsProps {
  projectId: string;
  isDark: boolean;
  t: any;
  onChange?: () => void;
}

export const NotificationsSettings: React.FC<NotificationsSettingsProps> = ({
  projectId,
  isDark,
  t,
  onChange,
}) => {
  const { enqueueSnackbar } = useSnackbar();

  const [notifChannels, setNotifChannels] = useState<any[]>([]);
  const [notifLoaded, setNotifLoaded] = useState(false);
  const [addNotifDialog, setAddNotifDialog] = useState<string | null>(null);
  const [editingNotifChannel, setEditingNotifChannel] = useState<any | null>(
    null
  );

  const loadNotificationChannels = async () => {
    try {
      const svc = argusService as any;
      if (typeof svc.listNotificationChannels === 'function') {
        const d = await svc.listNotificationChannels(projectId);
        setNotifChannels(d);
        onChange?.();
      }
      setNotifLoaded(true);
    } catch {
      setNotifLoaded(true);
    }
  };

  useEffect(() => {
    loadNotificationChannels();
  }, [projectId]);

  return (
    <PageContentLoader loading={!notifLoaded}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <SettingsCard
          title={t('argus.settings.availableNotifications')}
          desc={t('argus.settings.notificationsDesc')}
          isDark={isDark}
        >
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 2,
            }}
          >
            {NOTIFICATION_PROVIDERS.map((prov) => (
              <ProviderCard
                key={prov.id}
                prov={prov}
                isDark={isDark}
                t={t}
                count={notifChannels.filter((c) => c.provider === prov.id).length}
                onAdd={() => {
                  setAddNotifDialog(prov.id);
                }}
              />
            ))}
          </Box>
        </SettingsCard>
        {notifLoaded && notifChannels.length > 0 && (
          <SettingsCard
            title={t('argus.settings.configuredChannels')}
            desc={t('argus.settings.configuredChannelsDesc')}
            isDark={isDark}
          >
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: 2,
              }}
            >
              {notifChannels.map((ch: any) => {
                const prov = NOTIFICATION_PROVIDERS.find(
                  (p) => p.id === ch.provider
                );
                return (
                  <ConnectedItem
                    key={ch.id}
                    isDark={isDark}
                    color={prov?.color || '#666'}
                    icon={
                      prov?.icon || <NotificationsIcon sx={{ fontSize: 18 }} />
                    }
                    title={ch.name}
                    chipLabel={prov?.name || ch.provider}
                    subtitle={
                      ch.webhook_url ||
                      ch.config?.webhook_url ||
                      ch.recipients ||
                      ch.config?.recipients ||
                      ''
                    }
                    active={ch.enabled}
                    t={t}
                    onEdit={() => setEditingNotifChannel(ch)}
                    onToggle={async () => {
                      try {
                        await (argusService as any).updateNotificationChannel?.(
                          projectId,
                          ch.id,
                          { enabled: !ch.enabled }
                        );
                        await loadNotificationChannels();
                      } catch {
                        /* */
                      }
                    }}
                    onTest={async () => {
                      try {
                        const r = await (
                          argusService as any
                        ).testNotificationChannel?.(projectId, ch.id);
                        enqueueSnackbar(
                          r?.ok ? r.message : t('argus.settings.testFailed'),
                          { variant: r?.ok ? 'success' : 'error' }
                        );
                      } catch {
                        enqueueSnackbar(t('argus.settings.testFailed'), {
                          variant: 'error',
                        });
                      }
                    }}
                    onDelete={async () => {
                      try {
                        await (argusService as any).deleteNotificationChannel?.(
                          projectId,
                          ch.id
                        );
                        setNotifChannels((p) =>
                          p.filter((i: any) => i.id !== ch.id)
                        );
                        enqueueSnackbar(t('common.deleted'), {
                          variant: 'success',
                        });
                      } catch {
                        /* */
                      }
                    }}
                  />
                );
              })}
            </Box>
          </SettingsCard>
        )}

        {/* ═══ ADD NOTIFICATION WIZARD ═══ */}
        {(() => {
          const np = NOTIFICATION_PROVIDERS.find((p) => p.id === addNotifDialog);
          if (!np) return null;
          const wizardCfg: WizardProviderConfig = {
            id: np.id,
            name: np.name,
            color: np.color,
            gradient: np.gradient,
            accentColor: np.accentColor,
            icon: np.icon,
            descKey: np.descKey,
            guideUrl: np.guideUrl,
            guideButtonKey: np.guideButtonKey,
            guideDescKey: np.guideDescKey,
          };
          const wizardFields: WizardFieldDef[] = np.fields.map((f) => ({
            ...f,
            required: f.key === 'name',
          }));
          return (
            <ProviderWizardModal
              open={!!addNotifDialog}
              onClose={() => {
                setAddNotifDialog(null);
              }}
              provider={wizardCfg}
              fields={wizardFields}
              wizardTitleKey="argus.settings.providerWizard.addNotification"
              onTestConnection={async (data) => {
                return await (
                  argusService as any
                ).testNotificationChannelPreSave?.(projectId, {
                  provider: addNotifDialog!,
                  config: data,
                });
              }}
              onSubmit={async (data) => {
                await (argusService as any).createNotificationChannel?.(
                  projectId,
                  {
                    provider: addNotifDialog,
                    name: data.name?.trim() || '',
                    webhook_url: data.webhook_url?.trim(),
                    channel: data.channel?.trim(),
                    recipients: data.recipients?.trim(),
                    secret: data.secret?.trim(),
                    api_token: data.api_token?.trim(),
                    severity: data.severity?.trim(),
                    config: data,
                  }
                );
                await loadNotificationChannels();
                setAddNotifDialog(null);
              }}
            />
          );
        })()}

        {/* ═══ EDIT NOTIFICATION WIZARD ═══ */}
        {(() => {
          if (!editingNotifChannel) return null;
          const np = NOTIFICATION_PROVIDERS.find(
            (p) => p.id === editingNotifChannel.provider
          );
          if (!np) return null;
          const wizardCfg: WizardProviderConfig = {
            id: np.id,
            name: np.name,
            color: np.color,
            gradient: np.gradient,
            accentColor: np.accentColor,
            icon: np.icon,
            descKey: np.descKey,
            guideUrl: np.guideUrl,
            guideButtonKey: np.guideButtonKey,
            guideDescKey: np.guideDescKey,
          };
          const wizardFields: WizardFieldDef[] = np.fields.map((f) => ({
            ...f,
            required: f.key === 'name',
          }));
          return (
            <ProviderWizardModal
              open={!!editingNotifChannel}
              onClose={() => {
                setEditingNotifChannel(null);
              }}
              provider={wizardCfg}
              fields={wizardFields}
              wizardTitleKey="argus.settings.providerWizard.editNotification"
              initialData={{
                name: editingNotifChannel.name || '',
                ...(editingNotifChannel.config || {}),
              }}
              onTestConnection={async (data) => {
                return await (
                  argusService as any
                ).testNotificationChannelPreSave?.(projectId, {
                  provider: editingNotifChannel.provider,
                  config: data,
                });
              }}
              onSubmit={async (data) => {
                await (argusService as any).updateNotificationChannel?.(
                  projectId,
                  editingNotifChannel.id,
                  {
                    name: data.name?.trim() || '',
                    config: data,
                  }
                );
                await loadNotificationChannels();
                setEditingNotifChannel(null);
              }}
            />
          );
        })()}
      </Box>
    </PageContentLoader>
  );
};

export default NotificationsSettings;
