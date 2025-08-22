import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Link,
  Alert,
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
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
// import { useTranslations } from '@/contexts/I18nContext';
import { RegisterData } from '@/types';

// Validation schema
const registerSchema = yup.object({
  name: yup
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters')
    .required('Name is required'),
  email: yup
    .string()
    .email('Please enter a valid email address')
    .required('Email is required'),
  password: yup
    .string()
    .min(6, 'Password must be at least 6 characters')
    .required('Password is required'),
  confirmPassword: yup
    .string()
    .oneOf([yup.ref('password')], 'Passwords must match')
    .required('Please confirm your password'),
});

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { register, isLoading, error, clearError } = useAuth();
  // const { t, auth } = useTranslations();
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [registerSuccess, setRegisterSuccess] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterData & { confirmPassword: string }>({
    resolver: yupResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

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
    } catch (err: any) {
      setRegisterError(err.message || auth.registerFailed);
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
              {auth.registerSuccess}
            </Typography>
            <Typography variant="body1" paragraph>
              Your account has been created successfully. Please wait for admin approval before you can log in.
            </Typography>
            <Button
              variant="contained"
              onClick={() => navigate('/login')}
              sx={{ mt: 2 }}
            >
              {auth.signIn}
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
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        p: 2,
      }}
    >
      <Card sx={{ maxWidth: 400, width: '100%' }}>
        <CardContent sx={{ p: 4 }}>
          {/* Header */}
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Typography variant="h4" component="h1" gutterBottom>
              {auth.createAccount}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {auth.signUp}
            </Typography>
          </Box>

          {/* Error Alert */}
          {(registerError || error) && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {registerError || error}
            </Alert>
          )}

          {/* Register Form */}
          <Box component="form" onSubmit={handleSubmit(onSubmit)}>
            <Controller
              name="name"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  label={auth.name}
                  error={!!errors.name}
                  helperText={errors.name?.message}
                  margin="normal"
                  autoComplete="name"
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
                  label={auth.email}
                  type="email"
                  error={!!errors.email}
                  helperText={errors.email?.message}
                  margin="normal"
                  autoComplete="email"
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
                  label={auth.password}
                  type={showPassword ? 'text' : 'password'}
                  error={!!errors.password}
                  helperText={errors.password?.message}
                  margin="normal"
                  autoComplete="new-password"
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
                  label={auth.confirmPassword}
                  type={showConfirmPassword ? 'text' : 'password'}
                  error={!!errors.confirmPassword}
                  helperText={errors.confirmPassword?.message}
                  margin="normal"
                  autoComplete="new-password"
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
                auth.signUp
              )}
            </Button>

            {/* Login Link */}
            <Box sx={{ textAlign: 'center', mt: 3 }}>
              <Typography variant="body2" color="text.secondary">
                {auth.alreadyHaveAccount}{' '}
                <Link
                  component={RouterLink}
                  to="/login"
                  color="primary"
                  fontWeight="medium"
                >
                  {auth.signIn}
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
