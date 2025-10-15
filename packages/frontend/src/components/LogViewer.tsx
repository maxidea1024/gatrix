import React, { useState, useRef, useEffect, useMemo } from 'react';
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
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';

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
  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
    lineNumber: number;
  } | null>(null);
  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [goToLine, setGoToLine] = useState('');
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  const lines = useMemo(() => logContent.split('\n'), [logContent]);

  // Find matching lines for search
  const matchingLines = useMemo(() => {
    const matches = new Set<number>();
    if (searchQuery) {
      lines.forEach((line, index) => {
        if (line.toLowerCase().includes(searchQuery.toLowerCase())) {
          matches.add(index + 1);
        }
      });
    }
    return matches;
  }, [lines, searchQuery]);

  // Memoize style objects to prevent re-creation on every render
  const lineNumberBaseStyle = useMemo(() => ({
    minWidth: '60px',
    px: 1,
    py: 0.25,
    textAlign: 'right' as const,
    borderRight: '1px solid',
    borderColor: 'grey.700',
    cursor: 'pointer',
    userSelect: 'none' as const,
    '&:hover': {
      color: 'grey.300',
      bgcolor: 'grey.700',
    },
  }), []);

  const lineContentStyle = useMemo(() => ({
    flex: 1,
    px: 2,
    py: 0.25,
    whiteSpace: 'pre' as const,
    overflowX: 'auto' as const,
  }), []);

  // Scroll to line if hash is present in URL
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith('#L')) {
      const lineNumber = parseInt(hash.substring(2), 10);
      if (!isNaN(lineNumber) && virtuosoRef.current) {
        setTimeout(() => {
          virtuosoRef.current?.scrollToIndex({
            index: lineNumber - 1,
            align: 'center',
            behavior: 'smooth'
          });
        }, 100);
      }
    }
  }, []);

  const handleLineClick = (event: React.MouseEvent<HTMLDivElement>, lineNumber: number) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedLine(lineNumber);
    setContextMenu({
      mouseX: event.clientX,
      mouseY: event.clientY,
      lineNumber,
    });
  };

  const handleClose = () => {
    setContextMenu(null);
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
    if (!isNaN(lineNumber) && lineNumber > 0 && lineNumber <= lines.length && virtuosoRef.current) {
      virtuosoRef.current.scrollToIndex({
        index: lineNumber - 1,
        align: 'center',
        behavior: 'smooth'
      });
      window.location.hash = `#L${lineNumber}`;
      setGoToLine('');
    }
  };

  const handleScrollToTop = () => {
    virtuosoRef.current?.scrollToIndex({ index: 0, behavior: 'smooth' });
  };

  const handleScrollToBottom = () => {
    virtuosoRef.current?.scrollToIndex({ index: lines.length - 1, behavior: 'smooth' });
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

  // Memoized row component for better performance
  const Row = React.memo(({ index }: { index: number }) => {
    const lineNumber = index + 1;
    const line = lines[index];
    const isHighlighted = window.location.hash === `#L${lineNumber}`;
    const isMatching = matchingLines.has(lineNumber);
    const isSelected = selectedLine === lineNumber;

    return (
      <Box
        display="flex"
        sx={{
          bgcolor: isHighlighted ? 'rgba(255, 255, 0, 0.1)' : 'transparent',
          '&:hover': {
            bgcolor: 'rgba(255, 255, 255, 0.05)',
          },
          '&:hover .line-menu-chip': {
            opacity: 1,
          },
        }}
      >
        {/* Line Number Area (clickable) */}
        <Box
          onClick={(e) => handleLineClick(e, lineNumber)}
          sx={{
            ...lineNumberBaseStyle,
            color: isMatching ? '#ffeb3b' : 'grey.500',
            bgcolor: isMatching ? 'rgba(255, 235, 59, 0.1)' : 'grey.800',
            borderLeft: isMatching ? '3px solid #ffeb3b' : isSelected ? '3px solid #2196f3' : 'none',
            fontWeight: isMatching ? 'bold' : 'normal',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 0.5,
          }}
        >
          <span>{lineNumber}</span>
          {/* Menu chip (shows on hover or when selected) */}
          <Box
            className="line-menu-chip"
            sx={{
              opacity: isSelected ? 1 : 0,
              transition: 'opacity 0.2s',
              fontSize: '0.7rem',
              color: 'grey.400',
              cursor: 'pointer',
            }}
          >
            •••
          </Box>
        </Box>

        {/* Line Content */}
        <Box sx={lineContentStyle}>
          {searchQuery ? highlightText(line || ' ', searchQuery) : (line || ' ')}
        </Box>
      </Box>
    );
  });

  Row.displayName = 'LogViewerRow';

  // Row renderer for react-virtuoso
  const rowRenderer = (index: number) => <Row index={index} />;

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
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1} gap={2} sx={{ flexShrink: 0 }}>
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
        variant="outlined"
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          bgcolor: 'grey.900',
          color: 'grey.100',
          fontFamily: 'monospace',
          fontSize: '0.75rem',
          position: 'relative',
        }}
      >
        <Virtuoso
          ref={virtuosoRef}
          totalCount={lines.length}
          itemContent={rowRenderer}
          style={{ height: '100%' }}
          overscan={{
            main: 400,
            reverse: 200,
          }}
          increaseViewportBy={{
            top: 200,
            bottom: 400,
          }}
          rangeChanged={(range) => {
            if (range) {
              setShowScrollTop(range.startIndex > 10);
              setShowScrollBottom(range.endIndex < lines.length - 10);
            }
          }}
        />
      </Paper>

      {/* Context Menu */}
      <Menu
        open={contextMenu !== null}
        onClose={handleClose}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
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

