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
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import PageContentLoader from '@/components/common/PageContentLoader';
import argusService, { ArgusProject, ArgusDsnKey } from '@/services/argusService';

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

  const projectId = '1';
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
        <Typography variant="h5" fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SettingsIcon sx={{ color: theme.palette.primary.main }} />
          {t('argus.settings.title')}
        </Typography>
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
            {saving ? '저장 중...' : t('common.save')}
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
            <Tab icon={<CodeIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="SDK 설정" />
          </Tabs>

          {/* === Tab 0: General === */}
          <TabPanel value={tab} index={0}>
            <Box sx={{ p: 3 }}>
              <SectionTitle title={t('argus.settings.general')} subtitle="프로젝트 이름, 플랫폼 등 기본 정보를 설정합니다." />
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2.5, mt: 2.5 }}>
                <SettingField label={t('argus.settings.projectName')} description="Argus 대시보드에 표시될 프로젝트 이름">
                  <TextField
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    size="small"
                    fullWidth
                    sx={inputSx(isDark)}
                  />
                </SettingField>
                <SettingField label={t('argus.settings.platform')} description="데이터 수집 SDK 플랫폼 (javascript, node, python 등)">
                  <TextField
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value)}
                    size="small"
                    fullWidth
                    sx={inputSx(isDark)}
                  />
                </SettingField>
                <SettingField label="프로젝트 ID" description="변경 불가능한 내부 식별자">
                  <TextField
                    value={projectId}
                    size="small"
                    fullWidth
                    disabled
                    sx={inputSx(isDark)}
                  />
                </SettingField>
                <SettingField label="프로젝트 Slug" description="URL에 사용되는 식별자">
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
              <SectionTitle title={t('argus.settings.samplingQuotas')} subtitle="데이터 수집 비율과 일일 한도를 설정합니다." />

              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3, mt: 2.5 }}>
                {/* Error Quota */}
                <SettingField label={t('argus.settings.errorQuota')} description="일일 최대 에러 수집 건수. 초과 시 드랍됩니다.">
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
                <SettingField label={t('argus.settings.retentionDays')} description="이벤트 데이터 보존 기간. 초과 데이터는 자동 삭제됩니다.">
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
                <SettingField label={t('argus.settings.txnSampleRate')} description="성능 트랜잭션 샘플링 비율. 1.0 = 100%">
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

                <SettingField label={t('argus.settings.sessionSampleRate')} description="세션 데이터 샘플링 비율. 1.0 = 100%">
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
                <SectionTitle title={t('argus.settings.dsnKeys')} subtitle="클라이언트 SDK에서 이벤트를 전송할 때 사용하는 인증 키입니다." />
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
                    키 생성하기
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
                        <Tooltip title="DSN 복사" placement="top">
                          <IconButton size="small" onClick={() => handleCopyDsn(key.dsn)}
                            sx={{ '&:hover': { color: theme.palette.primary.main } }}
                          >
                            <CopyIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {key.is_active && (
                          <Tooltip title="키 비활성화" placement="top">
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
              <SectionTitle title="SDK 설정 가이드" subtitle="클라이언트에서 Argus SDK를 초기화하는 방법입니다." />

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
                  title="cURL (테스트용)"
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
