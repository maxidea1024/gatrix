import React from 'react';
import { Box, Typography, Popover, useTheme, alpha } from '@mui/material';
import { useTranslation } from 'react-i18next';

export interface SearchAutocompleteFacet {
  value: string;
  count: number;
}

export interface SearchAutocompletePopoverProps {
  /** Whether the popover is open */
  open: boolean;
  /** Anchor element (the search input container) */
  anchorEl: HTMLElement | null;
  /** Current search query text */
  query: string;
  /** Available field keys for suggestions (e.g. ['severity', 'service', ...]) */
  fields: string[];
  /** Facet values per field key (e.g. { severity: [{value:'error', count:42}] }) */
  facets: Record<string, SearchAutocompleteFacet[]>;
  /** Whether dark mode is enabled */
  isDark: boolean;
  /** Called when user selects a field:value pair */
  onSelectTag: (field: string, value: string) => void;
  /** Called when user selects a field (appends "field:") */
  onSelectField: (field: string) => void;
  /** Called when user selects a syntax token (AND/OR) */
  onSelectSyntax: (syntax: string) => void;
  /** Called to close the popover */
  onClose: () => void;
}

/**
 * Shared 2-stage autocomplete popover for search inputs.
 *
 * Stage 1: Shows field suggestions (severity, service, ...) + AND/OR syntax
 * Stage 2: When user types "field:", shows matching values from facets with percentage bars
 *
 * Used in: ArgusLogsPage, ArgusDiscoverPage
 */
const SearchAutocompletePopover: React.FC<SearchAutocompletePopoverProps> = ({
  open,
  anchorEl,
  query,
  fields,
  facets,
  isDark,
  onSelectTag,
  onSelectField,
  onSelectSyntax,
  onClose,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      disableAutoFocus
      disableEnforceFocus
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      slotProps={{
        paper: {
          sx: {
            width: anchorEl?.offsetWidth || 300,
            mt: 0.5,
            borderRadius: '8px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
            maxHeight: 320,
            overflow: 'auto',
          },
        },
      }}
    >
      <Box sx={{ p: 1 }}>
        {(() => {
          // Stage 2: User typed "field:" — show values from facets
          const colonMatch = query.match(/([\w.-]+):([^\s]*)$/);

          if (colonMatch) {
            const fieldKey = colonMatch[1];
            const partialValue = colonMatch[2].toLowerCase();
            const values = (facets[fieldKey] || []) as SearchAutocompleteFacet[];
            const filtered = partialValue
              ? values.filter(v => v.value?.toLowerCase().includes(partialValue))
              : values;

            if (filtered.length === 0) {
              return (
                <Typography sx={{ px: 1, py: 1, fontSize: '0.75rem', color: 'text.disabled', fontStyle: 'italic' }}>
                  {partialValue
                    ? t('argus.discover.pressEnterToUse', { val: partialValue })
                    : t('argus.discover.typeValue', 'Type a value and press Enter')}
                </Typography>
              );
            }

            const totalCount = filtered.reduce((s, x) => s + x.count, 0);

            return (
              <>
                <Typography variant="caption" sx={{ px: 1, color: 'text.disabled', fontWeight: 600, display: 'block', mb: 0.5 }}>
                  {fieldKey} {t('argus.discover.values', 'values')}
                </Typography>
                {filtered.slice(0, 10).map((v, idx) => {
                  const pctOfTotal = totalCount > 0 ? ((v.count / totalCount) * 100) : 0;
                  return (
                    <Box
                      key={idx}
                      onClick={() => onSelectTag(fieldKey, v.value)}
                      sx={{
                        position: 'relative', px: 1.5, py: 0.5, cursor: 'pointer', borderRadius: '4px',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        overflow: 'hidden',
                        '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.08) },
                      }}
                    >
                      {/* Background bar */}
                      <Box sx={{
                        position: 'absolute', left: 8, top: 2, bottom: 2,
                        width: `${pctOfTotal}%`, minWidth: pctOfTotal > 0 ? 4 : 0,
                        backgroundColor: alpha(theme.palette.primary.main, isDark ? 0.18 : 0.12),
                        borderRadius: '0 3px 3px 0',
                        transition: 'width 0.3s ease',
                      }} />
                      <Typography sx={{
                        zIndex: 1, fontSize: '0.78rem',
                        color: theme.palette.primary.main, fontWeight: 600,
                      }}>
                        {v.value || '(empty)'}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, zIndex: 1 }}>
                        <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: theme.palette.primary.main }}>
                          {pctOfTotal.toFixed(0)}%
                        </Typography>
                        <Typography sx={{ fontSize: '0.65rem', color: 'text.disabled' }}>
                          {v.count.toLocaleString()}
                        </Typography>
                      </Box>
                    </Box>
                  );
                })}
              </>
            );
          }

          // Stage 1: Show field keys + syntax
          const tokens = query.split(/\s+/);
          const lastToken = tokens[tokens.length - 1].toLowerCase();
          const syntax = ['AND', 'OR'];

          const filteredFields = lastToken
            ? fields.filter(f => f.toLowerCase().includes(lastToken))
            : fields;
          const filteredSyntax = lastToken
            ? syntax.filter(s => s.toLowerCase().includes(lastToken))
            : syntax;

          return (
            <>
              {filteredSyntax.length > 0 && (
                <>
                  <Typography variant="caption" sx={{ px: 1, color: 'text.disabled', fontWeight: 600, display: 'block', mb: 0.5, mt: 0.5 }}>
                    {t('argus.discover.syntax', 'Syntax')}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, px: 1, mb: 1 }}>
                    {filteredSyntax.map(s => (
                      <Box
                        key={s}
                        onClick={() => onSelectSyntax(s)}
                        sx={{
                          px: 1.2, py: 0.4, cursor: 'pointer', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700,
                          backgroundColor: alpha(theme.palette.primary.main, 0.1), color: theme.palette.primary.main,
                          border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                          '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.2) },
                        }}
                      >
                        {s}
                      </Box>
                    ))}
                  </Box>
                </>
              )}

              <Typography variant="caption" sx={{ px: 1, color: 'text.disabled', fontWeight: 600, display: 'block', mb: 0.5 }}>
                {t('argus.discover.suggestions', 'Suggested Fields')}
              </Typography>
              {/* has: helper */}
              {(!lastToken || 'has:'.includes(lastToken)) && (
                <Box
                  onClick={() => onSelectField('has')}
                  sx={{
                    px: 1.5, py: 0.5, cursor: 'pointer', borderRadius: '4px', fontSize: '0.78rem',
                    '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.08) },
                  }}
                >
                  <span style={{ color: theme.palette.primary.main }}>has</span>:
                  <span style={{ color: 'text.disabled', fontSize: '0.7rem', marginLeft: 8 }}>
                    {t('argus.discover.hasDesc', 'Find events with this tag')}
                  </span>
                </Box>
              )}
              {filteredFields.map(field => (
                <Box
                  key={field}
                  onClick={() => onSelectField(field)}
                  sx={{
                    px: 1.5, py: 0.5, cursor: 'pointer', borderRadius: '4px', fontSize: '0.78rem',
                    '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.08) },
                  }}
                >
                  <span style={{ color: theme.palette.primary.main }}>{field}</span>:
                </Box>
              ))}
              {filteredFields.length === 0 && (!lastToken || !'has:'.includes(lastToken)) && (
                <Typography sx={{ px: 1, py: 1, fontSize: '0.75rem', color: 'text.disabled', fontStyle: 'italic' }}>
                  {t('argus.discover.noValues', 'No matching values')}
                </Typography>
              )}
            </>
          );
        })()}
      </Box>
    </Popover>
  );
};

export default SearchAutocompletePopover;
