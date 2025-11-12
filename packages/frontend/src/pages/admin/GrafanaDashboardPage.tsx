import React, { useMemo } from 'react';
import { Box } from '@mui/material';

export const GrafanaDashboardPage: React.FC = () => {
  const grafanaUrl = useMemo(() => {
    const url = ((import.meta.env as any).VITE_GRAFANA_URL as string) || `${window.location.protocol}//${window.location.hostname}:54000`;
    return url;
  }, []);

  const iframeUrl = useMemo(() => {
    // Grafana public dashboard URL format
    // You can customize this based on your dashboard ID
    return `${grafanaUrl}/d/000000001/home?orgId=1&kiosk=tv`;
  }, [grafanaUrl]);

  return (
    <Box
      sx={{
        width: '100%',
        height: 'calc(100vh - 64px)',
        overflow: 'hidden',
      }}
    >
      <iframe
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

