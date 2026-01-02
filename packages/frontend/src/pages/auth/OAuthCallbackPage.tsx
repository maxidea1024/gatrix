import React, { useEffect } from 'react';
import {
  Box,
  CircularProgress,
  Typography,
} from '@mui/material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthService } from '@/services/auth';

const OAuthCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();

  useEffect(() => {
    // 타임아웃 설정 (30초)
    const timeout = setTimeout(() => {
      navigate('/login?error=oauth_timeout', { replace: true });
    }, 30000);

    const handleCallback = async () => {
      try {
        // 성공 시 타임아웃 클리어
        clearTimeout(timeout);

        // Get token from URL parameters
        const token = searchParams.get('token');

        if (!token) {
          // No token, redirect to login with error
          navigate('/login?error=oauth_failed', { replace: true });
          return;
        }

        // Store the token
        localStorage.setItem('accessToken', token);

        // Initialize API service with the token
        AuthService.initializeAuth();

        // Get user profile to determine where to redirect
        const user = await AuthService.getProfile();

        // Store user data in localStorage
        localStorage.setItem('user', JSON.stringify(user));

        // Redirect based on user status
        if (user.status === 'pending') {
          window.location.href = '/auth/pending';
        } else if (user.status === 'suspended') {
          window.location.href = '/account-suspended';
        } else if (user.status === 'active') {
          window.location.href = '/dashboard';
        } else {
          // Unknown status, redirect to login
          window.location.href = '/login';
        }
      } catch (error) {
        console.error('OAuth callback error:', error);
        clearTimeout(timeout);
        navigate('/login?error=oauth_failed', { replace: true });
      }
    };

    handleCallback();

    // 컴포넌트 언마운트 시 타임아웃 클리어
    return () => {
      clearTimeout(timeout);
    };
  }, [navigate, searchParams]);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'background.default',
        p: 2,
      }}
    >
      <CircularProgress size={60} sx={{ mb: 3 }} />
      <Typography variant="h6" color="text.secondary">
        {t('auth.processingLogin')}
      </Typography>
    </Box>
  );
};

export default OAuthCallbackPage;
