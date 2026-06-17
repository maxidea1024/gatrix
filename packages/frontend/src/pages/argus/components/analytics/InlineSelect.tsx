import React, { useState, useMemo, useRef } from 'react';
import {
  Box,
  Typography,
  Popover,
  TextField,
  List,
  ListItemButton,
  ListItemText,
  InputAdornment,
  Chip,
  Fade,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Search as SearchIcon,
  ExpandMore as ExpandMoreIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

export interface InlineSelectOption {
  value: string;
  label: string;
  /** Optional React node (icon) to display before the label */
  icon?: React.ReactNode;
  /** Detail flyout metadata */
  meta?: {
    eventKey?: string;
    description?: string;
    category?: string;
    count?: number;
    isReserved?: boolean;
  };
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
  onEditOption?: (value: string, anchorEl: HTMLElement) => void;
}

const InlineSelect: React.FC<InlineSelectProps> = ({
  value,
  onChange,
  options,
  placeholder: placeholderProp,
  disabled = false,
  emptyLabel: emptyLabelProp,
  highlightEmpty = false,
  onEditOption,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { t } = useTranslation();
  const placeholder = placeholderProp ?? t('common.search', 'Search...');
  const emptyLabel = emptyLabelProp ?? t('common.select', 'Select...');

  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [search, setSearch] = useState('');
  const [hoveredOpt, setHoveredOpt] = useState<InlineSelectOption | null>(null);
  const [hoveredRect, setHoveredRect] = useState<DOMRect | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const open = Boolean(anchorEl);

  const handleOpen = (e: React.MouseEvent<HTMLElement>) => {
    if (!disabled) {
      setAnchorEl(e.currentTarget);
      setSearch('');
      setHoveredOpt(null);
    }
  };

  const handleClose = () => {
    setAnchorEl(null);
    setHoveredOpt(null);
  };

  const handleSelect = (val: string) => {
    onChange(val);
    handleClose();
  };

  const handleItemHover = (opt: InlineSelectOption, e: React.MouseEvent<HTMLElement>) => {
    if (opt.meta) {
      setHoveredOpt(opt);
      setHoveredRect(e.currentTarget.getBoundingClientRect());
    } else {
      setHoveredOpt(null);
    }
  };

  const selectedOption = options.find((o) => o.value === value);
  const displayText = selectedOption ? selectedOption.label : emptyLabel;
  const isEmpty = !selectedOption;

  // Check if any option has meta (enables flyout feature)
  const hasMeta = options.some((o) => o.meta);

  const filteredOptions = useMemo(() => {
    if (!search) return options;
    const s = search.toLowerCase();
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(s) || o.value.toLowerCase().includes(s)
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
          maxWidth: '100%',
          overflow: 'hidden',
          '&:hover': disabled
            ? {}
            : {
                background: isDark
                  ? 'rgba(255,255,255,0.06)'
                  : 'rgba(0,0,0,0.04)',
              },
        }}
      >
        {selectedOption?.icon && (
          <Box sx={{ display: 'flex', alignItems: 'center', color: isDark ? '#a5b4fc' : '#4f46e5' }}>
            {selectedOption.icon}
          </Box>
        )}
        <Typography
          variant="body2"
          sx={{
            fontWeight: 600,
            color:
              isEmpty && highlightEmpty
                ? theme.palette.primary.main
                : theme.palette.text.primary,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            minWidth: 0,
          }}
        >
          {displayText}
        </Typography>
        <ExpandMoreIcon
          sx={{
            fontSize: 16,
            flexShrink: 0,
            color:
              isEmpty && highlightEmpty
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
              width: 260,
              boxShadow: isDark
                ? '0 8px 32px rgba(0,0,0,0.5)'
                : '0 8px 32px rgba(0,0,0,0.1)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
            },
          },
        }}
      >
        {options.length > 6 && (
          <Box
            sx={{
              p: 1,
              borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
            }}
          >
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
                sx: { fontSize: '0.85rem' },
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 1.5,
                },
              }}
            />
          </Box>
        )}
        <List ref={listRef} sx={{ p: 0, maxHeight: 300, overflowY: 'auto' }}>
          {filteredOptions.length === 0 ? (
            <Box sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                {t('common.noResultsFound', 'No results found')}
              </Typography>
            </Box>
          ) : (
            filteredOptions.map((opt) => (
              <ListItemButton
                key={opt.value}
                selected={value === opt.value}
                onClick={() => handleSelect(opt.value)}
                onMouseEnter={(e) => handleItemHover(opt, e)}
                onMouseLeave={() => setHoveredOpt(null)}
                sx={{
                  py: 0.75,
                  px: 2,
                  gap: 1,
                  '&.Mui-selected': {
                    bgcolor: alpha(theme.palette.primary.main, 0.08),
                    '&:hover': {
                      bgcolor: alpha(theme.palette.primary.main, 0.12),
                    },
                  },
                }}
              >
                {opt.icon && (
                  <Box
                    sx={{
                      width: 28,
                      height: 28,
                      borderRadius: 1.5,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      bgcolor: isDark ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.08)',
                      color: isDark ? '#a5b4fc' : '#4f46e5',
                    }}
                  >
                    {opt.icon}
                  </Box>
                )}
                <ListItemText
                  primary={opt.label}
                  secondary={opt.meta?.eventKey && opt.meta.eventKey !== opt.label ? opt.meta.eventKey : undefined}
                  primaryTypographyProps={{
                    variant: 'body2',
                    fontWeight: value === opt.value ? 700 : 500,
                    noWrap: true,
                  }}
                  secondaryTypographyProps={{
                    variant: 'caption',
                    fontFamily: 'monospace',
                    fontSize: '0.78rem',
                    noWrap: true,
                    sx: { opacity: 0.6 },
                  }}
                />
                {onEditOption && (
                  <Box
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditOption(opt.value, e.currentTarget as HTMLElement);
                    }}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 24,
                      height: 24,
                      borderRadius: 0.5,
                      flexShrink: 0,
                      opacity: 0,
                      transition: 'opacity 0.15s',
                      color: 'text.secondary',
                      '.MuiListItemButton-root:hover &': { opacity: 0.5 },
                      '&:hover': {
                        opacity: '1 !important',
                        bgcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                      },
                    }}
                  >
                    <EditIcon sx={{ fontSize: 14 }} />
                  </Box>
                )}
              </ListItemButton>
            ))
          )}
        </List>
      </Popover>

      {/* ── Detail Flyout ── */}
      {hasMeta && hoveredOpt?.meta && hoveredRect && (
          <Box
            sx={{
              position: 'fixed',
              top: hoveredRect.top - 10,
              left: hoveredRect.right + 8,
              width: 240,
              p: 2,
              borderRadius: 2,
              bgcolor: isDark ? '#1e1e2f' : '#ffffff',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`,
              boxShadow: isDark
                ? '0 12px 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.05)'
                : '0 12px 40px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)',
              zIndex: theme.zIndex.modal + 1,
              pointerEvents: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
            }}
          >
            {/* Header: icon + name */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              {hoveredOpt.icon && (
                <Box sx={{
                  width: 36,
                  height: 36,
                  borderRadius: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: isDark ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.08)',
                  color: isDark ? '#a5b4fc' : '#4f46e5',
                  flexShrink: 0,
                }}>
                  {hoveredOpt.icon}
                </Box>
              )}
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle2" fontWeight={700} noWrap>
                  {hoveredOpt.label}
                </Typography>
                {hoveredOpt.meta.eventKey && (
                  <Typography variant="caption" fontFamily="monospace" color="text.secondary" noWrap sx={{ fontSize: '0.8rem', display: 'block' }}>
                    {hoveredOpt.meta.eventKey}
                  </Typography>
                )}
              </Box>
            </Box>

            {/* Description */}
            {hoveredOpt.meta.description && (
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.5, fontSize: '0.85rem' }}>
                {hoveredOpt.meta.description}
              </Typography>
            )}

            {/* Tags row */}
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {hoveredOpt.meta.category && (
                <Chip
                  size="small"
                  label={hoveredOpt.meta.category}
                  variant="outlined"
                  sx={{ height: 24, fontSize: '0.75rem', fontWeight: 600 }}
                />
              )}
              {hoveredOpt.meta.isReserved !== undefined && (
                <Chip
                  size="small"
                  label={hoveredOpt.meta.isReserved ? 'System' : 'Custom'}
                  sx={{
                    height: 24,
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    bgcolor: hoveredOpt.meta.isReserved
                      ? alpha('#22c55e', 0.1)
                      : alpha('#3b82f6', 0.1),
                    color: hoveredOpt.meta.isReserved ? '#22c55e' : '#3b82f6',
                  }}
                />
              )}
            </Box>

            {/* Volume */}
            {hoveredOpt.meta.count !== undefined && (
              <Box sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                pt: 0.75,
                borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
              }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                  Volume (30d)
                </Typography>
                <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.85rem', fontVariantNumeric: 'tabular-nums' }}>
                  {hoveredOpt.meta.count.toLocaleString()}
                </Typography>
              </Box>
            )}
          </Box>
      )}
    </>
  );
};

export default InlineSelect;
