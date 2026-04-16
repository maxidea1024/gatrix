import React, { useState, useEffect } from 'react';
import {
  Button,
  TextField,
  Box,
  IconButton,
  InputAdornment,
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import ResizableDrawer from '../common/ResizableDrawer';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import surveyService, { SurveyConfig } from '../../services/surveyService';
import { useOrgProject } from '@/contexts/OrgProjectContext';

interface SurveyConfigDialogProps {
  open: boolean;
  onClose: () => void;
}

const SurveyConfigDialog: React.FC<SurveyConfigDialogProps> = ({
  open,
  onClose,
}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { getProjectApiPath } = useOrgProject();
  const projectApiPath = getProjectApiPath();

  const [config, setConfig] = useState<SurveyConfig>({
    baseSurveyUrl: '',
    baseJoinedUrl: '',
    linkCaption: '',
    joinedSecretKey: '',
  });
  const [initialConfig, setInitialConfig] = useState<SurveyConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  // Load config
  useEffect(() => {
    if (open) {
      loadConfig();
    } else {
      setInitialConfig(null);
    }
  }, [open]);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const data = await surveyService.getSurveyConfig(projectApiPath);
      setConfig(data);
      setInitialConfig(data);
    } catch (error: any) {
      enqueueSnackbar(error.message || t('surveys.configLoadFailed'), {
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      await surveyService.updateSurveyConfig(projectApiPath, config);
      enqueueSnackbar(t('surveys.configUpdateSuccess'), { variant: 'success' });
      onClose();
    } catch (error: any) {
      enqueueSnackbar(error.message || t('surveys.configUpdateFailed'), {
        variant: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const hasChanges = initialConfig
    ? JSON.stringify(config) !== JSON.stringify(initialConfig)
    : false;

  return (
    <ResizableDrawer
      open={open}
      onClose={onClose}
      title={t('surveys.config')}
      subtitle={t('surveys.configSubtitle')}
      defaultWidth={600}
      minWidth={400}
      maxWidth={1200}
    >
      {/* Content */}
      <Box sx={{ p: 3, flexGrow: 1, overflow: 'auto' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <TextField
            label={t('surveys.baseSurveyUrl')}
            value={config.baseSurveyUrl}
            onChange={(e) =>
              setConfig({ ...config, baseSurveyUrl: e.target.value })
            }
            fullWidth
            disabled={loading}
            helperText={t('surveys.baseSurveyUrlHelp')}
          />
          <TextField
            label={t('surveys.baseJoinedUrl')}
            value={config.baseJoinedUrl}
            onChange={(e) =>
              setConfig({ ...config, baseJoinedUrl: e.target.value })
            }
            fullWidth
            disabled={loading}
            helperText={t('surveys.baseJoinedUrlHelp')}
          />
          <TextField
            label={t('surveys.linkCaption')}
            value={config.linkCaption}
            onChange={(e) =>
              setConfig({ ...config, linkCaption: e.target.value })
            }
            fullWidth
            disabled={loading}
            helperText={t('surveys.linkCaptionHelp')}
          />
          <TextField
            label={t('surveys.joinedSecretKey')}
            value={config.joinedSecretKey}
            onChange={(e) =>
              setConfig({ ...config, joinedSecretKey: e.target.value })
            }
            fullWidth
            disabled={loading}
            helperText={t('surveys.joinedSecretKeyHelp')}
            type={showSecret ? 'text' : 'password'}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowSecret(!showSecret)}
                    edge="end"
                    size="small"
                  >
                    {showSecret ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </Box>
      </Box>

      {/* Footer */}
      <Box
        sx={{
          p: 2,
          borderTop: 1,
          borderColor: 'divider',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 1,
          bgcolor: 'background.paper',
        }}
      >
        <Button onClick={onClose} disabled={submitting}>
          {t('common.cancel')}
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading || submitting || !hasChanges}
        >
          {submitting ? t('common.saving') : t('common.update')}
        </Button>
      </Box>
    </ResizableDrawer>
  );
};

export default SurveyConfigDialog;
