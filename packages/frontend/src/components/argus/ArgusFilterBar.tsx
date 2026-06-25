import React, { useState, useEffect, useCallback } from 'react';
import { Box, useTheme, alpha } from '@mui/material';
import { useTranslation } from 'react-i18next';
import MultiSelectFilterChip from '@/components/common/MultiSelectFilterChip';
import DateRangeSelector, {
  DateRangeValue,
  dateRangeToApiParams,
} from '@/components/common/DateRangeSelector';
import argusService from '@/services/argusService';

// ==================== Types ====================

export interface ArgusFilterState {
  dateRange: DateRangeValue;
  environments: string[];
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
  /** Hide the environment filter */
  hideEnvironment?: boolean;
  /** Extra controls to render before the spacer (e.g., sort chip) */
  extraControls?: React.ReactNode;
}

// ==================== Default State ====================

export const defaultArgusFilterState = (
  savedPreset?: string
): ArgusFilterState => ({
  dateRange: { type: 'preset', preset: savedPreset || '14d' },
  environments: [],
});

// ==================== Component ====================

const ArgusFilterBar: React.FC<ArgusFilterBarProps> = ({
  projectId,
  value,
  onChange,
  onRefresh,
  loading = false,
  hideEnvironment = false,
  extraControls,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';

  // Environment options from API
  const [envOptions, setEnvOptions] = useState<string[]>([]);

  const fetchOptions = useCallback(async () => {
    try {
      const result = await argusService.getFilterOptions(projectId);
      setEnvOptions(result.environments || []);
    } catch (error) {
      console.error('Failed to fetch filter options:', error);
    }
  }, [projectId]);

  useEffect(() => {
    fetchOptions();
  }, [fetchOptions]);

  const handleDateRangeChange = (dateRange: DateRangeValue) => {
    onChange({ ...value, dateRange });
  };

  const handleEnvironmentChange = (environments: string[]) => {
    onChange({ ...value, environments });
  };

  const hasActiveFilters = value.environments.length > 0;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.75,
        mb: 1.25,
        px: 1.5,
        py: 0.8,
        borderRadius: '10px',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
        backdropFilter: 'blur(8px)',
        flexWrap: 'wrap',
        position: 'relative',
        zIndex: 20,
        transition: 'border-color 0.2s',
        ...(hasActiveFilters && {
          borderColor: alpha(theme.palette.primary.main, 0.2),
        }),
      }}
    >
      {/* Environment */}
      {!hideEnvironment && envOptions.length > 0 && (
        <MultiSelectFilterChip
          label={t('argus.filters.environment', {
            defaultValue: 'Environment',
          })}
          options={envOptions.map((e) => ({ value: e, label: e }))}
          selected={value.environments}
          onChange={handleEnvironmentChange}
          emptyMeansAll
        />
      )}

      {/* Extra controls (e.g., query AQL editor) — flex:1 fills remaining space */}
      {extraControls}

      {/* Date Range Picker — always rightmost */}
      <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center' }}>
        <DateRangeSelector
          value={value.dateRange}
          onChange={handleDateRangeChange}
        />
      </Box>
    </Box>
  );
};

export default React.memo(ArgusFilterBar);

// ==================== Utility ====================

/**
 * Convert ArgusFilterState to API parameters object.
 * Merges date range params + contextual filter params.
 */
export function argusFilterStateToApiParams(state: ArgusFilterState): {
  period?: string;
  start?: string;
  end?: string;
} {
  const dateParams = dateRangeToApiParams(state.dateRange);
  return {
    ...dateParams,
  };
}
