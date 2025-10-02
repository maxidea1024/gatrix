import React, { useState, useEffect } from 'react';
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
  Alert
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  Archive as ArchiveIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { DataGrid, GridColDef, GridActionsCellItem } from '@mui/x-data-grid';

interface Environment {
  id: number;
  name: string;
  description: string;
  isActive: boolean;
}

interface Template {
  id: number;
  templateName: string;
  templateType: 'client' | 'server';
  status: 'draft' | 'staged' | 'published' | 'archived';
  version: number;
  updatedAt: string;
  updatedBy: string;
}

const RemoteConfigDashboard: React.FC = () => {
  const { t } = useTranslation();
  const [selectedEnvironment, setSelectedEnvironment] = useState<number>(1);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);

  // Mock data for demonstration
  useEffect(() => {
    setEnvironments([
      { id: 1, name: 'development', description: 'Development Environment', isActive: true },
      { id: 2, name: 'staging', description: 'Staging Environment', isActive: true },
      { id: 3, name: 'production', description: 'Production Environment', isActive: true }
    ]);

    setTemplates([
      {
        id: 1,
        templateName: 'mobile_app_config',
        templateType: 'client',
        status: 'published',
        version: 3,
        updatedAt: '2024-01-15T10:30:00Z',
        updatedBy: 'john.doe@example.com'
      },
      {
        id: 2,
        templateName: 'api_feature_flags',
        templateType: 'server',
        status: 'staged',
        version: 1,
        updatedAt: '2024-01-14T15:45:00Z',
        updatedBy: 'jane.smith@example.com'
      }
    ]);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published': return 'success';
      case 'staged': return 'warning';
      case 'draft': return 'info';
      case 'archived': return 'default';
      default: return 'default';
    }
  };

  const getTypeColor = (type: string) => {
    return type === 'client' ? 'primary' : 'secondary';
  };

  const handleRefresh = () => {
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      setLoading(false);
    }, 1000);
  };

  const columns: GridColDef[] = [
    {
      field: 'templateName',
      headerName: t('remoteConfig.templateName'),
      flex: 1,
      minWidth: 200
    },
    {
      field: 'templateType',
      headerName: t('remoteConfig.type'),
      width: 120,
      renderCell: (params) => (
        <Chip
          label={params.value}
          color={getTypeColor(params.value)}
          size="small"
          variant="outlined"
        />
      )
    },
    {
      field: 'status',
      headerName: t('remoteConfig.status'),
      width: 120,
      renderCell: (params) => (
        <Chip
          label={t(`remoteConfig.status.${params.value}`)}
          color={getStatusColor(params.value)}
          size="small"
        />
      )
    },
    {
      field: 'version',
      headerName: t('remoteConfig.version'),
      width: 100,
      renderCell: (params) => `v${params.value}`
    },
    {
      field: 'updatedAt',
      headerName: t('remoteConfig.lastUpdated'),
      width: 180,
      renderCell: (params) => new Date(params.value).toLocaleString()
    },
    {
      field: 'updatedBy',
      headerName: t('remoteConfig.updatedBy'),
      width: 200
    },
    {
      field: 'actions',
      type: 'actions',
      headerName: t('common.actions'),
      width: 150,
      getActions: (params) => [
        <GridActionsCellItem
          icon={<ViewIcon />}
          label={t('common.view')}
          onClick={() => console.log('View', params.id)}
        />,
        <GridActionsCellItem
          icon={<EditIcon />}
          label={t('common.edit')}
          onClick={() => console.log('Edit', params.id)}
        />,
        <GridActionsCellItem
          icon={<ArchiveIcon />}
          label={t('common.archive')}
          onClick={() => console.log('Archive', params.id)}
        />
      ]
    }
  ];

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          {t('remoteConfig.title')}
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {/* Environment Selector - Always visible at top */}
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>{t('remoteConfig.environment')}</InputLabel>
            <Select
              value={selectedEnvironment}
              label={t('remoteConfig.environment')}
              onChange={(e) => setSelectedEnvironment(e.target.value as number)}
            >
              {environments.map((env) => (
                <MenuItem key={env.id} value={env.id}>
                  {env.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          <Tooltip title={t('common.refresh')}>
            <IconButton onClick={handleRefresh} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => console.log('Create new template')}
          >
            {t('remoteConfig.createTemplate')}
          </Button>
          
          <Tooltip title={t('remoteConfig.environmentSettings')}>
            <IconButton onClick={() => console.log('Environment settings')}>
              <SettingsIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Environment Info */}
      <Alert severity="info" sx={{ mb: 3 }}>
        {t('remoteConfig.currentEnvironment')}: <strong>
          {environments.find(env => env.id === selectedEnvironment)?.name}
        </strong>
        {' - '}
        {environments.find(env => env.id === selectedEnvironment)?.description}
      </Alert>

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12 , sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                {t('remoteConfig.stats.totalTemplates')}
              </Typography>
              <Typography variant="h4">
                {templates.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12 , sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                {t('remoteConfig.stats.published')}
              </Typography>
              <Typography variant="h4" color="success.main">
                {templates.filter(t => t.status === 'published').length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12 , sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                {t('remoteConfig.stats.staged')}
              </Typography>
              <Typography variant="h4" color="warning.main">
                {templates.filter(t => t.status === 'staged').length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12 , sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                {t('remoteConfig.stats.drafts')}
              </Typography>
              <Typography variant="h4" color="info.main">
                {templates.filter(t => t.status === 'draft').length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Templates Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {t('remoteConfig.templates')}
          </Typography>
          <DataGrid
            rows={templates}
            columns={columns}
            loading={loading}
            autoHeight
            disableRowSelectionOnClick
            pageSizeOptions={[10, 25, 50]}
            initialState={{
              pagination: {
                paginationModel: { pageSize: 10 }
              }
            }}
          />
        </CardContent>
      </Card>
    </Box>
  );
};

export default RemoteConfigDashboard;
