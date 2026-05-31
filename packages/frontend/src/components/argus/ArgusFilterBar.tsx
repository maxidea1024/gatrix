import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  IconButton,
  Divider,
  useTheme,
  alpha,
  Tooltip,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  FilterList as FilterIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import MultiSelectFilterChip from '@/components/common/MultiSelectFilterChip';
import ArgusDateRangePicker, { ArgusDateRangeValue, argusDateRangeToApiParams } from './ArgusDateRangePicker';
import argusService from '@/services/argusService';

// ==================== Types ====================

export interface ArgusFilterState {
  dateRange: ArgusDateRangeValue;
  environments: string[];
  browsers: string[];
  os: string[];
}

interface ArgusFilterBarProps {
  projectId: string | number;
  /** Current filter state */
  value: ArgusFilterState;
  /** Called when any filter changes */
  onChange: (state: ArgusFilterState) => void;
  /** Called when refresh button is clicked */
  onRefresh?: () => void;
  /** Show loading spinner on refresh icon */
  loading?: boolean;
  /** Hide specific filters */
  hideFilters?: ('environment' | 'browser' | 'os')[];
  /** Extra controls to render before the spacer (e.g., sort chip) */
  extraControls?: React.ReactNode;
}

// ==================== Default State ====================

export const defaultArgusFilterState = (savedPreset?: string): ArgusFilterState => ({
  dateRange: { type: 'preset', preset: savedPreset || '24h' },
  environments: [],
  browsers: [],
  os: [],
});

// ==================== Component ====================

const ArgusFilterBar: React.FC<ArgusFilterBarProps> = ({
  projectId,
  value,
  onChange,
  onRefresh,
  loading = false,
  hideFilters = [],
  extraControls,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';

  // Filter options from API
  const [options, setOptions] = useState<{
    environments: string[];
    browsers: string[];
    os: string[];
  }>({ environments: [], browsers: [], os: [] });

  const fetchOptions = useCallback(async () => {
    try {
      const result = await argusService.getFilterOptions(projectId);
      setOptions(result);
    } catch (error) {
      console.error('Failed to fetch filter options:', error);
    }
  }, [projectId]);

  useEffect(() => { fetchOptions(); }, [fetchOptions]);

  const handleDateRangeChange = (dateRange: ArgusDateRangeValue) => {
    onChange({ ...value, dateRange });
  };

  const handleEnvironmentChange = (environments: string[]) => {
    onChange({ ...value, environments });
  };

  const handleBrowserChange = (browsers: string[]) => {
    onChange({ ...value, browsers });
  };

  const handleOsChange = (os: string[]) => {
    onChange({ ...value, os });
  };

  const hasActiveFilters =
    value.environments.length > 0 ||
    value.browsers.length > 0 ||
    value.os.length > 0;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.75,
        mb: 2.5,
        px: 1.5,
        py: 0.8,
        borderRadius: '10px',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        background: isDark
          ? 'rgba(255,255,255,0.02)'
          : 'rgba(0,0,0,0.015)',
        backdropFilter: 'blur(8px)',
        flexWrap: 'wrap',
        position: 'relative',
        transition: 'border-color 0.2s',
        ...(hasActiveFilters && {
          borderColor: alpha(theme.palette.primary.main, 0.2),
        }),
      }}
    >
      {/* Filter icon indicator */}
      <Tooltip title={t('argus.filters.filters', { defaultValue: 'Filters' })}>
        <FilterIcon sx={{
          fontSize: 16,
          color: hasActiveFilters ? theme.palette.primary.main : 'text.disabled',
          transition: 'color 0.2s',
        }} />
      </Tooltip>

      {/* Environment */}
      {!hideFilters.includes('environment') && options.environments.length > 0 && (
        <MultiSelectFilterChip
          label={t('argus.filters.environment', { defaultValue: 'Environment' })}
          options={options.environments.map(e => ({ value: e, label: e }))}
          selected={value.environments}
          onChange={handleEnvironmentChange}
          emptyMeansAll
        />
      )}

      {/* Browser */}
      {!hideFilters.includes('browser') && options.browsers.length > 0 && (
        <MultiSelectFilterChip
          label={t('argus.filters.browser', { defaultValue: 'Browser' })}
          options={options.browsers.map(b => ({ value: b, label: b }))}
          selected={value.browsers}
          onChange={handleBrowserChange}
          emptyMeansAll
        />
      )}

      {/* OS */}
      {!hideFilters.includes('os') && options.os.length > 0 && (
        <MultiSelectFilterChip
          label={t('argus.filters.os', { defaultValue: 'OS' })}
          options={options.os.map(o => ({ value: o, label: o }))}
          selected={value.os}
          onChange={handleOsChange}
          emptyMeansAll
        />
      )}

      {/* Extra controls (e.g., sort chip) */}
      {extraControls}

      {/* Spacer */}
      <Box sx={{ flex: 1 }} />

      {/* Date Range Picker — always rightmost */}
      <ArgusDateRangePicker
        value={value.dateRange}
        onChange={handleDateRangeChange}
      />

      {/* Divider + Refresh */}
      {onRefresh && (
        <>
          <Divider orientation="vertical" flexItem sx={{ mx: 0.3, borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)' }} />
          <Tooltip title={t('common.refresh', { defaultValue: 'Refresh' })}>
            <span>
              <IconButton onClick={onRefresh} disabled={loading} size="small" sx={{ p: 0.5 }}>
                <RefreshIcon sx={{
                  fontSize: 18,
                  transition: 'transform 0.3s',
                  ...(loading && {
                    animation: 'argus-spin 1s linear infinite',
                    '@keyframes argus-spin': {
                      from: { transform: 'rotate(0deg)' },
                      to: { transform: 'rotate(360deg)' },
                    },
                  }),
                }} />
              </IconButton>
            </span>
          </Tooltip>
        </>
      )}
    </Box>
  );
};

export default ArgusFilterBar;

// ==================== Utility ====================

/**
 * Convert ArgusFilterState to API parameters object.
 * Merges date range params + contextual filter params.
 */
export function argusFilterStateToApiParams(state: ArgusFilterState): {
  period?: string;
  start?: string;
  end?: string;
  environment?: string;
  browser?: string;
  os?: string;
} {
  const dateParams = argusDateRangeToApiParams(state.dateRange);
  return {
    ...dateParams,
    environment: state.environments.length === 1 ? state.environments[0] : undefined,
    browser: state.browsers.length === 1 ? state.browsers[0] : undefined,
    os: state.os.length === 1 ? state.os[0] : undefined,
  };
}
