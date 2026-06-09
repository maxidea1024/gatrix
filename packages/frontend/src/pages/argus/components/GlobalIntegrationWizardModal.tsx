import React, { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  Button,
  Box,
  CircularProgress,
  useTheme,
  alpha,
  IconButton,
  Fade,
} from '@mui/material';
import {
  Close as CloseIcon,
  ArrowForward as ArrowForwardIcon,
  ArrowBack as ArrowBackIcon,
  Lock as LockIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { argusService } from '@/services/argusService';

import { PROVIDER_CONFIG } from './GlobalIntegrationWizard/providerConfig';
import { WizardSidebar } from './GlobalIntegrationWizard/WizardSidebar';
import { WizardFormContainer } from './GlobalIntegrationWizard/WizardFields';
import {
  GithubFormState,
  GitlabFormState,
  BitbucketFormState,
  SlackFormState,
} from './GlobalIntegrationWizard/types';

import { GithubWizardSteps } from './GlobalIntegrationWizard/GithubWizardSteps';
import { GitlabWizardSteps } from './GlobalIntegrationWizard/GitlabWizardSteps';
import { BitbucketWizardSteps } from './GlobalIntegrationWizard/BitbucketWizardSteps';
import { SlackWizardSteps } from './GlobalIntegrationWizard/SlackWizardSteps';

interface GlobalIntegrationWizardModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  provider: 'github' | 'gitlab' | 'bitbucket' | 'slack';
}

export const GlobalIntegrationWizardModal: React.FC<
  GlobalIntegrationWizardModalProps
> = ({ open, onClose, onSuccess, provider }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const cfg = PROVIDER_CONFIG[provider];
  const totalSteps = cfg.steps.length;

  // Form states
  const [ghForm, setGhForm] = useState<GithubFormState>({
    appId: '',
    clientId: '',
    clientSecret: '',
    webhookSecret: '',
    privateKey: '',
  });
  const [glForm, setGlForm] = useState<GitlabFormState>({
    instanceUrl: '',
    applicationId: '',
    applicationSecret: '',
    webhookSecret: '',
  });
  const [bbForm, setBbForm] = useState<BitbucketFormState>({
    workspace: '',
    username: '',
    appPassword: '',
  });
  const [slackForm, setSlackForm] = useState<SlackFormState>({
    botToken: '',
    signingSecret: '',
  });

  // Test states
  const [ghTesting, setGhTesting] = useState(false);
  const [ghTestResult, setGhTestResult] = useState<{
    ok: boolean;
    name?: string;
    error?: string;
  } | null>(null);
  const [glTesting, setGlTesting] = useState(false);
  const [glTestResult, setGlTestResult] = useState<{
    ok: boolean;
    message?: string;
    error?: string;
  } | null>(null);
  const [bbTesting, setBbTesting] = useState(false);
  const [bbTestResult, setBbTestResult] = useState<{
    ok: boolean;
    display_name?: string;
    error?: string;
  } | null>(null);
  const [slackTesting, setSlackTesting] = useState(false);
  const [slackTestResult, setSlackTestResult] = useState<{
    ok: boolean;
    team?: string;
    error?: string;
  } | null>(null);

  // Reset state on open
  useEffect(() => {
    if (open) {
      setActiveStep(0);
      setError('');
      setLoading(false);
      setGhForm({
        appId: '',
        clientId: '',
        clientSecret: '',
        webhookSecret: '',
        privateKey: '',
      });
      setGlForm({
        instanceUrl: '',
        applicationId: '',
        applicationSecret: '',
        webhookSecret: '',
      });
      setBbForm({ workspace: '', username: '', appPassword: '' });
      setSlackForm({ botToken: '', signingSecret: '' });
      setGhTestResult(null);
      setGhTesting(false);
      setGlTestResult(null);
      setGlTesting(false);
      setBbTestResult(null);
      setBbTesting(false);
      setSlackTestResult(null);
      setSlackTesting(false);
    }
  }, [open]);

  const baseUrl = import.meta.env.VITE_APP_URL || window.location.origin;

  // Test handlers
  const handleGithubTest = useCallback(async () => {
    if (!ghForm.appId || !ghForm.privateKey) return;
    setGhTesting(true);
    setGhTestResult(null);
    try {
      const result = await argusService.testGithubConnection(
        ghForm.appId,
        ghForm.privateKey
      );
      setGhTestResult(result);
    } catch {
      setGhTestResult({ ok: false, error: 'Network error' });
    } finally {
      setGhTesting(false);
    }
  }, [ghForm.appId, ghForm.privateKey]);

  const handleGitlabTest = useCallback(async () => {
    if (!glForm.applicationId || !glForm.applicationSecret) return;
    setGlTesting(true);
    setGlTestResult(null);
    try {
      const result = await argusService.testGitlabConnection(
        glForm.instanceUrl || 'https://gitlab.com',
        glForm.applicationId,
        glForm.applicationSecret
      );
      setGlTestResult(result);
    } catch {
      setGlTestResult({ ok: false, error: 'Network error' });
    } finally {
      setGlTesting(false);
    }
  }, [glForm]);

  const handleBitbucketTest = useCallback(async () => {
    if (!bbForm.username || !bbForm.appPassword) return;
    setBbTesting(true);
    setBbTestResult(null);
    try {
      const result = await argusService.testBitbucketConnection(
        bbForm.username,
        bbForm.appPassword
      );
      setBbTestResult(result);
    } catch {
      setBbTestResult({ ok: false, error: 'Network error' });
    } finally {
      setBbTesting(false);
    }
  }, [bbForm]);

  const handleSlackTest = useCallback(async () => {
    if (!slackForm.botToken) return;
    setSlackTesting(true);
    setSlackTestResult(null);
    try {
      const result = await argusService.testSlackConnection(slackForm.botToken);
      setSlackTestResult(result);
    } catch {
      setSlackTestResult({ ok: false, error: 'Network error' });
    } finally {
      setSlackTesting(false);
    }
  }, [slackForm.botToken]);

  // Save handler
  const handleSave = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (provider === 'github') {
        await argusService.saveGlobalIntegrationConfig(provider, {
          name: 'GitHub App',
          credentials: {
            app_id: ghForm.appId,
            client_id: ghForm.clientId,
            client_secret: ghForm.clientSecret,
            webhook_secret: ghForm.webhookSecret,
            private_key: ghForm.privateKey,
          },
        });
      } else if (provider === 'gitlab') {
        await argusService.saveGlobalIntegrationConfig(provider, {
          name: 'GitLab OAuth',
          url: glForm.instanceUrl,
          credentials: {
            instance_url: glForm.instanceUrl,
            application_id: glForm.applicationId,
            application_secret: glForm.applicationSecret,
            webhook_secret: glForm.webhookSecret,
          },
        });
      } else if (provider === 'slack') {
        await argusService.saveGlobalIntegrationConfig(provider, {
          name: 'Slack App',
          credentials: {
            bot_token: slackForm.botToken,
            signing_secret: slackForm.signingSecret || undefined,
          },
        });
      } else {
        await argusService.saveGlobalIntegrationConfig(provider, {
          name: 'Bitbucket',
          credentials: {
            workspace: bbForm.workspace,
            username: bbForm.username,
            app_password: bbForm.appPassword,
          },
        });
      }
      onSuccess();
      setActiveStep(0);
    } catch (err: any) {
      setError(err.message || 'Failed to save');
    } finally {
      setLoading(false);
    }
  }, [provider, ghForm, glForm, bbForm, slackForm, onSuccess]);

  const canProceed = useCallback(() => {
    const lastStep = cfg.steps.length - 1;
    if (activeStep < lastStep) return true;
    if (provider === 'github') {
      return !!(
        ghForm.appId &&
        ghForm.clientId &&
        ghForm.clientSecret &&
        ghForm.privateKey
      );
    }
    if (provider === 'gitlab') {
      return !!(
        glForm.instanceUrl &&
        glForm.applicationId &&
        glForm.applicationSecret
      );
    }
    if (provider === 'slack') {
      return !!slackForm.botToken;
    }
    return !!(bbForm.workspace && bbForm.username && bbForm.appPassword);
  }, [
    activeStep,
    provider,
    ghForm,
    glForm,
    bbForm,
    slackForm,
    cfg.steps.length,
  ]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '16px',
          overflow: 'hidden',
          minHeight: 520,
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'row',
        },
      }}
    >
      <WizardSidebar
        provider={provider}
        activeStep={activeStep}
        cfg={cfg}
        isDark={isDark}
      />

      <Box
        sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}
      >
        <Box
          sx={{ display: 'flex', justifyContent: 'flex-end', p: 1.5, pb: 0 }}
        >
          <IconButton
            size="small"
            onClick={onClose}
            sx={{ opacity: 0.4, '&:hover': { opacity: 1 } }}
          >
            <CloseIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Box>

        <Box sx={{ flex: 1, px: 4, pb: 2, overflow: 'auto' }}>
          <Fade in key={activeStep} timeout={300}>
            <Box>
              <WizardFormContainer>
                {provider === 'github' && (
                  <GithubWizardSteps
                    step={activeStep}
                    form={ghForm}
                    onChange={(f, v) => setGhForm((p) => ({ ...p, [f]: v }))}
                    isDark={isDark}
                    baseUrl={baseUrl}
                    accentColor={cfg.accentColor}
                    testing={ghTesting}
                    testResult={ghTestResult}
                    onTest={handleGithubTest}
                  />
                )}
                {provider === 'gitlab' && (
                  <GitlabWizardSteps
                    step={activeStep}
                    form={glForm}
                    onChange={(f, v) => setGlForm((p) => ({ ...p, [f]: v }))}
                    isDark={isDark}
                    baseUrl={baseUrl}
                    accentColor={cfg.accentColor}
                    testing={glTesting}
                    testResult={glTestResult}
                    onTest={handleGitlabTest}
                  />
                )}
                {provider === 'bitbucket' && (
                  <BitbucketWizardSteps
                    step={activeStep}
                    form={bbForm}
                    onChange={(f, v) => setBbForm((p) => ({ ...p, [f]: v }))}
                    isDark={isDark}
                    accentColor={cfg.accentColor}
                    testing={bbTesting}
                    testResult={bbTestResult}
                    onTest={handleBitbucketTest}
                  />
                )}
                {provider === 'slack' && (
                  <SlackWizardSteps
                    step={activeStep}
                    form={slackForm}
                    onChange={(f, v) => setSlackForm((p) => ({ ...p, [f]: v }))}
                    isDark={isDark}
                    accentColor={cfg.accentColor}
                    testing={slackTesting}
                    testResult={slackTestResult}
                    onTest={handleSlackTest}
                  />
                )}
              </WizardFormContainer>
            </Box>
          </Fade>
        </Box>

        <Box
          sx={{
            px: 4,
            py: 2.5,
            borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: 1.5,
          }}
        >
          {activeStep > 0 && (
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
                '&:hover': {
                  backgroundColor: isDark
                    ? 'rgba(255,255,255,0.04)'
                    : 'rgba(0,0,0,0.03)',
                },
              }}
            >
              {t('common.back', 'Back')}
            </Button>
          )}
          {activeStep === totalSteps - 1 ? (
            <Button
              onClick={handleSave}
              variant="contained"
              disabled={loading || !canProceed()}
              startIcon={
                loading ? (
                  <CircularProgress size={18} color="inherit" />
                ) : (
                  <LockIcon sx={{ fontSize: 18 }} />
                )
              }
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                borderRadius: '10px',
                px: 4,
                py: 1,
                backgroundColor: cfg.accentColor,
                '&:hover': { backgroundColor: alpha(cfg.accentColor, 0.85) },
                '&.Mui-disabled': {
                  backgroundColor: alpha(cfg.accentColor, 0.3),
                },
              }}
            >
              {t(cfg.saveKey, 'Complete Integration')}
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
                backgroundColor: cfg.accentColor,
                '&:hover': { backgroundColor: alpha(cfg.accentColor, 0.85) },
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
