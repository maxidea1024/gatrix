import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/types/permissions';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Stack,
  TextField,
  MenuItem,
  Tabs,
  Tab,
  Button,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { varsService } from '@/services/varsService';
import { serviceDiscoveryConfigService, ServiceDiscoveryConfig } from '@/services/serviceDiscoveryConfigService';
import { useSnackbar } from 'notistack';
import { parseApiErrorMessage } from '../../utils/errorUtils';
import KeyValuePage from './KeyValuePage';

import { useEnvironment } from '@/contexts/EnvironmentContext';

// System Settings Page - requires admin role + system-settings permission
const SystemSettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const { user, hasPermission } = useAuth();
  const { currentEnvironmentId } = useEnvironment();
  const canManage = hasPermission([PERMISSIONS.SYSTEM_SETTINGS_MANAGE]);
  const { enqueueSnackbar } = useSnackbar();
  const [searchParams, setSearchParams] = useSearchParams();

  // Tabs - read from URL query parameter
  const tabFromUrl = searchParams.get('tab');
  const initialTab = tabFromUrl ? parseInt(tabFromUrl, 10) : 0;
  const [tab, setTab] = useState(initialTab >= 0 && initialTab <= 3 ? initialTab : 0);

  // Network settings
  const [admindUrl, setAdmindUrl] = useState('');

  // Integration settings
  const [slackWebhookUrl, setSlackWebhookUrl] = useState('');
  const [genericWebhookUrl, setGenericWebhookUrl] = useState('');

  // Service Discovery settings
  const [sdConfig, setSdConfig] = useState<ServiceDiscoveryConfig>({
    mode: 'redis',
    etcdHosts: 'http://localhost:2379',
    defaultTtl: 30,
    heartbeatInterval: 15,
  });

  // Load vars
  useEffect(() => {
    (async () => {
      try {
        const [admind, slack, generic] = await Promise.all([
          varsService.get('admindUrl'),
          varsService.get('slackWebhookUrl'),
          varsService.get('genericWebhookUrl'),
        ]);
        setAdmindUrl(admind || '');
        setSlackWebhookUrl(slack || '');
        setGenericWebhookUrl(generic || '');
      } catch (e) {
        // ignore load errors
      }
    })();
  }, [currentEnvironmentId]);

  // Load service discovery config
  useEffect(() => {
    if (user?.role === 'admin') {
      (async () => {
        try {
          const config = await serviceDiscoveryConfigService.getConfig();
          setSdConfig(config);
        } catch (e) {
          console.error('Failed to load service discovery config:', e);
        }
      })();
    }
  }, [user]);

  // Save service discovery config
  const handleSaveServiceDiscoveryConfig = async () => {
    try {
      await serviceDiscoveryConfigService.updateConfig(sdConfig);
      enqueueSnackbar(t('settings.serviceDiscovery.saved'), { variant: 'success' });
    } catch (error: any) {
      enqueueSnackbar(parseApiErrorMessage(error, 'settings.serviceDiscovery.saveFailed'), { variant: 'error' });
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
          {t('settings.systemSettings')}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {t('settings.subtitle')}
        </Typography>
      </Box>

      <Card>
        <CardContent>
          <Tabs
            value={tab}
            onChange={(_, v) => {
              setTab(v);
              setSearchParams({ tab: v.toString() });
            }}
            sx={{ mb: 2 }}
          >
            <Tab label={t('settings.network.title')} />
            <Tab label={t('settings.integrations.title')} />
            <Tab label={t('settings.serviceDiscovery.title')} />
            <Tab label={t('settings.kv.title')} />
          </Tabs>

          {tab === 0 && (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('settings.network.subtitle')}
              </Typography>
              <Stack spacing={2} sx={{ maxWidth: 640 }}>
                <TextField
                  fullWidth
                  label={t('settings.network.admindUrl')}
                  placeholder="https://admind.yourdomain.com"
                  value={admindUrl}
                  onChange={(e) => setAdmindUrl(e.target.value)}
                  helperText={t('settings.network.admindUrlHelp')}
                />
                {canManage && (
                  <Stack direction="row" spacing={1}>
                    <Button variant="contained" onClick={async () => { await varsService.set('admindUrl', admindUrl || null); }}>
                      {t('common.save')}
                    </Button>
                  </Stack>
                )}
              </Stack>
            </>
          )}

          {tab === 1 && (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('settings.integrations.subtitle')}
              </Typography>
              <Stack spacing={2} sx={{ maxWidth: 640 }}>
                <TextField
                  fullWidth
                  label={t('settings.integrations.slackWebhook')}
                  placeholder="https://hooks.slack.com/services/..."
                  value={slackWebhookUrl}
                  onChange={(e) => setSlackWebhookUrl(e.target.value)}
                  helperText={t('settings.integrations.slackWebhookHelp')}
                />
                <TextField
                  fullWidth
                  label={t('settings.integrations.genericWebhook')}
                  placeholder="https://your.webhook/endpoint"
                  value={genericWebhookUrl}
                  onChange={(e) => setGenericWebhookUrl(e.target.value)}
                  helperText={t('settings.integrations.genericWebhookHelp')}
                />
                {canManage && (
                  <Stack direction="row" spacing={1}>
                    <Button variant="contained" onClick={async () => { await varsService.set('slackWebhookUrl', slackWebhookUrl || null); await varsService.set('genericWebhookUrl', genericWebhookUrl || null); }}>
                      {t('common.save')}
                    </Button>
                  </Stack>
                )}
              </Stack>
            </>
          )}

          {tab === 2 && (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('settings.serviceDiscovery.subtitle')}
              </Typography>
              <Stack spacing={2} sx={{ maxWidth: 640 }}>
                <TextField
                  select
                  label={t('settings.serviceDiscovery.mode')}
                  value={sdConfig.mode}
                  onChange={(e) => setSdConfig({ ...sdConfig, mode: e.target.value as 'redis' | 'etcd' })}
                  helperText={t('settings.serviceDiscovery.modeHelp')}
                >
                  <MenuItem value="redis">Redis</MenuItem>
                  <MenuItem value="etcd">etcd</MenuItem>
                </TextField>

                <TextField
                  fullWidth
                  label={t('settings.serviceDiscovery.etcdHosts')}
                  placeholder="http://localhost:2379"
                  value={sdConfig.etcdHosts}
                  onChange={(e) => setSdConfig({ ...sdConfig, etcdHosts: e.target.value })}
                  helperText={t('settings.serviceDiscovery.etcdHostsHelp')}
                  disabled={sdConfig.mode !== 'etcd'}
                />

                <TextField
                  type="number"
                  label={t('settings.serviceDiscovery.defaultTtl')}
                  value={sdConfig.defaultTtl}
                  onChange={(e) => setSdConfig({ ...sdConfig, defaultTtl: e.target.value === '' ? '' : (parseInt(e.target.value, 10) || 30) })}
                  helperText={t('settings.serviceDiscovery.defaultTtlHelp')}
                  inputProps={{ min: 10, max: 300 }}
                />

                <TextField
                  type="number"
                  label={t('settings.serviceDiscovery.heartbeatInterval')}
                  value={sdConfig.heartbeatInterval}
                  onChange={(e) => setSdConfig({ ...sdConfig, heartbeatInterval: e.target.value === '' ? '' : (parseInt(e.target.value, 10) || 15) })}
                  helperText={t('settings.serviceDiscovery.heartbeatIntervalHelp')}
                  inputProps={{ min: 5, max: 60 }}
                />

                {canManage && (
                  <Stack direction="row" spacing={1}>
                    <Button variant="contained" onClick={handleSaveServiceDiscoveryConfig}>
                      {t('common.save')}
                    </Button>
                  </Stack>
                )}
              </Stack>
            </>
          )}

          {tab === 3 && (
            <KeyValuePage />
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default SystemSettingsPage;

