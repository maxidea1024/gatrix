import React, { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

const LogsPage: React.FC = () => {
  const { isDark } = useTheme();
  const { t } = useTranslation();

  const grafanaUrl = useMemo(() => {
    // Priority 1: Check runtime config (from docker-entrypoint.sh / config.js)
    const runtimeEnv = (window as any)?.ENV?.VITE_GRAFANA_URL as string | undefined;
    if (runtimeEnv && runtimeEnv.trim()) {
      return runtimeEnv.trim();
    }
    // Priority 2: Standard subpath proxy (works for both Dev/Vite and Prod/Nginx)
    return '/grafana';
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
        />
      </Box>
    </Box>
  );
};

export default LogsPage;

