import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  CircularProgress,
  Stack,
  Divider,
  Alert,
} from '@mui/material';
import {
  Logout as LogoutIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import { useSnackbar } from 'notistack';
import { LanguageSelector } from '@/components/LanguageSelector';

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
          <LanguageSelector variant="icon" size="medium" />
        </Box>

        <Card sx={{ maxWidth: 400, width: '100%' }}>
          <CardContent sx={{ textAlign: 'center', py: 4 }}>
            <CheckCircleIcon 
              sx={{ 
                fontSize: 64, 
                color: 'success.main', 
                mb: 2 
              }} 
            />
            <Typography variant="h5" gutterBottom>
              {t('auth.logout.completed')}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              {t('auth.logout.redirecting')}
            </Typography>
            <CircularProgress size={24} />
          </CardContent>
        </Card>
      </Box>
    );
  }

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
        <LanguageSelector variant="icon" size="medium" />
      </Box>

      <Card sx={{ maxWidth: 400, width: '100%' }}>
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <LogoutIcon 
              sx={{ 
                fontSize: 64, 
                color: 'warning.main', 
                mb: 2 
              }} 
            />
            <Typography variant="h5" gutterBottom>
              {t('auth.logout.title')}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {t('auth.logout.confirmation', { name: user?.name || t('common.user') })}
            </Typography>
          </Box>

          {logoutError && (
            <Alert 
              severity="error" 
              sx={{ mb: 3 }}
              action={
                <Button 
                  color="inherit" 
                  size="small" 
                  onClick={handleRetry}
                  disabled={isLoggingOut}
                >
                  {t('common.retry')}
                </Button>
              }
            >
              {logoutError}
            </Alert>
          )}

          <Divider sx={{ my: 3 }} />

          <Stack spacing={2}>
            <Button
              variant="contained"
              color="warning"
              size="large"
              onClick={handleLogout}
              disabled={isLoggingOut}
              startIcon={isLoggingOut ? <CircularProgress size={20} /> : <LogoutIcon />}
              fullWidth
            >
              {isLoggingOut ? t('auth.logout.processing') : t('auth.logout.confirm')}
            </Button>
            
            <Button
              variant="outlined"
              size="large"
              onClick={handleCancel}
              disabled={isLoggingOut}
              fullWidth
            >
              {t('common.cancel')}
            </Button>
          </Stack>

          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              {t('auth.logout.note')}
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default LogoutPage;
