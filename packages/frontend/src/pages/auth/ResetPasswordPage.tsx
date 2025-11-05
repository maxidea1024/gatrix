import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Link,
  InputAdornment,
  IconButton,
} from '@mui/material';
import { Visibility, VisibilityOff, CheckCircle, Error, Lock, Login } from '@mui/icons-material';
import { useNavigate, useSearchParams, Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthService } from '@/services/auth';
import { LanguageSelector } from '@/components/LanguageSelector';
import AuthLayout from '../../components/auth/AuthLayout';

const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);

  // 백엔드 메시지 키를 번역하는 함수
  const getTranslatedMessage = (messageKey: string): string => {
    const messageMap: { [key: string]: string } = {
      'PASSWORD_RESET_EMAIL_SENT': t('auth.passwordResetEmailSent'),
      'EMAIL_SEND_FAILED': t('auth.emailSendFailed'),
      'PASSWORD_RESET_REQUEST_ERROR': t('auth.passwordResetRequestError'),
      'INVALID_TOKEN': t('auth.invalidToken'),
      'TOKEN_EXPIRED': t('auth.tokenExpired'),
      'TOKEN_VALIDATION_ERROR': t('auth.tokenValidationFailed'),
      'PASSWORD_RESET_SUCCESS': t('auth.passwordResetSuccess'),
      'PASSWORD_RESET_ERROR': t('auth.resetPasswordFailed'),
    };

    return messageMap[messageKey] || messageKey;
  };

  useEffect(() => {
    if (!token) {
      setTokenValid(false);
      setIsValidating(false);
      setMessage({ type: 'error', text: t('auth.invalidResetLink') });
      return;
    }

    validateToken();
  }, [token]);

  // Disable autofill styling
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      input:-webkit-autofill,
      input:-webkit-autofill:hover,
      input:-webkit-autofill:focus,
      input:-webkit-autofill:active {
        -webkit-box-shadow: 0 0 0 30px rgba(255, 255, 255, 0.05) inset !important;
        -webkit-text-fill-color: white !important;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const validateToken = async () => {
    try {
      const response = await AuthService.validateResetToken(token!);
      setTokenValid(response.success);

      if (!response.success) {
        const translatedMessage = getTranslatedMessage(response.message);
        setMessage({ type: 'error', text: translatedMessage });
      }
    } catch (error: any) {
      setTokenValid(false);
      setMessage({ type: 'error', text: error.message || t('auth.tokenValidationFailed') });
    } finally {
      setIsValidating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password.trim()) {
      setMessage({ type: 'error', text: t('auth.passwordRequired') });
      return;
    }

    if (password.length < 6) {
      setMessage({ type: 'error', text: t('auth.passwordTooShort') });
      return;
    }

    if (password !== confirmPassword) {
      setMessage({ type: 'error', text: t('auth.passwordsNotMatch') });
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await AuthService.resetPassword(token!, password);

      if (response.success) {
        setResetSuccess(true);
        const translatedMessage = getTranslatedMessage(response.message);
        setMessage({ type: 'success', text: translatedMessage });
      } else {
        const translatedMessage = getTranslatedMessage(response.message);
        setMessage({ type: 'error', text: translatedMessage });
      }
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.message || t('auth.resetPasswordFailed')
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isValidating) {
    return (
      <AuthLayout
        title={t('auth.validatingToken')}
        subtitle="Please wait while we verify your reset token"
        showBackButton={false}
        showLeftPanel={false}
      >
        <Box sx={{ textAlign: 'center' }}>
          <CircularProgress
            size={48}
            sx={{
              mb: 2,
              color: '#667eea'
            }}
          />
          <Typography
            variant="body1"
            sx={{
              color: 'rgba(255, 255, 255, 0.7)'
            }}
          >
            {t('auth.validatingToken')}
          </Typography>
        </Box>
      </AuthLayout>
    );
  }

  if (!tokenValid) {
    return (
      <AuthLayout
        title={t('auth.invalidToken')}
        subtitle={t('auth.invalidTokenDescription')}
        showBackButton={true}
        showLeftPanel={false}
      >
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Error sx={{
            fontSize: 64,
            color: '#ff6b6b',
            mb: 2,
            filter: 'drop-shadow(0 4px 8px rgba(255, 107, 107, 0.3))'
          }} />
        </Box>

        {message && (
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
          >
            {message.text}
          </Alert>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Button
            variant="contained"
            onClick={() => navigate('/forgot-password')}
            sx={{
              background: 'linear-gradient(45deg, #667eea 30%, #764ba2 90%)',
              '&:hover': {
                background: 'linear-gradient(45deg, #5a6fd8 30%, #6a4190 90%)',
              },
              borderRadius: 2,
              textTransform: 'none',
              fontSize: '1rem',
              fontWeight: 600,
            }}
          >
            {t('auth.requestNewReset')}
          </Button>

          <Button
            variant="text"
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

  if (resetSuccess) {
    return (
      <AuthLayout
        title=""
        subtitle={t('auth.passwordResetSuccessDescription')}
        showBackButton={false}
        showLeftPanel={false}
      >
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <CheckCircle sx={{
            fontSize: 64,
            color: '#4caf50',
            mb: 2,
            filter: 'drop-shadow(0 4px 8px rgba(76, 175, 80, 0.3))',
            animation: 'checkSuccess 1.5s ease-in-out',
            '@keyframes checkSuccess': {
              '0%': {
                transform: 'scale(0) rotate(-180deg)',
                opacity: 0,
              },
              '50%': {
                transform: 'scale(1.2) rotate(0deg)',
                opacity: 1,
              },
              '100%': {
                transform: 'scale(1) rotate(0deg)',
                opacity: 1,
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
              color: '#4caf50',
              border: '1px solid rgba(76, 175, 80, 0.2)',
              '& .MuiAlert-icon': {
                color: '#4caf50'
              }
            }}
          >
            {message.text}
          </Alert>
        )}

        <Button
          variant="contained"
          fullWidth
          onClick={() => navigate('/login')}
          startIcon={<Login />}
          sx={{
            background: 'linear-gradient(45deg, #667eea 30%, #764ba2 90%)',
            '&:hover': {
              background: 'linear-gradient(45deg, #5a6fd8 30%, #6a4190 90%)',
            },
            borderRadius: 2,
            textTransform: 'none',
            fontSize: '1rem',
            fontWeight: 600,
            height: 48,
          }}
        >
          {t('auth.signIn')}
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={t('auth.resetPassword')}
      subtitle={t('auth.resetPasswordDescription')}
      showBackButton={true}
      showLeftPanel={false}
    >
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Lock sx={{
          fontSize: 64,
          color: '#667eea',
          mb: 2,
          filter: 'drop-shadow(0 4px 8px rgba(102, 126, 234, 0.3))'
        }} />
      </Box>

      {/* Message Alert - Smooth animation without fixed height */}
      <Box
        sx={{
          mb: message ? 3 : 0,
          overflow: 'hidden',
          height: message ? 'auto' : 0,
          transition: 'all 0.3s ease-out',
        }}
      >
        {message && (
          <Box
            sx={{
              width: '100%',
              animation: 'slideDown 0.3s ease-out forwards',
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
            }}
          >
            <Alert
              severity={message.type}
              sx={{
                width: '100%',
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
          </Box>
        )}
      </Box>

      <Box component="form" onSubmit={handleSubmit}>
        <TextField
          fullWidth
          label={t('auth.newPassword')}
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isSubmitting}
          required
          autoFocus
          autoComplete="new-password"
          spellCheck="false"
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
          }}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  onClick={() => setShowPassword(!showPassword)}
                  edge="end"
                  sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
                >
                  {showPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />

        <TextField
          fullWidth
          label={t('auth.confirmNewPassword')}
          type={showConfirmPassword ? 'text' : 'password'}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={isSubmitting}
          required
          autoComplete="new-password"
          spellCheck="false"
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
          }}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  edge="end"
                  sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
                >
                  {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />

        <Button
          type="submit"
          fullWidth
          variant="contained"
          size="large"
          disabled={isSubmitting}
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
          {isSubmitting ? (
            <CircularProgress size={24} color="inherit" />
          ) : (
            t('auth.resetPassword')
          )}
        </Button>

        <Box sx={{ textAlign: 'center' }}>
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
            {t('auth.backToLogin')}
          </Link>
        </Box>
      </Box>
    </AuthLayout>
  );
};

export default ResetPasswordPage;
