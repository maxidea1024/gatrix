import React, { useState, useMemo } from 'react';
import {
  Box,
  Popover,
  TextField,
  Checkbox,
  Typography,
  Button,
  Divider,
  InputAdornment,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectFilterChipProps {
  /** Category label shown on the chip (e.g. "환경", "조직") */
  label: string;
  /** Available options to select from */
  options: MultiSelectOption[];
  /** Currently selected values */
  selected: string[];
  /** Called when selection changes */
  onChange: (selected: string[]) => void;
  /** Chip size (default: 'small') */
  size?: 'small' | 'medium';
  /** Minimum width of the popover (default: 220) */
  popoverMinWidth?: number;
  /** Show search input when options exceed this count (default: 8) */
  searchThreshold?: number;
  /** If true, chip is hidden when options list is empty */
  hideWhenEmpty?: boolean;
}

/**
 * A compact multi-select filter chip that replaces horizontal chip lists.
 *
 * Renders as: [Label: 3/10 ▾]
 * Click opens a popover with search + checkbox list.
 */
const MultiSelectFilterChip: React.FC<MultiSelectFilterChipProps> = ({
  label,
  options,
  selected,
  onChange,
  size = 'small',
  popoverMinWidth = 220,
  searchThreshold = 8,
  hideWhenEmpty = false,
}) => {
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [searchText, setSearchText] = useState('');
  const open = Boolean(anchorEl);

  const allSelected = selected.length === options.length && options.length > 0;
  const noneSelected = selected.length === 0;

  // Summary: show selected item names (max 2) + overflow count
  const MAX_VISIBLE_LABELS = 2;
  const summaryText = useMemo(() => {
    if (allSelected) return t('common.all', 'All');
    if (noneSelected) return t('common.none', 'None');

    // Find labels for selected values (preserve option order)
    const selectedLabels = options
      .filter((opt) => selected.includes(opt.value))
      .map((opt) => opt.label);

    const visible = selectedLabels.slice(0, MAX_VISIBLE_LABELS);
    const overflow = selectedLabels.length - visible.length;

    return overflow > 0
      ? `${visible.join(', ')} +${overflow}`
      : visible.join(', ');
  }, [allSelected, noneSelected, selected, options, t]);

  // Filtered options by search
  const filteredOptions = useMemo(() => {
    if (!searchText) return options;
    const lower = searchText.toLowerCase();
    return options.filter((opt) =>
      opt.label.toLowerCase().includes(lower)
    );
  }, [options, searchText]);

  // Don't render if no options and hideWhenEmpty (AFTER all hooks)
  if (hideWhenEmpty && options.length === 0) return null;

  const handleToggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const handleSelectAll = () => {
    onChange(options.map((o) => o.value));
  };

  const handleDeselectAll = () => {
    onChange([]);
  };

  const handleOpen = (e: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(e.currentTarget);
    setSearchText('');
  };

  const handleClose = () => {
    setAnchorEl(null);
    setSearchText('');
  };

  return (
    <>
      <Box
        onClick={handleOpen}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          height: '32px',
          borderRadius: '4px',
          border: '1px solid',
          borderColor: open ? 'primary.main' : 'divider',
          bgcolor: open ? 'action.hover' : 'background.paper',
          cursor: 'pointer',
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
        {/* Value section */}
        <Box
          sx={{
            px: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
          }}
        >
          <Typography
            component="span"
            sx={{
              fontSize: '0.75rem',
              fontWeight: 600,
              color: noneSelected ? 'error.main' : 'text.primary',
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
            },
          },
        }}
      >
        {/* Header: Select All / Deselect All */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            px: 1.5,
            pt: 1,
            pb: 0.5,
          }}
        >
          <Typography
            variant="caption"
            sx={{ fontWeight: 600, color: 'text.secondary' }}
          >
            {label}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Button
              size="small"
              onClick={handleSelectAll}
              disabled={allSelected}
              sx={{
                minWidth: 'auto',
                px: 0.75,
                py: 0,
                fontSize: '0.7rem',
                textTransform: 'none',
              }}
            >
              {t('common.selectAll', 'All')}
            </Button>
            <Button
              size="small"
              onClick={handleDeselectAll}
              disabled={noneSelected}
              sx={{
                minWidth: 'auto',
                px: 0.75,
                py: 0,
                fontSize: '0.7rem',
                textTransform: 'none',
              }}
            >
              {t('common.deselectAll', 'None')}
            </Button>
          </Box>
        </Box>

        <Divider />

        {/* Search (only for long lists) */}
        {options.length > searchThreshold && (
          <Box sx={{ px: 1.5, pt: 1, pb: 0.5 }}>
            <TextField
              size="small"
              placeholder={t('common.search', 'Search...')}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              fullWidth
              autoFocus
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiInputBase-root': {
                  height: '30px',
                  fontSize: '0.8rem',
                },
              }}
            />
          </Box>
        )}

        {/* Options list */}
        <Box
          sx={{
            maxHeight: 280,
            overflowY: 'auto',
            py: 0.5,
          }}
        >
          {filteredOptions.length === 0 ? (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ px: 1.5, py: 1, textAlign: 'center', fontSize: '0.8rem' }}
            >
              {t('common.noResults', 'No results')}
            </Typography>
          ) : (
            filteredOptions.map((option) => {
              const isChecked = selected.includes(option.value);
              return (
                <Box
                  key={option.value}
                  onClick={() => handleToggle(option.value)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    px: 1,
                    py: 0.25,
                    cursor: 'pointer',
                    transition: 'background 0.1s',
                    '&:hover': {
                      bgcolor: 'action.hover',
                    },
                  }}
                >
                  <Checkbox
                    checked={isChecked}
                    size="small"
                    sx={{
                      p: 0.25,
                      '& .MuiSvgIcon-root': { fontSize: 18 },
                    }}
                  />
                  <Typography
                    variant="body2"
                    sx={{
                      fontSize: '0.8rem',
                      fontWeight: isChecked ? 600 : 400,
                      color: isChecked ? 'text.primary' : 'text.secondary',
                    }}
                  >
                    {option.label}
                  </Typography>
                </Box>
              );
            })
          )}
        </Box>
      </Popover>
    </>
  );
};

export default MultiSelectFilterChip;
