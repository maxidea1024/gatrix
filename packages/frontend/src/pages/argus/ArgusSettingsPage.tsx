import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Slider,
  Chip,
  IconButton,
  Divider,
  useTheme,
  InputAdornment,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  ContentCopy as CopyIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import PageContentLoader from '@/components/common/PageContentLoader';
import argusService, { ArgusProject, ArgusDsnKey } from '@/services/argusService';

const ArgusSettingsPage: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  const projectId = '1';

  const [project, setProject] = useState<ArgusProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Editable fields
  const [name, setName] = useState('');
  const [platform, setPlatform] = useState('');
  const [errorQuota, setErrorQuota] = useState(100000);
  const [txnSampleRate, setTxnSampleRate] = useState(1.0);
  const [sessionSampleRate, setSessionSampleRate] = useState(1.0);
  const [retentionDays, setRetentionDays] = useState(90);

  const fetchProject = useCallback(async () => {
    setLoading(true);
    try {
      const data = await argusService.getProject(projectId);
      setProject(data);
      setName(data.name);
      setPlatform(data.platform);
      setErrorQuota(data.error_quota_daily);
      setTxnSampleRate(data.transaction_sample_rate);
      setSessionSampleRate(data.session_sample_rate);
      setRetentionDays(data.retention_days);
    } catch (error: any) {
      // If project doesn't exist yet, auto-create it
      if (error?.response?.status === 404 || error?.status === 404) {
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
          enqueueSnackbar(t('argus.settings.projectCreated', 'Argus project auto-created'), { variant: 'success' });
        } catch (createError) {
          console.error('Failed to auto-create project:', createError);
        }
      } else {
        console.error('Failed to fetch project:', error);
      }
    } finally {
      setLoading(false);
    }
  }, [projectId, enqueueSnackbar, t]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await argusService.updateProject(projectId, {
        name,
        platform,
        error_quota_daily: errorQuota,
        transaction_sample_rate: txnSampleRate,
        session_sample_rate: sessionSampleRate,
        retention_days: retentionDays,
      });
      enqueueSnackbar(t('argus.settings.saveSuccess'), { variant: 'success' });
    } catch (error) {
      enqueueSnackbar(t('argus.settings.saveFailed'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleCopyDsn = (dsn: string) => {
    navigator.clipboard.writeText(dsn);
    enqueueSnackbar(t('argus.settings.dsnCopied'), { variant: 'info' });
  };

  const handleCreateKey = async () => {
    try {
      await argusService.createDsnKey(projectId, 'New Key');
      enqueueSnackbar(t('argus.settings.keyCreated'), { variant: 'success' });
      fetchProject();
    } catch (error) {
      enqueueSnackbar(t('argus.settings.keyCreateFailed'), { variant: 'error' });
    }
  };

  const handleRevokeKey = async (keyId: number) => {
    try {
      await argusService.revokeDsnKey(projectId, keyId);
      enqueueSnackbar(t('argus.settings.keyRevoked'), { variant: 'success' });
      fetchProject();
    } catch (error) {
      enqueueSnackbar(t('argus.settings.keyRevokeFailed'), { variant: 'error' });
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <SettingsIcon sx={{ fontSize: 28, color: theme.palette.primary.main }} />
          <Typography variant="h5" fontWeight={700}>
            {t('argus.settings.title')}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton onClick={fetchProject} size="small">
            <RefreshIcon />
          </IconButton>
          <Button
            variant="contained"
            size="small"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={saving || loading}
          >
            {t('common.save')}
          </Button>
        </Box>
      </Box>

      <PageContentLoader loading={loading}>
        {/* General Settings */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
            {t('argus.settings.general')}
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
            <TextField
              label={t('argus.settings.projectName')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              size="small"
              sx={{ flex: '1 1 250px' }}
            />
            <TextField
              label={t('argus.settings.platform')}
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              size="small"
              sx={{ flex: '1 1 200px' }}
            />
          </Box>
        </Paper>

        {/* Sampling & Quotas */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
            {t('argus.settings.samplingQuotas')}
          </Typography>

          <Box sx={{ mb: 3 }}>
            <Typography variant="body2" fontWeight={500} gutterBottom>
              {t('argus.settings.errorQuota')}
            </Typography>
            <TextField
              type="number"
              value={errorQuota}
              onChange={(e) => setErrorQuota(Number(e.target.value))}
              size="small"
              sx={{ width: 200 }}
              InputProps={{
                endAdornment: <InputAdornment position="end">/day</InputAdornment>,
              }}
            />
          </Box>

          <Box sx={{ mb: 3 }}>
            <Typography variant="body2" fontWeight={500} gutterBottom>
              {t('argus.settings.txnSampleRate')}: {(txnSampleRate * 100).toFixed(0)}%
            </Typography>
            <Slider
              value={txnSampleRate}
              onChange={(_, v) => setTxnSampleRate(v as number)}
              min={0}
              max={1}
              step={0.01}
              sx={{ maxWidth: 400 }}
            />
          </Box>

          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" fontWeight={500} gutterBottom>
              {t('argus.settings.sessionSampleRate')}: {(sessionSampleRate * 100).toFixed(0)}%
            </Typography>
            <Slider
              value={sessionSampleRate}
              onChange={(_, v) => setSessionSampleRate(v as number)}
              min={0}
              max={1}
              step={0.01}
              sx={{ maxWidth: 400 }}
            />
          </Box>

          <Divider sx={{ my: 2 }} />

          <Box>
            <Typography variant="body2" fontWeight={500} gutterBottom>
              {t('argus.settings.retentionDays')}
            </Typography>
            <TextField
              type="number"
              value={retentionDays}
              onChange={(e) => setRetentionDays(Number(e.target.value))}
              size="small"
              sx={{ width: 150 }}
              InputProps={{
                endAdornment: <InputAdornment position="end">{t('argus.settings.days')}</InputAdornment>,
              }}
            />
          </Box>
        </Paper>

        {/* DSN Keys */}
        <Paper sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="subtitle1" fontWeight={600}>
              {t('argus.settings.dsnKeys')}
            </Typography>
            <Button size="small" startIcon={<AddIcon />} onClick={handleCreateKey}>
              {t('argus.settings.createKey')}
            </Button>
          </Box>

          {project?.dsn_keys?.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
              {t('argus.settings.noKeys')}
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {project?.dsn_keys?.map((key) => (
                <Box
                  key={key.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    p: 1.5,
                    borderRadius: 1,
                    backgroundColor: theme.palette.action.hover,
                  }}
                >
                  <Box sx={{ flex: 1, overflow: 'hidden' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Typography variant="body2" fontWeight={600}>
                        {key.label}
                      </Typography>
                      <Chip
                        label={key.is_active ? t('common.active') : t('common.inactive')}
                        size="small"
                        color={key.is_active ? 'success' : 'default'}
                        variant="outlined"
                      />
                    </Box>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ fontFamily: 'monospace', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}
                    >
                      {key.dsn}
                    </Typography>
                  </Box>
                  <IconButton size="small" onClick={() => handleCopyDsn(key.dsn)}>
                    <CopyIcon fontSize="small" />
                  </IconButton>
                  {key.is_active && (
                    <IconButton size="small" color="error" onClick={() => handleRevokeKey(key.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  )}
                </Box>
              ))}
            </Box>
          )}
        </Paper>
      </PageContentLoader>
    </Box>
  );
};

export default ArgusSettingsPage;
