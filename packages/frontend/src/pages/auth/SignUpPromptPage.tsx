import React from 'react';
import {
  Box,
  Card,
  CardContent,
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
        <LanguageSelector />
      </Box>

      <Card sx={{ maxWidth: 400, width: '100%' }}>
        <CardContent sx={{ p: 4, textAlign: 'center' }}>
          {/* Header */}
          <Typography variant="h4" component="h1" gutterBottom>
            Gate
          </Typography>
          <Typography variant="h6" gutterBottom color="primary">
            {t('signUpPrompt.title')}
          </Typography>

          {/* Email Display */}
          {email && (
            <Box
              sx={{
                mt: 2,
                mb: 3,
                p: 2,
                backgroundColor: 'grey.100',
                borderRadius: 1,
              }}
            >
              <Typography variant="body2" color="text.secondary">
                {email}
              </Typography>
            </Box>
          )}

          {/* Message */}
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
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
            >
              {t('signUpPrompt.createAccount')}
            </Button>

            <Button
              variant="outlined"
              size="large"
              startIcon={<ArrowBackIcon />}
              onClick={handleBackToLogin}
              fullWidth
            >
              {t('signUpPrompt.backToLogin')}
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
};

export default SignUpPromptPage;
