import React, { useMemo } from 'react';
import { Box } from '@mui/material';
import {
  Poll as PollIcon,
  Description as DescriptionIcon,
  Assignment as AssignmentIcon,
  History as HistoryIcon,
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
const SurveysPage = React.lazy(() => import('./SurveysPage'));
const SurveyTemplatesPage = React.lazy(() => import('./SurveyTemplatesPage'));
const SurveyLogsPage = React.lazy(() => import('./SurveyLogsPage'));

interface TabConfig {
  key: string;
  labelKey: string;
  icon: React.ReactElement;
  permission?: string[];
  component: React.LazyExoticComponent<React.ComponentType<any>>;
}

const TAB_CONFIGS: TabConfig[] = [
  {
    key: 'definitions',
    labelKey: 'sidebar.surveyDefinitions',
    icon: <DescriptionIcon sx={{ fontSize: 18 }} />,
    permission: [P.SURVEYS_READ],
    component: SurveysPage,
  },
  {
    key: 'templates',
    labelKey: 'sidebar.surveyTemplates',
    icon: <AssignmentIcon sx={{ fontSize: 18 }} />,
    permission: [P.SURVEYS_UPDATE],
    component: SurveyTemplatesPage,
  },
  {
    key: 'logs',
    labelKey: 'sidebar.surveyLogs',
    icon: <HistoryIcon sx={{ fontSize: 18 }} />,
    permission: [P.SURVEYS_READ],
    component: SurveyLogsPage,
  },
];

const SurveysTabPage: React.FC = () => {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Filter tabs by permission
  const visibleTabs = useMemo(
    () =>
      TAB_CONFIGS.filter(
        (tab) => !tab.permission || hasPermission(tab.permission)
      ),
    [hasPermission]
  );

  // Get active tab from URL param, default to first visible tab
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
    <Box>
      <PageHeader
        icon={<PollIcon />}
        title={t('surveys.title')}
        subtitle={t('surveys.subtitle')}
        tabs={
          <SegmentedTabs
            items={segmentItems}
            value={activeTabKey}
            onChange={handleSegmentChange}
          />
        }
      />

      {/* Tab content */}
      <React.Suspense fallback={null}>
        {ActiveComponent && <ActiveComponent />}
      </React.Suspense>
    </Box>
  );
};

export default SurveysTabPage;
