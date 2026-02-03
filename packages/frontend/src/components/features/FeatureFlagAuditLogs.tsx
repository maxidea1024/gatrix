import React, { useState, useEffect, useCallback } from "react";
import { useDebounce } from "../../hooks/useDebounce";
import {
    Box,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Chip,
    Tooltip,
    TextField,
    InputAdornment,
    CircularProgress,
    IconButton,
    Popover,
    List,
    ListItem,
    ListItemButton,
    ListItemText,
    Checkbox,
    Collapse,
    Divider,
    Paper,
    alpha,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import {
    Search as SearchIcon,
    ViewColumn as ViewColumnIcon,
    Visibility as VisibilityIcon,
    VisibilityOff as VisibilityOffIcon,
    DragIndicator as DragIndicatorIcon,
    KeyboardArrowDown as KeyboardArrowDownIcon,
    KeyboardArrowRight as KeyboardArrowRightIcon,
    ContentCopy as ContentCopyIcon,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { useSnackbar } from "notistack";
import { copyToClipboardWithNotification } from "@/utils/clipboard";
import {
    AuditLogService,
    AuditLogFilters,
} from "../../services/auditLogService";
import { AuditLog } from "../../types";
import {
    formatDateTimeDetailed,
    formatRelativeTime,
} from "../../utils/dateFormat";
import SimplePagination from "../../components/common/SimplePagination";
import EmptyState from "../../components/common/EmptyState";
import { useI18n } from "../../contexts/I18nContext";
import dayjs, { Dayjs } from "dayjs";
import DateRangePicker, {
    DateRangePreset,
} from "../../components/common/DateRangePicker";
import DynamicFilterBar, {
    FilterDefinition,
    ActiveFilter,
} from "../../components/common/DynamicFilterBar";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";

// Interfaces & Subcomponents
interface ColumnConfig {
    id: string;
    labelKey: string;
    visible: boolean;
}

interface SortableColumnItemProps {
    column: ColumnConfig;
    onToggleVisibility: (id: string) => void;
}

const SortableColumnItem: React.FC<SortableColumnItemProps> = ({
    column,
    onToggleVisibility,
}) => {
    const { t } = useTranslation();
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: column.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <ListItem
            ref={setNodeRef}
            style={style}
            disablePadding
            secondaryAction={
                <Box
                    {...attributes}
                    {...listeners}
                    sx={{
                        cursor: "grab",
                        display: "flex",
                        alignItems: "center",
                        "&:active": { cursor: "grabbing" },
                    }}
                >
                    <DragIndicatorIcon sx={{ color: "text.disabled", fontSize: 20 }} />
                </Box>
            }
        >
            <ListItemButton
                dense
                onClick={() => onToggleVisibility(column.id)}
                sx={{ pr: 6 }}
            >
                <Checkbox
                    edge="start"
                    checked={column.visible}
                    tabIndex={-1}
                    disableRipple
                    size="small"
                    icon={<VisibilityOffIcon fontSize="small" />}
                    checkedIcon={<VisibilityIcon fontSize="small" />}
                />
                <ListItemText
                    primary={t(column.labelKey)}
                    slotProps={{ primary: { variant: "body2" } }}
                />
            </ListItemButton>
        </ListItem>
    );
};

interface FeatureFlagAuditLogsProps {
    flagName: string;
}

const FeatureFlagAuditLogs: React.FC<FeatureFlagAuditLogsProps> = ({
    flagName,
}) => {
    const { t } = useTranslation();
    const { language } = useI18n();
    const theme = useTheme();
    const { enqueueSnackbar } = useSnackbar();

    // State
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [expandedRowId, setExpandedRowId] = useState<number | null>(null);

    // Filters
    const [dateFrom, setDateFrom] = useState<Dayjs | null>(
        dayjs().subtract(7, "day")
    );
    const [dateTo, setDateTo] = useState<Dayjs | null>(dayjs());
    const [dateRangePreset, setDateRangePreset] =
        useState<DateRangePreset>("last7d");
    const [userFilter, setUserFilter] = useState("");
    const debouncedUserFilter = useDebounce(userFilter, 500);
    const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);

    // Columns
    const defaultColumns: ColumnConfig[] = [
        { id: "createdAt", labelKey: "auditLogs.createdAt", visible: true },
        { id: "user", labelKey: "auditLogs.user", visible: true },
        { id: "action", labelKey: "auditLogs.action", visible: true },
        { id: "resource", labelKey: "auditLogs.resource", visible: true },
        { id: "resourceId", labelKey: "auditLogs.resourceId", visible: true },
        { id: "ipAddress", labelKey: "auditLogs.ipAddress", visible: true },
    ];

    const [columns, setColumns] = useState<ColumnConfig[]>(() => {
        const saved = localStorage.getItem("featureFlagAuditLogsColumns");
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
            } catch (e) {
                return defaultColumns;
            }
        }
        return defaultColumns;
    });

    const [columnSettingsAnchor, setColumnSettingsAnchor] =
        useState<HTMLButtonElement | null>(null);

    const columnSensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Available filter definitions
    const availableFilters: FilterDefinition[] = [
        {
            key: "action",
            label: t("auditLogs.action"),
            type: "multiselect",
            operator: "any_of",
            allowOperatorToggle: false,
            options: AuditLogService.getAvailableActions().map((action) => ({
                value: action,
                label: t(`auditLogs.actions.${action}`),
            })),
        },
        {
            key: "ip_address",
            label: t("auditLogs.ipAddress"),
            type: "text",
        },
    ];

    const loadAuditLogs = useCallback(async () => {
        try {
            setLoading(true);

            const filters: AuditLogFilters = {
                ["resource_id" as keyof AuditLogFilters]: flagName,
            };

            if (dateFrom) {
                filters.start_date = dateFrom.toISOString();
            }
            if (dateTo) {
                filters.end_date = dateTo.toISOString();
            }
            if (debouncedUserFilter) {
                filters.user = debouncedUserFilter.trim();
            }

            activeFilters.forEach((filter) => {
                if (
                    filter.value !== undefined &&
                    filter.value !== null &&
                    filter.value !== ""
                ) {
                    if (Array.isArray(filter.value) && filter.value.length > 0) {
                        (filters as any)[filter.key] = filter.value;
                        if (filter.operator) {
                            (filters as any)[`${filter.key}_operator`] = filter.operator;
                        }
                    } else if (!Array.isArray(filter.value)) {
                        (filters as any)[filter.key] = filter.value;
                    }
                }
            });

            const result = await AuditLogService.getAuditLogs(page, limit, filters);

            if (result && Array.isArray(result.logs)) {
                setAuditLogs(result.logs);
                setTotal(result.total || 0);
            } else {
                setAuditLogs([]);
                setTotal(0);
            }
        } catch (error: any) {
            console.error("Error loading audit logs:", error);
            enqueueSnackbar(error.message || t("auditLogs.loadFailed"), {
                variant: "error",
            });
            setAuditLogs([]);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    }, [
        page,
        limit,
        flagName,
        dateFrom,
        dateTo,
        debouncedUserFilter,
        activeFilters,
        enqueueSnackbar,
        t,
    ]);

    useEffect(() => {
        loadAuditLogs();
    }, [loadAuditLogs]);

    // Handlers
    const handlePageChange = (newPage: number) => {
        // newPage is 0-based coming from SimplePagination (actually I will convert it)
        // Here we just set the 1-based page
        setPage(newPage);
    };

    const handleLimitChange = (event: any) => {
        const newLimit = parseInt(event.target.value, 10);
        setLimit(newLimit);
        setPage(1);
    };

    const handleFilterAdd = (filter: ActiveFilter) => {
        setActiveFilters((prev) => [...prev, filter]);
        setPage(1);
    };

    const handleFilterRemove = (filterKey: string) => {
        setActiveFilters((prev) => prev.filter((f) => f.key !== filterKey));
        setPage(1);
    };

    const handleDynamicFilterChange = (filterKey: string, value: any) => {
        setActiveFilters((prev) =>
            prev.map((f) => (f.key === filterKey ? { ...f, value } : f))
        );
        setPage(1);
    };

    const handleOperatorChange = (
        filterKey: string,
        operator: "any_of" | "include_all"
    ) => {
        setActiveFilters((prev) =>
            prev.map((f) => (f.key === filterKey ? { ...f, operator } : f))
        );
        setPage(1);
    };

    const handleToggleColumnVisibility = (columnId: string) => {
        const newColumns = columns.map((col) =>
            col.id === columnId ? { ...col, visible: !col.visible } : col
        );
        setColumns(newColumns);
        localStorage.setItem(
            "featureFlagAuditLogsColumns",
            JSON.stringify(newColumns)
        );
    };

    const handleColumnDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = columns.findIndex((col) => col.id === active.id);
            const newIndex = columns.findIndex((col) => col.id === over.id);
            const newColumns = arrayMove(columns, oldIndex, newIndex);
            setColumns(newColumns);
            localStorage.setItem(
                "featureFlagAuditLogsColumns",
                JSON.stringify(newColumns)
            );
        }
    };

    const handleCopyDetails = async (details: any) => {
        let text = "";
        if (!details) {
            text = "No details available";
        } else if (typeof details === "string") {
            text = details;
        } else {
            text = JSON.stringify(details, null, 2);
        }

        copyToClipboardWithNotification(
            text,
            () =>
                enqueueSnackbar(t("auditLogs.detailsCopied"), { variant: "success" }),
            () => enqueueSnackbar(t("common.copyFailed"), { variant: "error" })
        );
    };

    const renderCellContent = (log: AuditLog, columnId: string) => {
        switch (columnId) {
            case "createdAt":
                return (
                    <Tooltip
                        title={formatDateTimeDetailed(
                            (log as any).createdAt || log.created_at
                        )}
                    >
                        <Typography variant="body2">
                            {formatRelativeTime(
                                (log as any).createdAt || log.created_at,
                                undefined,
                                language
                            )}
                        </Typography>
                    </Tooltip>
                );
            case "user":
                return log.user_name ? (
                    <Box>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {log.user_name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            {log.user_email}
                        </Typography>
                    </Box>
                ) : (
                    <Typography variant="body2" color="text.secondary">
                        {t("auditLogs.system")}
                    </Typography>
                );
            case "action":
                return (
                    <Chip
                        label={t(`auditLogs.actions.${log.action}`)}
                        color={AuditLogService.getActionColor(log.action)}
                        size="small"
                    />
                );
            case "resource":
                const resourceType =
                    (log as any).resourceType ||
                    (log as any).resource_type ||
                    (log as any).entityType;
                return resourceType ? (
                    <Box>
                        <Typography variant="body2" fontWeight="medium">
                            {t(`auditLogs.resources.${resourceType}`, resourceType)}
                        </Typography>
                        {(() => {
                            const oldVals = (log as any).oldValues || (log as any).old_values;
                            const newVals = (log as any).newValues || (log as any).new_values;
                            const resourceName =
                                oldVals?.name ||
                                newVals?.name ||
                                oldVals?.worldId ||
                                newVals?.worldId;
                            return resourceName ? (
                                <Typography
                                    variant="body2"
                                    color="text.primary"
                                    sx={{ fontWeight: 500 }}
                                >
                                    {resourceName}
                                </Typography>
                            ) : null;
                        })()}
                    </Box>
                ) : (
                    <Typography variant="body2" color="text.secondary">
                        -
                    </Typography>
                );
            case "resourceId":
                const resourceId =
                    (log as any).resourceId ||
                    (log as any).resource_id ||
                    (log as any).entityId;
                return resourceId ? (
                    <Typography variant="caption" color="text.secondary">
                        ID: {resourceId}
                    </Typography>
                ) : (
                    <Typography variant="body2" color="text.secondary">
                        -
                    </Typography>
                );
            case "ipAddress":
                return (
                    <Typography variant="body2" fontFamily="monospace">
                        {log.ip_address || "-"}
                    </Typography>
                );
            default:
                return null;
        }
    };

    return (
        <Box sx={{ p: 0 }}>
            {/* Filters */}
            <Box
                sx={{
                    display: "flex",
                    gap: 2,
                    alignItems: "center",
                    flexWrap: "wrap",
                    mb: 3,
                }}
            >
                <DateRangePicker
                    dateFrom={dateFrom}
                    dateTo={dateTo}
                    onChange={(from, to, preset) => {
                        setDateFrom(from);
                        setDateTo(to);
                        setDateRangePreset(preset);
                        setPage(1);
                    }}
                    preset={dateRangePreset}
                    availablePresets={[
                        "today",
                        "yesterday",
                        "last7d",
                        "last30d",
                        "custom",
                    ]}
                    size="small"
                />

                <TextField
                    placeholder={t("auditLogs.searchUserPlaceholder")}
                    size="small"
                    sx={{
                        minWidth: 200,
                        flexGrow: 1,
                        maxWidth: 320,
                        "& .MuiOutlinedInput-root": {
                            height: "40px",
                            borderRadius: "20px",
                            bgcolor: "background.paper",
                        },
                    }}
                    value={userFilter}
                    onChange={(e) => {
                        setUserFilter(e.target.value);
                        setPage(1);
                    }}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon sx={{ color: "text.secondary", fontSize: 20 }} />
                            </InputAdornment>
                        ),
                    }}
                />

                <DynamicFilterBar
                    availableFilters={availableFilters}
                    activeFilters={activeFilters}
                    onFilterAdd={handleFilterAdd}
                    onFilterRemove={handleFilterRemove}
                    onFilterChange={handleDynamicFilterChange}
                    onOperatorChange={handleOperatorChange}
                />

                {/* Column Settings Button */}
                <Tooltip title={t("users.columnSettings")}>
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
            </Box>

            {/* Table */}
            {loading && auditLogs.length === 0 ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
                    <CircularProgress size={30} />
                </Box>
            ) : auditLogs.length === 0 ? (
                <EmptyState message={t("auditLogs.noLogsFound")} />
            ) : (
                <>
                    <TableContainer>
                        <Table sx={{ tableLayout: "auto" }}>
                            <TableHead>
                                <TableRow>
                                    <TableCell padding="checkbox" />
                                    {columns
                                        .filter((col) => col.visible)
                                        .map((column) => (
                                            <TableCell key={column.id}>
                                                {t(column.labelKey)}
                                            </TableCell>
                                        ))}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {auditLogs.map((log, index) => (
                                    <React.Fragment key={log.id}>
                                        <TableRow
                                            hover
                                            sx={{
                                                bgcolor:
                                                    index % 2 === 1
                                                        ? alpha(theme.palette.action.hover, 0.05)
                                                        : "transparent",
                                            }}
                                        >
                                            <TableCell padding="checkbox">
                                                <IconButton
                                                    size="small"
                                                    onClick={() =>
                                                        setExpandedRowId(
                                                            expandedRowId === log.id ? null : log.id
                                                        )
                                                    }
                                                >
                                                    {expandedRowId === log.id ? (
                                                        <KeyboardArrowDownIcon />
                                                    ) : (
                                                        <KeyboardArrowRightIcon />
                                                    )}
                                                </IconButton>
                                            </TableCell>
                                            {columns
                                                .filter((col) => col.visible)
                                                .map((column) => (
                                                    <TableCell key={column.id}>
                                                        {renderCellContent(log, column.id)}
                                                    </TableCell>
                                                ))}
                                        </TableRow>
                                        {/* Expanded Row Details */}
                                        <TableRow>
                                            <TableCell
                                                style={{ paddingBottom: 0, paddingTop: 0 }}
                                                colSpan={columns.filter((c) => c.visible).length + 1}
                                            >
                                                <Collapse
                                                    in={expandedRowId === log.id}
                                                    timeout="auto"
                                                    unmountOnExit
                                                >
                                                    <Box sx={{ py: 3, px: 2 }}>
                                                        {/* UserAgent */}
                                                        {((log as any).userAgent ||
                                                            (log as any).user_agent) && (
                                                                <>
                                                                    <Box sx={{ mb: 2 }}>
                                                                        <Typography
                                                                            variant="caption"
                                                                            color="text.secondary"
                                                                            sx={{
                                                                                fontWeight: 600,
                                                                                textTransform: "uppercase",
                                                                                letterSpacing: 0.5,
                                                                            }}
                                                                        >
                                                                            {t("auditLogs.userAgent")}
                                                                        </Typography>
                                                                        <Typography
                                                                            variant="body2"
                                                                            sx={{
                                                                                mt: 0.5,
                                                                                wordBreak: "break-all",
                                                                                fontFamily: "monospace",
                                                                                fontSize: "0.75rem",
                                                                                color: "text.secondary",
                                                                            }}
                                                                        >
                                                                            {(log as any).userAgent ||
                                                                                (log as any).user_agent}
                                                                        </Typography>
                                                                    </Box>
                                                                    <Divider sx={{ mb: 2 }} />
                                                                </>
                                                            )}

                                                        {/* Changes - Diff Viewer */}
                                                        {(() => {
                                                            const oldVals =
                                                                (log as any).oldValues ||
                                                                (log as any).old_values;
                                                            const newVals =
                                                                (log as any).newValues ||
                                                                (log as any).new_values;

                                                            // Both old and new values exist
                                                            if (oldVals && newVals) {
                                                                return (
                                                                    <>
                                                                        <Box>
                                                                            <Typography
                                                                                variant="caption"
                                                                                color="text.secondary"
                                                                                sx={{
                                                                                    mb: 1.5,
                                                                                    display: "block",
                                                                                    fontWeight: 600,
                                                                                    textTransform: "uppercase",
                                                                                    letterSpacing: 0.5,
                                                                                }}
                                                                            >
                                                                                {t("auditLogs.changes")}
                                                                            </Typography>
                                                                            <Paper
                                                                                elevation={0}
                                                                                sx={{
                                                                                    bgcolor: "background.default",
                                                                                    overflow: "hidden",
                                                                                    border: 1,
                                                                                    borderColor: "divider",
                                                                                    borderRadius: 1,
                                                                                }}
                                                                            >
                                                                                <Table size="small">
                                                                                    <TableHead>
                                                                                        <TableRow
                                                                                            sx={{ bgcolor: "action.hover" }}
                                                                                        >
                                                                                            <TableCell
                                                                                                sx={{
                                                                                                    fontWeight: 600,
                                                                                                    width: "25%",
                                                                                                }}
                                                                                            >
                                                                                                {t("changeRequest.field")}
                                                                                            </TableCell>
                                                                                            <TableCell
                                                                                                sx={{
                                                                                                    fontWeight: 600,
                                                                                                    width: "37.5%",
                                                                                                }}
                                                                                            >
                                                                                                {t("changeRequest.oldValue")}
                                                                                            </TableCell>
                                                                                            <TableCell
                                                                                                sx={{
                                                                                                    fontWeight: 600,
                                                                                                    width: "37.5%",
                                                                                                }}
                                                                                            >
                                                                                                {t("changeRequest.newValue")}
                                                                                            </TableCell>
                                                                                        </TableRow>
                                                                                    </TableHead>
                                                                                    <TableBody>
                                                                                        {(() => {
                                                                                            const allKeys = new Set([
                                                                                                ...Object.keys(oldVals || {}),
                                                                                                ...Object.keys(newVals || {}),
                                                                                            ]);
                                                                                            const changedFields: {
                                                                                                key: string;
                                                                                                oldVal: any;
                                                                                                newVal: any;
                                                                                            }[] = [];
                                                                                            allKeys.forEach((key) => {
                                                                                                const oldVal = oldVals?.[key];
                                                                                                const newVal = newVals?.[key];
                                                                                                if (
                                                                                                    JSON.stringify(oldVal) !==
                                                                                                    JSON.stringify(newVal)
                                                                                                ) {
                                                                                                    changedFields.push({
                                                                                                        key,
                                                                                                        oldVal,
                                                                                                        newVal,
                                                                                                    });
                                                                                                }
                                                                                            });

                                                                                            if (changedFields.length === 0) {
                                                                                                return (
                                                                                                    <TableRow>
                                                                                                        <TableCell
                                                                                                            colSpan={3}
                                                                                                            align="center"
                                                                                                            sx={{
                                                                                                                color: "text.secondary",
                                                                                                                py: 2,
                                                                                                            }}
                                                                                                        >
                                                                                                            {t(
                                                                                                                "changeRequest.noChanges"
                                                                                                            )}
                                                                                                        </TableCell>
                                                                                                    </TableRow>
                                                                                                );
                                                                                            }

                                                                                            return changedFields.map(
                                                                                                ({
                                                                                                    key,
                                                                                                    oldVal,
                                                                                                    newVal,
                                                                                                }) => (
                                                                                                    <TableRow
                                                                                                        key={key}
                                                                                                        sx={{
                                                                                                            "&:nth-of-type(odd)": {
                                                                                                                bgcolor: "action.hover",
                                                                                                            },
                                                                                                        }}
                                                                                                    >
                                                                                                        <TableCell
                                                                                                            sx={{
                                                                                                                fontWeight: 500,
                                                                                                                fontFamily: "monospace",
                                                                                                                fontSize: "0.75rem",
                                                                                                            }}
                                                                                                        >
                                                                                                            {key}
                                                                                                        </TableCell>
                                                                                                        <TableCell
                                                                                                            sx={{
                                                                                                                fontFamily: "monospace",
                                                                                                                fontSize: "0.75rem",
                                                                                                                bgcolor: alpha(
                                                                                                                    theme.palette.error
                                                                                                                        .main,
                                                                                                                    0.08
                                                                                                                ),
                                                                                                                color: "text.secondary",
                                                                                                                wordBreak: "break-all",
                                                                                                            }}
                                                                                                        >
                                                                                                            {oldVal !== undefined
                                                                                                                ? typeof oldVal ===
                                                                                                                    "object"
                                                                                                                    ? JSON.stringify(
                                                                                                                        oldVal
                                                                                                                    )
                                                                                                                    : String(oldVal)
                                                                                                                : "-"}
                                                                                                        </TableCell>
                                                                                                        <TableCell
                                                                                                            sx={{
                                                                                                                fontFamily: "monospace",
                                                                                                                fontSize: "0.75rem",
                                                                                                                bgcolor: alpha(
                                                                                                                    theme.palette.success
                                                                                                                        .main,
                                                                                                                    0.08
                                                                                                                ),
                                                                                                                wordBreak: "break-all",
                                                                                                            }}
                                                                                                        >
                                                                                                            {newVal !== undefined
                                                                                                                ? typeof newVal ===
                                                                                                                    "object"
                                                                                                                    ? JSON.stringify(
                                                                                                                        newVal
                                                                                                                    )
                                                                                                                    : String(newVal)
                                                                                                                : "-"}
                                                                                                        </TableCell>
                                                                                                    </TableRow>
                                                                                                )
                                                                                            );
                                                                                        })()}
                                                                                    </TableBody>
                                                                                </Table>
                                                                            </Paper>
                                                                        </Box>
                                                                        <Divider sx={{ my: 2 }} />
                                                                    </>
                                                                );
                                                            }

                                                            // Only new values exist (e.g. create)
                                                            if (!oldVals && newVals) {
                                                                return (
                                                                    <>
                                                                        <Box>
                                                                            <Typography
                                                                                variant="caption"
                                                                                color="text.secondary"
                                                                                sx={{
                                                                                    mb: 1.5,
                                                                                    display: "block",
                                                                                    fontWeight: 600,
                                                                                    textTransform: "uppercase",
                                                                                    letterSpacing: 0.5,
                                                                                }}
                                                                            >
                                                                                {t("auditLogs.newValues")}
                                                                            </Typography>
                                                                            <Paper
                                                                                elevation={0}
                                                                                sx={{
                                                                                    p: 2,
                                                                                    bgcolor: "background.default",
                                                                                    border: 1,
                                                                                    borderColor: "divider",
                                                                                    borderRadius: 1,
                                                                                    overflow: "auto",
                                                                                    maxHeight: 400,
                                                                                }}
                                                                            >
                                                                                <pre
                                                                                    style={{
                                                                                        margin: 0,
                                                                                        fontSize: "0.75rem",
                                                                                        fontFamily: "monospace",
                                                                                        color: theme.palette.text.primary,
                                                                                    }}
                                                                                >
                                                                                    {JSON.stringify(newVals, null, 2)}
                                                                                </pre>
                                                                            </Paper>
                                                                        </Box>
                                                                        <Divider sx={{ my: 2 }} />
                                                                    </>
                                                                );
                                                            }

                                                            return null;
                                                        })()}

                                                        <Box
                                                            sx={{
                                                                display: "flex",
                                                                justifyContent: "flex-end",
                                                            }}
                                                        >
                                                            <Tooltip title={t("common.copyToClipboard")}>
                                                                <IconButton
                                                                    size="small"
                                                                    onClick={() => handleCopyDetails(log)}
                                                                >
                                                                    <ContentCopyIcon fontSize="small" />
                                                                </IconButton>
                                                            </Tooltip>
                                                        </Box>
                                                    </Box>
                                                </Collapse>
                                            </TableCell>
                                        </TableRow>
                                    </React.Fragment>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>

                    <Box sx={{ mt: 2, display: "flex", justifyContent: "center" }}>
                        <SimplePagination
                            count={total}
                            page={page - 1} // 1-based to 0-based
                            rowsPerPage={limit}
                            onPageChange={(_, p) => handlePageChange(p + 1)} // 0-based to 1-based
                            onRowsPerPageChange={handleLimitChange}
                        />
                    </Box>
                </>
            )}

            {/* Column Settings Popover */}
            <Popover
                open={Boolean(columnSettingsAnchor)}
                anchorEl={columnSettingsAnchor}
                onClose={() => setColumnSettingsAnchor(null)}
                anchorOrigin={{
                    vertical: "bottom",
                    horizontal: "right",
                }}
                transformOrigin={{
                    vertical: "top",
                    horizontal: "right",
                }}
            >
                <Box sx={{ width: 280, p: 2 }}>
                    <Typography variant="subtitle2" sx={{ mb: 2 }}>
                        {t("users.columnSettings")}
                    </Typography>
                    <DndContext
                        sensors={columnSensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleColumnDragEnd}
                        modifiers={[restrictToVerticalAxis]}
                    >
                        <SortableContext
                            items={columns.map((c) => c.id)}
                            strategy={verticalListSortingStrategy}
                        >
                            <List dense>
                                {columns.map((column) => (
                                    <SortableColumnItem
                                        key={column.id}
                                        column={column}
                                        onToggleVisibility={handleToggleColumnVisibility}
                                    />
                                ))}
                            </List>
                        </SortableContext>
                    </DndContext>
                    <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end" }}>
                        <Chip
                            label={t("common.reset")}
                            size="small"
                            onClick={() => {
                                setColumns(defaultColumns);
                                localStorage.setItem(
                                    "featureFlagAuditLogsColumns",
                                    JSON.stringify(defaultColumns)
                                );
                            }}
                            clickable
                        />
                    </Box>
                </Box>
            </Popover>
        </Box>
    );
};

export default FeatureFlagAuditLogs;
