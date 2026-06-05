import React, { useState, useMemo } from 'react';
import { Box, Typography, Tooltip, useTheme, alpha, Popover, IconButton, Skeleton } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { FilterList as FilterIcon, Block as ExcludeIcon } from '@mui/icons-material';

export interface FacetData {
  tag: string;
  values: { value: string; count: number }[];
}

interface DiscoverFacetMapProps {
  facets: Record<string, { value: string; count: number }[]>;
  onSelectFacet: (tag: string, value: string, exclude?: boolean) => void;
  loading?: boolean;
}

/**
 * Sentry-style compact inline facet chips.
 * Each tag is a clickable chip that expands to a popover showing top values with bar charts.
 */
const DiscoverFacetMap: React.FC<DiscoverFacetMapProps> = ({ facets, onSelectFacet, loading }) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const facetEntries = useMemo(() => {
    return Object.entries(facets).filter(([, values]) => values && values.length > 0);
  }, [facets]);

  if (facetEntries.length === 0) {
    if (loading) return (
      <Box sx={{ display: 'flex', gap: 0.5, mb: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
        {[90, 110, 80, 100].map((w, i) => (
          <Skeleton key={i} variant="rounded" width={w} height={24} sx={{ borderRadius: '4px' }} />
        ))}
      </Box>
    );
    return null;
  }

  const openPopover = (e: React.MouseEvent<HTMLElement>, tag: string) => {
    setAnchorEl(e.currentTarget);
    setActiveTag(tag);
  };

  const activeValues = activeTag ? facets[activeTag] || [] : [];

  return (
    <Box sx={{ display: 'flex', gap: 0.5, mb: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
      {facetEntries.map(([tag, values]) => {
        const topValue = values[0]?.value || '';
        const totalCount = values.reduce((s, v) => s + v.count, 0);
        return (
          <Box
            key={tag}
            onClick={(e) => openPopover(e, tag)}
            sx={{
              display: 'inline-flex', alignItems: 'center', gap: 0.5,
              height: 24, px: 1, borderRadius: '4px',
              border: `1px solid ${activeTag === tag && anchorEl ? theme.palette.primary.main : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)'}`,
              cursor: 'pointer', transition: 'all 0.15s', userSelect: 'none',
              backgroundColor: activeTag === tag && anchorEl ? alpha(theme.palette.primary.main, 0.06) : 'transparent',
              '&:hover': {
                borderColor: theme.palette.primary.main,
                backgroundColor: alpha(theme.palette.primary.main, 0.04),
              },
            }}
          >
            <Typography sx={{ fontSize: '0.68rem', fontWeight: 600, color: 'text.secondary'}}>
              {tag}
            </Typography>
            <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: theme.palette.primary.main}}>
              {topValue}
            </Typography>
            {values.length > 1 && (
              <Typography sx={{ fontSize: '0.58rem', color: 'text.disabled' }}>
                +{values.length - 1}
              </Typography>
            )}
          </Box>
        );
      })}

      {/* Popover showing tag values */}
      <Popover
        open={Boolean(anchorEl) && Boolean(activeTag)}
        anchorEl={anchorEl}
        onClose={() => { setAnchorEl(null); setActiveTag(null); }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: {
              mt: 0.5, borderRadius: '8px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
              minWidth: 220, maxWidth: 300, maxHeight: 320, overflow: 'auto',
            },
          },
        }}
      >
        <Box sx={{ py: 1 }}>
          <Typography sx={{ px: 1.5, pb: 0.75, fontSize: '0.72rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            {activeTag}
          </Typography>
          {activeValues.slice(0, 10).map((v, idx) => {
            const totalCount = activeValues.reduce((s, x) => s + x.count, 0);
            const pctOfTotal = totalCount > 0 ? ((v.count / totalCount) * 100) : 0;
            return (
              <Box
                key={idx}
                sx={{
                  position: 'relative', display: 'flex', alignItems: 'center',
                  px: 1.5, py: 0.7, cursor: 'pointer', overflow: 'hidden',
                  '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' },
                  '&:hover .facet-actions': { opacity: 1 },
                }}
              >
                {/* Background bar fill — Sentry style */}
                <Box sx={{
                  position: 'absolute', left: 8, top: 2, bottom: 2,
                  width: `${pctOfTotal}%`, minWidth: pctOfTotal > 0 ? 4 : 0,
                  backgroundColor: alpha(theme.palette.primary.main, isDark ? 0.18 : 0.12),
                  borderRadius: '0 3px 3px 0',
                  transition: 'width 0.3s ease',
                }} />
                {/* Value */}
                <Typography sx={{
                  zIndex: 1, flex: 1, fontSize: '0.74rem', fontWeight: 500,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {v.value || '(empty)'}
                </Typography>
                {/* Right side: pct + count + actions */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, zIndex: 1, flexShrink: 0, ml: 1 }}>
                  <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: theme.palette.primary.main, minWidth: 28, textAlign: 'right' }}>
                    {pctOfTotal.toFixed(0)}%
                  </Typography>
                  <Typography sx={{ fontSize: '0.68rem', color: 'text.disabled', minWidth: 32, textAlign: 'right' }}>
                    {v.count.toLocaleString()}
                  </Typography>
                  <Box className="facet-actions" sx={{ display: 'flex', gap: 0.25, opacity: 0, transition: 'opacity 0.15s' }}>
                    <Tooltip title={t('argus.discover.facet.addToFilter', 'Add to filter')}>
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); onSelectFacet(activeTag!, v.value, false); setAnchorEl(null); setActiveTag(null); }}
                        sx={{ p: 0.2, color: theme.palette.primary.main }}>
                        <FilterIcon sx={{ fontSize: 12 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t('argus.discover.facet.exclude', 'Exclude')}>
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); onSelectFacet(activeTag!, v.value, true); setAnchorEl(null); setActiveTag(null); }}
                        sx={{ p: 0.2, color: theme.palette.error.main }}>
                        <ExcludeIcon sx={{ fontSize: 12 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
              </Box>
            );
          })}
        </Box>
      </Popover>
    </Box>
  );
};

export default DiscoverFacetMap;
