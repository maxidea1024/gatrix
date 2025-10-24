import React, { useMemo, useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Stack,
  TextField,
  Autocomplete,
  MenuItem,
  Tabs,
  Tab,
  Button,
  Divider,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import moment from 'moment-timezone';
import { getStoredTimezone, getStoredDateTimeFormat, setStoredTimezone, setStoredDateTimeFormat } from '@/utils/dateFormat';
import { useI18n, getLanguageDisplayName } from '@/contexts/I18nContext';
import { useTheme } from '@/contexts/ThemeContext';
import { varsService } from '@/services/varsService';
import { useAuth } from '@/contexts/AuthContext';
import { AuthService } from '@/services/auth';
import { serviceDiscoveryConfigService, ServiceDiscoveryConfig } from '@/services/serviceDiscoveryConfigService';
import { useSnackbar } from 'notistack';
import KeyValuePage from './settings/KeyValuePage';

const formatPresets = [
  'YYYY-MM-DD HH:mm:ss',
  'YYYY/MM/DD HH:mm',
  'YYYY.MM.DD HH:mm:ss',
  'YYYY-MM-DD',
  'MM/DD/YYYY HH:mm',
  'DD/MM/YYYY HH:mm:ss',
];

const SettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const { language, changeLanguage, supportedLanguages } = useI18n();
  const { mode, setTheme } = useTheme();
  const { user, refreshAuth } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const [searchParams, setSearchParams] = useSearchParams();

  const tzOptions = useMemo(() => moment.tz.names(), []);
  const [timezone, setTimezone] = useState<string>(getStoredTimezone());
  const [dtFormat, setDtFormat] = useState<string>(getStoredDateTimeFormat());
  const [preview, setPreview] = useState<string>('');

  // Tabs - read from URL query parameter
  const tabFromUrl = searchParams.get('tab');
  const initialTab = tabFromUrl ? parseInt(tabFromUrl, 10) : 0;
  const [tab, setTab] = useState(initialTab >= 0 && initialTab <= 4 ? initialTab : 0);

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

  useEffect(() => {
    const now = new Date();
    setPreview(moment(now).tz(timezone).format(dtFormat));
  }, [timezone, dtFormat]);

  // Format timezone with UTC offset
  const formatTimezone = (tz: string) => {
    const offset = moment.tz(tz).format('Z');
    return `${tz} (UTC${offset})`;
  };

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
        // ignore load errors on non-admin or missing route
      }
    })();
  }, []);

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

  // Auto-save on change
  useEffect(() => { setStoredTimezone(timezone); }, [timezone]);
  useEffect(() => { setStoredDateTimeFormat(dtFormat); }, [dtFormat]);

  // Update preview
  useEffect(() => {
    const now = moment().tz(timezone);
    setPreview(now.format(dtFormat));
  }, [timezone, dtFormat]);

  // Save language preference to user profile
  const handleLanguageChange = async (newLanguage: string) => {
    try {
      // Update UI immediately
      changeLanguage(newLanguage as any);

      // Save to backend if user is logged in
      if (user) {
        await AuthService.updateProfile({ preferredLanguage: newLanguage });
        await refreshAuth(); // Refresh user data
        enqueueSnackbar(t('settings.languageSaved'), { variant: 'success' });
      }
    } catch (error: any) {
      enqueueSnackbar(error.message || t('settings.languageSaveFailed'), { variant: 'error' });
    }
  };

  // Save service discovery config
  const handleSaveServiceDiscoveryConfig = async () => {
    try {
      await serviceDiscoveryConfigService.updateConfig(sdConfig);
      enqueueSnackbar(t('settings.serviceDiscovery.saved'), { variant: 'success' });
    } catch (error: any) {
      enqueueSnackbar(error.message || t('settings.serviceDiscovery.saveFailed'), { variant: 'error' });
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
          {t('settings.title')}
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
            <Tab label={t('settings.general.title')} />
            <Tab label={t('settings.network.title')} />
            <Tab label={t('settings.integrations.title')} />
            {user?.role === 'admin' && <Tab label={t('settings.serviceDiscovery.title')} />}
            <Tab label={t('settings.kv.title')} />
          </Tabs>

          {tab === 0 && (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('settings.general.subtitle')}
              </Typography>
              <Stack spacing={2} sx={{ maxWidth: 560 }}>
                {/* Language */}
                <Autocomplete
                  options={supportedLanguages}
                  getOptionLabel={(opt) => getLanguageDisplayName(opt)}
                  value={language}
                  onChange={(_, v) => v && handleLanguageChange(v)}
                  renderInput={(params) => (
                    <TextField {...params} label={t('language.changeLanguage')} />
                  )}
                />

                {/* Theme */}
                <TextField
                  select
                  label={t('theme')}
                  value={mode}
                  onChange={(e) => setTheme(e.target.value as any)}
                >
                  <MenuItem value="light">Light</MenuItem>
                  <MenuItem value="dark">Dark</MenuItem>
                  <MenuItem value="auto">Auto</MenuItem>
                </TextField>

                {/* Timezone */}
                <Autocomplete
                  options={tzOptions}
                  value={timezone}
                  onChange={(_, v) => v && setTimezone(v)}
                  getOptionLabel={formatTimezone}
                  renderInput={(params) => (
                    <TextField {...params} label="Timezone" placeholder="Search timezone" />
                  )}
                  renderOption={(props, option) => (
                    <li {...props}>
                      <Box>
                        <Typography variant="body2">{option}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          UTC{moment.tz(option).format('Z')}
                        </Typography>
                      </Box>
                    </li>
                  )}
                />

                {/* Datetime format */}
                <Autocomplete
                  freeSolo
                  options={formatPresets}
                  value={dtFormat}
                  onChange={(_, v) => v && setDtFormat(v)}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Datetime Format"
                      placeholder="e.g. YYYY-MM-DD HH:mm:ss"
                      onChange={(e) => setDtFormat(e.target.value)}
                    />
                  )}
                />

                {/* Preview */}
                <Typography variant="body2" color="text.secondary">
                  Preview: {preview}
                </Typography>
              </Stack>
            </>
          )}

          {tab === 1 && (
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
                  onChange={(e)=>setAdmindUrl(e.target.value)}
                  helperText={t('settings.network.admindUrlHelp')}
                />
                <Stack direction="row" spacing={1}>
                  <Button variant="contained" onClick={async ()=>{ await varsService.set('admindUrl', admindUrl || null); }}>
                    {t('common.save')}
                  </Button>
                </Stack>
              </Stack>
            </>
          )}

          {tab === 2 && (
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
                  onChange={(e)=>setSlackWebhookUrl(e.target.value)}
                  helperText={t('settings.integrations.slackWebhookHelp')}
                />
                <TextField
                  fullWidth
                  label={t('settings.integrations.genericWebhook')}
                  placeholder="https://your.webhook/endpoint"
                  value={genericWebhookUrl}
                  onChange={(e)=>setGenericWebhookUrl(e.target.value)}
                  helperText={t('settings.integrations.genericWebhookHelp')}
                />
                <Stack direction="row" spacing={1}>
                  <Button variant="contained" onClick={async ()=>{ await varsService.set('slackWebhookUrl', slackWebhookUrl || null); await varsService.set('genericWebhookUrl', genericWebhookUrl || null); }}>
                    {t('common.save')}
                  </Button>
                </Stack>
              </Stack>
            </>
          )}

          {user?.role === 'admin' && tab === 3 && (
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
                  onChange={(e) => setSdConfig({ ...sdConfig, defaultTtl: parseInt(e.target.value, 10) })}
                  helperText={t('settings.serviceDiscovery.defaultTtlHelp')}
                  inputProps={{ min: 10, max: 300 }}
                />

                <TextField
                  type="number"
                  label={t('settings.serviceDiscovery.heartbeatInterval')}
                  value={sdConfig.heartbeatInterval}
                  onChange={(e) => setSdConfig({ ...sdConfig, heartbeatInterval: parseInt(e.target.value, 10) })}
                  helperText={t('settings.serviceDiscovery.heartbeatIntervalHelp')}
                  inputProps={{ min: 5, max: 60 }}
                />

                <Stack direction="row" spacing={1}>
                  <Button variant="contained" onClick={handleSaveServiceDiscoveryConfig}>
                    {t('common.save')}
                  </Button>
                </Stack>
              </Stack>
            </>
          )}

          {tab === (user?.role === 'admin' ? 4 : 3) && (
            <KeyValuePage />
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default SettingsPage;
