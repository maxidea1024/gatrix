import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  IconButton,
  Collapse,
  Button,
  useTheme,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  KeyboardArrowDown,
  KeyboardArrowUp,
  Refresh as RefreshIcon,
  Circle as CircleIcon,
  Dns as DnsIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import serviceDiscoveryService, { ServiceInstance } from '../../services/serviceDiscoveryService';

interface EdgeGroup {
  id: string;
  name: string;
  instances: ServiceInstance[];
}

const GatrixEdgesPage: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [services, setServices] = useState<ServiceInstance[]>([]);
  const [groups, setGroups] = useState<EdgeGroup[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const fetchServices = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch all services and filter for edges, or generic approach
      // Assuming 'gate' or 'edge' is the service name. For now let's fetch all and filter client side if needed
      // Or just fetch all and assume we want to visualize 'gatrix-edge'
      const allServices = await serviceDiscoveryService.getServices();

      if (!allServices || !Array.isArray(allServices)) {
        console.warn('getServices returned invalid data:', allServices);
        setServices([]);
        setGroups([]);
        return;
      }

      // Filter for services that look like edges.
      // If we don't know the exact name, let's default to filtering 'gatrix-edge' or 'edge'
      // Ideally this should be configurable or determined by requirements.
      // Based on the image "edge-eu-north-1", the service name might be 'edge' or 'gatrix-edge'.
      const edgeServices = allServices.filter(
        (s) => s.labels.service === 'gatrix-edge' || s.labels.service === 'edge'
      );

      setServices(edgeServices);
      groupServices(edgeServices);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch services');
    } finally {
      setLoading(false);
    }
  };

  const groupServices = (services: ServiceInstance[]) => {
    const groupMap = new Map<string, ServiceInstance[]>();

    services.forEach((service) => {
      // Group by 'group' label or fallback to 'default'
      const groupName = service.labels.group || 'default';
      if (!groupMap.has(groupName)) {
        groupMap.set(groupName, []);
      }
      groupMap.get(groupName)?.push(service);
    });

    const newGroups: EdgeGroup[] = Array.from(groupMap.entries()).map(([name, instances]) => ({
      id: name,
      name: name === 'default' ? 'Default Group' : name,
      instances: instances.sort((a, b) => a.instanceId.localeCompare(b.instanceId)),
    }));

    setGroups(newGroups);
    // Expand all by default
    setExpandedGroups(new Set(newGroups.map((g) => g.id)));
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const toggleGroup = (groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready':
      case 'heartbeat':
        return theme.palette.success.main;
      case 'starting':
      case 'initializing':
        return theme.palette.warning.main;
      case 'error':
      case 'terminated':
        return theme.palette.error.main;
      default:
        return theme.palette.text.disabled;
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1600, mx: 'auto' }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 4,
        }}
      >
        <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
          {t('sidebar.gatrixEdges')}
        </Typography>
        <Button
          startIcon={<RefreshIcon />}
          variant="contained"
          onClick={fetchServices}
          disabled={loading}
        >
          {t('common.refresh')}
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {loading && !services.length ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
          }}
        >
          {/* Root Node */}
          <Card
            sx={{
              minWidth: 200,
              textAlign: 'center',
              border: `2px solid ${theme.palette.primary.main}`,
              boxShadow: theme.shadows[4],
              zIndex: 2,
            }}
          >
            <CardContent>
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    bgcolor: 'primary.main',
                    borderRadius: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                  }}
                >
                  <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                    G
                  </Typography>
                </Box>
                <Typography variant="h6">Gatrix</Typography>
              </Box>
            </CardContent>
          </Card>

          {/* Connection Lines Logic would go here if we were using SVG or canvas, 
              for simplified CSS version we'll just stack them with some visual connectors if possible,
              or just show the groups below. 
          */}

          <Box
            sx={{
              position: 'relative',
              width: '100%',
              display: 'flex',
              justifyContent: 'center',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: -32,
                left: '50%',
                width: 2,
                height: 32,
                bgcolor: theme.palette.divider,
              },
            }}
          >
            {/* Horizontal bar connecting groups */}
            {groups.length > 1 && (
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: '10%', // approximate, needs dynamic calculation for perfect tree
                  right: '10%',
                  height: 2,
                  bgcolor: theme.palette.divider,
                }}
              />
            )}

            <Box
              sx={{
                display: 'flex',
                gap: 3,
                flexWrap: 'wrap',
                justifyContent: 'center',
                width: '100%',
              }}
            >
              {groups.map((group) => (
                <Box
                  key={group.id}
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    minWidth: 300,
                  }}
                >
                  {/* Connector to parent */}
                  <Box
                    sx={{
                      width: 2,
                      height: 24,
                      bgcolor: theme.palette.divider,
                      mb: 1,
                      mt: -0.5,
                    }}
                  />

                  {/* Group Card */}
                  <Card
                    sx={{
                      width: '100%',
                      mb: 2,
                      border: `1px solid ${theme.palette.divider}`,
                    }}
                  >
                    <Box
                      sx={{
                        p: 1.5,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        bgcolor: theme.palette.action.hover,
                        cursor: 'pointer',
                      }}
                      onClick={() => toggleGroup(group.id)}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip
                          label="Self-hosted"
                          size="small"
                          color="primary"
                          variant="outlined"
                          sx={{ height: 20, fontSize: '0.7rem' }}
                        />
                        <Typography variant="subtitle1" fontWeight="bold">
                          {group.name}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                          {group.instances.length} instances
                        </Typography>
                        {expandedGroups.has(group.id) ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
                      </Box>
                    </Box>

                    <Collapse in={expandedGroups.has(group.id)}>
                      <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
                        <Box
                          sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 1,
                          }}
                        >
                          {group.instances.map((instance) => (
                            <Card
                              key={instance.instanceId}
                              variant="outlined"
                              sx={{
                                p: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                borderColor: theme.palette.divider,
                              }}
                            >
                              <Box
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 1.5,
                                }}
                              >
                                <CircleIcon
                                  sx={{
                                    fontSize: 12,
                                    color: getStatusColor(instance.status),
                                  }}
                                />
                                <Box>
                                  <Typography variant="body2" fontWeight="medium">
                                    {instance.hostname}
                                  </Typography>
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    title={instance.instanceId}
                                  >
                                    ID: {instance.instanceId.substring(0, 8)}...
                                  </Typography>
                                </Box>
                              </Box>

                              <Box
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 1,
                                }}
                              >
                                {/* Detailed status metrics could go here if available */}
                                {instance.status === 'ready' ? (
                                  <Chip
                                    label="Connected"
                                    size="small"
                                    color="success"
                                    sx={{ height: 20, fontSize: '0.65rem' }}
                                  />
                                ) : (
                                  <Chip
                                    label={instance.status}
                                    size="small"
                                    sx={{ height: 20, fontSize: '0.65rem' }}
                                  />
                                )}
                                <IconButton size="small">
                                  <KeyboardArrowDown fontSize="small" />
                                </IconButton>
                              </Box>
                            </Card>
                          ))}

                          {group.instances.length === 0 && (
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{ textAlign: 'center', py: 2 }}
                            >
                              No active instances
                            </Typography>
                          )}
                        </Box>
                      </CardContent>
                    </Collapse>
                  </Card>
                </Box>
              ))}

              {groups.length === 0 && !loading && (
                <Box sx={{ p: 4, textAlign: 'center' }}>
                  <Typography color="text.secondary">No Edge servers found.</Typography>
                </Box>
              )}
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default GatrixEdgesPage;
