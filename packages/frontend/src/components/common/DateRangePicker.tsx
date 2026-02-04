import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  ButtonGroup,
  Popover,
  Stack,
  Typography,
  Tab,
  Tabs,
  Paper,
  TextField,
} from '@mui/material';
import { CalendarToday as CalendarIcon, ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import { StaticDatePicker } from '@mui/x-date-pickers/StaticDatePicker';
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar';
import { PickersDay, PickersDayProps } from '@mui/x-date-pickers/PickersDay';
import dayjs, { Dayjs } from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import isBetween from 'dayjs/plugin/isBetween';
import { useTranslation } from 'react-i18next';
import { useI18n } from '@/contexts/I18nContext';
import { getStoredTimezone } from '@/utils/dateFormat';

// Extend dayjs with timezone support
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isBetween);

// Date range preset types
export type DateRangePreset =
  | 'today'
  | 'yesterday'
  | 'last7d'
  | 'last30d'
  | 'last3m'
  | 'last6m'
  | 'last12m'
  | 'ytd'
  | 'custom';

// Date range mode types (Mixpanel-style)
export type DateRangeMode = 'fixed' | 'since' | 'last';

export interface DateRange {
  from: Dayjs | null;
  to: Dayjs | null;
}

export interface DateRangePickerProps {
  // Current selected date range
  dateFrom: Dayjs | null;
  dateTo: Dayjs | null;

  // Callback when date range changes
  onChange: (from: Dayjs | null, to: Dayjs | null, preset: DateRangePreset) => void;

  // Current preset
  preset?: DateRangePreset;

  // Available presets (default: all)
  availablePresets?: DateRangePreset[];

  // Size variant
  size?: 'small' | 'medium';

  // Show time picker (default: false for day-level selection)
  showTime?: boolean;
}

/**
 * DateRangePicker Component
 *
 * Mixpanel-style date range picker with preset buttons and custom date selection.
 * Supports localization and timezone settings.
 *
 * @example
 * ```tsx
 * <DateRangePicker
 *   dateFrom={dateFrom}
 *   dateTo={dateTo}
 *   onChange={(from, to, preset) => {
 *     setDateFrom(from);
 *     setDateTo(to);
 *     setPreset(preset);
 *   }}
 *   preset={preset}
 * />
 * ```
 */
const DateRangePicker: React.FC<DateRangePickerProps> = ({
  dateFrom,
  dateTo,
  onChange,
  preset = 'last7d',
  availablePresets = [
    'today',
    'yesterday',
    'last7d',
    'last30d',
    'last3m',
    'last6m',
    'last12m',
    'ytd',
    'custom',
  ],
  size = 'small',
  showTime = false,
}) => {
  const { t } = useTranslation();
  const { language } = useI18n();
  const [currentPreset, setCurrentPreset] = useState<DateRangePreset>(preset);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [tempFrom, setTempFrom] = useState<Dayjs | null>(dateFrom);
  const [tempTo, setTempTo] = useState<Dayjs | null>(dateTo);
  const [mode, setMode] = useState<DateRangeMode>('fixed');
  const [tempPreset, setTempPreset] = useState<DateRangePreset | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<Dayjs | null>(null);

  // Update internal state when props change
  useEffect(() => {
    setCurrentPreset(preset);
  }, [preset]);

  useEffect(() => {
    setTempFrom(dateFrom);
    setTempTo(dateTo);
  }, [dateFrom, dateTo]);

  // Calculate date range based on preset
  const calculateDateRange = (presetValue: DateRangePreset): DateRange => {
    const timezone = getStoredTimezone();
    const now = dayjs().tz(timezone);

    switch (presetValue) {
      case 'today':
        return {
          from: now.startOf('day'),
          to: now.endOf('day'),
        };

      case 'yesterday':
        return {
          from: now.subtract(1, 'day').startOf('day'),
          to: now.subtract(1, 'day').endOf('day'),
        };

      case 'last7d':
        return {
          from: now.subtract(7, 'day').startOf('day'),
          to: now.endOf('day'),
        };

      case 'last30d':
        return {
          from: now.subtract(30, 'day').startOf('day'),
          to: now.endOf('day'),
        };

      case 'last3m':
        return {
          from: now.subtract(3, 'month').startOf('day'),
          to: now.endOf('day'),
        };

      case 'last6m':
        return {
          from: now.subtract(6, 'month').startOf('day'),
          to: now.endOf('day'),
        };

      case 'last12m':
        return {
          from: now.subtract(12, 'month').startOf('day'),
          to: now.endOf('day'),
        };

      case 'ytd':
        return {
          from: now.startOf('year'),
          to: now.endOf('day'),
        };

      case 'custom':
      default:
        return {
          from: dateFrom,
          to: dateTo,
        };
    }
  };

  // Handle preset button click
  const handlePresetClick = (presetValue: DateRangePreset) => {
    if (presetValue === 'custom') {
      setCurrentPreset('custom');
      setAnchorEl(null);
      return;
    }

    const range = calculateDateRange(presetValue);
    setCurrentPreset(presetValue);
    setTempFrom(range.from);
    setTempTo(range.to);
    onChange(range.from, range.to, presetValue);
    setAnchorEl(null);
  };

  // Handle date selection for range picker
  const handleDateClick = (date: Dayjs | null) => {
    if (!date) return;

    const normalizedDate = dayjs(date);
    if (!normalizedDate.isValid()) return;

    if (!tempFrom || (tempFrom && tempTo)) {
      // Start new selection
      setTempFrom(normalizedDate.startOf('day'));
      setTempTo(null);
    } else if (tempFrom && !tempTo) {
      // Complete selection
      if (normalizedDate.isBefore(tempFrom)) {
        setTempTo(tempFrom.endOf('day'));
        setTempFrom(normalizedDate.startOf('day'));
      } else {
        setTempTo(normalizedDate.endOf('day'));
      }
    }
  };

  // Handle drag start
  const handleMouseDown = (date: Dayjs) => {
    setIsDragging(true);
    setDragStart(date.startOf('day'));
    setTempFrom(date.startOf('day'));
    setTempTo(null);
  };

  // Handle drag over
  const handleMouseEnter = (date: Dayjs) => {
    if (!isDragging || !dragStart) return;

    const normalizedDate = date.startOf('day');
    if (normalizedDate.isBefore(dragStart)) {
      setTempFrom(normalizedDate);
      setTempTo(dragStart.endOf('day'));
    } else {
      setTempFrom(dragStart);
      setTempTo(normalizedDate.endOf('day'));
    }
  };

  // Handle drag end
  const handleMouseUp = () => {
    setIsDragging(false);
    setDragStart(null);
  };

  // Add global mouse up listener
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mouseup', handleMouseUp);
      return () => window.removeEventListener('mouseup', handleMouseUp);
    }
  }, [isDragging]);

  // Custom day renderer for range selection - Mixpanel style
  const CustomDay = (props: PickersDayProps<Dayjs>) => {
    const { day, ...other } = props;

    if (!tempFrom) {
      return <PickersDay day={day} {...other} />;
    }

    const dayStart = day.startOf('day');
    const fromStart = tempFrom.startOf('day');
    const toStart = tempTo ? tempTo.startOf('day') : null;

    // Compare full date including year, month, and day - use no unit or check year/month/date separately
    const isStart =
      dayStart.year() === fromStart.year() &&
      dayStart.month() === fromStart.month() &&
      dayStart.date() === fromStart.date();
    const isEnd = toStart
      ? dayStart.year() === toStart.year() &&
        dayStart.month() === toStart.month() &&
        dayStart.date() === toStart.date()
      : false;

    // Only highlight if both dates are selected
    const isInRange =
      toStart && tempFrom ? dayStart.isAfter(fromStart) && dayStart.isBefore(toStart) : false;

    const isSelected = isStart || isEnd || isInRange;

    return (
      <Box
        sx={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onMouseDown={() => handleMouseDown(day)}
        onMouseEnter={() => handleMouseEnter(day)}
      >
        {/* Background bar for range */}
        {isSelected && (
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              transform: 'translateY(-50%)',
              height: 36,
              left: isStart ? '50%' : 0,
              right: isEnd ? '50%' : 0,
              backgroundColor: 'rgba(25, 118, 210, 0.12)',
              zIndex: 0,
            }}
          />
        )}

        <PickersDay
          day={day}
          {...other}
          selected={false}
          sx={{
            position: 'relative',
            zIndex: 1,
            userSelect: 'none',
            ...(isSelected && {
              backgroundColor: isStart || isEnd ? 'primary.main' : 'transparent',
              color: isStart || isEnd ? 'primary.contrastText' : 'text.primary',
              fontWeight: isStart || isEnd ? 600 : 400,
              '&:hover': {
                backgroundColor: isStart || isEnd ? 'primary.dark' : 'rgba(25, 118, 210, 0.2)',
              },
            }),
          }}
        />
      </Box>
    );
  };

  // Handle custom date apply
  const handleCustomApply = () => {
    const presetToApply = tempPreset || 'custom';
    onChange(tempFrom, tempTo, presetToApply);
    setCurrentPreset(presetToApply);
    setTempPreset(null);
    setAnchorEl(null);
  };

  // Handle custom date cancel
  const handleCustomCancel = () => {
    setTempFrom(dateFrom);
    setTempTo(dateTo);
    setTempPreset(null);
    setAnchorEl(null);
  };

  // Get preset label
  const getPresetLabel = (presetValue: DateRangePreset): string => {
    return t(`common.dateRange.presets.${presetValue}`);
  };

  // Get current display text
  const getDisplayText = (): string => {
    if (currentPreset === 'custom') {
      if (dateFrom && dateTo) {
        const fromStr = dateFrom.format('MMM D, YYYY');
        const toStr = dateTo.format('MMM D, YYYY');
        return `${fromStr} - ${toStr}`;
      }
      return t('common.dateRange.presets.custom');
    }
    return getPresetLabel(currentPreset);
  };

  const open = Boolean(anchorEl);

  // Handle mode tab change
  const handleModeChange = (event: React.SyntheticEvent, newMode: DateRangeMode) => {
    setMode(newMode);
  };

  // Handle manual date input
  const handleFromDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const date = dayjs(value);
    if (date.isValid()) {
      setTempFrom(date.startOf('day'));
      // Auto-adjust end date if it's before the new start date
      if (tempTo && date.isAfter(tempTo)) {
        setTempTo(null);
      }
    }
  };

  const handleToDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const date = dayjs(value);
    if (date.isValid()) {
      setTempTo(date.endOf('day'));
      // Auto-adjust start date if it's after the new end date
      if (tempFrom && date.isBefore(tempFrom)) {
        setTempFrom(date.startOf('day'));
      }
    }
  };

  return (
    <Box>
      {/* Preset Buttons */}
      <ButtonGroup
        variant="outlined"
        size={size}
        sx={{
          '& .MuiButton-root': {
            textTransform: 'none',
            minWidth: size === 'small' ? 60 : 80,
            height: size === 'small' ? '40px' : 'auto',
          },
        }}
      >
        {availablePresets
          .filter((p) => p !== 'custom')
          .map((presetValue) => (
            <Button
              key={presetValue}
              variant={currentPreset === presetValue ? 'contained' : 'outlined'}
              onClick={() => handlePresetClick(presetValue)}
            >
              {getPresetLabel(presetValue)}
            </Button>
          ))}

        {/* Custom Button with Dropdown */}
        {availablePresets.includes('custom') && (
          <Button
            variant={currentPreset === 'custom' ? 'contained' : 'outlined'}
            onClick={(e) => {
              // Reset temp values when opening popover
              setTempFrom(dateFrom);
              setTempTo(dateTo);
              setTempPreset(null);
              setAnchorEl(e.currentTarget);
            }}
            endIcon={<ExpandMoreIcon />}
            startIcon={<CalendarIcon />}
          >
            {currentPreset === 'custom' ? getDisplayText() : getPresetLabel('custom')}
          </Button>
        )}
      </ButtonGroup>

      {/* Custom Date Popover - Mixpanel Style */}
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleCustomCancel}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        slotProps={{
          paper: {
            sx: {
              mt: 1,
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
              borderRadius: 2,
            },
          },
        }}
      >
        <Box sx={{ width: 'auto', minWidth: 320 }}>
          {/* Mode Tabs */}
          <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2, pt: 1 }}>
            <Tabs
              value={mode}
              onChange={handleModeChange}
              sx={{
                minHeight: 40,
                '& .MuiTab-root': {
                  minHeight: 40,
                  textTransform: 'none',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                },
              }}
            >
              <Tab label={t('common.dateRange.modes.fixed')} value="fixed" />
              <Tab label={t('common.dateRange.modes.since')} value="since" />
              <Tab label={t('common.dateRange.modes.last')} value="last" />
            </Tabs>
          </Box>

          {/* Fixed Mode - Date Range Picker */}
          {mode === 'fixed' && (
            <Box sx={{ p: 2 }}>
              <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
                <TextField
                  label={t('common.dateRange.from')}
                  value={tempFrom ? tempFrom.format('YYYY-MM-DD') : ''}
                  onChange={handleFromDateChange}
                  size="small"
                  type="date"
                  placeholder="YYYY-MM-DD"
                  sx={{ flex: 1 }}
                  InputLabelProps={{
                    shrink: true,
                  }}
                />
                <TextField
                  label={t('common.dateRange.to')}
                  value={tempTo ? tempTo.format('YYYY-MM-DD') : ''}
                  onChange={handleToDateChange}
                  size="small"
                  type="date"
                  placeholder="YYYY-MM-DD"
                  sx={{ flex: 1 }}
                  InputLabelProps={{
                    shrink: true,
                  }}
                />
              </Stack>
              <Stack direction="row" spacing={2}>
                <Box sx={{ flex: 1 }}>
                  <DateCalendar
                    value={tempFrom}
                    onChange={handleDateClick}
                    slots={{
                      day: CustomDay,
                    }}
                    sx={{
                      width: '100%',
                      maxHeight: 320,
                      '& .MuiPickersCalendarHeader-root': {
                        paddingLeft: 1,
                        paddingRight: 1,
                      },
                      '& .MuiDayCalendar-header': {
                        justifyContent: 'space-around',
                      },
                      '& .MuiPickersDay-root': {
                        fontSize: '0.875rem',
                      },
                    }}
                  />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <DateCalendar
                    value={tempFrom ? tempFrom.add(1, 'month') : dayjs().add(1, 'month')}
                    onChange={handleDateClick}
                    slots={{
                      day: CustomDay,
                    }}
                    sx={{
                      width: '100%',
                      maxHeight: 320,
                      '& .MuiPickersCalendarHeader-root': {
                        paddingLeft: 1,
                        paddingRight: 1,
                      },
                      '& .MuiDayCalendar-header': {
                        justifyContent: 'space-around',
                      },
                      '& .MuiPickersDay-root': {
                        fontSize: '0.875rem',
                      },
                    }}
                  />
                </Box>
              </Stack>
            </Box>
          )}

          {/* Since Mode - Single Date Picker */}
          {mode === 'since' && (
            <Box sx={{ p: 3 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('common.dateRange.sinceDescription')}
              </Typography>
              <DateCalendar
                value={tempFrom}
                onChange={(date) => {
                  setTempFrom(date.startOf('day'));
                  setTempTo(dayjs().endOf('day'));
                }}
                sx={{
                  width: '100%',
                  maxHeight: 320,
                }}
              />
            </Box>
          )}

          {/* Last Mode - Preset Buttons */}
          {mode === 'last' && (
            <Box sx={{ p: 3 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('common.dateRange.lastDescription')}
              </Typography>
              <Stack spacing={1}>
                {availablePresets
                  .filter((p) => p !== 'custom')
                  .map((presetValue) => (
                    <Button
                      key={presetValue}
                      variant={tempPreset === presetValue ? 'contained' : 'outlined'}
                      onClick={() => {
                        const range = calculateDateRange(presetValue);
                        setTempFrom(range.from);
                        setTempTo(range.to);
                        setTempPreset(presetValue);
                      }}
                      fullWidth
                      sx={{
                        justifyContent: 'flex-start',
                        textTransform: 'none',
                      }}
                    >
                      {getPresetLabel(presetValue)}
                    </Button>
                  ))}
              </Stack>
            </Box>
          )}

          {/* Action Buttons */}
          <Box
            sx={{
              px: 2,
              py: 1.5,
              borderTop: 1,
              borderColor: 'divider',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              bgcolor: 'background.default',
            }}
          >
            <Button size="small" onClick={handleCustomCancel} sx={{ textTransform: 'none' }}>
              {t('common.cancel')}
            </Button>
            <Button
              size="small"
              variant="contained"
              onClick={handleCustomApply}
              disabled={!tempFrom || !tempTo}
              sx={{ textTransform: 'none' }}
            >
              {t('common.apply')}
            </Button>
          </Box>
        </Box>
      </Popover>
    </Box>
  );
};

export default DateRangePicker;
