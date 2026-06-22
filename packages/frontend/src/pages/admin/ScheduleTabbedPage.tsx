import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  CircularProgress,
  useTheme,
  alpha,
  Typography,
} from '@mui/material';
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

interface SidebarItemProps {
  item: {
    key: string;
    label: string;
    icon: React.ReactNode;
  };
  active: boolean;
  isDark: boolean;
  onClick: () => void;
}

const SidebarItem: React.FC<SidebarItemProps> = React.memo(
  function SidebarItem({ item, active, isDark, onClick }) {
    const theme = useTheme();
    return (
      <Box
        onClick={onClick}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.2,
          px: 1.5,
          py: 1,
          mb: 0.2,
          borderRadius: '6px 0 0 6px',
          cursor: 'pointer',
          position: 'relative',
          backgroundColor: active
            ? alpha(theme.palette.primary.main, isDark ? 0.12 : 0.08)
            : 'transparent',
          color: active ? theme.palette.primary.main : 'text.primary',
          transition: 'all 0.1s ease-in-out',
          '&:hover': {
            backgroundColor: active
              ? alpha(theme.palette.primary.main, isDark ? 0.15 : 0.1)
              : isDark
                ? 'rgba(255,255,255,0.05)'
                : 'rgba(0,0,0,0.04)',
          },
        }}
      >
        {active && (
          <Box
            sx={{
              position: 'absolute',
              left: 0,
              top: '20%',
              bottom: '20%',
              width: 3,
              borderRadius: '0 4px 4px 0',
              backgroundColor: theme.palette.primary.main,
            }}
          />
        )}
        <Box
          sx={{
            display: 'flex',
            opacity: active ? 1 : 0.6,
            color: 'inherit',
          }}
        >
          {item.icon}
        </Box>
        <Typography
          sx={{
            fontSize: '0.85rem',
            fontWeight: active ? 600 : 400,
          }}
        >
          {item.label}
        </Typography>
      </Box>
    );
  }
);

const ScheduleTabbedPage: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
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

  const segmentItems = [
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
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <PageHeader
        icon={<ScheduleIcon />}
        title={t('sidebar.scheduleManagement')}
        subtitle={t('schedule.subtitle')}
      />

      <Box
        sx={{
          display: 'flex',
          gap: 2,
          flex: 1,
          mt: -2,
          ml: -2,
          mr: -2,
          mb: -2,
        }}
      >
        {/* ══════ LEFT SIDEBAR ══════ */}
        <Box
          sx={{
            width: 220,
            flexShrink: 0,
            borderRight: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            pt: 2,
            pl: 2,
          }}
        >
          <Box sx={{ position: 'sticky', top: 2, pr: 1 }}>
            {segmentItems.map((item) => (
              <SidebarItem
                key={item.key}
                item={item}
                active={activeTab === item.key}
                isDark={isDark}
                onClick={() => handleSegmentChange(item.key)}
              />
            ))}
          </Box>
        </Box>

        {/* ══════ RIGHT CONTENT ══════ */}
        <Box sx={{ flex: 1, minWidth: 0, pt: 0, pr: 2, pb: 6 }}>
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
      </Box>
    </Box>
  );
};

export default ScheduleTabbedPage;
