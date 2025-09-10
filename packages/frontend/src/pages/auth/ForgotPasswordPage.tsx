import React, { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Link,
} from '@mui/material';
import { ArrowBack, Email } from '@mui/icons-material';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthService } from '@/services/auth';
import { LanguageSelector } from '@/components/LanguageSelector';
import AuthLayout from '../../components/auth/AuthLayout';

const ForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  // 이메일 유효성 검사 함수
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // 이메일 입력 핸들러
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    setMessage(null); // 기존 메시지 클리어

    if (value.trim() === '') {
      setEmailError(null);
    } else if (!validateEmail(value)) {
      setEmailError(t('auth.emailInvalid'));
    } else {
      setEmailError(null);
    }
  };

  // 버튼 활성화 조건
  const isButtonDisabled = isSubmitting || !email.trim() || !!emailError;

  // 백엔드 메시지 키를 번역하는 함수
  const getTranslatedMessage = (messageKey: string): string => {
    const messageMap: { [key: string]: string } = {
      'PASSWORD_RESET_EMAIL_SENT': t('auth.passwordResetEmailSent'),
      'EMAIL_SEND_FAILED': t('auth.emailSendFailed'),
      'EMAIL_NOT_REGISTERED': t('auth.emailNotRegistered'),
      'PASSWORD_RESET_REQUEST_ERROR': t('auth.passwordResetRequestError'),
      'INVALID_TOKEN': t('auth.invalidToken'),
      'TOKEN_EXPIRED': t('auth.tokenExpired'),
      'TOKEN_VALIDATION_ERROR': t('auth.tokenValidationFailed'),
      'PASSWORD_RESET_SUCCESS': t('auth.passwordResetSuccess'),
      'PASSWORD_RESET_ERROR': t('auth.resetPasswordFailed'),
    };

    return messageMap[messageKey] || messageKey;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 이미 실시간 유효성 검사로 처리되므로 추가 검사 불필요
    if (isButtonDisabled) {
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await AuthService.forgotPassword(email);

      if (response.success) {
        setEmailSent(true);
        // 백엔드에서 메시지 키를 받아서 번역
        const translatedMessage = getTranslatedMessage(response.message);
        setMessage({ type: 'success', text: translatedMessage });
      } else {
        const translatedMessage = getTranslatedMessage(response.message);
        setMessage({ type: 'error', text: translatedMessage });
      }
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.message || t('auth.forgotPasswordFailed')
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (emailSent) {
    return (
      <AuthLayout
        title={t('auth.emailSent')}
        subtitle={t('auth.checkEmailForReset')}
        showBackButton={true}
        showLeftPanel={false}
      >
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Email sx={{
            fontSize: 64,
            color: '#667eea',
            mb: 2,
            filter: 'drop-shadow(0 4px 8px rgba(102, 126, 234, 0.3))',
            animation: 'emailBounce 2s ease-in-out infinite',
            '@keyframes emailBounce': {
              '0%, 20%, 50%, 80%, 100%': {
                transform: 'translateY(0)',
              },
              '40%': {
                transform: 'translateY(-10px)',
              },
              '60%': {
                transform: 'translateY(-5px)',
              },
            },
          }} />
        </Box>

        {message && message.type === 'success' && (
          <Alert
            severity="success"
            sx={{
              mb: 3,
              backgroundColor: 'rgba(76, 175, 80, 0.1)',
              color: 'white',
              '& .MuiAlert-icon': {
                color: '#4caf50'
              }
            }}
          >
            {message.text}
          </Alert>
        )}

        <Typography
          variant="body2"
          sx={{
            mb: 3,
            color: 'rgba(255, 255, 255, 0.7)',
            textAlign: 'center'
          }}
        >
          {t('auth.didntReceiveEmail')}
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Button
            variant="outlined"
            onClick={() => {
              setEmailSent(false);
              setMessage(null);
              setEmail('');
              setEmailError(null);
            }}
            sx={{
              borderColor: 'rgba(255, 255, 255, 0.3)',
              color: 'white',
              '&:hover': {
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
              },
            }}
          >
            {t('auth.resendEmail')}
          </Button>

          <Button
            variant="text"
            startIcon={<ArrowBack />}
            onClick={() => navigate('/login')}
            sx={{
              color: 'rgba(255, 255, 255, 0.7)',
              '&:hover': {
                color: 'white',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
              },
            }}
          >
            {t('auth.backToLogin')}
          </Button>
        </Box>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={t('auth.forgotPassword')}
      subtitle={t('auth.enterEmailToReset')}
      showBackButton={true}
      showLeftPanel={false}
    >

      {message && (
        <Alert
          severity={message.type}
          sx={{
            mb: 3,
            backgroundColor: message.type === 'error' ? 'rgba(244, 67, 54, 0.1)' : 'rgba(76, 175, 80, 0.1)',
            color: message.type === 'error' ? '#ff6b6b' : '#4caf50',
            border: `1px solid ${message.type === 'error' ? 'rgba(244, 67, 54, 0.2)' : 'rgba(76, 175, 80, 0.2)'}`,
            '& .MuiAlert-icon': {
              color: message.type === 'error' ? '#ff6b6b' : '#4caf50'
            }
          }}
          onClose={() => setMessage(null)}
        >
          {message.text}
        </Alert>
      )}

      <Box component="form" onSubmit={handleSubmit}>
        <TextField
          fullWidth
          label={t('auth.email')}
          type="email"
          value={email}
          onChange={handleEmailChange}
          disabled={isSubmitting}
          required
          autoFocus
          error={!!emailError}
          helperText={emailError || t('auth.emailHelp')}
          sx={{
            mb: 3,
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
              '&.Mui-disabled': {
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                '& fieldset': {
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                },
              },
            },
            '& .MuiInputLabel-root': {
              color: 'rgba(255, 255, 255, 0.7)',
              '&.Mui-disabled': {
                color: 'rgba(255, 255, 255, 0.5)',
              },
            },
            '& .MuiInputBase-input': {
              color: 'white',
              '&.Mui-disabled': {
                color: 'rgba(255, 255, 255, 0.7)',
                WebkitTextFillColor: 'rgba(255, 255, 255, 0.7)',
              },
            },
            '& .MuiFormHelperText-root': {
              color: emailError ? '#ff6b6b' : 'rgba(255, 255, 255, 0.6)',
              '&.Mui-disabled': {
                color: 'rgba(255, 255, 255, 0.4)',
              },
            },
          }}
        />

        <Button
          type="submit"
          fullWidth
          variant="contained"
          size="large"
          disabled={isButtonDisabled}
          startIcon={isSubmitting ? <CircularProgress size={20} /> : <Email />}
          sx={{
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
          {isSubmitting ? t('auth.sending') : t('auth.sendResetEmail')}
        </Button>

        <Box sx={{ textAlign: 'center', mb: 2 }}>
          <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
            {t('auth.rememberPassword')}{' '}
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
        <Box
          sx={{
            width: '100%',
            height: '1px',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            mb: 3,
          }}
        />

        <Box sx={{ textAlign: 'center' }}>
          <Link
            component={RouterLink}
            to="/login"
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              color: 'rgba(255, 255, 255, 0.7)',
              textDecoration: 'none',
              fontSize: '0.875rem',
              '&:hover': {
                color: '#667eea',
                textDecoration: 'underline'
              }
            }}
          >
            <ArrowBack sx={{ fontSize: 16 }} />
            {t('auth.backToLogin')}
          </Link>
        </Box>
      </Box>
    </AuthLayout>
  );
};

export default ForgotPasswordPage;
