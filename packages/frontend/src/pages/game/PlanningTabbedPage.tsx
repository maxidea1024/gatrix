import React, { useState, useCallback, useEffect } from 'react';
import { Box, Tabs, Tab, CircularProgress } from '@mui/material';
import {
  Storage as StorageIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '@/components/common/PageHeader';

const PlanningDataPage = React.lazy(() => import('./PlanningDataPage'));
const PlanningDataHistoryPage = React.lazy(
  () => import('./PlanningDataHistoryPage')
);

const TAB_DATA = 0;
const TAB_HISTORY = 1;

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
      id={`planning-tabpanel-${index}`}
      aria-labelledby={`planning-tab-${index}`}
    >
      {children}
    </Box>
  );
};

const PlanningTabbedPage: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const getInitialTab = (): number => {
    const tab = searchParams.get('tab');
    if (tab === 'history') return TAB_HISTORY;
    return TAB_DATA;
  };

  const [activeTab, setActiveTab] = useState(getInitialTab);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'history' && activeTab !== TAB_HISTORY)
      setActiveTab(TAB_HISTORY);
    if ((tab === null || tab === 'data') && activeTab !== TAB_DATA)
      setActiveTab(TAB_DATA);
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTabChange = useCallback(
    (_: React.SyntheticEvent, newValue: number) => {
      setActiveTab(newValue);
      const newParams = new URLSearchParams(searchParams);
      if (newValue === TAB_DATA) {
        newParams.delete('tab');
      } else {
        newParams.set('tab', 'history');
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
        title={t('sidebar.planningData')}
        subtitle={t(
          'planningData.subtitle',
          '기획 데이터를 관리하고 이력을 확인합니다.'
        )}
      />

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 0 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          aria-label="planning tabs"
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
              <StorageIcon sx={{ fontSize: 18 }} />,
              t('sidebar.planningDataManagement')
            )}
            id="planning-tab-0"
            aria-controls="planning-tabpanel-0"
          />
          <Tab
            label={tabLabel(
              <HistoryIcon sx={{ fontSize: 18 }} />,
              t('sidebar.planningDataHistory')
            )}
            id="planning-tab-1"
            aria-controls="planning-tabpanel-1"
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
        <TabPanel value={activeTab} index={TAB_DATA}>
          <PlanningDataPage embedded />
        </TabPanel>
        <TabPanel value={activeTab} index={TAB_HISTORY}>
          <PlanningDataHistoryPage embedded />
        </TabPanel>
      </React.Suspense>
    </Box>
  );
};

export default PlanningTabbedPage;
