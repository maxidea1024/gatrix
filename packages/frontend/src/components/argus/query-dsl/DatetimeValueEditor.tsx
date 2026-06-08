// ============================================================================
// DatetimeValueEditor — Datetime field value editor with presets + DateTimePicker
// Used in TokenEditDropdown for datetime-type fields (e.g., timestamp)
// ============================================================================

import React, { useState, useMemo } from 'react';
import {
  Box,
  List,
  ListItemButton,
  ListItemText,
  Typography,
  Divider,
  useTheme,
} from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, { Dayjs } from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { useTranslation } from 'react-i18next';
import { getStoredTimezone, getDateLocale } from '@/utils/dateFormat';

dayjs.extend(utc);
dayjs.extend(timezone);

// ─── Quick Presets ───────────────────────────────────────────────────────────

interface TimePreset {
  labelKey: string;
  value: string;
}

const RELATIVE_PRESETS: TimePreset[] = [
  { labelKey: 'dsl.datetime.preset.1h', value: 'now-1h' },
  { labelKey: 'dsl.datetime.preset.24h', value: 'now-24h' },
  { labelKey: 'dsl.datetime.preset.7d', value: 'now-7d' },
  { labelKey: 'dsl.datetime.preset.30d', value: 'now-30d' },
];

// ─── Component ───────────────────────────────────────────────────────────────

interface DatetimeValueEditorProps {
  /** Current operator (e.g., 'before', 'after', 'between') */
  operator: string;
  /** Current value (ISO string or relative expression) */
  currentValue?: string;
  /** End value for 'between' operator */
  currentValueTo?: string;
  /** Called when user selects a value */
  onSelect: (value: string, valueTo?: string) => void;
  isDark: boolean;
}

export default function DatetimeValueEditor({
  operator,
  currentValue,
  currentValueTo,
  onSelect,
  isDark,
}: DatetimeValueEditorProps) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const dateLocale = getDateLocale(i18n.language);
  const storedTz = getStoredTimezone();

  const isBetween = operator === 'between';

  // Parse existing values into Dayjs for DateTimePicker
  const parsedFrom = useMemo(() => {
    if (!currentValue || currentValue.startsWith('now')) return null;
    const d = dayjs(currentValue).tz(storedTz);
    return d.isValid() ? d : null;
  }, [currentValue, storedTz]);

  const parsedTo = useMemo(() => {
    if (!currentValueTo || currentValueTo.startsWith('now')) return null;
    const d = dayjs(currentValueTo).tz(storedTz);
    return d.isValid() ? d : null;
  }, [currentValueTo, storedTz]);

  // Local state for between mode
  const [fromValue, setFromValue] = useState<Dayjs | null>(parsedFrom);
  const [toValue, setToValue] = useState<Dayjs | null>(parsedTo);

  // ─── Handlers ────────────────────────────────────────────────────────

  const handlePresetClick = (preset: TimePreset) => {
    if (isBetween) {
      // For between: preset means "from preset to now"
      onSelect(preset.value, 'now');
    } else {
      onSelect(preset.value);
    }
  };

  const handleDateChange = (date: Dayjs | null, target: 'from' | 'to') => {
    const isoString = date ? date.utc().toISOString() : '';

    if (isBetween) {
      if (target === 'from') {
        setFromValue(date);
        // Auto-commit when both values are set
        if (date && toValue) {
          onSelect(isoString, toValue.utc().toISOString());
        }
      } else {
        setToValue(date);
        if (fromValue && date) {
          onSelect(fromValue.utc().toISOString(), isoString);
        }
      }
    } else {
      if (isoString) {
        onSelect(isoString);
      }
    }
  };

  // ─── Styles ──────────────────────────────────────────────────────────

  const sectionHeaderSx = {
    px: 1.5,
    py: 0.75,
    display: 'flex',
    alignItems: 'center',
    gap: 0.75,
    color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
    fontSize: '0.7rem',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  };

  const listItemSx = {
    py: 0.5,
    px: 1.5,
    borderRadius: '4px',
    mx: 0.5,
    '&:hover': {
      bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    },
  };

  const selectedPreset = currentValue;

  return (
    <Box sx={{ width: 280, maxHeight: 420, overflow: 'auto' }}>
      {/* Quick Presets */}
      <Box sx={sectionHeaderSx}>
        <AccessTimeIcon sx={{ fontSize: 14 }} />
        {t('dsl.datetime.quickSelect', 'Quick Select')}
      </Box>
      <List dense disablePadding sx={{ px: 0.5 }}>
        {RELATIVE_PRESETS.map((preset) => (
          <ListItemButton
            key={preset.value}
            onClick={() => handlePresetClick(preset)}
            selected={selectedPreset === preset.value}
            sx={listItemSx}
          >
            <ListItemText
              primary={
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Typography variant="body2">{t(preset.labelKey)}</Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      color: isDark
                        ? 'rgba(255,255,255,0.35)'
                        : 'rgba(0,0,0,0.35)',
                      fontFamily: 'monospace',
                    }}
                  >
                    {preset.value}
                  </Typography>
                </Box>
              }
            />
          </ListItemButton>
        ))}
      </List>

      <Divider sx={{ my: 1 }} />

      {/* DateTimePicker */}
      <Box sx={sectionHeaderSx}>
        <CalendarMonthIcon sx={{ fontSize: 14 }} />
        {isBetween ? t('dsl.datetime.dateRange', 'Date Range') : t('dsl.datetime.pickDateTime', 'Pick Date & Time')}
      </Box>
      <Box sx={{ px: 1.5, pb: 1.5 }}>
        <LocalizationProvider
          dateAdapter={AdapterDayjs}
          adapterLocale={dateLocale}
        >
          <DateTimePicker
            label={isBetween ? t('dsl.datetime.from', 'From') : t('dsl.datetime.pickDateTime', 'Date & Time')}
            value={fromValue}
            onChange={(d) => handleDateChange(d, 'from')}
            timezone={storedTz}
            ampm={true}
            format="YYYY-MM-DD A hh:mm"
            views={['year', 'month', 'day', 'hours', 'minutes']}
            timeSteps={{ minutes: 1 }}
            slotProps={{
              textField: {
                size: 'small',
                fullWidth: true,
                sx: { mt: 0.5 },
              },
            }}
          />
          {isBetween && (
            <DateTimePicker
              label={t('dsl.datetime.to', 'To')}
              value={toValue}
              onChange={(d) => handleDateChange(d, 'to')}
              timezone={storedTz}
              ampm={true}
              format="YYYY-MM-DD A hh:mm"
              views={['year', 'month', 'day', 'hours', 'minutes']}
              timeSteps={{ minutes: 1 }}
              minDateTime={fromValue ?? undefined}
              slotProps={{
                textField: {
                  size: 'small',
                  fullWidth: true,
                  sx: { mt: 1 },
                },
              }}
            />
          )}
        </LocalizationProvider>
      </Box>
    </Box>
  );
}
