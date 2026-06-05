import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Box, Typography, IconButton, Tabs, Tab, Divider, Collapse, Button,
  useTheme, alpha, Chip, CircularProgress,
} from '@mui/material';
import {
  Close as CloseIcon,
  KeyboardArrowUp as PrevIcon,
  KeyboardArrowDown as NextIcon,
  ContentCopy as CopyIcon,
  FilterList as FilterIcon,
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon,
  Block as ExcludeIcon,
  Timeline as TraceIcon,
  Share as ShareIcon,
  OpenInNew as OpenIcon,
} from '@mui/icons-material';
import SafeTooltip from '@/components/common/SafeTooltip';
import { CopyButton } from '@/components/common/CopyButton';
import { ArgusLogEntry } from '@/services/argusService';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { formatWith } from '@/utils/dateFormat';
import argusService, { ArgusTraceDetail } from '@/services/argusService';
import TraceWaterfall from '@/components/argus/TraceWaterfall';
import { useOrgProject } from '@/contexts/OrgProjectContext';

/* ─── Constants ─── */

const SEVERITY_COLORS: Record<string, string> = {
  fatal: '#d32f2f', error: '#f44336', warn: '#ff9800', warning: '#ff9800',
  info: '#2196f3', debug: '#9e9e9e', trace: '#607d8b',
};



/* ─── Types ─── */

interface LogSidePanelProps {
  log: ArgusLogEntry | null;
  open: boolean;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onFilter: (key: string, value: string, exclude: boolean) => void;
  hasPrev: boolean;
  hasNext: boolean;
  /** Panel width in px, controlled by parent splitter */
  width?: number;
}

/* ─── Attribute Row ─── */

const AttrRow: React.FC<{
  label: string;
  value: string;
  isDark: boolean;
  color?: string;
  bold?: boolean;
  onFilter?: (key: string, value: string, exclude: boolean) => void;
}> = ({ label, value, isDark, color, bold, onFilter }) => {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <Box sx={{
      display: 'flex', gap: 2, py: 0.6, px: 2,
      borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
      alignItems: 'flex-start',
      '&:hover .attr-actions': { opacity: 1 },
      '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.01)' },
    }}>
      <Typography sx={{
        fontSize: '0.7rem', color: 'text.disabled', minWidth: 120, flexShrink: 0,
        fontWeight: 500, pt: 0.15,
      }}>
        {label}
      </Typography>
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', minWidth: 0 }}>
        <Typography sx={{
          fontSize: '0.72rem', wordBreak: 'break-all', pt: 0.15,
          color: color || 'text.primary',
          fontWeight: bold ? 700 : 400,
          fontFamily: label === 'trace_id' || label === 'span_id' || label === 'log_id' ? 'monospace' : undefined,
        }}>
          {value || '—'}
        </Typography>
        <Box className="attr-actions" sx={{ opacity: 0, transition: 'opacity 0.15s', display: 'flex', gap: 0.3, flexShrink: 0, ml: 1 }}>
          <CopyButton text={value} size={12} sx={{ p: 0.2 }} />
          {onFilter && value && (
            <>
              <SafeTooltip title={t('argus.logs.panel.includeInFilter', 'Include in filter')}>
                <IconButton size="small" onClick={() => onFilter(label, value, false)} sx={{ p: 0.2, color: theme.palette.primary.main }}>
                  <FilterIcon sx={{ fontSize: 12 }} />
                </IconButton>
              </SafeTooltip>
              <SafeTooltip title={t('argus.logs.panel.excludeFromFilter', 'Exclude from filter')}>
                <IconButton size="small" onClick={() => onFilter(label, value, true)} sx={{ p: 0.2, color: theme.palette.error.main }}>
                  <ExcludeIcon sx={{ fontSize: 12 }} />
                </IconButton>
              </SafeTooltip>
            </>
          )}
        </Box>
      </Box>
    </Box>
  );
};

/* ─── Structured Attribute Tree ─── */

/**
 * Represents a node in a structured attribute tree.
 * Flat dot-separated keys (e.g. "service.name", "service.version") are grouped
 * into a hierarchical tree: service → { name: "...", version: "..." }.
 */
interface AttrTreeNode {
  /** The short segment name (e.g. "name" in "service.name") */
  key: string;
  /** Full dot-separated path used for filter operations (e.g. "service.name") */
  fullKey: string;
  /** Leaf value — undefined for group nodes */
  value?: string;
  /** Child nodes — empty array for leaf nodes */
  children: AttrTreeNode[];
}

/**
 * Build a tree from flat key-value pairs where keys use dot-separated paths.
 *
 * Example input:  { "service.name": "api", "service.version": "1.2", "host": "web-01" }
 * Example output: [
 *   { key: "service", children: [
 *       { key: "name", fullKey: "service.name", value: "api", children: [] },
 *       { key: "version", fullKey: "service.version", value: "1.2", children: [] },
 *   ]},
 *   { key: "host", fullKey: "host", value: "web-01", children: [] },
 * ]
 */
function buildAttrTree(entries: [string, string][]): AttrTreeNode[] {
  const root: AttrTreeNode[] = [];

  for (const [fullKey, value] of entries) {
    const parts = fullKey.split('.');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const segment = parts[i];
      const isLast = i === parts.length - 1;
      const partialKey = parts.slice(0, i + 1).join('.');

      let existing = current.find(n => n.key === segment);
      if (!existing) {
        existing = {
          key: segment,
          fullKey: partialKey,
          value: isLast ? value : undefined,
          children: [],
        };
        current.push(existing);
      } else if (isLast) {
        // This path segment already exists as a group — attach value
        existing.value = value;
        existing.fullKey = partialKey;
      }
      current = existing.children;
    }
  }

  return root;
}

/**
 * Recursive renderer for a structured attribute tree node.
 * Group nodes (those with children) are collapsible; leaf nodes show value + actions.
 */
const AttrTreeRenderer: React.FC<{
  nodes: AttrTreeNode[];
  depth: number;
  isDark: boolean;
  onFilter: (key: string, value: string, exclude: boolean) => void;
}> = ({ nodes, depth, isDark, onFilter }) => {
  const theme = useTheme();

  return (
    <>
      {nodes.map(node => {
        const isGroup = node.children.length > 0;
        if (isGroup) {
          return <TreeGroupNode key={node.fullKey} node={node} depth={depth} isDark={isDark} onFilter={onFilter} />;
        }
        // Leaf node — render as an attribute row with indentation
        return (
          <Box key={node.fullKey} sx={{ pl: depth * 1.5 }}>
            <AttrRow label={node.key} value={node.value || ''} isDark={isDark} onFilter={(_, v, ex) => onFilter(node.fullKey, v, ex)} />
          </Box>
        );
      })}
    </>
  );
};

/** Collapsible group node in the attribute tree */
const TreeGroupNode: React.FC<{
  node: AttrTreeNode;
  depth: number;
  isDark: boolean;
  onFilter: (key: string, value: string, exclude: boolean) => void;
}> = ({ node, depth, isDark, onFilter }) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(true);

  return (
    <Box>
      <Box
        onClick={() => setExpanded(e => !e)}
        sx={{
          display: 'flex', alignItems: 'center', gap: 0.5,
          pl: depth * 1.5 + 0.5, pr: 1.5, py: 0.5,
          cursor: 'pointer', userSelect: 'none',
          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}`,
          '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)' },
        }}
      >
        {expanded
          ? <ExpandMoreIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
          : <ChevronRightIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
        }
        <Typography sx={{
          fontSize: '0.7rem', fontWeight: 600, color: theme.palette.primary.main,
          opacity: 0.85,
        }}>
          {node.key}
        </Typography>
        <Typography sx={{ fontSize: '0.6rem', color: 'text.disabled', ml: 0.5 }}>
          ({node.children.length})
        </Typography>
        {/* If group node also has its own value, show it inline */}
        {node.value && (
          <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary', ml: 1, fontStyle: 'italic' }}>
            {node.value}
          </Typography>
        )}
      </Box>
      <Collapse in={expanded}>
        <AttrTreeRenderer nodes={node.children} depth={depth + 1} isDark={isDark} onFilter={onFilter} />
      </Collapse>
    </Box>
  );
};

/* ─── Event Tab Content ─── */

const EventTab: React.FC<{
  log: ArgusLogEntry;
  isDark: boolean;
  onFilter: (key: string, value: string, exclude: boolean) => void;
}> = ({ log, isDark, onFilter }) => {
  const theme = useTheme();
  const { t } = useTranslation();

  // Core attributes — always shown as flat rows at the top
  const coreAttrs: [string, string, string?, boolean?][] = [
    ['severity', log.level || '', SEVERITY_COLORS[log.level?.toLowerCase()] || undefined, true],
    ['timestamp', log.timestamp || ''],
    ['service', log.service || ''],
    ['environment', log.environment || ''],
    ['release', log.release || ''],
    ['logger_name', log.logger_name || ''],
    ['trace_id', log.trace_id || ''],
    ['span_id', log.span_id || ''],
    ['log_id', log.log_id || ''],
  ];

  // Custom attributes — built into a structured tree from dot-separated keys
  const attrTree = useMemo(() => {
    if (!log.attributes || typeof log.attributes !== 'object') return [];
    const entries: [string, string][] = Object.entries(log.attributes)
      .map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : String(v)]);
    return buildAttrTree(entries);
  }, [log.attributes]);

  return (
    <Box>
      {/* Full message */}
      <Box sx={{
        px: 2, py: 1.5,
        backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)',
        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
      }}>
        <Typography sx={{
          fontSize: '0.78rem', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          fontFamily: '"JetBrains Mono", "Fira Code", monospace',
          fontWeight: 400,
        }}>
          {log.message}
        </Typography>
        {log.body && log.body !== log.message && (
          <Typography sx={{
            fontSize: '0.72rem', lineHeight: 1.6, mt: 1, pt: 1,
            borderTop: `1px dashed ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
            whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'text.secondary',
          }}>
            {log.body}
          </Typography>
        )}
      </Box>

      {/* Core attributes section */}
      <Box sx={{ pt: 0.5 }}>
        <Typography sx={{ px: 2, pt: 1, pb: 0.5, fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'text.disabled' }}>
          {t('argus.logs.panel.coreAttributes', 'Core Attributes')}
        </Typography>
        {coreAttrs.map(([key, val, color, bold]) => (
          <AttrRow key={key} label={key} value={val} isDark={isDark} color={color} bold={Boolean(bold)} onFilter={onFilter} />
        ))}
      </Box>

      {/* Custom attributes — structured tree view */}
      {attrTree.length > 0 && (
        <Box sx={{ pt: 0.5 }}>
          <Typography sx={{ px: 2, pt: 1, pb: 0.5, fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'text.disabled' }}>
            {t('argus.logs.panel.customAttributes', 'Custom Attributes')}
          </Typography>
          <AttrTreeRenderer nodes={attrTree} depth={0} isDark={isDark} onFilter={onFilter} />
        </Box>
      )}
    </Box>
  );
};

/* ─── JSON Tab Content ─── */

const JsonTab: React.FC<{ log: ArgusLogEntry; isDark: boolean }> = ({ log, isDark }) => {
  const jsonStr = useMemo(() => JSON.stringify(log, null, 2), [log]);

  return (
    <Box sx={{ p: 2, overflow: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
        <CopyButton text={jsonStr} size={14} />
      </Box>
      <Box
        component="pre"
        sx={{
          fontSize: '0.7rem', lineHeight: 1.6,
          fontFamily: '"JetBrains Mono", "Fira Code", monospace',
          backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.03)',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          borderRadius: '8px', p: 2, m: 0,
          overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
        }}
      >
        {jsonStr}
      </Box>
    </Box>
  );
};

/* ─── Main Side Panel ─── */

const LogSidePanel: React.FC<LogSidePanelProps> = ({
  log, open, onClose, onPrev, onNext, onFilter, hasPrev, hasNext, width = 420,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isDark = theme.palette.mode === 'dark';
  const [tab, setTab] = useState(0);

  // Trace data fetching
  const { currentProject } = useOrgProject();
  const projectId = currentProject?.id || '1';
  const [traceData, setTraceData] = useState<ArgusTraceDetail | null>(null);
  const [traceLoading, setTraceLoading] = useState(false);
  const [traceFetchedFor, setTraceFetchedFor] = useState<string | null>(null);

  // Reset tab and trace when log changes
  useEffect(() => {
    setTab(0);
    setTraceData(null);
    setTraceFetchedFor(null);
  }, [log?.log_id]);

  // Keyboard navigation
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      // Ignore keyboard shortcuts when the user is typing in an input field
      const tag = (document.activeElement?.tagName || '').toLowerCase();
      const isEditable = tag === 'input' || tag === 'textarea' || (document.activeElement as HTMLElement)?.isContentEditable;

      if (e.key === 'Escape') { onClose(); return; }
      if (isEditable) return;  // Don't intercept j/k while typing

      if (e.key === 'ArrowUp' || e.key === 'k') { e.preventDefault(); onPrev(); }
      if (e.key === 'ArrowDown' || e.key === 'j') { e.preventDefault(); onNext(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose, onPrev, onNext]);

  // Auto-fetch trace data when Trace tab is selected
  useEffect(() => {
    if (tab === 2 && log?.trace_id && traceFetchedFor !== log.trace_id) {
      setTraceLoading(true);
      setTraceFetchedFor(log.trace_id);
      argusService.getTraceDetail(projectId, log.trace_id)
        .then(data => setTraceData(data))
        .catch(err => { console.error('Failed to fetch trace', err); setTraceData(null); })
        .finally(() => setTraceLoading(false));
    }
  }, [tab, log?.trace_id, projectId, traceFetchedFor]);

  if (!log) return null;

  const levelColor = SEVERITY_COLORS[log.level?.toLowerCase()] || '#9e9e9e';
  const formattedTime = formatWith(log.timestamp, 'YYYY-MM-DD HH:mm:ss.SSS');

  return (
    <Box
      sx={{
        width, flexShrink: 0,
        height: '100%', overflow: 'auto',
        backgroundColor: theme.palette.background.default,
        borderLeft: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
        display: open ? 'flex' : 'none',
        flexDirection: 'column',
        pl: 0.5,
      }}
    >
      {/* ── Header ── */}
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1,
        px: 2, py: 1,
        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'}`,
        backgroundColor: isDark ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.02)',
        flexShrink: 0,
      }}>
        {/* Severity badge */}
        <Chip
          label={log.level?.toUpperCase() || 'UNKNOWN'}
          size="small"
          sx={{
            height: 22, fontSize: '0.65rem', fontWeight: 800,
            backgroundColor: alpha(levelColor, 0.15),
            color: levelColor, border: `1px solid ${alpha(levelColor, 0.3)}`,
          }}
        />

        {/* Timestamp */}
        <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', fontFamily: 'monospace', flex: 1 }}>
          {formattedTime}
        </Typography>

        {/* Navigation */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
          <SafeTooltip title={t('argus.logs.panel.prevLog', 'Previous log (↑)')}>
            <span>
              <IconButton size="small" onClick={onPrev} disabled={!hasPrev} sx={{ p: 0.3 }}>
                <PrevIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </span>
          </SafeTooltip>
          <SafeTooltip title={t('argus.logs.panel.nextLog', 'Next log (↓)')}>
            <span>
              <IconButton size="small" onClick={onNext} disabled={!hasNext} sx={{ p: 0.3 }}>
                <NextIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </span>
          </SafeTooltip>
        </Box>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        {/* Actions */}
        {log.trace_id && (
          <SafeTooltip title={t('argus.logs.panel.viewTrace', 'View Trace')}>
            <IconButton
              size="small"
              onClick={() => navigate(`/argus/performance?trace=${log.trace_id}`, { state: { allowBack: true } })}
              sx={{ p: 0.3, color: theme.palette.primary.main }}
            >
              <TraceIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </SafeTooltip>
        )}

        <SafeTooltip title={t('argus.logs.panel.close', 'Close (Esc)')}>
          <IconButton size="small" onClick={onClose} sx={{ p: 0.3 }}>
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </SafeTooltip>
      </Box>

      {/* ── Service / Tags bar ── */}
      <Box sx={{
        display: 'flex', gap: 0.5, flexWrap: 'wrap', px: 2, py: 0.8,
        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
        backgroundColor: isDark ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.01)',
        flexShrink: 0,
      }}>
        {log.service && (
          <Chip label={log.service} size="small" variant="outlined"
            sx={{ height: 20, fontSize: '0.62rem', fontWeight: 600 }} />
        )}
        {log.environment && (
          <Chip label={log.environment} size="small" variant="outlined"
            sx={{ height: 20, fontSize: '0.62rem' }} />
        )}
        {log.release && (
          <Chip label={log.release} size="small" variant="outlined"
            sx={{ height: 20, fontSize: '0.62rem' }} />
        )}
      </Box>

      {/* ── Tabs ── */}
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{
          minHeight: 34, flexShrink: 0,
          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          '& .MuiTab-root': { minHeight: 34, py: 0, fontSize: '0.72rem', fontWeight: 600, textTransform: 'none' },
        }}
      >
        <Tab label={t('argus.logs.panel.eventTab', 'Event')} />
        <Tab label="JSON" />
        {log.trace_id && <Tab label={t('argus.logs.panel.traceTab', 'Trace')} />}
      </Tabs>

      {/* ── Tab content ── */}
      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        {tab === 0 && <EventTab log={log} isDark={isDark} onFilter={onFilter} />}
        {tab === 1 && <JsonTab log={log} isDark={isDark} />}
        {tab === 2 && log.trace_id && (
          <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Header with navigate button */}
            <Box sx={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              px: 2, py: 1, flexShrink: 0,
              borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <TraceIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', fontFamily: 'monospace' }}>
                  {log.trace_id.slice(0, 16)}...
                </Typography>
                <CopyButton text={log.trace_id} size={12} sx={{ p: 0.2 }} />
              </Box>
              <Button
                size="small"
                variant="outlined"
                startIcon={<OpenIcon sx={{ fontSize: 12 }} />}
                onClick={() => navigate(`/argus/performance?trace=${log.trace_id}`, { state: { allowBack: true } })}
                sx={{
                  textTransform: 'none', fontSize: '0.68rem', fontWeight: 600,
                  borderRadius: '6px', py: 0.25, px: 1,
                  borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
                }}
              >
                {t('argus.logs.panel.viewFullTrace', 'View full trace')}
              </Button>
            </Box>
            {/* Waterfall content */}
            <Box sx={{ flex: 1, overflow: 'auto', minHeight: 200 }}>
              {traceLoading ? (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 8 }}>
                  <CircularProgress size={24} />
                </Box>
              ) : traceData ? (
                <TraceWaterfall trace={traceData} isDark={isDark} />
              ) : (
                <Box sx={{ py: 6, textAlign: 'center' }}>
                  <TraceIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                  <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, mb: 0.5 }}>
                    {t('argus.logs.panel.traceNotFound', 'Trace not found')}
                  </Typography>
                  <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
                    {t('argus.logs.panel.traceNotFoundDesc', 'The trace data may have expired or is not available.')}
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default LogSidePanel;
