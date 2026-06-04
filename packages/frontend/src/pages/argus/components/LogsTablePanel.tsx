import React from 'react';
import {
  Box, Typography, Chip, IconButton, Tooltip,
  Paper, useTheme,
} from '@mui/material';
import {
  ArrowDownward as SortDescIcon,
  FullscreenExit as FullscreenExitIcon,
  WrapText as WrapTextIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

const AVAILABLE_COLUMNS = [
  { key: 'timestamp', label: 'TIMESTAMP' },
  { key: 'severity', label: 'SEVERITY' },
  { key: 'message', label: 'MESSAGE' },
  { key: 'service', label: 'SERVICE' },
  { key: 'environment', label: 'ENVIRONMENT' },
  { key: 'logger_name', label: 'LOGGER' },
  { key: 'trace_id', label: 'TRACE ID' },
  { key: 'release', label: 'RELEASE' },
];

export interface LogsTablePanelProps {
  columns: string[];
  logsFullscreen: boolean;
  wrapLines: boolean;
  logCount: number;
  isDark: boolean;
  onExitFullscreen: () => void;
  onWrapLinesToggle: () => void;
  children: React.ReactNode;
}

const LogsTablePanel: React.FC<LogsTablePanelProps> = ({
  columns,
  logsFullscreen,
  wrapLines,
  logCount,
  isDark,
  onExitFullscreen,
  onWrapLinesToggle,
  children,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <Paper elevation={0} sx={{
      borderRadius: 2, overflow: 'hidden',
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
      ...(logsFullscreen ? {
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 1300, m: 0, borderRadius: 0,
        display: 'flex', flexDirection: 'column',
        backgroundColor: theme.palette.background.paper,
      } : {}),
    }}>
      {/* Fullscreen header bar */}
      {logsFullscreen && (
        <Box sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          px: 2, py: 1,
          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
          backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 700 }}>
              {t('argus.logs.title', 'Logs')}
            </Typography>
            <Chip label={`${logCount}`} size="small" sx={{
              height: 22, fontSize: '0.7rem', fontWeight: 700,
            }} />
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tooltip title={wrapLines ? t('argus.logs.unwrapLines', 'Unwrap lines') : t('argus.logs.wrapLines', 'Wrap lines')}>
              <IconButton size="small" onClick={onWrapLinesToggle} color={wrapLines ? 'primary' : 'default'} sx={{ p: 0.4 }}>
                <WrapTextIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title={t('argus.logs.exitFullscreen', 'Exit fullscreen')}>
              <IconButton size="small" onClick={onExitFullscreen} sx={{ p: 0.4 }}>
                <FullscreenExitIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      )}

      {/* Column headers */}
      <Box sx={{
        display: 'flex', alignItems: 'center', px: 1.5, py: 0.8,
        borderBottom: `2px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'}`,
        backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
      }}>
        <Box sx={{ width: 44 }} />
        {columns.map(col => {
          const cfg = AVAILABLE_COLUMNS.find(c => c.key === col);
          const isMessage = col === 'message';
          return (
            <Box key={col} sx={{
              flex: isMessage ? 3 : col === 'timestamp' ? 1.3 : 0.8,
              minWidth: col === 'timestamp' ? 165 : isMessage ? 200 : 80,
              display: 'flex', alignItems: 'center', gap: 0.3,
            }}>
              <Typography sx={{
                fontSize: '0.68rem', fontWeight: 700, color: 'text.disabled',
                textTransform: 'uppercase', letterSpacing: '0.03em',
              }}>
                {cfg?.label || col.toUpperCase()}
              </Typography>
              {col === 'timestamp' && <SortDescIcon sx={{ fontSize: 12, color: 'text.disabled' }} />}
            </Box>
          );
        })}
      </Box>

      {/* Log rows (passed as children) */}
      {children}
    </Paper>
  );
};

export default LogsTablePanel;
