import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
  Alert,
  Chip,
  Checkbox,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormGroup,
  InputAdornment,
  IconButton,
  Stack,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tooltip,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Visibility,
  VisibilityOff,
  ArrowBack as ArrowBackIcon,
  Send as SendIcon,
  Sync as SyncIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { api } from '@/services/api';

// Provider icons
import slackIcon from '@/assets/icons/integrations/slack.svg';
import teamsIcon from '@/assets/icons/integrations/teams.svg';
import webhookIcon from '@/assets/icons/integrations/webhook.svg';
import larkIcon from '@/assets/icons/integrations/lark.svg';

interface Integration {
  id: string;
  provider: string;
  description: string | null;
  isEnabled: boolean;
  parameters: Record<string, any>;
  events: string[];
  environments: string[];
}

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

interface EventLog {
  id: string;
  eventType: string;
  state: 'success' | 'failed' | 'successWithErrors';
  statusCode: number | null;
  stateDetails: string | null;
  createdAt: string;
}

const PROVIDER_ICONS: Record<string, string> = {
  slack: slackIcon,
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

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

export const EditIntegrationPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { enqueueSnackbar } = useSnackbar();

  const [tabValue, setTabValue] = useState(0);
  const [providers, setProviders] = useState<ProviderDefinition[]>([]);
  const [environments, setEnvironments] = useState<{ environment: string; displayName?: string }[]>(
    []
  );
  const [integration, setIntegration] = useState<Integration | null>(null);
  const [description, setDescription] = useState('');
  const [isEnabled, setIsEnabled] = useState(true);
  const [parameters, setParameters] = useState<Record<string, any>>({});
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [selectedEnvironments, setSelectedEnvironments] = useState<string[]>([]);
  const [showSensitive, setShowSensitive] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [eventLogs, setEventLogs] = useState<EventLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [testing, setTesting] = useState(false);

  // Initial values for dirty check
  const [initialValues, setInitialValues] = useState<{
    description: string;
    isEnabled: boolean;
    parameters: Record<string, any>;
    events: string[];
    environments: string[];
  } | null>(null);

  useEffect(() => {
    fetchData();
    fetchEnvironments();
  }, [id]);

  useEffect(() => {
    if (tabValue === 1) {
      fetchEventLogs();
    }
  }, [tabValue, id]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [integrationRes, providersRes] = await Promise.all([
        api.get(`/admin/integrations/${id}`),
        api.get('/admin/integrations/providers'),
      ]);
      const integrationData = integrationRes?.data;
      setIntegration(integrationData);
      setProviders(providersRes?.data || []);

      // Populate form with existing data
      if (integrationData) {
        setDescription(integrationData.description || '');
        setIsEnabled(integrationData.isEnabled);
        setParameters(integrationData.parameters || {});
        setSelectedEvents(integrationData.events || []);
        setSelectedEnvironments(integrationData.environments || []);

        // Store initial values for dirty check
        setInitialValues({
          description: integrationData.description || '',
          isEnabled: integrationData.isEnabled,
          parameters: integrationData.parameters || {},
          events: integrationData.events || [],
          environments: integrationData.environments || [],
        });
      }
    } catch {
      enqueueSnackbar(t('integrations.loadFailed'), { variant: 'error' });
      navigate('/settings/integrations');
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

  const fetchEventLogs = async () => {
    try {
      setLogsLoading(true);
      const res = await api.get(`/admin/integrations/${id}/events`);
      setEventLogs(res?.data || []);
    } catch {
      // Ignore error
    } finally {
      setLogsLoading(false);
    }
  };

  const handleTestConnection = async () => {
    if (!integration) return;

    setTesting(true);
    try {
      await api.post(`/admin/integrations/${id}/test`);
      enqueueSnackbar(t('integrations.testSuccess'), { variant: 'success' });
    } catch (error: any) {
      const message = error?.response?.data?.error || t('integrations.testFailed');
      enqueueSnackbar(message, { variant: 'error' });
    } finally {
      setTesting(false);
    }
  };

  const currentProvider = integration
    ? providers.find((p) => p.name === integration.provider)
    : null;

  const handleParameterChange = (name: string, value: any) => {
    setParameters((prev) => ({ ...prev, [name]: value }));
  };

  const handleEventToggle = (event: string) => {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  };

  const handleCategoryToggle = (category: EventCategory) => {
    const allSelected = category.events.every((e) => selectedEvents.includes(e));
    if (allSelected) {
      setSelectedEvents((prev) => prev.filter((e) => !category.events.includes(e)));
    } else {
      setSelectedEvents((prev) => [...new Set([...prev, ...category.events])]);
    }
  };

  const handleSelectAllEvents = () => {
    const allEvents = EVENT_CATEGORIES.flatMap((c) => c.events);
    setSelectedEvents(allEvents);
  };

  const handleDeselectAllEvents = () => {
    setSelectedEvents([]);
  };

  // Check if all required parameters are filled
  const isFormValid = (): boolean => {
    if (!currentProvider) return false;
    if (selectedEvents.length === 0) return false;

    const requiredParams = currentProvider.parameters.filter((p) => p.required);
    for (const param of requiredParams) {
      const value = parameters[param.name];
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        return false;
      }
    }
    return true;
  };

  // Check if form has been modified
  const isDirty = (): boolean => {
    if (!initialValues) return false;

    if (description !== initialValues.description) return true;
    if (isEnabled !== initialValues.isEnabled) return true;
    if (JSON.stringify(parameters) !== JSON.stringify(initialValues.parameters)) return true;
    if (JSON.stringify(selectedEvents.sort()) !== JSON.stringify(initialValues.events.sort()))
      return true;
    if (
      JSON.stringify(selectedEnvironments.sort()) !==
      JSON.stringify(initialValues.environments.sort())
    )
      return true;

    return false;
  };

  const handleSave = async () => {
    if (!integration) return;
    if (!isFormValid()) {
      enqueueSnackbar(t('integrations.requiredFieldsMissing'), { variant: 'error' });
      return;
    }

    setSaving(true);
    try {
      await api.put(`/admin/integrations/${id}`, {
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

  const getStateIcon = (state: string) => {
    switch (state) {
      case 'success':
        return <CheckCircleIcon color="success" fontSize="small" />;
      case 'failed':
        return <ErrorIcon color="error" fontSize="small" />;
      default:
        return <ErrorIcon color="warning" fontSize="small" />;
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (!integration || !currentProvider) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{t('integrations.loadFailed')}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 2 }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h4" sx={{ fontWeight: 600 }}>
            {t('integrations.editTitle')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('integrations.editSubtitle')}
          </Typography>
        </Box>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/settings/integrations')}>
          {t('common.back')}
        </Button>
      </Box>

      {/* Provider Header */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" alignItems="center" gap={2}>
            <Box
              component="img"
              src={PROVIDER_ICONS[integration.provider] || webhookIcon}
              alt={t(currentProvider.displayName)}
              sx={{ width: 48, height: 48 }}
            />
            <Box flex={1}>
              <Typography variant="h6">{t(currentProvider.displayName)}</Typography>
              <Typography variant="body2" color="text.secondary">
                {t(currentProvider.description)}
              </Typography>
            </Box>
            <Chip
              label={isEnabled ? t('common.enabled') : t('common.disabled')}
              color={isEnabled ? 'success' : 'default'}
              size="small"
            />
          </Box>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
          <Tab label={t('integrations.settings')} />
          <Tab label={t('integrations.eventLogs')} />
        </Tabs>
      </Box>

      {/* Settings Tab */}
      <TabPanel value={tabValue} index={0}>
        {/* Action Buttons */}
        <Box display="flex" gap={2} mb={3}>
          <Button
            variant="outlined"
            startIcon={testing ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
            onClick={handleTestConnection}
            disabled={testing}
          >
            {testing ? t('common.sending') : t('integrations.testSend')}
          </Button>
        </Box>

        {/* Configuration Form */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
            gap: 3,
          }}
        >
          {/* Left Column - Parameters */}
          <Card>
            <CardContent>
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
            </CardContent>
          </Card>

          {/* Right Column - Events */}
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">{t('integrations.eventSelection')}</Typography>
                <Stack direction="row" spacing={1}>
                  <Button size="small" onClick={handleSelectAllEvents}>
                    {t('integrations.selectAllEvents')}
                  </Button>
                  <Button size="small" onClick={handleDeselectAllEvents}>
                    {t('integrations.deselectAllEvents')}
                  </Button>
                </Stack>
              </Box>

              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('integrations.eventSelectionHelp')}
              </Typography>

              {EVENT_CATEGORIES.map((category) => {
                const selectedCount = category.events.filter((e) =>
                  selectedEvents.includes(e)
                ).length;
                const allSelected = selectedCount === category.events.length;

                return (
                  <Accordion key={category.key} defaultExpanded={false}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Box display="flex" alignItems="center" gap={1} width="100%">
                        <Checkbox
                          checked={allSelected}
                          indeterminate={selectedCount > 0 && !allSelected}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => handleCategoryToggle(category)}
                        />
                        <Typography>{t(`integrations.eventCategories.${category.key}`)}</Typography>
                        <Chip
                          label={`${selectedCount}/${category.events.length}`}
                          size="small"
                          sx={{ ml: 'auto', mr: 1 }}
                        />
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails>
                      <FormGroup>
                        {category.events.map((event) => (
                          <FormControlLabel
                            key={event}
                            control={
                              <Checkbox
                                checked={selectedEvents.includes(event)}
                                onChange={() => handleEventToggle(event)}
                              />
                            }
                            label={event.replace(/_/g, ' ')}
                          />
                        ))}
                      </FormGroup>
                    </AccordionDetails>
                  </Accordion>
                );
              })}

              {selectedEvents.length === 0 && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  {t('integrations.eventSelectionHelp')}
                </Alert>
              )}
            </CardContent>
          </Card>
        </Box>

        {/* Environment Selection */}
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>
              {t('integrations.environmentSelection')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t('integrations.environmentSelectionHelp')}
            </Typography>
            <FormGroup row>
              {environments.map((env) => (
                <FormControlLabel
                  key={env.environment}
                  control={
                    <Checkbox
                      checked={selectedEnvironments.includes(env.environment)}
                      onChange={() => {
                        setSelectedEnvironments((prev) =>
                          prev.includes(env.environment)
                            ? prev.filter((e) => e !== env.environment)
                            : [...prev, env.environment]
                        );
                      }}
                    />
                  }
                  label={env.displayName || env.environment}
                />
              ))}
            </FormGroup>
            {environments.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                {t('integrations.noEnvironmentsAvailable')}
              </Typography>
            )}
          </CardContent>
        </Card>

        {/* Save Button */}
        <Box display="flex" justifyContent="flex-end" mt={3}>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving || !isFormValid() || !isDirty()}
          >
            {saving ? <CircularProgress size={24} /> : t('common.save')}
          </Button>
        </Box>
      </TabPanel>

      {/* Event Logs Tab */}
      <TabPanel value={tabValue} index={1}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">{t('integrations.eventLogs')}</Typography>
          <Button startIcon={<RefreshIcon />} onClick={fetchEventLogs} disabled={logsLoading}>
            {t('common.refresh')}
          </Button>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('integrations.eventLogsSubtitle')}
        </Typography>

        {logsLoading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        ) : eventLogs.length === 0 ? (
          <Alert severity="info">{t('integrations.noEventLogs')}</Alert>
        ) : (
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('common.status')}</TableCell>
                  <TableCell>{t('integrations.eventType')}</TableCell>
                  <TableCell>{t('integrations.statusCode')}</TableCell>
                  <TableCell>{t('integrations.details')}</TableCell>
                  <TableCell>{t('common.createdAt')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {eventLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <Tooltip title={t(`integrations.eventState.${log.state}`)}>
                        {getStateIcon(log.state)}
                      </Tooltip>
                    </TableCell>
                    <TableCell>{log.eventType.replace(/_/g, ' ')}</TableCell>
                    <TableCell>{log.statusCode ?? '-'}</TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{
                          maxWidth: 300,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {log.stateDetails || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>{new Date(log.createdAt).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </TabPanel>
    </Box>
  );
};

export default EditIntegrationPage;
