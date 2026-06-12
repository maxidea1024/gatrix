import React, { useState, useCallback, useEffect } from 'react';
import { Box, CircularProgress } from '@mui/material';
import {
  Business as OrgIcon,
  Folder as ProjectIcon,
  Public as EnvironmentIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSearchParams, useLocation } from 'react-router-dom';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import PageHeader from '@/components/common/PageHeader';
import SegmentedTabs, {
  SegmentedTabItem,
} from '@/components/common/SegmentedTabs';

// Lazy-load tab contents to avoid a massive bundle
const WorkspacePage = React.lazy(() => import('./WorkspacePage'));
const ProjectsPage = React.lazy(() => import('./ProjectsPage'));
const EnvironmentsPage = React.lazy(
  () => import('../settings/EnvironmentsPage')
);

const TAB_KEYS = ['organisations', 'projects', 'environments'] as const;
type TabKey = (typeof TAB_KEYS)[number];

interface TabPanelProps {
  children?: React.ReactNode;
  tabKey: TabKey;
  activeKey: TabKey;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, tabKey, activeKey }) => {
  // Keep mounted once rendered to preserve state across tab switches
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

const WorkspaceTabbedPage: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const { currentOrg, organisations } = useOrgProject();

  // Determine initial tab from URL path and params
  const getActiveTab = (): TabKey => {
    const path = location.pathname;
    if (path.endsWith('/environments')) return 'environments';
    if (path.endsWith('/projects')) return 'projects';
    const tab = searchParams.get('tab');
    if (tab === 'projects') return 'projects';
    if (tab === 'environments') return 'environments';
    if (searchParams.get('projectId')) return 'environments';
    if (searchParams.get('orgId')) return 'projects';
    return 'organisations';
  };

  const activeTab = getActiveTab();

  const handleSegmentChange = useCallback(
    (key: string) => {
      const newParams = new URLSearchParams(searchParams);
      if (key === 'organisations') {
        newParams.delete('tab');
        newParams.delete('orgId');
        newParams.delete('projectId');
      } else if (key === 'projects') {
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
    },
    [setSearchParams]
  );

  const handleNavigateToOrgs = useCallback(() => {
    const newParams = new URLSearchParams();
    setSearchParams(newParams, { replace: true });
  }, [setSearchParams]);

  const handleNavigateToEnvironments = useCallback(
    (orgId: string, projectId: string) => {
      const newParams = new URLSearchParams();
      newParams.set('tab', 'environments');
      newParams.set('orgId', orgId);
      newParams.set('projectId', projectId);
      setSearchParams(newParams, { replace: true });
    },
    [setSearchParams]
  );

  const segmentItems: SegmentedTabItem[] = [
    {
      key: 'organisations',
      label: t('workspace.tabs.organisations'),
      icon: <OrgIcon sx={{ fontSize: 18 }} />,
    },
    {
      key: 'projects',
      label: t('workspace.tabs.projects'),
      icon: <ProjectIcon sx={{ fontSize: 18 }} />,
    },
    {
      key: 'environments',
      label: t('workspace.tabs.environments'),
      icon: <EnvironmentIcon sx={{ fontSize: 18 }} />,
    },
  ];

  return (
    <Box>
      <PageHeader
        title={t('workspace.title')}
        subtitle={t('workspace.subtitle')}
        tabs={
          <SegmentedTabs
            items={segmentItems}
            value={activeTab}
            onChange={handleSegmentChange}
          />
        }
      />

      {/* Tab panels */}
      <React.Suspense
        fallback={
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress size={28} />
          </Box>
        }
      >
        <TabPanel tabKey="organisations" activeKey={activeTab}>
          <WorkspacePage
            embedded
            onNavigateToProjects={handleNavigateToProjects}
          />
        </TabPanel>

        <TabPanel tabKey="projects" activeKey={activeTab}>
          <ProjectsPage
            embedded
            onNavigateToEnvironments={handleNavigateToEnvironments}
            onNavigateToOrgs={handleNavigateToOrgs}
          />
        </TabPanel>

        <TabPanel tabKey="environments" activeKey={activeTab}>
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
