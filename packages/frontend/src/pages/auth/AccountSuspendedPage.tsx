import React, { useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Stack,
} from '@mui/material';
import {
  Block as BlockIcon,
  ArrowBack as ArrowBackIcon,
  ContactSupport as ContactSupportIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LanguageSelector } from '@/components/LanguageSelector';
import { AuthService } from '@/services/auth';

const AccountSuspendedPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  // Clear all authentication data when this page loads
  // to prevent showing dashboard briefly when navigating to login
  useEffect(() => {
    AuthService.clearAuthData();
  }, []);

  const handleBackToLogin = () => {
    navigate('/login', { replace: true });
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'background.default',
        p: 2,
        position: 'relative',
      }}
    >
      {/* Language Selector */}
      <Box
        sx={{
          position: 'absolute',
          top: 16,
          right: 16,
          zIndex: 1000,
        }}
      >
        <LanguageSelector />
      </Box>

      <Card sx={{ maxWidth: 500, width: '100%' }}>
        <CardContent sx={{ p: 4, textAlign: 'center' }}>
          {/* Icon */}
          <BlockIcon 
            sx={{ 
              fontSize: 64, 
              color: 'error.main',
              mb: 2 
            }} 
          />

          {/* Header */}
          <Typography variant="h4" component="h1" gutterBottom>
            Gatrix
          </Typography>
          <Typography variant="h6" gutterBottom color="error.main">
            {t('accountSuspended.title')}
          </Typography>

          {/* Message */}
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            {t('accountSuspended.message')}
          </Typography>

          {/* Additional Info */}
          <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
            {t('accountSuspended.additionalInfo')}
          </Typography>

          {/* Action Buttons */}
          <Stack spacing={2}>
            <Button
              variant="outlined"
              size="large"
              startIcon={<ContactSupportIcon />}
              color="primary"
              fullWidth
            >
              {t('accountSuspended.contactSupport')}
            </Button>
            
            <Button
              variant="text"
              size="large"
              startIcon={<ArrowBackIcon />}
              onClick={handleBackToLogin}
              fullWidth
            >
              {t('accountSuspended.backToLogin')}
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
};

export default AccountSuspendedPage;
