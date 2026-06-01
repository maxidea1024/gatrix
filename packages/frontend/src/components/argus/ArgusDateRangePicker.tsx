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

// ==================== Types ====================

export interface ArgusDateRangeValue {
  type: 'preset' | 'custom';
  preset?: string;
  start?: Date;
  end?: Date;
}

export interface ArgusDateRangePreset {
  value: string;
  labelKey: string;
  fallback: string;
}

interface ArgusDateRangePickerProps {
  value: ArgusDateRangeValue;
  onChange: (value: ArgusDateRangeValue) => void;
  presets?: ArgusDateRangePreset[];
  compact?: boolean;
}

// ==================== Default Presets ====================

const DEFAULT_PRESETS: ArgusDateRangePreset[] = [
  { value: '1h', labelKey: 'dateRange.preset.1h', fallback: '1 Hour' },
  { value: '6h', labelKey: 'dateRange.preset.6h', fallback: '6 Hours' },
  { value: '24h', labelKey: 'dateRange.preset.24h', fallback: '24 Hours' },
  { value: '7d', labelKey: 'dateRange.preset.7d', fallback: '7 Days' },
  { value: '14d', labelKey: 'dateRange.preset.14d', fallback: '14 Days' },
  { value: '30d', labelKey: 'dateRange.preset.30d', fallback: '30 Days' },
  { value: '90d', labelKey: 'dateRange.preset.90d', fallback: '90 Days' },
];

// ==================== Helpers ====================

function formatDateTimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function parseDateTimeLocal(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function presetToDisplay(preset: string, t: (key: string, options?: any) => string): string {
  const key = `dateRange.preset.${preset}`;
  const translated = t(key, { defaultValue: '' });
  if (translated && translated !== key && translated !== '') return translated;
  const match = preset.match(/^(\d+)(h|d|m)$/);
  if (!match) return preset;
  const [, num, unit] = match;
  const unitMap: Record<string, string> = {
    h: t('dateRange.unit.hours', { defaultValue: 'Hours' }),
    d: t('dateRange.unit.days', { defaultValue: 'Days' }),
    m: t('dateRange.unit.months', { defaultValue: 'Months' }),
  };
  return `${num} ${unitMap[unit] || unit}`;
}

function formatDateDisplay(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// ==================== Component ====================

const ArgusDateRangePicker: React.FC<ArgusDateRangePickerProps> = ({
  value,
  onChange,
  presets = DEFAULT_PRESETS,
  compact = false,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const [draftStart, setDraftStart] = useState<string>(() => {
    if (value.type === 'custom' && value.start) return formatDateTimeLocal(value.start);
    const d = new Date(); d.setHours(d.getHours() - 24);
    return formatDateTimeLocal(d);
  });
  const [draftEnd, setDraftEnd] = useState<string>(() => {
    if (value.type === 'custom' && value.end) return formatDateTimeLocal(value.end);
    return formatDateTimeLocal(new Date());
  });
  const [showCustom, setShowCustom] = useState(value.type === 'custom');

  const displayText = useMemo(() => {
    if (value.type === 'preset') {
      return t('dateRange.last', { defaultValue: 'Last' }) + ' ' + presetToDisplay(value.preset || '24h', t);
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

  const handleClose = () => { setAnchorEl(null); };

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

  const handleQuickSet = useCallback((hoursAgo: number) => {
    const end = new Date();
    const start = new Date(end.getTime() - hoursAgo * 3600_000);
    setDraftStart(formatDateTimeLocal(start));
    setDraftEnd(formatDateTimeLocal(end));
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
          bgcolor: open ? alpha(theme.palette.primary.main, 0.04) : 'background.paper',
          cursor: 'pointer',
          transition: 'all 0.15s',
          overflow: 'hidden',
          '&:hover': {
            borderColor: 'primary.main',
            bgcolor: alpha(theme.palette.primary.main, 0.04),
          },
        }}
      >
        <Box sx={{
          px: 1, height: '100%', display: 'flex', alignItems: 'center',
          bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
          borderRight: '1px solid', borderRightColor: 'divider',
        }}>
          <CalendarIcon sx={{ fontSize: 15, color: 'text.secondary' }} />
        </Box>
        <Box sx={{ px: 1.2, display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography component="span" sx={{
            fontSize: compact ? '0.7rem' : '0.75rem',
            fontWeight: 600,
            color: 'text.primary',
            whiteSpace: 'nowrap',
            maxWidth: compact ? 140 : 260,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {displayText}
          </Typography>
          <ExpandMoreIcon sx={{
            fontSize: 14, color: 'text.disabled',
            transition: 'transform 0.2s',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }} />
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
              minHeight: 320,
            },
          },
        }}
      >
        {/* Left: Presets */}
        <Box sx={{
          width: 150,
          borderRight: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          py: 1,
          display: 'flex',
          flexDirection: 'column',
        }}>
          <Typography variant="caption" sx={{ px: 1.5, pb: 0.5, fontWeight: 600, color: 'text.secondary', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {t('dateRange.relative', { defaultValue: 'Relative' })}
          </Typography>
          {presets.map((p) => {
            const isActive = value.type === 'preset' && value.preset === p.value;
            return (
              <Box
                key={p.value}
                onClick={() => handlePresetClick(p.value)}
                sx={{
                  px: 1.5, py: 0.6,
                  cursor: 'pointer',
                  fontSize: '0.78rem',
                  fontWeight: isActive ? 700 : 400,
                  color: isActive ? 'primary.main' : 'text.primary',
                  backgroundColor: isActive ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
                  transition: 'all 0.1s',
                  '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.06) },
                }}
              >
                {t(p.labelKey, { defaultValue: p.fallback })}
              </Box>
            );
          })}

          <Divider sx={{ my: 1 }} />

          <Box
            onClick={() => setShowCustom(true)}
            sx={{
              px: 1.5, py: 0.6,
              cursor: 'pointer',
              fontSize: '0.78rem',
              fontWeight: showCustom && value.type === 'custom' ? 700 : 400,
              color: showCustom ? 'primary.main' : 'text.primary',
              backgroundColor: showCustom ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
              transition: 'all 0.1s',
              display: 'flex', alignItems: 'center', gap: 0.5,
              '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.06) },
            }}
          >
            <TimeIcon sx={{ fontSize: 14 }} />
            {t('dateRange.custom', { defaultValue: 'Custom Range' })}
          </Box>
        </Box>

        {/* Right: Custom Range or Preview */}
        <Box sx={{ flex: 1, p: 2, display: 'flex', flexDirection: 'column', minWidth: 300 }}>
          {showCustom ? (
            <>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <CalendarIcon sx={{ fontSize: 16 }} />
                {t('dateRange.customRange', { defaultValue: 'Custom Date Range' })}
              </Typography>

              <Typography variant="caption" sx={{ mb: 0.5, fontWeight: 500, color: 'text.secondary', fontSize: '0.7rem' }}>
                {t('dateRange.from', { defaultValue: 'From' })}
              </Typography>
              <TextField
                type="datetime-local"
                size="small"
                value={draftStart.slice(0, 19)}
                onChange={(e) => setDraftStart(e.target.value)}
                inputProps={{ step: 1 }}
                sx={{ mb: 1.5, '& .MuiOutlinedInput-root': { borderRadius: 1.5, fontSize: '0.82rem' } }}
                fullWidth
              />

              <Typography variant="caption" sx={{ mb: 0.5, fontWeight: 500, color: 'text.secondary', fontSize: '0.7rem' }}>
                {t('dateRange.to', { defaultValue: 'To' })}
              </Typography>
              <TextField
                type="datetime-local"
                size="small"
                value={draftEnd.slice(0, 19)}
                onChange={(e) => setDraftEnd(e.target.value)}
                inputProps={{ step: 1 }}
                sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 1.5, fontSize: '0.82rem' } }}
                fullWidth
              />

              <Box sx={{ display: 'flex', gap: 0.5, mb: 2, flexWrap: 'wrap' }}>
                {[
                  { label: t('dateRange.quick.last1h', { defaultValue: 'Last 1h' }), hours: 1 },
                  { label: t('dateRange.quick.last6h', { defaultValue: 'Last 6h' }), hours: 6 },
                  { label: t('dateRange.quick.last24h', { defaultValue: 'Last 24h' }), hours: 24 },
                  { label: t('dateRange.quick.last7d', { defaultValue: 'Last 7d' }), hours: 168 },
                ].map((q) => (
                  <Button
                    key={q.hours}
                    size="small"
                    variant="outlined"
                    onClick={() => handleQuickSet(q.hours)}
                    sx={{ fontSize: '0.68rem', px: 1, py: 0.2, minWidth: 0, textTransform: 'none', borderRadius: 1 }}
                  >
                    {q.label}
                  </Button>
                ))}
              </Box>

              {!isValidCustomRange && draftStart && draftEnd && (
                <Typography variant="caption" color="error" sx={{ mb: 1, fontSize: '0.7rem' }}>
                  {t('dateRange.invalidRange', { defaultValue: 'Start must be before end' })}
                </Typography>
              )}

              <Button
                variant="contained"
                size="small"
                disabled={!isValidCustomRange}
                onClick={handleApplyCustom}
                sx={{ alignSelf: 'flex-end', textTransform: 'none', borderRadius: 1.5, px: 3 }}
              >
                {t('dateRange.apply', { defaultValue: 'Apply' })}
              </Button>
            </>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
              <CalendarIcon sx={{ fontSize: 40, color: alpha(theme.palette.primary.main, 0.2), mb: 1 }} />
              <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
                {displayText}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                {t('dateRange.selectPresetOrCustom', { defaultValue: 'Select a preset or choose a custom range' })}
              </Typography>
              <Button
                variant="outlined"
                size="small"
                onClick={() => setShowCustom(true)}
                sx={{ mt: 2, textTransform: 'none', borderRadius: 1.5, fontSize: '0.78rem' }}
              >
                {t('dateRange.setCustomRange', { defaultValue: 'Set Custom Range' })}
              </Button>
            </Box>
          )}
        </Box>
      </Popover>
    </>
  );
};

export default ArgusDateRangePicker;

// ==================== Utility ====================

export function argusDateRangeToApiParams(value: ArgusDateRangeValue): {
  period?: string;
  start?: string;
  end?: string;
} {
  if (value.type === 'preset') {
    return { period: value.preset || '24h' };
  }
  if (value.type === 'custom' && value.start && value.end) {
    // Use local time format (YYYY-MM-DD HH:MM:SS) for ClickHouse DateTime64 compatibility
    return { period: 'custom', start: value.start.toISOString(), end: value.end.toISOString() };
  }
  return { period: '24h' };
}
