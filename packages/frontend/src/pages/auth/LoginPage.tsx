import React, { useState, useMemo, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
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
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Google,
  GitHub,
  Login as LoginIcon,
} from '@mui/icons-material';
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
    return '이메일 또는 비밀번호가 올바르지 않습니다.';
  }

  if (status === 404) {
    return '등록되지 않은 이메일입니다.';
  }

  if (status === 403) {
    if (errorCode === 'ACCOUNT_PENDING') {
      return '계정 승인 대기 중입니다. 관리자의 승인을 기다려주세요.';
    }
    if (errorCode === 'ACCOUNT_SUSPENDED') {
      return '계정이 일시 정지되었습니다. 관리자에게 문의하세요.';
    }
    if (errorCode.includes('not active')) {
      return '계정이 비활성화 상태입니다. 관리자에게 문의하세요.';
    }
    return '계정에 접근할 수 없습니다. 관리자에게 문의하세요.';
  }

  if (status === 429) {
    return '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.';
  }

  if (status >= 500) {
    return '서버에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.';
  }

  // 네트워크 오류
  if (error.name === 'NetworkError' || !status) {
    return '네트워크 연결을 확인하고 다시 시도해주세요.';
  }

  // 기본 메시지
  return '로그인에 실패했습니다. 다시 시도해주세요.';
};

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isLoading, error, clearError } = useAuth();
  const { t } = useTranslation();

  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const from = (location.state as any)?.from?.pathname || '/dashboard';

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

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };



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
          {/* Header */}
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Typography variant="h4" component="h1" gutterBottom>
              Gatrix
            </Typography>
            <Typography variant="h6" gutterBottom>
              {t('auth.welcomeBack')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('auth.signIn')}
            </Typography>
          </Box>



          {/* Login Form */}
          <Box component="form" onSubmit={handleSubmit(onSubmit)} autoComplete="off">
            {/* Error Alert */}
            {loginError && (
              <Alert
                severity="error"
                sx={{ mb: 2 }}
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
                  inputProps={{
                    autoComplete: 'new-password', // 브라우저 자동완성 방지
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
                  autoComplete="off"
                  inputProps={{
                    autoComplete: 'new-password', // 브라우저 자동완성 방지
                    form: {
                      autoComplete: 'off'
                    }
                  }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label="toggle password visibility"
                          onClick={togglePasswordVisibility}
                          edge="end"
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              )}
            />

            <Controller
              name="rememberMe"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={<Checkbox {...field} checked={field.value} />}
                  label={t('auth.rememberMe')}
                  sx={{ mt: 1, mb: 2 }}
                />
              )}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={isSubmitting || isLoading || !!errors.email || !!errors.password || !emailValue || !passwordValue}
              startIcon={isSubmitting || isLoading ? <CircularProgress size={20} /> : <LoginIcon />}
              sx={{ mt: 2, mb: 2 }}
            >
              {isSubmitting || isLoading ? t('auth.signingIn') : t('auth.signIn')}
            </Button>

            {/* Forgot Password Link */}
            <Box sx={{ textAlign: 'center', mb: 3 }}>
              <Link
                component={RouterLink}
                to="/forgot-password"
                variant="body2"
                color="primary"
              >
                {t('auth.forgotPassword')}
              </Link>
            </Box>

            {/* Divider */}
            <Divider sx={{ my: 3 }}>
              <Typography variant="body2" color="text.secondary">
                {t('auth.or')}
              </Typography>
            </Divider>

            {/* OAuth Buttons */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<Google />}
                onClick={handleGoogleLogin}
                disabled={isSubmitting || isLoading}
              >
                {t('auth.loginWithGoogle')}
              </Button>

              <Button
                fullWidth
                variant="outlined"
                startIcon={<GitHub />}
                onClick={handleGitHubLogin}
                disabled={isSubmitting || isLoading}
              >
                {t('auth.loginWithGitHub')}
              </Button>
            </Box>

            {/* Register Link */}
            <Box sx={{ textAlign: 'center', mt: 3 }}>
              <Typography variant="body2" color="text.secondary">
                {t('auth.dontHaveAccount')}{' '}
                <Link
                  component={RouterLink}
                  to="/register"
                  color="primary"
                  fontWeight="medium"
                >
                  {t('auth.signUp')}
                </Link>
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default LoginPage;
