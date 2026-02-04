import React from 'react';
import { Box, CircularProgress, Backdrop, Typography, LinearProgress } from '@mui/material';
import { HourglassEmpty } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

interface LoadingIndicatorProps {
  variant?: 'circular' | 'linear' | 'backdrop' | 'inline';
  size?: 'small' | 'medium' | 'large';
  message?: string;
  open?: boolean;
}

export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  variant = 'circular',
  size = 'medium',
  message,
  open = true,
}) => {
  const getSize = () => {
    switch (size) {
      case 'small':
        return 20;
      case 'large':
        return 60;
      default:
        return 40;
    }
  };

  if (variant === 'backdrop') {
    return (
      <Backdrop
        sx={{
          color: '#fff',
          zIndex: (theme) => theme.zIndex.drawer + 1,
          flexDirection: 'column',
          gap: 2,
        }}
        open={open}
      >
        <HourglassEmpty sx={{ fontSize: 48, mb: 2 }} />
        <CircularProgress color="inherit" size={getSize()} />
        {message && (
          <Typography variant="body1" sx={{ mt: 2 }}>
            {message}
          </Typography>
        )}
      </Backdrop>
    );
  }

  if (variant === 'linear') {
    return (
      <Box sx={{ width: '100%' }}>
        <LinearProgress />
        {message && (
          <Typography variant="body2" align="center" sx={{ mt: 1 }}>
            {message}
          </Typography>
        )}
      </Box>
    );
  }

  if (variant === 'inline') {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <CircularProgress size={getSize()} />
        {message && <Typography variant="body2">{message}</Typography>}
      </Box>
    );
  }

  // Default circular variant
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        p: 3,
      }}
    >
      <HourglassEmpty sx={{ fontSize: 48, color: 'primary.main' }} />
      <CircularProgress size={getSize()} />
      {message && (
        <Typography variant="body2" color="text.secondary" align="center">
          {message}
        </Typography>
      )}
    </Box>
  );
};

// Page loading component
export const PageLoading: React.FC<{ message?: string }> = ({ message }) => {
  const { t } = useTranslation();

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        gap: 3,
      }}
    >
      <HourglassEmpty sx={{ fontSize: 64, color: 'primary.main' }} />
      <CircularProgress size={48} />
      <Typography variant="h6" color="text.secondary">
        {message || t('common.loading')}
      </Typography>
    </Box>
  );
};

// Full screen loading component
export const FullScreenLoading: React.FC<{ message?: string }> = ({ message }) => {
  const { t } = useTranslation();

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'background.default',
        zIndex: 9999,
        gap: 3,
      }}
    >
      <HourglassEmpty sx={{ fontSize: 80, color: 'primary.main' }} />
      <CircularProgress size={60} />
      <Typography variant="h5" color="text.secondary">
        {message || t('common.loading')}
      </Typography>
    </Box>
  );
};

// API loading context
interface ApiLoadingContextType {
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
  loadingMessage: string;
  setLoadingMessage: (message: string) => void;
}

const ApiLoadingContext = React.createContext<ApiLoadingContextType | undefined>(undefined);

export const ApiLoadingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLoading, setIsLoading] = React.useState(false);
  const [loadingMessage, setLoadingMessage] = React.useState('Loading...');

  const setLoading = (loading: boolean) => {
    setIsLoading(loading);
  };

  const value = {
    isLoading,
    setLoading,
    loadingMessage,
    setLoadingMessage,
  };

  return (
    <ApiLoadingContext.Provider value={value}>
      {children}
      <LoadingIndicator variant="backdrop" open={isLoading} message={loadingMessage} />
    </ApiLoadingContext.Provider>
  );
};

export const useApiLoading = () => {
  const context = React.useContext(ApiLoadingContext);
  if (context === undefined) {
    throw new Error('useApiLoading must be used within an ApiLoadingProvider');
  }
  return context;
};

export default LoadingIndicator;
