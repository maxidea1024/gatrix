import React, { useState, useRef } from 'react';
import {
  Box, Typography, Button, IconButton, Tooltip, CircularProgress,
  TextField, InputAdornment, Chip, Paper, alpha, useTheme
} from '@mui/material';
import {
  Article as LogIcon,
  Search as SearchIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
  FileDownload as ExportIcon,
  AccessTime as GotoTimeIcon,
  Close as CloseIcon,
  WrapText as WrapTextIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { CopyButton } from '@/components/common/CopyButton';
import { useLogsData } from '@/hooks/useIssueDetailData';

interface IssueLogsSectionProps {
  projectId: string;
  issueId: string;
  isDark: boolean;
}

const IssueLogsSection: React.FC<IssueLogsSectionProps> = ({ projectId, issueId, isDark }) => {
  const theme = useTheme();
  const { t } = useTranslation();

  const [showLogs, setShowLogs] = useState(false);
  const [expandedLogIds, setExpandedLogIds] = useState<Set<string>>(new Set());
  const [logsFullscreen, setLogsFullscreen] = useState(false);
  const [logSearch, setLogSearch] = useState('');
  const [logGotoTime, setLogGotoTime] = useState('');
  const [wrapLines, setWrapLines] = useState(false);
  const [showLogGoto, setShowLogGoto] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const { logs, logsHasMore, logsLoading, loadMoreLogs, isFetchingMore } = useLogsData(projectId, issueId, showLogs);

  return (
    <Paper elevation={0} sx={{
      p: 2, mt: 2, mb: 2, border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
      borderRadius: 2,
      ...(logsFullscreen ? {
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 1300, m: 0, borderRadius: 0, overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      } : {}),
    }}>
      {!showLogs ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 5 }}>
          <Button
            variant="outlined"
            startIcon={<LogIcon />}
            onClick={() => setShowLogs(true)}
            sx={{
              textTransform: 'none',
              fontSize: '0.8rem',
              fontWeight: 600,
              borderRadius: '8px',
              px: 3.5,
              py: 1.2,
              borderColor: theme.palette.info.main,
              color: theme.palette.info.main,
              '&:hover': {
                borderColor: theme.palette.info.dark,
                backgroundColor: alpha(theme.palette.info.main, 0.04),
              }
            }}
          >
            {t('argus.issues.loadLogs', 'Load Logs')}
          </Button>
        </Box>
      ) : (
        <>
          {/* Toolbar */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <Typography variant="subtitle2" fontWeight={600} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <LogIcon fontSize="small" sx={{ color: theme.palette.info.main }} />
              {t('argus.issues.logs', 'Logs')}
              {logs.length > 0 && <Chip label={(() => { const filtered = logSearch ? logs.filter(l => l.message.toLowerCase().includes(logSearch.toLowerCase()) || l.logger_name?.toLowerCase().includes(logSearch.toLowerCase()) || (l.attributes && JSON.stringify(l.attributes).toLowerCase().includes(logSearch.toLowerCase()))) : logs; return `${filtered.length}${logSearch ? '/' + logs.length : ''}`; })()} size="small" sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700, ml: 0.5 }} />}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {showLogs && logs.length > 0 && (
                <>
                  {/* Search */}
                  <TextField
                    size="small"
                    placeholder={t('argus.logs.searchPlaceholder')}
                    value={logSearch}
                    onChange={(e) => setLogSearch(e.target.value)}
                    sx={{
                      width: logsFullscreen ? 280 : 180,
                      '& .MuiOutlinedInput-root': {
                        height: 28, fontSize: '0.72rem', borderRadius: '6px',
                        fontFamily: 'inherit',
                      },
                    }}
                    InputProps={{
                      startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 14, color: 'text.disabled' }} /></InputAdornment>,
                      endAdornment: logSearch ? (
                        <InputAdornment position="end">
                          <IconButton size="small" onClick={() => setLogSearch('')} sx={{ p: 0.2 }}>
                            <CloseIcon sx={{ fontSize: 12 }} />
                          </IconButton>
                        </InputAdornment>
                      ) : null,
                    }}
                  />
                  {/* Go-to time */}
                  {showLogGoto ? (
                    <TextField
                      size="small"
                      placeholder="HH:MM:SS"
                      value={logGotoTime}
                      onChange={(e) => setLogGotoTime(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && logGotoTime) {
                          const parts = logGotoTime.split(':').map(Number);
                          if (parts.length >= 2) {
                            const targetH = parts[0] || 0;
                            const targetM = parts[1] || 0;
                            const targetS = parts[2] || 0;
                            const targetMin = targetH * 3600 + targetM * 60 + targetS;
                            // Find closest log
                            let closestIdx = 0;
                            let closestDiff = Infinity;
                            logs.forEach((log, idx) => {
                              const d = new Date(log.timestamp);
                              const logMin = d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
                              const diff = Math.abs(logMin - targetMin);
                              if (diff < closestDiff) { closestDiff = diff; closestIdx = idx; }
                            });
                            // Scroll to that row
                            const container = logContainerRef.current;
                            if (container) {
                              const rows = container.querySelectorAll('[data-log-row]');
                              if (rows[closestIdx]) {
                                rows[closestIdx].scrollIntoView({ behavior: 'smooth', block: 'center' });
                                // Flash highlight
                                (rows[closestIdx] as HTMLElement).style.backgroundColor = isDark ? 'rgba(33,150,243,0.15)' : 'rgba(33,150,243,0.12)';
                                setTimeout(() => { (rows[closestIdx] as HTMLElement).style.backgroundColor = ''; }, 1500);
                              }
                            }
                          }
                          setShowLogGoto(false);
                          setLogGotoTime('');
                        } else if (e.key === 'Escape') {
                          setShowLogGoto(false);
                          setLogGotoTime('');
                        }
                      }}
                      autoFocus
                      sx={{ width: 100, '& .MuiOutlinedInput-root': { height: 28, fontSize: '0.72rem', borderRadius: '6px' } }}
                    />
                  ) : (
                    <Tooltip title={t('argus.logs.jumpToTime')}>
                      <IconButton size="small" onClick={() => setShowLogGoto(true)} sx={{ p: 0.4 }}>
                        <GotoTimeIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                  {/* Export */}
                  <Tooltip title={t('argus.logs.exportJson')}>
                    <IconButton size="small" onClick={() => {
                      const dataStr = JSON.stringify(logs, null, 2);
                      const blob = new Blob([dataStr], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url; a.download = `logs-issue-${issueId}.json`;
                      a.click(); URL.revokeObjectURL(url);
                    }} sx={{ p: 0.4 }}>
                      <ExportIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                  {/* Wrap Lines */}
                  <Tooltip title={wrapLines ? t('argus.logs.unwrapLines', '줄바꿈 취소') : t('argus.logs.wrapLines', '줄바꿈')}>
                    <IconButton size="small" onClick={() => setWrapLines(w => !w)} color={wrapLines ? 'primary' : 'default'} sx={{ p: 0.4 }}>
                      <WrapTextIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                  {/* Fullscreen */}
                  <Tooltip title={logsFullscreen ? t('argus.logs.exitFullscreen') : t('argus.logs.fullscreen')}>
                    <IconButton size="small" onClick={() => setLogsFullscreen(f => !f)} sx={{ p: 0.4 }}>
                      {logsFullscreen ? <FullscreenExitIcon sx={{ fontSize: 16 }} /> : <FullscreenIcon sx={{ fontSize: 16 }} />}
                    </IconButton>
                  </Tooltip>
                </>
              )}
            </Box>
          </Box>
          {showLogs && (
            <Box sx={{ mt: 1.5, flex: logsFullscreen ? 1 : 'none', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              {logsLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                  <CircularProgress size={20} />
                </Box>
              ) : logs.length === 0 ? (
                <Typography variant="body2" color="text.secondary" textAlign="center" py={3}>
                  {t('argus.issues.noLogs', 'No logs found for this issue')}
                </Typography>
              ) : (() => {
                const searchLower = logSearch.toLowerCase();
                const filteredLogs = logSearch
                  ? logs.filter(l =>
                      l.message.toLowerCase().includes(searchLower) ||
                      l.logger_name?.toLowerCase().includes(searchLower) ||
                      l.level.toLowerCase().includes(searchLower) ||
                      (l.attributes && JSON.stringify(l.attributes).toLowerCase().includes(searchLower))
                    )
                  : logs;
                return (
                <Box ref={logContainerRef} sx={{
                  maxHeight: logsFullscreen ? 'none' : 650,
                  flex: logsFullscreen ? 1 : 'none',
                  overflowY: 'auto',
                  fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
                  fontSize: '0.73rem',
                  backgroundColor: isDark ? '#0d1117' : '#fafbfc',
                  borderRadius: 1,
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                }}>
                  {/* Header */}
                  <Box sx={{
                    display: 'grid',
                    gridTemplateColumns: '16px 76px 52px 150px 1fr',
                    gap: '0 8px',
                    px: 1.5, py: 0.6,
                    backgroundColor: isDark ? '#161b22' : '#f0f1f3',
                    borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                    position: 'sticky', top: 0, zIndex: 2,
                  }}>
                    <Box />
                    <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('argus.logs.time')}</Typography>
                    <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('argus.logs.level')}</Typography>
                    <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('argus.logs.logger')}</Typography>
                    <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('argus.logs.message')}</Typography>
                  </Box>
                  {/* Rows */}
                  {filteredLogs.map((log, i) => {
                    const levelColors: Record<string, { bg: string; fg: string }> = {
                      error: { bg: 'rgba(244,67,54,0.12)', fg: '#f44336' },
                      warn:  { bg: 'rgba(255,152,0,0.12)', fg: '#ff9800' },
                      warning: { bg: 'rgba(255,152,0,0.12)', fg: '#ff9800' },
                      info:  { bg: 'rgba(33,150,243,0.10)', fg: '#64b5f6' },
                      debug: { bg: 'rgba(158,158,158,0.10)', fg: '#9e9e9e' },
                    };
                    const lc = levelColors[log.level] || levelColors.debug;
                    const ts = new Date(log.timestamp);
                    const timeStr = `${ts.getHours().toString().padStart(2, '0')}:${ts.getMinutes().toString().padStart(2, '0')}:${ts.getSeconds().toString().padStart(2, '0')}`;
                    const logKey = log.log_id || String(i);
                    const isExpanded = expandedLogIds.has(logKey);
                    const toggleExpand = () => {
                      setExpandedLogIds(prev => {
                        const next = new Set(prev);
                        if (next.has(logKey)) next.delete(logKey);
                        else next.add(logKey);
                        return next;
                      });
                    };

                    const allFields: { key: string; value: string }[] = [
                      { key: 'timestamp', value: new Date(log.timestamp).toISOString() },
                      { key: 'level', value: log.level },
                      { key: 'logger', value: log.logger_name || '' },
                      { key: 'service', value: log.service || '' },
                      { key: 'environment', value: log.environment || '' },
                      { key: 'release', value: log.release || '' },
                      { key: 'trace_id', value: log.trace_id || '' },
                      { key: 'span_id', value: log.span_id || '' },
                      { key: 'message', value: log.message },
                    ];
                    if (log.attributes && typeof log.attributes === 'object') {
                      Object.entries(log.attributes).forEach(([k, v]) => {
                        allFields.push({ key: k, value: String(v) });
                      });
                    }

                    // Highlight search matches
                    const highlightText = (text: string) => {
                      if (!logSearch) return text;
                      const idx = text.toLowerCase().indexOf(searchLower);
                      if (idx === -1) return text;
                      return (
                        <>
                          {text.substring(0, idx)}
                          <Box component="span" sx={{ backgroundColor: isDark ? 'rgba(255,200,0,0.3)' : 'rgba(255,200,0,0.5)', borderRadius: '2px', px: '1px' }}>
                            {text.substring(idx, idx + logSearch.length)}
                          </Box>
                          {text.substring(idx + logSearch.length)}
                        </>
                      );
                    };

                    return (
                      <React.Fragment key={logKey}>
                        <Box
                          data-log-row
                          onClick={toggleExpand}
                          sx={{
                            display: 'grid',
                            gridTemplateColumns: '16px 76px 52px 150px 1fr',
                            gap: '0 8px',
                            px: 1.5, py: 0.4,
                            alignItems: 'center',
                            cursor: 'pointer',
                            userSelect: 'none',
                            borderBottom: isExpanded ? 'none' : `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}`,
                            backgroundColor: isExpanded
                              ? isDark ? 'rgba(33,150,243,0.06)' : 'rgba(33,150,243,0.04)'
                              : i % 2 === 0 ? 'transparent' : isDark ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.015)',
                            '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' },
                            transition: 'background-color 0.15s',
                          }}
                        >
                          <Box sx={{ color: 'text.disabled', display: 'flex', alignItems: 'center' }}>
                            {isExpanded ? <ExpandLessIcon sx={{ fontSize: 14 }} /> : <ExpandMoreIcon sx={{ fontSize: 14 }} />}
                          </Box>
                          <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled', fontFamily: 'inherit', fontVariantNumeric: 'tabular-nums' }}>
                            {timeStr}
                          </Typography>
                          <Box sx={{
                            px: 0.6, py: 0.15, borderRadius: '3px',
                            backgroundColor: lc.bg, color: lc.fg,
                            fontSize: '0.62rem', fontWeight: 700,
                            textAlign: 'center', textTransform: 'uppercase',
                            letterSpacing: '0.03em', lineHeight: 1.4,
                          }}>
                            {log.level === 'warning' ? 'warn' : log.level}
                          </Box>
                          <Typography sx={{ fontSize: '0.7rem', color: isDark ? '#8b949e' : '#656d76', fontFamily: 'inherit', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {highlightText(log.logger_name || '\u2014')}
                          </Typography>
                          <Typography sx={{
                            fontSize: '0.72rem',
                            color: log.level === 'error' ? (isDark ? '#ffa4a2' : '#d32f2f')
                              : log.level === 'warn' || log.level === 'warning' ? (isDark ? '#ffd699' : '#e65100')
                              : isDark ? '#c9d1d9' : '#24292f',
                            fontFamily: 'inherit',
                            ...(wrapLines ? {
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-all',
                            } : {
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            })
                          }}>
                            {highlightText(log.message)}
                          </Typography>
                        </Box>
                        {isExpanded && (
                          <Box sx={{
                            px: 2, py: 1.2, ml: '16px',
                            backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.02)',
                            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                            borderLeft: `3px solid ${lc.fg}`,
                          }}>
                            {/* Prominent Full Message Block */}
                            <Box sx={{
                              mb: 2,
                              p: 1.5,
                              borderRadius: '4px',
                              backgroundColor: isDark ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.8)',
                              border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                              position: 'relative',
                            }}>
                              <Typography sx={{
                                fontSize: '0.62rem',
                                fontWeight: 700,
                                color: 'text.disabled',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                mb: 0.8
                              }}>
                                {t('argus.logs.fullMessage', 'Full Message')}
                              </Typography>
                              <Typography sx={{
                                fontSize: '0.75rem',
                                color: log.level === 'error' ? (isDark ? '#ffa4a2' : '#d32f2f')
                                  : log.level === 'warn' || log.level === 'warning' ? (isDark ? '#ffd699' : '#e65100')
                                  : isDark ? '#e6edf3' : '#1f2328',
                                fontFamily: 'monospace',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-all',
                                pr: 4,
                              }}>
                                {highlightText(log.message)}
                              </Typography>
                              <CopyButton text={log.message} size={14}
                                sx={{ position: 'absolute', right: 8, top: 8, opacity: 0.4, '&:hover': { opacity: 1 } }}
                              />
                            </Box>

                            {/* Metadata Fields Grid */}
                            <Box sx={{ display: 'grid', gridTemplateColumns: '180px 1fr auto', gap: '2px 12px', alignItems: 'center' }}>
                              {allFields.filter(f => f.key !== 'message' && f.value).map((field) => (
                                <React.Fragment key={field.key}>
                                  <Typography sx={{ fontSize: '0.68rem', fontWeight: 600, color: isDark ? '#58a6ff' : '#0969da', fontFamily: 'inherit', py: 0.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {field.key}
                                  </Typography>
                                  <Typography sx={{ fontSize: '0.68rem', color: isDark ? '#c9d1d9' : '#24292f', fontFamily: 'inherit', py: 0.2, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                    {highlightText(field.value)}
                                  </Typography>
                                  <CopyButton text={field.value} size={12}
                                    sx={{ p: 0.2, opacity: 0.4, '&:hover': { opacity: 1 } }}
                                  />
                                </React.Fragment>
                              ))}
                            </Box>
                          </Box>
                        )}
                      </React.Fragment>
                    );
                  })}
                  {filteredLogs.length === 0 && logSearch && (
                    <Box sx={{ p: 3, textAlign: 'center' }}>
                      <Typography variant="body2" color="text.disabled">{t('argus.logs.noMatchingLogs', { query: logSearch })}</Typography>
                    </Box>
                  )}
                </Box>
                );
              })()}
            </Box>
          )}
          {/* Load More */}
          {logsHasMore && (
            <Box sx={{ py: 2, textAlign: 'center', borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}` }}>
              <Button
                variant="outlined" size="small"
                disabled={logsLoading || isFetchingMore}
                startIcon={(logsLoading || isFetchingMore) ? <CircularProgress size={14} color="inherit" /> : undefined}
                onClick={loadMoreLogs}
                sx={{
                  textTransform: 'none', fontSize: '0.78rem', fontWeight: 600, minWidth: 160,
                  borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
                }}
              >
                {t('argus.logs.loadMore', 'Load More Logs')}
              </Button>
            </Box>
          )}
        </>
      )}
    </Paper>
  );
};

export default IssueLogsSection;
