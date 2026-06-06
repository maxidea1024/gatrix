import React from 'react';
import { Box, Typography, Popover, useTheme, alpha } from '@mui/material';
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';

export interface FilterChipOption {
  value: string;
  label: string;
  color?: string;
}

export interface FilterChipSelectProps {
  /** Label shown before the value (e.g. "Status") */
  label: string;
  /** Currently selected value */
  value: string;
  /** Available options */
  options: FilterChipOption[];
  /** Popover anchor element (null = closed) */
  anchorEl: HTMLElement | null;
  /** Called when chip is clicked to open */
  onOpen: (e: React.MouseEvent<HTMLElement>) => void;
  /** Called when popover should close */
  onClose: () => void;
  /** Called when an option is selected */
  onSelect: (value: string) => void;
}

/**
 * A compact chip-style dropdown selector with popover.
 * Used for inline filter controls (Status, Level, Sort, etc.)
 */
const FilterChipSelect: React.FC<FilterChipSelectProps> = ({
  label,
  value,
  options,
  anchorEl,
  onOpen,
  onClose,
  onSelect,
}) => {
  const theme = useTheme();
  const currentOption = options.find((o) => o.value === value);
  const displayLabel = currentOption?.label || options[0]?.label;
  const dotColor = currentOption?.color;

  return (
    <>
      <Box
        onClick={onOpen}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          height: 28,
          px: 1.2,
          borderRadius: '6px',
          border: '1px solid',
          borderColor: anchorEl ? 'primary.main' : 'divider',
          bgcolor: anchorEl
            ? alpha(theme.palette.primary.main, 0.04)
            : 'transparent',
          cursor: 'pointer',
          transition: 'all 0.15s',
          userSelect: 'none',
          '&:hover': {
            borderColor: 'primary.main',
            bgcolor: alpha(theme.palette.primary.main, 0.04),
          },
        }}
      >
        {dotColor && (
          <Box
            sx={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: dotColor,
            }}
          />
        )}
        <Typography
          sx={{ fontSize: '0.72rem', fontWeight: 600, color: 'text.secondary' }}
        >
          {label}:
        </Typography>
        <Typography
          sx={{ fontSize: '0.72rem', fontWeight: 700, color: 'text.primary' }}
        >
          {displayLabel}
        </Typography>
        <ExpandMoreIcon
          sx={{
            fontSize: 13,
            color: 'text.disabled',
            transform: anchorEl ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.2s',
          }}
        />
      </Box>
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={onClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: {
              mt: 0.5,
              borderRadius: '8px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
              minWidth: 140,
              py: 0.5,
            },
          },
        }}
      >
        {options.map((opt) => (
          <Box
            key={opt.value}
            onClick={() => {
              onSelect(opt.value);
              onClose();
            }}
            sx={{
              px: 1.5,
              py: 0.6,
              cursor: 'pointer',
              fontSize: '0.78rem',
              fontWeight: opt.value === value ? 700 : 400,
              color: opt.value === value ? 'primary.main' : 'text.primary',
              backgroundColor:
                opt.value === value
                  ? alpha(theme.palette.primary.main, 0.06)
                  : 'transparent',
              display: 'flex',
              alignItems: 'center',
              gap: 0.8,
              transition: 'background 0.1s',
              '&:hover': {
                backgroundColor: alpha(theme.palette.primary.main, 0.04),
              },
            }}
          >
            {opt.color && (
              <Box
                sx={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  backgroundColor: opt.color,
                }}
              />
            )}
            {opt.label}
          </Box>
        ))}
      </Popover>
    </>
  );
};

export default React.memo(FilterChipSelect);
