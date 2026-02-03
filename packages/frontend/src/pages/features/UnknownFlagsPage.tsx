import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Tooltip,
  Alert,
  CircularProgress,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  TextField,
  InputAdornment,
} from "@mui/material";
import {
  Refresh as RefreshIcon,
  CheckCircle as ResolveIcon,
  Delete as DeleteIcon,
  HelpOutline as UnknownIcon,
  MoreVert as MoreVertIcon,
  Undo as UndoIcon,
  ContentCopy as CopyIcon,
  Search as SearchIcon,
  ViewColumn as ViewColumnIcon,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { useSnackbar } from "notistack";
import { useEnvironment } from "../../contexts/EnvironmentContext";
import { unknownFlagService, UnknownFlag } from "../../services/unknownFlagService";
import RelativeTime from "../../components/common/RelativeTime";
import DynamicFilterBar, {
  FilterDefinition,
  ActiveFilter,
} from "../../components/common/DynamicFilterBar";
import ColumnSettingsDialog, { ColumnConfig } from "../../components/common/ColumnSettingsDialog";
import HelpTip from "../../components/common/HelpTip";
import { copyToClipboardWithNotification } from "../../utils/clipboard";
import { useDebounce } from "../../hooks/useDebounce";

const UnknownFlagsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { currentEnvironmentId } = useEnvironment();
  const { enqueueSnackbar } = useSnackbar();

  const [flags, setFlags] = useState<UnknownFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  // Menu state
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedFlag, setSelectedFlag] = useState<UnknownFlag | null>(null);

  // Dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    type: "resolve" | "unresolve" | "delete";
    flag: UnknownFlag | null;
  }>({ open: false, type: "resolve", flag: null });

  // Column settings state
  const [columnSettingsAnchor, setColumnSettingsAnchor] = useState<null | HTMLElement>(null);
  const defaultColumns: ColumnConfig[] = [
    { id: "flagName", labelKey: "featureFlags.flagName", visible: true },
    { id: "environment", labelKey: "featureFlags.environment", visible: true },
    { id: "appName", labelKey: "featureFlags.appName", visible: true },
    { id: "sdkVersion", labelKey: "featureFlags.sdkVersion", visible: true },
    { id: "accessCount", labelKey: "featureFlags.accessCount", visible: true },
    { id: "lastReportedAt", labelKey: "featureFlags.lastReported", visible: true },
    { id: "status", labelKey: "common.status", visible: true },
  ];
  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    const saved = localStorage.getItem("unknownFlagsColumns");
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

  // Extract filter values
  const statusFilter = useMemo(() => {
    const filter = activeFilters.find((f) => f.key === "status");
    return filter?.value as string[] | undefined;
  }, [activeFilters]);

  // Filter definitions
  const filterDefinitions: FilterDefinition[] = useMemo(
    () => [
      {
        key: "status",
        label: t("common.status"),
        type: "multiselect",
        options: [
          {
            value: "unresolved",
            label: t("featureFlags.unresolved"),
            icon: <Chip size="small" color="warning" label="" sx={{ width: 16, height: 16, p: 0 }} />,
          },
          {
            value: "resolved",
            label: t("featureFlags.resolved"),
            icon: <Chip size="small" color="success" label="" sx={{ width: 16, height: 16, p: 0 }} />,
          },
        ],
      },
    ],
    [t]
  );

  const loadFlags = useCallback(async () => {
    setLoading(true);
    try {
      // Determine includeResolved based on filter
      const includeResolved = statusFilter?.includes("resolved") || (statusFilter?.length === 2) || !statusFilter;
      const result = await unknownFlagService.getUnknownFlags({
        includeResolved,
        environment: currentEnvironmentId || undefined,
      });
      setFlags(result.flags);
    } catch {
      enqueueSnackbar(t("common.loadError"), { variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, currentEnvironmentId, enqueueSnackbar, t]);

  useEffect(() => {
    loadFlags();
  }, [loadFlags]);

  // Handle filter changes
  const handleFilterChange = useCallback((key: string, value: any) => {
    setActiveFilters((prev) => {
      const existing = prev.find((f) => f.key === key);
      if (existing) {
        if (value === undefined || value === null || (Array.isArray(value) && value.length === 0)) {
          return prev.filter((f) => f.key !== key);
        }
        return prev.map((f) => (f.key === key ? { ...f, value } : f));
      }
      if (value === undefined || value === null || (Array.isArray(value) && value.length === 0)) {
        return prev;
      }
      return [...prev, { key, value }];
    });
  }, []);

  const handleRemoveFilter = useCallback((key: string) => {
    setActiveFilters((prev) => prev.filter((f) => f.key !== key));
  }, []);

  const handleFilterAdd = useCallback((filter: ActiveFilter) => {
    setActiveFilters((prev) => {
      const exists = prev.find((f) => f.key === filter.key);
      if (exists) {
        return prev;
      }
      return [...prev, filter];
    });
  }, []);

  const handleClearFilters = useCallback(() => {
    setActiveFilters([]);
    setSearchTerm("");
  }, []);

  // Column settings handlers
  const handleColumnsChange = useCallback((newColumns: ColumnConfig[]) => {
    setColumns(newColumns);
    localStorage.setItem("unknownFlagsColumns", JSON.stringify(newColumns));
  }, []);

  // Filter flags based on search and status filter
  const filteredFlags = useMemo(() => {
    let result = flags;

    // Apply search
    if (debouncedSearchTerm) {
      const lower = debouncedSearchTerm.toLowerCase();
      result = result.filter(
        (f) =>
          f.flagName.toLowerCase().includes(lower) ||
          f.appName?.toLowerCase().includes(lower)
      );
    }

    // Apply status filter
    if (statusFilter && statusFilter.length > 0 && statusFilter.length < 2) {
      if (statusFilter.includes("resolved")) {
        result = result.filter((f) => f.isResolved);
      } else if (statusFilter.includes("unresolved")) {
        result = result.filter((f) => !f.isResolved);
      }
    }

    return result;
  }, [flags, debouncedSearchTerm, statusFilter]);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, flag: UnknownFlag) => {
    setMenuAnchorEl(event.currentTarget);
    setSelectedFlag(flag);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setSelectedFlag(null);
  };

  const handleOpenConfirmDialog = (type: "resolve" | "unresolve" | "delete") => {
    setConfirmDialog({ open: true, type, flag: selectedFlag });
    handleMenuClose();
  };

  const handleCloseConfirmDialog = () => {
    setConfirmDialog({ open: false, type: "resolve", flag: null });
  };

  const handleConfirmAction = async () => {
    if (!confirmDialog.flag) return;

    try {
      switch (confirmDialog.type) {
        case "resolve":
          await unknownFlagService.resolveUnknownFlag(confirmDialog.flag.id);
          enqueueSnackbar(t("featureFlags.resolvedSuccessfully"), { variant: "success" });
          break;
        case "unresolve":
          await unknownFlagService.unresolveUnknownFlag(confirmDialog.flag.id);
          enqueueSnackbar(t("featureFlags.unresolvedSuccessfully"), { variant: "success" });
          break;
        case "delete":
          await unknownFlagService.deleteUnknownFlag(confirmDialog.flag.id);
          enqueueSnackbar(t("common.deleted"), { variant: "success" });
          break;
      }
      loadFlags();
    } catch {
      enqueueSnackbar(t("common.error"), { variant: "error" });
    } finally {
      handleCloseConfirmDialog();
    }
  };

  const getDialogContent = () => {
    if (!confirmDialog.flag) return { title: "", message: "" };
    const flagName = confirmDialog.flag.flagName;

    switch (confirmDialog.type) {
      case "resolve":
        return {
          title: t("featureFlags.confirmResolve"),
          message: t("featureFlags.confirmResolveMessage", { flagName }),
        };
      case "unresolve":
        return {
          title: t("featureFlags.confirmUnresolve"),
          message: t("featureFlags.confirmUnresolveMessage", { flagName }),
        };
      case "delete":
        return {
          title: t("common.confirmDelete"),
          message: t("featureFlags.confirmDeleteMessage", { flagName }),
        };
    }
  };

  const visibleColumns = columns.filter((c) => c.visible);
  const dialogContent = getDialogContent();

  const handleCopyFlagName = (flagName: string) => {
    copyToClipboardWithNotification(flagName, t("common.copiedToClipboard"), enqueueSnackbar);
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
        }}
      >
        <Box>
          <Typography
            variant="h5"
            fontWeight={600}
            sx={{ display: "flex", alignItems: "center", gap: 1 }}
          >
            <UnknownIcon color="warning" />
            {t("featureFlags.unknownFlags")} ({filteredFlags.length})
            <HelpTip title={t("featureFlags.unknownFlagsInfo")}>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {t("featureFlags.unknownFlagsTypes")}
              </Typography>
              <ul>
                <li>{t("featureFlags.unknownFlagsMissing")}</li>
                <li>{t("featureFlags.unknownFlagsInvalid")}</li>
              </ul>
            </HelpTip>
          </Typography>
          <Typography color="text.secondary" variant="body2">
            {t("featureFlags.unknownFlagsDescription")}
          </Typography>
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
                placeholder={t("featureFlags.searchUnknownFlags")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
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
              <DynamicFilterBar
                availableFilters={filterDefinitions}
                activeFilters={activeFilters}
                onFilterAdd={handleFilterAdd}
                onFilterRemove={handleRemoveFilter}
                onFilterChange={handleFilterChange}
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

      {/* Content */}
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress size={32} />
        </Box>
      ) : filteredFlags.length === 0 ? (
        <Box
          sx={{
            border: "2px dashed",
            borderColor: "divider",
            borderRadius: 2,
            p: 6,
            textAlign: "center",
          }}
        >
          <Typography color="text.secondary">
            {t("featureFlags.noUnknownFlags")}
          </Typography>
        </Box>
      ) : (
        <Card>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  {visibleColumns.map((col) => (
                    <TableCell
                      key={col.id}
                      align={col.id === "accessCount" || col.id === "status" ? "center" : "left"}
                    >
                      {t(col.labelKey)}
                    </TableCell>
                  ))}
                  <TableCell align="center">{t("common.actions")}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredFlags.map((flag) => (
                  <TableRow key={flag.id}>
                    {visibleColumns.map((col) => {
                      switch (col.id) {
                        case "flagName":
                          return (
                            <TableCell key={col.id}>
                              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                <UnknownIcon fontSize="small" color="warning" />
                                <Typography fontWeight={500} sx={{ fontFamily: "monospace" }}>
                                  {flag.flagName}
                                </Typography>
                                <Tooltip title={t("common.copy")}>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleCopyFlagName(flag.flagName)}
                                    sx={{ opacity: 0.6, "&:hover": { opacity: 1 } }}
                                  >
                                    <CopyIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            </TableCell>
                          );
                        case "environment":
                          return (
                            <TableCell key={col.id}>
                              <Chip label={flag.environment} size="small" sx={{ borderRadius: "16px" }} />
                            </TableCell>
                          );
                        case "appName":
                          return (
                            <TableCell key={col.id}>
                              {flag.appName ? (
                                <Chip label={flag.appName} size="small" variant="outlined" sx={{ borderRadius: "16px" }} />
                              ) : (
                                <Typography variant="body2" color="text.secondary">-</Typography>
                              )}
                            </TableCell>
                          );
                        case "sdkVersion":
                          return (
                            <TableCell key={col.id}>
                              <Typography variant="body2" color="text.secondary">
                                {flag.sdkVersion || "-"}
                              </Typography>
                            </TableCell>
                          );
                        case "accessCount":
                          return (
                            <TableCell key={col.id} align="center">
                              <Typography variant="body2">
                                {flag.accessCount.toLocaleString()}
                              </Typography>
                            </TableCell>
                          );
                        case "lastReportedAt":
                          return (
                            <TableCell key={col.id}>
                              <RelativeTime date={flag.lastReportedAt} />
                            </TableCell>
                          );
                        case "status":
                          return (
                            <TableCell key={col.id} align="center">
                              {flag.isResolved ? (
                                <Chip label={t("featureFlags.resolved")} size="small" color="success" />
                              ) : (
                                <Chip label={t("featureFlags.unresolved")} size="small" color="warning" />
                              )}
                            </TableCell>
                          );
                        default:
                          return <TableCell key={col.id}>-</TableCell>;
                      }
                    })}
                    <TableCell align="center">
                      <IconButton size="small" onClick={(e) => handleMenuOpen(e, flag)}>
                        <MoreVertIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {/* Action Menu */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
      >
        {selectedFlag && !selectedFlag.isResolved && (
          <MenuItem onClick={() => handleOpenConfirmDialog("resolve")}>
            <ListItemIcon>
              <ResolveIcon fontSize="small" color="success" />
            </ListItemIcon>
            <ListItemText>{t("featureFlags.markResolved")}</ListItemText>
          </MenuItem>
        )}
        {selectedFlag && selectedFlag.isResolved && (
          <MenuItem onClick={() => handleOpenConfirmDialog("unresolve")}>
            <ListItemIcon>
              <UndoIcon fontSize="small" color="warning" />
            </ListItemIcon>
            <ListItemText>{t("featureFlags.markUnresolved")}</ListItemText>
          </MenuItem>
        )}
        <MenuItem onClick={() => handleOpenConfirmDialog("delete")}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>{t("common.delete")}</ListItemText>
        </MenuItem>
      </Menu>

      {/* Column Settings Dialog */}
      <ColumnSettingsDialog
        open={Boolean(columnSettingsAnchor)}
        anchorEl={columnSettingsAnchor}
        columns={columns}
        defaultColumns={defaultColumns}
        onColumnsChange={handleColumnsChange}
        onClose={() => setColumnSettingsAnchor(null)}
      />

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog.open} onClose={handleCloseConfirmDialog}>
        <DialogTitle>{dialogContent.title}</DialogTitle>
        <DialogContent>
          <DialogContentText>{dialogContent.message}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseConfirmDialog}>{t("common.cancel")}</Button>
          <Button
            onClick={handleConfirmAction}
            color={confirmDialog.type === "delete" ? "error" : "primary"}
            variant="contained"
          >
            {t("common.confirm")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UnknownFlagsPage;
