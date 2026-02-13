/**
 * Menu Icon Mapping
 * Maps icon names (strings) to actual MUI Icon components
 * This allows menu configuration to use simple strings instead of JSX
 */
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
  AdminPanelSettings as AdminPanelSettingsIcon,
  Api as ApiIcon,
  Insights as InsightsIcon,
  Folder as FolderIcon,
  ViewCarousel as ViewCarouselIcon,
  Layers as LayersIcon,
  Storefront as StorefrontIcon,
  Flag as FlagIcon,
  Help as HelpIcon,
  HelpOutline as HelpOutlineIcon,
  Hub as HubIcon,
  SettingsSuggest as SettingsSuggestIcon,
  Category as CategoryIcon,
  Extension as ExtensionIcon,
  Code as CodeIcon,
  Phonelink as PhonelinkIcon,
  ShowChart as ShowChartIcon,
} from '@mui/icons-material';

// Icon name to component mapping
const ICON_MAP: Record<string, React.ReactElement> = {
  Dashboard: <DashboardIcon />,
  People: <PeopleIcon />,
  Settings: <SettingsIcon />,
  Security: <SecurityIcon />,
  History: <HistoryIcon />,
  Timeline: <TimelineIcon />,
  BugReport: <BugReportIcon />,
  CloudSync: <CloudSyncIcon />,
  VpnKey: <VpnKeyIcon />,
  Terminal: <TerminalIcon />,
  Chat: <ChatIcon />,
  Mail: <MailIcon />,
  Widgets: <WidgetsIcon />,
  Language: <LanguageIcon />,
  Build: <BuildIcon />,
  TextFields: <TextIcon />,
  Schedule: <ScheduleIcon />,
  Work: <JobIcon />,
  Monitor: <MonitorIcon />,
  Label: <LabelIcon />,
  CardGiftcard: <CardGiftcardIcon />,
  Announcement: <AnnouncementIcon />,
  Campaign: <CampaignIcon />,
  ConfirmationNumber: <ConfirmationNumberIcon />,
  Poll: <PollIcon />,
  SportsEsports: <SportsEsportsIcon />,
  Storage: <StorageIcon />,
  Event: <EventIcon />,
  Whatshot: <WhatshotIcon />,
  Celebration: <CelebrationIcon />,
  Dns: <DnsIcon />,
  Notifications: <NotificationsIcon />,
  AdminPanelSettings: <AdminPanelSettingsIcon />,
  Api: <ApiIcon />,
  Insights: <InsightsIcon />,
  Folder: <FolderIcon />,
  ViewCarousel: <ViewCarouselIcon />,
  Layers: <LayersIcon />,
  Storefront: <StorefrontIcon />,
  Flag: <FlagIcon />,
  Help: <HelpIcon />,
  HelpOutline: <HelpOutlineIcon />,
  Hub: <HubIcon />,
  SettingsSuggest: <SettingsSuggestIcon />,
  Category: <CategoryIcon />,
  Extension: <ExtensionIcon />,
  Code: <CodeIcon />,
  Phonelink: <PhonelinkIcon />,
  ShowChart: <ShowChartIcon />,
};

/**
 * Get icon component by name
 * Returns Dashboard icon as fallback if not found
 */
export function getIcon(name: string): React.ReactElement {
  return ICON_MAP[name] || ICON_MAP.Dashboard;
}

/**
 * Check if icon name is valid
 */
export function isValidIconName(name: string): boolean {
  return name in ICON_MAP;
}

/**
 * Get all available icon names
 */
export function getAvailableIcons(): string[] {
  return Object.keys(ICON_MAP);
}
