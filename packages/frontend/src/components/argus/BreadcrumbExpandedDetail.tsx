import React, { useMemo } from 'react';
import {
  Box, Typography, Chip, IconButton, Tooltip, useTheme, alpha,
} from '@mui/material';
import {
  ContentCopy as CopyIcon,
  OpenInNew as ExternalLinkIcon,
} from '@mui/icons-material';
import Prism from 'prismjs';
import 'prismjs/components/prism-sql';
import type { Breadcrumb } from './BreadcrumbsTimeline';

/* ─── Helpers ─── */

function isSqlMessage(msg?: string): boolean {
  if (!msg) return false;
  return /^(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|BEGIN|COMMIT|ROLLBACK|TRUNCATE)\b/i.test(msg.trim());
}

function isHttpCategory(crumb: Breadcrumb): boolean {
  return crumb.type === 'http' || crumb.category === 'http' || crumb.category === 'fetch' || crumb.category === 'xhr';
}

function isNavigationCategory(crumb: Breadcrumb): boolean {
  return crumb.category === 'navigation' || crumb.type === 'navigation';
}

/* ─── Structured Data Tree ─── */

interface DataNodeProps {
  keyName: string;
  value: unknown;
  depth: number;
  isDark: boolean;
  defaultExpanded: boolean;
}

const DataNode: React.FC<DataNodeProps> = ({ keyName, value, depth, isDark, defaultExpanded }) => {
  const [expanded, setExpanded] = React.useState(defaultExpanded || depth < 1);

  const colors = isDark
    ? { key: '#9cdcfe', str: '#ce9178', num: '#b5cea8', bool: '#569cd6', null: '#569cd6' }
    : { key: '#a31515', str: '#0451a5', num: '#098658', bool: '#0000ff', null: '#0000ff' };

  if (value === null || value === undefined) {
    return (
      <Box sx={{ display: 'flex', gap: 0.5, py: 0.15 }}>
        <Typography component="span" sx={{ fontSize: '0.72rem', color: colors.key, fontWeight: 600 }}>
          {keyName}:
        </Typography>
        <Typography component="span" sx={{ fontSize: '0.72rem', color: colors.null, fontStyle: 'italic' }}>
          {value === null ? 'null' : 'undefined'}
        </Typography>
      </Box>
    );
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    const entries = Object.entries(value as Record<string, unknown>);
    return (
      <Box sx={{ py: 0.1 }}>
        <Box
          onClick={() => setExpanded(!expanded)}
          sx={{ display: 'flex', gap: 0.5, cursor: 'pointer', '&:hover': { opacity: 0.7 } }}
        >
          <Typography component="span" sx={{ fontSize: '0.65rem', color: 'text.disabled', width: 12, textAlign: 'center' }}>
            {expanded ? '▾' : '▸'}
          </Typography>
          <Typography component="span" sx={{ fontSize: '0.72rem', color: colors.key, fontWeight: 600 }}>
            {keyName}:
          </Typography>
          {!expanded && (
            <Typography component="span" sx={{ fontSize: '0.68rem', color: 'text.disabled' }}>
              {`{${entries.length}}`}
            </Typography>
          )}
        </Box>
        {expanded && (
          <Box sx={{ pl: 2.5 }}>
            {entries.map(([k, v]) => (
              <DataNode key={k} keyName={k} value={v} depth={depth + 1} isDark={isDark} defaultExpanded={defaultExpanded} />
            ))}
          </Box>
        )}
      </Box>
    );
  }

  if (Array.isArray(value)) {
    return (
      <Box sx={{ py: 0.1 }}>
        <Box
          onClick={() => setExpanded(!expanded)}
          sx={{ display: 'flex', gap: 0.5, cursor: 'pointer', '&:hover': { opacity: 0.7 } }}
        >
          <Typography component="span" sx={{ fontSize: '0.65rem', color: 'text.disabled', width: 12, textAlign: 'center' }}>
            {expanded ? '▾' : '▸'}
          </Typography>
          <Typography component="span" sx={{ fontSize: '0.72rem', color: colors.key, fontWeight: 600 }}>
            {keyName}:
          </Typography>
          {!expanded && (
            <Typography component="span" sx={{ fontSize: '0.68rem', color: 'text.disabled' }}>
              {`[${value.length}]`}
            </Typography>
          )}
        </Box>
        {expanded && (
          <Box sx={{ pl: 2.5 }}>
            {value.map((v, i) => (
              <DataNode key={i} keyName={`${i}`} value={v} depth={depth + 1} isDark={isDark} defaultExpanded={defaultExpanded} />
            ))}
          </Box>
        )}
      </Box>
    );
  }

  // Primitive values
  let color = colors.str;
  let displayValue = String(value);
  if (typeof value === 'number') color = colors.num;
  else if (typeof value === 'boolean') color = colors.bool;
  else displayValue = `"${displayValue}"`;

  return (
    <Box sx={{ display: 'flex', gap: 0.5, py: 0.15 }}>
      <Typography component="span" sx={{ fontSize: '0.72rem', color: colors.key, fontWeight: 600 }}>
        {keyName}:
      </Typography>
      <Typography component="span" sx={{ fontSize: '0.72rem', color, wordBreak: 'break-all' }}>
        {displayValue}
      </Typography>
    </Box>
  );
};

/* ─── SQL Syntax Highlighter ─── */

const SqlHighlighted: React.FC<{ sql: string; isDark: boolean }> = ({ sql, isDark }) => {
  const html = useMemo(() => {
    try {
      return Prism.highlight(sql, Prism.languages.sql, 'sql');
    } catch {
      return sql;
    }
  }, [sql]);

  return (
    <Box
      component="pre"
      sx={{
        margin: 0, p: 0.8, borderRadius: '4px', fontSize: '0.72rem', lineHeight: 1.5,
        backgroundColor: isDark ? 'rgba(76,175,80,0.06)' : 'rgba(76,175,80,0.04)',
        border: `1px solid ${alpha(isDark ? '#4caf50' : '#4caf50', 0.15)}`,
        overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
        // Prism token colors
        '& .token.keyword': { color: isDark ? '#569cd6' : '#0000ff', fontWeight: 700 },
        '& .token.string': { color: isDark ? '#ce9178' : '#a31515' },
        '& .token.number': { color: isDark ? '#b5cea8' : '#098658' },
        '& .token.operator': { color: isDark ? '#d4d4d4' : '#333' },
        '& .token.punctuation': { color: isDark ? '#808080' : '#999' },
        '& .token.function': { color: isDark ? '#dcdcaa' : '#795e26' },
        '& .token.comment': { color: '#6a9955', fontStyle: 'italic' },
      }}
    >
      <code dangerouslySetInnerHTML={{ __html: html }} />
    </Box>
  );
};

/* ─── HTTP Detail Panel ─── */

const HttpDetailPanel: React.FC<{ crumb: Breadcrumb; isDark: boolean }> = ({ crumb, isDark }) => {
  const data = crumb.data || {};
  const method = data.method || '';
  const statusCode = data.status_code || data.statusCode || '';
  const url = data.url || '';
  const duration = data.duration || data.elapsed;
  const responseSize = data.response_body_size || data.responseBodySize;

  const isError = Number(statusCode) >= 400;

  const rows = [
    method && { key: 'Method', value: method },
    url && { key: 'URL', value: url },
    statusCode && { key: 'Status', value: String(statusCode) },
    duration && { key: 'Duration', value: `${duration}ms` },
    responseSize && { key: 'Response Size', value: `${responseSize} bytes` },
    data.reason && { key: 'Reason', value: data.reason },
  ].filter(Boolean) as { key: string; value: string }[];

  // Any remaining data keys not already shown
  const shownKeys = new Set(['method', 'url', 'status_code', 'statusCode', 'duration', 'elapsed',
    'response_body_size', 'responseBodySize', 'reason', '_virtual']);
  const extraEntries = Object.entries(data).filter(([k]) => !shownKeys.has(k));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3 }}>
      {rows.map(r => (
        <Box key={r.key} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Typography sx={{ fontSize: '0.68rem', color: 'text.disabled', minWidth: 80, fontWeight: 600 }}>
            {r.key}
          </Typography>
          <Typography sx={{
            fontSize: '0.72rem', wordBreak: 'break-all',
            color: r.key === 'Status' && isError ? '#f44336' : 'text.primary',
            fontWeight: r.key === 'Method' ? 700 : 400,
          }}>
            {r.value}
          </Typography>
        </Box>
      ))}
      {extraEntries.length > 0 && (
        <Box sx={{ mt: 0.5, pt: 0.5, borderTop: '1px solid', borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}>
          {extraEntries.map(([k, v]) => (
            <DataNode key={k} keyName={k} value={v} depth={0} isDark={isDark} defaultExpanded={false} />
          ))}
        </Box>
      )}
    </Box>
  );
};

/* ─── Navigation Detail Panel ─── */

const NavigationDetailPanel: React.FC<{ crumb: Breadcrumb; isDark: boolean }> = ({ crumb, isDark }) => {
  const data = crumb.data || {};
  const from = data.from || '';
  const to = data.to || data.url || crumb.message || '';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      {from && (
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Typography sx={{ fontSize: '0.68rem', color: 'text.disabled', minWidth: 40, fontWeight: 600 }}>From</Typography>
          <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', wordBreak: 'break-all' }}>{from}</Typography>
        </Box>
      )}
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <Typography sx={{ fontSize: '0.68rem', color: 'text.disabled', minWidth: 40, fontWeight: 600 }}>To</Typography>
        <Typography sx={{ fontSize: '0.72rem', color: 'text.primary', wordBreak: 'break-all', fontWeight: 600 }}>{to}</Typography>
        {/^https?:\/\//.test(to) && (
          <Tooltip title="Open in new tab">
            <IconButton
              size="small"
              onClick={(e) => { e.stopPropagation(); window.open(to, '_blank'); }}
              sx={{ p: 0.2 }}
            >
              <ExternalLinkIcon sx={{ fontSize: 12 }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </Box>
  );
};

/* ─── Main Expanded Detail Panel ─── */

export interface BreadcrumbExpandedDetailProps {
  crumb: Breadcrumb;
  isDark: boolean;
  fullyExpanded?: boolean;
}

/**
 * Renders the expanded detail panel for a breadcrumb item.
 * Supports category-specific rendering:
 * - HTTP: method/url/status/duration layout
 * - Navigation: from → to with external link
 * - SQL: Prism syntax highlighting
 * - Default: StructuredData tree viewer
 */
const BreadcrumbExpandedDetail: React.FC<BreadcrumbExpandedDetailProps> = ({
  crumb,
  isDark,
  fullyExpanded = false,
}) => {
  const hasData = crumb.data && Object.keys(crumb.data).filter(k => k !== '_virtual').length > 0;
  const isHttp = isHttpCategory(crumb);
  const isNav = isNavigationCategory(crumb);
  const isSql = isSqlMessage(crumb.message);

  const handleCopyCrumb = (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = JSON.stringify(crumb, null, 2);
    navigator.clipboard.writeText(text).catch(() => {});
  };

  return (
    <Box sx={{
      mt: 0.5, p: 1, borderRadius: '6px',
      backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.02)',
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
      position: 'relative',
    }}>
      {/* Copy button */}
      <Tooltip title="Copy breadcrumb">
        <IconButton
          size="small"
          onClick={handleCopyCrumb}
          sx={{ position: 'absolute', top: 4, right: 4, p: 0.3, opacity: 0.5, '&:hover': { opacity: 1 } }}
        >
          <CopyIcon sx={{ fontSize: 12 }} />
        </IconButton>
      </Tooltip>

      {/* Category-specific rendering */}
      {isHttp && hasData ? (
        <HttpDetailPanel crumb={crumb} isDark={isDark} />
      ) : isNav ? (
        <NavigationDetailPanel crumb={crumb} isDark={isDark} />
      ) : isSql && crumb.message ? (
        <Box>
          <SqlHighlighted sql={crumb.message} isDark={isDark} />
          {hasData && (
            <Box sx={{ mt: 0.5 }}>
              {Object.entries(crumb.data!).filter(([k]) => k !== '_virtual').map(([k, v]) => (
                <DataNode key={k} keyName={k} value={v} depth={0} isDark={isDark} defaultExpanded={fullyExpanded} />
              ))}
            </Box>
          )}
        </Box>
      ) : hasData ? (
        <Box>
          {Object.entries(crumb.data!).filter(([k]) => k !== '_virtual').map(([k, v]) => (
            <DataNode key={k} keyName={k} value={v} depth={0} isDark={isDark} defaultExpanded={fullyExpanded} />
          ))}
        </Box>
      ) : null}
    </Box>
  );
};

export default BreadcrumbExpandedDetail;
