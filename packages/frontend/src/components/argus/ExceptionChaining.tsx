import React, { useState, useMemo } from 'react';
import { Box, Typography, Chip, Collapse, IconButton, alpha, useTheme } from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Link as ChainIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

interface ExceptionEntry {
  type: string;
  value: string;
  depth: number;
}

interface ExceptionChainingProps {
  exceptionType?: string;
  exceptionValue?: string;
  isDark: boolean;
}

/**
 * Parses exception chaining from raw exception value.
 * Supports patterns like:
 *   "Caused by: SomeException: message"
 *   "__cause__: AnotherException: message"
 *   "The above exception was the direct cause of the following exception:"
 */
function parseExceptionChain(type?: string, value?: string): ExceptionEntry[] {
  const entries: ExceptionEntry[] = [];
  if (!type && !value) return entries;

  // Primary exception
  entries.push({
    type: type || 'Exception',
    value: value || '',
    depth: 0,
  });

  if (!value) return entries;

  // Try to split by "Caused by:" pattern
  const causedByRegex = /\n?\s*Caused by:\s*/gi;
  const parts = value.split(causedByRegex);

  if (parts.length > 1) {
    // First part is the main exception
    entries[0].value = parts[0].trim();

    // Subsequent parts are caused-by chains
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i].trim();
      const colonIdx = part.indexOf(':');
      if (colonIdx > 0 && colonIdx < 80) {
        entries.push({
          type: part.substring(0, colonIdx).trim(),
          value: part.substring(colonIdx + 1).trim(),
          depth: i,
        });
      } else {
        entries.push({
          type: 'CausedException',
          value: part,
          depth: i,
        });
      }
    }
  }

  return entries;
}

const ExceptionChaining: React.FC<ExceptionChainingProps> = ({
  exceptionType,
  exceptionValue,
  isDark,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set([0]));

  const chain = useMemo(
    () => parseExceptionChain(exceptionType, exceptionValue),
    [exceptionType, exceptionValue]
  );

  if (chain.length <= 1) return null; // No chaining detected

  const toggleExpand = (idx: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
        <ChainIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
        <Typography variant="caption" sx={{
          fontSize: '0.68rem', fontWeight: 700, color: 'text.secondary',
          textTransform: 'uppercase', letterSpacing: 0.5,
        }}>
          {t('argus.exceptionChain.title')}
        </Typography>
        <Chip
          label={`${chain.length} ${t('argus.exceptionChain.exceptions')}`}
          size="small"
          sx={{ height: 18, fontSize: '0.62rem', fontWeight: 700 }}
        />
      </Box>

      {chain.map((entry, idx) => (
        <Box
          key={idx}
          sx={{
            ml: entry.depth * 2,
            mb: 0.5,
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
            borderRadius: '8px',
            overflow: 'hidden',
            borderLeft: `3px solid ${idx === 0
              ? theme.palette.error.main
              : alpha(theme.palette.warning.main, 0.6 + idx * 0.1)
            }`,
          }}
        >
          <Box
            onClick={() => toggleExpand(idx)}
            sx={{
              display: 'flex', alignItems: 'center', gap: 1,
              px: 1.5, py: 0.8,
              cursor: 'pointer',
              backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
              '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' },
            }}
          >
            <IconButton size="small" sx={{ width: 18, height: 18, p: 0 }}>
              {expandedIds.has(idx)
                ? <ExpandLessIcon sx={{ fontSize: 14 }} />
                : <ExpandMoreIcon sx={{ fontSize: 14 }} />
              }
            </IconButton>
            {idx > 0 && (
              <Typography component="span" sx={{ fontSize: '0.65rem', color: 'text.disabled', fontStyle: 'italic' }}>
                {t('argus.exceptionChain.causedBy')}
              </Typography>
            )}
            <Typography component="span" sx={{ fontSize: '0.78rem', fontWeight: 700, color: idx === 0 ? 'error.main' : 'warning.main'}}>
              {entry.type}
            </Typography>
          </Box>
          <Collapse in={expandedIds.has(idx)}>
            <Box sx={{ px: 1.5, py: 1, borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}` }}>
              <Typography sx={{ fontSize: '0.78rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'text.primary' }}>
                {entry.value}
              </Typography>
            </Box>
          </Collapse>
        </Box>
      ))}
    </Box>
  );
};

export default ExceptionChaining;
