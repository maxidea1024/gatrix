import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
} from '@mui/material';
import {
  Block,
  Home,
  ArrowBack,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

const UnauthorizedPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();

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
          <Block 
            sx={{ 
              fontSize: 80, 
              color: 'error.main',
              mb: 3,
            }} 
          />

          {/* Header */}
          <Typography variant="h4" component="h1" gutterBottom>
            Access Denied
          </Typography>

          <Typography variant="h6" gutterBottom color="text.secondary">
            403 - Unauthorized
          </Typography>

          {/* Message */}
          <Typography variant="body1" paragraph sx={{ mb: 3 }}>
            You don't have permission to access this resource. This page is restricted to administrators only.
          </Typography>

          {user && (
            <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Logged in as: <strong>{user.name}</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Role: <strong>{user.role}</strong>
              </Typography>
            </Box>
          )}

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
            If you believe this is an error, please contact your administrator.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default UnauthorizedPage;
