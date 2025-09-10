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
                ? `linear-gradient(135deg, #134e4a 0%, #0f766e 25%, #0d9488 50%, #0e7490 75%, #164e63 100%)`
                : `linear-gradient(135deg, #0f3730 0%, #134e4a 25%, #0f766e 50%, #0e7490 75%, #164e63 100%)`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              display: { xs: 'none', md: 'flex' },
              flexDirection: 'column',
              justifyContent: 'space-between',
              padding: 4,
              color: 'white',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: 'inset 0 0 100px rgba(255, 255, 255, 0.1)',
            }}
          >
            {/* Animated Water Bubbles */}
            {/* Bubble 1 - Large */}
            <Box
              sx={{
                position: 'absolute',
                top: '15%',
                right: '10%',
                width: 120,
                height: 120,
                borderRadius: '50%',
                background: 'radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.2), rgba(45, 212, 191, 0.08))',
                zIndex: 1,
                animation: 'bubbleFloat1 6s ease-in-out infinite',
                '@keyframes bubbleFloat1': {
                  '0%': {
                    transform: 'translateY(0px) translateX(0px) scale(1)',
                    opacity: 0.8,
                  },
                  '33%': {
                    transform: 'translateY(-20px) translateX(10px) scale(1.05)',
                    opacity: 0.9,
                  },
                  '66%': {
                    transform: 'translateY(10px) translateX(-15px) scale(0.95)',
                    opacity: 0.7,
                  },
                  '100%': {
                    transform: 'translateY(0px) translateX(0px) scale(1)',
                    opacity: 0.8,
                  },
                },
              }}
            />

            {/* Bubble 2 - Medium */}
            <Box
              sx={{
                position: 'absolute',
                bottom: '25%',
                right: '15%',
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: 'radial-gradient(circle at 40% 40%, rgba(255, 255, 255, 0.2), rgba(72, 187, 120, 0.08))',
                zIndex: 1,
                animation: 'bubbleFloat2 8s ease-in-out infinite',
                '@keyframes bubbleFloat2': {
                  '0%': {
                    transform: 'translateY(0px) translateX(0px) scale(1)',
                    opacity: 0.7,
                  },
                  '25%': {
                    transform: 'translateY(15px) translateX(-10px) scale(1.1)',
                    opacity: 0.8,
                  },
                  '50%': {
                    transform: 'translateY(-10px) translateX(20px) scale(0.9)',
                    opacity: 0.6,
                  },
                  '75%': {
                    transform: 'translateY(5px) translateX(-5px) scale(1.05)',
                    opacity: 0.9,
                  },
                  '100%': {
                    transform: 'translateY(0px) translateX(0px) scale(1)',
                    opacity: 0.7,
                  },
                },
              }}
            />

            {/* Bubble 3 - Small */}
            <Box
              sx={{
                position: 'absolute',
                top: '50%',
                right: '5%',
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: 'radial-gradient(circle at 35% 35%, rgba(255, 255, 255, 0.18), rgba(56, 178, 172, 0.06))',
                zIndex: 1,
                animation: 'bubbleFloat3 4s ease-in-out infinite',
                '@keyframes bubbleFloat3': {
                  '0%': {
                    transform: 'translateY(0px) translateX(0px) scale(1)',
                    opacity: 0.6,
                  },
                  '50%': {
                    transform: 'translateY(-25px) translateX(15px) scale(1.2)',
                    opacity: 0.8,
                  },
                  '100%': {
                    transform: 'translateY(0px) translateX(0px) scale(1)',
                    opacity: 0.6,
                  },
                },
              }}
            />

            {/* Additional Small Bubbles */}
            <Box
              sx={{
                position: 'absolute',
                top: '30%',
                right: '25%',
                width: 25,
                height: 25,
                borderRadius: '50%',
                background: 'radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.15), rgba(20, 184, 166, 0.05))',
                zIndex: 1,
                animation: 'bubbleFloat4 7s ease-in-out infinite',
                '@keyframes bubbleFloat4': {
                  '0%': {
                    transform: 'translateY(0px) translateX(0px) scale(1)',
                    opacity: 0.5,
                  },
                  '40%': {
                    transform: 'translateY(20px) translateX(-8px) scale(1.3)',
                    opacity: 0.7,
                  },
                  '80%': {
                    transform: 'translateY(-15px) translateX(12px) scale(0.8)',
                    opacity: 0.4,
                  },
                  '100%': {
                    transform: 'translateY(0px) translateX(0px) scale(1)',
                    opacity: 0.5,
                  },
                },
              }}
            />

            <Box
              sx={{
                position: 'absolute',
                bottom: '40%',
                right: '8%',
                width: 35,
                height: 35,
                borderRadius: '50%',
                background: 'radial-gradient(circle at 25% 25%, rgba(255, 255, 255, 0.16), rgba(6, 182, 212, 0.07))',
                zIndex: 1,
                animation: 'bubbleFloat5 5s ease-in-out infinite',
                '@keyframes bubbleFloat5': {
                  '0%': {
                    transform: 'translateY(0px) translateX(0px) scale(1)',
                    opacity: 0.6,
                  },
                  '30%': {
                    transform: 'translateY(-18px) translateX(-12px) scale(1.15)',
                    opacity: 0.8,
                  },
                  '70%': {
                    transform: 'translateY(12px) translateX(18px) scale(0.85)',
                    opacity: 0.5,
                  },
                  '100%': {
                    transform: 'translateY(0px) translateX(0px) scale(1)',
                    opacity: 0.6,
                  },
                },
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
                  textShadow: '0 3px 6px rgba(0,0,0,0.5)',
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
                    textShadow: '0 2px 4px rgba(0,0,0,0.4)',
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
                  <Typography
                    variant="body1"
                    sx={{
                      textShadow: '0 2px 4px rgba(0,0,0,0.4)',
                    }}
                  >
                    Game data analytics & insights
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      backgroundColor: 'white',
                      borderRadius: '50%',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                    }}
                  />
                  <Typography
                    variant="body1"
                    sx={{
                      textShadow: '0 2px 4px rgba(0,0,0,0.4)',
                    }}
                  >
                    Real-time dashboard monitoring
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      backgroundColor: 'white',
                      borderRadius: '50%',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                    }}
                  />
                  <Typography
                    variant="body1"
                    sx={{
                      textShadow: '0 2px 4px rgba(0,0,0,0.4)',
                    }}
                  >
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
                    color: 'white',
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
