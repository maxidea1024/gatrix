import React, { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

const LogsPage: React.FC = () => {
  const { isDark } = useTheme();
  const { t } = useTranslation();

  const grafanaUrl = useMemo(() => {
    const url = ((import.meta.env as any).VITE_GRAFANA_URL as string) || `${window.location.protocol}//${window.location.hostname}:54000`;
    return url;
  }, []);

  const iframeUrl = useMemo(() => {
    const theme = isDark ? 'dark' : 'light';
    // Use kiosk mode to hide all Grafana UI elements
    return `${grafanaUrl}/d/gatrix-logs?orgId=1&kiosk&theme=${theme}`;
  }, [grafanaUrl, isDark]);

  return (
    <Box
      sx={{
        width: '100%',
        height: 'calc(100vh - 64px)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        p: 3,
      }}
    >
      <Box sx={{ mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          {t('monitoring.logs.title')}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t('monitoring.logs.subtitle')}
        </Typography>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0 }}>
        <iframe
          key={iframeUrl}
          src={iframeUrl}
          style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
          title={t('monitoring.logs.title')}
          allowFullScreen
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-top-navigation"
        />
      </Box>
    </Box>
  );
};

export default LogsPage;

