import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Popover,
  TextField,
  List,
  ListItemButton,
  ListItemText,
  InputAdornment,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Search as SearchIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';

export interface InlineSelectOption {
  value: string;
  label: string;
}

export interface InlineSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: InlineSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  /** Text shown if no value is selected */
  emptyLabel?: string;
  /** Force text to have primary color if empty (e.g. "Select Event") */
  highlightEmpty?: boolean;
}

const InlineSelect: React.FC<InlineSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Search...',
  disabled = false,
  emptyLabel = 'Select...',
  highlightEmpty = false,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [search, setSearch] = useState('');

  const open = Boolean(anchorEl);

  const handleOpen = (e: React.MouseEvent<HTMLElement>) => {
    if (!disabled) {
      setAnchorEl(e.currentTarget);
      setSearch('');
    }
  };

  const handleClose = () => setAnchorEl(null);

  const handleSelect = (val: string) => {
    onChange(val);
    handleClose();
  };

  const selectedOption = options.find((o) => o.value === value);
  const displayText = selectedOption ? selectedOption.label : emptyLabel;
  const isEmpty = !selectedOption;

  const filteredOptions = useMemo(() => {
    if (!search) return options;
    const s = search.toLowerCase();
    return options.filter(
      (o) => o.label.toLowerCase().includes(s) || o.value.toLowerCase().includes(s)
    );
  }, [options, search]);

  return (
    <>
      <Box
        onClick={handleOpen}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          cursor: disabled ? 'default' : 'pointer',
          px: 0.75,
          py: 0.25,
          borderRadius: 1,
          transition: 'all 0.15s',
          opacity: disabled ? 0.5 : 1,
          '&:hover': disabled
            ? {}
            : {
                background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              },
        }}
      >
        <Typography
          variant="body2"
          sx={{
            fontWeight: 600,
            color: isEmpty && highlightEmpty
              ? theme.palette.primary.main
              : theme.palette.text.primary,
            whiteSpace: 'nowrap',
          }}
        >
          {displayText}
        </Typography>
        <ExpandMoreIcon
          sx={{
            fontSize: 16,
            color: isEmpty && highlightEmpty
              ? theme.palette.primary.main
              : theme.palette.text.secondary,
          }}
        />
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
              borderRadius: 2,
              width: 240,
              boxShadow: isDark
                ? '0 8px 32px rgba(0,0,0,0.5)'
                : '0 8px 32px rgba(0,0,0,0.1)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
            },
          },
        }}
      >
        <Box sx={{ p: 1, borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}` }}>
          <TextField
            autoFocus
            fullWidth
            size="small"
            placeholder={placeholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 18 }} />
                </InputAdornment>
              ),
              sx: { fontSize: '0.85rem' }
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 1.5,
              }
            }}
          />
        </Box>
        <List sx={{ p: 0, maxHeight: 300, overflowY: 'auto' }}>
          {filteredOptions.length === 0 ? (
            <Box sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                No results found
              </Typography>
            </Box>
          ) : (
            filteredOptions.map((opt) => (
              <ListItemButton
                key={opt.value}
                selected={value === opt.value}
                onClick={() => handleSelect(opt.value)}
                sx={{
                  py: 1,
                  px: 2,
                  '&.Mui-selected': {
                    bgcolor: alpha(theme.palette.primary.main, 0.08),
                    '&:hover': {
                      bgcolor: alpha(theme.palette.primary.main, 0.12),
                    }
                  }
                }}
              >
                <ListItemText
                  primary={opt.label}
                  primaryTypographyProps={{
                    variant: 'body2',
                    fontWeight: value === opt.value ? 700 : 500,
                  }}
                />
              </ListItemButton>
            ))
          )}
        </List>
      </Popover>
    </>
  );
};

export default InlineSelect;
