import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Avatar,
  Container,
} from '@mui/material';
import {
  Block,
  Home,
  ArrowBack,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from 'react-i18next';

const UnauthorizedPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const { t } = useTranslation();

  const handleGoHome = () => {
    navigate('/dashboard');
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          py: 4,
        }}
      >
        <Card sx={{ width: '100%', textAlign: 'center' }}>
          <CardContent sx={{ p: 4 }}>
            {/* Icon */}
            <Box sx={{ mb: 3 }}>
              <Avatar
                sx={{
                  width: 80,
                  height: 80,
                  bgcolor: 'error.main',
                  mx: 'auto',
                  mb: 2,
                }}
              >
                <Block sx={{ fontSize: 40 }} />
              </Avatar>
            </Box>

            {/* Title */}
            <Typography variant="h4" component="h1" gutterBottom color="error.main">
              {t('errors.forbidden')}
            </Typography>

            {/* Message */}
            <Typography variant="body1" paragraph sx={{ mb: 4 }}>
              {t('errors.noPermissionAdminOnly', 'You do not have permission to access this resource. This page is restricted to administrators only.')}
            </Typography>

            {user ? (
              <Box sx={{ mb: 4 }}>
                <Typography variant="body2" color="text.secondary" paragraph>
                  {t('common.loggedInAs')}: <strong>{user.name}</strong> ({t('dashboard.role')}: <strong>{user.role}</strong>)
                </Typography>
                
                {user.status !== 'active' && (
                  <Typography variant="body2" color="warning.main" paragraph>
                    {t('dashboard.status')}: <strong>{user.status}</strong>
                  </Typography>
                )}

                <Typography variant="body2" color="text.secondary">
                  {t('errors.contactSupport')}
                </Typography>
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary" paragraph>
                {t('auth.loginRequired', 'You may need to log in with appropriate credentials to access this resource.')}
              </Typography>
            )}

            {/* Error Code */}
            <Box
              sx={{
                bgcolor: 'error.light',
                color: 'error.contrastText',
                p: 2,
                borderRadius: 1,
                mb: 4,
              }}
            >
              <Typography variant="body2" fontWeight="medium">
                Error 403: {t('errors.forbidden')}
              </Typography>
            </Box>

            {/* Actions */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {user ? (
                <>
                  <Button
                    variant="contained"
                    startIcon={<Home />}
                    onClick={handleGoHome}
                    fullWidth
                  >
                    {t('common.goToDashboard')}
                  </Button>
                  
                  <Button
                    variant="outlined"
                    startIcon={<ArrowBack />}
                    onClick={handleGoBack}
                    fullWidth
                  >
                    {t('common.goBack')}
                  </Button>
                </>
              ) : (
                <Button
                  variant="contained"
                  onClick={() => navigate('/login')}
                  fullWidth
                >
                  {t('auth.login')}
                </Button>
              )}
            </Box>

            {/* Additional Info */}
            <Box sx={{ mt: 4, pt: 3, borderTop: 1, borderColor: 'divider' }}>
              <Typography variant="caption" color="text.secondary">
                {t('errors.contactSupport')}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
};

export default UnauthorizedPage;
