import React, { useMemo } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  Paper,
  CircularProgress,
} from '@mui/material';
import {
  ContentCopy as CopyIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { Virtuoso } from 'react-virtuoso';

interface StackTraceViewerProps {
  stackTrace: string;
  firstLine?: string;
  stackFilePath?: string;
  loading?: boolean;
}

/**
 * Lua syntax highlighting helper
 */
const highlightLuaLine = (line: string) => {
  // Lua keywords
  const keywords = /\b(and|break|do|else|elseif|end|false|for|function|if|in|local|nil|not|or|repeat|return|then|true|until|while)\b/g;
  // Lua built-in functions
  const builtins = /\b(print|pairs|ipairs|type|tonumber|tostring|require|assert|error|pcall|xpcall|setmetatable|getmetatable|rawget|rawset|next|select|unpack|table|string|math|io|os|debug|coroutine)\b/g;
  // Strings
  const strings = /(["'])(?:(?=(\\?))\2.)*?\1/g;
  // Comments
  const comments = /(--.*$)/g;
  // Numbers
  const numbers = /\b(\d+\.?\d*)\b/g;
  // Function calls
  const functionCalls = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g;

  let result = line;
  const parts: { text: string; color: string }[] = [];
  let lastIndex = 0;

  // Simple tokenization (not perfect but good enough for stack traces)
  const tokens: { start: number; end: number; color: string }[] = [];

  // Find all matches
  let match;
  while ((match = keywords.exec(line)) !== null) {
    tokens.push({ start: match.index, end: match.index + match[0].length, color: '#569cd6' }); // Blue for keywords
  }
  while ((match = builtins.exec(line)) !== null) {
    tokens.push({ start: match.index, end: match.index + match[0].length, color: '#4ec9b0' }); // Cyan for builtins
  }
  while ((match = strings.exec(line)) !== null) {
    tokens.push({ start: match.index, end: match.index + match[0].length, color: '#ce9178' }); // Orange for strings
  }
  while ((match = comments.exec(line)) !== null) {
    tokens.push({ start: match.index, end: match.index + match[0].length, color: '#6a9955' }); // Green for comments
  }
  while ((match = numbers.exec(line)) !== null) {
    tokens.push({ start: match.index, end: match.index + match[0].length, color: '#b5cea8' }); // Light green for numbers
  }
  while ((match = functionCalls.exec(line)) !== null) {
    tokens.push({ start: match.index, end: match.index + match[1].length, color: '#dcdcaa' }); // Yellow for function calls
  }

  // Sort tokens by start position
  tokens.sort((a, b) => a.start - b.start);

  // Remove overlapping tokens (keep first match)
  const filteredTokens: typeof tokens = [];
  let lastEnd = -1;
  for (const token of tokens) {
    if (token.start >= lastEnd) {
      filteredTokens.push(token);
      lastEnd = token.end;
    }
  }

  // Build result with colored spans
  if (filteredTokens.length === 0) {
    return <span style={{ color: '#d4d4d4' }}>{line || ' '}</span>;
  }

  const elements: React.ReactNode[] = [];
  lastIndex = 0;

  filteredTokens.forEach((token, idx) => {
    // Add text before token
    if (token.start > lastIndex) {
      elements.push(
        <span key={`text-${idx}`} style={{ color: '#d4d4d4' }}>
          {line.substring(lastIndex, token.start)}
        </span>
      );
    }
    // Add colored token
    elements.push(
      <span key={`token-${idx}`} style={{ color: token.color }}>
        {line.substring(token.start, token.end)}
      </span>
    );
    lastIndex = token.end;
  });

  // Add remaining text
  if (lastIndex < line.length) {
    elements.push(
      <span key="text-end" style={{ color: '#d4d4d4' }}>
        {line.substring(lastIndex)}
      </span>
    );
  }

  return <>{elements}</>;
};

/**
 * StackTraceViewer Component
 * Displays stack trace with syntax highlighting for Lua
 */
export const StackTraceViewer: React.FC<StackTraceViewerProps> = ({
  stackTrace,
  firstLine,
  stackFilePath,
  loading = false,
}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  const lines = useMemo(() => stackTrace.split('\n'), [stackTrace]);

  const handleCopyAll = () => {
    navigator.clipboard.writeText(stackTrace);
    enqueueSnackbar(t('common.copiedToClipboard'), { variant: 'success' });
  };

  // Memoize style objects
  const lineNumberBaseStyle = useMemo(() => ({
    minWidth: '50px',
    px: 1,
    py: 0.25,
    textAlign: 'right' as const,
    borderRight: '1px solid',
    borderColor: 'grey.700',
    userSelect: 'none' as const,
    fontFamily: 'D2Coding, monospace',
    color: 'grey.500',
    bgcolor: 'grey.800',
  }), []);

  const lineContentStyle = useMemo(() => ({
    flex: 1,
    px: 2,
    py: 0.25,
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-all' as const,
    fontFamily: 'D2Coding, monospace',
  }), []);

  // Memoized row component
  const Row = React.memo(({ index }: { index: number }) => {
    const lineNumber = index + 1;
    const line = lines[index];

    return (
      <Box
        display="flex"
        sx={{
          outline: '1px dashed transparent',
          outlineOffset: '-1px',
          '&:hover': {
            bgcolor: 'rgba(255, 255, 255, 0.05)',
            outlineColor: 'grey.600',
          },
        }}
      >
        {/* Line Number */}
        <Box sx={lineNumberBaseStyle}>
          <span>{lineNumber}</span>
        </Box>

        {/* Line Content with Lua syntax highlighting */}
        <Box sx={lineContentStyle}>
          {highlightLuaLine(line)}
        </Box>
      </Box>
    );
  });

  Row.displayName = 'StackTraceViewerRow';

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <Box sx={{ flexShrink: 0, mb: 1 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="caption" color="text.secondary">
            {stackFilePath || t('crashes.stackTrace')} ({lines.length} {t('crashes.lines')})
          </Typography>
          <Tooltip title={t('crashes.copyAll')}>
            <IconButton size="small" onClick={handleCopyAll}>
              <CopyIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Stack Trace Content */}
      <Paper
        variant="outlined"
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          bgcolor: 'grey.900',
          color: 'grey.100',
          fontFamily: 'D2Coding, monospace',
          fontSize: '0.75rem',
          position: 'relative',
        }}
      >
        <Virtuoso
          totalCount={lines.length}
          itemContent={(index) => <Row index={index} />}
          style={{ height: '100%' }}
          overscan={{
            main: 200,
            reverse: 100,
          }}
        />
      </Paper>
    </Box>
  );
};

export default StackTraceViewer;

