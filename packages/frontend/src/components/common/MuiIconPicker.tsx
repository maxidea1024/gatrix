import React, { useState, useMemo } from 'react';
import {
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  IconButton,
  Typography,
  Tooltip,
  useTheme,
  alpha,
  InputAdornment,
} from '@mui/material';
import {
  Close as CloseIcon,
  Search as SearchIcon,
  // Extended icon set for Quick Links
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  Settings as SettingsIcon,
  Security as SecurityIcon,
  History as HistoryIcon,
  Timeline as TimelineIcon,
  BugReport as BugReportIcon,
  Chat as ChatIcon,
  Mail as MailIcon,
  Widgets as WidgetsIcon,
  Language as LanguageIcon,
  Build as BuildIcon,
  Schedule as ScheduleIcon,
  Monitor as MonitorIcon,
  Label as LabelIcon,
  CardGiftcard as CardGiftcardIcon,
  Campaign as CampaignIcon,
  ConfirmationNumber as ConfirmationNumberIcon,
  Poll as PollIcon,
  SportsEsports as SportsEsportsIcon,
  Storage as StorageIcon,
  Event as EventIcon,
  Dns as DnsIcon,
  Notifications as NotificationsIcon,
  Api as ApiIcon,
  Folder as FolderIcon,
  Flag as FlagIcon,
  Hub as HubIcon,
  Category as CategoryIcon,
  Extension as ExtensionIcon,
  Code as CodeIcon,
  ShowChart as ShowChartIcon,
  Sensors as SensorsIcon,
  SmartToy as SmartToyIcon,
  Image as ImageIcon,
  GridOn as GridOnIcon,
  // Additional icons for user links
  Link as LinkIcon,
  Bookmark as BookmarkIcon,
  Star as StarIcon,
  Home as HomeIcon,
  Web as WebIcon,
  Cloud as CloudIcon,
  GitHub as GitHubIcon,
  Public as PublicIcon,
  School as SchoolIcon,
  Work as WorkIcon,
  Favorite as FavoriteIcon,
  Place as PlaceIcon,
  Movie as MovieIcon,
  MusicNote as MusicNoteIcon,
  PhotoCamera as PhotoCameraIcon,
  ShoppingCart as ShoppingCartIcon,
  LocalOffer as LocalOfferIcon,
  FlightTakeoff as FlightTakeoffIcon,
  Restaurant as RestaurantIcon,
  LocalCafe as LocalCafeIcon,
  Pets as PetsIcon,
  Bolt as BoltIcon,
  DataObject as DataObjectIcon,
  Terminal as TerminalIcon,
  Webhook as WebhookIcon,
  Speed as SpeedIcon,
  Analytics as AnalyticsIcon,
  AccountTree as AccountTreeIcon,
  Layers as LayersIcon,
  Palette as PaletteIcon,
  DesignServices as DesignServicesIcon,
  Description as DescriptionIcon,
  Assignment as AssignmentIcon,
  InsertDriveFile as InsertDriveFileIcon,
  Help as HelpIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as CheckCircleIcon,
  Verified as VerifiedIcon,
  Rocket as RocketIcon,
  Science as ScienceIcon,
  Psychology as PsychologyIcon,
  AutoAwesome as AutoAwesomeIcon,
  TravelExplore as TravelExploreIcon,
  Diversity3 as Diversity3Icon,
  ViewInAr as ViewInArIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

// Extended icon map for Quick Links picker
const QUICK_LINK_ICON_MAP: Record<string, React.ReactElement> = {
  Link: <LinkIcon />,
  Bookmark: <BookmarkIcon />,
  Star: <StarIcon />,
  Home: <HomeIcon />,
  Web: <WebIcon />,
  Cloud: <CloudIcon />,
  GitHub: <GitHubIcon />,
  Public: <PublicIcon />,
  Favorite: <FavoriteIcon />,
  // Development & Tech
  Dashboard: <DashboardIcon />,
  Code: <CodeIcon />,
  Terminal: <TerminalIcon />,
  Api: <ApiIcon />,
  DataObject: <DataObjectIcon />,
  Webhook: <WebhookIcon />,
  BugReport: <BugReportIcon />,
  Hub: <HubIcon />,
  AccountTree: <AccountTreeIcon />,
  Extension: <ExtensionIcon />,
  SmartToy: <SmartToyIcon />,
  // Analytics & Data
  ShowChart: <ShowChartIcon />,
  Analytics: <AnalyticsIcon />,
  Speed: <SpeedIcon />,
  Monitor: <MonitorIcon />,
  Timeline: <TimelineIcon />,
  Sensors: <SensorsIcon />,
  // Communication
  Chat: <ChatIcon />,
  Mail: <MailIcon />,
  Campaign: <CampaignIcon />,
  Notifications: <NotificationsIcon />,
  // Content & Files
  Folder: <FolderIcon />,
  Description: <DescriptionIcon />,
  Assignment: <AssignmentIcon />,
  InsertDriveFile: <InsertDriveFileIcon />,
  Image: <ImageIcon />,
  GridOn: <GridOnIcon />,
  // Gaming & Entertainment
  SportsEsports: <SportsEsportsIcon />,
  Movie: <MovieIcon />,
  MusicNote: <MusicNoteIcon />,
  PhotoCamera: <PhotoCameraIcon />,
  // Business & Commerce
  Work: <WorkIcon />,
  ShoppingCart: <ShoppingCartIcon />,
  LocalOffer: <LocalOfferIcon />,
  CardGiftcard: <CardGiftcardIcon />,
  ConfirmationNumber: <ConfirmationNumberIcon />,
  // Infrastructure
  Storage: <StorageIcon />,
  Dns: <DnsIcon />,
  Security: <SecurityIcon />,
  Layers: <LayersIcon />,
  Settings: <SettingsIcon />,
  Build: <BuildIcon />,
  // Design & Creative
  Palette: <PaletteIcon />,
  DesignServices: <DesignServicesIcon />,
  AutoAwesome: <AutoAwesomeIcon />,
  ViewInAr: <ViewInArIcon />,
  // Misc
  School: <SchoolIcon />,
  Science: <ScienceIcon />,
  Psychology: <PsychologyIcon />,
  Language: <LanguageIcon />,
  Schedule: <ScheduleIcon />,
  History: <HistoryIcon />,
  Label: <LabelIcon />,
  Widgets: <WidgetsIcon />,
  Flag: <FlagIcon />,
  Category: <CategoryIcon />,
  Poll: <PollIcon />,
  Event: <EventIcon />,
  People: <PeopleIcon />,
  Place: <PlaceIcon />,
  FlightTakeoff: <FlightTakeoffIcon />,
  Restaurant: <RestaurantIcon />,
  LocalCafe: <LocalCafeIcon />,
  Pets: <PetsIcon />,
  Bolt: <BoltIcon />,
  Help: <HelpIcon />,
  Info: <InfoIcon />,
  Warning: <WarningIcon />,
  Error: <ErrorIcon />,
  CheckCircle: <CheckCircleIcon />,
  Verified: <VerifiedIcon />,
  Rocket: <RocketIcon />,
  TravelExplore: <TravelExploreIcon />,
  Diversity3: <Diversity3Icon />,
};

/**
 * Get the Quick Link icon element for a given icon name.
 * Falls back to Link icon if not found.
 */
export function getQuickLinkIcon(name: string): React.ReactElement {
  return QUICK_LINK_ICON_MAP[name] || QUICK_LINK_ICON_MAP.Link;
}

/**
 * Get all available quick link icon names
 */
export function getQuickLinkIconNames(): string[] {
  return Object.keys(QUICK_LINK_ICON_MAP);
}

interface MuiIconPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (iconName: string) => void;
  selectedIcon?: string;
}

const MuiIconPicker: React.FC<MuiIconPickerProps> = ({
  open,
  onClose,
  onSelect,
  selectedIcon,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';
  const [search, setSearch] = useState('');

  const filteredIcons = useMemo(() => {
    const names = Object.keys(QUICK_LINK_ICON_MAP);
    if (!search.trim()) return names;
    const query = search.toLowerCase();
    return names.filter((name) => name.toLowerCase().includes(query));
  }, [search]);

  const handleSelect = (iconName: string) => {
    onSelect(iconName);
    onClose();
    setSearch('');
  };

  return (
    <Dialog
      open={open}
      onClose={() => {
        onClose();
        setSearch('');
      }}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          maxHeight: '70vh',
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pb: 1,
        }}
      >
        <Typography component="span" variant="h6" fontWeight={600} fontSize="1rem">
          {t('quickLinks.selectIcon')}
        </Typography>
        <IconButton
          size="small"
          onClick={() => {
            onClose();
            setSearch('');
          }}
          sx={{ color: 'text.disabled' }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: 0 }}>
        <TextField
          fullWidth
          size="small"
          placeholder={t('quickLinks.searchIcons')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 2 }}
          autoFocus
        />
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(8, 1fr)',
            gap: 0.5,
            maxHeight: 360,
            overflow: 'auto',
            '&::-webkit-scrollbar': { width: 4 },
            '&::-webkit-scrollbar-thumb': {
              bgcolor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
              borderRadius: 2,
            },
          }}
        >
          {filteredIcons.map((name) => {
            const isSelected = name === selectedIcon;
            return (
              <Tooltip key={name} title={name} arrow placement="top">
                <Box
                  onClick={() => handleSelect(name)}
                  sx={{
                    width: 44,
                    height: 44,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 1.5,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    border: isSelected
                      ? `2px solid ${theme.palette.primary.main}`
                      : '2px solid transparent',
                    bgcolor: isSelected
                      ? alpha(theme.palette.primary.main, 0.1)
                      : 'transparent',
                    color: isSelected
                      ? theme.palette.primary.main
                      : theme.palette.text.secondary,
                    '&:hover': {
                      bgcolor: isSelected
                        ? alpha(theme.palette.primary.main, 0.15)
                        : isDark
                          ? 'rgba(255,255,255,0.08)'
                          : 'rgba(0,0,0,0.04)',
                      color: isSelected
                        ? theme.palette.primary.main
                        : theme.palette.text.primary,
                    },
                    '& .MuiSvgIcon-root': {
                      fontSize: 22,
                    },
                  }}
                >
                  {QUICK_LINK_ICON_MAP[name]}
                </Box>
              </Tooltip>
            );
          })}
        </Box>
        {filteredIcons.length === 0 && (
          <Typography
            variant="body2"
            color="text.disabled"
            sx={{ textAlign: 'center', py: 4 }}
          >
            {t('quickLinks.noIconsFound')}
          </Typography>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MuiIconPicker;
