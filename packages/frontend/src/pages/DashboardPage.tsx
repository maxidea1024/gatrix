import React from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Paper,
  Avatar,
  Chip,
} from '@mui/material';
import {
  People,
  PersonAdd,
  Security,
  TrendingUp,
} from '@mui/icons-material';
import { Layout } from '@/components/layout/Layout';
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

  const stats = statsData?.stats || {
    total: 0,
    active: 0,
    pending: 0,
    suspended: 0,
    admins: 0,
  };

  return (
    <Layout title="Dashboard">
      <Box sx={{ p: 3 }}>
        {/* Welcome Section */}
        <Paper sx={{ p: 3, mb: 3, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
          <Box sx={{ color: 'white' }}>
            <Typography variant="h4" gutterBottom>
              Welcome back, {user?.name}!
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.9 }}>
              {isAdmin() 
                ? 'Manage your admin panel and monitor system activities.'
                : 'Access your profile and view your account information.'
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
              System Overview
            </Typography>
            
            {statsLoading ? (
              <Typography>Loading statistics...</Typography>
            ) : statsError ? (
              <Typography color="error">Failed to load statistics</Typography>
            ) : (
              <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid item xs={12} sm={6} md={3}>
                  <StatsCard
                    title="Total Users"
                    value={stats.total}
                    icon={<People />}
                    color="primary"
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <StatsCard
                    title="Active Users"
                    value={stats.active}
                    icon={<TrendingUp />}
                    color="success"
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <StatsCard
                    title="Pending Approval"
                    value={stats.pending}
                    icon={<PersonAdd />}
                    color="warning"
                    subtitle={stats.pending > 0 ? 'Requires attention' : 'All caught up'}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <StatsCard
                    title="Administrators"
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
          Quick Actions
        </Typography>
        
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Profile Management
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  Update your profile information, change password, and manage account settings.
                </Typography>
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2">
                    <strong>Last Login:</strong> {user?.last_login_at ? new Date(user.last_login_at).toLocaleString() : 'Never'}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Email Verified:</strong> {user?.email_verified ? 'Yes' : 'No'}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Account Created:</strong> {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown'}
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
                    Administration
                  </Typography>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    Manage users, view audit logs, and configure system settings.
                  </Typography>
                  <Box sx={{ mt: 2 }}>
                    {stats.pending > 0 && (
                      <Typography variant="body2" color="warning.main">
                        <strong>⚠️ {stats.pending} user(s) pending approval</strong>
                      </Typography>
                    )}
                    <Typography variant="body2">
                      <strong>System Status:</strong> Operational
                    </Typography>
                    <Typography variant="body2">
                      <strong>Active Sessions:</strong> {stats.active}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>

        {/* Recent Activity - Placeholder */}
        <Typography variant="h5" gutterBottom sx={{ mt: 4, mb: 3 }}>
          Recent Activity
        </Typography>
        
        <Card>
          <CardContent>
            <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4 }}>
              Recent activity will be displayed here once the audit log system is integrated.
            </Typography>
          </CardContent>
        </Card>
      </Box>
    </Layout>
  );
};

export default DashboardPage;
