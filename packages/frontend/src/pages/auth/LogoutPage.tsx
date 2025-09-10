import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Alert,
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
  
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutComplete, setLogoutComplete] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      setLogoutError(null);
      
      await logout();
      
      setLogoutComplete(true);
      enqueueSnackbar(t('auth.logout.success'), { variant: 'success' });
      
      // 2초 후 로그인 페이지로 이동
      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 2000);
      
    } catch (error: any) {
      console.error('Logout failed:', error);
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
      <AuthLayout
        title={t('auth.logout.completed')}
        subtitle={t('auth.logout.redirecting')}
        showLeftPanel={false}
      >
        <Box sx={{
          textAlign: 'center',
          py: 4,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <CheckCircleIcon
            sx={{
              fontSize: 64,
              color: '#4caf50',
              mb: 3
            }}
          />
          <Box sx={{ mt: 2 }}>
            <CircularProgress size={24} sx={{ color: 'white' }} />
          </Box>
        </Box>
      </AuthLayout>
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
            color: '#ff9800',
            mb: 3
          }}
        />
      </Box>

      {logoutError && (
        <Alert
          severity="error"
          sx={{
            mb: 3,
            backgroundColor: 'rgba(244, 67, 54, 0.1)',
            color: '#ff6b6b',
            border: '1px solid rgba(244, 67, 54, 0.2)',
            '& .MuiAlert-icon': {
              color: '#ff6b6b'
            }
          }}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={handleRetry}
              disabled={isLoggingOut}
              sx={{ color: '#ff6b6b' }}
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
          startIcon={isLoggingOut ? <CircularProgress size={20} /> : <LogoutIcon />}
          fullWidth
          sx={{
            height: 48,
            background: 'linear-gradient(45deg, #2563eb 30%, #3b82f6 90%)',
            '&:hover': {
              background: 'linear-gradient(45deg, #1d4ed8 30%, #2563eb 90%)',
            },
            '&:disabled': {
              background: 'rgba(255, 255, 255, 0.1)',
              color: 'rgba(255, 255, 255, 0.3)',
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
            borderColor: 'rgba(255, 255, 255, 0.2)',
            color: 'rgba(255, 255, 255, 0.7)',
            textTransform: 'none',
            fontSize: '1rem',
            fontWeight: 600,
            borderRadius: 2,
            '&:hover': {
              borderColor: 'rgba(255, 255, 255, 0.3)',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              color: 'white',
            },
            '&:disabled': {
              opacity: 0.5,
            },
          }}
        >
          {t('common.cancel')}
        </Button>
      </Box>

      <Box sx={{ mt: 3, textAlign: 'center' }}>
        <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
          {t('auth.logout.note')}
        </Typography>
      </Box>
    </AuthLayout>
  );
};

export default LogoutPage;
