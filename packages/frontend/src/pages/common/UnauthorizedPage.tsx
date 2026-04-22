import React from 'react';
import { Box, Typography, Button, useTheme } from '@mui/material';
import {
  Block as BlockIcon,
  Home as HomeIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

/**
 * Unauthorized Page (403 Forbidden)
 *
 * Design matches SessionExpiredPage / NoOrgAccessPage for consistency.
 */
const UnauthorizedPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const handleGoHome = () => {
    navigate('/dashboard');
  };

  const handleGoBack = () => {
    navigate(-1);
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
            <BlockIcon
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
          {t('errors.forbidden')}
        </Typography>

        {/* Subtitle */}
        <Typography variant="body2" sx={{ mb: 0.5, color: 'text.secondary' }}>
          403 - {t('errors.unauthorized')}
        </Typography>

        {/* Description */}
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
          {t('errors.noPermissionAdminOnly')}
        </Typography>

        {/* Dashboard Button */}
        <Button
          variant="contained"
          size="large"
          startIcon={<HomeIcon />}
          onClick={handleGoHome}
          fullWidth
          sx={{
            mt: 1,
            py: 1.5,
            borderRadius: 2,
            textTransform: 'none',
            fontSize: '1rem',
            fontWeight: 600,
          }}
        >
          {t('common.goToDashboard')}
        </Button>

        {/* Go Back Button */}
        <Button
          variant="contained"
          size="large"
          startIcon={<ArrowBackIcon />}
          onClick={handleGoBack}
          fullWidth
          sx={{
            mt: 1.5,
            py: 1.5,
            borderRadius: 2,
            textTransform: 'none',
            fontSize: '1rem',
            fontWeight: 600,
          }}
        >
          {t('common.goBack')}
        </Button>
      </Box>
    </Box>
  );
};

export default UnauthorizedPage;
