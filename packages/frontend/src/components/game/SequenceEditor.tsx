import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  TextField,
  Collapse,
  Stack,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  Tooltip,
  ToggleButtonGroup,
  ToggleButton,
  keyframes,
  Menu,
  Divider,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  ContentCopy as ContentCopyIcon,
  ContentPaste as ContentPasteIcon,
  FirstPage as FirstPageIcon,
  LastPage as LastPageIcon,
  Link as LinkIcon,
  PlaylistAdd as AddMultipleIcon,
  FindReplace as ReplaceIcon,
  VerticalAlignTop as InsertBeforeIcon,
  VerticalAlignBottom as InsertAfterIcon,
} from '@mui/icons-material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
  DragIndicator as DragIndicatorIcon,
  ViewModule as GridViewIcon,
  ViewTimeline as TimelineViewIcon,
  ViewList as ListViewIcon,
  Image as ImageIcon,
  BrokenImage as BrokenImageIcon,
  Edit as EditIcon,
  Shuffle as ShuffleIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { Sequence, Frame, LoopModeType, FrameType } from '../../services/bannerService';
import { generateULID } from '../../utils/ulid';
import FrameEditor from './FrameEditor';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import { restrictToHorizontalAxis, restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Sortable list item component for list view
interface SortableListItemProps {
  frame: Frame;
  frameIndex: number;
  totalFrames: number;
  startTime: number;
  endTime: number;
  onEdit: () => void;
  onMovePrev: () => void;
  onMoveNext: () => void;
  onMoveFirst: () => void;
  onMoveLast: () => void;
  onDelete: () => void;
  onDuplicateBefore: () => void;
  onDuplicateAfter: () => void;
  onCopy: () => void;
  onPasteBefore: () => void;
  onPasteAfter: () => void;
  onPasteReplace: () => void;
  onAddEmptyBefore: () => void;
  onAddEmptyAfter: () => void;
  onAddMultipleEmptyBefore: (count: number) => void;
  onAddMultipleEmptyAfter: (count: number) => void;
  onAddFromClipboardBefore: (urls: string[]) => void;
  onAddFromClipboardAfter: (urls: string[]) => void;
  onFrameClick: () => void;
  hasClipboard: boolean;
  t: (key: string, options?: Record<string, unknown>) => string;
}

const SortableListItem: React.FC<SortableListItemProps> = ({
  frame,
  frameIndex,
  totalFrames,
  startTime,
  endTime,
  onEdit,
  onMovePrev,
  onMoveNext,
  onMoveFirst,
  onMoveLast,
  onDelete,
  onDuplicateBefore,
  onDuplicateAfter,
  onCopy,
  onPasteBefore,
  onPasteAfter,
  onPasteReplace,
  onAddEmptyBefore,
  onAddEmptyAfter,
  onAddMultipleEmptyBefore,
  onAddMultipleEmptyAfter,
  onAddFromClipboardBefore,
  onAddFromClipboardAfter,
  onFrameClick,
  hasClipboard,
  t,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: frame.frameId,
  });

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ mouseX: number; mouseY: number } | null>(null);
  const [clipboardUrls, setClipboardUrls] = useState<string[]>([]);
  const [emptyFrameCountDialogOpen, setEmptyFrameCountDialogOpen] = useState<'before' | 'after' | null>(null);

  // Parse image URLs from clipboard text
  const parseImageUrls = useCallback((text: string): string[] => {
    const parts = text.split(/[,\n\r]+/);
    const urls: string[] = [];
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('//')) {
        urls.push(trimmed);
      }
    }
    return urls;
  }, []);

  // Read clipboard when context menu opens
  useEffect(() => {
    if (contextMenu !== null) {
      if (navigator.clipboard && navigator.clipboard.readText) {
        navigator.clipboard.readText()
          .then((text) => {
            const urls = parseImageUrls(text);
            setClipboardUrls(urls);
          })
          .catch(() => {
            setClipboardUrls([]);
          });
      } else {
        setClipboardUrls([]);
      }
    }
  }, [contextMenu, parseImageUrls]);

  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({ mouseX: event.clientX, mouseY: event.clientY });
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 'auto',
  };

  const isVideo = frame.type === 'mp4';
  const isEven = frameIndex % 2 === 0;

  return (
    <>
      <Paper
        ref={setNodeRef}
        style={style as React.CSSProperties}
        onClick={onFrameClick}
        onDoubleClick={onEdit}
        onContextMenu={handleContextMenu}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          p: 1.5,
          mb: 0.5,
          borderRadius: 1,
          cursor: 'pointer',
          transition: 'background-color 0.15s',
          // Alternating row color: even rows have a very subtle tint on top of Paper background
          ...(isEven && {
            bgcolor: (theme) => theme.palette.mode === 'dark'
              ? 'rgba(255,255,255,0.02)'
              : 'rgba(0,0,0,0.015)',
          }),
          '&:hover': {
            bgcolor: (theme) => theme.palette.mode === 'dark'
              ? 'rgba(255,255,255,0.05)'
              : 'rgba(0,0,0,0.025)',
          },
          '&:last-of-type': { mb: 0 },
        }}
      >
        {/* Drag Handle */}
        <Box
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          sx={{
            cursor: 'grab',
            display: 'flex',
            alignItems: 'center',
            px: 0.5,
            py: 1,
            mx: -0.5,
            borderRadius: 0.5,
            color: 'text.secondary',
            '&:hover': {
              color: 'text.primary',
              bgcolor: 'action.hover',
            },
            '&:active': { cursor: 'grabbing' },
          }}
        >
          <DragIndicatorIcon fontSize="small" />
        </Box>

        {/* Frame Index */}
        <Typography
          sx={{
            minWidth: 32,
            textAlign: 'center',
            fontWeight: 600,
            color: 'primary.main',
          }}
        >
          #{frameIndex + 1}
        </Typography>

        {/* Time Position */}
        <Box sx={{ minWidth: 100 }}>
          <Typography variant="caption" color="text.secondary">
            {t('banners.listViewTime')}
          </Typography>
          <Typography variant="body2" fontFamily="monospace">
            {(startTime / 1000).toFixed(2)}s - {(endTime / 1000).toFixed(2)}s
          </Typography>
        </Box>

        {/* Image Preview */}
        <Box
          sx={{
            width: 80,
            height: 60,
            borderRadius: 1,
            overflow: 'hidden',
            bgcolor: 'grey.900',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {frame.imageUrl ? (
            isVideo ? (
              <video
                src={frame.imageUrl}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                muted
              />
            ) : (
              <img
                src={frame.imageUrl}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  (e.target as HTMLImageElement).parentElement!.innerHTML = '<span style="color: #999;">Error</span>';
                }}
              />
            )
          ) : (
            <ImageIcon color="disabled" />
          )}
        </Box>

        {/* Frame Details */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                {t('banners.duration')}
              </Typography>
              <Typography variant="body2">
                {(frame.delay / 1000).toFixed(2)}s ({frame.delay}ms)
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                {t('banners.type')}
              </Typography>
              <Typography variant="body2">
                {frame.imageUrl ? (frame.type?.toUpperCase() || '-') : t('banners.imageNotSet')}
              </Typography>
            </Box>
            {frame.transition && (
              <Box>
                <Typography variant="caption" color="text.secondary">
                  {t('banners.frameTransition')}
                </Typography>
                <Typography variant="body2">
                  {t(`banners.transitions.${frame.transition.type}`)} ({(frame.transition.duration / 1000).toFixed(2)}s)
                </Typography>
              </Box>
            )}
            {frame.link && (
              <Box sx={{ flex: 1, minWidth: 150 }}>
                <Typography variant="caption" color="text.secondary">
                  {t('banners.link')}
                </Typography>
                <Typography variant="body2" noWrap title={frame.link}>
                  {frame.link}
                </Typography>
              </Box>
            )}
          </Box>
          {frame.imageUrl && (
            <Typography
              variant="caption"
              color="text.secondary"
              title={frame.imageUrl}
              sx={{
                mt: 0.5,
                display: 'block',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                direction: 'rtl',
                textAlign: 'left',
              }}
            >
              <span style={{ direction: 'ltr', unicodeBidi: 'bidi-override' }}>
                URL: {frame.imageUrl}
              </span>
            </Typography>
          )}
        </Box>

        {/* Actions */}
        <Box sx={{ display: 'flex', gap: 0.5 }} onClick={(e) => e.stopPropagation()}>
          <Tooltip title={t('banners.contextMenu.edit')}>
            <IconButton size="small" onClick={onEdit}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={t('banners.contextMenu.movePrev')}>
            <span>
              <IconButton size="small" disabled={frameIndex === 0} onClick={onMovePrev}>
                <ArrowUpwardIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={t('banners.contextMenu.moveNext')}>
            <span>
              <IconButton size="small" disabled={frameIndex === totalFrames - 1} onClick={onMoveNext}>
                <ArrowDownwardIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={t('common.delete')}>
            <IconButton size="small" color="error" onClick={onDelete}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Paper>

      {/* Context Menu */}
      <Menu
        open={contextMenu !== null}
        onClose={handleCloseContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={contextMenu ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined}
      >
        {/* Edit */}
        <MenuItem onClick={() => { onEdit(); handleCloseContextMenu(); }}>
          <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{t('banners.contextMenu.edit')}</ListItemText>
        </MenuItem>

        <Divider />

        {/* Duplicate */}
        <MenuItem onClick={() => { onDuplicateBefore(); handleCloseContextMenu(); }} disabled={frameIndex === 0}>
          <ListItemIcon><InsertBeforeIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{t('banners.contextMenu.duplicateBefore')}</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { onDuplicateAfter(); handleCloseContextMenu(); }}>
          <ListItemIcon><InsertAfterIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{t('banners.contextMenu.duplicateAfter')}</ListItemText>
        </MenuItem>

        <Divider />

        {/* Copy */}
        <MenuItem onClick={() => { onCopy(); handleCloseContextMenu(); }}>
          <ListItemIcon><ContentCopyIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{t('banners.contextMenu.copy')}</ListItemText>
        </MenuItem>

        {/* Paste */}
        <MenuItem onClick={() => { onPasteBefore(); handleCloseContextMenu(); }} disabled={!hasClipboard}>
          <ListItemIcon><ContentPasteIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{t('banners.contextMenu.pasteBefore')}</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { onPasteAfter(); handleCloseContextMenu(); }} disabled={!hasClipboard}>
          <ListItemIcon><ContentPasteIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{t('banners.contextMenu.pasteAfter')}</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { onPasteReplace(); handleCloseContextMenu(); }} disabled={!hasClipboard}>
          <ListItemIcon><ReplaceIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{t('banners.contextMenu.pasteReplace')}</ListItemText>
        </MenuItem>

        <Divider />

        {/* Add Empty Frames */}
        <MenuItem onClick={() => { onAddEmptyBefore(); handleCloseContextMenu(); }}>
          <ListItemIcon><AddIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{t('banners.contextMenu.addEmptyBefore')}</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { handleCloseContextMenu(); setEmptyFrameCountDialogOpen('before'); }}>
          <ListItemIcon><AddMultipleIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{t('banners.contextMenu.addMultipleEmptyBefore')}</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { onAddEmptyAfter(); handleCloseContextMenu(); }}>
          <ListItemIcon><AddIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{t('banners.contextMenu.addEmptyAfter')}</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { handleCloseContextMenu(); setEmptyFrameCountDialogOpen('after'); }}>
          <ListItemIcon><AddMultipleIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{t('banners.contextMenu.addMultipleEmptyAfter')}</ListItemText>
        </MenuItem>

        {/* Add from Clipboard URLs */}
        {clipboardUrls.length > 0 && (
          <>
            <Divider />
            <MenuItem onClick={() => { onAddFromClipboardBefore(clipboardUrls); handleCloseContextMenu(); }}>
              <ListItemIcon><LinkIcon fontSize="small" color="primary" /></ListItemIcon>
              <ListItemText>
                {clipboardUrls.length === 1
                  ? t('banners.contextMenu.addFromClipboardBefore')
                  : t('banners.contextMenu.addFromClipboardBeforeMultiple', { count: clipboardUrls.length })}
              </ListItemText>
            </MenuItem>
            <MenuItem onClick={() => { onAddFromClipboardAfter(clipboardUrls); handleCloseContextMenu(); }}>
              <ListItemIcon><LinkIcon fontSize="small" color="primary" /></ListItemIcon>
              <ListItemText>
                {clipboardUrls.length === 1
                  ? t('banners.contextMenu.addFromClipboardAfter')
                  : t('banners.contextMenu.addFromClipboardAfterMultiple', { count: clipboardUrls.length })}
              </ListItemText>
            </MenuItem>
          </>
        )}

        <Divider />

        {/* Move */}
        <MenuItem onClick={() => { onMovePrev(); handleCloseContextMenu(); }} disabled={frameIndex === 0}>
          <ListItemIcon><ArrowUpwardIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{t('banners.contextMenu.movePrev')}</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { onMoveNext(); handleCloseContextMenu(); }} disabled={frameIndex === totalFrames - 1}>
          <ListItemIcon><ArrowDownwardIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{t('banners.contextMenu.moveNext')}</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { onMoveFirst(); handleCloseContextMenu(); }} disabled={frameIndex === 0}>
          <ListItemIcon><FirstPageIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{t('banners.contextMenu.moveFirst')}</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { onMoveLast(); handleCloseContextMenu(); }} disabled={frameIndex === totalFrames - 1}>
          <ListItemIcon><LastPageIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{t('banners.contextMenu.moveLast')}</ListItemText>
        </MenuItem>

        <Divider />

        {/* Delete */}
        <MenuItem onClick={() => { onDelete(); handleCloseContextMenu(); }} sx={{ color: 'error.main' }}>
          <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
          <ListItemText>{t('banners.contextMenu.delete')}</ListItemText>
        </MenuItem>
      </Menu>

      {/* Empty Frame Count Dialog */}
      <Dialog
        open={emptyFrameCountDialogOpen !== null}
        onClose={() => setEmptyFrameCountDialogOpen(null)}
        maxWidth="xs"
      >
        <DialogTitle>
          {emptyFrameCountDialogOpen === 'before'
            ? t('banners.contextMenu.addMultipleEmptyBefore')
            : t('banners.contextMenu.addMultipleEmptyAfter')}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label={t('banners.emptyFrameCount')}
            defaultValue={5}
            fullWidth
            sx={{ mt: 1 }}
            id="empty-frame-count-list"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEmptyFrameCountDialogOpen(null)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              const input = document.getElementById('empty-frame-count-list') as HTMLInputElement;
              const count = parseInt(input?.value || '5', 10);
              if (count > 0 && count <= 100) {
                if (emptyFrameCountDialogOpen === 'before') {
                  onAddMultipleEmptyBefore(count);
                } else {
                  onAddMultipleEmptyAfter(count);
                }
              }
              setEmptyFrameCountDialogOpen(null);
            }}
          >
            {t('common.add')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

interface SequenceEditorProps {
  sequence: Sequence;
  index: number;
  totalCount: number;
  onUpdate: (sequence: Sequence) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onFrameSelect?: (sequenceIndex: number, frameIndex: number) => void;
}

const SequenceEditor: React.FC<SequenceEditorProps> = ({
  sequence,
  index,
  totalCount,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  onFrameSelect,
}) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);
  const [clipboardFrame, setClipboardFrame] = useState<Frame | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'timeline' | 'list'>(() => {
    // Restore view mode from localStorage
    const saved = localStorage.getItem('bannerSequenceViewMode');
    return (saved === 'timeline' || saved === 'grid' || saved === 'list') ? saved as 'grid' | 'timeline' | 'list' : 'grid';
  });

  // List view editing frame index
  const [listEditingFrameIndex, setListEditingFrameIndex] = useState<number | null>(null);

  // Timeline resize state
  const [resizeState, setResizeState] = useState<{
    frameIndex: number;
    edge: 'left' | 'right';
    startX: number;
    startDelay: number;
    prevFrameDelay?: number;
  } | null>(null);

  const TIMELINE_HEIGHT = 90; // 1.5x of previous 60

  // Save view mode to localStorage when changed
  useEffect(() => {
    localStorage.setItem('bannerSequenceViewMode', viewMode);
  }, [viewMode]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Calculate total duration and timeline scale
  const { totalDuration, minFrameWidth, maxFrameWidth, pixelsPerSecond } = useMemo(() => {
    if (sequence.frames.length === 0) {
      return { totalDuration: 0, minFrameWidth: 80, maxFrameWidth: 200, pixelsPerSecond: 40 };
    }
    const total = sequence.frames.reduce((sum, f) => sum + f.delay, 0);
    // Scale: 40 pixels per second, with min 80px and max 200px per frame
    return { totalDuration: total, minFrameWidth: 80, maxFrameWidth: 200, pixelsPerSecond: 40 };
  }, [sequence.frames]);

  // Calculate frame width for timeline view
  const getFrameWidthForTimeline = (delay: number) => {
    const width = (delay / 1000) * pixelsPerSecond;
    return Math.min(maxFrameWidth, Math.max(minFrameWidth, width));
  };

  // Handle timeline resize start
  const handleResizeStart = (frameIndex: number, edge: 'left' | 'right', startX: number) => {
    const frame = sequence.frames[frameIndex];
    const prevFrame = frameIndex > 0 ? sequence.frames[frameIndex - 1] : null;
    setResizeState({
      frameIndex,
      edge,
      startX,
      startDelay: frame.delay,
      prevFrameDelay: prevFrame?.delay,
    });
  };

  // Handle timeline resize move
  useEffect(() => {
    if (!resizeState) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizeState.startX;
      const deltaTime = Math.round((deltaX / pixelsPerSecond) * 1000); // Convert pixels to ms
      const minDelay = 100; // Minimum 100ms

      const newFrames = [...sequence.frames];

      if (resizeState.edge === 'right') {
        // Resize right edge: extend/shrink current frame
        const newDelay = Math.max(minDelay, resizeState.startDelay + deltaTime);
        newFrames[resizeState.frameIndex] = {
          ...newFrames[resizeState.frameIndex],
          delay: newDelay,
        };

        // Check if we need to delete next frames
        const frameWidth = getFrameWidthForTimeline(newDelay);
        let deletedCount = 0;
        while (resizeState.frameIndex + 1 + deletedCount < newFrames.length) {
          const nextFrameIndex = resizeState.frameIndex + 1;
          const nextFrameWidth = getFrameWidthForTimeline(newFrames[nextFrameIndex].delay);
          // If current frame extends over next frame completely
          if (frameWidth >= resizeState.startDelay / 1000 * pixelsPerSecond + nextFrameWidth) {
            newFrames.splice(nextFrameIndex, 1);
            deletedCount++;
          } else {
            break;
          }
        }
      } else {
        // Resize left edge: extend/shrink current frame and previous frame
        if (resizeState.frameIndex > 0 && resizeState.prevFrameDelay !== undefined) {
          const prevNewDelay = Math.max(minDelay, resizeState.prevFrameDelay + deltaTime);
          const currentNewDelay = Math.max(minDelay, resizeState.startDelay - deltaTime);

          // Check if previous frame would be completely covered
          if (currentNewDelay >= resizeState.startDelay + resizeState.prevFrameDelay - minDelay) {
            // Delete previous frame
            newFrames.splice(resizeState.frameIndex - 1, 1);
            newFrames[resizeState.frameIndex - 1] = {
              ...newFrames[resizeState.frameIndex - 1],
              delay: resizeState.startDelay + resizeState.prevFrameDelay,
            };
          } else {
            newFrames[resizeState.frameIndex - 1] = {
              ...newFrames[resizeState.frameIndex - 1],
              delay: prevNewDelay,
            };
            newFrames[resizeState.frameIndex] = {
              ...newFrames[resizeState.frameIndex],
              delay: currentNewDelay,
            };
          }
        }
      }

      onUpdate({ ...sequence, frames: newFrames });
    };

    const handleMouseUp = () => {
      setResizeState(null);
      // Restore pointer events and user-select
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    // Disable pointer events on other elements and set cursor during resize
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ew-resize';

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      // Cleanup in case effect unmounts during resize
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [resizeState, sequence, onUpdate, pixelsPerSecond, getFrameWidthForTimeline]);

  const handleNameChange = (name: string) => {
    onUpdate({ ...sequence, name });
  };

  const handleSpeedChange = (speedMultiplier: number) => {
    onUpdate({ ...sequence, speedMultiplier });
  };

  const handleLoopModeChange = (loopMode: LoopModeType) => {
    onUpdate({ ...sequence, loopMode });
  };

  const handleAddFrame = () => {
    const newFrame: Frame = {
      frameId: generateULID(),
      imageUrl: '',
      type: 'png' as FrameType,
      delay: 5000,
      loop: false,
    };
    onUpdate({ ...sequence, frames: [...sequence.frames, newFrame] });
  };

  const handleUpdateFrame = (frameIndex: number, updatedFrame: Frame) => {
    const newFrames = [...sequence.frames];
    newFrames[frameIndex] = updatedFrame;
    onUpdate({ ...sequence, frames: newFrames });
  };

  const handleDeleteFrame = (frameIndex: number) => {
    onUpdate({ ...sequence, frames: sequence.frames.filter((_, i) => i !== frameIndex) });
  };

  // Create a copy of frame with new ID
  const createFrameCopy = (frame: Frame): Frame => ({
    ...frame,
    frameId: generateULID(),
  });

  // Duplicate frame before
  const handleDuplicateBefore = (frameIndex: number) => {
    const frameCopy = createFrameCopy(sequence.frames[frameIndex]);
    const newFrames = [...sequence.frames];
    newFrames.splice(frameIndex, 0, frameCopy);
    onUpdate({ ...sequence, frames: newFrames });
  };

  // Duplicate frame after
  const handleDuplicateAfter = (frameIndex: number) => {
    const frameCopy = createFrameCopy(sequence.frames[frameIndex]);
    const newFrames = [...sequence.frames];
    newFrames.splice(frameIndex + 1, 0, frameCopy);
    onUpdate({ ...sequence, frames: newFrames });
  };

  // Copy frame to clipboard
  const handleCopyFrame = (frameIndex: number) => {
    setClipboardFrame({ ...sequence.frames[frameIndex] });
  };

  // Paste before
  const handlePasteBefore = (frameIndex: number) => {
    if (!clipboardFrame) return;
    const frameCopy = createFrameCopy(clipboardFrame);
    const newFrames = [...sequence.frames];
    newFrames.splice(frameIndex, 0, frameCopy);
    onUpdate({ ...sequence, frames: newFrames });
  };

  // Paste after
  const handlePasteAfter = (frameIndex: number) => {
    if (!clipboardFrame) return;
    const frameCopy = createFrameCopy(clipboardFrame);
    const newFrames = [...sequence.frames];
    newFrames.splice(frameIndex + 1, 0, frameCopy);
    onUpdate({ ...sequence, frames: newFrames });
  };

  // Paste and replace
  const handlePasteReplace = (frameIndex: number) => {
    if (!clipboardFrame) return;
    const frameCopy = createFrameCopy(clipboardFrame);
    const newFrames = [...sequence.frames];
    newFrames[frameIndex] = frameCopy;
    onUpdate({ ...sequence, frames: newFrames });
  };

  // Move to first
  const handleMoveFirst = (frameIndex: number) => {
    if (frameIndex === 0) return;
    const frame = sequence.frames[frameIndex];
    const newFrames = sequence.frames.filter((_, i) => i !== frameIndex);
    newFrames.unshift(frame);
    onUpdate({ ...sequence, frames: newFrames });
  };

  // Move to last
  const handleMoveLast = (frameIndex: number) => {
    if (frameIndex === sequence.frames.length - 1) return;
    const frame = sequence.frames[frameIndex];
    const newFrames = sequence.frames.filter((_, i) => i !== frameIndex);
    newFrames.push(frame);
    onUpdate({ ...sequence, frames: newFrames });
  };

  // Create empty frame
  const createEmptyFrame = (): Frame => ({
    frameId: generateULID(),
    imageUrl: '',
    type: 'png' as FrameType,
    delay: 5000,
    loop: false,
  });

  // Add empty frame before
  const handleAddEmptyBefore = (frameIndex: number) => {
    const newFrame = createEmptyFrame();
    const newFrames = [...sequence.frames];
    newFrames.splice(frameIndex, 0, newFrame);
    onUpdate({ ...sequence, frames: newFrames });
  };

  // Add empty frame after
  const handleAddEmptyAfter = (frameIndex: number) => {
    const newFrame = createEmptyFrame();
    const newFrames = [...sequence.frames];
    newFrames.splice(frameIndex + 1, 0, newFrame);
    onUpdate({ ...sequence, frames: newFrames });
  };

  // Add multiple empty frames before
  const handleAddMultipleEmptyBefore = (frameIndex: number, count: number) => {
    const newFrames = [...sequence.frames];
    for (let i = 0; i < count; i++) {
      newFrames.splice(frameIndex, 0, createEmptyFrame());
    }
    onUpdate({ ...sequence, frames: newFrames });
  };

  // Add multiple empty frames after
  const handleAddMultipleEmptyAfter = (frameIndex: number, count: number) => {
    const newFrames = [...sequence.frames];
    for (let i = 0; i < count; i++) {
      newFrames.splice(frameIndex + 1 + i, 0, createEmptyFrame());
    }
    onUpdate({ ...sequence, frames: newFrames });
  };

  // Detect frame type from URL
  const detectFrameType = (url: string): FrameType => {
    const ext = url.split('?')[0].split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'jpg':
      case 'jpeg':
        return 'jpg';
      case 'gif':
        return 'gif';
      case 'mp4':
      case 'webm':
        return 'mp4';
      default:
        return 'png';
    }
  };

  // Create frame from URL
  const createFrameFromUrl = (imageUrl: string): Frame => ({
    frameId: generateULID(),
    imageUrl,
    type: detectFrameType(imageUrl),
    delay: 5000,
    loop: false,
  });

  // Add frames from clipboard URLs before
  const handleAddFromClipboardBefore = (frameIndex: number, urls: string[]) => {
    const newFrames = [...sequence.frames];
    // Insert in reverse order so they appear in the original order
    for (let i = urls.length - 1; i >= 0; i--) {
      newFrames.splice(frameIndex, 0, createFrameFromUrl(urls[i]));
    }
    onUpdate({ ...sequence, frames: newFrames });
  };

  // Add frames from clipboard URLs after
  const handleAddFromClipboardAfter = (frameIndex: number, urls: string[]) => {
    const newFrames = [...sequence.frames];
    for (let i = 0; i < urls.length; i++) {
      newFrames.splice(frameIndex + 1 + i, 0, createFrameFromUrl(urls[i]));
    }
    onUpdate({ ...sequence, frames: newFrames });
  };

  // Move to previous position
  const handleMovePrev = (frameIndex: number) => {
    if (frameIndex === 0) return;
    const newFrames = [...sequence.frames];
    [newFrames[frameIndex - 1], newFrames[frameIndex]] = [newFrames[frameIndex], newFrames[frameIndex - 1]];
    onUpdate({ ...sequence, frames: newFrames });
  };

  // Move to next position
  const handleMoveNext = (frameIndex: number) => {
    if (frameIndex === sequence.frames.length - 1) return;
    const newFrames = [...sequence.frames];
    [newFrames[frameIndex], newFrames[frameIndex + 1]] = [newFrames[frameIndex + 1], newFrames[frameIndex]];
    onUpdate({ ...sequence, frames: newFrames });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = sequence.frames.findIndex(f => f.frameId === active.id);
      const newIndex = sequence.frames.findIndex(f => f.frameId === over.id);
      onUpdate({ ...sequence, frames: arrayMove(sequence.frames, oldIndex, newIndex) });
    }
  };

  // Fisher-Yates shuffle algorithm
  const handleShuffle = () => {
    if (sequence.frames.length < 2) return;
    const shuffled = [...sequence.frames];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    onUpdate({ ...sequence, frames: shuffled });
  };

  return (
    <Paper sx={{ p: 2, border: 1, borderColor: 'divider' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <DragIndicatorIcon sx={{ color: 'text.secondary', cursor: 'grab' }} />
        <Typography variant="subtitle1" sx={{ flex: 1 }}>
          {sequence.name || `${t('banners.sequence')} ${index + 1}`}
        </Typography>
        <Tooltip title={t('common.moveUp')}>
          <span>
            <IconButton size="small" onClick={onMoveUp} disabled={index === 0}>
              <ArrowUpwardIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={t('common.moveDown')}>
          <span>
            <IconButton size="small" onClick={onMoveDown} disabled={index === totalCount - 1}>
              <ArrowDownwardIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <IconButton size="small" onClick={() => setExpanded(!expanded)}>
          {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
        <Tooltip title={t('common.delete')}>
          <IconButton size="small" color="error" onClick={onDelete}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
        <Tooltip title={t('banners.shuffleFrames')}>
          <span>
            <IconButton size="small" onClick={handleShuffle} disabled={sequence.frames.length < 2}>
              <ShuffleIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      <Collapse in={expanded}>
        <Stack spacing={2} sx={{ mt: 2 }}>
          <Stack direction="row" spacing={2}>
            <Box sx={{ flex: 1 }}>
              <TextField
                label={t('banners.sequenceName')}
                value={sequence.name}
                onChange={(e) => handleNameChange(e.target.value)}
                fullWidth
                size="small"
              />
            </Box>
            <Box sx={{ flex: 1 }}>
              <TextField
                label={t('banners.speedMultiplier')}
                value={sequence.speedMultiplier}
                onChange={(e) => handleSpeedChange(Number(e.target.value))}
                fullWidth
                size="small"
              />
            </Box>
            <Box sx={{ flex: 1 }}>
              <FormControl fullWidth size="small">
                <InputLabel>{t('banners.loopMode')}</InputLabel>
                <Select
                  value={sequence.loopMode}
                  label={t('banners.loopMode')}
                  onChange={(e) => handleLoopModeChange(e.target.value as LoopModeType)}
                >
                  <MenuItem value="loop">{t('banners.loopModes.loop')}</MenuItem>
                  <MenuItem value="pingpong">{t('banners.loopModes.pingpong')}</MenuItem>
                  <MenuItem value="once">{t('banners.loopModes.once')}</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </Stack>

          {/* Frames */}
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="subtitle2">{t('banners.frames')} ({sequence.frames.length})</Typography>
                {totalDuration > 0 && (
                  <Typography variant="caption" color="text.secondary">
                    • {(totalDuration / 1000).toFixed(1)}s
                  </Typography>
                )}
              </Box>
              <ToggleButtonGroup
                size="small"
                value={viewMode}
                exclusive
                onChange={(_, newMode) => newMode && setViewMode(newMode)}
                sx={{ '& .MuiToggleButton-root': { py: 0.25, px: 0.75 } }}
              >
                <ToggleButton value="grid">
                  <Tooltip title={t('banners.gridView')}>
                    <GridViewIcon fontSize="small" />
                  </Tooltip>
                </ToggleButton>
                <ToggleButton value="timeline">
                  <Tooltip title={t('banners.timelineView')}>
                    <TimelineViewIcon fontSize="small" />
                  </Tooltip>
                </ToggleButton>
                <ToggleButton value="list">
                  <Tooltip title={t('banners.listView')}>
                    <ListViewIcon fontSize="small" />
                  </Tooltip>
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>

            {sequence.frames.length === 0 ? (
              <Paper
                sx={{
                  p: 3,
                  textAlign: 'center',
                  bgcolor: (theme) => theme.palette.mode === 'dark' ? 'grey.800' : 'grey.50',
                  border: '2px dashed',
                  borderColor: 'divider',
                  borderRadius: 1,
                }}
              >
                <Typography color="text.secondary" variant="body2">{t('banners.noFrames')}</Typography>
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={handleAddFrame}
                  sx={{
                    mt: 1,
                    animation: `${keyframes`
                      0%, 100% { transform: scale(1); }
                      50% { transform: scale(1.05); }
                    `} 2s ease-in-out infinite`,
                    '&:hover': {
                      animation: 'none',
                      transform: 'scale(1.05)',
                    },
                  }}
                >
                  {t('banners.addFirstFrame')}
                </Button>
              </Paper>
            ) : viewMode === 'timeline' ? (
              /* Timeline View - frames width based on duration, horizontal drag only */
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
                modifiers={[restrictToHorizontalAxis]}
              >
                <SortableContext items={sequence.frames.map(f => f.frameId)} strategy={horizontalListSortingStrategy}>
                  <Box
                    sx={{
                      display: 'flex',
                      gap: 0.5,
                      p: 1.5,
                      bgcolor: (theme) => theme.palette.mode === 'dark' ? 'grey.800' : 'grey.100',
                      borderRadius: 1,
                      overflowX: 'auto',
                    }}
                  >
                    {sequence.frames.map((frame, frameIndex) => (
                      <FrameEditor
                        key={frame.frameId}
                        frame={frame}
                        frameIndex={frameIndex}
                        totalFrames={sequence.frames.length}
                        onUpdate={(updated) => handleUpdateFrame(frameIndex, updated)}
                        onDelete={() => handleDeleteFrame(frameIndex)}
                        onDuplicateBefore={() => handleDuplicateBefore(frameIndex)}
                        onDuplicateAfter={() => handleDuplicateAfter(frameIndex)}
                        onCopy={() => handleCopyFrame(frameIndex)}
                        onPasteBefore={() => handlePasteBefore(frameIndex)}
                        onPasteAfter={() => handlePasteAfter(frameIndex)}
                        onPasteReplace={() => handlePasteReplace(frameIndex)}
                        onMoveFirst={() => handleMoveFirst(frameIndex)}
                        onMoveLast={() => handleMoveLast(frameIndex)}
                        onMovePrev={() => handleMovePrev(frameIndex)}
                        onMoveNext={() => handleMoveNext(frameIndex)}
                        onAddEmptyBefore={() => handleAddEmptyBefore(frameIndex)}
                        onAddEmptyAfter={() => handleAddEmptyAfter(frameIndex)}
                        onAddMultipleEmptyBefore={(count) => handleAddMultipleEmptyBefore(frameIndex, count)}
                        onAddMultipleEmptyAfter={(count) => handleAddMultipleEmptyAfter(frameIndex, count)}
                        onAddFromClipboardBefore={(urls) => handleAddFromClipboardBefore(frameIndex, urls)}
                        onAddFromClipboardAfter={(urls) => handleAddFromClipboardAfter(frameIndex, urls)}
                        onResizeStart={handleResizeStart}
                        onFrameClick={() => onFrameSelect?.(index, frameIndex)}
                        hasClipboard={!!clipboardFrame}
                        timelineWidth={getFrameWidthForTimeline(frame.delay)}
                        timelineHeight={TIMELINE_HEIGHT}
                      />
                    ))}
                    <Paper
                      sx={{
                        minWidth: 60,
                        height: TIMELINE_HEIGHT,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '2px dashed',
                        borderColor: 'divider',
                        borderRadius: 1,
                        cursor: 'pointer',
                        bgcolor: 'transparent',
                        transition: 'all 0.2s',
                        '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
                      }}
                      onClick={handleAddFrame}
                    >
                      <AddIcon color="action" fontSize="small" />
                    </Paper>
                  </Box>
                </SortableContext>
              </DndContext>
            ) : viewMode === 'grid' ? (
              /* Grid View - equal size frames */
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={sequence.frames.map(f => f.frameId)} strategy={horizontalListSortingStrategy}>
                  <Box
                    sx={{
                      display: 'flex',
                      gap: 1,
                      flexWrap: 'wrap',
                      p: 1.5,
                      bgcolor: (theme) => theme.palette.mode === 'dark' ? 'grey.800' : 'grey.100',
                      borderRadius: 1,
                    }}
                  >
                    {sequence.frames.map((frame, frameIndex) => (
                      <FrameEditor
                        key={frame.frameId}
                        frame={frame}
                        frameIndex={frameIndex}
                        totalFrames={sequence.frames.length}
                        onUpdate={(updated) => handleUpdateFrame(frameIndex, updated)}
                        onDelete={() => handleDeleteFrame(frameIndex)}
                        onDuplicateBefore={() => handleDuplicateBefore(frameIndex)}
                        onDuplicateAfter={() => handleDuplicateAfter(frameIndex)}
                        onCopy={() => handleCopyFrame(frameIndex)}
                        onPasteBefore={() => handlePasteBefore(frameIndex)}
                        onPasteAfter={() => handlePasteAfter(frameIndex)}
                        onPasteReplace={() => handlePasteReplace(frameIndex)}
                        onMoveFirst={() => handleMoveFirst(frameIndex)}
                        onMoveLast={() => handleMoveLast(frameIndex)}
                        onMovePrev={() => handleMovePrev(frameIndex)}
                        onMoveNext={() => handleMoveNext(frameIndex)}
                        onAddEmptyBefore={() => handleAddEmptyBefore(frameIndex)}
                        onAddEmptyAfter={() => handleAddEmptyAfter(frameIndex)}
                        onAddMultipleEmptyBefore={(count) => handleAddMultipleEmptyBefore(frameIndex, count)}
                        onAddMultipleEmptyAfter={(count) => handleAddMultipleEmptyAfter(frameIndex, count)}
                        onAddFromClipboardBefore={(urls) => handleAddFromClipboardBefore(frameIndex, urls)}
                        onAddFromClipboardAfter={(urls) => handleAddFromClipboardAfter(frameIndex, urls)}
                        onFrameClick={() => onFrameSelect?.(index, frameIndex)}
                        hasClipboard={!!clipboardFrame}
                      />
                    ))}
                    <Paper
                      sx={{
                        width: 100,
                        height: 100,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '2px dashed',
                        borderColor: 'divider',
                        borderRadius: 1,
                        cursor: 'pointer',
                        bgcolor: 'transparent',
                        transition: 'all 0.2s',
                        '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
                      }}
                      onClick={handleAddFrame}
                    >
                      <AddIcon color="action" />
                    </Paper>
                  </Box>
                </SortableContext>
              </DndContext>
            ) : (
              /* List View - detailed frame information */
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
                modifiers={[restrictToVerticalAxis]}
              >
                <SortableContext
                  items={sequence.frames.map((f) => f.frameId)}
                  strategy={verticalListSortingStrategy}
                >
                  <Box
                    sx={{
                      p: 1.5,
                      bgcolor: (theme) => theme.palette.mode === 'dark' ? 'grey.800' : 'grey.100',
                      borderRadius: 1,
                    }}
                  >
                    {sequence.frames.map((frame, frameIndex) => {
                      // Calculate time position
                      const startTime = sequence.frames.slice(0, frameIndex).reduce((sum, f) => sum + f.delay, 0);
                      const endTime = startTime + frame.delay;

                      return (
                        <SortableListItem
                          key={frame.frameId}
                          frame={frame}
                          frameIndex={frameIndex}
                          totalFrames={sequence.frames.length}
                          startTime={startTime}
                          endTime={endTime}
                          onEdit={() => setListEditingFrameIndex(frameIndex)}
                          onMovePrev={() => handleMovePrev(frameIndex)}
                          onMoveNext={() => handleMoveNext(frameIndex)}
                          onMoveFirst={() => handleMoveFirst(frameIndex)}
                          onMoveLast={() => handleMoveLast(frameIndex)}
                          onDelete={() => handleDeleteFrame(frameIndex)}
                          onDuplicateBefore={() => handleDuplicateBefore(frameIndex)}
                          onDuplicateAfter={() => handleDuplicateAfter(frameIndex)}
                          onCopy={() => handleCopyFrame(frameIndex)}
                          onPasteBefore={() => handlePasteBefore(frameIndex)}
                          onPasteAfter={() => handlePasteAfter(frameIndex)}
                          onPasteReplace={() => handlePasteReplace(frameIndex)}
                          onAddEmptyBefore={() => handleAddEmptyBefore(frameIndex)}
                          onAddEmptyAfter={() => handleAddEmptyAfter(frameIndex)}
                          onAddMultipleEmptyBefore={(count) => handleAddMultipleEmptyBefore(frameIndex, count)}
                          onAddMultipleEmptyAfter={(count) => handleAddMultipleEmptyAfter(frameIndex, count)}
                          onAddFromClipboardBefore={(urls) => handleAddFromClipboardBefore(frameIndex, urls)}
                          onAddFromClipboardAfter={(urls) => handleAddFromClipboardAfter(frameIndex, urls)}
                          onFrameClick={() => onFrameSelect?.(index, frameIndex)}
                          hasClipboard={!!clipboardFrame}
                          t={t}
                        />
                      );
                    })}
                    <Button
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={handleAddFrame}
                      sx={{ mt: 1 }}
                    >
                      {t('banners.addFrame')}
                    </Button>

                    {/* Hidden FrameEditor for list view editing */}
                    {listEditingFrameIndex !== null && sequence.frames[listEditingFrameIndex] && (
                      <Box sx={{ display: 'none' }}>
                        <FrameEditor
                          frame={sequence.frames[listEditingFrameIndex]}
                          frameIndex={listEditingFrameIndex}
                          totalFrames={sequence.frames.length}
                          onUpdate={(updated) => {
                            handleUpdateFrame(listEditingFrameIndex, updated);
                          }}
                          onDelete={() => {
                            handleDeleteFrame(listEditingFrameIndex);
                            setListEditingFrameIndex(null);
                          }}
                          onDuplicateBefore={() => handleDuplicateBefore(listEditingFrameIndex)}
                          onDuplicateAfter={() => handleDuplicateAfter(listEditingFrameIndex)}
                          onCopy={() => handleCopyFrame(listEditingFrameIndex)}
                          onPasteBefore={() => handlePasteBefore(listEditingFrameIndex)}
                          onPasteAfter={() => handlePasteAfter(listEditingFrameIndex)}
                          onPasteReplace={() => handlePasteReplace(listEditingFrameIndex)}
                          onMoveFirst={() => handleMoveFirst(listEditingFrameIndex)}
                          onMoveLast={() => handleMoveLast(listEditingFrameIndex)}
                          onMovePrev={() => handleMovePrev(listEditingFrameIndex)}
                          onMoveNext={() => handleMoveNext(listEditingFrameIndex)}
                          onAddEmptyBefore={() => handleAddEmptyBefore(listEditingFrameIndex)}
                          onAddEmptyAfter={() => handleAddEmptyAfter(listEditingFrameIndex)}
                          onAddMultipleEmptyBefore={(count) => handleAddMultipleEmptyBefore(listEditingFrameIndex, count)}
                          onAddMultipleEmptyAfter={(count) => handleAddMultipleEmptyAfter(listEditingFrameIndex, count)}
                          onAddFromClipboardBefore={(urls) => handleAddFromClipboardBefore(listEditingFrameIndex, urls)}
                          onAddFromClipboardAfter={(urls) => handleAddFromClipboardAfter(listEditingFrameIndex, urls)}
                          hasClipboard={!!clipboardFrame}
                          forceDialogOpen
                          onDialogClose={() => setListEditingFrameIndex(null)}
                        />
                      </Box>
                    )}
                  </Box>
                </SortableContext>
              </DndContext>
            )}
          </Box>
        </Stack>
      </Collapse>
    </Paper>
  );
};

export default SequenceEditor;
