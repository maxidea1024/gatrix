/**
 * DateRangeSelector — Unified date/time range picker.
 *
 * A popover-based selector with preset durations (left panel) and optional
 * custom date-time range input (right panel). Replaces all legacy time-range
 * selection patterns in the project (ButtonGroup, ToggleButton, Select).
 *
 * ⚠️  This is the **only** date-range selector component for the project.
 *     Do NOT create ad-hoc ToggleButton / Select / ButtonGroup alternatives.
 *     See ui-patterns.md for the rule.
 *
 * @example
 * ```tsx
 * const [range, setRange] = useState<DateRangeValue>({ type: 'preset', preset: '24h' });
 * <DateRangeSelector value={range} onChange={setRange} />
 * ```
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Box,
  Popover,
  Typography,
  Button,
  Divider,
  TextField,
  useTheme,
  alpha,
} from '@mui/material';
import {
  CalendarMonth as CalendarIcon,
  ExpandMore as ExpandMoreIcon,
  AccessTime as TimeIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { getStoredTimezone } from '@/utils/dateFormat';

dayjs.extend(utc);
dayjs.extend(timezone);

// ==================== Types ====================

export interface DateRangeValue {
  type: 'preset' | 'custom';
  preset?: string;
  start?: Date;
  end?: Date;
}

export interface DateRangePresetOption {
  value: string;
  labelKey: string;
  fallback: string;
}

export interface DateRangeSelectorProps {
  /** Current value */
  value: DateRangeValue;
  /** Change handler */
  onChange: (value: DateRangeValue) => void;
  /** Preset options (default: 1h–90d) */
  presets?: DateRangePresetOption[];
  /** Compact mode for narrow spaces */
  compact?: boolean;
  /** Show the custom date-range panel (default: true) */
  showCustomRange?: boolean;
}

// ==================== Default Presets ====================

export const DEFAULT_PRESETS: DateRangePresetOption[] = [
  { value: '5min', labelKey: 'dateRange.preset.5min', fallback: '5 Minutes' },
  {
    value: '10min',
    labelKey: 'dateRange.preset.10min',
    fallback: '10 Minutes',
  },
  {
    value: '15min',
    labelKey: 'dateRange.preset.15min',
    fallback: '15 Minutes',
  },
  {
    value: '30min',
    labelKey: 'dateRange.preset.30min',
    fallback: '30 Minutes',
  },
  { value: '1h', labelKey: 'dateRange.preset.1h', fallback: '1 Hour' },
  { value: '3h', labelKey: 'dateRange.preset.3h', fallback: '3 Hours' },
  { value: '6h', labelKey: 'dateRange.preset.6h', fallback: '6 Hours' },
  { value: '12h', labelKey: 'dateRange.preset.12h', fallback: '12 Hours' },
  { value: '24h', labelKey: 'dateRange.preset.24h', fallback: '24 Hours' },
  { value: '2d', labelKey: 'dateRange.preset.2d', fallback: '2 Days' },
  { value: '7d', labelKey: 'dateRange.preset.7d', fallback: '7 Days' },
  { value: '14d', labelKey: 'dateRange.preset.14d', fallback: '14 Days' },
  { value: '30d', labelKey: 'dateRange.preset.30d', fallback: '30 Days' },
  { value: '90d', labelKey: 'dateRange.preset.90d', fallback: '90 Days' },
];

// ==================== Helpers ====================

/** Format a Date to datetime-local input value string in user timezone */
function formatDateTimeLocal(d: Date): string {
  const tz = getStoredTimezone();
  return dayjs(d).tz(tz).format('YYYY-MM-DDTHH:mm:ss');
}

/** Parse a datetime-local input string as user timezone → UTC Date */
function parseDateTimeLocal(s: string): Date | null {
  if (!s) return null;
  const tz = getStoredTimezone();
  // Interpret the input string as a date-time in the user's timezone
  const d = dayjs.tz(s, tz);
  return d.isValid() ? d.toDate() : null;
}

function presetToDisplay(
  preset: string,
  t: (key: string, options?: any) => string
): string {
  const key = `dateRange.preset.${preset}`;
  const translated = t(key, { defaultValue: '' });
  if (translated && translated !== key && translated !== '') return translated;
  const match = preset.match(/^(\d+)(min|h|d|m)$/);
  if (!match) return preset;
  const [, num, unit] = match;
  const unitMap: Record<string, string> = {
    min: t('dateRange.unit.minutes', { defaultValue: 'Minutes' }),
    h: t('dateRange.unit.hours', { defaultValue: 'Hours' }),
    d: t('dateRange.unit.days', { defaultValue: 'Days' }),
    m: t('dateRange.unit.months', { defaultValue: 'Months' }),
  };
  return `${num} ${unitMap[unit] || unit}`;
}

/** Format Date for display in user timezone */
function formatDateDisplay(d: Date): string {
  const tz = getStoredTimezone();
  return dayjs(d).tz(tz).format('YYYY-MM-DD HH:mm:ss');
}

// ==================== Component ====================

const DateRangeSelector: React.FC<DateRangeSelectorProps> = ({
  value,
  onChange,
  presets = DEFAULT_PRESETS,
  compact = false,
  showCustomRange = true,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const [draftStart, setDraftStart] = useState<string>(() => {
    if (value.type === 'custom' && value.start)
      return formatDateTimeLocal(value.start);
    const d = new Date();
    d.setHours(d.getHours() - 24);
    return formatDateTimeLocal(d);
  });
  const [draftEnd, setDraftEnd] = useState<string>(() => {
    if (value.type === 'custom' && value.end)
      return formatDateTimeLocal(value.end);
    return formatDateTimeLocal(new Date());
  });
  const [showCustom, setShowCustom] = useState(value.type === 'custom');

  const displayText = useMemo(() => {
    if (value.type === 'preset') {
      return (
        t('dateRange.last', { defaultValue: 'Last' }) +
        ' ' +
        presetToDisplay(value.preset || '24h', t)
      );
    }
    if (value.type === 'custom' && value.start && value.end) {
      return `${formatDateDisplay(value.start)} ~ ${formatDateDisplay(value.end)}`;
    }
    return t('dateRange.selectRange', { defaultValue: 'Select range' });
  }, [value, t]);

  const handleOpen = (e: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(e.currentTarget);
    if (value.type === 'custom' && value.start && value.end) {
      setDraftStart(formatDateTimeLocal(value.start));
      setDraftEnd(formatDateTimeLocal(value.end));
      setShowCustom(true);
    } else {
      setShowCustom(false);
    }
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handlePresetClick = (preset: string) => {
    onChange({ type: 'preset', preset });
    handleClose();
  };

  const handleApplyCustom = () => {
    const start = parseDateTimeLocal(draftStart);
    const end = parseDateTimeLocal(draftEnd);
    if (start && end && start < end) {
      onChange({ type: 'custom', start, end });
      handleClose();
    }
  };

  const isValidCustomRange = useMemo(() => {
    const s = parseDateTimeLocal(draftStart);
    const e = parseDateTimeLocal(draftEnd);
    return s && e && s < e;
  }, [draftStart, draftEnd]);

  const handleQuickSet = useCallback((minutesAgo: number) => {
    const tz = getStoredTimezone();
    const end = dayjs().tz(tz);
    const start = end.subtract(minutesAgo, 'minute');
    setDraftStart(start.format('YYYY-MM-DDTHH:mm:ss'));
    setDraftEnd(end.format('YYYY-MM-DDTHH:mm:ss'));
  }, []);

  return (
    <>
      {/* Trigger Button */}
      <Box
        onClick={handleOpen}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          height: 32,
          borderRadius: '6px',
          border: '1px solid',
          borderColor: open ? 'primary.main' : 'divider',
          bgcolor: open
            ? alpha(theme.palette.primary.main, 0.04)
            : 'background.paper',
          cursor: 'pointer',
          transition: 'all 0.15s',
          overflow: 'hidden',
          '&:hover': {
            borderColor: 'primary.main',
            bgcolor: alpha(theme.palette.primary.main, 0.04),
          },
        }}
      >
        <Box
          sx={{
            px: 1,
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
            borderRight: '1px solid',
            borderRightColor: 'divider',
          }}
        >
          <CalendarIcon
            sx={{ fontSize: 15, color: isDark ? 'grey.400' : 'text.secondary' }}
          />
        </Box>
        <Box sx={{ px: 1.2, display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography
            component="span"
            sx={{
              fontSize: compact ? '0.7rem' : '0.75rem',
              fontWeight: 600,
              color: 'text.primary',
              whiteSpace: 'nowrap',
            }}
          >
            {displayText}
          </Typography>
          <ExpandMoreIcon
            sx={{
              fontSize: 14,
              color: 'text.disabled',
              transition: 'transform 0.2s',
              transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          />
        </Box>
      </Box>

      {/* Popover */}
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: {
              mt: 0.5,
              borderRadius: '10px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
              overflow: 'hidden',
              display: 'flex',
              minHeight: showCustomRange ? 320 : undefined,
            },
          },
        }}
      >
        {/* Left: Presets */}
        <Box
          sx={{
            width: 150,
            borderRight: showCustomRange
              ? `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`
              : undefined,
            py: 1,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Typography
            variant="caption"
            sx={{
              px: 1.5,
              pb: 0.5,
              fontWeight: 600,
              color: 'text.secondary',
              fontSize: '0.65rem',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            {t('dateRange.relative', { defaultValue: 'Relative' })}
          </Typography>
          {presets.map((p, idx) => {
            const isActive =
              value.type === 'preset' && value.preset === p.value;
            // Detect unit group change for divider
            const getUnit = (v: string) => {
              if (v.endsWith('min')) return 'min';
              if (v.endsWith('h')) return 'h';
              return 'd';
            };
            const showDivider =
              idx > 0 && getUnit(p.value) !== getUnit(presets[idx - 1].value);
            return (
              <React.Fragment key={p.value}>
                {showDivider && <Divider sx={{ my: 0.5 }} />}
                <Box
                  onClick={() => handlePresetClick(p.value)}
                  sx={{
                    px: 1.5,
                    py: 0.6,
                    cursor: 'pointer',
                    fontSize: '0.78rem',
                    fontWeight: isActive ? 700 : 400,
                    color: isActive ? 'primary.main' : 'text.primary',
                    backgroundColor: isActive
                      ? alpha(theme.palette.primary.main, 0.08)
                      : 'transparent',
                    transition: 'all 0.1s',
                    '&:hover': {
                      backgroundColor: alpha(theme.palette.primary.main, 0.06),
                    },
                  }}
                >
                  {t(p.labelKey, { defaultValue: p.fallback })}
                </Box>
              </React.Fragment>
            );
          })}

          {showCustomRange && (
            <>
              <Divider sx={{ my: 1 }} />
              <Box
                onClick={() => setShowCustom(true)}
                sx={{
                  px: 1.5,
                  py: 0.6,
                  cursor: 'pointer',
                  fontSize: '0.78rem',
                  fontWeight: showCustom && value.type === 'custom' ? 700 : 400,
                  color: showCustom ? 'primary.main' : 'text.primary',
                  backgroundColor: showCustom
                    ? alpha(theme.palette.primary.main, 0.08)
                    : 'transparent',
                  transition: 'all 0.1s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.primary.main, 0.06),
                  },
                }}
              >
                <TimeIcon sx={{ fontSize: 14 }} />
                {t('dateRange.custom', { defaultValue: 'Custom Range' })}
              </Box>
            </>
          )}
        </Box>

        {/* Right: Custom Range or Preview */}
        {showCustomRange && (
          <Box
            sx={{ width: 340, p: 2, display: 'flex', flexDirection: 'column' }}
          >
            {showCustom ? (
              <>
                <Typography
                  variant="subtitle2"
                  fontWeight={600}
                  sx={{
                    mb: 1.5,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                  }}
                >
                  <CalendarIcon sx={{ fontSize: 16 }} />
                  {t('dateRange.customRange', {
                    defaultValue: 'Custom Date Range',
                  })}
                </Typography>

                <Typography
                  variant="caption"
                  sx={{
                    mb: 0.5,
                    fontWeight: 500,
                    color: 'text.secondary',
                    fontSize: '0.7rem',
                  }}
                >
                  {t('dateRange.from', { defaultValue: 'From' })}
                </Typography>
                <TextField
                  type="datetime-local"
                  size="small"
                  value={draftStart.slice(0, 19)}
                  onChange={(e) => setDraftStart(e.target.value)}
                  inputProps={{ step: 1 }}
                  sx={{
                    mb: 1.5,
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 1.5,
                      fontSize: '0.82rem',
                    },
                  }}
                  fullWidth
                />

                <Typography
                  variant="caption"
                  sx={{
                    mb: 0.5,
                    fontWeight: 500,
                    color: 'text.secondary',
                    fontSize: '0.7rem',
                  }}
                >
                  {t('dateRange.to', { defaultValue: 'To' })}
                </Typography>
                <TextField
                  type="datetime-local"
                  size="small"
                  value={draftEnd.slice(0, 19)}
                  onChange={(e) => setDraftEnd(e.target.value)}
                  inputProps={{ step: 1 }}
                  sx={{
                    mb: 1.5,
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 1.5,
                      fontSize: '0.82rem',
                    },
                  }}
                  fullWidth
                />

                <Divider sx={{ mb: 1 }} />
                <Typography
                  variant="caption"
                  sx={{
                    mb: 0.5,
                    fontWeight: 500,
                    color: 'text.secondary',
                    fontSize: '0.7rem',
                  }}
                >
                  {t('dateRange.quickSelect', { defaultValue: 'Quick Select' })}
                </Typography>

                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: 0.5,
                    mb: 1,
                  }}
                >
                  {presets.map((p) => {
                    const hours = presetToHours(p.value);
                    const minutes = hours != null ? Math.round(hours * 60) : 60;
                    return (
                      <Button
                        key={p.value}
                        size="small"
                        variant="outlined"
                        onClick={() => handleQuickSet(minutes)}
                        sx={{
                          fontSize: '0.65rem',
                          px: 0.5,
                          py: 0.3,
                          minWidth: 0,
                          textTransform: 'none',
                          borderRadius: 1,
                          borderColor: 'divider',
                          color: 'text.secondary',
                          '&:hover': {
                            borderColor: 'primary.main',
                            color: 'primary.main',
                          },
                        }}
                      >
                        {t(p.labelKey, { defaultValue: p.fallback })}
                      </Button>
                    );
                  })}
                </Box>

                {!isValidCustomRange && draftStart && draftEnd && (
                  <Typography
                    variant="caption"
                    color="error"
                    sx={{ mb: 1, fontSize: '0.7rem' }}
                  >
                    {t('dateRange.invalidRange', {
                      defaultValue: 'Start must be before end',
                    })}
                  </Typography>
                )}

                <Box sx={{ flexGrow: 1 }} />

                <Button
                  variant="contained"
                  size="small"
                  disabled={!isValidCustomRange}
                  onClick={handleApplyCustom}
                  sx={{
                    alignSelf: 'flex-end',
                    textTransform: 'none',
                    borderRadius: 1.5,
                    px: 3,
                    mb: 1,
                  }}
                >
                  {t('dateRange.apply', { defaultValue: 'Apply' })}
                </Button>
              </>
            ) : (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flex: 1,
                }}
              >
                <CalendarIcon
                  sx={{
                    fontSize: 40,
                    color: alpha(theme.palette.primary.main, 0.2),
                    mb: 1,
                  }}
                />
                <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
                  {displayText}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontSize: '0.7rem' }}
                >
                  {t('dateRange.selectPresetOrCustom', {
                    defaultValue: 'Select a preset or choose a custom range',
                  })}
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => setShowCustom(true)}
                  sx={{
                    mt: 2,
                    textTransform: 'none',
                    borderRadius: 1.5,
                    fontSize: '0.78rem',
                  }}
                >
                  {t('dateRange.setCustomRange', {
                    defaultValue: 'Set Custom Range',
                  })}
                </Button>
              </Box>
            )}
          </Box>
        )}
      </Popover>
    </>
  );
};

export default DateRangeSelector;

// ==================== Utility Functions ====================

export function dateRangeToApiParams(value: DateRangeValue): {
  period?: string;
  start?: string;
  end?: string;
} {
  if (value.type === 'preset') {
    return { period: value.preset || '24h' };
  }
  if (value.type === 'custom' && value.start && value.end) {
    const startObj =
      typeof value.start === 'string' ? new Date(value.start) : value.start;
    const endObj =
      typeof value.end === 'string' ? new Date(value.end) : value.end;
    return {
      period: 'custom',
      start: startObj.toISOString(),
      end: endObj.toISOString(),
    };
  }
  return { period: '24h' };
}

/**
 * Convert a preset string (e.g. '24h', '7d') to hours.
 * Returns undefined for unknown formats.
 */
export function presetToHours(preset: string): number | undefined {
  const match = preset.match(/^(\d+)(min|h|d|m)$/);
  if (!match) return undefined;
  const [, numStr, unit] = match;
  const num = parseInt(numStr, 10);
  if (unit === 'min') return num / 60;
  if (unit === 'h') return num;
  if (unit === 'd') return num * 24;
  if (unit === 'm') return num * 30 * 24;
  return undefined;
}

/**
 * Convert a DateRangeValue to a concrete { start: Date, end: Date } range.
 * For presets this calculates relative to `now` in the user's configured timezone.
 */
export function dateRangeToDatePair(value: DateRangeValue): {
  start: Date;
  end: Date;
} {
  if (value.type === 'custom' && value.start && value.end) {
    const startObj =
      typeof value.start === 'string' ? new Date(value.start) : value.start;
    const endObj =
      typeof value.end === 'string' ? new Date(value.end) : value.end;
    return { start: startObj, end: endObj };
  }
  const preset = value.preset || '24h';
  const tz = getStoredTimezone();
  const now = dayjs().tz(tz);
  const end = now;
  // Check for minute-based preset
  const minMatch = preset.match(/^(\d+)min$/);
  if (minMatch) {
    const minutes = parseInt(minMatch[1], 10);
    const start = now.subtract(minutes, 'minute');
    return { start: start.toDate(), end: end.toDate() };
  }
  const hours = presetToHours(preset) || 24;
  const start = now.subtract(hours, 'hour');
  return { start: start.toDate(), end: end.toDate() };
}
