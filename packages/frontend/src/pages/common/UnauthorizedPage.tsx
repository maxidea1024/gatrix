import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
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
