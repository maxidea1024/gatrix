import React, { useEffect } from 'react';
import { Box, Typography, Button, useTheme } from '@mui/material';
import {
  Block as BlockIcon,
  ArrowBack as ArrowBackIcon,
  ContactSupport as ContactSupportIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LanguageSelector } from '@/components/LanguageSelector';
import { AuthService } from '@/services/auth';

const AccountSuspendedPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

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
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        overflow: 'hidden',
        bgcolor: 'background.default',
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

      {/* Main card */}
      <Box
        sx={{
          maxWidth: 520,
          width: '100%',
          mx: 2,
          p: { xs: 4, sm: 5 },
          borderRadius: 4,
          bgcolor: 'background.paper',
          border: `1px solid`,
          borderColor: 'divider',
          boxShadow: isDark
            ? '0 8px 32px rgba(0,0,0,0.3)'
            : '0 8px 40px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)',
          textAlign: 'center',
        }}
      >
        {/* Icon */}
        <Box sx={{ position: 'relative', display: 'inline-flex', mb: 3 }}>
          <Box
            sx={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: isDark ? 'rgba(244,67,54,0.12)' : 'rgba(244,67,54,0.08)',
              border: '2px solid',
              borderColor: 'error.main',
            }}
          >
            <BlockIcon sx={{ fontSize: 36, color: 'error.main' }} />
          </Box>
        </Box>

        {/* Title */}
        <Typography
          variant="h5"
          fontWeight={700}
          sx={{ mb: 1, color: 'text.primary', letterSpacing: -0.3 }}
        >
          Gatrix
        </Typography>

        {/* Subtitle */}
        <Typography
          variant="h6"
          fontWeight={600}
          sx={{ mb: 1, color: 'error.main' }}
        >
          {t('accountSuspended.title')}
        </Typography>

        {/* Message */}
        <Typography
          variant="body1"
          sx={{
            mb: 3,
            color: 'text.secondary',
            lineHeight: 1.7,
            maxWidth: 400,
            mx: 'auto',
          }}
        >
          {t('accountSuspended.message')}
        </Typography>

        {/* Info box */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 1.5,
            py: 1.5,
            px: 2,
            borderRadius: 2,
            mb: 3,
            bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
            border: '1px solid',
            borderColor: 'divider',
            textAlign: 'left',
          }}
        >
          <Box sx={{ mt: 0.25, color: 'text.disabled', flexShrink: 0 }}>
            <InfoIcon sx={{ fontSize: 22 }} />
          </Box>
          <Typography
            variant="body2"
            sx={{ lineHeight: 1.5, color: 'text.secondary' }}
          >
            {t('accountSuspended.additionalInfo')}
          </Typography>
        </Box>

        {/* Action Buttons */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Button
            variant="contained"
            size="large"
            startIcon={<ContactSupportIcon />}
            fullWidth
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
              py: 1.2,
            }}
          >
            {t('accountSuspended.contactSupport')}
          </Button>

          <Button
            variant="text"
            size="large"
            startIcon={<ArrowBackIcon />}
            onClick={handleBackToLogin}
            fullWidth
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 500,
              color: 'text.secondary',
            }}
          >
            {t('accountSuspended.backToLogin')}
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

export default AccountSuspendedPage;
