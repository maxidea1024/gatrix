import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  FormControlLabel,
  Switch,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  InputAdornment,
  IconButton,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { api } from '@/services/api';
import { EventSelector, EnvironmentSelector } from '@/components/integrations/IntegrationSelectors';

// Provider icons
import slackIcon from '@/assets/icons/integrations/slack.svg';
import teamsIcon from '@/assets/icons/integrations/teams.svg';
import webhookIcon from '@/assets/icons/integrations/webhook.svg';
import larkIcon from '@/assets/icons/integrations/lark.svg';

interface ProviderDefinition {
  name: string;
  displayName: string;
  description: string;
  documentationUrl?: string;
  parameters: Array<{
    name: string;
    displayName: string;
    type: string;
    description?: string;
    placeholder?: string;
    required: boolean;
    sensitive: boolean;
    default?: string | number | boolean;
  }>;
  events: string[];
}

interface EventCategory {
  key: string;
  events: string[];
}

const PROVIDER_ICONS: Record<string, string> = {
  slack: slackIcon,
  'slack-app': slackIcon,
  teams: teamsIcon,
  webhook: webhookIcon,
  lark: larkIcon,
};

// Event categories for UI grouping
const EVENT_CATEGORIES: EventCategory[] = [
  {
    key: 'feature_flags',
    events: [
      'feature_flag_created',
      'feature_flag_updated',
      'feature_flag_archived',
      'feature_flag_revived',
      'feature_flag_deleted',
      'feature_flag_stale_on',
      'feature_flag_stale_off',
      'feature_environment_enabled',
      'feature_environment_disabled',
      'feature_strategy_added',
      'feature_strategy_updated',
      'feature_strategy_removed',
    ],
  },
  {
    key: 'segments',
    events: ['feature_segment_created', 'feature_segment_updated', 'feature_segment_deleted'],
  },
  {
    key: 'game_world',
    events: [
      'game_world_created',
      'game_world_updated',
      'game_world_deleted',
      'game_world_maintenance_on',
      'game_world_maintenance_off',
      'game_world_visibility_changed',
      'game_world_order_updated',
    ],
  },
  {
    key: 'client_version',
    events: [
      'client_version_created',
      'client_version_updated',
      'client_version_deleted',
      'client_version_bulk_created',
    ],
  },
  {
    key: 'service_notice',
    events: [
      'service_notice_created',
      'service_notice_updated',
      'service_notice_deleted',
      'service_notice_bulk_deleted',
      'service_notice_toggled',
    ],
  },
  {
    key: 'user',
    events: [
      'user_login',
      'user_created',
      'user_updated',
      'user_deleted',
      'user_approved',
      'user_rejected',
      'user_suspended',
      'user_unsuspended',
    ],
  },
  {
    key: 'api_token',
    events: [
      'api_token_created',
      'api_token_updated',
      'api_token_regenerated',
      'api_token_deleted',
    ],
  },
  {
    key: 'integration',
    events: ['integration_created', 'integration_updated', 'integration_deleted'],
  },
];

const STEPS = ['selectProvider', 'configure', 'selectEvents'];

export const CreateIntegrationPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { enqueueSnackbar } = useSnackbar();

  const [activeStep, setActiveStep] = useState(0);
  const [providers, setProviders] = useState<ProviderDefinition[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(
    searchParams.get('provider') || null
  );
  const [description, setDescription] = useState('');
  const [isEnabled, setIsEnabled] = useState(true);
  const [parameters, setParameters] = useState<Record<string, any>>({});
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [selectedEnvironments, setSelectedEnvironments] = useState<string[]>([]);
  const [environments, setEnvironments] = useState<{ environment: string; displayName?: string }[]>(
    []
  );
  const [showSensitive, setShowSensitive] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchProviders();
    fetchEnvironments();
  }, []);

  // Set default parameter values when provider changes
  useEffect(() => {
    if (currentProvider) {
      const defaults: Record<string, any> = {};
      for (const param of currentProvider.parameters) {
        if (param.default !== undefined) {
          defaults[param.name] = param.default;
        }
      }
      setParameters(defaults);
    }
  }, [selectedProvider, providers]);

  const fetchProviders = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/integrations/providers');
      setProviders(res?.data || []);
    } catch {
      enqueueSnackbar(t('integrations.providerLoadFailed'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const fetchEnvironments = async () => {
    try {
      const res = await api.get('/admin/environments');
      setEnvironments(res?.data || []);
    } catch {
      // Ignore error
    }
  };

  const currentProvider = providers.find((p) => p.name === selectedProvider);

  const handleParameterChange = (name: string, value: any) => {
    setParameters((prev) => ({ ...prev, [name]: value }));
  };

  // Check if all required parameters are filled
  const isParametersValid = (): boolean => {
    if (!currentProvider) return false;

    const requiredParams = currentProvider.parameters.filter((p) => p.required);
    for (const param of requiredParams) {
      const value = parameters[param.name];
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        return false;
      }
    }
    return true;
  };

  const canProceed = (): boolean => {
    switch (activeStep) {
      case 0:
        return !!selectedProvider;
      case 1:
        return isParametersValid();
      case 2:
        return selectedEvents.length > 0;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (activeStep === STEPS.length - 1) {
      handleSave();
    } else {
      setActiveStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (activeStep === 0) {
      navigate('/settings/integrations');
    } else {
      setActiveStep((prev) => prev - 1);
    }
  };

  const handleSave = async () => {
    if (!selectedProvider) return;
    if (!isParametersValid() || selectedEvents.length === 0) {
      enqueueSnackbar(t('integrations.requiredFieldsMissing'), { variant: 'error' });
      return;
    }

    setSaving(true);
    try {
      await api.post('/admin/integrations', {
        provider: selectedProvider,
        description,
        isEnabled,
        parameters,
        events: selectedEvents,
        environments: selectedEnvironments,
      });
      enqueueSnackbar(t('integrations.saveSuccess'), { variant: 'success' });
      navigate('/settings/integrations');
    } catch {
      enqueueSnackbar(t('integrations.saveFailed'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const renderParameterInput = (param: ProviderDefinition['parameters'][0]) => {
    const value = parameters[param.name] || '';
    const isSensitive = param.sensitive;
    const isVisible = showSensitive[param.name];

    if (param.type === 'textfield') {
      return (
        <TextField
          key={param.name}
          fullWidth
          multiline
          rows={4}
          label={t(param.displayName)}
          value={value}
          onChange={(e) => handleParameterChange(param.name, e.target.value)}
          placeholder={param.placeholder}
          helperText={param.description ? t(param.description) : undefined}
          required={param.required}
          sx={{ mb: 2 }}
        />
      );
    }

    return (
      <TextField
        key={param.name}
        fullWidth
        label={t(param.displayName)}
        type={isSensitive && !isVisible ? 'password' : 'text'}
        value={value}
        onChange={(e) => handleParameterChange(param.name, e.target.value)}
        placeholder={param.placeholder}
        helperText={param.description ? t(param.description) : undefined}
        required={param.required}
        sx={{ mb: 2 }}
        slotProps={
          isSensitive
            ? {
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() =>
                        setShowSensitive((prev) => ({
                          ...prev,
                          [param.name]: !prev[param.name],
                        }))
                      }
                      edge="end"
                    >
                      {isVisible ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }
            : undefined
        }
      />
    );
  };

  if (loading && providers.length === 0) {
    return (
      <Box display="flex" justifyContent="center" py={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 2 }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h4" sx={{ fontWeight: 600 }}>
            {t('integrations.createTitle')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('integrations.createSubtitle')}
          </Typography>
        </Box>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/settings/integrations')}>
          {t('common.back')}
        </Button>
      </Box>

      {/* Stepper */}
      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {STEPS.map((step) => (
          <Step key={step}>
            <StepLabel>{t(`integrations.step.${step}`)}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {/* Step Content */}
      <Card>
        <CardContent>
          {/* Step 0: Select Provider */}
          {activeStep === 0 && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>
                {t('integrations.selectProvider')}
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                  gap: 2,
                }}
              >
                {providers.map((provider) => (
                  <Card
                    key={provider.name}
                    sx={{
                      cursor: 'pointer',
                      border: 2,
                      borderColor:
                        selectedProvider === provider.name ? 'primary.main' : 'transparent',
                      '&:hover': { borderColor: 'primary.light' },
                    }}
                    onClick={() => setSelectedProvider(provider.name)}
                  >
                    <CardContent>
                      <Box display="flex" alignItems="center" gap={2}>
                        <Box
                          component="img"
                          src={PROVIDER_ICONS[provider.name] || webhookIcon}
                          alt={t(provider.displayName)}
                          sx={{ width: 40, height: 40 }}
                        />
                        <Box>
                          <Typography variant="subtitle1" fontWeight="bold">
                            {t(provider.displayName)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {t(provider.description)}
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            </Box>
          )}

          {/* Step 1: Configure Parameters */}
          {activeStep === 1 && currentProvider && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>
                {t('integrations.parameters')}
              </Typography>

              <TextField
                fullWidth
                label={t('integrations.description')}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('integrations.descriptionPlaceholder')}
                sx={{ mb: 2 }}
              />

              <FormControlLabel
                control={
                  <Switch checked={isEnabled} onChange={(e) => setIsEnabled(e.target.checked)} />
                }
                label={t('common.enabled')}
                sx={{ mb: 2 }}
              />

              {currentProvider.parameters.map((param) => renderParameterInput(param))}
            </Box>
          )}

          {/* Step 2: Select Events & Environments */}
          {activeStep === 2 && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>
                {t('integrations.eventSelection')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('integrations.eventSelectionHelp')}
              </Typography>

              <Box sx={{ mb: 3 }}>
                <EventSelector
                  selectedEvents={selectedEvents}
                  onChange={setSelectedEvents}
                  eventCategories={EVENT_CATEGORIES}
                />
              </Box>

              <Typography variant="h6" sx={{ mb: 2 }}>
                {t('integrations.environmentSelection')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('integrations.environmentSelectionHelp')}
              </Typography>

              <EnvironmentSelector
                selectedEnvironments={selectedEnvironments}
                onChange={setSelectedEnvironments}
                environments={environments}
              />
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Navigation Buttons */}
      <Box display="flex" justifyContent="space-between" mt={3}>
        <Button variant="outlined" onClick={handleBack}>
          {activeStep === 0 ? t('common.cancel') : t('common.back')}
        </Button>
        <Button
          variant="contained"
          onClick={handleNext}
          disabled={!canProceed() || saving}
          endIcon={
            saving ? (
              <CircularProgress size={16} />
            ) : activeStep === STEPS.length - 1 ? null : (
              <ArrowForwardIcon />
            )
          }
        >
          {activeStep === STEPS.length - 1 ? t('common.save') : t('common.next')}
        </Button>
      </Box>
    </Box>
  );
};

export default CreateIntegrationPage;
