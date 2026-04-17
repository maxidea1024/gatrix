import React, { useMemo } from 'react';
import { Box, Typography, Alert } from '@mui/material';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

/**
 * Resolve the Grafana base URL.
 * Returns null when no Grafana endpoint is explicitly configured.
 */
function resolveGrafanaUrl(): string | null {
  const runtimeEnv = (window as any)?.ENV?.VITE_GRAFANA_URL as
    | string
    | undefined;
  if (runtimeEnv && runtimeEnv.trim()) {
    return runtimeEnv.trim();
  }

  const buildEnv = import.meta.env.VITE_GRAFANA_URL as string | undefined;
  if (buildEnv && buildEnv.trim()) {
    return buildEnv.trim();
  }

  return null;
}

const LogsPage: React.FC = () => {
  const { isDark } = useTheme();
  const { t } = useTranslation();

  const grafanaUrl = useMemo(() => resolveGrafanaUrl(), []);

  const iframeUrl = useMemo(() => {
    if (!grafanaUrl) return null;
    const theme = isDark ? 'dark' : 'light';
    // Use kiosk mode to hide all Grafana UI elements
    return `${grafanaUrl}/d/gatrix-logs?orgId=1&kiosk&theme=${theme}`;
  }, [grafanaUrl, isDark]);

  return (
    <Box
      sx={{
        width: 'calc(100% + 48px)',
        height: 'calc(100vh - 64px)',
        m: -3,
        p: 0,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {iframeUrl ? (
        <iframe
          key={iframeUrl}
          src={iframeUrl}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            display: 'block',
          }}
          title={t('monitoring.logs.title')}
          allowFullScreen
        />
      ) : (
        <Box sx={{ textAlign: 'center', p: 4 }}>
          <Alert severity="info" sx={{ mb: 2 }}>
            {t(
              'grafanaDashboard.notConfigured',
              'Grafana URL이 설정되지 않았습니다. 환경 변수 VITE_GRAFANA_URL을 설정해주세요.'
            )}
          </Alert>
          <Typography variant="body2" color="text.secondary">
            docker-compose.yml 또는 .env 파일에서 VITE_GRAFANA_URL 환경 변수를
            설정하세요.
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default LogsPage;
