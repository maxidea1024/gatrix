import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Button, IconButton, Popover, Chip,
  MenuItem, Select, TextField, Autocomplete, alpha, useTheme
} from '@mui/material';
import {
  Add as AddIcon,
  Close as CloseIcon,
  AutoFixHigh as MagicIcon,
  WarningAmber as WarningIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

/* ─── Data model ─── */

type RuleType = 'tag' | 'text' | 'has';

interface BaseRule { id: string; connector: 'AND' | 'OR' }
interface TagRule extends BaseRule { type: 'tag'; field: string; op: string; value: string }
interface TextRule extends BaseRule { type: 'text'; contains: boolean; value: string }
interface HasRule extends BaseRule { type: 'has'; field: string }
type Rule = TagRule | TextRule | HasRule;

interface FacetValue {
  value: string;
  count: number;
}

export interface ActiveFilter { key: string; value: string; exclude: boolean; enabled: boolean }

interface ArgusQueryBuilderProps {
  fields: string[];
  query: string;
  facets?: Record<string, FacetValue[]>;
  activeFilters?: ActiveFilter[];
  onApply: (query: string) => void;
  anchorEl: HTMLElement | null;
  onClose: () => void;
}

const TAG_OPS = [
  { value: '=', label: 'is (=)', key: 'is' },
  { value: '!=', label: 'is not (!=)', key: 'isNot' },
  { value: '>', label: 'greater (>)', key: 'gt' },
  { value: '>=', label: 'greater eq (>=)', key: 'gte' },
  { value: '<', label: 'less (<)', key: 'lt' },
  { value: '<=', label: 'less eq (<=)', key: 'lte' },
];

const genId = () => Math.random().toString(36).substring(7);

/* ─── Parser ─── */

function parseQueryToRules(q: string, defaultField: string): { rules: Rule[]; isComplex: boolean } {
  if (!q.trim()) {
    return { rules: [{ id: genId(), type: 'tag', connector: 'AND', field: defaultField, op: '=', value: '' }], isComplex: false };
  }

  // Complex queries with parentheses
  if (q.includes('(') || q.includes(')')) {
    return { rules: [{ id: genId(), type: 'tag', connector: 'AND', field: defaultField, op: '=', value: '' }], isComplex: true };
  }

  // Tokenize: match key:"quoted value", key:value, "quoted text", AND, OR, or bare words
  const tokens: string[] = q.match(/(?:!?[\w.-]+:(?:"[^"]*"|'[^']*'|[^\s]*))|(?:"[^"]*")|(?:[^\s]+)/g) || [];
  const rules: Rule[] = [];
  let nextConnector: 'AND' | 'OR' = 'AND';

  tokens.forEach(token => {
    const upper = token.toUpperCase();
    if (upper === 'AND') { nextConnector = 'AND'; return; }
    if (upper === 'OR') { nextConnector = 'OR'; return; }

    const isNeg = token.startsWith('-') || token.startsWith('!');
    const clean = isNeg ? token.slice(1) : token;
    const colonIdx = clean.indexOf(':');

    if (colonIdx > 0) {
      const field = clean.slice(0, colonIdx);
      let val = clean.slice(colonIdx + 1);
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }

      if (field === 'has') {
        rules.push({ id: genId(), type: 'has', connector: nextConnector, field: val });
      } else {
        let op = isNeg ? '!=' : '=';
        if (val.startsWith('>=')) { op = '>='; val = val.slice(2); }
        else if (val.startsWith('<=')) { op = '<='; val = val.slice(2); }
        else if (val.startsWith('>')) { op = '>'; val = val.slice(1); }
        else if (val.startsWith('<')) { op = '<'; val = val.slice(1); }
        rules.push({ id: genId(), type: 'tag', connector: nextConnector, field, op, value: val });
      }
    } else {
      let textVal = token;
      let contains = true;
      if (textVal.startsWith('-') || textVal.startsWith('!')) { contains = false; textVal = textVal.slice(1); }
      if ((textVal.startsWith('"') && textVal.endsWith('"')) || (textVal.startsWith("'") && textVal.endsWith("'"))) {
        textVal = textVal.slice(1, -1);
      }
      rules.push({ id: genId(), type: 'text', connector: nextConnector, contains, value: textVal });
    }
    nextConnector = 'AND'; // reset
  });

  if (rules.length === 0) {
    rules.push({ id: genId(), type: 'tag', connector: 'AND', field: defaultField, op: '=', value: '' });
  }

  return { rules, isComplex: false };
}

/* ─── Serializer ─── */

function rulesToQuery(rules: Rule[]): string {
  // Filter out incomplete rules (empty values)
  const validRules = rules.filter(rule => {
    if (rule.type === 'tag') return rule.field && rule.value;
    if (rule.type === 'has') return !!rule.field;
    if (rule.type === 'text') return !!rule.value;
    return false;
  });

  const parts: string[] = [];

  validRules.forEach((rule, idx) => {
    if (idx > 0) {
      parts.push(rule.connector);
    }

    switch (rule.type) {
      case 'tag': {
        const isNeg = rule.op === '!=';
        let valStr = rule.value;
        if (['>', '<', '>=', '<='].includes(rule.op)) valStr = rule.op + valStr;
        valStr = `"${valStr}"`;
        parts.push(`${isNeg ? '!' : ''}${rule.field}:${valStr}`);
        break;
      }
      case 'has': {
        parts.push(`has:"${rule.field}"`);
        break;
      }
      case 'text': {
        let v = rule.value;
        if (v.includes(' ')) v = `"${v}"`;
        parts.push(`${!rule.contains ? '!' : ''}${v}`);
        break;
      }
    }
  });

  return parts.join(' ');
}

/* ─── Raw Query Preview ─── */

function escapeSqlString(str: string): string {
  return `'${str.replace(/'/g, "''")}'`;
}

function generateSqlPreview(rules: Rule[], activeFilters?: ActiveFilter[]): string {
  const lines: string[] = [];
  
  // Filter out incomplete rules
  const validRules = rules.filter(rule => {
    if (rule.type === 'tag') return rule.field && rule.value;
    if (rule.type === 'has') return !!rule.field;
    if (rule.type === 'text') return !!rule.value;
    return false;
  });

  // Query Builder Rules
  validRules.forEach((rule, idx) => {
    const prefix = idx === 0 ? 'WHERE ' : `  ${rule.connector.padEnd(3)} `;
    
    switch (rule.type) {
      case 'tag': {
        // e.g. service = 'game-world'
        const op = rule.op === '!=' ? '!=' : rule.op === '=' ? '=' : rule.op;
        lines.push(`${prefix}${rule.field} ${op} ${escapeSqlString(rule.value)}`);
        break;
      }
      case 'has': {
        lines.push(`${prefix}${rule.field} IS NOT NULL`);
        break;
      }
      case 'text': {
        const op = rule.contains ? 'ILIKE' : 'NOT ILIKE';
        lines.push(`${prefix}message ${op} ${escapeSqlString('%' + rule.value + '%')}`);
        break;
      }
    }
  });

  // Active Facets (always ANDed to the query)
  const enabledFilters = (activeFilters || []).filter(f => f.enabled);
  if (enabledFilters.length > 0) {
    if (lines.length > 0) lines.push('');
    lines.push('-- Applied Facets');
    enabledFilters.forEach((f, idx) => {
      const prefix = (lines.length === 1 && idx === 0) ? 'WHERE ' : '  AND ';
      const op = f.exclude ? '!=' : '=';
      lines.push(`${prefix}${f.key} ${op} ${escapeSqlString(f.value)}`);
    });
  }

  return lines.join('\n');
}

const HighlightedQuery: React.FC<{ sql: string; isDark: boolean }> = ({ sql, isDark }) => {
  if (!sql) {
    return (
      <Box sx={{
        fontFamily: '"JetBrains Mono", "Fira Code", monospace', fontSize: '0.72rem',
        p: 1.5, backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.03)',
        borderRadius: 1, border: `1px dashed ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
        color: 'text.disabled', fontStyle: 'italic',
      }}>
        No valid conditions to generate a query.
      </Box>
    );
  }

  // Very basic regex to colorize SQL: keywords, strings, comments
  const renderLine = (line: string, i: number) => {
    if (line.startsWith('--')) {
      return <div key={i} style={{ color: isDark ? '#607d8b' : '#9e9e9e', fontStyle: 'italic' }}>{line}</div>;
    }
    // Replace keywords and strings with styled spans
    // This is safe because we know the generated format exactly
    const parts = line.split(/('(?:[^']|'')*')|(\bWHERE\b|\bAND\b|\bOR\b|\bIS NOT NULL\b|\bILIKE\b|\bNOT ILIKE\b)/g).filter(Boolean);
    
    return (
      <div key={i}>
        {parts.map((p, j) => {
          if (p.startsWith("'") && p.endsWith("'")) {
            return <span key={j} style={{ color: isDark ? '#a5d6a7' : '#2e7d32' }}>{p}</span>;
          }
          if (/^(WHERE|AND|OR|IS NOT NULL|ILIKE|NOT ILIKE)$/.test(p)) {
            return <span key={j} style={{ color: isDark ? '#ffb74d' : '#ed6c02', fontWeight: 700 }}>{p}</span>;
          }
          // fields and operators
          return <span key={j} style={{ color: isDark ? '#e0e0e0' : '#424242' }}>{p}</span>;
        })}
      </div>
    );
  };

  return (
    <Box sx={{
      fontFamily: '"JetBrains Mono", "Fira Code", monospace', fontSize: '0.72rem', lineHeight: 1.5,
      p: 1.5, backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.03)',
      borderRadius: 1, border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
      whiteSpace: 'pre', overflowX: 'auto'
    }}>
      {sql.split('\n').map((line, i) => renderLine(line, i))}
    </Box>
  );
};

/* ─── Component ─── */

const ArgusQueryBuilder: React.FC<ArgusQueryBuilderProps> = ({ fields, query, facets = {}, activeFilters, onApply, anchorEl, onClose }) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';

  const [rules, setRules] = useState<Rule[]>([]);
  const [isComplex, setIsComplex] = useState(false);

  useEffect(() => {
    if (!anchorEl) return;
    const result = parseQueryToRules(query, fields[0] || 'level');
    setRules(result.rules);
    setIsComplex(result.isComplex);
  }, [anchorEl, query, fields]);

  const updateRule = (id: string, patch: Partial<Rule>) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, ...patch } as Rule : r));
  };

  const removeRule = (id: string) => {
    setRules(prev => {
      const filtered = prev.filter(r => r.id !== id);
      return filtered.length > 0 ? filtered : [{ id: genId(), type: 'tag', connector: 'AND', field: fields[0] || 'level', op: '=', value: '' } as TagRule];
    });
  };

  const addRule = (type: RuleType) => {
    const base = { id: genId(), connector: 'AND' as const };
    switch (type) {
      case 'tag':
        setRules(prev => [...prev, { ...base, type: 'tag', field: fields[0] || 'level', op: '=', value: '' }]);
        break;
      case 'has':
        setRules(prev => [...prev, { ...base, type: 'has', field: fields[0] || '' }]);
        break;
      case 'text':
        setRules(prev => [...prev, { ...base, type: 'text', contains: true, value: '' }]);
        break;
    }
  };

  const handleApply = () => {
    const q = rulesToQuery(rules);
    onApply(q);
    onClose();
  };

  const rowSx = { display: 'flex', gap: 0.75, alignItems: 'center' };
  const selectSx = { height: 30, fontSize: '0.75rem' };
  const inputSx = { height: 30, fontSize: '0.75rem' };

  return (
    <Popover
      open={Boolean(anchorEl)}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      slotProps={{ paper: { sx: { width: 600, mt: 1, borderRadius: '8px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' } } }}
    >
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <MagicIcon sx={{ fontSize: 20, color: theme.palette.primary.main }} />
            <Typography sx={{ fontWeight: 700, fontSize: '0.9rem' }}>
              {t('argus.builder.title', 'Visual Query Builder')}
            </Typography>
          </Box>
          <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
        </Box>

        {isComplex && (
          <Box sx={{ p: 1.5, borderRadius: 1, backgroundColor: alpha(theme.palette.warning.main, 0.1), display: 'flex', gap: 1, alignItems: 'flex-start' }}>
            <WarningIcon sx={{ fontSize: 18, color: theme.palette.warning.main, mt: 0.2 }} />
            <Typography sx={{ fontSize: '0.75rem', color: theme.palette.warning.main }}>
              {t('argus.builder.complexWarning', 'Complex query detected (Parentheses). The visual builder cannot parse it. Using the builder will overwrite your query.')}
            </Typography>
          </Box>
        )}

        {/* Rules */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {rules.map((rule, idx) => (
            <React.Fragment key={rule.id}>
              {/* Connector between rules */}
              {idx > 0 && (
                <Box sx={{ display: 'flex', alignItems: 'center', py: 0.25, pl: 1 }}>
                  <Select
                    size="small"
                    value={rule.connector}
                    onChange={e => updateRule(rule.id, { connector: e.target.value as 'AND' | 'OR' })}
                    sx={{
                      height: 22, fontSize: '0.65rem', fontWeight: 700,
                      color: rule.connector === 'OR' ? theme.palette.warning.main : theme.palette.info.main,
                      '& .MuiSelect-select': { py: 0, px: 1 },
                    }}
                    variant="standard"
                    disableUnderline
                  >
                    <MenuItem value="AND" sx={{ fontSize: '0.7rem', fontWeight: 700 }}>AND</MenuItem>
                    <MenuItem value="OR" sx={{ fontSize: '0.7rem', fontWeight: 700 }}>OR</MenuItem>
                  </Select>
                </Box>
              )}

              {/* Rule row */}
              <Box sx={rowSx}>
                {rule.type === 'tag' && (
                  <>
                    <Select
                      size="small" value={rule.field}
                      onChange={e => updateRule(rule.id, { field: e.target.value })}
                      sx={{ width: 130, ...selectSx }}
                      MenuProps={{ PaperProps: { sx: { maxHeight: 250 } } }}
                    >
                      {fields.map(f => <MenuItem key={f} value={f} sx={{ fontSize: '0.75rem' }}>{f}</MenuItem>)}
                      {!fields.includes(rule.field) && rule.field && <MenuItem value={rule.field} sx={{ fontSize: '0.75rem' }}>{rule.field}</MenuItem>}
                    </Select>
                    <Select
                      size="small" value={rule.op}
                      onChange={e => updateRule(rule.id, { op: e.target.value })}
                      sx={{ width: 120, ...selectSx }}
                    >
                      {TAG_OPS.map(o => (
                        <MenuItem key={o.value} value={o.value} sx={{ fontSize: '0.75rem' }}>
                          {t(`argus.builder.op.${o.key}`, o.label)}
                        </MenuItem>
                      ))}
                    </Select>
                    <Autocomplete
                      freeSolo
                      size="small"
                      options={(facets[rule.field] || []).map(v => v.value)}
                      value={rule.value || ''}
                      onInputChange={(_e, val) => updateRule(rule.id, { value: val })}
                      onChange={(_e, val) => updateRule(rule.id, { value: val || '' })}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          placeholder="value..."
                          error={!rule.value}
                          InputProps={{ ...params.InputProps, sx: inputSx }}
                        />
                      )}
                      renderOption={(props, option) => {
                        const fv = (facets[rule.field] || []).find(v => v.value === option);
                        return (
                          <Box component="li" {...props} sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', px: 1.5, py: 0.5 }}>
                            <span>{option}</span>
                            {fv && <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', ml: 1 }}>{fv.count.toLocaleString()}</Typography>}
                          </Box>
                        );
                      }}
                      slotProps={{ paper: { sx: { fontSize: '0.75rem', maxHeight: 200 } } }}
                      sx={{ flex: 1 }}
                    />
                  </>
                )}

                {rule.type === 'has' && (
                  <>
                    <Chip
                      label="has:"
                      size="small"
                      sx={{
                        fontWeight: 700, fontSize: '0.75rem', height: 30,
                        backgroundColor: alpha(theme.palette.success.main, 0.15),
                        color: theme.palette.success.main,
                        border: `1px solid ${alpha(theme.palette.success.main, 0.3)}`,
                      }}
                    />
                    <Select
                      size="small" value={rule.field}
                      onChange={e => updateRule(rule.id, { field: e.target.value })}
                      sx={{ flex: 1, ...selectSx }}
                      displayEmpty
                      MenuProps={{ PaperProps: { sx: { maxHeight: 250 } } }}
                    >
                      <MenuItem value="" disabled sx={{ fontSize: '0.75rem' }}>
                        {t('argus.builder.selectField', 'Select field...')}
                      </MenuItem>
                      {fields.map(f => <MenuItem key={f} value={f} sx={{ fontSize: '0.75rem' }}>{f}</MenuItem>)}
                      {rule.field && !fields.includes(rule.field) && <MenuItem value={rule.field} sx={{ fontSize: '0.75rem' }}>{rule.field}</MenuItem>}
                    </Select>
                  </>
                )}

                {rule.type === 'text' && (
                  <>
                    <Select
                      size="small"
                      value={rule.contains ? 'contains' : 'not_contains'}
                      onChange={e => updateRule(rule.id, { contains: e.target.value === 'contains' })}
                      sx={{ width: 150, ...selectSx }}
                    >
                      <MenuItem value="contains" sx={{ fontSize: '0.75rem' }}>{t('argus.builder.contains', 'Contains')}</MenuItem>
                      <MenuItem value="not_contains" sx={{ fontSize: '0.75rem' }}>{t('argus.builder.notContains', 'Not contains')}</MenuItem>
                    </Select>
                    <TextField
                      size="small" value={rule.value} placeholder={t('argus.builder.textPlaceholder', 'Search text...')}
                      onChange={e => updateRule(rule.id, { value: e.target.value })}
                      InputProps={{ sx: inputSx }}
                      sx={{ flex: 1 }}
                    />
                  </>
                )}

                <IconButton size="small" onClick={() => removeRule(rule.id)} sx={{ p: 0.3 }}>
                  <CloseIcon fontSize="small" sx={{ color: 'text.disabled', fontSize: 16 }} />
                </IconButton>
              </Box>
            </React.Fragment>
          ))}
        </Box>

        {/* Add buttons */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
          <Button
            startIcon={<AddIcon />} size="small"
            onClick={() => addRule('tag')}
            sx={{ textTransform: 'none', fontSize: '0.7rem', px: 1 }}
          >
            {t('argus.builder.addTagFilter', 'Tag Filter')}
          </Button>
          <Button
            startIcon={<AddIcon />} size="small"
            onClick={() => addRule('has')}
            sx={{ textTransform: 'none', fontSize: '0.7rem', px: 1 }}
          >
            {t('argus.builder.addHasFilter', 'Has Field')}
          </Button>
          <Button
            startIcon={<AddIcon />} size="small"
            onClick={() => addRule('text')}
            sx={{ textTransform: 'none', fontSize: '0.7rem', px: 1 }}
          >
            {t('argus.builder.addTextFilter', 'Text Search')}
          </Button>
        </Box>

        {/* Raw Query Preview */}
        <Box sx={{ mt: 2, pt: 1.5, borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
          <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: 'text.secondary', mb: 1 }}>
            {t('argus.builder.queryPreviewTitle', 'Generated Query Preview')}
          </Typography>
          <HighlightedQuery sql={generateSqlPreview(rules, activeFilters)} isDark={isDark} />
        </Box>

        {/* Actions */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1, mt: 1.5 }}>
          {rules.some(r => (r.type === 'tag' && !r.value) || (r.type === 'text' && !r.value)) && (
            <Typography sx={{ fontSize: '0.7rem', color: 'warning.main', mr: 'auto' }}>
              {t('argus.builder.emptyWarning', 'Empty value rules will be ignored')}
            </Typography>
          )}
          <Button size="small" onClick={onClose} sx={{ textTransform: 'none', fontWeight: 600 }}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button size="small" variant="contained" onClick={handleApply} sx={{ textTransform: 'none', fontWeight: 600 }}>
            {t('common.apply', 'Apply')}
          </Button>
        </Box>
      </Box>
    </Popover>
  );
};

export default ArgusQueryBuilder;
