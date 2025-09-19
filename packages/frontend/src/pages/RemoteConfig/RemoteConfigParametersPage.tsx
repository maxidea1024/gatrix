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
  Container,
  Paper,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Drawer,
  Fade,
  TextField,
  Switch,
  FormControlLabel,
  Tabs,
  Tab,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  RadioGroup,
  Radio,
  Snackbar
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Close as CloseIcon,
  Settings as SettingsIcon,
  Campaign as CampaignIcon,
  Code as CodeIcon,
  Tune as TuneIcon,
  Science as VariantsIcon,
  History as HistoryIcon,
  Restore as RestoreIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSearchParams, useNavigate } from 'react-router-dom';
import SimplePagination from '../../components/common/SimplePagination';
import ReactDiffViewer from 'react-diff-viewer-continued';
import remoteConfigService, { DeploymentHistoryItem, DeploymentChange } from '../../services/remoteConfigService';

// Side Panel Component for Firebase-style forms
interface SidePanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

const SidePanel: React.FC<SidePanelProps> = ({ open, onClose, title, children, actions }) => {
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      sx={{
        zIndex: 1300,
        '& .MuiDrawer-paper': {
          width: { xs: '100%', sm: 480, md: 600 },
          height: '100vh',
          display: 'flex',
          flexDirection: 'column'
        }
      }}
      ModalProps={{
        keepMounted: false
      }}
    >
      {/* Header */}
      <Box sx={{
        p: 3,
        borderBottom: 1,
        borderColor: 'divider',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'background.paper',
        position: 'sticky',
        top: 0,
        zIndex: 1
      }}>
        <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
        <IconButton
          onClick={onClose}
          size="small"
          sx={{
            '&:hover': {
              backgroundColor: 'action.hover'
            }
          }}
        >
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Content */}
      <Box sx={{
        flex: 1,
        p: 3,
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 3
      }}>
        {children}
      </Box>

      {/* Actions */}
      {actions && (
        <Box sx={{
          p: 2,
          borderTop: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          display: 'flex',
          gap: 1,
          justifyContent: 'flex-end'
        }}>
          {actions}
        </Box>
      )}
    </Drawer>
  );
};

// Types
interface Environment {
  id: number;
  environmentName: string;
  displayName: string;
  description: string;
}

interface Config {
  id: string;
  key: string;
  type: 'string' | 'number' | 'boolean' | 'json';
  defaultValue: any;
  description: string;
  variants?: ConfigVariant[];
  campaigns?: string[];
  contextFields?: string[];
  updatedAt: string;
  updatedBy: string;
}

interface ConfigVariant {
  name: string;
  value: any;
  weight: number;
  description?: string;
}

interface Campaign {
  id: string;
  name: string;
  configKey: string;
  overrideValue: any;
  startDate: string;
  endDate: string;
  isActive: boolean;
  targetSegments?: string[];
  trafficPercentage: number;
}

interface ContextField {
  id: string;
  name: string;
  type: 'string' | 'number' | 'boolean';
  description: string;
  possibleValues?: string[];
}

interface Segment {
  id: string;
  name: string;
  displayName: string;
  description: string;
  conditions: SegmentCondition[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SegmentCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'in' | 'not_in';
  value: any;
}

interface Variant {
  id: string;
  parameterKey: string;
  variantName: string;
  value: any;
  weight: number;
  description: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Use types from service
type DeploymentHistory = DeploymentHistoryItem;

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

// Version Management Context
interface PendingChange {
  id: string;
  type: 'parameter' | 'campaign' | 'segment' | 'context_field' | 'variant';
  action: 'created' | 'updated' | 'deleted';
  itemName: string;
  description: string;
  timestamp: string;
}

interface VersionContextType {
  hasChanges: boolean;
  pendingChanges: number;
  changesList: PendingChange[];
  markAsChanged: (change: PendingChange) => void;
  discardChanges: () => void;
  deployChanges: () => void;
  showDiscardDialog: () => void;
  showDeployDialog: () => void;
}

const VersionContext = createContext<VersionContextType>({
  hasChanges: false,
  pendingChanges: 0,
  changesList: [],
  markAsChanged: () => {},
  discardChanges: () => {},
  deployChanges: () => {},
  showDiscardDialog: () => {},
  showDeployDialog: () => {}
});

// Version Provider
export const VersionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [hasChanges, setHasChanges] = useState(false);
  const [pendingChanges, setPendingChanges] = useState(0);
  const [changesList, setChangesList] = useState<PendingChange[]>([]);
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const [deployDialogOpen, setDeployDialogOpen] = useState(false);

  const markAsChanged = (change: PendingChange) => {
    setHasChanges(true);
    setPendingChanges(prev => prev + 1);
    setChangesList(prev => [...prev, change]);
  };

  const discardChanges = async () => {
    try {
      // In template system, discard means reload from latest template
      setHasChanges(false);
      setPendingChanges(0);
      setChangesList([]);
      setDiscardDialogOpen(false);

      // Reload the page to get fresh data from server
      window.location.reload();
    } catch (error) {
      console.error('Failed to discard changes:', error);
      alert('Failed to discard changes. Please try again.');
    }
  };

  const deployChanges = async () => {
    try {
      // In template system, deploy creates a new template version
      await remoteConfigService.deployChanges({
        changeDescription: `Deploy ${changesList.length} changes`
      });

      setHasChanges(false);
      setPendingChanges(0);
      setChangesList([]);
      setDeployDialogOpen(false);

      // Show success message
      console.log('Template version deployed successfully');

      // Optionally reload to show new version in history
      // window.location.reload();
    } catch (error) {
      console.error('Failed to deploy changes:', error);
      // Show error message
      alert('Failed to deploy changes. Please try again.');
    }
  };

  const showDiscardDialog = () => {
    setDiscardDialogOpen(true);
  };

  const showDeployDialog = () => {
    setDeployDialogOpen(true);
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'created': return 'success';
      case 'updated': return 'info';
      case 'deleted': return 'error';
      default: return 'default';
    }
  };

  return (
    <VersionContext.Provider value={{
      hasChanges,
      pendingChanges,
      changesList,
      markAsChanged,
      discardChanges,
      deployChanges,
      showDiscardDialog,
      showDeployDialog
    }}>
      {children}

      {/* Discard Changes Confirmation Dialog */}
      <Dialog open={discardDialogOpen} onClose={() => setDiscardDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <DeleteIcon color="error" />
            Discard Changes ({pendingChanges})
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            Are you sure you want to discard all pending changes? This action cannot be undone.
          </Typography>

          {changesList.length > 0 && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Changes to be discarded:
              </Typography>

              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Type</TableCell>
                      <TableCell>Action</TableCell>
                      <TableCell>Item</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell>Time</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {changesList.map((change) => (
                      <TableRow key={change.id}>
                        <TableCell>
                          <Chip
                            label={change.type}
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={change.action}
                            size="small"
                            color={getActionColor(change.action) as any}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                            {change.itemName}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {change.description}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {new Date(change.timestamp).toLocaleTimeString()}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDiscardDialogOpen(false)}>
            Cancel
          </Button>
          <Button onClick={discardChanges} color="error" variant="contained">
            Discard All Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Deploy Changes Confirmation Dialog */}
      <Dialog open={deployDialogOpen} onClose={() => setDeployDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CampaignIcon color="primary" />
            Deploy Changes ({pendingChanges})
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            Are you sure you want to deploy all pending changes to the current environment?
          </Typography>

          {changesList.length > 0 && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Changes to be deployed:
              </Typography>

              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Type</TableCell>
                      <TableCell>Action</TableCell>
                      <TableCell>Item</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell>Time</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {changesList.map((change) => (
                      <TableRow key={change.id}>
                        <TableCell>
                          <Chip
                            label={change.type}
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={change.action}
                            size="small"
                            color={getActionColor(change.action) as any}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                            {change.itemName}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {change.description}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {new Date(change.timestamp).toLocaleTimeString()}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeployDialogOpen(false)}>
            Cancel
          </Button>
          <Button onClick={deployChanges} color="primary" variant="contained">
            Deploy All Changes
          </Button>
        </DialogActions>
      </Dialog>
    </VersionContext.Provider>
  );
};

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
          description: 'Development environment'
        },
        {
          id: 2,
          environmentName: 'staging',
          displayName: 'Staging',
          description: 'Staging environment'
        },
        {
          id: 3,
          environmentName: 'production',
          displayName: 'Production',
          description: 'Production environment'
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

// Simple Environment Selector with Version Management
const EnvironmentSelector: React.FC = () => {
  const { t } = useTranslation();
  const { currentEnvironment, environments, switchEnvironment, isLoading } = useContext(EnvironmentContext);
  const { hasChanges, pendingChanges, showDiscardDialog, showDeployDialog } = useContext(VersionContext);

  return (
    <Paper
      elevation={1}
      sx={{
        borderBottom: 1,
        borderColor: 'divider',
        mb: 3,
        position: 'sticky',
        top: 0,
        zIndex: 1200, // Higher than Drawer's default z-index (1300) but below modal backdrop
        backgroundColor: 'background.paper'
      }}
    >
      <Box sx={{ px: 3, py: 2 }}>
        <Grid container alignItems="center" justifyContent="space-between">
          <Grid item>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="h5" component="h1" sx={{ fontWeight: 600 }}>
                {t('remoteConfig.title', 'Remote Config')}
              </Typography>
              {hasChanges && (
                <Chip
                  label={t('remoteConfig.pendingChanges', `${pendingChanges} pending changes`)}
                  color="warning"
                  size="small"
                  variant="outlined"
                />
              )}
            </Box>
          </Grid>
          <Grid item>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {hasChanges && (
                <>
                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    onClick={showDiscardDialog}
                  >
                    {t('remoteConfig.discardChanges', 'Discard Changes')} ({pendingChanges})
                  </Button>
                  <Button
                    variant="contained"
                    color="primary"
                    size="small"
                    onClick={showDeployDialog}
                  >
                    {t('remoteConfig.deployChanges', 'Deploy Changes')} ({pendingChanges})
                  </Button>
                </>
              )}
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>{t('remoteConfig.environment', 'Environment')}</InputLabel>
                <Select
                  value={currentEnvironment?.id || ''}
                  onChange={(e) => switchEnvironment(Number(e.target.value))}
                  disabled={isLoading}
                  label={t('remoteConfig.environment', 'Environment')}
                  MenuProps={{
                    PaperProps: {
                      style: {
                        zIndex: 9999
                      }
                    }
                  }}
                >
                  {environments.map((env) => (
                    <MenuItem key={env.id} value={env.id}>
                      {env.displayName}
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

// Configs Management Component
const ConfigsManagement: React.FC = () => {
  const { t } = useTranslation();
  const { currentEnvironment } = useContext(EnvironmentContext);
  const { markAsChanged } = useContext(VersionContext);
  const [configs, setConfigs] = useState<Config[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [selectedConfig, setSelectedConfig] = useState<Config | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<'create' | 'edit'>('create');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [configToDelete, setConfigToDelete] = useState<Config | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    key: '',
    type: 'string' as 'string' | 'number' | 'boolean' | 'json',
    defaultValue: '',
    description: ''
  });

  useEffect(() => {
    if (currentEnvironment) {
      loadConfigs();
    }
  }, [currentEnvironment]);

  const loadConfigs = async () => {
    try {
      setLoading(true);
      // Load actual template data from API
      const templateData = await remoteConfigService.getTemplate();

      // Convert template parameters to Config format
      const configsArray: Config[] = Object.entries(templateData.parameters || {}).map(([key, param]: [string, any]) => ({
        id: param.id || key,
        key: key,
        type: param.type || 'string',
        defaultValue: param.defaultValue,
        description: param.description || '',
        updatedAt: param.updatedAt || new Date().toISOString(),
        updatedBy: param.updatedBy || 'system'
      }));

      setConfigs(configsArray);
    } catch (error) {
      console.error('Failed to load configs:', error);
      // Fallback to empty array if template doesn't exist yet
      setConfigs([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddConfig = () => {
    setSelectedConfig(null);
    setDialogType('create');
    setFormData({
      key: '',
      type: 'string',
      defaultValue: '',
      description: ''
    });
    setDialogOpen(true);
  };

  const handleEditConfig = (config: Config) => {
    setSelectedConfig(config);
    setDialogType('edit');
    setFormData({
      key: config.key,
      type: config.type,
      defaultValue: typeof config.defaultValue === 'object'
        ? JSON.stringify(config.defaultValue, null, 2)
        : String(config.defaultValue),
      description: config.description
    });
    setDialogOpen(true);
  };

  const handleDeleteConfig = (config: Config) => {
    setConfigToDelete(config);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!configToDelete) return;

    try {
      // Call actual API to delete parameter
      await remoteConfigService.deleteParameter(configToDelete.key);

      setConfigs(prev => prev.filter(c => c.id !== configToDelete.id));
      setSnackbarMessage(t('remoteConfig.parameterDeleted', 'Parameter deleted successfully'));
      setSnackbarOpen(true);
      markAsChanged({
        id: Date.now().toString(),
        type: 'parameter',
        action: 'deleted',
        itemName: configToDelete.key,
        description: `Deleted parameter "${configToDelete.key}"`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to delete config:', error);
      setSnackbarMessage(t('common.error', 'An error occurred'));
      setSnackbarOpen(true);
    } finally {
      setDeleteDialogOpen(false);
      setConfigToDelete(null);
    }
  };

  const handleSaveConfig = async () => {
    try {
      let processedValue: any = formData.defaultValue;

      // Process value based on type
      switch (formData.type) {
        case 'number':
          processedValue = Number(formData.defaultValue);
          if (isNaN(processedValue)) {
            setSnackbarMessage(t('remoteConfig.invalidNumber', 'Invalid number value'));
            setSnackbarOpen(true);
            return;
          }
          break;
        case 'boolean':
          processedValue = formData.defaultValue === 'true';
          break;
        case 'json':
          try {
            processedValue = JSON.parse(formData.defaultValue);
          } catch (e) {
            setSnackbarMessage(t('remoteConfig.invalidJson', 'Invalid JSON value'));
            setSnackbarOpen(true);
            return;
          }
          break;
        default:
          processedValue = formData.defaultValue;
      }

      const newConfig: Config = {
        id: selectedConfig?.id || Date.now().toString(),
        key: formData.key,
        type: formData.type,
        defaultValue: processedValue,
        description: formData.description,
        updatedAt: new Date().toISOString(),
        updatedBy: 'current.user@example.com' // TODO: Get from auth context
      };

      if (dialogType === 'create') {
        // Check for duplicate key
        if (configs.some(c => c.key === formData.key)) {
          setSnackbarMessage(t('remoteConfig.duplicateKey', 'Parameter key already exists'));
          setSnackbarOpen(true);
          return;
        }

        // Call actual API to create parameter
        const savedParameter = await remoteConfigService.addParameter(
          formData.key,
          formData.type,
          processedValue,
          formData.description
        );

        setConfigs(prev => [...prev, { ...newConfig, id: savedParameter.id }]);
        setSnackbarMessage(t('remoteConfig.parameterCreated', 'Parameter created successfully'));
        markAsChanged({
          id: Date.now().toString(),
          type: 'parameter',
          action: 'created',
          itemName: formData.key,
          description: `Created parameter "${formData.key}" with type ${formData.type}`,
          timestamp: new Date().toISOString()
        });
      } else {
        // Call actual API to update parameter
        await remoteConfigService.updateParameter(
          formData.key,
          formData.type,
          processedValue,
          formData.description
        );

        setConfigs(prev => prev.map(c => c.id === selectedConfig?.id ? newConfig : c));
        setSnackbarMessage(t('remoteConfig.parameterUpdated', 'Parameter updated successfully'));
        markAsChanged({
          id: Date.now().toString(),
          type: 'parameter',
          action: 'updated',
          itemName: formData.key,
          description: `Updated parameter "${formData.key}"`,
          timestamp: new Date().toISOString()
        });
      }

      setSnackbarOpen(true);
      setDialogOpen(false);
    } catch (error) {
      console.error('Failed to save config:', error);
      setSnackbarMessage(t('common.error', 'An error occurred'));
      setSnackbarOpen(true);
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'boolean': return 'success';
      case 'number': return 'info';
      case 'string': return 'primary';
      case 'json': return 'warning';
      default: return 'default';
    }
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const renderValueInput = () => {
    switch (formData.type) {
      case 'boolean':
        return (
          <FormControl component="fieldset" fullWidth>
            <RadioGroup
              value={formData.defaultValue}
              onChange={(e) => setFormData(prev => ({ ...prev, defaultValue: e.target.value }))}
              row
            >
              <FormControlLabel value="true" control={<Radio />} label="True" />
              <FormControlLabel value="false" control={<Radio />} label="False" />
            </RadioGroup>
          </FormControl>
        );
      case 'json':
        return (
          <TextField
            fullWidth
            multiline
            rows={6}
            value={formData.defaultValue}
            onChange={(e) => setFormData(prev => ({ ...prev, defaultValue: e.target.value }))}
            placeholder='{"key": "value"}'
            sx={{ fontFamily: 'monospace' }}
          />
        );
      default:
        return (
          <TextField
            fullWidth
            value={formData.defaultValue}
            onChange={(e) => setFormData(prev => ({ ...prev, defaultValue: e.target.value }))}
            type={formData.type === 'number' ? 'number' : 'text'}
            placeholder={formData.type === 'number' ? '0' : 'Enter value'}
          />
        );
    }
  };

  return (
    <>
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" component="h2">
            {t('remoteConfig.parameters', 'Parameters')}
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddConfig}
            size="small"
          >
            {t('remoteConfig.addParameter', 'Add Parameter')}
          </Button>
        </Box>

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('remoteConfig.parameterKey', 'Parameter Key')}</TableCell>
                <TableCell>{t('remoteConfig.type', 'Type')}</TableCell>
                <TableCell>{t('remoteConfig.defaultValue', 'Default Value')}</TableCell>
                <TableCell>{t('remoteConfig.description', 'Description')}</TableCell>
                <TableCell>{t('remoteConfig.features', 'Features')}</TableCell>
                <TableCell>{t('remoteConfig.lastUpdated', 'Last Updated')}</TableCell>
                <TableCell>{t('common.actions', 'Actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {configs
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((config) => (
                <TableRow key={config.id}>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                      {config.key}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={config.type}
                      size="small"
                      color={getTypeColor(config.type) as any}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                      {typeof config.defaultValue === 'object'
                        ? JSON.stringify(config.defaultValue)
                        : String(config.defaultValue)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {config.description}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {config.variants && (
                        <Chip
                          label={`${config.variants.length} variants`}
                          size="small"
                          icon={<VariantsIcon />}
                          variant="outlined"
                          color="secondary"
                        />
                      )}
                      {config.campaigns && config.campaigns.length > 0 && (
                        <Chip
                          label={`${config.campaigns.length} campaigns`}
                          size="small"
                          icon={<CampaignIcon />}
                          variant="outlined"
                          color="warning"
                        />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {new Date(config.updatedAt).toLocaleDateString()}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <IconButton
                        size="small"
                        onClick={() => handleEditConfig(config)}
                        color="primary"
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteConfig(config)}
                        color="error"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <SimplePagination
          count={configs.length}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[10, 25, 50, 100]}
        />
      </CardContent>
    </Card>

    {/* Create/Edit Parameter Side Panel */}
    <SidePanel
      open={dialogOpen}
      onClose={() => setDialogOpen(false)}
      title={dialogType === 'create'
        ? t('remoteConfig.addParameter', 'Add Parameter')
        : t('remoteConfig.editParameter', 'Edit Parameter')
      }
      actions={
        <>
          <Button onClick={() => setDialogOpen(false)}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            onClick={handleSaveConfig}
            variant="contained"
            disabled={!formData.key || !formData.description}
          >
            {dialogType === 'create' ? t('common.create', 'Create') : t('common.update', 'Update')}
          </Button>
        </>
      }
    >
      <TextField
        label={t('remoteConfig.parameterKey', 'Parameter Key')}
        value={formData.key}
        onChange={(e) => setFormData(prev => ({ ...prev, key: e.target.value }))}
        fullWidth
        required
        disabled={dialogType === 'edit'}
        placeholder="feature_flag"
        sx={{ fontFamily: 'monospace' }}
      />

      <FormControl fullWidth required>
        <InputLabel>{t('remoteConfig.type', 'Type')}</InputLabel>
        <Select
          value={formData.type}
          onChange={(e) => setFormData(prev => ({
            ...prev,
            type: e.target.value as any,
            defaultValue: e.target.value === 'boolean' ? 'false' : ''
          }))}
          label={t('remoteConfig.type', 'Type')}
          MenuProps={{
            PaperProps: {
              style: {
                zIndex: 9999
              }
            }
          }}
        >
          <MenuItem value="string">String</MenuItem>
          <MenuItem value="number">Number</MenuItem>
          <MenuItem value="boolean">Boolean</MenuItem>
          <MenuItem value="json">JSON</MenuItem>
        </Select>
      </FormControl>

      <Box>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          {t('remoteConfig.defaultValue', 'Default Value')}
        </Typography>
        {renderValueInput()}
      </Box>

      <TextField
        label={t('remoteConfig.description', 'Description')}
        value={formData.description}
        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
        fullWidth
        multiline
        rows={2}
        placeholder="Description of this parameter"
      />
    </SidePanel>

    {/* Delete Confirmation Dialog */}
    <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
      <DialogTitle>{t('remoteConfig.deleteParameter', 'Delete Parameter')}</DialogTitle>
      <DialogContent>
        <Typography>
          {t('remoteConfig.deleteParameterConfirm', 'Are you sure you want to delete parameter')} "{configToDelete?.key}"?
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {t('remoteConfig.deleteParameterWarning', 'This action cannot be undone.')}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setDeleteDialogOpen(false)}>
          {t('common.cancel', 'Cancel')}
        </Button>
        <Button onClick={confirmDelete} color="error" variant="contained">
          {t('common.delete', 'Delete')}
        </Button>
      </DialogActions>
    </Dialog>

    {/* Snackbar for notifications */}
    <Snackbar
      open={snackbarOpen}
      autoHideDuration={4000}
      onClose={() => setSnackbarOpen(false)}
      message={snackbarMessage}
    />
  </>
  );
};

// Campaigns Management Component
const CampaignsManagement: React.FC = () => {
  const { t } = useTranslation();
  const { currentEnvironment } = useContext(EnvironmentContext);
  const { markAsChanged } = useContext(VersionContext);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<'create' | 'edit'>('create');
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [campaignToDelete, setCampaignToDelete] = useState<Campaign | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    configKey: '',
    overrideValue: '',
    startDate: '',
    endDate: '',
    isActive: true,
    trafficPercentage: 100,
    targetSegments: [] as string[]
  });

  useEffect(() => {
    if (currentEnvironment) {
      loadCampaigns();
    }
  }, [currentEnvironment]);

  const loadCampaigns = async () => {
    try {
      setLoading(true);
      // TODO: Replace with actual API call
      const mockCampaigns: Campaign[] = [
        {
          id: '1',
          name: 'holiday_promotion',
          configKey: 'welcome_message',
          overrideValue: 'Happy Holidays! Welcome to our special promotion!',
          startDate: '2024-12-20T00:00:00Z',
          endDate: '2024-12-31T23:59:59Z',
          isActive: true,
          targetSegments: ['premium_users'],
          trafficPercentage: 100
        },
        {
          id: '2',
          name: 'beta_feature_test',
          configKey: 'enable_new_ui',
          overrideValue: true,
          startDate: '2024-01-15T00:00:00Z',
          endDate: '2024-02-15T23:59:59Z',
          isActive: false,
          targetSegments: ['beta_users'],
          trafficPercentage: 50
        }
      ];
      setCampaigns(mockCampaigns);
    } catch (error) {
      console.error('Failed to load campaigns:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCampaign = () => {
    setSelectedCampaign(null);
    setDialogType('create');
    setFormData({
      name: '',
      configKey: '',
      overrideValue: '',
      startDate: '',
      endDate: '',
      isActive: true,
      trafficPercentage: 100,
      targetSegments: []
    });
    setDialogOpen(true);
  };

  const handleEditCampaign = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setDialogType('edit');
    setFormData({
      name: campaign.name,
      configKey: campaign.configKey,
      overrideValue: typeof campaign.overrideValue === 'object'
        ? JSON.stringify(campaign.overrideValue, null, 2)
        : String(campaign.overrideValue),
      startDate: campaign.startDate.split('T')[0],
      endDate: campaign.endDate.split('T')[0],
      isActive: campaign.isActive,
      trafficPercentage: campaign.trafficPercentage,
      targetSegments: campaign.targetSegments || []
    });
    setDialogOpen(true);
  };

  const handleDeleteCampaign = (campaign: Campaign) => {
    setCampaignToDelete(campaign);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteCampaign = async () => {
    if (!campaignToDelete) return;

    try {
      setCampaigns(prev => prev.filter(c => c.id !== campaignToDelete.id));
      setSnackbarMessage(t('remoteConfig.campaignDeleted', 'Campaign deleted successfully'));
      setSnackbarOpen(true);
      markAsChanged({
        id: Date.now().toString(),
        type: 'campaign',
        action: 'deleted',
        itemName: campaignToDelete.name,
        description: `Deleted campaign "${campaignToDelete.name}"`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to delete campaign:', error);
      setSnackbarMessage(t('common.error', 'An error occurred'));
      setSnackbarOpen(true);
    } finally {
      setDeleteDialogOpen(false);
      setCampaignToDelete(null);
    }
  };

  const handleSaveCampaign = async () => {
    try {
      let processedValue: any = formData.overrideValue;

      // Try to parse as JSON first, fallback to string
      try {
        processedValue = JSON.parse(formData.overrideValue);
      } catch (e) {
        // If not valid JSON, treat as string/number/boolean
        if (formData.overrideValue === 'true') processedValue = true;
        else if (formData.overrideValue === 'false') processedValue = false;
        else if (!isNaN(Number(formData.overrideValue))) processedValue = Number(formData.overrideValue);
        else processedValue = formData.overrideValue;
      }

      const newCampaign: Campaign = {
        id: selectedCampaign?.id || Date.now().toString(),
        name: formData.name,
        configKey: formData.configKey,
        overrideValue: processedValue,
        startDate: formData.startDate + 'T00:00:00Z',
        endDate: formData.endDate + 'T23:59:59Z',
        isActive: formData.isActive,
        trafficPercentage: formData.trafficPercentage,
        targetSegments: formData.targetSegments
      };

      if (dialogType === 'create') {
        setCampaigns(prev => [...prev, newCampaign]);
        setSnackbarMessage(t('remoteConfig.campaignCreated', 'Campaign created successfully'));
        markAsChanged({
          id: Date.now().toString(),
          type: 'campaign',
          action: 'created',
          itemName: formData.name,
          description: `Created campaign "${formData.name}" for parameter "${formData.targetParameter}"`,
          timestamp: new Date().toISOString()
        });
      } else {
        setCampaigns(prev => prev.map(c => c.id === selectedCampaign?.id ? newCampaign : c));
        setSnackbarMessage(t('remoteConfig.campaignUpdated', 'Campaign updated successfully'));
        markAsChanged({
          id: Date.now().toString(),
          type: 'campaign',
          action: 'updated',
          itemName: formData.name,
          description: `Updated campaign "${formData.name}"`,
          timestamp: new Date().toISOString()
        });
      }

      setSnackbarOpen(true);
      setDialogOpen(false);
    } catch (error) {
      console.error('Failed to save campaign:', error);
      setSnackbarMessage(t('common.error', 'An error occurred'));
      setSnackbarOpen(true);
    }
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  return (
    <>
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" component="h2">
            {t('remoteConfig.campaigns', 'Campaigns')}
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddCampaign}
            size="small"
          >
            {t('remoteConfig.addCampaign', 'Add Campaign')}
          </Button>
        </Box>

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('remoteConfig.campaignName', 'Campaign Name')}</TableCell>
                <TableCell>{t('remoteConfig.targetParameter', 'Target Parameter')}</TableCell>
                <TableCell>{t('remoteConfig.overrideValue', 'Override Value')}</TableCell>
                <TableCell>{t('remoteConfig.period', 'Period')}</TableCell>
                <TableCell>{t('remoteConfig.traffic', 'Traffic %')}</TableCell>
                <TableCell>{t('remoteConfig.status', 'Status')}</TableCell>
                <TableCell>{t('common.actions', 'Actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {campaigns
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((campaign) => (
                <TableRow key={campaign.id}>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {campaign.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                      {campaign.configKey}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                      {typeof campaign.overrideValue === 'object'
                        ? JSON.stringify(campaign.overrideValue)
                        : String(campaign.overrideValue)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {new Date(campaign.startDate).toLocaleDateString()} - {new Date(campaign.endDate).toLocaleDateString()}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {campaign.trafficPercentage}%
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={campaign.isActive ? t('common.active', 'Active') : t('common.inactive', 'Inactive')}
                      size="small"
                      color={campaign.isActive ? 'success' : 'default'}
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <IconButton
                        size="small"
                        onClick={() => handleEditCampaign(campaign)}
                        color="primary"
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteCampaign(campaign)}
                        color="error"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <SimplePagination
          count={campaigns.length}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[10, 25, 50, 100]}
        />
      </CardContent>
    </Card>

    {/* Create/Edit Campaign Side Panel */}
    <SidePanel
      open={dialogOpen}
      onClose={() => setDialogOpen(false)}
      title={dialogType === 'create'
        ? t('remoteConfig.addCampaign', 'Add Campaign')
        : t('remoteConfig.editCampaign', 'Edit Campaign')
      }
      actions={
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          <Button onClick={() => setDialogOpen(false)}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            onClick={handleSaveCampaign}
            variant="contained"
            disabled={!formData.name || !formData.configKey || !formData.overrideValue || !formData.startDate || !formData.endDate}
          >
            {dialogType === 'create' ? t('common.create', 'Create') : t('common.update', 'Update')}
          </Button>
        </Box>
      }
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <TextField
          label={t('remoteConfig.campaignName', 'Campaign Name')}
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          fullWidth
          required
          placeholder="holiday_promotion"
        />

        <TextField
          label={t('remoteConfig.targetParameter', 'Target Parameter')}
          value={formData.configKey}
          onChange={(e) => setFormData(prev => ({ ...prev, configKey: e.target.value }))}
          fullWidth
          required
          placeholder="welcome_message"
          sx={{ fontFamily: 'monospace' }}
        />

        <TextField
          label={t('remoteConfig.overrideValue', 'Override Value')}
          value={formData.overrideValue}
          onChange={(e) => setFormData(prev => ({ ...prev, overrideValue: e.target.value }))}
          fullWidth
          required
          multiline
          rows={3}
          placeholder="New value for this campaign"
        />

        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField
            label={t('remoteConfig.startDate', 'Start Date')}
            type="date"
            value={formData.startDate}
            onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
            fullWidth
            required
            InputLabelProps={{ shrink: true }}
          />

          <TextField
            label={t('remoteConfig.endDate', 'End Date')}
            type="date"
            value={formData.endDate}
            onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
            fullWidth
            required
            InputLabelProps={{ shrink: true }}
          />
        </Box>

        <TextField
          label={t('remoteConfig.trafficPercentage', 'Traffic Percentage')}
          type="number"
          value={formData.trafficPercentage}
          onChange={(e) => setFormData(prev => ({ ...prev, trafficPercentage: parseInt(e.target.value) }))}
          fullWidth
          inputProps={{ min: 1, max: 100 }}
        />

        <FormControlLabel
          control={
            <Switch
              checked={formData.isActive}
              onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
            />
          }
          label={t('remoteConfig.isActive', 'Is Active')}
        />
      </Box>
    </SidePanel>

    {/* Delete Confirmation Dialog */}
    <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
      <DialogTitle>{t('remoteConfig.deleteCampaign', 'Delete Campaign')}</DialogTitle>
      <DialogContent>
        <Typography>
          {t('remoteConfig.deleteCampaignConfirm', 'Are you sure you want to delete campaign')} "{campaignToDelete?.name}"?
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {t('remoteConfig.deleteCampaignWarning', 'This action cannot be undone.')}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setDeleteDialogOpen(false)}>
          {t('common.cancel', 'Cancel')}
        </Button>
        <Button onClick={confirmDeleteCampaign} color="error" variant="contained">
          {t('common.delete', 'Delete')}
        </Button>
      </DialogActions>
    </Dialog>

    {/* Snackbar for notifications */}
    <Snackbar
      open={snackbarOpen}
      autoHideDuration={4000}
      onClose={() => setSnackbarOpen(false)}
      message={snackbarMessage}
    />
  </>
  );
};

// Context Fields Management Component
const ContextFieldsManagement: React.FC = () => {
  const { t } = useTranslation();
  const { currentEnvironment } = useContext(EnvironmentContext);
  const { markAsChanged } = useContext(VersionContext);
  const [contextFields, setContextFields] = useState<ContextField[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<'create' | 'edit'>('create');
  const [selectedField, setSelectedField] = useState<ContextField | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fieldToDelete, setFieldToDelete] = useState<ContextField | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    type: 'string' as 'string' | 'number' | 'boolean',
    description: '',
    possibleValues: [] as string[]
  });
  const [newValue, setNewValue] = useState('');

  useEffect(() => {
    if (currentEnvironment) {
      loadContextFields();
    }
  }, [currentEnvironment]);

  const loadContextFields = async () => {
    try {
      setLoading(true);
      // TODO: Replace with actual API call
      const mockContextFields: ContextField[] = [
        {
          id: '1',
          name: 'userType',
          type: 'string',
          description: 'Type of user (free, premium, enterprise)',
          possibleValues: ['free', 'premium', 'enterprise']
        },
        {
          id: '2',
          name: 'platform',
          type: 'string',
          description: 'Platform type (web, mobile, desktop)',
          possibleValues: ['web', 'mobile', 'desktop']
        },
        {
          id: '3',
          name: 'appVersion',
          type: 'string',
          description: 'Application version number'
        },
        {
          id: '4',
          name: 'isDebugMode',
          type: 'boolean',
          description: 'Whether debug mode is enabled'
        }
      ];
      setContextFields(mockContextFields);
    } catch (error) {
      console.error('Failed to load context fields:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddContextField = () => {
    setSelectedField(null);
    setDialogType('create');
    setFormData({
      name: '',
      type: 'string',
      description: '',
      possibleValues: []
    });
    setNewValue('');
    setDialogOpen(true);
  };

  const handleEditContextField = (field: ContextField) => {
    setSelectedField(field);
    setDialogType('edit');
    setFormData({
      name: field.name,
      type: field.type,
      description: field.description,
      possibleValues: field.possibleValues || []
    });
    setNewValue('');
    setDialogOpen(true);
  };

  const handleDeleteContextField = (field: ContextField) => {
    setFieldToDelete(field);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteField = async () => {
    if (!fieldToDelete) return;

    try {
      setContextFields(prev => prev.filter(f => f.id !== fieldToDelete.id));
      setSnackbarMessage(t('remoteConfig.contextFieldDeleted', 'Context field deleted successfully'));
      setSnackbarOpen(true);
      markAsChanged({
        id: Date.now().toString(),
        type: 'context_field',
        action: 'deleted',
        itemName: fieldToDelete.name,
        description: `Deleted context field "${fieldToDelete.name}"`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to delete context field:', error);
      setSnackbarMessage(t('common.error', 'An error occurred'));
      setSnackbarOpen(true);
    } finally {
      setDeleteDialogOpen(false);
      setFieldToDelete(null);
    }
  };

  const handleSaveContextField = async () => {
    try {
      const newField: ContextField = {
        id: selectedField?.id || Date.now().toString(),
        name: formData.name,
        type: formData.type,
        description: formData.description,
        possibleValues: formData.possibleValues.length > 0 ? formData.possibleValues : undefined
      };

      if (dialogType === 'create') {
        // Check for duplicate name
        if (contextFields.some(f => f.name === formData.name)) {
          setSnackbarMessage(t('remoteConfig.duplicateFieldName', 'Context field name already exists'));
          setSnackbarOpen(true);
          return;
        }
        setContextFields(prev => [...prev, newField]);
        setSnackbarMessage(t('remoteConfig.contextFieldCreated', 'Context field created successfully'));
        markAsChanged({
          id: Date.now().toString(),
          type: 'context_field',
          action: 'created',
          itemName: formData.name,
          description: `Created context field "${formData.name}" with type ${formData.type}`,
          timestamp: new Date().toISOString()
        });
      } else {
        setContextFields(prev => prev.map(f => f.id === selectedField?.id ? newField : f));
        setSnackbarMessage(t('remoteConfig.contextFieldUpdated', 'Context field updated successfully'));
        markAsChanged({
          id: Date.now().toString(),
          type: 'context_field',
          action: 'updated',
          itemName: formData.name,
          description: `Updated context field "${formData.name}"`,
          timestamp: new Date().toISOString()
        });
      }

      setSnackbarOpen(true);
      setDialogOpen(false);
    } catch (error) {
      console.error('Failed to save context field:', error);
      setSnackbarMessage(t('common.error', 'An error occurred'));
      setSnackbarOpen(true);
    }
  };

  const addPossibleValue = () => {
    if (newValue.trim() && !formData.possibleValues.includes(newValue.trim())) {
      setFormData(prev => ({
        ...prev,
        possibleValues: [...prev.possibleValues, newValue.trim()]
      }));
      setNewValue('');
    }
  };

  const removePossibleValue = (valueToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      possibleValues: prev.possibleValues.filter(v => v !== valueToRemove)
    }));
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  return (
    <>
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" component="h2">
            {t('remoteConfig.contextFields', 'Context Fields')}
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddContextField}
            size="small"
          >
            {t('remoteConfig.addContextField', 'Add Context Field')}
          </Button>
        </Box>

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('remoteConfig.fieldName', 'Field Name')}</TableCell>
                <TableCell>{t('remoteConfig.type', 'Type')}</TableCell>
                <TableCell>{t('remoteConfig.description', 'Description')}</TableCell>
                <TableCell>{t('remoteConfig.possibleValues', 'Possible Values')}</TableCell>
                <TableCell>{t('common.actions', 'Actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {contextFields
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((field) => (
                <TableRow key={field.id}>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                      {field.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={field.type}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {field.description}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {field.possibleValues ? (
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {field.possibleValues.map((value, index) => (
                          <Chip
                            key={index}
                            label={value}
                            size="small"
                            variant="outlined"
                          />
                        ))}
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        Any value
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <IconButton
                        size="small"
                        onClick={() => handleEditContextField(field)}
                        color="primary"
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteContextField(field)}
                        color="error"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <SimplePagination
          count={contextFields.length}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[10, 25, 50, 100]}
        />
      </CardContent>
    </Card>

    {/* Create/Edit Context Field Side Panel */}
    <SidePanel
      open={dialogOpen}
      onClose={() => setDialogOpen(false)}
      title={dialogType === 'create'
        ? t('remoteConfig.addContextField', 'Add Context Field')
        : t('remoteConfig.editContextField', 'Edit Context Field')
      }
      actions={
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          <Button onClick={() => setDialogOpen(false)}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            onClick={handleSaveContextField}
            variant="contained"
            disabled={!formData.name || !formData.description}
          >
            {dialogType === 'create' ? t('common.create', 'Create') : t('common.update', 'Update')}
          </Button>
        </Box>
      }
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <TextField
          label={t('remoteConfig.fieldName', 'Field Name')}
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          fullWidth
          required
          disabled={dialogType === 'edit'}
          placeholder="userType"
          sx={{ fontFamily: 'monospace' }}
        />

        <FormControl fullWidth required>
          <InputLabel>{t('remoteConfig.type', 'Type')}</InputLabel>
          <Select
            value={formData.type}
            onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as any }))}
            label={t('remoteConfig.type', 'Type')}
            MenuProps={{
              PaperProps: {
                style: {
                  zIndex: 9999
                }
              }
            }}
          >
            <MenuItem value="string">String</MenuItem>
            <MenuItem value="number">Number</MenuItem>
            <MenuItem value="boolean">Boolean</MenuItem>
          </Select>
        </FormControl>

        <TextField
          label={t('remoteConfig.description', 'Description')}
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          fullWidth
          required
          multiline
          rows={2}
          placeholder="Description of this context field"
        />

        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            {t('remoteConfig.possibleValues', 'Possible Values')} ({t('remoteConfig.optional', 'Optional')})
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <TextField
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder="Add possible value"
              size="small"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addPossibleValue();
                }
              }}
            />
            <Button onClick={addPossibleValue} variant="outlined">
              {t('common.add', 'Add')}
            </Button>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {formData.possibleValues.map((value, index) => (
              <Chip
                key={index}
                label={value}
                onDelete={() => removePossibleValue(value)}
                size="small"
                variant="outlined"
              />
            ))}
          </Box>
        </Box>
      </Box>
    </SidePanel>

    {/* Delete Confirmation Dialog */}
    <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
      <DialogTitle>{t('remoteConfig.deleteContextField', 'Delete Context Field')}</DialogTitle>
      <DialogContent>
        <Typography>
          {t('remoteConfig.deleteContextFieldConfirm', 'Are you sure you want to delete context field')} "{fieldToDelete?.name}"?
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {t('remoteConfig.deleteContextFieldWarning', 'This action cannot be undone.')}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setDeleteDialogOpen(false)}>
          {t('common.cancel', 'Cancel')}
        </Button>
        <Button onClick={confirmDeleteField} color="error" variant="contained">
          {t('common.delete', 'Delete')}
        </Button>
      </DialogActions>
    </Dialog>

    {/* Snackbar for notifications */}
    <Snackbar
      open={snackbarOpen}
      autoHideDuration={4000}
      onClose={() => setSnackbarOpen(false)}
      message={snackbarMessage}
    />
  </>
  );
};

// Segments Management Component
const SegmentsManagement: React.FC = () => {
  const { t } = useTranslation();
  const { currentEnvironment } = useContext(EnvironmentContext);
  const { markAsChanged } = useContext(VersionContext);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<'create' | 'edit'>('create');
  const [selectedSegment, setSelectedSegment] = useState<Segment | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [segmentToDelete, setSegmentToDelete] = useState<Segment | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    displayName: '',
    description: '',
    isActive: true,
    conditions: [] as SegmentCondition[]
  });

  useEffect(() => {
    if (currentEnvironment) {
      loadSegments();
    }
  }, [currentEnvironment]);

  const loadSegments = async () => {
    try {
      setLoading(true);
      // TODO: Replace with actual API call
      const mockSegments: Segment[] = [
        {
          id: '1',
          name: 'premium_users',
          displayName: 'Premium Users',
          description: 'Users with premium subscription',
          conditions: [
            { field: 'userType', operator: 'equals', value: 'premium' }
          ],
          isActive: true,
          createdAt: '2024-01-15T10:30:00Z',
          updatedAt: '2024-01-15T10:30:00Z'
        },
        {
          id: '2',
          name: 'mobile_users',
          displayName: 'Mobile Users',
          description: 'Users accessing from mobile devices',
          conditions: [
            { field: 'platform', operator: 'equals', value: 'mobile' }
          ],
          isActive: true,
          createdAt: '2024-01-14T15:45:00Z',
          updatedAt: '2024-01-14T15:45:00Z'
        },
        {
          id: '3',
          name: 'beta_users',
          displayName: 'Beta Users',
          description: 'Users in beta testing program',
          conditions: [
            { field: 'userType', operator: 'equals', value: 'beta' },
            { field: 'appVersion', operator: 'contains', value: 'beta' }
          ],
          isActive: true,
          createdAt: '2024-01-13T09:15:00Z',
          updatedAt: '2024-01-13T09:15:00Z'
        }
      ];
      setSegments(mockSegments);
    } catch (error) {
      console.error('Failed to load segments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSegment = () => {
    setSelectedSegment(null);
    setDialogType('create');
    setFormData({
      name: '',
      displayName: '',
      description: '',
      isActive: true,
      conditions: []
    });
    setDialogOpen(true);
  };

  const handleEditSegment = (segment: Segment) => {
    setSelectedSegment(segment);
    setDialogType('edit');
    setFormData({
      name: segment.name,
      displayName: segment.displayName,
      description: segment.description,
      isActive: segment.isActive,
      conditions: segment.conditions
    });
    setDialogOpen(true);
  };

  const handleDeleteSegment = (segment: Segment) => {
    setSegmentToDelete(segment);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteSegment = async () => {
    if (!segmentToDelete) return;

    try {
      setSegments(prev => prev.filter(s => s.id !== segmentToDelete.id));
      setSnackbarMessage(t('remoteConfig.segmentDeleted', 'Segment deleted successfully'));
      setSnackbarOpen(true);
      markAsChanged({
        id: Date.now().toString(),
        type: 'segment',
        action: 'deleted',
        itemName: segmentToDelete.name,
        description: `Deleted segment "${segmentToDelete.name}"`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to delete segment:', error);
      setSnackbarMessage(t('common.error', 'An error occurred'));
      setSnackbarOpen(true);
    } finally {
      setDeleteDialogOpen(false);
      setSegmentToDelete(null);
    }
  };

  const handleSaveSegment = async () => {
    try {
      const newSegment: Segment = {
        id: selectedSegment?.id || Date.now().toString(),
        name: formData.name,
        displayName: formData.displayName,
        description: formData.description,
        conditions: formData.conditions,
        isActive: formData.isActive,
        createdAt: selectedSegment?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (dialogType === 'create') {
        // Check for duplicate name
        if (segments.some(s => s.name === formData.name)) {
          setSnackbarMessage(t('remoteConfig.duplicateSegmentName', 'Segment name already exists'));
          setSnackbarOpen(true);
          return;
        }
        setSegments(prev => [...prev, newSegment]);
        setSnackbarMessage(t('remoteConfig.segmentCreated', 'Segment created successfully'));
        markAsChanged({
          id: Date.now().toString(),
          type: 'segment',
          action: 'created',
          itemName: formData.name,
          description: `Created segment "${formData.name}" with ${formData.conditions.length} conditions`,
          timestamp: new Date().toISOString()
        });
      } else {
        setSegments(prev => prev.map(s => s.id === selectedSegment?.id ? newSegment : s));
        setSnackbarMessage(t('remoteConfig.segmentUpdated', 'Segment updated successfully'));
        markAsChanged({
          id: Date.now().toString(),
          type: 'segment',
          action: 'updated',
          itemName: formData.name,
          description: `Updated segment "${formData.name}"`,
          timestamp: new Date().toISOString()
        });
      }

      setSnackbarOpen(true);
      setDialogOpen(false);
    } catch (error) {
      console.error('Failed to save segment:', error);
      setSnackbarMessage(t('common.error', 'An error occurred'));
      setSnackbarOpen(true);
    }
  };

  const addCondition = () => {
    setFormData(prev => ({
      ...prev,
      conditions: [...prev.conditions, { field: '', operator: 'equals', value: '' }]
    }));
  };

  const removeCondition = (index: number) => {
    setFormData(prev => ({
      ...prev,
      conditions: prev.conditions.filter((_, i) => i !== index)
    }));
  };

  const updateCondition = (index: number, field: keyof SegmentCondition, value: any) => {
    setFormData(prev => ({
      ...prev,
      conditions: prev.conditions.map((condition, i) =>
        i === index ? { ...condition, [field]: value } : condition
      )
    }));
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  return (
    <>
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" component="h2">
            {t('remoteConfig.segments', 'Segments')}
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddSegment}
            size="small"
          >
            {t('remoteConfig.addSegment', 'Add Segment')}
          </Button>
        </Box>

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('remoteConfig.segmentName', 'Segment Name')}</TableCell>
                <TableCell>{t('remoteConfig.displayName', 'Display Name')}</TableCell>
                <TableCell>{t('remoteConfig.description', 'Description')}</TableCell>
                <TableCell>{t('remoteConfig.conditions', 'Conditions')}</TableCell>
                <TableCell>{t('remoteConfig.status', 'Status')}</TableCell>
                <TableCell>{t('remoteConfig.lastUpdated', 'Last Updated')}</TableCell>
                <TableCell>{t('common.actions', 'Actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {segments
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((segment) => (
                <TableRow key={segment.id}>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                      {segment.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {segment.displayName}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {segment.description}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {segment.conditions.length} condition{segment.conditions.length !== 1 ? 's' : ''}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={segment.isActive ? t('common.active', 'Active') : t('common.inactive', 'Inactive')}
                      size="small"
                      color={segment.isActive ? 'success' : 'default'}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {new Date(segment.updatedAt).toLocaleDateString()}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <IconButton
                        size="small"
                        onClick={() => handleEditSegment(segment)}
                        color="primary"
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteSegment(segment)}
                        color="error"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <SimplePagination
          count={segments.length}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[10, 25, 50, 100]}
        />
      </CardContent>
    </Card>

    {/* Create/Edit Segment Side Panel */}
    <SidePanel
      open={dialogOpen}
      onClose={() => setDialogOpen(false)}
      title={dialogType === 'create'
        ? t('remoteConfig.addSegment', 'Add Segment')
        : t('remoteConfig.editSegment', 'Edit Segment')
      }
      actions={
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          <Button onClick={() => setDialogOpen(false)}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            onClick={handleSaveSegment}
            variant="contained"
            disabled={!formData.name || !formData.displayName || !formData.description}
          >
            {dialogType === 'create' ? t('common.create', 'Create') : t('common.update', 'Update')}
          </Button>
        </Box>
      }
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <TextField
          label={t('remoteConfig.segmentName', 'Segment Name')}
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          fullWidth
          required
          disabled={dialogType === 'edit'}
          placeholder="premium_users"
          sx={{ fontFamily: 'monospace' }}
        />

        <TextField
          label={t('remoteConfig.displayName', 'Display Name')}
          value={formData.displayName}
          onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
          fullWidth
          required
          placeholder="Premium Users"
        />

        <TextField
          label={t('remoteConfig.description', 'Description')}
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          fullWidth
          required
          multiline
          rows={2}
          placeholder="Description of this segment"
        />

        <FormControlLabel
          control={
            <Switch
              checked={formData.isActive}
              onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
            />
          }
          label={t('remoteConfig.isActive', 'Is Active')}
        />

        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="subtitle2">
              {t('remoteConfig.conditions', 'Conditions')}
            </Typography>
            <Button onClick={addCondition} variant="outlined">
              {t('remoteConfig.addCondition', 'Add Condition')}
            </Button>
          </Box>

          {formData.conditions.map((condition, index) => (
            <Box key={index} sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'center' }}>
              <TextField
                label="Field"
                value={condition.field}
                onChange={(e) => updateCondition(index, 'field', e.target.value)}
                size="small"
                sx={{ flex: 1 }}
                placeholder="userType"
              />

              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Operator</InputLabel>
                <Select
                  value={condition.operator}
                  onChange={(e) => updateCondition(index, 'operator', e.target.value)}
                  label="Operator"
                  MenuProps={{
                    PaperProps: {
                      style: {
                        zIndex: 9999
                      }
                    }
                  }}
                >
                  <MenuItem value="equals">Equals</MenuItem>
                  <MenuItem value="not_equals">Not Equals</MenuItem>
                  <MenuItem value="contains">Contains</MenuItem>
                  <MenuItem value="not_contains">Not Contains</MenuItem>
                  <MenuItem value="greater_than">Greater Than</MenuItem>
                  <MenuItem value="less_than">Less Than</MenuItem>
                  <MenuItem value="in">In</MenuItem>
                  <MenuItem value="not_in">Not In</MenuItem>
                </Select>
              </FormControl>

              <TextField
                label="Value"
                value={condition.value}
                onChange={(e) => updateCondition(index, 'value', e.target.value)}
                size="small"
                sx={{ flex: 1 }}
                placeholder="premium"
              />

              <IconButton
                size="small"
                onClick={() => removeCondition(index)}
                color="error"
              >
                <DeleteIcon />
              </IconButton>
            </Box>
          ))}

          {formData.conditions.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
              {t('remoteConfig.noConditions', 'No conditions added yet')}
            </Typography>
          )}
        </Box>
      </Box>
    </SidePanel>

    {/* Delete Confirmation Dialog */}
    <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
      <DialogTitle>{t('remoteConfig.deleteSegment', 'Delete Segment')}</DialogTitle>
      <DialogContent>
        <Typography>
          {t('remoteConfig.deleteSegmentConfirm', 'Are you sure you want to delete segment')} "{segmentToDelete?.name}"?
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {t('remoteConfig.deleteSegmentWarning', 'This action cannot be undone.')}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setDeleteDialogOpen(false)}>
          {t('common.cancel', 'Cancel')}
        </Button>
        <Button onClick={confirmDeleteSegment} color="error" variant="contained">
          {t('common.delete', 'Delete')}
        </Button>
      </DialogActions>
    </Dialog>

    {/* Snackbar for notifications */}
    <Snackbar
      open={snackbarOpen}
      autoHideDuration={4000}
      onClose={() => setSnackbarOpen(false)}
      message={snackbarMessage}
    />
  </>
  );
};

// Variants Management Component
const VariantsManagement: React.FC = () => {
  const { t } = useTranslation();
  const { currentEnvironment } = useContext(EnvironmentContext);
  const { markAsChanged } = useContext(VersionContext);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<'create' | 'edit'>('create');
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [variantToDelete, setVariantToDelete] = useState<Variant | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    parameterKey: '',
    variantName: '',
    value: '',
    weight: 50,
    description: '',
    isActive: true
  });

  useEffect(() => {
    if (currentEnvironment) {
      loadVariants();
    }
  }, [currentEnvironment]);

  const loadVariants = async () => {
    try {
      setLoading(true);
      // TODO: Replace with actual API call
      const mockVariants: Variant[] = [
        {
          id: '1',
          parameterKey: 'enable_new_ui',
          variantName: 'control',
          value: false,
          weight: 50,
          description: 'Control group - old UI',
          isActive: true,
          createdAt: '2024-01-15T10:30:00Z',
          updatedAt: '2024-01-15T10:30:00Z'
        },
        {
          id: '2',
          parameterKey: 'enable_new_ui',
          variantName: 'treatment',
          value: true,
          weight: 50,
          description: 'Treatment group - new UI',
          isActive: true,
          createdAt: '2024-01-15T10:30:00Z',
          updatedAt: '2024-01-15T10:30:00Z'
        },
        {
          id: '3',
          parameterKey: 'button_color',
          variantName: 'blue',
          value: '#0066cc',
          weight: 33,
          description: 'Blue button variant',
          isActive: true,
          createdAt: '2024-01-14T15:45:00Z',
          updatedAt: '2024-01-14T15:45:00Z'
        },
        {
          id: '4',
          parameterKey: 'button_color',
          variantName: 'green',
          value: '#00cc66',
          weight: 33,
          description: 'Green button variant',
          isActive: true,
          createdAt: '2024-01-14T15:45:00Z',
          updatedAt: '2024-01-14T15:45:00Z'
        },
        {
          id: '5',
          parameterKey: 'button_color',
          variantName: 'red',
          value: '#cc0066',
          weight: 34,
          description: 'Red button variant',
          isActive: false,
          createdAt: '2024-01-14T15:45:00Z',
          updatedAt: '2024-01-14T15:45:00Z'
        }
      ];
      setVariants(mockVariants);
    } catch (error) {
      console.error('Failed to load variants:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddVariant = () => {
    setSelectedVariant(null);
    setDialogType('create');
    setFormData({
      parameterKey: '',
      variantName: '',
      value: '',
      weight: 50,
      description: '',
      isActive: true
    });
    setDialogOpen(true);
  };

  const handleEditVariant = (variant: Variant) => {
    setSelectedVariant(variant);
    setDialogType('edit');
    setFormData({
      parameterKey: variant.parameterKey,
      variantName: variant.variantName,
      value: typeof variant.value === 'object'
        ? JSON.stringify(variant.value, null, 2)
        : String(variant.value),
      weight: variant.weight,
      description: variant.description,
      isActive: variant.isActive
    });
    setDialogOpen(true);
  };

  const handleDeleteVariant = (variant: Variant) => {
    setVariantToDelete(variant);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteVariant = async () => {
    if (!variantToDelete) return;

    try {
      setVariants(prev => prev.filter(v => v.id !== variantToDelete.id));
      setSnackbarMessage(t('remoteConfig.variantDeleted', 'Variant deleted successfully'));
      setSnackbarOpen(true);
      markAsChanged({
        id: Date.now().toString(),
        type: 'variant',
        action: 'deleted',
        itemName: `${variantToDelete.parameterKey}.${variantToDelete.variantName}`,
        description: `Deleted variant "${variantToDelete.variantName}" for parameter "${variantToDelete.parameterKey}"`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to delete variant:', error);
      setSnackbarMessage(t('common.error', 'An error occurred'));
      setSnackbarOpen(true);
    } finally {
      setDeleteDialogOpen(false);
      setVariantToDelete(null);
    }
  };

  const handleSaveVariant = async () => {
    try {
      let processedValue: any = formData.value;

      // Try to parse as JSON first, fallback to string
      try {
        processedValue = JSON.parse(formData.value);
      } catch (e) {
        // If not valid JSON, treat as string/number/boolean
        if (formData.value === 'true') processedValue = true;
        else if (formData.value === 'false') processedValue = false;
        else if (!isNaN(Number(formData.value))) processedValue = Number(formData.value);
        else processedValue = formData.value;
      }

      const newVariant: Variant = {
        id: selectedVariant?.id || Date.now().toString(),
        parameterKey: formData.parameterKey,
        variantName: formData.variantName,
        value: processedValue,
        weight: formData.weight,
        description: formData.description,
        isActive: formData.isActive,
        createdAt: selectedVariant?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (dialogType === 'create') {
        setVariants(prev => [...prev, newVariant]);
        setSnackbarMessage(t('remoteConfig.variantCreated', 'Variant created successfully'));
        markAsChanged({
          id: Date.now().toString(),
          type: 'variant',
          action: 'created',
          itemName: `${formData.parameterKey}.${formData.variantName}`,
          description: `Created variant "${formData.variantName}" for parameter "${formData.parameterKey}" with ${formData.weight}% weight`,
          timestamp: new Date().toISOString()
        });
      } else {
        setVariants(prev => prev.map(v => v.id === selectedVariant?.id ? newVariant : v));
        setSnackbarMessage(t('remoteConfig.variantUpdated', 'Variant updated successfully'));
        markAsChanged({
          id: Date.now().toString(),
          type: 'variant',
          action: 'updated',
          itemName: `${formData.parameterKey}.${formData.variantName}`,
          description: `Updated variant "${formData.variantName}" for parameter "${formData.parameterKey}"`,
          timestamp: new Date().toISOString()
        });
      }

      setSnackbarOpen(true);
      setDialogOpen(false);
    } catch (error) {
      console.error('Failed to save variant:', error);
      setSnackbarMessage(t('common.error', 'An error occurred'));
      setSnackbarOpen(true);
    }
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const getParameterVariants = (parameterKey: string) => {
    return variants.filter(v => v.parameterKey === parameterKey);
  };

  const getTotalWeight = (parameterKey: string) => {
    return getParameterVariants(parameterKey)
      .filter(v => v.isActive)
      .reduce((sum, v) => sum + v.weight, 0);
  };

  return (
    <>
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" component="h2">
            {t('remoteConfig.variants', 'Variants')}
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddVariant}
            size="small"
          >
            {t('remoteConfig.addVariant', 'Add Variant')}
          </Button>
        </Box>

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('remoteConfig.parameterKey', 'Parameter Key')}</TableCell>
                <TableCell>{t('remoteConfig.variantName', 'Variant Name')}</TableCell>
                <TableCell>{t('remoteConfig.value', 'Value')}</TableCell>
                <TableCell>{t('remoteConfig.weight', 'Weight %')}</TableCell>
                <TableCell>{t('remoteConfig.description', 'Description')}</TableCell>
                <TableCell>{t('remoteConfig.status', 'Status')}</TableCell>
                <TableCell>{t('common.actions', 'Actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {variants
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((variant) => {
                  const totalWeight = getTotalWeight(variant.parameterKey);
                  const isWeightValid = totalWeight <= 100;

                  return (
                <TableRow key={variant.id}>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                      {variant.parameterKey}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {variant.variantName}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                      {typeof variant.value === 'object'
                        ? JSON.stringify(variant.value)
                        : String(variant.value)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2">
                        {variant.weight}%
                      </Typography>
                      {!isWeightValid && (
                        <Chip
                          label={`Total: ${totalWeight}%`}
                          size="small"
                          color="error"
                          variant="outlined"
                        />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {variant.description}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={variant.isActive ? t('common.active', 'Active') : t('common.inactive', 'Inactive')}
                      size="small"
                      color={variant.isActive ? 'success' : 'default'}
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <IconButton
                        size="small"
                        onClick={() => handleEditVariant(variant)}
                        color="primary"
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteVariant(variant)}
                        color="error"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  </TableCell>
                </TableRow>
              )})}
            </TableBody>
          </Table>
        </TableContainer>

        <SimplePagination
          count={variants.length}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[10, 25, 50, 100]}
        />
      </CardContent>
    </Card>

    {/* Create/Edit Variant Side Panel */}
    <SidePanel
      open={dialogOpen}
      onClose={() => setDialogOpen(false)}
      title={dialogType === 'create'
        ? t('remoteConfig.addVariant', 'Add Variant')
        : t('remoteConfig.editVariant', 'Edit Variant')
      }
      actions={
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          <Button onClick={() => setDialogOpen(false)}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            onClick={handleSaveVariant}
            variant="contained"
            disabled={!formData.parameterKey || !formData.variantName || !formData.description}
          >
            {dialogType === 'create' ? t('common.create', 'Create') : t('common.update', 'Update')}
          </Button>
        </Box>
      }
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <TextField
          label={t('remoteConfig.parameterKey', 'Parameter Key')}
          value={formData.parameterKey}
          onChange={(e) => setFormData(prev => ({ ...prev, parameterKey: e.target.value }))}
          fullWidth
          required
          placeholder="enable_new_ui"
          sx={{ fontFamily: 'monospace' }}
        />

        <TextField
          label={t('remoteConfig.variantName', 'Variant Name')}
          value={formData.variantName}
          onChange={(e) => setFormData(prev => ({ ...prev, variantName: e.target.value }))}
          fullWidth
          required
          placeholder="control"
        />

        <TextField
          label={t('remoteConfig.value', 'Value')}
          value={formData.value}
          onChange={(e) => setFormData(prev => ({ ...prev, value: e.target.value }))}
          fullWidth
          required
          multiline
          rows={3}
          placeholder="true, false, 42, 'text', or JSON object"
          helperText={t('remoteConfig.valueHelp', 'Enter value as text, number, boolean, or JSON')}
        />

        <TextField
          label={t('remoteConfig.weight', 'Weight (%)')}
          type="number"
          value={formData.weight}
          onChange={(e) => setFormData(prev => ({ ...prev, weight: Number(e.target.value) }))}
          fullWidth
          required
          inputProps={{ min: 0, max: 100 }}
          helperText={t('remoteConfig.weightHelp', 'Percentage of traffic for this variant (0-100)')}
        />

        <TextField
          label={t('remoteConfig.description', 'Description')}
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          fullWidth
          required
          multiline
          rows={2}
          placeholder="Description of this variant"
        />

        <FormControlLabel
          control={
            <Switch
              checked={formData.isActive}
              onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
            />
          }
          label={t('remoteConfig.isActive', 'Is Active')}
        />
      </Box>
    </SidePanel>

    {/* Delete Confirmation Dialog */}
    <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
      <DialogTitle>{t('remoteConfig.deleteVariant', 'Delete Variant')}</DialogTitle>
      <DialogContent>
        <Typography>
          {t('remoteConfig.deleteVariantConfirm', 'Are you sure you want to delete variant')} "{variantToDelete?.variantName}"?
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {t('remoteConfig.deleteVariantWarning', 'This action cannot be undone.')}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setDeleteDialogOpen(false)}>
          {t('common.cancel', 'Cancel')}
        </Button>
        <Button onClick={confirmDeleteVariant} color="error" variant="contained">
          {t('common.delete', 'Delete')}
        </Button>
      </DialogActions>
    </Dialog>

    {/* Snackbar for notifications */}
    <Snackbar
      open={snackbarOpen}
      autoHideDuration={4000}
      onClose={() => setSnackbarOpen(false)}
      message={snackbarMessage}
    />
  </>
  );
};

// Deployment History Management Component
const DeploymentHistoryManagement: React.FC = () => {
  const { t } = useTranslation();
  const { currentEnvironment } = useContext(EnvironmentContext);
  const [deployments, setDeployments] = useState<DeploymentHistory[]>([]);
  const [currentVersion, setCurrentVersion] = useState<DeploymentHistory | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedDeployment, setSelectedDeployment] = useState<DeploymentHistory | null>(null);
  const [rollbackDialogOpen, setRollbackDialogOpen] = useState(false);
  const [deploymentToRollback, setDeploymentToRollback] = useState<DeploymentHistory | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  useEffect(() => {
    if (currentEnvironment) {
      loadDeployments();
    }
  }, [currentEnvironment, page, rowsPerPage]);

  const loadDeployments = async () => {
    try {
      setLoading(true);
      const response = await remoteConfigService.getDeploymentHistory(page + 1, rowsPerPage);
      setDeployments(response.deployments);

      // Set current version (latest successful deployment)
      const currentDeploy = response.deployments.find(d => d.status === 'success');
      setCurrentVersion(currentDeploy || null);
    } catch (error) {
      console.error('Failed to load deployments:', error);
      setSnackbarMessage(t('remoteConfig.loadDeploymentsError', 'Failed to load deployment history'));
      setSnackbarOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (deployment: DeploymentHistory) => {
    setSelectedDeployment(deployment);
    setDetailDialogOpen(true);
  };

  const handleRollback = (deployment: DeploymentHistory) => {
    setDeploymentToRollback(deployment);
    setRollbackDialogOpen(true);
  };

  const confirmRollback = async () => {
    if (!deploymentToRollback) return;

    try {
      await remoteConfigService.rollbackToDeployment({
        deploymentId: deploymentToRollback.id,
        description: `Rollback to version #${deploymentToRollback.version}`
      });

      setSnackbarMessage(t('remoteConfig.rollbackSuccess', `Successfully rolled back to version #${deploymentToRollback.version}`));
      setSnackbarOpen(true);

      // Reload deployments to show new rollback deployment
      loadDeployments();
    } catch (error) {
      console.error('Failed to rollback:', error);
      setSnackbarMessage(t('remoteConfig.rollbackError', 'Failed to rollback deployment'));
      setSnackbarOpen(true);
    } finally {
      setRollbackDialogOpen(false);
      setDeploymentToRollback(null);
    }
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'success';
      case 'failed': return 'error';
      case 'in_progress': return 'warning';
      default: return 'default';
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'created': return 'success';
      case 'updated': return 'info';
      case 'deleted': return 'error';
      default: return 'default';
    }
  };

  // Generate diff between current version and target version
  const generateVersionDiff = (currentDeploy: DeploymentHistory, targetDeploy: DeploymentHistory) => {
    const currentConfig = {
      version: currentDeploy.version,
      deployedBy: currentDeploy.deployedBy,
      deployedAt: currentDeploy.deployedAt,
      message: currentDeploy.message,
      changes: currentDeploy.changes.map(change => ({
        type: change.type,
        action: change.action,
        itemName: change.itemName,
        value: change.newValue || change.oldValue
      }))
    };

    const targetConfig = {
      version: targetDeploy.version,
      deployedBy: targetDeploy.deployedBy,
      deployedAt: targetDeploy.deployedAt,
      message: targetDeploy.message,
      changes: targetDeploy.changes.map(change => ({
        type: change.type,
        action: change.action,
        itemName: change.itemName,
        value: change.newValue || change.oldValue
      }))
    };

    return {
      current: JSON.stringify(currentConfig, null, 2),
      target: JSON.stringify(targetConfig, null, 2)
    };
  };

  return (
    <>
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" component="h2">
            {t('remoteConfig.deploymentHistory', 'Deployment History')}
          </Typography>
        </Box>

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('remoteConfig.version', 'Version')}</TableCell>
                <TableCell>{t('remoteConfig.message', 'Message')}</TableCell>
                <TableCell>{t('remoteConfig.deployedBy', 'Deployed By')}</TableCell>
                <TableCell>{t('remoteConfig.deployedAt', 'Deployed At')}</TableCell>
                <TableCell>{t('remoteConfig.status', 'Status')}</TableCell>
                <TableCell>{t('remoteConfig.changes', 'Changes')}</TableCell>
                <TableCell>{t('common.actions', 'Actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {deployments
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((deployment) => (
                <TableRow key={deployment.id}>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                      #{deployment.version}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ maxWidth: 300 }}>
                      {deployment.message}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {deployment.deployedBy.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        ({deployment.deployedBy.email})
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {new Date(deployment.deployedAt).toLocaleString()}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={deployment.status}
                      size="small"
                      color={getStatusColor(deployment.status) as any}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {deployment.changes.length} change{deployment.changes.length !== 1 ? 's' : ''}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Tooltip title={t('remoteConfig.viewDetails', 'View Details')}>
                        <IconButton
                          size="small"
                          onClick={() => handleViewDetails(deployment)}
                          color="primary"
                        >
                          <SettingsIcon />
                        </IconButton>
                      </Tooltip>
                      {deployment.rollbackAvailable && deployment.status === 'success' && (
                        <Tooltip title={t('remoteConfig.rollback', 'Rollback')}>
                          <IconButton
                            size="small"
                            onClick={() => handleRollback(deployment)}
                            color="warning"
                          >
                            <RestoreIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <SimplePagination
          count={deployments.length}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[10, 25, 50, 100]}
        />
      </CardContent>
    </Card>

    {/* Deployment Details Dialog */}
    <Dialog open={detailDialogOpen} onClose={() => setDetailDialogOpen(false)} maxWidth="md" fullWidth>
      <DialogTitle>
        {t('remoteConfig.deploymentDetails', 'Deployment Details')} - #{selectedDeployment?.version}
      </DialogTitle>
      <DialogContent>
        {selectedDeployment && (
          <Box sx={{ pt: 2 }}>
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  {t('remoteConfig.version', 'Version')}
                </Typography>
                <Typography variant="body1" sx={{ fontFamily: 'monospace' }}>
                  #{selectedDeployment.version}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  {t('remoteConfig.status', 'Status')}
                </Typography>
                <Chip
                  label={selectedDeployment.status}
                  size="small"
                  color={getStatusColor(selectedDeployment.status) as any}
                />
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  {t('remoteConfig.deployedBy', 'Deployed By')}
                </Typography>
                <Box>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {selectedDeployment.deployedBy.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selectedDeployment.deployedBy.email}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  {t('remoteConfig.deployedAt', 'Deployed At')}
                </Typography>
                <Typography variant="body1">
                  {new Date(selectedDeployment.deployedAt).toLocaleString()}
                </Typography>
              </Grid>
            </Grid>

            <Typography variant="h6" sx={{ mb: 2 }}>
              {t('remoteConfig.changes', 'Changes')} ({selectedDeployment.changes.length})
            </Typography>

            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t('remoteConfig.type', 'Type')}</TableCell>
                    <TableCell>{t('remoteConfig.action', 'Action')}</TableCell>
                    <TableCell>{t('remoteConfig.itemName', 'Item Name')}</TableCell>
                    <TableCell>{t('remoteConfig.changes', 'Changes')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {selectedDeployment.changes.map((change, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Chip
                          label={change.type}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={change.action}
                          size="small"
                          color={getActionColor(change.action) as any}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                          {change.itemName}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {change.action === 'created' && (
                          <Typography variant="body2" color="success.main">
                            Created with value: {JSON.stringify(change.newValue)}
                          </Typography>
                        )}
                        {change.action === 'updated' && (
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              From: {JSON.stringify(change.oldValue)}
                            </Typography>
                            <Typography variant="body2" color="info.main">
                              To: {JSON.stringify(change.newValue)}
                            </Typography>
                          </Box>
                        )}
                        {change.action === 'deleted' && (
                          <Typography variant="body2" color="error.main">
                            Deleted: {JSON.stringify(change.oldValue)}
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setDetailDialogOpen(false)}>
          {t('common.close', 'Close')}
        </Button>
      </DialogActions>
    </Dialog>

    {/* Rollback Confirmation Dialog with Diff */}
    <Dialog open={rollbackDialogOpen} onClose={() => setRollbackDialogOpen(false)} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <RestoreIcon color="warning" />
          {t('remoteConfig.rollback', 'Rollback')}
        </Box>
      </DialogTitle>
      <DialogContent>
        <Typography sx={{ mb: 2 }}>
          {t('remoteConfig.rollbackConfirm', 'Are you sure you want to rollback to version')} "#{deploymentToRollback?.version}"?
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {t('remoteConfig.rollbackWarning', 'This will create a new deployment that reverts all changes made after this version.')}
        </Typography>

        {deploymentToRollback && currentVersion && (
          <>
            {/* Version Comparison Info */}
            <Box sx={{ mb: 3 }}>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Paper sx={{ p: 2, bgcolor: 'error.light', color: 'error.contrastText' }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      {t('remoteConfig.currentVersion', 'Current Version')} (#{currentVersion.version})
                    </Typography>
                    <Typography variant="body2">
                      {currentVersion.deployedBy.name}
                    </Typography>
                    <Typography variant="caption">
                      {new Date(currentVersion.deployedAt).toLocaleString()}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6}>
                  <Paper sx={{ p: 2, bgcolor: 'success.light', color: 'success.contrastText' }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      {t('remoteConfig.targetVersion', 'Target Version')} (#{deploymentToRollback.version})
                    </Typography>
                    <Typography variant="body2">
                      {deploymentToRollback.deployedBy.name}
                    </Typography>
                    <Typography variant="caption">
                      {new Date(deploymentToRollback.deployedAt).toLocaleString()}
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
            </Box>

            {/* Diff Viewer */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                {t('remoteConfig.configurationDiff', 'Configuration Differences')}
              </Typography>
              <Paper sx={{ p: 1, bgcolor: 'background.default' }}>
                {(() => {
                  const diff = generateVersionDiff(currentVersion, deploymentToRollback);
                  return (
                    <ReactDiffViewer
                      oldValue={diff.current}
                      newValue={diff.target}
                      splitView={true}
                      leftTitle={`Current Version (#${currentVersion.version})`}
                      rightTitle={`Target Version (#${deploymentToRollback.version})`}
                      showDiffOnly={false}
                      hideLineNumbers={false}
                      styles={{
                        variables: {
                          light: {
                            codeFoldGutterBackground: '#f7f7f7',
                            codeFoldBackground: '#f1f8ff',
                          }
                        }
                      }}
                    />
                  );
                })()}
              </Paper>
            </Box>

            {/* Rollback Details */}
            <Box sx={{ p: 2, bgcolor: 'warning.light', borderRadius: 1 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                {t('remoteConfig.rollbackDetails', 'Rollback Details')}:
              </Typography>
              <Typography variant="body2">
                • {t('remoteConfig.version', 'Version')}: #{deploymentToRollback.version}
              </Typography>
              <Typography variant="body2">
                • {t('remoteConfig.deployedBy', 'Originally deployed by')}: {deploymentToRollback.deployedBy.name} ({deploymentToRollback.deployedBy.email})
              </Typography>
              <Typography variant="body2">
                • {t('remoteConfig.deployedAt', 'Deployed at')}: {new Date(deploymentToRollback.deployedAt).toLocaleString()}
              </Typography>
              <Typography variant="body2">
                • {t('remoteConfig.message', 'Message')}: {deploymentToRollback.message}
              </Typography>
            </Box>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setRollbackDialogOpen(false)}>
          {t('common.cancel', 'Cancel')}
        </Button>
        <Button onClick={confirmRollback} color="warning" variant="contained">
          {t('remoteConfig.confirmRollback', 'Confirm Rollback')}
        </Button>
      </DialogActions>
    </Dialog>

    {/* Snackbar for notifications */}
    <Snackbar
      open={snackbarOpen}
      autoHideDuration={4000}
      onClose={() => setSnackbarOpen(false)}
      message={snackbarMessage}
    />
  </>
  );
};

// Main Remote Config Page
const RemoteConfigParametersPage: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Tab names for URL mapping
  const tabNames = ['parameters', 'campaigns', 'context-fields', 'segments', 'variants', 'history'];

  // Get initial tab from URL, localStorage, or default to 0
  const getInitialTab = () => {
    const tabParam = searchParams.get('tab');
    if (tabParam) {
      const tabIndex = tabNames.indexOf(tabParam);
      if (tabIndex >= 0) {
        // Save to localStorage for future reference
        localStorage.setItem('remoteConfig.lastTab', tabParam);
        return tabIndex;
      }
    }

    // Fallback to localStorage
    const savedTab = localStorage.getItem('remoteConfig.lastTab');
    if (savedTab) {
      const tabIndex = tabNames.indexOf(savedTab);
      if (tabIndex >= 0) {
        // Update URL to match saved tab
        const newSearchParams = new URLSearchParams(searchParams);
        newSearchParams.set('tab', savedTab);
        setSearchParams(newSearchParams, { replace: true });
        return tabIndex;
      }
    }

    // Default to first tab
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set('tab', tabNames[0]);
    setSearchParams(newSearchParams, { replace: true });
    return 0;
  };

  const [tabValue, setTabValue] = useState(getInitialTab);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);

    // Update URL with new tab
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set('tab', tabNames[newValue]);
    setSearchParams(newSearchParams);

    // Save to localStorage
    localStorage.setItem('remoteConfig.lastTab', tabNames[newValue]);
  };

  // Update tab when URL changes (browser back/forward)
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam) {
      const tabIndex = tabNames.indexOf(tabParam);
      if (tabIndex >= 0 && tabIndex !== tabValue) {
        setTabValue(tabIndex);
        // Update localStorage when URL changes
        localStorage.setItem('remoteConfig.lastTab', tabParam);
      }
    }
  }, [searchParams, tabValue, tabNames]);

  return (
    <VersionProvider>
      <EnvironmentProvider>
        <Box sx={{ p: 3 }}>
          {/* Simple Environment Selector */}
          <EnvironmentSelector />

          {/* Main Content Tabs */}
          <Paper sx={{ width: '100%' }}>
            <Tabs
              value={tabValue}
              onChange={handleTabChange}
              sx={{ borderBottom: 1, borderColor: 'divider' }}
            >
              <Tab
                label={t('remoteConfig.parameters', 'Parameters')}
                icon={<CodeIcon />}
                iconPosition="start"
              />
              <Tab
                label={t('remoteConfig.campaigns', 'Campaigns')}
                icon={<CampaignIcon />}
                iconPosition="start"
              />
              <Tab
                label={t('remoteConfig.contextFields', 'Context Fields')}
                icon={<TuneIcon />}
                iconPosition="start"
              />
              <Tab
                label={t('remoteConfig.segments', 'Segments')}
                icon={<SettingsIcon />}
                iconPosition="start"
              />
            <Tab
              label={t('remoteConfig.variants', 'Variants')}
              icon={<VariantsIcon />}
              iconPosition="start"
            />
            <Tab
              label={t('remoteConfig.deploymentHistory', 'History')}
              icon={<HistoryIcon />}
              iconPosition="start"
            />
            </Tabs>

            <Box sx={{ p: 3 }}>
              {tabValue === 0 && <ConfigsManagement />}
              {tabValue === 1 && <CampaignsManagement />}
              {tabValue === 2 && <ContextFieldsManagement />}
              {tabValue === 3 && <SegmentsManagement />}
              {tabValue === 4 && <VariantsManagement />}
              {tabValue === 5 && <DeploymentHistoryManagement />}
            </Box>
          </Paper>
        </Box>
      </EnvironmentProvider>
    </VersionProvider>
  );
};

export default RemoteConfigParametersPage;
