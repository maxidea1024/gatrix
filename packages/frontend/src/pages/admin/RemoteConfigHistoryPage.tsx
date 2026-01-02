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
  Grid,
  Alert,
  Tooltip,
  Stack,
  Card,
  CardContent,
  LinearProgress,
  Badge,
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
  Close as CloseIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import api from '@/services/api';
import SimplePagination from '@/components/common/SimplePagination';
import { formatDateTimeDetailed } from '@/utils/dateFormat';

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
  createdByEmail?: string;
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
  deployedByEmail?: string;
}

const RemoteConfigHistoryPage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
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
  const [rollbackDialogOpen, setRollbackDialogOpen] = useState(false);
  const [rollbackTarget, setRollbackTarget] = useState<Deployment | null>(null);

  // Load deployments
  const loadDeployments = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/admin/remote-config/deployments?page=${page + 1}&limit=${rowsPerPage}`);
      setDeployments(response.data.deployments);
      setTotal(response.data.total);
    } catch (error) {
      console.error('Error loading deployments:', error);
      enqueueSnackbar('Failed to load deployment history', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Load versions
  const loadVersions = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/admin/remote-config/versions?page=${page + 1}&limit=${rowsPerPage}`);
      setVersions(response.data.versions);
      setTotal(response.data.total);
    } catch (error) {
      console.error('Error loading versions:', error);
      enqueueSnackbar('Failed to load version history', { variant: 'error' });
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
  const handleRollback = (deployment: Deployment) => {
    setRollbackTarget(deployment);
    setRollbackDialogOpen(true);
  };

  // Confirm rollback
  const confirmRollback = async () => {
    if (!rollbackTarget) return;

    try {
      await api.post('/remote-config/rollback', {
        deploymentId: rollbackTarget.id,
      });

      enqueueSnackbar('Rollback completed successfully', { variant: 'success' });
      loadDeployments();
      setRollbackDialogOpen(false);
      setRollbackTarget(null);
    } catch (error) {
      console.error('Error rolling back:', error);
      enqueueSnackbar('Failed to rollback deployment', { variant: 'error' });
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
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" component="h2" sx={{ mb: 1 }}>
          {t('remoteConfig.history.title')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('remoteConfig.history.subtitle')}
        </Typography>
      </Box>

      {/* Controls */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" spacing={2} justifyContent="space-between" alignItems="center">
            <Typography variant="h6" component="h3">
              {viewMode === 'deployments' ?
                t('remoteConfig.history.deployments') :
                t('remoteConfig.history.versions')
              }
            </Typography>
            <Stack direction="row" spacing={2}>
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>{t('remoteConfig.history.viewMode')}</InputLabel>
                <Select
                  value={viewMode}
                  onChange={(e) => setViewMode(e.target.value as any)}
                  label={t('remoteConfig.history.viewMode')}
                >
                  <MenuItem value="deployments">{t('remoteConfig.history.deployments')}</MenuItem>
                  <MenuItem value="versions">{t('remoteConfig.history.versions')}</MenuItem>
                </Select>
              </FormControl>
              <Button
                variant="outlined"
                onClick={viewMode === 'deployments' ? loadDeployments : loadVersions}
                startIcon={<RefreshIcon />}
                size="small"
              >
                {t('common.refresh')}
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {/* Deployments View */}
      {viewMode === 'deployments' && (
        <Card>
          <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>{t('remoteConfig.history.deployment')}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{t('remoteConfig.description')}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{t('remoteConfig.history.deployedBy')}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{t('remoteConfig.history.deployedAt')}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="center">{t('remoteConfig.history.configsCount')}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="center">{t('remoteConfig.actions')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {deployments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                        <Typography variant="body2" color="text.secondary">
                          {loading ? t('common.loading') : t('remoteConfig.history.noDeployments')}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    deployments.map((deployment) => (
                      <TableRow key={deployment.id} hover>
                        <TableCell>
                          <Typography variant="body2" fontWeight={500}>
                            {deployment.deploymentName || `Deployment #${deployment.id}`}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography
                            variant="body2"
                            sx={{
                              maxWidth: 250,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {deployment.description || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {deployment.deployedByName ? (
                            <Box>
                              <Typography variant="body2" fontWeight="medium">
                                {deployment.deployedByName}
                              </Typography>
                              {deployment.deployedByEmail && (
                                <Typography variant="caption" color="text.secondary">
                                  {deployment.deployedByEmail}
                                </Typography>
                              )}
                            </Box>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              System
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {formatDateTimeDetailed(deployment.deployedAt)}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Badge
                            badgeContent={deployment.configsCount || 0}
                            color="primary"
                            sx={{
                              '& .MuiBadge-badge': {
                                fontSize: '0.75rem',
                                minWidth: '20px',
                                height: '20px'
                              }
                            }}
                          >
                            <Chip
                              label={t('remoteConfig.history.configs')}
                              size="small"
                              variant="outlined"
                              color="primary"
                            />
                          </Badge>
                        </TableCell>
                        <TableCell align="center">
                          <Stack direction="row" spacing={0.5} justifyContent="center">
                            <Tooltip title={t('remoteConfig.history.viewDetails')}>
                              <IconButton
                                size="small"
                                onClick={() => openDetailDialog(deployment)}
                                sx={{
                                  border: '1px solid',
                                  borderColor: 'divider',
                                  '&:hover': { borderColor: 'primary.main' }
                                }}
                              >
                                <ViewIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={t('remoteConfig.history.rollback')}>
                              <IconButton
                                size="small"
                                onClick={() => handleRollback(deployment)}
                                color="warning"
                                sx={{
                                  border: '1px solid',
                                  borderColor: 'divider',
                                  '&:hover': { borderColor: 'warning.main' }
                                }}
                              >
                                <RestoreIcon fontSize="small" />
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
          </CardContent>
        </Card>
      )}

      {/* Versions View */}
      {viewMode === 'versions' && (
        <Card>
          <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>{t('remoteConfig.history.configId')}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{t('remoteConfig.history.version')}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{t('remoteConfig.status')}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{t('remoteConfig.history.value')}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{t('remoteConfig.history.changeDescription')}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{t('remoteConfig.history.createdBy')}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{t('remoteConfig.history.createdAt')}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="center">{t('remoteConfig.actions')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {versions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                        <Typography variant="body2" color="text.secondary">
                          {loading ? t('common.loading') : t('remoteConfig.history.noVersions')}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    versions.map((version) => (
                      <TableRow key={version.id} hover>
                        <TableCell>
                          <Typography variant="body2" fontWeight={500} color="primary">
                            #{version.configId}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={`v${version.versionNumber}`}
                            size="small"
                            variant="outlined"
                            color="default"
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={version.status.toUpperCase()}
                            color={getStatusColor(version.status) as any}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Typography
                            variant="body2"
                            sx={{
                              maxWidth: 150,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              fontFamily: 'monospace',
                              fontSize: '0.75rem'
                            }}
                          >
                            {version.value || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography
                            variant="body2"
                            sx={{
                              maxWidth: 180,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {version.changeDescription || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {version.createdByName ? (
                            <Box>
                              <Typography variant="body2" fontWeight="medium">
                                {version.createdByName}
                              </Typography>
                              {version.createdByEmail && (
                                <Typography variant="caption" color="text.secondary">
                                  {version.createdByEmail}
                                </Typography>
                              )}
                            </Box>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              System
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {formatDateTimeDetailed(version.createdAt)}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Tooltip title={t('remoteConfig.history.viewDetails')}>
                            <IconButton
                              size="small"
                              onClick={() => openDetailDialog(version)}
                              sx={{
                                border: '1px solid',
                                borderColor: 'divider',
                                '&:hover': { borderColor: 'primary.main' }
                              }}
                            >
                              <ViewIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
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
          </CardContent>
        </Card>
      )}

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onClose={() => setDetailDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {selectedItem && 'deploymentName' in selectedItem ?
            t('remoteConfig.history.deploymentDetails') :
            t('remoteConfig.history.versionDetails')
          }
        </DialogTitle>
        <DialogContent>
          {selectedItem && (
            <Box sx={{ mt: 2 }}>
              {'deploymentName' in selectedItem ? (
                // Deployment details - vertical layout
                <Stack spacing={3}>
                  <Box>
                    <Typography variant="h6" sx={{ mb: 2 }}>
                      {t('remoteConfig.history.deploymentInfo')}
                    </Typography>
                    <Stack spacing={2}>
                      <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                          {t('remoteConfig.history.deploymentName')}:
                        </Typography>
                        <Typography variant="body1">
                          {selectedItem.deploymentName || `${t('remoteConfig.history.deployment')} #${selectedItem.id}`}
                        </Typography>
                      </Box>

                      <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                          {t('remoteConfig.history.deployedBy')}:
                        </Typography>
                        <Typography variant="body1">
                          {selectedItem.deployedByName || t('common.system')}
                          {selectedItem.deployedByEmail && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                              {selectedItem.deployedByEmail}
                            </Typography>
                          )}
                        </Typography>
                      </Box>

                      <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                          {t('remoteConfig.history.deployedAt')}:
                        </Typography>
                        <Typography variant="body1">
                          {formatDateTimeDetailed(selectedItem.deployedAt)}
                        </Typography>
                      </Box>

                      <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                          {t('remoteConfig.description')}:
                        </Typography>
                        <Typography variant="body1" color="text.primary">
                          {selectedItem.description || t('remoteConfig.history.noDescription')}
                        </Typography>
                      </Box>
                    </Stack>
                  </Box>

                  <Box>
                    <Typography variant="h6" sx={{ mb: 2 }} color="text.primary">
                      {t('remoteConfig.history.configsSnapshot')}
                    </Typography>
                    <Paper sx={{
                      p: 2,
                      backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'grey.50',
                      maxHeight: 300,
                      overflow: 'auto'
                    }}>
                      <pre style={{
                        margin: 0,
                        fontSize: '0.875rem',
                        fontFamily: 'monospace',
                        color: 'inherit'
                      }}>
                        {selectedItem.configsSnapshot ?
                          JSON.stringify(selectedItem.configsSnapshot, null, 2) :
                          t('remoteConfig.history.noSnapshot')
                        }
                      </pre>
                    </Paper>
                  </Box>
                </Stack>
              ) : (
                // Version details - vertical layout
                <Stack spacing={3}>
                  <Box>
                    <Typography variant="h6" sx={{ mb: 2 }}>
                      {t('remoteConfig.history.versionInfo')}
                    </Typography>
                    <Stack spacing={2}>
                      <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                          {t('remoteConfig.history.configKey')}:
                        </Typography>
                        <Typography variant="body1">
                          {selectedItem.configKeyName || `Config #${selectedItem.configId}`}
                        </Typography>
                      </Box>

                      <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                          {t('remoteConfig.history.version')}:
                        </Typography>
                        <Typography variant="body1">
                          v{selectedItem.versionNumber}
                        </Typography>
                      </Box>

                      <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                          {t('remoteConfig.status')}:
                        </Typography>
                        <Chip
                          label={selectedItem.status.toUpperCase()}
                          color={getStatusColor(selectedItem.status) as any}
                          size="small"
                        />
                      </Box>

                      <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                          {t('remoteConfig.createdBy')}:
                        </Typography>
                        <Typography variant="body1">
                          {selectedItem.createdByName || t('common.system')}
                          {selectedItem.createdByEmail && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                              {selectedItem.createdByEmail}
                            </Typography>
                          )}
                        </Typography>
                      </Box>

                      <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                          {t('remoteConfig.history.createdAt')}:
                        </Typography>
                        <Typography variant="body1">
                          {formatDateTimeDetailed(selectedItem.createdAt)}
                        </Typography>
                      </Box>

                      {selectedItem.publishedAt && (
                        <Box>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                            {t('remoteConfig.history.publishedAt')}:
                          </Typography>
                          <Typography variant="body1">
                            {formatDateTimeDetailed(selectedItem.publishedAt)}
                          </Typography>
                        </Box>
                      )}

                      <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                          {t('remoteConfig.history.changeDescription')}:
                        </Typography>
                        <Typography variant="body1">
                          {selectedItem.changeDescription || t('remoteConfig.history.noDescription')}
                        </Typography>
                      </Box>
                    </Stack>
                  </Box>

                  <Box>
                    <Typography variant="h6" sx={{ mb: 2 }}>
                      {t('remoteConfig.defaultValue')}:
                    </Typography>
                    <Paper sx={{ p: 2, backgroundColor: 'grey.50', maxHeight: 300, overflow: 'auto' }}>
                      <pre style={{ margin: 0, fontSize: '0.875rem', fontFamily: 'monospace' }}>
                        {selectedItem.value || t('remoteConfig.history.noValue')}
                      </pre>
                    </Paper>
                  </Box>
                </Stack>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailDialogOpen(false)} startIcon={<CloseIcon />}>
            {t('common.close')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Rollback Confirmation Dialog */}
      <Dialog
        open={rollbackDialogOpen}
        onClose={() => setRollbackDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Typography variant="h6" color="warning.main">
            Î°§Î∞± ?ïÏù∏
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }} color="text.primary">
            ?ïÎßêÎ°??§Ïùå Î∞∞Ìè¨Î°?Î°§Î∞±?òÏãúÍ≤†Ïäµ?àÍπå?
          </Typography>
          {rollbackTarget && (
            <Box sx={{
              p: 2,
              bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'grey.50',
              borderRadius: 1
            }}>
              <Typography variant="subtitle2" gutterBottom color="text.primary">
                Î∞∞Ìè¨ ?ïÎ≥¥:
              </Typography>
              <Typography variant="body2" color="text.primary">
                <strong>?¥Î¶Ñ:</strong> {rollbackTarget.deploymentName || `Î∞∞Ìè¨ #${rollbackTarget.id}`}
              </Typography>
              <Typography variant="body2" color="text.primary">
                <strong>Î∞∞Ìè¨??</strong> {new Date(rollbackTarget.deployedAt).toLocaleString('ko-KR')}
              </Typography>
              <Typography variant="body2" color="text.primary">
                <strong>Î∞∞Ìè¨??</strong> {rollbackTarget.deployedByName || '?????ÜÏùå'}
              </Typography>
              {rollbackTarget.description && (
                <Typography variant="body2" color="text.primary">
                  <strong>?§Î™Ö:</strong> {rollbackTarget.description}
                </Typography>
              )}
            </Box>
          )}
          <Alert severity="warning" sx={{ mt: 2 }}>
            <Typography variant="body2">
              <strong>Ï£ºÏùò:</strong> Î°§Î∞±?òÎ©¥ ?ÑÏû¨ ?§Ï†ï???†ÌÉù??Î∞∞Ìè¨ ?úÏ†ê???§Ï†ï?ºÎ°ú ?òÎèå?ÑÍ∞ë?àÎã§.
              ???ëÏóÖ?Ä ?òÎèåÎ¶????ÜÏäµ?àÎã§.
            </Typography>
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setRollbackDialogOpen(false)}
            color="inherit"
            startIcon={<CancelIcon />}
          >
            Ï∑®ÏÜå
          </Button>
          <Button
            onClick={confirmRollback}
            color="warning"
            variant="contained"
            startIcon={<RestoreIcon />}
          >
            Î°§Î∞± ?§Ìñâ
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RemoteConfigHistoryPage;
