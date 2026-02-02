import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  FormGroup,
  Switch,
  Button,
  Typography,
  Box,
  Divider,
  CircularProgress,
  IconButton,
} from "@mui/material";
import {
  Close as CloseIcon,
  Security as SecurityIcon,
  Visibility as VisibilityIcon,
  Message as MessageIcon,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { useSnackbar } from "notistack";

interface PrivacySettingsData {
  channelInvitePolicy: "everyone" | "contacts_only" | "nobody";
  directMessagePolicy: "everyone" | "contacts_only" | "nobody";
  discoverableByEmail: boolean;
  discoverableByName: boolean;
  requireFriendRequest: boolean;
}

interface PrivacySettingsProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
}

const PrivacySettings: React.FC<PrivacySettingsProps> = ({
  open,
  onClose,
  title,
  subtitle,
}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  const [settings, setSettings] = useState<PrivacySettingsData>({
    channelInvitePolicy: "everyone",
    directMessagePolicy: "everyone",
    discoverableByEmail: true,
    discoverableByName: true,
    requireFriendRequest: false,
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // 현재 설정 로드
  const loadSettings = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/v1/privacy/settings", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSettings(data.data);
        }
      }
    } catch (error) {
      console.error("Failed to load privacy settings:", error);
      enqueueSnackbar(t("chat.privacyLoadFailed"), { variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  // 설정 저장
  const saveSettings = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/v1/privacy/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          enqueueSnackbar(t("chat.privacySaveSuccess"), { variant: "success" });
          onClose();
        } else {
          enqueueSnackbar(data.error || t("chat.privacySaveFailed"), {
            variant: "error",
          });
        }
      } else {
        enqueueSnackbar(t("chat.privacySaveFailed"), { variant: "error" });
      }
    } catch (error) {
      console.error("Failed to save privacy settings:", error);
      enqueueSnackbar(t("chat.privacySaveFailed"), { variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  // 다이얼로그 열릴 때 설정 로드
  useEffect(() => {
    if (open) {
      loadSettings();
    }
  }, [open]);

  const handlePolicyChange = (
    field: keyof PrivacySettingsData,
    value: string,
  ) => {
    setSettings((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSwitchChange = (
    field: keyof PrivacySettingsData,
    checked: boolean,
  ) => {
    setSettings((prev) => ({
      ...prev,
      [field]: checked,
    }));
  };

  const getPolicyDescription = (policy: string) => {
    switch (policy) {
      case "everyone":
        return t("chat.privacyPolicyEveryoneDesc");
      case "contacts_only":
        return t("chat.privacyPolicyContactsDesc");
      case "nobody":
        return t("chat.privacyPolicyNobodyDesc");
      default:
        return "";
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box>
            <Box display="flex" alignItems="center" gap={1}>
              <SecurityIcon />
              <Typography variant="h6">
                {title || t("chat.privacySettings")}
              </Typography>
            </Box>
            {subtitle && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 0.5 }}
              >
                {subtitle}
              </Typography>
            )}
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        {loading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        ) : (
          <Box>
            {/* Channel Invitations */}
            <Box mb={3}>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <MessageIcon color="primary" />
                <Typography variant="h6">
                  {t("chat.channelInvitations")}
                </Typography>
              </Box>
              <FormControl component="fieldset">
                <FormLabel component="legend">
                  {t("chat.whoCanInviteChannels")}
                </FormLabel>
                <RadioGroup
                  value={settings.channelInvitePolicy}
                  onChange={(e) =>
                    handlePolicyChange("channelInvitePolicy", e.target.value)
                  }
                >
                  <FormControlLabel
                    value="everyone"
                    control={<Radio />}
                    label={t("chat.privacyPolicyEveryone")}
                  />
                  <FormControlLabel
                    value="contacts_only"
                    control={<Radio />}
                    label={t("chat.privacyPolicyContacts")}
                    disabled // TODO: Enable when contact system is implemented
                  />
                  <FormControlLabel
                    value="nobody"
                    control={<Radio />}
                    label={t("chat.privacyPolicyNobody")}
                  />
                </RadioGroup>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ mt: 1 }}
                >
                  {getPolicyDescription(settings.channelInvitePolicy)}
                </Typography>
              </FormControl>
            </Box>

            <Divider />

            {/* Direct Messages */}
            <Box my={3}>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <MessageIcon color="primary" />
                <Typography variant="h6">{t("chat.directMessages")}</Typography>
              </Box>
              <FormControl component="fieldset">
                <FormLabel component="legend">
                  {t("chat.whoCanStartDirectMessages")}
                </FormLabel>
                <RadioGroup
                  value={settings.directMessagePolicy}
                  onChange={(e) =>
                    handlePolicyChange("directMessagePolicy", e.target.value)
                  }
                >
                  <FormControlLabel
                    value="everyone"
                    control={<Radio />}
                    label={t("chat.privacyPolicyEveryone")}
                  />
                  <FormControlLabel
                    value="contacts_only"
                    control={<Radio />}
                    label={t("chat.privacyPolicyContacts")}
                    disabled // TODO: Enable when contact system is implemented
                  />
                  <FormControlLabel
                    value="nobody"
                    control={<Radio />}
                    label={t("chat.privacyPolicyNobody")}
                  />
                </RadioGroup>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ mt: 1 }}
                >
                  {getPolicyDescription(settings.directMessagePolicy)}
                </Typography>
              </FormControl>
            </Box>

            <Divider />

            {/* Discovery Settings */}
            <Box mt={3}>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <VisibilityIcon color="primary" />
                <Typography variant="h6">
                  {t("chat.discoverySettings")}
                </Typography>
              </Box>
              <FormGroup>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.discoverableByEmail}
                      onChange={(e) =>
                        handleSwitchChange(
                          "discoverableByEmail",
                          e.target.checked,
                        )
                      }
                    />
                  }
                  label={t("chat.allowFindByEmail")}
                />
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ ml: 4, mb: 2 }}
                >
                  {t("chat.allowFindByEmailDesc")}
                </Typography>

                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.discoverableByName}
                      onChange={(e) =>
                        handleSwitchChange(
                          "discoverableByName",
                          e.target.checked,
                        )
                      }
                    />
                  }
                  label={t("chat.allowFindByName")}
                />
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ ml: 4 }}
                >
                  {t("chat.allowFindByNameDesc")}
                </Typography>
              </FormGroup>
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          {t("common.cancel")}
        </Button>
        <Button
          variant="contained"
          onClick={saveSettings}
          disabled={loading || saving}
          startIcon={saving ? <CircularProgress size={16} /> : null}
        >
          {saving ? t("chat.privacySaving") : t("chat.privacySaveSettings")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PrivacySettings;
