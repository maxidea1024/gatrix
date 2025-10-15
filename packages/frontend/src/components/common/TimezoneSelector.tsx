import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Autocomplete,
  TextField,
  Chip,
  Tooltip,
  Popover,
  Stack,
  Divider,
  useTheme
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Public as PublicIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import moment from 'moment-timezone';
import {
  getStoredTimezone,
  setStoredTimezone,
  formatDateTimeDetailed,
  formatUptime
} from '../../utils/dateFormat';
import { timeService, ServerTimeData } from '../../services/timeService';

const TimezoneSelector: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [timezone, setTimezone] = useState<string>(getStoredTimezone());
  const [serverTime, setServerTime] = useState<Date>(new Date());
  const [serverTimeData, setServerTimeData] = useState<ServerTimeData | null>(null);
  const [currentUptime, setCurrentUptime] = useState<number>(0);

  const timezoneOptions = moment.tz.names();
  const open = Boolean(anchorEl);

  useEffect(() => {
    // 서버 시간 동기화 시작
    timeService.startSync();

    // 서버 시간 업데이트 리스너 등록
    const handleServerTimeUpdate = (data: ServerTimeData) => {
      setServerTimeData(data);
    };

    timeService.addListener(handleServerTimeUpdate);

    // 1초마다 현재 서버 시간과 업타임 업데이트
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

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleTimezoneChange = (newTimezone: string | null) => {
    if (newTimezone) {
      setTimezone(newTimezone);
      setStoredTimezone(newTimezone);
      // 페이지 새로고침 없이 즉시 적용되도록 이벤트 발생
      window.dispatchEvent(new Event('timezoneChanged'));
    }
  };

  const formatTimezone = (tz: string) => {
    const offset = moment.tz(tz).format('Z');
    return `${tz} (UTC${offset})`;
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      {/* 서버 시간 표시 (클릭 가능) */}
      <Tooltip title={t('common.timezone')}>
        <Chip
          icon={<PublicIcon />}
          label={formatDateTimeDetailed(serverTime)}
          size="small"
          variant="outlined"
          onClick={handleClick}
          sx={{
            fontFamily: 'monospace',
            fontSize: '0.75rem',
            color: theme.palette.text.primary,
            borderColor: theme.palette.mode === 'dark'
              ? 'rgba(255, 255, 255, 0.3)'
              : 'rgba(0, 0, 0, 0.23)',
            backgroundColor: theme.palette.mode === 'dark'
              ? 'rgba(255, 255, 255, 0.05)'
              : 'rgba(0, 0, 0, 0.02)',
            borderRadius: 2,
            cursor: 'pointer',
            '& .MuiChip-icon': {
              fontSize: '0.875rem',
              color: theme.palette.text.secondary
            },
            '&:hover': {
              backgroundColor: theme.palette.mode === 'dark'
                ? 'rgba(255, 255, 255, 0.1)'
                : 'rgba(0, 0, 0, 0.05)',
              borderColor: theme.palette.mode === 'dark'
                ? 'rgba(255, 255, 255, 0.5)'
                : 'rgba(0, 0, 0, 0.4)',
              '& .MuiChip-label': {
                color: theme.palette.text.primary
              },
              '& .MuiChip-icon': {
                color: theme.palette.text.primary
              }
            }
          }}
        />
      </Tooltip>

      {/* Timezone 설정 팝오버 */}
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        slotProps={{
          backdrop: {
            invisible: true
          }
        }}
        PaperProps={{
          sx: {
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            boxShadow: 3
          }
        }}
      >
        <Box sx={{ p: 2, minWidth: 300 }}>
          <Stack spacing={2}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SettingsIcon fontSize="small" />
              <Typography variant="subtitle2">
                {t('settings.timezone')}
              </Typography>
            </Box>
            
            <Divider />
            
            {/* 현재 시간 정보 */}
            <Box>
              <Typography variant="caption" color="text.secondary">
                {t('common.currentLocalTime')}
              </Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                {formatDateTimeDetailed(new Date())}
              </Typography>
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary">
                {t('common.serverTime')}
              </Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                {formatDateTimeDetailed(serverTime)}
                {serverTimeData && (
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                    ({t('common.ping')}: {serverTimeData.ping}ms)
                  </Typography>
                )}
              </Typography>
            </Box>

            {/* 서버 업타임 */}
            {serverTimeData && (
              <Box>
                <Typography variant="caption" color="text.secondary">
                  {t('common.serverUptime')}
                </Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                  {formatUptime(currentUptime)}
                </Typography>
              </Box>
            )}

            <Divider />

            {/* Timezone 선택 */}
            <Autocomplete
              value={timezone}
              onChange={(_, newValue) => handleTimezoneChange(newValue)}
              options={timezoneOptions}
              getOptionLabel={formatTimezone}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={t('common.selectTimezone')}
                  size="small"
                  placeholder={t('common.searchTimezone')}
                />
              )}
              renderOption={(props, option) => (
                <li {...props}>
                  <Box>
                    <Typography variant="body2">{option}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      UTC{moment.tz(option).format('Z')}
                    </Typography>
                  </Box>
                </li>
              )}
              size="small"
            />

            {/* 현재 선택된 timezone 정보 */}
            <Box sx={{
              p: 1,
              bgcolor: 'action.hover',
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'divider'
            }}>
              <Typography variant="caption" color="text.secondary">
                {t('common.selectedTimezone')}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                {formatTimezone(timezone)}
              </Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                {moment().tz(timezone).format('YYYY-MM-DD HH:mm:ss')}
              </Typography>
            </Box>
          </Stack>
        </Box>
      </Popover>
    </Box>
  );
};

export default TimezoneSelector;
