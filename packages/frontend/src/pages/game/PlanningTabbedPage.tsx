import React, { useState, useCallback, useEffect } from 'react';
import { Box, CircularProgress } from '@mui/material';
import {
  Storage as StorageIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '@/components/common/PageHeader';
import SegmentedTabs, {
  SegmentedTabItem,
} from '@/components/common/SegmentedTabs';

const PlanningDataPage = React.lazy(() => import('./PlanningDataPage'));
const PlanningDataHistoryPage = React.lazy(
  () => import('./PlanningDataHistoryPage')
);

const TAB_KEYS = ['data', 'history'] as const;
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

const PlanningTabbedPage: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab: TabKey =
    (searchParams.get('tab') as TabKey) || 'data';

  const handleSegmentChange = useCallback(
    (key: string) => {
      const newParams = new URLSearchParams(searchParams);
      if (key === 'data') {
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
      key: 'data',
      label: t('sidebar.planningDataManagement'),
      icon: <StorageIcon sx={{ fontSize: 18 }} />,
    },
    {
      key: 'history',
      label: t('sidebar.planningDataHistory'),
      icon: <HistoryIcon sx={{ fontSize: 18 }} />,
    },
  ];

  return (
    <Box sx={{ px: 2, pb: 2, pt: 1.5 }}>
      <PageHeader
        icon={<StorageIcon />}
        title={t('sidebar.planningData')}
        subtitle={t('planningData.subtitle')}
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
        <TabPanel tabKey="data" activeKey={activeTab}>
          <PlanningDataPage embedded />
        </TabPanel>
        <TabPanel tabKey="history" activeKey={activeTab}>
          <PlanningDataHistoryPage embedded />
        </TabPanel>
      </React.Suspense>
    </Box>
  );
};

export default PlanningTabbedPage;
