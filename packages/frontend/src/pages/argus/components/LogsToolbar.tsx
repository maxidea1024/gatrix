import React from 'react';
import {
  Box,
  Typography,
  Chip,
  IconButton,
  Button,
  useTheme,
  alpha,
} from '@mui/material';
import SafeTooltip from '@/components/common/SafeTooltip';
import {
  FileDownload as ExportIcon,
  TableChart as EditTableIcon,
  FullscreenExit as FullscreenExitIcon,
  Fullscreen as FullscreenIcon,
  WrapText as WrapTextIcon,
  AccessTime as GotoTimeIcon,
  DensitySmall as CompactIcon,
  DensityMedium as DefaultDensityIcon,
  DensityLarge as ExpandedIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import SegmentedTabs from '@/components/common/SegmentedTabs';

export interface LogsToolbarProps {
  activeTab: number;
  onTabChange: (key: string) => void;
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
  // Display density
  displayDensity?: 'compact' | 'default' | 'expanded';
  onDensityChange?: (density: 'compact' | 'default' | 'expanded') => void;
}

const LogsToolbar: React.FC<LogsToolbarProps> = ({
  activeTab,
  onTabChange,
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
  displayDensity = 'default',
  onDensityChange,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        mb: 0.5,
      }}
    >
      <SegmentedTabs
        items={[
          { key: '0', label: t('argus.logs.logsTab', 'Logs') },
          { key: '1', label: t('argus.logs.aggregatesTab', 'Aggregates') },
          { key: '2', label: t('argus.logs.patternsTab', 'Patterns') },
          { key: '3', label: t('argus.logs.liveTailTab', 'Live Tail') },
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
              height: 22,
              fontSize: '0.68rem',
              fontWeight: 700,
              backgroundColor: alpha(theme.palette.primary.main, 0.08),
              color: 'text.secondary',
              border: 'none',
            }}
          />
        )}

        <Button
          variant="text"
          size="small"
          startIcon={<EditTableIcon sx={{ fontSize: 15 }} />}
          onClick={onOpenEditTable}
          sx={{
            textTransform: 'none',
            fontSize: '0.72rem',
            fontWeight: 600,
            px: 1.2,
            color: 'text.primary',
            borderRadius: '6px',
            whiteSpace: 'nowrap',
            '&:hover': {
              backgroundColor: isDark
                ? 'rgba(255,255,255,0.05)'
                : 'rgba(0,0,0,0.04)',
            },
          }}
        >
          {t('argus.logs.editTable', 'Edit Table')}
        </Button>

        <SafeTooltip title={t('argus.logs.export', 'Export')}>
          <IconButton size="small" onClick={onExport}>
            <ExportIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </SafeTooltip>

        {/* Time Jump */}
        {showGotoTime ? (
          <Box
            component="input"
            placeholder="HH:MM:SS"
            value={gotoTime}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              onGotoTimeChange(e.target.value)
            }
            onKeyDown={(e: React.KeyboardEvent) => {
              if (e.key === 'Enter') onGotoTimeSubmit();
              else if (e.key === 'Escape') onGotoTimeCancel();
            }}
            autoFocus
            sx={{
              width: 90,
              height: 26,
              border: '1px solid',
              borderColor: isDark
                ? 'rgba(255,255,255,0.15)'
                : 'rgba(0,0,0,0.15)',
              borderRadius: '6px',
              px: 1,
              fontSize: '0.72rem',
              backgroundColor: 'transparent',
              color: 'text.primary',
              outline: 'none',
              '&:focus': { borderColor: theme.palette.primary.main },
            }}
          />
        ) : (
          <SafeTooltip title={t('argus.logs.jumpToTime', 'Jump to time')}>
            <IconButton size="small" onClick={onShowGotoTime} sx={{ p: 0.4 }}>
              <GotoTimeIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </SafeTooltip>
        )}

        {/* Wrap Lines */}
        <SafeTooltip
          title={
            wrapLines
              ? t('argus.logs.unwrapLines', 'Unwrap lines')
              : t('argus.logs.wrapLines', 'Wrap lines')
          }
        >
          <IconButton
            size="small"
            onClick={onWrapLinesToggle}
            color={wrapLines ? 'primary' : 'default'}
            sx={{ p: 0.4 }}
          >
            <WrapTextIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </SafeTooltip>

        {/* Display Density */}
        {onDensityChange && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
              borderRadius: '6px',
              overflow: 'hidden',
            }}
          >
            <SafeTooltip title={t('argus.logs.density.compact', 'Compact')}>
              <IconButton
                size="small"
                onClick={() => onDensityChange('compact')}
                sx={{
                  p: 0.3,
                  borderRadius: 0,
                  backgroundColor:
                    displayDensity === 'compact'
                      ? alpha(theme.palette.primary.main, 0.12)
                      : 'transparent',
                }}
              >
                <CompactIcon
                  sx={{
                    fontSize: 16,
                    color:
                      displayDensity === 'compact'
                        ? theme.palette.primary.main
                        : 'text.disabled',
                  }}
                />
              </IconButton>
            </SafeTooltip>
            <SafeTooltip title={t('argus.logs.density.default', 'Default')}>
              <IconButton
                size="small"
                onClick={() => onDensityChange('default')}
                sx={{
                  p: 0.3,
                  borderRadius: 0,
                  backgroundColor:
                    displayDensity === 'default'
                      ? alpha(theme.palette.primary.main, 0.12)
                      : 'transparent',
                }}
              >
                <DefaultDensityIcon
                  sx={{
                    fontSize: 16,
                    color:
                      displayDensity === 'default'
                        ? theme.palette.primary.main
                        : 'text.disabled',
                  }}
                />
              </IconButton>
            </SafeTooltip>
            <SafeTooltip title={t('argus.logs.density.expanded', 'Expanded')}>
              <IconButton
                size="small"
                onClick={() => onDensityChange('expanded')}
                sx={{
                  p: 0.3,
                  borderRadius: 0,
                  backgroundColor:
                    displayDensity === 'expanded'
                      ? alpha(theme.palette.primary.main, 0.12)
                      : 'transparent',
                }}
              >
                <ExpandedIcon
                  sx={{
                    fontSize: 16,
                    color:
                      displayDensity === 'expanded'
                        ? theme.palette.primary.main
                        : 'text.disabled',
                  }}
                />
              </IconButton>
            </SafeTooltip>
          </Box>
        )}

        {/* Fullscreen */}
        <SafeTooltip
          placement="bottom-end"
          title={
            logsFullscreen
              ? t('argus.logs.exitFullscreen', 'Exit fullscreen')
              : t('argus.logs.fullscreen', 'Fullscreen')
          }
        >
          <IconButton size="small" onClick={onFullscreenToggle} sx={{ p: 0.4 }}>
            {logsFullscreen ? (
              <FullscreenExitIcon sx={{ fontSize: 18 }} />
            ) : (
              <FullscreenIcon sx={{ fontSize: 18 }} />
            )}
          </IconButton>
        </SafeTooltip>
      </Box>
    </Box>
  );
};

export default React.memo(LogsToolbar);
