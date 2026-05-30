import React, { useState, useMemo } from 'react';
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
}

// ==================== Config ====================

const CATEGORY_CONFIG: Record<string, { icon: React.ReactElement; color: string; label: string }> = {
  'ui.click': { icon: <ClickIcon sx={{ fontSize: 14 }} />, color: '#7c4dff', label: 'UI Click' },
  'ui.input': { icon: <UIIcon sx={{ fontSize: 14 }} />, color: '#7c4dff', label: 'UI Input' },
  navigation: { icon: <NavIcon sx={{ fontSize: 14 }} />, color: '#2196f3', label: 'Navigation' },
  http: { icon: <HttpIcon sx={{ fontSize: 14 }} />, color: '#00bcd4', label: 'HTTP' },
  fetch: { icon: <HttpIcon sx={{ fontSize: 14 }} />, color: '#00bcd4', label: 'Fetch' },
  xhr: { icon: <HttpIcon sx={{ fontSize: 14 }} />, color: '#00bcd4', label: 'XHR' },
  console: { icon: <ConsoleIcon sx={{ fontSize: 14 }} />, color: '#ff9800', label: 'Console' },
  error: { icon: <ErrorIcon sx={{ fontSize: 14 }} />, color: '#f44336', label: 'Error' },
  warning: { icon: <WarningIcon sx={{ fontSize: 14 }} />, color: '#ff9800', label: 'Warning' },
  info: { icon: <InfoIcon sx={{ fontSize: 14 }} />, color: '#2196f3', label: 'Info' },
  query: { icon: <QueryIcon sx={{ fontSize: 14 }} />, color: '#4caf50', label: 'Query' },
  debug: { icon: <ConsoleIcon sx={{ fontSize: 14 }} />, color: '#9e9e9e', label: 'Debug' },
};

const LEVEL_COLORS: Record<string, string> = {
  fatal: '#f44336',
  error: '#f44336',
  warning: '#ff9800',
  info: '#2196f3',
  debug: '#9e9e9e',
  log: '#9e9e9e',
};

function getCategoryConfig(category?: string, type?: string) {
  if (category && CATEGORY_CONFIG[category]) return CATEGORY_CONFIG[category];
  if (type && CATEGORY_CONFIG[type]) return CATEGORY_CONFIG[type];
  // Fallback: try prefix match
  if (category) {
    const prefix = category.split('.')[0];
    if (CATEGORY_CONFIG[prefix]) return CATEGORY_CONFIG[prefix];
  }
  return { icon: <InfoIcon sx={{ fontSize: 14 }} />, color: '#9e9e9e', label: category || type || 'Event' };
}

function formatTime(ts?: string): string {
  if (!ts) return '';
  try {
    const d = new Date(ts);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, '0')}`;
  } catch {
    return ts;
  }
}

// ==================== Component ====================

const BreadcrumbsTimeline: React.FC<BreadcrumbsTimelineProps> = ({ breadcrumbs }) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';

  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set<string>();
    breadcrumbs.forEach(b => {
      const c = b.category || b.type || 'other';
      cats.add(c.split('.')[0]);
    });
    return Array.from(cats);
  }, [breadcrumbs]);

  // Filter breadcrumbs
  const filtered = useMemo(() => {
    let items = [...breadcrumbs];
    if (filterCategory) {
      items = items.filter(b => {
        const c = b.category || b.type || 'other';
        return c === filterCategory || c.startsWith(filterCategory + '.');
      });
    }
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(b =>
        (b.message || '').toLowerCase().includes(q) ||
        (b.category || '').toLowerCase().includes(q) ||
        JSON.stringify(b.data || {}).toLowerCase().includes(q)
      );
    }
    return items;
  }, [breadcrumbs, filterCategory, search]);

  if (breadcrumbs.length === 0) {
    return (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <ConsoleIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
        <Typography variant="body2" color="text.secondary">
          {t('argus.breadcrumbs.empty', { defaultValue: 'No breadcrumbs available for this event' })}
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header & Filters */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
        <TextField
          size="small"
          placeholder={t('argus.breadcrumbs.search', { defaultValue: 'Search breadcrumbs...' })}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 15, color: 'text.disabled' }} /></InputAdornment>,
          }}
          sx={{
            minWidth: 180,
            '& .MuiOutlinedInput-root': {
              borderRadius: '6px', fontSize: '0.75rem', height: 28,
              backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
            },
            '& .MuiOutlinedInput-input': { py: 0.3 },
          }}
        />

        <FilterIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
        {categories.map(cat => {
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
                height: 22, fontSize: '0.68rem', fontWeight: 600,
                borderColor: isActive ? cfg.color : 'divider',
                backgroundColor: isActive ? alpha(cfg.color, 0.12) : 'transparent',
                color: isActive ? cfg.color : 'text.secondary',
                '&:hover': { backgroundColor: alpha(cfg.color, 0.08) },
              }}
            />
          );
        })}

        <Box sx={{ flex: 1 }} />
        <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.68rem' }}>
          {filtered.length} / {breadcrumbs.length}
        </Typography>
      </Box>

      {/* Timeline */}
      <Box sx={{
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        borderRadius: '8px',
        overflow: 'hidden',
      }}>
        {filtered.map((crumb, idx) => {
          const cfg = getCategoryConfig(crumb.category, crumb.type);
          const levelColor = crumb.level ? LEVEL_COLORS[crumb.level] : undefined;
          const hasData = crumb.data && Object.keys(crumb.data).length > 0;
          const isExpanded = expandedIdx === idx;
          const isError = crumb.level === 'error' || crumb.level === 'fatal';

          return (
            <Box
              key={idx}
              sx={{
                display: 'flex', alignItems: 'flex-start', gap: 1,
                px: 1.5, py: 0.7,
                borderBottom: idx < filtered.length - 1 ? `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}` : 'none',
                backgroundColor: isError ? alpha('#f44336', 0.03) : 'transparent',
                transition: 'background 0.1s',
                '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)' },
                cursor: hasData ? 'pointer' : 'default',
              }}
              onClick={() => hasData && setExpandedIdx(isExpanded ? null : idx)}
            >
              {/* Timeline line */}
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pt: 0.3, minWidth: 20 }}>
                <Box sx={{
                  width: 20, height: 20, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backgroundColor: alpha(levelColor || cfg.color, 0.12),
                  color: levelColor || cfg.color,
                }}>
                  {cfg.icon}
                </Box>
                {idx < filtered.length - 1 && (
                  <Box sx={{ width: 1, flex: 1, minHeight: 8, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }} />
                )}
              </Box>

              {/* Content */}
              <Box sx={{ flex: 1, minWidth: 0, py: 0.1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.2 }}>
                  <Chip
                    label={crumb.category || crumb.type || 'event'}
                    size="small"
                    sx={{
                      height: 18, fontSize: '0.62rem', fontWeight: 700,
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
                        height: 16, fontSize: '0.58rem', fontWeight: 700,
                        backgroundColor: alpha(LEVEL_COLORS[crumb.level] || '#9e9e9e', 0.1),
                        color: LEVEL_COLORS[crumb.level] || '#9e9e9e',
                        border: 'none',
                      }}
                    />
                  )}
                  {hasData && (
                    <ExpandMoreIcon sx={{
                      fontSize: 14, color: 'text.disabled',
                      transform: isExpanded ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.2s',
                    }} />
                  )}
                </Box>

                <Typography sx={{
                  fontSize: '0.76rem', color: isError ? '#f44336' : 'text.primary',
                  fontWeight: isError ? 600 : 400,
                  wordBreak: 'break-word',
                  fontFamily: crumb.category === 'console' ? 'monospace' : 'inherit',
                }}>
                  {crumb.message || '(no message)'}
                </Typography>

                {/* Expanded data */}
                <Collapse in={isExpanded}>
                  {hasData && (
                    <Box sx={{
                      mt: 0.5, p: 1, borderRadius: '4px',
                      backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.03)',
                      fontFamily: 'monospace', fontSize: '0.7rem',
                      maxHeight: 200, overflow: 'auto',
                    }}>
                      {Object.entries(crumb.data!).map(([key, val]) => (
                        <Box key={key} sx={{ display: 'flex', gap: 1, py: 0.2 }}>
                          <Typography component="span" sx={{ color: 'text.secondary', fontSize: '0.7rem', fontFamily: 'monospace', minWidth: 80, fontWeight: 600 }}>
                            {key}:
                          </Typography>
                          <Typography component="span" sx={{ color: 'text.primary', fontSize: '0.7rem', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                            {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  )}
                </Collapse>
              </Box>

              {/* Timestamp */}
              <Tooltip title={crumb.timestamp || ''}>
                <Typography sx={{
                  fontSize: '0.65rem', color: 'text.disabled', fontFamily: 'monospace',
                  whiteSpace: 'nowrap', pt: 0.3,
                }}>
                  {formatTime(crumb.timestamp)}
                </Typography>
              </Tooltip>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

export default BreadcrumbsTimeline;
