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


} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import CodeEditor from '@/components/common/CodeEditor';

import SimplePagination from '@/components/common/SimplePagination';
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
  updatedByName?: string;
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
    } catch (error) {
      console.error('Error loading configs:', error);
      toast.error('Failed to load remote configs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfigs();
  }, [page, rowsPerPage, filters]);

  // Handle create config
  const handleCreate = async () => {
    try {
      const response = await fetch('/api/v1/remote-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to create config');
      }

      toast.success('Remote config created successfully');
      setCreateDialogOpen(false);
      resetForm();
      loadConfigs();
    } catch (error) {
      console.error('Error creating config:', error);
      toast.error('Failed to create remote config');
    }
  };

  // Handle edit config
  const handleEdit = async () => {
    if (!selectedConfig) return;

    try {
      const response = await fetch(`/api/v1/remote-config/${selectedConfig.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to update config');
      }

      toast.success('Remote config updated successfully');
      setEditDialogOpen(false);
      resetForm();
      loadConfigs();
    } catch (error) {
      console.error('Error updating config:', error);
      toast.error('Failed to update remote config');
    }
  };

  // Handle delete config
  const handleDelete = async (config: RemoteConfig) => {
    if (!confirm(`Are you sure you want to delete "${config.keyName}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/v1/remote-config/${config.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete config');
      }

      toast.success('Remote config deleted successfully');
      loadConfigs();
    } catch (error) {
      console.error('Error deleting config:', error);
      toast.error('Failed to delete remote config');
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
        <Typography variant="h4" component="h1" sx={{ mb: 1 }}>
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
          </Tabs>
        </Box>

        {/* Action Buttons - only show on config tab */}
        {currentTab === 0 && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
            <Button
              variant="contained"
              startIcon={<PublishIcon />}
              color="success"
            >
              {t('admin.remoteConfig.publishChanges')}
            </Button>
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
              <TableCell>{t('admin.remoteConfig.keyName')}</TableCell>
              <TableCell>{t('admin.remoteConfig.valueType')}</TableCell>
              <TableCell>{t('admin.remoteConfig.defaultValue')}</TableCell>
              <TableCell>{t('admin.remoteConfig.status')}</TableCell>
              <TableCell>{t('admin.remoteConfig.description')}</TableCell>
              <TableCell>{t('admin.remoteConfig.updated')}</TableCell>
              <TableCell align="right">{t('admin.remoteConfig.actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {configs.map((config) => (
              <TableRow key={config.id}>
                <TableCell>
                  <Typography variant="body2" fontWeight={500}>
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
                  <Typography variant="body2" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {config.defaultValue || '-'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={config.isActive ? t('admin.remoteConfig.active') : t('admin.remoteConfig.inactive')}
                    color={config.isActive ? 'success' : 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {config.description || '-'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="caption">
                    {new Date(config.updatedAt).toLocaleDateString()}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={1}>
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => openEditDialog(config)}>
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
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
      ) : (
        <RemoteConfigHistoryPage />
      )}

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{t('admin.remoteConfig.createConfig')}</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              label={t('admin.remoteConfig.keyName')}
              value={formData.keyName}
              onChange={(e) => setFormData({ ...formData, keyName: e.target.value })}
              required
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
              </Box>
            ) : (
              <TextField
                fullWidth
                label={t('admin.remoteConfig.defaultValue')}
                value={formData.defaultValue}
                onChange={(e) => setFormData({ ...formData, defaultValue: e.target.value })}
              />
            )}

            <TextField
              fullWidth
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              multiline
              rows={2}
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
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Edit Remote Config</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              label={t('admin.remoteConfig.keyName')}
              value={formData.keyName}
              onChange={(e) => setFormData({ ...formData, keyName: e.target.value })}
              required
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
              </Box>
            ) : (
              <TextField
                fullWidth
                label={t('admin.remoteConfig.defaultValue')}
                value={formData.defaultValue}
                onChange={(e) => setFormData({ ...formData, defaultValue: e.target.value })}
              />
            )}

            <TextField
              fullWidth
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              multiline
              rows={2}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleEdit} variant="contained">Update</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RemoteConfigPage;
