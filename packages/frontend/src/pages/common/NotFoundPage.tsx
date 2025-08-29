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
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        p: 2,
      }}
    >
      <Card sx={{ maxWidth: 500, width: '100%' }}>
        <CardContent sx={{ p: 4, textAlign: 'center' }}>
          {/* Icon */}
          <SearchOff 
            sx={{ 
              fontSize: 80, 
              color: 'text.secondary',
              mb: 3,
            }} 
          />

          {/* Header */}
          <Typography variant="h4" component="h1" gutterBottom>
            {t('notFound.title')}
          </Typography>

          <Typography variant="h6" gutterBottom color="text.secondary">
            {t('notFound.subtitle')}
          </Typography>

          {/* Message */}
          <Typography variant="body1" paragraph sx={{ mb: 3 }}>
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
            >
              {t('common.goBack')}
            </Button>
          </Box>

          {/* Footer */}
          <Typography variant="caption" color="text.secondary" sx={{ mt: 3, display: 'block' }}>
            {t('notFound.footer')}
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default NotFoundPage;
