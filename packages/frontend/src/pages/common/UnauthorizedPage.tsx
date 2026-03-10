import React from 'react';
import { Box, Typography, Button, Chip, useTheme } from '@mui/material';
import {
  Block as BlockIcon,
  Home as HomeIcon,
  ArrowBack as ArrowBackIcon,
  VpnKey as PermissionIcon,
  SupportAgent as SupportIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from 'react-i18next';

interface LocationState {
  requiredPermissions?: string[];
  requiredRole?: string;
}

/**
 * Unauthorized Page (403 Forbidden)
 *
 * Design matches SessionExpiredPage / NoOrgAccessPage for consistency.
 */
const UnauthorizedPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

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
    return translated === key ? permission : translated;
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
        <Typography
          variant="body2"
          sx={{ mb: 0.5, color: 'text.secondary' }}
        >
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

        {/* Logged-in user info */}
        {user && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1,
              py: 1.5,
              px: 2,
              mb: 3,
              borderRadius: 2,
              bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Typography variant="body2" color="text.secondary">
              {t('common.loggedInAs')}:
            </Typography>
            <Typography variant="body2" fontWeight={600} color="text.primary">
              {user.name}
            </Typography>
          </Box>
        )}

        {/* Required Permissions Section */}
        {(requiredPermissions.length > 0 || requiredRole) && (
          <Box sx={{ textAlign: 'left', mb: 3 }}>
            {/* Header */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1.5,
                py: 1.5,
                px: 2,
                borderRadius: 2,
                mb: 1,
                bgcolor: isDark
                  ? 'rgba(237,108,2,0.08)'
                  : 'rgba(237,108,2,0.04)',
                border: '1px solid',
                borderColor: isDark
                  ? 'rgba(237,108,2,0.2)'
                  : 'rgba(237,108,2,0.12)',
              }}
            >
              <Box
                sx={{
                  mt: 0.25,
                  color: 'warning.main',
                  flexShrink: 0,
                }}
              >
                <PermissionIcon sx={{ fontSize: 22 }} />
              </Box>
              <Box>
                <Typography
                  variant="subtitle2"
                  fontWeight={600}
                  sx={{ mb: 0.25, color: 'text.primary' }}
                >
                  {t('errors.requiredPermissions')}
                </Typography>

                {requiredRole && (
                  <Box sx={{ mt: 0.5 }}>
                    <Typography
                      variant="caption"
                      sx={{ color: 'text.secondary' }}
                    >
                      {t('errors.requiredRole')}:{' '}
                    </Typography>
                    <Chip
                      label={t(`users.roles.${requiredRole}`)}
                      size="small"
                      color="primary"
                      variant="outlined"
                      sx={{ borderRadius: '16px', height: 22 }}
                    />
                  </Box>
                )}

                {requiredPermissions.length > 0 && (
                  <Box sx={{ mt: 0.5 }}>
                    <Typography
                      variant="caption"
                      sx={{
                        display: 'block',
                        mb: 0.5,
                        color: 'text.secondary',
                      }}
                    >
                      {t('errors.requiredPermissionsList')}:
                    </Typography>
                    <Box
                      sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}
                    >
                      {requiredPermissions.map((permission) => (
                        <Chip
                          key={permission}
                          label={getPermissionDisplayName(permission)}
                          size="small"
                          color="warning"
                          variant="outlined"
                          sx={{
                            fontSize: '0.7rem',
                            borderRadius: '16px',
                            height: 22,
                          }}
                        />
                      ))}
                    </Box>
                  </Box>
                )}
              </Box>
            </Box>
          </Box>
        )}

        {/* Help step */}
        <Box sx={{ textAlign: 'left', mb: 3 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 1.5,
              py: 1.5,
              px: 2,
              borderRadius: 2,
              bgcolor: isDark
                ? 'rgba(255,255,255,0.04)'
                : 'rgba(0,0,0,0.02)',
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Box
              sx={{
                mt: 0.25,
                color: 'info.main',
                flexShrink: 0,
              }}
            >
              <SupportIcon sx={{ fontSize: 22 }} />
            </Box>
            <Box>
              <Typography
                variant="body2"
                sx={{ lineHeight: 1.5, color: 'text.secondary' }}
              >
                {t('errors.contactSupport')}
              </Typography>
            </Box>
          </Box>
        </Box>

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
            background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
            boxShadow: `0 4px 14px ${isDark ? 'rgba(0,0,0,0.4)' : 'rgba(102,126,234,0.25)'}`,
            '&:hover': {
              background: `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.secondary.dark})`,
              boxShadow: `0 6px 20px ${isDark ? 'rgba(0,0,0,0.5)' : 'rgba(102,126,234,0.35)'}`,
            },
          }}
        >
          {t('common.goToDashboard')}
        </Button>

        {/* Go Back Button */}
        <Button
          variant="outlined"
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
