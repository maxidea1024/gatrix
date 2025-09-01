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
  HourglassEmpty as HourglassIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LanguageSelector } from '@/components/LanguageSelector';

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
          {/* Icon */}
          <HourglassIcon 
            sx={{ 
              fontSize: 64, 
              color: 'warning.main',
              mb: 2 
            }} 
          />

          {/* Header */}
          <Typography variant="h4" component="h1" gutterBottom>
            Gatrix
          </Typography>
          <Typography variant="h6" gutterBottom color="warning.main">
            {t('pendingApproval.title')}
          </Typography>
          
          {/* Email Display */}
          {email && (
            <Box
              sx={{
                mt: 2,
                mb: 3,
                p: 2,
                backgroundColor: 'action.hover',
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
              }}
            >
              <Typography variant="body2" color="text.primary" fontWeight="medium">
                {email}
              </Typography>
            </Box>
          )}

          {/* Message */}
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            {t('pendingApproval.message')}
          </Typography>

          {/* Additional Info */}
          <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
            {t('pendingApproval.additionalInfo')}
          </Typography>

          {/* Action Button */}
          <Button
            variant="outlined"
            size="large"
            startIcon={<ArrowBackIcon />}
            onClick={handleBackToLogin}
            fullWidth
          >
            {t('pendingApproval.backToLogin')}
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
};

export default PendingApprovalPage;
