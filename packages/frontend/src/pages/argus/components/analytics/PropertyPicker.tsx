import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from 'react';
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
  Checkbox,
  Button,
} from '@mui/material';
import {
  Search as SearchIcon,
  Close as CloseIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import argusService from '@/services/argusService';

interface PropertyOption {
  key: string;
  type: 'builtin' | 'string' | 'numeric';
  label?: string;
}

interface PropertyPickerProps {
  projectId: string | number;
  eventName?: string;
  value: string[];
  onChange: (value: string[]) => void;
  /** Placeholder label when no value selected */
  emptyLabel?: string;
  /** If true, show highlight when empty */
  highlightEmpty?: boolean;
  /** Maximum number of properties allowed (default: 3) */
  maxItems?: number;
  /** Styling variant */
  variant?: 'button' | 'text';
}

const BUILTIN_KEYS: Record<string, string> = {
  platform: 'argus.analytics.prop.platform',
  environment: 'argus.analytics.prop.environment',
  release: 'argus.analytics.prop.release',
  country: 'argus.analytics.prop.country',
  city: 'argus.analytics.prop.city',
  os: 'argus.analytics.prop.os',
  app_version: 'argus.analytics.prop.appVersion',
};

const BUILTIN_DEFAULTS: Record<string, string> = {
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
  emptyLabel: emptyLabelProp,
  highlightEmpty = false,
  maxItems = 3,
  variant = 'button',
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { t } = useTranslation();
  const anchorRef = useRef<any>(null);

  const emptyLabel =
    emptyLabelProp ?? t('argus.analytics.selectProperty', 'Select Property');

  /** Translate a builtin property key at render time */
  const getBuiltinLabel = useCallback(
    (key: string) => {
      const i18nKey = BUILTIN_KEYS[key];
      return i18nKey ? t(i18nKey, BUILTIN_DEFAULTS[key] || key) : key;
    },
    [t]
  );

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [properties, setProperties] = useState<PropertyOption[]>([]);

  // Load properties when opened or eventName changes
  const loadProperties = useCallback(async () => {
    setLoading(true);
    try {
      // Always include builtin columns
      const builtinProps: PropertyOption[] = Object.keys(BUILTIN_KEYS).map(
        (key) => ({
          key,
          type: 'builtin' as const,
          label: BUILTIN_DEFAULTS[key],
        })
      );

      // Always call API - when eventName is undefined, backend returns all project properties
      const data = await argusService.getAnalyticsEventProperties(
        projectId,
        eventName || undefined
      );
      const stringProps: PropertyOption[] = (data.string_keys || []).map(
        (k: string) => ({
          key: k,
          type: 'string' as const,
        })
      );
      const numericProps: PropertyOption[] = (data.numeric_keys || []).map(
        (k: string) => ({
          key: k,
          type: 'numeric' as const,
        })
      );
      setProperties([...builtinProps, ...stringProps, ...numericProps]);
    } catch {
      // Fallback to builtin only
      setProperties(
        Object.keys(BUILTIN_KEYS).map((key) => ({
          key,
          type: 'builtin' as const,
          label: BUILTIN_DEFAULTS[key],
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

  const isSelected = useCallback((key: string) => value.includes(key), [value]);

  const toggleProperty = useCallback(
    (key: string) => {
      if (value.includes(key)) {
        onChange(value.filter((v) => v !== key));
      } else if (value.length < maxItems) {
        onChange([...value, key]);
      }
    },
    [value, onChange, maxItems]
  );

  const removeProperty = useCallback(
    (key: string) => {
      onChange(value.filter((v) => v !== key));
    },
    [value, onChange]
  );

  const clearAll = useCallback(() => {
    onChange([]);
  }, [onChange]);

  const isEmpty = value.length === 0;
  const isMaxed = value.length >= maxItems;

  return (
    <>
      {variant === 'text' && isEmpty ? (
        <Button
          ref={anchorRef}
          size="small"
          startIcon={<AddIcon sx={{ fontSize: 14 }} />}
          onClick={() => setOpen(true)}
          sx={{
            justifyContent: 'flex-start',
            color: 'text.secondary',
            textTransform: 'none',
            borderRadius: 2,
            pl: 0.5,
            fontSize: '0.8rem',
            width: 'fit-content',
            minWidth: 0,
            '&:hover': {
              background: isDark
                ? 'rgba(255,255,255,0.04)'
                : 'rgba(0,0,0,0.04)',
            },
          }}
        >
          {emptyLabel}
        </Button>
      ) : (
        <Box
          ref={anchorRef}
          onClick={() => setOpen(true)}
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            cursor: 'pointer',
            px: 1,
            py: 0.25,
            borderRadius: 1,
            fontSize: '0.8rem',
            fontWeight: 500,
            color:
              isEmpty && highlightEmpty
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
              background: isDark
                ? 'rgba(255,255,255,0.06)'
                : 'rgba(0,0,0,0.04)',
              borderColor: isDark
                ? 'rgba(255,255,255,0.15)'
                : 'rgba(0,0,0,0.15)',
            },
            transition: 'all 0.15s ease',
            flexWrap: 'wrap',
            maxWidth: 400,
          }}
        >
          {isEmpty ? (
            <span>{emptyLabel}</span>
          ) : (
            value.map((key) => (
              <Chip
                key={key}
                label={getBuiltinLabel(key)}
                size="small"
                onDelete={(e) => {
                  e.stopPropagation();
                  removeProperty(key);
                }}
                deleteIcon={<CloseIcon sx={{ fontSize: '14px !important' }} />}
                sx={{
                  height: 20,
                  fontSize: '0.72rem',
                  fontWeight: 500,
                  bgcolor: alpha(
                    theme.palette.primary.main,
                    isDark ? 0.15 : 0.08
                  ),
                  color: theme.palette.primary.main,
                  '& .MuiChip-deleteIcon': {
                    fontSize: 14,
                    color: alpha(theme.palette.primary.main, 0.6),
                    '&:hover': { color: theme.palette.primary.main },
                  },
                }}
              />
            ))
          )}
        </Box>
      )}

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
              width: 300,
              maxHeight: 440,
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
        <Box
          sx={{
            p: 1,
            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          }}
        >
          <TextField
            size="small"
            fullWidth
            placeholder={t(
              'argus.analytics.searchProperties',
              'Search properties...'
            )}
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

        {/* Selected chips + clear */}
        {!isEmpty && (
          <Box
            sx={{
              px: 1.5,
              py: 0.75,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 0.5,
              alignItems: 'center',
              borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            }}
          >
            {value.map((key) => (
              <Chip
                key={key}
                label={getBuiltinLabel(key)}
                size="small"
                onDelete={() => removeProperty(key)}
                deleteIcon={<CloseIcon sx={{ fontSize: '14px !important' }} />}
                sx={{
                  height: 20,
                  fontSize: '0.7rem',
                  bgcolor: alpha(
                    theme.palette.primary.main,
                    isDark ? 0.15 : 0.08
                  ),
                  color: theme.palette.primary.main,
                  '& .MuiChip-deleteIcon': {
                    fontSize: 14,
                    color: alpha(theme.palette.primary.main, 0.5),
                  },
                }}
              />
            ))}
            <Typography
              variant="caption"
              onClick={clearAll}
              sx={{
                cursor: 'pointer',
                color: 'error.main',
                fontSize: '0.65rem',
                '&:hover': { textDecoration: 'underline' },
              }}
            >
              {t('common.remove', 'Clear')}
            </Typography>
            {isMaxed && (
              <Typography
                variant="caption"
                sx={{ color: 'text.disabled', fontSize: '0.65rem', ml: 'auto' }}
              >
                {t('argus.analytics.maxBreakdowns', 'Max {{max}}', {
                  max: maxItems,
                })}
              </Typography>
            )}
          </Box>
        )}

        {/* Options */}
        <Box sx={{ overflowY: 'auto', maxHeight: 320, py: 0.5 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={20} />
            </Box>
          ) : filtered.length === 0 ? (
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                textAlign: 'center',
                py: 3,
                opacity: 0.5,
              }}
            >
              {t('argus.analytics.noPropertiesFound', 'No properties found')}
            </Typography>
          ) : (
            <>
              {/* None option — clear all */}
              <Box
                onClick={() => {
                  clearAll();
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
                  '&:hover': {
                    bgcolor: isDark
                      ? 'rgba(255,255,255,0.04)'
                      : 'rgba(0,0,0,0.04)',
                  },
                }}
              >
                {t('common.none', 'None')}
              </Box>

              {(['builtin', 'string', 'numeric'] as const).map((groupType) => {
                const items = grouped[groupType];
                if (!items || items.length === 0) return null;
                const groupLabel =
                  groupType === 'builtin'
                    ? t('argus.analytics.groupBuiltin', 'Built-in')
                    : groupType === 'string'
                      ? t(
                          'argus.analytics.groupCustomString',
                          'Custom (String)'
                        )
                      : t(
                          'argus.analytics.groupCustomNumeric',
                          'Custom (Numeric)'
                        );

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
                    {items.map((prop) => {
                      const selected = isSelected(prop.key);
                      const disabled = !selected && isMaxed;
                      return (
                        <Box
                          key={prop.key}
                          onClick={() => {
                            if (!disabled) toggleProperty(prop.key);
                          }}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            px: 1,
                            py: 0.5,
                            cursor: disabled ? 'not-allowed' : 'pointer',
                            fontSize: '0.8rem',
                            fontWeight: selected ? 600 : 400,
                            opacity: disabled ? 0.4 : 1,
                            color: selected ? 'primary.main' : 'text.primary',
                            bgcolor: selected
                              ? alpha(
                                  theme.palette.primary.main,
                                  isDark ? 0.1 : 0.05
                                )
                              : 'transparent',
                            '&:hover': {
                              bgcolor: disabled
                                ? 'transparent'
                                : isDark
                                  ? 'rgba(255,255,255,0.04)'
                                  : 'rgba(0,0,0,0.04)',
                            },
                          }}
                        >
                          <Checkbox
                            checked={selected}
                            disabled={disabled}
                            size="small"
                            sx={{
                              p: 0.25,
                              mr: 0.75,
                              '& .MuiSvgIcon-root': { fontSize: 16 },
                            }}
                          />
                          <span style={{ flex: 1 }}>
                            {prop.type === 'builtin'
                              ? getBuiltinLabel(prop.key)
                              : prop.label || prop.key}
                          </span>
                          {groupType !== 'builtin' && (
                            <Chip
                              label={groupType === 'string' ? 'Str' : 'Num'}
                              size="small"
                              sx={{
                                height: 16,
                                fontSize: '0.6rem',
                                fontWeight: 600,
                                bgcolor: alpha(
                                  groupType === 'string'
                                    ? '#3b82f6'
                                    : '#f59e0b',
                                  isDark ? 0.15 : 0.1
                                ),
                                color:
                                  groupType === 'string'
                                    ? '#3b82f6'
                                    : '#f59e0b',
                              }}
                            />
                          )}
                        </Box>
                      );
                    })}
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
