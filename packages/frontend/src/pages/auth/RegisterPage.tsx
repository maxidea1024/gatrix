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
  const [registeredEmail, setRegisteredEmail] = useState<string>(''); // Store registered email
  const [oauthLoading, setOauthLoading] = useState<string | null>(null); // 'google', 'github', 'qq', etc.
  const [isShaking, setIsShaking] = useState(false);
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);
  const [passwordFieldType, setPasswordFieldType] = useState<'text' | 'password'>('text'); // Start as text to prevent autofill
  const [confirmPasswordFieldType, setConfirmPasswordFieldType] = useState<'text' | 'password'>('text'); // Start as text to prevent autofill
  const isWebkit = useMemo(() => {
    if (typeof navigator === 'undefined') return true;
    return /AppleWebKit|Chrome|Safari|Edg/.test(navigator.userAgent);
  }, []);

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
      .required(t('auth.confirmPasswordRequired'))
      .test('passwords-match', t('auth.passwordsNotMatch'), function(value) {
        return this.parent.password === value;
      }),
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
    setValue,
  } = useForm<RegisterData & { confirmPassword: string }>({
    resolver,
    mode: 'onChange', // 실시간 검증을 위해 onChange로 변경
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  // Watch password for real-time confirmation validation
  const watchedPassword = watch('password');

  // Set email from location state if available
  useEffect(() => {
    if (prefilledEmail) {
      setValue('email', prefilledEmail);
    }
  }, [prefilledEmail, setValue]);

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
      setRegisteredEmail(data.email); // Save registered email
      setRegisterSuccess(true);
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
          background: (theme) => theme.palette.mode === 'dark'
            ? 'linear-gradient(135deg, #0f0f0f 0%, #050505 100%)'
            : 'linear-gradient(135deg, #9e9e9e 0%, #757575 100%)',
          p: 2,
        }}
      >
        <Card
          sx={{
            maxWidth: 400,
            width: '100%',
            animation: 'rumbleIn 0.6s ease-out',
            '@keyframes rumbleIn': {
              '0%': {
                opacity: 0,
                transform: 'scale(0.3) rotate(0deg)',
              },
              '25%': {
                transform: 'scale(1.1) rotate(-2deg)',
              },
              '35%': {
                transform: 'scale(1.05) rotate(2deg)',
              },
              '45%': {
                transform: 'scale(1.02) rotate(-1deg)',
              },
              '55%': {
                transform: 'scale(1.01) rotate(1deg)',
              },
              '65%': {
                transform: 'scale(1) rotate(-0.5deg)',
              },
              '75%': {
                transform: 'scale(1) rotate(0.5deg)',
              },
              '100%': {
                opacity: 1,
                transform: 'scale(1) rotate(0deg)',
              },
            },
          }}
        >
          <CardContent sx={{ p: 4, textAlign: 'center' }}>
            <Box
              sx={{
                mb: 2,
              }}
            >
              <Typography
                variant="h1"
                component="div"
                sx={{
                  fontSize: '3rem',
                  display: 'inline-block',
                  animation: 'bounce 1s ease-in-out infinite',
                  '@keyframes bounce': {
                    '0%, 100%': {
                      transform: 'translateY(0) scale(1)',
                    },
                    '25%': {
                      transform: 'translateY(-15px) scale(1.1)',
                    },
                    '50%': {
                      transform: 'translateY(0) scale(0.95)',
                    },
                    '75%': {
                      transform: 'translateY(-7px) scale(1.05)',
                    },
                  },
                }}
              >
                🎉
              </Typography>
            </Box>
            <Typography
              variant="h4"
              component="h1"
              gutterBottom
              color="success.main"
              sx={{
                fontWeight: 600,
                textShadow: '2px 2px 4px rgba(0, 0, 0, 0.3), 0px 0px 8px rgba(76, 175, 80, 0.4)',
                '& > span': {
                  display: 'inline-block',
                  animation: 'wave 1.5s ease-in-out infinite',
                },
                '& > span:nth-of-type(1)': { animationDelay: '0s' },
                '& > span:nth-of-type(2)': { animationDelay: '0.1s' },
                '& > span:nth-of-type(3)': { animationDelay: '0.2s' },
                '& > span:nth-of-type(4)': { animationDelay: '0.3s' },
                '& > span:nth-of-type(5)': { animationDelay: '0.4s' },
                '& > span:nth-of-type(6)': { animationDelay: '0.5s' },
                '& > span:nth-of-type(7)': { animationDelay: '0.6s' },
                '& > span:nth-of-type(8)': { animationDelay: '0.7s' },
                '& > span:nth-of-type(9)': { animationDelay: '0.8s' },
                '& > span:nth-of-type(10)': { animationDelay: '0.9s' },
                '@keyframes wave': {
                  '0%, 100%': {
                    transform: 'translateY(0px)',
                  },
                  '50%': {
                    transform: 'translateY(-5px)',
                  },
                },
              }}
            >
              {t('auth.registerSuccess').split('').map((char, index) => (
                <span key={index}>{char === ' ' ? '\u00A0' : char}</span>
              ))}
            </Typography>
            <Typography
              variant="body1"
              paragraph
              sx={{ mt: 2 }}
            >
              {t('auth.registerSuccessDescription')}
            </Typography>
            <Button
              variant="contained"
              onClick={() => navigate('/login', { state: { registeredEmail } })}
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
        {/* Hidden real-named fields to absorb browser autofill */}
        <input
          type="text"
          name="username"
          autoComplete="username"
          style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}
          tabIndex={-1}
          aria-hidden="true"
          readOnly
        />
        <input
          type="password"
          name="password"
          autoComplete="new-password"
          style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}
          tabIndex={-1}
          aria-hidden="true"
          readOnly
        />

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

        {/* Error Alert - Smooth animation without fixed height */}
        <Box
          sx={{
            mb: registerError ? 3 : 0,
            overflow: 'hidden',
            height: registerError ? 'auto' : 0,
            transition: 'all 0.3s ease-out',
          }}
        >
          {registerError && (
            <Box
              sx={{
                width: '100%',
                animation: isShaking
                  ? 'errorShake 0.5s ease-in-out forwards'
                  : 'slideDown 0.3s ease-out forwards',
                '@keyframes slideDown': {
                  from: {
                    opacity: 0,
                    transform: 'translateY(-10px)',
                  },
                  to: {
                    opacity: 1,
                    transform: 'translateY(0)',
                  },
                },
                '@keyframes errorShake': {
                  '0%, 100%': { transform: 'translateX(0)' },
                  '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-4px)' },
                  '20%, 40%, 60%, 80%': { transform: 'translateX(4px)' },
                },
              }}
            >
              <Alert
                severity="error"
                sx={{
                  width: '100%',
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
            </Box>
          )}
        </Box>

        {/* Name Field */}
        <Controller
          name="name"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              fullWidth
              label={`${t('auth.name')} *`}
              helperText={t('auth.nameHelp')}
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
                '& .MuiFormHelperText-root': {
                  minHeight: '20px',
                  display: 'block',
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
              helperText={t('auth.emailHelp')}
              autoComplete="off"
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
                  minHeight: '20px',
                  height: '20px',
                  lineHeight: '20px',
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
              type={isWebkit ? 'text' : (showPassword ? 'text' : passwordFieldType)}
              helperText={t('auth.passwordHelp')}
              autoComplete="off"
              onFocus={(e) => {
                // Remove readonly on focus to allow user input
                if (!isWebkit) {
                  setPasswordFieldType('password');
                }
                e.target.removeAttribute('readonly');
              }}
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
                  // Mask characters when using type=text on WebKit browsers
                  ...(isWebkit && !showPassword ? {
                    WebkitTextSecurity: 'disc',
                  } : {}),
                },
                '& .MuiFormHelperText-root': {
                  minHeight: '20px',
                  height: '20px',
                  lineHeight: '20px',
                  color: errors.password ? 'rgba(255, 182, 193, 0.8)' : 'rgba(255, 255, 255, 0.6)',
                },
              }}
              inputProps={{
                autoComplete: 'off',
                'data-lpignore': 'true',
                'data-form-type': 'other',
                'data-1p-ignore': 'true',
                'aria-autocomplete': 'none',
                readOnly: true, // Prevent autofill, will be removed on focus
                name: `password-${Math.random().toString(36).substring(7)}`, // Random name to prevent autofill
              }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="toggle password visibility"
                      onClick={togglePasswordVisibility}
                      edge="end"
                      tabIndex={-1}
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

            // Determine helper text based on validation state
            let helperText = t('auth.confirmPasswordHelp');
            if (errors.confirmPassword?.message) {
              helperText = errors.confirmPassword.message;
            } else if (isPasswordMatch) {
              helperText = t('auth.passwordsMatch');
            }

            return (
              <TextField
                {...field}
                fullWidth
                label={`${t('auth.confirmPassword')} *`}
                type={isWebkit ? 'text' : (showConfirmPassword ? 'text' : confirmPasswordFieldType)}
                helperText={helperText}
                autoComplete="off"
                onFocus={(e) => {
                  // Remove readonly on focus to allow user input
                  if (!isWebkit) {
                    setConfirmPasswordFieldType('password');
                  }
                  e.target.removeAttribute('readonly');
                }}
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
                    // Mask characters when using type=text on WebKit browsers
                    ...(isWebkit && !showConfirmPassword ? {
                      WebkitTextSecurity: 'disc',
                    } : {}),
                  },
                  '& .MuiFormHelperText-root': {
                    minHeight: '20px',
                    height: '20px',
                    lineHeight: '20px',
                    color: errors.confirmPassword
                      ? 'rgba(255, 182, 193, 0.8)'
                      : (showMatchIndicator && isPasswordMatch
                          ? 'rgba(129, 199, 132, 0.8)'
                          : 'rgba(255, 255, 255, 0.6)'),
                  },
                }}
                inputProps={{
                  autoComplete: 'off',
                  'data-lpignore': 'true',
                  'data-form-type': 'other',
                  'data-1p-ignore': 'true',
                  'aria-autocomplete': 'none',
                  readOnly: true, // Prevent autofill, will be removed on focus
                  name: `confirm-password-${Math.random().toString(36).substring(7)}`, // Random name to prevent autofill
                }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle confirm password visibility"
                        onClick={toggleConfirmPasswordVisibility}
                        edge="end"
                        tabIndex={-1}
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
