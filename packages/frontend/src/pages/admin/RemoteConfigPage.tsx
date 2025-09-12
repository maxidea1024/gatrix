import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,

  IconButton,
  Chip,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,

  Tooltip,
  Stack,
  Tabs,
  Tab,
  CircularProgress,
  FormControlLabel,
  Switch,
  Badge,
  Checkbox
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  CloudUpload as PublishIcon,
  Cancel as CancelIcon,
  Save as SaveIcon,
  Visibility as VisibilityIcon,
  Storage as StageIcon


} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import CodeEditor from '@/components/common/CodeEditor';
import TargetConditionBuilder from '../../components/TargetConditionBuilder';

import SimplePagination from '@/components/common/SimplePagination';
import { formatDateTimeDetailed } from '@/utils/dateFormat';
import api from '@/services/api';
import RemoteConfigHistoryPage from './RemoteConfigHistoryPage';

// Types
interface RemoteConfig {
  id: number;
  keyName: string;
  defaultValue: string | null;
  valueType: 'string' | 'number' | 'boolean' | 'json' | 'yaml';
  description: string | null;
  isActive: boolean;
  createdBy: number | null;
  updatedBy: number | null;
  createdAt: string;
  updatedAt: string;
  createdByName?: string;
  createdByEmail?: string;
  updatedByName?: string;
  updatedByEmail?: string;
}

interface RemoteConfigFilters {
  search?: string;
  valueType?: string;
  isActive?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

const RemoteConfigPage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [configs, setConfigs] = useState<RemoteConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<RemoteConfigFilters>({});

  // SSE connection for real-time updates (임시 비활성화)
  // const { isConnected } = useSSENotifications({
  //   onEvent: (event) => {
  //     if (event.type === 'remote_config_change') {
  //       // Reload configs when changes occur
  //       loadConfigs();
  //     }
  //   },
  // });

  
  // Tab state
  const [currentTab, setCurrentTab] = useState(0);

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<RemoteConfig | null>(null);
  const [stageDialogOpen, setStageDialogOpen] = useState(false);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [selectedConfigs, setSelectedConfigs] = useState<number[]>([]);
  
  // Form states
  const [formData, setFormData] = useState<{
    keyName: string;
    defaultValue: string;
    valueType: 'string' | 'number' | 'boolean' | 'json' | 'yaml';
    description: string;
    isActive: boolean;
  }>({
    keyName: '',
    defaultValue: '',
    valueType: 'string',
    description: '',
    isActive: true,
  });

  const [formErrors, setFormErrors] = useState<{[key: string]: string}>({});

  // Stage/Publish form states
  const [stageFormData, setStageFormData] = useState({
    description: ''
  });
  const [publishFormData, setPublishFormData] = useState({
    deploymentName: '',
    description: ''
  });

  // Generate default deployment name
  const generateDeploymentName = () => {
    const now = new Date();
    const timestamp = now.toISOString().slice(0, 16).replace('T', '_').replace(/:/g, '');
    return `Deploy_${timestamp}`;
  };

  // Delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [configToDelete, setConfigToDelete] = useState<RemoteConfig | null>(null);

  // Value detail dialog state
  const [valueDetailOpen, setValueDetailOpen] = useState(false);
  const [valueDetailContent, setValueDetailContent] = useState<{title: string, value: string, type: string}>({title: '', value: '', type: ''});

  // Form validation
  const validateForm = (): boolean => {
    const errors: {[key: string]: string} = {};

    if (!formData.keyName.trim()) {
      errors.keyName = t('admin.remoteConfig.validation.keyNameRequired');
    } else if (!/^[a-zA-Z][a-zA-Z0-9_]{0,255}$/.test(formData.keyName)) {
      errors.keyName = t('admin.remoteConfig.validation.keyNameInvalid');
    }

    if (!formData.defaultValue.trim()) {
      errors.defaultValue = t('admin.remoteConfig.validation.defaultValueRequired');
    }

    if (!formData.description.trim()) {
      errors.description = '설명은 필수 입력 항목입니다.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Load configs
  const loadConfigs = async () => {
    try {
      setLoading(true);
      const params = {
        page: (page + 1).toString(),
        limit: rowsPerPage.toString(),
        ...Object.fromEntries(
          Object.entries(filters).map(([key, value]) => [key, String(value)])
        ),
      };

      const response = await api.get('/remote-config', { params });
      setConfigs(response.data.configs);
      setTotal(response.data.total);
    } catch (error: any) {
      console.error('Error loading configs:', error);
      const errorMessage = error.error?.message || error.message || t('admin.remoteConfig.loadError');
      enqueueSnackbar(errorMessage, { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfigs();
  }, [page, rowsPerPage, filters]);

  // Handle create config
  const handleCreate = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      await api.post('/remote-config', formData);

      enqueueSnackbar(t('admin.remoteConfig.createSuccess'), { variant: 'success' });
      setCreateDialogOpen(false);
      resetForm();
      loadConfigs();
    } catch (error: any) {
      console.error('Error creating config:', error);
      const errorMessage = error.error?.message || error.message || t('admin.remoteConfig.createError');
      enqueueSnackbar(errorMessage, { variant: 'error' });
    }
  };

  // Handle edit config
  const handleEdit = async () => {
    if (!selectedConfig) return;

    if (!validateForm()) {
      return;
    }

    try {
      await api.put(`/remote-config/${selectedConfig.id}`, formData);

      enqueueSnackbar(t('admin.remoteConfig.updateSuccess'), { variant: 'success' });
      setEditDialogOpen(false);
      resetForm();
      loadConfigs();
    } catch (error: any) {
      console.error('Error updating config:', error);
      const errorMessage = error.error?.message || error.message || t('admin.remoteConfig.updateError');
      enqueueSnackbar(errorMessage, { variant: 'error' });
    }
  };

  // Handle delete config
  const handleDelete = (config: RemoteConfig) => {
    setConfigToDelete(config);
    setDeleteDialogOpen(true);
  };

  // Confirm delete
  const confirmDelete = async () => {
    if (!configToDelete) return;

    try {
      await api.delete(`/remote-config/${configToDelete.id}`);

      enqueueSnackbar(t('admin.remoteConfig.deleteSuccess'), { variant: 'success' });
      loadConfigs();
      setDeleteDialogOpen(false);
      setConfigToDelete(null);
    } catch (error: any) {
      console.error('Error deleting config:', error);
      const errorMessage = error.error?.message || error.message || t('admin.remoteConfig.deleteError');
      enqueueSnackbar(errorMessage, { variant: 'error' });
    }
  };

  // Cancel delete
  const cancelDelete = () => {
    setDeleteDialogOpen(false);
    setConfigToDelete(null);
  };

  // Stage configs
  const handleStageConfigs = async () => {
    try {
      console.log('Starting stage configs...', { selectedConfigs, stageFormData }); // 디버깅용

      if (selectedConfigs.length === 0) {
        enqueueSnackbar(t('admin.remoteConfig.selectConfigsFirst'), { variant: 'warning' });
        return;
      }

      const response = await api.post('/remote-config/stage', {
        configIds: selectedConfigs,
        description: stageFormData.description
      });

      console.log('Full response:', response); // 전체 응답 확인
      console.log('Stage response:', response.data); // 디버깅용

      // 성공 조건: success가 true이거나, stagedConfigIds가 있으면 성공으로 간주
      if (response.data.success || response.data.stagedConfigIds) {
        enqueueSnackbar(t('admin.remoteConfig.stageSuccess'), { variant: 'success' });
        setStageDialogOpen(false);
        setStageFormData({ description: '' });
        setSelectedConfigs([]);
        loadConfigs();
      } else {
        console.log('Stage failed - success is false'); // 디버깅용
        enqueueSnackbar(response.data.message || t('admin.remoteConfig.stageError'), { variant: 'error' });
      }
    } catch (error: any) {
      console.error('Error staging configs:', error);
      const errorMessage = error.response?.data?.message || t('admin.remoteConfig.stageError');
      enqueueSnackbar(errorMessage, { variant: 'error' });
    }
  };

  // Publish staged configs
  const handlePublishChanges = async () => {
    try {
      const response = await api.post('/remote-config/publish', {
        deploymentName: publishFormData.deploymentName,
        description: publishFormData.description
      });

      if (response.data.success) {
        enqueueSnackbar(t('admin.remoteConfig.publishSuccess'), { variant: 'success' });
        setPublishDialogOpen(false);
        setPublishFormData({ deploymentName: '', description: '' });
        loadConfigs();
      }
    } catch (error: any) {
      console.error('Error publishing changes:', error);
      const errorMessage = error.response?.data?.message || t('admin.remoteConfig.publishError');
      enqueueSnackbar(errorMessage, { variant: 'error' });
    }
  };

  // Campaigns Tab Component
  const CampaignsTab = () => {
    const [campaigns, setCampaigns] = useState<any[]>([]);
    const [campaignLoading, setCampaignLoading] = useState(true);
    const [campaignPage, setCampaignPage] = useState(0);
    const [campaignRowsPerPage, setCampaignRowsPerPage] = useState(10);
    const [campaignTotal, setCampaignTotal] = useState(0);
    const [createCampaignDialogOpen, setCreateCampaignDialogOpen] = useState(false);
    const [editCampaignDialogOpen, setEditCampaignDialogOpen] = useState(false);
    const [selectedCampaign, setSelectedCampaign] = useState<any>(null);
    const [campaignFormData, setCampaignFormData] = useState({
      campaignName: '',
      description: '',
      startDate: '',
      endDate: '',
      priority: 0,
      status: 'draft' as 'draft' | 'scheduled' | 'running' | 'completed' | 'paused',
      targetConditions: {} as any,
      overrideConfigs: [] as Array<{configId: number, configName: string, overrideValue: string}>,
      isActive: true
    });

    // Load campaigns
    const loadCampaigns = async () => {
      try {
        setCampaignLoading(true);
        const response = await api.get(`/campaigns?page=${campaignPage + 1}&limit=${campaignRowsPerPage}`);

        if (response.data.success) {
          setCampaigns(response.data.data.campaigns || []);
          setCampaignTotal(response.data.data.total || 0);
        }
      } catch (error) {
        console.error('Error loading campaigns:', error);
        enqueueSnackbar(t('admin.remoteConfig.campaigns.loadError'), { variant: 'error' });
      } finally {
        setCampaignLoading(false);
      }
    };

    // Create campaign
    const handleCreateCampaign = async () => {
      try {
        const response = await api.post('/campaigns', campaignFormData);

        if (response.data.success) {
          enqueueSnackbar(t('admin.remoteConfig.campaigns.createSuccess'), { variant: 'success' });
          setCreateCampaignDialogOpen(false);
          setCampaignFormData({
            campaignName: '',
            description: '',
            startDate: '',
            endDate: '',
            priority: 0,
            status: 'draft',
            targetConditions: {},
            isActive: true
          });
          loadCampaigns();
        }
      } catch (error: any) {
        console.error('Error creating campaign:', error);
        const errorMessage = error.response?.data?.message || t('admin.remoteConfig.campaigns.createError');
        enqueueSnackbar(errorMessage, { variant: 'error' });
      }
    };

    // Edit campaign
    const handleEditCampaign = async () => {
      try {
        const response = await api.put(`/campaigns/${selectedCampaign.id}`, campaignFormData);

        if (response.data.success) {
          enqueueSnackbar(t('admin.remoteConfig.campaigns.updateSuccess'), { variant: 'success' });
          setEditCampaignDialogOpen(false);
          setSelectedCampaign(null);
          loadCampaigns();
        }
      } catch (error: any) {
        console.error('Error updating campaign:', error);
        const errorMessage = error.response?.data?.message || t('admin.remoteConfig.campaigns.updateError');
        enqueueSnackbar(errorMessage, { variant: 'error' });
      }
    };

    // Delete campaign
    const handleDeleteCampaign = async (campaign: any) => {
      try {
        const response = await api.delete(`/campaigns/${campaign.id}`);

        if (response.data.success) {
          enqueueSnackbar(t('admin.remoteConfig.campaigns.deleteSuccess'), { variant: 'success' });
          loadCampaigns();
        }
      } catch (error: any) {
        console.error('Error deleting campaign:', error);
        const errorMessage = error.response?.data?.message || t('admin.remoteConfig.campaigns.deleteError');
        enqueueSnackbar(errorMessage, { variant: 'error' });
      }
    };

    // Load campaigns on mount and page change
    useEffect(() => {
      loadCampaigns();
    }, [campaignPage, campaignRowsPerPage]);

    return (
      <Paper sx={{ p: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6" color="text.primary">
            {t('admin.remoteConfig.campaigns.title')}
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateCampaignDialogOpen(true)}
          >
            {t('admin.remoteConfig.campaigns.createCampaign')}
          </Button>
        </Box>

        {/* Campaigns Table */}
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>{t('admin.remoteConfig.campaigns.campaignName')}</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{t('admin.remoteConfig.description')}</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{t('admin.remoteConfig.campaigns.startDate')}</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{t('admin.remoteConfig.campaigns.endDate')}</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="center">{t('admin.remoteConfig.status')}</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="center">{t('admin.remoteConfig.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {campaignLoading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : campaigns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      {t('admin.remoteConfig.campaigns.noCampaigns')}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                campaigns.map((campaign) => (
                  <TableRow key={campaign.id}>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium" color="text.primary">
                        {campaign.campaignName}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.primary">
                        {campaign.description || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {campaign.startDate ? formatDateTimeDetailed(campaign.startDate) : '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {campaign.endDate ? formatDateTimeDetailed(campaign.endDate) : '-'}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={campaign.isActive ? t('admin.remoteConfig.active') : t('admin.remoteConfig.inactive')}
                        color={campaign.isActive ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Stack direction="row" spacing={0.5} justifyContent="center">
                        <Tooltip title={t('common.edit')}>
                          <IconButton
                            size="small"
                            onClick={() => {
                              setSelectedCampaign(campaign);
                              setCampaignFormData({
                                campaignName: campaign.campaignName,
                                description: campaign.description || '',
                                startDate: campaign.startDate || '',
                                endDate: campaign.endDate || '',
                                priority: campaign.priority || 0,
                                status: campaign.status || 'draft',
                                targetConditions: campaign.targetConditions || {},
                                isActive: campaign.isActive
                              });
                              setEditCampaignDialogOpen(true);
                            }}
                            sx={{ border: '1px solid', borderColor: 'divider' }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t('common.delete')}>
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteCampaign(campaign)}
                            sx={{ border: '1px solid', borderColor: 'divider' }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination */}
        <SimplePagination
          page={campaignPage}
          rowsPerPage={campaignRowsPerPage}
          count={Math.ceil(campaignTotal / campaignRowsPerPage)}
          onPageChange={(_, newPage) => setCampaignPage(newPage - 1)}
          onRowsPerPageChange={(e) => {
            setCampaignRowsPerPage(parseInt(e.target.value));
            setCampaignPage(0);
          }}
          rowsPerPageOptions={[5, 10, 25, 50]}
        />

        {/* Create Campaign Dialog */}
        <Dialog
          open={createCampaignDialogOpen}
          onClose={() => setCreateCampaignDialogOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            <Box>
              <Typography variant="h6" component="div" color="text.primary">
                {t('admin.remoteConfig.campaigns.createCampaign')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {t('admin.remoteConfig.campaigns.createCampaignSubtitle')}
              </Typography>
            </Box>
          </DialogTitle>
          <DialogContent>
            <Stack spacing={3} sx={{ mt: 1 }}>
              <TextField
                fullWidth
                label={t('admin.remoteConfig.campaigns.campaignName')}
                value={campaignFormData.campaignName}
                onChange={(e) => setCampaignFormData({ ...campaignFormData, campaignName: e.target.value })}
                required
                helperText={t('admin.remoteConfig.campaigns.campaignNameHelp')}
              />
              <TextField
                fullWidth
                label={t('admin.remoteConfig.description')}
                value={campaignFormData.description}
                onChange={(e) => setCampaignFormData({ ...campaignFormData, description: e.target.value })}
                multiline
                rows={3}
                required
                helperText="캠페인의 목적과 내용을 간단히 설명해주세요"
              />
              <TextField
                fullWidth
                label={t('admin.remoteConfig.campaigns.startDate')}
                type="datetime-local"
                value={campaignFormData.startDate}
                onChange={(e) => setCampaignFormData({ ...campaignFormData, startDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
                helperText={t('admin.remoteConfig.campaigns.startDateHelp')}
              />
              <TextField
                fullWidth
                label={t('admin.remoteConfig.campaigns.endDate')}
                type="datetime-local"
                value={campaignFormData.endDate}
                onChange={(e) => setCampaignFormData({ ...campaignFormData, endDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
                helperText={t('admin.remoteConfig.campaigns.endDateHelp')}
              />
              <TextField
                fullWidth
                label={t('admin.remoteConfig.campaigns.priority')}
                type="number"
                value={campaignFormData.priority}
                onChange={(e) => setCampaignFormData({ ...campaignFormData, priority: parseInt(e.target.value) || 0 })}
                helperText={t('admin.remoteConfig.campaigns.priorityHelp')}
              />
              <TextField
                fullWidth
                select
                label={t('admin.remoteConfig.campaigns.status')}
                value={campaignFormData.status}
                onChange={(e) => setCampaignFormData({ ...campaignFormData, status: e.target.value as any })}
              >
                <MenuItem value="draft">{t('admin.remoteConfig.campaigns.statusDraft')}</MenuItem>
                <MenuItem value="scheduled">{t('admin.remoteConfig.campaigns.statusScheduled')}</MenuItem>
                <MenuItem value="running">{t('admin.remoteConfig.campaigns.statusRunning')}</MenuItem>
                <MenuItem value="paused">{t('admin.remoteConfig.campaigns.statusPaused')}</MenuItem>
                <MenuItem value="completed">{t('admin.remoteConfig.campaigns.statusCompleted')}</MenuItem>
              </TextField>
              <FormControlLabel
                control={
                  <Switch
                    checked={campaignFormData.isActive}
                    onChange={(e) => setCampaignFormData({ ...campaignFormData, isActive: e.target.checked })}
                  />
                }
                label={t('admin.remoteConfig.active')}
              />

              <TargetConditionBuilder
                conditions={campaignFormData.targetConditions?.conditions || []}
                onChange={(conditions) => setCampaignFormData({
                  ...campaignFormData,
                  targetConditions: {
                    ...campaignFormData.targetConditions,
                    conditions
                  }
                })}
              />

              {/* Override Configurations Section */}
              <Box>
                <Typography variant="h6" gutterBottom color="text.primary">
                  {t('admin.remoteConfig.campaigns.overrideConfigs')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {t('admin.remoteConfig.campaigns.overrideConfigsHelp')}
                </Typography>

                {campaignFormData.overrideConfigs.map((override, index) => (
                  <Box key={index} sx={{ mb: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <FormControl sx={{ minWidth: 200 }}>
                        <InputLabel>{t('admin.remoteConfig.campaigns.selectConfig')}</InputLabel>
                        <Select
                          value={override.configId || ''}
                          onChange={(e) => {
                            const selectedConfig = configs.find(c => c.id === e.target.value);
                            const newOverrides = [...campaignFormData.overrideConfigs];
                            newOverrides[index] = {
                              ...override,
                              configId: e.target.value as number,
                              configName: selectedConfig?.keyName || ''
                            };
                            setCampaignFormData({ ...campaignFormData, overrideConfigs: newOverrides });
                          }}
                          label={t('admin.remoteConfig.campaigns.selectConfig')}
                        >
                          {configs.map((config) => (
                            <MenuItem key={config.id} value={config.id}>
                              {config.keyName}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>

                      <TextField
                        label={t('admin.remoteConfig.campaigns.overrideValue')}
                        value={override.overrideValue}
                        onChange={(e) => {
                          const newOverrides = [...campaignFormData.overrideConfigs];
                          newOverrides[index] = { ...override, overrideValue: e.target.value };
                          setCampaignFormData({ ...campaignFormData, overrideConfigs: newOverrides });
                        }}
                        sx={{ flexGrow: 1 }}
                      />

                      <IconButton
                        onClick={() => {
                          const newOverrides = campaignFormData.overrideConfigs.filter((_, i) => i !== index);
                          setCampaignFormData({ ...campaignFormData, overrideConfigs: newOverrides });
                        }}
                        color="error"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Stack>
                  </Box>
                ))}

                {campaignFormData.overrideConfigs.length === 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                    {t('admin.remoteConfig.campaigns.noOverrides')}
                  </Typography>
                )}

                <Button
                  startIcon={<AddIcon />}
                  onClick={() => {
                    setCampaignFormData({
                      ...campaignFormData,
                      overrideConfigs: [
                        ...campaignFormData.overrideConfigs,
                        { configId: 0, configName: '', overrideValue: '' }
                      ]
                    });
                  }}
                  variant="outlined"
                  sx={{ mt: 1 }}
                >
                  {t('admin.remoteConfig.campaigns.addOverride')}
                </Button>
              </Box>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => setCreateCampaignDialogOpen(false)}
              startIcon={<CancelIcon />}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="contained"
              onClick={handleCreateCampaign}
              disabled={!campaignFormData.campaignName.trim() || !campaignFormData.description.trim()}
              startIcon={<SaveIcon />}
            >
              {t('common.create')}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Edit Campaign Dialog */}
        <Dialog
          open={editCampaignDialogOpen}
          onClose={() => setEditCampaignDialogOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>{t('admin.remoteConfig.campaigns.editCampaign')}</DialogTitle>
          <DialogContent>
            <Stack spacing={3} sx={{ mt: 1 }}>
              <TextField
                fullWidth
                label={t('admin.remoteConfig.campaigns.campaignName')}
                value={campaignFormData.campaignName}
                onChange={(e) => setCampaignFormData({ ...campaignFormData, campaignName: e.target.value })}
                required
              />
              <TextField
                fullWidth
                label={t('admin.remoteConfig.description')}
                value={campaignFormData.description}
                onChange={(e) => setCampaignFormData({ ...campaignFormData, description: e.target.value })}
                multiline
                rows={3}
              />
              <TextField
                fullWidth
                label={t('admin.remoteConfig.campaigns.startDate')}
                type="datetime-local"
                value={campaignFormData.startDate}
                onChange={(e) => setCampaignFormData({ ...campaignFormData, startDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                fullWidth
                label={t('admin.remoteConfig.campaigns.endDate')}
                type="datetime-local"
                value={campaignFormData.endDate}
                onChange={(e) => setCampaignFormData({ ...campaignFormData, endDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                fullWidth
                label={t('admin.remoteConfig.campaigns.priority')}
                type="number"
                value={campaignFormData.priority}
                onChange={(e) => setCampaignFormData({ ...campaignFormData, priority: parseInt(e.target.value) || 0 })}
                helperText={t('admin.remoteConfig.campaigns.priorityHelp')}
              />
              <TextField
                fullWidth
                select
                label={t('admin.remoteConfig.campaigns.status')}
                value={campaignFormData.status}
                onChange={(e) => setCampaignFormData({ ...campaignFormData, status: e.target.value as any })}
              >
                <MenuItem value="draft">{t('admin.remoteConfig.campaigns.statusDraft')}</MenuItem>
                <MenuItem value="scheduled">{t('admin.remoteConfig.campaigns.statusScheduled')}</MenuItem>
                <MenuItem value="running">{t('admin.remoteConfig.campaigns.statusRunning')}</MenuItem>
                <MenuItem value="paused">{t('admin.remoteConfig.campaigns.statusPaused')}</MenuItem>
                <MenuItem value="completed">{t('admin.remoteConfig.campaigns.statusCompleted')}</MenuItem>
              </TextField>
              <FormControlLabel
                control={
                  <Switch
                    checked={campaignFormData.isActive}
                    onChange={(e) => setCampaignFormData({ ...campaignFormData, isActive: e.target.checked })}
                  />
                }
                label={t('admin.remoteConfig.active')}
              />

              <TargetConditionBuilder
                conditions={campaignFormData.targetConditions?.conditions || []}
                onChange={(conditions) => setCampaignFormData({
                  ...campaignFormData,
                  targetConditions: {
                    ...campaignFormData.targetConditions,
                    conditions
                  }
                })}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditCampaignDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="contained"
              onClick={handleEditCampaign}
              disabled={!campaignFormData.campaignName.trim()}
            >
              {t('common.save')}
            </Button>
          </DialogActions>
        </Dialog>
      </Paper>
    );
  };

  // Conditions Tab Component
  const ConditionsTab = () => {
    const [conditions, setConditions] = useState<any[]>([]);
    const [conditionLoading, setConditionLoading] = useState(true);
    const [createConditionDialogOpen, setCreateConditionDialogOpen] = useState(false);
    const [conditionFormData, setConditionFormData] = useState({
      name: '',
      description: '',
      conditions: [] as any[]
    });

    const loadConditions = async () => {
      try {
        setConditionLoading(true);
        // TODO: API 호출로 조건 목록 로드
        setConditions([]);
      } catch (error) {
        console.error('Error loading conditions:', error);
      } finally {
        setConditionLoading(false);
      }
    };

    useEffect(() => {
      loadConditions();
    }, []);

    const handleCreateCondition = async () => {
      try {
        // TODO: API 호출로 조건 생성
        console.log('Creating condition:', conditionFormData);
        setCreateConditionDialogOpen(false);
        setConditionFormData({ name: '', description: '', conditions: [] });
        loadConditions();
      } catch (error) {
        console.error('Error creating condition:', error);
      }
    };

    return (
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6" color="text.primary">
            {t('admin.remoteConfig.conditions.title')}
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateConditionDialogOpen(true)}
          >
            {t('admin.remoteConfig.conditions.createCondition')}
          </Button>
        </Box>

        {conditionLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : conditions.length === 0 ? (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              {t('admin.remoteConfig.conditions.noConditions')}
            </Typography>
          </Paper>
        ) : (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t('admin.remoteConfig.conditions.name')}</TableCell>
                  <TableCell>{t('admin.remoteConfig.description')}</TableCell>
                  <TableCell>{t('admin.remoteConfig.conditions.conditionsCount')}</TableCell>
                  <TableCell align="center">{t('admin.remoteConfig.actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {conditions.map((condition) => (
                  <TableRow key={condition.id}>
                    <TableCell>{condition.name}</TableCell>
                    <TableCell>{condition.description}</TableCell>
                    <TableCell>{condition.conditions?.length || 0}</TableCell>
                    <TableCell align="center">
                      <IconButton size="small">
                        <EditIcon />
                      </IconButton>
                      <IconButton size="small" color="error">
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Create Condition Dialog */}
        <Dialog
          open={createConditionDialogOpen}
          onClose={() => setCreateConditionDialogOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            <Box>
              <Typography variant="h6" component="div" color="text.primary">
                {t('admin.remoteConfig.conditions.createCondition')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {t('admin.remoteConfig.conditions.createConditionSubtitle')}
              </Typography>
            </Box>
          </DialogTitle>
          <DialogContent>
            <Stack spacing={3} sx={{ mt: 1 }}>
              <TextField
                fullWidth
                label={t('admin.remoteConfig.conditions.name')}
                value={conditionFormData.name}
                onChange={(e) => setConditionFormData({ ...conditionFormData, name: e.target.value })}
                required
                helperText={t('admin.remoteConfig.conditions.nameHelp')}
              />
              <TextField
                fullWidth
                label={t('admin.remoteConfig.description')}
                value={conditionFormData.description}
                onChange={(e) => setConditionFormData({ ...conditionFormData, description: e.target.value })}
                multiline
                rows={2}
                required
                helperText={t('admin.remoteConfig.conditions.descriptionHelp')}
              />

              <TargetConditionBuilder
                conditions={conditionFormData.conditions}
                onChange={(conditions) => setConditionFormData({ ...conditionFormData, conditions })}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => setCreateConditionDialogOpen(false)}
              startIcon={<CancelIcon />}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="contained"
              onClick={handleCreateCondition}
              disabled={!conditionFormData.name.trim() || !conditionFormData.description.trim()}
              startIcon={<SaveIcon />}
            >
              {t('common.create')}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    );
  };

  // Variants Tab Component
  const VariantsTab = () => {
    const [selectedConfig, setSelectedConfig] = useState<RemoteConfig | null>(null);
    const [variants, setVariants] = useState<any[]>([]);
    const [variantLoading, setVariantLoading] = useState(false);
    const [createVariantDialogOpen, setCreateVariantDialogOpen] = useState(false);
    const [editVariantDialogOpen, setEditVariantDialogOpen] = useState(false);
    const [selectedVariant, setSelectedVariant] = useState<any>(null);
    const [variantFormData, setVariantFormData] = useState({
      variantName: '',
      value: '',
      trafficPercentage: 0,
      isActive: true
    });

    // Load variants for selected config
    const loadVariants = async (configId: number) => {
      try {
        setVariantLoading(true);
        const response = await api.get(`/campaigns/configs/${configId}/variants`);

        if (response.data.success) {
          setVariants(response.data.data.variants || []);
        }
      } catch (error) {
        console.error('Error loading variants:', error);
        enqueueSnackbar(t('admin.remoteConfig.variants.loadError'), { variant: 'error' });
      } finally {
        setVariantLoading(false);
      }
    };

    // Create variant
    const handleCreateVariant = async () => {
      if (!selectedConfig) return;

      try {
        const response = await api.post(`/campaigns/configs/${selectedConfig.id}/variants`, variantFormData);

        if (response.data.success) {
          enqueueSnackbar(t('admin.remoteConfig.variants.createSuccess'), { variant: 'success' });
          setCreateVariantDialogOpen(false);
          setVariantFormData({
            variantName: '',
            value: '',
            trafficPercentage: 0,
            isActive: true
          });
          loadVariants(selectedConfig.id);
        }
      } catch (error: any) {
        console.error('Error creating variant:', error);
        const errorMessage = error.response?.data?.message || t('admin.remoteConfig.variants.createError');
        enqueueSnackbar(errorMessage, { variant: 'error' });
      }
    };

    // Edit variant
    const handleEditVariant = async () => {
      if (!selectedConfig || !selectedVariant) return;

      try {
        const response = await api.put(`/campaigns/configs/${selectedConfig.id}/variants/${selectedVariant.id}`, variantFormData);

        if (response.data.success) {
          enqueueSnackbar(t('admin.remoteConfig.variants.updateSuccess'), { variant: 'success' });
          setEditVariantDialogOpen(false);
          setSelectedVariant(null);
          loadVariants(selectedConfig.id);
        }
      } catch (error: any) {
        console.error('Error updating variant:', error);
        const errorMessage = error.response?.data?.message || t('admin.remoteConfig.variants.updateError');
        enqueueSnackbar(errorMessage, { variant: 'error' });
      }
    };

    // Delete variant
    const handleDeleteVariant = async (variant: any) => {
      if (!selectedConfig) return;

      try {
        const response = await api.delete(`/campaigns/configs/${selectedConfig.id}/variants/${variant.id}`);

        if (response.data.success) {
          enqueueSnackbar(t('admin.remoteConfig.variants.deleteSuccess'), { variant: 'success' });
          loadVariants(selectedConfig.id);
        }
      } catch (error: any) {
        console.error('Error deleting variant:', error);
        const errorMessage = error.response?.data?.message || t('admin.remoteConfig.variants.deleteError');
        enqueueSnackbar(errorMessage, { variant: 'error' });
      }
    };

    return (
      <Paper sx={{ p: 3 }}>
        {/* Config Selection */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }} color="text.primary">
            {t('admin.remoteConfig.variants.title')}
          </Typography>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>{t('admin.remoteConfig.variants.selectConfig')}</InputLabel>
            <Select
              value={selectedConfig?.id || ''}
              onChange={(e) => {
                const config = configs.find(c => c.id === e.target.value);
                setSelectedConfig(config || null);
                if (config) {
                  loadVariants(config.id);
                }
              }}
              label={t('admin.remoteConfig.variants.selectConfig')}
            >
              {configs.map((config) => (
                <MenuItem key={config.id} value={config.id}>
                  {config.keyName} ({config.valueType})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {selectedConfig ? (
          <>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="subtitle1" color="text.primary">
                {selectedConfig.keyName}의 변형
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setCreateVariantDialogOpen(true)}
              >
                {t('admin.remoteConfig.variants.createVariant')}
              </Button>
            </Box>

            {/* Variants Table */}
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>{t('admin.remoteConfig.variants.variantName')}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{t('admin.remoteConfig.defaultValue')}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="center">{t('admin.remoteConfig.variants.trafficPercentage')}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="center">{t('admin.remoteConfig.status')}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="center">{t('admin.remoteConfig.actions')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {variantLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                        <CircularProgress />
                      </TableCell>
                    </TableRow>
                  ) : variants.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                        <Typography variant="body2" color="text.secondary">
                          {t('admin.remoteConfig.variants.noVariants')}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    variants.map((variant) => (
                      <TableRow key={variant.id}>
                        <TableCell>
                          <Typography variant="body2" fontWeight="medium" color="text.primary">
                            {variant.variantName}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace' }} color="text.primary">
                            {truncateValue(variant.value, 'string')}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={`${variant.trafficPercentage}%`}
                            color="primary"
                            size="small"
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={variant.isActive ? t('admin.remoteConfig.active') : t('admin.remoteConfig.inactive')}
                            color={variant.isActive ? 'success' : 'default'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Stack direction="row" spacing={0.5} justifyContent="center">
                            <Tooltip title={t('common.edit')}>
                              <IconButton
                                size="small"
                                onClick={() => {
                                  setSelectedVariant(variant);
                                  setVariantFormData({
                                    variantName: variant.variantName,
                                    value: variant.value || '',
                                    trafficPercentage: variant.trafficPercentage,
                                    isActive: variant.isActive
                                  });
                                  setEditVariantDialogOpen(true);
                                }}
                                sx={{ border: '1px solid', borderColor: 'divider' }}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={t('common.delete')}>
                              <IconButton
                                size="small"
                                onClick={() => handleDeleteVariant(variant)}
                                sx={{ border: '1px solid', borderColor: 'divider' }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Create Variant Dialog */}
            <Dialog
              open={createVariantDialogOpen}
              onClose={() => setCreateVariantDialogOpen(false)}
              maxWidth="md"
              fullWidth
            >
              <DialogTitle>{t('admin.remoteConfig.variants.createVariant')}</DialogTitle>
              <DialogContent>
                <Stack spacing={3} sx={{ mt: 1 }}>
                  <TextField
                    fullWidth
                    label={t('admin.remoteConfig.variants.variantName')}
                    value={variantFormData.variantName}
                    onChange={(e) => setVariantFormData({ ...variantFormData, variantName: e.target.value })}
                    required
                  />
                  <TextField
                    fullWidth
                    label={t('admin.remoteConfig.defaultValue')}
                    value={variantFormData.value}
                    onChange={(e) => setVariantFormData({ ...variantFormData, value: e.target.value })}
                    multiline
                    rows={4}
                    helperText={t('admin.remoteConfig.variants.valueHelp')}
                  />
                  <TextField
                    fullWidth
                    label={t('admin.remoteConfig.variants.trafficPercentage')}
                    type="number"
                    value={variantFormData.trafficPercentage}
                    onChange={(e) => setVariantFormData({ ...variantFormData, trafficPercentage: parseFloat(e.target.value) || 0 })}
                    inputProps={{ min: 0, max: 100, step: 0.1 }}
                    helperText={t('admin.remoteConfig.variants.trafficHelp')}
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={variantFormData.isActive}
                        onChange={(e) => setVariantFormData({ ...variantFormData, isActive: e.target.checked })}
                      />
                    }
                    label={t('admin.remoteConfig.active')}
                  />
                </Stack>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setCreateVariantDialogOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button
                  variant="contained"
                  onClick={handleCreateVariant}
                  disabled={!variantFormData.variantName.trim()}
                >
                  {t('common.create')}
                </Button>
              </DialogActions>
            </Dialog>

            {/* Edit Variant Dialog */}
            <Dialog
              open={editVariantDialogOpen}
              onClose={() => setEditVariantDialogOpen(false)}
              maxWidth="md"
              fullWidth
            >
              <DialogTitle>{t('admin.remoteConfig.variants.editVariant')}</DialogTitle>
              <DialogContent>
                <Stack spacing={3} sx={{ mt: 1 }}>
                  <TextField
                    fullWidth
                    label={t('admin.remoteConfig.variants.variantName')}
                    value={variantFormData.variantName}
                    onChange={(e) => setVariantFormData({ ...variantFormData, variantName: e.target.value })}
                    required
                  />
                  <TextField
                    fullWidth
                    label={t('admin.remoteConfig.defaultValue')}
                    value={variantFormData.value}
                    onChange={(e) => setVariantFormData({ ...variantFormData, value: e.target.value })}
                    multiline
                    rows={4}
                    helperText={t('admin.remoteConfig.variants.valueHelp')}
                  />
                  <TextField
                    fullWidth
                    label={t('admin.remoteConfig.variants.trafficPercentage')}
                    type="number"
                    value={variantFormData.trafficPercentage}
                    onChange={(e) => setVariantFormData({ ...variantFormData, trafficPercentage: parseFloat(e.target.value) || 0 })}
                    inputProps={{ min: 0, max: 100, step: 0.1 }}
                    helperText={t('admin.remoteConfig.variants.trafficHelp')}
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={variantFormData.isActive}
                        onChange={(e) => setVariantFormData({ ...variantFormData, isActive: e.target.checked })}
                      />
                    }
                    label={t('admin.remoteConfig.active')}
                  />
                </Stack>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setEditVariantDialogOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button
                  variant="contained"
                  onClick={handleEditVariant}
                  disabled={!variantFormData.variantName.trim()}
                >
                  {t('common.save')}
                </Button>
              </DialogActions>
            </Dialog>
          </>
        ) : (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body2" color="text.secondary">
              {t('admin.remoteConfig.variants.selectConfigFirst')}
            </Typography>
          </Box>
        )}
      </Paper>
    );
  };

  // Show value detail
  const showValueDetail = (title: string, value: string, type: string) => {
    setValueDetailContent({ title, value, type });
    setValueDetailOpen(true);
  };

  // Truncate complex values
  const truncateValue = (value: string, type: string, maxLength: number = 50) => {
    if (!value) return '-';

    if (type === 'json' || type === 'yaml') {
      try {
        // Try to parse and format
        const parsed = JSON.parse(value);
        const formatted = JSON.stringify(parsed, null, 2);
        if (formatted.length > maxLength) {
          return formatted.substring(0, maxLength) + '...';
        }
        return formatted;
      } catch {
        // If parsing fails, just truncate
        if (value.length > maxLength) {
          return value.substring(0, maxLength) + '...';
        }
        return value;
      }
    }

    if (value.length > maxLength) {
      return value.substring(0, maxLength) + '...';
    }
    return value;
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      keyName: '',
      defaultValue: '',
      valueType: 'string',
      description: '',
      isActive: true,
    });
    setFormErrors({});
    setSelectedConfig(null);
  };

  // Open edit dialog
  const openEditDialog = (config: RemoteConfig) => {
    setSelectedConfig(config);
    setFormData({
      keyName: config.keyName,
      defaultValue: config.defaultValue || '',
      valueType: config.valueType,
      description: config.description || '',
      isActive: config.isActive,
    });
    setEditDialogOpen(true);
  };

  // Get value type color
  const getValueTypeColor = (type: string) => {
    switch (type) {
      case 'string': return 'primary';
      case 'number': return 'secondary';
      case 'boolean': return 'success';
      case 'json': return 'warning';
      case 'yaml': return 'info';
      default: return 'default';
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ mb: 1 }} color="text.primary">
          {t('admin.remoteConfig.title')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('admin.remoteConfig.subtitle')}
        </Typography>

        {/* Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs value={currentTab} onChange={(_, newValue) => setCurrentTab(newValue)}>
            <Tab label={t('admin.remoteConfig.title')} />
            <Tab label={t('admin.remoteConfig.history.title')} />
            <Tab label={t('admin.remoteConfig.campaigns.title')} />
            <Tab label={t('admin.remoteConfig.variants.title')} />
            <Tab label={t('admin.remoteConfig.conditions.title')} />
            <Tab label={t('admin.remoteConfig.contextFields.title')} />
          </Tabs>
        </Box>

        {/* Action Buttons - only show on config tab */}
        {currentTab === 0 && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box>
              {selectedConfigs.length > 0 && (
                <Typography variant="body2" color="text.secondary">
                  {selectedConfigs.length}개 설정 선택됨
                </Typography>
              )}
            </Box>
            <Stack direction="row" spacing={2}>
              <Button
                variant="outlined"
                startIcon={<StageIcon />}
                disabled={selectedConfigs.length === 0}
                onClick={() => setStageDialogOpen(true)}
              >
                {t('admin.remoteConfig.stageChanges')}
              </Button>
              <Button
                variant="contained"
                startIcon={<PublishIcon />}
                color="success"
                onClick={() => {
                  setPublishFormData({
                    deploymentName: generateDeploymentName(),
                    description: ''
                  });
                  setPublishDialogOpen(true);
                }}
              >
                {t('admin.remoteConfig.publishChanges')}
              </Button>
            </Stack>
          </Box>
        )}
      </Box>

      {/* Tab Content */}
      {currentTab === 0 ? (
        <Paper sx={{ p: 3 }}>
        {/* Filters */}
        <Box sx={{ mb: 3 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
            <Box sx={{ flex: 1, minWidth: 200 }}>
              <TextField
                fullWidth
                placeholder={t('admin.remoteConfig.search')}
                value={filters.search || ''}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
            <Box sx={{ minWidth: 150 }}>
              <FormControl fullWidth size="small">
                <InputLabel>{t('admin.remoteConfig.valueType')}</InputLabel>
                <Select
                  value={filters.valueType || ''}
                  onChange={(e) => setFilters({ ...filters, valueType: e.target.value })}
                  label={t('admin.remoteConfig.valueType')}
                >
                  <MenuItem value="">{t('admin.remoteConfig.allTypes')}</MenuItem>
                  <MenuItem value="string">{t('admin.remoteConfig.valueTypes.string')}</MenuItem>
                  <MenuItem value="number">{t('admin.remoteConfig.valueTypes.number')}</MenuItem>
                  <MenuItem value="boolean">{t('admin.remoteConfig.valueTypes.boolean')}</MenuItem>
                  <MenuItem value="json">{t('admin.remoteConfig.valueTypes.json')}</MenuItem>
                  <MenuItem value="yaml">{t('admin.remoteConfig.valueTypes.yaml')}</MenuItem>
                </Select>
              </FormControl>
            </Box>
            <Box sx={{ minWidth: 120 }}>
              <FormControl fullWidth size="small">
                <InputLabel>{t('admin.remoteConfig.status')}</InputLabel>
                <Select
                  value={filters.isActive?.toString() || ''}
                  onChange={(e) => setFilters({
                    ...filters,
                    isActive: e.target.value === '' ? undefined : e.target.value === 'true'
                  })}
                  label={t('admin.remoteConfig.status')}
                >
                  <MenuItem value="">{t('admin.remoteConfig.allStatuses')}</MenuItem>
                  <MenuItem value="true">{t('admin.remoteConfig.active')}</MenuItem>
                  <MenuItem value="false">{t('admin.remoteConfig.inactive')}</MenuItem>
                </Select>
              </FormControl>
            </Box>
            <Stack direction="row" spacing={1}>
              <IconButton
                onClick={loadConfigs}
                disabled={loading}
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                }}
              >
                <RefreshIcon />
              </IconButton>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setCreateDialogOpen(true)}
              >
                {t('admin.remoteConfig.createConfig')}
              </Button>
            </Stack>
          </Stack>
        </Box>



      {/* Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  indeterminate={selectedConfigs.length > 0 && selectedConfigs.length < configs.length}
                  checked={configs.length > 0 && selectedConfigs.length === configs.length}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedConfigs(configs.map(config => config.id));
                    } else {
                      setSelectedConfigs([]);
                    }
                  }}
                />
              </TableCell>
              <TableCell>{t('admin.remoteConfig.keyName')}</TableCell>
              <TableCell>{t('admin.remoteConfig.valueType')}</TableCell>
              <TableCell>{t('admin.remoteConfig.defaultValue')}</TableCell>
              <TableCell>{t('admin.remoteConfig.status')}</TableCell>
              <TableCell>버전 상태</TableCell>
              <TableCell>{t('admin.remoteConfig.description')}</TableCell>
              <TableCell>{t('admin.remoteConfig.updated')}</TableCell>
              <TableCell>{t('admin.remoteConfig.createdBy')}</TableCell>
              <TableCell align="center">{t('admin.remoteConfig.actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {configs.map((config) => (
              <TableRow key={config.id}>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={selectedConfigs.includes(config.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedConfigs([...selectedConfigs, config.id]);
                      } else {
                        setSelectedConfigs(selectedConfigs.filter(id => id !== config.id));
                      }
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontWeight={500} color="text.primary">
                    {config.keyName}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={config.valueType.toUpperCase()}
                    color={getValueTypeColor(config.valueType) as any}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  {config.defaultValue && (config.valueType === 'json' || config.valueType === 'yaml') ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography
                        variant="body2"
                        sx={{
                          maxWidth: 150,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          fontFamily: 'monospace',
                          fontSize: '0.75rem'
                        }}
                      >
                        {truncateValue(config.defaultValue, config.valueType, 30)}
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={() => showValueDetail(
                          `${config.keyName} - ${t('admin.remoteConfig.defaultValue')}`,
                          config.defaultValue,
                          config.valueType
                        )}
                        sx={{ p: 0.5 }}
                      >
                        <VisibilityIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  ) : (
                    <Typography
                      variant="body2"
                      sx={{
                        maxWidth: 200,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        fontFamily: config.valueType === 'string' ? 'inherit' : 'monospace'
                      }}
                    >
                      {config.defaultValue || '-'}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Chip
                    label={config.isActive ? t('admin.remoteConfig.active') : t('admin.remoteConfig.inactive')}
                    color={config.isActive ? 'success' : 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Chip
                    label="Draft"
                    color="warning"
                    size="small"
                    variant="outlined"
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }} color="text.primary">
                    {config.description || '-'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="caption" color="text.secondary">
                    {formatDateTimeDetailed(config.updatedAt)}
                  </Typography>
                </TableCell>
                <TableCell>
                  {config.createdByName ? (
                    <Box>
                      <Typography variant="body2" fontWeight="medium" color="text.primary">
                        {config.createdByName}
                      </Typography>
                      {config.createdByEmail && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          {config.createdByEmail}
                        </Typography>
                      )}
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      -
                    </Typography>
                  )}
                </TableCell>
                <TableCell align="center">
                  <Stack direction="row" spacing={1} justifyContent="center">
                    <Tooltip title={t('common.edit')}>
                      <IconButton size="small" onClick={() => openEditDialog(config)}>
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t('common.delete')}>
                      <IconButton size="small" onClick={() => handleDelete(config)} color="error">
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Pagination */}
        <SimplePagination
          count={total}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={(_, newPage) => setPage(newPage)}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[5, 10, 25, 50, 100]}
        />
      </TableContainer>
        </Paper>
      ) : currentTab === 1 ? (
        <RemoteConfigHistoryPage />
      ) : currentTab === 2 ? (
        <CampaignsTab />
      ) : currentTab === 3 ? (
        <VariantsTab />
      ) : currentTab === 4 ? (
        <ConditionsTab />
      ) : currentTab === 5 ? (
        <ContextFieldsTab />
      ) : null}

      {/* Create Dialog */}
      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="md"
        PaperProps={{
          sx: { width: '80%' }
        }}
      >
        <DialogTitle>
          <Box>
            <Typography variant="h6" component="div" color="text.primary">
              {t('admin.remoteConfig.createConfig')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {t('admin.remoteConfig.createConfigSubtitle')}
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              label={t('admin.remoteConfig.keyName')}
              value={formData.keyName}
              onChange={(e) => setFormData({ ...formData, keyName: e.target.value })}
              required
              error={!!formErrors.keyName}
              helperText={formErrors.keyName || t('admin.remoteConfig.helpTexts.keyNameCreate')}
              autoFocus
            />

            <FormControl fullWidth required>
              <InputLabel>{t('admin.remoteConfig.valueType')}</InputLabel>
              <Select
                value={formData.valueType}
                onChange={(e) => setFormData({ ...formData, valueType: e.target.value as any })}
                label={t('admin.remoteConfig.valueType')}
              >
                <MenuItem value="string">{t('admin.remoteConfig.valueTypes.string')}</MenuItem>
                <MenuItem value="number">{t('admin.remoteConfig.valueTypes.number')}</MenuItem>
                <MenuItem value="boolean">{t('admin.remoteConfig.valueTypes.boolean')}</MenuItem>
                <MenuItem value="json">{t('admin.remoteConfig.valueTypes.json')}</MenuItem>
                <MenuItem value="yaml">{t('admin.remoteConfig.valueTypes.yaml')}</MenuItem>
              </Select>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, ml: 2 }}>
                {t('admin.remoteConfig.helpTexts.valueType')}
              </Typography>
            </FormControl>

            {formData.valueType === 'json' || formData.valueType === 'yaml' ? (
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {t('admin.remoteConfig.defaultValue')} *
                </Typography>
                <CodeEditor
                  value={formData.defaultValue}
                  onChange={(value) => setFormData({ ...formData, defaultValue: value })}
                  language={formData.valueType as 'json' | 'yaml'}
                  height={200}
                />
                <Typography
                  variant="caption"
                  color={formErrors.defaultValue ? 'error' : 'text.secondary'}
                  sx={{ mt: 1, display: 'block' }}
                >
                  {formErrors.defaultValue || t('admin.remoteConfig.helpTexts.defaultValue')}
                </Typography>
              </Box>
            ) : (
              <TextField
                fullWidth
                label={t('admin.remoteConfig.defaultValue')}
                value={formData.defaultValue}
                onChange={(e) => setFormData({ ...formData, defaultValue: e.target.value })}
                required
                error={!!formErrors.defaultValue}
                helperText={formErrors.defaultValue || t('admin.remoteConfig.helpTexts.defaultValue')}
              />
            )}

            <TextField
              fullWidth
              label={t('admin.remoteConfig.description')}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              multiline
              rows={2}
              required
              error={!!formErrors.description}
              helperText={formErrors.description || t('admin.remoteConfig.helpTexts.description')}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setCreateDialogOpen(false)}
            startIcon={<CancelIcon />}
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleCreate}
            variant="contained"
            startIcon={<SaveIcon />}
          >
            {t('common.create')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        maxWidth="md"
        PaperProps={{
          sx: { width: '80%' }
        }}
      >
        <DialogTitle>{t('admin.remoteConfig.editConfig')}</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              label={t('admin.remoteConfig.keyName')}
              value={formData.keyName}
              onChange={(e) => setFormData({ ...formData, keyName: e.target.value })}
              required
              disabled
              error={!!formErrors.keyName}
              helperText={formErrors.keyName || t('admin.remoteConfig.helpTexts.keyNameEdit')}
            />

            <FormControl fullWidth required>
              <InputLabel>{t('admin.remoteConfig.valueType')}</InputLabel>
              <Select
                value={formData.valueType}
                onChange={(e) => setFormData({ ...formData, valueType: e.target.value as any })}
                label={t('admin.remoteConfig.valueType')}
              >
                <MenuItem value="string">{t('admin.remoteConfig.valueTypes.string')}</MenuItem>
                <MenuItem value="number">{t('admin.remoteConfig.valueTypes.number')}</MenuItem>
                <MenuItem value="boolean">{t('admin.remoteConfig.valueTypes.boolean')}</MenuItem>
                <MenuItem value="json">{t('admin.remoteConfig.valueTypes.json')}</MenuItem>
                <MenuItem value="yaml">{t('admin.remoteConfig.valueTypes.yaml')}</MenuItem>
              </Select>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, ml: 2 }}>
                {t('admin.remoteConfig.helpTexts.valueType')}
              </Typography>
            </FormControl>

            {formData.valueType === 'json' || formData.valueType === 'yaml' ? (
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {t('admin.remoteConfig.defaultValue')}
                </Typography>
                <CodeEditor
                  value={formData.defaultValue}
                  onChange={(value) => setFormData({ ...formData, defaultValue: value })}
                  language={formData.valueType as 'json' | 'yaml'}
                  height={200}
                />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  {t('admin.remoteConfig.helpTexts.defaultValue')}
                </Typography>
              </Box>
            ) : (
              <TextField
                fullWidth
                label={t('admin.remoteConfig.defaultValue')}
                value={formData.defaultValue}
                onChange={(e) => setFormData({ ...formData, defaultValue: e.target.value })}
                helperText={t('admin.remoteConfig.helpTexts.defaultValue')}
              />
            )}

            <TextField
              fullWidth
              label={t('admin.remoteConfig.description')}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              multiline
              rows={2}
              helperText={t('admin.remoteConfig.helpTexts.description')}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setEditDialogOpen(false)}
            startIcon={<CancelIcon />}
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleEdit}
            variant="contained"
            startIcon={<SaveIcon />}
          >
            {t('common.update')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={cancelDelete}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {t('admin.remoteConfig.deleteConfirmTitle')}
        </DialogTitle>
        <DialogContent>
          <Typography>
            {configToDelete && t('admin.remoteConfig.confirmDelete', { keyName: configToDelete.keyName })}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={cancelDelete}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={confirmDelete}
            color="error"
            variant="contained"
            startIcon={<DeleteIcon />}
          >
            {t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Value Detail Dialog */}
      <Dialog
        open={valueDetailOpen}
        onClose={() => setValueDetailOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {valueDetailContent.title}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1 }}>
            <CodeEditor
              value={valueDetailContent.value}
              language={valueDetailContent.type === 'json' ? 'json' : 'yaml'}
              onChange={() => {}} // Read-only, no-op
              readOnly={true}
              height="400px"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setValueDetailOpen(false)}>
            {t('common.close')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Stage Configs Dialog */}
      <Dialog
        open={stageDialogOpen}
        onClose={() => setStageDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{t('admin.remoteConfig.stageConfigs')}</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {selectedConfigs.length}개의 선택된 설정을 스테이징합니다.
            </Typography>
            <TextField
              fullWidth
              label={t('admin.remoteConfig.stageDescription')}
              value={stageFormData.description}
              onChange={(e) => setStageFormData({ ...stageFormData, description: e.target.value })}
              multiline
              rows={3}
              placeholder={t('admin.remoteConfig.stageDescriptionPlaceholder')}
              required
              helperText="스테이징하는 이유나 변경 내용을 간단히 설명해주세요."
              error={!stageFormData.description.trim()}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setStageDialogOpen(false)}
            startIcon={<CancelIcon />}
          >
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            onClick={handleStageConfigs}
            disabled={selectedConfigs.length === 0 || !stageFormData.description.trim()}
            startIcon={<StageIcon />}
          >
            {t('admin.remoteConfig.stageConfigs')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Publish Configs Dialog */}
      <Dialog
        open={publishDialogOpen}
        onClose={() => setPublishDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{t('admin.remoteConfig.publishConfigs')}</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {t('admin.remoteConfig.publishConfigsDescription')}
            </Typography>
            <TextField
              fullWidth
              label={t('admin.remoteConfig.deploymentName')}
              value={publishFormData.deploymentName}
              onChange={(e) => setPublishFormData({ ...publishFormData, deploymentName: e.target.value })}
              placeholder={t('admin.remoteConfig.deploymentNamePlaceholder')}
              required
              helperText="배포를 식별할 수 있는 고유한 이름을 입력하세요. (예: v1.2.0_release)"
              error={!publishFormData.deploymentName.trim()}
            />
            <TextField
              fullWidth
              label={t('admin.remoteConfig.deploymentDescription')}
              value={publishFormData.description}
              onChange={(e) => setPublishFormData({ ...publishFormData, description: e.target.value })}
              multiline
              rows={3}
              placeholder={t('admin.remoteConfig.deploymentDescriptionPlaceholder')}
              required
              helperText="이번 배포에 포함된 변경사항이나 목적을 설명해주세요."
              error={!publishFormData.description.trim()}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setPublishDialogOpen(false)}
            startIcon={<CancelIcon />}
          >
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={handlePublishChanges}
            disabled={!publishFormData.deploymentName.trim() || !publishFormData.description.trim()}
            startIcon={<PublishIcon />}
          >
            {t('admin.remoteConfig.publishConfigs')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RemoteConfigPage;
