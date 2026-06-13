import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
  Select,
  MenuItem,
  TextField,
  useTheme,
  Divider,
} from '@mui/material';
import {
  Close as CloseIcon,
  DeleteOutline as DeleteIcon,
  DragIndicator as DragIcon,
  Add as AddIcon,
  Functions as EquationIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

/* ─── Types ─── */

interface ColumnEntry {
  id: string; // unique key for dnd-kit
  expression: string; // e.g. "count()" or "level"
  alias: string; // custom display name
}

interface ColumnEditorModalProps {
  open: boolean;
  onClose: () => void;
  fields: string[];
  availableColumns: string[];
  availableAggregates: string[];
  onApply: (newFields: string[]) => void;
}

/* ─── Helpers ─── */

let _idCounter = 0;
const nextId = () => `col-${++_idCounter}`;

/** Parse "count() AS errors" → { expression: "count()", alias: "errors" } */
function parseField(field: string): Omit<ColumnEntry, 'id'> {
  const m = field.match(/^(.+?)\s+AS\s+(\w+)$/i);
  if (m) return { expression: m[1].trim(), alias: m[2].trim() };
  return { expression: field.trim(), alias: '' };
}

/** Parse an expression like "uniq(user_id)" into func="uniq" and param="user_id" */
function parseExpression(expr: string) {
  const m = expr.match(/^(\w+)\((.*?)\)$/);
  if (m) return { func: m[1], param: m[2] };
  return { func: null, param: null };
}

/** Serialize back to field string */
function serializeEntry(e: ColumnEntry): string {
  return e.alias ? `${e.expression} AS ${e.alias}` : e.expression;
}

/* ─── Sortable Row ─── */

const SortableColumnRow: React.FC<{
  entry: ColumnEntry;
  columns: string[];
  aggregates: string[];
  isDark: boolean;
  onChangeExpr: (id: string, expr: string) => void;
  onChangeAlias: (id: string, alias: string) => void;
  onRemove: (id: string) => void;
  aliasPlaceholder: string;
}> = ({
  entry,
  columns,
  aggregates,
  isDark,
  onChangeExpr,
  onChangeAlias,
  onRemove,
  aliasPlaceholder,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: entry.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 'auto',
  };

  const parsed = parseExpression(entry.expression);
  const isFunc = parsed.func !== null && aggregates.includes(parsed.func);
  const baseValue = isFunc ? parsed.func : entry.expression;
  const paramValue = parsed.param;

  return (
    <Box
      ref={setNodeRef}
      style={style}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        p: 0.75,
        px: 1,
        borderRadius: 1.5,
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
        backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#fff',
        '&:hover': {
          borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)',
        },
      }}
    >
      {/* Drag handle */}
      <Box
        {...attributes}
        {...listeners}
        sx={{
          cursor: 'grab',
          display: 'flex',
          alignItems: 'center',
          color: 'text.disabled',
          flexShrink: 0,
          '&:active': { cursor: 'grabbing' },
        }}
      >
        <DragIcon sx={{ fontSize: 18 }} />
      </Box>

      {/* Equation: free-text input */}
      {entry.expression.startsWith('equation|') ? (
        <TextField
          size="small"
          value={entry.expression.replace('equation|', '')}
          onChange={(e) => onChangeExpr(entry.id, `equation|${e.target.value}`)}
          placeholder="e.g. count() / uniq(user_id)"
          sx={{
            flex: 2,
            minWidth: 300,
            '& .MuiOutlinedInput-root': {
              fontSize: '0.82rem',
              fontFamily: 'monospace',
              backgroundColor: isDark
                ? 'rgba(255,152,0,0.04)'
                : 'rgba(255,152,0,0.03)',
            },
            '& .MuiOutlinedInput-input': { py: 0.75 },
          }}
          InputProps={{
            startAdornment: (
              <Typography
                sx={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  color: '#ff9800',
                  mr: 1,
                  whiteSpace: 'nowrap',
                }}
              >
                ƒ(x)
              </Typography>
            ),
          }}
        />
      ) : (
        <>
          {/* Field / Function Selector */}
          <Select
            size="small"
            value={baseValue}
            onChange={(e) => {
              const val = e.target.value;
              if (aggregates.includes(val)) {
                onChangeExpr(
                  entry.id,
                  val === 'count' ? 'count()' : `${val}(${columns[0] || '*'})`
                );
              } else {
                onChangeExpr(entry.id, val);
              }
            }}
            sx={{
              flex: 1,
              minWidth: 140,
              '& .MuiSelect-select': { py: 0.75, fontSize: '0.82rem' },
            }}
            MenuProps={{ PaperProps: { sx: { maxHeight: 300 } } }}
          >
            <MenuItem
              disabled
              sx={{
                fontSize: '0.75rem',
                fontWeight: 'bold',
                color: 'text.secondary',
              }}
            >
              Functions
            </MenuItem>
            {aggregates.map((agg) => (
              <MenuItem
                key={`agg-${agg}`}
                value={agg}
                sx={{ fontSize: '0.82rem', pl: 3 }}
              >
                {agg}
              </MenuItem>
            ))}
            <MenuItem
              disabled
              sx={{
                fontSize: '0.75rem',
                fontWeight: 'bold',
                color: 'text.secondary',
                mt: 1,
              }}
            >
              Columns
            </MenuItem>
            {columns.map((col) => (
              <MenuItem
                key={`col-${col}`}
                value={col}
                sx={{ fontSize: '0.82rem', pl: 3 }}
              >
                {col}
              </MenuItem>
            ))}
          </Select>

          {/* Parameter Selector (if function) */}
          {isFunc && baseValue !== 'count' && (
            <Select
              size="small"
              value={paramValue || columns[0] || ''}
              onChange={(e) => {
                onChangeExpr(entry.id, `${baseValue}(${e.target.value})`);
              }}
              sx={{
                flex: 1,
                minWidth: 140,
                '& .MuiSelect-select': { py: 0.75, fontSize: '0.82rem' },
              }}
              MenuProps={{ PaperProps: { sx: { maxHeight: 300 } } }}
            >
              {columns.map((col) => (
                <MenuItem
                  key={`param-${col}`}
                  value={col}
                  sx={{ fontSize: '0.82rem' }}
                >
                  {col}
                </MenuItem>
              ))}
            </Select>
          )}
          {(!isFunc || baseValue === 'count') && (
            <Box
              sx={{ flex: 1, minWidth: 140 }}
            /> /* Spacer to align alias input */
          )}
        </>
      )}

      {/* Alias input */}
      <TextField
        size="small"
        placeholder={aliasPlaceholder}
        value={entry.alias}
        onChange={(e) => onChangeAlias(entry.id, e.target.value)}
        sx={{
          width: 160,
          flexShrink: 0,
          '& .MuiOutlinedInput-root': { fontSize: '0.8rem' },
          '& .MuiOutlinedInput-input': { py: 0.75 },
        }}
      />

      {/* Delete button */}
      <IconButton
        size="small"
        onClick={() => onRemove(entry.id)}
        sx={{
          flexShrink: 0,
          color: 'text.disabled',
          '&:hover': { color: '#f44336' },
        }}
      >
        <DeleteIcon sx={{ fontSize: 18 }} />
      </IconButton>
    </Box>
  );
};

/* ─── Main Modal ─── */

const ColumnEditorModal: React.FC<ColumnEditorModalProps> = ({
  open,
  onClose,
  fields,
  availableColumns,
  availableAggregates,
  onApply,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';

  const [entries, setEntries] = useState<ColumnEntry[]>([]);

  // Sync from parent on open
  useEffect(() => {
    if (open) {
      setEntries(fields.map((f) => ({ id: nextId(), ...parseField(f) })));
    }
  }, [open, fields]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setEntries((prev) => {
        const oldIdx = prev.findIndex((e) => e.id === active.id);
        const newIdx = prev.findIndex((e) => e.id === over.id);
        return arrayMove(prev, oldIdx, newIdx);
      });
    }
  }, []);

  const handleChangeExpr = useCallback((id: string, expr: string) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, expression: expr } : e))
    );
  }, []);

  const handleChangeAlias = useCallback((id: string, alias: string) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, alias } : e)));
  }, []);

  const handleRemove = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const handleAddColumn = () => {
    const defaultExpr = availableColumns[0] || 'count()';
    setEntries((prev) => [
      ...prev,
      { id: nextId(), expression: defaultExpr, alias: '' },
    ]);
  };

  const handleAddEquation = () => {
    setEntries((prev) => [
      ...prev,
      {
        id: nextId(),
        expression: 'equation|count() / uniq(user_id)',
        alias: '',
      },
    ]);
  };

  const handleApply = () => {
    if (entries.length > 0) {
      onApply(entries.map(serializeEntry));
      onClose();
    }
  };

  const aliasPlaceholder = t(
    'argus.discover.column.alias',
    'Column name (alias)'
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden' } }}
    >
      {/* Title */}
      <DialogTitle
        sx={{
          m: 0,
          py: 1.5,
          px: 2.5,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        }}
      >
        <Typography
          variant="subtitle1"
          fontWeight={700}
          sx={{ fontSize: '0.95rem' }}
        >
          {t('argus.discover.column.edit', 'Edit Columns')}
        </Typography>
        <IconButton
          onClick={onClose}
          size="small"
          sx={{ color: 'text.secondary' }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      {/* Content */}
      <DialogContent sx={{ p: 0 }}>
        <Box sx={{ p: 2.5 }}>
          {/* Column header labels */}
          <Box sx={{ display: 'flex', gap: 1, mb: 1, pl: 4.5 }}>
            <Typography
              variant="caption"
              sx={{
                flex: 1,
                minWidth: 140,
                color: 'text.disabled',
                fontSize: '0.68rem',
                textTransform: 'uppercase',
                fontWeight: 600,
              }}
            >
              {t('argus.discover.column.field', 'Field / Function')}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                flex: 1,
                minWidth: 140,
                color: 'text.disabled',
                fontSize: '0.68rem',
                textTransform: 'uppercase',
                fontWeight: 600,
              }}
            >
              {t('argus.discover.column.param', 'Parameter')}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                width: 160,
                color: 'text.disabled',
                fontSize: '0.68rem',
                textTransform: 'uppercase',
                fontWeight: 600,
              }}
            >
              {t('argus.discover.column.alias', 'Alias')}
            </Typography>
            <Box sx={{ width: 34 }} /> {/* spacer for delete btn */}
          </Box>

          {/* Sortable column list */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={entries.map((e) => e.id)}
              strategy={verticalListSortingStrategy}
            >
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                {entries.map((entry) => (
                  <SortableColumnRow
                    key={entry.id}
                    entry={entry}
                    columns={availableColumns}
                    aggregates={availableAggregates}
                    isDark={isDark}
                    onChangeExpr={handleChangeExpr}
                    onChangeAlias={handleChangeAlias}
                    onRemove={handleRemove}
                    aliasPlaceholder={aliasPlaceholder}
                  />
                ))}
              </Box>
            </SortableContext>
          </DndContext>

          {/* Empty state */}
          {entries.length === 0 && (
            <Typography
              variant="body2"
              color="error"
              sx={{ py: 3, textAlign: 'center', fontSize: '0.82rem' }}
            >
              {t(
                'argus.discover.column.required',
                'At least one column is required'
              )}
            </Typography>
          )}

          {/* Add column button */}
          <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
            <Button
              startIcon={<AddIcon />}
              onClick={handleAddColumn}
              size="small"
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.8rem',
                color: theme.palette.primary.main,
              }}
            >
              {t('argus.discover.column.add', 'Add a Column')}
            </Button>
            <Button
              startIcon={<EquationIcon />}
              onClick={handleAddEquation}
              size="small"
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.8rem',
                color: theme.palette.warning.main,
              }}
            >
              {t('argus.discover.column.addEquation', 'Add Equation')}
            </Button>
          </Box>
        </Box>
      </DialogContent>

      {/* Actions */}
      <Divider />
      <DialogActions
        sx={{ p: 2, px: 2.5, backgroundColor: theme.palette.background.paper }}
      >
        <Button
          onClick={onClose}
          sx={{ textTransform: 'none', fontWeight: 500 }}
        >
          {t('common.cancel', 'Cancel')}
        </Button>
        <Button
          onClick={handleApply}
          variant="contained"
          disabled={entries.length === 0}
          sx={{
            textTransform: 'none',
            fontWeight: 600,
            px: 3,
          }}
        >
          {t('common.apply', 'Apply')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ColumnEditorModal;
