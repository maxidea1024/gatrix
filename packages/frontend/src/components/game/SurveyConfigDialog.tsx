import React, { useState, useEffect } from "react";
import {
  AppBar,
  Toolbar,
  Button,
  TextField,
  Box,
  Typography,
  IconButton,
} from "@mui/material";
import { Close as CloseIcon } from "@mui/icons-material";
import ResizableDrawer from "../common/ResizableDrawer";
import { useTranslation } from "react-i18next";
import { useSnackbar } from "notistack";
import surveyService, { SurveyConfig } from "../../services/surveyService";

interface SurveyConfigDialogProps {
  open: boolean;
  onClose: () => void;
}

const SurveyConfigDialog: React.FC<SurveyConfigDialogProps> = ({
  open,
  onClose,
}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  const [config, setConfig] = useState<SurveyConfig>({
    baseSurveyUrl: "",
    baseJoinedUrl: "",
    linkCaption: "",
    joinedSecretKey: "",
  });
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Load config
  useEffect(() => {
    if (open) {
      loadConfig();
    }
  }, [open]);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const data = await surveyService.getSurveyConfig();
      setConfig(data);
    } catch (error: any) {
      enqueueSnackbar(error.message || t("surveys.configLoadFailed"), {
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      await surveyService.updateSurveyConfig(config);
      enqueueSnackbar(t("surveys.configUpdateSuccess"), { variant: "success" });
      onClose();
    } catch (error: any) {
      enqueueSnackbar(error.message || t("surveys.configUpdateFailed"), {
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
      defaultWidth={600}
      minWidth={400}
      maxWidth={1200}
    >
      {/* Header */}
      <AppBar position="static" color="default" elevation={0}>
        <Toolbar>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6">{t("surveys.config")}</Typography>
            <Typography variant="body2" color="text.secondary">
              {t("surveys.configSubtitle")}
            </Typography>
          </Box>
          <IconButton edge="end" onClick={onClose} sx={{ ml: 2 }}>
            <CloseIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* Content */}
      <Box sx={{ p: 3, flexGrow: 1, overflow: "auto" }}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <TextField
            label={t("surveys.baseSurveyUrl")}
            value={config.baseSurveyUrl}
            onChange={(e) =>
              setConfig({ ...config, baseSurveyUrl: e.target.value })
            }
            fullWidth
            disabled={loading}
            helperText={t("surveys.baseSurveyUrlHelp")}
          />
          <TextField
            label={t("surveys.baseJoinedUrl")}
            value={config.baseJoinedUrl}
            onChange={(e) =>
              setConfig({ ...config, baseJoinedUrl: e.target.value })
            }
            fullWidth
            disabled={loading}
            helperText={t("surveys.baseJoinedUrlHelp")}
          />
          <TextField
            label={t("surveys.linkCaption")}
            value={config.linkCaption}
            onChange={(e) =>
              setConfig({ ...config, linkCaption: e.target.value })
            }
            fullWidth
            disabled={loading}
            helperText={t("surveys.linkCaptionHelp")}
          />
          <TextField
            label={t("surveys.joinedSecretKey")}
            value={config.joinedSecretKey}
            onChange={(e) =>
              setConfig({ ...config, joinedSecretKey: e.target.value })
            }
            fullWidth
            disabled={loading}
            helperText={t("surveys.joinedSecretKeyHelp")}
            type="password"
          />
        </Box>
      </Box>

      {/* Footer */}
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
        <Button onClick={onClose} disabled={submitting}>
          {t("common.cancel")}
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading || submitting}
        >
          {submitting ? t("common.saving") : t("common.save")}
        </Button>
      </Box>
    </ResizableDrawer>
  );
};

export default SurveyConfigDialog;
