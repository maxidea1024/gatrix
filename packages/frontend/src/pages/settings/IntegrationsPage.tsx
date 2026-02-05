import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Switch,
  CircularProgress,
  Alert,
  Chip,
  IconButton,
  Tooltip,
  Stack,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  ChevronRight as ChevronRightIcon,
} from '@mui/icons-material';
import ConfirmDeleteDialog from '@/components/common/ConfirmDeleteDialog';
import { CreateIntegrationWizard } from '@/components/integrations/CreateIntegrationWizard';
import { useSnackbar } from 'notistack';
import { api } from '@/services/api';

// Integration provider icons
import slackIcon from '@/assets/icons/integrations/slack.svg';
import teamsIcon from '@/assets/icons/integrations/teams.svg';
import webhookIcon from '@/assets/icons/integrations/webhook.svg';
import larkIcon from '@/assets/icons/integrations/lark.svg';
import newrelicIcon from '@/assets/icons/integrations/newrelic.svg';

interface Integration {
  id: string;
  provider: string;
  description: string | null;
  isEnabled: boolean;
  parameters: Record<string, any>;
  events: string[];
  environments: string[];
  createdByName?: string;
  updatedByName?: string;
  createdAt: string;
  updatedAt: string;
}

interface ProviderDefinition {
  name: string;
  displayName: string;
  description: string;
  documentationUrl?: string;
  deprecated?: string;
  parameters: Array<{
    name: string;
    displayName: string;
    type: string;
    description?: string;
    placeholder?: string;
    required: boolean;
    sensitive: boolean;
  }>;
  events: string[];
}

const PROVIDER_ICONS: Record<string, string> = {
  slack: slackIcon,
  'slack-app': slackIcon,
  'new-relic': newrelicIcon,
  teams: teamsIcon,
  webhook: webhookIcon,
  lark: larkIcon,
};

export const IntegrationsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();

  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [providers, setProviders] = useState<ProviderDefinition[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Integration | null>(null);
  const [loading, setLoading] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardProvider, setWizardProvider] = useState<string | undefined>(undefined);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [integrationsRes, providersRes] = await Promise.all([
        api.get('/admin/integrations'),
        api.get('/admin/integrations/providers'),
      ]);
      setIntegrations(integrationsRes?.data || []);
      setProviders(providersRes?.data || []);
    } catch {
      enqueueSnackbar(t('integrations.loadFailed'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggle = async (integration: Integration) => {
    try {
      await api.post(`/admin/integrations/${integration.id}/toggle`);
      await fetchData();
      enqueueSnackbar(
        integration.isEnabled
          ? t('integrations.disabledSuccess')
          : t('integrations.enabledSuccess'),
        { variant: 'success' }
      );
    } catch {
      enqueueSnackbar(t('integrations.toggleFailed'), { variant: 'error' });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/admin/integrations/${deleteTarget.id}`);
      await fetchData();
      enqueueSnackbar(t('integrations.deleteSuccess'), { variant: 'success' });
      setDeleteTarget(null);
    } catch {
      enqueueSnackbar(t('integrations.deleteFailed'), { variant: 'error' });
    }
  };

  const getProviderIcon = (provider: string): string => {
    return PROVIDER_ICONS[provider] || webhookIcon;
  };

  const getConfiguredProviders = (): Set<string> => {
    return new Set(integrations.map((i) => i.provider));
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 2 }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h4" sx={{ fontWeight: 600 }}>
            {t('integrations.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('integrations.subtitle')}
          </Typography>
        </Box>
        {integrations.length > 0 && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setWizardProvider(undefined);
              setWizardOpen(true);
            }}
          >
            {t('integrations.create')}
          </Button>
        )}
      </Box>

      {loading && integrations.length === 0 ? (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {/* Configured Integrations - Now at TOP */}
          {integrations.length > 0 && (
            <>
              <Typography variant="h6" sx={{ mb: 1 }}>
                {t('integrations.configuredIntegrations')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('integrations.configuredDescription')}
              </Typography>
              <Stack spacing={2} sx={{ mb: 4 }}>
                {integrations.map((integration) => {
                  const provider = providers.find((p) => p.name === integration.provider);
                  return (
                    <Card
                      key={integration.id}
                      sx={{
                        border: 1,
                        borderColor: 'divider',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                      }}
                    >
                      <CardContent sx={{ py: 2 }}>
                        <Box display="flex" alignItems="center" justifyContent="space-between">
                          <Box display="flex" alignItems="center" gap={2}>
                            <Box
                              component="img"
                              src={getProviderIcon(integration.provider)}
                              alt={integration.provider}
                              sx={{ width: 32, height: 32 }}
                            />
                            <Typography variant="subtitle1" fontWeight="medium">
                              {t(provider?.displayName || integration.provider)}
                            </Typography>
                          </Box>
                          <Box display="flex" alignItems="center" gap={1}>
                            <Chip
                              label={integration.isEnabled ? t('common.enabled') : t('common.disabled')}
                              size="small"
                              color={integration.isEnabled ? 'success' : 'default'}
                              variant="outlined"
                            />
                            <Tooltip title={t('common.delete')}>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => setDeleteTarget(integration)}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </Box>
                        <Box sx={{ mt: 1 }}>
                          <Button
                            size="small"
                            endIcon={<ChevronRightIcon />}
                            onClick={() => navigate(`/settings/integrations/${integration.id}/edit`)}
                            sx={{ textTransform: 'none' }}
                          >
                            {t('common.open')}
                          </Button>
                        </Box>
                      </CardContent>
                    </Card>
                  );
                })}
              </Stack>
            </>
          )}

          {/* Available Integrations - Now at BOTTOM */}
          <Typography variant="h6" sx={{ mb: 1 }}>
            {t('integrations.availableProviders')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('integrations.availableDescription')}
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(auto-fill, minmax(280px, 1fr))',
                md: 'repeat(auto-fill, minmax(280px, 1fr))',
              },
              gap: 2,
              mb: 4,
            }}
          >
            {providers.map((provider) => (
              <Card
                key={provider.name}
                sx={{
                  minWidth: 280,
                  maxWidth: 400,
                  border: 1,
                  borderColor: 'divider',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                  display: 'flex',
                  flexDirection: 'column',
                  opacity: provider.deprecated ? 0.7 : 1,
                  transition: 'box-shadow 0.2s',
                  '&:hover': {
                    boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                  },
                }}
              >
                <CardContent sx={{ flex: 1, pb: 1 }}>
                  <Box display="flex" alignItems="center" gap={2} mb={1}>
                    <Box
                      component="img"
                      src={getProviderIcon(provider.name)}
                      alt={t(provider.displayName)}
                      sx={{ width: 32, height: 32 }}
                    />
                    <Typography variant="subtitle1" fontWeight="medium">
                      {t(provider.displayName)}
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {t(provider.description)}
                  </Typography>
                  {provider.deprecated && (
                    <Typography variant="caption" color="warning.main">
                      {t(provider.deprecated)}
                    </Typography>
                  )}
                </CardContent>
                <Box sx={{ px: 2, pb: 2 }}>
                  <Button
                    size="small"
                    endIcon={<ChevronRightIcon />}
                    onClick={() => {
                      setWizardProvider(provider.name);
                      setWizardOpen(true);
                    }}
                    sx={{ textTransform: 'none' }}
                  >
                    {t('integrations.configure')}
                  </Button>
                </Box>
              </Card>
            ))}
          </Box>
        </>
      )}

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        title={t('integrations.deleteConfirmTitle')}
        message={t('integrations.deleteConfirmMessage', {
          provider: t(
            providers.find((p) => p.name === deleteTarget?.provider)?.displayName ||
            deleteTarget?.provider ||
            ''
          ),
        })}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
        confirmButtonText={t('common.delete')}
      />

      <CreateIntegrationWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onSuccess={fetchData}
        initialProvider={wizardProvider}
      />
    </Box>
  );
};

export default IntegrationsPage;
