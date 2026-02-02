import React, { useState, useCallback, useRef, useEffect } from "react";
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
  Tooltip,
  FormControlLabel,
  Switch,
  InputAdornment,
  Divider,
  Menu,
  ListItemIcon,
  ListItemText,
  Collapse,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import {
  Delete as DeleteIcon,
  DragIndicator as DragIndicatorIcon,
  Image as ImageIcon,
  BrokenImage as BrokenImageIcon,
  Edit as EditIcon,
  ContentCopy as CopyIcon,
  ContentPaste as PasteIcon,
  VerticalAlignTop as MoveFirstIcon,
  VerticalAlignBottom as MoveLastIcon,
  ArrowBack as InsertBeforeIcon,
  ArrowForward as InsertAfterIcon,
  SwapHoriz as ReplaceIcon,
  KeyboardArrowUp as MovePrevIcon,
  KeyboardArrowDown as MoveNextIcon,
  Add as AddIcon,
  AddCircleOutline as AddMultipleIcon,
  Link as LinkIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  FilterList as FilterIcon,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import {
  Frame,
  FrameType,
  FrameActionType,
  FrameEffectType,
  TransitionType,
  FrameTargeting,
  FrameFilterLogic,
} from "../../services/bannerService";
import { usePlatformConfig } from "../../contexts/PlatformConfigContext";
import { useGameWorld } from "../../contexts/GameWorldContext";
import TargetSettingsGroup, {
  ChannelSubchannelData,
} from "./TargetSettingsGroup";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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
  onMovePrev: () => void;
  onMoveNext: () => void;
  onAddEmptyBefore: () => void;
  onAddEmptyAfter: () => void;
  onAddMultipleEmptyBefore: (count: number) => void;
  onAddMultipleEmptyAfter: (count: number) => void;
  onAddFromClipboardBefore: (urls: string[]) => void;
  onAddFromClipboardAfter: (urls: string[]) => void;
  onResizeStart?: (
    frameIndex: number,
    edge: "left" | "right",
    startX: number,
  ) => void;
  onFrameClick?: () => void; // Callback when frame is clicked (for preview sync)
  hasClipboard: boolean;
  timelineWidth?: number; // Optional width for timeline view mode
  timelineHeight?: number; // Optional height for timeline view mode
  forceDialogOpen?: boolean; // Force dialog to open (for list view)
  onDialogClose?: () => void; // Callback when dialog closes (for list view)
}

// Auto-detect frame type from URL extension
const detectFrameType = (url: string): FrameType | null => {
  // Return null if URL is empty or not a valid URL format
  if (!url || !url.trim()) {
    return null;
  }

  // Check if it looks like a valid URL (starts with http://, https://, or //)
  const trimmedUrl = url.trim().toLowerCase();
  if (
    !trimmedUrl.startsWith("http://") &&
    !trimmedUrl.startsWith("https://") &&
    !trimmedUrl.startsWith("//")
  ) {
    return null;
  }

  const ext = url.split("?")[0].split(".").pop()?.toLowerCase();
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "jpg";
    case "png":
      return "png";
    case "gif":
      return "gif";
    case "mp4":
    case "webm":
      return "mp4";
    default:
      return null;
  }
};

// Format delay to seconds (e.g., 1500 -> "1.50s")
const formatDelayToSeconds = (delayMs: number): string => {
  return (delayMs / 1000).toFixed(2) + "s";
};

// Get filename from URL
const getFileNameFromUrl = (url: string): string => {
  try {
    const pathname = new URL(url).pathname;
    const filename = pathname.split("/").pop() || url;
    return filename.length > 25 ? "..." + filename.slice(-22) : filename;
  } catch {
    return url.length > 25 ? "..." + url.slice(-22) : url;
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
  onMovePrev,
  onMoveNext,
  onAddEmptyBefore,
  onAddEmptyAfter,
  onAddMultipleEmptyBefore,
  onAddMultipleEmptyAfter,
  onAddFromClipboardBefore,
  onAddFromClipboardAfter,
  onResizeStart,
  onFrameClick,
  hasClipboard,
  timelineWidth,
  timelineHeight,
  forceDialogOpen,
  onDialogClose,
}) => {
  // Timeline mode: use timelineWidth for width and timelineHeight for height
  const isTimelineMode = !!timelineWidth;
  const frameSize = isTimelineMode ? timelineWidth : 100;
  const frameHeight = isTimelineMode ? timelineHeight || 90 : frameSize;
  const [emptyFrameCountDialogOpen, setEmptyFrameCountDialogOpen] = useState<
    "before" | "after" | null
  >(null);
  const { t } = useTranslation();
  const { platforms, channels } = usePlatformConfig();
  const { worlds } = useGameWorld();
  const [settingsOpen, setSettingsOpen] = useState(forceDialogOpen || false);
  const [imageError, setImageError] = useState(false);

  // Local edit state for dialog (cancel/apply pattern)
  const [editFrame, setEditFrame] = useState<Frame>(frame);
  const [localDelaySeconds, setLocalDelaySeconds] = useState(
    (frame.delay / 1000).toString(),
  );

  // Dynamic conditions expand state
  const [dynamicConditionsExpanded, setDynamicConditionsExpanded] =
    useState(false);

  // Sync forceDialogOpen with settingsOpen
  useEffect(() => {
    if (forceDialogOpen) {
      setSettingsOpen(true);
    }
  }, [forceDialogOpen]);

  // Reset local edit state when dialog opens
  useEffect(() => {
    if (settingsOpen) {
      setEditFrame(frame);
      setLocalDelaySeconds((frame.delay / 1000).toString());
    }
  }, [settingsOpen, frame]);

  // Handle dialog close (cancel)
  const handleDialogClose = useCallback(() => {
    setSettingsOpen(false);
    setEditFrame(frame); // Reset to original
    onDialogClose?.();
  }, [onDialogClose, frame]);

  // Handle dialog apply
  const handleDialogApply = useCallback(() => {
    onUpdate(editFrame);
    setSettingsOpen(false);
    onDialogClose?.();
  }, [editFrame, onUpdate, onDialogClose]);

  // Image metadata state
  const [imageInfo, setImageInfo] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
  } | null>(null);

  // Clipboard image URLs state
  const [clipboardUrls, setClipboardUrls] = useState<string[]>([]);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: frame.frameId,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Parse image URLs from clipboard text
  const parseImageUrls = useCallback((text: string): string[] => {
    // Split by comma or newline
    const parts = text.split(/[,\n\r]+/);
    const urls: string[] = [];

    for (const part of parts) {
      const trimmed = part.trim();
      // Skip empty strings
      if (!trimmed) continue;

      // Check if it looks like a valid URL
      if (
        trimmed.startsWith("http://") ||
        trimmed.startsWith("https://") ||
        trimmed.startsWith("//")
      ) {
        urls.push(trimmed);
      }
    }

    return urls;
  }, []);

  // Read clipboard when context menu opens
  useEffect(() => {
    if (contextMenu !== null) {
      // Try to read clipboard
      if (navigator.clipboard && navigator.clipboard.readText) {
        navigator.clipboard
          .readText()
          .then((text) => {
            const urls = parseImageUrls(text);
            setClipboardUrls(urls);
          })
          .catch(() => {
            // Clipboard read failed (permission denied, etc.)
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

  const handleMenuAction = useCallback(
    (action: () => void) => {
      action();
      handleCloseContextMenu();
    },
    [handleCloseContextMenu],
  );

  // Dialog edit handlers - update local editFrame state
  const handleImageUrlChange = (imageUrl: string) => {
    setImageError(false);
    setImageInfo(null); // Reset image info when URL changes
    const detectedType = detectFrameType(imageUrl);
    // Only set type if detected, otherwise keep previous type or use 'png' as fallback for valid URLs
    setEditFrame({
      ...editFrame,
      imageUrl,
      type: detectedType || editFrame.type || "png",
    });
  };

  // Handle image load to get dimensions
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setImageInfo({ width: img.naturalWidth, height: img.naturalHeight });
  };

  // Handle video load to get dimensions
  const handleVideoLoad = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    setImageInfo({ width: video.videoWidth, height: video.videoHeight });
  };

  const handleDelaySecondsChange = (value: string) => {
    setLocalDelaySeconds(value);
    const seconds = parseFloat(value);
    if (!isNaN(seconds) && seconds >= 0) {
      setEditFrame({ ...editFrame, delay: Math.round(seconds * 1000) });
    }
  };

  const handleLoopChange = (loop: boolean) => {
    setEditFrame({ ...editFrame, loop });
  };

  const handleActionTypeChange = (type: FrameActionType) => {
    setEditFrame({
      ...editFrame,
      action: {
        ...editFrame.action,
        type,
        value: editFrame.action?.value || "",
      },
    });
  };

  const handleActionValueChange = (value: string) => {
    setEditFrame({
      ...editFrame,
      action: {
        ...editFrame.action,
        type: editFrame.action?.type || "none",
        value,
      },
    });
  };

  const handleEffectEnterChange = (enter: FrameEffectType) => {
    setEditFrame({
      ...editFrame,
      effects: { ...editFrame.effects, enter },
    });
  };

  const handleEffectExitChange = (exit: FrameEffectType) => {
    setEditFrame({
      ...editFrame,
      effects: { ...editFrame.effects, exit },
    });
  };

  const handleTransitionTypeChange = (type: TransitionType) => {
    setEditFrame({
      ...editFrame,
      transition: { type, duration: editFrame.transition?.duration || 300 },
    });
  };

  const handleTransitionDurationChange = (durationSeconds: string) => {
    const seconds = parseFloat(durationSeconds);
    if (!isNaN(seconds) && seconds >= 0) {
      setEditFrame({
        ...editFrame,
        transition: {
          type: editFrame.transition?.type || "none",
          duration: Math.round(seconds * 1000),
        },
      });
    }
  };

  // Targeting handlers
  const handleTargetingUpdate = (updates: Partial<FrameTargeting>) => {
    setEditFrame({
      ...editFrame,
      targeting: { ...editFrame.targeting, ...updates },
    });
  };

  const handlePlatformsChange = (
    platformsList: string[],
    inverted: boolean,
  ) => {
    handleTargetingUpdate({
      platforms: platformsList.length > 0 ? platformsList : undefined,
      platformsInverted: inverted,
    });
  };

  const handleChannelsChange = (
    channelsList: ChannelSubchannelData[],
    inverted: boolean,
  ) => {
    handleTargetingUpdate({
      channelSubchannels: channelsList.length > 0 ? channelsList : undefined,
      channelSubchannelsInverted: inverted,
    });
  };

  const handleWorldsChange = (worldsList: string[], inverted: boolean) => {
    handleTargetingUpdate({
      worlds: worldsList.length > 0 ? worldsList : undefined,
      worldsInverted: inverted,
    });
  };

  const handleLevelMinChange = (value: string) => {
    const num = parseInt(value);
    handleTargetingUpdate({
      levelMin: !isNaN(num) && num > 0 ? num : undefined,
    });
  };

  const handleLevelMaxChange = (value: string) => {
    const num = parseInt(value);
    handleTargetingUpdate({
      levelMax: !isNaN(num) && num > 0 ? num : undefined,
    });
  };

  const handleJoinDaysMinChange = (value: string) => {
    const num = parseInt(value);
    handleTargetingUpdate({
      joinDaysMin: !isNaN(num) && num >= 0 ? num : undefined,
    });
  };

  const handleJoinDaysMaxChange = (value: string) => {
    const num = parseInt(value);
    handleTargetingUpdate({
      joinDaysMax: !isNaN(num) && num >= 0 ? num : undefined,
    });
  };

  const handleFilterLogicChange = (logic: FrameFilterLogic) => {
    handleTargetingUpdate({ filterLogic: logic });
  };

  const handleDoubleClick = useCallback(() => {
    setSettingsOpen(true);
  }, []);

  const isVideo = frame.type === "mp4" || frame.type === "gif";
  const isEditVideo = editFrame.type === "mp4" || editFrame.type === "gif";

  // Build tooltip content
  const tooltipContent = (
    <Box sx={{ p: 0.5 }}>
      {/* Info Table */}
      <Box
        component="table"
        sx={{
          borderSpacing: "6px 2px",
          borderCollapse: "separate",
          "& td": { verticalAlign: "top" },
        }}
      >
        <tbody>
          <tr>
            <Box
              component="td"
              sx={{
                color: "grey.400",
                whiteSpace: "nowrap",
                pr: 1,
                fontSize: "0.75rem",
              }}
            >
              {t("banners.frame")}
            </Box>
            <Box component="td" sx={{ fontWeight: 500, fontSize: "0.75rem" }}>
              {frameIndex + 1} / {totalFrames}
            </Box>
          </tr>
          <tr>
            <Box
              component="td"
              sx={{
                color: "grey.400",
                whiteSpace: "nowrap",
                pr: 1,
                fontSize: "0.75rem",
              }}
            >
              {t("banners.type")}
            </Box>
            <Box component="td" sx={{ fontWeight: 500, fontSize: "0.75rem" }}>
              {frame.imageUrl
                ? frame.type?.toUpperCase() || "-"
                : t("banners.imageNotSet")}
            </Box>
          </tr>
          <tr>
            <Box
              component="td"
              sx={{
                color: "grey.400",
                whiteSpace: "nowrap",
                pr: 1,
                fontSize: "0.75rem",
              }}
            >
              {t("banners.frameTime")}
            </Box>
            <Box component="td" sx={{ fontWeight: 500, fontSize: "0.75rem" }}>
              {formatDelayToSeconds(frame.delay)}
            </Box>
          </tr>
          {frame.imageUrl && (
            <tr>
              <Box
                component="td"
                sx={{
                  color: "grey.400",
                  whiteSpace: "nowrap",
                  pr: 1,
                  fontSize: "0.75rem",
                }}
              >
                {t("banners.file")}
              </Box>
              <Box component="td" sx={{ fontWeight: 500, fontSize: "0.75rem" }}>
                {getFileNameFromUrl(frame.imageUrl)}
              </Box>
            </tr>
          )}
          {frame.action?.type && frame.action.type !== "none" && (
            <tr>
              <Box
                component="td"
                sx={{
                  color: "grey.400",
                  whiteSpace: "nowrap",
                  pr: 1,
                  fontSize: "0.75rem",
                }}
              >
                {t("banners.action")}
              </Box>
              <Box component="td" sx={{ fontWeight: 500, fontSize: "0.75rem" }}>
                {t(`banners.actionTypes.${frame.action.type}`)}
              </Box>
            </tr>
          )}
          {frame.effects?.enter && frame.effects.enter !== "none" && (
            <tr>
              <Box
                component="td"
                sx={{
                  color: "grey.400",
                  whiteSpace: "nowrap",
                  pr: 1,
                  fontSize: "0.75rem",
                }}
              >
                {t("banners.enterEffect")}
              </Box>
              <Box component="td" sx={{ fontWeight: 500, fontSize: "0.75rem" }}>
                {t(`banners.effects.${frame.effects.enter}`)}
              </Box>
            </tr>
          )}
          {frame.effects?.exit && frame.effects.exit !== "none" && (
            <tr>
              <Box
                component="td"
                sx={{
                  color: "grey.400",
                  whiteSpace: "nowrap",
                  pr: 1,
                  fontSize: "0.75rem",
                }}
              >
                {t("banners.exitEffect")}
              </Box>
              <Box component="td" sx={{ fontWeight: 500, fontSize: "0.75rem" }}>
                {t(`banners.effects.${frame.effects.exit}`)}
              </Box>
            </tr>
          )}
          {frame.transition?.type && frame.transition.type !== "none" && (
            <tr>
              <Box
                component="td"
                sx={{
                  color: "grey.400",
                  whiteSpace: "nowrap",
                  pr: 1,
                  fontSize: "0.75rem",
                }}
              >
                {t("banners.transition")}
              </Box>
              <Box component="td" sx={{ fontWeight: 500, fontSize: "0.75rem" }}>
                {t(`banners.transitions.${frame.transition.type}`)} (
                {(frame.transition.duration / 1000).toFixed(2)}s)
              </Box>
            </tr>
          )}
        </tbody>
      </Box>
      {/* Image/Video Preview - at the bottom with divider */}
      {frame.imageUrl && !imageError && (
        <>
          <Divider sx={{ my: 1, borderColor: "rgba(255,255,255,0.2)" }} />
          <Box sx={{ display: "flex", justifyContent: "center" }}>
            {isVideo && frame.type === "mp4" ? (
              <video
                src={frame.imageUrl}
                style={{
                  maxWidth: 180,
                  maxHeight: 100,
                  objectFit: "contain",
                  borderRadius: 4,
                  background: "#000",
                }}
                muted
              />
            ) : (
              <img
                src={frame.imageUrl}
                alt=""
                style={{
                  maxWidth: 180,
                  maxHeight: 100,
                  objectFit: "contain",
                  borderRadius: 4,
                  background: "#000",
                }}
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
        title={isDragging ? "" : tooltipContent}
        placement="top"
        arrow
        enterDelay={300}
        open={isDragging ? false : undefined}
        componentsProps={{
          tooltip: {
            sx: {
              bgcolor: "rgba(30, 30, 30, 0.85)",
              backdropFilter: "blur(4px)",
              "& .MuiTooltip-arrow": {
                color: "rgba(30, 30, 30, 0.85)",
              },
              maxWidth: "none",
            },
          },
        }}
      >
        <Paper
          ref={setNodeRef}
          style={style}
          onClick={onFrameClick}
          onDoubleClick={handleDoubleClick}
          onContextMenu={handleContextMenu}
          sx={{
            width: frameSize,
            height: isTimelineMode ? frameHeight : frameSize,
            position: "relative",
            overflow: "hidden",
            borderRadius: 1,
            border: 2,
            borderColor: isDragging ? "primary.main" : "transparent",
            cursor: "pointer",
            bgcolor: (theme) =>
              theme.palette.mode === "dark" ? "grey.800" : "grey.100",
            transition: "border-color 0.2s, box-shadow 0.2s",
            flexShrink: 0, // Prevent shrinking in timeline mode
            "&:hover": {
              borderColor: "primary.light",
              "& .frame-overlay": { opacity: 1 },
              "& .resize-grip": { opacity: 1 },
            },
          }}
        >
          {/* Left resize grip (timeline mode only, not for first frame) */}
          {isTimelineMode && onResizeStart && frameIndex > 0 && (
            <Box
              className="resize-grip"
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onResizeStart(frameIndex, "left", e.clientX);
              }}
              sx={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: 8,
                cursor: "ew-resize",
                bgcolor: "primary.main",
                opacity: 0,
                transition: "opacity 0.2s",
                zIndex: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                "&:hover": { opacity: 1 },
                "&::before": {
                  content: '""',
                  width: 2,
                  height: 20,
                  bgcolor: "white",
                  borderRadius: 1,
                },
              }}
            />
          )}
          {/* Right resize grip (timeline mode only) */}
          {isTimelineMode && onResizeStart && (
            <Box
              className="resize-grip"
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onResizeStart(frameIndex, "right", e.clientX);
              }}
              sx={{
                position: "absolute",
                right: 0,
                top: 0,
                bottom: 0,
                width: 8,
                cursor: "ew-resize",
                bgcolor: "primary.main",
                opacity: 0,
                transition: "opacity 0.2s",
                zIndex: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                "&:hover": { opacity: 1 },
                "&::before": {
                  content: '""',
                  width: 2,
                  height: 20,
                  bgcolor: "white",
                  borderRadius: 1,
                },
              }}
            />
          )}
          {/* Image Preview */}
          {frame.imageUrl ? (
            imageError ? (
              <Box
                sx={{
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <BrokenImageIcon color="disabled" />
              </Box>
            ) : isVideo && frame.type === "mp4" ? (
              <video
                src={frame.imageUrl}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                muted
                onError={() => setImageError(true)}
              />
            ) : (
              <img
                src={frame.imageUrl}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                onError={() => setImageError(true)}
              />
            )
          ) : (
            <Box
              sx={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ImageIcon color="disabled" sx={{ fontSize: 32 }} />
            </Box>
          )}

          {/* Drag Handle (top) */}
          <Box
            {...attributes}
            {...listeners}
            className="frame-overlay"
            sx={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 20,
              bgcolor: "rgba(0,0,0,0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: 0,
              transition: "opacity 0.2s",
              cursor: "grab",
              "&:active": { cursor: "grabbing" },
            }}
          >
            <DragIndicatorIcon sx={{ color: "white", fontSize: 14 }} />
          </Box>

          {/* Bottom Info Bar */}
          <Box
            sx={{
              position: "absolute",
              bottom: 0,
              // Add padding to avoid resize grips in timeline mode
              left: isTimelineMode ? 10 : 0,
              right: isTimelineMode ? 10 : 0,
              bgcolor: "rgba(0,0,0,0.7)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              px: 0.5,
              py: 0.25,
            }}
          >
            <Typography
              variant="caption"
              sx={{ color: "white", fontSize: "0.65rem", fontWeight: 500 }}
            >
              {formatDelayToSeconds(frame.delay)}
            </Typography>
            <Box sx={{ display: "flex", gap: 0 }}>
              <Tooltip title={t("banners.frameSettings")}>
                <IconButton
                  size="small"
                  onClick={() => setSettingsOpen(true)}
                  sx={{ color: "white", p: 0.25 }}
                >
                  <EditIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title={t("common.delete")}>
                <IconButton
                  size="small"
                  onClick={onDelete}
                  sx={{ color: "error.light", p: 0.25 }}
                >
                  <DeleteIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        </Paper>
      </Tooltip>

      {/* Settings Dialog */}
      <Dialog
        open={settingsOpen}
        onClose={handleDialogClose}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editFrame.imageUrl ? t("banners.editFrame") : t("banners.addFrame")}
        </DialogTitle>
        <DialogContent
          sx={{
            maxHeight: "70vh",
            overflowY: "auto",
          }}
        >
          <Box sx={{ display: "flex", gap: 3, pt: 1 }}>
            {/* Left: Settings - narrower width */}
            <Box
              sx={{
                flex: "0 0 400px",
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                gap: 1.5,
              }}
            >
              {/* Image URL */}
              <TextField
                label={t("banners.imageUrl")}
                value={editFrame.imageUrl}
                onChange={(e) => handleImageUrlChange(e.target.value)}
                fullWidth
                size="small"
                placeholder="https://cdn.example.com/image.png"
                helperText={
                  editFrame.imageUrl && detectFrameType(editFrame.imageUrl)
                    ? `${t("banners.detectedType")}: ${editFrame.type?.toUpperCase()}`
                    : ""
                }
              />

              {/* Basic Settings */}
              <Box sx={{ display: "flex", gap: 2 }}>
                <TextField
                  label={t("banners.frameTime")}
                  value={localDelaySeconds}
                  onChange={(e) => handleDelaySecondsChange(e.target.value)}
                  size="small"
                  sx={{ flex: 1 }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">s</InputAdornment>
                    ),
                  }}
                />
                {isEditVideo && (
                  <FormControlLabel
                    control={
                      <Switch
                        checked={editFrame.loop || false}
                        onChange={(e) => handleLoopChange(e.target.checked)}
                        size="small"
                      />
                    }
                    label={t("banners.loopVideo")}
                    sx={{ ml: 1 }}
                  />
                )}
              </Box>

              <Divider />

              {/* Action Settings */}
              <Typography variant="subtitle2" color="text.secondary">
                {t("banners.actionSettings")}
              </Typography>
              <Box sx={{ display: "flex", gap: 2 }}>
                <FormControl size="small" sx={{ minWidth: 140 }}>
                  <InputLabel>{t("banners.actionType")}</InputLabel>
                  <Select
                    value={editFrame.action?.type || "none"}
                    label={t("banners.actionType")}
                    onChange={(e) =>
                      handleActionTypeChange(e.target.value as FrameActionType)
                    }
                  >
                    <MenuItem value="none">
                      {t("banners.actionTypes.none")}
                    </MenuItem>
                    <MenuItem value="openUrl">
                      {t("banners.actionTypes.openUrl")}
                    </MenuItem>
                    <MenuItem value="command">
                      {t("banners.actionTypes.command")}
                    </MenuItem>
                    <MenuItem value="deepLink">
                      {t("banners.actionTypes.deepLink")}
                    </MenuItem>
                  </Select>
                </FormControl>
                {editFrame.action?.type && editFrame.action.type !== "none" && (
                  <TextField
                    label={t("banners.actionValue")}
                    value={editFrame.action?.value || ""}
                    onChange={(e) => handleActionValueChange(e.target.value)}
                    size="small"
                    sx={{ flex: 1 }}
                  />
                )}
              </Box>

              <Divider />

              {/* Effect Settings */}
              <Typography variant="subtitle2" color="text.secondary">
                {t("banners.effectSettings")}
              </Typography>
              <Box sx={{ display: "flex", gap: 2 }}>
                <FormControl size="small" sx={{ flex: 1 }}>
                  <InputLabel>{t("banners.enterEffect")}</InputLabel>
                  <Select
                    value={editFrame.effects?.enter || "none"}
                    label={t("banners.enterEffect")}
                    onChange={(e) =>
                      handleEffectEnterChange(e.target.value as FrameEffectType)
                    }
                  >
                    <MenuItem value="none">
                      {t("banners.effects.none")}
                    </MenuItem>
                    <MenuItem value="fadeIn">
                      {t("banners.effects.fadeIn")}
                    </MenuItem>
                    <MenuItem value="slideLeft">
                      {t("banners.effects.slideLeft")}
                    </MenuItem>
                    <MenuItem value="slideRight">
                      {t("banners.effects.slideRight")}
                    </MenuItem>
                    <MenuItem value="slideUp">
                      {t("banners.effects.slideUp")}
                    </MenuItem>
                    <MenuItem value="slideDown">
                      {t("banners.effects.slideDown")}
                    </MenuItem>
                    <MenuItem value="zoomIn">
                      {t("banners.effects.zoomIn")}
                    </MenuItem>
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ flex: 1 }}>
                  <InputLabel>{t("banners.exitEffect")}</InputLabel>
                  <Select
                    value={editFrame.effects?.exit || "none"}
                    label={t("banners.exitEffect")}
                    onChange={(e) =>
                      handleEffectExitChange(e.target.value as FrameEffectType)
                    }
                  >
                    <MenuItem value="none">
                      {t("banners.effects.none")}
                    </MenuItem>
                    <MenuItem value="fadeOut">
                      {t("banners.effects.fadeOut")}
                    </MenuItem>
                    <MenuItem value="slideLeft">
                      {t("banners.effects.slideLeft")}
                    </MenuItem>
                    <MenuItem value="slideRight">
                      {t("banners.effects.slideRight")}
                    </MenuItem>
                    <MenuItem value="slideUp">
                      {t("banners.effects.slideUp")}
                    </MenuItem>
                    <MenuItem value="slideDown">
                      {t("banners.effects.slideDown")}
                    </MenuItem>
                    <MenuItem value="zoomOut">
                      {t("banners.effects.zoomOut")}
                    </MenuItem>
                  </Select>
                </FormControl>
              </Box>

              <Divider />

              {/* Transition Settings */}
              <Typography variant="subtitle2" color="text.secondary">
                {t("banners.transitionSettings")}
              </Typography>
              <Box sx={{ display: "flex", gap: 2 }}>
                <FormControl size="small" sx={{ flex: 1 }}>
                  <InputLabel>{t("banners.transitionType")}</InputLabel>
                  <Select
                    value={editFrame.transition?.type || "none"}
                    label={t("banners.transitionType")}
                    onChange={(e) =>
                      handleTransitionTypeChange(
                        e.target.value as TransitionType,
                      )
                    }
                  >
                    <MenuItem value="none">
                      {t("banners.transitions.none")}
                    </MenuItem>
                    <MenuItem value="fade">
                      {t("banners.transitions.fade")}
                    </MenuItem>
                    <MenuItem value="slide">
                      {t("banners.transitions.slide")}
                    </MenuItem>
                    <MenuItem value="crossfade">
                      {t("banners.transitions.crossfade")}
                    </MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  label={t("banners.transitionDuration")}
                  value={(
                    (editFrame.transition?.duration || 300) / 1000
                  ).toFixed(2)}
                  onChange={(e) =>
                    handleTransitionDurationChange(e.target.value)
                  }
                  size="small"
                  sx={{ flex: 1 }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">s</InputAdornment>
                    ),
                  }}
                />
              </Box>
            </Box>

            {/* Right: Preview - fills remaining space */}
            <Box
              sx={{
                flex: 1,
                minWidth: 200,
                display: "flex",
                flexDirection: "column",
                bgcolor: (theme) =>
                  theme.palette.mode === "dark" ? "grey.900" : "grey.100",
                borderRadius: 1,
                p: 1.5,
              }}
            >
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mb: 0.5, textAlign: "center" }}
              >
                {t("banners.preview")}
              </Typography>

              {/* Preview container - fills available space */}
              <Box
                sx={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  bgcolor: "black",
                  borderRadius: 1,
                  overflow: "hidden",
                }}
              >
                {editFrame.imageUrl ? (
                  imageError ? (
                    <Box
                      sx={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                      }}
                    >
                      <BrokenImageIcon color="disabled" sx={{ fontSize: 48 }} />
                      <Typography
                        variant="caption"
                        color="error"
                        sx={{ mt: 1 }}
                      >
                        {t("banners.imageLoadError")}
                      </Typography>
                    </Box>
                  ) : isEditVideo && editFrame.type === "mp4" ? (
                    <video
                      src={editFrame.imageUrl}
                      style={{
                        maxWidth: "100%",
                        maxHeight: "100%",
                        objectFit: "contain",
                      }}
                      controls
                      muted
                      onError={() => setImageError(true)}
                      onLoadedMetadata={handleVideoLoad}
                    />
                  ) : (
                    <img
                      src={editFrame.imageUrl}
                      alt=""
                      style={{
                        maxWidth: "100%",
                        maxHeight: "100%",
                        objectFit: "contain",
                      }}
                      onError={() => setImageError(true)}
                      onLoad={handleImageLoad}
                    />
                  )
                ) : (
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                    }}
                  >
                    <ImageIcon sx={{ fontSize: 48, color: "grey.600" }} />
                    <Typography
                      variant="caption"
                      sx={{ mt: 1, color: "grey.500" }}
                    >
                      {t("banners.enterImageUrl")}
                    </Typography>
                  </Box>
                )}
              </Box>

              {/* Image/Video Info */}
              {editFrame.imageUrl && !imageError && (
                <Box sx={{ mt: 1, textAlign: "center" }}>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    component="div"
                  >
                    {editFrame.type && (
                      <span>
                        {t("banners.type")}:{" "}
                        <strong>{editFrame.type.toUpperCase()}</strong>
                      </span>
                    )}
                    {imageInfo && (
                      <>
                        <span style={{ margin: "0 8px" }}>•</span>
                        <span>
                          {t("banners.dimensions")}:{" "}
                          <strong>
                            {imageInfo.width} × {imageInfo.height}
                          </strong>
                        </span>
                      </>
                    )}
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>

          {/* Frame Targeting Section */}
          <Divider sx={{ my: 3 }} />

          {/* Target Settings Group - Platform, Channel, World */}
          <TargetSettingsGroup
            targetPlatforms={editFrame.targeting?.platforms || []}
            targetPlatformsInverted={
              editFrame.targeting?.platformsInverted || false
            }
            platforms={platforms}
            onPlatformsChange={handlePlatformsChange}
            targetChannelSubchannels={
              editFrame.targeting?.channelSubchannels || []
            }
            targetChannelSubchannelsInverted={
              editFrame.targeting?.channelSubchannelsInverted || false
            }
            channels={channels}
            onChannelsChange={handleChannelsChange}
            targetWorlds={editFrame.targeting?.worlds || []}
            targetWorldsInverted={editFrame.targeting?.worldsInverted || false}
            worlds={worlds}
            onWorldsChange={handleWorldsChange}
            showUserIdFilter={false}
            showWorldFilter={true}
            title={
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <FilterIcon sx={{ fontSize: 20 }} />
                <Typography variant="subtitle1" fontWeight={600}>
                  {t("banners.frameTargeting")}
                </Typography>
              </Box>
            }
          />

          {/* Dynamic Conditions Section */}
          <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                cursor: "pointer",
              }}
              onClick={() =>
                setDynamicConditionsExpanded(!dynamicConditionsExpanded)
              }
            >
              {dynamicConditionsExpanded ? (
                <ExpandLessIcon />
              ) : (
                <ExpandMoreIcon />
              )}
              <Typography variant="subtitle1" fontWeight={600}>
                {t("banners.dynamicConditions")}
              </Typography>
            </Box>
            <Collapse in={dynamicConditionsExpanded}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", mt: 1, mb: 2 }}
              >
                {t("banners.dynamicConditionsHelp")}
              </Typography>

              {/* User Level Range */}
              <Box sx={{ mb: 2 }}>
                <Typography
                  variant="subtitle2"
                  color="text.secondary"
                  sx={{ mb: 1 }}
                >
                  {t("banners.userLevelRange")}
                </Typography>
                <Box sx={{ display: "flex", gap: 2 }}>
                  <TextField
                    label={t("banners.userLevelMin")}
                    type="number"
                    value={editFrame.targeting?.levelMin || ""}
                    onChange={(e) => handleLevelMinChange(e.target.value)}
                    size="small"
                    sx={{ flex: 1 }}
                    placeholder={t("banners.noLimitPlaceholder")}
                    InputProps={{ inputProps: { min: 1 } }}
                  />
                  <TextField
                    label={t("banners.userLevelMax")}
                    type="number"
                    value={editFrame.targeting?.levelMax || ""}
                    onChange={(e) => handleLevelMaxChange(e.target.value)}
                    size="small"
                    sx={{ flex: 1 }}
                    placeholder={t("banners.noLimitPlaceholder")}
                    InputProps={{ inputProps: { min: 1 } }}
                  />
                </Box>
              </Box>

              {/* Join Days Range */}
              <Box sx={{ mb: 2 }}>
                <Typography
                  variant="subtitle2"
                  color="text.secondary"
                  sx={{ mb: 1 }}
                >
                  {t("banners.joinDaysRange")}
                </Typography>
                <Box sx={{ display: "flex", gap: 2 }}>
                  <TextField
                    label={t("banners.joinDaysMin")}
                    type="number"
                    value={
                      editFrame.targeting?.joinDaysMin !== undefined
                        ? editFrame.targeting.joinDaysMin
                        : ""
                    }
                    onChange={(e) => handleJoinDaysMinChange(e.target.value)}
                    size="small"
                    sx={{ flex: 1 }}
                    placeholder={t("banners.noLimitPlaceholder")}
                    InputProps={{ inputProps: { min: 0 } }}
                  />
                  <TextField
                    label={t("banners.joinDaysMax")}
                    type="number"
                    value={
                      editFrame.targeting?.joinDaysMax !== undefined
                        ? editFrame.targeting.joinDaysMax
                        : ""
                    }
                    onChange={(e) => handleJoinDaysMaxChange(e.target.value)}
                    size="small"
                    sx={{ flex: 1 }}
                    placeholder={t("banners.noLimitPlaceholder")}
                    InputProps={{ inputProps: { min: 0 } }}
                  />
                </Box>
              </Box>

              {/* Filter Logic (AND/OR) */}
              <Box>
                <Typography
                  variant="subtitle2"
                  color="text.secondary"
                  sx={{ mb: 1 }}
                >
                  {t("banners.filterLogic")}
                </Typography>
                <ToggleButtonGroup
                  value={editFrame.targeting?.filterLogic || "and"}
                  exclusive
                  onChange={(_, value) =>
                    value && handleFilterLogicChange(value as FrameFilterLogic)
                  }
                  size="small"
                >
                  <ToggleButton value="and">
                    {t("banners.filterLogicAnd")}
                  </ToggleButton>
                  <ToggleButton value="or">
                    {t("banners.filterLogicOr")}
                  </ToggleButton>
                </ToggleButtonGroup>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: "block", mt: 0.5 }}
                >
                  {t("banners.filterLogicHelp")}
                </Typography>
              </Box>
            </Collapse>
          </Paper>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleDialogClose}>{t("common.cancel")}</Button>
          <Button variant="contained" onClick={handleDialogApply}>
            {t("common.apply")}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Context Menu */}
      <Menu
        open={contextMenu !== null}
        onClose={handleCloseContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
      >
        {/* Edit */}
        <MenuItem onClick={() => handleMenuAction(() => setSettingsOpen(true))}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t("banners.contextMenu.edit")}</ListItemText>
        </MenuItem>

        <Divider />

        {/* Duplicate */}
        <MenuItem
          onClick={() => handleMenuAction(onDuplicateBefore)}
          disabled={frameIndex === 0}
        >
          <ListItemIcon>
            <InsertBeforeIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>
            {t("banners.contextMenu.duplicateBefore")}
          </ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleMenuAction(onDuplicateAfter)}>
          <ListItemIcon>
            <InsertAfterIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t("banners.contextMenu.duplicateAfter")}</ListItemText>
        </MenuItem>

        <Divider />

        {/* Copy */}
        <MenuItem onClick={() => handleMenuAction(onCopy)}>
          <ListItemIcon>
            <CopyIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t("banners.contextMenu.copy")}</ListItemText>
        </MenuItem>

        {/* Paste */}
        <MenuItem
          onClick={() => handleMenuAction(onPasteBefore)}
          disabled={!hasClipboard}
        >
          <ListItemIcon>
            <PasteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t("banners.contextMenu.pasteBefore")}</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => handleMenuAction(onPasteAfter)}
          disabled={!hasClipboard}
        >
          <ListItemIcon>
            <PasteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t("banners.contextMenu.pasteAfter")}</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => handleMenuAction(onPasteReplace)}
          disabled={!hasClipboard}
        >
          <ListItemIcon>
            <ReplaceIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t("banners.contextMenu.pasteReplace")}</ListItemText>
        </MenuItem>

        <Divider />

        {/* Add Empty Frames */}
        <MenuItem onClick={() => handleMenuAction(onAddEmptyBefore)}>
          <ListItemIcon>
            <AddIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t("banners.contextMenu.addEmptyBefore")}</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            handleCloseContextMenu();
            setEmptyFrameCountDialogOpen("before");
          }}
        >
          <ListItemIcon>
            <AddMultipleIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>
            {t("banners.contextMenu.addMultipleEmptyBefore")}
          </ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleMenuAction(onAddEmptyAfter)}>
          <ListItemIcon>
            <AddIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t("banners.contextMenu.addEmptyAfter")}</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            handleCloseContextMenu();
            setEmptyFrameCountDialogOpen("after");
          }}
        >
          <ListItemIcon>
            <AddMultipleIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>
            {t("banners.contextMenu.addMultipleEmptyAfter")}
          </ListItemText>
        </MenuItem>

        {/* Add from Clipboard URLs */}
        {clipboardUrls.length > 0 && (
          <>
            <Divider />
            <MenuItem
              onClick={() =>
                handleMenuAction(() => onAddFromClipboardBefore(clipboardUrls))
              }
            >
              <ListItemIcon>
                <LinkIcon fontSize="small" color="primary" />
              </ListItemIcon>
              <ListItemText>
                {clipboardUrls.length === 1
                  ? t("banners.contextMenu.addFromClipboardBefore")
                  : t("banners.contextMenu.addFromClipboardBeforeMultiple", {
                      count: clipboardUrls.length,
                    })}
              </ListItemText>
            </MenuItem>
            <MenuItem
              onClick={() =>
                handleMenuAction(() => onAddFromClipboardAfter(clipboardUrls))
              }
            >
              <ListItemIcon>
                <LinkIcon fontSize="small" color="primary" />
              </ListItemIcon>
              <ListItemText>
                {clipboardUrls.length === 1
                  ? t("banners.contextMenu.addFromClipboardAfter")
                  : t("banners.contextMenu.addFromClipboardAfterMultiple", {
                      count: clipboardUrls.length,
                    })}
              </ListItemText>
            </MenuItem>
          </>
        )}

        <Divider />

        {/* Move */}
        <MenuItem
          onClick={() => handleMenuAction(onMovePrev)}
          disabled={frameIndex === 0}
        >
          <ListItemIcon>
            <MovePrevIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t("banners.contextMenu.movePrev")}</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => handleMenuAction(onMoveNext)}
          disabled={frameIndex === totalFrames - 1}
        >
          <ListItemIcon>
            <MoveNextIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t("banners.contextMenu.moveNext")}</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => handleMenuAction(onMoveFirst)}
          disabled={frameIndex === 0}
        >
          <ListItemIcon>
            <MoveFirstIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t("banners.contextMenu.moveFirst")}</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => handleMenuAction(onMoveLast)}
          disabled={frameIndex === totalFrames - 1}
        >
          <ListItemIcon>
            <MoveLastIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t("banners.contextMenu.moveLast")}</ListItemText>
        </MenuItem>

        <Divider />

        {/* Delete */}
        <MenuItem
          onClick={() => handleMenuAction(onDelete)}
          sx={{ color: "error.main" }}
        >
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>{t("banners.contextMenu.delete")}</ListItemText>
        </MenuItem>
      </Menu>

      {/* Empty Frame Count Dialog */}
      <Dialog
        open={emptyFrameCountDialogOpen !== null}
        onClose={() => setEmptyFrameCountDialogOpen(null)}
        maxWidth="xs"
      >
        <DialogTitle>
          {emptyFrameCountDialogOpen === "before"
            ? t("banners.contextMenu.addMultipleEmptyBefore")
            : t("banners.contextMenu.addMultipleEmptyAfter")}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label={t("banners.emptyFrameCount")}
            defaultValue={5}
            fullWidth
            sx={{ mt: 1 }}
            id="empty-frame-count"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEmptyFrameCountDialogOpen(null)}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              const input = document.getElementById(
                "empty-frame-count",
              ) as HTMLInputElement;
              const count = parseInt(input?.value || "5", 10);
              if (count > 0 && count <= 100) {
                if (emptyFrameCountDialogOpen === "before") {
                  onAddMultipleEmptyBefore(count);
                } else {
                  onAddMultipleEmptyAfter(count);
                }
              }
              setEmptyFrameCountDialogOpen(null);
            }}
          >
            {t("common.add")}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default FrameEditor;
