import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Chip,
  CircularProgress,
  alpha,
  useTheme,
  Tabs,
  Tab,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider as MuiDivider,
  Snackbar,
} from '@mui/material';
import {
  DeviceHub as DeviceIcon,
  Person as PersonIcon,
  Sell as TagIcon,
  FolderOpen as FolderIcon,
  Schedule as ScheduleIcon,
  Info as InfoIcon,
  Code as SdkIcon,
  Public as GeoIcon,
  Language as BrowserIcon,
  Computer as OsIcon,
  PhoneAndroid as PhoneIcon,
  Settings as SettingsIcon,
  Link as LinkIcon,
  DataObject as DataObjectIcon,
  MoreHoriz as MoreHorizIcon,
  BarChart as BarChartIcon,
  Search as SearchIcon,
  ContentCopy as CopyIcon,
  FindInPage as FindInPageIcon,
  ChatBubbleOutline as MessageIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { ArgusErrorEvent, ArgusTraceDetail } from '@/services/argusService';
import ContextCard from '@/components/argus/ContextCard';
import { getOpColor } from '@/components/argus/TraceWaterfall';
import BreadcrumbsTimeline from '@/components/argus/BreadcrumbsTimeline';
import JsonViewer from '@/components/common/JsonViewer';
import { ActionChip } from '@/components/common/ActionChip';
import CollapsibleSection from '@/components/argus/CollapsibleSection';
import { getBrowserIcon, getOsIcon, getDeviceIcon } from '@/utils/brandIcons';

// ── Context chips extraction ──────────────────────────────────────
interface ContextChip {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function extractContextChips(
  event: IssueContextSectionProps['highlightEvent']
): ContextChip[] {
  if (!event) return [];
  const chips: ContextChip[] = [];

  if (event.browser) {
    chips.push({
      icon: getBrowserIcon(event.browser, 16),
      label:
        event.browser +
        (event.browser_version ? ` ${event.browser_version}` : ''),
      value: 'browser',
    });
  }
  if (event.os) {
    chips.push({
      icon: getOsIcon(event.os, 16),
      label: event.os + (event.os_version ? ` ${event.os_version}` : ''),
      value: 'os',
    });
  }
  if (event.device && event.device !== 'Other') {
    chips.push({
      icon: getDeviceIcon(event.device, 16),
      label: event.device,
      value: 'device',
    });
  }

  return chips;
}

// ── Highlight key-value extraction ────────────────────────────────
/** Default highlight keys to show when user hasn't customized */
const DEFAULT_HIGHLIGHT_KEYS = [
  'handled',
  'level',
  'transaction',
  'url',
  'browser',
  'os',
  'environment',
  'release',
];

interface HighlightKV {
  key: string;
  value: string;
  isLink?: boolean;
}

function extractHighlightKVs(
  event: IssueContextSectionProps['event'],
  tags: Record<string, string>
): HighlightKV[] {
  const kvs: HighlightKV[] = [];
  const seen = new Set<string>();

  for (const hk of DEFAULT_HIGHLIGHT_KEYS) {
    // Check tags first
    if (tags[hk] !== undefined) {
      const v = String(tags[hk]);
      const isLink = v.startsWith('http://') || v.startsWith('https://');
      kvs.push({ key: hk, value: v, isLink });
      seen.add(hk);
      continue;
    }
    // Check top-level event fields
    const fieldMap: Record<string, string | undefined> = {
      level: event.level,
      transaction: event.transaction,
      environment: event.environment,
      release: event.release,
      browser: event.browser
        ? `${event.browser}${event.browser_version ? ` ${event.browser_version}` : ''}`
        : undefined,
      os: event.os
        ? `${event.os}${event.os_version ? ` ${event.os_version}` : ''}`
        : undefined,
    };
    if (fieldMap[hk]) {
      kvs.push({ key: hk, value: fieldMap[hk]!, isLink: false });
      seen.add(hk);
    }
  }

  // Also extract trace_id from contexts
  try {
    const ctx =
      typeof event.contexts === 'string'
        ? JSON.parse(event.contexts)
        : event.contexts;
    if (ctx?.trace?.trace_id && !seen.has('trace_id')) {
      kvs.push({ key: 'Trace ID', value: ctx.trace.trace_id, isLink: false });
    }
  } catch {
    /* ignore */
  }

  return kvs;
}

// ── Tag category classification ───────────────────────────────────

const APPLICATION_TAG_KEYS = new Set([
  'app',
  'app.name',
  'app.version',
  'release',
  'environment',
  'level',
  'handled',
  'mechanism',
  'sdk',
  'sdk.name',
  'sdk.version',
]);

const CLIENT_TAG_KEYS = new Set([
  'browser',
  'browser.name',
  'browser.version',
  'os',
  'os.name',
  'os.version',
  'os.rooted',
  'device',
  'device.family',
  'device.model',
  'device.brand',
  'url',
  'runtime',
  'runtime.name',
  'runtime.version',
]);

type TagCategory = 'all' | 'custom' | 'application' | 'client' | 'other';

const OTHER_TAG_KEYS = new Set([
  'team',
  'transaction',
  'user',
  'server_name',
  'logger',
  'site',
]);

function classifyTag(key: string): Exclude<TagCategory, 'all'> {
  const k = key.toLowerCase();
  if (APPLICATION_TAG_KEYS.has(k)) return 'application';
  if (CLIENT_TAG_KEYS.has(k)) return 'client';
  if (OTHER_TAG_KEYS.has(k)) return 'other';
  // Check prefix-based matching
  if (k.startsWith('app.') || k.startsWith('sdk.')) return 'application';
  if (
    k.startsWith('browser.') ||
    k.startsWith('os.') ||
    k.startsWith('device.') ||
    k.startsWith('runtime.')
  )
    return 'client';
  return 'custom';
}

/** Group dot-separated keys like app.name into nested groups */
function groupTags(tags: Record<string, any>): {
  key: string;
  value?: string;
  children?: { key: string; value: string }[];
}[] {
  const groups: Map<
    string,
    { value?: string; children: { key: string; value: string }[] }
  > = new Map();

  for (const [k, v] of Object.entries(tags)) {
    const dotIdx = k.indexOf('.');
    if (dotIdx > 0) {
      const parent = k.substring(0, dotIdx);
      const child = k.substring(dotIdx + 1);
      if (!groups.has(parent)) groups.set(parent, { children: [] });
      groups.get(parent)!.children.push({ key: child, value: String(v) });
    } else {
      // Could also be a parent if there are dotted children
      if (!groups.has(k)) groups.set(k, { children: [] });
      groups.get(k)!.value = String(v);
    }
  }

  const result: {
    key: string;
    value?: string;
    children?: { key: string; value: string }[];
  }[] = [];
  for (const [key, group] of groups) {
    if (group.children.length > 0) {
      result.push({ key, value: group.value, children: group.children });
    } else if (group.value !== undefined) {
      result.push({ key, value: group.value });
    }
  }
  return result;
}

// ── Context icon mapping ──────────────────────────────────────────

function getContextIcon(ctxKey: string): React.ReactNode {
  const k = ctxKey.toLowerCase();
  if (k === 'user') return <PersonIcon />;
  if (k === 'browser') return <BrowserIcon />;
  if (k === 'os' || k === 'operating system') return <OsIcon />;
  if (k === 'device') return <PhoneIcon />;
  if (k === 'trace' || k.includes('trace')) return <LinkIcon />;
  if (k === 'culture' || k === 'geo') return <GeoIcon />;
  if (k === 'runtime' || k === 'react' || k === 'sdk') return <SdkIcon />;
  if (k.includes('settings') || k.includes('설정') || k.includes('config'))
    return <SettingsIcon />;
  return <InfoIcon />;
}

// ── Component ──────────────────────────────────────────────────────

export interface IssueContextSectionProps {
  event: ArgusErrorEvent;
  /** Event data used for highlight tags (browser/os/device pills) */
  highlightEvent?: {
    browser?: string;
    browser_version?: string;
    os?: string;
    os_version?: string;
    device?: string;
    environment?: string;
    release?: string;
    user_ip?: string;
    platform?: string;
    tags?: Record<string, string>;
    contexts?: string | Record<string, any>;
  } | null;
  traceId: string | null;
  traceDetail: ArgusTraceDetail | null;
  loadingTrace: boolean;
  isDark: boolean;
  /** Slot for stacktrace section, rendered between Highlights and Tags */
  stacktraceSlot?: React.ReactNode;
}

const IssueContextSection: React.FC<IssueContextSectionProps> = ({
  event,
  highlightEvent,
  traceId,
  traceDetail,
  loadingTrace,
  isDark,
  stacktraceSlot,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Parse tags safely
  const parsedTags = React.useMemo(() => {
    try {
      return typeof event.tags === 'string'
        ? JSON.parse(event.tags)
        : event.tags || {};
    } catch {
      return {};
    }
  }, [event.tags]);

  // Parse extra data safely
  const extraData = React.useMemo(() => {
    if (!event.extra) return null;
    try {
      const d =
        typeof event.extra === 'string' ? JSON.parse(event.extra) : event.extra;
      return d && Object.keys(d).length > 0 ? d : null;
    } catch {
      return null;
    }
  }, [event.extra]);

  // Parse contexts safely
  const ctxData = React.useMemo(() => {
    if (!event.contexts) return null;
    try {
      const d =
        typeof event.contexts === 'string'
          ? JSON.parse(event.contexts)
          : event.contexts;
      return d && Object.keys(d).length > 0 ? d : null;
    } catch {
      return null;
    }
  }, [event.contexts]);

  // Parse breadcrumbs
  const breadcrumbsArr = React.useMemo(() => {
    if (!event.breadcrumbs) return [];
    try {
      const arr =
        typeof event.breadcrumbs === 'string'
          ? JSON.parse(event.breadcrumbs)
          : event.breadcrumbs;
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }, [event.breadcrumbs]);

  // Context chips (top bar)
  const contextChips = React.useMemo(
    () => extractContextChips(highlightEvent),
    [highlightEvent]
  );

  // Highlight key-value pairs (Sentry-style table)
  const highlightKVs = React.useMemo(
    () => extractHighlightKVs(event, parsedTags),
    [event, parsedTags]
  );

  const tagCount = Object.keys(parsedTags).length;

  // Tag category tab state
  const [tagCategory, setTagCategory] = React.useState<TagCategory>('all');

  // Categorized and grouped tags
  const filteredGroupedTags = React.useMemo(() => {
    const filtered: Record<string, any> = {};
    for (const [k, v] of Object.entries(parsedTags)) {
      if (tagCategory === 'all' || classifyTag(k) === tagCategory) {
        filtered[k] = v;
      }
    }
    return groupTags(filtered);
  }, [parsedTags, tagCategory]);

  // Count tags per category for badge display
  const categoryCounts = React.useMemo(() => {
    const counts = { all: 0, custom: 0, application: 0, client: 0, other: 0 };
    for (const k of Object.keys(parsedTags)) {
      counts.all++;
      counts[classifyTag(k)]++;
    }
    return counts;
  }, [parsedTags]);

  // Build context cards from ctxData and event top-level fields
  const contextCards = React.useMemo(() => {
    const cards: {
      key: string;
      title: string;
      icon: React.ReactNode;
      items: { label: string; value: string; isLink?: boolean }[];
    }[] = [];

    // 1. User card from top-level event fields
    const userItems: { label: string; value: string }[] = [];
    if (event.user_email)
      userItems.push({ label: 'Email', value: event.user_email });
    if (event.user_ip) userItems.push({ label: 'IP', value: event.user_ip });
    if (userItems.length > 0) {
      cards.push({
        key: 'user_toplevel',
        title: t('argus.issues.user', 'User'),
        icon: <PersonIcon />,
        items: userItems,
      });
    }

    // 2. Cards from ctxData
    if (ctxData) {
      for (const [ctxKey, ctxVal] of Object.entries(ctxData) as [
        string,
        any,
      ][]) {
        if (typeof ctxVal === 'object' && ctxVal !== null) {
          // Merge with user_toplevel if key is 'user'
          if (ctxKey.toLowerCase() === 'user') {
            const existing = cards.find((c) => c.key === 'user_toplevel');
            const items = Object.entries(ctxVal).map(([k, v]) => ({
              label: k,
              value: String(v),
            }));
            if (existing) {
              // Add items that don't already exist
              const existingLabels = new Set(
                existing.items.map((i) => i.label.toLowerCase())
              );
              for (const item of items) {
                if (!existingLabels.has(item.label.toLowerCase())) {
                  existing.items.push(item);
                }
              }
            } else {
              cards.push({
                key: ctxKey,
                title: ctxKey,
                icon: getContextIcon(ctxKey),
                items,
              });
            }
            continue;
          }
          const items = Object.entries(ctxVal).map(([k, v]) => {
            const sv = String(v);
            const isLink =
              sv.startsWith('http://') || sv.startsWith('https://');
            return { label: k, value: sv, isLink };
          });
          if (items.length > 0) {
            cards.push({
              key: ctxKey,
              title: ctxKey,
              icon: getContextIcon(ctxKey),
              items,
            });
          }
        }
      }
    }

    // 3. Environment card from top-level fields (if not already in ctxData)
    const hasEnvCtx = cards.some(
      (c) => c.key === 'environment' || c.key === 'runtime'
    );
    if (!hasEnvCtx) {
      const envItems: { label: string; value: string }[] = [];
      if (event.environment)
        envItems.push({
          label: t('argus.issues.environment', 'Environment'),
          value: event.environment,
        });
      if (event.release)
        envItems.push({
          label: t('argus.issues.release', 'Release'),
          value: event.release,
        });
      if (event.transaction)
        envItems.push({
          label: t('argus.issues.transaction', 'Transaction'),
          value: event.transaction,
        });
      if (envItems.length > 0) {
        cards.push({
          key: 'env_toplevel',
          title: t('argus.issues.environment', 'Environment'),
          icon: <SettingsIcon />,
          items: envItems,
        });
      }
    }

    return cards;
  }, [event, ctxData, t]);

  // ── Tag context menu state ──
  const [tagMenuAnchor, setTagMenuAnchor] = React.useState<HTMLElement | null>(
    null
  );
  const [tagMenuTarget, setTagMenuTarget] = React.useState({
    key: '',
    value: '',
  });
  const [copySnackOpen, setCopySnackOpen] = React.useState(false);

  const handleTagMenuOpen = (
    e: React.MouseEvent<HTMLElement>,
    key: string,
    value: string
  ) => {
    setTagMenuAnchor(e.currentTarget);
    setTagMenuTarget({ key, value });
  };
  const handleTagMenuClose = () => {
    setTagMenuAnchor(null);
  };

  return (
    <>
      {/* ═══ Context chips bar ═══ */}
      {contextChips.length > 0 && (
        <Box
          sx={{
            display: 'flex',
            gap: 1,
            flexWrap: 'wrap',
            py: 1,
            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          }}
        >
          {/* User chip */}
          {event.user_email && (
            <Chip
              size="small"
              icon={<PersonIcon sx={{ fontSize: 14 }} />}
              label={event.user_email}
              sx={{
                height: 24,
                fontSize: '0.72rem',
                fontWeight: 600,
                backgroundColor: isDark
                  ? 'rgba(255,255,255,0.06)'
                  : 'rgba(0,0,0,0.05)',
                color: 'text.primary',
                '& .MuiChip-icon': { color: 'text.secondary' },
              }}
            />
          )}
          {contextChips.map((c) => (
            <Chip
              key={c.value}
              size="small"
              icon={
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    '& img, & svg': { width: 14, height: 14 },
                  }}
                >
                  {c.icon}
                </Box>
              }
              label={c.label}
              sx={{
                height: 24,
                fontSize: '0.72rem',
                fontWeight: 600,
                backgroundColor: isDark
                  ? 'rgba(255,255,255,0.06)'
                  : 'rgba(0,0,0,0.05)',
                color: 'text.primary',
                '& .MuiChip-icon': { color: 'text.secondary' },
              }}
            />
          ))}
          {/* Release chip */}
          {event.release && (
            <Chip
              size="small"
              label={`🏷 ${event.release}`}
              sx={{
                height: 24,
                fontSize: '0.72rem',
                fontWeight: 600,
                backgroundColor: isDark
                  ? 'rgba(255,255,255,0.06)'
                  : 'rgba(0,0,0,0.05)',
                color: 'text.primary',
              }}
            />
          )}
          {/* Environment chip */}
          {event.environment && (
            <Chip
              size="small"
              label={`🌐 ${event.environment}`}
              sx={{
                height: 24,
                fontSize: '0.72rem',
                fontWeight: 600,
                backgroundColor: isDark
                  ? 'rgba(255,255,255,0.06)'
                  : 'rgba(0,0,0,0.05)',
                color: 'text.primary',
              }}
            />
          )}
        </Box>
      )}

      {/* ═══ Highlights (Sentry-style key-value table) ═══ */}
      <CollapsibleSection
        title={t('argus.issues.highlights', 'Highlights')}
        icon={
          <TagIcon fontSize="small" sx={{ color: theme.palette.info.main }} />
        }
        storageKey="highlights"
        hideActionsOnCollapse
        hidden={highlightKVs.length === 0}
        actions={
          <IconButton
            size="small"
            title={t('argus.issues.editHighlights', 'Edit')}
            sx={{
              fontSize: '0.7rem',
              color: 'text.secondary',
              borderRadius: 1,
              px: 1,
              py: 0.3,
              '&:hover': {
                backgroundColor: isDark
                  ? 'rgba(255,255,255,0.06)'
                  : 'rgba(0,0,0,0.04)',
              },
            }}
          >
            <EditIcon sx={{ fontSize: 14, mr: 0.5 }} />
            <Typography
              component="span"
              sx={{ fontSize: '0.7rem', fontWeight: 600 }}
            >
              {t('argus.issues.editHighlights', 'Edit')}
            </Typography>
          </IconButton>
        }
      >
        {(() => {
          const leftCol = highlightKVs.filter((_, i) => i % 2 === 0);
          const rightCol = highlightKVs.filter((_, i) => i % 2 === 1);
          const borderColor = isDark
            ? 'rgba(255,255,255,0.06)'
            : 'rgba(0,0,0,0.06)';
          const dividerColor = isDark
            ? 'rgba(255,255,255,0.04)'
            : 'rgba(0,0,0,0.04)';
          const stripeBg = isDark
            ? 'rgba(255,255,255,0.02)'
            : 'rgba(0,0,0,0.015)';

          const renderColumn = (items: typeof highlightKVs) => (
            <Box
              sx={{
                flex: 1,
                minWidth: 0,
                borderRadius: 1.5,
                overflow: 'hidden',
                border: `1px solid ${borderColor}`,
              }}
            >
              {items.map((kv, j) => (
                <Box
                  key={kv.key}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    px: 1.5,
                    py: 0.8,
                    backgroundColor: j % 2 === 0 ? stripeBg : 'transparent',
                    borderBottom:
                      j < items.length - 1
                        ? `1px solid ${dividerColor}`
                        : 'none',
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: '0.75rem',
                      color: 'text.secondary',
                      fontWeight: 500,
                      minWidth: 80,
                      flexShrink: 0,
                      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                    }}
                  >
                    {kv.key}
                  </Typography>
                  <Typography
                    component={kv.isLink ? 'a' : 'span'}
                    {...(kv.isLink
                      ? {
                          href: kv.value,
                          target: '_blank',
                          rel: 'noopener noreferrer',
                        }
                      : {})}
                    sx={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: kv.isLink
                        ? theme.palette.info.main
                        : 'text.primary',
                      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      textDecoration: 'none',
                      '&:hover': kv.isLink
                        ? { textDecoration: 'underline' }
                        : {},
                    }}
                  >
                    {kv.value}
                  </Typography>
                </Box>
              ))}
            </Box>
          );

          return (
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              {renderColumn(leftCol)}
              {rightCol.length > 0 && renderColumn(rightCol)}
            </Box>
          );
        })()}
      </CollapsibleSection>

      {/* ═══ Message ═══ */}
      {event.message && (
        <CollapsibleSection
          title={t('argus.issues.message', 'Message')}
          icon={
            <MessageIcon
              fontSize="small"
              sx={{ color: theme.palette.info.main }}
            />
          }
          storageKey="message"
        >
          <Typography
            sx={{
              fontSize: '0.82rem',
              color: 'text.primary',
              lineHeight: 1.6,
              px: 1.5,
              py: 1,
              borderRadius: 1.5,
              backgroundColor: isDark
                ? 'rgba(255,255,255,0.03)'
                : 'rgba(0,0,0,0.02)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
              fontFamily: 'inherit',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {event.message}
          </Typography>
        </CollapsibleSection>
      )}

      {/* ═══ Stacktrace (injected from parent) ═══ */}
      {stacktraceSlot}

      {/* ═══ Tags (Category Tabs + Key-Value Table) ═══ */}
      <CollapsibleSection
        title={t('argus.issues.tags', 'Tags')}
        icon={
          <TagIcon fontSize="small" sx={{ color: theme.palette.info.main }} />
        }
        badge={
          tagCount > 0 ? (
            <Chip
              label={tagCount}
              size="small"
              sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700, ml: 0.5 }}
            />
          ) : undefined
        }
        storageKey="tags"
        hideActionsOnCollapse
        hidden={tagCount === 0}
        actions={
          <Tabs
            value={tagCategory}
            onChange={(_, v) => setTagCategory(v)}
            variant="scrollable"
            scrollButtons={false}
            sx={{
              minHeight: 0,
              '& .MuiTab-root': {
                minHeight: 0,
                minWidth: 'auto',
                px: 1,
                py: 0.3,
                fontSize: '0.65rem',
                fontWeight: 600,
                textTransform: 'none',
                borderRadius: '6px',
                color: 'text.secondary',
                '&.Mui-selected': {
                  color: theme.palette.primary.main,
                  backgroundColor: alpha(
                    theme.palette.primary.main,
                    isDark ? 0.1 : 0.06
                  ),
                },
              },
              '& .MuiTabs-indicator': { display: 'none' },
            }}
          >
            {(
              [
                'all',
                'custom',
                'application',
                'client',
                'other',
              ] as TagCategory[]
            ).map(
              (cat) =>
                categoryCounts[cat] > 0 && (
                  <Tab
                    key={cat}
                    value={cat}
                    label={t(
                      `argus.issues.tagCategory.${cat}`,
                      cat.charAt(0).toUpperCase() + cat.slice(1)
                    )}
                  />
                )
            )}
          </Tabs>
        }
      >
        {/* 2-column key-value table */}
        {(() => {
          // Flatten groups into rows for consistent rendering
          type TagRow = {
            key: string;
            value: string;
            isChild: boolean;
            parentKey?: string;
            fullKey: string;
          };
          const groups: TagRow[][] = [];
          for (const group of filteredGroupedTags) {
            const block: TagRow[] = [];
            block.push({
              key: group.key,
              value: group.value || '',
              isChild: false,
              fullKey: group.key,
            });
            if (group.children) {
              for (const child of group.children) {
                block.push({
                  key: child.key,
                  value: child.value,
                  isChild: true,
                  parentKey: group.key,
                  fullKey: `${group.key}.${child.key}`,
                });
              }
            }
            groups.push(block);
          }
          // Split groups into 2 columns by total row count, keeping each group intact
          const totalRows = groups.reduce((sum, g) => sum + g.length, 0);
          const halfTarget = Math.ceil(totalRows / 2);
          let leftCount = 0;
          let splitIdx = groups.length;
          for (let gi = 0; gi < groups.length; gi++) {
            leftCount += groups[gi].length;
            if (leftCount >= halfTarget) {
              splitIdx = gi + 1;
              break;
            }
          }
          const leftRows = groups.slice(0, splitIdx).flat();
          const rightRows = groups.slice(splitIdx).flat();
          const borderColor = isDark
            ? 'rgba(255,255,255,0.06)'
            : 'rgba(0,0,0,0.06)';
          const dividerColor = isDark
            ? 'rgba(255,255,255,0.04)'
            : 'rgba(0,0,0,0.04)';

          const renderTagColumn = (col: typeof rows) => (
            <Box
              sx={{
                flex: 1,
                minWidth: 0,
                borderRadius: 1.5,
                overflow: 'hidden',
                border: `1px solid ${borderColor}`,
              }}
            >
              {col.map((row, rowIdx) => (
                <Box
                  key={`${row.parentKey || ''}-${row.key}-${rowIdx}`}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: '140px 1fr auto',
                    borderBottom:
                      rowIdx < col.length - 1
                        ? `1px solid ${dividerColor}`
                        : 'none',
                    backgroundColor:
                      rowIdx % 2 === 0
                        ? 'transparent'
                        : isDark
                          ? 'rgba(255,255,255,0.015)'
                          : 'rgba(0,0,0,0.015)',
                    '&:hover': {
                      backgroundColor: isDark
                        ? 'rgba(255,255,255,0.04)'
                        : 'rgba(0,0,0,0.03)',
                    },
                    '&:hover .tag-menu-btn': {
                      opacity: 1,
                    },
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: row.isChild ? '0.72rem' : '0.75rem',
                      fontWeight: row.isChild ? 400 : 600,
                      color: row.isChild ? 'text.disabled' : 'text.secondary',
                      py: 0.6,
                      px: 1.2,
                      pl: row.isChild ? 3 : 1.2,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      fontFamily: 'monospace',
                    }}
                  >
                    {row.key}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: row.isChild ? '0.72rem' : '0.75rem',
                      fontWeight: 600,
                      color: row.value.startsWith('http')
                        ? theme.palette.info.main
                        : row.value
                          ? 'text.primary'
                          : 'text.disabled',
                      py: 0.6,
                      px: 1.2,
                      wordBreak: 'break-all',
                      fontFamily: 'monospace',
                    }}
                  >
                    {row.value}
                  </Typography>
                  {/* ··· menu button (visible on hover) */}
                  {row.value && (
                    <IconButton
                      className="tag-menu-btn"
                      size="small"
                      onClick={(e) =>
                        handleTagMenuOpen(e, row.fullKey, row.value)
                      }
                      sx={{
                        opacity: 0,
                        transition: 'opacity 0.15s',
                        alignSelf: 'center',
                        width: 22,
                        height: 22,
                        mr: 0.5,
                      }}
                    >
                      <MoreHorizIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  )}
                </Box>
              ))}
            </Box>
          );

          return (
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              {renderTagColumn(leftRows)}
              {rightRows.length > 0 && renderTagColumn(rightRows)}
            </Box>
          );
        })()}

        {/* Tag context menu */}
        <Menu
          anchorEl={tagMenuAnchor}
          open={Boolean(tagMenuAnchor)}
          onClose={handleTagMenuClose}
          slotProps={{
            paper: {
              sx: {
                minWidth: 220,
                borderRadius: 2,
                '& .MuiMenuItem-root': {
                  fontSize: '0.78rem',
                  py: 0.8,
                },
              },
            },
          }}
        >
          <MenuItem
            onClick={() => {
              handleTagMenuClose();
              document
                .getElementById('argus-tag-distribution')
                ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
          >
            <ListItemIcon>
              <BarChartIcon sx={{ fontSize: 16 }} />
            </ListItemIcon>
            <ListItemText>
              {t('argus.issues.tagMenu.breakdown', 'Tag breakdown')}
            </ListItemText>
          </MenuItem>
          <MenuItem
            onClick={() => {
              handleTagMenuClose();
              navigate(
                `/argus/explore/discover?q=${encodeURIComponent(`${tagMenuTarget.key}:"${tagMenuTarget.value}"`)}`
              );
            }}
          >
            <ListItemIcon>
              <SearchIcon sx={{ fontSize: 16 }} />
            </ListItemIcon>
            <ListItemText>
              {t(
                'argus.issues.tagMenu.viewEvents',
                'View events with this value'
              )}
            </ListItemText>
          </MenuItem>
          <MenuItem
            onClick={() => {
              handleTagMenuClose();
              navigate(
                `/argus/issues?search=${encodeURIComponent(`${tagMenuTarget.key}:${tagMenuTarget.value}`)}`
              );
            }}
          >
            <ListItemIcon>
              <FindInPageIcon sx={{ fontSize: 16 }} />
            </ListItemIcon>
            <ListItemText>
              {t(
                'argus.issues.tagMenu.searchIssues',
                'Search issues with this value'
              )}
            </ListItemText>
          </MenuItem>
          <MuiDivider />
          <MenuItem
            onClick={() => {
              navigator.clipboard.writeText(tagMenuTarget.value);
              setCopySnackOpen(true);
              handleTagMenuClose();
            }}
          >
            <ListItemIcon>
              <CopyIcon sx={{ fontSize: 16 }} />
            </ListItemIcon>
            <ListItemText>
              {t('argus.issues.tagMenu.copyValue', 'Copy tag value')}
            </ListItemText>
          </MenuItem>
        </Menu>

        {/* Copy snackbar */}
        <Snackbar
          open={copySnackOpen}
          autoHideDuration={2000}
          onClose={() => setCopySnackOpen(false)}
          message={t('argus.issues.tagMenu.copied', 'Copied!')}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        />
      </CollapsibleSection>

      {/* ═══ Breadcrumbs ═══ */}
      <CollapsibleSection
        title={t('argus.issues.breadcrumbs', 'Breadcrumbs')}
        icon={
          <FolderIcon
            fontSize="small"
            sx={{ color: theme.palette.warning.main }}
          />
        }
        badge={
          breadcrumbsArr.length > 0 ? (
            <Chip
              label={breadcrumbsArr.length}
              size="small"
              sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700, ml: 0.5 }}
            />
          ) : undefined
        }
        storageKey="breadcrumbs"
        hidden={breadcrumbsArr.length === 0}
      >
        <BreadcrumbsTimeline
          breadcrumbs={breadcrumbsArr}
          summaryMode
          summaryCount={5}
          errorEvent={{
            type: event.exception_type,
            value: event.exception_value,
            timestamp: event.timestamp,
          }}
        />
      </CollapsibleSection>

      {/* ═══ Contexts (unified card grid) ═══ */}
      <CollapsibleSection
        title={t('argus.issues.contexts', 'Contexts')}
        icon={
          <DeviceIcon
            fontSize="small"
            sx={{ color: theme.palette.primary.main }}
          />
        }
        storageKey="contexts"
        hidden={contextCards.length === 0}
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
            gap: 1.5,
          }}
        >
          {contextCards.map((card) => (
            <ContextCard
              key={card.key}
              title={card.title}
              icon={card.icon}
              items={card.items}
              isDark={isDark}
            />
          ))}
        </Box>
      </CollapsibleSection>

      {/* ═══ Transaction Trace ═══ */}
      {traceId && traceDetail && traceDetail.spans.length > 0 && (
        <CollapsibleSection
          title={t('argus.issues.transactionTrace', 'Transaction Trace')}
          icon={
            <ScheduleIcon
              fontSize="small"
              sx={{ color: theme.palette.success.main }}
            />
          }
          storageKey="trace"
          actions={
            traceDetail && traceDetail.spans.length > 0 ? (
              <ActionChip
                label={t('argus.issues.viewFullTrace', 'View Full Trace')}
                onClick={() =>
                  navigate(`/argus/explore/traces?q=trace_id:"${traceId}"`)
                }
              />
            ) : undefined
          }
        >
          {loadingTrace ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress size={20} />
            </Box>
          ) : traceDetail && traceDetail.spans.length > 0 ? (
            <Box>
              {/* Compact span preview (up to 5) */}
              {traceDetail.spans.slice(0, 5).map((span, idx) => {
                const opColor = getOpColor(span.op);
                const durStr =
                  span.duration >= 1000
                    ? `${(span.duration / 1000).toFixed(2)}s`
                    : `${Math.round(span.duration)}ms`;
                return (
                  <Box
                    key={span.span_id || idx}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      py: 0.6,
                      px: 0.5,
                      borderBottom:
                        idx < Math.min(traceDetail.spans.length, 5) - 1
                          ? `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`
                          : 'none',
                    }}
                  >
                    <Chip
                      label={span.op}
                      size="small"
                      sx={{
                        height: 18,
                        fontSize: '0.62rem',
                        fontWeight: 700,
                        backgroundColor: alpha(opColor, 0.1),
                        color: opColor,
                        border: 'none',
                        flexShrink: 0,
                      }}
                    />
                    <Typography
                      sx={{
                        fontSize: '0.76rem',
                        color: 'text.primary',
                        flex: 1,
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {span.description || span.op}
                    </Typography>
                    {span.status &&
                      span.status !== 'ok' &&
                      span.status !== 'unknown' && (
                        <Chip
                          label={span.status}
                          size="small"
                          sx={{
                            height: 16,
                            fontSize: '0.58rem',
                            fontWeight: 700,
                            backgroundColor: alpha('#f44336', 0.1),
                            color: '#f44336',
                            border: 'none',
                            flexShrink: 0,
                          }}
                        />
                      )}
                    <Typography
                      sx={{
                        fontSize: '0.7rem',
                        color: 'text.secondary',
                        fontWeight: 500,
                        flexShrink: 0,
                        fontFamily: 'monospace',
                      }}
                    >
                      {durStr}
                    </Typography>
                  </Box>
                );
              })}
              {/* +N more indicator */}
              {traceDetail.spans.length > 5 && (
                <Typography
                  sx={{
                    fontSize: '0.72rem',
                    color: 'text.disabled',
                    pt: 0.8,
                    pl: 0.5,
                    fontWeight: 500,
                  }}
                >
                  +{traceDetail.spans.length - 5}{' '}
                  {t('argus.issues.moreSpans', 'more spans')}
                </Typography>
              )}
            </Box>
          ) : (
            <Typography
              variant="body2"
              color="text.disabled"
              sx={{ fontSize: '0.78rem' }}
            >
              {t('argus.issues.noTraceData', 'No trace data available.')}
            </Typography>
          )}
        </CollapsibleSection>
      )}

      {/* ═══ Extra Data ═══ */}
      <CollapsibleSection
        title={t('argus.issues.extraData', 'Additional Data')}
        icon={<DataObjectIcon fontSize="small" sx={{ color: '#ff9800' }} />}
        storageKey="extra"
        hidden={!extraData}
      >
        {extraData && <JsonViewer data={extraData} isDark={isDark} />}
      </CollapsibleSection>

      {/* (Contexts section is now unified above — old separate section removed) */}
    </>
  );
};

export default React.memo(IssueContextSection);
