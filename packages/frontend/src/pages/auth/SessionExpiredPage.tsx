import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Button, useTheme } from '@mui/material';
import {
  Login as LoginIcon,
  ErrorOutline as ErrorIcon,
  VpnKey as KeyIcon,
  Refresh as RefreshIcon,
  SupportAgent as SupportIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { AuthService } from '@/services/auth';

/**
 * Session Expired Page
 *
 * Displayed when:
 * - User's account was deleted while they were logged in
 * - Server was reset and user data was cleared
 * - Token is valid but user no longer exists in database
 *
 * Design matches the onboarding page (NoOrgAccessPage) for consistency.
 */
const SessionExpiredPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  useEffect(() => {
    // Clear all authentication data when this page loads
    AuthService.clearAuthData();
  }, []);

  const handleBackToLogin = () => {
    navigate('/login', { replace: true });
  };

  const steps = [
    {
      icon: <KeyIcon sx={{ fontSize: 22 }} />,
      title: t('auth.sessionExpired.step1Title'),
      desc: t('auth.sessionExpired.step1Desc'),
    },
    {
      icon: <RefreshIcon sx={{ fontSize: 22 }} />,
      title: t('auth.sessionExpired.step2Title'),
      desc: t('auth.sessionExpired.step2Desc'),
    },
    {
      icon: <SupportIcon sx={{ fontSize: 22 }} />,
      title: t('auth.sessionExpired.step3Title'),
      desc: t('auth.sessionExpired.step3Desc'),
    },
  ];

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
      }}
    >
      {/* Main card */}
      <Box
        sx={{
          maxWidth: 520,
          width: '100%',
          mx: 2,
          p: { xs: 4, sm: 5 },
          borderRadius: 4,
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          boxShadow: isDark
            ? '0 8px 32px rgba(0,0,0,0.3)'
            : '0 8px 40px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)',
          textAlign: 'center',
        }}
      >
        {/* Error indicator */}
        <Box sx={{ position: 'relative', display: 'inline-flex', mb: 3 }}>
          <Box
            sx={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: isDark
                ? 'linear-gradient(135deg, rgba(211,47,47,0.15), rgba(237,108,2,0.1))'
                : 'linear-gradient(135deg, rgba(211,47,47,0.08), rgba(237,108,2,0.05))',
              border: `2px solid ${isDark ? 'rgba(211,47,47,0.3)' : 'rgba(211,47,47,0.15)'}`,
            }}
          >
            <ErrorIcon
              sx={{
                fontSize: 36,
                color: 'error.main',
                opacity: 0.9,
              }}
            />
          </Box>
        </Box>

        {/* Title */}
        <Typography
          variant="h5"
          fontWeight={700}
          sx={{ mb: 1, color: 'text.primary', letterSpacing: -0.3 }}
        >
          {t('auth.sessionExpired.title')}
        </Typography>

        {/* Subtitle */}
        <Typography
          variant="body1"
          sx={{
            mb: 4,
            color: 'text.secondary',
            lineHeight: 1.7,
            maxWidth: 400,
            mx: 'auto',
          }}
        >
          {t('auth.sessionExpired.description')}
        </Typography>

        {/* Info steps */}
        <Box sx={{ textAlign: 'left', mb: 3 }}>
          {steps.map((step, idx) => (
            <Box
              key={idx}
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1.5,
                py: 1.5,
                px: 2,
                borderRadius: 2,
                mb: 1,
                bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Box
                sx={{
                  mt: 0.25,
                  color: 'warning.main',
                  flexShrink: 0,
                }}
              >
                {step.icon}
              </Box>
              <Box>
                <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.25, color: 'text.primary' }}>
                  {step.title}
                </Typography>
                <Typography variant="body2" sx={{ lineHeight: 1.5, color: 'text.secondary' }}>
                  {step.desc}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>

        {/* Back to Login Button */}
        <Button
          variant="contained"
          size="large"
          startIcon={<LoginIcon />}
          onClick={handleBackToLogin}
          fullWidth
          sx={{
            mt: 1,
            py: 1.5,
            borderRadius: 2,
            textTransform: 'none',
            fontSize: '1rem',
            fontWeight: 600,
            background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
            boxShadow: `0 4px 14px ${isDark ? 'rgba(0,0,0,0.4)' : 'rgba(102,126,234,0.25)'}`,
            '&:hover': {
              background: `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.secondary.dark})`,
              boxShadow: `0 6px 20px ${isDark ? 'rgba(0,0,0,0.5)' : 'rgba(102,126,234,0.35)'}`,
            },
          }}
        >
          {t('auth.sessionExpired.backToLogin')}
        </Button>
      </Box>
    </Box>
  );
};

export default SessionExpiredPage;
