import React, { useState, useCallback, useEffect } from 'react';
import {
  Dialog, Button, Typography, Box, TextField, IconButton,
  Alert, CircularProgress, useTheme, alpha, Tooltip, Fade,
  InputAdornment,
} from '@mui/material';
import {
  ContentCopy as CopyIcon, OpenInNew as OpenInNewIcon,
  Check as CheckIcon, Close as CloseIcon, GitHub as GitHubIcon,
  Cloud as GitLabIcon, Storage as BitbucketIcon,
  ArrowForward as ArrowForwardIcon,
  ArrowBack as ArrowBackIcon, Lock as LockIcon,
  Visibility as VisibilityIcon, VisibilityOff as VisibilityOffIcon,
  Chat as SlackIcon, PlayArrow as PlayArrowIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { argusService } from '@/services/argusService';

// ─── Provider Config ────────────────────────────────────────────────
interface StepDef {
  titleKey: string;
  subtitleKey: string;
  icon: string;
}

const PROVIDER_CONFIG = {
  github: {
    name: 'GitHub',
    color: '#24292f',
    accentColor: '#58a6ff',
    gradient: 'linear-gradient(160deg, #0d1117 0%, #161b22 30%, #1a2332 60%, #0f2540 100%)',
    icon: <GitHubIcon />,
    settingsUrl: 'https://github.com/settings/apps/new',
    titleKey: 'argus.settings.githubWizard.title',
    subtitleKey: 'argus.settings.githubWizard.subtitle',
    saveKey: 'argus.settings.githubWizard.saveConfig',
    steps: [
      { titleKey: 'argus.settings.githubWizard.step1Title', subtitleKey: 'argus.settings.githubWizard.step1Subtitle', icon: '🚀' },
      { titleKey: 'argus.settings.githubWizard.step2Title', subtitleKey: 'argus.settings.githubWizard.step2Subtitle', icon: '🔗' },
      { titleKey: 'argus.settings.githubWizard.step3Title', subtitleKey: 'argus.settings.githubWizard.step3Subtitle', icon: '🔐' },
      { titleKey: 'argus.settings.githubWizard.step4Title', subtitleKey: 'argus.settings.githubWizard.step4Subtitle', icon: '🔑' },
    ] as StepDef[],
  },
  gitlab: {
    name: 'GitLab',
    color: '#fc6d26',
    accentColor: '#58a6ff',
    gradient: 'linear-gradient(145deg, #292961 0%, #1f1f3a 50%, #171730 100%)',
    icon: <GitLabIcon />,
    settingsUrl: '',
    titleKey: 'argus.settings.gitlabWizard.title',
    subtitleKey: 'argus.settings.gitlabWizard.subtitle',
    saveKey: 'argus.settings.gitlabWizard.saveConfig',
    steps: [
      { titleKey: 'argus.settings.gitlabWizard.step1Title', subtitleKey: 'argus.settings.gitlabWizard.step1Subtitle', icon: '🚀' },
      { titleKey: 'argus.settings.gitlabWizard.step2Title', subtitleKey: 'argus.settings.gitlabWizard.step2Subtitle', icon: '🔗' },
      { titleKey: 'argus.settings.gitlabWizard.step3Title', subtitleKey: 'argus.settings.gitlabWizard.step3Subtitle', icon: '🔐' },
      { titleKey: 'argus.settings.gitlabWizard.step4Title', subtitleKey: 'argus.settings.gitlabWizard.step4Subtitle', icon: '🔑' },
    ] as StepDef[],
  },
  bitbucket: {
    name: 'Bitbucket',
    color: '#0052CC',
    accentColor: '#58a6ff',
    gradient: 'linear-gradient(160deg, #0747a6 0%, #0a3578 40%, #091e42 100%)',
    icon: <BitbucketIcon />,
    settingsUrl: 'https://bitbucket.org/account/settings/app-passwords/',
    titleKey: 'argus.settings.bitbucketWizard.title',
    subtitleKey: 'argus.settings.bitbucketWizard.subtitle',
    saveKey: 'argus.settings.bitbucketWizard.saveConfig',
    steps: [
      { titleKey: 'argus.settings.bitbucketWizard.step1Title', subtitleKey: 'argus.settings.bitbucketWizard.step1Subtitle', icon: '🚀' },
      { titleKey: 'argus.settings.bitbucketWizard.step2Title', subtitleKey: 'argus.settings.bitbucketWizard.step2Subtitle', icon: '🔑' },
    ] as StepDef[],
  },
  slack: {
    name: 'Slack',
    color: '#4A154B',
    accentColor: '#36C5F0',
    gradient: 'linear-gradient(160deg, #4A154B 0%, #3D1142 30%, #2D0E35 60%, #1A0A20 100%)',
    icon: <SlackIcon />,
    settingsUrl: 'https://api.slack.com/apps',
    titleKey: 'argus.settings.slackWizard.title',
    subtitleKey: 'argus.settings.slackWizard.subtitle',
    saveKey: 'argus.settings.slackWizard.saveConfig',
    steps: [
      { titleKey: 'argus.settings.slackWizard.step1Title', subtitleKey: 'argus.settings.slackWizard.step1Subtitle', icon: '🚀' },
      { titleKey: 'argus.settings.slackWizard.step2Title', subtitleKey: 'argus.settings.slackWizard.step2Subtitle', icon: '🔐' },
      { titleKey: 'argus.settings.slackWizard.step3Title', subtitleKey: 'argus.settings.slackWizard.step3Subtitle', icon: '🔑' },
    ] as StepDef[],
  },
};

// ─── Copiable URL Row ───────────────────────────────────────────────
const CopyableUrl: React.FC<{
  label: string; value: string; isDark: boolean;
}> = ({ label, value, isDark }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Box sx={{ mb: 2 }}>
      <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: 'text.secondary', mb: 0.5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </Typography>
      <Box
        onClick={handleCopy}
        sx={{
          display: 'flex', alignItems: 'center', gap: 1,
          p: '10px 14px', borderRadius: '8px', cursor: 'pointer',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
          backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
          transition: 'all 0.15s ease',
          '&:hover': {
            borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
          },
        }}
      >
        <Typography sx={{
          flex: 1, fontSize: '0.82rem', color: isDark ? '#c9d1d9' : '#24292f', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {value}
        </Typography>
        <Tooltip title={copied ? '✓ 복사됨' : '클릭하여 복사'} placement="top">
          <Box sx={{ color: copied ? '#2ea44f' : 'text.secondary', display: 'flex', alignItems: 'center', transition: 'color 0.15s' }}>
            {copied ? <CheckIcon sx={{ fontSize: 16 }} /> : <CopyIcon sx={{ fontSize: 16 }} />}
          </Box>
        </Tooltip>
      </Box>
    </Box>
  );
};

// ─── Permission/Scope Item ──────────────────────────────────────────
const PermissionItem: React.FC<{
  title: string; items: string[]; isDark: boolean; color: string;
}> = ({ title, items, isDark, color }) => (
  <Box sx={{
    p: 2, borderRadius: '10px', mb: 1.5,
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
    backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
  }}>
    <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: alpha(color, 0.8), mb: 1, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {title}
    </Typography>
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8 }}>
      {items.map(item => (
        <Box key={item} sx={{
          px: 1.2, py: 0.4, borderRadius: '6px', fontSize: '0.78rem', fontWeight: 500,
          backgroundColor: alpha(color, isDark ? 0.15 : 0.08), color: isDark ? alpha(color, 0.9) : color,
          }}>
          {item}
        </Box>
      ))}
    </Box>
  </Box>
);

// ─── Styled Input ───────────────────────────────────────────────────
const WizardInput: React.FC<{
  label: string; value: string; onChange: (v: string) => void;
  isDark: boolean; type?: string; multiline?: boolean; rows?: number;
  hint?: string; required?: boolean; placeholder?: string;
}> = ({ label, value, onChange, isDark, type = 'text', multiline, rows, hint, required, placeholder }) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  return (
    <Box sx={{ mb: 2 }}>
      <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'text.secondary', mb: 0.5 }}>
        {label} {required && <Box component="span" sx={{ color: '#ef4444' }}>*</Box>}
      </Typography>
      <TextField
        fullWidth size="small" value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        type={isPassword && !showPassword ? 'password' : 'text'}
        multiline={multiline} rows={rows}
        autoComplete={isPassword ? 'new-password' : 'off'}
        inputProps={{ autoComplete: isPassword ? 'new-password' : 'off' }}
        InputProps={{
          ...(isPassword ? {
            endAdornment: (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setShowPassword(!showPassword)} edge="end" sx={{ opacity: 0.5 }}>
                  {showPassword ? <VisibilityOffIcon sx={{ fontSize: 16 }} /> : <VisibilityIcon sx={{ fontSize: 16 }} />}
                </IconButton>
              </InputAdornment>
            ),
          } : {}),
        }}
        sx={{
          '& .MuiOutlinedInput-root': {
            borderRadius: '8px', fontSize: '0.85rem',
            backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
          },
        }}
      />
      {hint && <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled', mt: 0.4, fontStyle: 'italic' }}>{hint}</Typography>}
    </Box>
  );
};

// Helper form element that wraps WizardInput with autoComplete off
const WizardFormContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <form autoComplete="off" onSubmit={e => e.preventDefault()} style={{ display: 'contents' }}>
    {children}
  </form>
);

// ─── Main Component ─────────────────────────────────────────────────
interface GlobalIntegrationWizardModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  provider: 'github' | 'gitlab' | 'bitbucket' | 'slack';
}

export const GlobalIntegrationWizardModal: React.FC<GlobalIntegrationWizardModalProps> = ({
  open, onClose, onSuccess, provider,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const cfg = PROVIDER_CONFIG[provider];
  const totalSteps = cfg.steps.length;

  // GitHub form
  const [ghForm, setGhForm] = useState({ appId: '', clientId: '', clientSecret: '', webhookSecret: '', privateKey: '' });
  // GitLab form — instanceUrl is empty; placeholder shows 'https://gitlab.com'
  const [glForm, setGlForm] = useState({ instanceUrl: '', applicationId: '', applicationSecret: '', webhookSecret: '' });
  // Bitbucket form
  const [bbForm, setBbForm] = useState({ workspace: '', username: '', appPassword: '' });
  // Slack form
  const [slackForm, setSlackForm] = useState({ botToken: '', signingSecret: '' });
  const [slackTestResult, setSlackTestResult] = useState<{ ok: boolean; team?: string; user?: string; error?: string } | null>(null);
  const [slackTesting, setSlackTesting] = useState(false);

  // GitHub Test State
  const [ghTestResult, setGhTestResult] = useState<{ ok: boolean; name?: string; html_url?: string; error?: string } | null>(null);
  const [ghTesting, setGhTesting] = useState(false);

  // GitLab Test State
  const [glTestResult, setGlTestResult] = useState<{ ok: boolean; message?: string; error?: string } | null>(null);
  const [glTesting, setGlTesting] = useState(false);

  // Bitbucket Test State
  const [bbTestResult, setBbTestResult] = useState<{ ok: boolean; display_name?: string; account_id?: string; error?: string } | null>(null);
  const [bbTesting, setBbTesting] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setActiveStep(0);
      setError('');
      setLoading(false);
      // Reset ALL form data to prevent stale values / browser autofill artifacts
      setGhForm({ appId: '', clientId: '', clientSecret: '', webhookSecret: '', privateKey: '' });
      setGlForm({ instanceUrl: '', applicationId: '', applicationSecret: '', webhookSecret: '' });
      setBbForm({ workspace: '', username: '', appPassword: '' });
      setSlackForm({ botToken: '', signingSecret: '' });
      setSlackTestResult(null);
      setSlackTesting(false);
      setGhTestResult(null);
      setGhTesting(false);
      setGlTestResult(null);
      setGlTesting(false);
      setBbTestResult(null);
      setBbTesting(false);
    }
  }, [open]);

  const baseUrl = import.meta.env.VITE_APP_URL || window.location.origin;

  const handleSave = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (provider === 'github') {
        await argusService.saveGlobalIntegrationConfig(provider, {
          name: 'GitHub App',
          credentials: {
            app_id: ghForm.appId, client_id: ghForm.clientId,
            client_secret: ghForm.clientSecret, webhook_secret: ghForm.webhookSecret,
            private_key: ghForm.privateKey,
          },
        });
      } else if (provider === 'gitlab') {
        await argusService.saveGlobalIntegrationConfig(provider, {
          name: 'GitLab OAuth',
          url: glForm.instanceUrl,
          credentials: {
            instance_url: glForm.instanceUrl, application_id: glForm.applicationId,
            application_secret: glForm.applicationSecret, webhook_secret: glForm.webhookSecret,
          },
        });
      } else if (provider === 'slack') {
        await argusService.saveGlobalIntegrationConfig(provider, {
          name: 'Slack App',
          credentials: {
            bot_token: slackForm.botToken,
            signing_secret: slackForm.signingSecret || undefined,
          },
        });
      } else {
        await argusService.saveGlobalIntegrationConfig(provider, {
          name: 'Bitbucket',
          credentials: {
            workspace: bbForm.workspace, username: bbForm.username,
            app_password: bbForm.appPassword,
          },
        });
      }
      onSuccess();
      setActiveStep(0);
    } catch (err: any) {
      setError(err.message || 'Failed to save');
    } finally {
      setLoading(false);
    }
  }, [provider, ghForm, glForm, bbForm, onSuccess]);

  const canProceed = useCallback(() => {
    const lastStep = cfg.steps.length - 1;
    if (activeStep < lastStep) return true;
    if (provider === 'github') return !!(ghForm.appId && ghForm.clientId && ghForm.clientSecret && ghForm.privateKey);
    if (provider === 'gitlab') return !!(glForm.instanceUrl && glForm.applicationId && glForm.applicationSecret);
    if (provider === 'slack') return !!slackForm.botToken;
    return !!(bbForm.workspace && bbForm.username && bbForm.appPassword);
  }, [activeStep, provider, ghForm, glForm, bbForm, cfg.steps.length]);

  // ─── Step Content Renderers ────────────────────────────────────────

  const renderGithubStep = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Box>
            <Typography sx={{ fontSize: '0.88rem', lineHeight: 1.7, color: 'text.secondary', mb: 3 }}>
              {t('argus.settings.githubWizard.step1Instruction', 'Click the button below to open GitHub Developer Settings in a new tab. Create a new GitHub App.')}
            </Typography>
            <Box sx={{
              p: 3, borderRadius: '12px', textAlign: 'center',
              border: `2px dashed ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
              backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
            }}>
              <GitHubIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2, opacity: 0.5 }} />
              <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary', mb: 2.5 }}>
                {t('argus.settings.githubWizard.step1Desc')}
              </Typography>
              <Button
                variant="contained" size="large" endIcon={<OpenInNewIcon />}
                href="https://github.com/settings/apps/new"
                target="_blank" rel="noopener noreferrer"
                sx={{
                  borderRadius: '10px', textTransform: 'none', fontWeight: 700, px: 4, py: 1.2,
                  backgroundColor: '#58a6ff', color: '#fff',
                  '&:hover': { backgroundColor: '#4090e0' },
                }}
              >
                {t('argus.settings.githubWizard.goToGithub')}
              </Button>
            </Box>
          </Box>
        );
      case 1:
        return (
          <Box>
            <Typography sx={{ fontSize: '0.88rem', lineHeight: 1.7, color: 'text.secondary', mb: 3 }}>
              {t('argus.settings.githubWizard.step2Desc')}
            </Typography>
            <CopyableUrl label={t('argus.settings.githubWizard.homepageUrl')} value={baseUrl} isDark={isDark} />
            <CopyableUrl label={t('argus.settings.githubWizard.callbackUrl')} value={`${baseUrl}/api/argus/integrations/github/callback`} isDark={isDark} />
            <CopyableUrl label={t('argus.settings.githubWizard.webhookUrl')} value={`${baseUrl}/api/argus/webhooks/github`} isDark={isDark} />
          </Box>
        );
      case 2:
        return (
          <Box>
            <Typography sx={{ fontSize: '0.88rem', lineHeight: 1.7, color: 'text.secondary', mb: 3 }}>
              {t('argus.settings.githubWizard.step3Desc')}
            </Typography>
            <PermissionItem
              title={t('argus.settings.githubWizard.permissionsTitle', 'Repository Permissions')}
              items={['Contents: Read', 'Issues: Read & Write', 'Pull requests: Read']}
              isDark={isDark} color={cfg.accentColor}
            />
            <PermissionItem
              title={t('argus.settings.githubWizard.eventsTitle', 'Subscribe to Events')}
              items={['Push', 'Pull Request', 'Release', 'Issues']}
              isDark={isDark} color={cfg.accentColor}
            />
          </Box>
        );
      case 3:
        return (
          <Box>
            <Typography sx={{ fontSize: '0.88rem', lineHeight: 1.7, color: 'text.secondary', mb: 3 }}>
              {t('argus.settings.githubWizard.step4Desc')}
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <WizardInput label={t('argus.settings.githubWizard.appId')} value={ghForm.appId}
                onChange={v => setGhForm(p => ({ ...p, appId: v }))} isDark={isDark} required />
              <WizardInput label={t('argus.settings.githubWizard.clientId')} value={ghForm.clientId}
                onChange={v => setGhForm(p => ({ ...p, clientId: v }))} isDark={isDark} required />
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <WizardInput label={t('argus.settings.githubWizard.clientSecret')} value={ghForm.clientSecret}
                onChange={v => setGhForm(p => ({ ...p, clientSecret: v }))} isDark={isDark} type="password" required />
              <WizardInput label={t('argus.settings.githubWizard.webhookSecret')} value={ghForm.webhookSecret}
                onChange={v => setGhForm(p => ({ ...p, webhookSecret: v }))} isDark={isDark} type="password" />
            </Box>
            <WizardInput label={t('argus.settings.githubWizard.privateKey')} value={ghForm.privateKey}
              onChange={v => setGhForm(p => ({ ...p, privateKey: v }))} isDark={isDark}
              multiline rows={5} required
              hint={t('argus.settings.githubWizard.privateKeyHint', 'Paste the full contents of the .pem file')}
              placeholder="-----BEGIN RSA PRIVATE KEY-----" />
              
            {/* Connection Test Section */}
            <Box sx={{
              mt: 3, p: 2, borderRadius: '10px',
              backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'}`,
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: ghTestResult ? 2 : 0 }}>
                <Box>
                  <Typography sx={{ fontWeight: 600, fontSize: '0.88rem' }}>
                    {t('argus.settings.providerWizard.testTitle', '연결 테스트')}
                  </Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                    {t('argus.settings.providerWizard.testDesc', '저장 전에 연결 상태를 확인합니다 (선택사항)')}
                  </Typography>
                </Box>
                <Button
                  onClick={async () => {
                    if (!ghForm.appId || !ghForm.privateKey) return;
                    setGhTesting(true);
                    setGhTestResult(null);
                    try {
                      const result = await argusService.testGithubConnection(ghForm.appId, ghForm.privateKey);
                      setGhTestResult(result);
                    } catch {
                      setGhTestResult({ ok: false, error: 'Network error' });
                    } finally {
                      setGhTesting(false);
                    }
                  }}
                  disabled={ghTesting || !ghForm.appId || !ghForm.privateKey}
                  variant="outlined" size="small"
                  startIcon={ghTesting ? <CircularProgress size={16} /> : <PlayArrowIcon />}
                  sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600 }}
                >
                  {t('argus.settings.providerWizard.testBtn', '연결 테스트')}
                </Button>
              </Box>
              {ghTestResult && (
                <Alert
                  severity={ghTestResult.ok ? 'success' : 'error'}
                  sx={{ borderRadius: '8px', fontSize: '0.82rem' }}
                  icon={ghTestResult.ok ? <CheckIcon sx={{ fontSize: 18 }} /> : undefined}
                >
                  {ghTestResult.ok ? `연결 성공! (${ghTestResult.name})` : `연결 실패: ${ghTestResult.error}`}
                </Alert>
              )}
            </Box>
          </Box>
        );
      default: return null;
    }
  };

  const renderGitlabStep = (step: number) => {
    const instanceUrl = glForm.instanceUrl || 'https://gitlab.com';
    switch (step) {
      case 0:
        return (
          <Box>
            <Typography sx={{ fontSize: '0.88rem', lineHeight: 1.7, color: 'text.secondary', mb: 2 }}>
              {t('argus.settings.gitlabWizard.step1Instruction', 'Click below to open your GitLab instance settings. Register a new OAuth Application.')}
            </Typography>
            <WizardInput
              label={t('argus.settings.gitlabWizard.instanceUrl', 'GitLab Instance URL')}
              value={glForm.instanceUrl}
              onChange={v => setGlForm(p => ({ ...p, instanceUrl: v }))}
              isDark={isDark} required
              hint={t('argus.settings.gitlabWizard.instanceUrlHint', 'e.g. https://gitlab.com or https://gitlab.mycompany.com')}
              placeholder="https://gitlab.com"
            />
            <Box sx={{
              p: 3, borderRadius: '12px', textAlign: 'center', mt: 1,
              border: `2px dashed ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
              backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
            }}>
              <GitLabIcon sx={{ fontSize: 48, color: '#fc6d26', mb: 2, opacity: 0.6 }} />
              <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary', mb: 2.5 }}>
                {t('argus.settings.gitlabWizard.step1Desc')}
              </Typography>
              <Button
                variant="contained" size="large" endIcon={<OpenInNewIcon />}
                href={`${instanceUrl}/-/profile/applications`}
                target="_blank" rel="noopener noreferrer"
                sx={{
                  borderRadius: '10px', textTransform: 'none', fontWeight: 700, px: 4, py: 1.2,
                  backgroundColor: '#58a6ff', color: '#fff',
                  '&:hover': { backgroundColor: '#4090e0' },
                }}
              >
                {t('argus.settings.gitlabWizard.goToGitlab', 'Open GitLab Applications')}
              </Button>
            </Box>
          </Box>
        );
      case 1:
        return (
          <Box>
            <Typography sx={{ fontSize: '0.88rem', lineHeight: 1.7, color: 'text.secondary', mb: 3 }}>
              {t('argus.settings.gitlabWizard.step2Desc')}
            </Typography>
            <CopyableUrl label={t('argus.settings.gitlabWizard.redirectUri', 'Redirect URI')} value={`${baseUrl}/api/argus/integrations/gitlab/callback`} isDark={isDark} />
            <CopyableUrl label={t('argus.settings.gitlabWizard.webhookUrl', 'Webhook URL')} value={`${baseUrl}/api/argus/webhooks/gitlab`} isDark={isDark} />
          </Box>
        );
      case 2:
        return (
          <Box>
            <Typography sx={{ fontSize: '0.88rem', lineHeight: 1.7, color: 'text.secondary', mb: 3 }}>
              {t('argus.settings.gitlabWizard.step3Desc')}
            </Typography>
            <PermissionItem
              title={t('argus.settings.gitlabWizard.scopesTitle', 'Required Scopes')}
              items={['api', 'read_user', 'read_repository']}
              isDark={isDark} color={cfg.accentColor}
            />
            <Box sx={{ mt: 2, p: 2, borderRadius: '8px', backgroundColor: alpha('#fc6d26', 0.06), border: `1px solid ${alpha('#fc6d26', 0.15)}` }}>
              <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', lineHeight: 1.6 }}>
                💡 <strong>Confidential</strong> 옵션을 체크하고, <strong>Expire access tokens</strong>는 체크 해제하세요.
              </Typography>
            </Box>
          </Box>
        );
      case 3:
        return (
          <Box>
            <Typography sx={{ fontSize: '0.88rem', lineHeight: 1.7, color: 'text.secondary', mb: 3 }}>
              {t('argus.settings.gitlabWizard.step4Desc')}
            </Typography>
            <WizardInput label={t('argus.settings.gitlabWizard.applicationId', 'Application ID')} value={glForm.applicationId}
              onChange={v => setGlForm(p => ({ ...p, applicationId: v }))} isDark={isDark} required />
            <WizardInput label={t('argus.settings.gitlabWizard.applicationSecret', 'Application Secret')} value={glForm.applicationSecret}
              onChange={v => setGlForm(p => ({ ...p, applicationSecret: v }))} isDark={isDark} type="password" required />
            <WizardInput label={t('argus.settings.gitlabWizard.webhookSecret', 'Webhook Secret')} value={glForm.webhookSecret}
              onChange={v => setGlForm(p => ({ ...p, webhookSecret: v }))} isDark={isDark} type="password"
              hint="선택 사항이지만 보안을 위해 권장됩니다" />

            {/* Connection Test Section */}
            <Box sx={{
              mt: 3, p: 2, borderRadius: '10px',
              backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'}`,
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: glTestResult ? 2 : 0 }}>
                <Box>
                  <Typography sx={{ fontWeight: 600, fontSize: '0.88rem' }}>
                    {t('argus.settings.providerWizard.testTitle', '연결 테스트')}
                  </Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                    {t('argus.settings.providerWizard.testDesc', '저장 전에 연결 상태를 확인합니다 (선택사항)')}
                  </Typography>
                </Box>
                <Button
                  onClick={async () => {
                    if (!glForm.applicationId || !glForm.applicationSecret) return;
                    setGlTesting(true);
                    setGlTestResult(null);
                    try {
                      const result = await argusService.testGitlabConnection(glForm.instanceUrl || 'https://gitlab.com', glForm.applicationId, glForm.applicationSecret);
                      setGlTestResult(result);
                    } catch {
                      setGlTestResult({ ok: false, error: 'Network error' });
                    } finally {
                      setGlTesting(false);
                    }
                  }}
                  disabled={glTesting || !glForm.applicationId || !glForm.applicationSecret}
                  variant="outlined" size="small"
                  startIcon={glTesting ? <CircularProgress size={16} /> : <PlayArrowIcon />}
                  sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600 }}
                >
                  {t('argus.settings.providerWizard.testBtn', '연결 테스트')}
                </Button>
              </Box>
              {glTestResult && (
                <Alert
                  severity={glTestResult.ok ? 'success' : 'error'}
                  sx={{ borderRadius: '8px', fontSize: '0.82rem' }}
                  icon={glTestResult.ok ? <CheckIcon sx={{ fontSize: 18 }} /> : undefined}
                >
                  {glTestResult.ok ? `연결 성공! (${glTestResult.message})` : `연결 실패: ${glTestResult.error}`}
                </Alert>
              )}
            </Box>
          </Box>
        );
      default: return null;
    }
  };

  const renderBitbucketStep = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Box>
            <Typography sx={{ fontSize: '0.88rem', lineHeight: 1.7, color: 'text.secondary', mb: 2 }}>
              {t('argus.settings.bitbucketWizard.step1Instruction', 'Bitbucket의 App Passwords 페이지에서 새 앱 비밀번호를 생성합니다.')}
            </Typography>
            <Box sx={{
              p: 3, borderRadius: '12px', textAlign: 'center',
              border: `2px dashed ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
              backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
            }}>
              <BitbucketIcon sx={{ fontSize: 48, color: '#0052CC', mb: 2, opacity: 0.6 }} />
              <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary', mb: 2 }}>
                {t('argus.settings.bitbucketWizard.step1Desc', 'Personal Settings > App passwords로 이동하여 새 비밀번호를 생성하세요.')}
              </Typography>
              <Button
                variant="contained" size="large" endIcon={<OpenInNewIcon />}
                href="https://bitbucket.org/account/settings/app-passwords/"
                target="_blank" rel="noopener noreferrer"
                sx={{
                  borderRadius: '10px', textTransform: 'none', fontWeight: 700, px: 4, py: 1.2,
                  backgroundColor: '#58a6ff', color: '#fff',
                  '&:hover': { backgroundColor: '#4090e0' },
                }}
              >
                {t('argus.settings.bitbucketWizard.goToBitbucket', 'Bitbucket App Passwords 열기')}
              </Button>
            </Box>
            <Box sx={{ mt: 2.5 }}>
              <PermissionItem
                title={t('argus.settings.bitbucketWizard.permissionsTitle', 'Required Permissions')}
                items={['Repositories: Read', 'Pull requests: Read', 'Issues: Read']}
                isDark={isDark} color={cfg.accentColor}
              />
            </Box>
          </Box>
        );
      case 1:
        return (
          <Box>
            <Typography sx={{ fontSize: '0.88rem', lineHeight: 1.7, color: 'text.secondary', mb: 3 }}>
              {t('argus.settings.bitbucketWizard.step2Desc', 'Bitbucket 워크스페이스, 사용자 이름, 그리고 생성한 App Password를 입력합니다.')}
            </Typography>
            <WizardInput label={t('argus.settings.bitbucketWizard.workspace', 'Workspace')} value={bbForm.workspace}
              onChange={v => setBbForm(p => ({ ...p, workspace: v }))} isDark={isDark} required
              placeholder="" hint={t('argus.settings.bitbucketWizard.workspaceHint', 'Bitbucket URL의 워크스페이스 슬러그 (예: bitbucket.org/my-workspace)')} />
            <WizardInput label={t('argus.settings.bitbucketWizard.username', 'Username')} value={bbForm.username}
              onChange={v => setBbForm(p => ({ ...p, username: v }))} isDark={isDark} required
              placeholder="" />
            <WizardInput label={t('argus.settings.bitbucketWizard.appPassword', 'App Password')} value={bbForm.appPassword}
              onChange={v => setBbForm(p => ({ ...p, appPassword: v }))} isDark={isDark} type="password" required
              hint={t('argus.settings.bitbucketWizard.appPasswordHint', '방금 생성한 App Password를 붙여넣으세요')} />

            {/* Connection Test Section */}
            <Box sx={{
              mt: 3, p: 2, borderRadius: '10px',
              backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'}`,
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: bbTestResult ? 2 : 0 }}>
                <Box>
                  <Typography sx={{ fontWeight: 600, fontSize: '0.88rem' }}>
                    {t('argus.settings.providerWizard.testTitle', '연결 테스트')}
                  </Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                    {t('argus.settings.providerWizard.testDesc', '저장 전에 연결 상태를 확인합니다 (선택사항)')}
                  </Typography>
                </Box>
                <Button
                  onClick={async () => {
                    if (!bbForm.username || !bbForm.appPassword) return;
                    setBbTesting(true);
                    setBbTestResult(null);
                    try {
                      const result = await argusService.testBitbucketConnection(bbForm.username, bbForm.appPassword);
                      setBbTestResult(result);
                    } catch {
                      setBbTestResult({ ok: false, error: 'Network error' });
                    } finally {
                      setBbTesting(false);
                    }
                  }}
                  disabled={bbTesting || !bbForm.username || !bbForm.appPassword}
                  variant="outlined" size="small"
                  startIcon={bbTesting ? <CircularProgress size={16} /> : <PlayArrowIcon />}
                  sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600 }}
                >
                  {t('argus.settings.providerWizard.testBtn', '연결 테스트')}
                </Button>
              </Box>
              {bbTestResult && (
                <Alert
                  severity={bbTestResult.ok ? 'success' : 'error'}
                  sx={{ borderRadius: '8px', fontSize: '0.82rem' }}
                  icon={bbTestResult.ok ? <CheckIcon sx={{ fontSize: 18 }} /> : undefined}
                >
                  {bbTestResult.ok ? `연결 성공! (${bbTestResult.display_name})` : `연결 실패: ${bbTestResult.error}`}
                </Alert>
              )}
            </Box>
          </Box>
        );
      default: return null;
    }
  };

  const handleSlackTest = async () => {
    if (!slackForm.botToken) return;
    setSlackTesting(true);
    setSlackTestResult(null);
    try {
      const result = await argusService.testSlackConnection(slackForm.botToken);
      setSlackTestResult(result);
    } catch {
      setSlackTestResult({ ok: false, error: 'Network error' });
    } finally {
      setSlackTesting(false);
    }
  };

  const renderSlackStep = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Box>
            <Typography sx={{ fontSize: '0.88rem', lineHeight: 1.7, color: 'text.secondary', mb: 2 }}>
              {t('argus.settings.slackWizard.step1Instruction', 'Go to Slack API Dashboard to create a new Slack App for your workspace.')}
            </Typography>
            <Box sx={{
              p: 3, borderRadius: '12px', textAlign: 'center',
              border: `2px dashed ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
              backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
            }}>
              <SlackIcon sx={{ fontSize: 48, color: '#36C5F0', mb: 2, opacity: 0.7 }} />
              <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary', mb: 2.5 }}>
                {t('argus.settings.slackWizard.step1Desc', 'Create a new Slack App from the "From scratch" option.')}
              </Typography>
              <Button
                variant="contained" size="large" endIcon={<OpenInNewIcon />}
                href="https://api.slack.com/apps" target="_blank" rel="noopener noreferrer"
                sx={{
                  borderRadius: '10px', textTransform: 'none', fontWeight: 700, px: 4, py: 1.2,
                  backgroundColor: '#58a6ff', color: '#fff',
                  '&:hover': { backgroundColor: '#4090e0' },
                }}
              >
                {t('argus.settings.slackWizard.goToSlack', 'Open Slack API Dashboard')}
              </Button>
            </Box>
          </Box>
        );
      case 1:
        return (
          <Box>
            <Typography sx={{ fontSize: '0.88rem', lineHeight: 1.7, color: 'text.secondary', mb: 3 }}>
              {t('argus.settings.slackWizard.step2Desc', 'Navigate to OAuth & Permissions and add the following Bot Token Scopes:')}
            </Typography>
            <PermissionItem
              title={t('argus.settings.slackWizard.botScopes', 'Bot Token Scopes')}
              items={['chat:write', 'channels:read', 'groups:read', 'chat:write.customize']}
              isDark={isDark} color={cfg.accentColor}
            />
            <Box sx={{ mt: 2, p: 2, borderRadius: '8px', backgroundColor: alpha(cfg.accentColor, 0.06), border: `1px solid ${alpha(cfg.accentColor, 0.15)}` }}>
              <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', lineHeight: 1.6 }}>
                💡 {t('argus.settings.slackWizard.step2Hint', 'After adding scopes, click "Install to Workspace" and authorize. Then copy the Bot User OAuth Token (starts with xoxb-).')}
              </Typography>
            </Box>
          </Box>
        );
      case 2:
        return (
          <Box>
            <Typography sx={{ fontSize: '0.88rem', lineHeight: 1.7, color: 'text.secondary', mb: 3 }}>
              {t('argus.settings.slackWizard.step3Desc', 'Paste the Bot User OAuth Token and optionally the Signing Secret.')}
            </Typography>
            <WizardInput
              label={t('argus.settings.slackWizard.botToken', 'Bot User OAuth Token')}
              value={slackForm.botToken}
              onChange={v => setSlackForm(p => ({ ...p, botToken: v }))}
              isDark={isDark} type="password" required
              placeholder="xoxb-..."
              hint={t('argus.settings.slackWizard.botTokenHint', 'Found in OAuth & Permissions after installing the app to your workspace')}
            />
            <WizardInput
              label={t('argus.settings.slackWizard.signingSecret', 'Signing Secret')}
              value={slackForm.signingSecret}
              onChange={v => setSlackForm(p => ({ ...p, signingSecret: v }))}
              isDark={isDark} type="password"
              hint={t('argus.settings.slackWizard.signingSecretHint', 'Optional. Found in Basic Information > App Credentials')}
            />
            <Button
              variant="contained" size="small"
              disabled={!slackForm.botToken || slackTesting}
              onClick={handleSlackTest}
              startIcon={slackTesting ? <CircularProgress size={14} color="inherit" /> : undefined}
              sx={{
                textTransform: 'none', fontWeight: 600, borderRadius: '8px',
                backgroundColor: '#58a6ff', color: '#fff',
                '&:hover': { backgroundColor: '#4090e0' },
              }}
            >
              {t('argus.settings.slackWizard.testConnection', 'Test Connection')}
            </Button>
            {slackTestResult && (
              <Alert
                severity={slackTestResult.ok ? 'success' : 'error'}
                sx={{ mt: 2, borderRadius: '8px' }}
              >
                {slackTestResult.ok
                  ? t('argus.settings.slackWizard.testSuccess', 'Connected to {{team}}').replace('{{team}}', slackTestResult.team || 'Slack')
                  : `${t('argus.settings.slackWizard.testFailed', 'Connection failed')}: ${slackTestResult.error}`
                }
              </Alert>
            )}
          </Box>
        );
      default: return null;
    }
  };

  return (
    <Dialog
      open={open} onClose={onClose} maxWidth="md" fullWidth
      PaperProps={{
        sx: {
          borderRadius: '16px', overflow: 'hidden',
          minHeight: 520, maxHeight: '85vh',
          display: 'flex', flexDirection: 'row',
        },
      }}
    >
      {/* ═══ LEFT SIDEBAR — Always Dark (Stripe/Vercel pattern) ═══ */}
      <Box sx={{
        width: 260, minWidth: 260, flexShrink: 0,
        background: cfg.gradient,
        color: '#fff',
        display: 'flex', flexDirection: 'column',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Decorative elements */}
        <Box sx={{ position: 'absolute', top: -50, right: -50, width: 160, height: 160, borderRadius: '50%', background: `radial-gradient(circle, ${alpha(cfg.accentColor, 0.12)} 0%, transparent 70%)` }} />
        <Box sx={{ position: 'absolute', bottom: -70, left: -40, width: 180, height: 180, borderRadius: '50%', background: `radial-gradient(circle, ${alpha(cfg.accentColor, 0.08)} 0%, transparent 70%)` }} />

        {/* Provider Header */}
        <Box sx={{ p: 3, pb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
            <Box sx={{
              width: 36, height: 36, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: 'rgba(255,255,255,0.12)',
              '& .MuiSvgIcon-root': { fontSize: 22, color: '#fff' },
            }}>
              {cfg.icon}
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 800, fontSize: '1rem', letterSpacing: '-0.02em' }}>
                {t(cfg.titleKey, cfg.name)}
              </Typography>
            </Box>
          </Box>
          <Typography sx={{ fontSize: '0.72rem', opacity: 0.55, lineHeight: 1.5, mt: 1 }}>
            {t(cfg.subtitleKey)}
          </Typography>
        </Box>

        {/* Vertical Steps */}
        <Box sx={{ flex: 1, px: 3, py: 1 }}>
          {cfg.steps.map((step, idx) => {
            const isActive = idx === activeStep;
            const isCompleted = idx < activeStep;
            return (
              <Box key={idx} sx={{ display: 'flex', gap: 1.5, position: 'relative' }}>
                {/* Vertical connector line */}
                {idx < totalSteps - 1 && (
                  <Box sx={{
                    position: 'absolute', left: 15, top: 32, width: 2, height: 'calc(100% - 16px)',
                    zIndex: 0,
                    backgroundColor: isCompleted ? alpha(cfg.accentColor, 0.5) : 'rgba(255,255,255,0.08)',
                    transition: 'background-color 0.3s',
                  }} />
                )}
                {/* Step circle */}
                <Box sx={{
                  width: 32, height: 32, minWidth: 32, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.75rem', fontWeight: 700, zIndex: 1,
                  transition: 'all 0.3s ease',
                  ...(isCompleted ? {
                    backgroundColor: cfg.accentColor, color: '#fff',
                  } : isActive ? {
                    backgroundColor: '#1e3a5f',
                    border: `2px solid ${cfg.accentColor}`,
                    color: '#fff',
                    boxShadow: `0 0 0 4px ${alpha(cfg.accentColor, 0.15)}`,
                  } : {
                    backgroundColor: '#1a2030',
                    border: '2px solid #2a3444',
                    color: 'rgba(255,255,255,0.3)',
                  }),
                }}>
                  {isCompleted ? <CheckIcon sx={{ fontSize: 16 }} /> : idx + 1}
                </Box>
                {/* Step text */}
                <Box sx={{ py: 0.5, pb: 3 }}>
                  <Typography sx={{
                    fontSize: '0.78rem', fontWeight: isActive ? 700 : 500,
                    color: isActive ? '#fff' : 'rgba(255,255,255,0.4)',
                    transition: 'all 0.3s', lineHeight: 1.3,
                  }}>
                    {t(step.titleKey)}
                  </Typography>
                  <Typography sx={{
                    fontSize: '0.65rem', mt: 0.3,
                    color: isActive ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)',
                    transition: 'all 0.3s',
                  }}>
                    {t(step.subtitleKey)}
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Box>

        {/* Bottom progress */}
        <Box sx={{ px: 3, pb: 3 }}>
          <Box sx={{ display: 'flex', gap: 0.5, mb: 1 }}>
            {cfg.steps.map((_, idx) => (
              <Box key={idx} sx={{
                flex: 1, height: 3, borderRadius: 2,
                backgroundColor: idx <= activeStep ? cfg.accentColor : 'rgba(255,255,255,0.08)',
                transition: 'background-color 0.3s',
              }} />
            ))}
          </Box>
          <Typography sx={{ fontSize: '0.65rem', opacity: 0.4, textAlign: 'center' }}>
            {activeStep + 1} / {totalSteps}
          </Typography>
        </Box>
      </Box>

      {/* ═══ RIGHT CONTENT ═══ */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Close button */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 1.5, pb: 0 }}>
          <IconButton size="small" onClick={onClose} sx={{ opacity: 0.4, '&:hover': { opacity: 1 } }}>
            <CloseIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Box>

        {/* Step Content */}
        <Box sx={{ flex: 1, px: 4, pb: 2, overflow: 'auto' }}>
          <Fade in key={activeStep} timeout={300}>
            <Box>
              {/* Step Header */}
              <Box sx={{ mb: 3 }}>
                <Typography sx={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                  {t(cfg.steps[activeStep].titleKey)}
                </Typography>
              </Box>

              {/* Step Body */}
              {provider === 'github' ? renderGithubStep(activeStep) : provider === 'gitlab' ? renderGitlabStep(activeStep) : provider === 'slack' ? renderSlackStep(activeStep) : renderBitbucketStep(activeStep)}
              {error && <Alert severity="error" sx={{ mt: 2, borderRadius: '10px' }}>{error}</Alert>}
            </Box>
          </Fade>
        </Box>

        {/* Footer Actions */}
        <Box sx={{
          px: 4, py: 2.5,
          borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1.5,
        }}>
          {activeStep > 0 && (
            <Button
              onClick={() => setActiveStep(s => s - 1)}
              disabled={loading}
              startIcon={<ArrowBackIcon />}
              sx={{
                textTransform: 'none', fontWeight: 600, color: 'text.secondary',
                borderRadius: '10px', px: 2.5, py: 0.8,
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' },
              }}
            >
              {t('common.back', '이전')}
            </Button>
          )}
          {activeStep === totalSteps - 1 ? (
            <Button
              onClick={handleSave} variant="contained" disabled={loading || !canProceed()}
              startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <LockIcon sx={{ fontSize: 18 }} />}
              sx={{
                textTransform: 'none', fontWeight: 700, borderRadius: '10px', px: 4, py: 1,
                backgroundColor: cfg.accentColor,
                '&:hover': { backgroundColor: alpha(cfg.accentColor, 0.85) },
                '&.Mui-disabled': { backgroundColor: alpha(cfg.accentColor, 0.3) },
              }}
            >
              {t(cfg.saveKey, '연동 완료')}
            </Button>
          ) : (
            <Button
              onClick={() => setActiveStep(s => s + 1)} variant="contained"
              endIcon={<ArrowForwardIcon />}
              sx={{
                textTransform: 'none', fontWeight: 700, borderRadius: '10px', px: 4, py: 1,
                backgroundColor: cfg.accentColor,
                '&:hover': { backgroundColor: alpha(cfg.accentColor, 0.85) },
              }}
            >
              {t('common.next', '다음')}
            </Button>
          )}
        </Box>
      </Box>
    </Dialog>
  );
};
