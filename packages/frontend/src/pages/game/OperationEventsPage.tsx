import React, { useMemo } from 'react';
import { Box, Tab, Tabs, Paper } from '@mui/material';
import {
  Whatshot as WhatshotIcon,
  Celebration as CelebrationIcon,
  Event as EventIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { P } from '@/types/permissions';
import PageHeader from '@/components/common/PageHeader';

// Lazy-load the actual page contents
const HotTimeButtonEventPage = React.lazy(
  () => import('./HotTimeButtonEventPage')
);
const LiveEventPage = React.lazy(() => import('./LiveEventPage'));

interface TabConfig {
  key: string;
  labelKey: string;
  icon: React.ReactElement;
  permission?: string[];
  component: React.LazyExoticComponent<React.ComponentType<any>>;
}

const TAB_CONFIGS: TabConfig[] = [
  {
    key: 'hottime',
    labelKey: 'sidebar.hotTimeButtonEvent',
    icon: <WhatshotIcon sx={{ fontSize: 18 }} />,
    permission: [P.OPERATION_EVENTS_READ],
    component: HotTimeButtonEventPage,
  },
  {
    key: 'live',
    labelKey: 'sidebar.liveEvent',
    icon: <CelebrationIcon sx={{ fontSize: 18 }} />,
    permission: [P.OPERATION_EVENTS_READ],
    component: LiveEventPage,
  },
];

const OperationEventsPage: React.FC = () => {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const visibleTabs = useMemo(
    () =>
      TAB_CONFIGS.filter(
        (tab) => !tab.permission || hasPermission(tab.permission)
      ),
    [hasPermission]
  );

  const activeTabKey = searchParams.get('tab') || visibleTabs[0]?.key || '';
  const activeTabIndex = Math.max(
    0,
    visibleTabs.findIndex((t) => t.key === activeTabKey)
  );

  const handleTabChange = (_: React.SyntheticEvent, newIndex: number) => {
    const tab = visibleTabs[newIndex];
    if (tab) {
      setSearchParams({ tab: tab.key }, { replace: true });
    }
  };

  const ActiveComponent = visibleTabs[activeTabIndex]?.component;

  return (
    <Box sx={{ p: 2 }}>
      <PageHeader
        icon={<EventIcon />}
        title={t('sidebar.operationEvents')}
        subtitle={t('operationEvents.subtitle', {
          defaultValue: '핫타임/버튼 이벤트 및 라이브 이벤트를 관리합니다.',
        })}
      />

      <Paper variant="outlined" sx={{ mb: 2 }}>
        <Tabs
          value={activeTabIndex}
          onChange={handleTabChange}
          sx={{
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 600,
              minHeight: 44,
            },
          }}
        >
          {visibleTabs.map((tab) => (
            <Tab
              key={tab.key}
              icon={tab.icon}
              iconPosition="start"
              label={t(tab.labelKey)}
            />
          ))}
        </Tabs>
      </Paper>

      <React.Suspense fallback={null}>
        {ActiveComponent && <ActiveComponent />}
      </React.Suspense>
    </Box>
  );
};

export default OperationEventsPage;
