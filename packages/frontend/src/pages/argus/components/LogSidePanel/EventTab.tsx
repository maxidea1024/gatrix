import React, { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { ArgusLogEntry } from '@/services/argusService';
import { AttrRow } from './AttrRow';
import { buildAttrTree, AttrTreeRenderer } from './AttrTree';
import { ARGUS_SEMANTIC } from '../../argusThemeTokens';

export const SEVERITY_COLORS: Record<string, string> = {
  fatal: '#d32f2f',
  error: ARGUS_SEMANTIC.negative,
  warn: ARGUS_SEMANTIC.warning,
  warning: ARGUS_SEMANTIC.warning,
  info: ARGUS_SEMANTIC.info,
  debug: '#9e9e9e',
  trace: '#607d8b',
};

interface EventTabProps {
  log: ArgusLogEntry;
  isDark: boolean;
  onFilter: (key: string, value: string, exclude: boolean) => void;
}

export const EventTab: React.FC<EventTabProps> = ({
  log,
  isDark,
  onFilter,
}) => {
  const { t } = useTranslation();

  const coreAttrs: [string, string, string?, boolean?][] = [
    [
      'severity',
      log.level || '',
      SEVERITY_COLORS[log.level?.toLowerCase()] || undefined,
      true,
    ],
    ['timestamp', log.timestamp || ''],
    ['service', log.service || ''],
    ['environment', log.environment || ''],
    ['release', log.release || ''],
    ['logger_name', log.logger_name || ''],
    ['trace_id', log.trace_id || ''],
    ['span_id', log.span_id || ''],
    ['log_id', log.log_id || ''],
  ];

  const attrTree = useMemo(() => {
    if (!log.attributes || typeof log.attributes !== 'object') return [];
    const entries: [string, string][] = Object.entries(log.attributes).map(
      ([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : String(v)]
    );
    return buildAttrTree(entries);
  }, [log.attributes]);

  return (
    <Box>
      <Box
        sx={{
          px: 2,
          py: 1.5,
          backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)',
          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        }}
      >
        <Typography
          sx={{
            fontSize: '0.78rem',
            lineHeight: 1.7,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontFamily: '"JetBrains Mono", "Fira Code", monospace',
            fontWeight: 400,
          }}
        >
          {log.message}
        </Typography>
        {log.body && log.body !== log.message && (
          <Typography
            sx={{
              fontSize: '0.72rem',
              lineHeight: 1.6,
              mt: 1,
              pt: 1,
              borderTop: `1px dashed ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              color: 'text.secondary',
            }}
          >
            {log.body}
          </Typography>
        )}
      </Box>

      <Box sx={{ pt: 0.5 }}>
        <Typography
          sx={{
            px: 2,
            pt: 1,
            pb: 0.5,
            fontSize: '0.65rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'text.disabled',
          }}
        >
          {t('argus.logs.panel.coreAttributes', 'Core Attributes')}
        </Typography>
        {coreAttrs.map(([key, val, color, bold]) => (
          <AttrRow
            key={key}
            label={key}
            value={val}
            isDark={isDark}
            color={color}
            bold={Boolean(bold)}
            onFilter={onFilter}
          />
        ))}
      </Box>

      {attrTree.length > 0 && (
        <Box sx={{ pt: 0.5 }}>
          <Typography
            sx={{
              px: 2,
              pt: 1,
              pb: 0.5,
              fontSize: '0.65rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'text.disabled',
            }}
          >
            {t('argus.logs.panel.customAttributes', 'Custom Attributes')}
          </Typography>
          <AttrTreeRenderer
            nodes={attrTree}
            depth={0}
            isDark={isDark}
            onFilter={onFilter}
          />
        </Box>
      )}
    </Box>
  );
};
