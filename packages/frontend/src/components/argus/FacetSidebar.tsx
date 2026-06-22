import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  IconButton,
  InputBase,
  useTheme,
  alpha,
  Collapse,
} from '@mui/material';
import {
  FilterList as FilterIcon,
  Block as ExcludeIcon,
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon,
  Search as SearchIcon,
  ChevronLeft as CollapseIcon,
  ChevronRight as ExpandIcon,
  Add as AddIcon,
  Close as RemoveIcon,
} from '@mui/icons-material';
import SafeTooltip from '@/components/common/SafeTooltip';
import { formatCompactNumber } from '@/utils/numberFormat';
import { useTranslation } from 'react-i18next';

/* ─── Types ─── */

export interface FacetGroup {
  key: string; // e.g. 'severity', 'service'
  label: string; // display label
  values: { value: string; count: number }[];
}

export interface FacetSidebarProps {
  facets: FacetGroup[];
  onFilter: (key: string, value: string, exclude?: boolean) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  loading?: boolean;
  customFacets?: FacetGroup[];
  discoveredFacets?: FacetGroup[];
  onAddCustomFacet?: (key: string) => void;
  onRemoveCustomFacet?: (key: string) => void;
  width?: number;
}

/* ─── Single Facet Section ─── */

const FacetSection = React.memo<{
  facet: FacetGroup;
  onFilter: (key: string, value: string, exclude?: boolean) => void;
  isDark: boolean;
}>(({ facet, onFilter, isDark }) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);

  const totalCount = useMemo(
    () => facet.values.reduce((s, v) => s + v.count, 0),
    [facet.values]
  );

  const filteredValues = useMemo(() => {
    let vals = facet.values;
    if (search.trim()) {
      const q = search.toLowerCase();
      vals = vals.filter((v) => v.value.toLowerCase().includes(q));
    }
    return showAll ? vals : vals.slice(0, 10);
  }, [facet.values, search, showAll]);

  const hasMore = facet.values.length > 10 && !showAll && !search.trim();

  return (
    <Box
      sx={{
        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'}`,
      }}
    >
      {/* Header */}
      <Box
        onClick={() => setExpanded((e) => !e)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          px: 1.5,
          py: 0.8,
          cursor: 'pointer',
          userSelect: 'none',
          '&:hover': {
            backgroundColor: isDark
              ? 'rgba(255,255,255,0.03)'
              : 'rgba(0,0,0,0.02)',
          },
        }}
      >
        {expanded ? (
          <ExpandMoreIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
        ) : (
          <ChevronRightIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
        )}
        <Typography
          sx={{
            fontSize: '0.72rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: 'text.secondary',
            flex: 1,
          }}
        >
          {facet.label}
        </Typography>
        <Typography sx={{ fontSize: '0.62rem', color: 'text.disabled' }}>
          {facet.values.length}
        </Typography>
      </Box>

      {/* Body */}
      <Collapse in={expanded}>
        <Box sx={{ px: 1, pb: 1 }}>
          {/* Search within facet values */}
          {facet.values.length > 5 && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                mx: 0.5,
                mb: 0.5,
                px: 1,
                height: 26,
                borderRadius: '4px',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)'}`,
              }}
            >
              <SearchIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
              <InputBase
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t(
                  'argus.logs.facet.filterValues',
                  'Filter values...'
                )}
                sx={{ fontSize: '0.68rem', flex: 1, '& input': { p: 0 } }}
              />
            </Box>
          )}

          {/* Values list */}
          {filteredValues.map((v) => {
            const pct = totalCount > 0 ? (v.count / totalCount) * 100 : 0;
            return (
              <Box
                key={v.value}
                sx={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  px: 0.5,
                  py: 0.35,
                  mx: 0.5,
                  borderRadius: '3px',
                  cursor: 'pointer',
                  overflow: 'hidden',
                  '&:hover': {
                    backgroundColor: isDark
                      ? 'rgba(255,255,255,0.05)'
                      : 'rgba(0,0,0,0.03)',
                  },
                  '&:hover .facet-actions': { opacity: 1 },
                }}
                onClick={() => onFilter(facet.key, v.value, false)}
              >
                {/* Percentage bar background */}
                <Box
                  sx={{
                    position: 'absolute',
                    left: 0,
                    top: 1,
                    bottom: 1,
                    width: `${pct}%`,
                    minWidth: pct > 0 ? 2 : 0,
                    backgroundColor: alpha(
                      theme.palette.primary.main,
                      isDark ? 0.15 : 0.1
                    ),
                    borderRadius: '0 2px 2px 0',
                    transition: 'width 0.3s ease',
                  }}
                />

                {/* Value name */}
                <Typography
                  sx={{
                    zIndex: 1,
                    flex: 1,
                    fontSize: '0.7rem',
                    fontWeight: 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    pl: 0.5,
                  }}
                >
                  {v.value || '(empty)'}
                </Typography>

                {/* Count + actions */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    zIndex: 1,
                    flexShrink: 0,
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: '0.62rem',
                      fontWeight: 600,
                      color: theme.palette.primary.main,
                      minWidth: 24,
                      textAlign: 'right',
                    }}
                  >
                    {pct.toFixed(0)}%
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: '0.62rem',
                      color: 'text.disabled',
                      minWidth: 28,
                      textAlign: 'right',
                    }}
                  >
                    {formatCompactNumber(v.count)}
                  </Typography>
                  <Box
                    className="facet-actions"
                    sx={{
                      display: 'flex',
                      gap: 0.2,
                      opacity: 0,
                      transition: 'opacity 0.15s',
                    }}
                  >
                    <SafeTooltip
                      title={t('argus.logs.facet.include', 'Include in filter')}
                    >
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          onFilter(facet.key, v.value, false);
                        }}
                        sx={{ p: 0.15, color: theme.palette.primary.main }}
                      >
                        <FilterIcon sx={{ fontSize: 11 }} />
                      </IconButton>
                    </SafeTooltip>
                    <SafeTooltip
                      title={t(
                        'argus.logs.facet.exclude',
                        'Exclude from filter'
                      )}
                    >
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          onFilter(facet.key, v.value, true);
                        }}
                        sx={{ p: 0.15, color: theme.palette.error.main }}
                      >
                        <ExcludeIcon sx={{ fontSize: 11 }} />
                      </IconButton>
                    </SafeTooltip>
                  </Box>
                </Box>
              </Box>
            );
          })}

          {/* Show all toggle */}
          {hasMore && (
            <Typography
              onClick={() => setShowAll(true)}
              sx={{
                fontSize: '0.65rem',
                color: theme.palette.primary.main,
                cursor: 'pointer',
                textAlign: 'center',
                mt: 0.5,
                '&:hover': { textDecoration: 'underline' },
              }}
            >
              {t('argus.logs.facet.viewAll', 'View all {{count}} values', {
                count: facet.values.length,
              })}
            </Typography>
          )}
          {showAll && facet.values.length > 10 && (
            <Typography
              onClick={() => setShowAll(false)}
              sx={{
                fontSize: '0.65rem',
                color: 'text.disabled',
                cursor: 'pointer',
                textAlign: 'center',
                mt: 0.5,
                '&:hover': { textDecoration: 'underline' },
              }}
            >
              {t('argus.logs.facet.showLess', 'Show less')}
            </Typography>
          )}
        </Box>
      </Collapse>
    </Box>
  );
});

/* ─── Main Sidebar ─── */

const FacetSidebar = React.memo<FacetSidebarProps>(
  ({
    facets,
    onFilter,
    collapsed,
    onToggleCollapse,
    loading,
    customFacets,
    discoveredFacets,
    onAddCustomFacet,
    onRemoveCustomFacet,
    width = 240,
  }) => {
    const theme = useTheme();
    const { t } = useTranslation();
    const isDark = theme.palette.mode === 'dark';
    const [newFacetKey, setNewFacetKey] = useState('');

    return (
      <Box sx={{ position: 'relative', flexShrink: 0 }}>
        {/* Edge toggle button — circular, straddling the right border */}
        <Box
          onClick={onToggleCollapse}
          sx={{
            position: 'absolute',
            right: -12,
            top: 6,
            zIndex: 100,
            width: 24,
            height: 24,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: isDark ? '#1e1e1e' : '#ffffff',
            border: `1px solid ${theme.palette.divider}`,
            cursor: 'pointer',
            color: 'text.secondary',
            transition:
              'background-color 0.15s ease, box-shadow 0.15s ease, color 0.15s ease',
            '&:hover': {
              bgcolor: isDark ? '#252525' : '#f5f5f5',
              boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.1)}`,
              color: isDark ? 'primary.main' : 'text.primary',
            },
          }}
        >
          {collapsed ? (
            <ExpandIcon sx={{ fontSize: 14, color: 'inherit' }} />
          ) : (
            <CollapseIcon sx={{ fontSize: 14, color: 'inherit' }} />
          )}
        </Box>

        {/* Panel content */}
        {collapsed ? (
          <Box
            sx={{
              width: 12,
              borderRight: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'}`,
              height: '100%',
            }}
          />
        ) : (
          <Box
            sx={{
              width,
              overflowY: 'auto',
              overflowX: 'hidden',
              borderRight: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'}`,
              '&::-webkit-scrollbar': { width: 4 },
              '&::-webkit-scrollbar-thumb': {
                backgroundColor: isDark
                  ? 'rgba(255,255,255,0.1)'
                  : 'rgba(0,0,0,0.1)',
                borderRadius: 2,
              },
            }}
          >
            {/* Header */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                px: 1.5,
                py: 1,
                borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'}`,
              }}
            >
              <Typography
                sx={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: 'text.secondary',
                }}
              >
                {t('argus.logs.facet.facets', 'Facets')}
              </Typography>
            </Box>

        {/* Facet sections */}
        {facets.map((facet) => (
          <FacetSection
            key={facet.key}
            facet={facet}
            onFilter={onFilter}
            isDark={isDark}
          />
        ))}

        {facets.length === 0 && !loading && (
          <Typography
            sx={{
              px: 2,
              py: 3,
              fontSize: '0.72rem',
              color: 'text.disabled',
              textAlign: 'center',
            }}
          >
            {t('argus.logs.facet.noFacets', 'No facets available')}
          </Typography>
        )}

        {/* Custom Facets */}
        {customFacets && customFacets.length > 0 && (
          <Box
            sx={{
              borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'}`,
              mt: 0.5,
            }}
          >
            <Typography
              sx={{
                fontSize: '0.65rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: 'text.disabled',
                px: 1.5,
                py: 0.6,
              }}
            >
              {t('argus.logs.customFacets.title', 'Custom Facets')}
            </Typography>
            {customFacets.map((facet) => (
              <Box key={facet.key} sx={{ position: 'relative' }}>
                <FacetSection
                  facet={facet}
                  onFilter={onFilter}
                  isDark={isDark}
                />
                {onRemoveCustomFacet && (
                  <IconButton
                    size="small"
                    onClick={() => onRemoveCustomFacet(facet.key)}
                    sx={{
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      p: 0.2,
                      opacity: 0.4,
                      '&:hover': { opacity: 1 },
                    }}
                  >
                    <RemoveIcon sx={{ fontSize: 12 }} />
                  </IconButton>
                )}
              </Box>
            ))}
          </Box>
        )}

        {/* Discovered Facets */}
        {discoveredFacets && discoveredFacets.length > 0 && (
          <Box
            sx={{
              borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'}`,
              mt: 0.5,
            }}
          >
            <Typography
              sx={{
                fontSize: '0.65rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: 'text.disabled',
                px: 1.5,
                py: 0.6,
              }}
            >
              {t('argus.logs.customFacets.discovered', 'Discovered')}
            </Typography>
            {discoveredFacets.map((facet) => (
              <FacetSection
                key={facet.key}
                facet={facet}
                onFilter={onFilter}
                isDark={isDark}
              />
            ))}
          </Box>
        )}

        {/* Add Custom Facet */}
        {onAddCustomFacet && (
          <Box
            sx={{
              px: 1,
              py: 0.5,
              borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'}`,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <InputBase
                value={newFacetKey}
                onChange={(e) => setNewFacetKey(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newFacetKey.trim()) {
                    onAddCustomFacet(newFacetKey.trim());
                    setNewFacetKey('');
                  }
                }}
                placeholder={t(
                  'argus.logs.customFacets.placeholder',
                  'e.g. user_id, request_path'
                )}
                sx={{
                  flex: 1,
                  fontSize: '0.65rem',
                  height: 24,
                  px: 0.5,
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)'}`,
                  borderRadius: '4px',
                }}
              />
              <SafeTooltip
                title={t('argus.logs.customFacets.add', 'Add Facet')}
              >
                <IconButton
                  size="small"
                  onClick={() => {
                    if (newFacetKey.trim()) {
                      onAddCustomFacet(newFacetKey.trim());
                      setNewFacetKey('');
                    }
                  }}
                  sx={{ p: 0.3 }}
                >
                  <AddIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </SafeTooltip>
            </Box>
          </Box>
        )}
          </Box>
        )}
      </Box>
    );
  }
);

export default FacetSidebar;
