import React, { useMemo } from 'react';
import { Box, Tab, Tabs, Paper } from '@mui/material';
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
        icon={<PollIcon />}
        title={t('surveys.title')}
        subtitle={t('surveys.subtitle')}
      />

      {/* Tabs */}
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

      {/* Tab content */}
      <React.Suspense fallback={null}>
        {ActiveComponent && <ActiveComponent />}
      </React.Suspense>
    </Box>
  );
};

export default SurveysTabPage;
