import React, {
  useState,
  useEffect,
  Suspense,
  useMemo,
  useCallback,
} from 'react';
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
  Button,
  Switch,
  FormControlLabel,
  CircularProgress,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  NetworkCheck as NetworkIcon,
  Storage as StorageIcon,
  SmartToy as AiIcon,
  Terminal as ConsoleIcon,
  Inventory2 as DataIcon,
  Extension as IntegrationIcon,
  PhoneAndroid as SdkIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
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
import PageHeader from '@/components/common/PageHeader';

// Lazy-loaded section pages
const SystemConsolePage = React.lazy(
  () => import('../admin/SystemConsolePage')
);
const DataManagementPage = React.lazy(
  () => import('../admin/DataManagementPage')
);
const IntegrationsPage = React.lazy(() => import('./IntegrationsPage'));
const IntegrationsSdksPage = React.lazy(() => import('./IntegrationsSdksPage'));

/* ─── Types ─── */

type SectionId =
  | 'network'
  | 'kv'
  | 'ai'
  | 'console'
  | 'data'
  | 'integrations'
  | 'sdks';

interface NavItem {
  id: SectionId;
  labelKey: string;
  icon: React.ReactNode;
}

interface NavGroup {
  labelKey: string;
  items: NavItem[];
}

/* ─── Nav Structure ─── */

const NAV_GROUPS: NavGroup[] = [
  {
    labelKey: 'settings.systemSettings.groupSystem',
    items: [
      {
        id: 'network',
        labelKey: 'settings.network.title',
        icon: <NetworkIcon sx={{ fontSize: 18 }} />,
      },
      {
        id: 'kv',
        labelKey: 'settings.kv.title',
        icon: <StorageIcon sx={{ fontSize: 18 }} />,
      },
      {
        id: 'ai',
        labelKey: 'aiChat.settings.title',
        icon: <AiIcon sx={{ fontSize: 18 }} />,
      },
      {
        id: 'console',
        labelKey: 'sidebar.console',
        icon: <ConsoleIcon sx={{ fontSize: 18 }} />,
      },
    ],
  },
  {
    labelKey: 'settings.systemSettings.groupData',
    items: [
      {
        id: 'data',
        labelKey: 'sidebar.dataManagement',
        icon: <DataIcon sx={{ fontSize: 18 }} />,
      },
    ],
  },
  {
    labelKey: 'settings.systemSettings.groupIntegrations',
    items: [
      {
        id: 'integrations',
        labelKey: 'integrations.title',
        icon: <IntegrationIcon sx={{ fontSize: 18 }} />,
      },
      {
        id: 'sdks',
        labelKey: 'integrations.sdks.title',
        icon: <SdkIcon sx={{ fontSize: 18 }} />,
      },
    ],
  },
];

/* ─── Sidebar Nav Item ─── */

interface SidebarItemProps {
  item: NavItem;
  active: boolean;
  isDark: boolean;
  onClick: () => void;
  t: (key: string) => string;
}

const SidebarItem: React.FC<SidebarItemProps> = React.memo(
  function SidebarItem({ item, active, isDark, onClick, t }) {
    const theme = useTheme();
    return (
      <Box
        onClick={onClick}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.2,
          px: 1.5,
          py: 1,
          mb: 0.2,
          borderRadius: '6px 0 0 6px',
          cursor: 'pointer',
          position: 'relative',
          backgroundColor: active
            ? alpha(theme.palette.primary.main, isDark ? 0.12 : 0.08)
            : 'transparent',
          color: active ? theme.palette.primary.main : 'text.primary',
          transition: 'all 0.1s ease-in-out',
          '&:hover': {
            backgroundColor: active
              ? alpha(theme.palette.primary.main, isDark ? 0.15 : 0.1)
              : isDark
                ? 'rgba(255,255,255,0.05)'
                : 'rgba(0,0,0,0.04)',
          },
        }}
      >
        {active && (
          <Box
            sx={{
              position: 'absolute',
              left: 0,
              top: '20%',
              bottom: '20%',
              width: 3,
              borderRadius: '0 4px 4px 0',
              backgroundColor: theme.palette.primary.main,
            }}
          />
        )}
        <Box
          sx={{
            display: 'flex',
            opacity: active ? 1 : 0.6,
            color: 'inherit',
          }}
        >
          {item.icon}
        </Box>
        <Typography
          sx={{
            fontSize: '0.85rem',
            fontWeight: active ? 600 : 400,
          }}
        >
          {t(item.labelKey)}
        </Typography>
      </Box>
    );
  }
);

/* ─── Section Card wrapper ─── */

const SectionCard: React.FC<{
  maxWidth?: number;
  children: React.ReactNode;
}> = ({ maxWidth = 720, children }) => (
  <Card sx={{ maxWidth }}>
    <CardContent>{children}</CardContent>
  </Card>
);

/* ─── Main Page ─── */

const SystemSettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { user, hasPermission } = useAuth();
  const { currentEnvironmentId } = useEnvironment();
  const { getProjectApiPath } = useOrgProject();
  const projectApiPath = getProjectApiPath();
  const canManage = hasPermission([P.SYSTEM_SETTINGS_UPDATE]);
  const { enqueueSnackbar } = useSnackbar();
  const navigate = useNavigate();
  const location = useLocation();

  // ── Section routing via URL hash ──
  const ALL_SECTION_IDS: SectionId[] = NAV_GROUPS.flatMap((g) =>
    g.items.map((i) => i.id)
  );

  const currentSection = useMemo<SectionId>(() => {
    const hash = location.hash.replace('#', '') as SectionId;
    return ALL_SECTION_IDS.includes(hash) ? hash : 'network';
  }, [location.hash]);

  const setSection = useCallback(
    (id: SectionId) => {
      navigate({ hash: `#${id}` }, { replace: true });
      window.scrollTo({ top: 0 });
    },
    [navigate]
  );

  // ── Network settings ──
  const [admindUrl, setAdmindUrl] = useState('');
  const [savedAdmindUrl, setSavedAdmindUrl] = useState('');

  // ── AI Chat settings ──
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

  const isAiSettingsDirty =
    aiSettings.enabled !== savedAiSettings.enabled ||
    aiSettings.provider !== savedAiSettings.provider ||
    aiSettings.model !== savedAiSettings.model ||
    aiSettings.apiBaseUrl !== savedAiSettings.apiBaseUrl ||
    aiSettings.apiKey.length > 0;

  // Load vars (network)
  useEffect(() => {
    (async () => {
      try {
        const admind = await varsService.get(projectApiPath, 'admindUrl');
        setAdmindUrl(admind || '');
        setSavedAdmindUrl(admind || '');
      } catch {
        // ignore
      }
    })();
  }, [currentEnvironmentId]);

  // Load AI settings on section activation
  useEffect(() => {
    if (currentSection === 'ai') {
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
          try {
            const models = await aiChatService.getModels(settings.provider);
            setAvailableModels(models);
          } catch {
            setAvailableModels([]);
          }
        } catch {
          // ignore
        } finally {
          setAiSettingsLoading(false);
        }
      })();
    }
  }, [currentSection]);

  const handleSaveAiSettings = async () => {
    try {
      const payload: any = {
        enabled: aiSettings.enabled,
        provider: aiSettings.provider,
        model: aiSettings.model,
        apiBaseUrl: aiSettings.apiBaseUrl || null,
      };
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

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <PageHeader
        icon={<SettingsIcon />}
        title={t('settings.systemSettings')}
        subtitle={t('settings.subtitle')}
      />

      <Box
        sx={{
          display: 'flex',
          gap: 2,
          flex: 1,
          mt: -2,
          ml: -2,
          mr: -2,
          mb: -2,
        }}
      >
        {/* ══════ LEFT SIDEBAR ══════ */}
        <Box
          sx={{
            width: 220,
            flexShrink: 0,
            borderRight: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            pt: 2,
            pl: 2,
          }}
        >
          <Box sx={{ position: 'sticky', top: 2, pr: 1 }}>
            {NAV_GROUPS.map((group, gi) => (
              <Box key={gi} sx={{ mb: 2 }}>
                <Typography
                  sx={{
                    px: 1.5,
                    pb: 1,
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: 'text.secondary',
                    letterSpacing: '0.1em',
                  }}
                >
                  {t(group.labelKey)}
                </Typography>
                {group.items.map((item) => (
                  <SidebarItem
                    key={item.id}
                    item={item}
                    active={currentSection === item.id}
                    isDark={isDark}
                    onClick={() => setSection(item.id)}
                    t={t}
                  />
                ))}
              </Box>
            ))}
          </Box>
        </Box>

        {/* ══════ RIGHT CONTENT ══════ */}
        <Box sx={{ flex: 1, minWidth: 0, pt: 2, pr: 2, pb: 6 }}>
          {/* ─── NETWORK ─── */}
          {currentSection === 'network' && (
            <SectionCard>
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
                        enqueueSnackbar(t('common.saved'), {
                          variant: 'success',
                        });
                      }}
                    >
                      {t('common.update')}
                    </Button>
                  </Stack>
                )}
              </Stack>
            </SectionCard>
          )}

          {/* ─── KEY-VALUE ─── */}
          {currentSection === 'kv' && <KeyValuePage hideHeader />}

          {/* ─── AI CHAT ─── */}
          {currentSection === 'ai' && (
            <SectionCard>
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
                    setModelsLoading(true);
                    aiChatService
                      .getModels(newProvider)
                      .then((models) => {
                        setAvailableModels(models);
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
            </SectionCard>
          )}

          {/* ─── SYSTEM CONSOLE ─── */}
          {currentSection === 'console' && (
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

          {/* ─── DATA MANAGEMENT ─── */}
          {currentSection === 'data' && (
            <Suspense
              fallback={
                <PageContentLoader loading>
                  <div />
                </PageContentLoader>
              }
            >
              <DataManagementPage hideHeader />
            </Suspense>
          )}

          {/* ─── INTEGRATIONS ─── */}
          {currentSection === 'integrations' && (
            <Suspense
              fallback={
                <PageContentLoader loading>
                  <div />
                </PageContentLoader>
              }
            >
              <IntegrationsPage hideHeader />
            </Suspense>
          )}

          {/* ─── SDK INTEGRATION ─── */}
          {currentSection === 'sdks' && (
            <Suspense
              fallback={
                <PageContentLoader loading>
                  <div />
                </PageContentLoader>
              }
            >
              <IntegrationsSdksPage hideHeader />
            </Suspense>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default SystemSettingsPage;
