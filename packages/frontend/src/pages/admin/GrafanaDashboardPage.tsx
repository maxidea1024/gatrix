import React, { useEffect, useMemo, useState } from 'react';
import { Box, Tabs, Tab, Typography, Alert } from '@mui/material';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';

type DashboardKey = 'overview' | 'sdkMetrics';

interface DashboardDefinition {
  key: DashboardKey;
  uid: string;
}

const dashboards: DashboardDefinition[] = [
  { key: 'overview', uid: 'gatrix-overview' },
  { key: 'sdkMetrics', uid: 'gatrix-sdk-metrics' },
];

/**
 * Resolve the Grafana base URL.
 * - Runtime/build-time env: always used if set
 * - Production: falls back to '/grafana' (nginx proxies it)
 * - Dev mode without explicit URL: returns null to prevent
 *   the SPA catch-all from embedding Gatrix inside itself.
 */
function resolveGrafanaUrl(): string | null {
  // Priority 1: runtime config injected by docker-entrypoint / config.js
  const runtimeEnv = (window as any)?.ENV?.VITE_GRAFANA_URL as
    | string
    | undefined;
  if (runtimeEnv && runtimeEnv.trim()) {
    return runtimeEnv.trim();
  }

  // Priority 2: build-time env
  const buildEnv = import.meta.env.VITE_GRAFANA_URL as string | undefined;
  if (buildEnv && buildEnv.trim()) {
    return buildEnv.trim();
  }

  // Priority 3: production build → nginx proxies /grafana
  if (!import.meta.env.DEV) {
    return '/grafana';
  }

  // Dev mode without explicit URL → cannot safely render iframe
  return null;
}

export const GrafanaDashboardPage: React.FC = () => {
  const { isDark } = useTheme();
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const [selectedDashboard, setSelectedDashboard] = useState<DashboardKey>(
    () => {
      const param = searchParams.get('dashboard');
      if (param === 'sdkMetrics') {
        return 'sdkMetrics';
      }
      return 'overview';
    }
  );

  useEffect(() => {
    const param = searchParams.get('dashboard');
    if (param === 'overview' || param === 'sdkMetrics') {
      setSelectedDashboard(param);
    }
  }, [searchParams]);

  const grafanaUrl = useMemo(() => resolveGrafanaUrl(), []);

  const currentDashboard = useMemo(
    () =>
      dashboards.find((item) => item.key === selectedDashboard) ??
      dashboards[0],
    [selectedDashboard]
  );

  const iframeUrl = useMemo(() => {
    if (!grafanaUrl) return null;
    const theme = isDark ? 'dark' : 'light';
    return `${grafanaUrl}/d/${currentDashboard.uid}?kiosk=tv&theme=${theme}`;
  }, [grafanaUrl, isDark, currentDashboard.uid]);

  const handleChangeTab = (
    _event: React.SyntheticEvent,
    value: DashboardKey
  ) => {
    setSelectedDashboard(value);
    const next = new URLSearchParams(searchParams);
    next.set('dashboard', value);
    setSearchParams(next, { replace: true });
  };

  return (
    <Box
      sx={{
        width: '100%',
        height: 'calc(100vh - 64px)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={selectedDashboard}
          onChange={handleChangeTab}
          aria-label="Grafana dashboards"
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            minHeight: 48,
            '& .MuiTab-root': { textTransform: 'none', fontWeight: 500 },
          }}
        >
          <Tab value="overview" label={t('grafanaDashboard.tabs.overview')} />
          <Tab
            value="sdkMetrics"
            label={t('grafanaDashboard.tabs.sdkMetrics')}
          />
        </Tabs>
      </Box>
      <Box
        sx={{
          flex: 1,
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
            title={t('sidebar.grafana')}
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
    </Box>
  );
};

export default GrafanaDashboardPage;
