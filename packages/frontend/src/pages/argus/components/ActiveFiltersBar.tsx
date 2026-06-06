import React from 'react';
import { Box, Chip, Typography, useTheme, alpha } from '@mui/material';
import { useTranslation } from 'react-i18next';

export interface ActiveFilter {
  key: string;
  value: string;
  exclude: boolean;
  enabled: boolean;
}

export interface ActiveFiltersBarProps {
  activeFilters: ActiveFilter[];
  isDark: boolean;
  onToggleFilter: (index: number) => void;
  onRemoveFilter: (index: number) => void;
  onClearAll: () => void;
}

const ActiveFiltersBar: React.FC<ActiveFiltersBarProps> = ({
  activeFilters,
  isDark,
  onToggleFilter,
  onRemoveFilter,
  onClearAll,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();

  if (activeFilters.length === 0) return null;

  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 0.5,
        px: 2,
        py: 0.75,
        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        backgroundColor: isDark ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.01)',
        alignItems: 'center',
        flexShrink: 0,
      }}
    >
      {activeFilters.map((f, idx) => (
        <Chip
          key={`${f.key}-${f.value}-${f.exclude}-${idx}`}
          label={`${f.key}${f.exclude ? ' ≠ ' : ': '}${f.value}`}
          size="small"
          onClick={() => onToggleFilter(idx)}
          onDelete={() => onRemoveFilter(idx)}
          sx={{
            height: 24,
            fontSize: '0.73rem',
            fontWeight: 600,
            cursor: 'pointer',
            backgroundColor: !f.enabled
              ? isDark
                ? 'rgba(255,255,255,0.04)'
                : 'rgba(0,0,0,0.04)'
              : f.exclude
                ? alpha(theme.palette.error.main, 0.12)
                : alpha(theme.palette.primary.main, 0.1),
            color: !f.enabled
              ? 'text.disabled'
              : f.exclude
                ? theme.palette.error.main
                : theme.palette.primary.main,
            borderRadius: '6px',
            opacity: f.enabled ? 1 : 0.55,
            textDecoration: f.enabled ? 'none' : 'line-through',
            transition: 'all 0.15s ease',
            '& .MuiChip-label': {
              textDecoration: f.enabled ? 'none' : 'line-through',
            },
            '& .MuiChip-deleteIcon': {
              fontSize: 14,
              color: !f.enabled
                ? 'text.disabled'
                : f.exclude
                  ? theme.palette.error.main
                  : theme.palette.primary.main,
              opacity: 0.6,
              '&:hover': { opacity: 1 },
            },
          }}
        />
      ))}
      <Typography
        component="span"
        onClick={onClearAll}
        sx={{
          fontSize: '0.7rem',
          color: 'text.disabled',
          cursor: 'pointer',
          ml: 0.5,
          '&:hover': { color: 'text.secondary', textDecoration: 'underline' },
        }}
      >
        {t('argus.logs.clearAll', 'Clear all')}
      </Typography>
    </Box>
  );
};

export default ActiveFiltersBar;
