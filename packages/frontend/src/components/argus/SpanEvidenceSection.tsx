/**
 * SpanEvidenceSection — G30: Performance issue span evidence.
 *
 * Highlights the problematic span(s) that caused a performance issue,
 * such as slow DB queries, N+1 queries, or slow HTTP calls.
 */
import React, { useState } from 'react';
import {
  Box, Typography, Paper, Chip, IconButton, Collapse,
  Tooltip, alpha, useTheme, LinearProgress,
} from '@mui/material';
import {
  Speed as SpanIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  Warning as SlowIcon,
  Storage as DbIcon,
  Http as HttpIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

interface SpanEvidence {
  op: string;
  description: string;
  duration_ms: number;
  status: 'ok' | 'internal_error' | 'deadline_exceeded' | string;
  problem_type?: 'slow_db_query' | 'n_plus_one' | 'slow_http' | 'slow_resource' | string;
  parent_span_id?: string;
  repeats?: number;
}

interface SpanEvidenceSectionProps {
  spans: SpanEvidence[];
  transactionDuration?: number;
}

function formatDuration(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)}µs`;
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

const PROBLEM_CONFIG: Record<string, { color: string; label: string }> = {
  slow_db_query: { color: '#f44336', label: 'Slow DB Query' },
  n_plus_one: { color: '#ff5722', label: 'N+1 Query' },
  slow_http: { color: '#ff9800', label: 'Slow HTTP' },
  slow_resource: { color: '#9c27b0', label: 'Slow Resource' },
};

function getOpIcon(op: string) {
  if (op.startsWith('db')) return <DbIcon sx={{ fontSize: 12 }} />;
  if (op.startsWith('http')) return <HttpIcon sx={{ fontSize: 12 }} />;
  return <SpanIcon sx={{ fontSize: 12 }} />;
}

const SpanEvidenceSection: React.FC<SpanEvidenceSectionProps> = ({ spans, transactionDuration }) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';
  const [expanded, setExpanded] = useState(true);

  if (!spans || spans.length === 0) return null;

  const totalDuration = transactionDuration || spans.reduce((sum, s) => sum + s.duration_ms, 0);

  return (
    <Paper
      elevation={0}
      sx={{
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        borderRadius: 2, overflow: 'hidden', mb: 1.5,
      }}
    >
      <Box
        onClick={() => setExpanded(!expanded)}
        sx={{
          display: 'flex', alignItems: 'center', gap: 1,
          px: 2, py: 1, cursor: 'pointer',
          '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)' },
        }}
      >
        <SlowIcon sx={{ fontSize: 16, color: '#ff9800' }} />
        <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, flex: 1 }}>
          {t('argus.spanEvidence.title')}
        </Typography>
        <Chip
          label={`${spans.length} span(s)`}
          size="small"
          sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700, backgroundColor: alpha('#ff9800', 0.1), color: '#ff9800' }}
        />
        <IconButton size="small" sx={{ width: 20, height: 20 }}>
          {expanded ? <CollapseIcon sx={{ fontSize: 14 }} /> : <ExpandIcon sx={{ fontSize: 14 }} />}
        </IconButton>
      </Box>

      <Collapse in={expanded}>
        <Box sx={{ px: 2, pb: 1.5 }}>
          {spans.map((span, idx) => {
            const problemCfg = span.problem_type ? PROBLEM_CONFIG[span.problem_type] : null;
            const pct = totalDuration > 0 ? (span.duration_ms / totalDuration) * 100 : 0;

            return (
              <Box
                key={idx}
                sx={{
                  mb: 1, p: 1, borderRadius: '8px',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
                }}
              >
                {/* Header */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                  {getOpIcon(span.op)}
                  <Chip
                    label={span.op}
                    size="small"
                    sx={{ height: 16, fontSize: '0.55rem', fontWeight: 700}}
                  />
                  {problemCfg && (
                    <Chip
                      icon={<SlowIcon sx={{ fontSize: '10px !important' }} />}
                      label={problemCfg.label}
                      size="small"
                      sx={{
                        height: 18, fontSize: '0.55rem', fontWeight: 700,
                        backgroundColor: alpha(problemCfg.color, 0.1),
                        color: problemCfg.color,
                        '& .MuiChip-icon': { color: problemCfg.color },
                      }}
                    />
                  )}
                  {span.repeats && span.repeats > 1 && (
                    <Chip
                      label={`×${span.repeats}`}
                      size="small"
                      sx={{ height: 16, fontSize: '0.55rem', fontWeight: 700, color: '#f44336' }}
                    />
                  )}
                  <Box sx={{ flex: 1 }} />
                  <Typography sx={{
                    fontSize: '0.75rem', fontWeight: 700, color: span.duration_ms > 1000 ? '#f44336' : span.duration_ms > 200 ? '#ff9800' : 'text.primary',
                  }}>
                    {formatDuration(span.duration_ms)}
                  </Typography>
                </Box>

                {/* Description */}
                <Typography sx={{
                  fontSize: '0.7rem', color: 'text.secondary', wordBreak: 'break-all',
                  mb: 0.5,
                }}>
                  {span.description}
                </Typography>

                {/* Duration bar */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(pct, 100)}
                    sx={{
                      flex: 1, height: 4, borderRadius: 2,
                      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                      '& .MuiLinearProgress-bar': {
                        backgroundColor: pct > 50 ? '#f44336' : pct > 20 ? '#ff9800' : '#4caf50',
                        borderRadius: 2,
                      },
                    }}
                  />
                  <Typography sx={{ fontSize: '0.55rem', color: 'text.disabled', minWidth: 30 }}>
                    {pct.toFixed(0)}%
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Box>
      </Collapse>
    </Paper>
  );
};

export default React.memo(SpanEvidenceSection);
