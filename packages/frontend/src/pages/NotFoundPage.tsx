import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Avatar,
  Container,
} from '@mui/material';
import {
  SearchOff,
  Home,
  ArrowBack,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
// import { useTranslations } from '@/contexts/I18nContext';

const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  // const { t, errors } = useTranslations();

  const handleGoHome = () => {
    if (isAuthenticated) {
      navigate('/dashboard');
    } else {
      navigate('/login');
    }
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          py: 4,
        }}
      >
        <Card sx={{ width: '100%', textAlign: 'center' }}>
          <CardContent sx={{ p: 4 }}>
            {/* Icon */}
            <Box sx={{ mb: 3 }}>
              <Avatar
                sx={{
                  width: 80,
                  height: 80,
                  bgcolor: 'primary.main',
                  mx: 'auto',
                  mb: 2,
                }}
              >
                <SearchOff sx={{ fontSize: 40 }} />
              </Avatar>
            </Box>

            {/* Title */}
            <Typography variant="h4" component="h1" gutterBottom color="primary.main">
              404 - Page Not Found
            </Typography>

            {/* Message */}
            <Typography variant="body1" paragraph sx={{ mb: 4 }}>
              The page you're looking for doesn't exist or has been moved.
            </Typography>

            <Typography variant="body2" color="text.secondary" paragraph>
              This could happen if:
            </Typography>

            <Box sx={{ textAlign: 'left', mb: 4, mx: 'auto', maxWidth: 300 }}>
              <Typography variant="body2" color="text.secondary" component="ul" sx={{ pl: 2 }}>
                <li>The URL was typed incorrectly</li>
                <li>The page has been moved or deleted</li>
                <li>You don't have permission to view this page</li>
                <li>The link you followed is broken</li>
              </Typography>
            </Box>

            {/* Error Code */}
            <Box
              sx={{
                bgcolor: 'primary.light',
                color: 'primary.contrastText',
                p: 2,
                borderRadius: 1,
                mb: 4,
              }}
            >
              <Typography variant="body2" fontWeight="medium">
                Error 404: {errors.notFound}
              </Typography>
            </Box>

            {/* Actions */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Button
                variant="contained"
                startIcon={<Home />}
                onClick={handleGoHome}
                fullWidth
              >
                {isAuthenticated ? 'Go to Dashboard' : 'Go to Login'}
              </Button>
              
              <Button
                variant="outlined"
                startIcon={<ArrowBack />}
                onClick={handleGoBack}
                fullWidth
              >
                Go Back
              </Button>
            </Box>

            {/* Additional Info */}
            <Box sx={{ mt: 4, pt: 3, borderTop: 1, borderColor: 'divider' }}>
              <Typography variant="caption" color="text.secondary">
                If you believe this page should exist, please contact support.
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
};

export default NotFoundPage;
