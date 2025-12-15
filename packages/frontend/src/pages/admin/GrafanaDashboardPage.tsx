import React, { useEffect, useMemo, useState } from 'react';
import { Box, Tabs, Tab } from '@mui/material';
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

export const GrafanaDashboardPage: React.FC = () => {
  const { isDark } = useTheme();
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const [selectedDashboard, setSelectedDashboard] = useState<DashboardKey>(() => {
    const param = searchParams.get('dashboard');
    if (param === 'sdkMetrics') {
      return 'sdkMetrics';
    }
    return 'overview';
  });

  useEffect(() => {
    const param = searchParams.get('dashboard');
    if (param === 'overview' || param === 'sdkMetrics') {
      setSelectedDashboard(param);
    }
  }, [searchParams]);

  const grafanaUrl = useMemo(() => {
    // In vite dev mode (port 5173), access Grafana directly on port 44000
    // In docker-compose or production, use /grafana subpath proxy
    const isViteDev = import.meta.env.DEV && window.location.port === '5173';
    if (isViteDev) {
      return `${window.location.protocol}//${window.location.hostname}:44000`;
    } else {
      return `${window.location.protocol}//${window.location.host}/grafana`;
    }
  }, []);

  const currentDashboard = useMemo(
    () => dashboards.find((item) => item.key === selectedDashboard) ?? dashboards[0],
    [selectedDashboard],
  );

  const iframeUrl = useMemo(() => {
    const theme = isDark ? 'dark' : 'light';
    return `${grafanaUrl}/d/${currentDashboard.uid}?kiosk=tv&theme=${theme}`;
  }, [grafanaUrl, isDark, currentDashboard.uid]);

  const handleChangeTab = (_event: React.SyntheticEvent, value: DashboardKey) => {
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
          sx={{ minHeight: 48, '& .MuiTab-root': { textTransform: 'none', fontWeight: 500 } }}
        >
          <Tab value="overview" label={t('grafanaDashboard.tabs.overview')} />
          <Tab value="sdkMetrics" label={t('grafanaDashboard.tabs.sdkMetrics')} />
        </Tabs>
      </Box>
      <Box sx={{ flex: 1 }}>
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
      </Box>
    </Box>
  );
};

export default GrafanaDashboardPage;
