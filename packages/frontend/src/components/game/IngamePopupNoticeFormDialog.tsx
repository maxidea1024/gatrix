import React, { useState, useEffect, useMemo } from "react";
import {
  Button,
  TextField,
  FormControlLabel,
  Switch,
  Box,
  Typography,
  AppBar,
  Toolbar,
  IconButton,
  Stack,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  AlertTitle,
} from "@mui/material";
import { Close as CloseIcon } from "@mui/icons-material";
import ResizableDrawer from "../common/ResizableDrawer";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";
import dayjs, { Dayjs } from "dayjs";
import { useTranslation } from "react-i18next";
import { useSnackbar } from "notistack";
import { useNavigate } from "react-router-dom";
import { showChangeRequestCreatedToast } from "../../utils/changeRequestToast";
import { getActionLabel } from "../../utils/changeRequestToast";
import { useEnvironment } from "../../contexts/EnvironmentContext";
import { usePlatformConfig } from "../../contexts/PlatformConfigContext";
import { useGameWorld } from "../../contexts/GameWorldContext";
import {
  IngamePopupNotice,
  CreateIngamePopupNoticeData,
  UpdateIngamePopupNoticeData,
} from "../../services/ingamePopupNoticeService";
import ingamePopupNoticeService from "../../services/ingamePopupNoticeService";
import {
  messageTemplateService,
  MessageTemplate,
} from "../../services/messageTemplateService";
import MultiLanguageMessageInput from "../common/MultiLanguageMessageInput";
import { parseUTCForPicker } from "../../utils/dateFormat";
import TargetSettingsGroup, {
  ChannelSubchannelData,
} from "./TargetSettingsGroup";
import { parseApiErrorMessage } from "../../utils/errorUtils";
import { useEntityLock } from "../../hooks/useEntityLock";

interface IngamePopupNoticeFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  notice?: IngamePopupNotice | null;
}

const IngamePopupNoticeFormDialog: React.FC<
  IngamePopupNoticeFormDialogProps
> = ({ open, onClose, onSuccess, notice }) => {
  const { t } = useTranslation();
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const navigate = useNavigate();
  const { currentEnvironment } = useEnvironment();
  const requiresApproval = currentEnvironment?.requiresApproval ?? false;
  const { platforms, channels } = usePlatformConfig();
  const { worlds } = useGameWorld();
  const [submitting, setSubmitting] = useState(false);

  // Entity Lock for edit mode
  const { hasLock, lockedBy, pendingCR, forceTakeover } = useEntityLock({
    table: "g_ingame_popup_notices",
    entityId: notice?.id || null,
    isEditing: open && !!notice,
    // onLockLost is called when lock is taken - toast is now handled by useEntityLock via SSE
  });

  // Form state
  const [isActive, setIsActive] = useState(true);
  const [content, setContent] = useState("");

  // Target settings - Initialize with default values to avoid controlled/uncontrolled component warnings
  const [targetPlatforms, setTargetPlatforms] = useState<string[]>([]);
  const [targetPlatformsInverted, setTargetPlatformsInverted] =
    useState<boolean>(false);
  const [targetChannelSubchannels, setTargetChannelSubchannels] = useState<
    ChannelSubchannelData[]
  >([]);
  const [
    targetChannelSubchannelsInverted,
    setTargetChannelSubchannelsInverted,
  ] = useState<boolean>(false);
  const [targetWorlds, setTargetWorlds] = useState<string[]>([]);
  const [targetWorldsInverted, setTargetWorldsInverted] =
    useState<boolean>(false);

  // User ID targeting
  const [targetUserIds, setTargetUserIds] = useState<string>("");
  const [targetUserIdsInverted, setTargetUserIdsInverted] =
    useState<boolean>(false);

  const [displayPriority, setDisplayPriority] = useState(100);
  const [showOnce, setShowOnce] = useState(false);
  const [startDate, setStartDate] = useState<Dayjs | null>(null);
  const [endDate, setEndDate] = useState<Dayjs | null>(null);
  const [useTemplate, setUseTemplate] = useState(false);
  const [messageTemplateId, setMessageTemplateId] = useState<number | null>(
    null,
  );
  const [description, setDescription] = useState("");

  // Template state
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] =
    useState<MessageTemplate | null>(null);

  // Load templates
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const result = await messageTemplateService.list({
          isEnabled: true,
          limit: 1000,
        });
        setTemplates(result.templates);
      } catch (error) {
        console.error("Failed to load templates:", error);
      }
    };
    loadTemplates();
  }, []);

  // Initialize form with notice data
  useEffect(() => {
    if (notice) {
      setIsActive(notice.isActive);
      setContent(notice.content);

      // Convert targetChannels/targetSubchannels to targetChannelSubchannels format
      // targetSubchannels format: "channel:subchannel" (e.g., "official:global", "official:asia")
      const targetChannelSubchannels: ChannelSubchannelData[] = [];
      const targetChannels = notice.targetChannels || [];
      const targetSubchannels = notice.targetSubchannels || [];

      // Parse targetSubchannels from "channel:subchannel" format
      const subchannelsByChannel: { [key: string]: string[] } = {};
      targetSubchannels.forEach((subchannelKey: string) => {
        const [channel, subchannel] = subchannelKey.split(":");
        if (channel && subchannel) {
          if (!subchannelsByChannel[channel]) {
            subchannelsByChannel[channel] = [];
          }
          subchannelsByChannel[channel].push(subchannel);
        }
      });

      // Build targetChannelSubchannels array
      if (targetChannels.length > 0) {
        targetChannels.forEach((channel: string) => {
          targetChannelSubchannels.push({
            channel,
            subchannels: subchannelsByChannel[channel] || [],
          });
        });
      }

      setTargetPlatforms(notice.targetPlatforms || []);
      setTargetPlatformsInverted(notice.targetPlatformsInverted || false);
      setTargetChannelSubchannels(targetChannelSubchannels);
      setTargetChannelSubchannelsInverted(
        notice.targetChannelsInverted || false,
      );
      setTargetWorlds(notice.targetWorlds || []);
      setTargetWorldsInverted(notice.targetWorldsInverted || false);
      setTargetUserIds((notice as any).targetUserIds || "");
      setTargetUserIdsInverted((notice as any).targetUserIdsInverted || false);

      setDisplayPriority(notice.displayPriority);
      setShowOnce(notice.showOnce);
      // Parse UTC time and convert to user's timezone for display
      setStartDate(parseUTCForPicker(notice.startDate));
      setEndDate(parseUTCForPicker(notice.endDate));
      setUseTemplate(notice.useTemplate);
      setMessageTemplateId(notice.messageTemplateId);
      setDescription(notice.description || "");

      // Load selected template
      if (notice.useTemplate && notice.messageTemplateId) {
        const template = templates.find(
          (t) => t.id === notice.messageTemplateId,
        );
        setSelectedTemplate(template || null);
      }
    } else {
      // Reset form
      setIsActive(true);
      setContent("");
      setTargetPlatforms([]);
      setTargetPlatformsInverted(false);
      setTargetChannelSubchannels([]);
      setTargetChannelSubchannelsInverted(false);
      setTargetWorlds([]);
      setTargetWorldsInverted(false);
      setTargetUserIds("");
      setTargetUserIdsInverted(false);
      setDisplayPriority(100);
      setShowOnce(false);
      setStartDate(null);
      setEndDate(null);
      setUseTemplate(false);
      setMessageTemplateId(null);
      setDescription("");
      setSelectedTemplate(null);
    }
  }, [notice, open, templates]);

  // Handle template selection
  useEffect(() => {
    if (useTemplate && messageTemplateId) {
      const template = templates.find((t) => t.id === messageTemplateId);
      setSelectedTemplate(template || null);
      if (template) {
        setContent(template.defaultMessage || "");
      }
    } else {
      setSelectedTemplate(null);
    }
  }, [useTemplate, messageTemplateId, templates]);

  // Check if form is dirty (data changed)
  const isDirty = useMemo(() => {
    if (!notice) return true;

    // Convert current target settings back to channels/subchannels for comparison
    const currentChannels: string[] = [];
    const currentSubchannels: string[] = [];
    if (targetChannelSubchannels && targetChannelSubchannels.length > 0) {
      targetChannelSubchannels.forEach((item: any) => {
        if (!currentChannels.includes(item.channel)) {
          currentChannels.push(item.channel);
        }
        item.subchannels.forEach((subchannel: string) => {
          const subchannelKey = `${item.channel}:${subchannel}`;
          if (!currentSubchannels.includes(subchannelKey)) {
            currentSubchannels.push(subchannelKey);
          }
        });
      });
    }

    const currentData = {
      isActive,
      content: content.trim(),
      targetPlatforms:
        targetPlatforms.length > 0 ? [...targetPlatforms].sort() : null,
      targetPlatformsInverted,
      targetChannels:
        currentChannels.length > 0 ? [...currentChannels].sort() : null,
      targetChannelsInverted: targetChannelSubchannelsInverted,
      targetSubchannels:
        currentSubchannels.length > 0 ? [...currentSubchannels].sort() : null,
      targetWorlds: targetWorlds.length > 0 ? [...targetWorlds].sort() : null,
      targetWorldsInverted,
      targetUserIds: targetUserIds.trim() || null,
      targetUserIdsInverted,
      displayPriority,
      showOnce,
      startDate: startDate ? startDate.toISOString() : null,
      endDate: endDate ? endDate.toISOString() : null,
      useTemplate,
      messageTemplateId: useTemplate ? messageTemplateId : null,
      description: description.trim() || null,
    };

    const originalData = {
      isActive: notice.isActive,
      content: notice.content.trim(),
      targetPlatforms:
        (notice.targetPlatforms || []).length > 0
          ? [...notice.targetPlatforms].sort()
          : null,
      targetPlatformsInverted: notice.targetPlatformsInverted || false,
      targetChannels:
        (notice.targetChannels || []).length > 0
          ? [...notice.targetChannels].sort()
          : null,
      targetChannelsInverted: notice.targetChannelsInverted || false,
      targetSubchannels:
        (notice.targetSubchannels || []).length > 0
          ? [...notice.targetSubchannels].sort()
          : null,
      targetWorlds:
        (notice.targetWorlds || []).length > 0
          ? [...notice.targetWorlds].sort()
          : null,
      targetWorldsInverted: notice.targetWorldsInverted || false,
      targetUserIds: (notice as any).targetUserIds?.trim() || null,
      targetUserIdsInverted: (notice as any).targetUserIdsInverted || false,
      displayPriority: notice.displayPriority,
      showOnce: notice.showOnce,
      startDate: notice.startDate
        ? dayjs(notice.startDate).toISOString()
        : null,
      endDate: notice.endDate ? dayjs(notice.endDate).toISOString() : null,
      useTemplate: notice.useTemplate,
      messageTemplateId: notice.useTemplate ? notice.messageTemplateId : null,
      description: notice.description?.trim() || null,
    };

    return JSON.stringify(currentData) !== JSON.stringify(originalData);
  }, [
    notice,
    isActive,
    content,
    targetPlatforms,
    targetPlatformsInverted,
    targetChannelSubchannels,
    targetChannelSubchannelsInverted,
    targetWorlds,
    targetWorldsInverted,
    targetUserIds,
    targetUserIdsInverted,
    displayPriority,
    showOnce,
    startDate,
    endDate,
    useTemplate,
    messageTemplateId,
    description,
  ]);

  const handleSubmit = async () => {
    // Validation
    if (!content.trim()) {
      enqueueSnackbar(t("ingamePopupNotices.contentRequired"), {
        variant: "error",
      });
      return;
    }

    // Note: endDate is now optional - null means no end date (permanent notice)

    setSubmitting(true);

    try {
      // Convert targetChannelSubchannels to targetChannels and targetSubchannels for API
      // targetSubchannels format: "channel:subchannel" (e.g., "official:global", "official:asia")
      const targetChannels: string[] = [];
      const targetSubchannels: string[] = [];
      if (targetChannelSubchannels && targetChannelSubchannels.length > 0) {
        targetChannelSubchannels.forEach((item: any) => {
          if (!targetChannels.includes(item.channel)) {
            targetChannels.push(item.channel);
          }
          item.subchannels.forEach((subchannel: string) => {
            const subchannelKey = `${item.channel}:${subchannel}`;
            if (!targetSubchannels.includes(subchannelKey)) {
              targetSubchannels.push(subchannelKey);
            }
          });
        });
      }

      const data: CreateIngamePopupNoticeData | UpdateIngamePopupNoticeData = {
        isActive,
        content: content.trim(),
        targetPlatforms: targetPlatforms.length > 0 ? targetPlatforms : null,
        targetPlatformsInverted: targetPlatformsInverted,
        targetChannels: targetChannels.length > 0 ? targetChannels : null,
        targetChannelsInverted: targetChannelSubchannelsInverted,
        targetSubchannels:
          targetSubchannels.length > 0 ? targetSubchannels : null,
        targetSubchannelsInverted: targetChannelSubchannelsInverted,
        targetWorlds: targetWorlds.length > 0 ? targetWorlds : null,
        targetWorldsInverted: targetWorldsInverted,
        targetUserIds: targetUserIds.trim() || null,
        targetUserIdsInverted: targetUserIdsInverted,
        displayPriority,
        showOnce,
        // Convert local time to UTC (12:00 KST -> 03:00 UTC)
        startDate: startDate ? startDate.toISOString() : null,
        endDate: endDate ? endDate.toISOString() : null,
        useTemplate,
        messageTemplateId: useTemplate ? messageTemplateId : null,
        description: description.trim() || null,
      };

      if (notice) {
        const result = await ingamePopupNoticeService.updateIngamePopupNotice(
          notice.id,
          data,
        );
        if (result.isChangeRequest) {
          showChangeRequestCreatedToast(
            enqueueSnackbar,
            closeSnackbar,
            navigate,
          );
        } else {
          enqueueSnackbar(t("ingamePopupNotices.updateSuccess"), {
            variant: "success",
          });
        }
      } else {
        const result = await ingamePopupNoticeService.createIngamePopupNotice(
          data as CreateIngamePopupNoticeData,
        );
        if (result.isChangeRequest) {
          showChangeRequestCreatedToast(
            enqueueSnackbar,
            closeSnackbar,
            navigate,
          );
        } else {
          enqueueSnackbar(t("ingamePopupNotices.createSuccess"), {
            variant: "success",
          });
        }
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error("Failed to save ingame popup notice:", error);
      const fallbackKey = requiresApproval
        ? "ingamePopupNotices.requestSaveFailed"
        : "ingamePopupNotices.saveFailed";
      enqueueSnackbar(parseApiErrorMessage(error, fallbackKey), {
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ResizableDrawer
      open={open}
      onClose={onClose}
      title={
        notice
          ? t("ingamePopupNotices.editNotice")
          : t("ingamePopupNotices.createNotice")
      }
      subtitle={
        notice
          ? t("ingamePopupNotices.editNoticeSubtitle")
          : t("ingamePopupNotices.createNoticeSubtitle")
      }
      storageKey="ingamePopupNoticeFormDrawerWidth"
      defaultWidth={800}
      minWidth={600}
      zIndex={1300}
    >
      {/* Content */}
      <Box
        sx={{
          flex: 1,
          overflow: "auto",
          p: 3,
        }}
      >
        <Stack spacing={3}>
          {/* Lock Warning */}
          {notice && lockedBy && !hasLock && (
            <Alert
              severity="warning"
              action={
                <Button color="inherit" size="small" onClick={forceTakeover}>
                  {t("entityLock.takeOver")}
                </Button>
              }
            >
              <AlertTitle>
                {t("entityLock.warning", {
                  userName: lockedBy.userName,
                  userEmail: lockedBy.userEmail,
                })}
              </AlertTitle>
            </Alert>
          )}

          {/* Pending CR Warning */}
          {notice && pendingCR && (
            <Alert severity="info">
              <AlertTitle>{t("entityLock.pendingCR")}</AlertTitle>
              {t("entityLock.pendingCRDetail", {
                crTitle: pendingCR.crTitle,
                crId: pendingCR.crId,
              })}
            </Alert>
          )}

          {/* Active Status */}
          <Box>
            <FormControlLabel
              control={
                <Switch
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
              }
              label={t("ingamePopupNotices.isActive")}
            />
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", ml: 4, mt: 0.5 }}
            >
              {t("ingamePopupNotices.isActiveHelp")}
            </Typography>
          </Box>

          {/* Target Settings Group */}
          <TargetSettingsGroup
            targetPlatforms={targetPlatforms}
            targetPlatformsInverted={targetPlatformsInverted}
            platforms={platforms}
            onPlatformsChange={(platforms, inverted) => {
              setTargetPlatforms(platforms);
              setTargetPlatformsInverted(inverted);
            }}
            targetChannelSubchannels={targetChannelSubchannels}
            targetChannelSubchannelsInverted={targetChannelSubchannelsInverted}
            channels={channels}
            onChannelsChange={(channels, inverted) => {
              setTargetChannelSubchannels(channels);
              setTargetChannelSubchannelsInverted(inverted);
            }}
            targetWorlds={targetWorlds}
            targetWorldsInverted={targetWorldsInverted}
            worlds={worlds}
            onWorldsChange={(worlds, inverted) => {
              setTargetWorlds(worlds);
              setTargetWorldsInverted(inverted);
            }}
            targetUserIds={targetUserIds}
            targetUserIdsInverted={targetUserIdsInverted}
            onUserIdsChange={(ids) => {
              setTargetUserIds(ids);
            }}
            onUserIdsInvertedChange={(inverted) => {
              setTargetUserIdsInverted(inverted);
            }}
            showUserIdFilter={true}
          />

          {/* Date Range */}
          <Box sx={{ display: "flex", gap: 2, flexDirection: "column" }}>
            <Box sx={{ display: "flex", gap: 2 }}>
              <DateTimePicker
                label={t("ingamePopupNotices.startDate")}
                value={startDate}
                onChange={(date) => setStartDate(date)}
                timeSteps={{ minutes: 1 }}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    required: false,
                    slotProps: { input: { readOnly: true } },
                  },
                  actionBar: {
                    actions: ["clear", "cancel", "accept"],
                  },
                }}
              />
              <DateTimePicker
                label={t("ingamePopupNotices.endDate")}
                value={endDate}
                onChange={(date) => setEndDate(date)}
                minDateTime={startDate || undefined}
                timeSteps={{ minutes: 1 }}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    required: false,
                    slotProps: { input: { readOnly: true } },
                  },
                  actionBar: {
                    actions: ["clear", "cancel", "accept"],
                  },
                }}
              />
            </Box>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ ml: 1.75 }}
            >
              {t("ingamePopupNotices.startDateHelp")} /{" "}
              {t("ingamePopupNotices.endDateHelp")}
            </Typography>
          </Box>

          {/* Display Priority */}
          <TextField
            label={t("ingamePopupNotices.displayPriority")}
            type="number"
            value={displayPriority}
            onChange={(e) =>
              setDisplayPriority(
                e.target.value === "" ? "" : parseInt(e.target.value) || 100,
              )
            }
            fullWidth
            helperText={t("ingamePopupNotices.displayPriorityHelp")}
          />

          {/* Show Once */}
          <Box>
            <FormControlLabel
              control={
                <Switch
                  checked={showOnce}
                  onChange={(e) => setShowOnce(e.target.checked)}
                />
              }
              label={t("ingamePopupNotices.showOnce")}
            />
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", ml: 4, mt: 0.5 }}
            >
              {t("ingamePopupNotices.showOnceHelp")}
            </Typography>
          </Box>

          {/* Use Template */}
          <Box>
            <FormControlLabel
              control={
                <Switch
                  checked={useTemplate}
                  onChange={(e) => setUseTemplate(e.target.checked)}
                />
              }
              label={t("ingamePopupNotices.useTemplate")}
            />
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", ml: 4, mt: 0.5 }}
            >
              {t("ingamePopupNotices.useTemplateHelp")}
            </Typography>
          </Box>

          {/* Message Template Selection */}
          {useTemplate && (
            <FormControl fullWidth>
              <InputLabel>{t("ingamePopupNotices.messageTemplate")}</InputLabel>
              <Select
                value={messageTemplateId || ""}
                onChange={(e) => setMessageTemplateId(e.target.value as number)}
                label={t("ingamePopupNotices.messageTemplate")}
              >
                <MenuItem value="">
                  <em>{t("ingamePopupNotices.selectTemplate")}</em>
                </MenuItem>
                {templates.map((template) => (
                  <MenuItem key={template.id} value={template.id}>
                    {template.name}
                  </MenuItem>
                ))}
              </Select>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mt: 0.5, ml: 1.75 }}
              >
                {t("ingamePopupNotices.messageTemplateHelp")}
              </Typography>
            </FormControl>
          )}

          {/* Content */}
          <TextField
            label={t("ingamePopupNotices.content")}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            fullWidth
            required
            multiline
            rows={6}
            disabled={useTemplate && !!messageTemplateId}
            placeholder={t("ingamePopupNotices.contentPlaceholder")}
            helperText={t("ingamePopupNotices.contentHelp")}
          />

          {/* Description */}
          <TextField
            label={t("ingamePopupNotices.description")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            multiline
            rows={2}
            helperText={t("ingamePopupNotices.descriptionHelp")}
          />
        </Stack>
      </Box>

      {/* Footer */}
      <Box
        sx={{
          p: 2,
          borderTop: 1,
          borderColor: "divider",
          bgcolor: "background.paper",
          display: "flex",
          gap: 1,
          justifyContent: "flex-end",
        }}
      >
        <Button onClick={onClose} disabled={submitting}>
          {t("common.cancel")}
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={submitting || (!!notice && !isDirty)}
        >
          {getActionLabel(notice ? "update" : "create", requiresApproval, t)}
        </Button>
      </Box>
    </ResizableDrawer>
  );
};

export default IngamePopupNoticeFormDialog;
