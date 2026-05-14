/**
 * Media Asset Browser Dialog
 *
 * A dialog that allows users to browse and select from previously uploaded
 * media assets. Used in FrameEditor to pick images without re-uploading.
 */
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  ImageList,
  ImageListItem,
  ImageListItemBar,
  Chip,
  CircularProgress,
  IconButton,
  Tooltip,
  ToggleButton,
  ToggleButtonGroup,
  Pagination,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  ContentCopy as CopyIcon,
  ViewModule as GridIcon,
  ViewList as ListIcon,
  Image as ImageIcon,
} from '@mui/icons-material';
import SearchTextField from './SearchTextField';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import {
  mediaAssetService,
  MediaAsset,
} from '../../services/mediaAssetService';
import { useDebounce } from '../../hooks/useDebounce';
import { copyToClipboardWithNotification } from '../../utils/clipboard';

interface MediaAssetBrowserDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (cdnUrl: string) => void;
}

// Format file size to KB/MB
const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Get short content type label
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

const MediaAssetBrowserDialog: React.FC<MediaAssetBrowserDialogProps> = ({
  open,
  onClose,
  onSelect,
}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const debouncedSearch = useDebounce(searchTerm, 400);
  const limit = 24;

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / limit)),
    [total]
  );

  const loadAssets = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    try {
      const result = await mediaAssetService.listAssets({
        page,
        limit,
        search: debouncedSearch || undefined,
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
  }, [open, page, debouncedSearch, enqueueSnackbar, t]);

  // Load when dialog opens or params change
  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedId(null);
      setSearchTerm('');
      setPage(1);
    }
  }, [open]);

  const handleSelect = () => {
    if (!selectedId) return;
    const asset = assets.find((a) => a.id === selectedId);
    if (asset) {
      onSelect(asset.cdnUrl);
      onClose();
    }
  };

  const handleDoubleClick = (asset: MediaAsset) => {
    onSelect(asset.cdnUrl);
    onClose();
  };

  const handleCopy = (url: string) => {
    copyToClipboardWithNotification(
      url,
      () =>
        enqueueSnackbar(t('common.copiedToClipboard'), { variant: 'success' }),
      () => enqueueSnackbar(t('common.copyFailed'), { variant: 'error' })
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <ImageIcon />
        {t('mediaAssets.browseTitle')}
      </DialogTitle>
      <DialogContent sx={{ minHeight: 400 }}>
        {/* Search & Controls */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            mb: 2,
            mt: 1,
          }}
        >
          <SearchTextField
            placeholder={t('common.search') as string}
            value={searchTerm}
            onChange={(value) => {
              setSearchTerm(value);
              setPage(1);
            }}
          />
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_, val) => val && setViewMode(val)}
            size="small"
          >
            <ToggleButton value="grid">
              <GridIcon fontSize="small" />
            </ToggleButton>
            <ToggleButton value="list">
              <ListIcon fontSize="small" />
            </ToggleButton>
          </ToggleButtonGroup>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ whiteSpace: 'nowrap' }}
          >
            {total} {t('mediaAssets.assetsCount')}
          </Typography>
        </Box>

        {/* Loading */}
        {loading && (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              minHeight: 200,
            }}
          >
            <CircularProgress />
          </Box>
        )}

        {/* Empty */}
        {!loading && assets.length === 0 && (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              minHeight: 200,
              flexDirection: 'column',
              gap: 1,
            }}
          >
            <ImageIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
            <Typography color="text.secondary">
              {t('mediaAssets.noAssets')}
            </Typography>
          </Box>
        )}

        {/* Grid View */}
        {!loading && assets.length > 0 && viewMode === 'grid' && (
          <ImageList cols={6} gap={8} sx={{ mt: 0 }}>
            {assets.map((asset) => {
              const isSelected = selectedId === asset.id;
              const isVideo = asset.contentType.startsWith('video/');
              return (
                <ImageListItem
                  key={asset.id}
                  onClick={() => setSelectedId(asset.id)}
                  onDoubleClick={() => handleDoubleClick(asset)}
                  sx={{
                    cursor: 'pointer',
                    borderRadius: 1,
                    overflow: 'hidden',
                    border: 2,
                    borderColor: isSelected ? 'primary.main' : 'divider',
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                    '&:hover': {
                      borderColor: isSelected
                        ? 'primary.main'
                        : 'primary.light',
                      boxShadow: 1,
                    },
                    position: 'relative',
                  }}
                >
                  {isVideo ? (
                    <video
                      src={asset.cdnUrl}
                      style={{
                        width: '100%',
                        height: 120,
                        objectFit: 'cover',
                      }}
                      muted
                    />
                  ) : (
                    <img
                      src={asset.cdnUrl}
                      alt={asset.fileName}
                      loading="lazy"
                      style={{
                        width: '100%',
                        height: 120,
                        objectFit: 'cover',
                      }}
                    />
                  )}
                  {isSelected && (
                    <CheckCircleIcon
                      color="primary"
                      sx={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        bgcolor: 'background.paper',
                        borderRadius: '50%',
                        fontSize: 22,
                      }}
                    />
                  )}
                  <ImageListItemBar
                    sx={{
                      '& .MuiImageListItemBar-title': { fontSize: '0.7rem' },
                      '& .MuiImageListItemBar-subtitle': {
                        fontSize: '0.6rem',
                      },
                    }}
                    title={
                      asset.fileName.length > 18
                        ? '...' + asset.fileName.slice(-15)
                        : asset.fileName
                    }
                    subtitle={
                      <Box
                        sx={{
                          display: 'flex',
                          gap: 0.5,
                          alignItems: 'center',
                        }}
                      >
                        <Chip
                          label={getTypeLabel(asset.contentType)}
                          size="small"
                          sx={{
                            height: 16,
                            fontSize: '0.55rem',
                            '& .MuiChip-label': { px: 0.5 },
                          }}
                        />
                        <Typography
                          variant="caption"
                          sx={{ fontSize: '0.55rem' }}
                        >
                          {formatFileSize(asset.size)}
                        </Typography>
                      </Box>
                    }
                    actionIcon={
                      <Tooltip title={t('common.copy')}>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopy(asset.cdnUrl);
                          }}
                          sx={{ color: 'rgba(255,255,255,0.7)' }}
                        >
                          <CopyIcon sx={{ fontSize: 13 }} />
                        </IconButton>
                      </Tooltip>
                    }
                  />
                </ImageListItem>
              );
            })}
          </ImageList>
        )}

        {/* List View */}
        {!loading && assets.length > 0 && viewMode === 'list' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {assets.map((asset) => {
              const isSelected = selectedId === asset.id;
              const isVideo = asset.contentType.startsWith('video/');
              return (
                <Box
                  key={asset.id}
                  onClick={() => setSelectedId(asset.id)}
                  onDoubleClick={() => handleDoubleClick(asset)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    p: 1,
                    borderRadius: 1,
                    cursor: 'pointer',
                    border: 1,
                    borderColor: isSelected ? 'primary.main' : 'divider',
                    bgcolor: isSelected
                      ? 'action.selected'
                      : 'background.paper',
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                >
                  {isVideo ? (
                    <video
                      src={asset.cdnUrl}
                      style={{
                        width: 48,
                        height: 48,
                        objectFit: 'cover',
                        borderRadius: 4,
                      }}
                      muted
                    />
                  ) : (
                    <img
                      src={asset.cdnUrl}
                      alt={asset.fileName}
                      style={{
                        width: 48,
                        height: 48,
                        objectFit: 'cover',
                        borderRadius: 4,
                      }}
                    />
                  )}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" noWrap>
                      {asset.fileName}
                    </Typography>
                    <Box
                      sx={{
                        display: 'flex',
                        gap: 1,
                        alignItems: 'center',
                        mt: 0.25,
                      }}
                    >
                      <Chip
                        label={getTypeLabel(asset.contentType)}
                        size="small"
                        sx={{ height: 18, fontSize: '0.65rem' }}
                      />
                      <Typography variant="caption" color="text.secondary">
                        {formatFileSize(asset.size)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        refs: {asset.refCount}
                      </Typography>
                    </Box>
                  </Box>
                  {isSelected && <CheckCircleIcon color="primary" />}
                </Box>
              );
            })}
          </Box>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
            <Pagination
              count={totalPages}
              page={page}
              onChange={(_, p) => setPage(p)}
              size="small"
              color="primary"
            />
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button
          variant="contained"
          onClick={handleSelect}
          disabled={!selectedId}
        >
          {t('mediaAssets.selectImage')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MediaAssetBrowserDialog;
