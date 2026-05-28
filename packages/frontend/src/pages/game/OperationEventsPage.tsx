import React, { useMemo } from 'react';
import { Box } from '@mui/material';
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
import SegmentedTabs, {
  SegmentedTabItem,
} from '@/components/common/SegmentedTabs';

// Lazy-load the actual page contents
const HotTimeBuffEventPage = React.lazy(() => import('./HotTimeBuffEventPage'));
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
    labelKey: 'sidebar.hotTimeBuffEvent',
    icon: <WhatshotIcon sx={{ fontSize: 18 }} />,
    permission: [P.OPERATION_EVENTS_READ],
    component: HotTimeBuffEventPage,
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

  const handleSegmentChange = (key: string) => {
    setSearchParams({ tab: key }, { replace: true });
  };

  const segmentItems: SegmentedTabItem[] = useMemo(
    () =>
      visibleTabs.map((tab) => ({
        key: tab.key,
        label: t(tab.labelKey),
        icon: tab.icon,
      })),
    [visibleTabs, t]
  );

  const ActiveComponent = visibleTabs[activeTabIndex]?.component;

  return (
    <Box sx={{ px: 2, pb: 2, pt: 1.5 }}>
      <PageHeader
        icon={<EventIcon />}
        title={t('sidebar.operationEvents')}
        subtitle={t('operationEvents.subtitle', {
          defaultValue: '핫타임버프 이벤트 및 라이브 이벤트를 관리합니다.',
        })}
        tabs={
          <SegmentedTabs
            items={segmentItems}
            value={activeTabKey}
            onChange={handleSegmentChange}
          />
        }
      />

      <React.Suspense fallback={null}>
        {ActiveComponent && <ActiveComponent />}
      </React.Suspense>
    </Box>
  );
};

export default OperationEventsPage;
