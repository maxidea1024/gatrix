import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Tabs,
  Tab,
  CircularProgress,
} from '@mui/material';
import {
  Business as OrgIcon,
  Folder as ProjectIcon,
  Public as EnvironmentIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSearchParams, useLocation } from 'react-router-dom';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import PageHeader from '@/components/common/PageHeader';

// Lazy-load tab contents to avoid a massive bundle
const WorkspacePage = React.lazy(() => import('./WorkspacePage'));
const ProjectsPage = React.lazy(() => import('./ProjectsPage'));
const EnvironmentsPage = React.lazy(
  () => import('../settings/EnvironmentsPage')
);

// Tab panel IDs
const TAB_ORGS = 0;
const TAB_PROJECTS = 1;
const TAB_ENVIRONMENTS = 2;

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => {
  // Keep mounted once rendered to preserve state across tab switches
  const [hasRendered, setHasRendered] = useState(false);
  useEffect(() => {
    if (value === index) setHasRendered(true);
  }, [value, index]);

  if (!hasRendered) return null;

  return (
    <Box
      role="tabpanel"
      hidden={value !== index}
      id={`workspace-tabpanel-${index}`}
      aria-labelledby={`workspace-tab-${index}`}
    >
      {children}
    </Box>
  );
};

const WorkspaceTabbedPage: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const { currentOrg, organisations } = useOrgProject();

  // Determine initial tab from URL path and params
  const getInitialTab = (): number => {
    // Pathname-based detection for direct route access
    const path = location.pathname;
    if (path.endsWith('/environments')) return TAB_ENVIRONMENTS;
    if (path.endsWith('/projects')) return TAB_PROJECTS;
    // Tab param detection
    const tab = searchParams.get('tab');
    if (tab === 'projects') return TAB_PROJECTS;
    if (tab === 'environments') return TAB_ENVIRONMENTS;
    // Legacy URL compat: if projectId is in URL, show environments
    if (searchParams.get('projectId')) return TAB_ENVIRONMENTS;
    // If orgId is in URL (from old projects page link), show projects
    if (searchParams.get('orgId')) return TAB_PROJECTS;
    return TAB_ORGS;
  };

  const [activeTab, setActiveTab] = useState(getInitialTab);

  // Sync tab when URL params change externally (e.g. from sidebar context manage buttons)
  React.useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'organisations' || tab === null) {
      // Only sync if not already on the target tab to avoid unnecessary re-renders
      if (tab === 'organisations' && activeTab !== TAB_ORGS) setActiveTab(TAB_ORGS);
    }
    if (tab === 'projects' && activeTab !== TAB_PROJECTS) setActiveTab(TAB_PROJECTS);
    if (tab === 'environments' && activeTab !== TAB_ENVIRONMENTS) setActiveTab(TAB_ENVIRONMENTS);
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTabChange = useCallback(
    (_: React.SyntheticEvent, newValue: number) => {
      setActiveTab(newValue);
      // Update URL tab param without losing other params
      const newParams = new URLSearchParams(searchParams);
      if (newValue === TAB_ORGS) {
        newParams.delete('tab');
        newParams.delete('orgId');
        newParams.delete('projectId');
      } else if (newValue === TAB_PROJECTS) {
        newParams.set('tab', 'projects');
        newParams.delete('projectId');
      } else {
        newParams.set('tab', 'environments');
      }
      setSearchParams(newParams, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  // Cross-tab navigation: called from child pages
  const handleNavigateToProjects = useCallback(
    (orgId: string) => {
      const newParams = new URLSearchParams();
      newParams.set('tab', 'projects');
      newParams.set('orgId', orgId);
      setSearchParams(newParams, { replace: true });
      setActiveTab(TAB_PROJECTS);
    },
    [setSearchParams]
  );

  const handleNavigateToOrgs = useCallback(() => {
    const newParams = new URLSearchParams();
    setSearchParams(newParams, { replace: true });
    setActiveTab(TAB_ORGS);
  }, [setSearchParams]);

  const handleNavigateToEnvironments = useCallback(
    (orgId: string, projectId: string) => {
      const newParams = new URLSearchParams();
      newParams.set('tab', 'environments');
      newParams.set('orgId', orgId);
      newParams.set('projectId', projectId);
      setSearchParams(newParams, { replace: true });
      setActiveTab(TAB_ENVIRONMENTS);
    },
    [setSearchParams]
  );

  const tabLabel = (icon: React.ReactElement, label: string) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
      {icon}
      <span>{label}</span>
    </Box>
  );

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        title={t('workspace.title')}
        subtitle={t('workspace.subtitle')}
      />

      {/* Tab bar */}
      <Box
        sx={{
          borderBottom: 1,
          borderColor: 'divider',
          mb: 0,
        }}
      >
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          aria-label="workspace tabs"
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
              <OrgIcon sx={{ fontSize: 18 }} />,
              t('workspace.tabs.organisations')
            )}
            id="workspace-tab-0"
            aria-controls="workspace-tabpanel-0"
          />
          <Tab
            label={tabLabel(
              <ProjectIcon sx={{ fontSize: 18 }} />,
              t('workspace.tabs.projects')
            )}
            id="workspace-tab-1"
            aria-controls="workspace-tabpanel-1"
          />
          <Tab
            label={tabLabel(
              <EnvironmentIcon sx={{ fontSize: 18 }} />,
              t('workspace.tabs.environments')
            )}
            id="workspace-tab-2"
            aria-controls="workspace-tabpanel-2"
          />
        </Tabs>
      </Box>

      {/* Tab panels */}
      <React.Suspense
        fallback={
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress size={28} />
          </Box>
        }
      >
        <TabPanel value={activeTab} index={TAB_ORGS}>
          <WorkspacePage
            embedded
            onNavigateToProjects={handleNavigateToProjects}
          />
        </TabPanel>

        <TabPanel value={activeTab} index={TAB_PROJECTS}>
          <ProjectsPage
            embedded
            onNavigateToEnvironments={handleNavigateToEnvironments}
            onNavigateToOrgs={handleNavigateToOrgs}
          />
        </TabPanel>

        <TabPanel value={activeTab} index={TAB_ENVIRONMENTS}>
          <EnvironmentsPage
            embedded
            onNavigateToOrgs={handleNavigateToOrgs}
            onNavigateToProjects={handleNavigateToProjects}
          />
        </TabPanel>
      </React.Suspense>
    </Box>
  );
};

export default WorkspaceTabbedPage;
