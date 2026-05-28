import React, { useState, useCallback, useEffect } from 'react';
import { Box, CircularProgress } from '@mui/material';
import {
  Storage as StorageIcon,
  History as HistoryIcon,
  Dns as DnsIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '@/components/common/PageHeader';
import SegmentedTabs, {
  SegmentedTabItem,
} from '@/components/common/SegmentedTabs';

const ServerListPage = React.lazy(() => import('./ServerListPage'));
const ServerLifecyclePage = React.lazy(() => import('./ServerLifecyclePage'));
const GatrixEdgesPage = React.lazy(() => import('./GatrixEdgesPage'));

const TAB_KEYS = ['list', 'lifecycle', 'edges'] as const;
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

const ServersTabbedPage: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab: TabKey =
    (searchParams.get('tab') as TabKey) || 'list';

  const handleSegmentChange = useCallback(
    (key: string) => {
      const newParams = new URLSearchParams(searchParams);
      if (key === 'list') {
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
      key: 'list',
      label: t('sidebar.serverList'),
      icon: <StorageIcon sx={{ fontSize: 18 }} />,
    },
    {
      key: 'lifecycle',
      label: t('sidebar.serverLifecycle'),
      icon: <HistoryIcon sx={{ fontSize: 18 }} />,
    },
    {
      key: 'edges',
      label: t('sidebar.gatrixEdges'),
      icon: <DnsIcon sx={{ fontSize: 18 }} />,
    },
  ];

  return (
    <Box sx={{ px: 2, pb: 2, pt: 1.5 }}>
      <PageHeader
        title={t('sidebar.serverManagement')}
        subtitle={t('servers.subtitle')}
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
        <TabPanel tabKey="list" activeKey={activeTab}>
          <ServerListPage embedded />
        </TabPanel>
        <TabPanel tabKey="lifecycle" activeKey={activeTab}>
          <ServerLifecyclePage embedded />
        </TabPanel>
        <TabPanel tabKey="edges" activeKey={activeTab}>
          <GatrixEdgesPage embedded />
        </TabPanel>
      </React.Suspense>
    </Box>
  );
};

export default ServersTabbedPage;
