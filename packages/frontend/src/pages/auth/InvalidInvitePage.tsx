import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Typography,
  Button,
  Alert,
  useTheme,
} from '@mui/material';
import {
  ErrorOutline as ErrorIcon,
  Login as LoginIcon,
  PersonAdd as RegisterIcon,
} from '@mui/icons-material';
import AuthLayout from '@/components/auth/AuthLayout';
import { LanguageSelector } from '@/components/LanguageSelector';

const InvalidInvitePage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const theme = useTheme();

  const handleGoToLogin = () => {
    navigate('/login', { replace: true });
  };

  const handleGoToRegister = () => {
    navigate('/register', { replace: true });
  };

  return (
    <AuthLayout
      title={t('admin.invitations.invalidInviteTitle')}
      subtitle={t('admin.invitations.invalidInviteSubtitle')}
      showLeftPanel={false}
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
        <LanguageSelector variant="icon" size="medium" />
      </Box>
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <ErrorIcon
          sx={{
            fontSize: 64,
            color: 'error.main',
            mb: 3
          }}
        />
      </Box>

      <Alert
        severity="error"
        sx={{
          mb: 4,
          backgroundColor: theme.palette.mode === 'dark'
            ? 'rgba(244, 67, 54, 0.1)'
            : 'rgba(244, 67, 54, 0.05)',
          color: 'error.main',
          border: `1px solid ${theme.palette.error.main}20`,
          '& .MuiAlert-icon': {
            color: 'error.main'
          },
          '& .MuiAlert-message': {
            width: '100%'
          }
        }}
      >
        <Typography variant="body1" sx={{ mb: 1, fontWeight: 500 }}>
          {t('admin.invitations.invalidInviteMessage')}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {t('admin.invitations.invalidInviteHelp')}
        </Typography>
      </Alert>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Button
          variant="contained"
          size="large"
          startIcon={<LoginIcon />}
          onClick={handleGoToLogin}
          sx={{
            py: 1.5,
            fontSize: '1rem',
            fontWeight: 600,
            borderRadius: 2,
            textTransform: 'none',
            boxShadow: theme.shadows[2],
            '&:hover': {
              boxShadow: theme.shadows[4],
            }
          }}
        >
          {t('admin.invitations.goToLogin')}
        </Button>

        <Button
          variant="outlined"
          size="large"
          startIcon={<RegisterIcon />}
          onClick={handleGoToRegister}
          sx={{
            py: 1.5,
            fontSize: '1rem',
            fontWeight: 600,
            borderRadius: 2,
            textTransform: 'none',
            borderWidth: 2,
            '&:hover': {
              borderWidth: 2,
              backgroundColor: 'primary.50'
            }
          }}
        >
          {t('admin.invitations.goToRegister')}
        </Button>
      </Box>

      <Box sx={{ mt: 4, textAlign: 'center' }}>
        <Typography 
          variant="body2" 
          sx={{ 
            color: 'text.secondary',
            fontSize: '0.875rem'
          }}
        >
          {t('admin.invitations.invalidInviteHelp')}
        </Typography>
      </Box>
    </AuthLayout>
  );
};

export default InvalidInvitePage;
