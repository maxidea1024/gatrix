import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Typography,
  CircularProgress,
  Tabs,
  Tab,
  Button,
  useTheme,
  alpha,
  Paper,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Event as EventIcon,
  Folder as SessionIcon,
  ShoppingCart as PurchaseIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import PageHeader from '@/components/common/PageHeader';
import PageContentLoader from '@/components/common/PageContentLoader';
import ArgusBreadcrumbs from '@/components/argus/ArgusBreadcrumbs';
import { useOrgProject } from '@/contexts/OrgProjectContext';

import {
  getUserProfile,
  getUserEvents,
  getUserCohortMemberships,
  getRevenueUserSummary,
  getUserProperties,
  type UserFinancialResponse,
} from '@/services/argus/argusAnalytics';
import type {
  ArgusUserProfile,
  ArgusUserEvent,
  ArgusUserProperty,
} from '@/services/argus/argusTypes';
import type { CohortMembership } from '@/components/argus/CohortChip';

import UserProfileDetailLeft from '@/components/userProfiles/UserProfileDetailLeft';
import UserProfileEventFeed from '@/components/userProfiles/UserProfileEventFeed';
import UserProfileSessionsTab from '@/components/userProfiles/UserProfileSessionsTab';
import UserProfileFinanceTab from '@/components/userProfiles/UserProfileFinanceTab';
import UserProfilePropsTab from '@/components/userProfiles/UserProfilePropsTab';

type LifecycleStage = { label: string; bg: string; fg: string };
function computeLifecycleStage(profile: ArgusUserProfile, netRevenue: number): LifecycleStage {
  const daysSinceFirst = (Date.now() - new Date(profile.first_seen).getTime()) / 86400000;
  const daysSinceLast  = (Date.now() - new Date(profile.last_seen).getTime()) / 86400000;
  const isVip = netRevenue >= 100;
  if (daysSinceFirst < 7)   return { label: isVip ? 'NEW VIP' : 'NEW',     bg: '#1565c0', fg: '#90caf9' };
  if (daysSinceLast > 30)   return { label: isVip ? 'DORMANT VIP' : 'DORMANT', bg: '#b71c1c', fg: '#ef9a9a' };
  if (daysSinceLast > 14)   return { label: isVip ? 'AT RISK VIP' : 'AT RISK', bg: '#e65100', fg: '#ffcc80' };
  if (daysSinceLast <= 7)   return { label: isVip ? 'ACTIVE VIP' : 'ACTIVE',  bg: '#1b5e20', fg: '#a5d6a7' };
  return                           { label: isVip ? 'REGULAR VIP' : 'REGULAR', bg: '#37474f', fg: '#b0bec5' };
}

type PurchaseChurnRisk = { kind: 'purchase' | 'refund'; msg: string } | null;
function computeChurnRisk(
  lastPurchase: string | null,
  refundRate: number,
  netRevenue: number
): PurchaseChurnRisk {
  if (netRevenue > 0 && lastPurchase) {
    const days = Math.floor((Date.now() - new Date(lastPurchase).getTime()) / 86400000);
    if (days > 30) return { kind: 'purchase', msg: `${days}d` };
  }
  if (refundRate > 0.2) return { kind: 'refund', msg: `${(refundRate * 100).toFixed(0)}%` };
  return null;
}

export const ArgusUserProfileDetailPage: React.FC = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { t } = useTranslation();
  const { currentProject, isLoading: contextLoading } = useOrgProject();
  const projectId = currentProject?.id;
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();

  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');

  const tab = useMemo(() => {
    switch (tabParam) {
      case 'sessions': return 1;
      case 'finance': return 2;
      case 'properties': return 3;
      case 'feed':
      default:
        return 0;
    }
  }, [tabParam]);

  const setTab = (newTab: number) => {
    const params = new URLSearchParams(searchParams);
    switch (newTab) {
      case 1:
        params.set('tab', 'sessions');
        params.delete('subTab');
        break;
      case 2:
        params.set('tab', 'finance');
        break;
      case 3:
        params.set('tab', 'properties');
        params.delete('subTab');
        break;
      case 0:
      default:
        params.set('tab', 'feed');
        params.delete('subTab');
        break;
    }
    setSearchParams(params, { replace: true });
  };
  const [profile, setProfile] = useState<ArgusUserProfile | null>(null);
  const [events, setEvents] = useState<ArgusUserEvent[]>([]);
  const [userCohorts, setUserCohorts] = useState<CohortMembership[]>([]);
  const [finData, setFinData] = useState<UserFinancialResponse | null>(null);
  const [properties, setProperties] = useState<ArgusUserProperty[]>([]);
  const [propertiesLoading, setPropertiesLoading] = useState(true);
  
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !projectId) return;
    setLoading(true);
    setPropertiesLoading(true);

    Promise.all([
      getUserProfile(projectId, userId).then((p) => setProfile(p)),
      getUserEvents(projectId, userId, { limit: 150 }).then((r) => setEvents(r.data)),
      getUserCohortMemberships(projectId, [userId]).then((memberships) => {
        setUserCohorts(memberships[userId] || []);
      }),
      getRevenueUserSummary(projectId, { user_id: userId, period: '90d' })
        .then((data) => setFinData(data))
        .catch(() => null),
      getUserProperties(projectId, userId)
        .then((props) => {
          setProperties(props);
          setPropertiesLoading(false);
        })
        .catch(() => {
          setProperties([]);
          setPropertiesLoading(false);
        }),
    ])
      .catch((error) => {
        console.error('Failed to load user detail profile:', error);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [userId, projectId]);

  // Derived computations
  const lifecycleStage = useMemo(
    () => (profile ? computeLifecycleStage(profile, finData?.summary?.net_revenue ?? 0) : null),
    [profile, finData]
  );

  const churnRisk = useMemo(
    () => (finData?.summary ? computeChurnRisk(finData.summary.last_purchase, finData.summary.refund_rate, finData.summary.net_revenue) : null),
    [finData]
  );

  if (contextLoading || (loading && !profile)) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 'calc(100vh - 96px)' }}>
        <CircularProgress size={40} />
      </Box>
    );
  }

  if (!profile || !userId) {
    return (
      <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/argus/analytics/users')} sx={{ mb: 2 }}>
          {t('argus.userProfiles.backToList', 'Back to List')}
        </Button>
        <Typography variant="h6">{t('argus.userProfiles.userNotFound', 'User not found')}</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 96px)', overflow: 'hidden' }}>
      <PageHeader
        title={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              size="small"
              onClick={() => navigate('/argus/analytics/users')}
              sx={{ minWidth: 'auto', p: 0.5, mr: 0.5, borderRadius: 1.5, border: '1px solid', borderColor: 'divider', color: 'text.secondary' }}
            >
              <ArrowBackIcon sx={{ fontSize: 18 }} />
            </Button>
            <ArgusBreadcrumbs
              paths={[
                {
                  label: t('argus.userProfiles.title', 'User Profiles'),
                  to: '/argus/analytics/users',
                },
                { label: userId },
              ]}
              size="title"
            />
          </Box>
        }
      />

      <Box sx={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
        {/* Left Column (Details / sidebar) */}
        <Box sx={{ width: 300, flexShrink: 0, borderRight: `1px solid ${theme.palette.divider}`, height: '100%' }}>
          <UserProfileDetailLeft
            profile={profile}
            userCohorts={userCohorts}
            netRevenue={finData?.summary.net_revenue ?? 0}
            events={events}
            lifecycleStage={lifecycleStage}
            churnRisk={churnRisk}
          />
        </Box>

        {/* Right Column (Tabs timeline / logs) */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, bgcolor: 'background.default' }}>
          <Box sx={{ borderBottom: `1px solid ${theme.palette.divider}`, bgcolor: 'background.paper', px: 2 }}>
            <Tabs
              value={tab}
              onChange={(_, v) => setTab(v)}
              sx={{
                minHeight: 48,
                '& .MuiTab-root': {
                  minHeight: 48,
                  fontSize: 13,
                  textTransform: 'none',
                  fontWeight: 600,
                },
              }}
            >
              <Tab
                label={t('argus.userProfiles.activityFeed', 'Activity Feed')}
                icon={<EventIcon sx={{ fontSize: 16 }} />}
                iconPosition="start"
              />
              <Tab
                label={t('argus.userProfiles.sessionsLogs', 'Sessions Logs')}
                icon={<SessionIcon sx={{ fontSize: 16 }} />}
                iconPosition="start"
              />
              <Tab
                label={t('argus.userProfiles.finance', 'Finance')}
                icon={<PurchaseIcon sx={{ fontSize: 16 }} />}
                iconPosition="start"
              />
              <Tab
                label={t('argus.userProfiles.userProperties', 'Properties', { count: properties.length })}
                icon={<SettingsIcon sx={{ fontSize: 16 }} />}
                iconPosition="start"
              />
            </Tabs>
          </Box>

          <Box sx={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
            {tab === 0 && <UserProfileEventFeed userId={userId} projectId={projectId || ''} />}
            {tab === 1 && <UserProfileSessionsTab userId={userId} projectId={projectId || ''} />}
            {tab === 2 && <UserProfileFinanceTab userId={userId} projectId={projectId || ''} />}
            {tab === 3 && (
              <UserProfilePropsTab
                userId={userId}
                projectId={projectId || ''}
                initialProperties={properties}
                initialLoading={propertiesLoading}
              />
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default ArgusUserProfileDetailPage;
