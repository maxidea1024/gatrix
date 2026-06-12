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
  Tabs,
  Tab,
} from '@mui/material';

import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import dayjsTimezone from 'dayjs/plugin/timezone';
import {
  getStoredTimezone,
  getStoredDateTimeFormat,
  setStoredTimezone,
  setStoredDateTimeFormat,
  formatUptime,
  formatDuration,
} from '@/utils/dateFormat';
import { useI18n, getLanguageDisplayName } from '@/contexts/I18nContext';
import { useTheme as useAppTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { AuthService } from '@/services/auth';
import { useSnackbar } from 'notistack';
import PageContentLoader from '@/components/common/PageContentLoader';
import PageHeader from '@/components/common/PageHeader';

import AnalogClock from '@/components/common/AnalogClock';
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

const TAB_KEYS = ['general', 'time'] as const;
type TabKey = (typeof TAB_KEYS)[number];



// General Settings Page - accessible to all users
const SettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const { language, changeLanguage, supportedLanguages } = useI18n();
  const { mode, setTheme: setAppTheme } = useAppTheme();
  const { user, refreshAuth } = useAuth();
  const { enqueueSnackbar } = useSnackbar();

  // Tab state synced with URL
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab') as TabKey | null;
  const [tab, setTab] = useState<TabKey>(
    tabFromUrl && TAB_KEYS.includes(tabFromUrl) ? tabFromUrl : 'general'
  );

  const tzOptions = useMemo(() => Intl.supportedValuesOf('timeZone'), []);
  const [timezone, setTimezone] = useState<string>(getStoredTimezone());
  const [dtFormat, setDtFormat] = useState<string>(getStoredDateTimeFormat());

  // Server time state (migrated from TimezoneSelector)
  const [localTime, setLocalTime] = useState<Date>(new Date());
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
      setLocalTime(new Date());
      setServerTime(timeService.getCurrentServerTime());
      setCurrentUptime(timeService.getCurrentUptime());
    }, 1000);

    return () => {
      timeService.stopSync();
      timeService.removeListener(handleServerTimeUpdate);
      clearInterval(interval);
    };
  }, []);

  // UTC times derived from local/server times (for analog clock display)
  const localUtcTime = useMemo(() => {
    const d = new Date(localTime);
    return new Date(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate(),
      d.getUTCHours(),
      d.getUTCMinutes(),
      d.getUTCSeconds()
    );
  }, [localTime]);

  const serverUtcTime = useMemo(() => {
    const d = new Date(serverTime);
    return new Date(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate(),
      d.getUTCHours(),
      d.getUTCMinutes(),
      d.getUTCSeconds()
    );
  }, [serverTime]);

  // Format timezone with UTC offset
  const formatTimezone = (tz: string) => {
    const offset = dayjs().tz(tz).format('Z');
    return `${tz} (UTC${offset})`;
  };

  // Format UTC time string
  const formatUTCTime = (date: Date) => {
    return dayjs(date).utc().format('YYYY-MM-DD HH:mm:ss');
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

        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs
            value={TAB_KEYS.indexOf(tab)}
            onChange={(_, newValue) => {
              const key = TAB_KEYS[newValue];
              setTab(key);
              setSearchParams({ tab: key });
            }}
          >
            <Tab label={t('settings.general.tabGeneral')} />
            <Tab label={t('settings.general.tabTime')} />
          </Tabs>
        </Box>

        <Stack spacing={2} sx={{ maxWidth: 640 }}>
          {/* ─── General Tab ─── */}
          {tab === 'general' && (
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
                    <MenuItem value="light">
                      {t('common.themeLight')}
                    </MenuItem>
                    <MenuItem value="dark">
                      {t('common.themeDark')}
                    </MenuItem>
                    <MenuItem value="auto">
                      {t('common.themeAuto')}
                    </MenuItem>
                  </TextField>
                </Stack>
              </CardContent>
            </Card>
          )}

          {/* ─── Time Tab ─── */}
          {tab === 'time' && (
            <>
              {/* Time settings */}
              <Card>
                <CardContent>
                  <Stack spacing={2}>
                    {/* Timezone */}
                    <Autocomplete
                      options={tzOptions}
                      value={timezone}
                      onChange={(_, v) => v && setTimezone(v)}
                      getOptionLabel={formatTimezone}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label={t('common.timezone')}
                          placeholder={t('common.searchTimezone')}
                        />
                      )}
                      renderOption={(props, option) => (
                        <li {...props}>
                          <Box>
                            <Typography variant="body2">{option}</Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
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
                          label={t('settings.general.dateTimeFormat')}
                          placeholder="e.g. YYYY-MM-DD HH:mm:ss"
                          onChange={(e) => setDtFormat(e.target.value)}
                        />
                      )}
                    />
                  </Stack>
                </CardContent>
              </Card>

              {/* Current Time Card - Local */}
              <Card>
                <CardContent>
                  <Typography
                    variant="subtitle2"
                    sx={{ fontWeight: 700, mb: 2 }}
                  >
                    {t('settings.general.currentTime')}
                  </Typography>

                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'center',
                      gap: { xs: 6, sm: 10 },
                      py: 1,
                    }}
                  >
                    <AnalogClock
                      time={localTime}
                      label={t('settings.general.localTime')}
                      size={120}
                    />
                    <AnalogClock
                      time={localUtcTime}
                      label="UTC"
                      size={120}
                    />
                  </Box>
                </CardContent>
              </Card>

              {/* Current Time Card - Server */}
              <Card>
                <CardContent>
                  <Typography
                    variant="subtitle2"
                    sx={{ fontWeight: 700, mb: 2 }}
                  >
                    {t('common.serverTime')}
                  </Typography>

                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'center',
                      gap: { xs: 6, sm: 10 },
                      py: 1,
                      mb: serverTimeData ? 1.5 : 0,
                    }}
                  >
                    <AnalogClock
                      time={serverTime}
                      label={t('settings.general.serverTimeLabel')}
                      size={120}
                    />
                    <AnalogClock
                      time={serverUtcTime}
                      label="UTC"
                      size={120}
                    />
                  </Box>

                  {serverTimeData && (
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'center',
                        flexWrap: 'wrap',
                        gap: 0.5,
                        mt: 1,
                        pt: 1.5,
                        borderTop: 1,
                        borderColor: 'divider',
                      }}
                    >
                      <Typography
                        variant="caption"
                        color="text.secondary"
                      >
                        {t('common.serverUptime')}: {formatUptime(currentUptime)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        ·
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                      >
                        {t('common.ping', 'Ping')}: {serverTimeData.ping}ms
                      </Typography>
                      {(() => {
                        const diffMs = Math.abs(
                          serverTime.getTime() - localTime.getTime()
                        );
                        if (diffMs < 1000) return null;
                        const sign =
                          serverTime.getTime() > localTime.getTime()
                            ? '+'
                            : '-';
                        return (
                          <>
                            <Typography variant="caption" color="text.secondary">
                              ·
                            </Typography>
                            <Typography
                              variant="caption"
                              sx={{ color: 'warning.main', fontWeight: 600 }}
                            >
                              {t('settings.general.timeDiff', 'Diff')}: {sign}{formatDuration(diffMs)}
                            </Typography>
                          </>
                        );
                      })()}
                    </Box>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </Stack>
      </Box>
    </PageContentLoader>
  );
};

export default SettingsPage;
