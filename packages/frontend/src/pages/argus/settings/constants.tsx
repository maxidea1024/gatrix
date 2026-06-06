import React from 'react';
import {
  Settings as SettingsIcon,
  Tune as TuneIcon,
  VpnKey as KeyIcon,
  Code as CodeIcon,
  UploadFile as UploadIcon,
  GitHub as GitHubIcon,
  Notifications as NotificationsIcon,
  BugReport as BugIcon,
  Security as SecurityIcon,
} from '@mui/icons-material';

export const PLATFORM_OPTIONS = [
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

export const PLATFORM_CATEGORIES = [
  ...new Set(PLATFORM_OPTIONS.map((p) => p.category)),
];

export type SectionId =
  | 'general'
  | 'sampling'
  | 'dsn-keys'
  | 'sdk-setup'
  | 'source-maps'
  | 'integrations'
  | 'notifications'
  | 'issue-trackers'
  | 'ownership';

export interface NavItem {
  id: SectionId;
  labelKey: string;
  icon: React.ReactNode;
}

export interface NavGroup {
  labelKey: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    labelKey: 'argus.settings.groupProject',
    items: [
      {
        id: 'general',
        labelKey: 'argus.settings.general',
        icon: <SettingsIcon sx={{ fontSize: 18 }} />,
      },
      {
        id: 'sampling',
        labelKey: 'argus.settings.samplingQuotas',
        icon: <TuneIcon sx={{ fontSize: 18 }} />,
      },
    ],
  },
  {
    labelKey: 'argus.settings.groupSdk',
    items: [
      {
        id: 'dsn-keys',
        labelKey: 'argus.settings.dsnKeys',
        icon: <KeyIcon sx={{ fontSize: 18 }} />,
      },
      {
        id: 'sdk-setup',
        labelKey: 'argus.settings.sdkSetup',
        icon: <CodeIcon sx={{ fontSize: 18 }} />,
      },
      {
        id: 'source-maps',
        labelKey: 'argus.settings.sourceMaps',
        icon: <UploadIcon sx={{ fontSize: 18 }} />,
      },
    ],
  },
  {
    labelKey: 'argus.settings.groupIntegrations',
    items: [
      {
        id: 'integrations',
        labelKey: 'argus.settings.integrations',
        icon: <GitHubIcon sx={{ fontSize: 18 }} />,
      },
      {
        id: 'notifications',
        labelKey: 'argus.settings.notifications',
        icon: <NotificationsIcon sx={{ fontSize: 18 }} />,
      },
      {
        id: 'issue-trackers',
        labelKey: 'argus.settings.issueTrackers',
        icon: <BugIcon sx={{ fontSize: 18 }} />,
      },
      {
        id: 'ownership',
        labelKey: 'argus.settings.ownership',
        icon: <SecurityIcon sx={{ fontSize: 18 }} />,
      },
    ],
  },
];
