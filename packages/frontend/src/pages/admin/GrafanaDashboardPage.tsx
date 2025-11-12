import React, { useMemo } from 'react';
import { Box } from '@mui/material';
import { useTheme } from '@/contexts/ThemeContext';

export const GrafanaDashboardPage: React.FC = () => {
  const { isDark } = useTheme();

  const grafanaUrl = useMemo(() => {
    const url = ((import.meta.env as any).VITE_GRAFANA_URL as string) || `${window.location.protocol}//${window.location.hostname}:54000`;
    return url;
  }, []);

  const iframeUrl = useMemo(() => {
    // Grafana home page with theme parameter
    // theme=dark or theme=light
    const theme = isDark ? 'dark' : 'light';
    return `${grafanaUrl}/?kiosk=tv&theme=${theme}`;
  }, [grafanaUrl, isDark]);

  return (
    <Box
      sx={{
        width: '100%',
        height: 'calc(100vh - 64px)',
        overflow: 'hidden',
      }}
    >
      <iframe
        key={iframeUrl}
        src={iframeUrl}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          display: 'block',
        }}
        title="Grafana Dashboard"
        allowFullScreen
        sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-top-navigation"
      />
    </Box>
  );
};

export default GrafanaDashboardPage;

