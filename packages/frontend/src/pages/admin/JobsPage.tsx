import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { PERMISSIONS } from "@/types/permissions";
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
  Paper,
  Chip,
  IconButton,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Card,
  CardContent,
  Tabs,
  Tab,
  LinearProgress,
  Autocomplete,
  Drawer,
  InputAdornment,
  useTheme,
} from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Close as CloseIcon,
  PlayArrow as ExecuteIcon,
  History as HistoryIcon,
  Search as SearchIcon,
  Work as WorkIcon,
  ViewColumn as ViewColumnIcon,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { useSnackbar } from "notistack";
import { jobService } from "../../services/jobService";
import { tagService, Tag } from "../../services/tagService";
import {
  Job,
  JobType,
  JobExecution,
  JobExecutionStatus,
  JobListResponse,
} from "../../types/job";
import { formatDateTimeDetailed } from "../../utils/dateFormat";
import JobForm from "../../components/jobs/JobForm";
import JobExecutionHistory from "../../components/jobs/JobExecutionHistory";
import SimplePagination from "../../components/common/SimplePagination";
import EmptyState from "../../components/common/EmptyState";
import ColumnSettingsDialog, {
  ColumnConfig,
} from "../../components/common/ColumnSettingsDialog";
import { getContrastColor } from "@/utils/colorUtils";

// Default column configuration
const defaultColumns: ColumnConfig[] = [
  { id: "jobName", labelKey: "jobs.jobName", visible: true },
  { id: "jobType", labelKey: "jobs.jobType", visible: true },
  { id: "schedule", labelKey: "jobs.schedule", visible: true },
  { id: "lastExecution", labelKey: "jobs.lastExecution", visible: true },
  { id: "nextExecution", labelKey: "jobs.nextExecution", visible: true },
  { id: "isEnabled", labelKey: "jobs.isEnabled", visible: true },
  { id: "tags", labelKey: "common.tags", visible: true },
];

const JobsPage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const theme = useTheme();
  const { hasPermission } = useAuth();
  const canManage = hasPermission([PERMISSIONS.SCHEDULER_MANAGE]);

  // Column settings state
  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    const saved = localStorage.getItem("jobsColumns");
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

  // State
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobTypes, setJobTypes] = useState<JobType[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [tagFilter, setTagFilter] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedJobType, setSelectedJobType] = useState<number | "">("");
  const [enabledFilter, setEnabledFilter] = useState<boolean | "">("");
  const [tabValue, setTabValue] = useState(0);

  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [total, setTotal] = useState(0);

  // Dialog states
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [selectedJobForHistory, setSelectedJobForHistory] =
    useState<Job | null>(null);
  const [jobToDelete, setJobToDelete] = useState<Job | null>(null);

  // Column handlers
  const handleColumnsChange = (newColumns: ColumnConfig[]) => {
    setColumns(newColumns);
    localStorage.setItem("jobsColumns", JSON.stringify(newColumns));
  };

  const handleResetColumns = () => {
    setColumns(defaultColumns);
    localStorage.removeItem("jobsColumns");
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const tagIds = tagFilter.map((tag) => tag.id.toString());
      const [jobsResponse, jobTypesData] = await Promise.all([
        jobService.getJobsWithPagination({
          jobTypeId: selectedJobType || undefined,
          isEnabled: enabledFilter !== "" ? enabledFilter : undefined,
          search: searchTerm || undefined,
          tags: tagIds.length > 0 ? tagIds : undefined,
          limit: rowsPerPage,
          offset: page * rowsPerPage,
        }),
        jobService.getJobTypes(),
      ]);

      setJobs(jobsResponse.jobs);
      setTotal(jobsResponse.pagination.total);
      console.log("JobsPage - jobTypesData received:", jobTypesData);
      setJobTypes(jobTypesData);
    } catch (error) {
      console.error("Failed to load data:", error);
      enqueueSnackbar("작업 목록을 불러오는데 실패했습니다.", {
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [
    selectedJobType,
    enabledFilter,
    searchTerm,
    tagFilter,
    page,
    rowsPerPage,
  ]);

  // 태그 로딩
  const loadTags = useCallback(async () => {
    try {
      const tags = await tagService.list();
      setAllTags(tags);
    } catch (error) {
      console.error("Failed to load tags:", error);
    }
  }, []);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [selectedJobType, enabledFilter, searchTerm, tagFilter]);

  // Load data and tags
  useEffect(() => {
    console.log("JobsPage useEffect - loading data");
    loadData();
    loadTags();
  }, [loadData, loadTags]);

  // Handlers
  const handleSearch = () => {
    setPage(0); // Reset to first page
    // loadData will be called automatically by useEffect
  };

  const handleReset = () => {
    setSearchTerm("");
    setSelectedJobType("");
    setEnabledFilter("");
    setTagFilter([]);
    setPage(0); // Reset to first page
    // loadData will be called automatically by useEffect
  };

  // 태그 필터 변경 핸들러
  const handleTagFilterChange = useCallback((tags: Tag[]) => {
    setTagFilter(tags);
    setPage(0);
  }, []);

  // 페이지 변경 핸들러
  const handlePageChange = useCallback((_: unknown, newPage: number) => {
    setPage(newPage);
  }, []);

  // 페이지 크기 변경 핸들러
  const handleRowsPerPageChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const newRowsPerPage = parseInt(event.target.value, 10);
      setRowsPerPage(newRowsPerPage);
      setPage(0);
    },
    [],
  );

  const handleAddJob = () => {
    setEditingJob(null);
    setFormDialogOpen(true);
  };

  const handleEditJob = (job: Job) => {
    setEditingJob(job);
    setFormDialogOpen(true);
  };

  const handleDeleteJob = (job: Job) => {
    setJobToDelete(job);
    setDeleteDialogOpen(true);
  };

  const handleExecuteJob = async (job: Job) => {
    try {
      const result = await jobService.executeJob(job.id);
      enqueueSnackbar(
        t("jobs.executeStarted", {
          name: job.name,
          executionId: result.executionId,
        }),
        {
          variant: "success",
        },
      );
    } catch (error) {
      console.error("Failed to execute job:", error);
      enqueueSnackbar(t("common.jobExecuteFailed"), { variant: "error" });
    }
  };

  const handleViewHistory = (job: Job) => {
    setSelectedJobForHistory(job);
    setHistoryDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!jobToDelete) return;

    try {
      await jobService.deleteJob(jobToDelete.id);
      enqueueSnackbar(t("jobs.deleted", { name: jobToDelete.name }), {
        variant: "success",
      });
      setDeleteDialogOpen(false);
      setJobToDelete(null);
      loadData();
    } catch (error) {
      console.error("Failed to delete job:", error);
      enqueueSnackbar("작업 삭제에 실패했습니다.", { variant: "error" });
    }
  };

  const handleFormSubmit = async (data: any) => {
    try {
      if (editingJob) {
        await jobService.updateJob(editingJob.id, data);
        enqueueSnackbar(t("jobs.updated", { name: data.name }), {
          variant: "success",
        });
      } else {
        await jobService.createJob(data);
        enqueueSnackbar(t("jobs.created", { name: data.name }), {
          variant: "success",
        });
      }
      setFormDialogOpen(false);
      loadData();
    } catch (error: any) {
      console.error("Failed to save job:", error);

      // 409 에러 (이름 중복) 처리
      const status = error?.status || error?.response?.status;
      if (status === 409) {
        enqueueSnackbar(t("common.jobNameDuplicate"), { variant: "error" });
      } else {
        enqueueSnackbar(t("common.jobSaveFailed"), { variant: "error" });
      }
    }
  };

  const getStatusChip = (job: Job) => {
    if (!job.isEnabled) {
      return (
        <Chip label={t("common.unavailable")} color="default" size="small" />
      );
    }
    return <Chip label={t("common.usable")} color="success" size="small" />;
  };

  const getJobTypeLabel = (jobTypeId: number) => {
    const jobType = jobTypes.find((jt) => jt.id === jobTypeId);
    return jobType?.displayName || jobType?.name || "Unknown";
  };

  // 텍스트 길이 제한 함수
  const truncateText = (
    text: string | null | undefined,
    maxLength: number = 50,
  ) => {
    if (!text) return "-";
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  // Render cell content based on column ID
  const renderCellContent = (job: Job, columnId: string) => {
    switch (columnId) {
      case "jobName":
        return (
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {truncateText(job.name, 30)}
          </Typography>
        );
      case "jobType":
        return (
          <Chip
            label={getJobTypeLabel(job.jobTypeId)}
            size="small"
            color="primary"
            variant="outlined"
          />
        );
      case "schedule":
        return (
          <Typography variant="body2">{job.cronExpression || "-"}</Typography>
        );
      case "lastExecution":
        return (
          <Typography variant="body2">
            {job.lastExecutedAt
              ? formatDateTimeDetailed(job.lastExecutedAt)
              : "-"}
          </Typography>
        );
      case "nextExecution":
        return (
          <Typography variant="body2">
            {job.nextExecutionAt
              ? formatDateTimeDetailed(job.nextExecutionAt)
              : "-"}
          </Typography>
        );
      case "isEnabled":
        return getStatusChip(job);
      case "tags":
        return (
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
            {job.tags && job.tags.length > 0 ? (
              job.tags.map((tag) => (
                <Chip key={tag.id} label={tag.name} size="small" />
              ))
            ) : (
              <Typography variant="body2" color="text.secondary">
                -
              </Typography>
            )}
          </Box>
        );
      default:
        return null;
    }
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
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <WorkIcon sx={{ fontSize: 32, color: "primary.main" }} />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {t("jobs.title")}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t("jobs.description")}
            </Typography>
          </Box>
        </Box>
        {canManage && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddJob}
          >
            {t("jobs.addJob")}
          </Button>
        )}
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                fullWidth
                size="small"
                placeholder={t("common.search")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    height: "40px",
                    borderRadius: "20px",
                    bgcolor: "background.paper",
                    transition: "all 0.2s ease-in-out",
                    "& fieldset": {
                      borderColor: "divider",
                    },
                    "&:hover": {
                      bgcolor: "action.hover",
                      "& fieldset": {
                        borderColor: "primary.light",
                      },
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
                  "& .MuiInputBase-input": {
                    fontSize: "0.875rem",
                  },
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon
                        sx={{ color: "text.secondary", fontSize: 20 }}
                      />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 2 }}>
              <FormControl fullWidth size="small">
                <InputLabel shrink={true}>{t("jobs.jobType")}</InputLabel>
                <Select
                  value={selectedJobType}
                  onChange={(e) =>
                    setSelectedJobType(e.target.value as number | "")
                  }
                  label={t("jobs.jobType")}
                  displayEmpty
                  size="small"
                  MenuProps={{
                    PaperProps: {
                      style: {
                        zIndex: 9999,
                      },
                    },
                  }}
                  sx={{
                    minWidth: 120,
                    "& .MuiSelect-select": {
                      overflow: "visible",
                      textOverflow: "clip",
                      whiteSpace: "nowrap",
                    },
                  }}
                >
                  <MenuItem value="">{t("common.all")}</MenuItem>
                  {jobTypes.map((jobType) => (
                    <MenuItem key={jobType.id} value={jobType.id}>
                      {jobType.displayName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 2 }}>
              <FormControl fullWidth size="small">
                <InputLabel shrink={true}>{t("common.usable")}</InputLabel>
                <Select
                  value={enabledFilter}
                  onChange={(e) =>
                    setEnabledFilter(e.target.value as boolean | "")
                  }
                  label={t("common.usable")}
                  displayEmpty
                  size="small"
                  MenuProps={{
                    PaperProps: {
                      style: {
                        zIndex: 9999,
                      },
                    },
                  }}
                  sx={{
                    minWidth: 120,
                    "& .MuiSelect-select": {
                      overflow: "visible",
                      textOverflow: "clip",
                      whiteSpace: "nowrap",
                    },
                  }}
                >
                  <MenuItem value="">{t("common.all")}</MenuItem>
                  <MenuItem value={true}>{t("common.usable")}</MenuItem>
                  <MenuItem value={false}>{t("common.unavailable")}</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, md: 5 }}>
              {/* 태그 필터 */}
              <Autocomplete
                multiple
                sx={{ minWidth: 400 }}
                options={allTags}
                getOptionLabel={(option) => option.name}
                filterSelectedOptions
                value={tagFilter}
                onChange={(_, value) => handleTagFilterChange(value)}
                slotProps={{
                  popper: {
                    style: {
                      zIndex: 9999,
                    },
                  },
                }}
                renderValue={(value, getTagProps) =>
                  value.map((option, index) => {
                    const { key, ...chipProps } = getTagProps({ index });
                    return (
                      <Tooltip
                        key={option.id}
                        title={option.description || t("tags.noDescription")}
                        arrow
                      >
                        <Chip
                          variant="outlined"
                          label={option.name}
                          size="small"
                          sx={{
                            bgcolor: option.color,
                            color: getContrastColor(option.color),
                          }}
                          {...chipProps}
                        />
                      </Tooltip>
                    );
                  })
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={t("common.tags")}
                    size="small"
                  />
                )}
                renderOption={(props, option) => {
                  const { key, ...otherProps } = props;
                  return (
                    <Box component="li" key={key} {...otherProps}>
                      <Chip
                        label={option.name}
                        size="small"
                        sx={{
                          bgcolor: option.color,
                          color: getContrastColor(option.color),
                          mr: 1,
                        }}
                      />
                      {option.description || t("common.noDescription")}
                    </Box>
                  );
                }}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Column Settings Button */}
      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
        <Button
          startIcon={<ViewColumnIcon />}
          onClick={(e) => setColumnSettingsAnchor(e.currentTarget)}
          size="small"
        >
          {t("common.columnSettings")}
        </Button>
      </Box>

      {/* Jobs Table */}
      {loading ? (
        <Paper sx={{ p: 6, textAlign: "center" }}>
          <Typography color="text.secondary">
            {t("common.loadingJobs")}
          </Typography>
        </Paper>
      ) : jobs.length === 0 ? (
        <Paper sx={{ p: 0 }}>
          <EmptyState
            message={t("jobs.noJobsFound")}
            subtitle={canManage ? t("common.addFirstItem") : undefined}
            onAddClick={canManage ? handleAddJob : undefined}
            addButtonLabel={t("jobs.addJob")}
          />
        </Paper>
      ) : (
        <TableContainer
          component={Paper}
          sx={{
            maxWidth: "100%",
            overflow: "auto",
          }}
        >
          <Table sx={{ tableLayout: "auto" }}>
            <TableHead>
              <TableRow>
                {columns
                  .filter((col) => col.visible)
                  .map((column) => (
                    <TableCell key={column.id}>{t(column.labelKey)}</TableCell>
                  ))}
                {canManage && (
                  <TableCell align="right" sx={{ width: 150 }}>
                    {t("common.actions")}
                  </TableCell>
                )}
              </TableRow>
            </TableHead>
            <TableBody>
              {jobs.map((job, index) => (
                <TableRow
                  key={job.id}
                  sx={{
                    bgcolor:
                      index % 2 === 0
                        ? theme.palette.mode === "dark"
                          ? "rgba(255, 255, 255, 0.02)"
                          : "rgba(0, 0, 0, 0.02)"
                        : "transparent",
                  }}
                >
                  {columns
                    .filter((col) => col.visible)
                    .map((column) => (
                      <TableCell key={column.id}>
                        {renderCellContent(job, column.id)}
                      </TableCell>
                    ))}
                  {canManage && (
                    <TableCell align="right">
                      <Tooltip title={t("jobs.execute")}>
                        <IconButton
                          size="small"
                          onClick={() => handleExecuteJob(job)}
                          disabled={!job.isEnabled}
                        >
                          <ExecuteIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t("jobs.viewHistory")}>
                        <IconButton
                          size="small"
                          onClick={() => handleViewHistory(job)}
                        >
                          <HistoryIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t("common.edit")}>
                        <IconButton
                          size="small"
                          onClick={() => handleEditJob(job)}
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t("common.delete")}>
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteJob(job)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <SimplePagination
            count={total}
            page={page}
            rowsPerPage={rowsPerPage}
            onPageChange={handlePageChange}
            onRowsPerPageChange={handleRowsPerPageChange}
          />
        </TableContainer>
      )}

      {/* Job Form Drawer */}
      <Drawer
        anchor="right"
        open={formDialogOpen}
        onClose={() => setFormDialogOpen(false)}
        PaperProps={{
          sx: {
            width: { xs: "100%", sm: 700 },
            maxWidth: "100vw",
            display: "flex",
            flexDirection: "column",
          },
        }}
        ModalProps={{
          keepMounted: false,
        }}
      >
        {/* Header */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            p: 2,
            borderBottom: "1px solid",
            borderColor: "divider",
            bgcolor: "background.paper",
          }}
        >
          <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
            {editingJob ? t("jobs.editJob") : t("jobs.addJob")}
          </Typography>
          <IconButton
            onClick={() => setFormDialogOpen(false)}
            size="small"
            sx={{
              "&:hover": {
                backgroundColor: "action.hover",
              },
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, overflow: "auto" }}>
          <JobForm
            job={editingJob}
            jobTypes={jobTypes}
            onSubmit={handleFormSubmit}
            onCancel={() => setFormDialogOpen(false)}
            isDrawer={true}
          />
        </Box>
      </Drawer>

      {/* Job History Drawer */}
      <Drawer
        anchor="right"
        open={historyDialogOpen}
        onClose={() => setHistoryDialogOpen(false)}
        sx={{
          zIndex: 1301,
          "& .MuiDrawer-paper": {
            width: { xs: "100%", sm: 800 },
            maxWidth: "100vw",
            display: "flex",
            flexDirection: "column",
          },
        }}
      >
        {/* Header */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            p: 2,
            borderBottom: "1px solid",
            borderColor: "divider",
            bgcolor: "background.paper",
          }}
        >
          <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
            {t("jobs.executionHistory")} - {selectedJobForHistory?.name}
          </Typography>
          <IconButton
            onClick={() => setHistoryDialogOpen(false)}
            size="small"
            sx={{
              "&:hover": {
                backgroundColor: "action.hover",
              },
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, overflow: "auto", p: 2 }}>
          {selectedJobForHistory && (
            <JobExecutionHistory jobId={selectedJobForHistory.id} />
          )}
        </Box>

        {/* Footer */}
        <Box
          sx={{
            p: 2,
            borderTop: "1px solid",
            borderColor: "divider",
            bgcolor: "background.paper",
            display: "flex",
            gap: 2,
            justifyContent: "flex-end",
          }}
        >
          <Button
            onClick={() => setHistoryDialogOpen(false)}
            variant="outlined"
          >
            {t("common.close")}
          </Button>
        </Box>
      </Drawer>

      {/* Delete Confirmation Drawer */}
      <Drawer
        anchor="right"
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        sx={{
          zIndex: 1301,
          "& .MuiDrawer-paper": {
            width: { xs: "100%", sm: 400 },
            maxWidth: "100vw",
            display: "flex",
            flexDirection: "column",
          },
        }}
      >
        {/* Header */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            p: 2,
            borderBottom: "1px solid",
            borderColor: "divider",
            bgcolor: "background.paper",
          }}
        >
          <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
            {t("common.confirmDelete")}
          </Typography>
          <IconButton
            onClick={() => setDeleteDialogOpen(false)}
            size="small"
            sx={{
              "&:hover": {
                backgroundColor: "action.hover",
              },
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, p: 2 }}>
          <Typography>
            {t("jobs.confirmDeleteMessage", { name: jobToDelete?.name })}
          </Typography>
        </Box>

        {/* Footer */}
        <Box
          sx={{
            p: 2,
            borderTop: "1px solid",
            borderColor: "divider",
            bgcolor: "background.paper",
            display: "flex",
            gap: 2,
            justifyContent: "flex-end",
          }}
        >
          <Button onClick={() => setDeleteDialogOpen(false)} variant="outlined">
            {t("common.cancel")}
          </Button>
          <Button
            onClick={confirmDelete}
            color="error"
            variant="contained"
            startIcon={<DeleteIcon />}
          >
            {t("common.delete")}
          </Button>
        </Box>
      </Drawer>

      {/* Column Settings Dialog */}
      <ColumnSettingsDialog
        anchorEl={columnSettingsAnchor}
        onClose={() => setColumnSettingsAnchor(null)}
        columns={columns}
        onColumnsChange={handleColumnsChange}
        onReset={handleResetColumns}
      />
    </Box>
  );
};

export default JobsPage;
