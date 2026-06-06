/**
 * SpanDetailPanel — Sentry-faithful span detail panel.
 *
 * Matches Sentry's layout:
 * 1. General section: Trace ID, Duration, Status, key metadata
 * 2. Tags section: Each tag with value + distribution bar (like Sentry)
 * 3. All colors from theme
 */
import React, { useState } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Chip,
  Divider,
  Tooltip,
  alpha,
  useTheme,
  Button,
  Collapse,
} from '@mui/material';
import {
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { CopyButton } from '@/components/common/CopyButton';
import { ArgusTraceSpan } from '@/services/argusService';
import { getOpColor } from './TraceWaterfall';

interface SpanDetailPanelProps {
  span: ArgusTraceSpan | null;
  onClose: () => void;
  isDark: boolean;
  totalDuration: number;
  /** All spans in the trace — used to compute tag distributions */
  allSpans?: ArgusTraceSpan[];
  /** When true, renders inline below a row (no side panel chrome) */
  inline?: boolean;
}

/** Compute distribution of a tag value across all spans */
function computeTagDistribution(
  tagKey: string,
  allSpans: ArgusTraceSpan[],
  source: 'tags' | 'data'
): { value: string; count: number; pct: number }[] {
  const counts = new Map<string, number>();
  let total = 0;
  for (const s of allSpans) {
    const pool = source === 'tags' ? s.tags : s.data;
    if (!pool) continue;
    const v = pool[tagKey];
    if (v !== undefined && v !== null && v !== '') {
      const str = String(v);
      counts.set(str, (counts.get(str) || 0) + 1);
      total++;
    }
  }
  return Array.from(counts.entries())
    .map(([value, count]) => ({
      value,
      count,
      pct: total > 0 ? (count / total) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

const SpanDetailPanel: React.FC<SpanDetailPanelProps> = ({
  span,
  onClose,
  isDark,
  totalDuration,
  allSpans = [],
  inline = false,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [expandedTags, setExpandedTags] = useState<Set<string>>(new Set());

  if (!span) return null;

  const duration = Number(span.duration);
  const durationPct = totalDuration > 0 ? (duration / totalDuration) * 100 : 0;
  const isError = span.status !== 'ok' && span.status !== '';
  const opColor = getOpColor(span.op);

  const toggleTagExpand = (key: string) => {
    setExpandedTags((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // ---- Collect all tags from both tags and data ----
  const tagEntries: { key: string; value: string; source: 'tags' | 'data' }[] =
    [];
  if (span.tags) {
    Object.entries(span.tags).forEach(([k, v]) =>
      tagEntries.push({ key: k, value: String(v), source: 'tags' })
    );
  }
  if (span.data) {
    Object.entries(span.data).forEach(([k, v]) => {
      // Skip if already in tags
      if (!span.tags || !(k in span.tags)) {
        tagEntries.push({ key: k, value: String(v), source: 'data' });
      }
    });
  }

  // ---- Sub-components ----

  /** General section row */
  const InfoRow: React.FC<{
    label: string;
    value: string | React.ReactNode;
    copyable?: boolean;
  }> = ({ label, value, copyable }) => (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        py: 0.4,
        minHeight: 26,
      }}
    >
      <Typography
        variant="caption"
        sx={{
          color: theme.palette.text.secondary,
          fontSize: '0.75rem',
          flexShrink: 0,
          mr: 2,
        }}
      >
        {label}
      </Typography>
      <Box
        sx={{ display: 'flex', alignItems: 'center', gap: 0.3, minWidth: 0 }}
      >
        {typeof value === 'string' ? (
          <Typography
            variant="caption"
            sx={{
              fontSize: '0.75rem',
              wordBreak: 'break-all',
              textAlign: 'right',
              color: theme.palette.text.primary,
            }}
          >
            {value}
          </Typography>
        ) : (
          value
        )}
        {copyable && typeof value === 'string' && (
          <CopyButton
            text={value}
            size={12}
            sx={{ p: 0.3, opacity: 0.4, '&:hover': { opacity: 1 } }}
          />
        )}
      </Box>
    </Box>
  );

  /** Tag row with distribution bar — Sentry style */
  const TagDistributionRow: React.FC<{
    tagKey: string;
    tagValue: string;
    source: 'tags' | 'data';
  }> = ({ tagKey, tagValue, source }) => {
    const dist =
      allSpans.length > 1
        ? computeTagDistribution(tagKey, allSpans, source)
        : [{ value: tagValue, count: 1, pct: 100 }];

    const currentPct = dist.find((d) => d.value === tagValue)?.pct ?? 100;
    const isExpanded = expandedTags.has(tagKey);
    const hasMultipleValues = dist.length > 1;

    // Choose bar color based on distribution
    const barColor = theme.palette.primary.main;

    return (
      <Box
        sx={{
          py: 1,
          px: 2,
          borderBottom: `1px solid ${theme.palette.divider}`,
          '&:last-child': { borderBottom: 'none' },
        }}
      >
        {/* Tag header: name + value */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: hasMultipleValues ? 'pointer' : 'default',
            mb: 0.5,
          }}
          onClick={() => hasMultipleValues && toggleTagExpand(tagKey)}
        >
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              fontSize: '0.8rem',
              color: theme.palette.text.primary,
            }}
          >
            {tagKey}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography
              variant="caption"
              sx={{
                fontSize: '0.72rem',
                color: theme.palette.text.secondary,
                maxWidth: 180,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {tagValue}
            </Typography>
            {hasMultipleValues &&
              (isExpanded ? (
                <ExpandMoreIcon
                  sx={{ fontSize: 16, color: theme.palette.text.secondary }}
                />
              ) : (
                <ChevronRightIcon
                  sx={{ fontSize: 16, color: theme.palette.text.secondary }}
                />
              ))}
          </Box>
        </Box>

        {/* Distribution bar */}
        <Box
          sx={{
            height: 6,
            borderRadius: 3,
            backgroundColor: theme.palette.action.hover,
            overflow: 'hidden',
            mb: 0.3,
          }}
        >
          <Box
            sx={{
              height: '100%',
              width: `${currentPct}%`,
              borderRadius: 3,
              backgroundColor: alpha(barColor, 0.6),
              transition: 'width 0.3s',
            }}
          />
        </Box>

        {/* Percentage label */}
        <Typography
          variant="caption"
          sx={{
            fontSize: '0.65rem',
            color: theme.palette.text.secondary,
          }}
        >
          {currentPct.toFixed(0)}%
        </Typography>

        {/* Expanded distribution details */}
        {hasMultipleValues && (
          <Collapse in={isExpanded}>
            <Box sx={{ mt: 1, pl: 1 }}>
              {dist.map((d, i) => (
                <Box
                  key={i}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    py: 0.3,
                  }}
                >
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      flexShrink: 0,
                      backgroundColor:
                        d.value === tagValue
                          ? barColor
                          : alpha(theme.palette.text.secondary, 0.3),
                    }}
                  />
                  <Typography
                    variant="caption"
                    sx={{
                      flex: 1,
                      fontSize: '0.72rem',
                      color: theme.palette.text.primary,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {d.value || '(empty)'}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      fontSize: '0.68rem',
                      color: theme.palette.text.secondary,
                      flexShrink: 0,
                    }}
                  >
                    {d.pct.toFixed(0)}%
                  </Typography>
                </Box>
              ))}
            </Box>
          </Collapse>
        )}
      </Box>
    );
  };

  return (
    <Box
      sx={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        ...(inline
          ? {
              // Inline mode: no side-panel chrome
              backgroundColor: 'transparent',
            }
          : {
              height: '100%',
              borderLeft: `1px solid ${theme.palette.divider}`,
              backgroundColor: theme.palette.background.paper,
              overflow: 'hidden',
            }),
      }}
    >
      {/* ---- Header ---- */}
      <Box
        sx={{
          px: 2,
          py: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          borderBottom: `1px solid ${theme.palette.divider}`,
          flexShrink: 0,
        }}
      >
        <Chip
          label={span.op}
          size="small"
          sx={{
            fontWeight: 700,
            fontSize: '0.68rem',
            height: 20,
            backgroundColor: alpha(opColor, isDark ? 0.2 : 0.1),
            color: opColor,
          }}
        />
        <Typography
          variant="body2"
          sx={{
            fontSize: '0.78rem',
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            color: theme.palette.text.primary,
          }}
        >
          {span.description || span.op}
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>

      {/* ---- Scrollable content — horizontal layout in inline mode ---- */}
      <Box
        sx={{
          overflow: inline ? 'visible' : 'auto',
          flex: inline ? undefined : 1,
          ...(inline
            ? {
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                gap: 1.5,
                p: 2,
              }
            : {}),
        }}
      >
        <Box
          sx={{
            ...(inline ? {} : { mx: 2, mt: 2, mb: 1.5 }),
            p: 2,
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 1.5,
            backgroundColor: isDark
              ? alpha(theme.palette.background.paper, 0.6)
              : theme.palette.background.paper,
          }}
        >
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 700,
              fontSize: '0.82rem',
              mb: 1,
              color: theme.palette.text.primary,
            }}
          >
            {t('argus.spanDetail.general')}
          </Typography>

          <InfoRow
            label={t('argus.spanDetail.spanId')}
            value={span.span_id}
            copyable
          />
          <InfoRow
            label={t('argus.spanDetail.traceId')}
            value={span.trace_id}
            copyable
          />
          <InfoRow
            label={t('argus.spanDetail.parentSpan')}
            value={span.parent_span_id || '–'}
            copyable={!!span.parent_span_id}
          />
          <InfoRow
            label={t('argus.spanDetail.duration')}
            value={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    color: theme.palette.text.primary,
                  }}
                >
                  {duration}ms
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: '0.68rem',
                    color: theme.palette.text.secondary,
                  }}
                >
                  ({durationPct.toFixed(1)}%)
                </Typography>
              </Box>
            }
          />
          <InfoRow
            label={t('argus.spanDetail.status')}
            value={
              <Chip
                label={span.status || 'ok'}
                size="small"
                sx={{
                  height: 18,
                  fontSize: '0.62rem',
                  fontWeight: 600,
                  backgroundColor: alpha(
                    isError
                      ? theme.palette.error.main
                      : theme.palette.success.main,
                    0.1
                  ),
                  color: isError
                    ? theme.palette.error.main
                    : theme.palette.success.main,
                }}
              />
            }
          />
          <InfoRow label={t('argus.spanDetail.operation')} value={span.op} />
          {span.action && (
            <InfoRow label={t('argus.spanDetail.action')} value={span.action} />
          )}
          {span.domain && (
            <InfoRow label={t('argus.spanDetail.domain')} value={span.domain} />
          )}
          <InfoRow
            label={t('argus.spanDetail.start')}
            value={new Date(span.start_timestamp).toLocaleString()}
          />

          {/* DB Query inline — if present */}
          {(span.data?.['db.statement'] || span.data?.['db.query']) && (
            <Box sx={{ mt: 1 }}>
              <Typography
                variant="caption"
                sx={{
                  color: theme.palette.text.secondary,
                  fontSize: '0.72rem',
                }}
              >
                {t('argus.spanDetail.query')}
              </Typography>
              <Box
                sx={{
                  mt: 0.5,
                  p: 1.5,
                  borderRadius: 1,
                  backgroundColor: theme.palette.action.hover,
                  border: `1px solid ${theme.palette.divider}`,
                  fontSize: '0.72rem',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  maxHeight: 120,
                  overflow: 'auto',
                  color: theme.palette.text.primary,
                  lineHeight: 1.5,
                }}
              >
                {span.data?.['db.statement'] || span.data?.['db.query']}
              </Box>
              <CopyButton
                text={(span.data?.['db.statement'] || span.data?.['db.query'])!}
                size={12}
                tooltip={t('argus.spanDetail.copySql')}
                sx={{ mt: 0.5 }}
              />
            </Box>
          )}

          {/* HTTP cURL inline */}
          {span.data?.['http.url'] && (
            <Box sx={{ mt: 1 }}>
              <CopyButton
                text={`curl -X ${span.data?.['http.method'] || 'GET'} '${span.data?.['http.url']}'`}
                size={12}
                tooltip={t('argus.spanDetail.copyAsCurl')}
              />
            </Box>
          )}
        </Box>

        {/* ====== Tags Section — Sentry-style with distribution bars ====== */}
        {tagEntries.length > 0 && (
          <Box
            sx={{
              ...(inline ? {} : { mx: 2, mb: 2 }),
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 1.5,
              backgroundColor: isDark
                ? alpha(theme.palette.background.paper, 0.6)
                : theme.palette.background.paper,
              overflow: 'hidden',
            }}
          >
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 700,
                fontSize: '0.82rem',
                px: 2,
                pt: 1.5,
                pb: 1,
                color: theme.palette.text.primary,
              }}
            >
              {t('argus.spanDetail.tags')}
            </Typography>

            {tagEntries.map(({ key, value, source }) => (
              <TagDistributionRow
                key={key}
                tagKey={key}
                tagValue={value}
                source={source}
              />
            ))}
          </Box>
        )}

        {/* Bottom padding */}
        {!inline && <Box sx={{ height: 24 }} />}
      </Box>
    </Box>
  );
};

export default SpanDetailPanel;
