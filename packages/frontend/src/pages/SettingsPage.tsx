import React, { useMemo, useState, useEffect } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Stack,
  TextField,
  Autocomplete,
  MenuItem,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import moment from "moment-timezone";
import {
  getStoredTimezone,
  getStoredDateTimeFormat,
  setStoredTimezone,
  setStoredDateTimeFormat,
} from "@/utils/dateFormat";
import { useI18n, getLanguageDisplayName } from "@/contexts/I18nContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { AuthService } from "@/services/auth";
import { useSnackbar } from "notistack";

const formatPresets = [
  "YYYY-MM-DD HH:mm:ss",
  "YYYY/MM/DD HH:mm",
  "YYYY.MM.DD HH:mm:ss",
  "YYYY-MM-DD",
  "MM/DD/YYYY HH:mm",
  "DD/MM/YYYY HH:mm:ss",
];

// General Settings Page - accessible to all users
const SettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const { language, changeLanguage, supportedLanguages } = useI18n();
  const { mode, setTheme } = useTheme();
  const { user, refreshAuth } = useAuth();
  const { enqueueSnackbar } = useSnackbar();

  const tzOptions = useMemo(() => moment.tz.names(), []);
  const [timezone, setTimezone] = useState<string>(getStoredTimezone());
  const [dtFormat, setDtFormat] = useState<string>(getStoredDateTimeFormat());
  const [preview, setPreview] = useState<string>("");

  useEffect(() => {
    const now = new Date();
    setPreview(moment(now).tz(timezone).format(dtFormat));
  }, [timezone, dtFormat]);

  // Format timezone with UTC offset
  const formatTimezone = (tz: string) => {
    const offset = moment.tz(tz).format("Z");
    return `${tz} (UTC${offset})`;
  };

  // Auto-save on change
  useEffect(() => {
    setStoredTimezone(timezone);
  }, [timezone]);
  useEffect(() => {
    setStoredDateTimeFormat(dtFormat);
  }, [dtFormat]);

  // Update preview
  useEffect(() => {
    const now = moment().tz(timezone);
    setPreview(now.format(dtFormat));
  }, [timezone, dtFormat]);

  // Save language preference to user profile
  const handleLanguageChange = async (newLanguage: string) => {
    try {
      // Update UI immediately
      changeLanguage(newLanguage as any);

      // Save to backend if user is logged in
      if (user) {
        await AuthService.updateProfile({ preferredLanguage: newLanguage });
        await refreshAuth(); // Refresh user data
        enqueueSnackbar(t("settings.languageSaved"), { variant: "success" });
      }
    } catch (error: any) {
      enqueueSnackbar(error.message || t("settings.languageSaveFailed"), {
        variant: "error",
      });
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
          {t("settings.general.title")}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {t("settings.general.subtitle")}
        </Typography>
      </Box>

      <Card>
        <CardContent>
          <Stack spacing={2} sx={{ maxWidth: 560 }}>
            {/* Language */}
            <Autocomplete
              options={supportedLanguages}
              getOptionLabel={(opt) => getLanguageDisplayName(opt)}
              value={language}
              onChange={(_, v) => v && handleLanguageChange(v)}
              renderInput={(params) => (
                <TextField {...params} label={t("language.changeLanguage")} />
              )}
            />

            {/* Theme */}
            <TextField
              select
              label={t("theme")}
              value={mode}
              onChange={(e) => setTheme(e.target.value as any)}
            >
              <MenuItem value="light">Light</MenuItem>
              <MenuItem value="dark">Dark</MenuItem>
              <MenuItem value="auto">Auto</MenuItem>
            </TextField>

            {/* Timezone */}
            <Autocomplete
              options={tzOptions}
              value={timezone}
              onChange={(_, v) => v && setTimezone(v)}
              getOptionLabel={formatTimezone}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Timezone"
                  placeholder="Search timezone"
                />
              )}
              renderOption={(props, option) => (
                <li {...props}>
                  <Box>
                    <Typography variant="body2">{option}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      UTC{moment.tz(option).format("Z")}
                    </Typography>
                  </Box>
                </li>
              )}
            />

            {/* Datetime format */}
            <Autocomplete
              freeSolo
              options={formatPresets}
              value={dtFormat}
              onChange={(_, v) => v && setDtFormat(v)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Datetime Format"
                  placeholder="e.g. YYYY-MM-DD HH:mm:ss"
                  onChange={(e) => setDtFormat(e.target.value)}
                />
              )}
            />

            {/* Preview */}
            <Typography variant="body2" color="text.secondary">
              Preview: {preview}
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
};

export default SettingsPage;
