import React, { useState, useEffect } from 'react';
import {
  Button,
  TextField,
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Stack,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import {
  PlatformDefaultsService,
  PlatformDefaults,
  PlatformDefaultsMap,
} from '@/services/platformDefaultsService';
import { usePlatformConfig } from '@/contexts/PlatformConfigContext';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import ResizableDrawer from '@/components/common/ResizableDrawer';

interface PlatformDefaultsDialogProps {
  open: boolean;
  onClose: () => void;
}

const PlatformDefaultsDialog: React.FC<PlatformDefaultsDialogProps> = ({
  open,
  onClose,
}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { platforms, isLoading: platformsLoading } = usePlatformConfig();
  const { getProjectApiPath } = useOrgProject();
  const projectApiPath = getProjectApiPath();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [defaults, setDefaults] = useState<PlatformDefaultsMap>({});

  // Load defaults
  const loadDefaults = async () => {
    try {
      setLoading(true);
      const data = await PlatformDefaultsService.getAllDefaults(projectApiPath);
      // Ensure all known platforms are present, even if not stored yet
      const merged: PlatformDefaultsMap = platforms.reduce((acc, p) => {
        acc[p.value] = {
          gameServerAddress: data?.[p.value]?.gameServerAddress || '',
          patchAddress: data?.[p.value]?.patchAddress || '',
        };
        return acc;
      }, {} as PlatformDefaultsMap);
      setDefaults(merged);
    } catch (error) {
      console.error('Failed to load platform defaults:', error);
      enqueueSnackbar(t('platformDefaults.loadError'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && !platformsLoading && platforms.length > 0) {
      loadDefaults();
    }
  }, [open, platforms, platformsLoading]);

  // Update platform default value
  const handlePlatformDefaultChange = (
    platform: string,
    field: keyof PlatformDefaults,
    value: string
  ) => {
    setDefaults((prev) => ({
      ...prev,
      [platform]: {
        ...prev[platform],
        [field]: value,
      },
    }));
  };

  // Save
  const handleSave = async () => {
    try {
      setSaving(true);
      await PlatformDefaultsService.setAllDefaults(projectApiPath, defaults);
      enqueueSnackbar(t('platformDefaults.saveSuccess'), {
        variant: 'success',
      });
      onClose();
    } catch (error) {
      console.error('Failed to save platform defaults:', error);
      enqueueSnackbar(t('platformDefaults.saveError'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const platformList = platforms;

  return (
    <ResizableDrawer
      open={open}
      onClose={onClose}
      title={t('platformDefaults.title')}
      subtitle={t('platformDefaults.description')}
      storageKey="platformDefaultsDrawerWidth"
      defaultWidth={600}
      minWidth={450}
      zIndex={1301}
    >
      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Stack spacing={2}>
            {/* Platform settings */}
            {platformList.length === 0 ? (
              <Alert severity="info">{t('platformDefaults.noPlatforms')}</Alert>
            ) : (
              platformList.map((platform) => (
                <Accordion key={platform.value} defaultExpanded>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        width: '100%',
                        mr: 2,
                      }}
                    >
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                        {platform.label}
                      </Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Stack spacing={2}>
                      <TextField
                        fullWidth
                        label={t('clientVersions.form.gameServerAddress')}
                        value={
                          defaults[platform.value]?.gameServerAddress || ''
                        }
                        onChange={(e) =>
                          handlePlatformDefaultChange(
                            platform.value,
                            'gameServerAddress',
                            e.target.value
                          )
                        }
                        placeholder="https://game.example.com"
                        helperText={t('platformDefaults.gameServerAddressHelp')}
                      />
                      <TextField
                        fullWidth
                        label={t('clientVersions.form.patchAddress')}
                        value={defaults[platform.value]?.patchAddress || ''}
                        onChange={(e) =>
                          handlePlatformDefaultChange(
                            platform.value,
                            'patchAddress',
                            e.target.value
                          )
                        }
                        placeholder="https://patch.example.com"
                        helperText={t('platformDefaults.patchAddressHelp')}
                      />
                    </Stack>
                  </AccordionDetails>
                </Accordion>
              ))
            )}
          </Stack>
        )}
      </Box>

      {/* Footer */}
      <Box
        sx={{
          p: 2,
          borderTop: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          display: 'flex',
          gap: 1,
          justifyContent: 'flex-end',
        }}
      >
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
          onClick={handleSave}
          disabled={saving || loading}
        >
          {t('common.save')}
        </Button>
      </Box>
    </ResizableDrawer>
  );
};

export default PlatformDefaultsDialog;
