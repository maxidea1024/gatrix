import React, { useState } from 'react';
import {
  Box,
  Popover,
  Typography,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Check as CheckMarkIcon,
} from '@mui/icons-material';

export interface ChipSelectOption {
  /** The value stored / emitted */
  value: string;
  /** Display label shown in the dropdown and chip */
  label: string;
  /** Optional color dot shown next to the label */
  color?: string;
  /** Optional secondary description */
  desc?: string;
}

interface ChipSelectProps {
  /** Category label shown on the left half of the chip */
  label: string;
  /** Available options */
  options: ChipSelectOption[];
  /** Currently selected value */
  value: string;
  /** Called when selection changes */
  onChange: (value: string) => void;
  /** Minimum width of the popover (default: 180) */
  popoverMinWidth?: number;
  /** If true, the chip is disabled */
  disabled?: boolean;
}

/**
 * A compact single-select chip that replaces MUI's outlined Select.
 *
 * Renders as: [ Label │ SelectedValue ▾ ]
 *
 * Matches the visual pattern of `MultiSelectFilterChip` but for
 * single-value selection with an optional color dot per option.
 */
const ChipSelect: React.FC<ChipSelectProps> = ({
  label,
  options,
  value,
  onChange,
  popoverMinWidth = 180,
  disabled = false,
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const selectedOption = options.find((o) => o.value === value);
  const displayLabel = selectedOption?.label ?? value;
  const displayColor = selectedOption?.color;

  const handleOpen = (e: React.MouseEvent<HTMLElement>) => {
    if (disabled) return;
    setAnchorEl(e.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSelect = (val: string) => {
    onChange(val);
    handleClose();
  };

  return (
    <>
      <Box
        onClick={handleOpen}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          height: '37px',
          borderRadius: '4px',
          border: '1px solid',
          borderColor: open ? 'primary.main' : 'divider',
          bgcolor: open ? 'action.hover' : 'background.paper',
          cursor: disabled ? 'default' : 'pointer',
          transition: 'all 0.15s',
          overflow: 'hidden',
          opacity: disabled ? 0.5 : 1,
          flexShrink: 0,
          '&:hover': disabled
            ? {}
            : {
                borderColor: 'primary.main',
                bgcolor: 'action.hover',
              },
        }}
      >
        {/* Label section (left) */}
        <Box
          sx={{
            px: 1,
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            bgcolor: (theme) =>
              theme.palette.mode === 'dark'
                ? 'rgba(255,255,255,0.06)'
                : 'rgba(0,0,0,0.04)',
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

        {/* Value section (right) */}
        <Box
          sx={{
            px: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
          }}
        >
          {displayColor && (
            <Box
              sx={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: displayColor,
                flexShrink: 0,
              }}
            />
          )}
          <Typography
            component="span"
            sx={{
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'text.primary',
              whiteSpace: 'nowrap',
            }}
          >
            {displayLabel}
          </Typography>
          <ExpandMoreIcon
            sx={{
              fontSize: 14,
              color: 'text.disabled',
              transition: 'transform 0.2s',
              transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
              ml: -0.25,
            }}
          />
        </Box>
      </Box>

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
              minWidth: popoverMinWidth,
              maxWidth: 320,
              borderRadius: '10px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
              py: 0.5,
            },
          },
        }}
      >
        {options.map((option) => {
          const isSelected = option.value === value;
          return (
            <Box
              key={option.value}
              onClick={() => handleSelect(option.value)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 1.5,
                py: 0.75,
                cursor: 'pointer',
                transition: 'background 0.1s',
                backgroundColor: isSelected ? 'action.selected' : 'transparent',
                '&:hover': {
                  bgcolor: 'action.hover',
                },
              }}
            >
              {/* Color dot */}
              {option.color && (
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: option.color,
                    flexShrink: 0,
                  }}
                />
              )}

              {/* Label + desc */}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  sx={{
                    fontSize: '0.8rem',
                    fontWeight: isSelected ? 700 : 500,
                    color: isSelected ? 'text.primary' : 'text.secondary',
                  }}
                >
                  {option.label}
                </Typography>
                {option.desc && (
                  <Typography
                    sx={{
                      fontSize: '0.68rem',
                      color: 'text.disabled',
                      lineHeight: 1.3,
                    }}
                  >
                    {option.desc}
                  </Typography>
                )}
              </Box>

              {/* Check mark */}
              {isSelected && (
                <CheckMarkIcon
                  sx={{ fontSize: 16, color: 'primary.main', flexShrink: 0 }}
                />
              )}
            </Box>
          );
        })}
      </Popover>
    </>
  );
};

export default ChipSelect;
