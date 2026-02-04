import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Button,
  TextField,
  Box,
  Typography,
  IconButton,
  Paper,
  Stack,
  Grid,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tooltip,
  FormControl,
  FormControlLabel,
  Checkbox,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  AlertTitle,
} from '@mui/material';
import {
  Add as AddIcon,
  ExpandMore as ExpandMoreIcon,
  Visibility as VisibilityIcon,
  Info as InfoIcon,
  ViewList as ViewListIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
} from '@mui/icons-material';
import ResizableDrawer from '../common/ResizableDrawer';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useNavigate } from 'react-router-dom';
import { showChangeRequestCreatedToast } from '../../utils/changeRequestToast';
import { getActionLabel } from '../../utils/changeRequestToast';
import { useEnvironment } from '../../contexts/EnvironmentContext';
import { parseApiErrorMessage } from '../../utils/errorUtils';
import bannerService, { Banner, Sequence, LoopModeType } from '../../services/bannerService';
import { generateULID } from '../../utils/ulid';
import SequenceEditor from './SequenceEditor';
import BannerPreview from './BannerPreview';
import { useEntityLock } from '../../hooks/useEntityLock';

interface BannerFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  banner?: Banner | null;
}

// Predefined banner sizes
const BANNER_SIZE_PRESETS = [
  { label: '1024 × 512 (2:1)', width: 1024, height: 512 },
  { label: '728 × 90 (Leaderboard)', width: 728, height: 90 },
  { label: '300 × 250 (Medium Rectangle)', width: 300, height: 250 },
  { label: '320 × 100 (Large Mobile)', width: 320, height: 100 },
  { label: '468 × 60 (Banner)', width: 468, height: 60 },
  { label: '320 × 50 (Mobile)', width: 320, height: 50 },
  { label: '970 × 250 (Billboard)', width: 970, height: 250 },
  { label: '300 × 600 (Half Page)', width: 300, height: 600 },
  { label: '160 × 600 (Wide Skyscraper)', width: 160, height: 600 },
  { label: '1200 × 628 (Social)', width: 1200, height: 628 },
  { value: 'custom', label: '' }, // Custom will be set with translation
];

// Max undo/redo history size
const MAX_HISTORY_SIZE = 50;

const BannerFormDialog: React.FC<BannerFormDialogProps> = ({ open, onClose, onSave, banner }) => {
  const { t } = useTranslation();
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const navigate = useNavigate();
  const { currentEnvironment } = useEnvironment();
  const requiresApproval = currentEnvironment?.requiresApproval ?? false;

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [width, setWidth] = useState(1024);
  const [height, setHeight] = useState(512);
  const [sizePreset, setSizePreset] = useState('1024x512');
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [shuffle, setShuffle] = useState(false);
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [saving, setSaving] = useState(false);

  // Entity Lock for edit mode
  const { hasLock, lockedBy, pendingCR, forceTakeover } = useEntityLock({
    table: 'g_banners',
    entityId: banner?.bannerId || null,
    isEditing: open && !!banner,
    // onLockLost is called when lock is taken - toast is now handled by useEntityLock via SSE
  });

  // Accordion expansion states
  const [basicInfoExpanded, setBasicInfoExpanded] = useState(true);
  const [sequenceExpanded, setSequenceExpanded] = useState(true);
  const [previewExpanded, setPreviewExpanded] = useState(true);

  // Frame selection for preview sync
  const [selectedPreviewFrame, setSelectedPreviewFrame] = useState<{
    sequenceIndex: number;
    frameIndex: number;
  } | null>(null);

  // Get size preset value from width/height
  const getSizePresetValue = useCallback((w: number, h: number) => {
    const match = BANNER_SIZE_PRESETS.find((p) => p.width === w && p.height === h);
    return match ? `${w}x${h}` : 'custom';
  }, []);

  // Handle size preset change
  const handleSizePresetChange = useCallback((value: string) => {
    setSizePreset(value);
    if (value !== 'custom') {
      const [w, h] = value.split('x').map(Number);
      setWidth(w);
      setHeight(h);
    }
  }, []);

  // Refs
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Undo/Redo history
  const [sequenceHistory, setSequenceHistory] = useState<Sequence[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isUndoRedoRef = useRef(false);

  // Initialize form
  useEffect(() => {
    if (banner) {
      setName(banner.name);
      setDescription(banner.description || '');
      setWidth(banner.width);
      setHeight(banner.height);
      setSizePreset(getSizePresetValue(banner.width, banner.height));
      setPlaybackSpeed(banner.playbackSpeed);
      setShuffle(banner.shuffle ?? false);
      const initialSequences = banner.sequences ? JSON.parse(JSON.stringify(banner.sequences)) : [];
      setSequences(initialSequences);
      setSequenceHistory([initialSequences]);
      setHistoryIndex(0);
    } else {
      // Reset form for new banner
      setName('');
      setDescription('');
      setWidth(1024);
      setHeight(512);
      setSizePreset('1024x512');
      setPlaybackSpeed(1.0);
      setShuffle(false);
      setSequences([]);
      setSequenceHistory([[]]);
      setHistoryIndex(0);
    }
  }, [banner, open, getSizePresetValue]);

  // Check if form is dirty (data changed)
  const isDirty = useMemo(() => {
    if (!banner) return true;

    const currentData = {
      name: name.trim(),
      description: description.trim() || '',
      width,
      height,
      playbackSpeed,
      shuffle: !!shuffle,
      sequences: sequences.map((s) => ({
        name: s.name,
        speedMultiplier: s.speedMultiplier,
        loopMode: s.loopMode,
        frames: (s.frames || []).map((f) => ({
          imageUrl: f.imageUrl,
          delay: f.delay,
          link: f.link || '',
        })),
      })),
    };

    const originalData = {
      name: banner.name.trim(),
      description: banner.description?.trim() || '',
      width: banner.width,
      height: banner.height,
      playbackSpeed: banner.playbackSpeed,
      shuffle: !!banner.shuffle,
      sequences: (banner.sequences || []).map((s) => ({
        name: s.name,
        speedMultiplier: s.speedMultiplier,
        loopMode: s.loopMode,
        frames: (s.frames || []).map((f) => ({
          imageUrl: f.imageUrl,
          delay: f.delay,
          link: f.link || '',
        })),
      })),
    };

    return JSON.stringify(currentData) !== JSON.stringify(originalData);
  }, [banner, name, description, width, height, playbackSpeed, shuffle, sequences]);

  // Focus name input when dialog opens
  useEffect(() => {
    if (open) {
      // Use setTimeout to ensure the input is rendered
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 100);
    }
  }, [open]);

  // Update history when sequences change (except from undo/redo)
  useEffect(() => {
    if (isUndoRedoRef.current) {
      isUndoRedoRef.current = false;
      return;
    }
    // Skip initial render
    if (historyIndex === -1) return;

    // Don't add to history if the sequences are the same as current history
    const currentHistoryState = sequenceHistory[historyIndex];
    if (JSON.stringify(currentHistoryState) === JSON.stringify(sequences)) return;

    // Remove future history and add new state
    const newHistory = sequenceHistory.slice(0, historyIndex + 1);
    newHistory.push(JSON.parse(JSON.stringify(sequences)));

    // Limit history size
    if (newHistory.length > MAX_HISTORY_SIZE) {
      newHistory.shift();
    }

    setSequenceHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [sequences]);

  // Undo/Redo handlers
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      isUndoRedoRef.current = true;
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setSequences(JSON.parse(JSON.stringify(sequenceHistory[newIndex])));
    }
  }, [historyIndex, sequenceHistory]);

  const handleRedo = useCallback(() => {
    if (historyIndex < sequenceHistory.length - 1) {
      isUndoRedoRef.current = true;
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setSequences(JSON.parse(JSON.stringify(sequenceHistory[newIndex])));
    }
  }, [historyIndex, sequenceHistory]);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        e.preventDefault();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        handleRedo();
        e.preventDefault();
      }
    };

    if (open) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, handleUndo, handleRedo]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < sequenceHistory.length - 1;

  // Regex for valid identifier: lowercase letters, numbers, underscore, hyphen (must start with letter)
  const BANNER_NAME_REGEX = /^[a-z][a-z0-9_-]*$/;

  // Validate banner name format
  const isValidBannerName = (value: string): boolean => {
    return BANNER_NAME_REGEX.test(value);
  };

  // Get name validation error message
  const getNameError = (): string | null => {
    if (!name.trim()) {
      return null; // Don't show error for empty field until save
    }
    if (!isValidBannerName(name)) {
      return t('banners.nameInvalidFormat');
    }
    return null;
  };

  const nameError = getNameError();

  const handleSave = async () => {
    if (!name.trim()) {
      enqueueSnackbar(t('banners.nameRequired'), { variant: 'error' });
      return;
    }

    // Validate name format
    if (!isValidBannerName(name)) {
      enqueueSnackbar(t('banners.nameInvalidFormat'), { variant: 'error' });
      return;
    }

    setSaving(true);
    try {
      if (banner) {
        const result = await bannerService.updateBanner(banner.bannerId, {
          name,
          description,
          width,
          height,
          playbackSpeed,
          shuffle,
          sequences,
        });
        if (result.isChangeRequest) {
          showChangeRequestCreatedToast(enqueueSnackbar, closeSnackbar, navigate);
        } else {
          enqueueSnackbar(t('banners.updateSuccess'), { variant: 'success' });
        }
      } else {
        const result = await bannerService.createBanner({
          name,
          description,
          width,
          height,
          playbackSpeed,
          shuffle,
          sequences,
        });
        if (result.isChangeRequest) {
          showChangeRequestCreatedToast(enqueueSnackbar, closeSnackbar, navigate);
        } else {
          enqueueSnackbar(t('banners.createSuccess'), { variant: 'success' });
        }
      }
      onSave();
    } catch (error: any) {
      // Handle specific error codes from backend
      const errorCode = error.response?.data?.error?.code || error.code;
      if (errorCode === 'DUPLICATE_NAME') {
        enqueueSnackbar(t('banners.nameDuplicate'), { variant: 'error' });
      } else if (errorCode === 'INVALID_NAME_FORMAT') {
        enqueueSnackbar(t('banners.nameInvalidFormat'), { variant: 'error' });
      } else {
        const fallbackKey = currentEnvironment?.requiresApproval
          ? 'banners.requestSaveFailed'
          : 'banners.saveFailed';
        enqueueSnackbar(parseApiErrorMessage(error, fallbackKey), {
          variant: 'error',
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleAddSequence = () => {
    const newSequence: Sequence = {
      sequenceId: generateULID(),
      name: `${t('banners.sequence')} ${sequences.length + 1}`,
      speedMultiplier: 1.0,
      loopMode: 'loop' as LoopModeType,
      frames: [],
    };
    setSequences([...sequences, newSequence]);
  };

  const handleUpdateSequence = (index: number, updatedSequence: Sequence) => {
    const newSequences = [...sequences];
    newSequences[index] = updatedSequence;
    setSequences(newSequences);
  };

  const handleDeleteSequence = (index: number) => {
    setSequences(sequences.filter((_, i) => i !== index));
  };

  const handleMoveSequence = (fromIndex: number, toIndex: number) => {
    const newSequences = [...sequences];
    const [removed] = newSequences.splice(fromIndex, 1);
    newSequences.splice(toIndex, 0, removed);
    setSequences(newSequences);
  };

  const isEditing = !!banner;

  return (
    <ResizableDrawer
      open={open}
      onClose={onClose}
      title={isEditing ? t('banners.editBanner') : t('banners.createBanner')}
      storageKey="bannerFormDrawerWidth"
      defaultWidth={900}
      minWidth={700}
    >
      <Box
        sx={{
          p: 3,
          overflow: 'auto',
          flex: 1,
        }}
      >
        {/* Lock Warnings */}
        {banner && lockedBy && !hasLock && (
          <Alert
            severity="warning"
            sx={{ mb: 2 }}
            action={
              <Button color="inherit" size="small" onClick={forceTakeover}>
                {t('entityLock.takeOver')}
              </Button>
            }
          >
            <AlertTitle>
              {t('entityLock.warning', {
                userName: lockedBy.userName,
                userEmail: lockedBy.userEmail,
              })}
            </AlertTitle>
          </Alert>
        )}

        {banner && pendingCR && (
          <Alert severity="info" sx={{ mb: 2 }}>
            <AlertTitle>{t('entityLock.pendingCR')}</AlertTitle>
            {t('entityLock.pendingCRDetail', {
              crTitle: pendingCR.crTitle,
              crId: pendingCR.crId,
            })}
          </Alert>
        )}

        {/* Basic Info Accordion */}
        <Accordion
          expanded={basicInfoExpanded}
          onChange={(_, expanded) => setBasicInfoExpanded(expanded)}
          sx={{
            mb: 1,
            bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'grey.900' : 'grey.50'),
            '&:before': { display: 'none' },
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            sx={{
              minHeight: 48,
              '& .MuiAccordionSummary-content': { my: 1 },
            }}
          >
            <InfoIcon sx={{ mr: 1, color: 'text.secondary' }} />
            <Typography variant="subtitle2" fontWeight={600}>
              {t('banners.basicInfo')}
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ p: 2 }}>
            <Stack spacing={2}>
              <TextField
                inputRef={nameInputRef}
                label={t('banners.name')}
                value={name}
                onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                fullWidth
                required
                size="small"
                error={!!nameError}
                helperText={nameError || t('banners.nameHelperText')}
                placeholder="main_banner"
              />
              <TextField
                label={t('banners.description')}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                fullWidth
                multiline
                rows={2}
                size="small"
              />
              <Divider />
              {/* Size row: Preset + (Custom fields if selected) */}
              <Stack direction="row" spacing={2}>
                <Box sx={{ flex: sizePreset === 'custom' ? 4 : 6 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel>{t('banners.sizePreset')}</InputLabel>
                    <Select
                      value={sizePreset}
                      label={t('banners.sizePreset')}
                      onChange={(e) => handleSizePresetChange(e.target.value)}
                    >
                      {BANNER_SIZE_PRESETS.map((preset) => (
                        <MenuItem
                          key={preset.value || `${preset.width}x${preset.height}`}
                          value={preset.value || `${preset.width}x${preset.height}`}
                        >
                          {preset.value === 'custom' ? t('banners.customSize') : preset.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
                {sizePreset === 'custom' && (
                  <>
                    <Box sx={{ flex: 4 }}>
                      <TextField
                        label={t('banners.width')}
                        value={width}
                        onChange={(e) => setWidth(Number(e.target.value) || 0)}
                        fullWidth
                        size="small"
                        inputProps={{ style: { MozAppearance: 'textfield' } }}
                        sx={{
                          '& input[type=number]': {
                            MozAppearance: 'textfield',
                          },
                          '& input[type=number]::-webkit-outer-spin-button': {
                            WebkitAppearance: 'none',
                            margin: 0,
                          },
                          '& input[type=number]::-webkit-inner-spin-button': {
                            WebkitAppearance: 'none',
                            margin: 0,
                          },
                        }}
                      />
                    </Box>
                    <Box sx={{ flex: 4 }}>
                      <TextField
                        label={t('banners.height')}
                        value={height}
                        onChange={(e) => setHeight(Number(e.target.value) || 0)}
                        fullWidth
                        size="small"
                        inputProps={{ style: { MozAppearance: 'textfield' } }}
                        sx={{
                          '& input[type=number]': {
                            MozAppearance: 'textfield',
                          },
                          '& input[type=number]::-webkit-outer-spin-button': {
                            WebkitAppearance: 'none',
                            margin: 0,
                          },
                          '& input[type=number]::-webkit-inner-spin-button': {
                            WebkitAppearance: 'none',
                            margin: 0,
                          },
                        }}
                      />
                    </Box>
                  </>
                )}
                {sizePreset !== 'custom' && (
                  <>
                    <Box sx={{ flex: 4 }}>
                      <TextField
                        label={t('banners.playbackSpeed')}
                        value={playbackSpeed}
                        onChange={(e) => setPlaybackSpeed(Number(e.target.value) || 1)}
                        fullWidth
                        size="small"
                        inputProps={{ style: { MozAppearance: 'textfield' } }}
                        sx={{
                          '& input[type=number]': {
                            MozAppearance: 'textfield',
                          },
                          '& input[type=number]::-webkit-outer-spin-button': {
                            WebkitAppearance: 'none',
                            margin: 0,
                          },
                          '& input[type=number]::-webkit-inner-spin-button': {
                            WebkitAppearance: 'none',
                            margin: 0,
                          },
                        }}
                      />
                    </Box>
                    <Box sx={{ flex: 2, display: 'flex', alignItems: 'center' }}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={shuffle}
                            onChange={(e) => setShuffle(e.target.checked)}
                            size="small"
                          />
                        }
                        label={t('banners.shuffleMode')}
                      />
                    </Box>
                  </>
                )}
              </Stack>
              {/* Playback speed and shuffle on separate row when custom size */}
              {sizePreset === 'custom' && (
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                  <TextField
                    label={t('banners.playbackSpeed')}
                    value={playbackSpeed}
                    onChange={(e) => setPlaybackSpeed(Number(e.target.value) || 1)}
                    size="small"
                    sx={{
                      flex: 1,
                      '& input[type=number]': { MozAppearance: 'textfield' },
                      '& input[type=number]::-webkit-outer-spin-button': {
                        WebkitAppearance: 'none',
                        margin: 0,
                      },
                      '& input[type=number]::-webkit-inner-spin-button': {
                        WebkitAppearance: 'none',
                        margin: 0,
                      },
                    }}
                    inputProps={{ style: { MozAppearance: 'textfield' } }}
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={shuffle}
                        onChange={(e) => setShuffle(e.target.checked)}
                        size="small"
                      />
                    }
                    label={t('banners.shuffleMode')}
                  />
                </Box>
              )}
            </Stack>
          </AccordionDetails>
        </Accordion>

        {/* Sequence Accordion */}
        <Accordion
          expanded={sequenceExpanded}
          onChange={(_, expanded) => setSequenceExpanded(expanded)}
          sx={{
            mb: 1,
            bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'grey.900' : 'grey.50'),
            '&:before': { display: 'none' },
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            sx={{
              minHeight: 48,
              '& .MuiAccordionSummary-content': { my: 1 },
            }}
          >
            <ViewListIcon sx={{ mr: 1, color: 'text.secondary' }} />
            <Typography variant="subtitle2" fontWeight={600}>
              {t('banners.sequencesTab')}
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ p: 2 }}>
            {/* Toolbar: Undo/Redo | Add Sequence */}
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                mb: 2,
              }}
            >
              <Tooltip title={`${t('common.undo')} (Ctrl+Z)`}>
                <span>
                  <IconButton size="small" onClick={handleUndo} disabled={!canUndo} sx={{ p: 0.5 }}>
                    <UndoIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title={`${t('common.redo')} (Ctrl+Y)`}>
                <span>
                  <IconButton size="small" onClick={handleRedo} disabled={!canRedo} sx={{ p: 0.5 }}>
                    <RedoIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Divider
                orientation="vertical"
                flexItem
                sx={{ mx: 1, height: 24, alignSelf: 'center' }}
              />
              <Button
                variant="outlined"
                size="small"
                startIcon={<AddIcon />}
                onClick={handleAddSequence}
              >
                {t('banners.addSequence')}
              </Button>
            </Box>
            {sequences.length === 0 ? (
              <Paper sx={{ p: 4, textAlign: 'center', bgcolor: 'action.hover' }}>
                <Typography color="text.secondary">{t('banners.noSequences')}</Typography>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={handleAddSequence}
                  sx={{ mt: 2 }}
                >
                  {t('banners.addFirstSequence')}
                </Button>
              </Paper>
            ) : (
              <Stack spacing={2}>
                {sequences.map((sequence, index) => (
                  <SequenceEditor
                    key={sequence.sequenceId}
                    sequence={sequence}
                    index={index}
                    totalCount={sequences.length}
                    onUpdate={(updated) => handleUpdateSequence(index, updated)}
                    onDelete={() => handleDeleteSequence(index)}
                    onMoveUp={() => index > 0 && handleMoveSequence(index, index - 1)}
                    onMoveDown={() =>
                      index < sequences.length - 1 && handleMoveSequence(index, index + 1)
                    }
                    onFrameSelect={(seqIdx, frameIdx) =>
                      setSelectedPreviewFrame({
                        sequenceIndex: seqIdx,
                        frameIndex: frameIdx,
                      })
                    }
                  />
                ))}
              </Stack>
            )}
          </AccordionDetails>
        </Accordion>

        {/* Preview Accordion */}
        <Accordion
          expanded={previewExpanded}
          onChange={(_, expanded) => setPreviewExpanded(expanded)}
          sx={{
            mb: 1,
            bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'grey.900' : 'grey.50'),
            '&:before': { display: 'none' },
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            sx={{
              minHeight: 48,
              '& .MuiAccordionSummary-content': { my: 1 },
            }}
          >
            <VisibilityIcon sx={{ mr: 1, color: 'text.secondary' }} />
            <Typography variant="subtitle2" fontWeight={600}>
              {t('banners.previewTitle')}
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ p: 3 }}>
            <BannerPreview
              width={width}
              height={height}
              sequences={sequences}
              playbackSpeed={playbackSpeed}
              selectedSequenceIndex={selectedPreviewFrame?.sequenceIndex}
              selectedFrameIndex={selectedPreviewFrame?.frameIndex}
            />
          </AccordionDetails>
        </Accordion>
      </Box>

      {/* Footer */}
      <Divider />
      <Box sx={{ p: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving || (!!banner && !isDirty)}
        >
          {saving
            ? t('common.saving')
            : getActionLabel(isEditing ? 'update' : 'create', requiresApproval, t)}
        </Button>
      </Box>
    </ResizableDrawer>
  );
};

export default BannerFormDialog;
