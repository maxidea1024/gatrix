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
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import ConfirmDeleteDialog from '@/components/common/ConfirmDeleteDialog';
import { CreateIntegrationWizard } from '@/components/integrations/CreateIntegrationWizard';
import { useSnackbar } from 'notistack';
import { api } from '@/services/api';

// Integration provider icons
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
            onClick={() => setWizardOpen(true)}
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
          {/* Available Integrations */}
          <Typography variant="h6" sx={{ mb: 2 }}>
            {t('integrations.availableProviders')}
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
              gap: 2,
              mb: 4,
            }}
          >
            {providers.map((provider) => (
              <Card
                key={provider.name}
                sx={{
                  height: '100%',
                  cursor: 'pointer',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 4,
                  },
                }}
                onClick={() => setWizardOpen(true)}
              >
                <CardContent>
                  <Box display="flex" alignItems="center" gap={2} mb={1}>
                    <Box
                      component="img"
                      src={getProviderIcon(provider.name)}
                      alt={t(provider.displayName)}
                      sx={{ width: 40, height: 40 }}
                    />
                    <Typography variant="h6">{t(provider.displayName)}</Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {t(provider.description)}
                  </Typography>
                  {getConfiguredProviders().has(provider.name) && (
                    <Chip
                      label={t('integrations.configured')}
                      size="small"
                      color="success"
                      sx={{ mt: 1 }}
                    />
                  )}
                </CardContent>
              </Card>
            ))}
          </Box>

          {/* Configured Integrations */}
          <Typography variant="h6" sx={{ mb: 2 }}>
            {t('integrations.configuredIntegrations')}
          </Typography>
          {integrations.length === 0 ? (
            <Box
              sx={{
                border: '2px dashed',
                borderColor: 'divider',
                borderRadius: 2,
                p: 4,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
              }}
            >
              <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                {t('integrations.noIntegrationsGuide')}
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => navigate('/settings/integrations/create')}
              >
                {t('integrations.createFirst')}
              </Button>
            </Box>
          ) : (
            <Stack spacing={2}>
              {integrations.map((integration) => (
                <Card key={integration.id}>
                  <CardContent>
                    <Box display="flex" alignItems="center" justifyContent="space-between">
                      <Box display="flex" alignItems="center" gap={2}>
                        <Box
                          component="img"
                          src={getProviderIcon(integration.provider)}
                          alt={integration.provider}
                          sx={{ width: 40, height: 40 }}
                        />
                        <Box>
                          <Typography variant="h6">
                            {providers.find((p) => p.name === integration.provider)?.displayName ||
                              integration.provider}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {integration.description || t('integrations.noDescription')}
                          </Typography>
                          <Box display="flex" gap={1} mt={0.5}>
                            <Chip
                              label={`${integration.events.length} ${t('integrations.events')}`}
                              size="small"
                              variant="outlined"
                            />
                            {integration.environments.length > 0 && (
                              <Chip
                                label={`${integration.environments.length} ${t('integrations.environments')}`}
                                size="small"
                                variant="outlined"
                              />
                            )}
                          </Box>
                        </Box>
                      </Box>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Switch
                          checked={integration.isEnabled}
                          onChange={() => handleToggle(integration)}
                          color="primary"
                        />
                        <Tooltip title={t('common.edit')}>
                          <IconButton
                            onClick={() =>
                              navigate(`/settings/integrations/${integration.id}/edit`)
                            }
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t('common.delete')}>
                          <IconButton color="error" onClick={() => setDeleteTarget(integration)}>
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          )}
        </>
      )}

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        title={t('integrations.deleteConfirmTitle')}
        message={t('integrations.deleteConfirmMessage', {
          provider:
            providers.find((p) => p.name === deleteTarget?.provider)?.displayName ||
            deleteTarget?.provider,
        })}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
        confirmButtonText={t('common.delete')}
      />

      <CreateIntegrationWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onSuccess={fetchData}
      />
    </Box>
  );
};

export default IntegrationsPage;
