import React, { useState, useCallback, useEffect } from 'react';
import { Dialog, Button, IconButton, Alert, CircularProgress, useTheme, alpha, Fade, Box, Typography } from '@mui/material';
import { Close as CloseIcon, ArrowForward as ArrowForwardIcon, ArrowBack as ArrowBackIcon, Save as SaveIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { WizardFieldDef, WizardProviderConfig, WizardStep, ProviderWizardModalProps } from './ProviderWizard/types';
import { WizardSidebar } from './ProviderWizard/WizardSidebar';
import { IntroStep } from './ProviderWizard/IntroStep';
import { FieldsStep } from './ProviderWizard/FieldsStep';

export type { WizardFieldDef, WizardProviderConfig, WizardStep, ProviderWizardModalProps };

export const ProviderWizardModal: React.FC<ProviderWizardModalProps> = ({
  open,
  onClose,
  provider,
  fields,
  onSubmit,
  wizardTitleKey,
  initialData,
  onTestConnection,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const sidebarBg = isDark ? '#1e1e2e' : '#2d2b55';
  const accent = isDark ? '#667eea' : '#667eea';

  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const hasGuide = !!provider?.guideUrl;
  const splitThreshold = 4;
  const needsSplit = fields.length > splitThreshold;

  const buildSteps = useCallback((): WizardStep[] => {
    const steps: WizardStep[] = [
      { titleKey: 'argus.settings.providerWizard.introTitle', subtitleKey: 'argus.settings.providerWizard.introSubtitle' },
    ];
    if (needsSplit) {
      steps.push({ titleKey: 'argus.settings.providerWizard.basicTitle', subtitleKey: 'argus.settings.providerWizard.basicSubtitle' });
      steps.push({ titleKey: 'argus.settings.providerWizard.detailTitle', subtitleKey: 'argus.settings.providerWizard.detailSubtitle' });
    } else {
      steps.push({ titleKey: 'argus.settings.providerWizard.configTitle', subtitleKey: 'argus.settings.providerWizard.configSubtitle' });
    }
    return steps;
  }, [needsSplit]);

  const steps = buildSteps();
  const totalSteps = steps.length;
  const firstFields = needsSplit ? fields.slice(0, splitThreshold) : fields;
  const secondFields = needsSplit ? fields.slice(splitThreshold) : [];
  const isEditMode = !!initialData;

  useEffect(() => {
    if (open) {
      setActiveStep(isEditMode ? 1 : 0);
      setError('');
      setLoading(false);
      setFormData(initialData || {});
      setTestResult(null);
      setTesting(false);
    }
  }, [open, isEditMode, initialData]);

  const handleTestConnection = async () => {
    if (!onTestConnection) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await onTestConnection(formData);
      setTestResult(result);
    } catch (err: any) {
      setTestResult({ ok: false, message: err.message || 'Test failed' });
    } finally {
      setTesting(false);
    }
  };

  if (!provider) return null;

  const handleSave = async () => {
    setLoading(true);
    setError('');
    try {
      await onSubmit(formData);
      onClose();
    } catch (err: any) {
      setError(err.message || t('argus.settings.providerWizard.saveFailed', 'Failed to save'));
    } finally {
      setLoading(false);
    }
  };

  const canProceed = () => {
    if (activeStep === 0) return true;
    const currentFields = activeStep === 1 ? firstFields : secondFields;
    return currentFields
      .filter((f) => f.required !== false)
      .filter((f) => f.key === 'name' || f.type === 'password' || f.required)
      .every((f) => !!formData[f.key]?.trim());
  };

  const isLastStep = activeStep === totalSteps - 1;

  const renderStepContent = () => {
    if (activeStep === 0) {
      return <IntroStep cfg={provider} hasGuide={hasGuide} isDark={isDark} accent={accent} />;
    }
    const currentFields = activeStep === 1 ? firstFields : secondFields;
    const showTest = activeStep === 1 ? (!needsSplit && isLastStep) : true;
    return (
      <FieldsStep
        fieldsToRender={currentFields}
        formData={formData}
        onChange={(key, value) => {
          setFormData((prev) => ({ ...prev, [key]: value }));
          setTestResult(null);
        }}
        isDark={isDark}
        accent={accent}
        showTest={showTest}
        onTestConnection={onTestConnection}
        testing={testing}
        testResult={testResult}
        onTest={handleTestConnection}
        canProceed={canProceed()}
      />
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: '16px', overflow: 'hidden', minHeight: 440, maxHeight: '85vh', display: 'flex', flexDirection: 'row' } }}>
      <WizardSidebar cfg={provider} wizardTitleKey={wizardTitleKey} activeStep={activeStep} steps={steps} isDark={isDark} sidebarBg={sidebarBg} accent={accent} />
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 1.5, pb: 0 }}>
          <IconButton size="small" onClick={onClose} sx={{ opacity: 0.4, '&:hover': { opacity: 1 } }}>
            <CloseIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Box>
        <Box sx={{ flex: 1, px: 4, pb: 2, overflow: 'auto' }}>
          <Fade in key={activeStep} timeout={300}>
            <Box>
              <Box sx={{ mb: 3 }}>
                <Typography sx={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                  {t(steps[activeStep].titleKey)}
                </Typography>
              </Box>
              {renderStepContent()}
              {error && <Alert severity="error" sx={{ mt: 2, borderRadius: '10px' }}>{error}</Alert>}
            </Box>
          </Fade>
        </Box>
        <Box sx={{ px: 4, py: 2.5, borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1.5 }}>
          {activeStep > (isEditMode ? 1 : 0) && (
            <Button
              onClick={() => setActiveStep((s) => s - 1)}
              disabled={loading}
              startIcon={<ArrowBackIcon />}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                color: 'text.secondary',
                borderRadius: '10px',
                px: 2.5,
                py: 0.8,
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' },
              }}
            >
              {t('common.back', 'Back')}
            </Button>
          )}
          {isLastStep ? (
            <Button
              onClick={handleSave}
              variant="contained"
              disabled={loading || !canProceed() || (isEditMode && JSON.stringify(formData) === JSON.stringify(initialData || {}))}
              startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <SaveIcon sx={{ fontSize: 18 }} />}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                borderRadius: '10px',
                px: 4,
                py: 1,
                backgroundColor: accent,
                '&:hover': { backgroundColor: alpha(accent, 0.85) },
                '&.Mui-disabled': { backgroundColor: alpha(accent, 0.3) },
              }}
            >
              {t(isEditMode ? 'common.save' : 'argus.settings.providerWizard.save', isEditMode ? 'Save' : 'Complete Integration')}
            </Button>
          ) : (
            <Button
              onClick={() => setActiveStep((s) => s + 1)}
              variant="contained"
              endIcon={<ArrowForwardIcon />}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                borderRadius: '10px',
                px: 4,
                py: 1,
                backgroundColor: accent,
                '&:hover': { backgroundColor: alpha(accent, 0.85) },
              }}
            >
              {t('common.next', 'Next')}
            </Button>
          )}
        </Box>
      </Box>
    </Dialog>
  );
};
