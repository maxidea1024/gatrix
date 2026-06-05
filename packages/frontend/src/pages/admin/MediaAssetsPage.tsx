/**
 * Media Assets Administration Page
 *
 * Provides an overview of all uploaded media assets with:
 * - Search and filter capabilities (no Paper frame)
 * - Asset preview with metadata
 * - Referencing banner list per asset
 * - VertMore context menu for actions
 * - GC status visibility (garbage-eligible assets)
 */
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  Menu,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  DeleteSweep as DeleteSweepIcon,
  Refresh as RefreshIcon,
  ContentCopy as CopyIcon,
  Visibility as ViewIcon,
  Info as InfoIcon,
  MoreVert as MoreVertIcon,
  Image as ImageIcon,
} from '@mui/icons-material';
import SearchTextField from '../../components/common/SearchTextField';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import PageHeader from '../../components/common/PageHeader';
import PageContentLoader from '../../components/common/PageContentLoader';
import EmptyPagePlaceholder from '../../components/common/EmptyPagePlaceholder';
import SimplePagination from '../../components/common/SimplePagination';
import {
  mediaAssetService,
  MediaAsset,
  ReferencingBanner,
} from '../../services/mediaAssetService';
import { useDebounce } from '../../hooks/useDebounce';
import { useListRestoration } from '../../hooks/useListRestoration';
import { copyToClipboardWithNotification } from '../../utils/clipboard';
import { useGlobalPageSize } from '../../hooks/useGlobalPageSize';
import {
  formatRelativeTime,
  formatDateTimeDetailed,
} from '../../utils/dateFormat';
import { CopyButton } from '@/components/common/CopyButton';

// Format file size
const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// (date formatting uses shared formatRelativeTime + formatDateTimeDetailed)

// Get short type label
const getTypeLabel = (contentType: string): string => {
  const map: Record<string, string> = {
    'image/jpeg': 'JPG',
    'image/png': 'PNG',
    'image/gif': 'GIF',
    'image/webp': 'WebP',
    'image/svg+xml': 'SVG',
    'image/bmp': 'BMP',
    'video/mp4': 'MP4',
  };
  return map[contentType] || contentType.split('/').pop()?.toUpperCase() || '?';
};

const MediaAssetsPage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const navigate = useNavigate();
  const [rowsPerPage, setRowsPerPage] = useGlobalPageSize();

  // State
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [refStatusFilter, setRefStatusFilter] = useState<
    'all' | 'referenced' | 'garbage'
  >('all');
  const debouncedSearch = useDebounce(searchTerm, 400);

  // Restore list state
  const listState = React.useMemo(
    () => ({ searchTerm, refStatusFilter, page, rowsPerPage }),
    [searchTerm, refStatusFilter, page, rowsPerPage]
  );

  useListRestoration(
    listState,
    (saved) => {
      if (saved.searchTerm !== undefined) setSearchTerm(saved.searchTerm);
      if (saved.refStatusFilter !== undefined)
        setRefStatusFilter(saved.refStatusFilter);
      if (saved.page !== undefined) setPage(saved.page);
      if (saved.rowsPerPage !== undefined) setRowsPerPage(saved.rowsPerPage);
    },
    [loading, assets]
  );

  // Detail dialog
  const [detailAsset, setDetailAsset] = useState<MediaAsset | null>(null);
  const [detailBanners, setDetailBanners] = useState<ReferencingBanner[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<MediaAsset | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Bulk delete unreferenced
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Action menu (VertMore)
  const [actionMenuAnchor, setActionMenuAnchor] = useState<null | HTMLElement>(
    null
  );
  const [actionMenuAsset, setActionMenuAsset] = useState<MediaAsset | null>(
    null
  );

  // Load assets
  const loadAssets = useCallback(async () => {
    setLoading(true);
    try {
      const result = await mediaAssetService.listAssets({
        page: page + 1,
        limit: rowsPerPage,
        search: debouncedSearch || undefined,
        refStatus: refStatusFilter,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });
      setAssets(result.assets);
      setTotal(result.total);
    } catch (error: any) {
      console.error('Failed to load media assets:', error);
      enqueueSnackbar(error?.message || t('mediaAssets.loadError'), {
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, debouncedSearch, refStatusFilter, enqueueSnackbar, t]);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  // Action menu handlers
  const handleActionMenuOpen = (
    event: React.MouseEvent<HTMLElement>,
    asset: MediaAsset
  ) => {
    setActionMenuAnchor(event.currentTarget);
    setActionMenuAsset(asset);
  };

  const handleActionMenuClose = () => {
    setActionMenuAnchor(null);
    setActionMenuAsset(null);
  };

  // Open detail dialog
  const handleViewDetail = async (asset: MediaAsset) => {
    handleActionMenuClose();
    setDetailAsset(asset);
    setDetailLoading(true);
    setDetailBanners([]);
    try {
      const result = await mediaAssetService.getAsset(asset.id);
      setDetailBanners(result.referencingBanners);
    } catch (error: any) {
      console.error('Failed to load asset detail:', error);
      enqueueSnackbar(error?.message || t('mediaAssets.detailError'), {
        variant: 'error',
      });
    } finally {
      setDetailLoading(false);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await mediaAssetService.deleteAsset(deleteTarget.id);
      enqueueSnackbar(t('mediaAssets.deleteSuccess'), { variant: 'success' });
      setDeleteTarget(null);
      loadAssets();
    } catch (error: any) {
      console.error('Failed to delete media asset:', error);
      enqueueSnackbar(error?.message || t('mediaAssets.deleteError'), {
        variant: 'error',
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleCopy = (text: string) => {
    handleActionMenuClose();
    copyToClipboardWithNotification(
      text,
      () =>
        enqueueSnackbar(t('common.copiedToClipboard'), { variant: 'success' }),
      () => enqueueSnackbar(t('common.copyFailed'), { variant: 'error' })
    );
  };

  // Bulk delete unreferenced
  const unreferencedCount = useMemo(
    () => assets.filter((a) => a.refCount === 0).length,
    [assets]
  );

  const handleBulkDeleteUnreferenced = async () => {
    setBulkDeleting(true);
    try {
      const result = await mediaAssetService.bulkDeleteUnreferenced();
      enqueueSnackbar(
        t('mediaAssets.bulkDeleteSuccess', { count: result.deleted }),
        { variant: 'success' }
      );
      setBulkDeleteOpen(false);

      // 삭제된 항목이 있을 때만 목록 새로고침
      if (result.deleted > 0) {
        loadAssets();
      }
    } catch (error: any) {
      console.error('Failed to bulk delete:', error);
      enqueueSnackbar(error?.message || t('mediaAssets.bulkDeleteError'), {
        variant: 'error',
      });
    } finally {
      setBulkDeleting(false);
    }
  };

  return (
    <Box sx={{ px: 2, pb: 2, pt: 1.5 }}>
      <PageHeader
        icon={<ImageIcon />}
        title={t('mediaAssets.title')}
        subtitle={t('mediaAssets.subtitle')}
      />

      {/* Search & Filters — no Paper frame, matching CouponUsagePage */}
      <Box sx={{ mb: 2 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            flexWrap: 'nowrap',
            justifyContent: 'space-between',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              gap: 2,
              alignItems: 'center',
              flexWrap: 'nowrap',
              flexGrow: 1,
              minWidth: 0,
            }}
          >
            <SearchTextField
              placeholder={t('common.search') as string}
              value={searchTerm}
              onChange={(value) => {
                setSearchTerm(value);
                setPage(0);
              }}
            />
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>{t('mediaAssets.refStatusFilter')}</InputLabel>
              <Select
                value={refStatusFilter}
                label={t('mediaAssets.refStatusFilter')}
                onChange={(e) => {
                  setRefStatusFilter(e.target.value as any);
                  setPage(0);
                }}
              >
                <MenuItem value="all">
                  {t('mediaAssets.refStatus.all')}
                </MenuItem>
                <MenuItem value="referenced">
                  {t('mediaAssets.refStatus.referenced')}
                </MenuItem>
                <MenuItem value="garbage">
                  {t('mediaAssets.refStatus.garbage')}
                </MenuItem>
              </Select>
            </FormControl>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Tooltip title={t('mediaAssets.bulkDeleteUnreferenced')}>
              <span>
                <Button
                  size="small"
                  variant="contained"
                  color="error"
                  startIcon={<DeleteSweepIcon />}
                  onClick={() => setBulkDeleteOpen(true)}
                  disabled={loading}
                >
                  {t('mediaAssets.bulkDeleteUnreferenced')}
                </Button>
              </span>
            </Tooltip>
            <Tooltip title={t('common.refresh')}>
              <span>
                <IconButton
                  size="small"
                  onClick={loadAssets}
                  disabled={loading}
                >
                  <RefreshIcon />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        </Box>
      </Box>

      {/* Table */}
      <PageContentLoader loading={loading}>
        {assets.length === 0 ? (
          <EmptyPagePlaceholder message={t('mediaAssets.noAssets')} />
        ) : (
          <Card variant="outlined">
            <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ width: 60, whiteSpace: 'nowrap' }}>
                        {t('mediaAssets.columns.preview')}
                      </TableCell>
                      <TableCell>{t('mediaAssets.columns.fileName')}</TableCell>
                      <TableCell>{t('mediaAssets.columns.type')}</TableCell>
                      <TableCell>{t('mediaAssets.columns.size')}</TableCell>
                      <TableCell>{t('mediaAssets.columns.refCount')}</TableCell>
                      <TableCell>
                        {t('mediaAssets.columns.uploadedBy')}
                      </TableCell>
                      <TableCell>
                        {t('mediaAssets.columns.createdAt')}
                      </TableCell>
                      <TableCell>{t('mediaAssets.columns.status')}</TableCell>
                      <TableCell align="center">
                        {t('mediaAssets.columns.actions')}
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {assets.map((asset) => {
                      const isGarbage =
                        asset.refCount === 0 && asset.gcEligibleAt;
                      return (
                        <TableRow
                          key={asset.id}
                          hover
                          sx={{
                            bgcolor: isGarbage
                              ? 'action.disabledBackground'
                              : undefined,
                          }}
                        >
                          <TableCell sx={{ py: 0.5 }}>
                            {asset.contentType.startsWith('video/') ? (
                              <video
                                src={asset.cdnUrl}
                                style={{
                                  width: 32,
                                  height: 32,
                                  objectFit: 'cover',
                                  borderRadius: 3,
                                }}
                                muted
                              />
                            ) : (
                              <img
                                src={asset.cdnUrl}
                                alt={asset.fileName}
                                style={{
                                  width: 32,
                                  height: 32,
                                  objectFit: 'cover',
                                  borderRadius: 3,
                                }}
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display =
                                    'none';
                                }}
                              />
                            )}
                          </TableCell>
                          <TableCell>
                            <Typography
                              variant="body2"
                              noWrap
                              sx={{
                                maxWidth: 200,
                                cursor: 'pointer',
                                '&:hover': { textDecoration: 'underline' },
                              }}
                              onClick={() => handleViewDetail(asset)}
                            >
                              {asset.fileName}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={getTypeLabel(asset.contentType)}
                              size="small"
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell>{formatFileSize(asset.size)}</TableCell>
                          <TableCell>
                            <Chip
                              label={asset.refCount}
                              size="small"
                              color={asset.refCount > 0 ? 'primary' : 'default'}
                              variant={
                                asset.refCount > 0 ? 'filled' : 'outlined'
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Typography
                              variant="body2"
                              noWrap
                              sx={{ maxWidth: 120 }}
                            >
                              {asset.uploadedBy || '-'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Tooltip
                              title={formatDateTimeDetailed(asset.createdAt)}
                            >
                              <Typography variant="body2" component="span">
                                {formatRelativeTime(asset.createdAt)}
                              </Typography>
                            </Tooltip>
                          </TableCell>
                          <TableCell>
                            {isGarbage ? (
                              <Chip
                                label={t('mediaAssets.status.gcEligible')}
                                size="small"
                                color="warning"
                              />
                            ) : asset.refCount > 0 ? (
                              <Chip
                                label={t('mediaAssets.status.active')}
                                size="small"
                                color="success"
                              />
                            ) : (
                              <Chip
                                label={t('mediaAssets.status.unreferenced')}
                                size="small"
                                color="default"
                              />
                            )}
                          </TableCell>
                          <TableCell align="center">
                            <IconButton
                              size="small"
                              onClick={(e) => handleActionMenuOpen(e, asset)}
                            >
                              <MoreVertIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
              <SimplePagination
                page={page}
                rowsPerPage={rowsPerPage}
                count={total}
                onPageChange={(_, newPage) => setPage(newPage)}
                onRowsPerPageChange={(event) => {
                  setRowsPerPage(Number(event.target.value));
                  setPage(0);
                }}
              />
            </CardContent>
          </Card>
        )}
      </PageContentLoader>

      {/* Action Menu (VertMore) */}
      <Menu
        anchorEl={actionMenuAnchor}
        open={Boolean(actionMenuAnchor)}
        onClose={handleActionMenuClose}
      >
        <MenuItem
          onClick={() => {
            if (actionMenuAsset) handleViewDetail(actionMenuAsset);
          }}
        >
          <ListItemIcon>
            <ViewIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('mediaAssets.viewDetail')}</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (actionMenuAsset) handleCopy(actionMenuAsset.cdnUrl);
          }}
        >
          <ListItemIcon>
            <CopyIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('common.copy')} URL</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => {
            if (actionMenuAsset) {
              setDeleteTarget(actionMenuAsset);
              handleActionMenuClose();
            }
          }}
        >
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText sx={{ color: 'error.main' }}>
            {t('mediaAssets.forceDelete')}
          </ListItemText>
        </MenuItem>
      </Menu>

      {/* Detail Dialog */}
      <Dialog
        open={!!detailAsset}
        onClose={() => setDetailAsset(null)}
        maxWidth="md"
        fullWidth
        sx={{ '& .MuiDialog-paper': { maxWidth: 750 } }}
      >
        {detailAsset && (
          <>
            <DialogTitle>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <InfoIcon />
                {t('mediaAssets.detailTitle')}
              </Box>
            </DialogTitle>
            <DialogContent>
              <Box sx={{ display: 'flex', gap: 3, pt: 1 }}>
                {/* Preview */}
                <Box
                  sx={{
                    flex: '0 0 200px',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'flex-start',
                  }}
                >
                  {detailAsset.contentType.startsWith('video/') ? (
                    <video
                      src={detailAsset.cdnUrl}
                      controls
                      muted
                      style={{
                        maxWidth: '100%',
                        maxHeight: 200,
                        borderRadius: 8,
                      }}
                    />
                  ) : (
                    <img
                      src={detailAsset.cdnUrl}
                      alt={detailAsset.fileName}
                      style={{
                        maxWidth: '100%',
                        maxHeight: 200,
                        borderRadius: 8,
                        objectFit: 'contain',
                      }}
                    />
                  )}
                </Box>

                {/* Metadata */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box
                    sx={{
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: 1,
                      overflow: 'hidden',
                      mb: 2,
                    }}
                  >
                    {[
                      {
                        label: 'ID',
                        value: (
                          <Typography
                            variant="body2"
                            sx={{ fontSize: '0.8rem' }}
                          >
                            {detailAsset.id}
                          </Typography>
                        ),
                      },
                      {
                        label: t('mediaAssets.columns.fileName'),
                        value: detailAsset.fileName,
                      },
                      {
                        label: t('mediaAssets.columns.type'),
                        value: (
                          <Chip
                            label={getTypeLabel(detailAsset.contentType)}
                            size="small"
                            variant="outlined"
                          />
                        ),
                      },
                      {
                        label: t('mediaAssets.columns.size'),
                        value: formatFileSize(detailAsset.size),
                      },
                      {
                        label: 'SHA-256',
                        value: (
                          <Typography
                            variant="body2"
                            sx={{
                              fontSize: '0.75rem',
                              wordBreak: 'break-all',
                              opacity: 0.8,
                            }}
                          >
                            {detailAsset.hash}
                          </Typography>
                        ),
                      },
                      {
                        label: 'CDN URL',
                        value: (
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 0.5,
                            }}
                          >
                            <Typography
                              component="a"
                              href={detailAsset.cdnUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              variant="body2"
                              color="primary"
                              sx={{
                                fontSize: '0.75rem',
                                wordBreak: 'break-all',
                                flex: 1,
                                textDecoration: 'none',
                                '&:hover': { textDecoration: 'underline' },
                              }}
                            >
                              {detailAsset.cdnUrl}
                            </Typography>
                            <CopyButton text={detailAsset.cdnUrl} size={13} />
                          </Box>
                        ),
                      },
                      {
                        label: t('mediaAssets.columns.refCount'),
                        value: (
                          <Chip
                            label={detailAsset.refCount}
                            size="small"
                            color={
                              detailAsset.refCount > 0 ? 'primary' : 'default'
                            }
                          />
                        ),
                      },
                      {
                        label: t('mediaAssets.columns.uploadedBy'),
                        value: detailAsset.uploadedBy || '-',
                      },
                      {
                        label: t('mediaAssets.columns.createdAt'),
                        value: (
                          <Tooltip
                            title={formatDateTimeDetailed(
                              detailAsset.createdAt
                            )}
                          >
                            <Typography variant="body2" component="span">
                              {formatRelativeTime(detailAsset.createdAt)}
                            </Typography>
                          </Tooltip>
                        ),
                      },
                    ].map((row, idx, arr) => (
                      <Box
                        key={idx}
                        sx={{
                          display: 'flex',
                          borderBottom: idx < arr.length - 1 ? 1 : 0,
                          borderColor: 'divider',
                        }}
                      >
                        <Box
                          sx={{
                            width: 120,
                            flexShrink: 0,
                            px: 1.5,
                            py: 1,
                            bgcolor: 'action.hover',
                            display: 'flex',
                            alignItems: 'center',
                            borderRight: 1,
                            borderColor: 'divider',
                          }}
                        >
                          <Typography
                            variant="body2"
                            sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}
                          >
                            {row.label}
                          </Typography>
                        </Box>
                        <Box
                          sx={{
                            flex: 1,
                            px: 1.5,
                            py: 1,
                            display: 'flex',
                            alignItems: 'center',
                            minWidth: 0,
                          }}
                        >
                          {typeof row.value === 'string' ? (
                            <Typography variant="body2">{row.value}</Typography>
                          ) : (
                            row.value
                          )}
                        </Box>
                      </Box>
                    ))}
                  </Box>

                  {/* Referencing Banners */}
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    {t('mediaAssets.referencingBanners')} (
                    {detailBanners.length})
                  </Typography>
                  {detailLoading ? (
                    <CircularProgress size={20} />
                  ) : detailBanners.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      {t('mediaAssets.noReferencingBanners')}
                    </Typography>
                  ) : (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {detailBanners.map((banner) => (
                        <Chip
                          key={banner.bannerId}
                          label={`${banner.name} (${banner.status})`}
                          size="small"
                          variant="outlined"
                          color={
                            banner.status === 'published'
                              ? 'success'
                              : 'default'
                          }
                          onClick={() => {
                            setDetailAsset(null);
                            navigate(
                              `/game/banners?search=${encodeURIComponent(banner.name)}&editId=${banner.bannerId}`
                            );
                          }}
                          sx={{ cursor: 'pointer' }}
                        />
                      ))}
                    </Box>
                  )}
                </Box>
              </Box>
            </DialogContent>
            <DialogActions>
              <Button variant="text" onClick={() => setDetailAsset(null)}>
                {t('common.close')}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        maxWidth="xs"
        fullWidth
      >
        {deleteTarget && (
          <>
            <DialogTitle>{t('mediaAssets.deleteConfirmTitle')}</DialogTitle>
            <DialogContent>
              <Alert severity="warning" sx={{ mb: 2 }}>
                {t('mediaAssets.deleteConfirmMessage')}
              </Alert>
              <Typography variant="body2">
                <strong>{t('mediaAssets.columns.fileName')}:</strong>{' '}
                {deleteTarget.fileName}
              </Typography>
              <Typography variant="body2">
                <strong>{t('mediaAssets.columns.refCount')}:</strong>{' '}
                {deleteTarget.refCount}
              </Typography>
              {deleteTarget.refCount > 0 && (
                <Alert severity="error" sx={{ mt: 1 }}>
                  {t('mediaAssets.deleteActiveWarning')}
                </Alert>
              )}
            </DialogContent>
            <DialogActions>
              <Button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                variant="contained"
              >
                {t('common.cancel')}
              </Button>
              <Button
                variant="text"
                color="error"
                onClick={handleDelete}
                disabled={deleting}
                startIcon={
                  deleting ? <CircularProgress size={16} /> : <DeleteIcon />
                }
              >
                {t('mediaAssets.forceDelete')}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Bulk Delete Unreferenced Confirmation Dialog */}
      <Dialog
        open={bulkDeleteOpen}
        onClose={() => !bulkDeleting && setBulkDeleteOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{t('mediaAssets.bulkDeleteConfirmTitle')}</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            {t('mediaAssets.bulkDeleteConfirmMessage')}
          </Alert>
          <Typography variant="body2">
            {t('mediaAssets.bulkDeleteDescription')}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            variant="contained"
            onClick={() => setBulkDeleteOpen(false)}
            disabled={bulkDeleting}
          >
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleBulkDeleteUnreferenced}
            disabled={bulkDeleting}
            startIcon={
              bulkDeleting ? (
                <CircularProgress size={16} />
              ) : (
                <DeleteSweepIcon />
              )
            }
          >
            {t('mediaAssets.bulkDeleteConfirm')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MediaAssetsPage;
