import React, { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Box,
  Typography,
  Alert,
  CircularProgress,
  Divider,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";
import {
  ExpandMore as ExpandMoreIcon,
  ContentCopy as CopyIcon,
  Warning as WarningIcon,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { useSnackbar } from "notistack";
import {
  Environment,
  CopyOptions,
  CopyPreview,
  CopyResult,
  environmentService,
} from "../services/environmentService";

interface EnvironmentCopyDialogProps {
  open: boolean;
  onClose: () => void;
  environments: Environment[];
  onCopyComplete?: () => void;
}

export const EnvironmentCopyDialog: React.FC<EnvironmentCopyDialogProps> = ({
  open,
  onClose,
  environments,
  onCopyComplete,
}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  const [sourceId, setSourceId] = useState<string>("");
  const [targetId, setTargetId] = useState<string>("");
  const [options, setOptions] = useState<CopyOptions>({
    copyTemplates: true,
    copyGameWorlds: true,
    copySegments: true,
    copyBanners: true,
    copyClientVersions: true,
    copyCoupons: true,
    copyIngamePopupNotices: true,
    copyMessageTemplates: true,
    copyRewardTemplates: true,
    copyServiceMaintenance: true,
    copyServiceNotices: true,
    copySurveys: true,
    copyVars: true,
    copyContextFields: true,
    copyCampaigns: true,
    copyAccountWhitelist: true,
    copyIpWhitelist: true,
    copyJobs: true,
    copyPlanningData: true,
    overwriteExisting: false,
  });
  const [preview, setPreview] = useState<CopyPreview | null>(null);
  const [result, setResult] = useState<CopyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [copying, setCopying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSourceId("");
      setTargetId("");
      setOptions({
        copyTemplates: true,
        copyGameWorlds: true,
        copySegments: true,
        copyBanners: true,
        copyClientVersions: true,
        copyCoupons: true,
        copyIngamePopupNotices: true,
        copyMessageTemplates: true,
        copyRewardTemplates: true,
        copyServiceMaintenance: true,
        copyServiceNotices: true,
        copySurveys: true,
        copyVars: true,
        copyContextFields: true,
        copyCampaigns: true,
        copyAccountWhitelist: true,
        copyIpWhitelist: true,
        copyJobs: true,
        copyPlanningData: true,
        overwriteExisting: false,
      });
      setPreview(null);
      setResult(null);
      setError(null);
    }
  }, [open]);

  // Load preview when source and target are selected
  const loadPreview = useCallback(async () => {
    if (!sourceId || !targetId || sourceId === targetId) {
      setPreview(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const previewData = await environmentService.getCopyPreview(
        sourceId,
        targetId,
      );
      setPreview(previewData);
    } catch (err) {
      setError(t("environments.copyFailed"));
      console.error("Failed to load preview:", err);
    } finally {
      setLoading(false);
    }
  }, [sourceId, targetId, t]);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  const handleCopy = async () => {
    if (!sourceId || !targetId) return;

    setCopying(true);
    setError(null);
    try {
      const copyResult = await environmentService.copyEnvironmentData(
        sourceId,
        targetId,
        options,
      );
      setResult(copyResult);
      enqueueSnackbar(t("environments.copyCompleted"), { variant: "success" });
      onCopyComplete?.();
    } catch (err) {
      setError(t("environments.copyFailed"));
      enqueueSnackbar(t("environments.copyFailed"), { variant: "error" });
    } finally {
      setCopying(false);
    }
  };

  const handleClose = () => {
    if (!copying) {
      onClose();
    }
  };

  const canCopy =
    sourceId && targetId && sourceId !== targetId && !loading && !copying;
  const hasData =
    preview &&
    (preview.summary.templates.total > 0 ||
      preview.summary.gameWorlds.total > 0 ||
      preview.summary.segments.total > 0 ||
      preview.summary.banners.total > 0 ||
      preview.summary.clientVersions.total > 0 ||
      preview.summary.coupons.total > 0 ||
      preview.summary.ingamePopupNotices.total > 0 ||
      preview.summary.messageTemplates.total > 0 ||
      preview.summary.rewardTemplates.total > 0 ||
      preview.summary.serviceMaintenance.total > 0 ||
      preview.summary.serviceNotices.total > 0 ||
      preview.summary.surveys.total > 0 ||
      preview.summary.vars.total > 0 ||
      preview.summary.contextFields.total > 0 ||
      preview.summary.campaigns.total > 0);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <CopyIcon />
          {t("environments.copyEnvironment")}
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {t("environments.copyEnvironmentDescription")}
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Environment Selection */}
        <Box sx={{ display: "flex", gap: 2, mb: 3 }}>
          <FormControl fullWidth>
            <InputLabel>{t("environments.sourceEnvironment")}</InputLabel>
            <Select
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
              label={t("environments.sourceEnvironment")}
              disabled={copying}
            >
              {environments.map((env) => (
                <MenuItem
                  key={env.environment}
                  value={env.environment}
                  disabled={env.environment === targetId}
                >
                  {env.displayName}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel>{t("environments.targetEnvironment")}</InputLabel>
            <Select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              label={t("environments.targetEnvironment")}
              disabled={copying}
            >
              {environments.map((env) => (
                <MenuItem
                  key={env.environment}
                  value={env.environment}
                  disabled={env.environment === sourceId}
                >
                  {env.displayName}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {sourceId === targetId && sourceId !== "" && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {t("environments.sameEnvironmentError")}
          </Alert>
        )}

        {/* Copy Options */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            {t("environments.copyOptions")}
          </Typography>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 0.5,
            }}
          >
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={options.copyTemplates}
                  onChange={(e) =>
                    setOptions({ ...options, copyTemplates: e.target.checked })
                  }
                  disabled={copying}
                />
              }
              label={
                <Typography variant="body2">
                  {t("environments.copyTemplates")}
                </Typography>
              }
            />
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={options.copyGameWorlds}
                  onChange={(e) =>
                    setOptions({ ...options, copyGameWorlds: e.target.checked })
                  }
                  disabled={copying}
                />
              }
              label={
                <Typography variant="body2">
                  {t("environments.copyGameWorlds")}
                </Typography>
              }
            />
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={options.copySegments}
                  onChange={(e) =>
                    setOptions({ ...options, copySegments: e.target.checked })
                  }
                  disabled={copying}
                />
              }
              label={
                <Typography variant="body2">
                  {t("environments.copySegments")}
                </Typography>
              }
            />
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={options.copyBanners}
                  onChange={(e) =>
                    setOptions({ ...options, copyBanners: e.target.checked })
                  }
                  disabled={copying}
                />
              }
              label={
                <Typography variant="body2">
                  {t("environments.copyBanners")}
                </Typography>
              }
            />
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={options.copyClientVersions}
                  onChange={(e) =>
                    setOptions({
                      ...options,
                      copyClientVersions: e.target.checked,
                    })
                  }
                  disabled={copying}
                />
              }
              label={
                <Typography variant="body2">
                  {t("environments.copyClientVersions")}
                </Typography>
              }
            />
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={options.copyCoupons}
                  onChange={(e) =>
                    setOptions({ ...options, copyCoupons: e.target.checked })
                  }
                  disabled={copying}
                />
              }
              label={
                <Typography variant="body2">
                  {t("environments.copyCoupons")}
                </Typography>
              }
            />
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={options.copyIngamePopupNotices}
                  onChange={(e) =>
                    setOptions({
                      ...options,
                      copyIngamePopupNotices: e.target.checked,
                    })
                  }
                  disabled={copying}
                />
              }
              label={
                <Typography variant="body2">
                  {t("environments.copyIngamePopupNotices")}
                </Typography>
              }
            />
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={options.copyMessageTemplates}
                  onChange={(e) =>
                    setOptions({
                      ...options,
                      copyMessageTemplates: e.target.checked,
                    })
                  }
                  disabled={copying}
                />
              }
              label={
                <Typography variant="body2">
                  {t("environments.copyMessageTemplates")}
                </Typography>
              }
            />
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={options.copyRewardTemplates}
                  onChange={(e) =>
                    setOptions({
                      ...options,
                      copyRewardTemplates: e.target.checked,
                    })
                  }
                  disabled={copying}
                />
              }
              label={
                <Typography variant="body2">
                  {t("environments.copyRewardTemplates")}
                </Typography>
              }
            />
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={options.copyServiceMaintenance}
                  onChange={(e) =>
                    setOptions({
                      ...options,
                      copyServiceMaintenance: e.target.checked,
                    })
                  }
                  disabled={copying}
                />
              }
              label={
                <Typography variant="body2">
                  {t("environments.copyServiceMaintenance")}
                </Typography>
              }
            />
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={options.copyServiceNotices}
                  onChange={(e) =>
                    setOptions({
                      ...options,
                      copyServiceNotices: e.target.checked,
                    })
                  }
                  disabled={copying}
                />
              }
              label={
                <Typography variant="body2">
                  {t("environments.copyServiceNotices")}
                </Typography>
              }
            />
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={options.copySurveys}
                  onChange={(e) =>
                    setOptions({ ...options, copySurveys: e.target.checked })
                  }
                  disabled={copying}
                />
              }
              label={
                <Typography variant="body2">
                  {t("environments.copySurveys")}
                </Typography>
              }
            />
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={options.copyVars}
                  onChange={(e) =>
                    setOptions({ ...options, copyVars: e.target.checked })
                  }
                  disabled={copying}
                />
              }
              label={
                <Typography variant="body2">
                  {t("environments.copyVars")}
                </Typography>
              }
            />
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={options.copyContextFields}
                  onChange={(e) =>
                    setOptions({
                      ...options,
                      copyContextFields: e.target.checked,
                    })
                  }
                  disabled={copying}
                />
              }
              label={
                <Typography variant="body2">
                  {t("environments.copyContextFields")}
                </Typography>
              }
            />
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={options.copyCampaigns}
                  onChange={(e) =>
                    setOptions({ ...options, copyCampaigns: e.target.checked })
                  }
                  disabled={copying}
                />
              }
              label={
                <Typography variant="body2">
                  {t("environments.copyCampaigns")}
                </Typography>
              }
            />
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={options.copyAccountWhitelist}
                  onChange={(e) =>
                    setOptions({
                      ...options,
                      copyAccountWhitelist: e.target.checked,
                    })
                  }
                  disabled={copying}
                />
              }
              label={
                <Typography variant="body2">
                  {t("environments.copyAccountWhitelist")}
                </Typography>
              }
            />
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={options.copyIpWhitelist}
                  onChange={(e) =>
                    setOptions({
                      ...options,
                      copyIpWhitelist: e.target.checked,
                    })
                  }
                  disabled={copying}
                />
              }
              label={
                <Typography variant="body2">
                  {t("environments.copyIpWhitelist")}
                </Typography>
              }
            />
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={options.copyJobs}
                  onChange={(e) =>
                    setOptions({ ...options, copyJobs: e.target.checked })
                  }
                  disabled={copying}
                />
              }
              label={
                <Typography variant="body2">
                  {t("environments.copyJobs")}
                </Typography>
              }
            />
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={options.copyPlanningData}
                  onChange={(e) =>
                    setOptions({
                      ...options,
                      copyPlanningData: e.target.checked,
                    })
                  }
                  disabled={copying}
                />
              }
              label={
                <Typography variant="body2">
                  {t("environments.copyPlanningData")}
                </Typography>
              }
            />
          </Box>
          <Divider sx={{ my: 1 }} />
          <FormControlLabel
            control={
              <Checkbox
                checked={options.overwriteExisting}
                onChange={(e) =>
                  setOptions({
                    ...options,
                    overwriteExisting: e.target.checked,
                  })
                }
                disabled={copying}
              />
            }
            label={
              <Box>
                <Typography variant="body2">
                  {t("environments.overwriteExisting")}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t("environments.overwriteExistingDescription")}
                </Typography>
              </Box>
            }
          />
        </Box>

        {/* Preview Section */}
        {loading && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
            <CircularProgress size={24} />
            <Typography sx={{ ml: 2 }}>
              {t("environments.loadingPreview")}
            </Typography>
          </Box>
        )}

        {preview && !result && (
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              {t("environments.preview")}
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t("common.type")}</TableCell>
                  <TableCell align="right">{t("common.total")}</TableCell>
                  <TableCell align="right">
                    {t("environments.conflicts")}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {[
                  { key: "templates", label: "copyTemplates" },
                  { key: "gameWorlds", label: "copyGameWorlds" },
                  { key: "segments", label: "copySegments" },
                  { key: "banners", label: "copyBanners" },
                  { key: "clientVersions", label: "copyClientVersions" },
                  { key: "coupons", label: "copyCoupons" },
                  {
                    key: "ingamePopupNotices",
                    label: "copyIngamePopupNotices",
                  },
                  { key: "messageTemplates", label: "copyMessageTemplates" },
                  { key: "rewardTemplates", label: "copyRewardTemplates" },
                  {
                    key: "serviceMaintenance",
                    label: "copyServiceMaintenance",
                  },
                  { key: "serviceNotices", label: "copyServiceNotices" },
                  { key: "surveys", label: "copySurveys" },
                  { key: "vars", label: "copyVars" },
                  { key: "contextFields", label: "copyContextFields" },
                  { key: "campaigns", label: "copyCampaigns" },
                  { key: "accountWhitelist", label: "copyAccountWhitelist" },
                  { key: "ipWhitelist", label: "copyIpWhitelist" },
                  { key: "jobs", label: "copyJobs" },
                  { key: "planningData", label: "copyPlanningData" },
                ].map(({ key, label }) => {
                  const summary =
                    preview.summary[key as keyof typeof preview.summary];
                  if (!summary || summary.total === 0) return null;
                  return (
                    <TableRow key={key}>
                      <TableCell>{t(`environments.${label}`)}</TableCell>
                      <TableCell align="right">{summary.total}</TableCell>
                      <TableCell align="right">
                        {summary.conflicts > 0 ? (
                          <Chip
                            size="small"
                            color="warning"
                            icon={<WarningIcon />}
                            label={summary.conflicts}
                          />
                        ) : (
                          <Chip
                            size="small"
                            color="success"
                            label={t("environments.noConflicts")}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
        )}

        {/* Result Section */}
        {result && (
          <Alert severity="success" sx={{ mt: 2 }}>
            <Typography variant="subtitle2">
              {t("environments.copyResult")}
            </Typography>
            <Box
              sx={{
                mt: 1,
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: 0.5,
              }}
            >
              {[
                { key: "templates", label: "copyTemplates" },
                { key: "gameWorlds", label: "copyGameWorlds" },
                { key: "segments", label: "copySegments" },
                { key: "banners", label: "copyBanners" },
                { key: "clientVersions", label: "copyClientVersions" },
                { key: "coupons", label: "copyCoupons" },
                { key: "ingamePopupNotices", label: "copyIngamePopupNotices" },
                { key: "messageTemplates", label: "copyMessageTemplates" },
                { key: "rewardTemplates", label: "copyRewardTemplates" },
                { key: "serviceMaintenance", label: "copyServiceMaintenance" },
                { key: "serviceNotices", label: "copyServiceNotices" },
                { key: "surveys", label: "copySurveys" },
                { key: "vars", label: "copyVars" },
                { key: "contextFields", label: "copyContextFields" },
                { key: "campaigns", label: "copyCampaigns" },
                { key: "accountWhitelist", label: "copyAccountWhitelist" },
                { key: "ipWhitelist", label: "copyIpWhitelist" },
                { key: "jobs", label: "copyJobs" },
                { key: "planningData", label: "copyPlanningData" },
              ].map(({ key, label }) => {
                const item = result[key as keyof typeof result];
                if (!item || (item.copied === 0 && item.skipped === 0))
                  return null;
                return (
                  <Typography key={key} variant="body2">
                    {t(`environments.${label}`)}: {item.copied}{" "}
                    {t("environments.copied")}, {item.skipped}{" "}
                    {t("environments.skipped")}
                  </Typography>
                );
              })}
            </Box>
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={copying}>
          {t("common.close")}
        </Button>
        {!result && (
          <Button
            onClick={handleCopy}
            variant="contained"
            disabled={!canCopy || !hasData}
            startIcon={copying ? <CircularProgress size={20} /> : <CopyIcon />}
          >
            {copying
              ? t("environments.copyInProgress")
              : t("environments.copyEnvironment")}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default EnvironmentCopyDialog;
