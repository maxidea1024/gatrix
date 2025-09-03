import React, { useState, useMemo, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Link,
  CircularProgress,
  IconButton,
  InputAdornment,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useNavigate, useLocation, Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { RegisterData } from '@/types';
import { LanguageSelector } from '@/components/LanguageSelector';
import { toast } from 'react-toastify';

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
    formState: { errors, isSubmitting, touchedFields },
    trigger,
    reset,
    clearErrors,
  } = useForm<RegisterData & { confirmPassword: string }>({
    resolver,
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
              {t('auth.createAccount')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {fromPrompt ? t('auth.completeRegistration') : t('auth.signUpDescription')}
            </Typography>
          </Box>



          {/* Register Form */}
          <Box component="form" onSubmit={handleSubmit(onSubmit)} autoComplete="off">
            <Controller
              name="name"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  label={t('auth.name')}
                  error={false}
                  helperText=""
                  margin="normal"
                  autoComplete="off"
                  autoFocus
                />
              )}
            />

            <Controller
              name="email"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  label={t('auth.email')}
                  type="text"
                  error={false}
                  helperText=""
                  margin="normal"
                  autoComplete="off"
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
                  autoComplete="new-password"
                  inputProps={{
                    autoComplete: 'new-password',
                    'data-lpignore': 'true', // LastPass 무시
                    'data-form-type': 'other', // 브라우저 힌트 제거
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
              name="confirmPassword"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  label={t('auth.confirmPassword')}
                  type={showConfirmPassword ? 'text' : 'password'}
                  error={false}
                  helperText=""
                  margin="normal"
                  autoComplete="new-password"
                  inputProps={{
                    autoComplete: 'new-password',
                    'data-lpignore': 'true', // LastPass 무시
                    'data-form-type': 'other', // 브라우저 힌트 제거
                  }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label="toggle confirm password visibility"
                          onClick={toggleConfirmPasswordVisibility}
                          edge="end"
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
              disabled={isSubmitting || isLoading}
              sx={{ mt: 3, mb: 2 }}
            >
              {isSubmitting || isLoading ? (
                <CircularProgress size={24} />
              ) : (
                t('auth.signUp')
              )}
            </Button>

            {/* Login Link */}
            <Box sx={{ textAlign: 'center', mt: 3 }}>
              <Typography variant="body2" color="text.secondary">
                {t('auth.alreadyHaveAccount')}{' '}
                <Link
                  component={RouterLink}
                  to="/login"
                  color="primary"
                  fontWeight="medium"
                >
                  {t('auth.signIn')}
                </Link>
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default RegisterPage;
