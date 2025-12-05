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
  Api as ApiIcon,
  Insights as InsightsIcon,
  Folder as FolderIcon,
  ViewCarousel as ViewCarouselIcon,
  Layers as LayersIcon,
} from '@mui/icons-material';
import { Permission, PERMISSIONS } from '@/types/permissions';

export interface MenuItem {
  text: string;
  icon: React.ReactElement;
  path?: string;
  adminOnly?: boolean;
  requiredPermission?: Permission | Permission[]; // Required permission(s) to view this menu item
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
  { text: 'settings.general.title', icon: <SettingsIcon />, path: '/settings' },
];

// 관리자 메뉴 - 관리자패널 카테고리
export const adminPanelMenuItems: MenuItem[] = [
  { text: 'sidebar.userManagement', icon: <PeopleIcon />, path: '/admin/users', adminOnly: true, requiredPermission: [PERMISSIONS.USERS_VIEW, PERMISSIONS.USERS_MANAGE] },
  { text: 'sidebar.clientVersions', icon: <WidgetsIcon />, path: '/admin/client-versions', adminOnly: true, requiredPermission: [PERMISSIONS.CLIENT_VERSIONS_VIEW, PERMISSIONS.CLIENT_VERSIONS_MANAGE] },
  { text: 'sidebar.gameWorlds', icon: <LanguageIcon />, path: '/admin/game-worlds', adminOnly: true, requiredPermission: [PERMISSIONS.GAME_WORLDS_VIEW, PERMISSIONS.GAME_WORLDS_MANAGE] },
  { text: 'sidebar.maintenance', icon: <BuildIcon />, path: '/admin/maintenance', adminOnly: true, requiredPermission: [PERMISSIONS.MAINTENANCE_VIEW, PERMISSIONS.MAINTENANCE_MANAGE] },
  { text: 'sidebar.maintenanceTemplates', icon: <TextIcon />, path: '/admin/maintenance-templates', adminOnly: true, requiredPermission: [PERMISSIONS.MAINTENANCE_TEMPLATES_VIEW, PERMISSIONS.MAINTENANCE_TEMPLATES_MANAGE] },
  {
    text: 'sidebar.scheduleManagement', icon: <ScheduleIcon />, adminOnly: true, requiredPermission: [PERMISSIONS.SCHEDULER_VIEW, PERMISSIONS.SCHEDULER_MANAGE], children: [
      { text: 'sidebar.scheduler', icon: <ScheduleIcon />, path: '/admin/scheduler', adminOnly: true, requiredPermission: [PERMISSIONS.SCHEDULER_VIEW, PERMISSIONS.SCHEDULER_MANAGE] },
      { text: 'sidebar.jobs', icon: <JobIcon />, path: '/admin/jobs', adminOnly: true, requiredPermission: [PERMISSIONS.SCHEDULER_VIEW, PERMISSIONS.SCHEDULER_MANAGE] },
      { text: 'sidebar.queueMonitor', icon: <MonitorIcon />, path: '/admin/queue-monitor', adminOnly: true, requiredPermission: [PERMISSIONS.SCHEDULER_VIEW, PERMISSIONS.SCHEDULER_MANAGE] },
    ]
  },
  { text: 'sidebar.auditLogs', icon: <HistoryIcon />, path: '/admin/audit-logs', adminOnly: true, requiredPermission: PERMISSIONS.AUDIT_LOGS_VIEW },
  { text: 'sidebar.realtimeEvents', icon: <TimelineIcon />, path: '/admin/realtime-events', adminOnly: true, requiredPermission: PERMISSIONS.REALTIME_EVENTS_VIEW },
  { text: 'sidebar.crashEvents', icon: <BugReportIcon />, path: '/admin/crash-events', adminOnly: true, requiredPermission: PERMISSIONS.CRASH_EVENTS_VIEW },
  { text: 'sidebar.remoteConfig', icon: <CloudSyncIcon />, path: '/admin/remote-config', adminOnly: true, requiredPermission: [PERMISSIONS.REMOTE_CONFIG_VIEW, PERMISSIONS.REMOTE_CONFIG_MANAGE] },
  {
    text: 'sidebar.security', icon: <SecurityIcon />, adminOnly: true, requiredPermission: [PERMISSIONS.SECURITY_VIEW, PERMISSIONS.SECURITY_MANAGE], children: [
      { text: 'sidebar.apiAccessTokens', icon: <VpnKeyIcon />, path: '/admin/api-tokens', adminOnly: true, requiredPermission: [PERMISSIONS.SECURITY_VIEW, PERMISSIONS.SECURITY_MANAGE] },
      { text: 'sidebar.whitelist', icon: <SecurityIcon />, path: '/admin/whitelist', adminOnly: true, requiredPermission: [PERMISSIONS.SECURITY_VIEW, PERMISSIONS.SECURITY_MANAGE] },
    ]
  },
  {
    text: 'sidebar.serverManagement', icon: <DnsIcon />, adminOnly: true, requiredPermission: [PERMISSIONS.SERVERS_VIEW, PERMISSIONS.SERVERS_MANAGE], children: [
      { text: 'sidebar.serverList', icon: <ServerIcon />, path: '/admin/server-list', adminOnly: true, requiredPermission: [PERMISSIONS.SERVERS_VIEW, PERMISSIONS.SERVERS_MANAGE] },
    ]
  },
  {
    text: 'sidebar.monitoring', icon: <MonitorIcon />, adminOnly: true, requiredPermission: PERMISSIONS.MONITORING_VIEW, children: [
      { text: 'sidebar.grafana', icon: <MonitorIcon />, path: '/admin/grafana-dashboard', adminOnly: true, requiredPermission: PERMISSIONS.MONITORING_VIEW },
      { text: 'sidebar.logs', icon: <MonitorIcon />, path: '/monitoring/logs', adminOnly: true, requiredPermission: PERMISSIONS.MONITORING_VIEW },
      { text: 'sidebar.alerts', icon: <NotificationsIcon />, path: '/monitoring/alerts', adminOnly: true, requiredPermission: PERMISSIONS.MONITORING_VIEW },
    ]
  },
  { text: 'sidebar.openApi', icon: <ApiIcon />, path: '/admin/open-api', adminOnly: true, requiredPermission: PERMISSIONS.OPEN_API_VIEW },
  { text: 'sidebar.console', icon: <TerminalIcon />, path: '/admin/console', adminOnly: true, requiredPermission: PERMISSIONS.CONSOLE_ACCESS },
];

// 게임관리 메뉴
export const gameMenuItems: MenuItem[] = [
  { text: 'sidebar.serviceNotices', icon: <AnnouncementIcon />, path: '/game/service-notices', adminOnly: true, requiredPermission: [PERMISSIONS.SERVICE_NOTICES_VIEW, PERMISSIONS.SERVICE_NOTICES_MANAGE] },
  { text: 'sidebar.ingamePopupNotices', icon: <NotificationsIcon />, path: '/game/ingame-popup-notices', adminOnly: true, requiredPermission: [PERMISSIONS.INGAME_POPUP_NOTICES_VIEW, PERMISSIONS.INGAME_POPUP_NOTICES_MANAGE] },
  {
    text: 'sidebar.coupons', icon: <ConfirmationNumberIcon />, adminOnly: true, requiredPermission: [PERMISSIONS.COUPONS_VIEW, PERMISSIONS.COUPONS_MANAGE], children: [
      { text: 'sidebar.couponSettings', icon: <SettingsIcon />, path: '/game/coupon-settings', adminOnly: true, requiredPermission: [PERMISSIONS.COUPONS_VIEW, PERMISSIONS.COUPONS_MANAGE] },
      { text: 'sidebar.couponUsage', icon: <HistoryIcon />, path: '/game/coupon-usage', adminOnly: true, requiredPermission: [PERMISSIONS.COUPONS_VIEW, PERMISSIONS.COUPONS_MANAGE] },
    ]
  },
  { text: 'sidebar.surveys', icon: <PollIcon />, path: '/game/surveys', adminOnly: true, requiredPermission: [PERMISSIONS.SURVEYS_VIEW, PERMISSIONS.SURVEYS_MANAGE] },
  {
    text: 'sidebar.operationEvents',
    icon: <EventIcon />,
    adminOnly: true,
    requiredPermission: [PERMISSIONS.OPERATION_EVENTS_VIEW, PERMISSIONS.OPERATION_EVENTS_MANAGE],
    children: [
      { text: 'sidebar.hotTimeButtonEvent', icon: <WhatshotIcon />, path: '/game/hot-time-button-event', adminOnly: true, requiredPermission: [PERMISSIONS.OPERATION_EVENTS_VIEW, PERMISSIONS.OPERATION_EVENTS_MANAGE] },
      { text: 'sidebar.liveEvent', icon: <CelebrationIcon />, path: '/game/live-event', adminOnly: true, requiredPermission: [PERMISSIONS.OPERATION_EVENTS_VIEW, PERMISSIONS.OPERATION_EVENTS_MANAGE] },
    ]
  },
  { text: 'sidebar.rewardTemplates', icon: <CardGiftcardIcon />, path: '/game/reward-templates', adminOnly: true, requiredPermission: [PERMISSIONS.REWARD_TEMPLATES_VIEW, PERMISSIONS.REWARD_TEMPLATES_MANAGE] },
  { text: 'sidebar.banners', icon: <ViewCarouselIcon />, path: '/game/banners', adminOnly: true, requiredPermission: [PERMISSIONS.BANNERS_VIEW, PERMISSIONS.BANNERS_MANAGE] },
  { text: 'sidebar.planningData', icon: <StorageIcon />, path: '/game/planning-data', adminOnly: true, requiredPermission: [PERMISSIONS.PLANNING_DATA_VIEW, PERMISSIONS.PLANNING_DATA_MANAGE] },
];

// 이벤트 렌즈 메뉴
export const eventLensMenuItems: MenuItem[] = [
  { text: 'sidebar.projects', icon: <FolderIcon />, path: '/admin/event-lens/projects', adminOnly: true, requiredPermission: [PERMISSIONS.EVENT_LENS_VIEW, PERMISSIONS.EVENT_LENS_MANAGE] },
];

// 설정 메뉴 - admin 전용
export const settingsMenuItems: MenuItem[] = [
  { text: 'settings.systemSettings', icon: <SettingsIcon />, path: '/settings/system', adminOnly: true, requiredPermission: [PERMISSIONS.SYSTEM_SETTINGS_VIEW, PERMISSIONS.SYSTEM_SETTINGS_MANAGE] },
  { text: 'tags.title', icon: <LabelIcon />, path: '/settings/tags', adminOnly: true, requiredPermission: [PERMISSIONS.TAGS_VIEW, PERMISSIONS.TAGS_MANAGE] },
  { text: 'sidebar.dataManagement', icon: <CloudSyncIcon />, path: '/admin/data-management', adminOnly: true, requiredPermission: [PERMISSIONS.DATA_MANAGEMENT_VIEW, PERMISSIONS.DATA_MANAGEMENT_MANAGE] },
  { text: 'environments.title', icon: <LayersIcon />, path: '/settings/environments', adminOnly: true, requiredPermission: [PERMISSIONS.ENVIRONMENTS_VIEW, PERMISSIONS.ENVIRONMENTS_MANAGE] },
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
        id: 'event-lens',
        text: 'sidebar.eventLens',
        icon: <InsightsIcon />,
        adminOnly: true,
        children: eventLensMenuItems,
      },
      {
        id: 'settings',
        text: 'sidebar.settings',
        icon: <SettingsIcon />,
        adminOnly: true,
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

