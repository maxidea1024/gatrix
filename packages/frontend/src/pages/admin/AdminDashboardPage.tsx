import React from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Paper,
  useTheme,
  LinearProgress,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
} from '@mui/material';
import {
  People as PeopleIcon,
  PersonAdd as PersonAddIcon,
  Security as SecurityIcon,
  TrendingUp as TrendingUpIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Assessment as AssessmentIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useUserStats } from '@/hooks/useSWR';

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: 'primary' | 'secondary' | 'success' | 'warning' | 'error';
  trend?: number;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color, trend }) => {
  const theme = useTheme();
  
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 600, color: `${color}.main` }}>
              {value.toLocaleString()}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {title}
            </Typography>
            {trend !== undefined && (
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                <TrendingUpIcon 
                  sx={{ 
                    fontSize: 16, 
                    mr: 0.5, 
                    color: trend >= 0 ? 'success.main' : 'error.main' 
                  }} 
                />
                <Typography 
                  variant="caption" 
                  sx={{ color: trend >= 0 ? 'success.main' : 'error.main' }}
                >
                  {trend >= 0 ? '+' : ''}{trend}%
                </Typography>
              </Box>
            )}
          </Box>
          <Box sx={{ color: `${color}.main`, opacity: 0.7 }}>
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

const AdminDashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const { data: statsData, isLoading, error } = useUserStats();

  if (isLoading) {
    return (
      <Box sx={{ p: 3, width: '100%', mt: 2 }}>
        <LinearProgress />
      </Box>
    );
  }

  // Mock data if API fails
  const stats = statsData?.data || {
    totalUsers: 156,
    activeUsers: 142,
    pendingUsers: 8,
    adminUsers: 6,
  };

  // Mock data for additional admin stats
  const systemStats = {
    serverUptime: '15 days, 3 hours',
    totalSessions: 1247,
    avgResponseTime: '120ms',
    errorRate: 0.02,
  };

  const recentActivities = [
    { id: 1, user: 'John Doe', action: 'User registered', time: '2 minutes ago', type: 'info' },
    { id: 2, user: 'Jane Smith', action: 'Profile updated', time: '5 minutes ago', type: 'success' },
    { id: 3, user: 'Admin', action: 'User approved', time: '10 minutes ago', type: 'success' },
    { id: 4, user: 'System', action: 'Backup completed', time: '1 hour ago', type: 'info' },
    { id: 5, user: 'Bob Wilson', action: 'Login failed', time: '2 hours ago', type: 'warning' },
  ];

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircleIcon sx={{ color: 'success.main' }} />;
      case 'warning': return <WarningIcon sx={{ color: 'warning.main' }} />;
      case 'error': return <WarningIcon sx={{ color: 'error.main' }} />;
      default: return <ScheduleIcon sx={{ color: 'info.main' }} />;
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
          {t('admin.dashboard.title')}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {t('admin.dashboard.subtitle')}
        </Typography>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title={t('dashboard.totalUsers')}
            value={stats.totalUsers}
            icon={<PeopleIcon sx={{ fontSize: 40 }} />}
            color="primary"
            trend={12}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title={t('dashboard.activeUsers')}
            value={stats.activeUsers}
            icon={<CheckCircleIcon sx={{ fontSize: 40 }} />}
            color="success"
            trend={8}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title={t('dashboard.pendingApproval')}
            value={stats.pendingUsers}
            icon={<PersonAddIcon sx={{ fontSize: 40 }} />}
            color="warning"
            trend={-5}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title={t('dashboard.administrators')}
            value={stats.adminUsers}
            icon={<SecurityIcon sx={{ fontSize: 40 }} />}
            color="secondary"
          />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* System Performance */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <AssessmentIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {t('admin.dashboard.systemPerformance')}
                </Typography>
              </Box>
              
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      {t('admin.dashboard.serverUptime')}
                    </Typography>
                    <Typography variant="h6">{systemStats.serverUptime}</Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      {t('admin.dashboard.totalSessions')}
                    </Typography>
                    <Typography variant="h6">{systemStats.totalSessions.toLocaleString()}</Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      {t('admin.dashboard.avgResponseTime')}
                    </Typography>
                    <Typography variant="h6">{systemStats.avgResponseTime}</Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      {t('admin.dashboard.errorRate')}
                    </Typography>
                    <Typography variant="h6">{(systemStats.errorRate * 100).toFixed(2)}%</Typography>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Activities */}
        <Grid item xs={12} md={4}>
          <Card sx={{ height: 'fit-content' }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                {t('admin.dashboard.recentActivities')}
              </Typography>
              <List dense>
                {recentActivities.map((activity, index) => (
                  <React.Fragment key={activity.id}>
                    <ListItem sx={{ px: 0 }}>
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        {getActivityIcon(activity.type)}
                      </ListItemIcon>
                      <ListItemText
                        primary={activity.action}
                        secondary={`${activity.user} • ${activity.time}`}
                        primaryTypographyProps={{ variant: 'body2' }}
                        secondaryTypographyProps={{ variant: 'caption' }}
                      />
                    </ListItem>
                    {index < recentActivities.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default AdminDashboardPage;
