import React, { useState, useMemo, useEffect } from 'react';
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
} from '@mui/material';
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
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';

interface SequenceEditorProps {
  sequence: Sequence;
  index: number;
  totalCount: number;
  onUpdate: (sequence: Sequence) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

const SequenceEditor: React.FC<SequenceEditorProps> = ({
  sequence,
  index,
  totalCount,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
}) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);
  const [clipboardFrame, setClipboardFrame] = useState<Frame | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'timeline'>(() => {
    // Restore view mode from localStorage
    const saved = localStorage.getItem('bannerSequenceViewMode');
    return (saved === 'timeline' || saved === 'grid') ? saved : 'grid';
  });

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
      </Box>

      <Collapse in={expanded}>
        <Stack spacing={2} sx={{ mt: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={4}>
              <TextField
                label={t('banners.sequenceName')}
                value={sequence.name}
                onChange={(e) => handleNameChange(e.target.value)}
                fullWidth
                size="small"
              />
            </Grid>
            <Grid item xs={4}>
              <TextField
                label={t('banners.speedMultiplier')}
                value={sequence.speedMultiplier}
                onChange={(e) => handleSpeedChange(Number(e.target.value))}
                fullWidth
                size="small"
              />
            </Grid>
            <Grid item xs={4}>
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
            </Grid>
          </Grid>

          {/* Frames */}
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="subtitle2">{t('banners.frames')} ({sequence.frames.length})</Typography>
                {totalDuration > 0 && (
                  <Typography variant="caption" color="text.secondary">
                    • {(totalDuration / 1000).toFixed(1)}s {t('banners.total')}
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
                <Button size="small" startIcon={<AddIcon />} onClick={handleAddFrame} sx={{ mt: 1 }}>
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
                      '&::-webkit-scrollbar': { height: 8 },
                      '&::-webkit-scrollbar-thumb': { bgcolor: 'action.hover', borderRadius: 4 },
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
                          hasClipboard={!!clipboardFrame}
                          timelineWidth={getFrameWidthForTimeline(frame.delay)}
                        />
                      ))}
                    <Paper
                      sx={{
                        minWidth: 60,
                        height: 60,
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
            ) : (
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
            )}
          </Box>
        </Stack>
      </Collapse>
    </Paper>
  );
};

export default SequenceEditor;
