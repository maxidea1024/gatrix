import React from 'react';
import {
  BugReport as BugIcon,
  Speed as FrequencyIcon,
  People as UsersIcon,
  Refresh as RegressionIcon,
  Feedback as FeedbackIcon,
  FilterList as FilterIcon,
  PriorityHigh as PriorityIcon,
  ShowChart as MetricIcon,
  Webhook as WebhookIcon,
  Email as EmailIcon,
  Chat as SlackIcon,
  Assignment as JiraIcon,
  ViewKanban as LinearIcon,
  NotificationsActive as PagerDutyIcon,
} from '@mui/icons-material';
import { ArgusAlertCondition, ArgusAlertAction } from '@/services/argusService';

export const getConditionTypes = (
  t: (key: string) => string
): {
  value: ArgusAlertCondition['type'];
  label: string;
  desc: string;
  icon: React.ReactElement;
  color: string;
}[] => [
  {
    value: 'new_issue',
    label: t('argus.alerts.condNewIssue'),
    desc: t('argus.alerts.condNewIssueDesc'),
    icon: <BugIcon sx={{ fontSize: 18 }} />,
    color: '#f44336',
  },
  {
    value: 'event_frequency',
    label: t('argus.alerts.condEventFreq'),
    desc: t('argus.alerts.condEventFreqDesc'),
    icon: <FrequencyIcon sx={{ fontSize: 18 }} />,
    color: '#ff9800',
  },
  {
    value: 'user_count',
    label: t('argus.alerts.condUserCount'),
    desc: t('argus.alerts.condUserCountDesc'),
    icon: <UsersIcon sx={{ fontSize: 18 }} />,
    color: '#2196f3',
  },
  {
    value: 'regression',
    label: t('argus.alerts.condRegression'),
    desc: t('argus.alerts.condRegressionDesc'),
    icon: <RegressionIcon sx={{ fontSize: 18 }} />,
    color: '#9c27b0',
  },
  {
    value: 'new_feedback',
    label: t('argus.alerts.condNewFeedback'),
    desc: t('argus.alerts.condNewFeedbackDesc'),
    icon: <FeedbackIcon sx={{ fontSize: 18 }} />,
    color: '#00bcd4',
  },
  {
    value: 'property_match',
    label: t('argus.alerts.condPropMatch') || 'Event Property Match',
    desc:
      t('argus.alerts.condPropMatchDesc') ||
      'Matches an event property (platform, url, etc.)',
    icon: <FilterIcon sx={{ fontSize: 18 }} />,
    color: '#3f51b5',
  },
  {
    value: 'high_priority_issue',
    label: t('argus.alerts.condHighPriority'),
    desc: t('argus.alerts.condHighPriorityDesc'),
    icon: <PriorityIcon sx={{ fontSize: 18 }} />,
    color: '#e91e63',
  },
  {
    value: 'project_error_rate',
    label: t('argus.alerts.condMetric') || 'Project Error Rate',
    desc:
      t('argus.alerts.condMetricDesc') || 'Global error rate exceeds threshold',
    icon: <MetricIcon sx={{ fontSize: 18 }} />,
    color: '#f44336',
  },
];

export const getActionTypes = (
  t: (key: string) => string
): {
  value: ArgusAlertAction['type'];
  label: string;
  icon: React.ReactElement;
  color: string;
}[] => [
  {
    value: 'webhook',
    label: t('argus.alerts.webhook'),
    icon: <WebhookIcon sx={{ fontSize: 18 }} />,
    color: '#7c4dff',
  },
  {
    value: 'email',
    label: t('argus.alerts.email'),
    icon: <EmailIcon sx={{ fontSize: 18 }} />,
    color: '#00bcd4',
  },
  {
    value: 'slack',
    label: 'Slack App',
    icon: <SlackIcon sx={{ fontSize: 18 }} />,
    color: '#36C5F0',
  },
  {
    value: 'jira',
    label: 'Jira Software',
    icon: <JiraIcon sx={{ fontSize: 18 }} />,
    color: '#0052cc',
  },
  {
    value: 'linear',
    label: 'Linear',
    icon: <LinearIcon sx={{ fontSize: 18 }} />,
    color: '#5e6ad2',
  },
  {
    value: 'pagerduty',
    label: 'PagerDuty',
    icon: <PagerDutyIcon sx={{ fontSize: 18 }} />,
    color: '#06ac38',
  },
];

export const getIntervals = (t: (key: string) => string) => [
  { value: 60, label: t('argus.alerts.1min') },
  { value: 300, label: t('argus.alerts.5min') },
  { value: 900, label: t('argus.alerts.15min') },
  { value: 1800, label: t('argus.alerts.30min') },
  { value: 3600, label: t('argus.alerts.1hour') },
  { value: 86400, label: t('argus.alerts.1day') },
];

export const getFrequencies = (t: (key: string) => string) => [
  { value: 60, label: t('argus.alerts.1min') },
  { value: 300, label: t('argus.alerts.5min') },
  { value: 900, label: t('argus.alerts.15min') },
  { value: 3600, label: t('argus.alerts.1hour') },
  { value: 86400, label: t('argus.alerts.1day') },
];
