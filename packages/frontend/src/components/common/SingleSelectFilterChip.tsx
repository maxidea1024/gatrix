import React from 'react';
import { Box, Typography, Select, MenuItem, useTheme } from '@mui/material';
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';

interface SingleSelectFilterChipProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  emptyMeansAll?: boolean;
}

const SingleSelectFilterChip: React.FC<SingleSelectFilterChipProps> = ({
  label,
  value,
  options,
  onChange,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const selectedOption = options.find((o) => o.value === value);
  const summaryText = selectedOption ? selectedOption.label : '';

  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        height: '32px',
        borderRadius: '4px',
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        position: 'relative',
        transition: 'all 0.15s',
        overflow: 'hidden',
        '&:hover': {
          borderColor: 'primary.main',
          bgcolor: 'action.hover',
        },
      }}
    >
      {/* Label section */}
      <Box
        sx={{
          px: 1,
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
          borderRight: '1px solid',
          borderRightColor: 'divider',
        }}
      >
        <Typography
          component="span"
          sx={{
            fontSize: '0.75rem',
            fontWeight: 500,
            color: 'text.secondary',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </Typography>
      </Box>

      {/* Value section */}
      <Box
        sx={{
          px: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          position: 'relative',
        }}
      >
        <Typography
          component="span"
          sx={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: 'text.primary',
            whiteSpace: 'nowrap',
            maxWidth: 200,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {summaryText}
        </Typography>
        <ExpandMoreIcon
          sx={{
            fontSize: 14,
            color: 'text.disabled',
            ml: -0.25,
          }}
        />

        {/* Invisible Select overlaid on top for native interaction */}
        <Select
          value={value}
          onChange={(e) => onChange(e.target.value as string)}
          MenuProps={{
            PaperProps: {
              sx: {
                mt: 0.5,
                borderRadius: '8px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
              },
            },
          }}
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            opacity: 0,
            cursor: 'pointer',
            '& .MuiSelect-select': {
              width: '100%',
              height: '100%',
            },
          }}
        >
          {options.map((o) => (
            <MenuItem key={o.value} value={o.value} sx={{ fontSize: '0.8rem' }}>
              {o.label}
            </MenuItem>
          ))}
        </Select>
      </Box>
    </Box>
  );
};

export default SingleSelectFilterChip;
