import React from 'react';
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

interface StackTraceViewerProps {
  stackTrace: string;
  firstLine?: string;
  stackFilePath?: string;
  loading?: boolean;
}

/**
 * StackTraceViewer Component
 * Displays stack trace with syntax highlighting
 */
export const StackTraceViewer: React.FC<StackTraceViewerProps> = ({
  stackTrace,
  firstLine,
  stackFilePath,
  loading = false,
}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  const handleCopyAll = () => {
    navigator.clipboard.writeText(stackTrace);
    enqueueSnackbar(t('common.copied'), { variant: 'success' });
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Toolbar */}
      <Box display="flex" justifyContent="flex-end" alignItems="center" mb={1}>
        <Tooltip title={t('crashes.copyAll')}>
          <IconButton size="small" onClick={handleCopyAll}>
            <CopyIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Stack Trace Content */}
      <Paper
        variant="outlined"
        sx={{
          maxHeight: 600,
          overflow: 'auto',
          bgcolor: 'grey.900',
          color: 'grey.100',
          fontFamily: 'monospace',
          fontSize: '0.75rem',
          p: 2,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {stackTrace.split('\n').map((line, index) => {
          // Highlight different parts of stack trace
          let color = 'grey.100';
          let fontWeight = 'normal';

          // Error/Exception lines
          if (line.match(/^(Error|Exception|Fatal|Unhandled)/i)) {
            color = 'error.light';
            fontWeight = 'bold';
          }
          // File paths and line numbers
          else if (line.match(/\.(cs|cpp|h|js|ts|py|java):\d+/)) {
            color = 'info.light';
          }
          // Function/method names
          else if (line.match(/^\s+at\s+/)) {
            color = 'warning.light';
          }
          // Stack frame indicators
          else if (line.match(/^\s*#\d+/)) {
            color = 'success.light';
          }

          return (
            <Box
              key={index}
              sx={{
                color,
                fontWeight,
                '&:hover': {
                  bgcolor: 'rgba(255, 255, 255, 0.05)',
                },
              }}
            >
              {line || ' '}
            </Box>
          );
        })}
      </Paper>
    </Box>
  );
};

export default StackTraceViewer;

