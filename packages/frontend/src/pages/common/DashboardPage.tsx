import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Paper,
  useTheme,
  Chip,
  Avatar,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  People as PeopleIcon,
  ShoppingCart as ShoppingCartIcon,
  AttachMoney as MoneyIcon,
  Assessment as AssessmentIcon,
  People,
  PersonAdd,
  Security,
  TrendingUp,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { useUserStats } from '@/hooks/useSWR';

// Stats card component
interface StatsCardProps {
  title: string;
  value: number | string;
  icon: React.ReactElement;
  color: 'primary' | 'secondary' | 'success' | 'warning' | 'error';
  subtitle?: string;
}

const StatsCard: React.FC<StatsCardProps> = ({ title, value, icon, color, subtitle }) => {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Avatar sx={{ bgcolor: `${color}.main`, mr: 2 }}>
            {icon}
          </Avatar>
          <Box>
            <Typography variant="h4" component="div" fontWeight="bold">
              {value}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="caption" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

const DashboardPage: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const { data: statsData, error: statsError, isLoading: statsLoading } = useUserStats();
  const { t } = useTranslation();

  const stats = statsData?.stats || {
    total: 0,
    active: 0,
    pending: 0,
    suspended: 0,
    admins: 0,
  };

  return (
    <Box sx={{ p: 3 }}>
        {/* Welcome Section */}
        <Paper sx={{ p: 3, mb: 3, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
          <Box sx={{ color: 'white' }}>
            <Typography variant="h4" gutterBottom>
              {t('dashboard.welcomeBack', { name: user?.name })}
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.9 }}>
              {isAdmin() 
                ? t('dashboard.adminWelcome')
                : t('dashboard.userWelcome')
              }
            </Typography>
            <Box sx={{ mt: 2 }}>
              <Chip 
                label={user?.role?.toUpperCase()} 
                sx={{ 
                  bgcolor: 'rgba(255, 255, 255, 0.2)', 
                  color: 'white',
                  fontWeight: 'bold'
                }} 
              />
              <Chip 
                label={user?.status?.toUpperCase()} 
                sx={{ 
                  bgcolor: user?.status === 'active' ? 'success.main' : 'warning.main',
                  color: 'white',
                  ml: 1,
                  fontWeight: 'bold'
                }} 
              />
            </Box>
          </Box>
        </Paper>

        {/* Stats Section - Only for Admins */}
        {isAdmin() && (
          <>
            <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
              {t('dashboard.systemOverview')}
            </Typography>
            
            {statsLoading ? (
              <Typography>{t('common.loading')}</Typography>
            ) : statsError ? (
              <Typography color="error">{t('dashboard.loadStatsError')}</Typography>
            ) : (
              <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid item xs={12} sm={6} md={3}>
                  <StatsCard
                    title={t('dashboard.totalUsers')}
                    value={stats.total}
                    icon={<People />}
                    color="primary"
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <StatsCard
                    title={t('dashboard.activeUsers')}
                    value={stats.active}
                    icon={<TrendingUp />}
                    color="success"
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <StatsCard
                    title={t('dashboard.pendingApproval')}
                    value={stats.pending}
                    icon={<PersonAdd />}
                    color="warning"
                    subtitle={stats.pending > 0 ? t('dashboard.requiresAttention') : t('dashboard.allCaughtUp')}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <StatsCard
                    title={t('dashboard.administrators')}
                    value={stats.admins}
                    icon={<Security />}
                    color="secondary"
                  />
                </Grid>
              </Grid>
            )}
          </>
        )}

        {/* Quick Actions */}
        <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
          {t('dashboard.quickActions')}
        </Typography>
        
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {t('dashboard.profileManagement')}
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  {t('dashboard.profileManagementDesc')}
                </Typography>
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2">
                    <strong>{t('dashboard.lastLogin')}:</strong> {user?.lastLoginAt ? new Date(user.last_login_at).toLocaleString() : t('dashboard.never')}
                  </Typography>
                  <Typography variant="body2">
                    <strong>{t('dashboard.emailVerified')}:</strong> {user?.emailVerified ? t('common.yes') : t('common.no')}
                  </Typography>
                  <Typography variant="body2">
                    <strong>{t('dashboard.accountCreated')}:</strong> {user?.createdAt ? new Date(user.created_at).toLocaleDateString() : t('dashboard.unknown')}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {isAdmin() && (
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {t('dashboard.administration')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    {t('dashboard.administrationDesc')}
                  </Typography>
                  <Box sx={{ mt: 2 }}>
                    {stats.pending > 0 && (
                      <Typography variant="body2" color="warning.main">
                        <strong>⚠️ {t('dashboard.pendingUsers', { count: stats.pending })}</strong>
                      </Typography>
                    )}
                    <Typography variant="body2">
                      <strong>{t('dashboard.systemStatus')}:</strong> {t('dashboard.operational')}
                    </Typography>
                    <Typography variant="body2">
                      <strong>{t('dashboard.activeSessions')}:</strong> {stats.active}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>

        {/* Recent Activity - Placeholder */}
        <Typography variant="h5" gutterBottom sx={{ mt: 4, mb: 3 }}>
          {t('dashboard.recentActivity')}
        </Typography>
        
        <Card>
          <CardContent>
            <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4 }}>
              {t('dashboard.recentActivityPlaceholder')}
            </Typography>
          </CardContent>
        </Card>
    </Box>
  );
};

export default DashboardPage;
