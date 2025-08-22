import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
} from '@mui/material';
import {
  HourglassEmpty,
  ExitToApp,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
// import { useTranslations } from '@/contexts/I18nContext';

const PendingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  // const { t, auth } = useTranslations();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
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
          <HourglassEmpty 
            sx={{ 
              fontSize: 80, 
              color: 'warning.main',
              mb: 3,
            }} 
          />

          {/* Header */}
          <Typography variant="h4" component="h1" gutterBottom>
            Account Pending Approval
          </Typography>

          <Typography variant="h6" gutterBottom color="text.secondary">
            Welcome, {user?.name}!
          </Typography>

          {/* Message */}
          <Alert severity="warning" sx={{ mb: 3, textAlign: 'left' }}>
            <Typography variant="body1" paragraph>
              Your account has been created successfully, but it requires approval from an administrator before you can access the system.
            </Typography>
            <Typography variant="body2">
              <strong>What happens next?</strong>
            </Typography>
            <Typography variant="body2" component="ul" sx={{ mt: 1, pl: 2 }}>
              <li>An administrator will review your account</li>
              <li>You'll receive an email notification once approved</li>
              <li>You can then log in and access all features</li>
            </Typography>
          </Alert>

          {/* Account Details */}
          <Box sx={{ textAlign: 'left', mb: 3 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Account Details:
            </Typography>
            <Typography variant="body2">
              <strong>Email:</strong> {user?.email}
            </Typography>
            <Typography variant="body2">
              <strong>Name:</strong> {user?.name}
            </Typography>
            <Typography variant="body2">
              <strong>Status:</strong> Pending Approval
            </Typography>
            <Typography variant="body2">
              <strong>Created:</strong> {user?.createdAt ? new Date(user.created_at).toLocaleDateString() : 'Unknown'}
            </Typography>
          </Box>

          {/* Actions */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="body2" color="text.secondary">
              If you have any questions, please contact the administrator.
            </Typography>
            
            <Button
              variant="outlined"
              startIcon={<ExitToApp />}
              onClick={handleLogout}
              size="large"
            >
              Sign Out
            </Button>
          </Box>

          {/* Footer */}
          <Typography variant="caption" color="text.secondary" sx={{ mt: 3, display: 'block' }}>
            Thank you for your patience. We'll get you set up as soon as possible!
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default PendingPage;
