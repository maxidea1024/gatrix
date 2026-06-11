/**
 * QuerySuggestionDropdown — Sentry-style autocomplete dropdown with category tabs.
 *
 * Features:
 *   - Category tabs: Recent / All / Fields / Operators / Values
 *   - Recent search history from localStorage
 *   - Arrow ↑/↓ navigate items
 *   - Compact rows with category indicators
 *   - Keyboard hints footer
 */

import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  useMemo,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { Box, Typography, IconButton, CircularProgress } from '@mui/material';
import {
  Close as CloseIcon,
  SearchRounded as SearchIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import type { SuggestionItem, SuggestionCategory } from './types';
import type { RecentSearch } from './recent-searches';
import { getOpLabel } from './operator-labels';

// ─── Props ───────────────────────────────────────────────────────────────────

export interface QuerySuggestionDropdownProps {
  suggestions: SuggestionItem[];
  selectedIndex: number;
  onSelect: (item: SuggestionItem, isMultiSelect?: boolean) => void;
  onSelectedIndexChange?: (index: number) => void;
  isDark: boolean;
  /** Current input prefix — tabs only show when empty */
  inputPrefix?: string;
  /** Recent search history */
  recentSearches?: RecentSearch[];
  /** Called when user selects a recent search */
  onSelectRecent?: (query: string) => void;
  /** Called when user removes a recent search */
  onRemoveRecent?: (query: string) => void;
  /** Called when multiple values are selected */
  onSelectMultiple?: (values: string[]) => void;
  /** Set of currently selected values for in/!in operators */
  selectedValues?: Set<string>;
  /** Left offset for positioning dropdown near cursor */
  dropdownLeft?: number;
  /** Show loading spinner when facet values are being fetched */
  isLoading?: boolean;
}

/** Imperative handle for tab navigation */
export interface QuerySuggestionDropdownHandle {
  nextTab: () => void;
  prevTab: () => void;
  /** Get the filtered suggestion item at the given display index */
  getItemAtIndex: (index: number) => SuggestionItem | null;
  /** Get the count of currently visible (filtered) suggestions */
  getItemCount: () => number;
}

// ─── Tab types ───────────────────────────────────────────────────────────────

type TabKey = 'recent' | 'all' | string; // dynamic: log, resource, trace, event, user, attribute

interface TabConfig {
  key: TabKey;
  i18nKey: string;
  fallback: string;
}

// ─── Category visual config ──────────────────────────────────────────────────

interface CategoryBadge {
  label: string;
  color: string;
  bg: string;
  bgLight: string;
}

const CATEGORY_BADGES: Record<string, CategoryBadge> = {
  // Field domain categories
  log: {
    label: 'LOG',
    color: '#7c8aff',
    bg: 'rgba(124,138,255,0.12)',
    bgLight: 'rgba(92,107,192,0.10)',
  },
  resource: {
    label: 'RES',
    color: '#6ec87a',
    bg: 'rgba(110,200,122,0.12)',
    bgLight: 'rgba(56,142,60,0.10)',
  },
  trace: {
    label: 'TRC',
    color: '#e6994a',
    bg: 'rgba(230,153,74,0.12)',
    bgLight: 'rgba(230,81,0,0.10)',
  },
  event: {
    label: 'EVT',
    color: '#d97ce6',
    bg: 'rgba(217,124,230,0.12)',
    bgLight: 'rgba(156,39,176,0.10)',
  },
  user: {
    label: 'USR',
    color: '#4fc3f7',
    bg: 'rgba(79,195,247,0.12)',
    bgLight: 'rgba(2,136,209,0.10)',
  },
  attribute: {
    label: 'ATR',
    color: '#90a4ae',
    bg: 'rgba(144,164,174,0.12)',
    bgLight: 'rgba(96,125,139,0.10)',
  },
  // Suggestion categories
  operator: {
    label: 'OP',
    color: '#e6994a',
    bg: 'rgba(230,153,74,0.12)',
    bgLight: 'rgba(230,81,0,0.08)',
  },
  logical: {
    label: 'KW',
    color: '#b07adb',
    bg: 'rgba(176,122,219,0.12)',
    bgLight: 'rgba(123,31,162,0.08)',
  },
  paren: {
    label: '( )',
    color: '#b07adb',
    bg: 'rgba(176,122,219,0.12)',
    bgLight: 'rgba(123,31,162,0.08)',
  },
  has: {
    label: 'HAS',
    color: '#4db6ac',
    bg: 'rgba(77,182,172,0.12)',
    bgLight: 'rgba(0,121,107,0.10)',
  },
};

// Legacy color map for non-badge uses
const CATEGORY_COLORS: Record<string, string> = {
  log: '#7c8aff',
  resource: '#6ec87a',
  trace: '#e6994a',
  event: '#d97ce6',
  user: '#4fc3f7',
  attribute: '#90a4ae',
  field: '#7c8aff',
  operator: '#e6994a',
  value: '#6ec87a',
  logical: '#b07adb',
};

// ─── Component ───────────────────────────────────────────────────────────────

export const QuerySuggestionDropdown = forwardRef<
  QuerySuggestionDropdownHandle,
  QuerySuggestionDropdownProps
>(function QuerySuggestionDropdown(
  {
    suggestions,
    selectedIndex,
    onSelect,
    onSelectedIndexChange,
    isDark,
    inputPrefix = '',
    recentSearches = [],
    onSelectRecent,
    onRemoveRecent,
    onSelectMultiple,
    selectedValues = new Set(),
    dropdownLeft = 0,
    isLoading = false,
  },
  ref
) {
  const { t } = useTranslation();
  const listRef = useRef<HTMLDivElement>(null);

  const [isCtrlPressed, setIsCtrlPressed] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.key === 'Meta') {
        setIsCtrlPressed(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.key === 'Meta') {
        setIsCtrlPressed(false);
      }
    };
    const handleWindowBlur = () => {
      setIsCtrlPressed(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, []);

  // Tabs only visible when input is empty (field selection mode)
  const showTabs = inputPrefix.trim() === '';

  // Collect unique fieldCategories from suggestions (for domain-aware tabs)
  const fieldCategories = useMemo(() => {
    const cats = new Set<string>();
    for (const s of suggestions) {
      if (s.fieldCategory) cats.add(s.fieldCategory);
    }
    return cats;
  }, [suggestions]);

  const hasMultipleValues = useMemo(() => {
    let valueCount = 0;
    let isStringField = false;
    for (const s of suggestions) {
      if (s.category === 'value' && !s.description?.startsWith('aql.smart.')) {
        if (s.fieldType === 'string') isStringField = true;
        valueCount++;
      }
    }
    return isStringField && valueCount >= 2;
  }, [suggestions]);

  const hasRecent = recentSearches.length > 0;

  // Use hasMultipleValues to determine if we are in a context that supports multi-select

  // Domain-aware tab labels
  const FIELD_CAT_TABS: Record<string, { i18nKey: string; fallback: string }> =
    {
      log: { i18nKey: 'aql.tab.logs', fallback: 'Logs' },
      resource: { i18nKey: 'aql.tab.resource', fallback: 'Resource' },
      trace: { i18nKey: 'aql.tab.trace', fallback: 'Trace' },
      event: { i18nKey: 'aql.tab.event', fallback: 'Event' },
      user: { i18nKey: 'aql.tab.user', fallback: 'User' },
      attribute: { i18nKey: 'aql.tab.attributes', fallback: 'Attributes' },
      logic: { i18nKey: 'aql.tab.logic', fallback: 'Logic' },
    };

  const availableTabs = useMemo(() => {
    const tabs: TabConfig[] = [];

    if (hasRecent) {
      tabs.push({
        key: 'recent',
        i18nKey: 'aql.tab.recent',
        fallback: 'Recent',
      });
    }
    tabs.push({ key: 'all', i18nKey: 'aql.tab.all', fallback: 'All' });

    // Add tabs for each field category present in suggestions
    const catOrder = [
      'log',
      'resource',
      'trace',
      'event',
      'user',
      'attribute',
      'logic',
    ];
    for (const cat of catOrder) {
      if (fieldCategories.has(cat)) {
        const meta = FIELD_CAT_TABS[cat] ?? {
          i18nKey: `AQL.tab.${cat}`,
          fallback: cat,
        };
        tabs.push({ key: cat, ...meta });
      }
    }

    return tabs;
  }, [fieldCategories, hasRecent]);

  // Default to 'recent' if available when input is empty, otherwise 'all'
  const defaultTab = hasRecent && suggestions.length === 0 ? 'recent' : 'all';
  const [activeTab, setActiveTab] = useState<TabKey>(defaultTab);

  // When user starts typing, force to 'all' tab; when cleared, restore to default
  useEffect(() => {
    if (!showTabs) {
      setActiveTab('all');
    }
  }, [showTabs]);

  // Expose tab navigation and filtered item access to parent
  // (moved after filteredSuggestions so it can reference the computed list)
  const _tabNavHandleRef = ref; // alias to use after filteredSuggestions

  // Reset tab when available tabs change
  useEffect(() => {
    if (showTabs && !availableTabs.find((tab) => tab.key === activeTab)) {
      setActiveTab(availableTabs[0]?.key ?? 'all');
    }
  }, [availableTabs, activeTab, showTabs]);

  // Filter suggestions by active tab (using fieldCategory)
  const filteredSuggestions = useMemo(() => {
    // When typing (tabs hidden), show ALL suggestions including logical operators
    if (!showTabs) return suggestions;
    if (activeTab === 'recent') {
      return recentSearches.map((r) => ({
        label: r.query,
        category: 'recent' as SuggestionCategory,
        fieldCategory: 'recent',
      }));
    }
    if (activeTab === 'all') {
      // Show has/has not in All tab, but exclude AND/OR/parens
      return suggestions.filter((s) => {
        if (s.fieldCategory !== 'logic') return true;
        // Keep has/has not (they have insertText starting with 'has:' or '!has:')
        const insert = (s.insertText ?? '').toLowerCase();
        return insert.startsWith('has:') || insert.startsWith('!has:');
      });
    }
    // Filter by fieldCategory
    return suggestions.filter((s) => s.fieldCategory === activeTab);
  }, [suggestions, activeTab, showTabs, recentSearches]);

  // Group filtered suggestions by fieldCategory for section headers
  const grouped = useMemo(() => {
    const map = new Map<string, SuggestionItem[]>();
    for (const item of filteredSuggestions) {
      const key = item.fieldCategory ?? item.category;
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return map;
  }, [filteredSuggestions]);

  // Flatten grouped map to match the actual render order.
  // This ensures getItemAtIndex(n) returns the same item as the n-th rendered row.
  const flatOrderedItems = useMemo(() => {
    return Array.from(grouped.values()).flat();
  }, [grouped]);

  useImperativeHandle(
    _tabNavHandleRef,
    () => ({
      nextTab: () => {
        if (!showTabs || availableTabs.length <= 1) return;
        setActiveTab((curr) => {
          const idx = availableTabs.findIndex((t) => t.key === curr);
          const next = (idx + 1) % availableTabs.length;
          return availableTabs[next].key;
        });
        onSelectedIndexChange?.(-1);
      },
      prevTab: () => {
        if (!showTabs || availableTabs.length <= 1) return;
        setActiveTab((curr) => {
          const idx = availableTabs.findIndex((t) => t.key === curr);
          const prev = (idx - 1 + availableTabs.length) % availableTabs.length;
          return availableTabs[prev].key;
        });
        onSelectedIndexChange?.(-1);
      },
      getItemAtIndex: (index: number) => {
        return flatOrderedItems[index] ?? null;
      },
      getItemCount: () => {
        return flatOrderedItems.length;
      },
    }),
    [showTabs, availableTabs, onSelectedIndexChange, flatOrderedItems]
  );

  // Pre-compute tab counts
  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = {
      recent: recentSearches.length,
      all: suggestions.filter((s) => {
        if (s.fieldCategory !== 'logic') return true;
        const insert = (s.insertText ?? '').toLowerCase();
        return insert.startsWith('has:') || insert.startsWith('!has:');
      }).length,
    };
    for (const cat of fieldCategories) {
      counts[cat] = suggestions.filter((s) => s.fieldCategory === cat).length;
    }
    return counts;
  }, [suggestions, recentSearches.length, fieldCategories]);

  // Scroll selected item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const items = list.querySelectorAll('[data-suggestion-item]');
    const item = items[selectedIndex] as HTMLElement;
    if (item) {
      item.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const isRecentTab = activeTab === 'recent';
  let flatIndex = 0;

  // Do not render the popover at all if there's nothing to show
  if (!showTabs && filteredSuggestions.length === 0) return null;
  if (showTabs && suggestions.length === 0 && recentSearches.length === 0)
    return null;

  return (
    <Box
      sx={{
        position: 'absolute',
        top: '100%',
        left: dropdownLeft,
        mt: '2px',
        minWidth: 360,
        maxWidth: 480,
        borderRadius: '8px',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
        backgroundColor: isDark ? '#1e1e1e' : '#fff',
        boxShadow: isDark
          ? '0 4px 20px rgba(0,0,0,0.6)'
          : '0 4px 20px rgba(0,0,0,0.1)',
        zIndex: 1000,
        overflow: 'hidden',
      }}
    >
      {/* ── Category Tabs — only in field selection mode ── */}
      {showTabs && availableTabs.length > 1 && (
        <Box
          sx={{
            display: 'flex',
            gap: 0,
            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            px: '4px',
          }}
        >
          {availableTabs.map((tab) => {
            const isActive = tab.key === activeTab;
            const count = tabCounts[tab.key] ?? 0;

            return (
              <Box
                key={tab.key}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setActiveTab(tab.key);
                  onSelectedIndexChange?.(-1);
                }}
                sx={{
                  px: 1,
                  py: '5px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: isActive ? 600 : 400,
                  color: isActive
                    ? isDark
                      ? '#e0e0e0'
                      : '#1a1a1a'
                    : isDark
                      ? 'rgba(255,255,255,0.4)'
                      : 'rgba(0,0,0,0.4)',
                  borderBottom: isActive
                    ? `2px solid ${isDark ? '#7c8aff' : '#5c6bc0'}`
                    : '2px solid transparent',
                  transition: 'all 0.15s ease',
                  userSelect: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  '&:hover': {
                    color: isDark ? '#e0e0e0' : '#1a1a1a',
                  },
                }}
              >
                {t(tab.i18nKey, tab.fallback)}
                <Typography
                  component="span"
                  sx={{
                    fontSize: '9px',
                    color: isDark
                      ? 'rgba(255,255,255,0.25)'
                      : 'rgba(0,0,0,0.25)',
                    fontWeight: 400,
                  }}
                >
                  {count}
                </Typography>
              </Box>
            );
          })}
        </Box>
      )}

      {/* ── Content ── */}
      <Box
        ref={listRef}
        sx={{
          maxHeight: 260,
          overflowY: 'auto',
          py: '3px',
        }}
      >
        {isRecentTab ? (
          /* ── Recent Searches List ── */
          recentSearches.length === 0 ? (
            <Typography
              sx={{
                px: 1.5,
                py: 1,
                fontSize: '11px',
                color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
                textAlign: 'center',
              }}
            >
              {t('aql.noRecent', 'No recent searches')}
            </Typography>
          ) : (
            recentSearches.map((recent, idx) => {
              const isSelected = idx === selectedIndex;

              return (
                <Box
                  key={recent.query}
                  data-suggestion-item
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onSelectRecent?.(recent.query);
                  }}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.75,
                    px: 1,
                    py: '4px',
                    cursor: 'pointer',
                    backgroundColor: isSelected
                      ? isDark
                        ? 'rgba(255,255,255,0.08)'
                        : 'rgba(0,0,0,0.05)'
                      : 'transparent',
                    '&:hover': {
                      backgroundColor: isDark
                        ? 'rgba(255,255,255,0.06)'
                        : 'rgba(0,0,0,0.04)',
                    },
                    borderRadius: '4px',
                    mx: '3px',
                    transition: 'background-color 0.1s ease',
                    '&:hover .recent-remove': {
                      opacity: 1,
                    },
                  }}
                >
                  {/* Clock icon */}
                  <Typography
                    sx={{
                      fontSize: '11px',
                      color: isDark
                        ? 'rgba(255,255,255,0.25)'
                        : 'rgba(0,0,0,0.25)',
                      flexShrink: 0,
                      lineHeight: 1,
                    }}
                  >
                    🕐
                  </Typography>

                  {/* Query chips preview */}
                  <Box
                    sx={{
                      flex: 1,
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '3px',
                      minWidth: 0,
                      overflow: 'hidden',
                    }}
                  >
                    {formatRecentQuery(recent.query, isDark)}
                  </Box>

                  {/* Remove button */}
                  <IconButton
                    className="recent-remove"
                    size="small"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onRemoveRecent?.(recent.query);
                    }}
                    sx={{
                      p: '2px',
                      opacity: 0,
                      transition: 'opacity 0.15s',
                      flexShrink: 0,
                    }}
                  >
                    <CloseIcon
                      sx={{
                        fontSize: 12,
                        color: isDark
                          ? 'rgba(255,255,255,0.3)'
                          : 'rgba(0,0,0,0.3)',
                      }}
                    />
                  </IconButton>
                </Box>
              );
            })
          )
        ) : /* ── Suggestion List ── */
        filteredSuggestions.length === 0 ? (
          isLoading ? (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1,
                px: 1.5,
                py: 1.5,
              }}
            >
              <CircularProgress
                size={14}
                thickness={5}
                sx={{
                  color: isDark
                    ? 'rgba(124,138,255,0.7)'
                    : 'rgba(92,107,192,0.7)',
                }}
              />
              <Typography
                sx={{
                  fontSize: '11px',
                  color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
                }}
              >
                {t('aql.loadingValues', 'Loading values...')}
              </Typography>
            </Box>
          ) : (
            <Typography
              sx={{
                px: 1.5,
                py: 1,
                fontSize: '11px',
                color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
                textAlign: 'center',
              }}
            >
              {t('aql.noSuggestions', 'No suggestions')}
            </Typography>
          )
        ) : (
          Array.from(grouped.entries()).map(([category, items]) => (
            <Box key={category}>
              {showTabs && activeTab === 'all' && grouped.size > 1 && (
                <Typography
                  sx={{
                    px: 1,
                    py: '2px',
                    mt: flatIndex > 0 ? '2px' : 0,
                    display: 'block',
                    color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
                    fontSize: '9px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    userSelect: 'none',
                  }}
                >
                  {t(`AQL.category.${category}`, category)}
                </Typography>
              )}

              {items.map((item) => {
                const idx = flatIndex++;
                const isSelected = idx === selectedIndex;
                const isValue =
                  item.category === 'value' &&
                  !item.description?.startsWith('aql.smart.') &&
                  !item.fieldCategory;
                const isSmart = item.description?.startsWith('aql.smart.');
                const isLogical = item.category === 'logical';
                const isParen = item.category === 'paren';

                return (
                  <Box
                    key={`${category}-${item.label}`}
                    data-suggestion-item
                    onMouseEnter={() => setHoveredIndex(idx)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      // Ctrl/Cmd + click = multi-select (toggle value without closing)
                      const isMulti = !!(e.ctrlKey || e.metaKey);
                      if (isMulti) {
                        e.stopPropagation();
                      }
                      onSelect(item, isMulti);
                    }}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.75,
                      px: 1,
                      py: '2px',
                      cursor: 'pointer',
                      backgroundColor: isSelected
                        ? isDark
                          ? 'rgba(255,255,255,0.08)'
                          : 'rgba(0,0,0,0.05)'
                        : 'transparent',
                      '&:hover': {
                        backgroundColor: isDark
                          ? 'rgba(255,255,255,0.06)'
                          : 'rgba(0,0,0,0.04)',
                      },
                      borderRadius: '4px',
                      mx: '3px',
                    }}
                  >
                    {/* Category badge — unified visual system */}
                    {(() => {
                      // Smart suggestions → search icon
                      if (isSmart) {
                        return (
                          <SearchIcon
                            sx={{
                              fontSize: 13,
                              flexShrink: 0,
                              ml: '1px',
                              color: isDark
                                ? 'rgba(255,255,255,0.35)'
                                : 'rgba(0,0,0,0.35)',
                            }}
                          />
                        );
                      }
                      if (isValue) {
                        const isChecked = selectedValues.has(item.label);
                        if (hasMultipleValues) {
                          return (
                            <Box
                              onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onSelect(item, true);
                              }}
                              sx={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: 14,
                                height: 14,
                                flexShrink: 0,
                                cursor: 'pointer',
                                borderRadius: '3px',
                                border: `1px solid ${isChecked ? 'transparent' : isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}`,
                                backgroundColor: isChecked
                                  ? isDark
                                    ? '#7c8aff'
                                    : '#5c6bc0'
                                  : 'transparent',
                                color: '#fff',
                                fontSize: 10,
                                fontWeight: 700,
                                lineHeight: 1,
                              }}
                            >
                              {isChecked && '✓'}
                            </Box>
                          );
                        }
                        return <Box sx={{ width: 14, flexShrink: 0 }} />;
                      }
                      // Everything else → category badge
                      const badgeKey = isLogical
                        ? 'logical'
                        : isParen
                          ? 'paren'
                          : item.category === 'operator'
                            ? 'operator'
                            : (item.fieldCategory ?? item.category);
                      const badge = CATEGORY_BADGES[badgeKey];
                      if (badge) {
                        return (
                          <Box
                            sx={{
                              fontSize: '8px',
                              fontWeight: 700,
                              flexShrink: 0,
                              fontFamily: '"JetBrains Mono", monospace',
                              color: isDark ? badge.color : badge.color,
                              backgroundColor: isDark
                                ? badge.bg
                                : badge.bgLight,
                              borderRadius: '3px',
                              px: '3px',
                              py: '1px',
                              lineHeight: 1.3,
                              letterSpacing: '0.02em',
                              minWidth: 22,
                              textAlign: 'center',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {badge.label}
                          </Box>
                        );
                      }
                      // Fallback dot
                      return (
                        <Box
                          sx={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            backgroundColor:
                              CATEGORY_COLORS[
                                item.fieldCategory ?? item.category
                              ] ?? '#90a4ae',
                            opacity: 0.7,
                            flexShrink: 0,
                            ml: '8px',
                          }}
                        />
                      );
                    })()}

                    {/* Label — smart rendering for composite suggestions */}
                    <Box
                      sx={{
                        fontSize: '12px',
                        fontFamily: '"JetBrains Mono", monospace',
                        fontWeight: 500,
                        color: isDark ? '#d4d4d4' : '#1a1a1a',
                        flex: 1,
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        lineHeight: 1.4,
                      }}
                    >
                      {renderSuggestionLabel(item, isDark)}
                    </Box>

                    {/* Description or field type — hide for smart suggestions */}
                    {(item.description || item.fieldType) &&
                      !item.description?.startsWith('aql.smart.') && (
                        <Typography
                          sx={{
                            fontSize: '10px',
                            color: isDark
                              ? 'rgba(255,255,255,0.25)'
                              : 'rgba(0,0,0,0.3)',
                            fontFamily: 'inherit',
                            flexShrink: 0,
                            lineHeight: 1,
                          }}
                        >
                          {item.description
                            ? t(item.description, item.description)
                            : item.fieldType}
                        </Typography>
                      )}
                  </Box>
                );
              })}
            </Box>
          ))
        )}
      </Box>

      {/* ── Keyboard hint footer ── */}
      <Box
        sx={{
          display: 'flex',
          gap: 1.5,
          px: 1,
          py: '4px',
          borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        {/* Multi-select hint — shown when multiple values are available */}
        {hasMultipleValues && (
          <Typography
            sx={{
              fontSize: '11px',
              color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)',
              whiteSpace: 'nowrap',
            }}
          >
            {t('aql.hint.multiSelect', 'Hold {{key}} to select multiple', {
              key: navigator.platform?.includes('Mac') ? '⌘' : 'Ctrl',
            })}
          </Typography>
        )}
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          {[
            { keys: '↑↓', label: t('aql.hint.navigate', 'navigate') },
            { keys: '←→', label: t('aql.hint.switchTab', 'tab') },
            { keys: 'Tab', label: t('aql.hint.select', 'select') },
            { keys: 'Esc', label: t('aql.hint.close', 'close') },
          ].map(({ keys, label }) => (
            <Box
              key={keys}
              sx={{ display: 'flex', alignItems: 'center', gap: '3px' }}
            >
              <Typography
                component="span"
                sx={{
                  fontSize: '11px',
                  fontFamily: '"JetBrains Mono", monospace',
                  color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)',
                  backgroundColor: isDark
                    ? 'rgba(255,255,255,0.06)'
                    : 'rgba(0,0,0,0.05)',
                  px: '4px',
                  py: '1px',
                  borderRadius: '3px',
                  lineHeight: 1.3,
                }}
              >
                {keys}
              </Typography>
              <Typography
                component="span"
                sx={{
                  fontSize: '11px',
                  color: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)',
                  lineHeight: 1.3,
                }}
              >
                {label}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
});

// ─── Suggestion label renderer ───────────────────────────────────────────────

/**
 * Render a suggestion label with smart coloring.
 * For "message contains X" / "message is X" style suggestions, split into
 * colored parts: [field] [operator] [value].
 */
function renderSuggestionLabel(
  item: SuggestionItem,
  isDark: boolean
): React.ReactNode {
  // Smart suggestions: "message contains X", "message not starts with X", etc.
  const smartMatch = item.label.match(
    /^(\w+)\s+(not\s+contains|not\s+starts\s+with|not\s+ends\s+with|is\s+not|contains|starts\s+with|ends\s+with|is)\s+(.+)$/
  );
  if (smartMatch) {
    const [, field, op, value] = smartMatch;
    return (
      <>
        <span
          style={{
            color: isDark ? '#7c8aff' : '#5c6bc0',
            fontWeight: 600,
          }}
        >
          {field}
        </span>{' '}
        <span
          style={{
            color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
            fontWeight: 400,
          }}
        >
          {op}
        </span>{' '}
        <span
          style={{
            color: isDark ? '#e6994a' : '#e65100',
            fontWeight: 500,
          }}
        >
          {value}
        </span>
      </>
    );
  }

  // Regular label
  if (item.category === 'operator') {
    return <span>{getOpLabel(item.label, item.fieldType ?? 'string')}</span>;
  }

  // has / has not operators: show with operator styling
  if (
    item.label === 'has' ||
    item.label === '!has' ||
    item.label === 'has not'
  ) {
    return (
      <span
        style={{
          color: isDark ? '#c792ea' : '#7b1fa2',
          fontWeight: 600,
        }}
      >
        {item.label}
      </span>
    );
  }

  return <span>{item.label}</span>;
}

// ─── Recent query formatter ──────────────────────────────────────────────────

/**
 * Format a recent query string as inline chip previews.
 */
function formatRecentQuery(query: string, isDark: boolean): React.ReactNode[] {
  // Simple tokenization: split by ' and ', ' or ' or whitespace-bounded segments
  const parts = query.split(/\s+(and|or)\s+/i);
  const nodes: React.ReactNode[] = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    if (!part) continue;

    const isLogical = /^(and|or)$/i.test(part);

    if (isLogical) {
      nodes.push(
        <Typography
          key={`logic-${i}`}
          component="span"
          sx={{
            fontSize: '10px',
            color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
            fontStyle: 'italic',
            lineHeight: 1.4,
          }}
        >
          {part.toUpperCase()}
        </Typography>
      );
    } else {
      nodes.push(
        <Box
          key={`chip-${i}`}
          component="span"
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            px: '5px',
            py: '1px',
            borderRadius: '3px',
            backgroundColor: isDark
              ? 'rgba(255,255,255,0.06)'
              : 'rgba(0,0,0,0.05)',
            fontSize: '11px',
            fontFamily: '"JetBrains Mono", monospace',
            color: isDark ? '#c0c0c0' : '#333',
            lineHeight: 1.4,
            whiteSpace: 'nowrap',
          }}
        >
          {formatChipParts(part, isDark)}
        </Box>
      );
    }
  }

  return nodes;
}

/**
 * Format a single filter expression with colored parts.
 * e.g. "message:contains(\"hello\")" → [message] [contains] ["hello"]
 */
function formatChipParts(expr: string, isDark: boolean): React.ReactNode {
  // Try to parse field:op(value) or field:value
  const colonIdx = expr.indexOf(':');
  if (colonIdx === -1) {
    // Plain text
    return <span>{expr}</span>;
  }

  const field = expr.slice(0, colonIdx);
  const rest = expr.slice(colonIdx + 1);

  return (
    <>
      <span style={{ color: isDark ? '#7c8aff' : '#5c6bc0', fontWeight: 600 }}>
        {field}
      </span>
      <span
        style={{
          color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
          margin: '0 1px',
        }}
      >
        :
      </span>
      <span style={{ color: isDark ? '#6ec87a' : '#2e7d32' }}>{rest}</span>
    </>
  );
}
