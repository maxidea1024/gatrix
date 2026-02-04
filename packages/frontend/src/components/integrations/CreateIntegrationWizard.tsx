import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
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
  Card,
  CardContent,
  CardActionArea,
  Chip,
  Fade,
  alpha,
} from '@mui/material';
import {
  Close as CloseIcon,
  Visibility,
  VisibilityOff,
  Check as CheckIcon,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { api } from '@/services/api';
import { EventSelector, EnvironmentSelector } from './IntegrationSelectors';

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
  teams: teamsIcon,
  webhook: webhookIcon,
  lark: larkIcon,
};

const PROVIDER_COLORS: Record<string, string> = {
  slack: '#4A154B',
  teams: '#6264A7',
  webhook: '#607D8B',
  lark: '#00D6B9',
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

interface CreateIntegrationWizardProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialProvider?: string;
}

export const CreateIntegrationWizard: React.FC<CreateIntegrationWizardProps> = ({
  open,
  onClose,
  onSuccess,
  initialProvider,
}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  const [activeStep, setActiveStep] = useState(initialProvider ? 1 : 0);
  const [providers, setProviders] = useState<ProviderDefinition[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(initialProvider || null);
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

  const STEPS = ['selectProvider', 'configure', 'selectEvents'];

  useEffect(() => {
    if (open) {
      fetchProviders();
      fetchEnvironments();
      // Reset form - if initialProvider is set, start at step 1
      setActiveStep(initialProvider ? 1 : 0);
      setSelectedProvider(initialProvider || null);
      setDescription('');
      setIsEnabled(true);
      setParameters({});
      setSelectedEvents([]);
      setSelectedEnvironments([]);
      setShowSensitive({});
    }
  }, [open, initialProvider]);

  // Set default parameter values and description when provider changes
  useEffect(() => {
    if (currentProvider) {
      const defaults: Record<string, any> = {};
      for (const param of currentProvider.parameters) {
        // Only set non-sensitive defaults
        if (param.default !== undefined && !param.sensitive) {
          defaults[param.name] = param.default;
        }
      }
      setParameters(defaults);

      // Set default description
      const providerName = t(currentProvider.displayName);
      setDescription(`Gatrix ${providerName}`);
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
    setActiveStep((prev) => prev - 1);
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
      onSuccess();
      onClose();
    } catch {
      enqueueSnackbar(t('integrations.saveFailed'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const renderParameterInput = (param: ProviderDefinition['parameters'][0]) => {
    const value = parameters[param.name] ?? '';
    const isSensitive = param.sensitive;
    const isVisible = showSensitive[param.name];

    if (param.type === 'textfield') {
      return (
        <TextField
          key={param.name}
          fullWidth
          multiline
          rows={3}
          label={t(param.displayName)}
          value={value}
          onChange={(e) => handleParameterChange(param.name, e.target.value)}
          placeholder={param.placeholder}
          helperText={param.description ? t(param.description) : undefined}
          required={param.required}
          size="small"
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
        size="small"
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
                        size="small"
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

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          minHeight: 500,
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: 1,
          borderColor: 'divider',
          pb: 2,
        }}
      >
        <Box>
          <Typography variant="h5" fontWeight="bold">
            {t('integrations.createTitle')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('integrations.createSubtitle')}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 3 }}>
        {/* Stepper */}
        <Stepper activeStep={activeStep} sx={{ mt: 3, mb: 4 }}>
          {STEPS.map((step) => (
            <Step key={step}>
              <StepLabel>{t(`integrations.step.${step}`)}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {loading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {/* Step 0: Select Provider */}
            <Fade in={activeStep === 0}>
              <Box sx={{ display: activeStep === 0 ? 'block' : 'none' }}>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                    gap: 2,
                  }}
                >
                  {providers.map((provider) => {
                    const isSelected = selectedProvider === provider.name;
                    const color = PROVIDER_COLORS[provider.name] || '#607D8B';
                    return (
                      <Card
                        key={provider.name}
                        sx={{
                          border: 2,
                          borderColor: isSelected ? color : 'transparent',
                          bgcolor: isSelected ? alpha(color, 0.05) : 'background.paper',
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            borderColor: alpha(color, 0.5),
                            transform: 'translateY(-2px)',
                            boxShadow: 2,
                          },
                        }}
                      >
                        <CardActionArea onClick={() => setSelectedProvider(provider.name)}>
                          <CardContent sx={{ p: 2.5 }}>
                            <Box display="flex" alignItems="center" gap={2}>
                              <Box
                                sx={{
                                  width: 48,
                                  height: 48,
                                  borderRadius: 2,
                                  bgcolor: alpha(color, 0.1),
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <Box
                                  component="img"
                                  src={PROVIDER_ICONS[provider.name] || webhookIcon}
                                  alt={t(provider.displayName)}
                                  sx={{ width: 32, height: 32 }}
                                />
                              </Box>
                              <Box flex={1}>
                                <Typography variant="subtitle1" fontWeight="bold">
                                  {t(provider.displayName)}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  {t(provider.description)}
                                </Typography>
                              </Box>
                              {isSelected && <CheckIcon sx={{ color: color }} />}
                            </Box>
                          </CardContent>
                        </CardActionArea>
                      </Card>
                    );
                  })}
                </Box>
              </Box>
            </Fade>

            {/* Step 1: Configure Parameters */}
            <Fade in={activeStep === 1}>
              <Box sx={{ display: activeStep === 1 ? 'block' : 'none' }}>
                {currentProvider && (
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      mb: 3,
                      p: 2,
                      borderRadius: 2,
                      bgcolor: alpha(PROVIDER_COLORS[currentProvider.name] || '#607D8B', 0.05),
                    }}
                  >
                    <Box
                      component="img"
                      src={PROVIDER_ICONS[currentProvider.name] || webhookIcon}
                      alt={t(currentProvider.displayName)}
                      sx={{ width: 32, height: 32 }}
                    />
                    <Box>
                      <Typography variant="h6">{t(currentProvider.displayName)}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {t(currentProvider.description)}
                      </Typography>
                    </Box>
                  </Box>
                )}

                <FormControlLabel
                  control={
                    <Switch checked={isEnabled} onChange={(e) => setIsEnabled(e.target.checked)} />
                  }
                  label={t('common.enabled')}
                  sx={{ mb: 2 }}
                />

                <TextField
                  fullWidth
                  label={t('integrations.description')}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('integrations.descriptionPlaceholder')}
                  size="small"
                  sx={{ mb: 2 }}
                />

                {currentProvider?.parameters.map((param) => renderParameterInput(param))}
              </Box>
            </Fade>

            {/* Step 2: Select Events & Environments */}
            <Fade in={activeStep === 2}>
              <Box sx={{ display: activeStep === 2 ? 'block' : 'none' }}>
                <Box sx={{ mb: 4 }}>
                  <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
                    {t('integrations.eventSelection')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {t('integrations.eventSelectionHelp')}
                  </Typography>
                  <EventSelector
                    selectedEvents={selectedEvents}
                    onChange={setSelectedEvents}
                    eventCategories={EVENT_CATEGORIES}
                  />
                </Box>

                <Box>
                  <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
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
              </Box>
            </Fade>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, borderTop: 1, borderColor: 'divider' }}>
        <Button onClick={activeStep === 0 ? onClose : handleBack} disabled={saving}>
          {activeStep === 0 ? t('common.cancel') : t('common.back')}
        </Button>
        <Button
          variant="contained"
          onClick={handleNext}
          disabled={!canProceed() || saving}
          sx={{ minWidth: 120 }}
        >
          {saving ? (
            <CircularProgress size={20} color="inherit" />
          ) : activeStep === STEPS.length - 1 ? (
            t('common.save')
          ) : (
            t('common.next')
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreateIntegrationWizard;
