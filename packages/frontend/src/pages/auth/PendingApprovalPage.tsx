import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { HourglassEmpty as HourglassIcon, ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LanguageSelector } from '@/components/LanguageSelector';
import AuthLayout from '../../components/auth/AuthLayout';

const PendingApprovalPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  // Get email from location state if available
  const email = (location.state as any)?.email || '';

  const handleBackToLogin = () => {
    navigate('/login');
  };

  return (
    <AuthLayout title={t('pendingApproval.title')} subtitle="" showLeftPanel={false}>
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
        {/* Icon */}
        <HourglassIcon
          sx={{
            fontSize: 80,
            color: '#ffa726',
            mb: 3,
            opacity: 0.8,
            animation: 'hourglassFlip 3s ease-in-out infinite',
            '@keyframes hourglassFlip': {
              '0%': {
                transform: 'rotate(0deg)',
              },
              '50%': {
                transform: 'rotate(180deg)',
              },
              '100%': {
                transform: 'rotate(360deg)',
              },
            },
          }}
        />

        {/* Email Display */}
        {email && (
          <Box
            sx={{
              mt: 2,
              mb: 3,
              p: 2,
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 2,
            }}
          >
            <Typography variant="body1" sx={{ color: 'white', fontWeight: 500 }}>
              {email}
            </Typography>
          </Box>
        )}

        {/* Message */}
        <Typography
          variant="body1"
          sx={{ color: 'rgba(255, 255, 255, 0.8)', mb: 3, lineHeight: 1.6 }}
        >
          {t('pendingApproval.message')}
        </Typography>

        {/* Additional Info */}
        <Typography
          variant="body2"
          sx={{ color: 'rgba(255, 255, 255, 0.6)', mb: 4, lineHeight: 1.5 }}
        >
          {t('pendingApproval.additionalInfo')}
        </Typography>

        {/* Action Button */}
        <Button
          variant="outlined"
          size="large"
          startIcon={<ArrowBackIcon />}
          onClick={handleBackToLogin}
          fullWidth
          sx={{
            height: 48,
            borderColor: '#667eea',
            color: '#667eea',
            textTransform: 'none',
            fontSize: '1rem',
            fontWeight: 600,
            borderRadius: 2,
            '&:hover': {
              borderColor: '#5a6fd8',
              backgroundColor: 'rgba(102, 126, 234, 0.1)',
              color: '#5a6fd8',
            },
          }}
        >
          {t('pendingApproval.backToLogin')}
        </Button>
      </Box>
    </AuthLayout>
  );
};

export default PendingApprovalPage;
