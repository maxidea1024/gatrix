import React, { useState, useMemo, useCallback, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import Prism from 'prismjs';
import 'prismjs/components/prism-sql';
import BreadcrumbExpandedDetail from './BreadcrumbExpandedDetail';
import {
  Box,
  Typography,
  Chip,
  TextField,
  InputAdornment,
  IconButton,
  useTheme,
  alpha,
  Tooltip,
  Collapse,
  Button,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Drawer,
  Divider,
  Snackbar,
  Alert,
} from '@mui/material';
import {
  Search as SearchIcon,
  Mouse as ClickIcon,
  Language as NavIcon,
  Http as HttpIcon,
  Terminal as ConsoleIcon,
  ErrorOutline as ErrorIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  Storage as QueryIcon,
  TouchApp as UIIcon,
  ExpandMore as ExpandMoreIcon,
  FilterList as FilterIcon,
  SwapVert as SortIcon,
  Schedule as TimeIcon,
  ContentCopy as CopyIcon,
  Code as CodeIcon,
  OpenInNew as ExternalLinkIcon,
  Close as CloseIcon,
  FiberManualRecord as DotIcon,
  Visibility as ViewAllIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

// ==================== Types ====================

export interface Breadcrumb {
  type?: string;
  category?: string;
  message?: string;
  data?: Record<string, any>;
  level?: string;
  timestamp?: string;
}

interface BreadcrumbsTimelineProps {
  breadcrumbs: Breadcrumb[];
  /** Summary mode: show only N items and a "View All" button */
  summaryMode?: boolean;
  /** Max items in summary mode */
  summaryCount?: number;
  /** Error event info for virtual crumb */
  errorEvent?: {
    type?: string;
    value?: string;
    timestamp?: string;
  };
  /** If true, all rows render expanded data by default (used in Drawer mode) */
  fullyExpanded?: boolean;
}

// ==================== Constants ====================

const SORT_KEY = 'argus-breadcrumb-sort';
const TIME_DISPLAY_KEY = 'argus-breadcrumb-time-display';

type SortOrder = 'newest' | 'oldest';
type TimeDisplay = 'absolute' | 'relative';

// ==================== Config ====================

const CATEGORY_CONFIG: Record<
  string,
  { icon: React.ReactElement; color: string; label: string }
> = {
  'ui.click': {
    icon: <ClickIcon sx={{ fontSize: 14 }} />,
    color: '#7c4dff',
    label: 'UI Click',
  },
  'ui.input': {
    icon: <UIIcon sx={{ fontSize: 14 }} />,
    color: '#7c4dff',
    label: 'UI Input',
  },
  navigation: {
    icon: <NavIcon sx={{ fontSize: 14 }} />,
    color: '#2196f3',
    label: 'Navigation',
  },
  http: {
    icon: <HttpIcon sx={{ fontSize: 14 }} />,
    color: '#00bcd4',
    label: 'HTTP',
  },
  fetch: {
    icon: <HttpIcon sx={{ fontSize: 14 }} />,
    color: '#00bcd4',
    label: 'Fetch',
  },
  xhr: {
    icon: <HttpIcon sx={{ fontSize: 14 }} />,
    color: '#00bcd4',
    label: 'XHR',
  },
  ws: {
    icon: <HttpIcon sx={{ fontSize: 14 }} />,
    color: '#26c6da',
    label: 'WebSocket',
  },
  console: {
    icon: <ConsoleIcon sx={{ fontSize: 14 }} />,
    color: '#ff9800',
    label: 'Console',
  },
  error: {
    icon: <ErrorIcon sx={{ fontSize: 14 }} />,
    color: '#f44336',
    label: 'Error',
  },
  warning: {
    icon: <WarningIcon sx={{ fontSize: 14 }} />,
    color: '#ff9800',
    label: 'Warning',
  },
  info: {
    icon: <InfoIcon sx={{ fontSize: 14 }} />,
    color: '#2196f3',
    label: 'Info',
  },
  query: {
    icon: <QueryIcon sx={{ fontSize: 14 }} />,
    color: '#4caf50',
    label: 'Query',
  },
  db: {
    icon: <QueryIcon sx={{ fontSize: 14 }} />,
    color: '#4caf50',
    label: 'DB',
  },
  debug: {
    icon: <ConsoleIcon sx={{ fontSize: 14 }} />,
    color: '#9e9e9e',
    label: 'Debug',
  },
  redis: {
    icon: <QueryIcon sx={{ fontSize: 14 }} />,
    color: '#d32f2f',
    label: 'Redis',
  },
  network: {
    icon: <NavIcon sx={{ fontSize: 14 }} />,
    color: '#42a5f5',
    label: 'Network',
  },
  anticheat: {
    icon: <ErrorIcon sx={{ fontSize: 14 }} />,
    color: '#e91e63',
    label: 'Anti-Cheat',
  },
  save: {
    icon: <QueryIcon sx={{ fontSize: 14 }} />,
    color: '#66bb6a',
    label: 'Save',
  },
  payment: {
    icon: <InfoIcon sx={{ fontSize: 14 }} />,
    color: '#ffa726',
    label: 'Payment',
  },
  chat: {
    icon: <ConsoleIcon sx={{ fontSize: 14 }} />,
    color: '#ab47bc',
    label: 'Chat',
  },
  matchmaking: {
    icon: <UIIcon sx={{ fontSize: 14 }} />,
    color: '#29b6f6',
    label: 'Matchmaking',
  },
  auth: {
    icon: <InfoIcon sx={{ fontSize: 14 }} />,
    color: '#78909c',
    label: 'Auth',
  },
  inventory: {
    icon: <QueryIcon sx={{ fontSize: 14 }} />,
    color: '#8d6e63',
    label: 'Inventory',
  },
};

const LEVEL_COLORS: Record<string, string> = {
  fatal: '#f44336',
  error: '#f44336',
  warning: '#ff9800',
  info: '#2196f3',
  debug: '#9e9e9e',
  log: '#9e9e9e',
};

const LEVEL_OPTIONS = ['error', 'warning', 'info', 'debug'] as const;

function getCategoryConfig(category?: string, type?: string) {
  if (category && CATEGORY_CONFIG[category]) return CATEGORY_CONFIG[category];
  if (type && CATEGORY_CONFIG[type]) return CATEGORY_CONFIG[type];
  if (category) {
    const prefix = category.split('.')[0];
    if (CATEGORY_CONFIG[prefix]) return CATEGORY_CONFIG[prefix];
  }
  return {
    icon: <InfoIcon sx={{ fontSize: 14 }} />,
    color: '#9e9e9e',
    label: category || type || 'Event',
  };
}

// ==================== Time Helpers ====================

function formatAbsoluteTime(ts?: string): string {
  if (!ts) return '';
  try {
    const d = new Date(ts);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, '0')}`;
  } catch {
    return ts;
  }
}

function formatRelativeTime(ts?: string, referenceTs?: string): string {
  if (!ts || !referenceTs) return '';
  try {
    const d = new Date(ts).getTime();
    const ref = new Date(referenceTs).getTime();
    const diffMs = d - ref;
    const sign = diffMs >= 0 ? '+' : '-';
    const abs = Math.abs(diffMs);

    if (abs < 1000) return `${sign}${abs}ms`;
    if (abs < 60000) return `${sign}${(abs / 1000).toFixed(2)}s`;
    const mins = Math.floor(abs / 60000);
    const secs = ((abs % 60000) / 1000).toFixed(1);
    return `${sign}${mins}m ${secs}s`;
  } catch {
    return ts;
  }
}

// ==================== Copy Helpers ====================

function breadcrumbsToMarkdown(crumbs: Breadcrumb[]): string {
  const header = '| Timestamp | Type | Category | Level | Message |';
  const sep = '|-----------|------|----------|-------|---------|';
  const rows = crumbs.map((c) => {
    const ts = c.timestamp ? new Date(c.timestamp).toISOString() : '';
    const type = (c.type || '').replace(/\|/g, '\\|');
    const cat = (c.category || '').replace(/\|/g, '\\|');
    const lvl = (c.level || '').replace(/\|/g, '\\|');
    const msg = (c.message || '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
    return `| ${ts} | ${type} | ${cat} | ${lvl} | ${msg} |`;
  });
  return [header, sep, ...rows].join('\n');
}

function breadcrumbsToJSON(crumbs: Breadcrumb[]): string {
  return JSON.stringify(crumbs, null, 2);
}

// ==================== Specialized Renderers ====================

function isHttpBreadcrumb(crumb: Breadcrumb): boolean {
  return (
    crumb.type === 'http' ||
    crumb.category === 'http' ||
    crumb.category === 'fetch' ||
    crumb.category === 'xhr'
  );
}

function isSqlMessage(msg?: string): boolean {
  if (!msg) return false;
  const sqlKeywords =
    /^(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|BEGIN|COMMIT|ROLLBACK|TRUNCATE)\b/i;
  return sqlKeywords.test(msg.trim());
}

function isNavigationUrl(crumb: Breadcrumb): boolean {
  return crumb.category === 'navigation' || crumb.type === 'navigation';
}

function extractUrl(text?: string): string | null {
  if (!text) return null;
  const match = text.match(/https?:\/\/[^\s)]+/);
  return match ? match[0] : null;
}

// HTTP breadcrumb renderer
const HttpBreadcrumbContent: React.FC<{
  crumb: Breadcrumb;
  isError: boolean;
}> = ({ crumb, isError }) => {
  const data = crumb.data || {};
  const method = data.method || '';
  const statusCode = data.status_code || data.statusCode || '';
  const url = data.url || '';
  const msg = crumb.message || '';

  // Try to parse from message: "GET /api/foo → 200 (123ms)"
  const msgMatch = msg.match(
    /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(.+?)(?:\s+[→→]\s+(\d+))?(?:\s*\((.+?)\))?$/
  );

  return (
    <Box
      sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}
    >
      {(method || msgMatch?.[1]) && (
        <Typography
          component="span"
          sx={{
            fontSize: '0.7rem',
            fontWeight: 700,
            color: isError ? '#f44336' : '#00bcd4',
          }}
        >
          {method || msgMatch?.[1]}
        </Typography>
      )}
      <Typography
        component="span"
        sx={{
          fontSize: '0.76rem',
          color: isError ? '#f44336' : 'text.primary',
          fontWeight: isError ? 600 : 400,
          wordBreak: 'break-word',
        }}
      >
        {url || msgMatch?.[2] || msg}
      </Typography>
      {(statusCode || msgMatch?.[3]) && (
        <Chip
          label={statusCode || msgMatch?.[3]}
          size="small"
          sx={{
            height: 16,
            fontSize: '0.6rem',
            fontWeight: 700,
            backgroundColor: alpha(
              Number(statusCode || msgMatch?.[3]) >= 400
                ? '#f44336'
                : '#4caf50',
              0.1
            ),
            color:
              Number(statusCode || msgMatch?.[3]) >= 400
                ? '#f44336'
                : '#4caf50',
          }}
        />
      )}
      {msgMatch?.[4] && (
        <Typography
          component="span"
          sx={{ fontSize: '0.65rem', color: 'text.disabled' }}
        >
          {msgMatch[4]}
        </Typography>
      )}
    </Box>
  );
};

// ==================== Main Component ====================

const BreadcrumbsTimeline: React.FC<BreadcrumbsTimelineProps> = ({
  breadcrumbs,
  summaryMode = false,
  summaryCount = 5,
  errorEvent,
  fullyExpanded = false,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';

  // Persisted state
  const [sortOrder, setSortOrder] = useState<SortOrder>(() => {
    try {
      return (localStorage.getItem(SORT_KEY) as SortOrder) || 'newest';
    } catch {
      return 'newest';
    }
  });
  const [timeDisplay, setTimeDisplay] = useState<TimeDisplay>(() => {
    try {
      return (
        (localStorage.getItem(TIME_DISPLAY_KEY) as TimeDisplay) || 'absolute'
      );
    } catch {
      return 'absolute';
    }
  });

  // UI state
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [filterLevel, setFilterLevel] = useState<string | null>(null);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [copyMenuAnchor, setCopyMenuAnchor] = useState<null | HTMLElement>(
    null
  );
  const [snackbar, setSnackbar] = useState<string | null>(null);

  // Persist sort/time
  const handleSortChange = useCallback(() => {
    const next = sortOrder === 'newest' ? 'oldest' : 'newest';
    setSortOrder(next);
    try {
      localStorage.setItem(SORT_KEY, next);
    } catch {
      /* noop */
    }
  }, [sortOrder]);

  const handleTimeDisplayChange = useCallback(() => {
    const next = timeDisplay === 'absolute' ? 'relative' : 'absolute';
    setTimeDisplay(next);
    try {
      localStorage.setItem(TIME_DISPLAY_KEY, next);
    } catch {
      /* noop */
    }
  }, [timeDisplay]);

  // Build virtual crumb
  const allBreadcrumbs = useMemo(() => {
    const crumbs = [...breadcrumbs];
    if (errorEvent?.type) {
      crumbs.push({
        type: 'error',
        category: 'error',
        message: `${errorEvent.type}: ${errorEvent.value || ''}`,
        level: 'error',
        timestamp: errorEvent.timestamp,
        data: { _virtual: true },
      });
    }
    return crumbs;
  }, [breadcrumbs, errorEvent]);

  // Unique categories
  const categories = useMemo(() => {
    const cats = new Set<string>();
    allBreadcrumbs.forEach((b) => {
      const c = b.category || b.type || 'other';
      cats.add(c.split('.')[0]);
    });
    return Array.from(cats);
  }, [allBreadcrumbs]);

  // Unique levels present
  const levelsPresent = useMemo(() => {
    const levels = new Set<string>();
    allBreadcrumbs.forEach((b) => {
      if (b.level) levels.add(b.level);
    });
    return LEVEL_OPTIONS.filter((l) => levels.has(l));
  }, [allBreadcrumbs]);

  // Reference timestamp for relative time
  const referenceTimestamp = useMemo(() => {
    const sorted = [...allBreadcrumbs].sort(
      (a, b) =>
        new Date(a.timestamp || 0).getTime() -
        new Date(b.timestamp || 0).getTime()
    );
    return sorted[0]?.timestamp;
  }, [allBreadcrumbs]);

  // Filter & sort
  const filtered = useMemo(() => {
    let items = [...allBreadcrumbs];

    if (filterCategory) {
      items = items.filter((b) => {
        const c = b.category || b.type || 'other';
        return c === filterCategory || c.startsWith(filterCategory + '.');
      });
    }

    if (filterLevel) {
      items = items.filter((b) => b.level === filterLevel);
    }

    if (search) {
      const q = search.toLowerCase();
      items = items.filter(
        (b) =>
          (b.message || '').toLowerCase().includes(q) ||
          (b.category || '').toLowerCase().includes(q) ||
          (b.type || '').toLowerCase().includes(q) ||
          JSON.stringify(b.data || {})
            .toLowerCase()
            .includes(q)
      );
    }

    // Sort
    items.sort((a, b) => {
      const ta = new Date(a.timestamp || 0).getTime();
      const tb = new Date(b.timestamp || 0).getTime();
      return sortOrder === 'newest' ? tb - ta : ta - tb;
    });

    return items;
  }, [allBreadcrumbs, filterCategory, filterLevel, search, sortOrder]);

  // Copy handlers
  const handleCopy = useCallback(
    async (format: 'markdown' | 'json') => {
      const text =
        format === 'markdown'
          ? breadcrumbsToMarkdown(filtered)
          : breadcrumbsToJSON(filtered);
      try {
        await navigator.clipboard.writeText(text);
        setSnackbar(t('argus.breadcrumbs.copied'));
      } catch {
        // Fallback
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        setSnackbar(t('argus.breadcrumbs.copied'));
      }
      setCopyMenuAnchor(null);
    },
    [filtered, t]
  );

  if (allBreadcrumbs.length === 0) {
    return (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <ConsoleIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
        <Typography variant="body2" color="text.secondary">
          {t('argus.breadcrumbs.empty')}
        </Typography>
      </Box>
    );
  }

  // ---- Render a single breadcrumb item ----
  const renderItem = (crumb: Breadcrumb, idx: number, totalCount: number) => {
    const cfg = getCategoryConfig(crumb.category, crumb.type);
    const levelColor = crumb.level ? LEVEL_COLORS[crumb.level] : undefined;
    const hasData =
      crumb.data &&
      Object.keys(crumb.data).filter((k) => k !== '_virtual').length > 0;
    const isExpanded = fullyExpanded || expandedIdx === idx;
    const isError = crumb.level === 'error' || crumb.level === 'fatal';
    const isVirtual = crumb.data?._virtual;
    const isHttp = isHttpBreadcrumb(crumb);
    const isSql = isSqlMessage(crumb.message);
    const isNav = isNavigationUrl(crumb);
    const navUrl = isNav
      ? extractUrl(crumb.message) || crumb.data?.to || crumb.data?.url
      : null;

    const timeStr =
      timeDisplay === 'absolute'
        ? formatAbsoluteTime(crumb.timestamp)
        : formatRelativeTime(crumb.timestamp, referenceTimestamp);

    return (
      <Box
        key={idx}
        sx={{
          display: 'flex',
          alignItems: 'stretch',
          gap: 1,
          px: 1.5,
          backgroundColor: isVirtual
            ? alpha('#f44336', 0.06)
            : isError
              ? alpha('#f44336', 0.03)
              : 'transparent',
          transition: 'background 0.1s',
          '&:hover': {
            backgroundColor: isDark
              ? 'rgba(255,255,255,0.02)'
              : 'rgba(0,0,0,0.015)',
          },
          cursor: hasData ? 'pointer' : 'default',
        }}
        onClick={() =>
          hasData && !fullyExpanded && setExpandedIdx(isExpanded ? null : idx)
        }
      >
        {/* Timeline line */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            minWidth: 20,
            alignSelf: 'stretch',
          }}
        >
          {idx > 0 ? (
            <Box
              sx={{
                width: '2px',
                height: '8px',
                backgroundColor: isDark
                  ? 'rgba(255,255,255,0.08)'
                  : 'rgba(0,0,0,0.08)',
                flexShrink: 0,
              }}
            />
          ) : (
            <Box sx={{ height: '8px', flexShrink: 0 }} />
          )}
          <Box
            sx={{
              width: 20,
              height: 20,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: alpha(
                levelColor || cfg.color,
                isVirtual ? 0.2 : 0.12
              ),
              color: levelColor || cfg.color,
              flexShrink: 0,
              border: isVirtual
                ? `2px solid ${levelColor || cfg.color}`
                : 'none',
            }}
          >
            {isVirtual ? <ErrorIcon sx={{ fontSize: 14 }} /> : cfg.icon}
          </Box>
          {idx < totalCount - 1 && (
            <Box
              sx={{
                width: '2px',
                flex: 1,
                backgroundColor: isDark
                  ? 'rgba(255,255,255,0.08)'
                  : 'rgba(0,0,0,0.08)',
              }}
            />
          )}
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, minWidth: 0, py: 0.7 }}>
          <Box
            sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.2 }}
          >
            <Chip
              label={crumb.category || crumb.type || 'event'}
              size="small"
              sx={{
                height: 18,
                fontSize: '0.62rem',
                fontWeight: 700,
                backgroundColor: alpha(cfg.color, 0.08),
                color: cfg.color,
                border: 'none',
              }}
            />
            {crumb.level && crumb.level !== 'info' && (
              <Chip
                label={crumb.level}
                size="small"
                sx={{
                  height: 16,
                  fontSize: '0.58rem',
                  fontWeight: 700,
                  backgroundColor: alpha(
                    LEVEL_COLORS[crumb.level] || '#9e9e9e',
                    0.1
                  ),
                  color: LEVEL_COLORS[crumb.level] || '#9e9e9e',
                  border: 'none',
                }}
              />
            )}
            {isVirtual && (
              <Chip
                label={t('argus.breadcrumbs.errorOccurred')}
                size="small"
                sx={{
                  height: 16,
                  fontSize: '0.58rem',
                  fontWeight: 700,
                  backgroundColor: alpha('#f44336', 0.1),
                  color: '#f44336',
                  border: 'none',
                }}
              />
            )}
            {hasData && !fullyExpanded && (
              <ExpandMoreIcon
                sx={{
                  fontSize: 14,
                  color: 'text.disabled',
                  transform: isExpanded ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.2s',
                }}
              />
            )}
          </Box>

          {/* Message — specialized rendering */}
          {isHttp ? (
            <HttpBreadcrumbContent crumb={crumb} isError={isError} />
          ) : isSql && crumb.message ? (
            <Box
              component="code"
              sx={{
                fontSize: '0.76rem',
                wordBreak: 'break-word',
                backgroundColor: isDark
                  ? 'rgba(76,175,80,0.06)'
                  : 'rgba(76,175,80,0.04)',
                px: 0.5,
                py: 0.1,
                borderRadius: '3px',
                border: `1px solid ${alpha('#4caf50', 0.15)}`,
                display: 'inline',
                '& .token.keyword': {
                  color: isDark ? '#569cd6' : '#0000ff',
                  fontWeight: 700,
                },
                '& .token.string': { color: isDark ? '#ce9178' : '#a31515' },
                '& .token.number': { color: isDark ? '#b5cea8' : '#098658' },
                '& .token.operator': { color: isDark ? '#d4d4d4' : '#333' },
                '& .token.punctuation': { color: isDark ? '#808080' : '#999' },
                '& .token.function': { color: isDark ? '#dcdcaa' : '#795e26' },
              }}
              dangerouslySetInnerHTML={{
                __html: (() => {
                  try {
                    return Prism.highlight(
                      crumb.message,
                      Prism.languages.sql,
                      'sql'
                    );
                  } catch {
                    return crumb.message;
                  }
                })(),
              }}
            />
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography
                sx={{
                  fontSize: '0.76rem',
                  color: isError || isVirtual ? '#f44336' : 'text.primary',
                  fontWeight: isError || isVirtual ? 600 : 400,
                  wordBreak: 'break-word',
                }}
              >
                {crumb.message || '(no message)'}
              </Typography>
              {navUrl && (
                <Tooltip title={navUrl}>
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(navUrl, '_blank');
                    }}
                    sx={{ p: 0.2 }}
                  >
                    <ExternalLinkIcon
                      sx={{ fontSize: 12, color: 'text.disabled' }}
                    />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          )}

          {/* Expanded data — uses BreadcrumbExpandedDetail */}
          {hasData && (
            <Collapse in={isExpanded}>
              <BreadcrumbExpandedDetail
                crumb={crumb}
                isDark={isDark}
                fullyExpanded={fullyExpanded}
              />
            </Collapse>
          )}
        </Box>

        {/* Timestamp */}
        <Tooltip
          title={
            crumb.timestamp ? new Date(crumb.timestamp).toLocaleString() : ''
          }
        >
          <Typography
            sx={{
              fontSize: '0.65rem',
              color:
                timeDisplay === 'relative'
                  ? alpha(theme.palette.text.primary, 0.5)
                  : 'text.disabled',
              whiteSpace: 'nowrap',
              py: 0.7,
              fontWeight: timeDisplay === 'relative' ? 500 : 400,
            }}
          >
            {timeStr}
          </Typography>
        </Tooltip>
      </Box>
    );
  };

  // ---- Toolbar component ----
  const renderToolbar = (isDrawer: boolean = false) => (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.8,
        mb: 1.5,
        flexWrap: 'wrap',
      }}
    >
      {/* Search */}
      <TextField
        size="small"
        placeholder={t('argus.breadcrumbs.search')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon sx={{ fontSize: 15, color: 'text.disabled' }} />
            </InputAdornment>
          ),
        }}
        sx={{
          flex: 1,
          minWidth: isDrawer ? 200 : 260,
          '& .MuiOutlinedInput-root': {
            borderRadius: '6px',
            fontSize: '0.75rem',
            height: 28,
            backgroundColor: isDark
              ? 'rgba(255,255,255,0.03)'
              : 'rgba(0,0,0,0.02)',
          },
          '& .MuiOutlinedInput-input': { py: 0.3 },
        }}
      />

      {/* Category filter chips */}
      <FilterIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
      {categories.map((cat) => {
        const cfg = getCategoryConfig(cat);
        const isActive = filterCategory === cat;
        return (
          <Chip
            key={cat}
            label={cfg.label}
            size="small"
            variant={isActive ? 'filled' : 'outlined'}
            onClick={() => setFilterCategory(isActive ? null : cat)}
            sx={{
              height: 22,
              fontSize: '0.68rem',
              fontWeight: 600,
              borderColor: isActive ? cfg.color : 'divider',
              backgroundColor: isActive
                ? alpha(cfg.color, 0.12)
                : 'transparent',
              color: isActive ? cfg.color : 'text.secondary',
              '&:hover': { backgroundColor: alpha(cfg.color, 0.08) },
            }}
          />
        );
      })}

      {/* Level filter chips */}
      {levelsPresent.length > 1 && (
        <>
          <Divider
            orientation="vertical"
            flexItem
            sx={{ mx: 0.3, height: 16, alignSelf: 'center' }}
          />
          {levelsPresent.map((lvl) => {
            const isActive = filterLevel === lvl;
            const color = LEVEL_COLORS[lvl] || '#9e9e9e';
            return (
              <Chip
                key={lvl}
                label={lvl}
                size="small"
                variant={isActive ? 'filled' : 'outlined'}
                onClick={() => setFilterLevel(isActive ? null : lvl)}
                icon={
                  <DotIcon
                    sx={{
                      fontSize: '8px !important',
                      color: `${color} !important`,
                    }}
                  />
                }
                sx={{
                  height: 20,
                  fontSize: '0.62rem',
                  fontWeight: 600,
                  borderColor: isActive ? color : 'divider',
                  backgroundColor: isActive
                    ? alpha(color, 0.12)
                    : 'transparent',
                  color: isActive ? color : 'text.secondary',
                  '&:hover': { backgroundColor: alpha(color, 0.08) },
                  '& .MuiChip-icon': { ml: '4px', mr: '-2px' },
                }}
              />
            );
          })}
        </>
      )}

      <Box sx={{ flex: 1 }} />

      {/* Sort toggle */}
      <Tooltip
        title={
          sortOrder === 'newest'
            ? t('argus.breadcrumbs.sortNewest')
            : t('argus.breadcrumbs.sortOldest')
        }
      >
        <IconButton size="small" onClick={handleSortChange} sx={{ p: 0.3 }}>
          <SortIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
        </IconButton>
      </Tooltip>

      {/* Time display toggle */}
      <Tooltip
        title={
          timeDisplay === 'absolute'
            ? t('argus.breadcrumbs.timeAbsolute')
            : t('argus.breadcrumbs.timeRelative')
        }
      >
        <IconButton
          size="small"
          onClick={handleTimeDisplayChange}
          sx={{ p: 0.3 }}
        >
          <TimeIcon
            sx={{
              fontSize: 16,
              color:
                timeDisplay === 'relative'
                  ? theme.palette.primary.main
                  : 'text.secondary',
            }}
          />
        </IconButton>
      </Tooltip>

      {/* Copy menu */}
      <Tooltip title={t('argus.breadcrumbs.copy')}>
        <IconButton
          size="small"
          onClick={(e) => setCopyMenuAnchor(e.currentTarget)}
          sx={{ p: 0.3 }}
        >
          <CopyIcon sx={{ fontSize: 15, color: 'text.secondary' }} />
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={copyMenuAnchor}
        open={Boolean(copyMenuAnchor)}
        onClose={() => setCopyMenuAnchor(null)}
        slotProps={{ paper: { sx: { minWidth: 160 } } }}
      >
        <MenuItem onClick={() => handleCopy('markdown')} dense>
          <ListItemIcon>
            <CodeIcon sx={{ fontSize: 16 }} />
          </ListItemIcon>
          <ListItemText>Markdown</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleCopy('json')} dense>
          <ListItemIcon>
            <CopyIcon sx={{ fontSize: 16 }} />
          </ListItemIcon>
          <ListItemText>JSON</ListItemText>
        </MenuItem>
      </Menu>

      {/* Count */}
      <Typography
        variant="caption"
        color="text.disabled"
        sx={{ fontSize: '0.68rem' }}
      >
        {filtered.length} / {allBreadcrumbs.length}
      </Typography>
    </Box>
  );

  // ---- Timeline list (simple, for summary mode) ----
  const renderTimeline = (items: Breadcrumb[]) => (
    <Box
      sx={{
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        borderRadius: '8px',
        overflow: 'hidden',
      }}
    >
      {items.map((crumb, idx) => renderItem(crumb, idx, items.length))}
    </Box>
  );

  // ---- Virtualized Timeline (for Drawer with many items) ----
  const VirtualizedTimeline: React.FC<{ items: Breadcrumb[] }> = ({
    items,
  }) => {
    const parentRef = useRef<HTMLDivElement>(null);
    const virtualizer = useVirtualizer({
      count: items.length,
      getScrollElement: () => parentRef.current,
      estimateSize: () => 52,
      overscan: 10,
    });

    return (
      <Box
        ref={parentRef}
        sx={{
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          borderRadius: '8px',
          overflow: 'auto',
          maxHeight: 'calc(100vh - 200px)',
        }}
      >
        <Box
          sx={{
            height: virtualizer.getTotalSize(),
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => (
            <Box
              key={virtualRow.key}
              ref={virtualizer.measureElement}
              data-index={virtualRow.index}
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {renderItem(
                items[virtualRow.index],
                virtualRow.index,
                items.length
              )}
            </Box>
          ))}
        </Box>
      </Box>
    );
  };

  // ---- SUMMARY MODE ----
  if (summaryMode) {
    const summaryItems = filtered.slice(0, summaryCount);
    const hasMore = allBreadcrumbs.length > summaryCount;

    return (
      <Box>
        {renderTimeline(summaryItems)}
        {hasMore && (
          <Button
            variant="text"
            size="small"
            onClick={() => setDrawerOpen(true)}
            startIcon={<ViewAllIcon sx={{ fontSize: 14 }} />}
            sx={{
              mt: 1,
              fontSize: '0.75rem',
              fontWeight: 600,
              textTransform: 'none',
              color: theme.palette.primary.main,
            }}
          >
            {t('argus.breadcrumbs.viewAll', {
              count: allBreadcrumbs.length,
            })}
          </Button>
        )}

        {/* Drawer */}
        <Drawer
          anchor="right"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          PaperProps={{
            sx: {
              width: { xs: '100%', sm: '65%', md: '55%', lg: '45%' },
              maxWidth: 700,
              backgroundColor: theme.palette.background.default,
            },
          }}
        >
          <Box
            sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}
          >
            {/* Drawer header */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                px: 2.5,
                py: 1.5,
                borderBottom: `1px solid ${theme.palette.divider}`,
                backgroundColor: theme.palette.background.paper,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography
                  variant="subtitle1"
                  fontWeight={700}
                  sx={{ fontSize: '0.95rem' }}
                >
                  {t('argus.breadcrumbs.title')}
                </Typography>
                <Chip
                  label={allBreadcrumbs.length}
                  size="small"
                  sx={{ height: 20, fontSize: '0.7rem', fontWeight: 700 }}
                />
              </Box>
              <IconButton size="small" onClick={() => setDrawerOpen(false)}>
                <CloseIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Box>

            {/* Drawer body */}
            <Box sx={{ flex: 1, overflow: 'auto', px: 2.5, py: 2 }}>
              {renderToolbar(true)}
              {filtered.length > 50 ? (
                <VirtualizedTimeline items={filtered} />
              ) : (
                renderTimeline(filtered)
              )}
            </Box>
          </Box>
        </Drawer>

        {/* Snackbar */}
        <Snackbar
          open={!!snackbar}
          autoHideDuration={2000}
          onClose={() => setSnackbar(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert
            severity="success"
            variant="filled"
            sx={{ fontSize: '0.8rem' }}
          >
            {snackbar}
          </Alert>
        </Snackbar>
      </Box>
    );
  }

  // ---- FULL MODE (inline) ----
  return (
    <Box>
      {renderToolbar()}
      {renderTimeline(filtered)}

      {/* Snackbar */}
      <Snackbar
        open={!!snackbar}
        autoHideDuration={2000}
        onClose={() => setSnackbar(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" variant="filled" sx={{ fontSize: '0.8rem' }}>
          {snackbar}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default BreadcrumbsTimeline;
