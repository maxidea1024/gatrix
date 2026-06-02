import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash';
import { vscDarkPlus, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';

SyntaxHighlighter.registerLanguage('javascript', javascript);
SyntaxHighlighter.registerLanguage('bash', bash);

import {
  Box, Typography, Paper, TextField, Button, Slider, Chip, IconButton,
  Divider, useTheme, InputAdornment, alpha, Tooltip, Select, MenuItem,
  FormControl, InputLabel, CircularProgress, Dialog, DialogTitle,
  DialogContent, DialogActions, Avatar, Collapse,
} from '@mui/material';
import {
  Settings as SettingsIcon, Add as AddIcon,
  Delete as DeleteIcon, Save as SaveIcon, VpnKey as KeyIcon,
  Tune as TuneIcon, Code as CodeIcon, CheckCircle as CheckIcon,
  Cancel as CancelIcon, UploadFile as UploadIcon, GitHub as GitHubIcon,
  Security as SecurityIcon, BugReport as BugIcon,
  PlayArrow as TestConnectionIcon, ArrowBack as ArrowBackIcon,
  Close as CloseIcon, Storage as StorageIcon, Cloud as CloudIcon,
  Notifications as NotificationsIcon, Email as EmailIcon,
  Webhook as WebhookIcon, Chat as ChatIcon, Edit as EditIcon,
  Visibility as VisibilityIcon, VisibilityOff as VisibilityOffIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import PageContentLoader from '@/components/common/PageContentLoader';
import PageHeader from '@/components/common/PageHeader';
import { CopyButton } from '@/components/common/CopyButton';
import ChipSelect from '@/components/common/ChipSelect';
import argusService, {
  ArgusProject, ArgusSourcemapRelease,
  ArgusIntegration, ArgusOwnershipRule, ArgusIssueTracker,
} from '@/services/argusService';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { GlobalIntegrationWizardModal } from './components/GlobalIntegrationWizardModal';
import { ProviderWizardModal, WizardProviderConfig, WizardFieldDef } from './components/ProviderWizardModal';

// ═══════════════════════════════════════════════════════════════════════
// Platform Options — Sentry 호환 플랫폼 목록
// ═══════════════════════════════════════════════════════════════════════
const PLATFORM_OPTIONS = [
  { id: 'javascript', label: 'JavaScript', category: 'Browser' },
  { id: 'javascript-react', label: 'React', category: 'Browser' },
  { id: 'javascript-vue', label: 'Vue', category: 'Browser' },
  { id: 'javascript-angular', label: 'Angular', category: 'Browser' },
  { id: 'javascript-svelte', label: 'Svelte', category: 'Browser' },
  { id: 'javascript-nextjs', label: 'Next.js', category: 'Browser' },
  { id: 'javascript-remix', label: 'Remix', category: 'Browser' },
  { id: 'node', label: 'Node.js', category: 'Server' },
  { id: 'node-express', label: 'Express', category: 'Server' },
  { id: 'node-koa', label: 'Koa', category: 'Server' },
  { id: 'node-nestjs', label: 'NestJS', category: 'Server' },
  { id: 'python', label: 'Python', category: 'Server' },
  { id: 'python-django', label: 'Django', category: 'Server' },
  { id: 'python-flask', label: 'Flask', category: 'Server' },
  { id: 'python-fastapi', label: 'FastAPI', category: 'Server' },
  { id: 'go', label: 'Go', category: 'Server' },
  { id: 'java', label: 'Java', category: 'Server' },
  { id: 'java-spring-boot', label: 'Spring Boot', category: 'Server' },
  { id: 'dotnet', label: '.NET', category: 'Server' },
  { id: 'dotnet-aspnetcore', label: 'ASP.NET Core', category: 'Server' },
  { id: 'ruby', label: 'Ruby', category: 'Server' },
  { id: 'ruby-rails', label: 'Rails', category: 'Server' },
  { id: 'php', label: 'PHP', category: 'Server' },
  { id: 'php-laravel', label: 'Laravel', category: 'Server' },
  { id: 'rust', label: 'Rust', category: 'Server' },
  { id: 'elixir', label: 'Elixir', category: 'Server' },
  { id: 'apple-ios', label: 'iOS (Swift)', category: 'Mobile' },
  { id: 'android', label: 'Android (Kotlin)', category: 'Mobile' },
  { id: 'react-native', label: 'React Native', category: 'Mobile' },
  { id: 'flutter', label: 'Flutter', category: 'Mobile' },
  { id: 'unity', label: 'Unity', category: 'Desktop/Game' },
  { id: 'unreal', label: 'Unreal Engine', category: 'Desktop/Game' },
  { id: 'electron', label: 'Electron', category: 'Desktop/Game' },
] as const;

const PLATFORM_CATEGORIES = [...new Set(PLATFORM_OPTIONS.map(p => p.category))];

// ═══════════════════════════════════════════════════════════════════════
// Provider Registry — 확장 가능한 프로바이더 정의
// 새 프로바이더 추가: 배열에 객체 하나만 추가하면 자동 반영
// ═══════════════════════════════════════════════════════════════════════

interface ProviderFieldDef {
  key: string;
  labelKey: string;
  labelFallback: string;
  placeholder: string;
  type?: string;
  options?: { value: string; label: string }[];
  width?: number;
}

interface RepoProviderDef {
  id: string;
  name: string;
  descKey: string;
  icon: React.ReactNode;
  color: string;
  fields: ProviderFieldDef[];
}

interface TrackerProviderDef {
  id: string;
  name: string;
  descKey: string;
  color: string;
  icon: React.ReactNode;
  baseFields: ProviderFieldDef[];
  configFields: ProviderFieldDef[];
}

const REPO_PROVIDERS: RepoProviderDef[] = [
  {
    id: 'github', name: 'GitHub', color: '#8b949e',
    descKey: 'argus.settings.githubDesc',
    icon: <GitHubIcon />,
    fields: [
      { key: 'repo_url', labelKey: 'argus.settings.repoUrl', labelFallback: 'Repository URL', placeholder: 'https://github.com/org/repo' },
      { key: 'default_branch', labelKey: 'argus.settings.defaultBranch', labelFallback: 'Default Branch', placeholder: 'main' },
      { key: 'access_token', labelKey: 'argus.settings.trackerApiToken', labelFallback: 'Access Token (Optional)', placeholder: '••••••••', type: 'password' },
    ],
  },
  {
    id: 'gitlab', name: 'GitLab', color: '#fc6d26',
    descKey: 'argus.settings.gitlabDesc',
    icon: <CloudIcon />,
    fields: [
      { key: 'repo_url', labelKey: 'argus.settings.repoUrl', labelFallback: 'Repository URL', placeholder: 'https://gitlab.com/org/repo' },
      { key: 'default_branch', labelKey: 'argus.settings.defaultBranch', labelFallback: 'Default Branch', placeholder: 'main' },
      { key: 'access_token', labelKey: 'argus.settings.trackerApiToken', labelFallback: 'Access Token (Optional)', placeholder: '••••••••', type: 'password' },
    ],
  },
  {
    id: 'bitbucket', name: 'Bitbucket', color: '#0052CC',
    descKey: 'argus.settings.bitbucketDesc',
    icon: <StorageIcon />,
    fields: [
      { key: 'repo_url', labelKey: 'argus.settings.repoUrl', labelFallback: 'Repository URL', placeholder: 'https://bitbucket.org/org/repo' },
      { key: 'default_branch', labelKey: 'argus.settings.defaultBranch', labelFallback: 'Default Branch', placeholder: 'main' },
      { key: 'access_token', labelKey: 'argus.settings.trackerApiToken', labelFallback: 'Access Token (Optional)', placeholder: '••••••••', type: 'password' },
    ],
  },
];

const TRACKER_PROVIDERS: (TrackerProviderDef & { gradient: string; accentColor: string })[] = [
  {
    id: 'jira', name: 'Jira', color: '#0052CC',
    gradient: 'linear-gradient(160deg, #003087 0%, #0052CC 40%, #2684FF 100%)',
    accentColor: '#2684FF',
    descKey: 'argus.settings.jiraDesc',
    icon: <BugIcon />,
    baseFields: [
      { key: 'name', labelKey: 'argus.settings.trackerName', labelFallback: 'Display Name', placeholder: 'My Jira' },
      { key: 'api_url', labelKey: 'argus.settings.trackerApiUrl', labelFallback: 'Jira URL', placeholder: 'https://myorg.atlassian.net' },
      { key: 'api_token', labelKey: 'argus.settings.trackerApiToken', labelFallback: 'API Token', placeholder: '', type: 'password' },
    ],
    configFields: [
      { key: 'project_key', labelKey: 'argus.settings.jiraProjectKey', labelFallback: 'Project Key', placeholder: 'PROJ' },
      { key: 'email', labelKey: 'argus.settings.jiraEmail', labelFallback: 'Email', placeholder: 'user@company.com' },
      { key: 'issue_type', labelKey: 'argus.settings.jiraIssueType', labelFallback: 'Issue Type', placeholder: 'Bug' },
    ],
  },
  {
    id: 'github', name: 'GitHub Issues', color: '#8b949e',
    gradient: 'linear-gradient(160deg, #0d1117 0%, #161b22 40%, #1a2332 100%)',
    accentColor: '#58a6ff',
    descKey: 'argus.settings.githubIssuesDesc',
    icon: <GitHubIcon />,
    baseFields: [
      { key: 'name', labelKey: 'argus.settings.trackerName', labelFallback: 'Display Name', placeholder: 'GitHub Issues' },
      { key: 'api_url', labelKey: 'argus.settings.trackerApiUrl', labelFallback: 'API URL', placeholder: 'https://api.github.com' },
      { key: 'api_token', labelKey: 'argus.settings.trackerApiToken', labelFallback: 'Personal Access Token', placeholder: '', type: 'password' },
    ],
    configFields: [
      { key: 'repo', labelKey: 'argus.settings.githubRepo', labelFallback: 'Repository', placeholder: 'owner/repo' },
    ],
  },
  {
    id: 'linear', name: 'Linear', color: '#5E6AD2',
    gradient: 'linear-gradient(160deg, #2E3192 0%, #4A4FC4 40%, #5E6AD2 100%)',
    accentColor: '#818CF8',
    descKey: 'argus.settings.linearDesc',
    icon: <BugIcon />,
    baseFields: [
      { key: 'name', labelKey: 'argus.settings.trackerName', labelFallback: 'Display Name', placeholder: 'Linear' },
      { key: 'api_url', labelKey: 'argus.settings.trackerApiUrl', labelFallback: 'API URL', placeholder: 'https://api.linear.app' },
      { key: 'api_token', labelKey: 'argus.settings.trackerApiToken', labelFallback: 'API Key', placeholder: '', type: 'password' },
    ],
    configFields: [
      { key: 'team_id', labelKey: 'argus.settings.linearTeamId', labelFallback: 'Team ID', placeholder: 'team-uuid' },
    ],
  },
];

// ─── Notification Providers ─────────────────────────────────────────

interface NotificationProviderDef {
  id: string;
  name: string;
  descKey: string;
  color: string;
  icon: React.ReactNode;
  fields: ProviderFieldDef[];
}

const NOTIFICATION_PROVIDERS: (NotificationProviderDef & { gradient: string; accentColor: string; guideUrl?: string; guideButtonKey?: string; guideDescKey?: string })[] = [
  {
    id: 'slack', name: 'Slack', color: '#4A154B',
    gradient: 'linear-gradient(160deg, #2C0E31 0%, #4A154B 40%, #611f69 100%)',
    accentColor: '#36C5F0',
    guideUrl: 'https://api.slack.com/messaging/webhooks',
    guideButtonKey: 'argus.settings.providerWizard.slackGuideBtn',
    guideDescKey: 'argus.settings.providerWizard.slackGuideDesc',
    descKey: 'argus.settings.slackDesc',
    icon: <ChatIcon />,
    fields: [
      { key: 'name', labelKey: 'argus.settings.channelName', labelFallback: 'Name', placeholder: '#error-alerts' },
      { key: 'webhook_url', labelKey: 'argus.settings.webhookUrl', labelFallback: 'Webhook URL', placeholder: 'https://hooks.slack.com/services/...' },
      { key: 'channel', labelKey: 'argus.settings.slackChannel', labelFallback: 'Channel', placeholder: '#general' },
    ],
  },
  {
    id: 'discord', name: 'Discord', color: '#5865F2',
    gradient: 'linear-gradient(160deg, #2C2F86 0%, #4752C4 40%, #5865F2 100%)',
    accentColor: '#7289DA',
    guideUrl: 'https://support.discord.com/hc/en-us/articles/228383668',
    guideButtonKey: 'argus.settings.providerWizard.discordGuideBtn',
    guideDescKey: 'argus.settings.providerWizard.discordGuideDesc',
    descKey: 'argus.settings.discordDesc',
    icon: <ChatIcon />,
    fields: [
      { key: 'name', labelKey: 'argus.settings.channelName', labelFallback: 'Name', placeholder: 'Error Alerts' },
      { key: 'webhook_url', labelKey: 'argus.settings.webhookUrl', labelFallback: 'Webhook URL', placeholder: 'https://discord.com/api/webhooks/...' },
    ],
  },
  {
    id: 'msteams', name: 'Microsoft Teams', color: '#6264A7',
    gradient: 'linear-gradient(160deg, #32335C 0%, #4B4D80 40%, #6264A7 100%)',
    accentColor: '#7B83EB',
    descKey: 'argus.settings.msteamsDesc',
    icon: <ChatIcon />,
    fields: [
      { key: 'name', labelKey: 'argus.settings.channelName', labelFallback: 'Name', placeholder: 'Argus Alerts' },
      { key: 'webhook_url', labelKey: 'argus.settings.webhookUrl', labelFallback: 'Webhook URL', placeholder: 'https://outlook.office.com/webhook/...' },
    ],
  },
  {
    id: 'webhook', name: 'Webhook', color: '#FF6B35',
    gradient: 'linear-gradient(160deg, #8B3A1D 0%, #CC5429 40%, #FF6B35 100%)',
    accentColor: '#FF9966',
    descKey: 'argus.settings.webhookDesc',
    icon: <WebhookIcon />,
    fields: [
      { key: 'name', labelKey: 'argus.settings.channelName', labelFallback: 'Name', placeholder: 'Custom Hook' },
      { key: 'webhook_url', labelKey: 'argus.settings.webhookUrl', labelFallback: 'URL', placeholder: 'https://api.example.com/hook' },
      { key: 'secret', labelKey: 'argus.settings.webhookSecret', labelFallback: 'Secret', placeholder: '', type: 'password' },
    ],
  },
  {
    id: 'email', name: 'Email', color: '#EA4335',
    gradient: 'linear-gradient(160deg, #8B2920 0%, #C4372C 40%, #EA4335 100%)',
    accentColor: '#FF6B6B',
    descKey: 'argus.settings.emailDesc',
    icon: <EmailIcon />,
    fields: [
      { key: 'name', labelKey: 'argus.settings.channelName', labelFallback: 'Name', placeholder: 'Dev Team Email' },
      { key: 'recipients', labelKey: 'argus.settings.emailRecipients', labelFallback: 'Recipients', placeholder: 'dev@company.com, ops@company.com' },
    ],
  },
  {
    id: 'pagerduty', name: 'PagerDuty', color: '#06AC38',
    gradient: 'linear-gradient(160deg, #045D1F 0%, #058F2E 40%, #06AC38 100%)',
    accentColor: '#4ADE80',
    descKey: 'argus.settings.pagerdutyDesc',
    icon: <NotificationsIcon />,
    fields: [
      { key: 'name', labelKey: 'argus.settings.channelName', labelFallback: 'Name', placeholder: 'On-Call Alerts' },
      { key: 'api_token', labelKey: 'argus.settings.trackerApiToken', labelFallback: 'Integration Key', placeholder: '', type: 'password' },
      { key: 'severity', labelKey: 'argus.settings.pdSeverity', labelFallback: 'Default Severity', placeholder: 'critical' },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════
// Section Navigation
// ═══════════════════════════════════════════════════════════════════════

type SectionId = 'general' | 'sampling' | 'dsn-keys' | 'sdk-setup' | 'source-maps' | 'integrations' | 'notifications' | 'issue-trackers' | 'ownership';

const NAV_GROUPS = [
  {
    labelKey: 'argus.settings.groupProject', items: [
      { id: 'general' as SectionId, labelKey: 'argus.settings.general', icon: <SettingsIcon sx={{ fontSize: 18 }} /> },
      { id: 'sampling' as SectionId, labelKey: 'argus.settings.samplingQuotas', icon: <TuneIcon sx={{ fontSize: 18 }} /> },
    ],
  },
  {
    labelKey: 'argus.settings.groupSdk', items: [
      { id: 'dsn-keys' as SectionId, labelKey: 'argus.settings.dsnKeys', icon: <KeyIcon sx={{ fontSize: 18 }} /> },
      { id: 'sdk-setup' as SectionId, labelKey: 'argus.settings.sdkSetup', icon: <CodeIcon sx={{ fontSize: 18 }} /> },
      { id: 'source-maps' as SectionId, labelKey: 'argus.settings.sourceMaps', icon: <UploadIcon sx={{ fontSize: 18 }} /> },
    ],
  },
  {
    labelKey: 'argus.settings.groupIntegrations', items: [
      { id: 'integrations' as SectionId, labelKey: 'argus.settings.integrations', icon: <GitHubIcon sx={{ fontSize: 18 }} /> },
      { id: 'notifications' as SectionId, labelKey: 'argus.settings.notifications', icon: <NotificationsIcon sx={{ fontSize: 18 }} /> },
      { id: 'issue-trackers' as SectionId, labelKey: 'argus.settings.issueTrackers', icon: <BugIcon sx={{ fontSize: 18 }} /> },
      { id: 'ownership' as SectionId, labelKey: 'argus.settings.ownership', icon: <SecurityIcon sx={{ fontSize: 18 }} /> },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════

const ArgusSettingsPage: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const isDark = theme.palette.mode === 'dark';
  const navigate = useNavigate();
  const location = useLocation();
  const { currentProject } = useOrgProject();
  const projectId = currentProject?.id || '1';

  // ── Section routing ──
  const currentSection = useMemo<SectionId>(() => {
    const hash = location.hash.replace('#', '') as SectionId;
    const allIds = NAV_GROUPS.flatMap(g => g.items.map(i => i.id));
    return allIds.includes(hash) ? hash : 'general';
  }, [location.hash]);

  const setSection = useCallback((id: SectionId) => {
    navigate({ hash: `#${id}` }, { replace: true });
    window.scrollTo({ top: 0 });
  }, [navigate]);

  // ── Shared styles ──
  const bdr = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const bdrSubtle = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)';
  const bgSubtle = isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)';
  const inpSx = {
    '& .MuiOutlinedInput-root': {
      borderRadius: '8px',
      fontSize: '0.875rem',
      height: '36px',
    },
    '& .MuiInputBase-input': {
      height: '36px',
      boxSizing: 'border-box',
      padding: '8px 14px',
    },
  };

  // ── State ──
  const [project, setProject] = useState<ArgusProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [platform, setPlatform] = useState('');
  const [errorQuota, setErrorQuota] = useState(100000);
  const [txnRate, setTxnRate] = useState(1.0);
  const [sessionRate, setSessionRate] = useState(1.0);
  const [retentionDays, setRetentionDays] = useState(90);
  const originalValues = React.useRef({ name: '', platform: '', errorQuota: 100000, txnRate: 1.0, sessionRate: 1.0, retentionDays: 90 });
  const isDirty = name !== originalValues.current.name || platform !== originalValues.current.platform
    || errorQuota !== originalValues.current.errorQuota || txnRate !== originalValues.current.txnRate
    || sessionRate !== originalValues.current.sessionRate || retentionDays !== originalValues.current.retentionDays;

  // Lazy section data
  const [sourcemaps, setSourcemaps] = useState<ArgusSourcemapRelease[]>([]);
  const [smLoaded, setSmLoaded] = useState(false);
  const [integrations, setIntegrations] = useState<ArgusIntegration[]>([]);
  const [intLoaded, setIntLoaded] = useState(false);
  const [trackers, setTrackers] = useState<ArgusIssueTracker[]>([]);
  const [trkLoaded, setTrkLoaded] = useState(false);
  const [rules, setRules] = useState<ArgusOwnershipRule[]>([]);
  const [ruleLoaded, setRuleLoaded] = useState(false);
  const [notifChannels, setNotifChannels] = useState<any[]>([]);
  const [notifLoaded, setNotifLoaded] = useState(false);

  // Dialog
  const [addIntDialog, setAddIntDialog] = useState<string | null>(null);
  const [addTrkDialog, setAddTrkDialog] = useState<string | null>(null);
  const [addNotifDialog, setAddNotifDialog] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [dynamicFields, setDynamicFields] = useState<ProviderFieldDef[]>([]);

  // Setup Wizard Modal
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardProvider, setWizardProvider] = useState<'github' | 'gitlab' | 'bitbucket'>('github');

  // Ownership form
  const [newRule, setNewRule] = useState({ name: '', type: 'path', pattern: '', owners: '' });
  const [guideCollapsed, setGuideCollapsed] = useState(() => {
    try { return localStorage.getItem('argus_ownership_guide_collapsed') === '1'; } catch { return false; }
  });
  const toggleGuide = useCallback(() => {
    setGuideCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem('argus_ownership_guide_collapsed', next ? '1' : '0'); } catch { /* noop */ }
      return next;
    });
  }, []);

  // ── Fetch ──
  const fetchProject = useCallback(async () => {
    setLoading(true);
    try {
      const data = await argusService.getProject(projectId);
      setProject(data); setName(data.name); setPlatform(data.platform);
      const eq = Number(data.error_quota_daily) || 100000;
      const tr = Number(data.transaction_sample_rate);
      const sr = Number(data.session_sample_rate);
      const rd = Number(data.retention_days);
      setErrorQuota(eq); setTxnRate(tr); setSessionRate(sr); setRetentionDays(rd);
      originalValues.current = { name: data.name, platform: data.platform, errorQuota: eq, txnRate: tr, sessionRate: sr, retentionDays: rd };
    } catch (err: any) {
      if (err?.response?.status === 404 || err?.status === 404) {
        try {
          const created = await argusService.createProject({
            gatrix_project_id: projectId, name: 'Default Project', slug: 'default', platform: 'javascript',
          });
          setProject(created); setName(created.name); setPlatform(created.platform);
          enqueueSnackbar(t('argus.settings.projectCreated'), { variant: 'success' });
        } catch { /* */ }
      }
    } finally { setLoading(false); }
  }, [projectId, enqueueSnackbar, t]);

  useEffect(() => { fetchProject(); }, [fetchProject]);

  useEffect(() => {
    if (currentSection === 'source-maps' && !smLoaded)
      argusService.listSourcemapReleases(projectId).then(d => { setSourcemaps(d); setSmLoaded(true); }).catch(() => setSmLoaded(true));
    if (currentSection === 'integrations' && !intLoaded)
      argusService.listIntegrations(projectId).then(d => { setIntegrations(d); setIntLoaded(true); }).catch(() => setIntLoaded(true));
    if (currentSection === 'notifications' && !notifLoaded) {
      // Backend: GET /:projectId/notification-channels (to be implemented)
      const svc = argusService as any;
      if (typeof svc.listNotificationChannels === 'function') {
        svc.listNotificationChannels(projectId).then((d: any[]) => { setNotifChannels(d); setNotifLoaded(true); }).catch(() => setNotifLoaded(true));
      } else {
        setNotifLoaded(true);
      }
    }
    if (currentSection === 'issue-trackers' && !trkLoaded)
      argusService.listIssueTrackers(projectId).then(d => { setTrackers(d); setTrkLoaded(true); }).catch(() => setTrkLoaded(true));
    if (currentSection === 'ownership' && !ruleLoaded)
      argusService.listOwnershipRules(projectId).then(d => { setRules(d); setRuleLoaded(true); }).catch(() => setRuleLoaded(true));
  }, [currentSection, projectId, smLoaded, intLoaded, trkLoaded, ruleLoaded, notifLoaded]);

  // ── Handlers ──
  const handleSave = async () => {
    setSaving(true);
    try {
      await argusService.updateProject(projectId, {
        name, platform, error_quota_daily: errorQuota,
        transaction_sample_rate: txnRate, session_sample_rate: sessionRate, retention_days: retentionDays,
      });
      enqueueSnackbar(t('argus.settings.saveSuccess'), { variant: 'success' });
      originalValues.current = { name, platform, errorQuota, txnRate, sessionRate, retentionDays };
    } catch { enqueueSnackbar(t('argus.settings.saveFailed'), { variant: 'error' }); }
    finally { setSaving(false); }
  };



  const handleCreateKey = async () => {
    try { await argusService.createDsnKey(projectId, 'New Key'); enqueueSnackbar(t('argus.settings.keyCreated'), { variant: 'success' }); fetchProject(); }
    catch { enqueueSnackbar(t('argus.settings.keyCreateFailed'), { variant: 'error' }); }
  };

  const handleRevokeKey = async (keyId: number) => {
    try { await argusService.revokeDsnKey(projectId, keyId); enqueueSnackbar(t('argus.settings.keyRevoked'), { variant: 'success' }); fetchProject(); }
    catch { enqueueSnackbar(t('argus.settings.keyRevokeFailed'), { variant: 'error' }); }
  };

  const [editingKeyId, setEditingKeyId] = useState<number | null>(null);
  const [editingKeyLabel, setEditingKeyLabel] = useState<string>('');

  const handleRenameKey = async (keyId: number) => {
    if (!editingKeyLabel.trim()) return;
    try {
      await argusService.updateDsnKey(projectId, keyId, { label: editingKeyLabel.trim() });
      enqueueSnackbar(t('common.saved'), { variant: 'success' });
      setEditingKeyId(null);
      fetchProject();
    } catch {
      enqueueSnackbar(t('common.saveFailed', { defaultValue: 'Failed to save' }), { variant: 'error' });
    }
  };

  const handleAddIntegration = async () => {
    if (!addIntDialog) return;
    try {
      await argusService.createIntegration(projectId, {
        provider: addIntDialog,
        repo_url: formData.repo_url?.trim() || '',
        default_branch: formData.default_branch?.trim() || 'main',
        access_token: formData.access_token?.trim(),
      });
      setIntegrations(await argusService.listIntegrations(projectId));
      setAddIntDialog(null); setFormData({});
      enqueueSnackbar(t('argus.settings.integrationAdded'), { variant: 'success' });
    } catch { enqueueSnackbar(t('argus.settings.integrationFailed'), { variant: 'error' }); }
  };

  const handleAddTracker = async () => {
    if (!addTrkDialog) return;
    const prov = TRACKER_PROVIDERS.find(p => p.id === addTrkDialog);
    if (!prov) return;
    const config: Record<string, string> = {};
    prov.configFields.forEach(f => { if (formData[f.key]) config[f.key] = formData[f.key]; });
    try {
      await argusService.createIssueTracker(projectId, {
        provider: addTrkDialog as any, name: formData.name?.trim() || '',
        api_url: formData.api_url?.trim() || '', api_token: formData.api_token?.trim() || '',
        config: Object.keys(config).length > 0 ? config : undefined,
      });
      setTrackers(await argusService.listIssueTrackers(projectId));
      setAddTrkDialog(null); setFormData({});
      enqueueSnackbar(t('argus.settings.trackerAdded'), { variant: 'success' });
    } catch { enqueueSnackbar(t('argus.settings.trackerAddFailed'), { variant: 'error' }); }
  };

  const dsnExample = project?.dsn_keys?.find(k => k.is_active)?.dsn || 'https://<key>@<host>/argus/<project-id>';

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <PageHeader
        icon={<SettingsIcon />}
        title={t('argus.settings.title')}
        subtitle={t('argus.settings.subtitle')}
      />

      <PageContentLoader loading={loading} sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <Box sx={{ display: 'flex', gap: 4, flex: 1, mb: -2 }}>

          {/* ══════ LEFT SIDEBAR ══════ */}
          <Box sx={{
            width: 220, flexShrink: 0,
            borderRight: '1px solid', borderColor: 'divider',
          }}>
            <Box sx={{ position: 'sticky', top: 0, pr: 2 }}>
            {NAV_GROUPS.map((group, gi) => (
              <Box key={gi} sx={{ mb: 2 }}>
                <Typography sx={{
                  px: 1.5, pb: 1,
                  fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase',
                  color: 'text.secondary', letterSpacing: '0.1em',
                }}>
                  {t(group.labelKey)}
                </Typography>
                {group.items.map(item => {
                  const active = currentSection === item.id;
                  return (
                    <Box key={item.id} onClick={() => setSection(item.id)}
                      sx={{
                        display: 'flex', alignItems: 'center', gap: 1.2,
                        px: 1.5, py: 1, mb: 0.2, borderRadius: '6px',
                        cursor: 'pointer', position: 'relative',
                        backgroundColor: active ? alpha(theme.palette.primary.main, isDark ? 0.12 : 0.08) : 'transparent',
                        color: active ? theme.palette.primary.main : 'text.primary',
                        transition: 'all 0.1s ease-in-out',
                        '&:hover': {
                          backgroundColor: active
                            ? alpha(theme.palette.primary.main, isDark ? 0.15 : 0.1)
                            : isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                        },
                      }}
                    >
                      {active && (
                        <Box sx={{
                          position: 'absolute', left: 0, top: '20%', bottom: '20%',
                          width: 3, borderRadius: '0 4px 4px 0',
                          backgroundColor: theme.palette.primary.main
                        }} />
                      )}
                      <Box sx={{ display: 'flex', opacity: active ? 1 : 0.6, color: 'inherit' }}>{item.icon}</Box>
                      <Typography sx={{ fontSize: '0.85rem', fontWeight: active ? 600 : 400 }}>{t(item.labelKey)}</Typography>
                    </Box>
                  );
                })}
              </Box>
            ))}
            </Box>
          </Box>

          {/* ══════ RIGHT CONTENT ══════ */}
          <Box sx={{ flex: 1, minWidth: 0, pb: 6 }}>

            {/* ─── GENERAL ─── */}
            {currentSection === 'general' && (
              <SettingsCard title={t('argus.settings.general')} desc={t('argus.settings.generalDesc')} isDark={isDark}
                headerAction={<Button variant="contained" size="small" startIcon={<SaveIcon />} onClick={handleSave} disabled={saving || !isDirty}
                  sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600, px: 3, boxShadow: 'none' }}>
                  {saving ? t('argus.settings.saving') : t('common.save')}
                </Button>}
              >
                <FieldBlock label={t('argus.settings.projectName')} desc={t('argus.settings.projectNameDesc')}>
                  <TextField value={name} onChange={e => setName(e.target.value)} size="small" sx={{ ...inpSx, maxWidth: 400, width: '100%' }} />
                </FieldBlock>
                <FieldBlock label={t('argus.settings.platform')} desc={t('argus.settings.platformDesc')}>
                  <Select value={platform} onChange={e => setPlatform(e.target.value)} size="small" displayEmpty
                    sx={{ ...inpSx, maxWidth: 300, width: '100%' }}>
                    {PLATFORM_CATEGORIES.map(cat => [
                      <MenuItem key={`cat-${cat}`} disabled sx={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'text.secondary', letterSpacing: '0.05em', py: 0.5, opacity: '1 !important' }}>
                        {cat}
                      </MenuItem>,
                      ...PLATFORM_OPTIONS.filter(p => p.category === cat).map(p => (
                        <MenuItem key={p.id} value={p.id} sx={{ fontSize: '0.85rem', pl: 3 }}>{p.label}</MenuItem>
                      )),
                    ])}
                  </Select>
                </FieldBlock>
                <FieldBlock label={t('argus.settings.projectId')} desc={t('argus.settings.projectIdDesc')} last>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TextField value={projectId} size="small" disabled sx={{ ...inpSx, maxWidth: 380, width: '100%' }} />
                    <CopyButton text={projectId} />
                  </Box>
                </FieldBlock>
              </SettingsCard>
            )}

            {/* ─── SAMPLING ─── */}
            {currentSection === 'sampling' && (<>
              <SettingsCard title={t('argus.settings.samplingQuotas')} desc={t('argus.settings.samplingDesc')} isDark={isDark}
                headerAction={<Button variant="contained" size="small" startIcon={<SaveIcon />} onClick={handleSave} disabled={saving || !isDirty}
                  sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600, px: 3, boxShadow: 'none' }}>
                  {saving ? t('argus.settings.saving') : t('common.save')}
                </Button>}
              >
                <FieldBlock label={t('argus.settings.errorQuota')} desc={t('argus.settings.errorQuotaDesc')}>
                  <TextField type="number" value={errorQuota} onChange={e => setErrorQuota(Number(e.target.value))}
                    size="small" sx={{ ...inpSx, width: 200 }}
                    InputProps={{ endAdornment: <InputAdornment position="end">/day</InputAdornment> }}
                  />
                </FieldBlock>
                <FieldBlock label={t('argus.settings.retentionDays')} desc={t('argus.settings.retentionDesc')}>
                  <TextField type="number" value={retentionDays} onChange={e => setRetentionDays(Number(e.target.value))}
                    size="small" sx={{ ...inpSx, width: 160 }}
                    InputProps={{ endAdornment: <InputAdornment position="end">{t('argus.settings.days')}</InputAdornment> }}
                  />
                </FieldBlock>
                <FieldBlock label={t('argus.settings.txnSampleRate')} desc={t('argus.settings.txnSampleDesc')}>
                  <RateBar value={txnRate} onChange={setTxnRate} isDark={isDark} />
                </FieldBlock>
                <FieldBlock label={t('argus.settings.sessionSampleRate')} desc={t('argus.settings.sessionSampleDesc')} last>
                  <RateBar value={sessionRate} onChange={setSessionRate} isDark={isDark} />
                </FieldBlock>
              </SettingsCard>
            </>)}

            {/* ─── DSN KEYS ─── */}
            {currentSection === 'dsn-keys' && (
              <SettingsCard title={t('argus.settings.dsnKeys')} desc={t('argus.settings.dsnKeysDesc')} isDark={isDark}
                headerAction={<Button size="small" startIcon={<AddIcon />} onClick={handleCreateKey} variant="contained"
                  sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600, fontSize: '0.8rem' }}>{t('argus.settings.createKey')}</Button>}
              >
                {!project?.dsn_keys?.length ? (
                  <EmptyState icon={<KeyIcon />} text={t('argus.settings.noKeys')} />
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {project.dsn_keys.map(key => (
                      <Paper key={key.id} elevation={0} sx={{
                        p: 2, border: `1px solid ${bdr}`, borderRadius: '10px',
                      }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          {editingKeyId === key.id ? (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flex: 1 }}>
                              <TextField
                                value={editingKeyLabel}
                                onChange={e => setEditingKeyLabel(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleRenameKey(key.id)}
                                size="small"
                                autoFocus
                                sx={{ ...inpSx, width: '200px', '& .MuiInputBase-input': { py: 0.5 } }}
                              />
                              <IconButton size="small" onClick={() => handleRenameKey(key.id)} color="primary"><CheckIcon fontSize="small" /></IconButton>
                              <IconButton size="small" onClick={() => setEditingKeyId(null)}><CloseIcon fontSize="small" /></IconButton>
                            </Box>
                          ) : (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                              <Typography sx={{ fontWeight: 600, fontSize: '0.85rem' }}>{key.label}</Typography>
                              <IconButton size="small" onClick={() => { setEditingKeyId(key.id); setEditingKeyLabel(key.label); }} sx={{ opacity: 0.5, '&:hover': { opacity: 1 } }}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          )}
                          <StatusBadge active={key.is_active} t={t} />
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ flex: 1, minWidth: 0, p: 1, borderRadius: '6px', backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.03)' }}>
                            <Typography sx={{
                              fontFamily: '"JetBrains Mono", "Fira Code", monospace', fontSize: '0.75rem',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              color: isDark ? '#bbb' : '#555', userSelect: 'all',
                            }}>{key.dsn}</Typography>
                          </Box>
                          <CopyButton text={key.dsn} />
                          {key.is_active && (
                            <Tooltip title={t('argus.settings.deactivateKey')}><IconButton size="small" color="error"
                              onClick={() => handleRevokeKey(key.id)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                          )}
                        </Box>
                      </Paper>
                    ))}
                  </Box>
                )}
              </SettingsCard>
            )}

            {/* ─── SDK SETUP ─── */}
            {currentSection === 'sdk-setup' && (
              <SettingsCard title={t('argus.settings.sdkGuide')} desc={t('argus.settings.sdkGuideDesc')} isDark={isDark}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                  <CodeBlock title={t('argus.settings.jsTitle')} language="javascript" isDark={isDark}
                    code={`import * as Argus from '@argus/browser';\n\nArgus.init({\n  dsn: '${dsnExample}',\n  environment: 'production',\n  release: '${name}@1.0.0',\n  tracesSampleRate: ${txnRate},\n  sessionSampleRate: ${sessionRate},\n});`} />
                  <CodeBlock title={t('argus.settings.nodeTitle')} language="javascript" isDark={isDark}
                    code={`const Argus = require('@argus/node');\n\nArgus.init({\n  dsn: '${dsnExample}',\n  environment: process.env.NODE_ENV,\n  release: '${name}@1.0.0',\n  tracesSampleRate: ${txnRate},\n});`} />
                  <CodeBlock title={t('argus.settings.curlTitle')} language="bash" isDark={isDark}
                    code={`curl -X POST '${window.location.origin}/argus/api/${projectId}/ingest/batch' \\\n  -H 'Authorization: Bearer ${project?.dsn_keys?.find(k => k.is_active)?.public_key || '<your-key>'}' \\\n  -H 'Content-Type: application/json' \\\n  -d '{"events": [{"type": "error", ...}]}'`} />
                </Box>
              </SettingsCard>
            )}

            {/* ─── SOURCE MAPS ─── */}
            {currentSection === 'source-maps' && (
              <SettingsCard title={t('argus.settings.sourceMapsTitle')} desc={t('argus.settings.sourceMapsSubtitle')} isDark={isDark}
                headerAction={
                  <Button size="small" variant="contained" startIcon={<UploadIcon />} component="label"
                    sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600, fontSize: '0.8rem' }}>
                    {t('common.upload')}
                    <input type="file" multiple hidden accept=".map,.js.map" onChange={async (e) => {
                      const files = Array.from(e.target.files || []);
                      if (!files.length) return;
                      const release = prompt(t('argus.settings.enterRelease'));
                      if (!release) return;
                      try {
                        await argusService.uploadSourcemaps(projectId, release, files);
                        enqueueSnackbar(t('argus.settings.smUploadSuccess', { count: files.length }), { variant: 'success' });
                        setSourcemaps(await argusService.listSourcemapReleases(projectId));
                      } catch { enqueueSnackbar(t('argus.settings.smUploadFailed'), { variant: 'error' }); }
                    }} />
                  </Button>
                }
              >
                {/* CLI */}
                <Paper elevation={0} sx={{ p: 2, mb: 2.5, border: `1px solid ${bdr}`, borderRadius: '8px', backgroundColor: bgSubtle }}>
                  <Typography sx={{ fontWeight: 600, fontSize: '0.75rem', mb: 1, color: 'text.secondary' }}>{t('argus.settings.cliExample')}</Typography>
                  <Box sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.73rem', color: isDark ? '#aaa' : '#555', whiteSpace: 'pre', lineHeight: 1.6 }}>
                    {`curl -X POST '${window.location.origin}/argus/api/${projectId}/sourcemaps' \\\n  -F 'release=1.0.0' \\\n  -F 'files=@dist/main.js.map'`}
                  </Box>
                </Paper>
                {!smLoaded ? <Spinner /> : sourcemaps.length === 0 ? (
                  <EmptyState icon={<UploadIcon />} text={t('argus.settings.noSourceMaps')} hint={t('argus.settings.noSourceMapsHint')} />
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {sourcemaps.map(rel => (
                      <Paper key={rel.id} elevation={0} sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2, border: `1px solid ${bdr}`, borderRadius: '8px' }}>
                        <Box sx={{ flex: 1 }}>
                          <Typography sx={{ fontWeight: 600, fontSize: '0.85rem' }}>{rel.release}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {rel.file_count} {t('common.files')} · {new Date(rel.created_at).toLocaleString()}
                          </Typography>
                        </Box>
                        <Tooltip title={t('common.delete')}><IconButton size="small" color="error" onClick={async () => {
                          try { await argusService.deleteSourcemapRelease(projectId, rel.id); setSourcemaps(p => p.filter(r => r.id !== rel.id)); enqueueSnackbar(t('argus.settings.smDeleteSuccess'), { variant: 'success' }); }
                          catch { enqueueSnackbar(t('argus.settings.smDeleteFailed'), { variant: 'error' }); }
                        }}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                      </Paper>
                    ))}
                  </Box>
                )}
              </SettingsCard>
            )}

            {/* ─── INTEGRATIONS ─── */}
            {currentSection === 'integrations' && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <SettingsCard title={t('argus.settings.availableProviders')} desc={t('argus.settings.availableProvidersDesc')} isDark={isDark}>
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 2 }}>
                    {REPO_PROVIDERS.map(prov => (
                      <ProviderCard key={prov.id} prov={prov} isDark={isDark} t={t}
                        count={integrations.filter(i => i.provider === prov.id).length}
                        onAdd={async () => {
                          let finalFields = prov.fields;
                          if (prov.id === 'github' || prov.id === 'gitlab' || prov.id === 'bitbucket') {
                            try {
                              const { configured } = await argusService.getGlobalIntegrationConfig(prov.id);
                              if (!configured) {
                                setWizardProvider(prov.id as 'github' | 'gitlab' | 'bitbucket');
                                setWizardOpen(true);
                                return;
                              }
                              
                              if (prov.id === 'github') {
                                const repos = await argusService.getGithubRepositories();
                                finalFields = finalFields.map(f => {
                                  if (f.key === 'repo_url') {
                                    return {
                                      ...f,
                                      type: 'select',
                                      options: repos.map(r => ({ value: r.url, label: r.full_name }))
                                    };
                                  }
                                  if (f.key === 'access_token') return null; // GitHub App doesn't need manual access token
                                  return f;
                                }).filter(Boolean) as ProviderFieldDef[];
                              }
                            } catch (e) {
                              console.error('Failed to check config', e);
                            }
                          }
                          setDynamicFields(finalFields);
                          setAddIntDialog(prov.id);
                          setFormData({ default_branch: 'main' });
                        }}
                      />
                    ))}
                  </Box>
                </SettingsCard>
                {intLoaded && integrations.length > 0 && (
                  <SettingsCard title={t('argus.settings.configuredIntegrations')} desc={t('argus.settings.configuredIntegrationsDesc')} isDark={isDark}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {integrations.map(intg => {
                        const prov = REPO_PROVIDERS.find(p => p.id === intg.provider);
                        return (
                          <ConnectedItem key={intg.id} isDark={isDark} color={prov?.color || '#666'} icon={prov?.icon || <GitHubIcon sx={{ fontSize: 18 }} />}
                            title={intg.repo_url} subtitle={`${intg.provider} · ${intg.default_branch} · ${new Date(intg.created_at).toLocaleDateString()}`}
                            active={intg.enabled} t={t}
                            onDelete={async () => { await argusService.deleteIntegration(projectId, intg.id); setIntegrations(p => p.filter(i => i.id !== intg.id)); enqueueSnackbar(t('common.deleted'), { variant: 'success' }); }}
                          />
                        );
                      })}
                    </Box>
                  </SettingsCard>
                )}
                {!intLoaded && <Spinner />}
              </Box>
            )}

            {/* ─── NOTIFICATIONS ─── */}
            {currentSection === 'notifications' && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <SettingsCard title={t('argus.settings.availableNotifications')} desc={t('argus.settings.notificationsDesc')} isDark={isDark}>
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 2 }}>
                    {NOTIFICATION_PROVIDERS.map(prov => (
                      <ProviderCard key={prov.id} prov={prov} isDark={isDark} t={t}
                        count={notifChannels.filter(c => c.provider === prov.id).length}
                        onAdd={() => { setAddNotifDialog(prov.id); setFormData({}); }}
                      />
                    ))}
                  </Box>
                </SettingsCard>
                {notifLoaded && notifChannels.length > 0 && (
                  <SettingsCard title={t('argus.settings.configuredChannels')} desc={t('argus.settings.configuredChannelsDesc')} isDark={isDark}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {notifChannels.map((ch: any) => {
                        const prov = NOTIFICATION_PROVIDERS.find(p => p.id === ch.provider);
                        return (
                          <ConnectedItem key={ch.id} isDark={isDark} color={prov?.color || '#666'} icon={prov?.icon || <NotificationsIcon sx={{ fontSize: 18 }} />}
                            title={ch.name} chipLabel={prov?.name || ch.provider}
                            subtitle={ch.webhook_url || ch.recipients || ''}
                            active={ch.enabled} t={t}
                            onToggle={async () => {
                              try {
                                await (argusService as any).updateNotificationChannel?.(projectId, ch.id, { enabled: !ch.enabled });
                                const updated = await (argusService as any).listNotificationChannels?.(projectId);
                                if (updated) setNotifChannels(updated);
                              } catch { /* */ }
                            }}
                            onTest={async () => {
                              try {
                                const r = await (argusService as any).testNotificationChannel?.(projectId, ch.id);
                                enqueueSnackbar(r?.ok ? r.message : t('argus.settings.testFailed'), { variant: r?.ok ? 'success' : 'error' });
                              } catch { enqueueSnackbar(t('argus.settings.testFailed'), { variant: 'error' }); }
                            }}
                            onDelete={async () => {
                              try {
                                await (argusService as any).deleteNotificationChannel?.(projectId, ch.id);
                                setNotifChannels(p => p.filter((i: any) => i.id !== ch.id));
                                enqueueSnackbar(t('common.deleted'), { variant: 'success' });
                              } catch { /* */ }
                            }}
                          />
                        );
                      })}
                    </Box>
                  </SettingsCard>
                )}
                {!notifLoaded && <Spinner />}
              </Box>
            )}

            {/* ─── ISSUE TRACKERS ─── */}
            {currentSection === 'issue-trackers' && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <SettingsCard title={t('argus.settings.availableTrackers')} desc={t('argus.settings.issueTrackersDesc')} isDark={isDark}>
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 2 }}>
                    {TRACKER_PROVIDERS.map(prov => (
                      <ProviderCard key={prov.id} prov={prov} isDark={isDark} t={t}
                        count={trackers.filter(tr => tr.provider === prov.id).length}
                        onAdd={() => { setAddTrkDialog(prov.id); setFormData({}); }}
                      />
                    ))}
                  </Box>
                </SettingsCard>
                {trkLoaded && trackers.length > 0 && (
                  <SettingsCard title={t('argus.settings.configuredTrackers')} desc={t('argus.settings.configuredTrackersDesc')} isDark={isDark}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {trackers.map(trk => {
                        const prov = TRACKER_PROVIDERS.find(p => p.id === trk.provider);
                        return (
                          <ConnectedItem key={trk.id} isDark={isDark} color={prov?.color || '#666'} icon={prov?.icon || <BugIcon sx={{ fontSize: 18 }} />}
                            title={trk.name} chipLabel={prov?.name || trk.provider}
                            subtitle={`${trk.api_url}${trk.config?.project_key ? ` · ${trk.config.project_key}` : ''}${trk.config?.repo ? ` · ${trk.config.repo}` : ''}`}
                            active={trk.enabled} t={t}
                            onToggle={async () => { await argusService.updateIssueTracker(projectId, trk.id, { enabled: !trk.enabled }); setTrackers(await argusService.listIssueTrackers(projectId)); }}
                            onTest={async () => {
                              try { const r = await argusService.testIssueTracker(projectId, trk.id); enqueueSnackbar(r.ok ? r.message : `Failed: ${r.message}`, { variant: r.ok ? 'success' : 'error' }); }
                              catch { enqueueSnackbar(t('argus.settings.testFailed'), { variant: 'error' }); }
                            }}
                            onDelete={async () => { await argusService.deleteIssueTracker(projectId, trk.id); setTrackers(p => p.filter(i => i.id !== trk.id)); enqueueSnackbar(t('common.deleted'), { variant: 'success' }); }}
                          />
                        );
                      })}
                    </Box>
                  </SettingsCard>
                )}
                {!trkLoaded && <Spinner />}
              </Box>
            )}


            {/* ─── OWNERSHIP ─── */}
            {currentSection === 'ownership' && (<Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

              <Paper elevation={0} sx={{
                borderRadius: '12px', overflow: 'hidden',
                border: `1px solid ${bdr}`,
                background: isDark
                  ? 'linear-gradient(135deg, rgba(124,77,255,0.06) 0%, rgba(66,165,245,0.04) 100%)'
                  : 'linear-gradient(135deg, rgba(124,77,255,0.04) 0%, rgba(66,165,245,0.02) 100%)',
              }}>
                <Box
                  onClick={toggleGuide}
                  sx={{
                    px: 3, py: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    cursor: 'pointer', userSelect: 'none',
                    '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)' },
                  }}
                >
                  <Box>
                    <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>{t('argus.settings.ownershipGuideTitle')}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.78rem', mt: 0.3 }}>{t('argus.settings.ownershipGuideDesc')}</Typography>
                  </Box>
                  <IconButton size="small" sx={{ transition: 'transform 0.2s', transform: guideCollapsed ? 'rotate(0deg)' : 'rotate(180deg)' }}>
                    <ExpandMoreIcon fontSize="small" />
                  </IconButton>
                </Box>

                <Collapse in={!guideCollapsed} timeout={200}>
                <Divider sx={{ borderColor: bdr }} />

                {/* Syntax Reference */}
                <Box sx={{ px: 3, py: 2 }}>
                  <Typography sx={{ fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', color: 'text.disabled', letterSpacing: '0.08em', mb: 1.5 }}>
                    {t('argus.settings.ownershipSyntaxTitle')}
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 1.5 }}>
                    {([
                      { type: 'path', example: 'src/components/**', desc: t('argus.settings.ownershipSyntaxPath'), color: '#7c4dff' },
                      { type: 'module', example: 'com.app.auth', desc: t('argus.settings.ownershipSyntaxModule'), color: '#42a5f5' },
                      { type: 'url', example: '/api/v1/checkout*', desc: t('argus.settings.ownershipSyntaxUrl'), color: '#66bb6a' },
                      { type: 'tag', example: 'browser:Chrome*', desc: t('argus.settings.ownershipSyntaxTag'), color: '#ffa726' },
                    ] as const).map(s => (
                      <Box key={s.type} sx={{
                        p: 1.5, borderRadius: '8px',
                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                        backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.6)',
                      }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 0.5 }}>
                          <Box sx={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: s.color, flexShrink: 0 }} />
                          <Typography sx={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.type}</Typography>
                        </Box>
                        <Typography sx={{ fontFamily: '"JetBrains Mono", "Fira Code", monospace', fontSize: '0.72rem', color: s.color, mb: 0.3 }}>{s.example}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem', lineHeight: 1.4 }}>{s.desc}</Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>

                {/* Examples */}
                <Box sx={{ px: 3, py: 2, borderTop: `1px solid ${bdrSubtle}` }}>
                  <Typography sx={{ fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', color: 'text.disabled', letterSpacing: '0.08em', mb: 1 }}>
                    {t('argus.settings.ownershipExampleTitle')}
                  </Typography>
                  <Box sx={{
                    fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                    fontSize: '0.73rem', lineHeight: 2,
                    color: isDark ? '#bbb' : '#555',
                    p: 1.5, borderRadius: '6px',
                    backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.03)',
                  }}>
                    <Box component="span" sx={{ color: '#7c4dff' }}>path:</Box>src/frontend/** <Box component="span" sx={{ color: '#66bb6a' }}>alice@team.com</Box> <Box component="span" sx={{ color: '#42a5f5' }}>#frontend</Box><br/>
                    <Box component="span" sx={{ color: '#ffa726' }}>tag:</Box>level:fatal <Box component="span" sx={{ color: '#66bb6a' }}>#oncall-team</Box><br/>
                    <Box component="span" sx={{ color: '#42a5f5' }}>url:</Box>/api/payments/** <Box component="span" sx={{ color: '#66bb6a' }}>bob@team.com</Box>
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, fontSize: '0.68rem', fontStyle: 'italic' }}>
                    {t('argus.settings.ownershipEvalDesc')}
                  </Typography>
                </Box>
                </Collapse>
              </Paper>

              {/* ── Rules Card ── */}
              <SettingsCard
                title={t('argus.settings.ownership')}
                desc={ruleLoaded ? t('argus.settings.rulesCount', { count: rules.length }) : t('argus.settings.ownershipDesc')}
                isDark={isDark}
              >
                {/* Add Rule Form — collapsible */}
                {(newRule.name !== undefined) && (
                  <Paper elevation={0} sx={{
                    p: 2.5, mb: 2, borderRadius: '10px',
                    border: `1px solid ${isDark ? alpha('#7c4dff', 0.2) : alpha('#7c4dff', 0.12)}`,
                    backgroundColor: isDark ? alpha('#7c4dff', 0.04) : alpha('#7c4dff', 0.02),
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <SecurityIcon sx={{ fontSize: 18, color: '#7c4dff' }} />
                      <Typography sx={{ fontWeight: 700, fontSize: '0.82rem' }}>{t('argus.settings.addRule')}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                      <Box sx={{ flex: 1 }}>
                        <TextField size="small" placeholder={t('argus.settings.ruleName')}
                          value={newRule.name} onChange={e => setNewRule({ ...newRule, name: e.target.value })}
                          fullWidth
                          sx={{ ...inpSx, '& .MuiOutlinedInput-notchedOutline legend': { display: 'none' }, '& .MuiInputLabel-root': { display: 'none' } }} />
                      </Box>
                      <ChipSelect
                        label={t('argus.settings.matchType')}
                        value={newRule.type}
                        onChange={v => setNewRule({ ...newRule, type: v })}
                        options={[
                          { value: 'path', label: 'Path', color: '#7c4dff', desc: t('argus.settings.ownershipSyntaxPath') },
                          { value: 'module', label: 'Module', color: '#42a5f5', desc: t('argus.settings.ownershipSyntaxModule') },
                          { value: 'url', label: 'URL', color: '#66bb6a', desc: t('argus.settings.ownershipSyntaxUrl') },
                          { value: 'tag', label: 'Tag', color: '#ffa726', desc: t('argus.settings.ownershipSyntaxTag') },
                        ]}
                      />
                    </Box>
                    <Box sx={{ mb: 1.5 }}>
                      <TextField size="small" placeholder={t('argus.settings.pattern')}
                        value={newRule.pattern} onChange={e => setNewRule({ ...newRule, pattern: e.target.value })}
                        fullWidth
                        sx={{ ...inpSx, '& .MuiOutlinedInput-notchedOutline legend': { display: 'none' }, '& .MuiInputLabel-root': { display: 'none' } }} />
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', fontSize: '0.68rem' }}>{t('argus.settings.globHint')}</Typography>
                    </Box>
                    <Box sx={{ mb: 2 }}>
                      <TextField size="small" placeholder={t('argus.settings.owners')}
                        value={newRule.owners} onChange={e => setNewRule({ ...newRule, owners: e.target.value })}
                        fullWidth
                        sx={{ ...inpSx, '& .MuiOutlinedInput-notchedOutline legend': { display: 'none' }, '& .MuiInputLabel-root': { display: 'none' } }} />
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', fontSize: '0.68rem' }}>{t('argus.settings.ownerHint')}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                      <Button variant="contained" size="small" startIcon={<AddIcon />}
                        disabled={!newRule.name.trim() || !newRule.pattern.trim() || !newRule.owners.trim()}
                        onClick={async () => {
                          try {
                            await argusService.createOwnershipRule(projectId, {
                              name: newRule.name.trim(), match_type: newRule.type, match_pattern: newRule.pattern.trim(),
                              owners: newRule.owners.split(',').map(o => o.trim()).filter(Boolean),
                            });
                            setRules(await argusService.listOwnershipRules(projectId));
                            setNewRule({ name: '', type: 'path', pattern: '', owners: '' });
                            enqueueSnackbar(t('argus.settings.ruleAdded'), { variant: 'success' });
                          } catch { enqueueSnackbar(t('argus.settings.ruleFailed'), { variant: 'error' }); }
                        }}
                        sx={{ textTransform: 'none', fontWeight: 600, borderRadius: '8px', px: 3 }}>{t('common.add')}</Button>
                    </Box>
                  </Paper>
                )}

                {/* Rules List */}
                {!ruleLoaded ? <Spinner /> : rules.length === 0 ? (
                  <Box sx={{ py: 6, textAlign: 'center' }}>
                    <Box sx={{
                      width: 64, height: 64, borderRadius: '50%', mx: 'auto', mb: 2,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: isDark ? 'linear-gradient(135deg, rgba(124,77,255,0.12), rgba(66,165,245,0.08))' : 'linear-gradient(135deg, rgba(124,77,255,0.08), rgba(66,165,245,0.04))',
                    }}>
                      <SecurityIcon sx={{ fontSize: 28, color: '#7c4dff' }} />
                    </Box>
                    <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', mb: 0.5 }}>{t('argus.settings.noRules')}</Typography>
                    <Typography color="text.secondary" sx={{ fontSize: '0.78rem', mb: 2, maxWidth: 360, mx: 'auto', lineHeight: 1.5 }}>
                      {t('argus.settings.noRulesHint')}
                    </Typography>
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {rules.map((rule, _idx) => {
                      const owners = typeof rule.owners === 'string' ? JSON.parse(rule.owners) : rule.owners;
                      const typeColor = { path: '#7c4dff', module: '#42a5f5', url: '#66bb6a', tag: '#ffa726' }[rule.match_type] || '#888';
                      return (
                        <Paper key={rule.id} elevation={0} sx={{
                          p: 0, overflow: 'hidden',
                          border: `1px solid ${rule.enabled === false ? (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)') : bdr}`,
                          borderRadius: '10px',
                          opacity: rule.enabled === false ? 0.5 : 1,
                          transition: 'all 0.15s ease',
                          '&:hover': { borderColor: alpha(typeColor, 0.4) },
                        }}>
                          <Box sx={{ display: 'flex', alignItems: 'stretch' }}>
                            {/* Color accent bar */}
                            <Box sx={{ width: 4, flexShrink: 0, backgroundColor: typeColor, borderRadius: '10px 0 0 10px' }} />

                            {/* Content */}
                            <Box sx={{ flex: 1, p: 2, minWidth: 0 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.8 }}>
                                <Typography sx={{ fontWeight: 700, fontSize: '0.85rem' }}>{rule.name}</Typography>
                                <Chip label={rule.match_type} size="small" sx={{
                                  height: 20, fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.04em',
                                  backgroundColor: alpha(typeColor, isDark ? 0.15 : 0.1), color: typeColor, border: 'none',
                                }} />
                                {rule.auto_assign && (
                                  <Chip label="auto-assign" size="small" sx={{
                                    height: 20, fontSize: '0.6rem', fontWeight: 600,
                                    backgroundColor: alpha('#7c4dff', 0.1), color: '#7c4dff', border: 'none',
                                  }} />
                                )}
                                {rule.enabled === false && (
                                  <Chip label={t('argus.settings.ruleDisabled')} size="small" sx={{
                                    height: 20, fontSize: '0.6rem', fontWeight: 600,
                                    backgroundColor: alpha('#ff5252', isDark ? 0.15 : 0.1), color: '#ff5252', border: 'none',
                                  }} />
                                )}
                              </Box>

                              {/* Pattern line */}
                              <Box sx={{
                                display: 'inline-flex', alignItems: 'center', gap: 0.8,
                                px: 1, py: 0.3, borderRadius: '4px', mb: 1,
                                backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.03)',
                              }}>
                                <Box component="span" sx={{ color: typeColor, fontFamily: '"JetBrains Mono", monospace', fontSize: '0.7rem', fontWeight: 700 }}>
                                  {rule.match_type}:
                                </Box>
                                <Typography sx={{ fontFamily: '"JetBrains Mono", "Fira Code", monospace', fontSize: '0.73rem', color: isDark ? '#ccc' : '#444' }}>
                                  {rule.match_pattern}
                                </Typography>
                              </Box>

                              {/* Owners */}
                              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                {(owners as string[]).map((o: string, i: number) => (
                                  <Chip key={i} label={o} size="small"
                                    avatar={<Avatar sx={{ width: 18, height: 18, fontSize: '0.6rem', backgroundColor: alpha(typeColor, 0.2), color: typeColor }}>{o[0]?.toUpperCase()}</Avatar>}
                                    sx={{ height: 22, fontSize: '0.68rem', fontWeight: 600, borderRadius: '6px' }} />
                                ))}
                              </Box>
                            </Box>

                            {/* Actions */}
                            <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 0.5, px: 1, borderLeft: `1px solid ${bdrSubtle}` }}>
                              <Tooltip title={rule.enabled === false ? t('argus.alerts.enable') : t('argus.alerts.disable')}>
                                <IconButton size="small" onClick={async () => {
                                  try {
                                    await argusService.updateOwnershipRule(projectId, rule.id, { enabled: rule.enabled === false ? true : false });
                                    setRules(await argusService.listOwnershipRules(projectId));
                                  } catch { enqueueSnackbar(t('argus.settings.ruleUpdateFailed'), { variant: 'error' }); }
                                }} sx={{ opacity: 0.6, '&:hover': { opacity: 1 } }}>
                                  {rule.enabled === false ? <CancelIcon fontSize="small" /> : <CheckIcon fontSize="small" sx={{ color: '#66bb6a' }} />}
                                </IconButton>
                              </Tooltip>
                              <Tooltip title={t('argus.settings.deleteRule')}>
                                <IconButton size="small" color="error" onClick={async () => {
                                  try {
                                    await argusService.deleteOwnershipRule(projectId, rule.id);
                                    setRules(p => p.filter(r => r.id !== rule.id));
                                    enqueueSnackbar(t('argus.settings.ruleDeleted'), { variant: 'success' });
                                  } catch { enqueueSnackbar(t('argus.settings.ruleFailed'), { variant: 'error' }); }
                                }} sx={{ opacity: 0.6, '&:hover': { opacity: 1 } }}>
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          </Box>
                        </Paper>
                      );
                    })}
                  </Box>
                )}
              </SettingsCard>
            </Box>)}
          </Box>
        </Box>
      </PageContentLoader>

      {/* ═══ ADD INTEGRATION DIALOG ═══ */}
      <ConfigDialog open={!!addIntDialog} onClose={() => { setAddIntDialog(null); setFormData({}); }}
        provider={REPO_PROVIDERS.find(p => p.id === addIntDialog) || null}
        fields={dynamicFields}
        formData={formData} setFormData={setFormData} onSubmit={handleAddIntegration}
        submitDisabled={!formData.repo_url?.trim()} isDark={isDark} t={t} inpSx={inpSx}
      />

      {/* ═══ ADD TRACKER WIZARD ═══ */}
      {(() => {
        const tp = TRACKER_PROVIDERS.find(p => p.id === addTrkDialog);
        if (!tp) return null;
        const wizardCfg: WizardProviderConfig = {
          id: tp.id, name: tp.name, color: tp.color,
          gradient: tp.gradient, accentColor: tp.accentColor,
          icon: tp.icon, descKey: tp.descKey,
        };
        const allFields: WizardFieldDef[] = [...tp.baseFields, ...tp.configFields].map(f => ({
          ...f, required: f.key === 'name' || f.key === 'api_url' || f.key === 'api_token',
        }));
        return (
          <ProviderWizardModal
            open={!!addTrkDialog}
            onClose={() => { setAddTrkDialog(null); }}
            provider={wizardCfg}
            fields={allFields}
            wizardTitleKey="argus.settings.providerWizard.addTracker"
            onSubmit={async (data) => {
              const prov = TRACKER_PROVIDERS.find(p => p.id === addTrkDialog);
              if (!prov || !addTrkDialog) return;
              const config: Record<string, string> = {};
              prov.configFields.forEach(f => { if (data[f.key]) config[f.key] = data[f.key]; });
              await argusService.createIssueTracker(projectId, {
                provider: addTrkDialog as any, name: data.name?.trim() || '',
                api_url: data.api_url?.trim() || '', api_token: data.api_token?.trim() || '',
                config: Object.keys(config).length > 0 ? config : undefined,
              });
              setTrackers(await argusService.listIssueTrackers(projectId));
              setAddTrkDialog(null);
              enqueueSnackbar(t('argus.settings.trackerAdded'), { variant: 'success' });
            }}
          />
        );
      })()}

      {/* ═══ ADD NOTIFICATION WIZARD ═══ */}
      {(() => {
        const np = NOTIFICATION_PROVIDERS.find(p => p.id === addNotifDialog);
        if (!np) return null;
        const wizardCfg: WizardProviderConfig = {
          id: np.id, name: np.name, color: np.color,
          gradient: np.gradient, accentColor: np.accentColor,
          icon: np.icon, descKey: np.descKey,
          guideUrl: np.guideUrl, guideButtonKey: np.guideButtonKey,
          guideDescKey: np.guideDescKey,
        };
        const wizardFields: WizardFieldDef[] = np.fields.map(f => ({
          ...f, required: f.key === 'name',
        }));
        return (
          <ProviderWizardModal
            open={!!addNotifDialog}
            onClose={() => { setAddNotifDialog(null); }}
            provider={wizardCfg}
            fields={wizardFields}
            wizardTitleKey="argus.settings.providerWizard.addNotification"
            onSubmit={async (data) => {
              await (argusService as any).createNotificationChannel?.(projectId, {
                provider: addNotifDialog, name: data.name?.trim() || '',
                webhook_url: data.webhook_url?.trim(), channel: data.channel?.trim(),
                recipients: data.recipients?.trim(), secret: data.secret?.trim(),
                api_token: data.api_token?.trim(), severity: data.severity?.trim(),
                config: data,
              });
              const updated = await (argusService as any).listNotificationChannels?.(projectId);
              if (updated) setNotifChannels(updated);
              setAddNotifDialog(null);
              enqueueSnackbar(t('argus.settings.channelAdded'), { variant: 'success' });
            }}
          />
        );
      })()}

      <GlobalIntegrationWizardModal
        open={wizardOpen}
        provider={wizardProvider}
        onClose={() => setWizardOpen(false)}
        onSuccess={() => {
          setWizardOpen(false);
          enqueueSnackbar(t('common.saved', 'Saved successfully'), { variant: 'success' });
          setAddIntDialog(wizardProvider);
          setFormData({ default_branch: 'main' });
        }}
      />
    </Box>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════════

/** 설정 카드 — 패널 단위 래퍼 */
const SettingsCard: React.FC<{
  title: string; desc: string; isDark: boolean;
  children: React.ReactNode; headerAction?: React.ReactNode; footer?: React.ReactNode;
}> = ({ title, desc, isDark, children, headerAction, footer }) => {
  const bdr = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  return (
    <Paper elevation={0} sx={{ border: `1px solid ${bdr}`, borderRadius: '12px', overflow: 'hidden' }}>
      {/* Header */}
      <Box sx={{
        px: 3, py: 2.5, borderBottom: `1px solid ${bdr}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>{title}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.78rem', mt: 0.3 }}>{desc}</Typography>
        </Box>
        {headerAction}
      </Box>
      {/* Body */}
      <Box sx={{ p: 3 }}>{children}</Box>
      {/* Footer */}
      {footer && (
        <Box sx={{ px: 3, py: 2, borderTop: `1px solid ${bdr}`, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', display: 'flex', justifyContent: 'flex-end' }}>
          {footer}
        </Box>
      )}
    </Paper>
  );
};

/** 필드 블록 — Sentry 스타일 (라벨+설명 위, 인풋 아래, 일관된 폭) */
const FieldBlock: React.FC<{
  label: string; desc: string; children: React.ReactNode; last?: boolean;
}> = ({ label, desc, children, last }) => (
  <Box sx={{
    py: 2.5,
    borderBottom: last ? 'none' : '1px solid',
    borderColor: 'divider',
  }}>
    <Typography sx={{ fontWeight: 600, fontSize: '0.88rem', mb: 0.3 }}>{label}</Typography>
    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.78rem', mb: 1.5, lineHeight: 1.5 }}>{desc}</Typography>
    {children}
  </Box>
);

/** 프로바이더 카드 (마켓플레이스 그리드용) */
const ProviderCard: React.FC<{
  prov: { id: string; name: string; descKey: string; color: string; icon: React.ReactNode };
  isDark: boolean; t: any; count: number; onAdd: () => void;
}> = ({ prov, isDark, t, count, onAdd }) => {
  const bdr = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  return (
    <Paper elevation={0} onClick={onAdd}
      sx={{
        p: 2.5, border: `1px solid ${bdr}`, borderRadius: '12px',
        display: 'flex', flexDirection: 'column', gap: 1.5, cursor: 'pointer',
        transition: 'all 0.15s',
        '&:hover': { borderColor: alpha(prov.color, 0.5), transform: 'translateY(-1px)', boxShadow: `0 4px 16px ${alpha(prov.color, 0.1)}` },
      }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Avatar sx={{ width: 36, height: 36, backgroundColor: alpha(prov.color, isDark ? 0.2 : 0.08), color: prov.color, '& .MuiSvgIcon-root': { fontSize: 20 } }}>
          {prov.icon}
        </Avatar>
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: '0.85rem' }}>{prov.name}</Typography>
          {count > 0 && <Chip label={`${count} ${t('argus.settings.configured')}`} size="small"
            sx={{ height: 18, fontSize: '0.58rem', fontWeight: 600, backgroundColor: alpha('#4caf50', 0.1), color: '#4caf50', border: 'none', mt: 0.3 }} />}
        </Box>
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.73rem', lineHeight: 1.5, flex: 1 }}>
        {t(prov.descKey)}
      </Typography>
      <Button size="small" variant="contained" fullWidth startIcon={<AddIcon />}
        onClick={e => { e.stopPropagation(); onAdd(); }}
        sx={{
          mt: 'auto', borderRadius: '8px', textTransform: 'none', fontWeight: 600, fontSize: '0.78rem',
        }}
      >
        {t('argus.settings.addConnection')}
      </Button>
    </Paper>
  );
};

/** 연결된 아이템 (Integration / Tracker 공통) */
const ConnectedItem: React.FC<{
  isDark: boolean; color: string; icon: React.ReactNode;
  title: string; subtitle: string; chipLabel?: string;
  active: boolean; t: any;
  onToggle?: () => void; onTest?: () => void; onDelete: () => void;
}> = ({ isDark, color, icon, title, subtitle, chipLabel, active, t, onToggle, onTest, onDelete }) => {
  const bdr = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  return (
    <Paper elevation={0} sx={{
      p: 2, display: 'flex', alignItems: 'center', gap: 2,
      border: `1px solid ${bdr}`, borderRadius: '10px',
    }}>
      <Avatar sx={{ width: 32, height: 32, backgroundColor: alpha(color, isDark ? 0.2 : 0.08), color }}>
        {icon}
      </Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography sx={{ fontWeight: 600, fontSize: '0.85rem' }} noWrap>{title}</Typography>
          {chipLabel && <Chip label={chipLabel} size="small" sx={{ height: 20, fontSize: '0.6rem', fontWeight: 700, backgroundColor: alpha(color, 0.1), color, border: 'none' }} />}
        </Box>
        <Typography variant="caption" color="text.secondary" noWrap>{subtitle}</Typography>
      </Box>
      {onTest && (
        <Tooltip title={t('argus.settings.testConnection')}><IconButton size="small" onClick={onTest}
          sx={{ '&:hover': { color: '#4caf50' } }}><TestConnectionIcon fontSize="small" /></IconButton></Tooltip>
      )}
      {onToggle && (
        <Chip label={active ? t('common.active') : t('common.inactive')} size="small" onClick={onToggle}
          sx={{ height: 22, fontWeight: 600, fontSize: '0.7rem', cursor: 'pointer', backgroundColor: alpha(active ? '#4caf50' : '#9e9e9e', 0.12), color: active ? '#4caf50' : '#9e9e9e', border: 'none' }} />
      )}
      {!onToggle && <StatusBadge active={active} t={t} />}
      <IconButton size="small" color="error" onClick={onDelete}><DeleteIcon fontSize="small" /></IconButton>
    </Paper>
  );
};

/** 설정 다이얼로그 (Integration + Tracker 공통) */
const ConfigDialog: React.FC<{
  open: boolean; onClose: () => void;
  provider: { name: string; color: string; icon: React.ReactNode; descKey: string } | null;
  fields: ProviderFieldDef[];
  formData: Record<string, string>; setFormData: (d: Record<string, string>) => void;
  onSubmit: () => void; submitDisabled: boolean;
  isDark: boolean; t: any; inpSx: any;
}> = ({ open, onClose, provider, fields, formData, setFormData, onSubmit, submitDisabled, isDark, t, inpSx }) => {
  const [visibleFields, setVisibleFields] = useState<Record<string, boolean>>({});
  if (!provider) return null;
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '14px' } }}>
      <DialogTitle sx={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 1.5, pb: 1 }}>
        <Avatar sx={{ width: 28, height: 28, backgroundColor: alpha(provider.color, 0.1), color: provider.color }}>{provider.icon}</Avatar>
        {t('argus.settings.configure')} {provider.name}
        <Box sx={{ flex: 1 }} />
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, fontSize: '0.8rem' }}>{t(provider.descKey)}</Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {fields.map(f => {
            const isSecret = f.type === 'password';
            const showPlain = visibleFields[f.key];
            
            if (f.type === 'select') {
              return (
                <FormControl key={f.key} size="small" fullWidth sx={inpSx}>
                  <InputLabel>{t(f.labelKey)}</InputLabel>
                  <Select
                    value={formData[f.key] || ''}
                    label={t(f.labelKey)}
                    onChange={e => setFormData({ ...formData, [f.key]: e.target.value })}
                  >
                    {f.options?.map(opt => (
                      <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              );
            }

            return (
              <TextField key={f.key} size="small" fullWidth label={t(f.labelKey)} placeholder={f.placeholder}
                type={isSecret && !showPlain ? 'password' : 'text'} value={formData[f.key] || ''}
                onChange={e => setFormData({ ...formData, [f.key]: e.target.value })} sx={inpSx}
                InputProps={isSecret ? {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setVisibleFields(v => ({ ...v, [f.key]: !v[f.key] }))} edge="end">
                        {showPlain ? <VisibilityOffIcon sx={{ fontSize: 18 }} /> : <VisibilityIcon sx={{ fontSize: 18 }} />}
                      </IconButton>
                    </InputAdornment>
                  ),
                } : undefined}
              />
            );
          })}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} sx={{ textTransform: 'none', color: 'text.secondary' }}>{t('common.cancel')}</Button>
        <Button variant="contained" onClick={onSubmit} disabled={submitDisabled}
          sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '8px', px: 3 }}>{t('common.add')}</Button>
      </DialogActions>
    </Dialog>
  );
};

/** 샘플링 비율 프로그레스 바 — 마우스 드래그로 설정 */
const RateBar: React.FC<{ value: number; onChange: (v: number) => void; isDark: boolean }> = ({ value, onChange, isDark }) => {
  const barRef = React.useRef<HTMLDivElement>(null);
  const pct = Math.round(value * 100);
  const color = '#7c4dff';

  const calcValue = (clientX: number) => {
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onChange(Math.round(ratio * 100) / 100);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    calcValue(e.clientX);
    const onMove = (ev: MouseEvent) => calcValue(ev.clientX);
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <Box ref={barRef} onMouseDown={handleMouseDown}
      sx={{
        maxWidth: 400, width: '100%', height: 32, borderRadius: '6px', cursor: 'ew-resize',
        backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
        position: 'relative', overflow: 'hidden', userSelect: 'none',
        '&:hover': { boxShadow: `0 0 0 2px ${alpha(color, 0.3)}` },
      }}>
      <Box sx={{
        position: 'absolute', left: 0, top: 0, bottom: 0,
        width: `${pct}%`, borderRadius: '6px',
        background: `linear-gradient(90deg, ${alpha(color, 0.4)}, ${alpha(color, 0.2)})`,
        transition: 'none',
      }} />
      <Typography sx={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize: '0.82rem', color: isDark ? '#fff' : '#333',
        pointerEvents: 'none',
      }}>
        {pct}%
      </Typography>
    </Box>
  );
};

const StatusBadge: React.FC<{ active: boolean; t: any }> = ({ active, t }) => (
  <Chip
    icon={active ? <CheckIcon sx={{ fontSize: '14px !important' }} /> : <CancelIcon sx={{ fontSize: '14px !important' }} />}
    label={active ? t('common.active') : t('common.inactive')} size="small"
    sx={{ height: 22, fontWeight: 600, fontSize: '0.7rem', backgroundColor: alpha(active ? '#4caf50' : '#9e9e9e', 0.12), color: active ? '#4caf50' : '#9e9e9e', border: 'none', '& .MuiChip-icon': { color: active ? '#4caf50' : '#9e9e9e' } }}
  />
);

const EmptyState: React.FC<{ icon: React.ReactNode; text: string; hint?: string }> = ({ icon, text, hint }) => (
  <Box sx={{ py: 5, textAlign: 'center' }}>
    <Box sx={{ mb: 1.5, '& .MuiSvgIcon-root': { fontSize: 44, color: 'text.disabled' } }}>{icon}</Box>
    <Typography color="text.secondary" sx={{ fontSize: '0.85rem' }}>{text}</Typography>
    {hint && <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5, display: 'block' }}>{hint}</Typography>}
  </Box>
);

const Spinner: React.FC = () => <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>;

const CodeBlock: React.FC<{ title: string; language: string; code: string; isDark: boolean }> = ({ title, language, code, isDark }) => {
  const { t } = useTranslation();
  return (
  <Paper elevation={0} sx={{ border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, borderRadius: '10px', overflow: 'hidden' }}>
    <Box sx={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 0.8,
      backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
      borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
    }}>
      <Typography sx={{ fontWeight: 600, fontSize: '0.75rem' }}>{title}</Typography>
      <CopyButton text={code} size={14} />
    </Box>
    {/* @ts-expect-error react-syntax-highlighter type incompatibility with React 18 */}
    <SyntaxHighlighter language={language} style={isDark ? vscDarkPlus : oneLight}
      customStyle={{ margin: 0, padding: '16px', fontSize: '0.78rem', lineHeight: 1.6, borderRadius: 0, background: isDark ? '#1a1a2e' : '#fafafa' }}
      showLineNumbers={false}>{code}</SyntaxHighlighter>
  </Paper>
  );
};

export default ArgusSettingsPage;
