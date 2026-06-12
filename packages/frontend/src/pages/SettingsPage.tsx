import React, { useMemo, useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Stack,
  TextField,
  Autocomplete,
  MenuItem,
  Divider,
  useTheme,
  alpha,
} from '@mui/material';
import {
  AccessTime as AccessTimeIcon,
  Public as PublicIcon,
  Timer as TimerIcon,
  Speed as SpeedIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import dayjsTimezone from 'dayjs/plugin/timezone';
import {
  getStoredTimezone,
  getStoredDateTimeFormat,
  setStoredTimezone,
  setStoredDateTimeFormat,
  formatDateTimeDetailed,
  formatUptime,
} from '@/utils/dateFormat';
import { useI18n, getLanguageDisplayName } from '@/contexts/I18nContext';
import { useTheme as useAppTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { AuthService } from '@/services/auth';
import { useSnackbar } from 'notistack';
import PageContentLoader from '@/components/common/PageContentLoader';
import PageHeader from '@/components/common/PageHeader';
import { timeService, ServerTimeData } from '@/services/timeService';

dayjs.extend(utc);
dayjs.extend(dayjsTimezone);

const formatPresets = [
  'YYYY-MM-DD HH:mm:ss',
  'YYYY/MM/DD HH:mm',
  'YYYY.MM.DD HH:mm:ss',
  'YYYY-MM-DD',
  'MM/DD/YYYY HH:mm',
  'DD/MM/YYYY HH:mm:ss',
];

/** Small info row used in the Server Info card */
const InfoRow: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}> = ({ icon, label, value }) => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        py: 0.75,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 28,
          height: 28,
          borderRadius: '6px',
          bgcolor:
            theme.palette.mode === 'dark'
              ? alpha(theme.palette.primary.main, 0.12)
              : alpha(theme.palette.primary.main, 0.08),
          color: theme.palette.primary.main,
          flexShrink: 0,
          '& .MuiSvgIcon-root': { fontSize: 16 },
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ fontSize: '0.7rem', lineHeight: 1.2 }}
        >
          {label}
        </Typography>
        <Typography
          variant="body2"
          sx={{ fontWeight: 500, fontSize: '0.85rem', lineHeight: 1.3 }}
        >
          {value}
        </Typography>
      </Box>
    </Box>
  );
};

// General Settings Page - accessible to all users
const SettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const { language, changeLanguage, supportedLanguages } = useI18n();
  const { mode, setTheme: setAppTheme } = useAppTheme();
  const { user, refreshAuth } = useAuth();
  const { enqueueSnackbar } = useSnackbar();

  const tzOptions = useMemo(() => Intl.supportedValuesOf('timeZone'), []);
  const [timezone, setTimezone] = useState<string>(getStoredTimezone());
  const [dtFormat, setDtFormat] = useState<string>(getStoredDateTimeFormat());

  // Server time state (migrated from TimezoneSelector)
  const [serverTime, setServerTime] = useState<Date>(new Date());
  const [serverTimeData, setServerTimeData] = useState<ServerTimeData | null>(
    null
  );
  const [currentUptime, setCurrentUptime] = useState<number>(0);

  // Server time sync
  useEffect(() => {
    timeService.startSync();

    const handleServerTimeUpdate = (data: ServerTimeData) => {
      setServerTimeData(data);
    };

    timeService.addListener(handleServerTimeUpdate);

    const interval = setInterval(() => {
      setServerTime(timeService.getCurrentServerTime());
      setCurrentUptime(timeService.getCurrentUptime());
    }, 1000);

    return () => {
      timeService.stopSync();
      timeService.removeListener(handleServerTimeUpdate);
      clearInterval(interval);
    };
  }, []);

  // Format timezone with UTC offset
  const formatTimezone = (tz: string) => {
    const offset = dayjs().tz(tz).format('Z');
    return `${tz} (UTC${offset})`;
  };

  // Auto-save on change
  useEffect(() => {
    setStoredTimezone(timezone);
  }, [timezone]);
  useEffect(() => {
    setStoredDateTimeFormat(dtFormat);
  }, [dtFormat]);

  // Save language preference to user profile
  const handleLanguageChange = async (newLanguage: string) => {
    try {
      changeLanguage(newLanguage as any);

      if (user) {
        await AuthService.updateProfile({ preferredLanguage: newLanguage });
        await refreshAuth();
        enqueueSnackbar(t('settings.languageSaved'), { variant: 'success' });
      }
    } catch (error: any) {
      enqueueSnackbar(error.message || t('settings.languageSaveFailed'), {
        variant: 'error',
      });
    }
  };

  return (
    <PageContentLoader loading={false}>
      <Box>
        <PageHeader
          title={t('settings.general.title')}
          subtitle={t('settings.general.subtitle')}
        />

        <Stack spacing={2} sx={{ maxWidth: 640 }}>
          {/* General Settings Card */}
          <Card>
            <CardContent>
              <Stack spacing={2}>
                {/* Language */}
                <Autocomplete
                  options={supportedLanguages}
                  getOptionLabel={(opt) => getLanguageDisplayName(opt)}
                  value={language}
                  onChange={(_, v) => v && handleLanguageChange(v)}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label={t('language.changeLanguage')}
                    />
                  )}
                />

                {/* Theme */}
                <TextField
                  select
                  label={t('theme')}
                  value={mode}
                  onChange={(e) => setAppTheme(e.target.value as any)}
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
                          UTC{dayjs().tz(option).format('Z')}
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
              </Stack>
            </CardContent>
          </Card>

          {/* Server Info Card (migrated from TimezoneSelector popover) */}
          <Card>
            <CardContent>
              <Typography
                variant="subtitle2"
                sx={{ fontWeight: 700, mb: 1.5 }}
              >
                {t('settings.serverInfo', 'Server Info')}
              </Typography>
              <Divider sx={{ mb: 1.5 }} />

              <Stack spacing={0.5}>
                {/* Local time */}
                <InfoRow
                  icon={<AccessTimeIcon />}
                  label={t('common.currentLocalTime')}
                  value={formatDateTimeDetailed(new Date())}
                />

                {/* Server time */}
                <InfoRow
                  icon={<PublicIcon />}
                  label={t('common.serverTime')}
                  value={
                    <>
                      {formatDateTimeDetailed(serverTime)}
                      {serverTimeData && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ ml: 1 }}
                        >
                          ({t('common.ping')}: {serverTimeData.ping}ms)
                        </Typography>
                      )}
                    </>
                  }
                />

                {/* Server uptime */}
                {serverTimeData && (
                  <InfoRow
                    icon={<TimerIcon />}
                    label={t('common.serverUptime')}
                    value={formatUptime(currentUptime)}
                  />
                )}

                {/* Ping */}
                {serverTimeData && (
                  <InfoRow
                    icon={<SpeedIcon />}
                    label={t('common.ping', 'Ping')}
                    value={`${serverTimeData.ping}ms`}
                  />
                )}
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Box>
    </PageContentLoader>
  );
};

export default SettingsPage;
