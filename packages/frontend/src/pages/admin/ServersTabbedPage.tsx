import React, { useState, useCallback, useEffect } from 'react';
import { Box, Tabs, Tab, CircularProgress } from '@mui/material';
import {
  Storage as StorageIcon,
  History as HistoryIcon,
  Dns as DnsIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '@/components/common/PageHeader';

const ServerListPage = React.lazy(() => import('./ServerListPage'));
const ServerLifecyclePage = React.lazy(() => import('./ServerLifecyclePage'));
const GatrixEdgesPage = React.lazy(() => import('./GatrixEdgesPage'));

const TAB_LIST = 0;
const TAB_LIFECYCLE = 1;
const TAB_EDGES = 2;

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
      id={`servers-tabpanel-${index}`}
      aria-labelledby={`servers-tab-${index}`}
    >
      {children}
    </Box>
  );
};

const ServersTabbedPage: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const getInitialTab = (): number => {
    const tab = searchParams.get('tab');
    if (tab === 'lifecycle') return TAB_LIFECYCLE;
    if (tab === 'edges') return TAB_EDGES;
    return TAB_LIST;
  };

  const [activeTab, setActiveTab] = useState(getInitialTab);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'lifecycle' && activeTab !== TAB_LIFECYCLE)
      setActiveTab(TAB_LIFECYCLE);
    if (tab === 'edges' && activeTab !== TAB_EDGES) setActiveTab(TAB_EDGES);
    if ((tab === null || tab === 'list') && activeTab !== TAB_LIST)
      setActiveTab(TAB_LIST);
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTabChange = useCallback(
    (_: React.SyntheticEvent, newValue: number) => {
      setActiveTab(newValue);
      const newParams = new URLSearchParams(searchParams);
      if (newValue === TAB_LIST) {
        newParams.delete('tab');
      } else if (newValue === TAB_LIFECYCLE) {
        newParams.set('tab', 'lifecycle');
      } else {
        newParams.set('tab', 'edges');
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
        title={t('sidebar.serverManagement')}
        subtitle={t(
          'servers.subtitle')}
      />

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 0 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          aria-label="servers tabs"
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
              <StorageIcon sx={{ fontSize: 18 }} />,
              t('sidebar.serverList')
            )}
            id="servers-tab-0"
            aria-controls="servers-tabpanel-0"
          />
          <Tab
            label={tabLabel(
              <HistoryIcon sx={{ fontSize: 18 }} />,
              t('sidebar.serverLifecycle')
            )}
            id="servers-tab-1"
            aria-controls="servers-tabpanel-1"
          />
          <Tab
            label={tabLabel(
              <DnsIcon sx={{ fontSize: 18 }} />,
              t('sidebar.gatrixEdges')
            )}
            id="servers-tab-2"
            aria-controls="servers-tabpanel-2"
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
        <TabPanel value={activeTab} index={TAB_LIST}>
          <ServerListPage embedded />
        </TabPanel>
        <TabPanel value={activeTab} index={TAB_LIFECYCLE}>
          <ServerLifecyclePage embedded />
        </TabPanel>
        <TabPanel value={activeTab} index={TAB_EDGES}>
          <GatrixEdgesPage embedded />
        </TabPanel>
      </React.Suspense>
    </Box>
  );
};

export default ServersTabbedPage;
