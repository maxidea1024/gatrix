import React, { useState, useCallback } from 'react';
import { Box, Typography, IconButton, useTheme } from '@mui/material';
import SafeTooltip from '@/components/common/SafeTooltip';
import {
  ContentCopy as CopyIcon,
  Check as CheckIcon,
} from '@mui/icons-material';
import { copyToClipboard } from '@/utils/clipboard';

// ─── CopyButton ─────────────────────────────────────────────────────
// A minimal icon button that copies text and shows a ✓ animation.
//
// Usage:
//   <CopyButton text="some value" />
//   <CopyButton text={longJson} size={18} tooltipPlacement="right" />
// ─────────────────────────────────────────────────────────────────────

interface CopyButtonProps {
  /** Text to copy to clipboard */
  text: string;
  /** Icon size in px (default: 16) */
  size?: number;
  /** Tooltip placement */
  tooltipPlacement?: 'top' | 'bottom' | 'left' | 'right';
  /** Tooltip label (default: '복사') */
  tooltip?: string;
  /** Copied label (default: '복사됨') */
  copiedTooltip?: string;
  /** Optional callback after successful copy */
  onCopied?: () => void;
  /** Custom sx for the IconButton */
  sx?: Record<string, any>;
}

export const CopyButton: React.FC<CopyButtonProps> = ({
  text,
  size = 16,
  tooltipPlacement = 'top',
  tooltip = '복사',
  copiedTooltip = '✓ 복사됨',
  onCopied,
  sx,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopied(true);
      onCopied?.();
      setTimeout(() => setCopied(false), 2000);
    }
  }, [text, onCopied]);

  return (
    <SafeTooltip title={copied ? copiedTooltip : tooltip} placement={tooltipPlacement}>
      <IconButton
        onClick={handleCopy}
        size="small"
        sx={{
          color: copied ? '#2ea44f' : 'text.secondary',
          transition: 'color 0.15s ease',
          '&:hover': { color: copied ? '#2ea44f' : 'text.primary' },
          ...sx,
        }}
      >
        {copied
          ? <CheckIcon sx={{ fontSize: size }} />
          : <CopyIcon sx={{ fontSize: size }} />
        }
      </IconButton>
    </SafeTooltip>
  );
};

// ─── CopyableField ──────────────────────────────────────────────────
// A read-only field row with label, monospace value, and copy button.
// Used for displaying URLs, tokens, IDs, etc.
//
// Usage:
//   <CopyableField label="Webhook URL" value={webhookUrl} />
//   <CopyableField label="DSN" value={dsn} monoFont={false} />
// ─────────────────────────────────────────────────────────────────────

interface CopyableFieldProps {
  /** Field label */
  label: string;
  /** Field value (also the text that gets copied) */
  value: string;
  /** Use monospace font for value (default: true) */
  monoFont?: boolean;
  /** Show the label above the field (default: true) */
  showLabel?: boolean;
}

export const CopyableField: React.FC<CopyableFieldProps> = ({
  label,
  value,
  monoFont = true,
  showLabel = true,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    const ok = await copyToClipboard(value);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [value]);

  return (
    <Box sx={{ mb: 2 }}>
      {showLabel && (
        <Typography sx={{
          fontSize: '0.7rem', fontWeight: 600, color: 'text.secondary', mb: 0.5,
          textTransform: 'uppercase', letterSpacing: '0.05em',
        }}>
          {label}
        </Typography>
      )}
      <Box
        onClick={handleCopy}
        sx={{
          display: 'flex', alignItems: 'center', gap: 1,
          p: '10px 14px', borderRadius: '8px', cursor: 'pointer',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
          backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
          transition: 'all 0.15s ease',
          '&:hover': {
            borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
          },
        }}
      >
        <Typography sx={{
          flex: 1, fontSize: '0.82rem',
          color: isDark ? '#c9d1d9' : '#24292f',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {value}
        </Typography>
        <SafeTooltip title={copied ? '✓ 복사됨' : '클릭하여 복사'} placement="top">
          <Box sx={{
            color: copied ? '#2ea44f' : 'text.secondary',
            display: 'flex', alignItems: 'center', transition: 'color 0.15s',
          }}>
            {copied ? <CheckIcon sx={{ fontSize: 16 }} /> : <CopyIcon sx={{ fontSize: 16 }} />}
          </Box>
        </SafeTooltip>
      </Box>
    </Box>
  );
};

export default CopyButton;
