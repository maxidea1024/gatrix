import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, Typography, useTheme, alpha } from '@mui/material';
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
  const originalValues = React.useRef({
    name: '',
    platform: '',
    errorQuota: 100000,
    txnRate: 1.0,
    sessionRate: 1.0,
    retentionDays: 90,
    metricsGroupLimit: 10,
  });
  const isDirty =
    name !== originalValues.current.name ||
    platform !== originalValues.current.platform ||
    errorQuota !== originalValues.current.errorQuota ||
    txnRate !== originalValues.current.txnRate ||
    sessionRate !== originalValues.current.sessionRate ||
    retentionDays !== originalValues.current.retentionDays ||
    metricsGroupLimit !== originalValues.current.metricsGroupLimit;

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
      originalValues.current = {
        name: data.name,
        platform: data.platform,
        errorQuota: eq,
        txnRate: tr,
        sessionRate: sr,
        retentionDays: rd,
        metricsGroupLimit: mgl,
      };
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
        } catch {
          /* */
        }
      }
    } finally {
      setLoading(false);
    }
  }, [projectId, enqueueSnackbar, t]);

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
      };
    } catch {
      enqueueSnackbar(t('argus.settings.saveFailed'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
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
        <Box sx={{ display: 'flex', gap: 4, flex: 1, mb: -2 }}>
          {/* ══════ LEFT SIDEBAR ══════ */}
          <Box
            sx={{
              width: 220,
              flexShrink: 0,
              borderRight: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Box sx={{ position: 'sticky', top: 0, pr: 2 }}>
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
                          gap: 1.2,
                          px: 1.5,
                          py: 1,
                          mb: 0.2,
                          borderRadius: '6px',
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
                          {item.icon}
                        </Box>
                        <Typography
                          sx={{
                            fontSize: '0.85rem',
                            fontWeight: active ? 600 : 400,
                          }}
                        >
                          {t(item.labelKey)}
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>
              ))}
            </Box>
          </Box>

          {/* ══════ RIGHT CONTENT ══════ */}
          <Box sx={{ flex: 1, minWidth: 0, pb: 6 }}>
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
                saving={saving}
                isDirty={isDirty}
                handleSave={handleSave}
                isDark={isDark}
                t={t}
              />
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
              />
            )}

            {/* ─── ISSUE TRACKERS ─── */}
            {currentSection === 'issue-trackers' && (
              <IssueTrackersSettings
                projectId={projectId}
                isDark={isDark}
                t={t}
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
