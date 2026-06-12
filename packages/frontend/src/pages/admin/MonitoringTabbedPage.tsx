import React, { useState, useCallback, useEffect } from 'react';
import { Box, CircularProgress } from '@mui/material';
import {
  Monitor as MonitorIcon,
  Article as LogsIcon,
  Notifications as AlertsIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '@/components/common/PageHeader';
import SegmentedTabs, {
  SegmentedTabItem,
} from '@/components/common/SegmentedTabs';

const GrafanaDashboardPage = React.lazy(() => import('./GrafanaDashboardPage'));
const LogsPage = React.lazy(() => import('../monitoring/LogsPage'));
const AlertsPage = React.lazy(() => import('../monitoring/AlertsPage'));

const TAB_KEYS = ['grafana', 'logs', 'alerts'] as const;
type TabKey = (typeof TAB_KEYS)[number];

interface TabPanelProps {
  children?: React.ReactNode;
  tabKey: TabKey;
  activeKey: TabKey;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, tabKey, activeKey }) => {
  const [hasRendered, setHasRendered] = useState(false);
  useEffect(() => {
    if (activeKey === tabKey) setHasRendered(true);
  }, [activeKey, tabKey]);

  if (!hasRendered) return null;

  return (
    <Box role="tabpanel" hidden={activeKey !== tabKey}>
      {children}
    </Box>
  );
};

const MonitoringTabbedPage: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab: TabKey = (searchParams.get('tab') as TabKey) || 'grafana';

  const handleSegmentChange = useCallback(
    (key: string) => {
      const newParams = new URLSearchParams(searchParams);
      if (key === 'grafana') {
        newParams.delete('tab');
      } else {
        newParams.set('tab', key);
      }
      setSearchParams(newParams, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const segmentItems: SegmentedTabItem[] = [
    {
      key: 'grafana',
      label: t('sidebar.grafana'),
      icon: <MonitorIcon sx={{ fontSize: 18 }} />,
    },
    {
      key: 'logs',
      label: t('sidebar.logs'),
      icon: <LogsIcon sx={{ fontSize: 18 }} />,
    },
    {
      key: 'alerts',
      label: t('sidebar.alerts'),
      icon: <AlertsIcon sx={{ fontSize: 18 }} />,
    },
  ];

  return (
    <Box>
      <PageHeader
        icon={<MonitorIcon />}
        title={t('sidebar.monitoring')}
        subtitle={t('monitoring.subtitle')}
        tabs={
          <SegmentedTabs
            items={segmentItems}
            value={activeTab}
            onChange={handleSegmentChange}
          />
        }
      />

      <React.Suspense
        fallback={
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress size={28} />
          </Box>
        }
      >
        <TabPanel tabKey="grafana" activeKey={activeTab}>
          <GrafanaDashboardPage embedded />
        </TabPanel>
        <TabPanel tabKey="logs" activeKey={activeTab}>
          <LogsPage embedded />
        </TabPanel>
        <TabPanel tabKey="alerts" activeKey={activeTab}>
          <AlertsPage embedded />
        </TabPanel>
      </React.Suspense>
    </Box>
  );
};

export default MonitoringTabbedPage;
