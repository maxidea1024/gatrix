import React, { useEffect, useState } from 'react';
import { Box, Typography, Card, CardContent, Alert, CircularProgress } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';

const QueueMonitorPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 페이지 로드 시 iframe 로딩 완료를 기다림
    const timer = setTimeout(() => {
      setLoading(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  if (!user || user.role !== 'admin') {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          {t('errors.accessDenied')}
        </Alert>
      </Box>
    );
  }

  const bullboardUrl = `${window.location.protocol}//${window.location.host}/admin/queues`;

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
          {t('jobs.monitor')}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {t('jobs.monitorDescription')}
        </Typography>
      </Box>

      <Card>
        <CardContent sx={{ p: 0, position: 'relative', height: 'calc(100vh - 200px)' }}>
          {loading && (
            <Box
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 1,
              }}
            >
              <CircularProgress />
            </Box>
          )}
          
          {error && (
            <Box sx={{ p: 3 }}>
              <Alert severity="error">
                {error}
              </Alert>
            </Box>
          )}

          <iframe
            src={bullboardUrl}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              opacity: loading ? 0.3 : 1,
              transition: 'opacity 0.3s ease-in-out',
            }}
            title="Queue Monitor"
            onLoad={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setError(t('jobs.monitorLoadError'));
            }}
          />
        </CardContent>
      </Card>
    </Box>
  );
};

export default QueueMonitorPage;
