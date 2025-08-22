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
            The page you're looking for doesn't exist. It might have been moved, deleted, or you entered the wrong URL.
          </Typography>

          {/* Actions */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Button
              variant="contained"
              startIcon={<Home />}
              onClick={handleGoHome}
              size="large"
            >
              Go to Dashboard
            </Button>
            
            <Button
              variant="outlined"
              startIcon={<ArrowBack />}
              onClick={handleGoBack}
            >
              Go Back
            </Button>
          </Box>

          {/* Footer */}
          <Typography variant="caption" color="text.secondary" sx={{ mt: 3, display: 'block' }}>
            If you think this is a mistake, please contact support.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default NotFoundPage;
