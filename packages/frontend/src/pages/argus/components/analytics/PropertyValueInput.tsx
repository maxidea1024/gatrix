/**
 * PropertyValueInput — Autocomplete input for analytics filter values.
 * Lazy-loads top values from the API when a property is selected.
 * Uses AbortController for request cancellation and debounced search.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Typography,
  useTheme,
  alpha,
  CircularProgress,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import argusService from '@/services/argusService';
import { formatCompactNumber } from '@/utils/numberFormat';

interface PropertyValueInputProps {
  projectId: string;
  property: string;
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  placeholder?: string;
}

const PropertyValueInput: React.FC<PropertyValueInputProps> = ({
  projectId,
  property,
  value,
  onChange,
  onKeyDown,
  placeholder,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { t } = useTranslation();

  const [suggestions, setSuggestions] = useState<
    { value: string; count: number }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchSuggestions = useCallback(
    (search?: string) => {
      if (!property || !projectId) {
        setSuggestions([]);
        return;
      }

      // Cancel previous request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      argusService
        .getAnalyticsPropertyValues(
          projectId,
          property,
          { period: '30d', search: search || undefined },
          controller.signal
        )
        .then((data) => {
          if (!controller.signal.aborted) {
            setSuggestions(data);
            setLoading(false);
          }
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setLoading(false);
          }
        });
    },
    [projectId, property]
  );

  // Fetch initial suggestions when property changes
  useEffect(() => {
    if (property) {
      fetchSuggestions();
    } else {
      setSuggestions([]);
    }
    return () => {
      abortRef.current?.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [property, fetchSuggestions]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    onChange(newVal);
    setOpen(true);
    setHighlightIdx(-1);

    // Debounced search
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(newVal);
    }, 300);
  };

  const handleSelect = (val: string) => {
    onChange(val);
    setOpen(false);
    setHighlightIdx(-1);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const filtered = getFilteredSuggestions();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setHighlightIdx((prev) => Math.min(prev + 1, filtered.length - 1));
      return;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx((prev) => Math.max(prev - 1, -1));
      return;
    } else if (
      e.key === 'Enter' &&
      highlightIdx >= 0 &&
      filtered[highlightIdx]
    ) {
      e.preventDefault();
      handleSelect(filtered[highlightIdx].value);
      return; // Don't propagate — user is selecting a suggestion, not submitting
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
    onKeyDown?.(e);
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const getFilteredSuggestions = () => {
    if (!value) return suggestions;
    // Show all if input matches exactly (user may want to see alternatives)
    return suggestions;
  };

  const filtered = getFilteredSuggestions();

  return (
    <Box ref={containerRef} sx={{ position: 'relative', width: '100%' }}>
      <input
        ref={inputRef}
        value={value}
        onChange={handleInputChange}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder || t('argus.analytics.value', 'Value')}
        style={{
          background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
          borderRadius: 6,
          padding: '6px 10px',
          color: 'inherit',
          outline: 'none',
          fontSize: '0.82rem',
          fontFamily: 'inherit',
          width: '100%',
          boxSizing: 'border-box',
        }}
      />
      {open && property && (filtered.length > 0 || loading) && (
        <Box
          sx={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            mt: 0.5,
            maxHeight: 200,
            overflowY: 'auto',
            borderRadius: 1.5,
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
            bgcolor: isDark ? '#1e1e2e' : '#ffffff',
            boxShadow: isDark
              ? '0 8px 24px rgba(0,0,0,0.5)'
              : '0 8px 24px rgba(0,0,0,0.12)',
            zIndex: 1300,
            py: 0.5,
            '&::-webkit-scrollbar': { width: '4px' },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: isDark
                ? 'rgba(255,255,255,0.1)'
                : 'rgba(0,0,0,0.1)',
              borderRadius: '2px',
            },
          }}
        >
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
              <CircularProgress size={16} />
            </Box>
          )}
          {!loading && filtered.length === 0 && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', px: 1.5, py: 1, textAlign: 'center' }}
            >
              {t('common.noResultsFound', 'No results found')}
            </Typography>
          )}
          {!loading &&
            filtered.map((item, idx) => (
              <Box
                key={item.value}
                onMouseDown={(e) => {
                  e.preventDefault(); // Prevent blur
                  handleSelect(item.value);
                }}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  px: 1.5,
                  py: 0.5,
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  bgcolor:
                    idx === highlightIdx
                      ? alpha(theme.palette.primary.main, 0.12)
                      : item.value === value
                        ? alpha(theme.palette.primary.main, 0.06)
                        : 'transparent',
                  '&:hover': {
                    bgcolor: alpha(theme.palette.primary.main, 0.08),
                  },
                }}
              >
                <Typography
                  variant="body2"
                  sx={{
                    fontSize: '0.8rem',
                    fontWeight: item.value === value ? 600 : 400,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                    mr: 1,
                  }}
                >
                  {item.value}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontSize: '0.7rem', flexShrink: 0, opacity: 0.6 }}
                >
                  {formatCompactNumber(item.count)}
                </Typography>
              </Box>
            ))}
        </Box>
      )}
    </Box>
  );
};

export default PropertyValueInput;
