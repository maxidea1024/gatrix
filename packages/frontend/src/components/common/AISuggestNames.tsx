/**
 * AISuggestNames Component
 *
 * Reusable AI-powered name suggestion component.
 * Shows a button that, when clicked, calls the AI suggest API
 * and displays suggested names as clickable chips.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Box,
  Chip,
  CircularProgress,
  Tooltip,
  IconButton,
} from '@mui/material';
import { AutoAwesome as AIIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import aiChatService from '../../services/aiChatService';

interface AISuggestNamesProps {
  /** Entity type, e.g. 'feature-flag', 'segment' */
  type: string;
  /** Description text to base suggestions on */
  description: string;
  /** Additional context passed to the AI */
  context?: Record<string, string>;
  /** Called when user selects a suggested name */
  onSelect: (name: string) => void;
  /** Prefix to prepend to suggested names (e.g. 'release-') */
  prefix?: string;
  /** Max suggestions to request (default 5) */
  maxCount?: number;
  /** Minimum description length to enable the button (default 10) */
  minDescriptionLength?: number;
}

const AISuggestNames: React.FC<AISuggestNamesProps> = ({
  type,
  description,
  context,
  onSelect,
  prefix,
  maxCount = 5,
  minDescriptionLength = 10,
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [names, setNames] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [aiAvailable, setAIAvailable] = useState<boolean | null>(null);
  const lastDescriptionRef = useRef<string>('');

  // Check AI availability on mount
  useEffect(() => {
    let cancelled = false;
    aiChatService.getStatus().then((status) => {
      if (!cancelled) {
        setAIAvailable(status.available);
      }
    }).catch(() => {
      if (!cancelled) {
        setAIAvailable(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  // Clear suggestions when description changes significantly
  useEffect(() => {
    if (names.length > 0 && description !== lastDescriptionRef.current) {
      setNames([]);
      setError(null);
    }
  }, [description, names.length]);

  const handleSuggest = useCallback(async () => {
    if (loading || description.trim().length < minDescriptionLength) return;

    setLoading(true);
    setError(null);
    setNames([]);
    lastDescriptionRef.current = description;

    try {
      const result = await aiChatService.suggestNames({
        type,
        description: description.trim(),
        context: prefix ? { ...context, prefix } : context,
        count: maxCount,
      });
      // Apply prefix to names that don't already have it
      const prefixedNames = prefix
        ? result.map((n) => (n.startsWith(prefix) ? n : `${prefix}${n}`))
        : result;
      setNames(prefixedNames);
    } catch (err: any) {
      setError(t('ai.suggestNamesError'));
    } finally {
      setLoading(false);
    }
  }, [loading, description, minDescriptionLength, type, context, maxCount, t]);

  const handleSelect = useCallback(
    (name: string) => {
      onSelect(name);
    },
    [onSelect]
  );

  // Don't render if AI is not available
  if (aiAvailable === false) return null;

  const isDescriptionValid = description.trim().length >= minDescriptionLength;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Tooltip
          title={
            !isDescriptionValid
              ? t('ai.suggestNamesHint')
              : t('ai.suggestNames')
          }
        >
          <span>
            <IconButton
              size="small"
              onClick={handleSuggest}
              disabled={!isDescriptionValid || loading}
              sx={{
                color: 'primary.main',
                '&:hover': {
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                },
              }}
            >
              {loading ? (
                <CircularProgress size={18} />
              ) : (
                <AIIcon fontSize="small" />
              )}
            </IconButton>
          </span>
        </Tooltip>

        {/* Suggested name chips */}
        {names.length > 0 && (
          <Box
            sx={{
              display: 'flex',
              gap: 0.5,
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            {names.map((name) => (
              <Chip
                key={name}
                label={name}
                size="small"
                variant="outlined"
                clickable
                onClick={() => handleSelect(name)}
                sx={{
                  fontSize: '0.75rem',
                  height: 24,
                  borderColor: 'primary.main',
                  color: 'text.primary',
                  '&:hover': {
                    bgcolor: 'action.hover',
                    borderColor: 'primary.light',
                  },
                }}
              />
            ))}
          </Box>
        )}

        {/* Error message */}
        {error && (
          <Chip
            label={error}
            size="small"
            color="error"
            variant="outlined"
            sx={{ fontSize: '0.7rem', height: 22 }}
          />
        )}
      </Box>
    </Box>
  );
};

export default AISuggestNames;
