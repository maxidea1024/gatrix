import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Paper,
  Typography,
  Tooltip,
  IconButton,
} from '@mui/material';
import {
  UploadFile as UploadIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { SettingsCard, EmptyState, Spinner } from './components/SettingsShared';
import argusService, { ArgusSourcemapRelease } from '@/services/argusService';

interface SourceMapsSettingsProps {
  projectId: string;
  isDark: boolean;
  t: any;
}

export const SourceMapsSettings: React.FC<SourceMapsSettingsProps> = ({
  projectId,
  isDark,
  t,
}) => {
  const { enqueueSnackbar } = useSnackbar();
  const bdr = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const bgSubtle = isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)';

  const [sourcemaps, setSourcemaps] = useState<ArgusSourcemapRelease[]>([]);
  const [smLoaded, setSmLoaded] = useState(false);

  useEffect(() => {
    argusService
      .listSourcemapReleases(projectId)
      .then((d) => {
        setSourcemaps(d);
        setSmLoaded(true);
      })
      .catch(() => setSmLoaded(true));
  }, [projectId]);

  return (
    <SettingsCard
      title={t('argus.settings.sourceMapsTitle')}
      desc={t('argus.settings.sourceMapsSubtitle')}
      isDark={isDark}
      headerAction={
        <Button
          size="small"
          variant="contained"
          startIcon={<UploadIcon />}
          component="label"
          sx={{
            borderRadius: '8px',
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '0.8rem',
          }}
        >
          {t('common.upload')}
          <input
            type="file"
            multiple
            hidden
            accept=".map,.js.map"
            onChange={async (e) => {
              const files = Array.from(e.target.files || []);
              if (!files.length) return;
              const release = prompt(t('argus.settings.enterRelease'));
              if (!release) return;
              try {
                await argusService.uploadSourcemaps(projectId, release, files);
                enqueueSnackbar(
                  t('argus.settings.smUploadSuccess', { count: files.length }),
                  { variant: 'success' }
                );
                setSourcemaps(
                  await argusService.listSourcemapReleases(projectId)
                );
              } catch {
                enqueueSnackbar(t('argus.settings.smUploadFailed'), {
                  variant: 'error',
                });
              }
            }}
          />
        </Button>
      }
    >
      {/* CLI */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 2.5,
          border: `1px solid ${bdr}`,
          borderRadius: '8px',
          backgroundColor: bgSubtle,
        }}
      >
        <Typography
          sx={{
            fontWeight: 600,
            fontSize: '0.75rem',
            mb: 1,
            color: 'text.secondary',
          }}
        >
          {t('argus.settings.cliExample')}
        </Typography>
        <Box
          sx={{
            fontSize: '0.73rem',
            color: isDark ? '#aaa' : '#555',
            whiteSpace: 'pre',
            lineHeight: 1.6,
          }}
        >
          {`curl -X POST '${window.location.origin}/argus/api/${projectId}/sourcemaps' \\\n  -F 'release=1.0.0' \\\n  -F 'files=@dist/main.js.map'`}
        </Box>
      </Paper>
      {!smLoaded ? (
        <Spinner />
      ) : sourcemaps.length === 0 ? (
        <EmptyState
          icon={<UploadIcon />}
          text={t('argus.settings.noSourceMaps')}
          hint={t('argus.settings.noSourceMapsHint')}
        />
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {sourcemaps.map((rel) => (
            <Paper
              key={rel.id}
              elevation={0}
              sx={{
                p: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                border: `1px solid ${bdr}`,
                borderRadius: '8px',
              }}
            >
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontWeight: 600, fontSize: '0.85rem' }}>
                  {rel.release}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {rel.file_count} {t('common.files')} ·{' '}
                  {new Date(rel.created_at).toLocaleString()}
                </Typography>
              </Box>
              <Tooltip title={t('common.delete')}>
                <IconButton
                  size="small"
                  color="error"
                  onClick={async () => {
                    try {
                      await argusService.deleteSourcemapRelease(
                        projectId,
                        rel.id
                      );
                      setSourcemaps((p) => p.filter((r) => r.id !== rel.id));
                      enqueueSnackbar(t('argus.settings.smDeleteSuccess'), {
                        variant: 'success',
                      });
                    } catch {
                      enqueueSnackbar(t('argus.settings.smDeleteFailed'), {
                        variant: 'error',
                      });
                    }
                  }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Paper>
          ))}
        </Box>
      )}
    </SettingsCard>
  );
};

export default SourceMapsSettings;
