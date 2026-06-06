import React from 'react';
import { Box, Typography, IconButton, Tooltip, useTheme } from '@mui/material';
import {
  FilterList as FilterIcon,
  Block as ExcludeIcon,
  Timeline as TimelineIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ArgusLogEntry } from '@/services/argusService';
import { CopyButton } from '@/components/common/CopyButton';

const SEVERITY_COLORS: Record<string, string> = {
  fatal: '#d32f2f',
  error: '#f44336',
  warn: '#ff9800',
  warning: '#ff9800',
  info: '#2196f3',
  debug: '#9e9e9e',
  trace: '#607d8b',
};

export interface LogDetailProps {
  log: ArgusLogEntry;
  isDark: boolean;
  onFilter: (key: string, val: string, exclude: boolean) => void;
}

const LogDetail: React.FC<LogDetailProps> = ({ log, isDark, onFilter }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const attrs: [string, any][] = [];
  if (log.level) attrs.push(['severity', log.level]);
  if (log.timestamp) attrs.push(['timestamp_precise', log.timestamp]);
  if (log.trace_id) attrs.push(['trace_id', log.trace_id]);
  if (log.span_id) attrs.push(['span_id', log.span_id]);
  if (log.service) attrs.push(['service', log.service]);
  if (log.environment) attrs.push(['environment', log.environment]);
  if (log.release) attrs.push(['release', log.release]);
  if (log.logger_name) attrs.push(['logger_name', log.logger_name]);
  if (log.body) attrs.push(['body', log.body]);
  if (log.attributes && typeof log.attributes === 'object') {
    Object.entries(log.attributes).forEach(([k, v]) => attrs.push([k, v]));
  }

  const mid = Math.ceil(attrs.length / 2);
  const left = attrs.slice(0, mid);
  const right = attrs.slice(mid);

  const renderColumn = (items: [string, any][]) => (
    <Box sx={{ flex: 1 }}>
      {items.map(([key, val]) => (
        <Box
          key={key}
          sx={{
            display: 'flex',
            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
            py: 0.5,
            gap: 2,
            alignItems: 'flex-start',
            '&:hover .detail-actions': { opacity: 1 },
          }}
        >
          <Typography
            sx={{
              fontSize: '0.72rem',
              color: 'text.disabled',
              minWidth: 140,
              flexShrink: 0,
              pt: 0.2,
            }}
          >
            {key}
          </Typography>
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              minWidth: 0,
            }}
          >
            <Typography
              sx={{
                fontSize: '0.72rem',
                wordBreak: 'break-all',
                pt: 0.2,
                color:
                  key === 'severity'
                    ? SEVERITY_COLORS[String(val)?.toLowerCase()] ||
                      'text.primary'
                    : 'text.primary',
                fontWeight: key === 'severity' ? 700 : 400,
              }}
            >
              {typeof val === 'object' ? JSON.stringify(val) : String(val)}
            </Typography>
            <Box
              className="detail-actions"
              sx={{
                opacity: 0,
                transition: 'opacity 0.2s',
                display: 'flex',
                gap: 0.5,
                flexShrink: 0,
              }}
            >
              <CopyButton
                text={
                  typeof val === 'object' ? JSON.stringify(val) : String(val)
                }
                size={13}
                sx={{ p: 0.2 }}
              />
              <Tooltip
                title={t('argus.logs.action.addFilter', 'Add to filter')}
              >
                <IconButton
                  size="small"
                  onClick={() => onFilter(key, String(val), false)}
                  sx={{ p: 0.2, color: 'primary.main' }}
                >
                  <FilterIcon sx={{ fontSize: 13 }} />
                </IconButton>
              </Tooltip>
              <Tooltip
                title={t(
                  'argus.logs.action.excludeFilter',
                  'Exclude from filter'
                )}
              >
                <IconButton
                  size="small"
                  onClick={() => onFilter(key, String(val), true)}
                  sx={{ p: 0.2, color: 'error.main' }}
                >
                  <ExcludeIcon sx={{ fontSize: 13 }} />
                </IconButton>
              </Tooltip>
              {key === 'trace_id' && val && (
                <Tooltip
                  title={t(
                    'argus.logs.viewInTraceExplorer',
                    'View in Trace Explorer'
                  )}
                >
                  <IconButton
                    size="small"
                    onClick={() =>
                      navigate(`/argus/performance?trace=${val}`, {
                        state: { allowBack: true },
                      })
                    }
                    sx={{ p: 0.2, color: 'primary.main' }}
                  >
                    <TimelineIcon sx={{ fontSize: 13 }} />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          </Box>
        </Box>
      ))}
    </Box>
  );

  return (
    <Box
      sx={{
        mx: 2,
        mb: 1.5,
        px: 2,
        py: 1.5,
        borderRadius: 2,
        backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.015)',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
      }}
    >
      <Typography
        sx={{
          fontSize: '0.8rem',
          mb: 1.5,
          pb: 1,
          lineHeight: 1.6,
          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        }}
      >
        {log.message}
      </Typography>
      <Box sx={{ display: 'flex', gap: 4 }}>
        {renderColumn(left)}
        {renderColumn(right)}
      </Box>
    </Box>
  );
};

export default LogDetail;
