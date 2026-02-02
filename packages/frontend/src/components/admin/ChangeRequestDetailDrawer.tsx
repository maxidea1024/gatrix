import React, { useState, useMemo } from "react";
import {
  Box,
  Typography,
  Paper,
  Chip,
  Button,
  TextField,
  Divider,
  Avatar,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Collapse,
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  Check as CheckIcon,
  Close as CloseIcon,
  Delete as DeleteIcon,
  Send as SendIcon,
  Person as PersonIcon,
  MergeType as MergeIcon,
  DifferenceOutlined as DiffIcon,
  History as HistoryIcon,
  ExpandMore as ExpandMoreIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Undo as UndoIcon,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { useSnackbar } from "notistack";
import { useHandleApiError } from "@/hooks/useHandleApiError";
import useSWR from "swr";
import { useAuth } from "@/contexts/AuthContext";
import { RelativeTime } from "@/components/common/RelativeTime";
import ConfirmDeleteDialog from "@/components/common/ConfirmDeleteDialog";
import ResizableDrawer from "@/components/common/ResizableDrawer";
import changeRequestService, {
  ActionGroup,
  ChangeItem,
} from "@/services/changeRequestService";
import {
  formatChangeRequestTitle,
  formatChangeItemTitle,
} from "@/utils/changeRequestFormatter";
import RevertPreviewDrawer from "./RevertPreviewDrawer";
import SubmitPreviewDrawer from "./SubmitPreviewDrawer";

interface ChangeRequestDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  changeRequestId: string | null;
  onRefresh?: () => void;
}

// Status configuration
const STATUS_CONFIG: Record<
  ChangeRequestStatus,
  {
    color:
      | "default"
      | "primary"
      | "secondary"
      | "error"
      | "info"
      | "success"
      | "warning";
    labelKey: string;
    bgColor: string;
  }
> = {
  draft: {
    color: "default",
    labelKey: "changeRequest.status.draft",
    bgColor: "#6e7681",
  },
  open: {
    color: "primary",
    labelKey: "changeRequest.status.open",
    bgColor: "#238636",
  },
  approved: {
    color: "success",
    labelKey: "changeRequest.status.approved",
    bgColor: "#8957e5",
  },
  applied: {
    color: "info",
    labelKey: "changeRequest.status.applied",
    bgColor: "#a371f7",
  },
  rejected: {
    color: "error",
    labelKey: "changeRequest.status.rejected",
    bgColor: "#f85149",
  },
  conflict: {
    color: "warning",
    labelKey: "changeRequest.status.conflict",
    bgColor: "#d29922",
  },
};

// Timeline event type
interface TimelineEvent {
  type:
    | "created"
    | "submitted"
    | "approved"
    | "rejected"
    | "reopened"
    | "executed";
  timestamp: string;
  user?: { name?: string; email?: string };
  comment?: string;
  title?: string;
  reason?: string;
}

// Field Change
interface FieldChange {
  field: string;
  oldValue: any;
  newValue: any;
  operation: "added" | "removed" | "modified";
}

const ChangeRequestDetailDrawer: React.FC<ChangeRequestDetailDrawerProps> = ({
  open,
  onClose,
  changeRequestId,
  onRefresh,
}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuth();

  const [actionLoading, setActionLoading] = useState(false);
  const [comment, setComment] = useState("");
  const [submitPreviewOpen, setSubmitPreviewOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [expandedReasons, setExpandedReasons] = useState<
    Record<number, boolean>
  >({});
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    {},
  );
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>(
    {},
  );
  const [rollbackPreviewOpen, setRollbackPreviewOpen] = useState(false);
  const [rollbackTargetId, setRollbackTargetId] = useState<string | null>(null);

  // Delete handler for error dialog
  const handleDeleteFromError = async () => {
    try {
      await changeRequestService.delete(changeRequestId!);
      enqueueSnackbar(t("changeRequest.messages.deleted"), {
        variant: "success",
      });
      onClose();
      onRefresh?.();
    } catch (err: any) {
      enqueueSnackbar(t("changeRequest.errors.deleteFailed"), {
        variant: "error",
      });
    }
  };

  const { handleApiError, ErrorDialog } = useHandleApiError({
    onDelete: handleDeleteFromError,
  });

  // Fetch change request
  const {
    data: cr,
    error,
    isLoading,
    mutate,
  } = useSWR(
    open && changeRequestId ? `change-request-drawer-${changeRequestId}` : null,
    () => changeRequestService.getById(changeRequestId!),
    { revalidateOnFocus: false },
  );

  // Build timeline from CR data
  const timeline = useMemo<TimelineEvent[]>(() => {
    if (!cr) return [];
    const events: TimelineEvent[] = [];

    events.push({
      type: "created",
      timestamp: cr.createdAt,
      user: cr.requester,
    });

    if (cr.status !== "draft") {
      let submittedTimestamp = cr.updatedAt;

      // Adjust timestamp to ensure "Submitted" appears before "Approved"/"Rejected"/"Executed"
      // because database only stores updatedAt which gets overwritten
      if (cr.status !== "open") {
        const milestones: number[] = [];

        if (cr.approvals?.length) {
          milestones.push(
            ...cr.approvals.map((a) => new Date(a.createdAt).getTime()),
          );
        }
        if (cr.rejectedAt) {
          milestones.push(new Date(cr.rejectedAt).getTime());
        }
        // If status changed from open, updatedAt usually reflects that change
        milestones.push(new Date(cr.updatedAt).getTime());

        if (milestones.length > 0) {
          const earliest = Math.min(...milestones);
          // Force submitted to be before the earliest next event
          submittedTimestamp = new Date(earliest - 1000).toISOString();
        }
      }

      events.push({
        type: "submitted",
        timestamp: submittedTimestamp,
        user: cr.requester,
        title: cr.title,
        reason: cr.reason,
      });
    }

    if (cr.approvals?.length) {
      cr.approvals.forEach((approval) => {
        events.push({
          type: "approved",
          timestamp: approval.createdAt,
          user: approval.approver,
          comment: approval.comment,
        });
      });
    }

    if (cr.status === "rejected" && cr.rejectedAt) {
      events.push({
        type: "rejected",
        timestamp: cr.rejectedAt,
        user: cr.rejector,
        comment: cr.rejectionReason,
      });
    }

    if (cr.status === "applied") {
      events.push({
        type: "executed",
        timestamp: cr.updatedAt,
        user: cr.executor,
      });
    }

    return events.sort((a, b) => {
      const timeDiff =
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      if (timeDiff !== 0) return timeDiff;

      // Deterministic order for same timestamp
      const TYPE_PRIORITY: Record<string, number> = {
        created: 0,
        submitted: 1,
        reopened: 2,
        approved: 3,
        rejected: 4,
        executed: 5,
      };
      return (TYPE_PRIORITY[a.type] || 99) - (TYPE_PRIORITY[b.type] || 99);
    });
  }, [cr]);

  // Compute all field changes - Now uses ops directly from backend
  const allChanges = useMemo(() => {
    if (!cr?.changeItems) return [];

    return cr.changeItems.map((item: any) => {
      // Map backend ops to frontend FieldChange format
      const ops = item.ops || [];
      const changes: FieldChange[] = ops.map((op: any) => ({
        field: op.path,
        oldValue: op.oldValue,
        newValue: op.newValue,
        operation:
          op.opType === "SET"
            ? "added"
            : op.opType === "DEL"
              ? "removed"
              : "modified",
      }));

      // Map backend opType to frontend operation
      const operation =
        item.opType === "CREATE"
          ? "create"
          : item.opType === "DELETE"
            ? "delete"
            : "update";

      return {
        table: item.targetTable,
        targetId: item.targetId,
        operation,
        changes,
        actionGroupId: item.actionGroupId,
      };
    });
  }, [cr]);

  // Group changes by ActionGroup for new UI
  const groupedChanges = useMemo(() => {
    if (!cr?.actionGroups || cr.actionGroups.length === 0) {
      // Fallback: use allChanges directly if no action groups
      return null;
    }

    return cr.actionGroups
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((group) => {
        const groupItems = allChanges.filter(
          (item) => item.actionGroupId === group.id,
        );
        return {
          ...group,
          items: groupItems,
          totalChanges: groupItems.reduce(
            (sum, item) => sum + item.changes.length,
            0,
          ),
        };
      });
  }, [cr?.actionGroups, allChanges]);

  // Action type configuration
  const getActionTypeConfig = (actionType: string) => {
    switch (actionType) {
      case "CREATE_ENTITY":
        return {
          color: "success.main",
          bgColor: "success.dark",
          icon: <AddIcon sx={{ fontSize: 16 }} />,
          label: t("changeRequest.operationCreate"),
        };
      case "DELETE_ENTITY":
        return {
          color: "error.main",
          bgColor: "error.dark",
          icon: <DeleteIcon sx={{ fontSize: 16 }} />,
          label: t("changeRequest.operationDelete"),
        };
      case "UPDATE_ENTITY":
      default:
        return {
          color: "primary.main",
          bgColor: "primary.dark",
          icon: <EditIcon sx={{ fontSize: 16 }} />,
          label: t("changeRequest.operationModify"),
        };
    }
  };

  // Toggle group expansion
  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupId]: prev[groupId] === undefined ? true : !prev[groupId], // Default collapsed, so first click expands
    }));
  };

  // Toggle item expansion
  const toggleItem = (itemKey: string) => {
    setExpandedItems((prev) => ({
      ...prev,
      [itemKey]: prev[itemKey] === undefined ? true : !prev[itemKey], // Default collapsed, so first click expands
    }));
  };

  // Helper to format text that may contain $i18n: prefix for localization
  const formatI18nText = (text: string | undefined): string => {
    if (!text) return "";
    if (text.startsWith("$i18n:")) {
      const key = text.slice(6); // Remove '$i18n:' prefix
      return t(key);
    }
    return text;
  };

  const formatValue = (value: any): string => {
    if (value === null) return t("common.none", "없음");
    if (value === undefined) return "";
    if (typeof value === "boolean")
      return value ? t("common.yes", "예") : t("common.no", "아니오");
    if (typeof value === "object") {
      // For arrays, show count or items
      if (Array.isArray(value)) {
        if (value.length === 0) return t("common.none", "없음");
        // For simple arrays, join with comma
        if (
          value.every((v) => typeof v === "string" || typeof v === "number")
        ) {
          return value.join(", ");
        }
        return JSON.stringify(value, null, 2);
      }
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  // Convert internal field names to user-friendly labels based on table
  const formatFieldName = (tableName: string, fieldName: string): string => {
    // Table-specific field mappings using actual UI localization keys
    const tableFieldMappings: Record<string, Record<string, string>> = {
      // Service Notices (g_service_notices)
      g_service_notices: {
        title: t("serviceNotices.noticeTitle"),
        content: t("serviceNotices.content"),
        category: t("serviceNotices.category"),
        tabTitle: t("serviceNotices.tabTitle"),
        startDate: t("serviceNotices.startDate"),
        endDate: t("serviceNotices.endDate"),
        description: t("serviceNotices.description"),
        isActive: t("serviceNotices.isActive"),
        platforms: t("targetSettings.platforms"),
        channels: t("targetSettings.channels"),
        subchannels: t("targetSettings.subchannels"),
      },
      // Store Products (g_store_products)
      g_store_products: {
        productId: t("storeProducts.productId"),
        productName: t("storeProducts.productName"),
        nameKo: t("storeProducts.nameKo"),
        nameEn: t("storeProducts.nameEn"),
        nameZh: t("storeProducts.nameZh"),
        store: t("storeProducts.store"),
        price: t("storeProducts.price"),
        currency: t("storeProducts.currency"),
        isActive: t("storeProducts.isActive"),
        saleStartAt: t("storeProducts.saleStartAt"),
        saleEndAt: t("storeProducts.saleEndAt"),
        description: t("storeProducts.description"),
        descriptionKo: t("storeProducts.descriptionKo"),
        descriptionEn: t("storeProducts.descriptionEn"),
        descriptionZh: t("storeProducts.descriptionZh"),
        tags: t("storeProducts.tags"),
        tagIds: t("storeProducts.tags"),
        cmsProductId: t("storeProducts.cmsProductId", "CMS 상품 ID"),
        metadata: t("storeProducts.metadata", "메타데이터"),
      },
      // Game Worlds (g_game_worlds)
      g_game_worlds: {
        name: t("gameWorlds.name"),
        worldId: t("gameWorlds.worldId"),
        description: t("gameWorlds.description"),
        isVisible: t("gameWorlds.isVisible"),
        isMaintenance: t("gameWorlds.isMaintenance"),
        maintenanceMessage: t("gameWorlds.maintenanceMessage"),
        maintenanceStartDate: t("gameWorlds.maintenanceStartDate"),
        maintenanceEndDate: t("gameWorlds.maintenanceEndDate"),
        maintenanceLocales: t("gameWorlds.maintenanceLocales"),
        worldServerAddress: t("gameWorlds.worldServerAddress"),
        forceDisconnect: t("gameWorlds.forceDisconnect"),
        gracePeriodMinutes: t("gameWorlds.gracePeriodMinutes"),
        infraSettings: t("gameWorlds.infraSettings"),
        supportsMultiLanguage: t("gameWorlds.supportsMultiLanguage"),
        customPayload: t("gameWorlds.customPayload"),
        tagIds: t("gameWorlds.tags"),
      },
      // Client Versions (g_client_versions)
      g_client_versions: {
        platform: t("clientVersions.platform"),
        clientVersion: t("clientVersions.clientVersion"),
        clientStatus: t("clientVersions.clientStatus"),
        gameServerAddress: t("clientVersions.gameServerAddress"),
        gameServerAddressForWhiteList: t(
          "clientVersions.gameServerAddressForWhiteList",
        ),
        patchAddress: t("clientVersions.patchAddress"),
        patchAddressForWhiteList: t("clientVersions.patchAddressForWhiteList"),
        guestModeAllowed: t("clientVersions.guestModeAllowed"),
        externalClickLink: t("clientVersions.externalClickLink"),
        memo: t("clientVersions.memo"),
        customPayload: t("clientVersions.customPayload"),
        maintenanceStartDate: t("clientVersions.maintenance.startDate"),
        maintenanceEndDate: t("clientVersions.maintenance.endDate"),
        maintenanceMessage: t("clientVersions.maintenance.defaultMessage"),
        maintenanceLocales: t("gameWorlds.maintenanceLocales"),
        supportsMultiLanguage: t(
          "clientVersions.maintenance.supportsMultiLanguage",
        ),
        tags: t("clientVersions.tags"),
        channel: t("clientVersions.channel"),
        minVersion: t("clientVersions.minVersion"),
        recommendedVersion: t("clientVersions.recommendedVersion"),
        latestVersion: t("clientVersions.latestVersion"),
        updateUrl: t("clientVersions.updateUrl"),
        forceUpdate: t("clientVersions.forceUpdate"),
      },
      // Surveys (g_surveys)
      g_surveys: {
        isActive: t("surveys.isActive"),
        platformSurveyId: t("surveys.platformSurveyId"),
        surveyTitle: t("surveys.surveyTitle"),
        surveyContent: t("surveys.surveyContent"),
        triggerConditions: t("surveys.triggerConditions"),
        participationRewards: t("surveys.participationRewards"),
        rewardTemplateId: t("surveys.rewardTemplateId", "보상 템플릿"),
        rewardMailTitle: t("surveys.rewardMailTitle"),
        rewardMailContent: t("surveys.rewardMailContent"),
        targetPlatforms: t("surveys.targetPlatforms", "대상 플랫폼"),
        targetPlatformsInverted: t(
          "surveys.targetPlatformsInverted",
          "플랫폼 제외 모드",
        ),
        targetChannels: t("surveys.targetChannels", "대상 채널"),
        targetChannelsInverted: t(
          "surveys.targetChannelsInverted",
          "채널 제외 모드",
        ),
        targetSubchannels: t("surveys.targetSubchannels", "대상 서브채널"),
        targetSubchannelsInverted: t(
          "surveys.targetSubchannelsInverted",
          "서브채널 제외 모드",
        ),
        targetWorlds: t("surveys.targetWorlds", "대상 월드"),
        targetWorldsInverted: t(
          "surveys.targetWorldsInverted",
          "월드 제외 모드",
        ),
      },
      // Banners (g_banners)
      g_banners: {
        name: t("banners.name"),
        description: t("banners.description"),
        width: t("banners.width"),
        height: t("banners.height"),
        playbackSpeed: t("banners.playbackSpeed"),
        shuffle: t("banners.shuffleMode"),
        sequences: t("banners.sequencesTab"),
        bannerId: t("banners.bannerId", "배너 ID"),
      },
      // Ingame Popup Notices (g_ingame_popup_notices) - extended mappings
      g_ingame_popup_notices: {
        isActive: t("ingamePopupNotices.isActive"),
        content: t("ingamePopupNotices.content"),
        startDate: t("ingamePopupNotices.startDate"),
        endDate: t("ingamePopupNotices.endDate"),
        displayPriority: t("ingamePopupNotices.displayPriority"),
        showOnce: t("ingamePopupNotices.showOnce"),
        useTemplate: t("ingamePopupNotices.useTemplate"),
        messageTemplateId: t("ingamePopupNotices.messageTemplate"),
        description: t("ingamePopupNotices.description"),
        targetPlatforms: t("ingamePopupNotices.targetPlatforms", "대상 플랫폼"),
        targetPlatformsInverted: t(
          "ingamePopupNotices.targetPlatformsInverted",
          "플랫폼 제외 모드",
        ),
        targetChannels: t("ingamePopupNotices.targetChannels", "대상 채널"),
        targetChannelsInverted: t(
          "ingamePopupNotices.targetChannelsInverted",
          "채널 제외 모드",
        ),
        targetSubchannels: t(
          "ingamePopupNotices.targetSubchannels",
          "대상 서브채널",
        ),
        targetSubchannelsInverted: t(
          "ingamePopupNotices.targetSubchannelsInverted",
          "서브채널 제외 모드",
        ),
        targetWorlds: t("ingamePopupNotices.targetWorlds", "대상 월드"),
        targetWorldsInverted: t(
          "ingamePopupNotices.targetWorldsInverted",
          "월드 제외 모드",
        ),
        targetUserIds: t("ingamePopupNotices.targetUserIds", "대상 유저 ID"),
        targetUserIdsInverted: t(
          "ingamePopupNotices.targetUserIdsInverted",
          "유저 ID 제외 모드",
        ),
      },
      // Reward Templates (g_reward_templates)
      g_reward_templates: {
        name: t("rewardTemplates.name"),
        description: t("rewardTemplates.description"),
        rewardItems: t("rewardTemplates.rewardItems"),
        tags: t("rewardTemplates.tags"),
        tagIds: t("rewardTemplates.tags"),
      },
    };

    // Common field mappings (fallback)
    const commonMappings: Record<string, string> = {
      id: "ID",
      environment: t("common.environment"),
      createdAt: t("common.createdAt"),
      updatedAt: t("common.updatedAt"),
      createdBy: t("common.createdBy"),
      updatedBy: t("common.updatedBy"),
      version: t("common.version"),
    };

    // Try table-specific mapping first
    if (tableFieldMappings[tableName]?.[fieldName]) {
      return tableFieldMappings[tableName][fieldName];
    }

    // Try common mappings
    if (commonMappings[fieldName]) {
      return commonMappings[fieldName];
    }

    // Fallback: Convert camelCase to readable format
    return fieldName
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  };

  const hasApproved = useMemo(() => {
    return cr?.approvals?.some((a) => a.approverId === user?.id);
  }, [cr, user]);

  const requiredApprovals = cr?.environmentModel?.requiredApprovers ?? 1;
  const currentApprovals = cr?.approvals?.length ?? 0;

  // Actions
  const handleApprove = async () => {
    setActionLoading(true);
    try {
      await changeRequestService.approve(
        changeRequestId!,
        comment || undefined,
      );
      enqueueSnackbar(t("changeRequest.messages.approved"), {
        variant: "success",
      });
      setComment("");
      mutate();
      onRefresh?.();
    } catch (err: any) {
      handleApiError(err, "changeRequest.errors.approveFailed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!comment.trim()) {
      enqueueSnackbar(t("changeRequest.errors.rejectCommentRequired"), {
        variant: "warning",
      });
      return;
    }
    setActionLoading(true);
    try {
      await changeRequestService.reject(changeRequestId!, comment);
      enqueueSnackbar(t("changeRequest.messages.rejected"), {
        variant: "success",
      });
      setComment("");
      mutate();
      onRefresh?.();
    } catch (err: any) {
      handleApiError(err, "changeRequest.errors.rejectFailed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleExecute = async () => {
    setActionLoading(true);
    try {
      await changeRequestService.execute(changeRequestId!);
      enqueueSnackbar(t("changeRequest.messages.executed"), {
        variant: "success",
      });
      mutate();
      onRefresh?.();
    } catch (err: any) {
      if (handleApiError(err, "changeRequest.errors.executeFailed")) {
        mutate();
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    setActionLoading(true);
    try {
      await changeRequestService.delete(changeRequestId!);
      enqueueSnackbar(t("changeRequest.messages.deleted"), {
        variant: "success",
      });
      onClose();
      onRefresh?.();
    } catch (err: any) {
      handleApiError(err, "changeRequest.errors.deleteFailed");
      setIsDeleteDialogOpen(false);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReopen = async () => {
    setActionLoading(true);
    try {
      await changeRequestService.reopen(changeRequestId!);
      enqueueSnackbar(t("changeRequest.messages.reopened"), {
        variant: "success",
      });
      mutate();
      onRefresh?.();
    } catch (err: any) {
      handleApiError(err, "changeRequest.errors.reopenFailed");
    } finally {
      setActionLoading(false);
    }
  };

  const statusConfig = cr ? STATUS_CONFIG[cr.status] : STATUS_CONFIG.draft;
  const totalChanges = allChanges.reduce(
    (sum, item) => sum + item.changes.length,
    0,
  );

  const drawerTitle = cr?.title
    ? formatChangeRequestTitle(cr.title, t)
    : t("changeRequest.title");
  const drawerSubtitle = cr
    ? `#${cr.id.slice(0, 8)} · ${t(statusConfig.labelKey)}`
    : "";

  return (
    <>
      <ResizableDrawer
        open={open}
        onClose={onClose}
        title={drawerTitle}
        subtitle={drawerSubtitle}
        storageKey="changeRequestDetailDrawerWidth"
        defaultWidth={900}
        minWidth={600}
        zIndex={1300}
      >
        {isLoading && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Box sx={{ p: 3 }}>
            <Alert severity="error">{t("common.loadFailed")}</Alert>
          </Box>
        )}

        {cr && (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              height: "100%",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <Box
              sx={{
                px: 3,
                pt: 2,
                pb: 1,
                borderBottom: 1,
                borderColor: "divider",
              }}
            >
              <Box
                sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}
              >
                <Chip
                  label={t(statusConfig.labelKey)}
                  size="small"
                  sx={{
                    bgcolor: statusConfig.bgColor,
                    color: "#fff",
                    fontWeight: 600,
                    borderRadius: "2em",
                  }}
                />
                <Typography variant="body2" color="text.secondary">
                  <strong>{cr.requester?.name || cr.requester?.email}</strong>{" "}
                  {t("changeRequest.wantsToMerge")} {allChanges.length}{" "}
                  {t("changeRequest.changes")}
                </Typography>
              </Box>

              {/* Tabs */}
              <Tabs
                value={activeTab}
                onChange={(_, v) => setActiveTab(v)}
                sx={{
                  minHeight: 40,
                  "& .MuiTab-root": {
                    minHeight: 40,
                    textTransform: "none",
                    fontWeight: 500,
                  },
                }}
              >
                <Tab
                  icon={<HistoryIcon sx={{ fontSize: 18 }} />}
                  iconPosition="start"
                  label={`${t("changeRequest.conversation")} (${timeline.length})`}
                />
                <Tab
                  icon={<DiffIcon sx={{ fontSize: 18 }} />}
                  iconPosition="start"
                  label={`${t("changeRequest.filesChanged")} (${totalChanges})`}
                />
              </Tabs>
            </Box>

            {/* Content */}
            <Box sx={{ flex: 1, overflow: "auto", p: 3 }}>
              {/* Conversation Tab */}
              {activeTab === 0 && (
                <Box>
                  {/* Initial Comment */}
                  <Box sx={{ display: "flex" }}>
                    {/* Time column with triangle pointer */}
                    <Box
                      sx={{
                        width: 72,
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "flex-end",
                        pr: 1,
                        pt: 1.5,
                      }}
                    >
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 0.5,
                        }}
                      >
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ fontWeight: 600, fontFamily: "monospace" }}
                        >
                          {new Date(cr.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: false,
                          })}
                        </Typography>
                        <Box
                          sx={{
                            width: 0,
                            height: 0,
                            borderTop: "6px solid transparent",
                            borderBottom: "6px solid transparent",
                            borderLeft: (theme) =>
                              `6px solid ${alpha(theme.palette.text.secondary, 0.3)}`,
                          }}
                        />
                      </Box>
                    </Box>

                    {/* Timeline connector column */}
                    <Box
                      sx={{
                        width: 48,
                        flexShrink: 0,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        position: "relative",
                      }}
                    >
                      <Avatar
                        sx={{
                          width: 32,
                          height: 32,
                          bgcolor: "grey.500",
                          mt: 0.5,
                          zIndex: 1,
                        }}
                      >
                        <PersonIcon sx={{ fontSize: 18 }} />
                      </Avatar>
                      {timeline.length > 1 && (
                        <Box
                          sx={{
                            position: "absolute",
                            top: 20, // mt: 0.5 (4px) + center (16px)
                            bottom: 0,
                            left: "50%",
                            width: 2,
                            bgcolor: "divider",
                            transform: "translateX(-50%)",
                          }}
                        />
                      )}
                    </Box>

                    {/* Content column */}
                    <Box sx={{ flex: 1, pl: 1.5, pb: 2 }}>
                      <Paper variant="outlined" sx={{ overflow: "hidden" }}>
                        <Box
                          sx={{
                            bgcolor: "action.hover",
                            px: 2,
                            py: 1,
                            borderBottom: cr.reason || cr.description ? 1 : 0,
                            borderColor: "divider",
                          }}
                        >
                          <Typography variant="body2">
                            <strong>
                              {cr.requester?.name || cr.requester?.email}
                            </strong>{" "}
                            {t("changeRequest.opened")}{" "}
                            <RelativeTime date={cr.createdAt} />
                          </Typography>
                        </Box>
                        {(cr.reason || cr.description) && (
                          <Box sx={{ p: 2 }}>
                            <Typography
                              variant="body2"
                              sx={{ whiteSpace: "pre-wrap" }}
                            >
                              {cr.reason || cr.description}
                            </Typography>
                          </Box>
                        )}
                      </Paper>
                    </Box>
                  </Box>

                  {/* Timeline Events */}
                  {timeline
                    .filter((e) => e.type !== "created")
                    .map((event, idx, arr) => (
                      <Box key={idx} sx={{ display: "flex" }}>
                        {/* Time column with triangle pointer */}
                        <Box
                          sx={{
                            width: 72,
                            flexShrink: 0,
                            display: "flex",
                            alignItems: "flex-start",
                            justifyContent: "flex-end",
                            pr: 1,
                            pt: 0.5,
                          }}
                        >
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 0.5,
                            }}
                          >
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{ fontWeight: 600, fontFamily: "monospace" }}
                            >
                              {new Date(event.timestamp).toLocaleTimeString(
                                [],
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  hour12: false,
                                },
                              )}
                            </Typography>
                            <Box
                              sx={{
                                width: 0,
                                height: 0,
                                borderTop: "6px solid transparent",
                                borderBottom: "6px solid transparent",
                                borderLeft: (theme) =>
                                  `6px solid ${
                                    event.type === "rejected"
                                      ? theme.palette.error.main
                                      : event.type === "approved"
                                        ? theme.palette.success.main
                                        : event.type === "executed"
                                          ? theme.palette.info.main
                                          : theme.palette.primary.main
                                  }`,
                              }}
                            />
                          </Box>
                        </Box>

                        {/* Timeline connector column */}
                        <Box
                          sx={{
                            width: 48,
                            flexShrink: 0,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            position: "relative",
                          }}
                        >
                          <Avatar
                            sx={{
                              width: 32,
                              height: 32,
                              bgcolor:
                                event.type === "rejected"
                                  ? "error.main"
                                  : event.type === "approved"
                                    ? "success.main"
                                    : event.type === "executed"
                                      ? "info.main"
                                      : "primary.main",
                              zIndex: 1,
                            }}
                          >
                            {event.type === "submitted" && (
                              <SendIcon sx={{ fontSize: 16 }} />
                            )}
                            {event.type === "approved" && (
                              <CheckIcon sx={{ fontSize: 16 }} />
                            )}
                            {event.type === "rejected" && (
                              <CloseIcon sx={{ fontSize: 16 }} />
                            )}
                            {event.type === "executed" && (
                              <MergeIcon sx={{ fontSize: 16 }} />
                            )}
                          </Avatar>
                          <Box
                            sx={{
                              position: "absolute",
                              top: 0,
                              bottom: idx === arr.length - 1 ? "auto" : 0,
                              height: idx === arr.length - 1 ? 16 : "auto",
                              left: "50%",
                              width: 2,
                              bgcolor: "divider",
                              transform: "translateX(-50%)",
                            }}
                          />
                        </Box>

                        {/* Content column */}
                        <Box sx={{ flex: 1, pl: 1.5, pb: 2 }}>
                          <Typography variant="body2">
                            <strong>
                              {event.user?.name ||
                                event.user?.email ||
                                "System"}
                            </strong>{" "}
                            {event.type === "submitted" &&
                              t("changeRequest.timeline.submitted")}
                            {event.type === "approved" &&
                              t("changeRequest.timeline.approved")}
                            {event.type === "rejected" &&
                              t("changeRequest.timeline.rejected")}
                            {event.type === "executed" &&
                              t("changeRequest.timeline.executed")}{" "}
                            <Typography component="span" color="text.secondary">
                              <RelativeTime date={event.timestamp} />
                            </Typography>
                          </Typography>

                          {/* Submitted event: show title with expandable reason */}
                          {event.type === "submitted" && (
                            <Paper variant="outlined" sx={{ mt: 1, p: 1.5 }}>
                              {event.title && (
                                <Typography
                                  variant="subtitle2"
                                  sx={{
                                    mb: event.reason ? 1 : 0,
                                    fontWeight: 600,
                                  }}
                                >
                                  {formatChangeRequestTitle(event.title, t)}
                                </Typography>
                              )}
                              {event.reason && (
                                <Typography
                                  variant="body2"
                                  sx={{
                                    whiteSpace: "pre-wrap",
                                    color: "text.secondary",
                                  }}
                                >
                                  {event.reason}
                                </Typography>
                              )}
                            </Paper>
                          )}

                          {event.comment && (
                            <Paper
                              variant="outlined"
                              sx={{
                                mt: 1,
                                p: 1.5,
                                bgcolor:
                                  event.type === "rejected"
                                    ? (theme) =>
                                        alpha(theme.palette.error.main, 0.1)
                                    : event.type === "approved"
                                      ? (theme) =>
                                          alpha(theme.palette.success.main, 0.1)
                                      : "action.hover",
                                borderColor:
                                  event.type === "rejected"
                                    ? "error.main"
                                    : event.type === "approved"
                                      ? "success.main"
                                      : "divider",
                              }}
                            >
                              <Typography
                                variant="body2"
                                sx={{ whiteSpace: "pre-wrap" }}
                              >
                                {event.comment}
                              </Typography>
                            </Paper>
                          )}
                        </Box>
                      </Box>
                    ))}

                  <Divider sx={{ my: 3, borderStyle: "dashed" }} />

                  {/* Review Box */}
                  {cr.status === "open" && (
                    <Paper variant="outlined" sx={{ overflow: "hidden" }}>
                      <Box
                        sx={{
                          bgcolor: "action.hover",
                          px: 2,
                          py: 1.5,
                          borderBottom: 1,
                          borderColor: "divider",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <Typography variant="subtitle2">
                          {t("changeRequest.addReview")}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ fontWeight: 600 }}
                        >
                          {t("changeRequest.approvalProgress")}:{" "}
                          {currentApprovals} / {requiredApprovals}
                        </Typography>
                      </Box>
                      <Box sx={{ p: 2 }}>
                        {!hasApproved ? (
                          <>
                            <TextField
                              autoFocus
                              fullWidth
                              multiline
                              rows={4}
                              placeholder={t("changeRequest.leaveComment")}
                              value={comment}
                              onChange={(e) => setComment(e.target.value)}
                              variant="outlined"
                              sx={{ mb: 2 }}
                            />
                            <Box
                              sx={{
                                display: "flex",
                                gap: 1,
                                justifyContent: "flex-end",
                              }}
                            >
                              <Button
                                variant="outlined"
                                color="error"
                                startIcon={
                                  actionLoading ? (
                                    <CircularProgress
                                      size={16}
                                      color="inherit"
                                    />
                                  ) : (
                                    <CloseIcon />
                                  )
                                }
                                onClick={handleReject}
                                disabled={actionLoading || !comment.trim()}
                              >
                                {t("changeRequest.actions.reject")}
                              </Button>
                              <Button
                                variant="contained"
                                color="success"
                                startIcon={
                                  actionLoading ? (
                                    <CircularProgress
                                      size={16}
                                      color="inherit"
                                    />
                                  ) : (
                                    <CheckIcon />
                                  )
                                }
                                onClick={handleApprove}
                                disabled={actionLoading}
                              >
                                {t("changeRequest.actions.approve")}
                              </Button>
                            </Box>
                          </>
                        ) : (
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              py: 2,
                              flexDirection: "column",
                              gap: 1,
                            }}
                          >
                            <CheckIcon
                              color="success"
                              sx={{ fontSize: 40, mb: 1 }}
                            />
                            <Typography variant="body2" color="text.secondary">
                              {t("errors.CR_ALREADY_APPROVED")}
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    </Paper>
                  )}

                  {/* Status Banners */}
                  {cr.status === "rejected" &&
                    (cr.requesterId === user?.id ||
                      user?.role === "admin" ||
                      user?.role === 0) && (
                      <Paper
                        sx={{
                          p: 2,
                          bgcolor: (theme) =>
                            alpha(theme.palette.error.main, 0.1),
                          border: 1,
                          borderColor: "error.main",
                        }}
                      >
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <Box>
                            <Typography
                              variant="body2"
                              fontWeight={500}
                              color="error.main"
                            >
                              {t("changeRequest.status.rejected")}
                            </Typography>
                            {cr.rejectionReason && (
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ display: "block", mt: 0.5 }}
                              >
                                {formatI18nText(cr.rejectionReason)}
                              </Typography>
                            )}
                          </Box>
                          <Box sx={{ display: "flex", gap: 1 }}>
                            <Button
                              variant="outlined"
                              color="warning"
                              startIcon={
                                actionLoading ? (
                                  <CircularProgress size={16} color="inherit" />
                                ) : (
                                  <UndoIcon />
                                )
                              }
                              onClick={handleReopen}
                              disabled={actionLoading}
                            >
                              {t("changeRequest.actions.reopen")}
                            </Button>
                            <Button
                              variant="outlined"
                              color="error"
                              startIcon={
                                actionLoading ? (
                                  <CircularProgress size={16} color="inherit" />
                                ) : (
                                  <DeleteIcon />
                                )
                              }
                              onClick={handleDelete}
                              disabled={actionLoading}
                            >
                              {t("common.delete")}
                            </Button>
                          </Box>
                        </Box>
                      </Paper>
                    )}

                  {cr.status === "conflict" &&
                    (cr.requesterId === user?.id ||
                      user?.role === "admin" ||
                      user?.role === 0) && (
                      <Paper
                        sx={{
                          p: 2,
                          bgcolor: (theme) =>
                            alpha(theme.palette.warning.main, 0.1),
                          border: 1,
                          borderColor: "warning.main",
                        }}
                      >
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <Box>
                            <Typography
                              variant="body2"
                              fontWeight={500}
                              color="warning.main"
                            >
                              ⚠️ {t("changeRequest.status.conflict")}
                            </Typography>
                            {cr.rejectionReason && (
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ display: "block", mt: 0.5 }}
                              >
                                {formatI18nText(cr.rejectionReason)}
                              </Typography>
                            )}
                          </Box>
                          <Box sx={{ display: "flex", gap: 1 }}>
                            <Button
                              variant="outlined"
                              color="warning"
                              startIcon={
                                actionLoading ? (
                                  <CircularProgress size={16} color="inherit" />
                                ) : (
                                  <UndoIcon />
                                )
                              }
                              onClick={handleReopen}
                              disabled={actionLoading}
                            >
                              {t("changeRequest.actions.reopen")}
                            </Button>
                            <Button
                              variant="outlined"
                              color="error"
                              startIcon={
                                actionLoading ? (
                                  <CircularProgress size={16} color="inherit" />
                                ) : (
                                  <DeleteIcon />
                                )
                              }
                              onClick={handleDelete}
                              disabled={actionLoading}
                            >
                              {t("common.delete")}
                            </Button>
                          </Box>
                        </Box>
                      </Paper>
                    )}

                  {cr.status === "approved" && (
                    <Paper
                      sx={{
                        p: 2,
                        bgcolor: (theme) =>
                          alpha(theme.palette.success.main, 0.1),
                        border: 1,
                        borderColor: "success.main",
                      }}
                    >
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <Box>
                          <Typography
                            variant="body2"
                            fontWeight={500}
                            color="success.main"
                          >
                            ✓ {t("changeRequest.readyToMerge")}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {cr.approvals?.length || 0}{" "}
                            {t("changeRequest.approvals")}
                          </Typography>
                        </Box>
                        <Button
                          variant="contained"
                          color="success"
                          startIcon={
                            actionLoading ? (
                              <CircularProgress size={16} color="inherit" />
                            ) : (
                              <MergeIcon />
                            )
                          }
                          onClick={handleExecute}
                          disabled={actionLoading}
                        >
                          {t("changeRequest.actions.merge")}
                        </Button>
                      </Box>
                    </Paper>
                  )}

                  {cr.status === "applied" && (
                    <Paper
                      sx={{
                        p: 2,
                        bgcolor: (theme) => alpha(theme.palette.info.main, 0.1),
                        border: 1,
                        borderColor: "info.main",
                      }}
                    >
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <Box>
                          <Typography
                            variant="body2"
                            fontWeight={500}
                            color="info.main"
                          >
                            ✓ {t("changeRequest.status.applied")}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {t("changeRequest.appliedMessage")}
                          </Typography>
                        </Box>
                        <Button
                          variant="outlined"
                          color="warning"
                          startIcon={<UndoIcon />}
                          onClick={() => {
                            setRollbackTargetId(changeRequestId);
                            setRollbackPreviewOpen(true);
                            onClose();
                          }}
                          disabled={actionLoading}
                        >
                          {t("changeRequest.actions.revert")}
                        </Button>
                      </Box>
                    </Paper>
                  )}

                  {cr.status === "draft" && (
                    <Paper variant="outlined" sx={{ p: 2 }}>
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <Typography variant="body2" color="text.secondary">
                          {t("changeRequest.draftMessage")}
                        </Typography>
                        <Box sx={{ display: "flex", gap: 1 }}>
                          <Button
                            variant="outlined"
                            color="error"
                            startIcon={
                              actionLoading ? (
                                <CircularProgress size={16} color="inherit" />
                              ) : (
                                <DeleteIcon />
                              )
                            }
                            onClick={handleDelete}
                            disabled={actionLoading}
                          >
                            {t("common.delete")}
                          </Button>
                          <Button
                            variant="contained"
                            startIcon={<SendIcon />}
                            onClick={() => setSubmitPreviewOpen(true)}
                            disabled={actionLoading}
                          >
                            {t("changeRequest.actions.readyForReview")}
                          </Button>
                        </Box>
                      </Box>
                    </Paper>
                  )}
                </Box>
              )}

              {/* Files Changed Tab */}
              {activeTab === 1 && (
                <Box>
                  {/* ActionGroup-based UI (when available) */}
                  {groupedChanges
                    ? groupedChanges.map((group) => {
                        const config = getActionTypeConfig(group.actionType);
                        const isExpanded = expandedGroups[group.id] === true; // Default collapsed

                        return (
                          <Paper
                            key={group.id}
                            variant="outlined"
                            sx={{ mb: 2, overflow: "hidden" }}
                          >
                            {/* ActionGroup Header - Clickable for expand/collapse */}
                            <Box
                              onClick={() => toggleGroup(group.id)}
                              sx={{
                                px: 2,
                                py: 1.5,
                                borderBottom: isExpanded ? 1 : 0,
                                borderColor: "divider",
                                display: "flex",
                                alignItems: "center",
                                gap: 1.5,
                                cursor: "pointer",
                                transition: "background-color 0.2s",
                                "&:hover": { bgcolor: "action.hover" },
                              }}
                            >
                              <ExpandMoreIcon
                                sx={{
                                  fontSize: 20,
                                  transform: isExpanded
                                    ? "rotate(0deg)"
                                    : "rotate(-90deg)",
                                  transition: "transform 0.2s",
                                  color: "text.secondary",
                                }}
                              />
                              <Avatar
                                sx={{
                                  width: 28,
                                  height: 28,
                                  bgcolor: config.color,
                                }}
                              >
                                {config.icon}
                              </Avatar>
                              <Box sx={{ flex: 1 }}>
                                <Typography variant="body2" fontWeight={600}>
                                  {formatChangeRequestTitle(group.title, t)}
                                </Typography>
                                {group.description && (
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                  >
                                    {group.description}
                                  </Typography>
                                )}
                              </Box>
                              <Chip
                                label={`${group.items.length} ${t("changeRequest.items")}`}
                                size="small"
                                sx={{ height: 20, fontSize: 11 }}
                              />
                            </Box>

                            {/* Collapsible content */}
                            <Collapse in={isExpanded} timeout="auto">
                              <Box sx={{ pl: 3 }}>
                                {group.items.map((item, idx) => {
                                  const itemKey = `${group.id}-${idx}`;
                                  const isItemExpanded =
                                    expandedItems[itemKey] === true; // Default collapsed

                                  return (
                                    <Box
                                      key={idx}
                                      sx={{
                                        borderBottom:
                                          idx < group.items.length - 1 ? 1 : 0,
                                        borderColor: "divider",
                                      }}
                                    >
                                      {/* Item header - clickable */}
                                      <Box
                                        onClick={() => toggleItem(itemKey)}
                                        sx={{
                                          px: 2,
                                          py: 1,
                                          display: "flex",
                                          alignItems: "center",
                                          gap: 1,
                                          cursor: "pointer",
                                          transition: "background-color 0.2s",
                                          "&:hover": {
                                            bgcolor: "action.hover",
                                          },
                                        }}
                                      >
                                        <ExpandMoreIcon
                                          sx={{
                                            fontSize: 16,
                                            transform: isItemExpanded
                                              ? "rotate(0deg)"
                                              : "rotate(-90deg)",
                                            transition: "transform 0.2s",
                                            color: "text.secondary",
                                          }}
                                        />
                                        <Typography
                                          variant="caption"
                                          sx={{
                                            fontFamily: "monospace",
                                            fontWeight: 600,
                                          }}
                                        >
                                          {formatChangeItemTitle(
                                            item.table,
                                            item.targetId,
                                            item.afterData,
                                            t,
                                          )}
                                        </Typography>
                                        <Chip
                                          label={item.operation}
                                          size="small"
                                          sx={{
                                            height: 18,
                                            fontSize: 10,
                                            bgcolor:
                                              item.operation === "create"
                                                ? "success.main"
                                                : item.operation === "delete"
                                                  ? "error.main"
                                                  : "primary.main",
                                            color: "#fff",
                                          }}
                                        />
                                        <Typography
                                          variant="caption"
                                          color="text.secondary"
                                          sx={{ ml: "auto" }}
                                        >
                                          {item.changes.length} ops
                                        </Typography>
                                      </Box>
                                      {/* Op-based changes - different display based on operation type */}
                                      <Collapse
                                        in={isItemExpanded}
                                        timeout="auto"
                                      >
                                        <Box sx={{ px: 2, py: 1 }}>
                                          {/* DELETE: No ops detail needed */}
                                          {item.operation === "delete" && (
                                            <Typography
                                              variant="body2"
                                              color="error"
                                              sx={{
                                                textAlign: "center",
                                                py: 2,
                                                fontStyle: "italic",
                                              }}
                                            >
                                              {t("changeRequest.opDelete")}
                                            </Typography>
                                          )}

                                          {/* CREATE: Table format (Field | Value) */}
                                          {item.operation === "create" &&
                                            item.changes.length > 0 && (
                                              <Table
                                                size="small"
                                                sx={{
                                                  "& td, & th": {
                                                    py: 0.75,
                                                    px: 1.5,
                                                    border: "none",
                                                  },
                                                }}
                                              >
                                                <TableBody>
                                                  {item.changes
                                                    .filter(
                                                      (c) =>
                                                        ![
                                                          "updatedBy",
                                                          "createdBy",
                                                          "updatedAt",
                                                          "createdAt",
                                                          "id",
                                                          "version",
                                                          "environment",
                                                        ].includes(c.field),
                                                    )
                                                    .map((change, i) => (
                                                      <TableRow
                                                        key={i}
                                                        sx={{
                                                          "&:nth-of-type(odd)":
                                                            {
                                                              bgcolor:
                                                                "action.hover",
                                                            },
                                                        }}
                                                      >
                                                        <TableCell
                                                          sx={{
                                                            fontWeight: 600,
                                                            color:
                                                              "text.secondary",
                                                            width: "35%",
                                                            fontSize:
                                                              "0.875rem",
                                                          }}
                                                        >
                                                          {formatFieldName(
                                                            item.table,
                                                            change.field,
                                                          )}
                                                        </TableCell>
                                                        <TableCell
                                                          sx={{
                                                            color:
                                                              "success.main",
                                                            fontWeight: 500,
                                                            fontSize:
                                                              "0.875rem",
                                                          }}
                                                        >
                                                          {formatValue(
                                                            change.newValue,
                                                          )}
                                                        </TableCell>
                                                      </TableRow>
                                                    ))}
                                                </TableBody>
                                              </Table>
                                            )}

                                          {/* UPDATE: Original format with before/after */}
                                          {item.operation === "update" &&
                                            item.changes
                                              .filter(
                                                (c) =>
                                                  ![
                                                    "updatedBy",
                                                    "createdBy",
                                                    "updatedAt",
                                                    "createdAt",
                                                  ].includes(c.field),
                                              )
                                              .map((change, i) => (
                                                <Box
                                                  key={i}
                                                  sx={{
                                                    display: "flex",
                                                    alignItems: "flex-start",
                                                    gap: 1,
                                                    py: 0.75,
                                                    borderBottom:
                                                      i <
                                                      item.changes.length - 1
                                                        ? 1
                                                        : 0,
                                                    borderColor: "divider",
                                                    fontSize: 12,
                                                    fontFamily: "monospace",
                                                  }}
                                                >
                                                  {/* Op icon */}
                                                  <Chip
                                                    label={
                                                      change.operation ===
                                                      "added"
                                                        ? "SET"
                                                        : change.operation ===
                                                            "removed"
                                                          ? "DEL"
                                                          : "MOD"
                                                    }
                                                    size="small"
                                                    sx={{
                                                      height: 18,
                                                      fontSize: 9,
                                                      fontWeight: 700,
                                                      minWidth: 36,
                                                      bgcolor:
                                                        change.operation ===
                                                        "added"
                                                          ? "success.main"
                                                          : change.operation ===
                                                              "removed"
                                                            ? "error.main"
                                                            : "primary.main",
                                                      color: "#fff",
                                                    }}
                                                  />
                                                  {/* Field name */}
                                                  <Typography
                                                    component="span"
                                                    sx={{
                                                      fontWeight: 600,
                                                      color: "text.primary",
                                                      fontSize: 12,
                                                    }}
                                                  >
                                                    {formatFieldName(
                                                      item.table,
                                                      change.field,
                                                    )}
                                                  </Typography>
                                                  {/* Op description */}
                                                  <Box
                                                    sx={{
                                                      flex: 1,
                                                      color: "text.secondary",
                                                    }}
                                                  >
                                                    {change.operation ===
                                                    "added" ? (
                                                      <Typography
                                                        component="span"
                                                        sx={{ fontSize: 12 }}
                                                      >
                                                        ={" "}
                                                        <Box
                                                          component="span"
                                                          sx={{
                                                            color:
                                                              "success.main",
                                                            fontWeight: 500,
                                                          }}
                                                        >
                                                          {formatValue(
                                                            change.newValue,
                                                          )}
                                                        </Box>
                                                      </Typography>
                                                    ) : change.operation ===
                                                      "removed" ? (
                                                      <Typography
                                                        component="span"
                                                        sx={{
                                                          fontSize: 12,
                                                          color: "error.main",
                                                          textDecoration:
                                                            "line-through",
                                                        }}
                                                      >
                                                        {formatValue(
                                                          change.oldValue,
                                                        )}
                                                      </Typography>
                                                    ) : (
                                                      <Typography
                                                        component="span"
                                                        sx={{ fontSize: 12 }}
                                                      >
                                                        <Box
                                                          component="span"
                                                          sx={{
                                                            color: "error.main",
                                                            textDecoration:
                                                              "line-through",
                                                          }}
                                                        >
                                                          {formatValue(
                                                            change.oldValue,
                                                          )}
                                                        </Box>
                                                        {" → "}
                                                        <Box
                                                          component="span"
                                                          sx={{
                                                            color:
                                                              "success.main",
                                                            fontWeight: 500,
                                                          }}
                                                        >
                                                          {formatValue(
                                                            change.newValue,
                                                          )}
                                                        </Box>
                                                      </Typography>
                                                    )}
                                                  </Box>
                                                </Box>
                                              ))}

                                          {item.operation === "update" &&
                                            item.changes.filter(
                                              (c) =>
                                                ![
                                                  "updatedBy",
                                                  "createdBy",
                                                  "updatedAt",
                                                  "createdAt",
                                                ].includes(c.field),
                                            ).length === 0 && (
                                              <Typography
                                                variant="body2"
                                                color="text.secondary"
                                                sx={{
                                                  textAlign: "center",
                                                  py: 2,
                                                }}
                                              >
                                                {t("changeRequest.noChanges")}
                                              </Typography>
                                            )}
                                        </Box>
                                      </Collapse>
                                    </Box>
                                  );
                                })}
                              </Box>
                            </Collapse>
                          </Paper>
                        );
                      })
                    : /* Fallback: Legacy view for items without ActionGroup - now using op-based list */
                      allChanges.map((item, idx) => (
                        <Paper
                          key={idx}
                          variant="outlined"
                          sx={{ mb: 2, overflow: "hidden" }}
                        >
                          <Box
                            sx={{
                              px: 2,
                              py: 1,
                              bgcolor: "action.hover",
                              borderBottom: 1,
                              borderColor: "divider",
                              display: "flex",
                              alignItems: "center",
                              gap: 1,
                            }}
                          >
                            <Typography
                              variant="body2"
                              sx={{ fontFamily: "monospace", fontWeight: 600 }}
                            >
                              {item.table}/{item.targetId}
                            </Typography>
                            <Chip
                              label={item.operation}
                              size="small"
                              sx={{
                                height: 20,
                                fontSize: 11,
                                bgcolor:
                                  item.operation === "create"
                                    ? "success.main"
                                    : item.operation === "delete"
                                      ? "error.main"
                                      : "primary.main",
                                color: "#fff",
                              }}
                            />
                          </Box>
                          {/* Op-based changes list */}
                          <Box sx={{ px: 2, py: 1 }}>
                            {item.changes.map((change, i) => (
                              <Box
                                key={i}
                                sx={{
                                  display: "flex",
                                  alignItems: "flex-start",
                                  gap: 1,
                                  py: 0.75,
                                  borderBottom:
                                    i < item.changes.length - 1 ? 1 : 0,
                                  borderColor: "divider",
                                  fontSize: 13,
                                  fontFamily: "monospace",
                                }}
                              >
                                <Chip
                                  label={
                                    change.operation === "added"
                                      ? "SET"
                                      : change.operation === "removed"
                                        ? "DEL"
                                        : "MOD"
                                  }
                                  size="small"
                                  sx={{
                                    height: 18,
                                    fontSize: 9,
                                    fontWeight: 700,
                                    minWidth: 36,
                                    bgcolor:
                                      change.operation === "added"
                                        ? "success.main"
                                        : change.operation === "removed"
                                          ? "error.main"
                                          : "primary.main",
                                    color: "#fff",
                                  }}
                                />
                                <Typography
                                  component="span"
                                  sx={{ fontWeight: 600, fontSize: 13 }}
                                >
                                  {formatFieldName(item.table, change.field)}
                                </Typography>
                                <Box sx={{ flex: 1, color: "text.secondary" }}>
                                  {change.operation === "added" ? (
                                    <Typography
                                      component="span"
                                      sx={{ fontSize: 13 }}
                                    >
                                      ={" "}
                                      <Box
                                        component="span"
                                        sx={{
                                          color: "success.main",
                                          fontWeight: 500,
                                        }}
                                      >
                                        {formatValue(change.newValue)}
                                      </Box>
                                    </Typography>
                                  ) : change.operation === "removed" ? (
                                    <Typography
                                      component="span"
                                      sx={{
                                        fontSize: 13,
                                        color: "error.main",
                                        textDecoration: "line-through",
                                      }}
                                    >
                                      {formatValue(change.oldValue)}
                                    </Typography>
                                  ) : (
                                    <Typography
                                      component="span"
                                      sx={{ fontSize: 13 }}
                                    >
                                      <Box
                                        component="span"
                                        sx={{
                                          color: "error.main",
                                          textDecoration: "line-through",
                                        }}
                                      >
                                        {formatValue(change.oldValue)}
                                      </Box>
                                      {" → "}
                                      <Box
                                        component="span"
                                        sx={{
                                          color: "success.main",
                                          fontWeight: 500,
                                        }}
                                      >
                                        {formatValue(change.newValue)}
                                      </Box>
                                    </Typography>
                                  )}
                                </Box>
                              </Box>
                            ))}
                            {item.changes.length === 0 && (
                              <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ textAlign: "center", py: 2 }}
                              >
                                {t("changeRequest.noChanges")}
                              </Typography>
                            )}
                          </Box>
                        </Paper>
                      ))}
                </Box>
              )}
            </Box>
          </Box>
        )}

        {/* Delete Confirmation */}
        <ConfirmDeleteDialog
          open={isDeleteDialogOpen}
          onClose={() => setIsDeleteDialogOpen(false)}
          onConfirm={handleConfirmDelete}
          title={t("changeRequest.deleteDialog.title")}
          message={t("changeRequest.deleteDialog.message")}
          loading={actionLoading}
        />
        <ErrorDialog />
      </ResizableDrawer>

      {/* Rollback Preview Drawer - Outside main drawer so it persists when main closes */}
      <RevertPreviewDrawer
        open={rollbackPreviewOpen}
        onClose={() => {
          setRollbackPreviewOpen(false);
          setRollbackTargetId(null);
        }}
        changeRequestId={rollbackTargetId}
        onRollbackCreated={() => {
          mutate();
          onRefresh?.();
        }}
      />

      {/* Submit Preview Drawer - Outside main drawer */}
      <SubmitPreviewDrawer
        open={submitPreviewOpen}
        onClose={() => setSubmitPreviewOpen(false)}
        changeRequest={cr}
        onSubmitted={() => {
          mutate();
          onRefresh?.();
        }}
      />
    </>
  );
};

export default ChangeRequestDetailDrawer;
