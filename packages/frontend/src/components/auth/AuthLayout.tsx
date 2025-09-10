import React from 'react';
import { Box, Typography, Container, Paper, IconButton, useTheme } from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  showBackButton?: boolean;
  backgroundImage?: string;
  leftContent?: {
    title: string;
    subtitle: string;
    description?: string;
  };
  showLeftPanel?: boolean;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({
  children,
  title,
  subtitle,
  showBackButton = false,
  backgroundImage = '/images/auth-bg.jpg',
  leftContent = {
    title: 'Welcome to',
    subtitle: 'GATRIX',
    description: 'Online gaming service platform with comprehensive dashboard management tools'
  },
  showLeftPanel = true
}) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const theme = useTheme();

  const handleBackClick = () => {
    navigate('/');
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: theme.palette.mode === 'dark'
          ? 'linear-gradient(135deg, #0f0f0f 0%, #050505 100%)'
          : 'linear-gradient(135deg, #9e9e9e 0%, #757575 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 2,
      }}
    >
      <Container maxWidth="lg">
        <Paper
          elevation={24}
          sx={{
            display: 'flex',
            borderRadius: 4,
            overflow: 'hidden',
            minHeight: showLeftPanel ? '600px' : 'auto',
            background: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            maxWidth: showLeftPanel ? 'none' : '500px',
            margin: showLeftPanel ? 'auto' : 'auto',
          }}
        >
          {/* Left Side - Hero Section */}
          {showLeftPanel && (
            <Box
            sx={{
              flex: 1,
              background: theme.palette.mode === 'dark'
                ? `linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 50%, #2563eb 100%)`
                : `linear-gradient(135deg, #1e3a8a 0%, #1e40af 50%, #2563eb 100%)`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              display: { xs: 'none', md: 'flex' },
              flexDirection: 'column',
              justifyContent: 'space-between',
              padding: 4,
              color: 'white',
              position: 'relative',
              overflow: 'hidden',


            }}
          >
            {/* Decorative elements */}
            <Box
              sx={{
                position: 'absolute',
                top: '15%',
                right: '10%',
                width: 120,
                height: 120,
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.1)',
                zIndex: 1,
              }}
            />
            <Box
              sx={{
                position: 'absolute',
                bottom: '25%',
                right: '15%',
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.08)',
                zIndex: 1,
              }}
            />
            <Box
              sx={{
                position: 'absolute',
                top: '50%',
                right: '5%',
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.06)',
                zIndex: 1,
              }}
            />

            {/* Back Button */}
            {showBackButton && (
              <Box sx={{ position: 'absolute', top: 16, right: 16, zIndex: 3 }}>
                <IconButton
                  onClick={handleBackClick}
                  sx={{
                    color: 'white',
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    backdropFilter: 'blur(10px)',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    },
                  }}
                >
                  <ArrowBack />
                </IconButton>
              </Box>
            )}

            {/* Hero Content */}
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative', zIndex: 3 }}>
              <Typography
                variant="h2"
                sx={{
                  fontWeight: 300,
                  marginBottom: 1,
                  lineHeight: 1.2,
                  textShadow: '0 2px 4px rgba(0,0,0,0.3)',
                  fontSize: { xs: '2rem', md: '2.5rem' },
                }}
              >
                {leftContent.title}
              </Typography>


              {leftContent.description && (
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 400,
                    marginBottom: 4,
                    lineHeight: 1.4,
                    textShadow: '0 1px 2px rgba(0,0,0,0.2)',
                    opacity: 0.9,
                    fontSize: { xs: '1rem', md: '1.25rem' },
                  }}
                >
                  {leftContent.description}
                </Typography>
              )}

              {/* Feature highlights */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      backgroundColor: 'white',
                      borderRadius: '50%',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                    }}
                  />
                  <Typography variant="body1" sx={{ opacity: 0.9 }}>
                    Game data analytics & insights
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      backgroundColor: 'rgba(255, 255, 255, 0.7)',
                      borderRadius: '50%',
                    }}
                  />
                  <Typography variant="body1" sx={{ opacity: 0.8 }}>
                    Real-time dashboard monitoring
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      backgroundColor: 'rgba(255, 255, 255, 0.5)',
                      borderRadius: '50%',
                    }}
                  />
                  <Typography variant="body1" sx={{ opacity: 0.7 }}>
                    User management & engagement
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Box>
          )}

          {/* Right Side - Form Section */}
          <Box
            sx={{
              flex: 1,
              padding: { xs: 3, md: 6 },
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              backgroundColor: 'rgba(30, 30, 30, 0.95)',
              color: 'white',
              position: 'relative',
            }}
          >
            {/* Mobile Back Button */}
            {showBackButton && (
              <Box sx={{ display: { xs: 'block', md: 'none' }, position: 'absolute', top: 16, left: 16 }}>
                <IconButton
                  onClick={handleBackClick}
                  sx={{
                    color: 'white',
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    },
                  }}
                >
                  <ArrowBack />
                </IconButton>
              </Box>
            )}

            {/* Form Header */}
            <Box sx={{ marginBottom: 4, marginTop: { xs: 6, md: 0 } }}>
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 'bold',
                  marginBottom: 1,
                  color: 'white',
                }}
              >
                {title}
              </Typography>
              {subtitle && (
                <Typography
                  variant="body1"
                  sx={{
                    color: 'rgba(255, 255, 255, 0.7)',
                  }}
                >
                  {subtitle}
                </Typography>
              )}
            </Box>

            {/* Form Content */}
            <Box sx={{ flex: 1 }}>
              {children}
            </Box>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
};

export default AuthLayout;
