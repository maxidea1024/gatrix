import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Autocomplete,
  TextField,
  Chip,
  Tooltip,
  IconButton,
  Popover,
  Stack,
  Divider
} from '@mui/material';
import {
  Schedule as ScheduleIcon,
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
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [timezone, setTimezone] = useState<string>(getStoredTimezone());
  const [serverTime, setServerTime] = useState<Date>(new Date());
  const [serverTimeData, setServerTimeData] = useState<ServerTimeData | null>(null);

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

    // 1초마다 현재 서버 시간 업데이트
    const interval = setInterval(() => {
      setServerTime(timeService.getCurrentServerTime());
    }, 1000);

    return () => {
      timeService.stopSync();
      timeService.removeListener(handleServerTimeUpdate);
      clearInterval(interval);
    };
  }, []);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
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
      {/* 서버 시간 표시 */}
      <Chip
        icon={<PublicIcon />}
        label={formatDateTimeDetailed(serverTime)}
        size="small"
        variant="outlined"
        sx={{
          fontFamily: 'monospace',
          fontSize: '0.75rem',
          color: 'rgba(255, 255, 255, 0.9)',
          borderColor: 'rgba(255, 255, 255, 0.3)',
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          '& .MuiChip-icon': {
            fontSize: '0.875rem',
            color: 'rgba(255, 255, 255, 0.7)'
          },
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            borderColor: 'rgba(255, 255, 255, 0.5)',
            '& .MuiChip-label': {
              color: 'rgba(255, 255, 255, 1)'
            },
            '& .MuiChip-icon': {
              color: 'rgba(255, 255, 255, 0.9)'
            }
          }
        }}
      />

      {/* Timezone 설정 버튼 */}
      <Tooltip title={t('common.timezone')}>
        <IconButton
          size="small"
          onClick={handleClick}
          sx={{
            color: 'rgba(255, 255, 255, 0.7)',
            backgroundColor: 'transparent',
            '&:hover': {
              color: 'rgba(255, 255, 255, 1)',
              backgroundColor: 'rgba(255, 255, 255, 0.1)'
            }
          }}
        >
          <ScheduleIcon fontSize="small" />
        </IconButton>
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
        PaperProps={{
          sx: {
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider'
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
                  {formatUptime(serverTimeData.uptime)}
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
