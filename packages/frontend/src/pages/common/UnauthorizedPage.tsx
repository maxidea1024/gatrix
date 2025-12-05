import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Divider,
} from '@mui/material';
import {
  Block,
  Home,
  ArrowBack,
  VpnKey as PermissionIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from 'react-i18next';

interface LocationState {
  requiredPermissions?: string[];
  requiredRole?: string;
}

const UnauthorizedPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { t } = useTranslation();

  // Get required permissions from location state
  const state = location.state as LocationState | null;
  const requiredPermissions = state?.requiredPermissions || [];
  const requiredRole = state?.requiredRole;

  const handleGoHome = () => {
    navigate('/dashboard');
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  // Translate permission key to display name
  const getPermissionDisplayName = (permission: string) => {
    const key = `permissions.${permission.replace('.', '_')}`;
    const translated = t(key);
    // If translation key doesn't exist, return the original permission
    return translated === key ? permission : translated;
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        p: 2,
      }}
    >
      <Card sx={{ maxWidth: 500, width: '100%' }}>
        <CardContent sx={{ p: 4, textAlign: 'center' }}>
          {/* Icon */}
          <Block
            sx={{
              fontSize: 80,
              color: 'error.main',
              mb: 3,
            }}
          />

          {/* Header */}
          <Typography variant="h4" component="h1" gutterBottom>
            {t('errors.forbidden')}
          </Typography>

          <Typography variant="h6" gutterBottom color="text.secondary">
            403 - {t('errors.unauthorized')}
          </Typography>

          {/* Message */}
          <Typography variant="body1" paragraph sx={{ mb: 3 }}>
            {t('errors.noPermissionAdminOnly')}
          </Typography>

          {user && (
            <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
              <Typography variant="body2" color="text.secondary">
                {t('common.loggedInAs')}: <strong>{user.name}</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('dashboard.role')}: <strong>{user.role}</strong>
              </Typography>
            </Box>
          )}

          {/* Required Permissions Section */}
          {(requiredPermissions.length > 0 || requiredRole) && (
            <Box sx={{ mb: 3, p: 2, bgcolor: 'warning.lighter', borderRadius: 1, textAlign: 'left' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <PermissionIcon sx={{ fontSize: 20, color: 'warning.main' }} />
                <Typography variant="subtitle2" color="warning.dark">
                  {t('errors.requiredPermissions')}
                </Typography>
              </Box>
              <Divider sx={{ mb: 1.5 }} />
              {requiredRole && (
                <Box sx={{ mb: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    {t('errors.requiredRole')}:
                  </Typography>
                  <Chip
                    label={t(`users.roles.${requiredRole}`)}
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                </Box>
              )}
              {requiredPermissions.length > 0 && (
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    {t('errors.requiredPermissionsList')}:
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {requiredPermissions.map((permission) => (
                      <Chip
                        key={permission}
                        label={getPermissionDisplayName(permission)}
                        size="small"
                        color="warning"
                        variant="outlined"
                        sx={{ fontSize: '0.75rem' }}
                      />
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
          )}

          {/* Actions */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Button
              variant="contained"
              startIcon={<Home />}
              onClick={handleGoHome}
              size="large"
            >
              {t('common.goToDashboard')}
            </Button>

            <Button
              variant="outlined"
              startIcon={<ArrowBack />}
              onClick={handleGoBack}
            >
              {t('common.goBack')}
            </Button>
          </Box>

          {/* Footer */}
          <Typography variant="caption" color="text.secondary" sx={{ mt: 3, display: 'block' }}>
            {t('errors.contactSupport')}
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default UnauthorizedPage;
