import React, { useEffect, useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActionArea,
  Grid,
  Paper,
  useTheme,
  Chip,
  Avatar,
  alpha,
  Skeleton,
  IconButton,
  Tooltip,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Badge,
} from '@mui/material';
import {
  People as PeopleIcon,
  PersonAdd as PersonAddIcon,
  Security as SecurityIcon,
  TrendingUp as TrendingUpIcon,
  Notifications as NotificationsIcon,
  Settings as SettingsIcon,
  Storage as StorageIcon,
  Build as BuildIcon,
  Campaign as CampaignIcon,
  Description as DescriptionIcon,
  Schedule as ScheduleIcon,
  VpnKey as VpnKeyIcon,
  History as HistoryIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  ArrowForward as ArrowForwardIcon,
  Speed as SpeedIcon,
  CloudQueue as CloudQueueIcon,
  Games as GamesIcon,
  Public as PublicIcon,
  EventNote as EventNoteIcon,
  CardGiftcard as CardGiftcardIcon,
  Poll as PollIcon,
  Image as ImageIcon,
  Timeline as TimelineIcon,
  OpenInNew as OpenInNewIcon,
  Refresh as RefreshIcon,
  Block as BlockIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { useUserStats } from '@/hooks/useSWR';
import api from '@/services/api';
import { useNavigate } from 'react-router-dom';
import { PERMISSIONS } from '@/types/permissions';

// Stats card component with modern design
interface StatsCardProps {
  title: string;
  value: number | string;
  icon: React.ReactElement;
  color: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
  subtitle?: string;
  onClick?: () => void;
  loading?: boolean;
  trend?: { value: number; isUp: boolean };
}

const StatsCard: React.FC<StatsCardProps> = ({ title, value, icon, color, subtitle, onClick, loading, trend }) => {
  const theme = useTheme();

  return (
    <Card
      sx={{
        height: '100%',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s ease-in-out',
        '&:hover': onClick ? {
          transform: 'translateY(-4px)',
          boxShadow: theme.shadows[8],
        } : {},
        position: 'relative',
        overflow: 'hidden',
      }}
      onClick={onClick}
    >
      <Box
        sx={{
          position: 'absolute',
          top: -20,
          right: -20,
          width: 100,
          height: 100,
          borderRadius: '50%',
          bgcolor: alpha(theme.palette[color].main, 0.1),
        }}
      />
      <CardContent sx={{ position: 'relative', zIndex: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="body2" color="text.secondary" fontWeight={500} gutterBottom>
              {title}
            </Typography>
            {loading ? (
              <Skeleton width={80} height={40} />
            ) : (
              <Typography variant="h4" component="div" fontWeight="bold" color={`${color}.main`}>
                {value}
              </Typography>
            )}
            {subtitle && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                {subtitle}
              </Typography>
            )}
            {trend && (
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 1, gap: 0.5 }}>
                <TrendingUpIcon
                  sx={{
                    fontSize: 16,
                    color: trend.isUp ? 'success.main' : 'error.main',
                    transform: trend.isUp ? 'none' : 'rotate(180deg)'
                  }}
                />
                <Typography variant="caption" color={trend.isUp ? 'success.main' : 'error.main'}>
                  {trend.value}%
                </Typography>
              </Box>
            )}
          </Box>
          <Avatar
            sx={{
              bgcolor: alpha(theme.palette[color].main, 0.15),
              color: `${color}.main`,
              width: 48,
              height: 48,
            }}
          >
            {icon}
          </Avatar>
        </Box>
        {onClick && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
            <ArrowForwardIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

// Quick action card component
interface QuickActionCardProps {
  title: string;
  description: string;
  icon: React.ReactElement;
  onClick: () => void;
  color?: string;
  badge?: number;
}

const QuickActionCard: React.FC<QuickActionCardProps> = ({ title, description, icon, onClick, color, badge }) => {
  const theme = useTheme();

  return (
    <Card
      sx={{
        cursor: 'pointer',
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: theme.shadows[4],
          '& .action-icon': {
            transform: 'scale(1.1)',
          }
        },
      }}
    >
      <CardActionArea onClick={onClick} sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Badge badgeContent={badge} color="error" max={99}>
            <Avatar
              className="action-icon"
              sx={{
                bgcolor: color || alpha(theme.palette.primary.main, 0.1),
                color: color ? 'white' : 'primary.main',
                transition: 'transform 0.2s ease-in-out',
              }}
            >
              {icon}
            </Avatar>
          </Badge>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" fontWeight={600} noWrap>
              {title}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {description}
            </Typography>
          </Box>
          <ArrowForwardIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
        </Box>
      </CardActionArea>
    </Card>
  );
};

// Recent activity item interface
interface RecentActivity {
  id: number;
  action: string;
  target: string;
  timestamp: string;
  userName?: string;
}

// Environment interface
interface Environment {
  id: string;
  environmentName: string;
  displayName: string;
  description?: string;
  color?: string;
}

// Environment data counts interface
interface EnvironmentDataCounts {
  templates: number;
  gameWorlds: number;
  segments: number;
  tags: number;
  vars: number;
  messageTemplates: number;
  serviceNotices: number;
  ingamePopups: number;
  surveys: number;
  coupons: number;
  banners: number;
  jobs: number;
  clientVersions: number;
  apiTokens: number;
  total: number;
}

interface EnvironmentWithCounts extends Environment {
  counts?: EnvironmentDataCounts;
  loading?: boolean;
}

const DashboardPage: React.FC = () => {
  const theme = useTheme();
  const { user, isAdmin, hasPermission } = useAuth();
  const { data: statsData, isLoading: statsLoading, mutate: refreshStats } = useUserStats();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isAdminUser = isAdmin();

  const [alertsSummary, setAlertsSummary] = useState<{ total: number; firing: number }>({
    total: 0,
    firing: 0,
  });
  const [alertsSummaryLoading, setAlertsSummaryLoading] = useState(false);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [environmentsWithCounts, setEnvironmentsWithCounts] = useState<EnvironmentWithCounts[]>([]);
  const [envCountsLoading, setEnvCountsLoading] = useState(false);

  // Map API response fields to local names
  const stats = {
    total: statsData?.totalUsers ?? 0,
    active: statsData?.activeUsers ?? 0,
    pending: statsData?.pendingUsers ?? 0,
    suspended: statsData?.suspendedUsers ?? 0,
    admins: statsData?.adminUsers ?? 0,
  };

  // Build quick actions based on permissions
  const quickActions = useMemo(() => {
    const actions: Array<{
      key: string;
      title: string;
      description: string;
      icon: React.ReactElement;
      path: string;
      permission?: string;
      badge?: number;
      color?: string;
    }> = [];

    // Admin Panel actions
    if (hasPermission(PERMISSIONS.USERS_VIEW)) {
      actions.push({
        key: 'users',
        title: t('sidebar.userManagement'),
        description: t('dashboard.quickActions.usersDesc'),
        icon: <PeopleIcon />,
        path: '/admin/users',
        badge: stats.pending > 0 ? stats.pending : undefined,
      });
    }

    if (hasPermission(PERMISSIONS.CLIENT_VERSIONS_VIEW)) {
      actions.push({
        key: 'clientVersions',
        title: t('sidebar.clientVersions'),
        description: t('dashboard.quickActions.clientVersionsDesc'),
        icon: <StorageIcon />,
        path: '/admin/client-versions',
      });
    }

    if (hasPermission(PERMISSIONS.GAME_WORLDS_VIEW)) {
      actions.push({
        key: 'gameWorlds',
        title: t('sidebar.gameWorlds'),
        description: t('dashboard.quickActions.gameWorldsDesc'),
        icon: <GamesIcon />,
        path: '/admin/game-worlds',
      });
    }

    if (hasPermission(PERMISSIONS.SERVERS_VIEW)) {
      actions.push({
        key: 'servers',
        title: t('sidebar.servers'),
        description: t('dashboard.quickActions.serversDesc'),
        icon: <CloudQueueIcon />,
        path: '/admin/servers',
      });
    }

    if (hasPermission(PERMISSIONS.MAINTENANCE_VIEW)) {
      actions.push({
        key: 'maintenance',
        title: t('sidebar.maintenance'),
        description: t('dashboard.quickActions.maintenanceDesc'),
        icon: <BuildIcon />,
        path: '/admin/maintenance',
      });
    }

    if (hasPermission(PERMISSIONS.SCHEDULER_VIEW)) {
      actions.push({
        key: 'scheduler',
        title: t('sidebar.scheduler'),
        description: t('dashboard.quickActions.schedulerDesc'),
        icon: <ScheduleIcon />,
        path: '/admin/scheduler',
      });
    }

    if (hasPermission(PERMISSIONS.REMOTE_CONFIG_VIEW)) {
      actions.push({
        key: 'remoteConfig',
        title: t('sidebar.remoteConfig'),
        description: t('dashboard.quickActions.remoteConfigDesc'),
        icon: <SettingsIcon />,
        path: '/admin/remote-config',
      });
    }

    // Game Management actions
    if (hasPermission(PERMISSIONS.SERVICE_NOTICES_VIEW)) {
      actions.push({
        key: 'serviceNotices',
        title: t('sidebar.serviceNotices'),
        description: t('dashboard.quickActions.serviceNoticesDesc'),
        icon: <CampaignIcon />,
        path: '/game/service-notices',
      });
    }

    if (hasPermission(PERMISSIONS.INGAME_POPUP_NOTICES_VIEW)) {
      actions.push({
        key: 'ingamePopupNotices',
        title: t('sidebar.ingamePopupNotices'),
        description: t('dashboard.quickActions.ingamePopupNoticesDesc'),
        icon: <NotificationsIcon />,
        path: '/game/ingame-popup-notices',
      });
    }

    if (hasPermission(PERMISSIONS.COUPONS_VIEW)) {
      actions.push({
        key: 'coupons',
        title: t('sidebar.coupons'),
        description: t('dashboard.quickActions.couponsDesc'),
        icon: <CardGiftcardIcon />,
        path: '/game/coupon-settings',
      });
    }

    if (hasPermission(PERMISSIONS.SURVEYS_VIEW)) {
      actions.push({
        key: 'surveys',
        title: t('sidebar.surveys'),
        description: t('dashboard.quickActions.surveysDesc'),
        icon: <PollIcon />,
        path: '/game/surveys',
      });
    }

    if (hasPermission(PERMISSIONS.OPERATION_EVENTS_VIEW)) {
      actions.push({
        key: 'operationEvents',
        title: t('sidebar.operationEvents'),
        description: t('dashboard.quickActions.operationEventsDesc'),
        icon: <EventNoteIcon />,
        path: '/game/operation-events',
      });
    }

    if (hasPermission(PERMISSIONS.BANNERS_VIEW)) {
      actions.push({
        key: 'banners',
        title: t('sidebar.banners'),
        description: t('dashboard.quickActions.bannersDesc'),
        icon: <ImageIcon />,
        path: '/game/banners',
      });
    }

    if (hasPermission(PERMISSIONS.PLANNING_DATA_VIEW)) {
      actions.push({
        key: 'planningData',
        title: t('sidebar.planningData'),
        description: t('dashboard.quickActions.planningDataDesc'),
        icon: <DescriptionIcon />,
        path: '/game/planning-data',
      });
    }

    // Security actions
    if (hasPermission(PERMISSIONS.SECURITY_VIEW)) {
      actions.push({
        key: 'security',
        title: t('sidebar.security'),
        description: t('dashboard.quickActions.securityDesc'),
        icon: <VpnKeyIcon />,
        path: '/admin/api-tokens',
      });
    }

    if (hasPermission(PERMISSIONS.AUDIT_LOGS_VIEW)) {
      actions.push({
        key: 'auditLogs',
        title: t('sidebar.auditLogs'),
        description: t('dashboard.quickActions.auditLogsDesc'),
        icon: <HistoryIcon />,
        path: '/admin/audit-logs',
      });
    }

    // Monitoring actions
    if (hasPermission(PERMISSIONS.MONITORING_VIEW)) {
      actions.push({
        key: 'monitoring',
        title: t('sidebar.monitoring'),
        description: t('dashboard.quickActions.monitoringDesc'),
        icon: <SpeedIcon />,
        path: '/admin/grafana-dashboard',
        color: alertsSummary.firing > 0 ? theme.palette.error.main : undefined,
        badge: alertsSummary.firing > 0 ? alertsSummary.firing : undefined,
      });
    }

    // Settings actions
    if (hasPermission(PERMISSIONS.ENVIRONMENTS_VIEW)) {
      actions.push({
        key: 'environments',
        title: t('sidebar.environments'),
        description: t('dashboard.quickActions.environmentsDesc'),
        icon: <PublicIcon />,
        path: '/settings/environments',
      });
    }

    return actions;
  }, [hasPermission, t, stats.pending, alertsSummary.firing, theme.palette.error.main]);

  // Load alerts summary
  useEffect(() => {
    if (!isAdminUser || !hasPermission(PERMISSIONS.MONITORING_VIEW)) {
      return;
    }

    let isMounted = true;

    const loadAlertsSummary = async () => {
      try {
        setAlertsSummaryLoading(true);

        const [totalRes, firingRes] = await Promise.all([
          api.get('/admin/monitoring/alerts', {
            params: { page: 1, limit: 1 },
          }),
          api.get('/admin/monitoring/alerts', {
            params: { page: 1, limit: 1, status: 'firing' },
          }),
        ]);

        if (!isMounted) return;

        setAlertsSummary({
          total: totalRes?.data?.pagination?.total || 0,
          firing: firingRes?.data?.pagination?.total || 0,
        });
      } catch {
        // Silently fail
      } finally {
        if (isMounted) setAlertsSummaryLoading(false);
      }
    };

    loadAlertsSummary();
    return () => { isMounted = false; };
  }, [isAdminUser, hasPermission]);

  // Load recent activities
  useEffect(() => {
    if (!isAdminUser || !hasPermission(PERMISSIONS.AUDIT_LOGS_VIEW)) {
      return;
    }

    let isMounted = true;

    const loadRecentActivities = async () => {
      try {
        setActivitiesLoading(true);
        const res = await api.get('/admin/audit-logs', {
          params: { page: 1, limit: 5 },
        });

        if (!isMounted) return;

        const logs = res?.data?.logs || [];
        setRecentActivities(logs.map((log: any) => ({
          id: log.id,
          action: log.action,
          target: log.details || log.targetType || '',
          timestamp: log.createdAt,
          userName: log.userName,
        })));
      } catch {
        // Silently fail
      } finally {
        if (isMounted) setActivitiesLoading(false);
      }
    };

    loadRecentActivities();
    return () => { isMounted = false; };
  }, [isAdminUser, hasPermission]);

  // Load environment data counts
  useEffect(() => {
    if (!isAdminUser) {
      return;
    }

    let isMounted = true;

    const loadEnvironmentCounts = async () => {
      try {
        setEnvCountsLoading(true);

        // First get user's accessible environments
        const [accessResponse, envsResponse] = await Promise.all([
          api.get('/admin/users/me/environments'),
          api.get('/admin/environments'),
        ]);

        if (!isMounted) return;

        const access = accessResponse?.data;
        const allEnvs: Environment[] = envsResponse?.data || [];

        // Filter to accessible environments
        const accessibleEnvs = access?.allowAllEnvironments
          ? allEnvs
          : allEnvs.filter((env: Environment) => access?.environmentIds?.includes(env.id));

        // Limit to first 4 environments for dashboard display
        const displayEnvs = accessibleEnvs.slice(0, 4);

        // Initialize with loading state
        setEnvironmentsWithCounts(displayEnvs.map((env: Environment) => ({ ...env, loading: true })));

        // Fetch counts for each environment
        const countsPromises = displayEnvs.map(async (env: Environment) => {
          try {
            const res = await api.get(`/admin/environments/${env.id}/related-data`);
            const rawData = res?.data?.relatedData;
            // Extract count from each { count, items } object
            const counts = rawData ? {
              templates: rawData.templates?.count ?? 0,
              gameWorlds: rawData.gameWorlds?.count ?? 0,
              segments: rawData.segments?.count ?? 0,
              tags: rawData.tags?.count ?? 0,
              vars: rawData.vars?.count ?? 0,
              messageTemplates: rawData.messageTemplates?.count ?? 0,
              serviceNotices: rawData.serviceNotices?.count ?? 0,
              ingamePopups: rawData.ingamePopups?.count ?? 0,
              surveys: rawData.surveys?.count ?? 0,
              coupons: rawData.coupons?.count ?? 0,
              banners: rawData.banners?.count ?? 0,
              jobs: rawData.jobs?.count ?? 0,
              clientVersions: rawData.clientVersions?.count ?? 0,
              apiTokens: rawData.apiTokens?.count ?? 0,
              total: rawData.total ?? 0,
            } : null;
            return {
              ...env,
              counts,
              loading: false,
            };
          } catch {
            return { ...env, counts: null, loading: false };
          }
        });

        const envsWithCounts = await Promise.all(countsPromises);
        if (isMounted) {
          setEnvironmentsWithCounts(envsWithCounts);
        }
      } catch {
        // Silently fail
      } finally {
        if (isMounted) setEnvCountsLoading(false);
      }
    };

    loadEnvironmentCounts();
    return () => { isMounted = false; };
  }, [isAdminUser]);

  // Get time-based greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t('dashboard.greetingMorning');
    if (hour < 18) return t('dashboard.greetingAfternoon');
    return t('dashboard.greetingEvening');
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      {/* Hero Section */}
      <Paper
        sx={{
          p: { xs: 3, md: 4 },
          mb: 4,
          background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
          borderRadius: 3,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: -50,
            right: -50,
            width: 200,
            height: 200,
            borderRadius: '50%',
            bgcolor: 'rgba(255,255,255,0.1)',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            bottom: -30,
            right: 100,
            width: 100,
            height: 100,
            borderRadius: '50%',
            bgcolor: 'rgba(255,255,255,0.05)',
          }}
        />
        <Box sx={{ position: 'relative', zIndex: 1, color: 'white' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
            <Box>
              <Typography variant="h4" fontWeight={700} gutterBottom>
                {getGreeting()}, {user?.name}!
              </Typography>
              <Typography variant="body1" sx={{ opacity: 0.9 }}>
                {isAdminUser ? t('dashboard.adminWelcome') : t('dashboard.userWelcome')}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Chip
                label={t(`roles.${user?.role}`)}
                sx={{
                  bgcolor: 'rgba(255, 255, 255, 0.2)',
                  color: 'white',
                  fontWeight: 600,
                  backdropFilter: 'blur(4px)',
                }}
              />
              <Chip
                icon={user?.status === 'active' ? <CheckCircleIcon sx={{ color: 'white !important' }} /> : <WarningIcon sx={{ color: 'white !important' }} />}
                label={t(`users.statuses.${user?.status}`)}
                sx={{
                  bgcolor: user?.status === 'active' ? 'rgba(76, 175, 80, 0.6)' : 'rgba(255, 152, 0, 0.6)',
                  color: 'white',
                  fontWeight: 600,
                  backdropFilter: 'blur(4px)',
                }}
              />
            </Box>
          </Box>
        </Box>
      </Paper>

      {/* Stats Section - Only for Admins with USERS_VIEW permission */}
      {isAdminUser && hasPermission(PERMISSIONS.USERS_VIEW) && (
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6" fontWeight={600}>
              {t('dashboard.systemOverview')}
            </Typography>
            <Tooltip title={t('common.refresh')}>
              <IconButton size="small" onClick={() => refreshStats()}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
          <Grid container spacing={2}>
            <Grid size={{ xs: 6, sm: 2.4 }}>
              <StatsCard
                title={t('dashboard.totalUsers')}
                value={stats.total}
                icon={<PeopleIcon />}
                color="primary"
                loading={statsLoading}
                onClick={() => navigate('/admin/users')}
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 2.4 }}>
              <StatsCard
                title={t('dashboard.activeUsers')}
                value={stats.active}
                icon={<TrendingUpIcon />}
                color="success"
                loading={statsLoading}
                onClick={() => navigate('/admin/users?status=active')}
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 2.4 }}>
              <StatsCard
                title={t('dashboard.pendingApproval')}
                value={stats.pending}
                icon={<PersonAddIcon />}
                color="warning"
                loading={statsLoading}
                subtitle={stats.pending > 0 ? t('dashboard.requiresAttention') : undefined}
                onClick={stats.pending > 0 ? () => navigate('/admin/users?status=pending') : undefined}
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 2.4 }}>
              <StatsCard
                title={t('dashboard.suspendedUsers')}
                value={stats.suspended}
                icon={<BlockIcon />}
                color="error"
                loading={statsLoading}
                onClick={stats.suspended > 0 ? () => navigate('/admin/users?status=suspended') : undefined}
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 2.4 }}>
              <StatsCard
                title={t('dashboard.administrators')}
                value={stats.admins}
                icon={<SecurityIcon />}
                color="info"
                loading={statsLoading}
                onClick={() => navigate('/admin/users?role=admin')}
              />
            </Grid>
          </Grid>
        </Box>
      )}

      {/* Monitoring Section - Only for Admins with MONITORING_VIEW permission */}
      {isAdminUser && hasPermission(PERMISSIONS.MONITORING_VIEW) && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
            {t('dashboard.monitoringOverview')}
          </Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <StatsCard
                title={t('dashboard.monitoringActiveAlerts')}
                value={alertsSummary.firing}
                icon={<WarningIcon />}
                color={alertsSummary.firing > 0 ? 'error' : 'success'}
                loading={alertsSummaryLoading}
                onClick={() => navigate('/monitoring/alerts?status=firing')}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <StatsCard
                title={t('dashboard.monitoringTotalAlerts')}
                value={alertsSummary.total}
                icon={<NotificationsIcon />}
                color="primary"
                loading={alertsSummaryLoading}
                onClick={() => navigate('/monitoring/alerts')}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <StatsCard
                title={t('dashboard.monitoringGrafanaCardTitle')}
                value={<OpenInNewIcon sx={{ fontSize: 28 }} />}
                icon={<TimelineIcon />}
                color="secondary"
                onClick={() => navigate('/admin/grafana-dashboard')}
              />
            </Grid>
          </Grid>
        </Box>
      )}

      {/* Environment Data Overview - Only for Admins */}
      {isAdminUser && environmentsWithCounts.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6" fontWeight={600}>
              {t('dashboard.environmentOverview')}
            </Typography>
            <Tooltip title={t('sidebar.environments')}>
              <IconButton size="small" onClick={() => navigate('/settings/environments')}>
                <OpenInNewIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
          <Grid container spacing={2}>
            {environmentsWithCounts.map((env) => (
              <Grid key={env.id} size={{ xs: 12, sm: 6, md: 3 }}>
                <Card
                  sx={{
                    height: '100%',
                    borderTop: `3px solid ${env.color || theme.palette.primary.main}`,
                    transition: 'all 0.2s ease-in-out',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: theme.shadows[4],
                    },
                  }}
                >
                  <CardContent sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          bgcolor: env.color || theme.palette.primary.main,
                          mr: 1,
                        }}
                      />
                      <Typography variant="subtitle2" fontWeight={600} noWrap>
                        {env.displayName || env.environmentName}
                      </Typography>
                    </Box>
                    {env.loading || envCountsLoading ? (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        <Skeleton width="80%" height={20} />
                        <Skeleton width="60%" height={20} />
                        <Skeleton width="70%" height={20} />
                      </Box>
                    ) : env.counts ? (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="caption" color="text.secondary">
                            {t('dashboard.envTemplates')}
                          </Typography>
                          <Typography variant="caption" fontWeight={600}>
                            {env.counts.templates}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="caption" color="text.secondary">
                            {t('dashboard.envGameWorlds')}
                          </Typography>
                          <Typography variant="caption" fontWeight={600}>
                            {env.counts.gameWorlds}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="caption" color="text.secondary">
                            {t('dashboard.envNotices')}
                          </Typography>
                          <Typography variant="caption" fontWeight={600}>
                            {env.counts.serviceNotices + env.counts.ingamePopups}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="caption" color="text.secondary">
                            {t('dashboard.envBanners')}
                          </Typography>
                          <Typography variant="caption" fontWeight={600}>
                            {env.counts.banners}
                          </Typography>
                        </Box>
                        <Divider sx={{ my: 0.5 }} />
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="caption" color="text.secondary" fontWeight={600}>
                            {t('dashboard.envTotal')}
                          </Typography>
                          <Typography variant="caption" fontWeight={700} color="primary.main">
                            {env.counts.total}
                          </Typography>
                        </Box>
                      </Box>
                    ) : (
                      <Typography variant="caption" color="text.secondary">
                        {t('dashboard.envNoData')}
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      <Grid container spacing={3}>
        {/* Quick Actions */}
        <Grid size={{ xs: 12, lg: 8 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                {t('dashboard.quickActionsTitle')}
              </Typography>
              <Grid container spacing={2}>
                {quickActions.slice(0, 8).map((action) => (
                  <Grid key={action.key} size={{ xs: 12, sm: 6 }}>
                    <QuickActionCard
                      title={action.title}
                      description={action.description}
                      icon={action.icon}
                      onClick={() => navigate(action.path)}
                      badge={action.badge}
                      color={action.color}
                    />
                  </Grid>
                ))}
              </Grid>
              {quickActions.length === 0 && (
                <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                  <Typography variant="body2">{t('dashboard.noQuickActions')}</Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Activity */}
        <Grid size={{ xs: 12, lg: 4 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6" fontWeight={600}>
                  {t('dashboard.recentActivity')}
                </Typography>
                {hasPermission(PERMISSIONS.AUDIT_LOGS_VIEW) && (
                  <Tooltip title={t('dashboard.viewAll')}>
                    <IconButton size="small" onClick={() => navigate('/admin/audit-logs')}>
                      <OpenInNewIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>

              {activitiesLoading ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {[1, 2, 3].map((i) => (
                    <Box key={i} sx={{ display: 'flex', gap: 2 }}>
                      <Skeleton variant="circular" width={40} height={40} />
                      <Box sx={{ flex: 1 }}>
                        <Skeleton width="60%" />
                        <Skeleton width="40%" />
                      </Box>
                    </Box>
                  ))}
                </Box>
              ) : recentActivities.length > 0 ? (
                <List disablePadding>
                  {recentActivities.map((activity, index) => (
                    <React.Fragment key={activity.id}>
                      <ListItem
                        disablePadding
                        sx={{ py: 1.5 }}
                      >
                        <ListItemIcon sx={{ minWidth: 40 }}>
                          <Avatar
                            sx={{
                              width: 32,
                              height: 32,
                              bgcolor: alpha(theme.palette.primary.main, 0.1),
                              color: 'primary.main',
                            }}
                          >
                            <EventNoteIcon sx={{ fontSize: 18 }} />
                          </Avatar>
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Typography variant="body2" fontWeight={500} noWrap>
                              {t(`auditLogs.actions.${activity.action}`, { defaultValue: activity.action })}
                            </Typography>
                          }
                          secondary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                              <Typography variant="caption" color="text.secondary">
                                {activity.userName}
                              </Typography>
                              <Typography variant="caption" color="text.disabled">•</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {new Date(activity.timestamp).toLocaleString()}
                              </Typography>
                            </Box>
                          }
                        />
                      </ListItem>
                      {index < recentActivities.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              ) : (
                <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                  <HistoryIcon sx={{ fontSize: 48, mb: 1, opacity: 0.5 }} />
                  <Typography variant="body2">{t('dashboard.noRecentActivity')}</Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default DashboardPage;
