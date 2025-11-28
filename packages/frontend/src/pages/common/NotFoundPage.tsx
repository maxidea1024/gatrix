import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
} from '@mui/material';
import {
  SearchOff,
  Home,
  ArrowBack,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleGoHome = () => {
    navigate('/dashboard');
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0f0f0f 0%, #050505 100%)',
        p: 2,
      }}
    >
      <Card sx={{
        maxWidth: 500,
        width: '100%',
        backgroundColor: 'rgba(30, 30, 30, 0.95)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
      }}>
        <CardContent sx={{ p: 4, textAlign: 'center' }}>
          {/* Icon */}
          <SearchOff
            sx={{
              fontSize: 80,
              color: 'rgba(255, 255, 255, 0.5)',
              mb: 3,
            }}
          />

          {/* Header */}
          <Typography variant="h4" component="h1" gutterBottom sx={{ color: 'white' }}>
            {t('notFound.title')}
          </Typography>

          <Typography variant="h6" gutterBottom sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
            {t('notFound.subtitle')}
          </Typography>

          {/* Message */}
          <Typography variant="body1" paragraph sx={{ mb: 3, color: 'rgba(255, 255, 255, 0.6)' }}>
            {t('notFound.description')}
          </Typography>

          {/* Actions */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Button
              variant="contained"
              startIcon={<Home />}
              onClick={handleGoHome}
              size="large"
            >
              {t('common.goToDashboard')}
            </Button>

            <Button
              variant="outlined"
              startIcon={<ArrowBack />}
              onClick={handleGoBack}
              sx={{
                borderColor: 'rgba(255, 255, 255, 0.3)',
                color: 'rgba(255, 255, 255, 0.8)',
                '&:hover': {
                  borderColor: 'rgba(255, 255, 255, 0.5)',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                }
              }}
            >
              {t('common.goBack')}
            </Button>
          </Box>

          {/* Footer */}
          <Typography variant="caption" sx={{ mt: 3, display: 'block', color: 'rgba(255, 255, 255, 0.4)' }}>
            {t('notFound.footer')}
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default NotFoundPage;
