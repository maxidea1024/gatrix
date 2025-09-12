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
  Checkbox,

  Tooltip,
  Stack,
  Tabs,
  Tab,
  CircularProgress,
  FormControlLabel,
  Switch,
  Badge,
  Alert,
  Divider
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
  Storage as StageIcon,
  Undo as UndoIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  FormatQuote as StringIcon,
  Tag as NumberIcon,
  CheckBox as BooleanIcon,
  DataObject as JsonIcon,
  Article as YamlIcon
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

  // Git-style: Track modified configs (draft status)
  const modifiedConfigs = configs.filter(config => config.status === 'draft');
  const stagedConfigs = configs.filter(config => config.status === 'staged');
  const hasChanges = modifiedConfigs.length > 0 || stagedConfigs.length > 0;

  // Get icon for value type
  const getValueTypeIcon = (valueType: string) => {
    const iconProps = {
      fontSize: 'inherit' as const,
      sx: {
        mr: 0.5,
        fontSize: '0.875rem', // 글자 크기와 비슷하게
        verticalAlign: 'middle'
      }
    };

    switch (valueType) {
      case 'string':
        return <StringIcon {...iconProps} color="primary" title="문자열" />;
      case 'number':
        return <NumberIcon {...iconProps} color="success" title="숫자" />;
      case 'boolean':
        return <BooleanIcon {...iconProps} color="warning" title="불린" />;
      case 'json':
        return <JsonIcon {...iconProps} color="info" title="JSON" />;
      case 'yaml':
        return <YamlIcon {...iconProps} color="secondary" title="YAML" />;
      default:
        return <StringIcon {...iconProps} color="primary" title="문자열" />;
    }
  };
  
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

  // Track original published value for comparison
  const [originalPublishedValue, setOriginalPublishedValue] = useState<string>('');

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

  // Context field delete confirmation dialog state
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState<{
    open: boolean;
    field: any;
  }>({ open: false, field: null });

  // Discard changes dialog state
  const [discardChangesDialogOpen, setDiscardChangesDialogOpen] = useState(false);
  const [selectedDiscardConfigs, setSelectedDiscardConfigs] = useState<number[]>([]);

  // Value detail dialog state
  const [valueDetailOpen, setValueDetailOpen] = useState(false);
  const [valueDetailContent, setValueDetailContent] = useState<{title: string, value: string, type: string}>({title: '', value: '', type: ''});

  // Context field management functions
  const handleDeleteField = (field: any) => {
    setDeleteConfirmDialog({ open: true, field });
  };

  const handleConfirmDelete = async () => {
    const { field } = deleteConfirmDialog;
    if (!field) return;

    try {
      const response = await api.deleteContextField(field.id);
      if (response.success) {
        // loadContextFields(); // This function needs to be defined or removed
        enqueueSnackbar(t('admin.remoteConfig.contextFields.deleteSuccess'), { variant: 'success' });
      } else {
        enqueueSnackbar(t('admin.remoteConfig.contextFields.deleteError'), { variant: 'error' });
      }
    } catch (error) {
      console.error('Error deleting context field:', error);
      enqueueSnackbar(t('admin.remoteConfig.contextFields.deleteError'), { variant: 'error' });
    } finally {
      setDeleteConfirmDialog({ open: false, field: null });
    }
  };

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

      // 기본 파라미터
      const params: Record<string, string> = {
        page: (page + 1).toString(),
        limit: rowsPerPage.toString(),
      };

      // 필터 파라미터 추가 (undefined 값 제외)
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params[key] = String(value);
        }
      });

      const response = await api.get('/admin/remote-config', { params });
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
      await api.post('/admin/remote-config', formData);

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
      await api.put(`/admin/remote-config/${selectedConfig.id}`, formData);

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
      await api.delete(`/admin/remote-config/${configToDelete.id}`);

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

      const response = await api.post('/admin/remote-config/stage', {
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
      console.log('Starting publish...', { publishFormData }); // 디버깅용

      const response = await api.post('/admin/remote-config/publish', {
        deploymentName: publishFormData.deploymentName,
        description: publishFormData.description
      });

      if (response.data.success) {
        enqueueSnackbar(t('admin.remoteConfig.publishSuccess'), { variant: 'success' });
        setPublishDialogOpen(false);
        setPublishFormData({ deploymentName: '', description: '' });
        loadConfigs();
      } else {
        enqueueSnackbar(response.data.message || t('admin.remoteConfig.publishError'), { variant: 'error' });
      }
    } catch (error: any) {
      console.error('Error publishing changes:', error);
      const errorMessage = error.response?.data?.message || t('admin.remoteConfig.publishError');
      enqueueSnackbar(errorMessage, { variant: 'error' });
    }
  };

  // Discard changes handler
  const handleDiscardChanges = async () => {
    try {
      const configsToDiscard = selectedDiscardConfigs.length > 0 ? selectedDiscardConfigs : modifiedConfigs.map(c => c.id);

      for (const configId of configsToDiscard) {
        // Delete draft versions for the config
        await api.delete(`/admin/remote-config/${configId}/versions/draft`);
      }

      enqueueSnackbar(`${configsToDiscard.length}개 설정의 변경사항이 취소되었습니다.`, { variant: 'success' });
      setDiscardChangesDialogOpen(false);
      setSelectedDiscardConfigs([]);

      // Reset form state if currently editing one of the discarded configs
      if (selectedConfig && configsToDiscard.includes(selectedConfig.id)) {
        // Reload the original values for the config
        const originalConfig = configs.find(c => c.id === selectedConfig.id);
        if (originalConfig) {
          try {
            const originalValue = await getOriginalConfigValue(originalConfig.id);
            setFormData({
              keyName: originalConfig.keyName,
              defaultValue: originalValue || originalConfig.defaultValue || '',
              valueType: originalConfig.valueType,
              description: originalConfig.description || '',
              isActive: originalConfig.isActive,
            });
          } catch (error) {
            console.error('Error reloading original values:', error);
            resetForm();
            setEditDialogOpen(false);
          }
        } else {
          resetForm();
          setEditDialogOpen(false);
        }
      }

      // Reload configs to reflect the changes
      await loadConfigs();
    } catch (error: any) {
      console.error('Error discarding changes:', error);
      const errorMessage = error.response?.data?.error?.message || error.message || '변경사항 취소 중 오류가 발생했습니다.';
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
      trafficPercentage: 100,
      status: 'draft' as 'draft' | 'scheduled' | 'running' | 'completed' | 'paused',
      targetConditions: {} as any,
      overrideConfigs: [] as Array<{configId: number, configName: string, overrideValue: string}>,
      isActive: true
    });

    // Load campaigns
    const loadCampaigns = async () => {
      try {
        setCampaignLoading(true);
        const response = await api.get(`/admin/remote-config/campaigns?page=${campaignPage + 1}&limit=${campaignRowsPerPage}`);

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
        // 항상 draft 상태로 생성
        const createData = {
          ...campaignFormData,
          status: 'draft' // 강제로 draft 상태로 설정
        };
        const response = await api.post('/admin/remote-config/campaigns', createData);

        if (response.data.success) {
          enqueueSnackbar(t('admin.remoteConfig.campaigns.createSuccess'), { variant: 'success' });
          setCreateCampaignDialogOpen(false);
          setCampaignFormData({
            campaignName: '',
            description: '',
            startDate: '',
            endDate: '',
            priority: 0,
            trafficPercentage: 100,
            status: 'draft',
            targetConditions: {},
            overrideConfigs: [],
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
        const response = await api.put(`/admin/remote-config/campaigns/${selectedCampaign.id}`, campaignFormData);

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
        const response = await api.delete(`/admin/remote-config/campaigns/${campaign.id}`);

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
                <TableCell sx={{ fontWeight: 600 }} align="center">트래픽 비율</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="center">{t('admin.remoteConfig.status')}</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="center">{t('admin.remoteConfig.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {campaignLoading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : campaigns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
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
                      <Typography variant="body2" color="text.primary" fontWeight="medium">
                        {campaign.trafficPercentage || 100}%
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
                label="트래픽 비율 (%)"
                type="number"
                value={campaignFormData.trafficPercentage}
                onChange={(e) => {
                  const value = parseFloat(e.target.value) || 0;
                  const clampedValue = Math.min(Math.max(value, 0), 100);
                  setCampaignFormData({ ...campaignFormData, trafficPercentage: clampedValue });
                }}
                inputProps={{ min: 0, max: 100, step: 0.01 }}
                helperText="캠페인이 적용될 사용자 비율 (0-100%)"
              />

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

              {/* Divider */}
              <Divider sx={{ my: 3 }} />

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

  // Targeting Tab Component
  const TargetingTab = () => {
    const [targetings, setTargetings] = useState<any[]>([]);
    const [targetingLoading, setTargetingLoading] = useState(true);
    const [createTargetingDialogOpen, setCreateTargetingDialogOpen] = useState(false);
    const [editTargetingDialogOpen, setEditTargetingDialogOpen] = useState(false);
    const [targetingFormData, setTargetingFormData] = useState({
      id: '',
      name: '',
      description: '',
      conditions: [] as any[]
    });

    const loadTargetings = async () => {
      try {
        setTargetingLoading(true);
        // 사전 정의된 타겟팅 목록 로드 (향후 API 연동 예정)
        const predefinedTargetings = [
          {
            id: 'vip_users',
            name: 'VIP 사용자',
            description: '레벨 50 이상이고 프리미엄 구독 중인 사용자',
            conditions: [
              { field: 'userLevel', operator: 'greater_than_or_equal', value: '50' },
              { field: 'isPremium', operator: 'equals', value: 'true' }
            ]
          },
          {
            id: 'new_users',
            name: '신규 사용자',
            description: '가입 후 7일 이내이고 레벨 10 미만인 사용자',
            conditions: [
              { field: 'registrationDays', operator: 'less_than_or_equal', value: '7' },
              { field: 'userLevel', operator: 'less_than', value: '10' }
            ]
          },
          {
            id: 'mobile_users',
            name: '모바일 사용자',
            description: 'iOS 또는 Android 플랫폼 사용자',
            conditions: [
              { field: 'platform', operator: 'in', value: 'ios,android' }
            ]
          }
        ];
        setTargetings(predefinedTargetings);
      } catch (error) {
        console.error('Error loading targetings:', error);
      } finally {
        setTargetingLoading(false);
      }
    };

    useEffect(() => {
      loadTargetings();
    }, []);

    const handleCreateTargeting = async () => {
      try {
        // 타겟팅 생성 (향후 API 연동 예정)
        const newTargeting = {
          id: `custom_${Date.now()}`,
          name: targetingFormData.name,
          description: targetingFormData.description,
          conditions: targetingFormData.conditions,
          isCustom: true,
          createdAt: new Date().toISOString()
        };

        // 임시로 로컬 상태에 추가
        setTargetings(prev => [...prev, newTargeting]);

        setCreateTargetingDialogOpen(false);
        setTargetingFormData({ id: '', name: '', description: '', conditions: [] });

        // 성공 메시지 표시
        setSnackbar({
          open: true,
          message: t('admin.remoteConfig.targeting.createSuccess'),
          severity: 'success'
        });
      } catch (error) {
        console.error('Error creating targeting:', error);
        setSnackbar({
          open: true,
          message: t('admin.remoteConfig.targeting.createError'),
          severity: 'error'
        });
      }
    };

    const handleEditTargeting = (targeting: any) => {
      setTargetingFormData({
        id: targeting.id,
        name: targeting.name,
        description: targeting.description,
        conditions: targeting.conditions || []
      });
      setEditTargetingDialogOpen(true);
    };

    const handleUpdateTargeting = async () => {
      try {
        // 타겟팅 업데이트 (향후 API 연동 예정)
        setTargetings(prev => prev.map(targeting =>
          targeting.id === targetingFormData.id
            ? {
                ...targeting,
                name: targetingFormData.name,
                description: targetingFormData.description,
                conditions: targetingFormData.conditions,
                updatedAt: new Date().toISOString()
              }
            : targeting
        ));

        setEditTargetingDialogOpen(false);
        setTargetingFormData({ id: '', name: '', description: '', conditions: [] });

        // 성공 메시지 표시
        setSnackbar({
          open: true,
          message: t('admin.remoteConfig.targeting.updateSuccess'),
          severity: 'success'
        });
      } catch (error) {
        console.error('Error updating targeting:', error);
        setSnackbar({
          open: true,
          message: t('admin.remoteConfig.targeting.updateError'),
          severity: 'error'
        });
      }
    };

    const handleDeleteTargeting = async (targeting: any) => {
      if (!window.confirm(t('admin.remoteConfig.targeting.deleteConfirm', { name: targeting.name }))) {
        return;
      }

      try {
        // 타겟팅 삭제 (향후 API 연동 예정)
        setTargetings(prev => prev.filter(t => t.id !== targeting.id));

        // 성공 메시지 표시
        setSnackbar({
          open: true,
          message: t('admin.remoteConfig.targeting.deleteSuccess'),
          severity: 'success'
        });
      } catch (error) {
        console.error('Error deleting targeting:', error);
        setSnackbar({
          open: true,
          message: t('admin.remoteConfig.targeting.deleteError'),
          severity: 'error'
        });
      }
    };

    return (
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6" color="text.primary">
            {t('admin.remoteConfig.targeting.title')}
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateTargetingDialogOpen(true)}
          >
            {t('admin.remoteConfig.targeting.createTargeting')}
          </Button>
        </Box>

        {targetingLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : targetings.length === 0 ? (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              {t('admin.remoteConfig.targeting.noTargeting')}
            </Typography>
          </Paper>
        ) : (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t('admin.remoteConfig.targeting.name')}</TableCell>
                  <TableCell>{t('admin.remoteConfig.description')}</TableCell>
                  <TableCell>{t('admin.remoteConfig.targeting.conditionsCount')}</TableCell>
                  <TableCell align="center">{t('admin.remoteConfig.actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {targetings.map((targeting) => (
                  <TableRow key={targeting.id}>
                    <TableCell>{targeting.name}</TableCell>
                    <TableCell>{targeting.description}</TableCell>
                    <TableCell>{targeting.conditions?.length || 0}</TableCell>
                    <TableCell align="center">
                      <Tooltip title={t('common.edit')}>
                        <IconButton
                          size="small"
                          onClick={() => handleEditTargeting(targeting)}
                          sx={{ border: '1px solid', borderColor: 'divider', mr: 1 }}
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('common.delete')}>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteTargeting(targeting)}
                          sx={{ border: '1px solid', borderColor: 'divider' }}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Create Targeting Dialog */}
        <Dialog
          open={createTargetingDialogOpen}
          onClose={() => {
            setCreateTargetingDialogOpen(false);
            setTargetingFormData({ id: '', name: '', description: '', conditions: [] });
          }}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            <Box>
              <Typography variant="h6" component="div" color="text.primary">
                {t('admin.remoteConfig.targeting.createTargeting')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {t('admin.remoteConfig.targeting.createTargetingSubtitle')}
              </Typography>
            </Box>
          </DialogTitle>
          <DialogContent>
            <Stack spacing={3} sx={{ mt: 1 }}>
              <TextField
                fullWidth
                label={t('admin.remoteConfig.targeting.name')}
                value={targetingFormData.name}
                onChange={(e) => setTargetingFormData({ ...targetingFormData, name: e.target.value })}
                required
                helperText={t('admin.remoteConfig.targeting.nameHelp')}
              />
              <TextField
                fullWidth
                label={t('admin.remoteConfig.description')}
                value={targetingFormData.description}
                onChange={(e) => setTargetingFormData({ ...targetingFormData, description: e.target.value })}
                multiline
                rows={2}
                required
                helperText={t('admin.remoteConfig.targeting.descriptionHelp')}
              />

              <TargetConditionBuilder
                conditions={targetingFormData.conditions}
                onChange={(conditions) => setTargetingFormData({ ...targetingFormData, conditions })}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                setCreateTargetingDialogOpen(false);
                setTargetingFormData({ id: '', name: '', description: '', conditions: [] });
              }}
              startIcon={<CancelIcon />}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="contained"
              onClick={handleCreateTargeting}
              disabled={!targetingFormData.name.trim() || !targetingFormData.description.trim()}
              startIcon={<SaveIcon />}
            >
              {t('common.create')}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Edit Targeting Dialog */}
        <Dialog
          open={editTargetingDialogOpen}
          onClose={() => {
            setEditTargetingDialogOpen(false);
            setTargetingFormData({ id: '', name: '', description: '', conditions: [] });
          }}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            <Box>
              <Typography variant="h6" component="div" color="text.primary">
                {t('admin.remoteConfig.targeting.editTargeting')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {t('admin.remoteConfig.targeting.editTargetingSubtitle')}
              </Typography>
            </Box>
          </DialogTitle>
          <DialogContent>
            <Stack spacing={3} sx={{ mt: 1 }}>
              <TextField
                fullWidth
                label={t('admin.remoteConfig.targeting.name')}
                value={targetingFormData.name}
                onChange={(e) => setTargetingFormData({ ...targetingFormData, name: e.target.value })}
                required
                helperText={t('admin.remoteConfig.targeting.nameHelp')}
              />
              <TextField
                fullWidth
                label={t('admin.remoteConfig.description')}
                value={targetingFormData.description}
                onChange={(e) => setTargetingFormData({ ...targetingFormData, description: e.target.value })}
                multiline
                rows={2}
                required
                helperText={t('admin.remoteConfig.targeting.descriptionHelp')}
              />

              <TargetConditionBuilder
                conditions={targetingFormData.conditions}
                onChange={(conditions) => setTargetingFormData({ ...targetingFormData, conditions })}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                setEditTargetingDialogOpen(false);
                setTargetingFormData({ id: '', name: '', description: '', conditions: [] });
              }}
              startIcon={<CancelIcon />}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="contained"
              onClick={handleUpdateTargeting}
              disabled={!targetingFormData.name.trim() || !targetingFormData.description.trim()}
              startIcon={<SaveIcon />}
            >
              {t('common.save')}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    );
  };

  // Context Fields Tab Component
  const ContextFieldsTab = () => {
    const [contextFields, setContextFields] = useState<any[]>([]);
    const [fieldLoading, setFieldLoading] = useState(true);
    const [createFieldDialogOpen, setCreateFieldDialogOpen] = useState(false);
    const [editFieldDialogOpen, setEditFieldDialogOpen] = useState(false);
    const [selectedField, setSelectedField] = useState<any>(null);
    const [fieldFormData, setFieldFormData] = useState({
      key: '',
      name: '',
      description: '',
      type: 'string' as 'string' | 'number' | 'boolean' | 'array',
      defaultValue: '',
      isRequired: false,
      options: [] as string[]
    });

    const loadContextFields = async () => {
      try {
        setFieldLoading(true);
        const response = await api.getContextFields();
        if (response.success) {
          setContextFields(response.data.fields || []);
        } else {
          console.error('Failed to load context fields:', response.message);
        }
      } catch (error) {
        console.error('Error loading context fields:', error);
      } finally {
        setFieldLoading(false);
      }
    };

    useEffect(() => {
      loadContextFields();
    }, []);

    const handleCreateField = async () => {
      try {
        const createData: any = {
          key: fieldFormData.key,
          name: fieldFormData.name,
          description: fieldFormData.description,
          type: fieldFormData.type,
          isRequired: fieldFormData.isRequired,
        };

        // defaultValue 처리 (빈 문자열, false, 0도 유효한 기본값)
        if (fieldFormData.defaultValue !== undefined && fieldFormData.defaultValue !== null) {
          createData.defaultValue = fieldFormData.defaultValue;
        }

        // options가 있을 때만 추가 (array 타입이고 옵션이 있는 경우)
        if (fieldFormData.type === 'array' && fieldFormData.options.length > 0) {
          createData.options = fieldFormData.options.filter(opt => opt.trim());
        }

        const response = await api.createContextField(createData);
        if (response.success) {
          setCreateFieldDialogOpen(false);
          setFieldFormData({ key: '', name: '', description: '', type: 'string', defaultValue: '', isRequired: false, options: [] });
          loadContextFields();
          enqueueSnackbar('컨텍스트 필드가 성공적으로 생성되었습니다.', { variant: 'success' });
        } else {
          console.error('Failed to create context field:', response.message);
          enqueueSnackbar(response.message || '컨텍스트 필드 생성에 실패했습니다.', { variant: 'error' });
        }
      } catch (error) {
        console.error('Error creating context field:', error);
      }
    };

    const handleEditField = (field: any) => {
      setSelectedField(field);
      setFieldFormData({
        key: field.key,
        name: field.name,
        description: field.description,
        type: field.type,
        defaultValue: field.defaultValue || '',
        isRequired: field.isRequired || false,
        options: field.options || []
      });
      setEditFieldDialogOpen(true);
    };

    const handleUpdateField = async () => {
      try {
        if (!selectedField) return;

        const updateData: any = {
          name: fieldFormData.name,
          description: fieldFormData.description,
          isRequired: fieldFormData.isRequired,
        };

        // defaultValue 처리 (빈 문자열, false, 0도 유효한 기본값)
        if (fieldFormData.defaultValue !== undefined && fieldFormData.defaultValue !== null) {
          updateData.defaultValue = fieldFormData.defaultValue;
        }

        // options가 있을 때만 추가 (array 타입이고 옵션이 있는 경우)
        if (fieldFormData.type === 'array' && fieldFormData.options.length > 0) {
          updateData.options = fieldFormData.options.filter(opt => opt.trim());
        }

        const response = await api.updateContextField(selectedField.id, updateData);
        if (response.success) {
          setEditFieldDialogOpen(false);
          setSelectedField(null);
          setFieldFormData({ key: '', name: '', description: '', type: 'string', defaultValue: '', isRequired: false, options: [] });
          loadContextFields();
          enqueueSnackbar('컨텍스트 필드가 성공적으로 수정되었습니다.', { variant: 'success' });
        } else {
          console.error('Failed to update context field:', response.message);
          enqueueSnackbar(response.message || '컨텍스트 필드 수정에 실패했습니다.', { variant: 'error' });
        }
      } catch (error) {
        console.error('Error updating context field:', error);
      }
    };

    const addOption = () => {
      setFieldFormData({
        ...fieldFormData,
        options: [...fieldFormData.options, '']
      });
    };

    const updateOption = (index: number, value: string) => {
      const newOptions = [...fieldFormData.options];
      newOptions[index] = value;
      setFieldFormData({
        ...fieldFormData,
        options: newOptions
      });
    };

    const removeOption = (index: number) => {
      setFieldFormData({
        ...fieldFormData,
        options: fieldFormData.options.filter((_, i) => i !== index)
      });
    };

    return (
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6" color="text.primary">
            {t('admin.remoteConfig.contextFields.title')}
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateFieldDialogOpen(true)}
          >
            {t('admin.remoteConfig.contextFields.createField')}
          </Button>
        </Box>

        {fieldLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : contextFields.length === 0 ? (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              {t('admin.remoteConfig.contextFields.noFields')}
            </Typography>
          </Paper>
        ) : (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t('admin.remoteConfig.contextFields.key')}</TableCell>
                  <TableCell>{t('admin.remoteConfig.contextFields.name')}</TableCell>
                  <TableCell>{t('admin.remoteConfig.contextFields.type')}</TableCell>
                  <TableCell align="center">필수 여부</TableCell>
                  <TableCell>{t('admin.remoteConfig.description')}</TableCell>
                  <TableCell align="center">{t('admin.remoteConfig.actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {contextFields.map((field) => (
                  <TableRow key={field.key}>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium" color="text.primary">
                        {field.key}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.primary">
                        {field.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={field.type} size="small" />
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={field.isRequired ? '필수' : '선택'}
                        size="small"
                        color={field.isRequired ? 'error' : 'default'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.primary">
                        {field.description}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <IconButton size="small" onClick={() => handleEditField(field)}>
                        <EditIcon />
                      </IconButton>
                      <IconButton size="small" color="error" onClick={() => handleDeleteField(field)}>
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Create Context Field Dialog */}
        <Dialog
          open={createFieldDialogOpen}
          onClose={() => setCreateFieldDialogOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            <Box>
              <Typography variant="h6" component="div" color="text.primary">
                {t('admin.remoteConfig.contextFields.createField')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {t('admin.remoteConfig.contextFields.createFieldSubtitle')}
              </Typography>
            </Box>
          </DialogTitle>
          <DialogContent>
            <Stack spacing={3} sx={{ mt: 1 }}>
              <TextField
                fullWidth
                label={t('admin.remoteConfig.contextFields.key')}
                value={fieldFormData.key}
                onChange={(e) => setFieldFormData({ ...fieldFormData, key: e.target.value })}
                required
                helperText={t('admin.remoteConfig.contextFields.keyHelp')}
              />
              <TextField
                fullWidth
                label={t('admin.remoteConfig.contextFields.name')}
                value={fieldFormData.name}
                onChange={(e) => setFieldFormData({ ...fieldFormData, name: e.target.value })}
                required
                helperText={t('admin.remoteConfig.contextFields.nameHelp')}
              />
              <TextField
                fullWidth
                label={t('admin.remoteConfig.description')}
                value={fieldFormData.description}
                onChange={(e) => setFieldFormData({ ...fieldFormData, description: e.target.value })}
                multiline
                rows={2}
                required
                helperText={t('admin.remoteConfig.contextFields.descriptionHelp')}
              />
              <FormControl fullWidth>
                <InputLabel>{t('admin.remoteConfig.contextFields.type')}</InputLabel>
                <Select
                  value={fieldFormData.type}
                  onChange={(e) => setFieldFormData({ ...fieldFormData, type: e.target.value as any })}
                  label={t('admin.remoteConfig.contextFields.type')}
                >
                  <MenuItem value="string">String</MenuItem>
                  <MenuItem value="number">Number</MenuItem>
                  <MenuItem value="boolean">Boolean</MenuItem>
                  <MenuItem value="array">Array</MenuItem>
                </Select>
              </FormControl>

              {/* Default Value Field */}
              {fieldFormData.type === 'boolean' ? (
                <FormControl fullWidth>
                  <InputLabel>기본값</InputLabel>
                  <Select
                    value={fieldFormData.defaultValue}
                    onChange={(e) => setFieldFormData({ ...fieldFormData, defaultValue: e.target.value })}
                    label="기본값"
                  >
                    <MenuItem value="true">True</MenuItem>
                    <MenuItem value="false">False</MenuItem>
                  </Select>
                  <FormHelperText>컨텍스트에서 값을 받지 못했을 때 사용할 기본값</FormHelperText>
                </FormControl>
              ) : (
                <TextField
                  fullWidth
                  label="기본값"
                  value={fieldFormData.defaultValue}
                  onChange={(e) => setFieldFormData({ ...fieldFormData, defaultValue: e.target.value })}
                  type={fieldFormData.type === 'number' ? 'number' : 'text'}
                  helperText="컨텍스트에서 값을 받지 못했을 때 사용할 기본값"
                  placeholder={
                    fieldFormData.type === 'string' ? '예: "default"' :
                    fieldFormData.type === 'number' ? '예: 0' :
                    fieldFormData.type === 'array' ? '예: []' : ''
                  }
                />
              )}

              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Checkbox
                  checked={fieldFormData.isRequired}
                  onChange={(e) => setFieldFormData({ ...fieldFormData, isRequired: e.target.checked })}
                />
                <Typography variant="body2" color="text.primary">
                  필수 필드 (조건 평가 시 반드시 제공되어야 함)
                </Typography>
              </Box>

              {fieldFormData.type === 'array' && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom color="text.primary">
                    {t('admin.remoteConfig.contextFields.options')}
                  </Typography>
                  {fieldFormData.options.map((option, index) => (
                    <Box key={index} sx={{ display: 'flex', gap: 1, mb: 1 }}>
                      <TextField
                        fullWidth
                        size="small"
                        value={option}
                        onChange={(e) => updateOption(index, e.target.value)}
                        placeholder={`Option ${index + 1}`}
                      />
                      <IconButton size="small" color="error" onClick={() => removeOption(index)}>
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  ))}
                  <Button
                    startIcon={<AddIcon />}
                    onClick={addOption}
                    size="small"
                  >
                    {t('admin.remoteConfig.contextFields.addOption')}
                  </Button>
                </Box>
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => setCreateFieldDialogOpen(false)}
              startIcon={<CancelIcon />}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="contained"
              onClick={handleCreateField}
              disabled={!fieldFormData.key.trim() || !fieldFormData.name.trim() || !fieldFormData.description.trim()}
              startIcon={<SaveIcon />}
            >
              {t('common.create')}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Edit Context Field Dialog */}
        <Dialog
          open={editFieldDialogOpen}
          onClose={() => setEditFieldDialogOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>{t('admin.remoteConfig.contextFields.editField')}</DialogTitle>
          <DialogContent>
            <Stack spacing={3} sx={{ mt: 1 }}>
              <TextField
                fullWidth
                label={t('admin.remoteConfig.contextFields.key')}
                value={fieldFormData.key}
                disabled
                helperText="키는 수정할 수 없습니다."
              />
              <TextField
                fullWidth
                label={t('admin.remoteConfig.contextFields.name')}
                value={fieldFormData.name}
                onChange={(e) => setFieldFormData({ ...fieldFormData, name: e.target.value })}
                required
              />
              <TextField
                fullWidth
                label={t('admin.remoteConfig.description')}
                value={fieldFormData.description}
                onChange={(e) => setFieldFormData({ ...fieldFormData, description: e.target.value })}
                multiline
                rows={2}
                required
              />
              {/* Default Value Field - Edit */}
              {fieldFormData.type === 'boolean' ? (
                <FormControl fullWidth>
                  <InputLabel>기본값</InputLabel>
                  <Select
                    value={fieldFormData.defaultValue}
                    onChange={(e) => setFieldFormData({ ...fieldFormData, defaultValue: e.target.value })}
                    label="기본값"
                  >
                    <MenuItem value="true">True</MenuItem>
                    <MenuItem value="false">False</MenuItem>
                  </Select>
                  <FormHelperText>컨텍스트에서 값을 받지 못했을 때 사용할 기본값</FormHelperText>
                </FormControl>
              ) : (
                <TextField
                  fullWidth
                  label="기본값"
                  value={fieldFormData.defaultValue}
                  onChange={(e) => setFieldFormData({ ...fieldFormData, defaultValue: e.target.value })}
                  type={fieldFormData.type === 'number' ? 'number' : 'text'}
                  helperText="컨텍스트에서 값을 받지 못했을 때 사용할 기본값"
                  placeholder={
                    fieldFormData.type === 'string' ? '예: "default"' :
                    fieldFormData.type === 'number' ? '예: 0' :
                    fieldFormData.type === 'array' ? '예: []' : ''
                  }
                />
              )}
              <FormControl fullWidth>
                <InputLabel>{t('admin.remoteConfig.contextFields.type')}</InputLabel>
                <Select
                  value={fieldFormData.type}
                  disabled
                  label={t('admin.remoteConfig.contextFields.type')}
                >
                  <MenuItem value="string">String</MenuItem>
                  <MenuItem value="number">Number</MenuItem>
                  <MenuItem value="boolean">Boolean</MenuItem>
                  <MenuItem value="array">Array</MenuItem>
                </Select>
              </FormControl>

              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Checkbox
                  checked={fieldFormData.isRequired}
                  onChange={(e) => setFieldFormData({ ...fieldFormData, isRequired: e.target.checked })}
                />
                <Typography variant="body2" color="text.primary">
                  필수 필드 (조건 평가 시 반드시 제공되어야 함)
                </Typography>
              </Box>

              {fieldFormData.type === 'array' && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom color="text.primary">
                    {t('admin.remoteConfig.contextFields.options')}
                  </Typography>
                  {fieldFormData.options.map((option, index) => (
                    <Box key={index} sx={{ display: 'flex', gap: 1, mb: 1 }}>
                      <TextField
                        fullWidth
                        size="small"
                        value={option}
                        onChange={(e) => updateOption(index, e.target.value)}
                        placeholder={`Option ${index + 1}`}
                      />
                      <IconButton size="small" color="error" onClick={() => removeOption(index)}>
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  ))}
                  <Button
                    startIcon={<AddIcon />}
                    onClick={addOption}
                    size="small"
                  >
                    {t('admin.remoteConfig.contextFields.addOption')}
                  </Button>
                </Box>
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => setEditFieldDialogOpen(false)}
              startIcon={<CancelIcon />}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="contained"
              onClick={handleUpdateField}
              disabled={!fieldFormData.name.trim() || !fieldFormData.description.trim()}
              startIcon={<SaveIcon />}
            >
              {t('common.update')}
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
        const response = await api.get(`/admin/remote-config/campaigns/configs/${configId}/variants`);

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
        const response = await api.post(`/admin/remote-config/campaigns/configs/${selectedConfig.id}/variants`, variantFormData);

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
        const response = await api.put(`/admin/remote-config/campaigns/configs/${selectedConfig.id}/variants/${selectedVariant.id}`, variantFormData);

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
        const response = await api.delete(`/admin/remote-config/campaigns/configs/${selectedConfig.id}/variants/${variant.id}`);

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

  // Helper function to get original config value
  const getOriginalConfigValue = async (configId: number): Promise<string> => {
    try {
      const response = await api.get(`/admin/remote-config/${configId}/versions`);
      if (response.data.versions && response.data.versions.length > 0) {
        const publishedVersion = response.data.versions.find((v: any) => v.status === 'published');
        if (publishedVersion) {
          return publishedVersion.value || '';
        }
      }
      return '';
    } catch (error) {
      console.error('Error getting original config value:', error);
      return '';
    }
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
    setOriginalPublishedValue('');
  };

  // Open edit dialog
  const openEditDialog = async (config: RemoteConfig) => {
    try {
      setSelectedConfig(config);

      // Get the original published value for comparison
      const originalValue = await getOriginalConfigValue(config.id);
      setOriginalPublishedValue(originalValue);

      // Logic for determining what value to show:
      // 1. If config status is 'published' -> show current value (should be same as published)
      // 2. If config status is 'draft' -> show current draft value
      // 3. Always show what user sees in the list for consistency
      setFormData({
        keyName: config.keyName,
        defaultValue: config.defaultValue || '',
        valueType: config.valueType,
        description: config.description || '',
        isActive: config.isActive,
      });
      setEditDialogOpen(true);
    } catch (error) {
      console.error('Error loading config for edit:', error);
      // Fallback to current config values
      setSelectedConfig(config);
      setOriginalPublishedValue(config.defaultValue || '');
      setFormData({
        keyName: config.keyName,
        defaultValue: config.defaultValue || '',
        valueType: config.valueType,
        description: config.description || '',
        isActive: config.isActive,
      });
      setEditDialogOpen(true);
    }
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
            <Tab label={t('admin.remoteConfig.targeting.title')} />
            <Tab label={t('admin.remoteConfig.contextFields.title')} />
          </Tabs>
        </Box>

        {/* Git-style Action Bar - only show when there are changes */}
        {currentTab === 0 && hasChanges && (
          <Box sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 2,
            p: 2,
            bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(25, 118, 210, 0.04)',
            borderRadius: 1,
            border: (theme) => `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(25, 118, 210, 0.12)'}`
          }}>
            {/* Left side - Change counts */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {modifiedConfigs.length > 0 && (
                <Chip
                  size="small"
                  label={`${modifiedConfigs.length}개 수정됨`}
                  color="warning"
                  variant="outlined"
                />
              )}
              {stagedConfigs.length > 0 && (
                <Chip
                  size="small"
                  label={`${stagedConfigs.length}개 스테이징됨`}
                  color="info"
                  variant="outlined"
                />
              )}
            </Box>

            {/* Right side - Action buttons */}
            <Stack direction="row" spacing={2}>
              {modifiedConfigs.length > 0 && (
                <>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<UndoIcon />}
                    onClick={() => setDiscardChangesDialogOpen(true)}
                    color="error"
                  >
                    변경사항 취소
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<StageIcon />}
                    onClick={() => {
                      setSelectedConfigs(modifiedConfigs.map(c => c.id));
                      setStageDialogOpen(true);
                    }}
                  >
                    변경사항 스테이징
                  </Button>
                </>
              )}
              {stagedConfigs.length > 0 ? (
                <Button
                  variant="contained"
                  size="small"
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
                  설정 배포 ({stagedConfigs.length}개)
                </Button>
              ) : modifiedConfigs.length === 0 && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    💡 배포할 스테이징된 설정이 없습니다.
                  </Typography>
                  <Typography variant="body2" color="primary.main" sx={{ fontWeight: 500 }}>
                    설정을 수정한 후 "변경사항 스테이징"을 먼저 진행하세요.
                  </Typography>
                </Box>
              )}
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
                    label={config.status === 'draft' ? t('admin.remoteConfig.statusDraft') :
                           config.status === 'staged' ? t('admin.remoteConfig.statusStaged') :
                           config.status === 'published' ? t('admin.remoteConfig.statusPublished') :
                           config.status === 'archived' ? t('admin.remoteConfig.statusArchived') :
                           t('admin.remoteConfig.statusDraft')}
                    color={config.status === 'draft' ? 'warning' :
                           config.status === 'staged' ? 'info' :
                           config.status === 'published' ? 'success' :
                           config.status === 'archived' ? 'default' :
                           'warning'}
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
        <TargetingTab />
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
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {t('admin.remoteConfig.editConfig')}
            {selectedConfig && (
              <>
                {selectedConfig.status === 'published' && (
                  <Chip
                    size="small"
                    label="배포됨"
                    color="success"
                    variant="outlined"
                  />
                )}
                {selectedConfig.status === 'draft' && (
                  <Chip
                    size="small"
                    label="수정됨"
                    color="warning"
                    variant="outlined"
                  />
                )}
                {selectedConfig.status === 'draft' && formData.defaultValue === originalPublishedValue && (
                  <Chip
                    size="small"
                    label="원래 값과 동일"
                    color="info"
                    variant="outlined"
                  />
                )}
              </>
            )}
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
                <Box sx={{ position: 'relative' }}>
                  <CodeEditor
                    value={formData.defaultValue}
                    onChange={(value) => setFormData({ ...formData, defaultValue: value })}
                    language={formData.valueType as 'json' | 'yaml'}
                    height={200}
                  />
                  {originalPublishedValue && selectedConfig && (
                    <Tooltip
                      title={
                        selectedConfig.status === 'published'
                          ? '배포된 상태입니다'
                          : formData.defaultValue === originalPublishedValue
                            ? '배포된 값과 동일합니다'
                            : '배포된 값과 다릅니다'
                      }
                    >
                      <Box
                        sx={{
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          backgroundColor: 'background.paper',
                          borderRadius: '50%',
                          width: 24,
                          height: 24,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: 1,
                          zIndex: 10
                        }}
                      >
                        {selectedConfig.status === 'published' ? (
                          <CheckCircleIcon sx={{ fontSize: 16, color: 'success.main' }} />
                        ) : formData.defaultValue === originalPublishedValue ? (
                          <CheckCircleIcon sx={{ fontSize: 16, color: 'success.main' }} />
                        ) : (
                          <WarningIcon sx={{ fontSize: 16, color: 'warning.main' }} />
                        )}
                      </Box>
                    </Tooltip>
                  )}
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  {t('admin.remoteConfig.helpTexts.defaultValue')}
                </Typography>
              </Box>
            ) : (
              <Box sx={{ position: 'relative' }}>
                <TextField
                  fullWidth
                  label={t('admin.remoteConfig.defaultValue')}
                  value={formData.defaultValue}
                  onChange={(e) => setFormData({ ...formData, defaultValue: e.target.value })}
                  helperText={t('admin.remoteConfig.helpTexts.defaultValue')}
                  InputProps={{
                    endAdornment: originalPublishedValue && selectedConfig && (
                      <Tooltip
                        title={
                          selectedConfig.status === 'published'
                            ? '배포된 상태입니다'
                            : formData.defaultValue === originalPublishedValue
                              ? '배포된 값과 동일합니다'
                              : '배포된 값과 다릅니다'
                        }
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', ml: 1 }}>
                          {selectedConfig.status === 'published' ? (
                            <CheckCircleIcon sx={{ fontSize: 20, color: 'success.main' }} />
                          ) : formData.defaultValue === originalPublishedValue ? (
                            <CheckCircleIcon sx={{ fontSize: 20, color: 'success.main' }} />
                          ) : (
                            <WarningIcon sx={{ fontSize: 20, color: 'warning.main' }} />
                          )}
                        </Box>
                      </Tooltip>
                    )
                  }}
                />
              </Box>
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
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>{t('admin.remoteConfig.stageConfigs')}</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2">
                다음 {selectedConfigs.length}개의 설정을 스테이징합니다. 스테이징된 설정은 배포 대기 상태가 됩니다.
              </Typography>
            </Alert>

            {/* Staging targets list */}
            <Box>
              <Typography variant="subtitle1" color="text.primary" sx={{ mb: 2, fontWeight: 600 }}>
                📋 스테이징 대상 설정
              </Typography>
              <Box sx={{
                maxHeight: 300,
                overflow: 'auto',
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)'
              }}>
                {configs.filter(config => selectedConfigs.includes(config.id)).map((config, index) => (
                  <Box
                    key={config.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      p: 2,
                      borderBottom: index < selectedConfigs.length - 1 ? 1 : 0,
                      borderColor: 'divider',
                      '&:hover': {
                        bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)'
                      }
                    }}
                  >
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="subtitle2" color="text.primary" sx={{ fontWeight: 600 }}>
                        {config.keyName}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {config.description || '설명 없음'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                        타입: {config.valueType} | 현재 값: {config.defaultValue || '(없음)'}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                      <Chip
                        size="small"
                        label={config.status === 'draft' ? '수정됨' : config.status}
                        color={config.status === 'draft' ? 'warning' : 'default'}
                        variant="outlined"
                      />
                      <Chip
                        size="small"
                        label={config.isActive ? '활성' : '비활성'}
                        color={config.isActive ? 'success' : 'default'}
                        variant="filled"
                      />
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>

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

            {/* Divider */}
            <Divider sx={{ my: 2 }} />

            {/* Deployment Review Section */}
            <Box>
              <Typography variant="subtitle1" color="text.primary" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                🚀 배포 대상 설정 리뷰
                <Chip
                  size="small"
                  label={`${stagedConfigs.length}개`}
                  color="success"
                  variant="outlined"
                />
              </Typography>

              {stagedConfigs.length > 0 ? (
                <Box sx={{
                  maxHeight: 300,
                  overflow: 'auto',
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)'
                }}>
                  {stagedConfigs.map((config, index) => (
                    <Box
                      key={config.id}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        p: 2,
                        borderBottom: index < stagedConfigs.length - 1 ? 1 : 0,
                        borderColor: 'divider',
                        '&:hover': {
                          bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)'
                        }
                      }}
                    >
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body1" sx={{ fontWeight: 500, mb: 0.5 }}>
                          {config.keyName}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          {config.description || '설명 없음'}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            {getValueTypeIcon(config.valueType)}
                            <Typography variant="caption" sx={{ fontWeight: 500 }}>
                              {config.valueType}
                            </Typography>
                          </Box>
                          <Typography variant="caption" color="text.secondary">
                            현재 값: {config.defaultValue || 'null'}
                          </Typography>
                        </Box>
                      </Box>
                      <Box sx={{ ml: 2 }}>
                        <Chip
                          size="small"
                          label="STAGED"
                          color="warning"
                          variant="filled"
                        />
                      </Box>
                    </Box>
                  ))}
                </Box>
              ) : (
                <Alert severity="info">
                  배포할 스테이징된 설정이 없습니다.
                </Alert>
              )}
            </Box>
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

      {/* 컨텍스트 필드 삭제 확인 다이얼로그 */}
      <Dialog
        open={deleteConfirmDialog.open}
        onClose={() => setDeleteConfirmDialog({ open: false, field: null })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle color="text.primary">
          {t('admin.remoteConfig.contextFields.deleteConfirmTitle')}
        </DialogTitle>
        <DialogContent>
          <Typography color="text.primary">
            {t('admin.remoteConfig.contextFields.deleteConfirmMessage', {
              name: deleteConfirmDialog.field?.name || ''
            })}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setDeleteConfirmDialog({ open: false, field: null })}
            startIcon={<CancelIcon />}
          >
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleConfirmDelete}
            startIcon={<DeleteIcon />}
          >
            {t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 변경사항 취소 다이얼로그 */}
      <Dialog
        open={discardChangesDialogOpen}
        onClose={() => setDiscardChangesDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle color="text.primary">
          변경사항 취소
        </DialogTitle>
        <DialogContent>
          <Typography color="text.primary" sx={{ mb: 2 }}>
            다음 설정들의 변경사항을 취소하시겠습니까? 이 작업은 되돌릴 수 없습니다.
          </Typography>

          {/* Modified configs list */}
          <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
            {modifiedConfigs.map((config) => (
              <Box
                key={config.id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  p: 1,
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  mb: 1,
                  bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)'
                }}
              >
                <Checkbox
                  checked={selectedDiscardConfigs.length === 0 || selectedDiscardConfigs.includes(config.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedDiscardConfigs(prev =>
                        prev.length === 0 ? [config.id] : [...prev.filter(id => id !== config.id), config.id]
                      );
                    } else {
                      setSelectedDiscardConfigs(prev => prev.filter(id => id !== config.id));
                    }
                  }}
                />
                <Box sx={{ flex: 1, ml: 1 }}>
                  <Typography variant="subtitle2" color="text.primary">
                    {config.keyName}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {config.description || '설명 없음'}
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  label="수정됨"
                  color="warning"
                  variant="outlined"
                />
              </Box>
            ))}
          </Box>

          {modifiedConfigs.length === 0 && (
            <Typography color="text.secondary" align="center" sx={{ py: 2 }}>
              취소할 변경사항이 없습니다.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setDiscardChangesDialogOpen(false)}
            startIcon={<CancelIcon />}
          >
            취소
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDiscardChanges}
            disabled={modifiedConfigs.length === 0}
            startIcon={<UndoIcon />}
          >
            변경사항 취소
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RemoteConfigPage;
