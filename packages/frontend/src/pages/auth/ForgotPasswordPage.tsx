import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Link,
  Container,
} from '@mui/material';
import { ArrowBack, Email } from '@mui/icons-material';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthService } from '@/services/auth';
import { LanguageSelector } from '@/components/LanguageSelector';

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
          <CardContent sx={{ p: 4 }}>
            <Box sx={{ textAlign: 'center', mb: 4 }}>
              <Typography variant="h5" gutterBottom sx={{ fontWeight: 600 }}>
                {t('auth.forgotPassword')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('auth.forgotPasswordDescription')}
              </Typography>
            </Box>

            {message && (
              <Alert 
                severity={message.type} 
                sx={{ mb: 3 }}
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
                sx={{ mb: 3 }}
              />

              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                disabled={isSubmitting}
                sx={{ mb: 3 }}
              >
                {isSubmitting ? (
                  <CircularProgress size={24} color="inherit" />
                ) : (
                  t('auth.sendResetEmail')
                )}
              </Button>

              <Box sx={{ textAlign: 'center' }}>
                <Link
                  component={RouterLink}
                  to="/login"
                  color="primary"
                  sx={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: 0.5,
                    textDecoration: 'none',
                    '&:hover': { textDecoration: 'underline' }
                  }}
                >
                  <ArrowBack sx={{ fontSize: 16 }} />
                  {t('auth.backToLogin')}
                </Link>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
};

export default ForgotPasswordPage;
