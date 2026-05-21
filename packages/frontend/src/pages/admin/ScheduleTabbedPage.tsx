import React, { useState, useCallback, useEffect } from 'react';
import { Box, Tabs, Tab, CircularProgress } from '@mui/material';
import {
  Schedule as ScheduleIcon,
  Work as WorkIcon,
  Monitor as MonitorIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '@/components/common/PageHeader';

const SchedulerPage = React.lazy(() => import('./SchedulerPage'));
const JobsPage = React.lazy(() => import('./JobsPage'));
const QueueMonitorPage = React.lazy(() => import('./QueueMonitorPage'));

const TAB_SCHEDULER = 0;
const TAB_JOBS = 1;
const TAB_QUEUE = 2;

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
      id={`schedule-tabpanel-${index}`}
      aria-labelledby={`schedule-tab-${index}`}
    >
      {children}
    </Box>
  );
};

const ScheduleTabbedPage: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const getInitialTab = (): number => {
    const tab = searchParams.get('tab');
    if (tab === 'jobs') return TAB_JOBS;
    if (tab === 'queue') return TAB_QUEUE;
    return TAB_SCHEDULER;
  };

  const [activeTab, setActiveTab] = useState(getInitialTab);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'jobs' && activeTab !== TAB_JOBS) setActiveTab(TAB_JOBS);
    if (tab === 'queue' && activeTab !== TAB_QUEUE) setActiveTab(TAB_QUEUE);
    if ((tab === null || tab === 'scheduler') && activeTab !== TAB_SCHEDULER)
      setActiveTab(TAB_SCHEDULER);
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTabChange = useCallback(
    (_: React.SyntheticEvent, newValue: number) => {
      setActiveTab(newValue);
      const newParams = new URLSearchParams(searchParams);
      if (newValue === TAB_SCHEDULER) {
        newParams.delete('tab');
      } else if (newValue === TAB_JOBS) {
        newParams.set('tab', 'jobs');
      } else {
        newParams.set('tab', 'queue');
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
        title={t('sidebar.scheduleManagement')}
        subtitle={t('schedule.subtitle', '스케줄 작업과 큐 상태를 관리합니다.')}
      />

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 0 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          aria-label="schedule tabs"
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
              <ScheduleIcon sx={{ fontSize: 18 }} />,
              t('sidebar.scheduler')
            )}
            id="schedule-tab-0"
            aria-controls="schedule-tabpanel-0"
          />
          <Tab
            label={tabLabel(
              <WorkIcon sx={{ fontSize: 18 }} />,
              t('sidebar.jobs')
            )}
            id="schedule-tab-1"
            aria-controls="schedule-tabpanel-1"
          />
          <Tab
            label={tabLabel(
              <MonitorIcon sx={{ fontSize: 18 }} />,
              t('sidebar.queueMonitor')
            )}
            id="schedule-tab-2"
            aria-controls="schedule-tabpanel-2"
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
        <TabPanel value={activeTab} index={TAB_SCHEDULER}>
          <SchedulerPage embedded />
        </TabPanel>
        <TabPanel value={activeTab} index={TAB_JOBS}>
          <JobsPage embedded />
        </TabPanel>
        <TabPanel value={activeTab} index={TAB_QUEUE}>
          <QueueMonitorPage embedded />
        </TabPanel>
      </React.Suspense>
    </Box>
  );
};

export default ScheduleTabbedPage;
