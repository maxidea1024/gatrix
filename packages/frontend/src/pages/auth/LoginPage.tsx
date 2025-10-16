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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Google,
  GitHub,
  Login as LoginIcon,
  Apple,
  Warning,
  Cancel,
  CheckCircle,
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
import { devLogger } from '@/utils/logger';

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
  const { login, isLoading, error, clearError, isAuthenticated, user } = useAuth();
  const { t } = useTranslation();

  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null); // 'google', 'github', 'qq', etc.
  const [showRememberMeWarning, setShowRememberMeWarning] = useState(false);
  const [pendingRememberMe, setPendingRememberMe] = useState(false);

  const from = (location.state as any)?.from?.pathname || '/dashboard';

  // Check if already authenticated and redirect
  useEffect(() => {
    devLogger.debug('[LoginPage] Auth state check:', {
      isAuthenticated,
      isLoading,
      hasUser: !!user,
      userStatus: user?.status,
      hasToken: !!localStorage.getItem('accessToken'),
      hasStoredUser: !!localStorage.getItem('user')
    });

    if (!isLoading && isAuthenticated && user?.status === 'active') {
      devLogger.info('[LoginPage] User already authenticated, redirecting to:', from);
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, isLoading, user, from, navigate]);

  // Check for OAuth error in URL params
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const oauthError = urlParams.get('error');

    if (oauthError === 'oauth_failed') {
      setLoginError(t('auth.errors.oauthFailed'));
      // Clear the error from URL
      navigate(location.pathname, { replace: true });
    } else if (oauthError === 'oauth_timeout') {
      setLoginError(t('auth.errors.oauthTimeout'));
      // Clear the error from URL
      navigate(location.pathname, { replace: true });
    }

    // OAuth 로딩 상태 초기화
    setOauthLoading(null);
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
    setValue,
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

    // 기억된 이메일과 설정이 모두 있을 때만 폼에 설정
    if (rememberedEmail && isRememberMeEnabled) {
      reset({
        email: rememberedEmail,
        password: '',
        rememberMe: true,
      });
    } else {
      // 기억된 설정이 없거나 불일치하면 초기화
      reset({
        email: '',
        password: '',
        rememberMe: false,
      });
    }
  }, [reset]);

  // Re-validate form when language changes
  useEffect(() => {
    clearErrors();
    trigger();
  }, [clearErrors, trigger, t]);

  const onSubmit = async (data: LoginCredentials & { rememberMe: boolean }) => {
    devLogger.debug('[LoginPage] onSubmit called with data:', {
      email: data.email,
      hasPassword: !!data.password,
      passwordLength: data.password?.length || 0
    });

    // Validate data before proceeding
    if (!data.email || !data.password) {
      devLogger.error('[LoginPage] Missing email or password');
      return;
    }

    try {
      setLoginError(null);
      clearError();

      devLogger.debug('[LoginPage] Starting login...');
      // 최소 2초 대기
      const startTime = Date.now();

      const loginPromise = login({
        email: data.email,
        password: data.password,
        rememberMe: data.rememberMe,
      });

      // 최소 2초가 지나지 않았다면 추가 대기
      const elapsed = Date.now() - startTime;
      if (elapsed < 2000) {
        await Promise.all([
          loginPromise,
          new Promise(resolve => setTimeout(resolve, 2000 - elapsed))
        ]);
      } else {
        await loginPromise;
      }

      devLogger.info('[LoginPage] Login successful, navigating to:', from);
      navigate(from, { replace: true });
    } catch (err: any) {
      devLogger.error('[LoginPage] Login error:', err);

      // Handle network errors explicitly
      if (err.message === 'Network Error' || err.code === 'ERR_NETWORK' || !err.status) {
        const networkError = t('auth.errors.networkError') || '서버에 연결할 수 없습니다. 네트워크 연결을 확인하거나 잠시 후 다시 시도해주세요.';
        setLoginError(networkError);
        return;
      }

      // Check if the error is about user not found
      if (err.status === 404 ||
          err.message === 'USER_NOT_FOUND' ||
          (err.error?.message === 'USER_NOT_FOUND')) {
        // Show error message for user not found
        const errorMsg = t('auth.errors.userNotFound');
        setLoginError(errorMsg);
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

  const handleOAuthLogin = async (provider: string, authUrl: string) => {
    setOauthLoading(provider);
    setLoginError(null);

    // 최소 2초 대기
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 타임아웃 설정 (30초)
    const timeout = setTimeout(() => {
      setOauthLoading(null);
      setLoginError(t('auth.errors.oauthTimeout'));
    }, 30000);

    // 페이지 이동 전에 타임아웃 정보를 sessionStorage에 저장
    sessionStorage.setItem('oauthTimeout', timeout.toString());
    sessionStorage.setItem('oauthProvider', provider);

    window.location.href = authUrl;
  };

  const handleGoogleLogin = () => {
    handleOAuthLogin('google', AuthService.getGoogleAuthUrl());
  };

  const handleGitHubLogin = () => {
    handleOAuthLogin('github', AuthService.getGitHubAuthUrl());
  };

  const handleQQLogin = () => {
    handleOAuthLogin('qq', AuthService.getQQAuthUrl());
  };

  const handleWeChatLogin = () => {
    handleOAuthLogin('wechat', AuthService.getWeChatAuthUrl());
  };

  const handleBaiduLogin = () => {
    handleOAuthLogin('baidu', AuthService.getBaiduAuthUrl());
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  // 이메일 기억하기 체크박스 변경 핸들러
  const handleRememberMeChange = (checked: boolean, onChange: (value: boolean) => void) => {
    if (checked) {
      // 체크하려고 할 때 보안 경고 표시
      setPendingRememberMe(true);
      setShowRememberMeWarning(true);
    } else {
      // 체크 해제할 때는 즉시 적용하고 저장된 이메일도 삭제
      onChange(false);
      AuthService.clearRememberedCredentials();
    }
  };

  // 보안 경고 확인 시
  const handleRememberMeConfirm = () => {
    setValue('rememberMe', true);
    setShowRememberMeWarning(false);
    setPendingRememberMe(false);
  };

  // 보안 경고 취소 시
  const handleRememberMeCancel = () => {
    setShowRememberMeWarning(false);
    setPendingRememberMe(false);
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
        {/* Error Alert - Smooth height transition */}
        {loginError && (
          <Box
            sx={{
              mb: 3,
              animation: 'slideDown 0.3s ease-in-out',
              '@keyframes slideDown': {
                from: {
                  opacity: 0,
                  transform: 'translateY(-10px)',
                  maxHeight: 0,
                },
                to: {
                  opacity: 1,
                  transform: 'translateY(0)',
                  maxHeight: '200px',
                },
              },
            }}
          >
            <Alert
              severity="error"
              sx={{
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
          </Box>
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
                    checked={field.value}
                    onChange={(e) => handleRememberMeChange(e.target.checked, field.onChange)}
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
          disabled={isSubmitting || isLoading || !emailValue || !passwordValue || !!errors.email || !!errors.password}
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
          <Tooltip title={t('auth.loginWithGoogle')} arrow>
            <IconButton
              onClick={handleGoogleLogin}
              disabled={isSubmitting || isLoading || oauthLoading !== null}
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
              {oauthLoading === 'google' ? (
                <CircularProgress size={24} sx={{ color: 'white' }} />
              ) : (
                <Google sx={{ fontSize: 24 }} />
              )}
            </IconButton>
          </Tooltip>

          <Tooltip title={t('auth.loginWithGitHub')} arrow>
            <IconButton
              onClick={handleGitHubLogin}
              disabled={isSubmitting || isLoading || oauthLoading !== null}
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
              {oauthLoading === 'github' ? (
                <CircularProgress size={24} sx={{ color: 'white' }} />
              ) : (
                <GitHub sx={{ fontSize: 24 }} />
              )}
            </IconButton>
          </Tooltip>

          <Tooltip title={t('auth.loginWithQQ')} arrow>
            <IconButton
              onClick={handleQQLogin}
              disabled={isSubmitting || isLoading || oauthLoading !== null}
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
              {oauthLoading === 'qq' ? (
                <CircularProgress size={24} sx={{ color: 'white' }} />
              ) : (
                <QQIcon sx={{ fontSize: 24 }} />
              )}
            </IconButton>
          </Tooltip>

          <Tooltip title={t('auth.loginWithWeChat')} arrow>
            <span>
              <IconButton
                onClick={handleWeChatLogin}
                disabled={true} // 임시 비활성화
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  color: '#ffffff',
                  opacity: 1,
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    borderColor: 'rgba(255, 255, 255, 0.4)',
                  },
                }}
              >
                <WeChatIcon sx={{ fontSize: 24, color: 'rgba(255, 255, 255, 0.8) !important' }} />
              </IconButton>
            </span>
          </Tooltip>

          <Tooltip title={t('auth.loginWithBaidu')} arrow>
            <span>
              <IconButton
                onClick={handleBaiduLogin}
                disabled={true} // 임시 비활성화
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  color: '#ffffff',
                  opacity: 1,
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    borderColor: 'rgba(255, 255, 255, 0.4)',
                  },
                }}
              >
                <BaiduIcon sx={{ fontSize: 24, color: 'rgba(255, 255, 255, 0.8) !important' }} />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Box>

      {/* 보안 경고 대화상자 */}
      <Dialog
        open={showRememberMeWarning}
        onClose={handleRememberMeCancel}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: 'rgba(30, 30, 30, 0.95)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: 'white',
          }
        }}
      >
        <DialogTitle sx={{
          color: '#ff9800',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          <Warning /> {t('auth.rememberMeWarning.title')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: 'rgba(255, 255, 255, 0.9)', mb: 2 }}>
            {t('auth.rememberMeWarning.message')}
          </DialogContentText>
          <Alert
            severity="warning"
            sx={{
              backgroundColor: 'rgba(255, 152, 0, 0.1)',
              color: '#ffb74d',
              border: '1px solid rgba(255, 152, 0, 0.2)',
              '& .MuiAlert-icon': {
                color: '#ffb74d'
              }
            }}
          >
            {t('auth.rememberMeWarning.publicDevice')}
          </Alert>
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 1 }}>
          <Button
            onClick={handleRememberMeCancel}
            variant="outlined"
            startIcon={<Cancel />}
            sx={{
              borderColor: 'rgba(255, 255, 255, 0.3)',
              color: 'rgba(255, 255, 255, 0.8)',
              '&:hover': {
                borderColor: 'rgba(255, 255, 255, 0.5)',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
              }
            }}
          >
            {t('auth.rememberMeWarning.cancel')}
          </Button>
          <Button
            onClick={handleRememberMeConfirm}
            variant="contained"
            startIcon={<CheckCircle />}
            sx={{
              background: 'linear-gradient(45deg, #667eea 30%, #764ba2 90%)',
              '&:hover': {
                background: 'linear-gradient(45deg, #5a6fd8 30%, #6a4190 90%)',
              }
            }}
          >
            {t('auth.rememberMeWarning.understand')}
          </Button>
        </DialogActions>
      </Dialog>
    </AuthLayout>
  );
};

export default LoginPage;
