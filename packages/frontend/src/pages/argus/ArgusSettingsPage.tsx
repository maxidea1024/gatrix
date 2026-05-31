import React, { useState, useEffect, useCallback } from 'react';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash';
import { vscDarkPlus, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';

SyntaxHighlighter.registerLanguage('javascript', javascript);
SyntaxHighlighter.registerLanguage('bash', bash);
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Slider,
  Chip,
  IconButton,
  Divider,
  useTheme,
  InputAdornment,
  alpha,
  Tabs,
  Tab,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  ContentCopy as CopyIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Save as SaveIcon,
  VpnKey as KeyIcon,
  Tune as TuneIcon,
  Info as InfoIcon,
  Code as CodeIcon,
  CheckCircle as CheckIcon,
  Cancel as CancelIcon,
  UploadFile as UploadIcon,
  GitHub as GitHubIcon,
  Security as SecurityIcon,
  Link as LinkIcon,
  Edit as EditIcon,
  BugReport as BugIcon,
  PlayArrow as TestConnectionIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import PageContentLoader from '@/components/common/PageContentLoader';
import argusService, { ArgusProject, ArgusDsnKey, ArgusSourcemapRelease, ArgusIntegration, ArgusOwnershipRule, ArgusIssueTracker } from '@/services/argusService';
import { useOrgProject } from '@/contexts/OrgProjectContext';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <Box role="tabpanel" hidden={value !== index} sx={{ pt: 2.5 }}>
    {value === index && children}
  </Box>
);

const ArgusSettingsPage: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const isDark = theme.palette.mode === 'dark';

  const { currentProject } = useOrgProject();
  const projectId = currentProject?.id || '1';
  const [tab, setTab] = useState(0);

  const [project, setProject] = useState<ArgusProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Editable fields
  const [name, setName] = useState('');
  const [platform, setPlatform] = useState('');
  const [errorQuota, setErrorQuota] = useState(100000);
  const [txnSampleRate, setTxnSampleRate] = useState(1.0);
  const [sessionSampleRate, setSessionSampleRate] = useState(1.0);
  const [retentionDays, setRetentionDays] = useState(90);

  // Source map state
  const [sourcemapReleases, setSourcemapReleases] = useState<ArgusSourcemapRelease[]>([]);
  const [smLoading, setSmLoading] = useState(false);

  // Integration state
  const [integrations, setIntegrations] = useState<ArgusIntegration[]>([]);
  const [intLoading, setIntLoading] = useState(false);
  const [newIntProvider, setNewIntProvider] = useState('github');
  const [newIntRepoUrl, setNewIntRepoUrl] = useState('');
  const [newIntBranch, setNewIntBranch] = useState('main');

  // Issue Tracker state
  const [issueTrackers, setIssueTrackers] = useState<ArgusIssueTracker[]>([]);
  const [itLoading, setItLoading] = useState(false);
  const [newItProvider, setNewItProvider] = useState<'jira' | 'github' | 'linear'>('jira');
  const [newItName, setNewItName] = useState('');
  const [newItUrl, setNewItUrl] = useState('');
  const [newItToken, setNewItToken] = useState('');
  const [newItConfig, setNewItConfig] = useState<Record<string, string>>({});
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Ownership state
  const [ownershipRules, setOwnershipRules] = useState<ArgusOwnershipRule[]>([]);
  const [ownLoading, setOwnLoading] = useState(false);
  const [newRuleName, setNewRuleName] = useState('');
  const [newRuleType, setNewRuleType] = useState('path');
  const [newRulePattern, setNewRulePattern] = useState('');
  const [newRuleOwners, setNewRuleOwners] = useState('');

  const fetchProject = useCallback(async () => {
    setLoading(true);
    try {
      const data = await argusService.getProject(projectId);
      setProject(data);
      setName(data.name);
      setPlatform(data.platform);
      setErrorQuota(Number(data.error_quota_daily));
      setTxnSampleRate(Number(data.transaction_sample_rate));
      setSessionSampleRate(Number(data.session_sample_rate));
      setRetentionDays(Number(data.retention_days));
    } catch (error: any) {
      if (error?.response?.status === 404 || error?.status === 404) {
        try {
          const created = await argusService.createProject({
            gatrix_project_id: projectId,
            name: 'Default Project',
            slug: 'default',
            platform: 'javascript',
          });
          setProject(created);
          setName(created.name);
          setPlatform(created.platform);
          enqueueSnackbar(t('argus.settings.projectCreated', 'Argus project auto-created'), { variant: 'success' });
        } catch (createError) {
          console.error('Failed to auto-create project:', createError);
        }
      } else {
        console.error('Failed to fetch project:', error);
      }
    } finally {
      setLoading(false);
    }
  }, [projectId, enqueueSnackbar, t]);

  useEffect(() => { fetchProject(); }, [fetchProject]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await argusService.updateProject(projectId, {
        name,
        platform,
        error_quota_daily: errorQuota,
        transaction_sample_rate: txnSampleRate,
        session_sample_rate: sessionSampleRate,
        retention_days: retentionDays,
      });
      enqueueSnackbar(t('argus.settings.saveSuccess'), { variant: 'success' });
    } catch (error) {
      enqueueSnackbar(t('argus.settings.saveFailed'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleCopyDsn = (dsn: string) => {
    navigator.clipboard.writeText(dsn);
    enqueueSnackbar(t('argus.settings.dsnCopied'), { variant: 'info' });
  };

  const handleCreateKey = async () => {
    try {
      await argusService.createDsnKey(projectId, 'New Key');
      enqueueSnackbar(t('argus.settings.keyCreated'), { variant: 'success' });
      fetchProject();
    } catch (error) {
      enqueueSnackbar(t('argus.settings.keyCreateFailed'), { variant: 'error' });
    }
  };

  const handleRevokeKey = async (keyId: number) => {
    try {
      await argusService.revokeDsnKey(projectId, keyId);
      enqueueSnackbar(t('argus.settings.keyRevoked'), { variant: 'success' });
      fetchProject();
    } catch (error) {
      enqueueSnackbar(t('argus.settings.keyRevokeFailed'), { variant: 'error' });
    }
  };

  const dsnExample = project?.dsn_keys?.find(k => k.is_active)?.dsn || 'https://<key>@<host>/argus/<project-id>';

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SettingsIcon sx={{ color: theme.palette.primary.main }} />
          <Typography variant="h5" fontWeight={700}>
            {t('argus.settings.title')}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.disabled', fontSize: '0.8rem' }}>
            — {t('argus.settings.subtitle')}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton onClick={fetchProject} size="small"><RefreshIcon /></IconButton>
          <Button
            variant="contained"
            size="small"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={saving || loading}
            sx={{
              borderRadius: 1.5, textTransform: 'none', fontWeight: 600,
              boxShadow: 'none',
              '&:hover': { boxShadow: `0 2px 8px ${alpha(theme.palette.primary.main, 0.3)}` },
            }}
          >
            {saving ? t('common.saving', 'Saving...') : t('common.save')}
          </Button>
        </Box>
      </Box>

      <PageContentLoader loading={loading}>
        {/* Tabs */}
        <Paper elevation={0} sx={{
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          borderRadius: 2,
        }}>
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            sx={{
              px: 2, borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
              '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, fontSize: '0.85rem', minHeight: 48 },
            }}
          >
            <Tab icon={<SettingsIcon sx={{ fontSize: 18 }} />} iconPosition="start" label={t('argus.settings.general')} />
            <Tab icon={<TuneIcon sx={{ fontSize: 18 }} />} iconPosition="start" label={t('argus.settings.samplingQuotas')} />
            <Tab icon={<KeyIcon sx={{ fontSize: 18 }} />} iconPosition="start" label={t('argus.settings.dsnKeys')} />
            <Tab icon={<CodeIcon sx={{ fontSize: 18 }} />} iconPosition="start" label={t('argus.settings.sdkSetup', 'SDK Setup')} />
            <Tab icon={<UploadIcon sx={{ fontSize: 18 }} />} iconPosition="start" label={t('argus.settings.sourceMaps', 'Source Maps')} />
            <Tab icon={<GitHubIcon sx={{ fontSize: 18 }} />} iconPosition="start" label={t('argus.settings.integrations', 'Integrations')} />
            <Tab icon={<SecurityIcon sx={{ fontSize: 18 }} />} iconPosition="start" label={t('argus.settings.ownership', 'Ownership')} />
          </Tabs>

          {/* === Tab 0: General === */}
          <TabPanel value={tab} index={0}>
            <Box sx={{ p: 3 }}>
              <SectionTitle title={t('argus.settings.general')} subtitle={t('argus.settings.generalDesc', 'Configure basic project information such as name and platform.')} />
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2.5, mt: 2.5 }}>
                <SettingField label={t('argus.settings.projectName')} description={t('argus.settings.projectNameDesc', 'Project name displayed in Argus dashboard')}>
                  <TextField
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    size="small"
                    fullWidth
                    sx={inputSx(isDark)}
                  />
                </SettingField>
                <SettingField label={t('argus.settings.platform')} description={t('argus.settings.platformDesc', 'SDK platform for data collection (javascript, node, python, etc.)')}>
                  <TextField
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value)}
                    size="small"
                    fullWidth
                    sx={inputSx(isDark)}
                  />
                </SettingField>
                <SettingField label={t('argus.settings.projectId', 'Project ID')} description={t('argus.settings.projectIdDesc', 'Immutable internal identifier')}>
                  <TextField
                    value={projectId}
                    size="small"
                    fullWidth
                    disabled
                    sx={inputSx(isDark)}
                  />
                </SettingField>
                <SettingField label={t('argus.settings.projectSlug', 'Project Slug')} description={t('argus.settings.projectSlugDesc', 'Identifier used in URLs')}>
                  <TextField
                    value={project?.slug || ''}
                    size="small"
                    fullWidth
                    disabled
                    sx={inputSx(isDark)}
                  />
                </SettingField>
              </Box>
            </Box>
          </TabPanel>

          {/* === Tab 1: Sampling & Quotas === */}
          <TabPanel value={tab} index={1}>
            <Box sx={{ p: 3 }}>
              <SectionTitle title={t('argus.settings.samplingQuotas')} subtitle={t('argus.settings.samplingDesc', 'Configure data collection rates and daily limits.')} />

              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3, mt: 2.5 }}>
                {/* Error Quota */}
                <SettingField label={t('argus.settings.errorQuota')} description={t('argus.settings.errorQuotaDesc', 'Maximum daily error collection count. Exceeding events are dropped.')}>
                  <TextField
                    type="number"
                    value={errorQuota}
                    onChange={(e) => setErrorQuota(Number(e.target.value))}
                    size="small"
                    sx={{ ...inputSx(isDark), width: 200 }}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">/day</InputAdornment>,
                    }}
                  />
                </SettingField>

                {/* Retention */}
                <SettingField label={t('argus.settings.retentionDays')} description={t('argus.settings.retentionDesc', 'Event data retention period. Expired data is automatically deleted.')}>
                  <TextField
                    type="number"
                    value={retentionDays}
                    onChange={(e) => setRetentionDays(Number(e.target.value))}
                    size="small"
                    sx={{ ...inputSx(isDark), width: 150 }}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">{t('argus.settings.days')}</InputAdornment>,
                    }}
                  />
                </SettingField>
              </Box>

              <Divider sx={{ my: 3 }} />

              {/* Sample Rates */}
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
                <SettingField label={t('argus.settings.txnSampleRate')} description={t('argus.settings.txnSampleDesc', 'Performance transaction sampling rate. 1.0 = 100%')}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Slider
                      value={txnSampleRate}
                      onChange={(_, v) => setTxnSampleRate(v as number)}
                      min={0} max={1} step={0.01}
                      sx={{ flex: 1, maxWidth: 300 }}
                    />
                    <Chip
                      label={`${(txnSampleRate * 100).toFixed(0)}%`}
                      size="small"
                      sx={{
                        fontWeight: 700, minWidth: 52,
                        backgroundColor: alpha(txnSampleRate >= 0.5 ? '#4caf50' : '#ff9800', 0.12),
                        color: txnSampleRate >= 0.5 ? '#4caf50' : '#ff9800',
                        border: 'none',
                      }}
                    />
                  </Box>
                </SettingField>

                <SettingField label={t('argus.settings.sessionSampleRate')} description={t('argus.settings.sessionSampleDesc', 'Session data sampling rate. 1.0 = 100%')}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Slider
                      value={sessionSampleRate}
                      onChange={(_, v) => setSessionSampleRate(v as number)}
                      min={0} max={1} step={0.01}
                      sx={{ flex: 1, maxWidth: 300 }}
                    />
                    <Chip
                      label={`${(sessionSampleRate * 100).toFixed(0)}%`}
                      size="small"
                      sx={{
                        fontWeight: 700, minWidth: 52,
                        backgroundColor: alpha(sessionSampleRate >= 0.5 ? '#4caf50' : '#ff9800', 0.12),
                        color: sessionSampleRate >= 0.5 ? '#4caf50' : '#ff9800',
                        border: 'none',
                      }}
                    />
                  </Box>
                </SettingField>
              </Box>
            </Box>
          </TabPanel>

          {/* === Tab 2: DSN Keys === */}
          <TabPanel value={tab} index={2}>
            <Box sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
                <SectionTitle title={t('argus.settings.dsnKeys')} subtitle={t('argus.settings.dsnKeysDesc', 'Authentication keys used by client SDKs to send events.')} />
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={handleCreateKey}
                  variant="outlined"
                  sx={{ borderRadius: 1.5, textTransform: 'none', fontWeight: 600 }}
                >
                  {t('argus.settings.createKey')}
                </Button>
              </Box>

              {project?.dsn_keys?.length === 0 ? (
                <Box sx={{ py: 6, textAlign: 'center' }}>
                  <KeyIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                  <Typography color="text.secondary">{t('argus.settings.noKeys')}</Typography>
                  <Button size="small" startIcon={<AddIcon />} onClick={handleCreateKey} sx={{ mt: 1, textTransform: 'none' }}>
                    {t('argus.settings.createKey')}
                  </Button>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {project?.dsn_keys?.map((key) => (
                    <Paper
                      key={key.id}
                      elevation={0}
                      sx={{
                        p: 2, display: 'flex', alignItems: 'center', gap: 2,
                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                        borderRadius: 1.5,
                        borderLeft: `4px solid ${key.is_active ? '#4caf50' : '#9e9e9e'}`,
                        transition: 'all 0.15s',
                        '&:hover': { borderColor: key.is_active ? '#4caf50' : '#9e9e9e' },
                      }}
                    >
                      <Box sx={{ flex: 1, overflow: 'hidden' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <Typography variant="body2" fontWeight={600}>{key.label}</Typography>
                          <Chip
                            icon={key.is_active ? <CheckIcon sx={{ fontSize: '14px !important' }} /> : <CancelIcon sx={{ fontSize: '14px !important' }} />}
                            label={key.is_active ? t('common.active') : t('common.inactive')}
                            size="small"
                            sx={{
                              height: 22, fontWeight: 600, fontSize: '0.7rem',
                              backgroundColor: alpha(key.is_active ? '#4caf50' : '#9e9e9e', 0.12),
                              color: key.is_active ? '#4caf50' : '#9e9e9e',
                              border: 'none',
                              '& .MuiChip-icon': { color: key.is_active ? '#4caf50' : '#9e9e9e' },
                            }}
                          />
                        </Box>
                        <Box sx={{
                          display: 'flex', alignItems: 'center', gap: 1,
                          p: 0.8, borderRadius: 1,
                          backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.03)',
                        }}>
                          <Typography
                            variant="caption"
                            sx={{
                              fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                              fontSize: '0.75rem', flex: 1,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              color: isDark ? '#aaa' : '#555',
                              userSelect: 'all',
                            }}
                          >
                            {key.dsn}
                          </Typography>
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                        <Tooltip title={t('argus.settings.copyDsn', 'Copy DSN')} placement="top">
                          <IconButton size="small" onClick={() => handleCopyDsn(key.dsn)}
                            sx={{ '&:hover': { color: theme.palette.primary.main } }}
                          >
                            <CopyIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {key.is_active && (
                          <Tooltip title={t('argus.settings.deactivateKey', 'Deactivate key')} placement="top">
                            <IconButton size="small" color="error" onClick={() => handleRevokeKey(key.id)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </Paper>
                  ))}
                </Box>
              )}
            </Box>
          </TabPanel>

          {/* === Tab 3: SDK Setup === */}
          <TabPanel value={tab} index={3}>
            <Box sx={{ p: 3 }}>
              <SectionTitle title={t('argus.settings.sdkGuide', 'SDK Setup Guide')} subtitle={t('argus.settings.sdkGuideDesc', 'How to initialize the Argus SDK in your client.')} />

              <Box sx={{ mt: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {/* JavaScript */}
                <CodeBlock
                  title="JavaScript / TypeScript"
                  language="javascript"
                  code={`import * as Argus from '@argus/browser';

Argus.init({
  dsn: '${dsnExample}',
  environment: 'production',
  release: '${name}@1.0.0',
  tracesSampleRate: ${txnSampleRate},
  sessionSampleRate: ${sessionSampleRate},
});`}
                  isDark={isDark}
                  onCopy={handleCopyDsn}
                />

                {/* Node.js */}
                <CodeBlock
                  title="Node.js"
                  language="javascript"
                  code={`const Argus = require('@argus/node');

Argus.init({
  dsn: '${dsnExample}',
  environment: process.env.NODE_ENV,
  release: '${name}@1.0.0',
  tracesSampleRate: ${txnSampleRate},
});`}
                  isDark={isDark}
                  onCopy={handleCopyDsn}
                />

                {/* cURL */}
                <CodeBlock
                  title={`cURL (${t('argus.settings.testUse', 'Test')})`}
                  language="bash"
                  code={`curl -X POST '${window.location.origin}/argus/api/${projectId}/ingest/batch' \\
  -H 'Authorization: Bearer ${project?.dsn_keys?.find(k => k.is_active)?.public_key || '<your-key>'}' \\
  -H 'Content-Type: application/json' \\
  -d '{"events": [{"type": "error", "event_id": "test123", ...}]}'`}
                  isDark={isDark}
                  onCopy={handleCopyDsn}
                />
              </Box>
            </Box>
          </TabPanel>

          {/* === Tab 4: Source Maps === */}
          <TabPanel value={tab} index={4}>
            <Box sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
                <SectionTitle title={t('argus.settings.sourceMaps', 'Source Maps')} subtitle={t('argus.settings.sourceMapsDesc', 'Manage source map files to deobfuscate stack traces.')} />
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<RefreshIcon />}
                    onClick={async () => {
                      setSmLoading(true);
                      try {
                        const data = await argusService.listSourcemapReleases(projectId);
                        setSourcemapReleases(data);
                      } catch (e) { console.error(e); }
                      finally { setSmLoading(false); }
                    }}
                    sx={{ borderRadius: 1.5, textTransform: 'none' }}
                  >
                    {t('common.refresh', 'Refresh')}
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<UploadIcon />}
                    component="label"
                    sx={{ borderRadius: 1.5, textTransform: 'none', fontWeight: 600 }}
                  >
                    {t('common.upload', 'Upload')}
                    <input
                      type="file"
                      multiple
                      hidden
                      accept=".map,.js.map"
                      onChange={async (e) => {
                        const files = Array.from(e.target.files || []);
                        if (files.length === 0) return;
                        const release = prompt('릴리즈 버전을 입력하세요 (예: 1.0.0)');
                        if (!release) return;
                        try {
                          await argusService.uploadSourcemaps(projectId, release, files);
                          enqueueSnackbar(`${files.length}개 소스맵 업로드 완료`, { variant: 'success' });
                          const data = await argusService.listSourcemapReleases(projectId);
                          setSourcemapReleases(data);
                        } catch (err) {
                          enqueueSnackbar('소스맵 업로드 실패', { variant: 'error' });
                        }
                      }}
                    />
                  </Button>
                </Box>
              </Box>

              {/* CLI Guide */}
              <Paper elevation={0} sx={{
                p: 2, mb: 2.5,
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                borderRadius: 1.5,
                backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
              }}>
                <Typography variant="caption" fontWeight={600} sx={{ mb: 1, display: 'block' }}>CLI 업로드 예시</Typography>
                <Box sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: isDark ? '#aaa' : '#555', whiteSpace: 'pre' }}>
                  {`curl -X POST '${window.location.origin}/argus/api/${projectId}/sourcemaps' \\\n  -F 'release=1.0.0' \\\n  -F 'files=@dist/main.js.map' \\\n  -F 'files=@dist/vendor.js.map'`}
                </Box>
              </Paper>

              {/* Release List */}
              {sourcemapReleases.length === 0 ? (
                <Box sx={{ py: 6, textAlign: 'center' }}>
                  <UploadIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                  <Typography color="text.secondary">업로드된 소스맵이 없습니다</Typography>
                  <Typography variant="caption" color="text.disabled">빌드 시 소스맵을 업로드하면 스택트레이스가 원본 코드로 표시됩니다</Typography>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {sourcemapReleases.map((rel) => (
                    <Paper
                      key={rel.id}
                      elevation={0}
                      sx={{
                        p: 2, display: 'flex', alignItems: 'center', gap: 2,
                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                        borderRadius: 1.5,
                      }}
                    >
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" fontWeight={600}>{rel.release}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {rel.file_count} files · {new Date(rel.created_at).toLocaleString()}
                          {rel.dist && ` · dist: ${rel.dist}`}
                        </Typography>
                      </Box>
                      <Tooltip title="삭제">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={async () => {
                            try {
                              await argusService.deleteSourcemapRelease(projectId, rel.id);
                              setSourcemapReleases(prev => prev.filter(r => r.id !== rel.id));
                              enqueueSnackbar('소스맵 삭제 완료', { variant: 'success' });
                            } catch {
                              enqueueSnackbar('삭제 실패', { variant: 'error' });
                            }
                          }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Paper>
                  ))}
                </Box>
              )}
            </Box>
          </TabPanel>

          {/* === Tab 5: Integrations === */}
          <TabPanel value={tab} index={5}>
            <Box sx={{ p: 3 }}>
              <SectionTitle
                title={t('argus.settings.integrations', 'Integrations')}
                subtitle={t('argus.settings.integrationsDesc', 'Connect your repository to link commits with issues and releases.')}
              />

              {/* Add Integration Form */}
              <Paper elevation={0} sx={{
                p: 2, mt: 2, mb: 2.5, borderRadius: 1.5,
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
              }}>
                <Typography variant="caption" fontWeight={600} sx={{ mb: 1.5, display: 'block', textTransform: 'uppercase', color: 'text.secondary', fontSize: '0.7rem' }}>
                  {t('argus.settings.addIntegration', 'Add Integration')}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <FormControl size="small" sx={{ minWidth: 120 }}>
                    <InputLabel>Provider</InputLabel>
                    <Select value={newIntProvider} onChange={(e) => setNewIntProvider(e.target.value)} label="Provider">
                      <MenuItem value="github">GitHub</MenuItem>
                      <MenuItem value="gitlab">GitLab</MenuItem>
                      <MenuItem value="bitbucket">Bitbucket</MenuItem>
                    </Select>
                  </FormControl>
                  <TextField
                    size="small"
                    label={t('argus.settings.repoUrl', 'Repository URL')}
                    placeholder="https://github.com/org/repo"
                    value={newIntRepoUrl}
                    onChange={(e) => setNewIntRepoUrl(e.target.value)}
                    sx={{ flex: 1, minWidth: 250, ...inputSx(isDark) }}
                  />
                  <TextField
                    size="small"
                    label={t('argus.settings.defaultBranch', 'Branch')}
                    value={newIntBranch}
                    onChange={(e) => setNewIntBranch(e.target.value)}
                    sx={{ width: 100, ...inputSx(isDark) }}
                  />
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<AddIcon />}
                    disabled={!newIntRepoUrl.trim()}
                    onClick={async () => {
                      try {
                        await argusService.createIntegration(projectId, {
                          provider: newIntProvider,
                          repo_url: newIntRepoUrl.trim(),
                          default_branch: newIntBranch,
                        });
                        const updated = await argusService.listIntegrations(projectId);
                        setIntegrations(updated);
                        setNewIntRepoUrl('');
                        enqueueSnackbar(t('argus.settings.integrationAdded', 'Integration added'), { variant: 'success' });
                      } catch {
                        enqueueSnackbar(t('argus.settings.integrationFailed', 'Failed to add integration'), { variant: 'error' });
                      }
                    }}
                    sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 1.5 }}
                  >
                    {t('common.add', 'Add')}
                  </Button>
                </Box>
              </Paper>

              {/* Integration List */}
              <Button
                size="small"
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={async () => {
                  setIntLoading(true);
                  try {
                    const data = await argusService.listIntegrations(projectId);
                    setIntegrations(data);
                  } catch (e) { console.error(e); }
                  finally { setIntLoading(false); }
                }}
                sx={{ mb: 2, borderRadius: 1.5, textTransform: 'none' }}
              >
                {t('common.refresh', 'Refresh')}
              </Button>

              {integrations.length === 0 ? (
                <Box sx={{ py: 6, textAlign: 'center' }}>
                  <GitHubIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                  <Typography color="text.secondary">
                    {t('argus.settings.noIntegrations', 'No integrations configured')}
                  </Typography>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {integrations.map((intg) => (
                    <Paper
                      key={intg.id}
                      elevation={0}
                      sx={{
                        p: 2, display: 'flex', alignItems: 'center', gap: 2,
                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                        borderRadius: 1.5,
                        borderLeft: `4px solid ${intg.enabled ? '#4caf50' : '#9e9e9e'}`,
                      }}
                    >
                      <GitHubIcon sx={{ color: intg.provider === 'github' ? '#fff' : '#fc6d26', fontSize: 24 }} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={600} noWrap>{intg.repo_url}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {intg.provider} · {intg.default_branch} · {new Date(intg.created_at).toLocaleDateString()}
                        </Typography>
                      </Box>
                      <Chip
                        label={intg.enabled ? t('common.active') : t('common.inactive')}
                        size="small"
                        sx={{
                          height: 22, fontWeight: 600, fontSize: '0.7rem',
                          backgroundColor: alpha(intg.enabled ? '#4caf50' : '#9e9e9e', 0.12),
                          color: intg.enabled ? '#4caf50' : '#9e9e9e',
                          border: 'none',
                        }}
                      />
                      <IconButton size="small" color="error" onClick={async () => {
                        await argusService.deleteIntegration(projectId, intg.id);
                        setIntegrations(prev => prev.filter(i => i.id !== intg.id));
                        enqueueSnackbar('Deleted', { variant: 'success' });
                      }}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Paper>
                  ))}
                </Box>
              )}
            </Box>
          </TabPanel>

          {/* === Tab 5b: Issue Trackers (within Integrations) === */}
          {tab === 5 && (
            <Box sx={{ px: 3, pb: 3 }}>
              <Divider sx={{ mb: 3 }} />
              <SectionTitle
                title={t('argus.settings.issueTrackers', 'Issue Trackers')}
                subtitle={t('argus.settings.issueTrackersDesc', 'Connect external issue trackers like Jira, GitHub Issues, or Linear to create and link issues.')}
              />

              {/* Add Issue Tracker Form */}
              <Paper elevation={0} sx={{
                p: 2, mt: 2, mb: 2.5, borderRadius: 1.5,
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
              }}>
                <Typography variant="caption" fontWeight={600} sx={{ mb: 1.5, display: 'block', textTransform: 'uppercase', color: 'text.secondary', fontSize: '0.7rem' }}>
                  {t('argus.settings.addIssueTracker', 'Add Issue Tracker')}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <FormControl size="small" sx={{ minWidth: 110 }}>
                    <InputLabel>Provider</InputLabel>
                    <Select value={newItProvider} onChange={(e) => { setNewItProvider(e.target.value as any); setNewItConfig({}); }} label="Provider">
                      <MenuItem value="jira">Jira</MenuItem>
                      <MenuItem value="github">GitHub</MenuItem>
                      <MenuItem value="linear">Linear</MenuItem>
                    </Select>
                  </FormControl>
                  <TextField size="small" label={t('argus.settings.trackerName', 'Name')} placeholder="My Jira"
                    value={newItName} onChange={(e) => setNewItName(e.target.value)}
                    sx={{ width: 140, ...inputSx(isDark) }}
                  />
                  <TextField size="small" label="API URL"
                    placeholder={newItProvider === 'jira' ? 'https://myorg.atlassian.net' : newItProvider === 'github' ? 'https://api.github.com' : 'https://api.linear.app'}
                    value={newItUrl} onChange={(e) => setNewItUrl(e.target.value)}
                    sx={{ flex: 1, minWidth: 200, ...inputSx(isDark) }}
                  />
                  <TextField size="small" label="API Token" type="password"
                    value={newItToken} onChange={(e) => setNewItToken(e.target.value)}
                    sx={{ width: 180, ...inputSx(isDark) }}
                  />
                </Box>

                {/* Provider-specific config */}
                <Box sx={{ display: 'flex', gap: 1.5, mt: 1.5, flexWrap: 'wrap' }}>
                  {newItProvider === 'jira' && (
                    <>
                      <TextField size="small" label="Project Key" placeholder="PROJ"
                        value={newItConfig.project_key || ''} onChange={(e) => setNewItConfig({ ...newItConfig, project_key: e.target.value })}
                        sx={{ width: 120, ...inputSx(isDark) }}
                      />
                      <TextField size="small" label="Email" placeholder="user@company.com"
                        value={newItConfig.email || ''} onChange={(e) => setNewItConfig({ ...newItConfig, email: e.target.value })}
                        sx={{ width: 200, ...inputSx(isDark) }}
                      />
                      <TextField size="small" label="Issue Type" placeholder="Bug"
                        value={newItConfig.issue_type || ''} onChange={(e) => setNewItConfig({ ...newItConfig, issue_type: e.target.value })}
                        sx={{ width: 120, ...inputSx(isDark) }}
                      />
                    </>
                  )}
                  {newItProvider === 'github' && (
                    <TextField size="small" label="Repository" placeholder="owner/repo"
                      value={newItConfig.repo || ''} onChange={(e) => setNewItConfig({ ...newItConfig, repo: e.target.value })}
                      sx={{ width: 250, ...inputSx(isDark) }}
                    />
                  )}
                  {newItProvider === 'linear' && (
                    <TextField size="small" label="Team ID" placeholder="team-uuid"
                      value={newItConfig.team_id || ''} onChange={(e) => setNewItConfig({ ...newItConfig, team_id: e.target.value })}
                      sx={{ width: 250, ...inputSx(isDark) }}
                    />
                  )}
                </Box>

                <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                  <Button variant="contained" size="small" startIcon={<AddIcon />}
                    disabled={!newItName.trim() || !newItUrl.trim() || !newItToken.trim()}
                    onClick={async () => {
                      try {
                        await argusService.createIssueTracker(projectId, {
                          provider: newItProvider, name: newItName.trim(),
                          api_url: newItUrl.trim(), api_token: newItToken.trim(),
                          config: Object.keys(newItConfig).length > 0 ? newItConfig : undefined,
                        });
                        setIssueTrackers(await argusService.listIssueTrackers(projectId));
                        setNewItName(''); setNewItUrl(''); setNewItToken(''); setNewItConfig({});
                        enqueueSnackbar(t('argus.settings.trackerAdded', 'Issue tracker added'), { variant: 'success' });
                      } catch {
                        enqueueSnackbar(t('argus.settings.trackerAddFailed', 'Failed to add tracker'), { variant: 'error' });
                      }
                    }}
                    sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 1.5 }}
                  >
                    {t('common.add', 'Add')}
                  </Button>
                </Box>
              </Paper>

              {/* Issue Tracker List */}
              <Button size="small" variant="outlined" startIcon={<RefreshIcon />}
                onClick={async () => {
                  setItLoading(true);
                  try { setIssueTrackers(await argusService.listIssueTrackers(projectId)); }
                  catch (e) { console.error(e); }
                  finally { setItLoading(false); }
                }}
                sx={{ mb: 2, borderRadius: 1.5, textTransform: 'none' }}
              >
                {t('common.refresh', 'Refresh')}
              </Button>

              {issueTrackers.length === 0 ? (
                <Box sx={{ py: 4, textAlign: 'center' }}>
                  <BugIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                  <Typography color="text.secondary" sx={{ fontSize: '0.85rem' }}>
                    {t('argus.settings.noIssueTrackers', 'No issue trackers configured')}
                  </Typography>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {issueTrackers.map((tracker) => {
                    const pColor: Record<string, string> = { jira: '#0052CC', github: '#333', linear: '#5E6AD2' };
                    const pLabel: Record<string, string> = { jira: 'Jira', github: 'GitHub Issues', linear: 'Linear' };
                    return (
                      <Paper key={tracker.id} elevation={0} sx={{
                        p: 2, display: 'flex', alignItems: 'center', gap: 2,
                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                        borderRadius: 1.5,
                        borderLeft: `4px solid ${tracker.enabled ? pColor[tracker.provider] || '#9e9e9e' : '#9e9e9e'}`,
                      }}>
                        <BugIcon sx={{ color: pColor[tracker.provider] || '#9e9e9e', fontSize: 24 }} />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" fontWeight={600}>{tracker.name}</Typography>
                            <Chip label={pLabel[tracker.provider] || tracker.provider} size="small"
                              sx={{ height: 20, fontSize: '0.62rem', fontWeight: 700,
                                backgroundColor: alpha(pColor[tracker.provider] || '#9e9e9e', 0.1),
                                color: pColor[tracker.provider] || '#9e9e9e', border: 'none',
                              }}
                            />
                          </Box>
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {tracker.api_url}
                            {tracker.config?.project_key && ` · ${tracker.config.project_key}`}
                            {tracker.config?.repo && ` · ${tracker.config.repo}`}
                          </Typography>
                        </Box>
                        <Tooltip title={t('argus.settings.testConnection', 'Test Connection')}>
                          <IconButton size="small" onClick={async () => {
                            try {
                              const result = await argusService.testIssueTracker(projectId, tracker.id);
                              enqueueSnackbar(result.ok ? result.message : `Failed: ${result.message}`,
                                { variant: result.ok ? 'success' : 'error' });
                            } catch { enqueueSnackbar('Test failed', { variant: 'error' }); }
                          }} sx={{ '&:hover': { color: '#4caf50' } }}>
                            <TestConnectionIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Chip label={tracker.enabled ? t('common.active') : t('common.inactive')} size="small"
                          onClick={async () => {
                            await argusService.updateIssueTracker(projectId, tracker.id, { enabled: !tracker.enabled });
                            setIssueTrackers(await argusService.listIssueTrackers(projectId));
                          }}
                          sx={{ height: 22, fontWeight: 600, fontSize: '0.7rem', cursor: 'pointer',
                            backgroundColor: alpha(tracker.enabled ? '#4caf50' : '#9e9e9e', 0.12),
                            color: tracker.enabled ? '#4caf50' : '#9e9e9e', border: 'none',
                          }}
                        />
                        <IconButton size="small" color="error" onClick={async () => {
                          await argusService.deleteIssueTracker(projectId, tracker.id);
                          setIssueTrackers(prev => prev.filter(i => i.id !== tracker.id));
                          enqueueSnackbar('Deleted', { variant: 'success' });
                        }}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Paper>
                    );
                  })}
                </Box>
              )}
            </Box>
          )}

          {/* === Tab 6: Ownership Rules === */}
          <TabPanel value={tab} index={6}>
            <Box sx={{ p: 3 }}>
              <SectionTitle
                title={t('argus.settings.ownership', 'Ownership Rules')}
                subtitle={t('argus.settings.ownershipDesc', 'Define rules to auto-assign issues based on file paths, modules, or tags — like CODEOWNERS.')}
              />

              {/* Add Rule Form */}
              <Paper elevation={0} sx={{
                p: 2, mt: 2, mb: 2.5, borderRadius: 1.5,
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
              }}>
                <Typography variant="caption" fontWeight={600} sx={{ mb: 1.5, display: 'block', textTransform: 'uppercase', color: 'text.secondary', fontSize: '0.7rem' }}>
                  {t('argus.settings.addRule', 'Add Rule')}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <TextField
                    size="small"
                    label={t('argus.settings.ruleName', 'Rule Name')}
                    placeholder="Frontend Team"
                    value={newRuleName}
                    onChange={(e) => setNewRuleName(e.target.value)}
                    sx={{ width: 160, ...inputSx(isDark) }}
                  />
                  <FormControl size="small" sx={{ minWidth: 100 }}>
                    <InputLabel>{t('argus.settings.matchType', 'Type')}</InputLabel>
                    <Select value={newRuleType} onChange={(e) => setNewRuleType(e.target.value)} label="Type">
                      <MenuItem value="path">Path</MenuItem>
                      <MenuItem value="module">Module</MenuItem>
                      <MenuItem value="tag">Tag</MenuItem>
                      <MenuItem value="url">URL</MenuItem>
                    </Select>
                  </FormControl>
                  <TextField
                    size="small"
                    label={t('argus.settings.pattern', 'Pattern')}
                    placeholder="src/components/**"
                    value={newRulePattern}
                    onChange={(e) => setNewRulePattern(e.target.value)}
                    sx={{ flex: 1, minWidth: 180, ...inputSx(isDark), '& .MuiOutlinedInput-root': { ...inputSx(isDark)['& .MuiOutlinedInput-root'], fontFamily: 'monospace' } }}
                  />
                  <TextField
                    size="small"
                    label={t('argus.settings.owners', 'Owners')}
                    placeholder="alice, bob"
                    value={newRuleOwners}
                    onChange={(e) => setNewRuleOwners(e.target.value)}
                    sx={{ width: 180, ...inputSx(isDark) }}
                  />
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<AddIcon />}
                    disabled={!newRuleName.trim() || !newRulePattern.trim() || !newRuleOwners.trim()}
                    onClick={async () => {
                      try {
                        await argusService.createOwnershipRule(projectId, {
                          name: newRuleName.trim(),
                          match_type: newRuleType,
                          match_pattern: newRulePattern.trim(),
                          owners: newRuleOwners.split(',').map(o => o.trim()).filter(Boolean),
                        });
                        const updated = await argusService.listOwnershipRules(projectId);
                        setOwnershipRules(updated);
                        setNewRuleName(''); setNewRulePattern(''); setNewRuleOwners('');
                        enqueueSnackbar(t('argus.settings.ruleAdded', 'Rule added'), { variant: 'success' });
                      } catch {
                        enqueueSnackbar(t('argus.settings.ruleFailed', 'Failed to add rule'), { variant: 'error' });
                      }
                    }}
                    sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 1.5 }}
                  >
                    {t('common.add', 'Add')}
                  </Button>
                </Box>
              </Paper>

              {/* Rules List */}
              <Button
                size="small"
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={async () => {
                  setOwnLoading(true);
                  try {
                    const data = await argusService.listOwnershipRules(projectId);
                    setOwnershipRules(data);
                  } catch (e) { console.error(e); }
                  finally { setOwnLoading(false); }
                }}
                sx={{ mb: 2, borderRadius: 1.5, textTransform: 'none' }}
              >
                {t('common.refresh', 'Refresh')}
              </Button>

              {ownershipRules.length === 0 ? (
                <Box sx={{ py: 6, textAlign: 'center' }}>
                  <SecurityIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                  <Typography color="text.secondary">
                    {t('argus.settings.noRules', 'No ownership rules defined')}
                  </Typography>
                  <Typography variant="caption" color="text.disabled">
                    {t('argus.settings.noRulesHint', 'Rules auto-assign issues to team members based on matching patterns.')}
                  </Typography>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {ownershipRules.map((rule) => {
                    const owners = typeof rule.owners === 'string' ? JSON.parse(rule.owners) : rule.owners;
                    return (
                      <Paper
                        key={rule.id}
                        elevation={0}
                        sx={{
                          p: 2, display: 'flex', alignItems: 'center', gap: 2,
                          border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                          borderRadius: 1.5,
                          borderLeft: `4px solid ${rule.enabled ? '#7c4dff' : '#9e9e9e'}`,
                        }}
                      >
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                            <Typography variant="body2" fontWeight={600}>{rule.name}</Typography>
                            <Chip label={rule.match_type} size="small" sx={{ height: 18, fontSize: '0.62rem', fontWeight: 700 }} />
                            {rule.auto_assign && (
                              <Chip label="auto-assign" size="small" sx={{ height: 18, fontSize: '0.62rem', backgroundColor: alpha('#7c4dff', 0.1), color: '#7c4dff', border: 'none' }} />
                            )}
                          </Box>
                          <Typography variant="caption" sx={{ fontFamily: 'monospace', color: isDark ? '#aaa' : '#666', fontSize: '0.72rem' }}>
                            {rule.match_pattern}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                            {(owners as string[]).map((o: string, idx: number) => (
                              <Chip key={idx} label={o} size="small" sx={{ height: 20, fontSize: '0.65rem', fontWeight: 600 }} />
                            ))}
                          </Box>
                        </Box>
                        <IconButton size="small" color="error" onClick={async () => {
                          await argusService.deleteOwnershipRule(projectId, rule.id);
                          setOwnershipRules(prev => prev.filter(r => r.id !== rule.id));
                          enqueueSnackbar('Deleted', { variant: 'success' });
                        }}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Paper>
                    );
                  })}
                </Box>
              )}
            </Box>
          </TabPanel>
        </Paper>
      </PageContentLoader>
    </Box>
  );
};

// --- Sub-components ---

const SectionTitle: React.FC<{ title: string; subtitle: string }> = ({ title, subtitle }) => (
  <Box>
    <Typography variant="subtitle1" fontWeight={700}>{title}</Typography>
    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.78rem' }}>{subtitle}</Typography>
  </Box>
);

const SettingField: React.FC<{ label: string; description: string; children: React.ReactNode }> = ({ label, description, children }) => (
  <Box>
    <Typography variant="body2" fontWeight={600} sx={{ mb: 0.3 }}>{label}</Typography>
    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem', display: 'block', mb: 1 }}>{description}</Typography>
    {children}
  </Box>
);

const CodeBlock: React.FC<{ title: string; language: string; code: string; isDark: boolean; onCopy: (text: string) => void }> = ({
  title, language, code, isDark, onCopy,
}) => (
  <Paper elevation={0} sx={{
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
    borderRadius: 1.5, overflow: 'hidden',
  }}>
    <Box sx={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      px: 2, py: 0.8,
      backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
      borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
    }}>
      <Typography variant="caption" fontWeight={600} sx={{ fontSize: '0.75rem' }}>{title}</Typography>
      <Tooltip title="코드 복사">
        <IconButton size="small" onClick={() => onCopy(code)}>
          <CopyIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </Tooltip>
    </Box>
    {/* @ts-expect-error react-syntax-highlighter type incompatibility with React 18 */}
    <SyntaxHighlighter
      language={language}
      style={isDark ? vscDarkPlus : oneLight}
      customStyle={{
        margin: 0,
        padding: '16px',
        fontSize: '0.78rem',
        lineHeight: 1.6,
        borderRadius: 0,
        background: isDark ? '#1e1e2e' : '#fafafa',
      }}
      showLineNumbers={false}
    >
      {code}
    </SyntaxHighlighter>
  </Paper>
);

const inputSx = (isDark: boolean) => ({
  '& .MuiOutlinedInput-root': {
    borderRadius: 1.5,
    backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
  },
});

export default ArgusSettingsPage;
