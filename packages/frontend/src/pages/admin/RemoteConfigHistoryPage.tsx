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
  TablePagination,
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
  Grid,
  Alert,
  Tooltip,
  Stack,
  Card,
  CardContent,
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  TimelineOppositeContent,
} from '@mui/material';
import {
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Visibility as ViewIcon,
  Restore as RestoreIcon,
  CloudUpload as PublishIcon,
  History as HistoryIcon,
  ArrowBack as BackIcon,
  Code as CodeIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import api from '@/services/api';

// Types
interface ConfigVersion {
  id: number;
  configId: number;
  versionNumber: number;
  value: string | null;
  status: 'draft' | 'staged' | 'published' | 'archived';
  changeDescription: string | null;
  publishedAt: string | null;
  createdBy: number | null;
  createdAt: string;
  createdByName?: string;
}

interface Deployment {
  id: number;
  deploymentName: string | null;
  description: string | null;
  configsSnapshot: any;
  deployedBy: number | null;
  deployedAt: string;
  rollbackDeploymentId: number | null;
  deployedByName?: string;
}

const RemoteConfigHistoryPage: React.FC = () => {
  const { t } = useTranslation();
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [versions, setVersions] = useState<ConfigVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [viewMode, setViewMode] = useState<'deployments' | 'versions'>('deployments');
  
  // Dialog states
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Deployment | ConfigVersion | null>(null);

  // Load deployments
  const loadDeployments = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/remote-config/deployments?page=${page + 1}&limit=${rowsPerPage}`);
      setDeployments(response.data.deployments);
      setTotal(response.data.total);
    } catch (error) {
      console.error('Error loading deployments:', error);
      toast.error('Failed to load deployment history');
    } finally {
      setLoading(false);
    }
  };

  // Load versions
  const loadVersions = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/v1/remote-config/versions?page=${page + 1}&limit=${rowsPerPage}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to load versions');
      }

      const data = await response.json();
      setVersions(data.data.versions);
      setTotal(data.data.total);
    } catch (error) {
      console.error('Error loading versions:', error);
      toast.error('Failed to load version history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (viewMode === 'deployments') {
      loadDeployments();
    } else {
      loadVersions();
    }
  }, [page, rowsPerPage, viewMode]);

  // Handle rollback
  const handleRollback = async (deployment: Deployment) => {
    if (!confirm(`Are you sure you want to rollback to deployment "${deployment.deploymentName || deployment.id}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/v1/remote-config/rollback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          deploymentId: deployment.id,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to rollback');
      }

      toast.success('Rollback completed successfully');
      loadDeployments();
    } catch (error) {
      console.error('Error rolling back:', error);
      toast.error('Failed to rollback deployment');
    }
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'default';
      case 'staged': return 'warning';
      case 'published': return 'success';
      case 'archived': return 'secondary';
      default: return 'default';
    }
  };

  // Open detail dialog
  const openDetailDialog = (item: Deployment | ConfigVersion) => {
    setSelectedItem(item);
    setDetailDialogOpen(true);
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            startIcon={<BackIcon />}
            onClick={() => window.location.href = '/admin/remote-config'}
          >
            Back to Remote Config
          </Button>
          <Typography variant="h4" component="h1">
            Remote Config History
          </Typography>
        </Box>
        <Stack direction="row" spacing={2}>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>View Mode</InputLabel>
            <Select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as any)}
              label="View Mode"
            >
              <MenuItem value="deployments">Deployments</MenuItem>
              <MenuItem value="versions">Versions</MenuItem>
            </Select>
          </FormControl>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={viewMode === 'deployments' ? loadDeployments : loadVersions}
          >
            Refresh
          </Button>
        </Stack>
      </Box>

      {/* Deployments View */}
      {viewMode === 'deployments' && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Deployment</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Deployed By</TableCell>
                <TableCell>Deployed At</TableCell>
                <TableCell>Configs Count</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {deployments.map((deployment) => (
                <TableRow key={deployment.id}>
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>
                      {deployment.deploymentName || `Deployment #${deployment.id}`}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {deployment.description || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {deployment.deployedByName || 'System'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {new Date(deployment.deployedAt).toLocaleString()}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={deployment.configsSnapshot ? Object.keys(deployment.configsSnapshot).length : 0}
                      size="small"
                      color="primary"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1}>
                      <Tooltip title="View Details">
                        <IconButton size="small" onClick={() => openDetailDialog(deployment)}>
                          <ViewIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Rollback">
                        <IconButton size="small" onClick={() => handleRollback(deployment)} color="warning">
                          <RestoreIcon />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={total}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={(_, newPage) => setPage(newPage)}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
          />
        </TableContainer>
      )}

      {/* Versions View */}
      {viewMode === 'versions' && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Config ID</TableCell>
                <TableCell>Version</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Value</TableCell>
                <TableCell>Change Description</TableCell>
                <TableCell>Created By</TableCell>
                <TableCell>Created At</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {versions.map((version) => (
                <TableRow key={version.id}>
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>
                      #{version.configId}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      v{version.versionNumber}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={version.status.toUpperCase()}
                      color={getStatusColor(version.status) as any}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {version.value || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {version.changeDescription || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {version.createdByName || 'System'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {new Date(version.createdAt).toLocaleString()}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="View Details">
                      <IconButton size="small" onClick={() => openDetailDialog(version)}>
                        <ViewIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={total}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={(_, newPage) => setPage(newPage)}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
          />
        </TableContainer>
      )}

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onClose={() => setDetailDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {selectedItem && 'deploymentName' in selectedItem ? 'Deployment Details' : 'Version Details'}
        </DialogTitle>
        <DialogContent>
          {selectedItem && (
            <Box sx={{ mt: 2 }}>
              {'deploymentName' in selectedItem ? (
                // Deployment details
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <Typography variant="h6">Deployment Information</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">Name:</Typography>
                    <Typography variant="body1">{selectedItem.deploymentName || `Deployment #${selectedItem.id}`}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">Deployed By:</Typography>
                    <Typography variant="body1">{selectedItem.deployedByName || 'System'}</Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary">Description:</Typography>
                    <Typography variant="body1">{selectedItem.description || 'No description'}</Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary">Deployed At:</Typography>
                    <Typography variant="body1">{new Date(selectedItem.deployedAt).toLocaleString()}</Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="h6" sx={{ mt: 2 }}>Configs Snapshot</Typography>
                    <Paper sx={{ p: 2, mt: 1, backgroundColor: 'grey.50' }}>
                      <pre style={{ margin: 0, fontSize: '0.875rem', overflow: 'auto' }}>
                        {JSON.stringify(selectedItem.configsSnapshot, null, 2)}
                      </pre>
                    </Paper>
                  </Grid>
                </Grid>
              ) : (
                // Version details
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <Typography variant="h6">Version Information</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">Config ID:</Typography>
                    <Typography variant="body1">#{selectedItem.configId}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">Version:</Typography>
                    <Typography variant="body1">v{selectedItem.versionNumber}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">Status:</Typography>
                    <Chip
                      label={selectedItem.status.toUpperCase()}
                      color={getStatusColor(selectedItem.status) as any}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">Created By:</Typography>
                    <Typography variant="body1">{selectedItem.createdByName || 'System'}</Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary">Change Description:</Typography>
                    <Typography variant="body1">{selectedItem.changeDescription || 'No description'}</Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary">Value:</Typography>
                    <Paper sx={{ p: 2, mt: 1, backgroundColor: 'grey.50' }}>
                      <pre style={{ margin: 0, fontSize: '0.875rem', overflow: 'auto' }}>
                        {selectedItem.value || 'No value'}
                      </pre>
                    </Paper>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary">Created At:</Typography>
                    <Typography variant="body1">{new Date(selectedItem.createdAt).toLocaleString()}</Typography>
                  </Grid>
                  {selectedItem.publishedAt && (
                    <Grid item xs={12}>
                      <Typography variant="body2" color="text.secondary">Published At:</Typography>
                      <Typography variant="body1">{new Date(selectedItem.publishedAt).toLocaleString()}</Typography>
                    </Grid>
                  )}
                </Grid>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RemoteConfigHistoryPage;
