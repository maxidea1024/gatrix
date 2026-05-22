import React, { useState, useCallback, useEffect } from 'react';
import { Box, Tabs, Tab, CircularProgress } from '@mui/material';
import {
  VpnKey as VpnKeyIcon,
  Security as SecurityIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '@/components/common/PageHeader';

const ApiTokensPage = React.lazy(() => import('./ApiTokensPage'));
const WhitelistPage = React.lazy(() => import('./WhitelistPage'));

const TAB_TOKENS = 0;
const TAB_WHITELIST = 1;

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
      id={`security-tabpanel-${index}`}
      aria-labelledby={`security-tab-${index}`}
    >
      {children}
    </Box>
  );
};

const SecurityTabbedPage: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const getInitialTab = (): number => {
    const tab = searchParams.get('tab');
    if (tab === 'whitelist') return TAB_WHITELIST;
    return TAB_TOKENS;
  };

  const [activeTab, setActiveTab] = useState(getInitialTab);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'whitelist' && activeTab !== TAB_WHITELIST)
      setActiveTab(TAB_WHITELIST);
    if ((tab === 'tokens' || tab === null) && activeTab !== TAB_TOKENS)
      setActiveTab(TAB_TOKENS);
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTabChange = useCallback(
    (_: React.SyntheticEvent, newValue: number) => {
      setActiveTab(newValue);
      const newParams = new URLSearchParams(searchParams);
      if (newValue === TAB_TOKENS) {
        newParams.delete('tab');
      } else {
        newParams.set('tab', 'whitelist');
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
        title={t('sidebar.security')}
        subtitle={t(
          'security.subtitle')}
      />

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 0 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          aria-label="security tabs"
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
              <VpnKeyIcon sx={{ fontSize: 18 }} />,
              t('sidebar.apiAccessTokens')
            )}
            id="security-tab-0"
            aria-controls="security-tabpanel-0"
          />
          <Tab
            label={tabLabel(
              <SecurityIcon sx={{ fontSize: 18 }} />,
              t('sidebar.whitelist')
            )}
            id="security-tab-1"
            aria-controls="security-tabpanel-1"
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
        <TabPanel value={activeTab} index={TAB_TOKENS}>
          <ApiTokensPage embedded />
        </TabPanel>
        <TabPanel value={activeTab} index={TAB_WHITELIST}>
          <WhitelistPage embedded />
        </TabPanel>
      </React.Suspense>
    </Box>
  );
};

export default SecurityTabbedPage;
