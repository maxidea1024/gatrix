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
  HourglassEmpty,
  Email,
  ExitToApp,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
// import { useTranslations } from '@/contexts/I18nContext';

const PendingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  // const { t, auth } = useTranslations();

  const handleLogout = () => {
    navigate('/logout');
  };

  const handleContactSupport = () => {
    // In a real application, this could open a support ticket system
    // or redirect to a contact form
    window.location.href = 'mailto:admin@example.com?subject=Account Approval Request';
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
                  bgcolor: 'warning.main',
                  mx: 'auto',
                  mb: 2,
                }}
              >
                <HourglassEmpty sx={{ fontSize: 40 }} />
              </Avatar>
            </Box>

            {/* Title */}
            <Typography variant="h4" component="h1" gutterBottom color="warning.main">
              Account Pending Approval
            </Typography>

            {/* User Info */}
            {user && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Welcome, {user.name}!
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {user.email}
                </Typography>
              </Box>
            )}

            {/* Message */}
            <Typography variant="body1" paragraph sx={{ mb: 4 }}>
              Your account has been created successfully, but it requires approval from an administrator 
              before you can access the system.
            </Typography>

            <Typography variant="body2" color="text.secondary" paragraph>
              You will receive an email notification once your account has been approved. 
              This process typically takes 1-2 business days.
            </Typography>

            {/* Status Info */}
            <Box
              sx={{
                bgcolor: 'warning.light',
                color: 'warning.contrastText',
                p: 2,
                borderRadius: 1,
                mb: 4,
              }}
            >
              <Typography variant="body2" fontWeight="medium">
                Status: Pending Administrator Approval
              </Typography>
            </Box>

            {/* Actions */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Button
                variant="outlined"
                startIcon={<Email />}
                onClick={handleContactSupport}
                fullWidth
              >
                Contact Support
              </Button>

              <Button
                variant="contained"
                startIcon={<ExitToApp />}
                onClick={handleLogout}
                fullWidth
              >
                {auth.logout}
              </Button>
            </Box>

            {/* Additional Info */}
            <Box sx={{ mt: 4, pt: 3, borderTop: 1, borderColor: 'divider' }}>
              <Typography variant="caption" color="text.secondary">
                If you believe this is an error or need immediate access, 
                please contact your system administrator.
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
};

export default PendingPage;
