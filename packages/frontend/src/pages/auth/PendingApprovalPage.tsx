import React from 'react';
import {
  Box,
  Typography,
  Button,
} from '@mui/material';
import {
  HourglassEmpty as HourglassIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
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
    <AuthLayout
      title="Account Pending Approval"
      subtitle="Your account has been created successfully"
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
        {/* Icon */}
        <HourglassIcon
          sx={{
            fontSize: 80,
            color: '#ffa726',
            mb: 3,
            opacity: 0.8
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
        <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.8)', mb: 3, lineHeight: 1.6 }}>
          Your account is currently pending administrator approval. You will receive an email notification once your account has been activated.
        </Typography>

        {/* Additional Info */}
        <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.6)', mb: 4, lineHeight: 1.5 }}>
          This process typically takes 1-2 business days. If you have any questions, please contact our support team.
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
            borderColor: 'rgba(255, 255, 255, 0.2)',
            color: 'white',
            textTransform: 'none',
            fontSize: '1rem',
            fontWeight: 500,
            '&:hover': {
              borderColor: 'rgba(255, 255, 255, 0.3)',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
            },
          }}
        >
          Back to Login
        </Button>
      </Box>
    </AuthLayout>
  );
};

export default PendingApprovalPage;
