import React, { useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Radio,
  Divider,
  alpha,
  useTheme,
} from '@mui/material';
import {
  Settings as DisplayIcon,
  ContentCopy as CopyIcon,
  KeyboardArrowDown as ArrowDownIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { ArgusErrorEvent } from '@/services/argusService';
import { copyToClipboard } from '@/utils/clipboard';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import ExceptionChaining from '@/components/argus/ExceptionChaining';
import StacktraceView from '@/components/argus/StacktraceView';

// ── Stacktrace display options type ──
export type StacktraceMode = 'relevant' | 'full' | 'raw';
export type StacktraceOrder = 'recent' | 'oldest';

// ── Shared hooks for stacktrace state ──
export function useStacktraceState() {
  const [mode, setMode] = useLocalStorage<StacktraceMode>(
    'argus_stacktrace_mode',
    'relevant'
  );
  const [order, setOrder] = useLocalStorage<StacktraceOrder>(
    'argus_stacktrace_order',
    'recent'
  );
  return { mode, setMode, order, setOrder };
}

// ── Sentry-style controls (Display + Copy as) ──
interface StacktraceControlsProps {
  mode: StacktraceMode;
  setMode: (m: StacktraceMode) => void;
  order: StacktraceOrder;
  setOrder: (o: StacktraceOrder) => void;
  event: ArgusErrorEvent;
  isDark: boolean;
}

export const StacktraceControls: React.FC<StacktraceControlsProps> = React.memo(
  ({ mode, setMode, order, setOrder, event, isDark }) => {
    const { t } = useTranslation();
    const theme = useTheme();
    const [displayAnchor, setDisplayAnchor] = useState<null | HTMLElement>(null);
    const [copyAnchor, setCopyAnchor] = useState<null | HTMLElement>(null);

    const handleCopyRaw = () => {
      if (event.stacktrace_raw) {
        let raw = '';
        try {
          const parsed =
            typeof event.stacktrace_raw === 'string'
              ? JSON.parse(event.stacktrace_raw)
              : event.stacktrace_raw;
          raw = JSON.stringify(parsed, null, 2);
        } catch {
          raw = String(event.stacktrace_raw);
        }
        copyToClipboard(raw);
      }
      setCopyAnchor(null);
    };

    const handleCopyException = () => {
      const text = `${event.exception_type || ''}: ${event.exception_value || ''}`;
      copyToClipboard(text.trim());
      setCopyAnchor(null);
    };

    const btnSx = {
      textTransform: 'none' as const,
      fontSize: '0.7rem',
      fontWeight: 600,
      borderRadius: '6px',
      py: 0.25,
      px: 1.2,
      minHeight: 26,
      color: 'text.secondary',
      borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
      '&:hover': {
        borderColor: theme.palette.primary.main,
        backgroundColor: alpha(theme.palette.primary.main, 0.04),
      },
    };

    return (
      <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}>
        {/* Display dropdown */}
        <Button
          size="small"
          variant="outlined"
          startIcon={<DisplayIcon sx={{ fontSize: 13 }} />}
          endIcon={<ArrowDownIcon sx={{ fontSize: 14 }} />}
          onClick={(e) => setDisplayAnchor(e.currentTarget)}
          sx={btnSx}
        >
          {t('argus.issues.display', 'Display')}
        </Button>
        <Menu
          anchorEl={displayAnchor}
          open={Boolean(displayAnchor)}
          onClose={() => setDisplayAnchor(null)}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          slotProps={{
            paper: {
              sx: {
                minWidth: 200,
                mt: 0.5,
                borderRadius: 2,
              },
            },
          }}
        >
          {/* VIEW section */}
          <Typography
            sx={{
              px: 2,
              pt: 1,
              pb: 0.5,
              fontSize: '0.65rem',
              fontWeight: 700,
              color: 'text.disabled',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            {t('argus.issues.displayView', 'View')}
          </Typography>
          <MenuItem dense onClick={() => { setMode('relevant'); setDisplayAnchor(null); }}>
            <Radio size="small" checked={mode === 'relevant'} sx={{ p: 0, mr: 1 }} />
            <ListItemText primaryTypographyProps={{ fontSize: '0.8rem' }}>
              {t('argus.issues.mostRelevant', 'Most Relevant')}
            </ListItemText>
          </MenuItem>
          <MenuItem dense onClick={() => { setMode('full'); setDisplayAnchor(null); }}>
            <Radio size="small" checked={mode === 'full'} sx={{ p: 0, mr: 1 }} />
            <ListItemText primaryTypographyProps={{ fontSize: '0.8rem' }}>
              {t('argus.issues.fullStackTrace', 'Full Stack Trace')}
            </ListItemText>
          </MenuItem>
          <MenuItem dense onClick={() => { setMode('raw'); setDisplayAnchor(null); }}>
            <Radio size="small" checked={mode === 'raw'} sx={{ p: 0, mr: 1 }} />
            <ListItemText primaryTypographyProps={{ fontSize: '0.8rem' }}>
              {t('argus.issues.rawStackTrace', 'Raw Stack Trace')}
            </ListItemText>
          </MenuItem>

          <Divider sx={{ my: 0.5 }} />

          {/* SORT section */}
          <Typography
            sx={{
              px: 2,
              pt: 0.5,
              pb: 0.5,
              fontSize: '0.65rem',
              fontWeight: 700,
              color: 'text.disabled',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            {t('argus.issues.displaySort', 'Sort')}
          </Typography>
          <MenuItem dense onClick={() => { setOrder('recent'); setDisplayAnchor(null); }}>
            <Radio size="small" checked={order === 'recent'} sx={{ p: 0, mr: 1 }} />
            <ListItemText primaryTypographyProps={{ fontSize: '0.8rem' }}>
              {t('argus.issues.mostRecent', 'Newest')}
            </ListItemText>
          </MenuItem>
          <MenuItem dense onClick={() => { setOrder('oldest'); setDisplayAnchor(null); }}>
            <Radio size="small" checked={order === 'oldest'} sx={{ p: 0, mr: 1 }} />
            <ListItemText primaryTypographyProps={{ fontSize: '0.8rem' }}>
              {t('argus.issues.oldestFirst', 'Oldest')}
            </ListItemText>
          </MenuItem>
        </Menu>

        {/* Copy as dropdown */}
        <Button
          size="small"
          variant="outlined"
          startIcon={<CopyIcon sx={{ fontSize: 13 }} />}
          endIcon={<ArrowDownIcon sx={{ fontSize: 14 }} />}
          onClick={(e) => setCopyAnchor(e.currentTarget)}
          sx={btnSx}
        >
          {t('argus.issues.copyAs', 'Copy as')}
        </Button>
        <Menu
          anchorEl={copyAnchor}
          open={Boolean(copyAnchor)}
          onClose={() => setCopyAnchor(null)}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          slotProps={{
            paper: {
              sx: { minWidth: 180, mt: 0.5, borderRadius: 2 },
            },
          }}
        >
          <MenuItem dense onClick={handleCopyRaw}>
            <ListItemText primaryTypographyProps={{ fontSize: '0.8rem' }}>
              {t('argus.issues.copyRawStacktrace', 'Raw stacktrace')}
            </ListItemText>
          </MenuItem>
          <MenuItem dense onClick={handleCopyException}>
            <ListItemText primaryTypographyProps={{ fontSize: '0.8rem' }}>
              {t('argus.issues.copyException', 'Exception message')}
            </ListItemText>
          </MenuItem>
        </Menu>
      </Box>
    );
  }
);

// ── Main Stacktrace Section (content only) ──
export interface IssueStacktraceSectionProps {
  event: ArgusErrorEvent;
  isDark: boolean;
  mode: StacktraceMode;
  order: StacktraceOrder;
}

const IssueStacktraceSection: React.FC<IssueStacktraceSectionProps> = ({
  event,
  isDark,
  mode,
  order,
}) => {
  const { t } = useTranslation();

  // Raw mode: show JSON text
  if (mode === 'raw') {
    let rawText = '';
    try {
      const parsed =
        typeof event.stacktrace_raw === 'string'
          ? JSON.parse(event.stacktrace_raw)
          : event.stacktrace_raw;
      rawText = JSON.stringify(parsed, null, 2);
    } catch {
      rawText = String(event.stacktrace_raw || '');
    }

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {event.exception_value && (
          <Typography
            variant="body2"
            sx={{
              color: isDark ? '#ddd' : '#333',
              fontSize: '0.85rem',
            }}
          >
            {event.exception_value}
          </Typography>
        )}
        <ExceptionChaining
          exceptionType={event.exception_type}
          exceptionValue={event.exception_value}
          isDark={isDark}
        />
        <Paper
          elevation={0}
          sx={{
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
            borderRadius: 2,
            overflow: 'auto',
            maxHeight: 500,
            p: 2,
            backgroundColor: isDark ? '#1e1e1e' : '#fafafa',
          }}
        >
          <Typography
            component="pre"
            sx={{
              fontSize: '0.75rem',
              fontFamily: '"JetBrains Mono", "Fira Code", monospace',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              color: 'text.secondary',
              m: 0,
            }}
          >
            {rawText}
          </Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {event.exception_value && (
        <Typography
          variant="body2"
          sx={{
            color: isDark ? '#ddd' : '#333',
            fontSize: '0.85rem',
          }}
        >
          {event.exception_value}
        </Typography>
      )}

      <ExceptionChaining
        exceptionType={event.exception_type}
        exceptionValue={event.exception_value}
        isDark={isDark}
      />

      <Paper
        elevation={0}
        sx={{
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        <StacktraceView
          stacktrace={event.stacktrace_raw}
          mode={mode === 'relevant' ? 'relevant' : 'full'}
          order={order}
          isDark={isDark}
        />
      </Paper>
    </Box>
  );
};

export default React.memo(IssueStacktraceSection);
