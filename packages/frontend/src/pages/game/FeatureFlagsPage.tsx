import React, { useState, useEffect, useMemo } from "react";
import NamingGuide from "../../components/common/NamingGuide";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { PERMISSIONS } from "../../types/permissions";
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  TextField,
  InputAdornment,
  Tooltip,
  Card,
  CardContent,
  Paper,
  TableSortLabel,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  Switch,
  Autocomplete,
  Stack,
  CircularProgress,
  Checkbox,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Menu,
  ListItemIcon,
  ListItemText,
  ClickAwayListener,
} from "@mui/material";
import {
  Add as AddIcon,
  Search as SearchIcon,
  Flag as FlagIcon,
  Refresh as RefreshIcon,
  Archive as ArchiveIcon,
  Unarchive as UnarchiveIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  Warning as WarningIcon,
  RocketLaunch as ReleaseIcon,
  Science as ExperimentIcon,
  Build as OperationalIcon,
  Security as PermissionIcon,
  PowerOff as KillSwitchIcon,
  ViewColumn as ViewColumnIcon,
  FileUpload as ImportIcon,
  FileDownload as ExportIcon,
  CheckCircle as CheckCircleIcon,
  MoreVert as MoreVertIcon,
  FileCopy as CloneIcon,
  ReportProblem as StaleIcon,
  Cancel as CancelIcon,
  Close as CloseIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  OpenInNew as OpenInNewIcon,
  BarChart as MetricsIcon,
  HelpOutline as HelpOutlineIcon,
  TextFields as TextFieldsIcon,
  Numbers as NumbersIcon,
  DataObject as DataObjectIcon,
} from "@mui/icons-material";
import JsonEditor from "../../components/common/JsonEditor";
import { useTranslation } from "react-i18next";
import { useSnackbar } from "notistack";
import { parseApiErrorMessage } from "../../utils/errorUtils";
import featureFlagService, { FeatureFlag, FlagType } from "../../services/featureFlagService";
import SimplePagination from "../../components/common/SimplePagination";
import EmptyState from "../../components/common/EmptyState";
import DynamicFilterBar, {
  FilterDefinition,
  ActiveFilter,
} from "../../components/common/DynamicFilterBar";
import ColumnSettingsDialog, { ColumnConfig } from "../../components/common/ColumnSettingsDialog";
import { useDebounce } from "../../hooks/useDebounce";
import { useGlobalPageSize } from "../../hooks/useGlobalPageSize";
import { formatDateTimeDetailed, formatRelativeTime } from "../../utils/dateFormat";
import ConfirmDeleteDialog from "../../components/common/ConfirmDeleteDialog";
import { copyToClipboardWithNotification } from "../../utils/clipboard";
import { tagService, Tag } from "../../services/tagService";
import { getContrastColor } from "../../utils/colorUtils";
import { environmentService, Environment } from "../../services/environmentService";
import ResizableDrawer from "../../components/common/ResizableDrawer";
import FeatureSwitch from "../../components/common/FeatureSwitch";
import api from "../../services/api";

interface FlagTypeInfo {
  flagType: string;
  lifetimeDays: number | null;
}

const FeatureFlagsPage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { hasPermission } = useAuth();
  const canManage = hasPermission([PERMISSIONS.FEATURE_FLAGS_MANAGE]);
  const navigate = useNavigate();

  // State
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useGlobalPageSize();
  const [loading, setLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const [staleConfirmOpen, setStaleConfirmOpen] = useState(false);
  const [deletingFlag, setDeletingFlag] = useState<FeatureFlag | null>(null);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [flagTypes, setFlagTypes] = useState<FlagTypeInfo[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [selectedFlags, setSelectedFlags] = useState<Set<string>>(new Set());

  // Create dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newFlag, setNewFlag] = useState({
    flagName: "",
    displayName: "",
    description: "",
    flagType: "release" as FlagType,
    tags: [] as string[],
    impressionDataEnabled: false,
    variantType: "string" as "string" | "number" | "json",
    baselinePayload: "" as string | number | object,
  });

  // Sorting state
  const [orderBy, setOrderBy] = useState<string>(() => {
    const saved = localStorage.getItem("featureFlagsSortBy");
    return saved || "createdAt";
  });
  const [order, setOrder] = useState<"asc" | "desc">(() => {
    const saved = localStorage.getItem("featureFlagsSortOrder");
    return (saved as "asc" | "desc") || "desc";
  });

  // Export/Import state
  const [exportMenuAnchor, setExportMenuAnchor] = useState<null | HTMLElement>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importData, setImportData] = useState<string>("");
  const [importing, setImporting] = useState(false);

  // Action menu state
  const [actionMenuAnchor, setActionMenuAnchor] = useState<null | HTMLElement>(null);
  const [actionMenuFlag, setActionMenuFlag] = useState<FeatureFlag | null>(null);

  // Bulk action menu state
  const [envMenuAnchor, setEnvMenuAnchor] = useState<null | HTMLElement>(null);
  const [staleMenuAnchor, setStaleMenuAnchor] = useState<null | HTMLElement>(null);

  // Clone dialog state
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [cloningFlag, setCloningFlag] = useState<FeatureFlag | null>(null);
  const [cloneNewName, setCloneNewName] = useState("");
  const [cloning, setCloning] = useState(false);
  const [newFlagBaselinePayloadJsonError, setNewFlagBaselinePayloadJsonError] = useState<string | null>(null);

  // Column settings state
  const [columnSettingsAnchor, setColumnSettingsAnchor] = useState<null | HTMLElement>(null);
  const defaultColumns: ColumnConfig[] = [
    { id: "flagName", labelKey: "featureFlags.flagName", visible: true },
    { id: "status", labelKey: "featureFlags.status", visible: true },
    { id: "variantType", labelKey: "featureFlags.variantType", visible: true },
    { id: "createdBy", labelKey: "common.createdBy", visible: true },
    { id: "createdAt", labelKey: "featureFlags.createdAt", visible: true },
    { id: "lastSeenAt", labelKey: "featureFlags.lastSeenAt", visible: true },
    { id: "tags", labelKey: "featureFlags.tags", visible: true },
  ];
  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    const saved = localStorage.getItem("featureFlagsColumns");
    if (saved) {
      try {
        const savedColumns = JSON.parse(saved);
        const mergedColumns = savedColumns.map((savedCol: ColumnConfig) => {
          const defaultCol = defaultColumns.find((c) => c.id === savedCol.id);
          return defaultCol ? { ...defaultCol, ...savedCol } : savedCol;
        });
        const savedIds = new Set(savedColumns.map((c: ColumnConfig) => c.id));
        const newColumns = defaultColumns.filter((c) => !savedIds.has(c.id));
        return [...mergedColumns, ...newColumns];
      } catch {
        return defaultColumns;
      }
    }
    return defaultColumns;
  });

  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  // Extract filter values with useMemo (as string[] for multiselect)
  const flagTypeFilter = useMemo(() => {
    const filter = activeFilters.find((f) => f.key === "flagType");
    return filter?.value as string[] | undefined;
  }, [activeFilters]);

  const statusFilter = useMemo(() => {
    const filter = activeFilters.find((f) => f.key === "status");
    return filter?.value as string[] | undefined;
  }, [activeFilters]);

  const tagFilter = useMemo(() => {
    const filter = activeFilters.find((f) => f.key === "tag");
    return filter?.value as string[] | undefined;
  }, [activeFilters]);

  // Icon helpers for filter options
  const getStatusIcon = (status: string) => {
    const iconProps = { sx: { fontSize: 16 } };
    switch (status) {
      case "active":
        return <CheckCircleIcon {...iconProps} color="success" />;
      case "archived":
        return <ArchiveIcon {...iconProps} color="disabled" />;
      case "stale":
        return <WarningIcon {...iconProps} color="error" />;
      case "potentiallyStale":
        return <WarningIcon {...iconProps} color="warning" />;
      default:
        return null;
    }
  };

  const getTypeIconSmall = (type: string) => {
    const iconProps = { sx: { fontSize: 16 } };
    switch (type) {
      case "release":
        return <ReleaseIcon {...iconProps} color="primary" />;
      case "experiment":
        return <ExperimentIcon {...iconProps} color="secondary" />;
      case "operational":
        return <OperationalIcon {...iconProps} color="warning" />;
      case "killSwitch":
        return <KillSwitchIcon {...iconProps} color="error" />;
      case "permission":
        return <PermissionIcon {...iconProps} color="action" />;
      default:
        return <FlagIcon {...iconProps} />;
    }
  };

  // Filter definitions
  const availableFilterDefinitions: FilterDefinition[] = useMemo(
    () => [
      {
        key: "status",
        label: t("featureFlags.status"),
        type: "multiselect",
        options: [
          {
            value: "active",
            label: t("featureFlags.statusActive"),
            icon: getStatusIcon("active"),
          },
          {
            value: "archived",
            label: t("featureFlags.statusArchived"),
            icon: getStatusIcon("archived"),
          },
          {
            value: "stale",
            label: t("featureFlags.statusStale"),
            icon: getStatusIcon("stale"),
          },
          {
            value: "potentiallyStale",
            label: t("featureFlags.statusPotentiallyStale"),
            icon: getStatusIcon("potentiallyStale"),
          },
        ],
      },
      {
        key: "flagType",
        label: t("featureFlags.flagType"),
        type: "multiselect",
        options: [
          {
            value: "release",
            label: t("featureFlags.types.release"),
            icon: getTypeIconSmall("release"),
          },
          {
            value: "experiment",
            label: t("featureFlags.types.experiment"),
            icon: getTypeIconSmall("experiment"),
          },
          {
            value: "operational",
            label: t("featureFlags.types.operational"),
            icon: getTypeIconSmall("operational"),
          },
          {
            value: "killSwitch",
            label: t("featureFlags.types.killSwitch"),
            icon: getTypeIconSmall("killSwitch"),
          },
          {
            value: "permission",
            label: t("featureFlags.types.permission"),
            icon: getTypeIconSmall("permission"),
          },
        ],
      },
      {
        key: "tag",
        label: t("featureFlags.tags"),
        type: "multiselect",
        operator: "any_of",
        allowOperatorToggle: true,
        options: allTags.map((tag) => ({ value: tag.name, label: tag.name })),
      },
      {
        key: "variantType",
        label: t("featureFlags.variantType"),
        type: "multiselect",
        options: [
          { value: "string", label: t("featureFlags.variantTypes.string") },
          { value: "number", label: t("featureFlags.variantTypes.number") },
          { value: "json", label: t("featureFlags.variantTypes.json") },
        ],
      },
    ],
    [t, allTags]
  );

  // Visible columns
  const visibleColumns = useMemo(() => columns.filter((col) => col.visible), [columns]);

  // Load flags
  const loadFlags = async () => {
    setLoading(true);
    try {
      // Determine isArchived and status based on statusFilter (multiselect)
      let isArchived: boolean | undefined = undefined;
      let status: string | undefined = undefined;

      // For multiselect, if only specific statuses are selected, apply them
      if (statusFilter && statusFilter.length > 0) {
        // If only archived is selected
        if (statusFilter.length === 1 && statusFilter[0] === "archived") {
          isArchived = true;
        }
        // If only active is selected
        else if (statusFilter.length === 1 && statusFilter[0] === "active") {
          isArchived = false;
        }
        // If stale or potentiallyStale is selected without archived
        else if (
          !statusFilter.includes("archived") &&
          (statusFilter.includes("stale") || statusFilter.includes("potentiallyStale"))
        ) {
          isArchived = false;
          if (statusFilter.length === 1) {
            status = statusFilter[0];
          }
        }
      }

      // For multiselect flagType, take the first value or undefined
      // TODO: Backend should support multiple flag types in the future
      const selectedFlagType =
        flagTypeFilter && flagTypeFilter.length > 0 ? (flagTypeFilter[0] as FlagType) : undefined;

      const result = await featureFlagService.getFeatureFlags({
        page: page + 1,
        limit: rowsPerPage,
        search: debouncedSearchTerm || undefined,
        flagType: selectedFlagType,
        isArchived,
        sortBy: orderBy,
        sortOrder: order,
      });

      if (
        result &&
        typeof result === "object" &&
        "flags" in result &&
        Array.isArray(result.flags)
      ) {
        // Apply client-side filtering for multiselect values that server doesn't support
        let filteredFlags = result.flags;

        // Filter by flagType (if any selected)
        if (flagTypeFilter && flagTypeFilter.length > 0) {
          filteredFlags = filteredFlags.filter((f) => flagTypeFilter.includes(f.flagType));
        }

        // Filter by status (if any selected)
        if (statusFilter && statusFilter.length > 0) {
          filteredFlags = filteredFlags.filter((f) => {
            // Determine the flag's status
            let flagStatus: string;
            if (f.isArchived) {
              flagStatus = "archived";
            } else if (f.stale) {
              flagStatus = "stale";
            } else if (f.potentiallyStale) {
              flagStatus = "potentiallyStale";
            } else {
              flagStatus = "active";
            }
            return statusFilter.includes(flagStatus);
          });
        }

        // Filter by tag
        if (tagFilter && tagFilter.length > 0) {
          filteredFlags = filteredFlags.filter((f) =>
            tagFilter.some((tag) => f.tags?.includes(tag))
          );
        }

        // Sort favorites first (always show favorites at top, then apply normal sort)
        filteredFlags.sort((a, b) => {
          // Favorites first
          if (a.isFavorite && !b.isFavorite) return -1;
          if (!a.isFavorite && b.isFavorite) return 1;
          return 0; // Keep original order for non-favorite sorting (already sorted by server)
        });

        setFlags(filteredFlags);
        const validTotal =
          typeof result.total === "number" && !isNaN(result.total) ? result.total : 0;
        setTotal(validTotal);
      } else {
        console.error("Invalid response:", result);
        setFlags([]);
        setTotal(0);
      }
    } catch (error: any) {
      console.error("Failed to load feature flags:", error);
      enqueueSnackbar(parseApiErrorMessage(error, "featureFlags.loadFailed"), {
        variant: "error",
      });
      setFlags([]);
      setTotal(0);
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  };

  const loadTags = async () => {
    try {
      const tags = await tagService.list();
      setAllTags(tags);
    } catch {
      setAllTags([]);
    }
  };

  // Filter handlers
  const handleFilterAdd = (filter: ActiveFilter) => {
    setActiveFilters([...activeFilters, filter]);
    setPage(0);
  };

  const handleFilterRemove = (filterKey: string) => {
    setActiveFilters(activeFilters.filter((f) => f.key !== filterKey));
    setPage(0);
  };

  const handleFilterChange = (filterKey: string, value: any) => {
    const newFilters = activeFilters.map((f) => (f.key === filterKey ? { ...f, value } : f));
    setActiveFilters(newFilters);
    setPage(0);
  };

  const handleOperatorChange = (filterKey: string, operator: "any_of" | "include_all") => {
    const newFilters = activeFilters.map((f) => (f.key === filterKey ? { ...f, operator } : f));
    setActiveFilters(newFilters);
  };

  // Column handlers
  const handleColumnsChange = (newColumns: ColumnConfig[]) => {
    setColumns(newColumns);
    localStorage.setItem("featureFlagsColumns", JSON.stringify(newColumns));
  };

  const handleResetColumns = () => {
    setColumns(defaultColumns);
    localStorage.setItem("featureFlagsColumns", JSON.stringify(defaultColumns));
  };

  // Export/Import handlers
  const handleExport = async (environment: string) => {
    try {
      // Get list of all flags first
      const result = await featureFlagService.getFeatureFlags({
        page: 1,
        limit: 10000, // Get all flags
        isArchived: false,
      });

      if (result && result.flags && result.flags.length > 0) {
        // Fetch detailed info for each flag (includes strategies)
        const detailedFlags = await Promise.all(
          result.flags.map(async (flag) => {
            try {
              return await featureFlagService.getFeatureFlag(flag.flagName);
            } catch {
              return flag; // Fallback to basic info if detail fetch fails
            }
          })
        );

        // Collect all used segment names from strategies
        const usedSegmentNames = new Set<string>();
        detailedFlags.forEach((flag) => {
          // Strategies are on the flag level (already filtered by env from getFeatureFlag)
          (flag as any).strategies?.forEach((strategy: any) => {
            strategy.segments?.forEach((segmentName: string) => {
              usedSegmentNames.add(segmentName);
            });
          });
        });

        // Fetch all segments and filter used ones
        let segments: any[] = [];
        if (usedSegmentNames.size > 0) {
          try {
            const response = await api.get("/admin/features/segments");
            const allSegments = response.data?.segments || [];
            segments = allSegments
              .filter((seg: any) => usedSegmentNames.has(seg.segmentName))
              .map((seg: any) => ({
                segmentName: seg.segmentName,
                description: seg.description,
                constraints: seg.constraints,
              }));
          } catch {
            // Continue without segments if fetch fails
          }
        }

        const exportData = {
          exportedAt: new Date().toISOString(),
          environment,
          segments,
          flags: detailedFlags.map((flag) => {
            // Strategies/variants are already filtered by environment in getFeatureFlag
            const envData = flag.environments?.find((env: any) => env.environment === environment);

            // Clean strategies - remove unnecessary metadata
            const strategies = ((flag as any).strategies ?? []).map((s: any) => ({
              strategyName: s.strategyName,
              parameters: s.parameters,
              constraints: s.constraints,
              segments: s.segments,
              sortOrder: s.sortOrder,
              isEnabled: s.isEnabled,
            }));

            // Clean variants - remove unnecessary metadata
            const variants = ((flag as any).variants ?? []).map((v: any) => ({
              variantName: v.variantName,
              weight: v.weight,
              payload: v.payload ?? null,
              payloadType: v.payloadType,
              weightLock: Boolean(v.weightLock),
              overrides: v.overrides ?? null,
            }));

            return {
              flagName: flag.flagName,
              displayName: flag.displayName,
              description: flag.description,
              flagType: flag.flagType,
              tags: flag.tags,
              impressionDataEnabled: flag.impressionDataEnabled,
              variantType: flag.variantType || "string",
              baselinePayload: flag.baselinePayload,
              enabled: envData?.isEnabled ?? false,
              strategies,
              variants,
            };
          }),
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `feature-flags-${environment}-${new Date().toISOString().split("T")[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        enqueueSnackbar(t("featureFlags.exportSuccess", { count: detailedFlags.length }), {
          variant: "success",
        });
      } else {
        enqueueSnackbar(t("featureFlags.exportNoFlags"), { variant: "info" });
      }
    } catch (error: any) {
      enqueueSnackbar(parseApiErrorMessage(error, "featureFlags.exportFailed"), {
        variant: "error",
      });
    }
    setExportMenuAnchor(null);
  };

  const handleImport = async () => {
    if (!importData.trim()) {
      enqueueSnackbar(t("featureFlags.importNoData"), { variant: "warning" });
      return;
    }

    setImporting(true);
    try {
      const data = JSON.parse(importData);

      if (!data.flags || !Array.isArray(data.flags)) {
        enqueueSnackbar(t("featureFlags.importInvalidFormat"), {
          variant: "error",
        });
        setImporting(false);
        return;
      }

      // Call backend import API
      const response = await api.post("/admin/features/import", {
        segments: data.segments || [],
        flags: data.flags,
      });

      const result = response.data;
      const summary = result.summary;

      // Show result
      if (summary.flagsCreated > 0 || summary.segmentsCreated > 0) {
        let msg = "";
        if (summary.flagsCreated > 0) {
          msg += t("featureFlags.importFlagsCreated", {
            count: summary.flagsCreated,
          });
        }
        if (summary.segmentsCreated > 0) {
          if (msg) msg += ", ";
          msg += t("featureFlags.importSegmentsCreated", {
            count: summary.segmentsCreated,
          });
        }
        enqueueSnackbar(msg, { variant: "success" });
        loadFlags();
      }

      if (summary.flagsSkipped > 0 || summary.segmentsSkipped > 0) {
        let msg = "";
        if (summary.flagsSkipped > 0) {
          msg += t("featureFlags.importFlagsSkipped", {
            count: summary.flagsSkipped,
          });
        }
        if (summary.segmentsSkipped > 0) {
          if (msg) msg += ", ";
          msg += t("featureFlags.importSegmentsSkipped", {
            count: summary.segmentsSkipped,
          });
        }
        enqueueSnackbar(msg, { variant: "info" });
      }

      if (summary.errors > 0) {
        enqueueSnackbar(t("featureFlags.importPartialError", { count: summary.errors }), {
          variant: "warning",
        });
      }

      if (summary.flagsCreated === 0 && summary.segmentsCreated === 0) {
        enqueueSnackbar(t("featureFlags.importNothingNew"), {
          variant: "info",
        });
      }

      setImportDialogOpen(false);
      setImportData("");
    } catch (error: any) {
      if (error instanceof SyntaxError) {
        enqueueSnackbar(t("featureFlags.importInvalidJson"), {
          variant: "error",
        });
      } else {
        enqueueSnackbar(parseApiErrorMessage(error, "featureFlags.importFailed"), {
          variant: "error",
        });
      }
    } finally {
      setImporting(false);
    }
  };

  const handleImportFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setImportData(content);
      };
      reader.readAsText(file);
    }
  };

  useEffect(() => {
    loadFlags();
  }, [
    page,
    rowsPerPage,
    debouncedSearchTerm,
    orderBy,
    order,
    flagTypeFilter,
    statusFilter,
    tagFilter,
  ]);

  useEffect(() => {
    loadTags();
    loadFlagTypes();
    loadEnvironments();
  }, []);

  const loadEnvironments = async () => {
    try {
      const envs = await environmentService.getEnvironments();
      // Filter only visible environments and sort by displayOrder
      setEnvironments(
        envs.filter((e) => !e.isHidden).sort((a, b) => a.displayOrder - b.displayOrder)
      );
    } catch {
      setEnvironments([]);
    }
  };

  const loadFlagTypes = async () => {
    try {
      const response = await api.get("/admin/features/types");
      setFlagTypes(response.data?.types || []);
    } catch {
      setFlagTypes([]);
    }
  };

  // Check if a flag is stale based on its type's lifetime
  const isStale = (flag: FeatureFlag): boolean => {
    if (!flag.createdAt) return false;
    const typeInfo = flagTypes.find((t) => t.flagType === flag.flagType);
    if (!typeInfo || typeInfo.lifetimeDays === null) return false;
    const createdAt = new Date(flag.createdAt);
    const now = new Date();
    const daysSinceCreation = Math.floor(
      (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSinceCreation > typeInfo.lifetimeDays;
  };

  // Sort handler
  const handleSort = (colId: string) => {
    let newOrder: "asc" | "desc" = "asc";
    if (orderBy === colId) {
      newOrder = order === "asc" ? "desc" : "asc";
    }
    setOrderBy(colId);
    setOrder(newOrder);
    localStorage.setItem("featureFlagsSortBy", colId);
    localStorage.setItem("featureFlagsSortOrder", newOrder);
    setPage(0);
  };

  // Toggle flag for a specific environment
  const handleToggle = async (flag: FeatureFlag, environment: string, currentEnabled: boolean) => {
    const newEnabled = !currentEnabled;

    // Optimistic update - ensure environments array exists
    setFlags((prev) =>
      prev.map((f) => {
        if (f.flagName !== flag.flagName) return f;

        // If environments array doesn't exist, create it with the toggled environment
        const existingEnvs = f.environments || [];
        const envExists = existingEnvs.some((e) => e.environment === environment);

        let updatedEnvs;
        if (envExists) {
          updatedEnvs = existingEnvs.map((e) =>
            e.environment === environment ? { ...e, isEnabled: newEnabled } : e
          );
        } else {
          // Add new environment entry
          updatedEnvs = [...existingEnvs, { environment, isEnabled: newEnabled }];
        }

        return {
          ...f,
          environments: updatedEnvs,
        };
      })
    );

    try {
      await featureFlagService.toggleFeatureFlag(flag.flagName, newEnabled, environment);
      enqueueSnackbar(
        t(currentEnabled ? "featureFlags.disableSuccess" : "featureFlags.enableSuccess"),
        { variant: "success" }
      );
    } catch (error: any) {
      // Rollback on error
      setFlags((prev) =>
        prev.map((f) => {
          if (f.flagName !== flag.flagName) return f;

          const existingEnvs = f.environments || [];
          const updatedEnvs = existingEnvs.map((e) =>
            e.environment === environment ? { ...e, isEnabled: currentEnabled } : e
          );

          return {
            ...f,
            environments: updatedEnvs,
          };
        })
      );
      enqueueSnackbar(parseApiErrorMessage(error, "featureFlags.toggleFailed"), {
        variant: "error",
      });
    }
  };

  // Get environment-specific enabled state
  const getEnvEnabled = (flag: FeatureFlag, envName: string): boolean => {
    if (flag.environments) {
      const envData = flag.environments.find((e) => e.environment === envName);
      return envData?.isEnabled ?? false;
    }
    // Fallback to legacy isEnabled
    return flag.isEnabled ?? false;
  };

  // Archive/Revive flag
  const handleArchiveToggle = async (flag: FeatureFlag) => {
    try {
      if (flag.isArchived) {
        await featureFlagService.reviveFeatureFlag(flag.flagName);
        enqueueSnackbar(t("featureFlags.reviveSuccess"), {
          variant: "success",
        });
      } else {
        await featureFlagService.archiveFeatureFlag(flag.flagName);
        enqueueSnackbar(t("featureFlags.archiveSuccess"), {
          variant: "success",
        });
      }
      loadFlags();
    } catch (error: any) {
      enqueueSnackbar(parseApiErrorMessage(error, "featureFlags.archiveFailed"), {
        variant: "error",
      });
    }
  };

  // Delete flag
  const handleDelete = (flag: FeatureFlag) => {
    setDeletingFlag(flag);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingFlag) return;
    try {
      await featureFlagService.deleteFeatureFlag(deletingFlag.flagName);
      enqueueSnackbar(t("featureFlags.deleteSuccess"), { variant: "success" });
      loadFlags();
    } catch (error: any) {
      enqueueSnackbar(parseApiErrorMessage(error, "featureFlags.deleteFailed"), {
        variant: "error",
      });
    } finally {
      setDeleteConfirmOpen(false);
      setDeletingFlag(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmOpen(false);
    setDeletingFlag(null);
  };

  // Action menu handlers
  const handleActionMenuOpen = (event: React.MouseEvent<HTMLElement>, flag: FeatureFlag) => {
    event.stopPropagation();
    setActionMenuAnchor(event.currentTarget);
    setActionMenuFlag(flag);
  };

  const handleActionMenuClose = () => {
    setActionMenuAnchor(null);
    setActionMenuFlag(null);
  };

  // Copy flag name to clipboard
  const handleCopyName = () => {
    if (actionMenuFlag) {
      copyToClipboardWithNotification(actionMenuFlag.flagName, t, enqueueSnackbar);
    }
    handleActionMenuClose();
  };

  // Clone flag - open clone dialog
  const handleClone = () => {
    if (actionMenuFlag) {
      setCloningFlag(actionMenuFlag);
      setCloneNewName("");
      setCloneDialogOpen(true);
    }
    handleActionMenuClose();
  };

  // Execute clone
  const handleCloneConfirm = async () => {
    if (!cloningFlag || !cloneNewName.trim()) return;

    setCloning(true);
    try {
      // Clone the flag via API
      await api.post("/admin/features/clone", {
        sourceFlagName: cloningFlag.flagName,
        newFlagName: cloneNewName.trim(),
      });
      enqueueSnackbar(t("featureFlags.cloneSuccess"), { variant: "success" });
      setCloneDialogOpen(false);
      setCloningFlag(null);
      setCloneNewName("");
      loadFlags();
    } catch (error: any) {
      enqueueSnackbar(parseApiErrorMessage(error, "featureFlags.cloneFailed"), {
        variant: "error",
      });
    } finally {
      setCloning(false);
    }
  };

  // Toggle stale status - show confirmation
  const handleStaleMenu = () => {
    if (actionMenuFlag) {
      setStaleConfirmOpen(true);
    }
    handleActionMenuClose();
  };

  // Stale confirmation handler
  const handleStaleConfirm = async () => {
    setStaleConfirmOpen(false);
    if (!actionMenuFlag) return;
    try {
      const newStale = !actionMenuFlag.stale;
      await api.put(`/admin/features/${actionMenuFlag.flagName}`, {
        stale: newStale,
      });
      enqueueSnackbar(
        newStale ? t("featureFlags.markStaleSuccess") : t("featureFlags.clearStaleSuccess"),
        { variant: "success" }
      );
      loadFlags();
    } catch (error: any) {
      enqueueSnackbar(parseApiErrorMessage(error, "featureFlags.updateFailed"), {
        variant: "error",
      });
    }
  };

  // Toggle favorite status
  const handleFavoriteToggle = async (flag: FeatureFlag) => {
    try {
      const newFavorite = !flag.isFavorite;
      await featureFlagService.toggleFavorite(flag.flagName, newFavorite);
      enqueueSnackbar(
        newFavorite
          ? t("featureFlags.addFavoriteSuccess")
          : t("featureFlags.removeFavoriteSuccess"),
        { variant: "success" }
      );
      loadFlags();
    } catch (error: any) {
      enqueueSnackbar(parseApiErrorMessage(error, "featureFlags.updateFailed"), {
        variant: "error",
      });
    }
  };

  // Archive from action menu - show confirmation
  const handleArchiveFromMenu = () => {
    if (actionMenuFlag) {
      setArchiveConfirmOpen(true);
    }
    handleActionMenuClose();
  };

  // Archive confirmation handler
  const handleArchiveConfirm = () => {
    setArchiveConfirmOpen(false);
    if (actionMenuFlag) {
      handleArchiveToggle(actionMenuFlag);
    }
  };

  // Delete from action menu
  const handleDeleteFromMenu = () => {
    if (actionMenuFlag) {
      handleDelete(actionMenuFlag);
    }
    handleActionMenuClose();
  };

  // Bulk action handlers
  const handleBulkArchive = async () => {
    const flagNames = Array.from(selectedFlags);
    const nonArchivedFlags = flags.filter((f) => flagNames.includes(f.flagName) && !f.isArchived);

    if (nonArchivedFlags.length === 0) {
      enqueueSnackbar(t("featureFlags.noFlagsToArchive"), {
        variant: "warning",
      });
      return;
    }

    try {
      for (const flag of nonArchivedFlags) {
        await featureFlagService.archiveFeatureFlag(flag.flagName);
      }
      enqueueSnackbar(
        t("featureFlags.bulkArchiveSuccess", {
          count: nonArchivedFlags.length,
        }),
        { variant: "success" }
      );
      setSelectedFlags(new Set());
      loadFlags();
    } catch (error: any) {
      enqueueSnackbar(parseApiErrorMessage(error, "featureFlags.bulkArchiveFailed"), {
        variant: "error",
      });
    }
  };

  const handleBulkRevive = async () => {
    const flagNames = Array.from(selectedFlags);
    const archivedFlags = flags.filter((f) => flagNames.includes(f.flagName) && f.isArchived);

    if (archivedFlags.length === 0) {
      enqueueSnackbar(t("featureFlags.noFlagsToRevive"), {
        variant: "warning",
      });
      return;
    }

    try {
      for (const flag of archivedFlags) {
        await featureFlagService.reviveFeatureFlag(flag.flagName);
      }
      enqueueSnackbar(t("featureFlags.bulkReviveSuccess", { count: archivedFlags.length }), {
        variant: "success",
      });
      setSelectedFlags(new Set());
      loadFlags();
    } catch (error: any) {
      enqueueSnackbar(parseApiErrorMessage(error, "featureFlags.bulkReviveFailed"), {
        variant: "error",
      });
    }
  };

  const handleBulkStale = async (markAsStale: boolean) => {
    const flagNames = Array.from(selectedFlags);
    const targetFlags = flags.filter(
      (f) => flagNames.includes(f.flagName) && !f.isArchived && f.stale !== markAsStale
    );

    if (targetFlags.length === 0) {
      enqueueSnackbar(t("featureFlags.noFlagsToUpdate"), {
        variant: "warning",
      });
      return;
    }

    try {
      for (const flag of targetFlags) {
        await api.put(`/admin/features/${flag.flagName}`, {
          stale: markAsStale,
        });
      }
      enqueueSnackbar(
        markAsStale
          ? t("featureFlags.bulkMarkStaleSuccess", {
            count: targetFlags.length,
          })
          : t("featureFlags.bulkClearStaleSuccess", {
            count: targetFlags.length,
          }),
        { variant: "success" }
      );
      setSelectedFlags(new Set());
      loadFlags();
    } catch (error: any) {
      enqueueSnackbar(parseApiErrorMessage(error, "featureFlags.bulkUpdateFailed"), {
        variant: "error",
      });
    }
  };

  const handleBulkEnable = async (environment: string, enable: boolean) => {
    const flagNames = Array.from(selectedFlags);
    const targetFlags = flags.filter((f) => flagNames.includes(f.flagName) && !f.isArchived);

    if (targetFlags.length === 0) {
      enqueueSnackbar(t("featureFlags.noFlagsToUpdate"), {
        variant: "warning",
      });
      return;
    }

    try {
      for (const flag of targetFlags) {
        await featureFlagService.toggleFeatureFlag(flag.flagName, enable, environment);
      }
      enqueueSnackbar(
        enable
          ? t("featureFlags.bulkEnableSuccess", {
            count: targetFlags.length,
            env: environment,
          })
          : t("featureFlags.bulkDisableSuccess", {
            count: targetFlags.length,
            env: environment,
          }),
        { variant: "success" }
      );
      setSelectedFlags(new Set());
      loadFlags();
    } catch (error: any) {
      enqueueSnackbar(parseApiErrorMessage(error, "featureFlags.bulkToggleFailed"), {
        variant: "error",
      });
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedFlags(new Set(flags.map((f) => f.flagName)));
    } else {
      setSelectedFlags(new Set());
    }
  };

  const handleSelectFlag = (flagName: string, checked: boolean) => {
    const newSelected = new Set(selectedFlags);
    if (checked) {
      newSelected.add(flagName);
    } else {
      newSelected.delete(flagName);
    }
    setSelectedFlags(newSelected);
  };

  // Create flag handler
  const handleCreateFlag = async () => {
    if (!newFlag.flagName.trim()) {
      enqueueSnackbar(t("featureFlags.flagNameRequired"), {
        variant: "warning",
      });
      return;
    }

    setCreating(true);
    try {
      // Create flag with empty strategies - user can add strategies manually
      await api.post("/admin/features", {
        flagName: newFlag.flagName.trim(),
        displayName: newFlag.displayName.trim() || undefined,
        description: newFlag.description.trim(),
        flagType: newFlag.flagType,
        tags: newFlag.tags,
        impressionDataEnabled: newFlag.impressionDataEnabled,
        variantType: newFlag.variantType,
        baselinePayload: newFlag.baselinePayload,
        strategies: [],
      });

      enqueueSnackbar(t("featureFlags.createSuccess"), { variant: "success" });
      setCreateDialogOpen(false);
      setNewFlag({
        flagName: "",
        displayName: "",
        description: "",
        flagType: "release",
        tags: [],
        impressionDataEnabled: false,
        variantType: "string",
        baselinePayload: "",
      });
      setNewFlagBaselinePayloadJsonError(null);
      loadFlags();
    } catch (error: any) {
      enqueueSnackbar(parseApiErrorMessage(error, "featureFlags.createFailed"), {
        variant: "error",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleOpenCreateDialog = () => {
    // Generate default flag name with timestamp
    const timestamp = Date.now().toString(36).slice(-4);
    setNewFlag({
      flagName: `new-feature-${timestamp}`,
      displayName: "",
      description: "",
      flagType: "release",
      tags: [],
      impressionDataEnabled: false,
      variantType: "string",
      baselinePayload: "",
    });
    setNewFlagBaselinePayloadJsonError(null);
    setCreateDialogOpen(true);
  };

  // Flag type chip color
  const getTypeColor = (
    type: FlagType
  ): "default" | "primary" | "secondary" | "warning" | "error" => {
    switch (type) {
      case "release":
        return "primary";
      case "experiment":
        return "secondary";
      case "operational":
        return "warning";
      case "killSwitch":
        return "error";
      case "permission":
        return "default";
      default:
        return "default";
    }
  };

  // Get icon for flag type
  const getTypeIcon = (type: FlagType) => {
    const iconProps = { sx: { fontSize: 18 } };
    switch (type) {
      case "release":
        return <ReleaseIcon {...iconProps} color="primary" />;
      case "experiment":
        return <ExperimentIcon {...iconProps} color="secondary" />;
      case "operational":
        return <OperationalIcon {...iconProps} color="warning" />;
      case "killSwitch":
        return <KillSwitchIcon {...iconProps} color="error" />;
      case "permission":
        return <PermissionIcon {...iconProps} color="action" />;
      default:
        return <FlagIcon {...iconProps} />;
    }
  };

  // Get flag status for display
  const getFlagStatus = (
    flag: FeatureFlag
  ): {
    status: string;
    color: "default" | "primary" | "warning" | "error" | "success";
  } => {
    if (flag.isArchived) {
      return { status: "archived", color: "default" };
    }
    if (flag.stale) {
      return { status: "stale", color: "error" };
    }
    // Check potentially stale based on lastSeenAt and flag type lifetime
    const flagTypeInfo = flagTypes.find((ft) => ft.flagType === flag.flagType);
    if (flagTypeInfo?.lifetimeDays && flag.lastSeenAt) {
      const lastSeen = new Date(flag.lastSeenAt);
      const now = new Date();
      const daysSinceLastSeen = (now.getTime() - lastSeen.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceLastSeen > flagTypeInfo.lifetimeDays) {
        return { status: "potentiallyStale", color: "warning" };
      }
    }
    return { status: "active", color: "success" };
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          mb: 3,
        }}
      >
        <Box>
          <Typography
            variant="h4"
            gutterBottom
            sx={{ display: "flex", alignItems: "center", gap: 1 }}
          >
            <FlagIcon />
            {t("featureFlags.title")}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t("featureFlags.subtitle")}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          {canManage && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenCreateDialog}>
              {t("featureFlags.createFlag")}
            </Button>
          )}
          <Divider orientation="vertical" sx={{ height: 32, mx: 0.5 }} />
          <Tooltip title={t("featureFlags.export")}>
            <IconButton onClick={(e) => setExportMenuAnchor(e.currentTarget)}>
              <ExportIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title={t("featureFlags.import")}>
            <IconButton onClick={() => setImportDialogOpen(true)} disabled={!canManage}>
              <ImportIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Search and Filters */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              flexWrap: "nowrap",
              justifyContent: "space-between",
            }}
          >
            <Box
              sx={{
                display: "flex",
                gap: 2,
                alignItems: "center",
                flexWrap: "nowrap",
                flexGrow: 1,
                minWidth: 0,
              }}
            >
              <TextField
                placeholder={t("featureFlags.searchPlaceholder")}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(0);
                }}
                sx={{
                  minWidth: 300,
                  flexGrow: 1,
                  maxWidth: 500,
                  "& .MuiOutlinedInput-root": {
                    height: "40px",
                    borderRadius: "20px",
                    bgcolor: "background.paper",
                    transition: "all 0.2s ease-in-out",
                    "& fieldset": { borderColor: "divider" },
                    "&:hover": {
                      bgcolor: "action.hover",
                      "& fieldset": { borderColor: "primary.light" },
                    },
                    "&.Mui-focused": {
                      bgcolor: "background.paper",
                      boxShadow: "0 0 0 2px rgba(25, 118, 210, 0.1)",
                      "& fieldset": {
                        borderColor: "primary.main",
                        borderWidth: "1px",
                      },
                    },
                  },
                  "& .MuiInputBase-input": { fontSize: "0.875rem" },
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: "text.secondary", fontSize: 20 }} />
                    </InputAdornment>
                  ),
                }}
                size="small"
              />

              {/* Dynamic Filter Bar */}
              <DynamicFilterBar
                availableFilters={availableFilterDefinitions}
                activeFilters={activeFilters}
                onFilterAdd={handleFilterAdd}
                onFilterRemove={handleFilterRemove}
                onFilterChange={handleFilterChange}
                onOperatorChange={handleOperatorChange}
                onRefresh={loadFlags}
                refreshDisabled={loading}
                noWrap={true}
                afterFilterAddActions={
                  <Tooltip title={t("common.columnSettings")}>
                    <IconButton
                      onClick={(e) => setColumnSettingsAnchor(e.currentTarget)}
                      sx={{
                        bgcolor: "background.paper",
                        border: 1,
                        borderColor: "divider",
                        "&:hover": { bgcolor: "action.hover" },
                      }}
                    >
                      <ViewColumnIcon />
                    </IconButton>
                  </Tooltip>
                }
              />
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
          {loading && isInitialLoad ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
              <Typography color="text.secondary">{t("common.loadingData")}</Typography>
            </Box>
          ) : flags.length === 0 ? (
            <EmptyState
              message={t("featureFlags.noFlagsFound")}
              onAddClick={canManage ? () => navigate("/feature-flags/new") : undefined}
              addButtonLabel={t("featureFlags.createFlag")}
              subtitle={canManage ? t("common.addFirstItem") : undefined}
            />
          ) : (
            <>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox" sx={{ width: 48 }}>
                        <Checkbox
                          indeterminate={
                            selectedFlags.size > 0 && selectedFlags.size < flags.length
                          }
                          checked={flags.length > 0 && selectedFlags.size === flags.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedFlags(new Set(flags.map((f) => f.flagName)));
                            } else {
                              setSelectedFlags(new Set());
                            }
                          }}
                          size="small"
                        />
                      </TableCell>

                      {/* Dynamic columns based on visibleColumns order */}
                      {visibleColumns.map((col) => {
                        switch (col.id) {
                          case "flagName":
                            return (
                              <TableCell key={col.id}>
                                <TableSortLabel
                                  active={orderBy === "flagName"}
                                  direction={orderBy === "flagName" ? order : "asc"}
                                  onClick={() => handleSort("flagName")}
                                >
                                  {t("featureFlags.flagName")}
                                </TableSortLabel>
                              </TableCell>
                            );
                          case "status":
                            // Status column followed by environment columns
                            return (
                              <React.Fragment key={col.id}>
                                <TableCell>{t("featureFlags.status")}</TableCell>
                                {/* Environment columns - right after status */}
                                {environments.map((env) => (
                                  <TableCell
                                    key={env.environment}
                                    align="center"
                                    sx={{
                                      minWidth: 70,
                                      maxWidth: 100,
                                      px: 0.5,
                                    }}
                                  >
                                    <Tooltip title={`${env.displayName} (${env.environment})`}>
                                      <Chip
                                        label={env.displayName}
                                        size="small"
                                        sx={{
                                          bgcolor: env.color || "#888",
                                          color: getContrastColor(env.color || "#888"),
                                          fontSize: "0.7rem",
                                          height: 20,
                                          maxWidth: 90,
                                          "& .MuiChip-label": {
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                          },
                                        }}
                                      />
                                    </Tooltip>
                                  </TableCell>
                                ))}
                              </React.Fragment>
                            );
                          case "createdBy":
                            return <TableCell key={col.id}>{t("common.createdBy")}</TableCell>;
                          case "createdAt":
                            return (
                              <TableCell key={col.id}>
                                <TableSortLabel
                                  active={orderBy === "createdAt"}
                                  direction={orderBy === "createdAt" ? order : "asc"}
                                  onClick={() => handleSort("createdAt")}
                                >
                                  {t("featureFlags.createdAt")}
                                </TableSortLabel>
                              </TableCell>
                            );
                          case "lastSeenAt":
                            return (
                              <TableCell key={col.id}>{t("featureFlags.lastSeenAt")}</TableCell>
                            );
                          case "tags":
                            return <TableCell key={col.id}>{t("featureFlags.tags")}</TableCell>;
                          default:
                            return null;
                        }
                      })}
                      {canManage && <TableCell align="center">{t("common.actions")}</TableCell>}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {flags.map((flag) => (
                      <TableRow
                        key={flag.id}
                        hover
                        selected={selectedFlags.has(flag.flagName)}
                        sx={{
                          ...(flag.isArchived ? { opacity: 0.6 } : {}),
                        }}
                      >
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={selectedFlags.has(flag.flagName)}
                            onChange={(e) => {
                              const newSelected = new Set(selectedFlags);
                              if (e.target.checked) {
                                newSelected.add(flag.flagName);
                              } else {
                                newSelected.delete(flag.flagName);
                              }
                              setSelectedFlags(newSelected);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            size="small"
                          />
                        </TableCell>

                        {/* Dynamic columns based on visibleColumns order */}
                        {visibleColumns.map((col) => {
                          switch (col.id) {
                            case "flagName":
                              return (
                                <TableCell key={col.id}>
                                  <Box>
                                    <Box
                                      sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 0.5,
                                      }}
                                    >
                                      <Tooltip title={t(`featureFlags.types.${flag.flagType}`)}>
                                        {getTypeIcon(flag.flagType)}
                                      </Tooltip>
                                      {isStale(flag) && (
                                        <Tooltip title={t("featureFlags.staleWarning")}>
                                          <WarningIcon
                                            sx={{
                                              fontSize: 16,
                                              color: "warning.main",
                                            }}
                                          />
                                        </Tooltip>
                                      )}
                                      <Typography
                                        fontWeight={500}
                                        sx={{
                                          cursor: "pointer",
                                          "&:hover": {
                                            textDecoration: "underline",
                                          },
                                        }}
                                        onClick={() => navigate(`/feature-flags/${flag.flagName}`)}
                                      >
                                        {flag.flagName}
                                      </Typography>
                                      <Tooltip title={t("common.copy")}>
                                        <IconButton
                                          size="small"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            copyToClipboardWithNotification(
                                              flag.flagName,
                                              enqueueSnackbar,
                                              t
                                            );
                                          }}
                                          sx={{
                                            opacity: 0.5,
                                            "&:hover": { opacity: 1 },
                                          }}
                                        >
                                          <CopyIcon sx={{ fontSize: 14 }} />
                                        </IconButton>
                                      </Tooltip>
                                      <IconButton
                                        size="small"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleFavoriteToggle(flag);
                                        }}
                                        sx={{
                                          color: flag.isFavorite
                                            ? "warning.main"
                                            : "action.disabled",
                                          opacity: flag.isFavorite ? 1 : 0.5,
                                          "&:hover": { opacity: 1 },
                                        }}
                                      >
                                        {flag.isFavorite ? (
                                          <StarIcon sx={{ fontSize: 16 }} />
                                        ) : (
                                          <StarBorderIcon sx={{ fontSize: 16 }} />
                                        )}
                                      </IconButton>
                                    </Box>
                                    {flag.displayName && flag.displayName !== flag.flagName && (
                                      <Typography
                                        variant="body2"
                                        color="text.secondary"
                                        sx={{ fontSize: "0.8rem" }}
                                      >
                                        {flag.displayName}
                                      </Typography>
                                    )}
                                  </Box>
                                </TableCell>
                              );
                            case "status":
                              // Status column followed by environment columns
                              return (
                                <React.Fragment key={col.id}>
                                  <TableCell>
                                    {(() => {
                                      const { status, color } = getFlagStatus(flag);
                                      return (
                                        <Chip
                                          label={t(
                                            `featureFlags.status${status.charAt(0).toUpperCase() + status.slice(1)}`
                                          )}
                                          size="small"
                                          color={color}
                                          variant={status === "active" ? "outlined" : "filled"}
                                          sx={{
                                            height: 20,
                                            fontSize: "0.75rem",
                                          }}
                                        />
                                      );
                                    })()}
                                  </TableCell>
                                  {/* Environment columns - right after status */}
                                  {environments.map((env) => {
                                    const isEnabled = getEnvEnabled(flag, env.environment);
                                    const tooltipText = `${t("featureFlags.toggleTooltip", { env: env.displayName })}\n${isEnabled ? t("featureFlags.toggleTooltipEnabled") : t("featureFlags.toggleTooltipDisabled")}`;
                                    return (
                                      <TableCell key={env.environment} align="center">
                                        <Box
                                          sx={{
                                            display: "flex",
                                            justifyContent: "center",
                                          }}
                                        >
                                          <Tooltip
                                            title={
                                              <span
                                                style={{
                                                  whiteSpace: "pre-line",
                                                }}
                                              >
                                                {tooltipText}
                                              </span>
                                            }
                                            arrow
                                            placement="top"
                                          >
                                            <span>
                                              <FeatureSwitch
                                                key={`${flag.flagName}-${env.environment}-${isEnabled}`}
                                                size="small"
                                                checked={isEnabled}
                                                onChange={() =>
                                                  handleToggle(flag, env.environment, isEnabled)
                                                }
                                                disabled={flag.isArchived || !canManage}
                                                onClick={(e) => e.stopPropagation()}
                                                color={env.color}
                                              />
                                            </span>
                                          </Tooltip>
                                        </Box>
                                      </TableCell>
                                    );
                                  })}
                                </React.Fragment>
                              );
                            case "createdBy":
                              return (
                                <TableCell key={col.id}>
                                  <Box>
                                    <Typography variant="body2" fontWeight={500}>
                                      {flag.createdByName || "-"}
                                    </Typography>
                                    {flag.createdByEmail && (
                                      <Typography
                                        variant="body2"
                                        color="text.secondary"
                                        sx={{ fontSize: "0.8rem" }}
                                      >
                                        {flag.createdByEmail}
                                      </Typography>
                                    )}
                                  </Box>
                                </TableCell>
                              );
                            case "createdAt":
                              return (
                                <TableCell key={col.id}>
                                  <Tooltip title={formatDateTimeDetailed(flag.createdAt)}>
                                    <span>{formatRelativeTime(flag.createdAt)}</span>
                                  </Tooltip>
                                </TableCell>
                              );
                            case "lastSeenAt":
                              return (
                                <TableCell key={col.id}>
                                  {flag.lastSeenAt ? (
                                    <Tooltip title={formatDateTimeDetailed(flag.lastSeenAt)}>
                                      <span>{formatRelativeTime(flag.lastSeenAt)}</span>
                                    </Tooltip>
                                  ) : (
                                    <Typography variant="body2" color="text.secondary">
                                      -
                                    </Typography>
                                  )}
                                </TableCell>
                              );
                            case "variantType":
                              return (
                                <TableCell key={col.id}>
                                  <Chip
                                    label={t(`featureFlags.variantTypes.${flag.variantType || "string"}`)}
                                    size="small"
                                    variant="outlined"
                                    color={
                                      flag.variantType === "json"
                                        ? "secondary"
                                        : flag.variantType === "number"
                                          ? "info"
                                          : "default"
                                    }
                                  />
                                </TableCell>
                              );
                            case "tags":
                              return (
                                <TableCell key={col.id}>
                                  <Box
                                    sx={{
                                      display: "flex",
                                      flexWrap: "wrap",
                                      gap: 0.5,
                                    }}
                                  >
                                    {flag.tags?.slice(0, 3).map((tagName) => {
                                      const tagData = allTags.find((t) => t.name === tagName);
                                      const color = tagData?.color || "#888888";
                                      return (
                                        <Tooltip
                                          key={tagName}
                                          title={tagData?.description || ""}
                                          arrow
                                        >
                                          <Chip
                                            label={tagName}
                                            size="small"
                                            sx={{
                                              height: 20,
                                              bgcolor: color,
                                              color: getContrastColor(color),
                                            }}
                                          />
                                        </Tooltip>
                                      );
                                    })}
                                    {flag.tags && flag.tags.length > 3 && (
                                      <Chip
                                        label={`+${flag.tags.length - 3}`}
                                        size="small"
                                        sx={{ height: 20 }}
                                      />
                                    )}
                                  </Box>
                                </TableCell>
                              );
                            default:
                              return null;
                          }
                        })}
                        {canManage && (
                          <TableCell align="center">
                            <IconButton size="small" onClick={(e) => handleActionMenuOpen(e, flag)}>
                              <MoreVertIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <SimplePagination
                page={page}
                rowsPerPage={rowsPerPage}
                count={total}
                onPageChange={(event, newPage) => setPage(newPage)}
                onRowsPerPageChange={(event) => {
                  setRowsPerPage(Number(event.target.value));
                  setPage(0);
                }}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Bulk Action Bar */}
      {selectedFlags.size > 0 && canManage && (
        <ClickAwayListener onClickAway={() => setSelectedFlags(new Set())}>
          <Paper
            elevation={8}
            sx={{
              position: "fixed",
              bottom: 24,
              left: "50%",
              transform: "translateX(-50%)",
              px: 3,
              py: 1.5,
              borderRadius: 3,
              display: "flex",
              alignItems: "center",
              gap: 2,
              zIndex: 1000,
              bgcolor: "background.paper",
            }}
          >
            <Chip
              label={`${selectedFlags.size} ${t("common.selected")}`}
              color="primary"
              size="small"
            />
            <Divider orientation="vertical" flexItem />

            {/* Environment Enable/Disable Dropdown */}
            <Box>
              <Button
                size="small"
                variant="outlined"
                onClick={(e) => setEnvMenuAnchor(e.currentTarget)}
              >
                {t("common.enable")} / {t("common.disable")}
              </Button>
              <Menu
                anchorEl={envMenuAnchor}
                open={Boolean(envMenuAnchor)}
                onClose={() => setEnvMenuAnchor(null)}
              >
                {environments.map((env) => (
                  <Box key={env.environment}>
                    <MenuItem
                      onClick={() => {
                        handleBulkEnable(env.environment, true);
                        setEnvMenuAnchor(null);
                      }}
                    >
                      <ListItemIcon>
                        <CheckCircleIcon fontSize="small" color="success" />
                      </ListItemIcon>
                      <ListItemText>
                        {t("common.enable")} - {env.displayName}
                      </ListItemText>
                    </MenuItem>
                    <MenuItem
                      onClick={() => {
                        handleBulkEnable(env.environment, false);
                        setEnvMenuAnchor(null);
                      }}
                    >
                      <ListItemIcon>
                        <CancelIcon fontSize="small" color="error" />
                      </ListItemIcon>
                      <ListItemText>
                        {t("common.disable")} - {env.displayName}
                      </ListItemText>
                    </MenuItem>
                  </Box>
                ))}
              </Menu>
            </Box>

            <Button
              size="small"
              variant="outlined"
              startIcon={<ArchiveIcon />}
              onClick={handleBulkArchive}
            >
              {t("featureFlags.archive")}
            </Button>

            <Button
              size="small"
              variant="outlined"
              startIcon={<UnarchiveIcon />}
              onClick={handleBulkRevive}
            >
              {t("featureFlags.revive")}
            </Button>

            {/* Stale Actions Dropdown */}
            <Box>
              <Button
                size="small"
                variant="outlined"
                onClick={(e) => setStaleMenuAnchor(e.currentTarget)}
                startIcon={<StaleIcon />}
              >
                Stale
              </Button>
              <Menu
                anchorEl={staleMenuAnchor}
                open={Boolean(staleMenuAnchor)}
                onClose={() => setStaleMenuAnchor(null)}
              >
                <MenuItem
                  onClick={() => {
                    handleBulkStale(true);
                    setStaleMenuAnchor(null);
                  }}
                >
                  <ListItemIcon>
                    <StaleIcon fontSize="small" color="warning" />
                  </ListItemIcon>
                  <ListItemText>{t("featureFlags.markStale")}</ListItemText>
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    handleBulkStale(false);
                    setStaleMenuAnchor(null);
                  }}
                >
                  <ListItemIcon>
                    <CheckCircleIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>{t("featureFlags.clearStale")}</ListItemText>
                </MenuItem>
              </Menu>
            </Box>

            <Divider orientation="vertical" flexItem />

            <IconButton size="small" onClick={() => setSelectedFlags(new Set())}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Paper>
        </ClickAwayListener>
      )}
      {/* Action Menu */}
      <Menu
        anchorEl={actionMenuAnchor}
        open={Boolean(actionMenuAnchor)}
        onClose={handleActionMenuClose}
        onClick={(e) => e.stopPropagation()}
      >
        <MenuItem onClick={handleCopyName}>
          <ListItemIcon>
            <CopyIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t("featureFlags.copyName")}</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (actionMenuFlag) {
              navigate(`/feature-flags/${actionMenuFlag.flagName}`);
            }
            handleActionMenuClose();
          }}
        >
          <ListItemIcon>
            <OpenInNewIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t("featureFlags.goToOverview")}</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (actionMenuFlag) {
              navigate(`/feature-flags/${actionMenuFlag.flagName}?tab=metrics`);
            }
            handleActionMenuClose();
          }}
        >
          <ListItemIcon>
            <MetricsIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t("featureFlags.goToMetrics")}</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleClone} disabled={!actionMenuFlag || actionMenuFlag.isArchived}>
          <ListItemIcon>
            <CloneIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t("featureFlags.clone")}</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={handleStaleMenu}
          disabled={!actionMenuFlag || actionMenuFlag.isArchived}
        >
          <ListItemIcon>
            <StaleIcon fontSize="small" color={actionMenuFlag?.stale ? "warning" : "inherit"} />
          </ListItemIcon>
          <ListItemText>
            {actionMenuFlag?.stale ? t("featureFlags.clearStale") : t("featureFlags.markStale")}
          </ListItemText>
        </MenuItem>
        <MenuItem onClick={handleArchiveFromMenu} disabled={!actionMenuFlag}>
          <ListItemIcon>
            {actionMenuFlag?.isArchived ? (
              <UnarchiveIcon fontSize="small" />
            ) : (
              <ArchiveIcon fontSize="small" />
            )}
          </ListItemIcon>
          <ListItemText>
            {actionMenuFlag?.isArchived ? t("featureFlags.revive") : t("featureFlags.archive")}
          </ListItemText>
        </MenuItem>
        {actionMenuFlag?.isArchived && (
          <>
            <Divider />
            <MenuItem onClick={handleDeleteFromMenu} sx={{ color: "error.main" }}>
              <ListItemIcon>
                <DeleteIcon fontSize="small" color="error" />
              </ListItemIcon>
              <ListItemText>{t("common.delete")}</ListItemText>
            </MenuItem>
          </>
        )}
      </Menu>

      {/* Delete Confirmation Dialog */}
      <ConfirmDeleteDialog
        open={deleteConfirmOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title={t("featureFlags.deleteConfirmTitle")}
        message={t("featureFlags.deleteConfirmMessage", {
          name: deletingFlag?.flagName || "",
        })}
      />

      {/* Archive Confirmation Dialog */}
      <Dialog
        open={archiveConfirmOpen}
        onClose={() => setArchiveConfirmOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          {actionMenuFlag?.isArchived
            ? t("featureFlags.reviveConfirmTitle")
            : t("featureFlags.archiveConfirmTitle")}
        </DialogTitle>
        <DialogContent>
          <Typography>
            {actionMenuFlag?.isArchived
              ? t("featureFlags.reviveConfirmMessage", { name: actionMenuFlag?.flagName })
              : t("featureFlags.archiveConfirmMessage", { name: actionMenuFlag?.flagName })}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setArchiveConfirmOpen(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="contained"
            color={actionMenuFlag?.isArchived ? "success" : "warning"}
            onClick={handleArchiveConfirm}
          >
            {actionMenuFlag?.isArchived ? t("featureFlags.revive") : t("featureFlags.archive")}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Stale Confirmation Dialog */}
      <Dialog
        open={staleConfirmOpen}
        onClose={() => setStaleConfirmOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          {actionMenuFlag?.stale
            ? t("featureFlags.unmarkStaleConfirmTitle")
            : t("featureFlags.markStaleConfirmTitle")}
        </DialogTitle>
        <DialogContent>
          <Typography>
            {actionMenuFlag?.stale
              ? t("featureFlags.unmarkStaleConfirmMessage", { name: actionMenuFlag?.flagName })
              : t("featureFlags.markStaleConfirmMessage", { name: actionMenuFlag?.flagName })}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStaleConfirmOpen(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="contained"
            color={actionMenuFlag?.stale ? "info" : "secondary"}
            onClick={handleStaleConfirm}
          >
            {actionMenuFlag?.stale ? t("featureFlags.unmarkStale") : t("featureFlags.markStale")}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Clone Dialog */}
      <Dialog
        open={cloneDialogOpen}
        onClose={() => setCloneDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{t("featureFlags.cloneFlag")}</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t("featureFlags.cloneFlagDescription", {
                name: cloningFlag?.flagName || "",
              })}
            </Typography>
            <TextField
              fullWidth
              required
              autoFocus
              label={t("featureFlags.newFlagName")}
              value={cloneNewName}
              onChange={(e) => setCloneNewName(e.target.value.replace(/[^a-zA-Z0-9_.-]/g, ""))}
              placeholder="new-flag-name"
              helperText={t("featureFlags.flagNameHelp")}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCloneDialogOpen(false)}>{t("common.cancel")}</Button>
          <Button
            variant="contained"
            onClick={handleCloneConfirm}
            disabled={cloning || !cloneNewName.trim()}
          >
            {cloning ? <CircularProgress size={20} /> : t("featureFlags.clone")}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Feature Flag Drawer */}
      <ResizableDrawer
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        title={t("featureFlags.createFlag")}
        subtitle={t("featureFlags.createFlagSubtitle")}
        storageKey="featureFlagCreateDrawerWidth"
        defaultWidth={500}
      >
        <Box sx={{ p: 3, flex: 1, overflow: "auto" }}>
          <Stack spacing={3}>
            {/* Flag Name */}
            <Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 1 }}>
                <Typography variant="subtitle2">
                  {t("featureFlags.flagName")} <Box component="span" sx={{ color: "error.main" }}>*</Box>
                </Typography>
                <NamingGuide type="flag" />
              </Box>
              <TextField
                fullWidth
                size="small"
                value={newFlag.flagName}
                onChange={(e) =>
                  setNewFlag({
                    ...newFlag,
                    flagName: e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""),
                  })
                }
                helperText={t("featureFlags.flagNameHelp")}
                inputProps={{ maxLength: 100 }}
              />
            </Box>

            {/* Display Name */}
            <TextField
              fullWidth
              label={t("featureFlags.displayName")}
              value={newFlag.displayName || ""}
              onChange={(e) => setNewFlag({ ...newFlag, displayName: e.target.value })}
              helperText={t("featureFlags.displayNameHelp")}
            />

            {/* Description */}
            <TextField
              fullWidth
              multiline
              rows={3}
              label={t("featureFlags.description")}
              value={newFlag.description}
              onChange={(e) => setNewFlag({ ...newFlag, description: e.target.value })}
              helperText={t("featureFlags.descriptionHelp")}
            />

            {/* Flag Type */}
            <FormControl fullWidth>
              <InputLabel>{t("featureFlags.flagType")}</InputLabel>
              <Select
                value={newFlag.flagType}
                label={t("featureFlags.flagType")}
                onChange={(e) =>
                  setNewFlag({
                    ...newFlag,
                    flagType: e.target.value as FlagType,
                  })
                }
              >
                <MenuItem value="release">
                  <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
                    <Box sx={{ mt: 0.3 }}>
                      <ReleaseIcon sx={{ fontSize: 18 }} color="primary" />
                    </Box>
                    <Box>
                      <Typography variant="body2" fontWeight={500}>
                        {t("featureFlags.types.release")}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: "block" }}
                      >
                        {t("featureFlags.flagTypes.release.desc")}
                      </Typography>
                    </Box>
                  </Box>
                </MenuItem>
                <MenuItem value="experiment">
                  <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
                    <Box sx={{ mt: 0.3 }}>
                      <ExperimentIcon sx={{ fontSize: 18 }} color="secondary" />
                    </Box>
                    <Box>
                      <Typography variant="body2" fontWeight={500}>
                        {t("featureFlags.types.experiment")}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: "block" }}
                      >
                        {t("featureFlags.flagTypes.experiment.desc")}
                      </Typography>
                    </Box>
                  </Box>
                </MenuItem>
                <MenuItem value="operational">
                  <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
                    <Box sx={{ mt: 0.3 }}>
                      <OperationalIcon sx={{ fontSize: 18 }} color="warning" />
                    </Box>
                    <Box>
                      <Typography variant="body2" fontWeight={500}>
                        {t("featureFlags.types.operational")}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: "block" }}
                      >
                        {t("featureFlags.flagTypes.operational.desc")}
                      </Typography>
                    </Box>
                  </Box>
                </MenuItem>
                <MenuItem value="killSwitch">
                  <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
                    <Box sx={{ mt: 0.3 }}>
                      <KillSwitchIcon sx={{ fontSize: 18 }} color="error" />
                    </Box>
                    <Box>
                      <Typography variant="body2" fontWeight={500}>
                        {t("featureFlags.types.killSwitch")}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: "block" }}
                      >
                        {t("featureFlags.flagTypes.killSwitch.desc")}
                      </Typography>
                    </Box>
                  </Box>
                </MenuItem>
                <MenuItem value="permission">
                  <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
                    <Box sx={{ mt: 0.3 }}>
                      <PermissionIcon sx={{ fontSize: 18 }} color="action" />
                    </Box>
                    <Box>
                      <Typography variant="body2" fontWeight={500}>
                        {t("featureFlags.types.permission")}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: "block" }}
                      >
                        {t("featureFlags.flagTypes.permission.desc")}
                      </Typography>
                    </Box>
                  </Box>
                </MenuItem>
              </Select>
            </FormControl>

            {/* Impression Data */}
            <Box>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Typography variant="body2">{t("featureFlags.impressionData")}</Typography>
                <Switch
                  checked={newFlag.impressionDataEnabled}
                  onChange={(e) =>
                    setNewFlag({
                      ...newFlag,
                      impressionDataEnabled: e.target.checked,
                    })
                  }
                />
              </Box>
              <Typography variant="caption" color="text.secondary">
                {t("featureFlags.impressionDataHelp")}
              </Typography>
            </Box>

            {/* Variant Type */}
            <Box>
              <Typography
                variant="subtitle2"
                sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 1 }}
              >
                {t("featureFlags.variantType")}
                <Tooltip title={t("featureFlags.variantTypeHelp")}>
                  <HelpOutlineIcon fontSize="small" color="action" />
                </Tooltip>
              </Typography>
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <Select
                  value={newFlag.variantType}
                  onChange={(e) => {
                    const newType = e.target.value as "string" | "json" | "number";
                    setNewFlag((prev) => ({
                      ...prev,
                      variantType: newType,
                      baselinePayload: newType === "number" ? 0 : newType === "json" ? "{}" : "",
                    }));
                    if (newType !== "json") {
                      setNewFlagBaselinePayloadJsonError(null);
                    }
                  }}
                >
                  <MenuItem value="string">
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <TextFieldsIcon sx={{ fontSize: 16, color: "info.main" }} />
                      {t("featureFlags.variantTypes.string")}
                    </Box>
                  </MenuItem>
                  <MenuItem value="number">
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <NumbersIcon sx={{ fontSize: 16, color: "success.main" }} />
                      {t("featureFlags.variantTypes.number")}
                    </Box>
                  </MenuItem>
                  <MenuItem value="json">
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <DataObjectIcon sx={{ fontSize: 16, color: "warning.main" }} />
                      {t("featureFlags.variantTypes.json")}
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>
            </Box>

            {/* Baseline Payload */}
            <Box>
              <Typography
                variant="subtitle2"
                sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 1 }}
              >
                {t("featureFlags.baselinePayload")}
                <Tooltip title={t("featureFlags.baselinePayloadHelp")}>
                  <HelpOutlineIcon fontSize="small" color="action" />
                </Tooltip>
              </Typography>
              {newFlag.variantType === "json" ? (
                <>
                  <JsonEditor
                    value={typeof newFlag.baselinePayload === "object"
                      ? JSON.stringify(newFlag.baselinePayload, null, 2)
                      : String(newFlag.baselinePayload || "{}")
                    }
                    onChange={(value) => {
                      let parsedValue: any = value;
                      try {
                        parsedValue = JSON.parse(value);
                        setNewFlagBaselinePayloadJsonError(null);
                      } catch (e: any) {
                        setNewFlagBaselinePayloadJsonError(e.message || "Invalid JSON");
                      }
                      setNewFlag((prev) => ({ ...prev, baselinePayload: parsedValue }));
                    }}
                    onValidation={(isValid, error) => {
                      setNewFlagBaselinePayloadJsonError(isValid ? null : (error || "Invalid JSON"));
                    }}
                    height={200}
                  />
                  {newFlagBaselinePayloadJsonError && (
                    <Typography variant="caption" color="error" sx={{ mt: 0.5, display: "block" }}>
                      {t("featureFlags.jsonError")}
                    </Typography>
                  )}
                  {!newFlagBaselinePayloadJsonError && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                      {t("featureFlags.payloadSize")}: {new TextEncoder().encode(
                        typeof newFlag.baselinePayload === "object"
                          ? JSON.stringify(newFlag.baselinePayload)
                          : String(newFlag.baselinePayload || "")
                      ).length} bytes
                    </Typography>
                  )}
                </>
              ) : newFlag.variantType === "number" ? (
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  placeholder="0"
                  value={newFlag.baselinePayload ?? ""}
                  onChange={(e) => {
                    const numValue = e.target.value === "" ? undefined : Number(e.target.value);
                    setNewFlag((prev) => ({ ...prev, baselinePayload: numValue ?? 0 }));
                  }}
                />
              ) : (
                <>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder={t("featureFlags.baselinePayloadPlaceholder")}
                    value={newFlag.baselinePayload ?? ""}
                    onChange={(e) => {
                      setNewFlag((prev) => ({ ...prev, baselinePayload: e.target.value }));
                    }}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                    {t("featureFlags.payloadSize")}: {new TextEncoder().encode(String(newFlag.baselinePayload || "")).length} bytes
                  </Typography>
                </>
              )}
            </Box>

            {/* Tags */}
            <Autocomplete
              multiple
              size="small"
              options={allTags.map((tag) => tag.name)}
              value={newFlag.tags}
              onChange={(_, newValue) => setNewFlag({ ...newFlag, tags: newValue })}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={t("featureFlags.tags")}
                  placeholder={t("featureFlags.selectTags")}
                  helperText={t("featureFlags.tagsHelp")}
                />
              )}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => {
                  const tag = allTags.find((t) => t.name === option);
                  return (
                    <Chip
                      {...getTagProps({ index })}
                      key={option}
                      label={option}
                      size="small"
                      sx={{
                        bgcolor: tag?.color || "#888",
                        color: getContrastColor(tag?.color || "#888"),
                      }}
                    />
                  );
                })
              }
            />
          </Stack>
        </Box>

        {/* Footer Actions */}
        <Box
          sx={{
            p: 2,
            borderTop: 1,
            borderColor: "divider",
            display: "flex",
            justifyContent: "flex-end",
            gap: 1,
          }}
        >
          <Button onClick={() => setCreateDialogOpen(false)} disabled={creating}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateFlag}
            disabled={creating || !newFlag.flagName.trim() || (newFlag.variantType === "json" && newFlagBaselinePayloadJsonError !== null)}
            startIcon={creating ? <CircularProgress size={20} /> : undefined}
          >
            {t("featureFlags.createFlag")}
          </Button>
        </Box>
      </ResizableDrawer>

      {/* Column Settings Dialog */}
      <ColumnSettingsDialog
        open={Boolean(columnSettingsAnchor)}
        anchorEl={columnSettingsAnchor}
        columns={columns}
        onColumnsChange={handleColumnsChange}
        onReset={handleResetColumns}
        onClose={() => setColumnSettingsAnchor(null)}
      />

      {/* Export Menu */}
      <Menu
        anchorEl={exportMenuAnchor}
        open={Boolean(exportMenuAnchor)}
        onClose={() => setExportMenuAnchor(null)}
      >
        {environments.map((env) => (
          <MenuItem key={env.environment} onClick={() => handleExport(env.environment)}>
            <ListItemIcon>
              <Chip
                size="small"
                sx={{
                  bgcolor: env.color || "#888",
                  color: getContrastColor(env.color || "#888"),
                  width: 20,
                  height: 20,
                  "& .MuiChip-label": { display: "none" },
                }}
              />
            </ListItemIcon>
            <ListItemText>{env.displayName}</ListItemText>
          </MenuItem>
        ))}
      </Menu>

      {/* Import Dialog */}
      <Dialog
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>{t("featureFlags.import")}</DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2, mt: 1 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {t("featureFlags.importDescription")}
            </Typography>
            <Button variant="outlined" component="label" startIcon={<ImportIcon />} sx={{ mt: 1 }}>
              {t("featureFlags.selectFile")}
              <input type="file" accept=".json" hidden onChange={handleImportFileChange} />
            </Button>
          </Box>
          <TextField
            multiline
            rows={10}
            fullWidth
            value={importData}
            onChange={(e) => setImportData(e.target.value)}
            placeholder={t("featureFlags.importPlaceholder")}
            sx={{ fontFamily: "monospace" }}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setImportDialogOpen(false);
              setImportData("");
            }}
            disabled={importing}
          >
            {t("common.cancel")}
          </Button>
          <Button
            variant="contained"
            onClick={handleImport}
            disabled={importing || !importData.trim()}
            startIcon={importing ? <CircularProgress size={20} /> : undefined}
          >
            {t("featureFlags.import")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box >
  );
};

export default FeatureFlagsPage;
