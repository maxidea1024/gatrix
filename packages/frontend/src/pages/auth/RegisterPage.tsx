import React, { useState, useMemo, useEffect } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Link,
  CircularProgress,
  IconButton,
  InputAdornment,
  Divider,
  Alert,
  Tooltip,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  PersonAdd,
  Google,
  GitHub,
} from '@mui/icons-material';
import QQIcon from '@/components/icons/QQIcon';
import WeChatIcon from '@/components/icons/WeChatIcon';
import BaiduIcon from '@/components/icons/BaiduIcon';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useNavigate, useLocation, Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { RegisterData } from '@/types';
import { LanguageSelector } from '@/components/LanguageSelector';
import { toast } from 'react-toastify';
import AuthLayout from '../../components/auth/AuthLayout';

// Validation schema - will be created inside component to access t function

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { register, isLoading, error, clearError } = useAuth();
  const { t } = useTranslation();

  // Get email from location state if coming from signup prompt
  const prefilledEmail = (location.state as any)?.email || '';
  const fromPrompt = (location.state as any)?.fromPrompt || false;

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [registerSuccess, setRegisterSuccess] = useState(false);

  // Validation schema with translations
  const registerSchema = useMemo(() => yup.object({
    name: yup
      .string()
      .min(2, t('auth.nameMinLength'))
      .max(100, t('auth.nameMaxLength'))
      .required(t('auth.nameRequired')),
    email: yup
      .string()
      .email(t('auth.emailInvalid'))
      .required(t('auth.emailRequired')),
    password: yup
      .string()
      .min(6, t('auth.passwordMinLength'))
      .required(t('auth.passwordRequired')),
    confirmPassword: yup
      .string()
      .oneOf([yup.ref('password')], t('auth.passwordsNotMatch'))
      .required(t('auth.confirmPasswordRequired')),
  }), [t]);

  const resolver = useMemo(() => yupResolver(registerSchema), [registerSchema]);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting, touchedFields, isValid },
    trigger,
    reset,
    clearErrors,
  } = useForm<RegisterData & { confirmPassword: string }>({
    resolver,
    mode: 'onTouched', // 필드를 터치한 후에만 검증
    defaultValues: {
      name: '',
      email: prefilledEmail,
      password: '',
      confirmPassword: '',
    },
  });

  // Re-validate form when language changes
  useEffect(() => {
    clearErrors();
    trigger();
  }, [clearErrors, trigger, t]);

  const onSubmit = async (data: RegisterData & { confirmPassword: string }) => {
    try {
      setRegisterError(null);
      clearError();

      await register({
        name: data.name,
        email: data.email,
        password: data.password,
      });

      setRegisterSuccess(true);
      toast.success(t('auth.registerSuccess'));
    } catch (err: any) {
      const errorMessage = err.message || t('auth.registerFailed');
      setRegisterError(errorMessage);
      toast.error(errorMessage);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const toggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };

  // OAuth handlers
  const handleGoogleLogin = () => {
    window.location.href = '/api/v1/auth/google';
  };

  const handleGitHubLogin = () => {
    window.location.href = '/api/v1/auth/github';
  };

  const handleQQLogin = () => {
    window.location.href = '/api/v1/auth/qq';
  };

  const handleWeChatLogin = () => {
    // 임시 비활성화
    console.log('WeChat login not available yet');
  };

  const handleBaiduLogin = () => {
    // 임시 비활성화
    console.log('Baidu login not available yet');
  };

  if (registerSuccess) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          p: 2,
        }}
      >
        <Card sx={{ maxWidth: 400, width: '100%' }}>
          <CardContent sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h4" component="h1" gutterBottom color="success.main">
              {t('auth.registerSuccess')}
            </Typography>
            <Typography variant="body1" paragraph>
              {t('auth.registerSuccessDescription')}
            </Typography>
            <Button
              variant="contained"
              onClick={() => navigate('/login')}
              sx={{ mt: 2 }}
            >
              {t('auth.signIn')}
            </Button>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <AuthLayout
      title={t('auth.createAccount')}
      leftContent={{
        title: t('auth.joinTitle'),
        subtitle: 'GATRIX',
        description: t('auth.joinDescription')
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



      {/* Register Form */}
      <Box component="form" onSubmit={handleSubmit(onSubmit)} autoComplete="off">
        {/* Error Alert */}
        {registerError && (
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
            onClose={() => setRegisterError(null)}
          >
            {registerError}
          </Alert>
        )}

        {/* Name Field */}
        <Controller
          name="name"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              fullWidth
              label={`${t('auth.name')} *`}
              helperText={errors.name?.message || t('auth.nameHelp')}
              autoComplete="name"
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
                '& .MuiFormHelperText-root': {
                  color: errors.name ? 'rgba(255, 182, 193, 0.8)' : 'rgba(255, 255, 255, 0.6)',
                },
              }}
            />
          )}
        />

        {/* Email Field */}
        <Controller
          name="email"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              fullWidth
              label={`${t('auth.email')} *`}
              type="email"
              helperText={errors.email?.message || t('auth.emailHelp')}
              autoComplete="email"
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
                '& .MuiFormHelperText-root': {
                  color: errors.email ? 'rgba(255, 182, 193, 0.8)' : 'rgba(255, 255, 255, 0.6)',
                },
              }}
            />
          )}
        />

        {/* Password Field */}
        <Controller
          name="password"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              fullWidth
              label={`${t('auth.password')} *`}
              type={showPassword ? 'text' : 'password'}
              helperText={errors.password?.message || t('auth.passwordHelp')}
              autoComplete="new-password"
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
                '& .MuiFormHelperText-root': {
                  color: errors.password ? 'rgba(255, 182, 193, 0.8)' : 'rgba(255, 255, 255, 0.6)',
                },
              }}
              inputProps={{
                autoComplete: 'new-password',
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

        {/* Confirm Password Field */}
        <Controller
          name="confirmPassword"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              fullWidth
              label={`${t('auth.confirmPassword')} *`}
              type={showConfirmPassword ? 'text' : 'password'}
              helperText={errors.confirmPassword?.message || t('auth.confirmPasswordHelp')}
              autoComplete="new-password"
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
                '& .MuiFormHelperText-root': {
                  color: errors.confirmPassword ? 'rgba(255, 182, 193, 0.8)' : 'rgba(255, 255, 255, 0.6)',
                },
              }}
              inputProps={{
                autoComplete: 'new-password',
                'data-lpignore': 'true',
                'data-form-type': 'other',
              }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="toggle confirm password visibility"
                      onClick={toggleConfirmPasswordVisibility}
                      edge="end"
                      sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
                    >
                      {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          )}
        />

        <Button
          type="submit"
          fullWidth
          variant="contained"
          size="large"
          disabled={isSubmitting || isLoading || !isValid}
          startIcon={isSubmitting || isLoading ? <CircularProgress size={20} /> : <PersonAdd />}
          sx={{
            mt: 3,
            mb: 2,
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
          {isSubmitting || isLoading ? t('auth.creatingAccount') : t('auth.createAccount')}
        </Button>

        {/* Login Link */}
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
            {t('auth.alreadyHaveAccount')}{' '}
            <Link
              component={RouterLink}
              to="/login"
              sx={{
                color: '#667eea',
                textDecoration: 'none',
                '&:hover': {
                  textDecoration: 'underline'
                }
              }}
            >
              {t('auth.signIn')}
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
          <Tooltip title={t('auth.signUpWithGoogle')} arrow>
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

          <Tooltip title={t('auth.signUpWithGitHub')} arrow>
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

          <Tooltip title={t('auth.signUpWithQQ')} arrow>
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

          <Tooltip title={t('auth.signUpWithWeChat')} arrow>
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

          <Tooltip title={t('auth.signUpWithBaidu')} arrow>
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
    </AuthLayout>
  );
};

export default RegisterPage;
