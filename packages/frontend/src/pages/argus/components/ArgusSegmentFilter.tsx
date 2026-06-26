/**
 * ArgusSegmentFilter — Global segment filter bar for Argus analytics pages.
 *
 * Supports multi-select for country / platform / app_version.
 * Values are stored as comma-separated strings (e.g. "US,KR,JP") to match
 * the backend buildSegmentFilter API.
 */
import React, { useMemo, useCallback } from 'react';
import {
  Box,
  Chip,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Checkbox,
  ListItemText,
  Button,
  alpha,
  useTheme,
  type SelectChangeEvent,
} from '@mui/material';
import {
  Close as CloseIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { ARGUS_SEMANTIC } from '../argusThemeTokens';

// ── Types ──

export interface SegmentFilterValues {
  /** Comma-separated country codes, e.g. "US,KR" */
  country?: string;
  /** Comma-separated platform names */
  platform?: string;
  /** Comma-separated app versions */
  app_version?: string;
}

interface ArgusSegmentFilterProps {
  value: SegmentFilterValues;
  onChange: (filters: SegmentFilterValues) => void;
  platforms?: string[];
  countries?: string[];
  appVersions?: string[];
}

// ── Helpers ──

/** Convert comma string to array, or empty array */
const toArray = (v?: string): string[] =>
  v ? v.split(',').filter(Boolean) : [];

/** Convert array back to comma string, or undefined */
const toComma = (arr: string[]): string | undefined =>
  arr.length > 0 ? arr.join(',') : undefined;

// ── Multi-Select Dropdown ──

const MultiFilterSelect: React.FC<{
  label: string;
  selected: string[];
  options: string[];
  onChange: (vals: string[]) => void;
  isDark: boolean;
}> = ({ label, selected, options, onChange, isDark }) => {
  const handleChange = (e: SelectChangeEvent<string[]>) => {
    const val = e.target.value;
    onChange(typeof val === 'string' ? val.split(',') : val);
  };

  return (
    <FormControl size="small" sx={{ minWidth: 120 }}>
      <InputLabel sx={{ fontSize: '0.75rem' }}>{label}</InputLabel>
      <Select<string[]>
        multiple
        label={label}
        value={selected}
        onChange={handleChange as any}
        renderValue={(sel) =>
          sel.length === 0 ? 'All' : sel.length === 1 ? sel[0] : `${sel.length} selected`
        }
        sx={{
          fontSize: '0.75rem',
          height: 32,
          '& .MuiSelect-select': { py: 0.5 },
          bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
        }}
        MenuProps={{
          PaperProps: { sx: { maxHeight: 300 } },
        }}
      >
        {options.map((opt) => (
          <MenuItem key={opt} value={opt} sx={{ fontSize: '0.75rem', py: 0.25 }}>
            <Checkbox checked={selected.includes(opt)} size="small" sx={{ p: 0.25, mr: 0.5 }} />
            <ListItemText primary={opt} primaryTypographyProps={{ fontSize: '0.75rem' }} />
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};

// ── Main Component ──

const ArgusSegmentFilter: React.FC<ArgusSegmentFilterProps> = ({
  value,
  onChange,
  platforms = [],
  countries = [],
  appVersions = [],
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { t } = useTranslation();

  const countryArr = useMemo(() => toArray(value.country), [value.country]);
  const platformArr = useMemo(() => toArray(value.platform), [value.platform]);
  const versionArr = useMemo(() => toArray(value.app_version), [value.app_version]);

  const activeChips = useMemo(() => {
    const chips: { key: keyof SegmentFilterValues; label: string; values: string[] }[] = [];
    if (countryArr.length > 0) chips.push({ key: 'country', label: 'Country', values: countryArr });
    if (platformArr.length > 0) chips.push({ key: 'platform', label: 'Platform', values: platformArr });
    if (versionArr.length > 0) chips.push({ key: 'app_version', label: 'Version', values: versionArr });
    return chips;
  }, [countryArr, platformArr, versionArr]);

  const hasFilters = activeChips.length > 0;

  const handleReset = useCallback(() => {
    onChange({});
  }, [onChange]);

  const handleRemoveChip = useCallback((key: keyof SegmentFilterValues, val: string) => {
    const current = toArray(value[key]);
    const next = current.filter(v => v !== val);
    onChange({ ...value, [key]: toComma(next) });
  }, [value, onChange]);

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        flexWrap: 'wrap',
      }}
    >


      {countries.length > 0 && (
        <MultiFilterSelect
          label={t('argus.filter.country', 'Country')}
          selected={countryArr}
          options={countries}
          onChange={(arr) => onChange({ ...value, country: toComma(arr) })}
          isDark={isDark}
        />
      )}
      {platforms.length > 0 && (
        <MultiFilterSelect
          label={t('argus.filter.platform', 'Platform')}
          selected={platformArr}
          options={platforms}
          onChange={(arr) => onChange({ ...value, platform: toComma(arr) })}
          isDark={isDark}
        />
      )}
      {appVersions.length > 0 && (
        <MultiFilterSelect
          label={t('argus.filter.appVersion', 'Version')}
          selected={versionArr}
          options={appVersions}
          onChange={(arr) => onChange({ ...value, app_version: toComma(arr) })}
          isDark={isDark}
        />
      )}

      {/* Active filter chips — one chip per selected value */}
      {activeChips.flatMap((group) =>
        group.values.map((val) => (
          <Chip
            key={`${group.key}-${val}`}
            label={`${group.label}: ${val}`}
            size="small"
            onDelete={() => handleRemoveChip(group.key, val)}
            sx={{
              height: 24,
              fontSize: '0.7rem',
              fontWeight: 600,
              bgcolor: alpha(ARGUS_SEMANTIC.info, isDark ? 0.12 : 0.06),
              color: ARGUS_SEMANTIC.info,
              '& .MuiChip-deleteIcon': {
                fontSize: 14,
                color: ARGUS_SEMANTIC.info,
                '&:hover': { color: ARGUS_SEMANTIC.negative },
              },
            }}
          />
        ))
      )}

      {hasFilters && (
        <Button
          size="small"
          onClick={handleReset}
          startIcon={<CloseIcon sx={{ fontSize: 12 }} />}
          sx={{
            fontSize: '0.65rem',
            textTransform: 'none',
            color: 'text.secondary',
            minWidth: 0,
            px: 1,
          }}
        >
          {t('argus.filter.reset', 'Reset')}
        </Button>
      )}
    </Box>
  );
};

export default ArgusSegmentFilter;
export type { ArgusSegmentFilterProps };
