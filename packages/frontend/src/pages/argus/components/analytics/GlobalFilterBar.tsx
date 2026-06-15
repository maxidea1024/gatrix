/**
 * GlobalFilterBar — Displays active global analytics filters as chips
 * with add/remove functionality. Sits in AnalyticsLayout toolbar area.
 */
import React, { useState } from 'react';
import {
  Box,
  Chip,
  Button,
  Popover,
  Typography,
  IconButton,
  useTheme,
  alpha,
} from '@mui/material';
import {
  FilterList as FilterIcon,
  Add as AddIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import {
  useGlobalAnalyticsFilter,
  type GlobalFilter,
} from '@/hooks/useGlobalAnalyticsFilter';
import PropertyPicker from './PropertyPicker';
import InlineSelect from './InlineSelect';
import PropertyValueInput from './PropertyValueInput';

interface GlobalFilterBarProps {
  projectId: string;
}

const GlobalFilterBar: React.FC<GlobalFilterBarProps> = ({ projectId }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { t } = useTranslation();
  const { filters, addFilter, updateFilter, removeFilter, clearFilters } =
    useGlobalAnalyticsFilter();

  const OPERATORS = [
    { value: 'is', label: t('argus.analytics.op.is', 'is') },
    { value: 'is_not', label: t('argus.analytics.op.isNot', 'is not') },
    { value: 'contains', label: t('argus.analytics.op.contains', 'contains') },
    { value: 'not_contains', label: t('argus.analytics.op.notContains', 'does not contain') },
  ];

  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [draft, setDraft] = useState<GlobalFilter>({
    property: '',
    operator: 'is',
    value: '',
  });

  const handleOpenAdd = (e: React.MouseEvent<HTMLElement>) => {
    setDraft({ property: '', operator: 'is', value: '' });
    setEditingIdx(null);
    setAnchorEl(e.currentTarget);
  };

  const handleEditFilter = (e: React.MouseEvent<HTMLElement>, idx: number) => {
    setDraft({ ...filters[idx] });
    setEditingIdx(idx);
    setAnchorEl(e.currentTarget);
  };

  const handleSave = () => {
    if (!draft.property) return;
    if (editingIdx !== null) {
      updateFilter(editingIdx, draft);
    } else {
      addFilter(draft);
    }
    setAnchorEl(null);
  };

  const formatLabel = (f: GlobalFilter) => {
    const op = OPERATORS.find((o) => o.value === f.operator)?.label || f.operator;
    return `${f.property} ${op} ${f.value}`;
  };

  if (filters.length === 0) {
    return (
      <Button
        size="small"
        startIcon={<FilterIcon sx={{ fontSize: 16 }} />}
        onClick={handleOpenAdd}
        sx={{
          textTransform: 'none',
          color: 'text.secondary',
          fontSize: '0.78rem',
          fontWeight: 500,
          px: 1,
          borderRadius: 1.5,
          '&:hover': {
            bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
          },
        }}
      >
        {t('argus.analytics.addFilter', 'Filter')}
        {renderPopover()}
      </Button>
    );
  }

  function renderPopover() {
    return (
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={(e) => { if (e) (e as any).stopPropagation?.(); setAnchorEl(null); }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: {
              p: 2,
              borderRadius: 2,
              minWidth: 320,
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
            },
          },
        }}
      >
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5, fontSize: '0.82rem' }}>
          {editingIdx !== null
            ? t('argus.analytics.editFilter', 'Edit Filter')
            : t('argus.analytics.addFilter', 'Add Filter')}
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <PropertyPicker
            projectId={projectId}
            value={draft.property ? [draft.property] : []}
            onChange={(val) => setDraft({ ...draft, property: val[0] || '' })}
            emptyLabel={t('argus.analytics.property', 'Property')}
            highlightEmpty
            maxItems={1}
          />

          <InlineSelect
            value={draft.operator}
            onChange={(val) => setDraft({ ...draft, operator: val })}
            options={OPERATORS}
          />

          <PropertyValueInput
            projectId={projectId}
            property={draft.property}
            value={draft.value}
            onChange={(val) => setDraft({ ...draft, value: val })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
            }}
          />

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 0.5 }}>
            <Button
              size="small"
              onClick={(e) => { e.stopPropagation(); setAnchorEl(null); }}
              sx={{ textTransform: 'none', fontSize: '0.78rem' }}
            >
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              size="small"
              variant="contained"
              onClick={(e) => { e.stopPropagation(); handleSave(); }}
              disabled={!draft.property}
              sx={{ textTransform: 'none', fontSize: '0.78rem', fontWeight: 700 }}
            >
              {editingIdx !== null ? t('common.save', 'Save') : t('common.add', 'Add')}
            </Button>
          </Box>
        </Box>
      </Popover>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        flexWrap: 'wrap',
      }}
    >
      <FilterIcon sx={{ fontSize: 16, color: 'text.secondary', mr: 0.25 }} />
      {filters.map((f, idx) => (
        <Chip
          key={idx}
          label={formatLabel(f)}
          size="small"
          onClick={(e) => handleEditFilter(e, idx)}
          onDelete={() => removeFilter(idx)}
          sx={{
            height: 24,
            fontSize: '0.72rem',
            fontWeight: 500,
            backgroundColor: alpha(theme.palette.primary.main, isDark ? 0.12 : 0.08),
            color: theme.palette.primary.main,
            borderRadius: 1.5,
            '& .MuiChip-deleteIcon': {
              fontSize: 14,
              color: alpha(theme.palette.primary.main, 0.6),
              '&:hover': { color: theme.palette.primary.main },
            },
          }}
        />
      ))}
      <IconButton
        size="small"
        onClick={handleOpenAdd}
        sx={{
          p: 0.25,
          color: 'text.secondary',
          '&:hover': { color: theme.palette.primary.main },
        }}
      >
        <AddIcon sx={{ fontSize: 16 }} />
      </IconButton>
      {filters.length > 1 && (
        <Button
          size="small"
          onClick={clearFilters}
          sx={{
            textTransform: 'none',
            fontSize: '0.68rem',
            color: 'text.disabled',
            minWidth: 0,
            px: 0.5,
          }}
        >
          {t('common.clearAll', 'Clear all')}
        </Button>
      )}
      {renderPopover()}
    </Box>
  );
};

export default GlobalFilterBar;
