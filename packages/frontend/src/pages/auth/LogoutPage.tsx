import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Alert,
  useTheme,
} from '@mui/material';
import {
  Logout as LogoutIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import { useSnackbar } from 'notistack';
import AuthLayout from '@/components/auth/AuthLayout';

const LogoutPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const theme = useTheme();
  
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutComplete, setLogoutComplete] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  const handleLogout = async () => {
    try {
      console.log('[LogoutPage] Starting logout...');
      console.log('[LogoutPage] Before logout - localStorage:', {
        hasToken: !!localStorage.getItem('accessToken'),
        hasUser: !!localStorage.getItem('user')
      });

      setIsLoggingOut(true);
      setLogoutError(null);

      await logout();

      console.log('[LogoutPage] After logout - localStorage:', {
        hasToken: !!localStorage.getItem('accessToken'),
        hasUser: !!localStorage.getItem('user')
      });

      setLogoutComplete(true);

      // 2초 후 로그인 페이지로 이동
      setTimeout(() => {
        console.log('[LogoutPage] Navigating to login page...');
        navigate('/login', { replace: true });
      }, 2000);

    } catch (error: any) {
      console.error('[LogoutPage] Logout failed:', error);
      setLogoutError(error.message || t('auth.logout.failed'));
      enqueueSnackbar(t('auth.logout.failed'), { variant: 'error' });
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleCancel = () => {
    navigate(-1); // 이전 페이지로 돌아가기
  };

  const handleRetry = () => {
    setLogoutError(null);
    handleLogout();
  };

  // 페이지 로드 시 자동으로 로그아웃 시작하지 않음 (사용자 확인 필요)
  useEffect(() => {
    // URL 파라미터로 자동 로그아웃 여부 확인
    const urlParams = new URLSearchParams(window.location.search);
    const autoLogout = urlParams.get('auto') === 'true';
    
    if (autoLogout) {
      handleLogout();
    }
  }, []);

  if (logoutComplete) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'background.default',
        }}
      >
        <Box
          sx={{
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            animation: 'fadeIn 0.4s ease-out',
            '@keyframes fadeIn': {
              from: { opacity: 0, transform: 'translateY(10px)' },
              to: { opacity: 1, transform: 'translateY(0)' }
            }
          }}
        >
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              bgcolor: 'success.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: 'scaleIn 0.3s ease-out',
              '@keyframes scaleIn': {
                from: { transform: 'scale(0)' },
                to: { transform: 'scale(1)' }
              }
            }}
          >
            <CheckCircleIcon sx={{ fontSize: 32, color: 'white' }} />
          </Box>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 500,
              color: 'text.primary',
              letterSpacing: '-0.01em'
            }}
          >
            {t('auth.logout.completed')}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {t('auth.logout.redirecting')}
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <AuthLayout
      title={t('auth.logout.title')}
      subtitle={t('auth.logout.confirmation', { name: user?.name || t('common.user') })}
      showLeftPanel={false}
    >
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <LogoutIcon
          sx={{
            fontSize: 64,
            color: 'warning.main',
            mb: 3
          }}
        />
      </Box>

      {logoutError && (
        <Alert
          severity="error"
          sx={{
            mb: 3,
            backgroundColor: theme.palette.mode === 'dark'
              ? 'rgba(244, 67, 54, 0.1)'
              : 'rgba(244, 67, 54, 0.05)',
            color: 'error.main',
            border: `1px solid ${theme.palette.error.main}20`,
            '& .MuiAlert-icon': {
              color: 'error.main'
            }
          }}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={handleRetry}
              disabled={isLoggingOut}
              sx={{ color: 'error.main' }}
            >
              {t('common.retry')}
            </Button>
          }
        >
          {logoutError}
        </Alert>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Button
          variant="contained"
          size="large"
          onClick={handleLogout}
          disabled={isLoggingOut}
          startIcon={isLoggingOut ? <CircularProgress size={20} sx={{ color: 'inherit' }} /> : <LogoutIcon />}
          fullWidth
          sx={{
            height: 48,
            background: theme.palette.mode === 'dark'
              ? 'linear-gradient(45deg, #667eea 30%, #764ba2 90%)'
              : 'linear-gradient(45deg, #1976d2 30%, #1565c0 90%)',
            '&:hover': {
              background: theme.palette.mode === 'dark'
                ? 'linear-gradient(45deg, #5a6fd8 30%, #6a4190 90%)'
                : 'linear-gradient(45deg, #1565c0 30%, #0d47a1 90%)',
            },
            '&:disabled': {
              background: theme.palette.action.disabledBackground,
              color: theme.palette.action.disabled,
            },
            borderRadius: 2,
            textTransform: 'none',
            fontSize: '1rem',
            fontWeight: 600,
          }}
        >
          {isLoggingOut ? t('auth.logout.processing') : t('auth.logout.confirm')}
        </Button>

        <Button
          variant="outlined"
          size="large"
          onClick={handleCancel}
          disabled={isLoggingOut}
          fullWidth
          sx={{
            height: 48,
            borderColor: 'primary.main',
            color: 'primary.main',
            textTransform: 'none',
            fontSize: '1rem',
            fontWeight: 600,
            borderRadius: 2,
            '&:hover': {
              borderColor: 'primary.dark',
              backgroundColor: theme.palette.mode === 'dark'
                ? 'rgba(144, 202, 249, 0.08)'
                : 'rgba(25, 118, 210, 0.04)',
              color: 'primary.dark',
            },
            '&:disabled': {
              borderColor: theme.palette.action.disabled,
              color: theme.palette.action.disabled,
            },
          }}
        >
          {t('common.cancel')}
        </Button>
      </Box>

      <Box sx={{ mt: 3, textAlign: 'center' }}>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {t('auth.logout.note')}
        </Typography>
      </Box>
    </AuthLayout>
  );
};

export default LogoutPage;
