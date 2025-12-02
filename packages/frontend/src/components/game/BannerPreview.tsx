import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Box, Typography, IconButton, Slider, Stack, keyframes, FormControl, Select, MenuItem, Chip } from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  SkipNext as SkipNextIcon,
  SkipPrevious as SkipPreviousIcon,
  Replay as ReplayIcon,
  ImageNotSupported as NoImageIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { Sequence, Frame, FrameEffectType, TransitionType } from '../../services/bannerService';

// Keyframe animations for frame effects
const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const fadeOut = keyframes`
  from { opacity: 1; }
  to { opacity: 0; }
`;

const slideLeft = keyframes`
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
`;

const slideRight = keyframes`
  from { transform: translateX(-100%); }
  to { transform: translateX(0); }
`;

const slideUp = keyframes`
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
`;

const slideDown = keyframes`
  from { transform: translateY(-100%); }
  to { transform: translateY(0); }
`;

const zoomIn = keyframes`
  from { transform: scale(0); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
`;

const zoomOut = keyframes`
  from { transform: scale(1.5); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
`;

const shake = keyframes`
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
  20%, 40%, 60%, 80% { transform: translateX(5px); }
`;

// Transition animations
const crossfade = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const slideTransition = keyframes`
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
`;

// Map effect types to keyframe animations
const effectAnimations: Record<FrameEffectType, ReturnType<typeof keyframes> | null> = {
  fadeIn,
  fadeOut,
  slideLeft,
  slideRight,
  slideUp,
  slideDown,
  zoomIn,
  zoomOut,
  shake,
  none: null,
};

// Map transition types to keyframe animations
const transitionAnimations: Record<TransitionType, ReturnType<typeof keyframes> | null> = {
  fade: fadeIn,
  crossfade,
  slide: slideTransition,
  none: null,
};

interface BannerPreviewProps {
  width: number;
  height: number;
  sequences: Sequence[];
  playbackSpeed: number;
}

interface ExtendedFrame extends Frame {
  sequenceIndex: number;
  frameIndex: number;
  sequenceName: string;
  speedMultiplier: number;
  loopMode: 'loop' | 'pingpong' | 'once';
}

// Extract filename from URL for display
const getFileNameFromUrl = (url: string): string => {
  if (!url) return '';
  try {
    const pathname = new URL(url).pathname;
    const filename = pathname.split('/').pop() || '';
    // Show last 20 characters if too long
    if (filename.length > 20) {
      return '...' + filename.slice(-20);
    }
    return filename;
  } catch {
    // If not a valid URL, just show the end portion
    if (url.length > 20) {
      return '...' + url.slice(-20);
    }
    return url;
  }
};

// Format milliseconds to seconds (e.g., 1500 -> "1.50s")
const formatTime = (ms: number): string => {
  return (ms / 1000).toFixed(2) + 's';
};

const BannerPreview: React.FC<BannerPreviewProps> = ({
  width,
  height,
  sequences,
  playbackSpeed,
}) => {
  const { t } = useTranslation();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [prevFrameIndex, setPrevFrameIndex] = useState<number | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [playDirection, setPlayDirection] = useState<1 | -1>(1); // 1 = forward, -1 = backward (for pingpong)
  const [currentTime, setCurrentTime] = useState(0);
  const [selectedSequenceIndex, setSelectedSequenceIndex] = useState<number | 'all'>('all');
  const [isHovering, setIsHovering] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const transitionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Get frames based on selected sequence (or all sequences)
  const allFrames = useMemo(() => {
    const targetSequences = selectedSequenceIndex === 'all'
      ? sequences
      : sequences.filter((_, idx) => idx === selectedSequenceIndex);

    return targetSequences.flatMap((seq, seqIdx) =>
      seq.frames.map((frame, frameIdx) => ({
        ...frame,
        sequenceIndex: selectedSequenceIndex === 'all' ? seqIdx : (selectedSequenceIndex as number),
        frameIndex: frameIdx,
        sequenceName: seq.name,
        speedMultiplier: seq.speedMultiplier,
        loopMode: seq.loopMode || 'loop',
      }))
    );
  }, [sequences, selectedSequenceIndex]);

  // Calculate total duration and cumulative times
  const { totalDuration, frameCumulativeTimes } = useMemo(() => {
    let total = 0;
    const cumulatives: number[] = [];
    allFrames.forEach((frame) => {
      cumulatives.push(total);
      total += (frame.delay / playbackSpeed) / (frame.speedMultiplier || 1);
    });
    return { totalDuration: total, frameCumulativeTimes: cumulatives };
  }, [allFrames, playbackSpeed]);

  const currentFrame = allFrames.length > 0 ? allFrames[currentFrameIndex] : null;
  const previousFrame = prevFrameIndex !== null && allFrames.length > 0 ? allFrames[prevFrameIndex] : null;

  // Get animation style for a frame
  const getAnimationStyle = (frame: ExtendedFrame, isEntering: boolean) => {
    const effectType = isEntering ? frame.effects?.enter : frame.effects?.exit;
    const effectDuration = frame.effects?.duration || 300;
    const transitionType = frame.transition?.type;
    const transitionDuration = frame.transition?.duration || 300;

    // Determine which animation to use
    let animation: ReturnType<typeof keyframes> | null = null;
    let duration = effectDuration;

    if (isEntering && transitionType && transitionType !== 'none') {
      animation = transitionAnimations[transitionType];
      duration = transitionDuration;
    } else if (effectType && effectType !== 'none') {
      animation = effectAnimations[effectType];
    }

    if (!animation) {
      return {};
    }

    return {
      animation: `${animation} ${duration}ms ease-in-out`,
    };
  };

  // Calculate preview dimensions (max 400px width, maintain aspect ratio)
  const maxPreviewWidth = 400;
  const scale = Math.min(1, maxPreviewWidth / width);
  const previewWidth = width * scale;
  const previewHeight = height * scale;

  // Handle frame transition
  const changeFrame = (newIndex: number) => {
    const newFrame = allFrames[newIndex];
    const transitionDuration = newFrame?.transition?.duration || 300;

    // Start transition
    setPrevFrameIndex(currentFrameIndex);
    setIsTransitioning(true);
    setCurrentFrameIndex(newIndex);

    // Clear previous transition timer
    if (transitionTimerRef.current) {
      clearTimeout(transitionTimerRef.current);
    }

    // End transition after duration
    transitionTimerRef.current = setTimeout(() => {
      setIsTransitioning(false);
      setPrevFrameIndex(null);
    }, transitionDuration);
  };

  // Update current time when frame changes
  useEffect(() => {
    if (frameCumulativeTimes.length > 0 && currentFrameIndex < frameCumulativeTimes.length) {
      setCurrentTime(frameCumulativeTimes[currentFrameIndex]);
    }
  }, [currentFrameIndex, frameCumulativeTimes]);

  useEffect(() => {
    if (isPlaying && allFrames.length > 0) {
      const frame = allFrames[currentFrameIndex];
      const delay = (frame.delay / playbackSpeed) / (frame.speedMultiplier || 1);
      const loopMode = frame.loopMode || 'loop';

      timerRef.current = setTimeout(() => {
        let nextIndex: number;
        let newDirection = playDirection;

        if (loopMode === 'pingpong') {
          // PingPong mode: reverse direction at boundaries
          if (playDirection === 1) {
            if (currentFrameIndex >= allFrames.length - 1) {
              nextIndex = currentFrameIndex - 1;
              newDirection = -1;
            } else {
              nextIndex = currentFrameIndex + 1;
            }
          } else {
            if (currentFrameIndex <= 0) {
              nextIndex = currentFrameIndex + 1;
              newDirection = 1;
            } else {
              nextIndex = currentFrameIndex - 1;
            }
          }
          // Ensure index is valid
          nextIndex = Math.max(0, Math.min(allFrames.length - 1, nextIndex));
        } else if (loopMode === 'once') {
          // Once mode: stop at end
          if (currentFrameIndex >= allFrames.length - 1) {
            setIsPlaying(false);
            return;
          }
          nextIndex = currentFrameIndex + 1;
        } else {
          // Loop mode: wrap around
          nextIndex = (currentFrameIndex + 1) % allFrames.length;
        }

        setPlayDirection(newDirection);
        changeFrame(nextIndex);
      }, delay);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [isPlaying, currentFrameIndex, allFrames, playbackSpeed, playDirection]);

  // Cleanup transition timer on unmount
  useEffect(() => {
    return () => {
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current);
      }
    };
  }, []);

  // Control video playback based on isPlaying state
  useEffect(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.play().catch(() => {
          // Ignore autoplay errors (user interaction required)
        });
      } else {
        videoRef.current.pause();
      }
    }
  }, [isPlaying, currentFrameIndex]);

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handlePrevFrame = () => {
    setIsPlaying(false);
    const newIndex = (currentFrameIndex - 1 + allFrames.length) % allFrames.length;
    changeFrame(newIndex);
  };

  const handleNextFrame = () => {
    setIsPlaying(false);
    const newIndex = (currentFrameIndex + 1) % allFrames.length;
    changeFrame(newIndex);
  };

  const handleReset = () => {
    setIsPlaying(false);
    setIsTransitioning(false);
    setPrevFrameIndex(null);
    setCurrentFrameIndex(0);
    setPlayDirection(1);
    setCurrentTime(0);
  };

  const handleSliderChange = (_: Event, value: number | number[]) => {
    setIsPlaying(false);
    setIsTransitioning(false);
    setPrevFrameIndex(null);
    setCurrentFrameIndex(value as number);
    setPlayDirection(1);
  };

  if (sequences.length === 0 || allFrames.length === 0) {
    return (
      <Box
        sx={{
          width: previewWidth,
          height: previewHeight,
          bgcolor: (theme) => theme.palette.mode === 'dark' ? 'grey.800' : 'grey.200',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1.5,
          borderRadius: 1,
          border: 1,
          borderColor: 'divider',
        }}
      >
        <NoImageIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
        <Typography color="text.secondary" variant="body2">
          {t('banners.noFramesToPreview')}
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        bgcolor: (theme) => theme.palette.mode === 'dark' ? 'grey.900' : 'grey.100',
        borderRadius: 2,
        p: 2,
        border: 1,
        borderColor: (theme) => theme.palette.mode === 'dark' ? 'grey.700' : 'grey.300',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      {/* Preview Area */}
      <Box
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        onClick={() => {
          // Open click URL in new tab if available
          if (currentFrame?.clickUrl) {
            window.open(currentFrame.clickUrl, '_blank');
          }
        }}
        sx={{
          width: previewWidth,
          height: previewHeight,
          bgcolor: '#1a1a1a',
          borderRadius: 1,
          overflow: 'hidden',
          position: 'relative',
          cursor: currentFrame?.clickUrl ? 'pointer' : 'default',
          boxShadow: (theme) => theme.palette.mode === 'dark'
            ? 'inset 0 0 0 1px rgba(255,255,255,0.1)'
            : 'inset 0 0 0 1px rgba(0,0,0,0.1)',
        }}
      >
        {/* Previous frame (for crossfade effect) */}
        {isTransitioning && previousFrame?.imageUrl && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              zIndex: 1,
            }}
          >
            {previousFrame.type === 'mp4' ? (
              <video
                src={previousFrame.imageUrl}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                muted
              />
            ) : (
              <img
                src={previousFrame.imageUrl}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            )}
          </Box>
        )}

        {/* Current frame with animation */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 2,
            ...(currentFrame && isTransitioning && getAnimationStyle(currentFrame as ExtendedFrame, true)),
          }}
        >
          {currentFrame?.imageUrl ? (
            currentFrame.type === 'mp4' ? (
              <video
                ref={videoRef}
                key={currentFrame.frameId}
                src={currentFrame.imageUrl}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                loop={currentFrame.loop}
                muted
                playsInline
              />
            ) : (
              <img
                key={currentFrame.frameId}
                src={currentFrame.imageUrl}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            )
          ) : (
            <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography color="grey.500">{t('banners.noImage')}</Typography>
            </Box>
          )}
        </Box>

        {/* Action Info Overlay - shown on hover when clickUrl or action exists */}
        {isHovering && (currentFrame?.clickUrl || (currentFrame?.action?.type && currentFrame.action.type !== 'none')) && (
          <Box
            sx={{
              position: 'absolute',
              top: 8,
              left: 8,
              right: 8,
              bgcolor: 'rgba(25, 118, 210, 0.85)',
              backdropFilter: 'blur(4px)',
              px: 1.5,
              py: 0.75,
              borderRadius: 0.5,
              zIndex: 4,
            }}
          >
            {currentFrame?.clickUrl && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography
                  variant="caption"
                  sx={{
                    color: 'rgba(255,255,255,0.7)',
                    fontSize: '0.65rem',
                  }}
                >
                  🔗 URL:
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: '#fff',
                    fontSize: '0.65rem',
                    fontWeight: 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                  }}
                >
                  {currentFrame.clickUrl}
                </Typography>
              </Box>
            )}
            {currentFrame?.action?.type && currentFrame.action.type !== 'none' && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: currentFrame?.clickUrl ? 0.5 : 0 }}>
                <Typography
                  variant="caption"
                  sx={{
                    color: 'rgba(255,255,255,0.7)',
                    fontSize: '0.65rem',
                  }}
                >
                  ⚡ {t('banners.action')}:
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: '#fff',
                    fontSize: '0.65rem',
                    fontWeight: 500,
                  }}
                >
                  {t(`banners.actionTypes.${currentFrame.action.type}`)} {currentFrame.action.value && `(${currentFrame.action.value})`}
                </Typography>
              </Box>
            )}
          </Box>
        )}

        {/* Frame Info Overlay with padding from content */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 8,
            left: 8,
            right: 8,
            bgcolor: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(4px)',
            px: 1.5,
            py: 0.5,
            borderRadius: 0.5,
            zIndex: 3,
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography
              variant="caption"
              sx={{
                color: 'rgba(255,255,255,0.85)',
                fontWeight: 500,
                fontSize: '0.65rem',
              }}
            >
              {currentFrame?.sequenceName} - {t('banners.frame')} {(currentFrame?.frameIndex || 0) + 1}
              {currentFrame?.imageUrl && (
                <Box component="span" sx={{ color: 'rgba(255,255,255,0.6)', ml: 0.5 }}>
                  ({getFileNameFromUrl(currentFrame.imageUrl)})
                </Box>
              )}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: 'rgba(255,255,255,0.7)',
                fontWeight: 500,
                fontSize: '0.65rem',
              }}
            >
              {currentFrame?.delay ? formatTime(currentFrame.delay) : ''}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Controls */}
      <Box sx={{ width: previewWidth }}>
        {/* Sequence selector - only show when multiple sequences */}
        {sequences.length > 1 && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1, px: 1 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
              {t('banners.sequence')}:
            </Typography>
            <FormControl size="small" sx={{ minWidth: 120, flex: 1 }}>
              <Select
                value={selectedSequenceIndex}
                onChange={(e) => {
                  setSelectedSequenceIndex(e.target.value as number | 'all');
                  setCurrentFrameIndex(0);
                  setCurrentTime(0);
                  setPlayDirection(1);
                }}
                sx={{
                  fontSize: '0.75rem',
                  '& .MuiSelect-select': { py: 0.5 },
                }}
              >
                <MenuItem value="all">
                  <Typography variant="caption">{t('common.all')}</Typography>
                </MenuItem>
                {sequences.map((seq, idx) => (
                  <MenuItem key={seq.sequenceId} value={idx}>
                    <Typography variant="caption">{seq.name || `${t('banners.sequence')} ${idx + 1}`}</Typography>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Chip
              label={`${allFrames.length} ${t('banners.frames')}`}
              size="small"
              sx={{ fontSize: '0.65rem', height: 20 }}
            />
          </Box>
        )}
        <Stack
          direction="row"
          spacing={0.5}
          alignItems="center"
          sx={{
            mt: 1.5,
            px: 1,
            py: 0.75,
            bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
            borderRadius: 1,
          }}
        >
          <IconButton
            size="small"
            onClick={handleReset}
            sx={{
              color: 'text.secondary',
              '&:hover': { color: 'text.primary' },
            }}
          >
            <ReplayIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={handlePrevFrame}
            sx={{
              color: 'text.secondary',
              '&:hover': { color: 'text.primary' },
            }}
          >
            <SkipPreviousIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={handlePlayPause}
            sx={{
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              mx: 0.5,
              '&:hover': {
                bgcolor: 'primary.dark',
              },
            }}
          >
            {isPlaying ? <PauseIcon fontSize="small" /> : <PlayIcon fontSize="small" />}
          </IconButton>
          <IconButton
            size="small"
            onClick={handleNextFrame}
            sx={{
              color: 'text.secondary',
              '&:hover': { color: 'text.primary' },
            }}
          >
            <SkipNextIcon fontSize="small" />
          </IconButton>
          <Slider
            value={currentFrameIndex}
            min={0}
            max={allFrames.length - 1}
            onChange={handleSliderChange}
            size="small"
            sx={{
              flex: 1,
              mx: 1.5,
              '& .MuiSlider-thumb': {
                width: 12,
                height: 12,
              },
              '& .MuiSlider-rail': {
                opacity: 0.3,
              },
            }}
          />
          <Typography
            variant="caption"
            sx={{
              minWidth: 50,
              color: 'text.secondary',
              fontWeight: 500,
              fontSize: '0.7rem',
              textAlign: 'right',
            }}
          >
            {currentFrameIndex + 1} / {allFrames.length}
          </Typography>
        </Stack>
        {/* Time Info */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            px: 1,
            mt: 0.5,
          }}
        >
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
              fontSize: '0.65rem',
            }}
          >
            {formatTime(currentTime)}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
              fontSize: '0.65rem',
            }}
          >
            {formatTime(totalDuration)}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default BannerPreview;

