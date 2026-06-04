import React from 'react';
import {
  Box, Typography, Chip, IconButton, Tooltip,
  Button, Divider, useTheme, alpha,
} from '@mui/material';
import {
  FileDownload as ExportIcon,
  TableChart as EditTableIcon,
  FullscreenExit as FullscreenExitIcon,
  Fullscreen as FullscreenIcon,
  WrapText as WrapTextIcon,
  AccessTime as GotoTimeIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import SegmentedTabs from '@/components/common/SegmentedTabs';
import FeatureSwitch from '@/components/common/FeatureSwitch';

export interface LogsToolbarProps {
  activeTab: number;
  onTabChange: (key: string) => void;
  autoRefresh: boolean;
  onAutoRefreshToggle: () => void;
  totalLogCount: number;
  displayCount: number;
  isDark: boolean;
  // Table controls
  onOpenEditTable: () => void;
  onExport: () => void;
  // Viewer features
  wrapLines: boolean;
  onWrapLinesToggle: () => void;
  logsFullscreen: boolean;
  onFullscreenToggle: () => void;
  // Time jump
  showGotoTime: boolean;
  gotoTime: string;
  onShowGotoTime: () => void;
  onGotoTimeChange: (val: string) => void;
  onGotoTimeSubmit: () => void;
  onGotoTimeCancel: () => void;
}

const LogsToolbar: React.FC<LogsToolbarProps> = ({
  activeTab,
  onTabChange,
  autoRefresh,
  onAutoRefreshToggle,
  totalLogCount,
  displayCount,
  isDark,
  onOpenEditTable,
  onExport,
  wrapLines,
  onWrapLinesToggle,
  logsFullscreen,
  onFullscreenToggle,
  showGotoTime,
  gotoTime,
  onShowGotoTime,
  onGotoTimeChange,
  onGotoTimeSubmit,
  onGotoTimeCancel,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
      <SegmentedTabs
        items={[
          { key: '0', label: t('argus.logs.logsTab', 'Logs') },
          { key: '1', label: t('argus.logs.aggregatesTab', 'Aggregates') },
        ]}
        value={String(activeTab)}
        onChange={onTabChange}
      />

      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
        {totalLogCount > 0 && (
          <Chip
            size="small"
            label={`${displayCount.toLocaleString()} / ${totalLogCount.toLocaleString()}`}
            sx={{
              height: 22, fontSize: '0.68rem', fontWeight: 700,
              backgroundColor: alpha(theme.palette.primary.main, 0.08),
              color: 'text.secondary', border: 'none',
            }}
          />
        )}

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography sx={{ fontSize: '0.68rem', color: 'text.disabled', fontWeight: 600, whiteSpace: 'nowrap' }}>
            {t('argus.logs.autoRefresh', 'Auto-refresh')}
          </Typography>
          <FeatureSwitch
            checked={autoRefresh}
            onChange={onAutoRefreshToggle}
            size="small"
            label={autoRefresh ? 'ON' : 'OFF'}
            color="#43a047"
          />
        </Box>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.3, borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)' }} />

        <Button variant="outlined" size="small" startIcon={<EditTableIcon sx={{ fontSize: 15 }} />}
          onClick={onOpenEditTable}
          sx={{
            textTransform: 'none', fontSize: '0.72rem', fontWeight: 600, px: 1.2,
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
            borderRadius: '6px', whiteSpace: 'nowrap',
          }}>
          {t('argus.logs.editTable', 'Edit Table')}
        </Button>

        <Tooltip title={t('argus.logs.export', 'Export')}>
          <IconButton size="small" onClick={onExport}>
            <ExportIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>

        {/* Time Jump */}
        {showGotoTime ? (
          <Box component="input"
            placeholder="HH:MM:SS"
            value={gotoTime}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onGotoTimeChange(e.target.value)}
            onKeyDown={(e: React.KeyboardEvent) => {
              if (e.key === 'Enter') onGotoTimeSubmit();
              else if (e.key === 'Escape') onGotoTimeCancel();
            }}
            autoFocus
            sx={{
              width: 90, height: 26, border: '1px solid',
              borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)',
              borderRadius: '6px', px: 1, fontSize: '0.72rem',
              backgroundColor: 'transparent', color: 'text.primary', outline: 'none',
              '&:focus': { borderColor: theme.palette.primary.main },
            }}
          />
        ) : (
          <Tooltip title={t('argus.logs.jumpToTime', 'Jump to time')}>
            <IconButton size="small" onClick={onShowGotoTime} sx={{ p: 0.4 }}>
              <GotoTimeIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        )}

        {/* Wrap Lines */}
        <Tooltip title={wrapLines ? t('argus.logs.unwrapLines', 'Unwrap lines') : t('argus.logs.wrapLines', 'Wrap lines')}>
          <IconButton size="small" onClick={onWrapLinesToggle} color={wrapLines ? 'primary' : 'default'} sx={{ p: 0.4 }}>
            <WrapTextIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>

        {/* Fullscreen */}
        <Tooltip title={logsFullscreen ? t('argus.logs.exitFullscreen', 'Exit fullscreen') : t('argus.logs.fullscreen', 'Fullscreen')}>
          <IconButton size="small" onClick={onFullscreenToggle} sx={{ p: 0.4 }}>
            {logsFullscreen ? <FullscreenExitIcon sx={{ fontSize: 18 }} /> : <FullscreenIcon sx={{ fontSize: 18 }} />}
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
};

export default LogsToolbar;
