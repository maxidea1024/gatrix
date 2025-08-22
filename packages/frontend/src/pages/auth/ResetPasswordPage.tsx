import React, { useState, useEffect } from 'react';
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
  InputAdornment,
  IconButton,
} from '@mui/material';
import { Visibility, VisibilityOff, CheckCircle, Error } from '@mui/icons-material';
import { useNavigate, useSearchParams, Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthService } from '@/services/auth';
import { LanguageSelector } from '@/components/LanguageSelector';

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
          <Box sx={{ textAlign: 'center' }}>
            <CircularProgress size={48} sx={{ mb: 2 }} />
            <Typography variant="body1" color="text.secondary">
              {t('auth.validatingToken')}
            </Typography>
          </Box>
        </Container>
      </Box>
    );
  }

  if (!tokenValid) {
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
              <Error sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />
              
              <Typography variant="h5" gutterBottom sx={{ fontWeight: 600 }}>
                {t('auth.invalidToken')}
              </Typography>
              
              {message && (
                <Alert severity="error" sx={{ mb: 3, textAlign: 'left' }}>
                  {message.text}
                </Alert>
              )}

              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                {t('auth.invalidTokenDescription')}
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Button
                  variant="contained"
                  onClick={() => navigate('/forgot-password')}
                >
                  {t('auth.requestNewReset')}
                </Button>
                
                <Button
                  variant="text"
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

  if (resetSuccess) {
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
              <CheckCircle sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
              
              <Typography variant="h5" gutterBottom sx={{ fontWeight: 600 }}>
                {t('auth.passwordResetSuccess')}
              </Typography>
              
              {message && message.type === 'success' && (
                <Alert severity="success" sx={{ mb: 3, textAlign: 'left' }}>
                  {message.text}
                </Alert>
              )}

              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                {t('auth.passwordResetSuccessDescription')}
              </Typography>

              <Button
                variant="contained"
                fullWidth
                onClick={() => navigate('/login')}
              >
                {t('auth.signIn')}
              </Button>
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
                {t('auth.resetPassword')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('auth.resetPasswordDescription')}
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
                label={t('auth.newPassword')}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                required
                autoFocus
                sx={{ mb: 2 }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
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
                sx={{ mb: 3 }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        edge="end"
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
                sx={{ mb: 3 }}
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
                  color="primary"
                  sx={{ 
                    textDecoration: 'none',
                    '&:hover': { textDecoration: 'underline' }
                  }}
                >
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

export default ResetPasswordPage;
