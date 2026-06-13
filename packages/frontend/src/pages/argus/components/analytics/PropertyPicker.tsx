import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Popover,
  TextField,
  InputAdornment,
  useTheme,
  alpha,
  Chip,
  CircularProgress,
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import argusService from '@/services/argusService';

interface PropertyOption {
  key: string;
  type: 'builtin' | 'string' | 'numeric';
  label?: string;
}

interface PropertyPickerProps {
  projectId: string | number;
  eventName?: string;
  value: string;
  onChange: (value: string) => void;
  /** Placeholder label when no value selected */
  emptyLabel?: string;
  /** If true, show highlight when empty */
  highlightEmpty?: boolean;
}

const BUILTIN_LABELS: Record<string, string> = {
  platform: 'Platform',
  environment: 'Environment',
  release: 'Release',
  country: 'Country',
  city: 'City',
  os: 'OS',
  app_version: 'App Version',
};

const PropertyPicker: React.FC<PropertyPickerProps> = ({
  projectId,
  eventName,
  value,
  onChange,
  emptyLabel = 'Select Property',
  highlightEmpty = false,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const anchorRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [properties, setProperties] = useState<PropertyOption[]>([]);

  // Load properties when opened or eventName changes
  const loadProperties = useCallback(async () => {
    setLoading(true);
    try {
      // Always include builtin columns
      const builtinProps: PropertyOption[] = Object.entries(BUILTIN_LABELS).map(
        ([key, label]) => ({ key, type: 'builtin' as const, label })
      );

      // Always call API - when eventName is undefined, backend returns all project properties
      const data = await argusService.getAnalyticsEventProperties(projectId, eventName || undefined);
      const stringProps: PropertyOption[] = (data.string_keys || []).map((k: string) => ({
        key: k,
        type: 'string' as const,
      }));
      const numericProps: PropertyOption[] = (data.numeric_keys || []).map((k: string) => ({
        key: k,
        type: 'numeric' as const,
      }));
      setProperties([...builtinProps, ...stringProps, ...numericProps]);
    } catch {
      // Fallback to builtin only
      setProperties(
        Object.entries(BUILTIN_LABELS).map(([key, label]) => ({
          key,
          type: 'builtin' as const,
          label,
        }))
      );
    } finally {
      setLoading(false);
    }
  }, [projectId, eventName]);

  useEffect(() => {
    if (open) {
      loadProperties();
    }
  }, [open, loadProperties]);

  const filtered = useMemo(() => {
    if (!search) return properties;
    const q = search.toLowerCase();
    return properties.filter(
      (p) =>
        p.key.toLowerCase().includes(q) ||
        (p.label && p.label.toLowerCase().includes(q))
    );
  }, [properties, search]);

  const grouped = useMemo(() => {
    const groups: Record<string, PropertyOption[]> = {
      builtin: [],
      string: [],
      numeric: [],
    };
    for (const p of filtered) {
      groups[p.type]?.push(p);
    }
    return groups;
  }, [filtered]);

  const displayLabel = value
    ? BUILTIN_LABELS[value] || value
    : emptyLabel;

  const isEmpty = !value;

  return (
    <>
      <Box
        ref={anchorRef}
        onClick={() => setOpen(true)}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          cursor: 'pointer',
          px: 1,
          py: 0.25,
          borderRadius: 1,
          fontSize: '0.8rem',
          fontWeight: 500,
          color: isEmpty && highlightEmpty
            ? theme.palette.primary.main
            : 'inherit',
          border: `1px solid ${
            isEmpty && highlightEmpty
              ? alpha(theme.palette.primary.main, 0.3)
              : isDark
                ? 'rgba(255,255,255,0.08)'
                : 'rgba(0,0,0,0.08)'
          }`,
          background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
          '&:hover': {
            background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
            borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)',
          },
          transition: 'all 0.15s ease',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: 200,
        }}
      >
        {displayLabel}
      </Box>

      <Popover
        open={open}
        anchorEl={anchorRef.current}
        onClose={() => {
          setOpen(false);
          setSearch('');
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: {
              width: 280,
              maxHeight: 400,
              mt: 0.5,
              borderRadius: 2,
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
              boxShadow: isDark
                ? '0 8px 32px rgba(0,0,0,0.5)'
                : '0 8px 32px rgba(0,0,0,0.12)',
            },
          },
        }}
      >
        {/* Search */}
        <Box sx={{ p: 1, borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
          <TextField
            size="small"
            fullWidth
            placeholder="Search properties..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 16, opacity: 0.5 }} />
                </InputAdornment>
              ),
              sx: { fontSize: '0.8rem', height: 32 },
            }}
          />
        </Box>

        {/* Options */}
        <Box sx={{ overflowY: 'auto', maxHeight: 320, py: 0.5 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={20} />
            </Box>
          ) : filtered.length === 0 ? (
            <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', py: 3, opacity: 0.5 }}>
              No properties found
            </Typography>
          ) : (
            <>
              {/* None option */}
              <Box
                onClick={() => {
                  onChange('');
                  setOpen(false);
                  setSearch('');
                }}
                sx={{
                  px: 1.5,
                  py: 0.75,
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  color: 'text.secondary',
                  fontStyle: 'italic',
                  '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' },
                }}
              >
                None
              </Box>

              {(['builtin', 'string', 'numeric'] as const).map((groupType) => {
                const items = grouped[groupType];
                if (!items || items.length === 0) return null;
                const groupLabel =
                  groupType === 'builtin'
                    ? 'Built-in'
                    : groupType === 'string'
                      ? 'Custom (String)'
                      : 'Custom (Numeric)';

                return (
                  <React.Fragment key={groupType}>
                    <Typography
                      variant="caption"
                      sx={{
                        display: 'block',
                        px: 1.5,
                        pt: 1,
                        pb: 0.25,
                        fontWeight: 700,
                        color: 'text.secondary',
                        fontSize: '0.65rem',
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                      }}
                    >
                      {groupLabel}
                    </Typography>
                    {items.map((prop) => (
                      <Box
                        key={prop.key}
                        onClick={() => {
                          onChange(prop.key);
                          setOpen(false);
                          setSearch('');
                        }}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          px: 1.5,
                          py: 0.75,
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                          fontWeight: value === prop.key ? 600 : 400,
                          color: value === prop.key ? 'primary.main' : 'text.primary',
                          bgcolor: value === prop.key
                            ? alpha(theme.palette.primary.main, isDark ? 0.1 : 0.05)
                            : 'transparent',
                          '&:hover': {
                            bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                          },
                        }}
                      >
                        <span>{prop.label || prop.key}</span>
                        {groupType !== 'builtin' && (
                          <Chip
                            label={groupType === 'string' ? 'Str' : 'Num'}
                            size="small"
                            sx={{
                              height: 16,
                              fontSize: '0.6rem',
                              fontWeight: 600,
                              bgcolor: alpha(
                                groupType === 'string' ? '#3b82f6' : '#f59e0b',
                                isDark ? 0.15 : 0.1
                              ),
                              color: groupType === 'string' ? '#3b82f6' : '#f59e0b',
                            }}
                          />
                        )}
                      </Box>
                    ))}
                  </React.Fragment>
                );
              })}
            </>
          )}
        </Box>
      </Popover>
    </>
  );
};

export default PropertyPicker;
