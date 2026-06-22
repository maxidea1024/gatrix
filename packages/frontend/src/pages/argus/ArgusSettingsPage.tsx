import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, Typography, useTheme, alpha, Tooltip } from '@mui/material';
import { Settings as SettingsIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import PageContentLoader from '@/components/common/PageContentLoader';
import PageHeader from '@/components/common/PageHeader';
import argusService, { ArgusProject } from '@/services/argusService';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import { useNavigate, useLocation } from 'react-router-dom';

// New sub-components
import GeneralSettings from './settings/GeneralSettings';
import SamplingSettings from './settings/SamplingSettings';
import DsnKeysSettings from './settings/DsnKeysSettings';
import SdkSetupSettings from './settings/SdkSetupSettings';
import SourceMapsSettings from './settings/SourceMapsSettings';
import IntegrationsSettings from './settings/IntegrationsSettings';
import NotificationsSettings from './settings/NotificationsSettings';
import IssueTrackersSettings from './settings/IssueTrackersSettings';
import OwnershipSettings from './settings/OwnershipSettings';
import LexiconSettings from './settings/LexiconSettings';

// Constants and types
import {
  PLATFORM_OPTIONS,
  PLATFORM_CATEGORIES,
  SectionId,
  NAV_GROUPS,
} from './settings/constants';

const ArgusSettingsPage: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const isDark = theme.palette.mode === 'dark';
  const navigate = useNavigate();
  const location = useLocation();
  const { currentProject } = useOrgProject();
  const projectId = currentProject?.id || '1';

  // ── Section routing ──
  const currentSection = useMemo<SectionId>(() => {
    const hash = location.hash.replace('#', '') as SectionId;
    const allIds = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.id));
    return allIds.includes(hash) ? hash : 'general';
  }, [location.hash]);

  const setSection = useCallback(
    (id: SectionId) => {
      navigate({ hash: `#${id}` }, { replace: true });
      window.scrollTo({ top: 0 });
    },
    [navigate]
  );

  // ── State ──
  const [project, setProject] = useState<ArgusProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [platform, setPlatform] = useState('');
  const [errorQuota, setErrorQuota] = useState(100000);
  const [txnRate, setTxnRate] = useState(1.0);
  const [sessionRate, setSessionRate] = useState(1.0);
  const [retentionDays, setRetentionDays] = useState(90);
  const [metricsGroupLimit, setMetricsGroupLimit] = useState(10);
  const [analyticsBreakdownLimit, setAnalyticsBreakdownLimit] = useState(20);
  const [trackerCount, setTrackerCount] = useState<number | null>(null);
  const [notifCount, setNotifCount] = useState<number | null>(null);

  const originalValues = React.useRef({
    name: '',
    platform: '',
    errorQuota: 100000,
    txnRate: 1.0,
    sessionRate: 1.0,
    retentionDays: 90,
    metricsGroupLimit: 10,
    analyticsBreakdownLimit: 20,
  });
  const isDirty =
    name !== originalValues.current.name ||
    platform !== originalValues.current.platform ||
    errorQuota !== originalValues.current.errorQuota ||
    txnRate !== originalValues.current.txnRate ||
    sessionRate !== originalValues.current.sessionRate ||
    retentionDays !== originalValues.current.retentionDays ||
    metricsGroupLimit !== originalValues.current.metricsGroupLimit ||
    analyticsBreakdownLimit !== originalValues.current.analyticsBreakdownLimit;

  const fetchCounts = useCallback(async () => {
    try {
      const [trackers, channels] = await Promise.all([
        argusService.listIssueTrackers(projectId).catch(() => []),
        (argusService as any)
          .listNotificationChannels(projectId)
          .catch(() => []),
      ]);
      setTrackerCount(trackers.length);
      setNotifCount(channels.length);
    } catch (err) {
      console.error('Failed to fetch counts:', err);
    }
  }, [projectId]);

  // ── Fetch ──
  const fetchProject = useCallback(async () => {
    setLoading(true);
    try {
      const data = await argusService.getProject(projectId);
      setProject(data);
      setName(data.name);
      setPlatform(data.platform);
      const eq = Number(data.error_quota_daily) || 100000;
      const tr = Number(data.transaction_sample_rate);
      const sr = Number(data.session_sample_rate);
      const rd = Number(data.retention_days);
      const mgl = Number(data.metrics_group_limit) || 10;
      setErrorQuota(eq);
      setTxnRate(tr);
      setSessionRate(sr);
      setRetentionDays(rd);
      setMetricsGroupLimit(mgl);
      const abl = Number(data.analytics_breakdown_limit) || 20;
      setAnalyticsBreakdownLimit(abl);
      originalValues.current = {
        name: data.name,
        platform: data.platform,
        errorQuota: eq,
        txnRate: tr,
        sessionRate: sr,
        retentionDays: rd,
        metricsGroupLimit: mgl,
        analyticsBreakdownLimit: abl,
      };
      await fetchCounts();
    } catch (err: any) {
      if (err?.response?.status === 404 || err?.status === 404) {
        try {
          const created = await argusService.createProject({
            gatrix_project_id: projectId,
            name: 'Default Project',
            slug: 'default',
            platform: 'javascript',
          });
          setProject(created);
          setName(created.name);
          setPlatform(created.platform);
          enqueueSnackbar(t('argus.settings.projectCreated'), {
            variant: 'success',
          });
          await fetchCounts();
        } catch {
          /* */
        }
      }
    } finally {
      setLoading(false);
    }
  }, [projectId, enqueueSnackbar, t, fetchCounts]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  // ── Handlers ──
  const handleSave = async () => {
    setSaving(true);
    try {
      await argusService.updateProject(projectId, {
        name,
        platform,
        error_quota_daily: errorQuota,
        transaction_sample_rate: txnRate,
        session_sample_rate: sessionRate,
        retention_days: retentionDays,
        metrics_group_limit: metricsGroupLimit,
        analytics_breakdown_limit: analyticsBreakdownLimit,
      });
      enqueueSnackbar(t('argus.settings.saveSuccess'), { variant: 'success' });
      originalValues.current = {
        name,
        platform,
        errorQuota,
        txnRate,
        sessionRate,
        retentionDays,
        metricsGroupLimit,
        analyticsBreakdownLimit,
      };
    } catch {
      enqueueSnackbar(t('argus.settings.saveFailed'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const renderBadge = (id: SectionId) => {
    if (id === 'dsn-keys') {
      const activeCount = project?.active_dsn_count ?? 0;
      if (activeCount === 0) return null;
      return (
        <Typography
          variant="caption"
          sx={{
            fontSize: '0.7rem',
            color: 'text.secondary',
            opacity: 0.8,
            fontWeight: 500,
          }}
        >
          {activeCount}
        </Typography>
      );
    }

    if (id === 'sdk-setup') {
      const activeCount = project?.active_dsn_count ?? 0;
      const isConnected = activeCount > 0;
      return (
        <Box
          sx={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: isConnected ? 'success.main' : 'text.disabled',
          }}
        />
      );
    }

    if (id === 'notifications') {
      if (notifCount === null) return null;
      return (
        <Typography
          variant="caption"
          sx={{
            fontSize: '0.7rem',
            color: notifCount > 0 ? 'primary.main' : 'text.secondary',
            opacity: notifCount > 0 ? 1 : 0.6,
            fontWeight: 600,
            px: 0.6,
            py: 0.1,
            borderRadius: 1,
            backgroundColor:
              notifCount > 0
                ? alpha(theme.palette.primary.main, 0.1)
                : 'transparent',
          }}
        >
          {notifCount}
        </Typography>
      );
    }

    if (id === 'issue-trackers') {
      if (trackerCount === null) return null;
      const connected = trackerCount > 0;
      return (
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          {connected ? (
            <Typography
              variant="caption"
              sx={{
                fontSize: '0.7rem',
                color: 'success.main',
                fontWeight: 600,
                px: 0.6,
                py: 0.1,
                borderRadius: 1,
                backgroundColor: alpha(theme.palette.success.main, 0.1),
              }}
            >
              {trackerCount}
            </Typography>
          ) : (
            <Tooltip
              title={t('argus.settings.trackerRequired', 'Connection Required')}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  backgroundColor: alpha(theme.palette.warning.main, 0.15),
                  color: 'warning.main',
                  fontSize: '0.7rem',
                  fontWeight: 800,
                }}
              >
                !
              </Box>
            </Tooltip>
          )}
        </Box>
      );
    }

    return null;
  };

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <PageHeader
        icon={<SettingsIcon />}
        title={t('argus.settings.title')}
        subtitle={t('argus.settings.subtitle')}
      />

      <PageContentLoader
        loading={loading}
        sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}
      >
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
              width: 220,
              flexShrink: 0,
              borderRight: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper',
              pt: 2,
              pl: 2,
            }}
          >
            <Box sx={{ position: 'sticky', top: 2, pr: 1 }}>
              {NAV_GROUPS.map((group, gi) => (
                <Box key={gi} sx={{ mb: 2 }}>
                  <Typography
                    sx={{
                      px: 1.5,
                      pb: 1,
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      color: 'text.secondary',
                      letterSpacing: '0.1em',
                    }}
                  >
                    {t(group.labelKey)}
                  </Typography>
                  {group.items.map((item) => {
                    const active = currentSection === item.id;
                    return (
                      <Box
                        key={item.id}
                        onClick={() => setSection(item.id)}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
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
                            alignItems: 'center',
                            gap: 1.2,
                            minWidth: 0,
                            flex: 1,
                          }}
                        >
                          <Box
                            sx={{
                              display: 'flex',
                              opacity: active ? 1 : 0.6,
                              color: 'inherit',
                            }}
                          >
                            {item.icon}
                          </Box>
                          <Typography
                            noWrap
                            sx={{
                              fontSize: '0.85rem',
                              fontWeight: active ? 600 : 400,
                            }}
                          >
                            {t(item.labelKey)}
                          </Typography>
                        </Box>
                        {renderBadge(item.id)}
                      </Box>
                    );
                  })}
                </Box>
              ))}
            </Box>
          </Box>

          {/* ══════ RIGHT CONTENT ══════ */}
          <Box sx={{ flex: 1, minWidth: 0, pt: 2, pr: 2, pb: 6 }}>
            {/* ─── GENERAL ─── */}
            {currentSection === 'general' && (
              <GeneralSettings
                projectId={projectId}
                name={name}
                setName={setName}
                platform={platform}
                setPlatform={setPlatform}
                saving={saving}
                isDirty={isDirty}
                handleSave={handleSave}
                isDark={isDark}
                t={t}
                PLATFORM_CATEGORIES={PLATFORM_CATEGORIES}
                PLATFORM_OPTIONS={PLATFORM_OPTIONS}
              />
            )}

            {/* ─── SAMPLING ─── */}
            {currentSection === 'sampling' && (
              <SamplingSettings
                errorQuota={errorQuota}
                setErrorQuota={setErrorQuota}
                retentionDays={retentionDays}
                setRetentionDays={setRetentionDays}
                txnRate={txnRate}
                setTxnRate={setTxnRate}
                sessionRate={sessionRate}
                setSessionRate={setSessionRate}
                metricsGroupLimit={metricsGroupLimit}
                setMetricsGroupLimit={setMetricsGroupLimit}
                analyticsBreakdownLimit={analyticsBreakdownLimit}
                setAnalyticsBreakdownLimit={setAnalyticsBreakdownLimit}
                saving={saving}
                isDirty={isDirty}
                handleSave={handleSave}
                isDark={isDark}
                t={t}
              />
            )}

            {/* ─── LEXICON ─── */}
            {currentSection === 'lexicon' && (
              <LexiconSettings projectId={projectId} isDark={isDark} t={t} />
            )}

            {/* ─── DSN KEYS ─── */}
            {currentSection === 'dsn-keys' && (
              <DsnKeysSettings
                project={project}
                setProject={setProject}
                projectId={projectId}
                isDark={isDark}
                t={t}
                fetchProject={fetchProject}
              />
            )}

            {/* ─── SDK SETUP ─── */}
            {currentSection === 'sdk-setup' && (
              <SdkSetupSettings
                project={project}
                projectId={projectId}
                name={name}
                txnRate={txnRate}
                sessionRate={sessionRate}
                isDark={isDark}
                t={t}
              />
            )}

            {/* ─── SOURCE MAPS ─── */}
            {currentSection === 'source-maps' && (
              <SourceMapsSettings projectId={projectId} isDark={isDark} t={t} />
            )}

            {/* ─── INTEGRATIONS ─── */}
            {currentSection === 'integrations' && (
              <IntegrationsSettings
                projectId={projectId}
                isDark={isDark}
                t={t}
              />
            )}

            {/* ─── NOTIFICATIONS ─── */}
            {currentSection === 'notifications' && (
              <NotificationsSettings
                projectId={projectId}
                isDark={isDark}
                t={t}
                onChange={fetchCounts}
              />
            )}

            {/* ─── ISSUE TRACKERS ─── */}
            {currentSection === 'issue-trackers' && (
              <IssueTrackersSettings
                projectId={projectId}
                isDark={isDark}
                t={t}
                onChange={fetchCounts}
              />
            )}

            {/* ─── OWNERSHIP ─── */}
            {currentSection === 'ownership' && (
              <OwnershipSettings projectId={projectId} isDark={isDark} t={t} />
            )}
          </Box>
        </Box>
      </PageContentLoader>
    </Box>
  );
};

export default ArgusSettingsPage;
