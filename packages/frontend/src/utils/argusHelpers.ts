/**
 * Argus shared utility functions and constants.
 * Centralised from ArgusIssuesPage / ArgusIssueDetailPage to be reusable
 * across all Argus components.
 */

import React from 'react';
import {
  ErrorOutline as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  KeyboardDoubleArrowUp as CriticalPriorityIcon,
  KeyboardArrowUp as HighPriorityIcon,
  Remove as MediumPriorityIcon,
  KeyboardArrowDown as LowPriorityIcon,
} from '@mui/icons-material';

// ─── Utility Functions ───────────────────────────────────────────────

/** Generate a stable color from a string (for avatars). */
export function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    '#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5',
    '#2196f3', '#00bcd4', '#009688', '#4caf50', '#ff9800',
  ];
  return colors[Math.abs(hash) % colors.length];
}

/** Get initials from a name (up to 2 chars). */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/** Format a date string as a relative time ("5 minutes ago", "2 days ago"). */
export function formatRelative(dateStr: string, t: (key: string, opts?: any) => string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(mins / 60);
    const days = Math.floor(hrs / 24);

    if (mins < 1) return t('common.time.justNow');
    if (mins < 60) return t('common.time.minutesAgo', { count: mins });
    if (hrs < 24) return t('common.time.hoursAgo', { count: hrs });
    if (days < 30) return t('common.time.daysAgo', { count: days });
    return d.toLocaleDateString();
  } catch {
    return dateStr;
  }
}

// ─── Level Config ────────────────────────────────────────────────────

/** Simple color-only map (kept for backward compat). */
export const LEVEL_COLORS: Record<string, string> = {
  fatal: '#f44336',
  error: '#ff5722',
  warning: '#ff9800',
  info: '#2196f3',
  debug: '#9e9e9e',
};

/** Rich level config with icon and background color for issue rows. */
export const LEVEL_CONFIG: Record<string, { color: string; icon: React.ReactElement; bg: string }> = {
  fatal: { color: '#f44336', icon: React.createElement(ErrorIcon, { sx: { fontSize: 16 } }), bg: 'rgba(244,67,54,0.08)' },
  error: { color: '#ff5722', icon: React.createElement(ErrorIcon, { sx: { fontSize: 16 } }), bg: 'rgba(255,87,34,0.08)' },
  warning: { color: '#ff9800', icon: React.createElement(WarningIcon, { sx: { fontSize: 16 } }), bg: 'rgba(255,152,0,0.08)' },
  info: { color: '#2196f3', icon: React.createElement(InfoIcon, { sx: { fontSize: 16 } }), bg: 'rgba(33,150,243,0.08)' },
  debug: { color: '#9e9e9e', icon: React.createElement(InfoIcon, { sx: { fontSize: 16 } }), bg: 'rgba(158,158,158,0.08)' },
};

// ─── Priority Config ─────────────────────────────────────────────────

export const PRIORITY_CONFIG: Record<string, { color: string; label: string; icon: React.ReactElement }> = {
  critical: { color: '#f44336', label: 'Critical', icon: React.createElement(CriticalPriorityIcon, { sx: { fontSize: 14 } }) },
  high: { color: '#ff5722', label: 'High', icon: React.createElement(HighPriorityIcon, { sx: { fontSize: 14 } }) },
  medium: { color: '#ff9800', label: 'Medium', icon: React.createElement(MediumPriorityIcon, { sx: { fontSize: 14 } }) },
  low: { color: '#2196f3', label: 'Low', icon: React.createElement(LowPriorityIcon, { sx: { fontSize: 14 } }) },
};

// ─── Issue Status Config ─────────────────────────────────────────────

export const ISSUE_STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  unresolved: { color: '#f44336', label: 'Unresolved' },
  resolved: { color: '#4caf50', label: 'Resolved' },
  ignored: { color: '#9e9e9e', label: 'Ignored' },
};
