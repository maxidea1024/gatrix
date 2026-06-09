import React from 'react';
import {
  GitHub as GitHubIcon,
  Cloud as GitLabIcon,
  Storage as BitbucketIcon,
  Chat as SlackIcon,
} from '@mui/icons-material';

export interface StepDef {
  titleKey: string;
  subtitleKey: string;
  icon: string;
}

export const PROVIDER_CONFIG = {
  github: {
    name: 'GitHub',
    color: '#24292f',
    accentColor: '#58a6ff',
    gradient:
      'linear-gradient(160deg, #0d1117 0%, #161b22 30%, #1a2332 60%, #0f2540 100%)',
    icon: <GitHubIcon />,
    settingsUrl: 'https://github.com/settings/apps/new',
    titleKey: 'argus.settings.githubWizard.title',
    subtitleKey: 'argus.settings.githubWizard.subtitle',
    saveKey: 'argus.settings.githubWizard.saveConfig',
    steps: [
      {
        titleKey: 'argus.settings.githubWizard.step1Title',
        subtitleKey: 'argus.settings.githubWizard.step1Subtitle',
        icon: '🚀',
      },
      {
        titleKey: 'argus.settings.githubWizard.step2Title',
        subtitleKey: 'argus.settings.githubWizard.step2Subtitle',
        icon: '🔗',
      },
      {
        titleKey: 'argus.settings.githubWizard.step3Title',
        subtitleKey: 'argus.settings.githubWizard.step3Subtitle',
        icon: '🔐',
      },
      {
        titleKey: 'argus.settings.githubWizard.step4Title',
        subtitleKey: 'argus.settings.githubWizard.step4Subtitle',
        icon: '🔑',
      },
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
      {
        titleKey: 'argus.settings.gitlabWizard.step1Title',
        subtitleKey: 'argus.settings.gitlabWizard.step1Subtitle',
        icon: '🚀',
      },
      {
        titleKey: 'argus.settings.gitlabWizard.step2Title',
        subtitleKey: 'argus.settings.gitlabWizard.step2Subtitle',
        icon: '🔗',
      },
      {
        titleKey: 'argus.settings.gitlabWizard.step3Title',
        subtitleKey: 'argus.settings.gitlabWizard.step3Subtitle',
        icon: '🔐',
      },
      {
        titleKey: 'argus.settings.gitlabWizard.step4Title',
        subtitleKey: 'argus.settings.gitlabWizard.step4Subtitle',
        icon: '🔑',
      },
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
      {
        titleKey: 'argus.settings.bitbucketWizard.step1Title',
        subtitleKey: 'argus.settings.bitbucketWizard.step1Subtitle',
        icon: '🚀',
      },
      {
        titleKey: 'argus.settings.bitbucketWizard.step2Title',
        subtitleKey: 'argus.settings.bitbucketWizard.step2Subtitle',
        icon: '🔑',
      },
    ] as StepDef[],
  },
  slack: {
    name: 'Slack',
    color: '#4A154B',
    accentColor: '#36C5F0',
    gradient:
      'linear-gradient(160deg, #4A154B 0%, #3D1142 30%, #2D0E35 60%, #1A0A20 100%)',
    icon: <SlackIcon />,
    settingsUrl: 'https://api.slack.com/apps',
    titleKey: 'argus.settings.slackWizard.title',
    subtitleKey: 'argus.settings.slackWizard.subtitle',
    saveKey: 'argus.settings.slackWizard.saveConfig',
    steps: [
      {
        titleKey: 'argus.settings.slackWizard.step1Title',
        subtitleKey: 'argus.settings.slackWizard.step1Subtitle',
        icon: '🚀',
      },
      {
        titleKey: 'argus.settings.slackWizard.step2Title',
        subtitleKey: 'argus.settings.slackWizard.step2Subtitle',
        icon: '🔐',
      },
      {
        titleKey: 'argus.settings.slackWizard.step3Title',
        subtitleKey: 'argus.settings.slackWizard.step3Subtitle',
        icon: '🔑',
      },
    ] as StepDef[],
  },
};
