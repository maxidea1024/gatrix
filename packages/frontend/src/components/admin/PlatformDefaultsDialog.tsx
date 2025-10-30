import React, { useState, useEffect } from 'react';
import {
  Drawer,
  Button,
  TextField,
  Box,
  Typography,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Stack,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { PlatformDefaultsService, PlatformDefaults, PlatformDefaultsMap } from '@/services/platformDefaultsService';
import { usePlatformConfig } from '@/contexts/PlatformConfigContext';

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

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [defaults, setDefaults] = useState<PlatformDefaultsMap>({});

  // 기본값 로드
  const loadDefaults = async () => {
    try {
      setLoading(true);
      const data = await PlatformDefaultsService.getAllDefaults();
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

  // 플랫폼 삭제/추가 기능은 사용하지 않음 (고정된 플랫폼 목록 사용)

  // 플랫폼 기본값 변경
  const handlePlatformDefaultChange = (platform: string, field: keyof PlatformDefaults, value: string) => {
    setDefaults(prev => ({
      ...prev,
      [platform]: {
        ...prev[platform],
        [field]: value,
      },
    }));
  };

  // 저장
  const handleSave = async () => {
    try {
      setSaving(true);
      await PlatformDefaultsService.setAllDefaults(defaults);
      enqueueSnackbar(t('platformDefaults.saveSuccess'), { variant: 'success' });
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
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      sx={{
        zIndex: 1301,
        '& .MuiDrawer-paper': {
          width: { xs: '100%', sm: 600 },
          maxWidth: '100vw',
          display: 'flex',
          flexDirection: 'column'
        }
      }}
    >
      {/* Header */}
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        p: 2,
        borderBottom: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper'
      }}>
        <Box>
          <Typography variant="h6" component="h2">
            {t('platformDefaults.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('platformDefaults.description')}
          </Typography>
        </Box>
        <IconButton
          onClick={onClose}
          size="small"
          sx={{
            '&:hover': {
              backgroundColor: 'action.hover'
            }
          }}
        >
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Stack spacing={2}>

            {/* 플랫폼별 설정 */}
            {platformList.length === 0 ? (
              <Alert severity="info">
                {t('platformDefaults.noPlatforms')}
              </Alert>
            ) : (
              platformList.map((platform) => (
                <Accordion key={platform.value} defaultExpanded>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', mr: 2 }}>
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
                        value={defaults[platform.value]?.gameServerAddress || ''}
                        onChange={(e) => handlePlatformDefaultChange(platform.value, 'gameServerAddress', e.target.value)}
                        placeholder="https://game.example.com"
                        helperText={t('platformDefaults.gameServerAddressHelp')}
                      />
                      <TextField
                        fullWidth
                        label={t('clientVersions.form.patchAddress')}
                        value={defaults[platform.value]?.patchAddress || ''}
                        onChange={(e) => handlePlatformDefaultChange(platform.value, 'patchAddress', e.target.value)}
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
      <Box sx={{
        p: 2,
        borderTop: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        display: 'flex',
        gap: 1,
        justifyContent: 'flex-end'
      }}>
        <Button onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
          onClick={handleSave}
          disabled={saving || loading}
        >
          {t('common.save')}
        </Button>
      </Box>
    </Drawer>
  );
};

export default PlatformDefaultsDialog;
