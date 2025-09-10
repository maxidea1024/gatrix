import React from 'react';
import {
  Box,
  Typography,
  Button,
  Stack,
} from '@mui/material';
import {
  PersonAdd as PersonAddIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LanguageSelector } from '@/components/LanguageSelector';
import AuthLayout from '../../components/auth/AuthLayout';

const SignUpPromptPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  // Get email from location state if available
  const email = (location.state as any)?.email || '';

  const handleSignUp = () => {
    navigate('/register', {
      state: {
        email: email,
        fromPrompt: true
      }
    });
  };

  const handleBackToLogin = () => {
    navigate('/login');
  };

  return (
    <AuthLayout
      title={t('signUpPrompt.title')}
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
        <LanguageSelector />
      </Box>

      <Box sx={{ textAlign: 'center' }}>
        {/* Email Display */}
        {email && (
          <Box
            sx={{
              mt: 2,
              mb: 3,
              p: 2,
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: 2,
            }}
          >
            <Typography variant="body2" sx={{ color: 'white', fontWeight: 'medium' }}>
              {email}
            </Typography>
          </Box>
        )}

        {/* Message */}
        <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 4 }}>
          {t('signUpPrompt.message')}
        </Typography>

        {/* Action Buttons */}
        <Stack spacing={2}>
          <Button
            variant="contained"
            size="large"
            startIcon={<PersonAddIcon />}
            onClick={handleSignUp}
            fullWidth
            sx={{
              height: 48,
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
            {t('signUpPrompt.createAccount')}
          </Button>

          <Button
            variant="outlined"
            size="large"
            startIcon={<ArrowBackIcon />}
            onClick={handleBackToLogin}
            fullWidth
            sx={{
              height: 48,
              borderColor: 'rgba(255, 255, 255, 0.2)',
              color: 'rgba(255, 255, 255, 0.7)',
              '&:hover': {
                borderColor: 'rgba(255, 255, 255, 0.3)',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
              },
              borderRadius: 2,
              textTransform: 'none',
              fontSize: '1rem',
              fontWeight: 600,
            }}
          >
            {t('signUpPrompt.backToLogin')}
          </Button>
        </Stack>
      </Box>
    </AuthLayout>
  );
};

export default SignUpPromptPage;
