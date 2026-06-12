import React, { useState, useCallback, useEffect } from 'react';
import { Box, CircularProgress } from '@mui/material';
import {
  VpnKey as VpnKeyIcon,
  Security as SecurityIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '@/components/common/PageHeader';
import SegmentedTabs, {
  SegmentedTabItem,
} from '@/components/common/SegmentedTabs';

const ApiTokensPage = React.lazy(() => import('./ApiTokensPage'));
const WhitelistPage = React.lazy(() => import('./WhitelistPage'));

const TAB_KEYS = ['tokens', 'whitelist'] as const;
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

const SecurityTabbedPage: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab: TabKey = (searchParams.get('tab') as TabKey) || 'tokens';

  const handleSegmentChange = useCallback(
    (key: string) => {
      const newParams = new URLSearchParams(searchParams);
      if (key === 'tokens') {
        newParams.delete('tab');
      } else {
        newParams.set('tab', key);
      }
      setSearchParams(newParams, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const segmentItems: SegmentedTabItem[] = [
    {
      key: 'tokens',
      label: t('sidebar.apiAccessTokens'),
      icon: <VpnKeyIcon sx={{ fontSize: 18 }} />,
    },
    {
      key: 'whitelist',
      label: t('sidebar.whitelist'),
      icon: <SecurityIcon sx={{ fontSize: 18 }} />,
    },
  ];

  return (
    <Box>
      <PageHeader
        icon={<SecurityIcon />}
        title={t('sidebar.security')}
        subtitle={t('security.subtitle')}
        tabs={
          <SegmentedTabs
            items={segmentItems}
            value={activeTab}
            onChange={handleSegmentChange}
          />
        }
      />

      <React.Suspense
        fallback={
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress size={28} />
          </Box>
        }
      >
        <TabPanel tabKey="tokens" activeKey={activeTab}>
          <ApiTokensPage embedded />
        </TabPanel>
        <TabPanel tabKey="whitelist" activeKey={activeTab}>
          <WhitelistPage embedded />
        </TabPanel>
      </React.Suspense>
    </Box>
  );
};

export default SecurityTabbedPage;
