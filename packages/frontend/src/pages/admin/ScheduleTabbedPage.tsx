import React, { useState, useCallback, useEffect } from 'react';
import { Box, CircularProgress } from '@mui/material';
import {
  Schedule as ScheduleIcon,
  Work as WorkIcon,
  Monitor as MonitorIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '@/components/common/PageHeader';
import SegmentedTabs, {
  SegmentedTabItem,
} from '@/components/common/SegmentedTabs';

const SchedulerPage = React.lazy(() => import('./SchedulerPage'));
const JobsPage = React.lazy(() => import('./JobsPage'));
const QueueMonitorPage = React.lazy(() => import('./QueueMonitorPage'));

const TAB_KEYS = ['scheduler', 'jobs', 'queue'] as const;
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

const ScheduleTabbedPage: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab: TabKey = (searchParams.get('tab') as TabKey) || 'scheduler';

  const handleSegmentChange = useCallback(
    (key: string) => {
      const newParams = new URLSearchParams(searchParams);
      if (key === 'scheduler') {
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
      key: 'scheduler',
      label: t('sidebar.scheduler'),
      icon: <ScheduleIcon sx={{ fontSize: 18 }} />,
    },
    {
      key: 'jobs',
      label: t('sidebar.jobs'),
      icon: <WorkIcon sx={{ fontSize: 18 }} />,
    },
    {
      key: 'queue',
      label: t('sidebar.queueMonitor'),
      icon: <MonitorIcon sx={{ fontSize: 18 }} />,
    },
  ];

  return (
    <Box sx={{ px: 2, pb: 2, pt: 1.5 }}>
      <PageHeader
        icon={<ScheduleIcon />}
        title={t('sidebar.scheduleManagement')}
        subtitle={t('schedule.subtitle')}
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
        <TabPanel tabKey="scheduler" activeKey={activeTab}>
          <SchedulerPage embedded />
        </TabPanel>
        <TabPanel tabKey="jobs" activeKey={activeTab}>
          <JobsPage embedded />
        </TabPanel>
        <TabPanel tabKey="queue" activeKey={activeTab}>
          <QueueMonitorPage embedded />
        </TabPanel>
      </React.Suspense>
    </Box>
  );
};

export default ScheduleTabbedPage;
