import React, { useState, useCallback, useEffect } from 'react';
import { Box, Tabs, Tab, CircularProgress } from '@mui/material';
import {
  Monitor as MonitorIcon,
  Article as LogsIcon,
  Notifications as AlertsIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '@/components/common/PageHeader';

const GrafanaDashboardPage = React.lazy(() => import('./GrafanaDashboardPage'));
const LogsPage = React.lazy(() => import('../monitoring/LogsPage'));
const AlertsPage = React.lazy(() => import('../monitoring/AlertsPage'));

const TAB_GRAFANA = 0;
const TAB_LOGS = 1;
const TAB_ALERTS = 2;

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => {
  const [hasRendered, setHasRendered] = useState(false);
  useEffect(() => {
    if (value === index) setHasRendered(true);
  }, [value, index]);

  if (!hasRendered) return null;

  return (
    <Box
      role="tabpanel"
      hidden={value !== index}
      id={`monitoring-tabpanel-${index}`}
      aria-labelledby={`monitoring-tab-${index}`}
    >
      {children}
    </Box>
  );
};

const MonitoringTabbedPage: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const getInitialTab = (): number => {
    const tab = searchParams.get('tab');
    if (tab === 'logs') return TAB_LOGS;
    if (tab === 'alerts') return TAB_ALERTS;
    return TAB_GRAFANA;
  };

  const [activeTab, setActiveTab] = useState(getInitialTab);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'logs' && activeTab !== TAB_LOGS) setActiveTab(TAB_LOGS);
    if (tab === 'alerts' && activeTab !== TAB_ALERTS) setActiveTab(TAB_ALERTS);
    if ((tab === null || tab === 'grafana') && activeTab !== TAB_GRAFANA)
      setActiveTab(TAB_GRAFANA);
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTabChange = useCallback(
    (_: React.SyntheticEvent, newValue: number) => {
      setActiveTab(newValue);
      const newParams = new URLSearchParams(searchParams);
      if (newValue === TAB_GRAFANA) {
        newParams.delete('tab');
      } else if (newValue === TAB_LOGS) {
        newParams.set('tab', 'logs');
      } else {
        newParams.set('tab', 'alerts');
      }
      setSearchParams(newParams, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const tabLabel = (icon: React.ReactElement, label: string) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
      {icon}
      <span>{label}</span>
    </Box>
  );

  return (
    <Box sx={{ p: 2 }}>
      <PageHeader
        title={t('sidebar.monitoring')}
        subtitle={t(
          'monitoring.subtitle',
          '시스템 모니터링과 알림을 관리합니다.'
        )}
      />

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 0 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          aria-label="monitoring tabs"
          sx={{
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 500,
              fontSize: '0.875rem',
              minHeight: 48,
            },
          }}
        >
          <Tab
            label={tabLabel(
              <MonitorIcon sx={{ fontSize: 18 }} />,
              t('sidebar.grafana')
            )}
            id="monitoring-tab-0"
            aria-controls="monitoring-tabpanel-0"
          />
          <Tab
            label={tabLabel(
              <LogsIcon sx={{ fontSize: 18 }} />,
              t('sidebar.logs')
            )}
            id="monitoring-tab-1"
            aria-controls="monitoring-tabpanel-1"
          />
          <Tab
            label={tabLabel(
              <AlertsIcon sx={{ fontSize: 18 }} />,
              t('sidebar.alerts')
            )}
            id="monitoring-tab-2"
            aria-controls="monitoring-tabpanel-2"
          />
        </Tabs>
      </Box>

      <React.Suspense
        fallback={
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress size={28} />
          </Box>
        }
      >
        <TabPanel value={activeTab} index={TAB_GRAFANA}>
          <GrafanaDashboardPage embedded />
        </TabPanel>
        <TabPanel value={activeTab} index={TAB_LOGS}>
          <LogsPage embedded />
        </TabPanel>
        <TabPanel value={activeTab} index={TAB_ALERTS}>
          <AlertsPage embedded />
        </TabPanel>
      </React.Suspense>
    </Box>
  );
};

export default MonitoringTabbedPage;
