import React, { useState, useEffect, Suspense } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { P } from '@/types/permissions';
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
  Switch,
  FormControlLabel,
  CircularProgress,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { varsService } from '@/services/varsService';

import { useSnackbar } from 'notistack';
import { parseApiErrorMessage } from '../../utils/errorUtils';
import KeyValuePage from './KeyValuePage';
import aiChatService, {
  AISettingsData,
  AIModel,
} from '@/services/aiChatService';

import { useEnvironment } from '@/contexts/EnvironmentContext';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import PageContentLoader from '@/components/common/PageContentLoader';

// Lazy-loaded tab pages
const SystemConsolePage = React.lazy(
  () => import('../admin/SystemConsolePage')
);
const DataManagementPage = React.lazy(
  () => import('../admin/DataManagementPage')
);
const IntegrationsPage = React.lazy(() => import('./IntegrationsPage'));
const IntegrationsSdksPage = React.lazy(() => import('./IntegrationsSdksPage'));

// System Settings Page - requires admin role + system-settings permission
const SystemSettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const { user, hasPermission } = useAuth();
  const { currentEnvironmentId } = useEnvironment();
  const { getProjectApiPath } = useOrgProject();
  const projectApiPath = getProjectApiPath();
  const canManage = hasPermission([P.SYSTEM_SETTINGS_UPDATE]);
  const { enqueueSnackbar } = useSnackbar();
  const [searchParams, setSearchParams] = useSearchParams();

  // Tabs - read from URL query parameter
  const tabFromUrl = searchParams.get('tab');
  const initialTab = tabFromUrl ? parseInt(tabFromUrl, 10) : 0;
  const [tab, setTab] = useState(
    initialTab >= 0 && initialTab <= 6 ? initialTab : 0
  );

  // Network settings
  const [admindUrl, setAdmindUrl] = useState('');
  const [savedAdmindUrl, setSavedAdmindUrl] = useState('');

  // AI Chat settings
  const [aiSettings, setAiSettings] = useState<{
    enabled: boolean;
    provider: string;
    model: string;
    apiKey: string;
    apiBaseUrl: string;
  }>({
    enabled: false,
    provider: 'openai',
    model: 'gpt-4o-mini',
    apiKey: '',
    apiBaseUrl: '',
  });
  const [savedAiSettings, setSavedAiSettings] = useState<{
    enabled: boolean;
    provider: string;
    model: string;
    apiBaseUrl: string;
  }>({
    enabled: false,
    provider: 'openai',
    model: 'gpt-4o-mini',
    apiBaseUrl: '',
  });
  const [maskedApiKey, setMaskedApiKey] = useState<string | null>(null);
  const [aiSettingsLoading, setAiSettingsLoading] = useState(false);
  const [availableModels, setAvailableModels] = useState<AIModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);

  // Check if AI settings have changed
  const isAiSettingsDirty =
    aiSettings.enabled !== savedAiSettings.enabled ||
    aiSettings.provider !== savedAiSettings.provider ||
    aiSettings.model !== savedAiSettings.model ||
    aiSettings.apiBaseUrl !== savedAiSettings.apiBaseUrl ||
    aiSettings.apiKey.length > 0;

  // Load vars
  useEffect(() => {
    (async () => {
      try {
        const [admind] = await Promise.all([
          varsService.get(projectApiPath, 'admindUrl'),
        ]);
        setAdmindUrl(admind || '');
        setSavedAdmindUrl(admind || '');
      } catch (e) {
        // ignore load errors
      }
    })();
  }, [currentEnvironmentId]);

  // Load AI settings
  useEffect(() => {
    if (tab === 2) {
      (async () => {
        try {
          setAiSettingsLoading(true);
          const settings = await aiChatService.getSettings();
          const base = {
            enabled: settings.enabled,
            provider: settings.provider,
            model: settings.model,
            apiBaseUrl: settings.apiBaseUrl || '',
          };
          setAiSettings({ ...base, apiKey: '' });
          setSavedAiSettings(base);
          setMaskedApiKey(settings.apiKey || null);
          // Also load models for current provider
          try {
            const models = await aiChatService.getModels(settings.provider);
            setAvailableModels(models);
          } catch {
            setAvailableModels([]);
          }
        } catch (e) {
          // ignore - settings may not exist yet
        } finally {
          setAiSettingsLoading(false);
        }
      })();
    }
  }, [tab]);

  // Save AI settings
  const handleSaveAiSettings = async () => {
    try {
      const payload: any = {
        enabled: aiSettings.enabled,
        provider: aiSettings.provider,
        model: aiSettings.model,
        apiBaseUrl: aiSettings.apiBaseUrl || null,
      };
      // Only send apiKey if user typed something new
      if (aiSettings.apiKey) {
        payload.apiKey = aiSettings.apiKey;
      }
      const updated = await aiChatService.updateSettings(payload);
      enqueueSnackbar(t('aiChat.settings.saved'), { variant: 'success' });
      const base = {
        enabled: updated.enabled,
        provider: updated.provider,
        model: updated.model,
        apiBaseUrl: updated.apiBaseUrl || '',
      };
      setAiSettings({ ...base, apiKey: '' });
      setSavedAiSettings(base);
      setMaskedApiKey(updated.apiKey || null);
    } catch (error: any) {
      enqueueSnackbar(parseApiErrorMessage(error, 'common.saveFailed'), {
        variant: 'error',
      });
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
            <Tab label={t('settings.kv.title')} />
            <Tab label={t('aiChat.settings.title')} />
            <Tab label={t('sidebar.dataManagement')} />
            <Tab label={t('integrations.title')} />
            <Tab label={t('integrations.sdks.title')} />
            <Tab label={t('sidebar.console')} />
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
                    <Button
                      variant="contained"
                      disabled={admindUrl === savedAdmindUrl}
                      onClick={async () => {
                        await varsService.set(
                          projectApiPath,
                          'admindUrl',
                          admindUrl || null
                        );
                        setSavedAdmindUrl(admindUrl);
                        enqueueSnackbar(t('common.saved'), { variant: 'success' });
                      }}
                    >
                      {t('common.update')}
                    </Button>
                  </Stack>
                )}
              </Stack>
            </>
          )}

          {tab === 1 && <KeyValuePage />}

          {tab === 2 && (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('aiChat.settings.enabledDescription')}
              </Typography>
              <Stack spacing={2} sx={{ maxWidth: 640 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={aiSettings.enabled}
                      onChange={(e) =>
                        setAiSettings({
                          ...aiSettings,
                          enabled: e.target.checked,
                        })
                      }
                    />
                  }
                  label={t('aiChat.settings.enabled')}
                />

                <TextField
                  select
                  label={t('aiChat.settings.provider')}
                  value={aiSettings.provider}
                  onChange={(e) => {
                    const newProvider = e.target.value;
                    setAiSettings({
                      ...aiSettings,
                      provider: newProvider,
                      model: '',
                    });
                    // Fetch models for the new provider
                    setModelsLoading(true);
                    aiChatService
                      .getModels(newProvider)
                      .then((models) => {
                        setAvailableModels(models);
                        // Auto-select first model
                        if (models.length > 0) {
                          setAiSettings((prev) => ({
                            ...prev,
                            model: models[0].id,
                          }));
                        }
                      })
                      .catch(() => setAvailableModels([]))
                      .finally(() => setModelsLoading(false));
                  }}
                >
                  <MenuItem value="openai">OpenAI</MenuItem>
                  <MenuItem value="claude">Claude (Anthropic)</MenuItem>
                  <MenuItem value="gemini">Google Gemini</MenuItem>
                  <MenuItem value="deepseek">DeepSeek</MenuItem>
                  <MenuItem value="qwen">Qwen (Alibaba)</MenuItem>
                </TextField>

                <TextField
                  select
                  fullWidth
                  label={t('aiChat.settings.model')}
                  value={aiSettings.model}
                  onChange={(e) =>
                    setAiSettings({ ...aiSettings, model: e.target.value })
                  }
                  helperText={t('aiChat.settings.modelHelp')}
                  disabled={modelsLoading}
                  slotProps={{
                    input: {
                      endAdornment: modelsLoading ? (
                        <Box sx={{ display: 'flex', mr: 2 }}>
                          <CircularProgress size={16} />
                        </Box>
                      ) : undefined,
                    },
                  }}
                >
                  {availableModels.map((m) => (
                    <MenuItem key={m.id} value={m.id}>
                      {m.name}
                    </MenuItem>
                  ))}
                  {availableModels.length === 0 && (
                    <MenuItem value={aiSettings.model} disabled>
                      {aiSettings.model || '—'}
                    </MenuItem>
                  )}
                </TextField>

                <TextField
                  fullWidth
                  label={t('aiChat.settings.apiKey')}
                  type="password"
                  placeholder={t('aiChat.settings.apiKeyPlaceholder')}
                  value={aiSettings.apiKey}
                  onChange={(e) =>
                    setAiSettings({ ...aiSettings, apiKey: e.target.value })
                  }
                  helperText={
                    maskedApiKey
                      ? `${t('aiChat.settings.currentKey')}: ${maskedApiKey}`
                      : t('aiChat.settings.apiKeyPlaceholder')
                  }
                />

                <TextField
                  fullWidth
                  label={t('aiChat.settings.apiBaseUrl')}
                  placeholder="https://api.groq.com/openai/v1"
                  value={aiSettings.apiBaseUrl}
                  onChange={(e) =>
                    setAiSettings({
                      ...aiSettings,
                      apiBaseUrl: e.target.value,
                    })
                  }
                  helperText={t('aiChat.settings.apiBaseUrlHelp')}
                />

                {canManage && (
                  <Stack direction="row" spacing={1}>
                    <Button
                      variant="contained"
                      onClick={handleSaveAiSettings}
                      disabled={!isAiSettingsDirty}
                    >
                      {t('common.update')}
                    </Button>
                  </Stack>
                )}
              </Stack>
            </>
          )}

          {tab === 3 && (
            <Suspense
              fallback={
                <PageContentLoader loading>
                  <div />
                </PageContentLoader>
              }
            >
              <DataManagementPage />
            </Suspense>
          )}

          {tab === 4 && (
            <Suspense
              fallback={
                <PageContentLoader loading>
                  <div />
                </PageContentLoader>
              }
            >
              <IntegrationsPage />
            </Suspense>
          )}

          {tab === 5 && (
            <Suspense
              fallback={
                <PageContentLoader loading>
                  <div />
                </PageContentLoader>
              }
            >
              <IntegrationsSdksPage />
            </Suspense>
          )}

          {tab === 6 && (
            <Suspense
              fallback={
                <PageContentLoader loading>
                  <div />
                </PageContentLoader>
              }
            >
              <SystemConsolePage />
            </Suspense>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default SystemSettingsPage;
