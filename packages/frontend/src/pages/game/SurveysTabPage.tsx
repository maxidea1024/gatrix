import React, { useMemo } from 'react';
import { Box, Typography, useTheme, alpha } from '@mui/material';
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
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
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

  const handleTabChange = (key: string) => {
    setSearchParams({ tab: key }, { replace: true });
  };

  const ActiveComponent = visibleTabs[activeTabIndex]?.component;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <PageHeader
        icon={<PollIcon />}
        title={t('surveys.title')}
        subtitle={t('surveys.subtitle')}
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
            width: 200,
            flexShrink: 0,
            borderRight: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            pt: 2,
            pl: 2,
          }}
        >
          <Box sx={{ position: 'sticky', top: 2, pr: 1 }}>
            {visibleTabs.map((tab) => {
              const active = tab.key === activeTabKey;
              return (
                <Box
                  key={tab.key}
                  onClick={() => handleTabChange(tab.key)}
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
                      ? alpha(
                          theme.palette.primary.main,
                          isDark ? 0.12 : 0.08
                        )
                      : 'transparent',
                    color: active
                      ? theme.palette.primary.main
                      : 'text.primary',
                    transition: 'all 0.1s ease-in-out',
                    '&:hover': {
                      backgroundColor: active
                        ? alpha(
                            theme.palette.primary.main,
                            isDark ? 0.15 : 0.1
                          )
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
                    {tab.icon}
                  </Box>
                  <Typography
                    noWrap
                    sx={{
                      fontSize: '0.85rem',
                      fontWeight: active ? 600 : 400,
                    }}
                  >
                    {t(tab.labelKey)}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </Box>

        {/* ══════ RIGHT CONTENT ══════ */}
        <Box sx={{ flex: 1, minWidth: 0, pt: 2, pr: 2, pb: 6 }}>
          <React.Suspense fallback={null}>
            {ActiveComponent && <ActiveComponent />}
          </React.Suspense>
        </Box>
      </Box>
    </Box>
  );
};

export default SurveysTabPage;
