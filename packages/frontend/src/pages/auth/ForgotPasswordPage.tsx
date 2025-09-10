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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      setMessage({ type: 'error', text: t('auth.emailRequired') });
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
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
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

        <Container maxWidth="sm">
          <Card sx={{ width: '100%', maxWidth: 400, mx: 'auto' }}>
            <CardContent sx={{ p: 4, textAlign: 'center' }}>
              <Email sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
              
              <Typography variant="h5" gutterBottom sx={{ fontWeight: 600 }}>
                {t('auth.emailSent')}
              </Typography>
              
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                {t('auth.checkEmailForReset')}
              </Typography>

              {message && message.type === 'success' && (
                <Alert severity="success" sx={{ mb: 3, textAlign: 'left' }}>
                  {message.text}
                </Alert>
              )}

              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                {t('auth.didntReceiveEmail')}
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Button
                  variant="outlined"
                  onClick={() => {
                    setEmailSent(false);
                    setMessage(null);
                    setEmail('');
                  }}
                >
                  {t('auth.resendEmail')}
                </Button>
                
                <Button
                  variant="text"
                  startIcon={<ArrowBack />}
                  onClick={() => navigate('/login')}
                >
                  {t('auth.backToLogin')}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Container>
      </Box>
    );
  }

  return (
    <AuthLayout
      title={t('auth.forgotPassword')}
      showLeftPanel={false}
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
          onChange={(e) => setEmail(e.target.value)}
          disabled={isSubmitting}
          required
          autoFocus
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
            },
            '& .MuiInputLabel-root': {
              color: 'rgba(255, 255, 255, 0.7)',
            },
            '& .MuiInputBase-input': {
              color: 'white',
            },
          }}
        />

        <Button
          type="submit"
          fullWidth
          variant="contained"
          size="large"
          disabled={isSubmitting}
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
