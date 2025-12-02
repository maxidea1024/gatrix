import React, { useState, useCallback, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  Tooltip,
  FormControlLabel,
  Switch,
  InputAdornment,
  Divider,
  Menu,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  DragIndicator as DragIndicatorIcon,
  Image as ImageIcon,
  BrokenImage as BrokenImageIcon,
  Edit as EditIcon,
  ContentCopy as CopyIcon,
  ContentPaste as PasteIcon,
  FileCopy as DuplicateIcon,
  VerticalAlignTop as MoveFirstIcon,
  VerticalAlignBottom as MoveLastIcon,
  ArrowBack as InsertBeforeIcon,
  ArrowForward as InsertAfterIcon,
  SwapHoriz as ReplaceIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { Frame, FrameType, FrameActionType, FrameEffectType, TransitionType } from '../../services/bannerService';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface FrameEditorProps {
  frame: Frame;
  frameIndex: number;
  totalFrames: number;
  onUpdate: (frame: Frame) => void;
  onDelete: () => void;
  onDuplicateBefore: () => void;
  onDuplicateAfter: () => void;
  onCopy: () => void;
  onPasteBefore: () => void;
  onPasteAfter: () => void;
  onPasteReplace: () => void;
  onMoveFirst: () => void;
  onMoveLast: () => void;
  hasClipboard: boolean;
}

// Auto-detect frame type from URL extension
const detectFrameType = (url: string): FrameType => {
  const ext = url.split('?')[0].split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'jpg';
    case 'png':
      return 'png';
    case 'gif':
      return 'gif';
    case 'mp4':
    case 'webm':
      return 'mp4';
    default:
      return 'png';
  }
};

// Format delay to seconds (e.g., 1500 -> "1.50s")
const formatDelayToSeconds = (delayMs: number): string => {
  return (delayMs / 1000).toFixed(2) + 's';
};

// Get filename from URL
const getFileNameFromUrl = (url: string): string => {
  try {
    const pathname = new URL(url).pathname;
    const filename = pathname.split('/').pop() || url;
    return filename.length > 25 ? '...' + filename.slice(-22) : filename;
  } catch {
    return url.length > 25 ? '...' + url.slice(-22) : url;
  }
};

const FrameEditor: React.FC<FrameEditorProps> = ({
  frame,
  frameIndex,
  totalFrames,
  onUpdate,
  onDelete,
  onDuplicateBefore,
  onDuplicateAfter,
  onCopy,
  onPasteBefore,
  onPasteAfter,
  onPasteReplace,
  onMoveFirst,
  onMoveLast,
  hasClipboard,
}) => {
  const { t } = useTranslation();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [localDelaySeconds, setLocalDelaySeconds] = useState((frame.delay / 1000).toString());
  const [contextMenu, setContextMenu] = useState<{ mouseX: number; mouseY: number } | null>(null);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: frame.frameId,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({ mouseX: event.clientX, mouseY: event.clientY });
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleMenuAction = useCallback((action: () => void) => {
    action();
    handleCloseContextMenu();
  }, [handleCloseContextMenu]);

  const handleImageUrlChange = (imageUrl: string) => {
    setImageError(false);
    const detectedType = detectFrameType(imageUrl);
    onUpdate({ ...frame, imageUrl, type: detectedType });
  };

  const handleDelaySecondsChange = (value: string) => {
    setLocalDelaySeconds(value);
    const seconds = parseFloat(value);
    if (!isNaN(seconds) && seconds >= 0) {
      onUpdate({ ...frame, delay: Math.round(seconds * 1000) });
    }
  };

  const handleLoopChange = (loop: boolean) => {
    onUpdate({ ...frame, loop });
  };

  const handleActionTypeChange = (type: FrameActionType) => {
    onUpdate({
      ...frame,
      action: { ...frame.action, type, value: frame.action?.value || '' },
    });
  };

  const handleActionValueChange = (value: string) => {
    onUpdate({
      ...frame,
      action: { ...frame.action, type: frame.action?.type || 'none', value },
    });
  };

  const handleEffectEnterChange = (enter: FrameEffectType) => {
    onUpdate({
      ...frame,
      effects: { ...frame.effects, enter },
    });
  };

  const handleEffectExitChange = (exit: FrameEffectType) => {
    onUpdate({
      ...frame,
      effects: { ...frame.effects, exit },
    });
  };

  const handleTransitionTypeChange = (type: TransitionType) => {
    onUpdate({
      ...frame,
      transition: { type, duration: frame.transition?.duration || 300 },
    });
  };

  const handleTransitionDurationChange = (durationSeconds: string) => {
    const seconds = parseFloat(durationSeconds);
    if (!isNaN(seconds) && seconds >= 0) {
      onUpdate({
        ...frame,
        transition: { type: frame.transition?.type || 'none', duration: Math.round(seconds * 1000) },
      });
    }
  };

  const handleDoubleClick = useCallback(() => {
    setSettingsOpen(true);
  }, []);

  const isVideo = frame.type === 'mp4' || frame.type === 'gif';

  // Build tooltip content
  const tooltipContent = (
    <Box sx={{ p: 0.5 }}>
      {/* Info Table */}
      <Box component="table" sx={{ borderSpacing: '6px 2px', borderCollapse: 'separate', '& td': { verticalAlign: 'top' } }}>
        <tbody>
          <tr>
            <Box component="td" sx={{ color: 'grey.400', whiteSpace: 'nowrap', pr: 1, fontSize: '0.75rem' }}>{t('banners.frame')}</Box>
            <Box component="td" sx={{ fontWeight: 500, fontSize: '0.75rem' }}>{frameIndex + 1} / {totalFrames}</Box>
          </tr>
          <tr>
            <Box component="td" sx={{ color: 'grey.400', whiteSpace: 'nowrap', pr: 1, fontSize: '0.75rem' }}>{t('banners.type')}</Box>
            <Box component="td" sx={{ fontWeight: 500, fontSize: '0.75rem' }}>{frame.type?.toUpperCase() || '-'}</Box>
          </tr>
          <tr>
            <Box component="td" sx={{ color: 'grey.400', whiteSpace: 'nowrap', pr: 1, fontSize: '0.75rem' }}>{t('banners.frameTime')}</Box>
            <Box component="td" sx={{ fontWeight: 500, fontSize: '0.75rem' }}>{formatDelayToSeconds(frame.delay)}</Box>
          </tr>
          {frame.imageUrl && (
            <tr>
              <Box component="td" sx={{ color: 'grey.400', whiteSpace: 'nowrap', pr: 1, fontSize: '0.75rem' }}>{t('banners.file')}</Box>
              <Box component="td" sx={{ fontWeight: 500, fontSize: '0.75rem' }}>{getFileNameFromUrl(frame.imageUrl)}</Box>
            </tr>
          )}
          {frame.action?.type && frame.action.type !== 'none' && (
            <tr>
              <Box component="td" sx={{ color: 'grey.400', whiteSpace: 'nowrap', pr: 1, fontSize: '0.75rem' }}>{t('banners.action')}</Box>
              <Box component="td" sx={{ fontWeight: 500, fontSize: '0.75rem' }}>{t(`banners.actionTypes.${frame.action.type}`)}</Box>
            </tr>
          )}
          {frame.effects?.enter && frame.effects.enter !== 'none' && (
            <tr>
              <Box component="td" sx={{ color: 'grey.400', whiteSpace: 'nowrap', pr: 1, fontSize: '0.75rem' }}>{t('banners.enterEffect')}</Box>
              <Box component="td" sx={{ fontWeight: 500, fontSize: '0.75rem' }}>{t(`banners.effects.${frame.effects.enter}`)}</Box>
            </tr>
          )}
          {frame.effects?.exit && frame.effects.exit !== 'none' && (
            <tr>
              <Box component="td" sx={{ color: 'grey.400', whiteSpace: 'nowrap', pr: 1, fontSize: '0.75rem' }}>{t('banners.exitEffect')}</Box>
              <Box component="td" sx={{ fontWeight: 500, fontSize: '0.75rem' }}>{t(`banners.effects.${frame.effects.exit}`)}</Box>
            </tr>
          )}
          {frame.transition?.type && frame.transition.type !== 'none' && (
            <tr>
              <Box component="td" sx={{ color: 'grey.400', whiteSpace: 'nowrap', pr: 1, fontSize: '0.75rem' }}>{t('banners.transition')}</Box>
              <Box component="td" sx={{ fontWeight: 500, fontSize: '0.75rem' }}>{t(`banners.transitions.${frame.transition.type}`)} ({(frame.transition.duration / 1000).toFixed(2)}s)</Box>
            </tr>
          )}
        </tbody>
      </Box>
      {/* Image/Video Preview - at the bottom with divider */}
      {frame.imageUrl && !imageError && (
        <>
          <Divider sx={{ my: 1, borderColor: 'rgba(255,255,255,0.2)' }} />
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            {isVideo && frame.type === 'mp4' ? (
              <video
                src={frame.imageUrl}
                style={{ maxWidth: 180, maxHeight: 100, objectFit: 'contain', borderRadius: 4, background: '#000' }}
                muted
              />
            ) : (
              <img
                src={frame.imageUrl}
                alt=""
                style={{ maxWidth: 180, maxHeight: 100, objectFit: 'contain', borderRadius: 4, background: '#000' }}
              />
            )}
          </Box>
        </>
      )}
    </Box>
  );

  return (
    <>
      <Tooltip
        title={tooltipContent}
        placement="top"
        arrow
        enterDelay={300}
        componentsProps={{
          tooltip: {
            sx: {
              bgcolor: 'rgba(30, 30, 30, 0.85)',
              backdropFilter: 'blur(4px)',
              '& .MuiTooltip-arrow': {
                color: 'rgba(30, 30, 30, 0.85)',
              },
              maxWidth: 'none',
            },
          },
        }}
      >
        <Paper
          ref={setNodeRef}
          style={style}
          onDoubleClick={handleDoubleClick}
          onContextMenu={handleContextMenu}
          sx={{
            width: 100,
            height: 100,
            position: 'relative',
            overflow: 'hidden',
            borderRadius: 1,
            border: 2,
            borderColor: isDragging ? 'primary.main' : 'transparent',
            cursor: 'grab',
            bgcolor: (theme) => theme.palette.mode === 'dark' ? 'grey.800' : 'grey.100',
            transition: 'all 0.2s',
            '&:hover': {
              borderColor: 'primary.light',
              '& .frame-overlay': { opacity: 1 },
            },
          }}
        >
        {/* Image Preview */}
        {frame.imageUrl ? (
          imageError ? (
            <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BrokenImageIcon color="disabled" />
            </Box>
          ) : isVideo && frame.type === 'mp4' ? (
            <video
              src={frame.imageUrl}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              muted
              onError={() => setImageError(true)}
            />
          ) : (
            <img
              src={frame.imageUrl}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={() => setImageError(true)}
            />
          )
        ) : (
          <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ImageIcon color="disabled" sx={{ fontSize: 32 }} />
          </Box>
        )}

        {/* Drag Handle (top) */}
        <Box
          {...attributes}
          {...listeners}
          className="frame-overlay"
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 20,
            bgcolor: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0,
            transition: 'opacity 0.2s',
          }}
        >
          <DragIndicatorIcon sx={{ color: 'white', fontSize: 14 }} />
        </Box>

        {/* Bottom Info Bar */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            bgcolor: 'rgba(0,0,0,0.7)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            px: 0.5,
            py: 0.25,
          }}
        >
          <Typography variant="caption" sx={{ color: 'white', fontSize: '0.65rem', fontWeight: 500 }}>
            {formatDelayToSeconds(frame.delay)}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0 }}>
            <Tooltip title={t('banners.frameSettings')}>
              <IconButton size="small" onClick={() => setSettingsOpen(true)} sx={{ color: 'white', p: 0.25 }}>
                <EditIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title={t('common.delete')}>
              <IconButton size="small" onClick={onDelete} sx={{ color: 'error.light', p: 0.25 }}>
                <DeleteIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
        </Paper>
      </Tooltip>

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>{frame.imageUrl ? t('banners.editFrame') : t('banners.addFrame')}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', gap: 3, pt: 1 }}>
            {/* Left: Settings - narrower width */}
            <Box sx={{ flex: '0 0 400px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {/* Image URL */}
              <TextField
                label={t('banners.imageUrl')}
                value={frame.imageUrl}
                onChange={(e) => handleImageUrlChange(e.target.value)}
                fullWidth
                size="small"
                placeholder="https://cdn.example.com/image.png"
                helperText={frame.type ? `${t('banners.detectedType')}: ${frame.type.toUpperCase()}` : ''}
              />

                {/* Basic Settings */}
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <TextField
                    label={t('banners.frameTime')}
                    type="number"
                    value={localDelaySeconds}
                    onChange={(e) => handleDelaySecondsChange(e.target.value)}
                    size="small"
                    sx={{ flex: 1 }}
                    InputProps={{
                      inputProps: { min: 0, step: 0.1 },
                      endAdornment: <InputAdornment position="end">s</InputAdornment>,
                    }}
                  />
                  {isVideo && (
                    <FormControlLabel
                      control={<Switch checked={frame.loop || false} onChange={(e) => handleLoopChange(e.target.checked)} size="small" />}
                      label={t('banners.loopVideo')}
                      sx={{ ml: 1 }}
                    />
                  )}
                </Box>

                <Divider />

                {/* Action Settings */}
                <Typography variant="subtitle2" color="text.secondary">{t('banners.actionSettings')}</Typography>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <FormControl size="small" sx={{ minWidth: 140 }}>
                    <InputLabel>{t('banners.actionType')}</InputLabel>
                    <Select value={frame.action?.type || 'none'} label={t('banners.actionType')} onChange={(e) => handleActionTypeChange(e.target.value as FrameActionType)}>
                      <MenuItem value="none">{t('banners.actionTypes.none')}</MenuItem>
                      <MenuItem value="openUrl">{t('banners.actionTypes.openUrl')}</MenuItem>
                      <MenuItem value="command">{t('banners.actionTypes.command')}</MenuItem>
                      <MenuItem value="deepLink">{t('banners.actionTypes.deepLink')}</MenuItem>
                    </Select>
                  </FormControl>
                  {frame.action?.type && frame.action.type !== 'none' && (
                    <TextField
                      label={t('banners.actionValue')}
                      value={frame.action?.value || ''}
                      onChange={(e) => handleActionValueChange(e.target.value)}
                      size="small"
                      sx={{ flex: 1 }}
                    />
                  )}
                </Box>

                <Divider />

                {/* Effect Settings */}
                <Typography variant="subtitle2" color="text.secondary">{t('banners.effectSettings')}</Typography>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <FormControl size="small" sx={{ flex: 1 }}>
                    <InputLabel>{t('banners.enterEffect')}</InputLabel>
                    <Select value={frame.effects?.enter || 'none'} label={t('banners.enterEffect')} onChange={(e) => handleEffectEnterChange(e.target.value as FrameEffectType)}>
                      <MenuItem value="none">{t('banners.effects.none')}</MenuItem>
                      <MenuItem value="fadeIn">{t('banners.effects.fadeIn')}</MenuItem>
                      <MenuItem value="slideLeft">{t('banners.effects.slideLeft')}</MenuItem>
                      <MenuItem value="slideRight">{t('banners.effects.slideRight')}</MenuItem>
                      <MenuItem value="slideUp">{t('banners.effects.slideUp')}</MenuItem>
                      <MenuItem value="slideDown">{t('banners.effects.slideDown')}</MenuItem>
                      <MenuItem value="zoomIn">{t('banners.effects.zoomIn')}</MenuItem>
                    </Select>
                  </FormControl>
                  <FormControl size="small" sx={{ flex: 1 }}>
                    <InputLabel>{t('banners.exitEffect')}</InputLabel>
                    <Select value={frame.effects?.exit || 'none'} label={t('banners.exitEffect')} onChange={(e) => handleEffectExitChange(e.target.value as FrameEffectType)}>
                      <MenuItem value="none">{t('banners.effects.none')}</MenuItem>
                      <MenuItem value="fadeOut">{t('banners.effects.fadeOut')}</MenuItem>
                      <MenuItem value="slideLeft">{t('banners.effects.slideLeft')}</MenuItem>
                      <MenuItem value="slideRight">{t('banners.effects.slideRight')}</MenuItem>
                      <MenuItem value="slideUp">{t('banners.effects.slideUp')}</MenuItem>
                      <MenuItem value="slideDown">{t('banners.effects.slideDown')}</MenuItem>
                      <MenuItem value="zoomOut">{t('banners.effects.zoomOut')}</MenuItem>
                    </Select>
                  </FormControl>
                </Box>

                <Divider />

                {/* Transition Settings */}
                <Typography variant="subtitle2" color="text.secondary">{t('banners.transitionSettings')}</Typography>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <FormControl size="small" sx={{ flex: 1 }}>
                    <InputLabel>{t('banners.transitionType')}</InputLabel>
                    <Select value={frame.transition?.type || 'none'} label={t('banners.transitionType')} onChange={(e) => handleTransitionTypeChange(e.target.value as TransitionType)}>
                      <MenuItem value="none">{t('banners.transitions.none')}</MenuItem>
                      <MenuItem value="fade">{t('banners.transitions.fade')}</MenuItem>
                      <MenuItem value="slide">{t('banners.transitions.slide')}</MenuItem>
                      <MenuItem value="crossfade">{t('banners.transitions.crossfade')}</MenuItem>
                    </Select>
                  </FormControl>
                  <TextField
                    label={t('banners.transitionDuration')}
                    type="number"
                    defaultValue={((frame.transition?.duration || 300) / 1000).toFixed(2)}
                    onChange={(e) => handleTransitionDurationChange(e.target.value)}
                    size="small"
                    sx={{ flex: 1 }}
                    InputProps={{
                      inputProps: { min: 0, step: 0.05 },
                      endAdornment: <InputAdornment position="end">s</InputAdornment>,
                    }}
                  />
                </Box>
            </Box>

            {/* Right: Preview - takes remaining space */}
            <Box
              sx={{
                flex: '1 1 auto',
                minWidth: 400,
                minHeight: 280,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: (theme) => theme.palette.mode === 'dark' ? 'grey.900' : 'grey.100',
                borderRadius: 1,
                p: 2,
              }}
            >
              <Typography variant="caption" color="text.secondary" sx={{ mb: 1 }}>
                {t('banners.preview')}
              </Typography>
              {frame.imageUrl ? (
                imageError ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <BrokenImageIcon color="disabled" sx={{ fontSize: 48 }} />
                    <Typography variant="caption" color="error" sx={{ mt: 1 }}>
                      {t('banners.imageLoadError')}
                    </Typography>
                  </Box>
                ) : isVideo && frame.type === 'mp4' ? (
                  <video
                    src={frame.imageUrl}
                    style={{ maxWidth: '100%', maxHeight: 400, borderRadius: 4 }}
                    controls
                    muted
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <img
                    src={frame.imageUrl}
                    alt=""
                    style={{ maxWidth: '100%', maxHeight: 400, borderRadius: 4, objectFit: 'contain' }}
                    onError={() => setImageError(true)}
                  />
                )
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <ImageIcon color="disabled" sx={{ fontSize: 48 }} />
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                    {t('banners.enterImageUrl')}
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="contained" onClick={() => setSettingsOpen(false)}>{t('common.close')}</Button>
        </DialogActions>
      </Dialog>

      {/* Context Menu */}
      <Menu
        open={contextMenu !== null}
        onClose={handleCloseContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={contextMenu !== null ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined}
      >
        {/* Edit */}
        <MenuItem onClick={() => handleMenuAction(() => setSettingsOpen(true))}>
          <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{t('banners.contextMenu.edit')}</ListItemText>
        </MenuItem>

        <Divider />

        {/* Duplicate */}
        <MenuItem onClick={() => handleMenuAction(onDuplicateBefore)} disabled={frameIndex === 0}>
          <ListItemIcon><InsertBeforeIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{t('banners.contextMenu.duplicateBefore')}</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleMenuAction(onDuplicateAfter)}>
          <ListItemIcon><InsertAfterIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{t('banners.contextMenu.duplicateAfter')}</ListItemText>
        </MenuItem>

        <Divider />

        {/* Copy */}
        <MenuItem onClick={() => handleMenuAction(onCopy)}>
          <ListItemIcon><CopyIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{t('banners.contextMenu.copy')}</ListItemText>
        </MenuItem>

        {/* Paste */}
        <MenuItem onClick={() => handleMenuAction(onPasteBefore)} disabled={!hasClipboard}>
          <ListItemIcon><PasteIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{t('banners.contextMenu.pasteBefore')}</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleMenuAction(onPasteAfter)} disabled={!hasClipboard}>
          <ListItemIcon><PasteIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{t('banners.contextMenu.pasteAfter')}</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleMenuAction(onPasteReplace)} disabled={!hasClipboard}>
          <ListItemIcon><ReplaceIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{t('banners.contextMenu.pasteReplace')}</ListItemText>
        </MenuItem>

        <Divider />

        {/* Move */}
        <MenuItem onClick={() => handleMenuAction(onMoveFirst)} disabled={frameIndex === 0}>
          <ListItemIcon><MoveFirstIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{t('banners.contextMenu.moveFirst')}</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleMenuAction(onMoveLast)} disabled={frameIndex === totalFrames - 1}>
          <ListItemIcon><MoveLastIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{t('banners.contextMenu.moveLast')}</ListItemText>
        </MenuItem>

        <Divider />

        {/* Delete */}
        <MenuItem onClick={() => handleMenuAction(onDelete)} sx={{ color: 'error.main' }}>
          <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
          <ListItemText>{t('banners.contextMenu.delete')}</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
};

export default FrameEditor;
