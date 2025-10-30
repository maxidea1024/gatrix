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
  Mail as MailIcon,
  Widgets as WidgetsIcon,
  Language as LanguageIcon,
  Build as BuildIcon,
  TextFields as TextIcon,
  Schedule as ScheduleIcon,
  Work as JobIcon,
  Monitor as MonitorIcon,
  Label as LabelIcon,
  CardGiftcard as CardGiftcardIcon,
  Announcement as AnnouncementIcon,
  Campaign as CampaignIcon,
  ConfirmationNumber as ConfirmationNumberIcon,
  Poll as PollIcon,
  SportsEsports as SportsEsportsIcon,
  Storage as StorageIcon,
  Event as EventIcon,
  Whatshot as WhatshotIcon,
  Celebration as CelebrationIcon,
  Dns as DnsIcon,
  Notifications as NotificationsIcon,
  AdminPanelSettings,
  Storage as ServerIcon,
} from '@mui/icons-material';

export interface MenuItem {
  text: string;
  icon: React.ReactElement;
  path?: string;
  adminOnly?: boolean;
  children?: MenuItem[];
  divider?: boolean; // Show divider before this item
}

export interface MenuCategory {
  id: string;
  text: string;
  icon: React.ReactElement;
  adminOnly?: boolean;
  children: MenuItem[];
}

// 기본 메뉴 (모든 사용자)
export const baseMenuItems: MenuItem[] = [
  { text: 'sidebar.dashboard', icon: <DashboardIcon />, path: '/dashboard' },
];

// 관리자 메뉴 - 관리자패널 카테고리
export const adminPanelMenuItems: MenuItem[] = [
  { text: 'sidebar.userManagement', icon: <PeopleIcon />, path: '/admin/users', adminOnly: true },
  { text: 'sidebar.clientVersions', icon: <WidgetsIcon />, path: '/admin/client-versions', adminOnly: true },
  { text: 'sidebar.gameWorlds', icon: <LanguageIcon />, path: '/admin/game-worlds', adminOnly: true },
  { text: 'sidebar.maintenance', icon: <BuildIcon />, path: '/admin/maintenance', adminOnly: true },
  { text: 'sidebar.maintenanceTemplates', icon: <TextIcon />, path: '/admin/maintenance-templates', adminOnly: true },
  { text: 'sidebar.scheduleManagement', icon: <ScheduleIcon />, adminOnly: true, children: [
    { text: 'sidebar.scheduler', icon: <ScheduleIcon />, path: '/admin/scheduler', adminOnly: true },
    { text: 'sidebar.jobs', icon: <JobIcon />, path: '/admin/jobs', adminOnly: true },
    { text: 'sidebar.queueMonitor', icon: <MonitorIcon />, path: '/admin/queue-monitor', adminOnly: true },
  ] },
  { text: 'sidebar.whitelist', icon: <SecurityIcon />, path: '/admin/whitelist', adminOnly: true },
  { text: 'sidebar.auditLogs', icon: <HistoryIcon />, path: '/admin/audit-logs', adminOnly: true },
  { text: 'sidebar.realtimeEvents', icon: <TimelineIcon />, path: '/admin/realtime-events', adminOnly: true },
  { text: 'sidebar.crashEvents', icon: <BugReportIcon />, path: '/admin/crash-events', adminOnly: true },
  { text: 'sidebar.remoteConfig', icon: <CloudSyncIcon />, path: '/admin/remote-config', adminOnly: true },
  { text: 'sidebar.apiTokens', icon: <VpnKeyIcon />, path: '/admin/api-tokens', adminOnly: true },
  { text: 'sidebar.console', icon: <TerminalIcon />, path: '/admin/console', adminOnly: true },
  { text: 'sidebar.serverManagement', icon: <DnsIcon />, adminOnly: true, children: [
    { text: 'sidebar.serverList', icon: <ServerIcon />, path: '/admin/server-list', adminOnly: true },
  ] },
];

// 게임관리 메뉴
export const gameMenuItems: MenuItem[] = [
  { text: 'sidebar.serviceNotices', icon: <AnnouncementIcon />, path: '/game/service-notices', adminOnly: true },
  { text: 'sidebar.ingamePopupNotices', icon: <NotificationsIcon />, path: '/game/ingame-popup-notices', adminOnly: true },
  { text: 'sidebar.coupons', icon: <ConfirmationNumberIcon />, adminOnly: true, children: [
    { text: 'sidebar.couponSettings', icon: <SettingsIcon />, path: '/game/coupon-settings', adminOnly: true },
    { text: 'sidebar.couponUsage', icon: <HistoryIcon />, path: '/game/coupon-usage', adminOnly: true },
  ] },
  { text: 'sidebar.surveys', icon: <PollIcon />, path: '/game/surveys', adminOnly: true },
  {
    text: 'sidebar.operationEvents',
    icon: <EventIcon />,
    adminOnly: true,
    children: [
      { text: 'sidebar.hotTimeButtonEvent', icon: <WhatshotIcon />, path: '/game/hot-time-button-event', adminOnly: true },
      { text: 'sidebar.liveEvent', icon: <CelebrationIcon />, path: '/game/live-event', adminOnly: true },
    ]
  },
  { text: 'sidebar.rewardTemplates', icon: <CardGiftcardIcon />, path: '/game/reward-templates', adminOnly: true },
  { text: 'sidebar.planningData', icon: <StorageIcon />, path: '/game/planning-data', adminOnly: true },
];

// 설정 메뉴
export const settingsMenuItems: MenuItem[] = [
  { text: 'settings.general.title', icon: <SettingsIcon />, path: '/settings' },
  { text: 'tags.title', icon: <LabelIcon />, path: '/settings/tags' },
];

// 메뉴 카테고리 구성
export const getMenuCategories = (isAdmin: boolean): MenuCategory[] => {
  const categories: MenuCategory[] = [
    {
      id: 'navigation',
      text: 'sidebar.navigation',
      icon: <DashboardIcon />,
      children: baseMenuItems,
    },
  ];

  if (isAdmin) {
    categories.push(
      {
        id: 'admin-panel',
        text: 'sidebar.adminPanel',
        icon: <AdminPanelSettings />,
        adminOnly: true,
        children: adminPanelMenuItems,
      },
      {
        id: 'game-management',
        text: 'sidebar.gameManagement',
        icon: <SportsEsportsIcon />,
        adminOnly: true,
        children: gameMenuItems,
      },
      {
        id: 'settings',
        text: 'sidebar.settings',
        icon: <SettingsIcon />,
        children: settingsMenuItems,
      }
    );
  }

  return categories;
};

// 기존 호환성을 위한 함수
export const getAllMenuItems = (isAdmin: boolean): MenuItem[] => {
  if (isAdmin) {
    return [...baseMenuItems, ...adminPanelMenuItems];
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
  divider?: boolean;
}

// MenuItem을 NavItem으로 변환 (재귀적)
export const menuItemToNavItem = (item: MenuItem, parentPath?: string): NavItem => {
  // 아이콘 이름 추출 (예: <DashboardIcon /> -> 'Dashboard')
  const iconName = item.icon.type.name?.replace('Icon', '') || 'Dashboard';

  // id 생성: path가 있으면 path 기반, 없으면 text 기반
  const id = item.path
    ? item.path.replace(/\//g, '-').replace(/^-/, '')
    : item.text.replace(/\./g, '-').toLowerCase();

  const navItem: NavItem = {
    id,
    label: item.text,
    icon: iconName,
    path: item.path,
    roles: item.adminOnly ? ['admin'] : undefined,
    divider: item.divider,
  };

  // 자식 메뉴가 있으면 재귀적으로 변환
  if (item.children && item.children.length > 0) {
    navItem.children = item.children.map(child => menuItemToNavItem(child, item.path));
  }

  return navItem;
};

// Sidebar.tsx용 네비게이션 아이템 생성
export const getNavigationItems = (isAdmin: boolean): NavItem[] => {
  const items = getAllMenuItems(isAdmin);
  return items.map(menuItemToNavItem);
};

