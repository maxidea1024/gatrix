import React, { useState, useRef } from 'react';
import {
  Box,
  Popover,
  Typography,
  useTheme,
  alpha,
} from '@mui/material';
import { CompareArrows as CompareIcon } from '@mui/icons-material';

export type ComparePeriod =
  | ''
  | 'previous_period'
  | 'previous_week'
  | 'previous_month'
  | 'previous_year';

interface CompareSelectorProps {
  value: ComparePeriod;
  onChange: (value: ComparePeriod) => void;
}

const OPTIONS: { value: ComparePeriod; label: string }[] = [
  { value: '', label: 'None' },
  { value: 'previous_period', label: 'Previous Period' },
  { value: 'previous_week', label: 'Previous Week' },
  { value: 'previous_month', label: 'Previous Month' },
  { value: 'previous_year', label: 'Previous Year' },
];

const CompareSelector: React.FC<CompareSelectorProps> = ({ value, onChange }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const anchorRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const activeOption = OPTIONS.find((o) => o.value === value);
  const isActive = !!value;

  return (
    <>
      <Box
        ref={anchorRef}
        onClick={() => setOpen(true)}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          cursor: 'pointer',
          px: 1.25,
          py: 0.5,
          borderRadius: 1.5,
          fontSize: '0.8rem',
          fontWeight: 500,
          border: `1px solid ${
            isActive
              ? alpha(theme.palette.primary.main, 0.3)
              : isDark
                ? 'rgba(255,255,255,0.08)'
                : 'rgba(0,0,0,0.08)'
          }`,
          color: isActive ? theme.palette.primary.main : 'text.secondary',
          bgcolor: isActive
            ? alpha(theme.palette.primary.main, isDark ? 0.1 : 0.05)
            : 'transparent',
          '&:hover': {
            bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
            borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)',
          },
          transition: 'all 0.15s ease',
          whiteSpace: 'nowrap',
        }}
      >
        <CompareIcon sx={{ fontSize: 16 }} />
        {isActive ? activeOption?.label : 'Compare'}
      </Box>

      <Popover
        open={open}
        anchorEl={anchorRef.current}
        onClose={() => setOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: {
              width: 200,
              mt: 0.5,
              borderRadius: 2,
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
              boxShadow: isDark
                ? '0 8px 32px rgba(0,0,0,0.5)'
                : '0 8px 32px rgba(0,0,0,0.12)',
              py: 0.5,
            },
          },
        }}
      >
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            px: 1.5,
            pt: 0.5,
            pb: 0.5,
            fontWeight: 700,
            color: 'text.secondary',
            fontSize: '0.65rem',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          Compare to
        </Typography>
        {OPTIONS.map((opt) => (
          <Box
            key={opt.value}
            onClick={() => {
              onChange(opt.value);
              setOpen(false);
            }}
            sx={{
              px: 1.5,
              py: 0.75,
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontWeight: value === opt.value ? 600 : 400,
              color: value === opt.value ? 'primary.main' : 'text.primary',
              bgcolor:
                value === opt.value
                  ? alpha(theme.palette.primary.main, isDark ? 0.1 : 0.05)
                  : 'transparent',
              '&:hover': {
                bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
              },
            }}
          >
            {opt.label}
          </Box>
        ))}
      </Popover>
    </>
  );
};

export default CompareSelector;
