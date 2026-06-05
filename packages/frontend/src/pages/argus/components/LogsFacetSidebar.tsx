import React, { useState, useMemo } from 'react';
import {
  Box, Typography, IconButton, InputBase, Checkbox,
  useTheme, alpha, Collapse,
} from '@mui/material';
import {
  FilterList as FilterIcon, Block as ExcludeIcon,
  ExpandMore as ExpandMoreIcon, ChevronRight as ChevronRightIcon,
  Search as SearchIcon,
  ChevronLeft as CollapseIcon,
  ChevronRight as ExpandIcon,
} from '@mui/icons-material';
import SafeTooltip from '@/components/common/SafeTooltip';
import { useTranslation } from 'react-i18next';

/* ─── Types ─── */

export interface FacetGroup {
  key: string;          // e.g. 'severity', 'service'
  label: string;        // display label
  values: { value: string; count: number }[];
}

interface LogsFacetSidebarProps {
  facets: FacetGroup[];
  onFilter: (key: string, value: string, exclude?: boolean) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  loading?: boolean;
}

/* ─── Single Facet Section ─── */

const FacetSection: React.FC<{
  facet: FacetGroup;
  onFilter: (key: string, value: string, exclude?: boolean) => void;
  isDark: boolean;
}> = ({ facet, onFilter, isDark }) => {
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
      vals = vals.filter(v => v.value.toLowerCase().includes(q));
    }
    return showAll ? vals : vals.slice(0, 10);
  }, [facet.values, search, showAll]);

  const hasMore = facet.values.length > 10 && !showAll && !search.trim();

  return (
    <Box sx={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'}` }}>
      {/* Header */}
      <Box
        onClick={() => setExpanded(e => !e)}
        sx={{
          display: 'flex', alignItems: 'center', gap: 0.5,
          px: 1.5, py: 0.8, cursor: 'pointer', userSelect: 'none',
          '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' },
        }}
      >
        {expanded
          ? <ExpandMoreIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
          : <ChevronRightIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
        }
        <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'text.secondary', flex: 1 }}>
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
            <Box sx={{
              display: 'flex', alignItems: 'center', gap: 0.5,
              mx: 0.5, mb: 0.5, px: 1, height: 26, borderRadius: '4px',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)'}`,
            }}>
              <SearchIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
              <InputBase
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('argus.logs.facet.filterValues', 'Filter values...')}
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
                  position: 'relative', display: 'flex', alignItems: 'center',
                  px: 0.5, py: 0.35, mx: 0.5, borderRadius: '3px',
                  cursor: 'pointer', overflow: 'hidden',
                  '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' },
                  '&:hover .facet-actions': { opacity: 1 },
                }}
                onClick={() => onFilter(facet.key, v.value, false)}
              >
                {/* Percentage bar background */}
                <Box sx={{
                  position: 'absolute', left: 0, top: 1, bottom: 1,
                  width: `${pct}%`, minWidth: pct > 0 ? 2 : 0,
                  backgroundColor: alpha(theme.palette.primary.main, isDark ? 0.15 : 0.10),
                  borderRadius: '0 2px 2px 0', transition: 'width 0.3s ease',
                }} />

                {/* Value name */}
                <Typography sx={{
                  zIndex: 1, flex: 1, fontSize: '0.7rem', fontWeight: 500,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  pl: 0.5,
                }}>
                  {v.value || '(empty)'}
                </Typography>

                {/* Count + actions */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, zIndex: 1, flexShrink: 0 }}>
                  <Typography sx={{ fontSize: '0.62rem', fontWeight: 600, color: theme.palette.primary.main, minWidth: 24, textAlign: 'right' }}>
                    {pct.toFixed(0)}%
                  </Typography>
                  <Typography sx={{ fontSize: '0.62rem', color: 'text.disabled', minWidth: 28, textAlign: 'right' }}>
                    {v.count.toLocaleString()}
                  </Typography>
                  <Box className="facet-actions" sx={{ display: 'flex', gap: 0.2, opacity: 0, transition: 'opacity 0.15s' }}>
                    <SafeTooltip title={t('argus.logs.facet.include', 'Include in filter')}>
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); onFilter(facet.key, v.value, false); }}
                        sx={{ p: 0.15, color: theme.palette.primary.main }}>
                        <FilterIcon sx={{ fontSize: 11 }} />
                      </IconButton>
                    </SafeTooltip>
                    <SafeTooltip title={t('argus.logs.facet.exclude', 'Exclude from filter')}>
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); onFilter(facet.key, v.value, true); }}
                        sx={{ p: 0.15, color: theme.palette.error.main }}>
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
                fontSize: '0.65rem', color: theme.palette.primary.main,
                cursor: 'pointer', textAlign: 'center', mt: 0.5,
                '&:hover': { textDecoration: 'underline' },
              }}
            >
              {t('argus.logs.facet.viewAll', 'View all {{count}} values', { count: facet.values.length })}
            </Typography>
          )}
          {showAll && facet.values.length > 10 && (
            <Typography
              onClick={() => setShowAll(false)}
              sx={{
                fontSize: '0.65rem', color: 'text.disabled',
                cursor: 'pointer', textAlign: 'center', mt: 0.5,
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
};

/* ─── Main Sidebar ─── */

const LogsFacetSidebar: React.FC<LogsFacetSidebarProps> = ({
  facets, onFilter, collapsed, onToggleCollapse, loading,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';

  if (collapsed) {
    return (
      <Box sx={{
        width: 32, flexShrink: 0,
        borderRight: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'}`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', pt: 1,
      }}>
        <SafeTooltip title={t('argus.logs.facet.expandFacets', 'Expand facets')} placement="right">
          <IconButton size="small" onClick={onToggleCollapse} sx={{ p: 0.5 }}>
            <ExpandIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </SafeTooltip>
      </Box>
    );
  }

  return (
    <Box sx={{
      width: 240, flexShrink: 0, overflowY: 'auto', overflowX: 'hidden',
      borderRight: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'}`,
      '&::-webkit-scrollbar': { width: 4 },
      '&::-webkit-scrollbar-thumb': { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', borderRadius: 2 },
    }}>
      {/* Header */}
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        px: 1.5, py: 1, borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'}`,
      }}>
        <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'text.secondary' }}>
          {t('argus.logs.facet.facets', 'Facets')}
        </Typography>
        <SafeTooltip title={t('argus.logs.facet.collapseFacets', 'Collapse')} placement="right">
          <IconButton size="small" onClick={onToggleCollapse} sx={{ p: 0.3 }}>
            <CollapseIcon sx={{ fontSize: 14, transform: 'rotate(180deg)' }} />
          </IconButton>
        </SafeTooltip>
      </Box>

      {/* Facet sections */}
      {facets.map(facet => (
        <FacetSection
          key={facet.key}
          facet={facet}
          onFilter={onFilter}
          isDark={isDark}
        />
      ))}

      {facets.length === 0 && !loading && (
        <Typography sx={{ px: 2, py: 3, fontSize: '0.72rem', color: 'text.disabled', textAlign: 'center' }}>
          {t('argus.logs.facet.noFacets', 'No facets available')}
        </Typography>
      )}
    </Box>
  );
};

export default LogsFacetSidebar;
