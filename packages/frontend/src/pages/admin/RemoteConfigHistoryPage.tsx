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
import { toast } from 'react-toastify';
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
      toast.error('Failed to load deployment history');
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

      toast.success('Rollback completed successfully');
      loadDeployments();
      setRollbackDialogOpen(false);
      setRollbackTarget(null);
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
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" component="h2" sx={{ mb: 1 }}>
          {t('admin.remoteConfig.history.title')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('admin.remoteConfig.history.subtitle')}
        </Typography>
      </Box>

      {/* Controls */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" spacing={2} justifyContent="space-between" alignItems="center">
            <Typography variant="h6" component="h3">
              {viewMode === 'deployments' ?
                t('admin.remoteConfig.history.deployments') :
                t('admin.remoteConfig.history.versions')
              }
            </Typography>
            <Stack direction="row" spacing={2}>
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>{t('admin.remoteConfig.history.viewMode')}</InputLabel>
                <Select
                  value={viewMode}
                  onChange={(e) => setViewMode(e.target.value as any)}
                  label={t('admin.remoteConfig.history.viewMode')}
                >
                  <MenuItem value="deployments">{t('admin.remoteConfig.history.deployments')}</MenuItem>
                  <MenuItem value="versions">{t('admin.remoteConfig.history.versions')}</MenuItem>
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
          <CardContent sx={{ p: 0 }}>
            {loading && <LinearProgress />}
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>{t('admin.remoteConfig.history.deployment')}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{t('admin.remoteConfig.description')}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{t('admin.remoteConfig.history.deployedBy')}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{t('admin.remoteConfig.history.deployedAt')}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="center">{t('admin.remoteConfig.history.configsCount')}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="center">{t('admin.remoteConfig.actions')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {deployments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                        <Typography variant="body2" color="text.secondary">
                          {loading ? t('common.loading') : t('admin.remoteConfig.history.noDeployments')}
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
                              label={t('admin.remoteConfig.history.configs')}
                              size="small"
                              variant="outlined"
                              color="primary"
                            />
                          </Badge>
                        </TableCell>
                        <TableCell align="center">
                          <Stack direction="row" spacing={0.5} justifyContent="center">
                            <Tooltip title={t('admin.remoteConfig.history.viewDetails')}>
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
                            <Tooltip title={t('admin.remoteConfig.history.rollback')}>
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
          <CardContent sx={{ p: 0 }}>
            {loading && <LinearProgress />}
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>{t('admin.remoteConfig.history.configId')}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{t('admin.remoteConfig.history.version')}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{t('admin.remoteConfig.status')}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{t('admin.remoteConfig.history.value')}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{t('admin.remoteConfig.history.changeDescription')}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{t('admin.remoteConfig.history.createdBy')}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{t('admin.remoteConfig.history.createdAt')}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="center">{t('admin.remoteConfig.actions')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {versions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                        <Typography variant="body2" color="text.secondary">
                          {loading ? t('common.loading') : t('admin.remoteConfig.history.noVersions')}
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
                          <Tooltip title={t('admin.remoteConfig.history.viewDetails')}>
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
            t('admin.remoteConfig.history.deploymentDetails') :
            t('admin.remoteConfig.history.versionDetails')
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
                      {t('admin.remoteConfig.history.deploymentInfo')}
                    </Typography>
                    <Stack spacing={2}>
                      <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                          {t('admin.remoteConfig.history.deploymentName')}:
                        </Typography>
                        <Typography variant="body1">
                          {selectedItem.deploymentName || `${t('admin.remoteConfig.history.deployment')} #${selectedItem.id}`}
                        </Typography>
                      </Box>

                      <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                          {t('admin.remoteConfig.history.deployedBy')}:
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
                          {t('admin.remoteConfig.history.deployedAt')}:
                        </Typography>
                        <Typography variant="body1">
                          {formatDateTimeDetailed(selectedItem.deployedAt)}
                        </Typography>
                      </Box>

                      <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                          {t('admin.remoteConfig.description')}:
                        </Typography>
                        <Typography variant="body1" color="text.primary">
                          {selectedItem.description || t('admin.remoteConfig.history.noDescription')}
                        </Typography>
                      </Box>
                    </Stack>
                  </Box>

                  <Box>
                    <Typography variant="h6" sx={{ mb: 2 }} color="text.primary">
                      {t('admin.remoteConfig.history.configsSnapshot')}
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
                          t('admin.remoteConfig.history.noSnapshot')
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
                      {t('admin.remoteConfig.history.versionInfo')}
                    </Typography>
                    <Stack spacing={2}>
                      <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                          {t('admin.remoteConfig.history.configKey')}:
                        </Typography>
                        <Typography variant="body1">
                          {selectedItem.configKeyName || `Config #${selectedItem.configId}`}
                        </Typography>
                      </Box>

                      <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                          {t('admin.remoteConfig.history.version')}:
                        </Typography>
                        <Typography variant="body1">
                          v{selectedItem.versionNumber}
                        </Typography>
                      </Box>

                      <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                          {t('admin.remoteConfig.status')}:
                        </Typography>
                        <Chip
                          label={selectedItem.status.toUpperCase()}
                          color={getStatusColor(selectedItem.status) as any}
                          size="small"
                        />
                      </Box>

                      <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                          {t('admin.remoteConfig.createdBy')}:
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
                          {t('admin.remoteConfig.history.createdAt')}:
                        </Typography>
                        <Typography variant="body1">
                          {formatDateTimeDetailed(selectedItem.createdAt)}
                        </Typography>
                      </Box>

                      {selectedItem.publishedAt && (
                        <Box>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                            {t('admin.remoteConfig.history.publishedAt')}:
                          </Typography>
                          <Typography variant="body1">
                            {formatDateTimeDetailed(selectedItem.publishedAt)}
                          </Typography>
                        </Box>
                      )}

                      <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                          {t('admin.remoteConfig.history.changeDescription')}:
                        </Typography>
                        <Typography variant="body1">
                          {selectedItem.changeDescription || t('admin.remoteConfig.history.noDescription')}
                        </Typography>
                      </Box>
                    </Stack>
                  </Box>

                  <Box>
                    <Typography variant="h6" sx={{ mb: 2 }}>
                      {t('admin.remoteConfig.defaultValue')}:
                    </Typography>
                    <Paper sx={{ p: 2, backgroundColor: 'grey.50', maxHeight: 300, overflow: 'auto' }}>
                      <pre style={{ margin: 0, fontSize: '0.875rem', fontFamily: 'monospace' }}>
                        {selectedItem.value || t('admin.remoteConfig.history.noValue')}
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
            롤백 확인
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }} color="text.primary">
            정말로 다음 배포로 롤백하시겠습니까?
          </Typography>
          {rollbackTarget && (
            <Box sx={{
              p: 2,
              bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'grey.50',
              borderRadius: 1
            }}>
              <Typography variant="subtitle2" gutterBottom color="text.primary">
                배포 정보:
              </Typography>
              <Typography variant="body2" color="text.primary">
                <strong>이름:</strong> {rollbackTarget.deploymentName || `배포 #${rollbackTarget.id}`}
              </Typography>
              <Typography variant="body2" color="text.primary">
                <strong>배포일:</strong> {new Date(rollbackTarget.deployedAt).toLocaleString('ko-KR')}
              </Typography>
              <Typography variant="body2" color="text.primary">
                <strong>배포자:</strong> {rollbackTarget.deployedByName || '알 수 없음'}
              </Typography>
              {rollbackTarget.description && (
                <Typography variant="body2" color="text.primary">
                  <strong>설명:</strong> {rollbackTarget.description}
                </Typography>
              )}
            </Box>
          )}
          <Alert severity="warning" sx={{ mt: 2 }}>
            <Typography variant="body2">
              <strong>주의:</strong> 롤백하면 현재 설정이 선택한 배포 시점의 설정으로 되돌아갑니다.
              이 작업은 되돌릴 수 없습니다.
            </Typography>
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setRollbackDialogOpen(false)}
            color="inherit"
            startIcon={<CancelIcon />}
          >
            취소
          </Button>
          <Button
            onClick={confirmRollback}
            color="warning"
            variant="contained"
            startIcon={<RestoreIcon />}
          >
            롤백 실행
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RemoteConfigHistoryPage;
