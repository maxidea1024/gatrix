import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  Tooltip,
  Paper,
  CircularProgress,
  TextField,
  InputAdornment,
  Fab,
} from '@mui/material';
import {
  Download as DownloadIcon,
  ContentCopy as CopyIcon,
  Link as LinkIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
  KeyboardArrowUp as ArrowUpIcon,
  KeyboardArrowDown as ArrowDownIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';

interface LogViewerProps {
  logContent: string;
  logFilePath?: string;
  loading?: boolean;
}

/**
 * LogViewer Component
 * Displays log file content with line numbers, search, and navigation functionality
 */
export const LogViewer: React.FC<LogViewerProps> = ({ logContent, logFilePath, loading = false }) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [goToLine, setGoToLine] = useState('');
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const lineRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
  const containerRef = useRef<HTMLDivElement | null>(null);

  const lines = logContent.split('\n');

  // Find matching lines for search
  const matchingLines = new Set<number>();
  if (searchQuery) {
    lines.forEach((line, index) => {
      if (line.toLowerCase().includes(searchQuery.toLowerCase())) {
        matchingLines.add(index + 1);
      }
    });
  }

  // Scroll to line if hash is present in URL
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith('#L')) {
      const lineNumber = parseInt(hash.substring(2), 10);
      if (!isNaN(lineNumber) && lineRefs.current[lineNumber]) {
        lineRefs.current[lineNumber]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, []);

  // Handle scroll to show/hide floating buttons
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      setShowScrollTop(scrollTop > 200);
      setShowScrollBottom(scrollTop < scrollHeight - clientHeight - 200);
    };

    container.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial check

    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLineClick = (event: React.MouseEvent<HTMLDivElement>, lineNumber: number) => {
    setSelectedLine(lineNumber);
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
    setSelectedLine(null);
  };

  const handleCopyLine = () => {
    if (selectedLine !== null) {
      const lineContent = lines[selectedLine - 1];
      navigator.clipboard.writeText(lineContent);
      enqueueSnackbar(t('common.copiedToClipboard'), { variant: 'success' });
      handleClose();
    }
  };

  const handleCopyLineWithNumber = () => {
    if (selectedLine !== null) {
      const lineContent = lines[selectedLine - 1];
      const textToCopy = `${selectedLine}: ${lineContent}`;
      navigator.clipboard.writeText(textToCopy);
      enqueueSnackbar(t('common.copiedToClipboard'), { variant: 'success' });
      handleClose();
    }
  };

  const handleCopyLink = () => {
    if (selectedLine !== null) {
      const url = `${window.location.origin}${window.location.pathname}${window.location.search}#L${selectedLine}`;
      navigator.clipboard.writeText(url);
      enqueueSnackbar(t('crashes.linkCopied'), { variant: 'success' });
      handleClose();
    }
  };

  const handleDownload = () => {
    const blob = new Blob([logContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = logFilePath ? logFilePath.split('/').pop() || 'log.txt' : 'log.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    enqueueSnackbar(t('crashes.logDownloaded'), { variant: 'success' });
  };

  const handleCopyAll = () => {
    navigator.clipboard.writeText(logContent);
    enqueueSnackbar(t('common.copiedToClipboard'), { variant: 'success' });
  };

  const handleGoToLine = () => {
    const lineNumber = parseInt(goToLine, 10);
    if (!isNaN(lineNumber) && lineNumber > 0 && lineNumber <= lines.length) {
      lineRefs.current[lineNumber]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      window.location.hash = `#L${lineNumber}`;
      setGoToLine('');
    }
  };

  const handleScrollToTop = () => {
    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleScrollToBottom = () => {
    containerRef.current?.scrollTo({ top: containerRef.current.scrollHeight, behavior: 'smooth' });
  };

  const highlightText = (text: string, query: string) => {
    if (!query) return text;

    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return (
      <>
        {parts.map((part, index) =>
          part.toLowerCase() === query.toLowerCase() ? (
            <span key={index} style={{ backgroundColor: '#ffeb3b', color: '#000' }}>
              {part}
            </span>
          ) : (
            part
          )
        )}
      </>
    );
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ position: 'relative' }}>
      {/* Toolbar */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1} gap={2}>
        <Typography variant="caption" color="text.secondary">
          {logFilePath || t('crashes.logFile')} ({lines.length} {t('crashes.lines')})
          {searchQuery && ` - ${matchingLines.size} matches`}
        </Typography>
        <Box display="flex" gap={1} alignItems="center">
          {/* Search */}
          <TextField
            size="small"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: searchQuery && (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setSearchQuery('')}>
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ),
            }}
            sx={{ width: 200 }}
          />

          {/* Go to Line */}
          <TextField
            size="small"
            placeholder="Go to line..."
            value={goToLine}
            onChange={(e) => setGoToLine(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleGoToLine();
              }
            }}
            type="number"
            sx={{ width: 120 }}
          />

          <Tooltip title={t('crashes.copyAll')}>
            <IconButton size="small" onClick={handleCopyAll}>
              <CopyIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={t('crashes.downloadLog')}>
            <IconButton size="small" onClick={handleDownload}>
              <DownloadIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Log Content */}
      <Paper
        ref={containerRef}
        variant="outlined"
        sx={{
          maxHeight: 600,
          overflow: 'auto',
          bgcolor: 'grey.900',
          color: 'grey.100',
          fontFamily: 'monospace',
          fontSize: '0.75rem',
          position: 'relative',
        }}
      >
        <Box>
          {lines.map((line, index) => {
            const lineNumber = index + 1;
            const isHighlighted = window.location.hash === `#L${lineNumber}`;
            const isMatching = matchingLines.has(lineNumber);

            return (
              <Box
                key={lineNumber}
                ref={(el) => (lineRefs.current[lineNumber] = el)}
                display="flex"
                sx={{
                  bgcolor: isHighlighted ? 'rgba(255, 255, 0, 0.1)' : 'transparent',
                  '&:hover': {
                    bgcolor: 'rgba(255, 255, 255, 0.05)',
                  },
                }}
              >
                {/* Line Number */}
                <Box
                  onClick={(e) => handleLineClick(e, lineNumber)}
                  sx={{
                    minWidth: 60,
                    px: 1,
                    py: 0.25,
                    textAlign: 'right',
                    color: isMatching ? '#ffeb3b' : 'grey.500',
                    bgcolor: isMatching ? 'rgba(255, 235, 59, 0.1)' : 'grey.800',
                    borderRight: '1px solid',
                    borderColor: 'grey.700',
                    borderLeft: isMatching ? '3px solid #ffeb3b' : 'none',
                    cursor: 'pointer',
                    userSelect: 'none',
                    fontWeight: isMatching ? 'bold' : 'normal',
                    '&:hover': {
                      color: 'grey.300',
                      bgcolor: 'grey.700',
                    },
                  }}
                >
                  {lineNumber}
                </Box>

                {/* Line Content */}
                <Box
                  sx={{
                    flex: 1,
                    px: 2,
                    py: 0.25,
                    whiteSpace: 'pre',
                    overflowX: 'auto',
                  }}
                >
                  {searchQuery ? highlightText(line || ' ', searchQuery) : (line || ' ')}
                </Box>
              </Box>
            );
          })}
        </Box>
      </Paper>

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
      >
        <MenuItem onClick={handleCopyLine}>
          <CopyIcon fontSize="small" sx={{ mr: 1 }} />
          {t('crashes.copyLine')}
        </MenuItem>
        <MenuItem onClick={handleCopyLineWithNumber}>
          <CopyIcon fontSize="small" sx={{ mr: 1 }} />
          {t('crashes.copyLineWithNumber')}
        </MenuItem>
        <MenuItem onClick={handleCopyLink}>
          <LinkIcon fontSize="small" sx={{ mr: 1 }} />
          {t('crashes.copyLineLink')}
        </MenuItem>
      </Menu>

      {/* Floating Scroll Buttons */}
      {showScrollTop && (
        <Fab
          size="small"
          color="primary"
          onClick={handleScrollToTop}
          sx={{
            position: 'absolute',
            bottom: showScrollBottom ? 80 : 16,
            right: 16,
            zIndex: 1,
          }}
        >
          <ArrowUpIcon />
        </Fab>
      )}
      {showScrollBottom && (
        <Fab
          size="small"
          color="primary"
          onClick={handleScrollToBottom}
          sx={{
            position: 'absolute',
            bottom: 16,
            right: 16,
            zIndex: 1,
          }}
        >
          <ArrowDownIcon />
        </Fab>
      )}
    </Box>
  );
};

export default LogViewer;

