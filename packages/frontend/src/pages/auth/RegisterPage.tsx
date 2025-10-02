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
  Card,
  CardContent,
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
import { useSnackbar } from 'notistack';
import AuthLayout from '../../components/auth/AuthLayout';
import { invitationService } from '../../services/invitationService';
import { Invitation } from '../../types/invitation';

// Validation schema - will be created inside component to access t function

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { register, isLoading, error, clearError } = useAuth();
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  // Get email from location state if coming from signup prompt
  const prefilledEmail = (location.state as any)?.email || '';
  const fromPrompt = (location.state as any)?.fromPrompt || false;

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [registerSuccess, setRegisterSuccess] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null); // 'google', 'github', 'qq', etc.
  const [isShaking, setIsShaking] = useState(false);
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);

  // 초대 관련 상태
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [invitationLoading, setInvitationLoading] = useState(false);
  const [invitationError, setInvitationError] = useState<string | null>(null);

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
    watch,
  } = useForm<RegisterData & { confirmPassword: string }>({
    resolver,
    mode: 'onChange', // 실시간 검증을 위해 onChange로 변경
    defaultValues: {
      name: '',
      email: prefilledEmail,
      password: '',
      confirmPassword: '',
    },
  });

  // Watch password for real-time confirmation validation
  const watchedPassword = watch('password');

  // Re-validate form when language changes
  useEffect(() => {
    clearErrors();
    trigger();
  }, [clearErrors, trigger, t]);

  // Re-validate confirm password when password changes
  useEffect(() => {
    if (watchedPassword) {
      trigger('confirmPassword');
    }
  }, [watchedPassword, trigger]);

  // 초대 토큰 확인
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const token = urlParams.get('invite');

    if (token) {
      setInviteToken(token);
      validateInvitation(token);
    }
  }, [location.search]);

  const validateInvitation = async (token: string) => {
    setInvitationLoading(true);
    setInvitationError(null);

    try {
      const result = await invitationService.validateInvitation(token);
      if (result.valid && result.invitation) {
        setInvitation(result.invitation);
        // 초대받은 경우 이메일 필드를 미리 채움 (있는 경우)
        if (result.invitation.email) {
          setValue('email', result.invitation.email);
        }
      } else {
        // 초대 링크가 유효하지 않은 경우 전용 페이지로 리다이렉트
        navigate('/invalid-invite', { replace: true });
      }
    } catch (error: any) {
      console.error('Failed to validate invitation:', error);
      // 404나 기타 에러의 경우도 유효하지 않은 초대로 처리
      if (error.status === 404 || error.status === 400) {
        navigate('/invalid-invite', { replace: true });
      } else {
        setInvitationError(error.message || t('auth.invitation.checkFailed'));
      }
    } finally {
      setInvitationLoading(false);
    }
  };

  // Function to get translated error message
  const getRegisterErrorMessage = (error: any): string => {
    if (!error) return t('auth.errors.registrationFailed');

    const errorCode = error.message || error.error?.message || '';
    const status = error.status;

    // Map backend error codes to translation keys
    const errorMap: { [key: string]: string } = {
      'EMAIL_ALREADY_EXISTS': t('auth.errors.emailAlreadyExists'),
      'User with this email already exists': t('auth.errors.emailAlreadyExists'), // Legacy message
      'REGISTRATION_FAILED': t('auth.errors.registrationFailed'),
      'INVALID_EMAIL_FORMAT': t('auth.errors.invalidEmailFormat'),
      'PASSWORD_TOO_SHORT': t('auth.errors.passwordTooShort'),
      'NAME_TOO_SHORT': t('auth.errors.nameTooShort'),
      'NAME_TOO_LONG': t('auth.errors.nameTooLong'),
      'EMAIL_REQUIRED': t('auth.errors.emailRequired'),
      'PASSWORD_REQUIRED': t('auth.errors.passwordRequired'),
      'NAME_REQUIRED': t('auth.errors.nameRequired'),
      'VALIDATION_ERROR': t('auth.errors.validationError'),
    };

    // Check for specific error codes
    if (errorMap[errorCode]) {
      return errorMap[errorCode];
    }

    // Handle status codes
    if (status === 409) {
      return t('auth.errors.emailAlreadyExists');
    } else if (status === 400) {
      return t('auth.errors.validationError');
    } else if (status === 500) {
      return t('auth.errors.registrationFailed');
    }

    // Fallback to generic error message
    return errorCode || t('auth.errors.registrationFailed');
  };

  const onSubmit = async (data: RegisterData & { confirmPassword: string }) => {
    const startTime = Date.now();

    try {
      setIsSubmittingForm(true);

      // API 호출
      if (inviteToken && invitation) {
        // 초대를 통한 가입
        await invitationService.acceptInvitation(inviteToken, {
          username: data.name,
          password: data.password,
          email: data.email,
          fullName: data.name,
        });
      } else {
        // 일반 가입
        await register({
          name: data.name,
          email: data.email,
          password: data.password,
        });
      }

      // 성공 시 최소 2초 대기
      const elapsed = Date.now() - startTime;
      const remainingTime = Math.max(0, 2000 - elapsed);
      if (remainingTime > 0) {
        await new Promise(resolve => setTimeout(resolve, remainingTime));
      }

      // 성공 시에만 에러 메시지 지우기
      setRegisterError(null);
      setRegisterSuccess(true);
      enqueueSnackbar(t('auth.registerSuccess'), { variant: 'success' });
    } catch (err: any) {
      // 에러 시에도 최소 2초 대기
      const elapsed = Date.now() - startTime;
      const remainingTime = Math.max(0, 2000 - elapsed);
      if (remainingTime > 0) {
        await new Promise(resolve => setTimeout(resolve, remainingTime));
      }

      const errorMessage = getRegisterErrorMessage(err);
      setRegisterError(errorMessage);

      // Trigger shake animation
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
    } finally {
      setIsSubmittingForm(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const toggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };

  // OAuth handlers
  const handleOAuthSignUp = async (provider: string, authUrl: string) => {
    setOauthLoading(provider);
    setRegisterError(null);

    // 최소 2초 대기
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 타임아웃 설정 (30초)
    const timeout = setTimeout(() => {
      setOauthLoading(null);
      setRegisterError(t('auth.errors.oauthTimeout'));
    }, 30000);

    // 페이지 이동 전에 타임아웃 정보를 sessionStorage에 저장
    sessionStorage.setItem('oauthTimeout', timeout.toString());
    sessionStorage.setItem('oauthProvider', provider);

    window.location.href = authUrl;
  };

  const handleGoogleLogin = () => {
    handleOAuthSignUp('google', '/api/v1/auth/google');
  };

  const handleGitHubLogin = () => {
    handleOAuthSignUp('github', '/api/v1/auth/github');
  };

  const handleQQLogin = () => {
    handleOAuthSignUp('qq', '/api/v1/auth/qq');
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
      <Box
        component="form"
        onSubmit={handleSubmit(onSubmit)}
        autoComplete="off"
      >
        {/* Invitation Status */}
        {invitationLoading && (
          <Alert severity="info" sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={16} />
              초대 링크를 확인하고 있습니다...
            </Box>
          </Alert>
        )}

        {invitation && (
          <Alert severity="success" sx={{ mb: 3 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
              {t('auth.invitation.receivedTitle')}
            </Typography>
            <Typography variant="body2">
              {t('auth.invitation.receivedDesc')}
            </Typography>
          </Alert>
        )}

        {invitationError && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {invitationError}
          </Alert>
        )}

        {/* Error Alert - 항상 공간 확보로 레이아웃 안정화 */}
        <Alert
          severity="error"
          sx={{
            mb: 3,
            backgroundColor: registerError ? 'rgba(244, 67, 54, 0.1)' : 'transparent',
            color: registerError ? '#ff6b6b' : 'transparent',
            border: registerError ? '1px solid rgba(244, 67, 54, 0.2)' : '1px solid transparent',
            opacity: registerError ? 1 : 0,
            visibility: registerError ? 'visible' : 'hidden',
            minHeight: '52px', // Alert의 기본 높이 확보
            transition: 'opacity 0.2s ease-in-out, background-color 0.2s ease-in-out, border-color 0.2s ease-in-out',
            animation: isShaking ? 'errorShake 0.5s ease-in-out' : 'none',
            '@keyframes errorShake': {
              '0%, 100%': { transform: 'translateX(0)' },
              '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-4px)' },
              '20%, 40%, 60%, 80%': { transform: 'translateX(4px)' },
            },
            '& .MuiAlert-icon': {
              color: registerError ? '#ff6b6b' : 'transparent'
            },
            '& .MuiAlert-message': {
              opacity: registerError ? 1 : 0,
            }
          }}
          onClose={registerError ? () => setRegisterError(null) : undefined}
        >
          {registerError || 'placeholder'} {/* 항상 내용이 있도록 */}
        </Alert>

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
          render={({ field }) => {
            const isPasswordMatch = field.value && watchedPassword && field.value === watchedPassword;
            const hasConfirmPasswordValue = field.value && field.value.length > 0;
            const showMatchIndicator = hasConfirmPasswordValue && watchedPassword;

            return (
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
                      borderColor: showMatchIndicator
                        ? (isPasswordMatch ? 'rgba(76, 175, 80, 0.5)' : 'rgba(244, 67, 54, 0.5)')
                        : 'rgba(255, 255, 255, 0.2)',
                    },
                    '&:hover fieldset': {
                      borderColor: showMatchIndicator
                        ? (isPasswordMatch ? 'rgba(76, 175, 80, 0.7)' : 'rgba(244, 67, 54, 0.7)')
                        : 'rgba(255, 255, 255, 0.3)',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: showMatchIndicator
                        ? (isPasswordMatch ? '#4caf50' : '#f44336')
                        : '#667eea',
                    },
                  },
                  '& .MuiInputLabel-root': {
                    color: 'rgba(255, 255, 255, 0.7)',
                  },
                  '& .MuiInputBase-input': {
                    color: 'white',
                  },
                  '& .MuiFormHelperText-root': {
                    color: errors.confirmPassword
                      ? 'rgba(255, 182, 193, 0.8)'
                      : (showMatchIndicator && isPasswordMatch
                          ? 'rgba(129, 199, 132, 0.8)'
                          : 'rgba(255, 255, 255, 0.6)'),
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
            );
          }}
        />

        <Button
          type="submit"
          fullWidth
          variant="contained"
          size="large"
          disabled={isSubmitting || isLoading || isSubmittingForm || !isValid}
          startIcon={isSubmitting || isLoading || isSubmittingForm ? <CircularProgress size={20} /> : <PersonAdd />}
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
          {t('auth.createAccount')}
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

          <Tooltip title={t('auth.signUpWithGitHub')} arrow>
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

          <Tooltip title={t('auth.signUpWithQQ')} arrow>
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
