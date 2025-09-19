import React, { useState, useEffect, useContext, createContext } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  IconButton,
  Tooltip,
  AppBar,
  Toolbar,
  Container,
  Paper,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Switch,
  FormControlLabel,
  Tabs,
  Tab,
  Divider
} from '@mui/material';
import { DataGrid, GridColDef, GridActionsCellItem } from '@mui/x-data-grid';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Publish as PublishIcon,
  Archive as ArchiveIcon,
  Settings as SettingsIcon,
  Campaign as CampaignIcon,
  Code as CodeIcon,
  Visibility as ViewIcon,
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  History as HistoryIcon,
  Download as ExportIcon,
  Upload as ImportIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

// Types
interface Environment {
  id: number;
  environmentName: string;
  displayName: string;
  description: string;
  isDefault: boolean;
  requiresApproval: boolean;
  requiredApprovers: number;
}

interface Template {
  id: number;
  templateName: string;
  displayName: string;
  description: string;
  templateType: 'client' | 'server';
  status: 'draft' | 'staged' | 'published' | 'archived';
  version: number;
  publishedAt?: string;
  updatedAt: string;
  updatedBy: string;
}

interface ChangeRequest {
  id: number;
  templateId: number;
  requestType: string;
  title: string;
  status: 'pending' | 'approved' | 'rejected';
  requiredApprovals: number;
  receivedApprovals: number;
  createdAt: string;
  createdBy: string;
}

// Environment Context
interface EnvironmentContextType {
  currentEnvironment: Environment | null;
  environments: Environment[];
  switchEnvironment: (environmentId: number) => void;
  isLoading: boolean;
}

const EnvironmentContext = createContext<EnvironmentContextType>({
  currentEnvironment: null,
  environments: [],
  switchEnvironment: () => {},
  isLoading: false
});

// Environment Provider
export const EnvironmentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentEnvironment, setCurrentEnvironment] = useState<Environment | null>(null);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadEnvironments();
  }, []);

  const loadEnvironments = async () => {
    try {
      setIsLoading(true);
      // TODO: Replace with actual API call
      const mockEnvironments: Environment[] = [
        {
          id: 1,
          environmentName: 'development',
          displayName: 'Development',
          description: 'Development environment for testing',
          isDefault: true,
          requiresApproval: false,
          requiredApprovers: 1
        },
        {
          id: 2,
          environmentName: 'staging',
          displayName: 'Staging',
          description: 'Staging environment for pre-production testing',
          isDefault: false,
          requiresApproval: true,
          requiredApprovers: 1
        },
        {
          id: 3,
          environmentName: 'production',
          displayName: 'Production',
          description: 'Production environment for live users',
          isDefault: false,
          requiresApproval: true,
          requiredApprovers: 2
        }
      ];
      
      setEnvironments(mockEnvironments);
      
      // Set default environment
      const savedEnvId = localStorage.getItem('selectedEnvironmentId');
      if (savedEnvId) {
        const savedEnv = mockEnvironments.find(env => env.id === parseInt(savedEnvId));
        if (savedEnv) {
          setCurrentEnvironment(savedEnv);
        } else {
          setCurrentEnvironment(mockEnvironments[0]);
        }
      } else {
        setCurrentEnvironment(mockEnvironments[0]);
      }
    } catch (error) {
      console.error('Failed to load environments:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const switchEnvironment = (environmentId: number) => {
    const environment = environments.find(env => env.id === environmentId);
    if (environment) {
      setCurrentEnvironment(environment);
      localStorage.setItem('selectedEnvironmentId', environmentId.toString());
    }
  };

  return (
    <EnvironmentContext.Provider value={{
      currentEnvironment,
      environments,
      switchEnvironment,
      isLoading
    }}>
      {children}
    </EnvironmentContext.Provider>
  );
};

// Environment Selector Component
const EnvironmentSelector: React.FC = () => {
  const { t } = useTranslation();
  const { currentEnvironment, environments, switchEnvironment, isLoading } = useContext(EnvironmentContext);

  const getEnvironmentColor = (envName: string) => {
    switch (envName.toLowerCase()) {
      case 'development': return 'success';
      case 'staging': return 'warning';
      case 'production': return 'error';
      default: return 'default';
    }
  };

  return (
    <Paper elevation={1} sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
      <Box sx={{ px: 3, py: 2 }}>
        <Grid container alignItems="center" justifyContent="space-between">
          <Grid item>
            <Typography variant="h5" component="h1" sx={{ fontWeight: 600 }}>
              {t('remoteConfig.title')}
            </Typography>
          </Grid>
          <Grid item>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body2" color="text.secondary">
                {t('remoteConfig.currentEnvironment')}:
              </Typography>
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <Select
                  value={currentEnvironment?.id || ''}
                  onChange={(e) => switchEnvironment(Number(e.target.value))}
                  disabled={isLoading}
                  displayEmpty
                >
                  {environments.map((env) => (
                    <MenuItem key={env.id} value={env.id}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip
                          label={env.displayName}
                          size="small"
                          color={getEnvironmentColor(env.environmentName) as any}
                          variant="outlined"
                        />
                        {env.requiresApproval && (
                          <Chip
                            label={`${env.requiredApprovers} approver${env.requiredApprovers > 1 ? 's' : ''}`}
                            size="small"
                            variant="outlined"
                          />
                        )}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </Grid>
        </Grid>
      </Box>
    </Paper>
  );
};

// Statistics Cards Component
const StatisticsCards: React.FC = () => {
  const { t } = useTranslation();
  const [stats, setStats] = useState({
    totalTemplates: 0,
    published: 0,
    staged: 0,
    drafts: 0,
    pendingApprovals: 0
  });

  useEffect(() => {
    // TODO: Load actual statistics
    setStats({
      totalTemplates: 12,
      published: 8,
      staged: 2,
      drafts: 2,
      pendingApprovals: 3
    });
  }, []);

  const cards = [
    {
      title: t('remoteConfig.stats.totalTemplates'),
      value: stats.totalTemplates,
      color: 'primary',
      icon: <CodeIcon />
    },
    {
      title: t('remoteConfig.stats.published'),
      value: stats.published,
      color: 'success',
      icon: <PublishIcon />
    },
    {
      title: t('remoteConfig.stats.staged'),
      value: stats.staged,
      color: 'warning',
      icon: <SettingsIcon />
    },
    {
      title: t('remoteConfig.stats.drafts'),
      value: stats.drafts,
      color: 'info',
      icon: <EditIcon />
    },
    {
      title: t('remoteConfig.stats.pendingApprovals'),
      value: stats.pendingApprovals,
      color: 'error',
      icon: <ApproveIcon />
    }
  ];

  return (
    <Grid container spacing={3} sx={{ mb: 3 }}>
      {cards.map((card, index) => (
        <Grid xs={12} sm={6} md={2.4} key={index}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="text.secondary" gutterBottom variant="body2">
                    {card.title}
                  </Typography>
                  <Typography variant="h4" component="div">
                    {card.value}
                  </Typography>
                </Box>
                <Box sx={{ color: `${card.color}.main` }}>
                  {card.icon}
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
};

// Templates Management Component
const TemplatesManagement: React.FC = () => {
  const { t } = useTranslation();
  const { currentEnvironment } = useContext(EnvironmentContext);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<'create' | 'edit' | 'view'>('create');

  useEffect(() => {
    if (currentEnvironment) {
      loadTemplates();
    }
  }, [currentEnvironment]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      // TODO: Replace with actual API call
      const mockTemplates: Template[] = [
        {
          id: 1,
          templateName: 'mobile_app_config',
          displayName: 'Mobile App Configuration',
          description: 'Configuration for mobile application features',
          templateType: 'client',
          status: 'published',
          version: 3,
          publishedAt: '2024-01-15T10:30:00Z',
          updatedAt: '2024-01-15T10:30:00Z',
          updatedBy: 'john.doe@example.com'
        },
        {
          id: 2,
          templateName: 'api_feature_flags',
          displayName: 'API Feature Flags',
          description: 'Server-side feature flags for API',
          templateType: 'server',
          status: 'draft',
          version: 1,
          updatedAt: '2024-01-14T15:45:00Z',
          updatedBy: 'jane.smith@example.com'
        }
      ];
      setTemplates(mockTemplates);
    } catch (error) {
      console.error('Failed to load templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTemplate = () => {
    setSelectedTemplate(null);
    setDialogType('create');
    setDialogOpen(true);
  };

  const handleEditTemplate = (template: Template) => {
    setSelectedTemplate(template);
    setDialogType('edit');
    setDialogOpen(true);
  };

  const handleViewTemplate = (template: Template) => {
    setSelectedTemplate(template);
    setDialogType('view');
    setDialogOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published': return 'success';
      case 'staged': return 'warning';
      case 'draft': return 'info';
      case 'archived': return 'default';
      default: return 'default';
    }
  };

  const columns: GridColDef[] = [
    {
      field: 'displayName',
      headerName: t('remoteConfig.templateName'),
      flex: 1,
      minWidth: 200
    },
    {
      field: 'templateType',
      headerName: t('remoteConfig.type'),
      width: 100,
      renderCell: (params) => (
        <Chip
          label={params.value}
          size="small"
          color={params.value === 'client' ? 'primary' : 'secondary'}
          variant="outlined"
        />
      )
    },
    {
      field: 'status',
      headerName: t('remoteConfig.status.title'),
      width: 120,
      renderCell: (params) => (
        <Chip
          label={t(`remoteConfig.status.${params.value}`, params.value)}
          size="small"
          color={getStatusColor(params.value) as any}
        />
      )
    },
    {
      field: 'version',
      headerName: t('remoteConfig.version'),
      width: 80,
      align: 'center'
    },
    {
      field: 'updatedAt',
      headerName: t('remoteConfig.lastUpdated'),
      width: 160,
      renderCell: (params) => new Date(params.value).toLocaleDateString()
    },
    {
      field: 'updatedBy',
      headerName: t('remoteConfig.updatedBy'),
      width: 180
    },
    {
      field: 'actions',
      type: 'actions',
      headerName: t('common.actions'),
      width: 120,
      getActions: (params) => [
        <GridActionsCellItem
          icon={<ViewIcon />}
          label={t('common.view')}
          onClick={() => handleViewTemplate(params.row)}
        />,
        <GridActionsCellItem
          icon={<EditIcon />}
          label={t('common.edit')}
          onClick={() => handleEditTemplate(params.row)}
        />,
        <GridActionsCellItem
          icon={<PublishIcon />}
          label={t('remoteConfig.publish')}
          onClick={() => {/* TODO: Implement publish */}}
          disabled={params.row.status === 'published'}
        />
      ]
    }
  ];

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" component="h2">
            {t('remoteConfig.templates')}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<ImportIcon />}
              size="small"
            >
              {t('remoteConfig.import')}
            </Button>
            <Button
              variant="outlined"
              startIcon={<ExportIcon />}
              size="small"
            >
              {t('remoteConfig.export')}
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleCreateTemplate}
              size="small"
            >
              {t('remoteConfig.createTemplate')}
            </Button>
          </Box>
        </Box>

        <DataGrid
          rows={templates}
          columns={columns}
          loading={loading}
          autoHeight
          disableRowSelectionOnClick
          pageSizeOptions={[10, 25, 50]}
          initialState={{
            pagination: { paginationModel: { pageSize: 10 } }
          }}
        />
      </CardContent>
    </Card>
  );
};

// Change Requests Management Component
const ChangeRequestsManagement: React.FC = () => {
  const { t } = useTranslation();
  const { currentEnvironment } = useContext(EnvironmentContext);
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (currentEnvironment) {
      loadChangeRequests();
    }
  }, [currentEnvironment]);

  const loadChangeRequests = async () => {
    try {
      setLoading(true);
      // TODO: Replace with actual API call
      const mockRequests: ChangeRequest[] = [
        {
          id: 1,
          templateId: 1,
          requestType: 'publish',
          title: 'Publish Mobile App Config v3',
          status: 'pending',
          requiredApprovals: 2,
          receivedApprovals: 1,
          createdAt: '2024-01-15T09:00:00Z',
          createdBy: 'john.doe@example.com'
        },
        {
          id: 2,
          templateId: 2,
          requestType: 'update',
          title: 'Update API Feature Flags',
          status: 'approved',
          requiredApprovals: 1,
          receivedApprovals: 1,
          createdAt: '2024-01-14T14:30:00Z',
          createdBy: 'jane.smith@example.com'
        }
      ];
      setChangeRequests(mockRequests);
    } catch (error) {
      console.error('Failed to load change requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = (requestId: number) => {
    // TODO: Implement approval logic
    console.log('Approve request:', requestId);
  };

  const handleReject = (requestId: number) => {
    // TODO: Implement rejection logic
    console.log('Reject request:', requestId);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'success';
      case 'pending': return 'warning';
      case 'rejected': return 'error';
      default: return 'default';
    }
  };

  const columns: GridColDef[] = [
    {
      field: 'title',
      headerName: t('remoteConfig.changeRequest.title'),
      flex: 1,
      minWidth: 250
    },
    {
      field: 'requestType',
      headerName: t('remoteConfig.changeRequest.type'),
      width: 120,
      renderCell: (params) => (
        <Chip
          label={params.value}
          size="small"
          variant="outlined"
        />
      )
    },
    {
      field: 'status',
      headerName: t('remoteConfig.status.title'),
      width: 120,
      renderCell: (params) => (
        <Chip
          label={t(`remoteConfig.changeRequest.status.${params.value}`, params.value)}
          size="small"
          color={getStatusColor(params.value) as any}
        />
      )
    },
    {
      field: 'approvals',
      headerName: t('remoteConfig.changeRequest.approvals'),
      width: 120,
      renderCell: (params) => (
        <Typography variant="body2">
          {params.row.receivedApprovals}/{params.row.requiredApprovals}
        </Typography>
      )
    },
    {
      field: 'createdAt',
      headerName: t('remoteConfig.createdAt'),
      width: 160,
      renderCell: (params) => new Date(params.value).toLocaleDateString()
    },
    {
      field: 'createdBy',
      headerName: t('remoteConfig.createdBy'),
      width: 180
    },
    {
      field: 'actions',
      type: 'actions',
      headerName: t('common.actions'),
      width: 120,
      getActions: (params) => [
        <GridActionsCellItem
          icon={<ApproveIcon />}
          label={t('remoteConfig.approve')}
          onClick={() => handleApprove(params.row.id)}
          disabled={params.row.status !== 'pending'}
        />,
        <GridActionsCellItem
          icon={<RejectIcon />}
          label={t('remoteConfig.reject')}
          onClick={() => handleReject(params.row.id)}
          disabled={params.row.status !== 'pending'}
        />,
        <GridActionsCellItem
          icon={<HistoryIcon />}
          label={t('remoteConfig.history')}
          onClick={() => {/* TODO: Show history */}}
        />
      ]
    }
  ];

  return (
    <Card sx={{ mt: 3 }}>
      <CardContent>
        <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
          {t('remoteConfig.changeRequests')}
        </Typography>

        <DataGrid
          rows={changeRequests}
          columns={columns}
          loading={loading}
          autoHeight
          disableRowSelectionOnClick
          pageSizeOptions={[10, 25, 50]}
          initialState={{
            pagination: { paginationModel: { pageSize: 10 } }
          }}
        />
      </CardContent>
    </Card>
  );
};

// Main Dashboard Component
const RemoteConfigDashboard: React.FC = () => {
  const { t } = useTranslation();
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <EnvironmentProvider>
      <Box sx={{ p: 3 }}>
        {/* Fixed Environment Selector */}
        <EnvironmentSelector />

        {/* Statistics Cards */}
        <StatisticsCards />

        {/* Main Content Tabs */}
        <Paper sx={{ width: '100%' }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab
              label={t('remoteConfig.templates')}
              icon={<CodeIcon />}
              iconPosition="start"
            />
            <Tab
              label={t('remoteConfig.changeRequests')}
              icon={<ApproveIcon />}
              iconPosition="start"
            />
            <Tab
              label={t('remoteConfig.environmentSettings')}
              icon={<SettingsIcon />}
              iconPosition="start"
            />
          </Tabs>

          <Box sx={{ p: 3 }}>
            {tabValue === 0 && <TemplatesManagement />}
            {tabValue === 1 && <ChangeRequestsManagement />}
            {tabValue === 2 && (
              <Alert severity="info">
                {t('remoteConfig.environmentSettingsComingSoon')}
              </Alert>
            )}
          </Box>
        </Paper>
      </Container>
    </EnvironmentProvider>
  );
};

export default RemoteConfigDashboard;
