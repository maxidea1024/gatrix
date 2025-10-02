import React from 'react';
import {
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  Settings as SettingsIcon,
  Security as SecurityIcon,
  History as HistoryIcon,
  Timeline as TimelineIcon,
  BugReport as BugReportIcon,
  CloudSync as CloudSyncIcon,
  VpnKey as VpnKeyIcon,
  Terminal as TerminalIcon,
  Chat as ChatIcon,
  Widgets as WidgetsIcon,
  Language as LanguageIcon,
  Build as BuildIcon,
  TextFields as TextIcon,
  Schedule as ScheduleIcon,
  Work as JobIcon,
  Monitor as MonitorIcon,
  Label as LabelIcon,
} from '@mui/icons-material';

export interface MenuItem {
  text: string;
  icon: React.ReactElement;
  path: string;
  adminOnly?: boolean;
}

// 기본 메뉴 (모든 사용자)
export const baseMenuItems: MenuItem[] = [
  { text: 'sidebar.dashboard', icon: <DashboardIcon />, path: '/dashboard' },
  { text: 'sidebar.chat', icon: <ChatIcon />, path: '/chat' },
];

// 관리자 메뉴
export const adminMenuItems: MenuItem[] = [
  { text: 'sidebar.userManagement', icon: <PeopleIcon />, path: '/admin/users', adminOnly: true },
  { text: 'sidebar.clientVersions', icon: <WidgetsIcon />, path: '/admin/client-versions', adminOnly: true },
  { text: 'sidebar.gameWorlds', icon: <LanguageIcon />, path: '/admin/game-worlds', adminOnly: true },
  { text: 'sidebar.maintenance', icon: <BuildIcon />, path: '/admin/maintenance', adminOnly: true },
  { text: 'sidebar.maintenanceTemplates', icon: <TextIcon />, path: '/admin/maintenance-templates', adminOnly: true },
  { text: 'sidebar.scheduler', icon: <ScheduleIcon />, path: '/admin/scheduler', adminOnly: true },
  { text: 'sidebar.jobs', icon: <JobIcon />, path: '/admin/jobs', adminOnly: true },
  { text: 'sidebar.queueMonitor', icon: <MonitorIcon />, path: '/admin/queue-monitor', adminOnly: true },
  { text: 'sidebar.whitelist', icon: <SecurityIcon />, path: '/admin/whitelist', adminOnly: true },
  { text: 'sidebar.auditLogs', icon: <HistoryIcon />, path: '/admin/audit-logs', adminOnly: true },
  { text: 'sidebar.realtimeEvents', icon: <TimelineIcon />, path: '/admin/realtime-events', adminOnly: true },
  { text: 'sidebar.crashes', icon: <BugReportIcon />, path: '/admin/crashes', adminOnly: true },
  { text: 'sidebar.remoteConfig', icon: <CloudSyncIcon />, path: '/admin/remote-config', adminOnly: true },
  { text: 'sidebar.apiTokens', icon: <VpnKeyIcon />, path: '/admin/api-tokens', adminOnly: true },
  { text: 'sidebar.console', icon: <TerminalIcon />, path: '/admin/console', adminOnly: true },
];

// 설정 메뉴
export const settingsMenuItems: MenuItem[] = [
  { text: 'settings.general.title', icon: <SettingsIcon />, path: '/settings' },
  { text: 'tags.title', icon: <LabelIcon />, path: '/settings/tags' },
];

// 모든 메뉴를 가져오는 함수
export const getAllMenuItems = (isAdmin: boolean): MenuItem[] => {
  if (isAdmin) {
    return [...baseMenuItems, ...adminMenuItems];
  }
  return baseMenuItems;
};

// Sidebar.tsx용 NavItem 타입과 호환되는 변환 함수
export interface NavItem {
  id: string;
  label: string;
  icon?: string;
  path?: string;
  children?: NavItem[];
  roles?: string[];
}

// MenuItem을 NavItem으로 변환
export const menuItemToNavItem = (item: MenuItem): NavItem => {
  // 아이콘 이름 추출 (예: <DashboardIcon /> -> 'Dashboard')
  const iconName = item.icon.type.name?.replace('Icon', '') || 'Dashboard';
  
  return {
    id: item.path.replace(/\//g, '-').replace(/^-/, ''),
    label: item.text,
    icon: iconName,
    path: item.path,
    roles: item.adminOnly ? ['admin'] : undefined,
  };
};

// Sidebar.tsx용 네비게이션 아이템 생성
export const getNavigationItems = (isAdmin: boolean): NavItem[] => {
  const items = getAllMenuItems(isAdmin);
  return items.map(menuItemToNavItem);
};

