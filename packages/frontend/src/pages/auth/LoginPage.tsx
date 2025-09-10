import React, { useState, useMemo, useEffect } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Link,
  Divider,
  CircularProgress,
  IconButton,
  InputAdornment,
  Checkbox,
  FormControlLabel,
  Alert,
  Tooltip,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Google,
  GitHub,
  Login as LoginIcon,
  Apple,
} from '@mui/icons-material';
import QQIcon from '../../components/icons/QQIcon';
import WeChatIcon from '../../components/icons/WeChatIcon';
import BaiduIcon from '../../components/icons/BaiduIcon';
import AuthLayout from '../../components/auth/AuthLayout';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useNavigate, useLocation, Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { LoginCredentials } from '@/types';
import { AuthService } from '@/services/auth';
import { LanguageSelector } from '@/components/LanguageSelector';

// Validation schema - will be created inside component to access t function

// 사용자 친화적인 오류 메시지 함수
const getErrorMessage = (error: any, t: any): string => {
  if (!error) return '';

  const errorCode = error.message || error.error?.message || '';
  const status = error.status;

  // 상태 코드별 메시지
  if (status === 401) {
    return t('auth.errors.invalidCredentials');
  }

  if (status === 404) {
    return t('auth.errors.userNotFound');
  }

  if (status === 403) {
    if (errorCode === 'ACCOUNT_PENDING') {
      return t('auth.errors.accountPending');
    }
    if (errorCode === 'ACCOUNT_SUSPENDED') {
      return t('auth.errors.accountSuspended');
    }
    if (errorCode.includes('not active')) {
      return t('auth.errors.accountInactive');
    }
    return t('auth.errors.accessDenied');
  }

  if (status === 429) {
    return t('auth.errors.tooManyAttempts');
  }

  if (status >= 500) {
    return t('auth.errors.serverError');
  }

  // 네트워크 오류
  if (error.name === 'NetworkError' || !status) {
    return t('auth.errors.networkError');
  }

  // 기본 메시지
  return t('auth.errors.loginFailed');
};

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isLoading, error, clearError } = useAuth();
  const { t } = useTranslation();

  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const from = (location.state as any)?.from?.pathname || '/dashboard';

  // Check for OAuth error in URL params
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const oauthError = urlParams.get('error');

    if (oauthError === 'oauth_failed') {
      setLoginError(t('auth.errors.oauthFailed'));
      // Clear the error from URL
      navigate(location.pathname, { replace: true });
    }
  }, [location.search, location.pathname, navigate, t]);

  // Validation schema with translations
  const loginSchema = useMemo(() => yup.object({
    email: yup
      .string()
      .email(t('auth.emailInvalid'))
      .required(t('auth.emailRequired')),
    password: yup
      .string()
      .min(6, t('auth.passwordMinLength'))
      .required(t('auth.passwordRequired')),
    rememberMe: yup.boolean(),
  }), [t]);

  const resolver = useMemo(() => yupResolver(loginSchema), [loginSchema]);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting, touchedFields, isValid },
    trigger,
    reset,
    clearErrors,
    watch,
  } = useForm<LoginCredentials & { rememberMe: boolean }>({
    resolver,
    mode: 'onChange', // 실시간 validation 활성화
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
  });

  // 현재 이메일 값 감시
  const emailValue = watch('email') || '';
  const passwordValue = watch('password') || '';

  // Initialize form with remembered credentials
  useEffect(() => {
    const rememberedEmail = AuthService.getRememberedEmail();
    const isRememberMeEnabled = AuthService.isRememberMeEnabled();

    if (rememberedEmail && isRememberMeEnabled) {
      reset({
        email: rememberedEmail,
        password: '',
        rememberMe: true,
      });
    }
  }, [reset]);

  // Re-validate form when language changes
  useEffect(() => {
    clearErrors();
    trigger();
  }, [clearErrors, trigger, t]);

  const onSubmit = async (data: LoginCredentials & { rememberMe: boolean }) => {
    try {
      setLoginError(null);
      clearError();

      await login({
        email: data.email,
        password: data.password,
        rememberMe: data.rememberMe,
      });

      navigate(from, { replace: true });
    } catch (err: any) {
      // Check if the error is about user not found
      if (err.status === 404 ||
          err.message === 'USER_NOT_FOUND' ||
          (err.error?.message === 'USER_NOT_FOUND')) {
        // Navigate to signup prompt page with email
        navigate('/signup-prompt', {
          state: {
            email: data.email
          }
        });
      } else if (err.status === 403) {
        // Check specific account status
        if (err.message === 'ACCOUNT_PENDING' || err.error?.message === 'ACCOUNT_PENDING') {
          // Account is pending approval
          navigate('/pending-approval', {
            state: {
              email: data.email
            }
          });
        } else if (err.message === 'ACCOUNT_SUSPENDED' || err.error?.message === 'ACCOUNT_SUSPENDED') {
          // Account is suspended
          navigate('/account-suspended');
        } else if (err.message?.includes('not active') || err.error?.message?.includes('not active')) {
          // Generic not active (fallback)
          navigate('/pending-approval', {
            state: {
              email: data.email
            }
          });
        } else {
          const errorMessage = getErrorMessage(err, t);
          setLoginError(errorMessage);
        }
      } else {
        const errorMessage = getErrorMessage(err, t);
        setLoginError(errorMessage);
      }
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = AuthService.getGoogleAuthUrl();
  };

  const handleGitHubLogin = () => {
    window.location.href = AuthService.getGitHubAuthUrl();
  };

  const handleQQLogin = () => {
    window.location.href = AuthService.getQQAuthUrl();
  };

  const handleWeChatLogin = () => {
    window.location.href = AuthService.getWeChatAuthUrl();
  };

  const handleBaiduLogin = () => {
    window.location.href = AuthService.getBaiduAuthUrl();
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };



  return (
    <AuthLayout
      title={t('auth.signIn')}
      subtitle={t('auth.welcomeBack')}
      leftContent={{
        title: t('auth.welcomeTitle'),
        subtitle: '',
        description: t('auth.welcomeDescription')
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



      {/* Login Form */}
      <Box component="form" onSubmit={handleSubmit(onSubmit)} autoComplete="off">
        {/* Error Alert */}
        {loginError && (
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
            onClose={() => setLoginError(null)}
          >
            {loginError}
          </Alert>
        )}

        <Controller
          name="email"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              fullWidth
              label={t('auth.email')}
              type="email"
              error={!!errors.email}
              helperText={errors.email?.message || ''}
              margin="normal"
              autoComplete="off"
              autoFocus
              sx={{
                mb: 2,
                '& .MuiOutlinedInput-root': {
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  '& fieldset': {
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                  },
                  '&:hover fieldset': {
                    borderColor: 'rgba(255, 255, 255, 0.3)',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#667eea',
                  },
                },
                '& .MuiInputLabel-root': {
                  color: 'rgba(255, 255, 255, 0.7)',
                },
                '& .MuiInputBase-input': {
                  color: 'white',
                },
              }}
              inputProps={{
                autoComplete: 'new-password',
                form: {
                  autoComplete: 'off'
                }
              }}
            />
          )}
        />

        <Controller
          name="password"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              fullWidth
              label={t('auth.password')}
              type={showPassword ? 'text' : 'password'}
              error={false}
              helperText=""
              margin="normal"
              autoComplete="current-password"
              sx={{
                mb: 2,
                '& .MuiOutlinedInput-root': {
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  '& fieldset': {
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                  },
                  '&:hover fieldset': {
                    borderColor: 'rgba(255, 255, 255, 0.3)',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#667eea',
                  },
                },
                '& .MuiInputLabel-root': {
                  color: 'rgba(255, 255, 255, 0.7)',
                },
                '& .MuiInputBase-input': {
                  color: 'white',
                },
              }}
              inputProps={{
                autoComplete: 'current-password',
                'data-lpignore': 'true',
                'data-form-type': 'other',
              }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="toggle password visibility"
                      onClick={togglePasswordVisibility}
                      edge="end"
                      sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          )}
        />

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Controller
            name="rememberMe"
            control={control}
            render={({ field }) => (
              <FormControlLabel
                control={
                  <Checkbox
                    {...field}
                    checked={field.value}
                    sx={{
                      color: 'rgba(255, 255, 255, 0.7)',
                      '&.Mui-checked': {
                        color: '#667eea',
                      },
                    }}
                  />
                }
                label={
                  <Typography sx={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.875rem' }}>
                    {t('auth.rememberMe')}
                  </Typography>
                }
              />
            )}
          />

          <Link
            component={RouterLink}
            to="/forgot-password"
            sx={{
              color: 'rgba(255, 255, 255, 0.7)',
              textDecoration: 'none',
              fontSize: '0.875rem',
              '&:hover': {
                color: '#667eea',
              }
            }}
          >
            {t('auth.forgotPassword')}
          </Link>
        </Box>

        <Button
          type="submit"
          fullWidth
          variant="contained"
          size="large"
          disabled={isSubmitting || isLoading || !!errors.email || !!errors.password || !emailValue || !passwordValue}
          startIcon={isSubmitting || isLoading ? <CircularProgress size={20} /> : <LoginIcon />}
          sx={{
            mt: 1,
            mb: 3,
            height: 48,
            background: 'linear-gradient(45deg, #667eea 30%, #764ba2 90%)',
            '&:hover': {
              background: 'linear-gradient(45deg, #5a6fd8 30%, #6a4190 90%)',
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
          {isSubmitting || isLoading ? t('auth.signingIn') : t('auth.signIn')}
        </Button>

        {/* Register Link */}
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
            {t('auth.dontHaveAccount')}{' '}
            <Link
              component={RouterLink}
              to="/register"
              sx={{
                color: '#667eea',
                textDecoration: 'none',
                '&:hover': {
                  textDecoration: 'underline'
                }
              }}
            >
              {t('auth.signUp')}
            </Link>
          </Typography>
        </Box>

        {/* Divider */}
        <Divider sx={{
          my: 3,
          '&::before, &::after': {
            borderColor: 'rgba(255, 255, 255, 0.3)',
          }
        }}>
          <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
            {t('auth.or')}
          </Typography>
        </Divider>

        {/* OAuth Buttons */}
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Tooltip title="Google로 로그인" arrow>
            <IconButton
              onClick={handleGoogleLogin}
              disabled={isSubmitting || isLoading}
              sx={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: 'white',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.15)',
                  borderColor: 'rgba(255, 255, 255, 0.3)',
                },
                '&:disabled': {
                  opacity: 0.7,
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  borderColor: 'rgba(255, 255, 255, 0.15)',
                  color: 'rgba(255, 255, 255, 0.6)',
                },
              }}
            >
              <Google sx={{ fontSize: 24 }} />
            </IconButton>
          </Tooltip>

          <Tooltip title="GitHub로 로그인" arrow>
            <IconButton
              onClick={handleGitHubLogin}
              disabled={isSubmitting || isLoading}
              sx={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: 'white',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.15)',
                  borderColor: 'rgba(255, 255, 255, 0.3)',
                },
                '&:disabled': {
                  opacity: 0.7,
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  borderColor: 'rgba(255, 255, 255, 0.15)',
                  color: 'rgba(255, 255, 255, 0.6)',
                },
              }}
            >
              <GitHub sx={{ fontSize: 24 }} />
            </IconButton>
          </Tooltip>

          <Tooltip title="QQ로 로그인" arrow>
            <IconButton
              onClick={handleQQLogin}
              disabled={isSubmitting || isLoading}
              sx={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: 'white',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.15)',
                  borderColor: 'rgba(255, 255, 255, 0.3)',
                },
                '&:disabled': {
                  opacity: 0.7,
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  borderColor: 'rgba(255, 255, 255, 0.15)',
                  color: 'rgba(255, 255, 255, 0.6)',
                },
              }}
            >
              <QQIcon sx={{ fontSize: 24 }} />
            </IconButton>
          </Tooltip>

          <Tooltip title="WeChat로 로그인 (준비중)" arrow>
            <span>
              <IconButton
                onClick={handleWeChatLogin}
                disabled={true} // 임시 비활성화
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: 'rgba(255, 255, 255, 0.7)',
                  opacity: 0.9,
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    borderColor: 'rgba(255, 255, 255, 0.4)',
                  },
                }}
              >
                <WeChatIcon sx={{ fontSize: 24 }} />
              </IconButton>
            </span>
          </Tooltip>

          <Tooltip title="Baidu로 로그인 (준비중)" arrow>
            <span>
              <IconButton
                onClick={handleBaiduLogin}
                disabled={true} // 임시 비활성화
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: 'rgba(255, 255, 255, 0.7)',
                  opacity: 0.9,
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    borderColor: 'rgba(255, 255, 255, 0.4)',
                  },
                }}
              >
                <BaiduIcon sx={{ fontSize: 24 }} />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Box>
    </AuthLayout>
  );
};

export default LoginPage;
