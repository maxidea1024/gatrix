import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Button, IconButton, Popover,
  MenuItem, Select, TextField, Tooltip, alpha, useTheme
} from '@mui/material';
import {
  Add as AddIcon,
  Close as CloseIcon,
  FilterList as FilterIcon,
  AutoFixHigh as MagicIcon,
  WarningAmber as WarningIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

interface TagRule {
  id: string;
  field: string;
  op: string;
  value: string;
}

interface TextRule {
  id: string;
  contains: boolean;
  value: string;
}

interface ArgusQueryBuilderProps {
  fields: string[];
  query: string;
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

const generateId = () => Math.random().toString(36).substring(7);

const ArgusQueryBuilder: React.FC<ArgusQueryBuilderProps> = ({ fields, query, onApply, anchorEl, onClose }) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';

  const [logicalOp, setLogicalOp] = useState<'AND' | 'OR'>('AND');
  const [tagRules, setTagRules] = useState<TagRule[]>([]);
  const [textRules, setTextRules] = useState<TextRule[]>([]);
  const [isComplex, setIsComplex] = useState(false);

  // Parse initial query
  useEffect(() => {
    if (!anchorEl) return;
    
    const parseQuery = (q: string) => {
      if (!q.trim()) {
        setTagRules([{ id: generateId(), field: 'level', op: '=', value: '' }]);
        setTextRules([]);
        setLogicalOp('AND');
        setIsComplex(false);
        return;
      }

      // Check complexity
      if (q.includes(' OR ') || q.includes('(') || q.includes(')')) {
        setIsComplex(true);
        setTagRules([{ id: generateId(), field: 'level', op: '=', value: '' }]);
        setTextRules([]);
        setLogicalOp('AND');
        return;
      }

      setIsComplex(false);
      const tokens: string[] = q.match(/("[^"]+"|[^"\s]+)/g) || [];
      const newTags: TagRule[] = [];
      const newTexts: TextRule[] = [];

      tokens.forEach(token => {
        // Strip AND keyword (since we assume AND for simple queries)
        if (token.toUpperCase() === 'AND') return;

        const isNegated = token.startsWith('-');
        const cleanToken = isNegated ? token.slice(1) : token;
        
        const colonIdx = cleanToken.indexOf(':');
        if (colonIdx > 0 && cleanToken.slice(0, colonIdx) !== 'has') {
          const field = cleanToken.slice(0, colonIdx);
          let val = cleanToken.slice(colonIdx + 1);
          // remove quotes if any
          if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
          
          let op = isNegated ? '!=' : '=';
          
          // Check for > < >= <=
          if (val.startsWith('>=')) { op = '>='; val = val.slice(2); }
          else if (val.startsWith('<=')) { op = '<='; val = val.slice(2); }
          else if (val.startsWith('>')) { op = '>'; val = val.slice(1); }
          else if (val.startsWith('<')) { op = '<'; val = val.slice(1); }

          newTags.push({ id: generateId(), field, op, value: val });
        } else {
          // text search or 'has:' which we treat as raw for simplicity unless we want to map it
          let textVal = token;
          let contains = true;
          if (token.startsWith('-')) {
            contains = false;
            textVal = token.slice(1);
          }
          if (textVal.startsWith('"') && textVal.endsWith('"')) textVal = textVal.slice(1, -1);
          
          newTexts.push({ id: generateId(), contains, value: textVal });
        }
      });

      if (newTags.length === 0 && newTexts.length === 0) {
        newTags.push({ id: generateId(), field: 'level', op: '=', value: '' });
      }

      setTagRules(newTags);
      setTextRules(newTexts);
      setLogicalOp('AND');
    };

    parseQuery(query);
  }, [anchorEl, query]);

  const handleApply = () => {
    const parts: string[] = [];
    
    tagRules.forEach(r => {
      if (!r.field || !r.value) return;
      const isNeg = r.op === '!=';
      let valStr = r.value;
      if (['>', '<', '>=', '<='].includes(r.op)) {
        valStr = r.op + valStr;
      }
      if (valStr.includes(' ')) valStr = `"${valStr}"`;
      parts.push(`${isNeg ? '-' : ''}${r.field}:${valStr}`);
    });

    textRules.forEach(r => {
      if (!r.value) return;
      let valStr = r.value;
      if (valStr.includes(' ')) valStr = `"${valStr}"`;
      parts.push(`${!r.contains ? '-' : ''}${valStr}`);
    });

    const finalQuery = parts.join(logicalOp === 'AND' ? ' ' : ' OR ');
    onApply(finalQuery);
    onClose();
  };

  return (
    <Popover
      open={Boolean(anchorEl)}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      slotProps={{ paper: { sx: { width: 550, mt: 1, borderRadius: '8px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' } } }}
    >
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
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
              {t('argus.builder.complexWarning', 'Complex query detected (OR / Parentheses). The visual builder cannot parse it. Using the builder will overwrite your query.')}
            </Typography>
          </Box>
        )}

        {/* Global Operator */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 600 }}>{t('argus.builder.match', 'Match')}</Typography>
          <Select
            size="small"
            value={logicalOp}
            onChange={e => setLogicalOp(e.target.value as any)}
            sx={{ height: 28, fontSize: '0.75rem', fontWeight: 700, minWidth: 80 }}
          >
            <MenuItem value="AND" sx={{ fontSize: '0.75rem' }}>ALL (AND)</MenuItem>
            <MenuItem value="OR" sx={{ fontSize: '0.75rem' }}>ANY (OR)</MenuItem>
          </Select>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 600 }}>{t('argus.builder.conditions', 'of the following rules:')}</Typography>
        </Box>

        {/* Tag Filters */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {tagRules.map((rule, idx) => (
            <Box key={rule.id} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Select
                size="small"
                value={rule.field}
                onChange={e => setTagRules(prev => prev.map(r => r.id === rule.id ? { ...r, field: e.target.value } : r))}
                sx={{ width: 140, height: 32, fontSize: '0.75rem' }}
                MenuProps={{ PaperProps: { sx: { maxHeight: 250 } } }}
              >
                {fields.map(f => <MenuItem key={f} value={f} sx={{ fontSize: '0.75rem' }}>{f}</MenuItem>)}
                {!fields.includes(rule.field) && rule.field && <MenuItem value={rule.field} sx={{ fontSize: '0.75rem' }}>{rule.field}</MenuItem>}
              </Select>

              <Select
                size="small"
                value={rule.op}
                onChange={e => setTagRules(prev => prev.map(r => r.id === rule.id ? { ...r, op: e.target.value } : r))}
                sx={{ width: 140, height: 32, fontSize: '0.75rem' }}
              >
                {TAG_OPS.map(o => (
                  <MenuItem key={o.value} value={o.value} sx={{ fontSize: '0.75rem' }}>
                    {t(`argus.builder.op.${o.key}`, o.label)}
                  </MenuItem>
                ))}
              </Select>

              <TextField
                size="small"
                value={rule.value}
                onChange={e => setTagRules(prev => prev.map(r => r.id === rule.id ? { ...r, value: e.target.value } : r))}
                placeholder="value..."
                InputProps={{ sx: { height: 32, fontSize: '0.75rem'} }}
                sx={{ flex: 1 }}
              />

              <IconButton size="small" onClick={() => setTagRules(prev => prev.filter(r => r.id !== rule.id))}>
                <CloseIcon fontSize="small" sx={{ color: 'text.disabled' }} />
              </IconButton>
            </Box>
          ))}
          <Button
            startIcon={<AddIcon />} size="small"
            onClick={() => setTagRules(prev => [...prev, { id: generateId(), field: fields[0] || 'level', op: '=', value: '' }])}
            sx={{ alignSelf: 'flex-start', textTransform: 'none', fontSize: '0.75rem', px: 1, mt: 0.5 }}
          >
            {t('argus.builder.addTagFilter', 'Add Tag Filter')}
          </Button>
        </Box>

        {/* Text Search Filters */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1, pt: 2, borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
          {textRules.map((rule, idx) => (
            <Box key={rule.id} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Select
                size="small"
                value={rule.contains ? 'contains' : 'not_contains'}
                onChange={e => setTextRules(prev => prev.map(r => r.id === rule.id ? { ...r, contains: e.target.value === 'contains' } : r))}
                sx={{ width: 140, height: 32, fontSize: '0.75rem' }}
              >
                <MenuItem value="contains" sx={{ fontSize: '0.75rem' }}>{t('argus.builder.contains', 'Line contains')}</MenuItem>
                <MenuItem value="not_contains" sx={{ fontSize: '0.75rem' }}>{t('argus.builder.notContains', 'Does not contain')}</MenuItem>
              </Select>

              <TextField
                size="small"
                value={rule.value}
                onChange={e => setTextRules(prev => prev.map(r => r.id === rule.id ? { ...r, value: e.target.value } : r))}
                placeholder="Search text..."
                InputProps={{ sx: { height: 32, fontSize: '0.75rem'} }}
                sx={{ flex: 1 }}
              />

              <IconButton size="small" onClick={() => setTextRules(prev => prev.filter(r => r.id !== rule.id))}>
                <CloseIcon fontSize="small" sx={{ color: 'text.disabled' }} />
              </IconButton>
            </Box>
          ))}
          <Button
            startIcon={<AddIcon />} size="small"
            onClick={() => setTextRules(prev => [...prev, { id: generateId(), contains: true, value: '' }])}
            sx={{ alignSelf: 'flex-start', textTransform: 'none', fontSize: '0.75rem', px: 1, mt: 0.5 }}
          >
            {t('argus.builder.addTextFilter', 'Add Text Filter')}
          </Button>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
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
