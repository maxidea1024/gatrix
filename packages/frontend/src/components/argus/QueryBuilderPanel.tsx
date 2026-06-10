// ═════════════════════════════════════════════════════════════════════════════
// QueryBuilderPanel — RAQB-style tree form query builder
// Recursive groups + AND/OR toggles + drag-and-drop + inline editing
// ═════════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useMemo, useCallback, useRef, type SetStateAction } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Dialog,
  Select,
  MenuItem,
  TextField,
  Autocomplete,
  Chip,
  Divider,
  ListSubheader,
  Menu,
  useTheme,
  ListItemIcon,
  alpha,
} from '@mui/material';
import {
  Add as AddIcon,
  Close as CloseIcon,
  AutoFixHigh as MagicIcon,
  DragIndicator as DragIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
  Storage as SqlIcon,
  Code as DslIcon,
  FilterList as FilterListIcon,
  SearchOff as SearchOffIcon,
  CheckCircleOutline as HasIcon,
  Label as TagIcon,
  Schedule as DateIcon,
  Numbers as NumIcon,
  ToggleOn as BoolIcon,
  ContentCopy as CopyIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { QueryHighlighter } from './QueryHighlighter';
import { queryToChips } from './query-dsl/useFilterChips';
import type { DomainConfig } from './query-dsl/types';
import { getOperatorOptions } from './query-dsl/operator-labels';

import {
  type Condition,
  type FilterCondition,
  type GroupCondition,
  chipsToTree,
  conditionToDsl,
  conditionToSql,
  createFilter,
  createEmptyRoot,
  addFilterToGroup,
  addGroupToGroup,
  removeCondition,
  moveCondition,
  updateCondition,
  hasValidFilters,
  duplicateCondition,
} from './query-builder-tree';
import {
  DialogBody, HeaderBar, HeaderLeft, HeaderRight, TreeEditor,
  BottomSection, UndoRedoGroup, UndoRedoBtn, FullscreenButton, GroupBox, GroupHeader,
  NotBadge, ConnectorChip, AddRuleButton, AddGroupButton, GroupActionButton,
  ChildrenContainer, PreviewHeader,
  PreviewModeToggle, PreviewContainer, ActionsRow, CancelButton, ApplyButton,
  EmptyGroupHint, DropZone, SplitHandle,
} from './QueryBuilderPanel.styles';

// ═════════════════════════════════════════════════════════════════════════════
// Types
// ═════════════════════════════════════════════════════════════════════════════

interface FacetValue { value: string; count: number }

export interface QueryBuilderPanelProps {
  open: boolean;
  onClose: () => void;
  config: DomainConfig;
  query: string;
  facets?: Record<string, FacetValue[]>;
  onApply: (query: string) => void;
  fetchFieldValues?: (fieldKey: string) => Promise<string[]>;
}

// ═════════════════════════════════════════════════════════════════════════════
// Drag state
// ═════════════════════════════════════════════════════════════════════════════

interface DragState {
  draggingId: string | null;
  dropTargetId: string | null;
  dropIndex: number;
}

// ═════════════════════════════════════════════════════════════════════════════
// Depth colors for tree structure lines
// ═════════════════════════════════════════════════════════════════════════════

const DEPTH_COLORS = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
const depthColor = (d: number) => DEPTH_COLORS[d % DEPTH_COLORS.length];
// Opaque muted line colors (no alpha, no overlap darkening)
const DEPTH_LINE_DARK  = ['#35365a', '#2a3f55', '#254a3a', '#4a4025', '#4a2a2a', '#3a2d4a'];
const DEPTH_LINE_LIGHT = ['#c8c9e2', '#bdd0e2', '#b8d8ca', '#dbd5b4', '#dbb8b8', '#d0c0db'];
const depthLineColor = (d: number, dark: boolean) =>
  (dark ? DEPTH_LINE_DARK : DEPTH_LINE_LIGHT)[d % DEPTH_LINE_DARK.length];

// ═════════════════════════════════════════════════════════════════════════════
// Component
// ═════════════════════════════════════════════════════════════════════════════

const QueryBuilderPanel: React.FC<QueryBuilderPanelProps> = ({
  open, onClose, config, query, facets = {}, onApply, fetchFieldValues,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';
  const primary = theme.palette.primary.main;

  const [tree, setTreeRaw] = useState<GroupCondition>(createEmptyRoot());
  const historyRef = useRef<{ past: GroupCondition[]; future: GroupCondition[] }>({ past: [], future: [] });
  const setTree = useCallback((action: SetStateAction<GroupCondition>) => {
    setTreeRaw((prev) => {
      const next = typeof action === 'function' ? action(prev) : action;
      if (next !== prev) {
        historyRef.current.past.push(prev);
        historyRef.current.future = [];
        if (historyRef.current.past.length > 50) historyRef.current.past.shift();
      }
      return next;
    });
  }, []);
  const undo = useCallback(() => {
    setTreeRaw((prev) => {
      const { past, future } = historyRef.current;
      if (past.length === 0) return prev;
      future.push(prev);
      return past.pop()!;
    });
  }, []);
  const redo = useCallback(() => {
    setTreeRaw((prev) => {
      const { past, future } = historyRef.current;
      if (future.length === 0) return prev;
      past.push(prev);
      return future.pop()!;
    });
  }, []);
  const [dynamicFacets, setDynamicFacets] = useState<Record<string, string[]>>({});
  const [previewMode, setPreviewMode] = useLocalStorage<'dsl' | 'clickhouse'>('qb-preview-mode', 'dsl');
  const [drag, setDrag] = useState<DragState>({ draggingId: null, dropTargetId: null, dropIndex: 0 });
  const [ruleMenuAnchor, setRuleMenuAnchor] = useState<{ groupId: string; el: HTMLElement } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [previewHeight, setPreviewHeight] = useLocalStorage<number>('qb-preview-height', 220);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally re-derive on every tree change
  const canUndo = useMemo(() => historyRef.current.past.length > 0, [tree]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const canRedo = useMemo(() => historyRef.current.future.length > 0, [tree]);

  // ── Sorted fields (faceted first) ──
  const sortedFields = useMemo(() => {
    const keys = config.fields.map((f) => f.key);
    return [...keys.filter((f) => (facets[f]?.length ?? 0) > 0), ...keys.filter((f) => (facets[f]?.length ?? 0) === 0)];
  }, [config.fields, facets]);

  // Include has/!has as pseudo-fields
  const allFields = useMemo(() => ['has', '!has', ...sortedFields], [sortedFields]);

  const getFacetValues = useCallback((field: string): FacetValue[] => {
    if (facets[field]?.length > 0) return facets[field];
    if (dynamicFacets[field]) return dynamicFacets[field].map((v) => ({ value: v, count: 0 }));
    const fc = config.fields.find((f) => f.key === field);
    if (fc?.staticValues) return fc.staticValues.map((v) => ({ value: v, count: 0 }));
    return [];
  }, [facets, dynamicFacets, config]);

  const loadField = useCallback(async (field: string) => {
    if (!fetchFieldValues || facets[field]?.length > 0 || dynamicFacets[field]) return;
    try { const v = await fetchFieldValues(field); setDynamicFacets((p) => ({ ...p, [field]: v })); } catch { /* */ }
  }, [fetchFieldValues, facets, dynamicFacets]);

  // ── Get operators for a field ──
  const getFieldOps = useCallback((fieldKey: string) => {
    if (fieldKey === 'has' || fieldKey === '!has') return [];
    const f = config.fields.find((x) => x.key === fieldKey);
    if (f) return getOperatorOptions(f.operators, f.type);
    return [{ op: '=', label: 'is' }, { op: '!=', label: 'is not' }, { op: 'contains', label: 'contains' }, { op: '!contains', label: 'does not contain' }];
  }, [config]);

  // ── Init from query ──
  useEffect(() => {
    if (!open) return;
    const chips = queryToChips(query);
    setTreeRaw(chipsToTree(chips));
    historyRef.current = { past: [], future: [] };
  }, [open, query]);

  // ── Keyboard shortcuts: Ctrl+Z / Ctrl+Y ──
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, undo, redo]);

  // ── Inline prune: remove non-root groups with 0 children ──
  const prune = useCallback((root: GroupCondition): GroupCondition => {
    const pruned: Condition[] = [];
    for (const child of root.children) {
      if (child.type === 'group') {
        const cleaned = prune(child);
        if (cleaned.children.length > 0) pruned.push(cleaned);
        // else: skip empty non-root group
      } else {
        pruned.push(child);
      }
    }
    return { ...root, children: pruned };
  }, []);

  // ── Tree mutations ──
  const update = useCallback((id: string, patch: Partial<FilterCondition> | Partial<GroupCondition>) => {
    setTree((t) => updateCondition(t, id, patch));
  }, []);

  const remove = useCallback((id: string) => {
    setTree((t) => {
      const [newTree] = removeCondition(t, id);
      return prune(newTree);
    });
  }, [prune]);

  const addFilter = useCallback((groupId: string, field: string) => {
    setTree((t) => addFilterToGroup(t, groupId, field));
  }, []);

  const addGroup = useCallback((groupId: string) => {
    setTree((t) => addGroupToGroup(t, groupId));
  }, []);

  const duplicate = useCallback((id: string) => {
    setTree((t) => duplicateCondition(t, id));
  }, []);

  // ── DnD handlers ──
  const handleDragStart = useCallback((e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
    setDrag((d) => ({ ...d, draggingId: id }));
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, targetGroupId: string, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDrag((d) => {
      // Skip redundant updates to avoid jitter
      if (d.dropTargetId === targetGroupId && d.dropIndex === index) return d;
      return { ...d, dropTargetId: targetGroupId, dropIndex: index };
    });
  }, []);

  const handleDragLeave = useCallback(() => {
    setDrag((d) => ({ ...d, dropTargetId: null }));
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetGroupId: string, index: number) => {
    e.preventDefault();
    const condId = e.dataTransfer.getData('text/plain');
    if (condId) {
      setTree((t) => prune(moveCondition(t, condId, targetGroupId, index)));
    }
    setDrag({ draggingId: null, dropTargetId: null, dropIndex: 0 });
  }, [prune]);

  const handleDragEnd = useCallback(() => {
    setDrag({ draggingId: null, dropTargetId: null, dropIndex: 0 });
  }, []);

  // ── Previews (tree-walk pretty-print) ──
  const dslForApply = useMemo(() => conditionToDsl(tree), [tree]);

  const dslPreview = useMemo(() => {
    const fmtDsl = (c: Condition, depth: number): string => {
      if (c.type === 'filter') return conditionToDsl(c);
      const parts = c.children.map((ch) => fmtDsl(ch, depth + 1)).filter(Boolean);
      if (parts.length === 0) return '';
      const conn = `${c.connector} `; // "AND " or "OR "
      const pad = ' '.repeat(conn.length);
      const indent = '  '.repeat(depth);
      if (depth > 0) {
        const inner = parts.map((p, i) =>
          i === 0 ? `${pad}${p}` : `${indent}${conn}${p}`,
        ).join('\n');
        const body = `(\n${indent}${inner}\n${indent})`;
        return c.negated ? `NOT ${body}` : body;
      }
      const joined = parts.map((p, i) =>
        i === 0 ? `${pad}${p}` : `${conn}${p}`,
      ).join('\n');
      return c.negated ? `NOT ${joined}` : joined;
    };
    return fmtDsl(tree, 0);
  }, [tree]);

  const sqlPreview = useMemo(() => {
    const fmtSql = (c: Condition, depth: number): string => {
      if (c.type === 'filter') return conditionToSql(c);
      const parts = c.children.map((ch) => fmtSql(ch, depth + 1)).filter(Boolean);
      if (parts.length === 0) return '';
      const conn = `${c.connector} `;
      const pad = ' '.repeat(conn.length);
      const indent = '  '.repeat(depth);
      if (depth > 0) {
        const inner = parts.map((p, i) =>
          i === 0 ? `${pad}${p}` : `${indent}${conn}${p}`,
        ).join('\n');
        const body = `(\n${indent}${inner}\n${indent})`;
        return c.negated ? `NOT ${body}` : body;
      }
      const base = '  '; // 2-space indent from WHERE
      const joined = parts.map((p, i) =>
        i === 0 ? `${base}${pad}${p}` : `${base}${conn}${p}`,
      ).join('\n');
      return c.negated ? `NOT ${joined}` : joined;
    };
    const body = fmtSql(tree, 0);
    return body ? `WHERE\n${body}` : '';
  }, [tree]);

  const isValid = useMemo(() => hasValidFilters(tree), [tree]);
  const handleApply = useCallback(() => { onApply(dslForApply); onClose(); }, [onApply, onClose, dslForApply]);

  // ═════════════════════════════════════════════════════════════════════════
  // renderFilter — a single filter row
  // ═════════════════════════════════════════════════════════════════════════

  const renderFilter = (filter: FilterCondition, groupId: string, index: number, depth: number) => {
    const isHas = filter.field === 'has' || filter.field === '!has';
    const ops = getFieldOps(filter.field);
    const facetVals = getFacetValues(filter.field);
    const valueOpts = [...facetVals].sort((a, b) => b.count - a.count).map((v) => String(v.value ?? ''));
    const isDragging = drag.draggingId === filter.id;
    const isDropTarget = drag.dropTargetId === groupId && drag.dropIndex === index;
    const lineColor = depthColor(depth);

    return (
      <Box key={filter.id}>
        <Box
          draggable
          onDragStart={(e) => handleDragStart(e, filter.id)}
          onDragOver={(e) => handleDragOver(e, groupId, index)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, groupId, index)}
          onDragEnd={handleDragEnd}
          sx={{
            display: 'flex', alignItems: 'center', gap: 0.5,
            px: 0.8, py: 0.4,
            borderRadius: '6px',
            backgroundColor: isDark
              ? isDragging ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.02)'
              : isDragging ? 'rgba(99,102,241,0.04)' : 'rgba(0,0,0,0.015)',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
            outline: isDropTarget ? `2px solid ${primary}` : 'none',
            outlineOffset: -1,
            opacity: isDragging ? 0.4 : 1,
            transition: 'opacity 0.15s, outline-color 0.1s',
            '&:hover': {
              backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)',
              '& .drag-grip': { opacity: 0.6 },
            },
          }}
        >
          {/* Drag grip */}
          <DragIcon className="drag-grip" sx={{ fontSize: 14, color: 'text.disabled', opacity: 0.2, cursor: 'grab', flexShrink: 0 }} />

          {/* NOT toggle */}
          <Box
            onClick={() => update(filter.id, { negated: !filter.negated })}
            sx={{
              fontSize: '0.5rem', fontWeight: 800, letterSpacing: '0.04em',
              px: 0.5, py: 0.1, borderRadius: '3px', minWidth: 26, textAlign: 'center',
              cursor: 'pointer', userSelect: 'none', flexShrink: 0,
              color: filter.negated ? theme.palette.error.main : alpha(theme.palette.text.disabled, 0.35),
              backgroundColor: filter.negated ? alpha(theme.palette.error.main, 0.1) : 'transparent',
              border: `1px solid ${filter.negated ? alpha(theme.palette.error.main, 0.4) : isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'}`,
              transition: 'all 0.12s',
              '&:hover': { color: theme.palette.error.main, backgroundColor: alpha(theme.palette.error.main, 0.08) },
            }}
          >NOT</Box>

          {/* Field select */}
          <Select size="small" displayEmpty value={filter.field || ''}
            onChange={(e) => {
              const newField = e.target.value;
              update(filter.id, { field: newField });
              if (newField !== 'has' && newField !== '!has') loadField(newField);
            }}
            sx={{ minWidth: 100, height: 26, fontSize: '0.7rem', '& .MuiSelect-select': { py: 0.3 } }}
            MenuProps={{ PaperProps: { sx: { maxHeight: 250, fontSize: '0.7rem' } } }}
          >
            <MenuItem value="" disabled sx={{ fontSize: '0.7rem' }}>field…</MenuItem>
            <ListSubheader sx={{ fontSize: '0.55rem', fontWeight: 700, lineHeight: '24px', color: 'text.disabled', letterSpacing: '0.06em' }}>OPERATORS</ListSubheader>
            <MenuItem value="has" sx={{ fontSize: '0.7rem', fontWeight: 600 }}>
              <FilterListIcon sx={{ fontSize: 12, mr: 0.5, color: 'success.main' }} />has
            </MenuItem>
            <MenuItem value="!has" sx={{ fontSize: '0.7rem', fontWeight: 600 }}>
              <SearchOffIcon sx={{ fontSize: 12, mr: 0.5, color: 'error.main' }} />!has
            </MenuItem>
            <Divider sx={{ my: 0.3 }} />
            <ListSubheader sx={{ fontSize: '0.55rem', fontWeight: 700, lineHeight: '24px', color: 'text.disabled', letterSpacing: '0.06em' }}>FIELDS</ListSubheader>
            {sortedFields.map((f) => (
              <MenuItem key={f} value={f} sx={{ fontSize: '0.7rem' }}>
                {f}
                {facets[f]?.length > 0 && (
                  <Typography component="span" sx={{ ml: 0.5, fontSize: '0.55rem', color: 'text.disabled' }}>
                    ({facets[f].length})
                  </Typography>
                )}
              </MenuItem>
            ))}
          </Select>

          {/* Operator select — hidden for has/!has */}
          {!isHas && ops.length > 0 && (
            <Select size="small" value={filter.operator || '='}
              onChange={(e) => update(filter.id, { operator: e.target.value })}
              sx={{ minWidth: 80, height: 26, fontSize: '0.7rem', '& .MuiSelect-select': { py: 0.3 } }}
            >
              {ops.map((o) => <MenuItem key={o.op} value={o.op} sx={{ fontSize: '0.7rem' }}>{o.label}</MenuItem>)}
            </Select>
          )}

          {/* Value — Autocomplete with multi-value support */}
          {!isHas ? (
            <Autocomplete multiple freeSolo size="small"
              options={valueOpts}
              value={(() => {
                if (filter.values && filter.values.length > 0) return filter.values;
                if (filter.value && filter.value.includes(', ')) {
                  return filter.value.split(', ').map((v: string) => v.trim()).filter(Boolean);
                }
                return filter.value ? [filter.value] : [];
              })()}
              onChange={(_e, newVal) => {
                const arr = (newVal as string[]).filter(Boolean);
                update(filter.id, {
                  values: arr.length > 1 ? arr : undefined,
                  value: arr.length === 1 ? arr[0] : arr.join(', '),
                });
              }}
              onFocus={() => filter.field && loadField(filter.field)}
              renderInput={(params) => (
                <TextField {...params} placeholder="value…"
                  InputProps={{ ...params.InputProps, sx: { minHeight: 26, fontSize: '0.7rem', py: 0, flexWrap: 'wrap' } }} />
              )}
              renderTags={(vals, getTagProps) =>
                vals.map((v, i) => (
                  <Chip {...getTagProps({ index: i })} key={i} label={v} size="small"
                    sx={{ height: 18, fontSize: '0.6rem', '& .MuiChip-deleteIcon': { fontSize: 12 } }} />
                ))
              }
              slotProps={{ paper: { sx: { fontSize: '0.7rem', maxHeight: 200 } } }}
              sx={{ flex: 1, minWidth: 100 }}
            />
          ) : (
            // HAS: value = field name to check existence
            <Select size="small" displayEmpty value={filter.value || ''}
              onChange={(e) => update(filter.id, { value: e.target.value })}
              sx={{ flex: 1, minWidth: 100, height: 26, fontSize: '0.7rem', '& .MuiSelect-select': { py: 0.3 } }}
              MenuProps={{ PaperProps: { sx: { maxHeight: 250 } } }}
            >
              <MenuItem value="" disabled sx={{ fontSize: '0.7rem' }}>field…</MenuItem>
              {sortedFields.map((f) => <MenuItem key={f} value={f} sx={{ fontSize: '0.7rem' }}>{f}</MenuItem>)}
            </Select>
          )}

          {/* Duplicate */}
          <GroupActionButton size="small" actionColor="info" onClick={() => duplicate(filter.id)}>
            <CopyIcon sx={{ fontSize: 12 }} />
          </GroupActionButton>
          {/* Delete */}
          <GroupActionButton size="small" actionColor="error" onClick={() => remove(filter.id)}>
            <CloseIcon sx={{ fontSize: 12 }} />
          </GroupActionButton>
        </Box>
      </Box>
    );
  };

  // ═════════════════════════════════════════════════════════════════════════
  // renderGroup — recursive group rendering
  // ═════════════════════════════════════════════════════════════════════════

  const renderGroup = (group: GroupCondition, depth: number, isRoot: boolean) => {
    const lineColor = depthColor(depth);

    return (
      <GroupBox key={group.id} isDark={isDark} isRoot={isRoot} lineColor={lineColor}>
        {/* Group header */}
        <GroupHeader>
          {/* NOT badge for group */}
          {!isRoot && (
            <NotBadge isNegated={group.negated} isDark={isDark}
              onClick={() => update(group.id, { negated: !group.negated })}>NOT</NotBadge>
          )}

          {/* AND/OR toggle chip */}
          <ConnectorChip isOr={group.connector === 'OR'} primaryColor={primary}
            onClick={() => update(group.id, { connector: group.connector === 'AND' ? 'OR' : 'AND' })}>
            {group.connector}
          </ConnectorChip>

          {/* +Rule — click opens field picker */}
          <AddRuleButton size="small" startIcon={<AddIcon sx={{ fontSize: 10 }} />}
            onClick={(e) => setRuleMenuAnchor({ groupId: group.id, el: e.currentTarget })}>
            {t('argus.builder.addRule', 'Rule')}
          </AddRuleButton>
          <Menu
            anchorEl={ruleMenuAnchor?.groupId === group.id ? ruleMenuAnchor.el : null}
            open={ruleMenuAnchor?.groupId === group.id}
            onClose={() => setRuleMenuAnchor(null)}
            slotProps={{ paper: { sx: { maxHeight: 300, minWidth: 160, fontSize: '0.7rem' } } }}
          >
            <ListSubheader sx={{ fontSize: '0.55rem', fontWeight: 700, lineHeight: '24px', color: 'text.disabled', letterSpacing: '0.06em' }}>
              {t('argus.builder.specialFields', 'SPECIAL')}
            </ListSubheader>
            {['has', '!has'].map((f) => (
              <MenuItem key={f} sx={{ fontSize: '0.7rem', gap: 0.5 }} onClick={() => {
                addFilter(group.id, f);
                setRuleMenuAnchor(null);
              }}>
                <ListItemIcon sx={{ minWidth: 24 }}><HasIcon sx={{ fontSize: 14, color: 'warning.main' }} /></ListItemIcon>
                {f}
              </MenuItem>
            ))}
            <Divider sx={{ my: 0.3 }} />
            <ListSubheader sx={{ fontSize: '0.55rem', fontWeight: 700, lineHeight: '24px', color: 'text.disabled', letterSpacing: '0.06em' }}>
              {t('argus.builder.fields', 'FIELDS')}
            </ListSubheader>
            {sortedFields.map((f) => {
              const fc = config.fields.find((x) => x.key === f);
              const icon = fc?.type === 'datetime' ? <DateIcon sx={{ fontSize: 14 }} />
                : fc?.type === 'number' ? <NumIcon sx={{ fontSize: 14 }} />
                : fc?.type === 'boolean' ? <BoolIcon sx={{ fontSize: 14 }} />
                : <TagIcon sx={{ fontSize: 14 }} />;
              return (
                <MenuItem key={f} sx={{ fontSize: '0.7rem', gap: 0.5 }} onClick={() => {
                  addFilter(group.id, f);
                  setRuleMenuAnchor(null);
                }}>
                  <ListItemIcon sx={{ minWidth: 24, color: 'text.disabled' }}>{icon}</ListItemIcon>
                  {f}
                  {facets[f]?.length > 0 && (
                    <Typography component="span" sx={{ ml: 'auto', pl: 1, fontSize: '0.55rem', color: 'text.disabled' }}>({facets[f].length})</Typography>
                  )}
                </MenuItem>
              );
            })}
          </Menu>
          <AddGroupButton size="small" startIcon={<AddIcon sx={{ fontSize: 10 }} />}
            onClick={() => addGroup(group.id)}>
            {t('argus.builder.addGroup', 'Group')}
          </AddGroupButton>

          {/* Duplicate / Delete group (non-root) */}
          {!isRoot && (
            <>
              <GroupActionButton size="small" actionColor="info" onClick={() => duplicate(group.id)} sx={{ ml: 0.3 }}>
                <CopyIcon sx={{ fontSize: 12 }} />
              </GroupActionButton>
              <GroupActionButton size="small" actionColor="error" onClick={() => remove(group.id)}>
                <CloseIcon sx={{ fontSize: 12 }} />
              </GroupActionButton>
            </>
          )}
        </GroupHeader>

        {/* Children */}
        <ChildrenContainer isRoot={isRoot}>
          {group.children.length === 0 ? (
            <EmptyGroupHint>
              <FilterListIcon sx={{ fontSize: 14, color: 'text.disabled', opacity: 0.4 }} />
              <Typography sx={{ fontSize: '0.65rem', color: 'text.disabled', fontStyle: 'italic' }}>
                {t('argus.builder.emptyGroup', '+ 규칙 버튼을 눌러 조건을 추가하세요')}
              </Typography>
            </EmptyGroupHint>
          ) : group.children.map((child, idx) => {
            const isFirst = idx === 0;
            const isLast = idx === group.children.length - 1;
            const opaqueColor = depthLineColor(depth, isDark);
            const bStyle = `2px solid ${opaqueColor}`;
            const isChildGroup = child.type === 'group';
            const connectY = isChildGroup ? '14px' : '50%';
            const lastBottom = isChildGroup ? 'calc(100% - 14px)' : '50%';
            const branchWidth = isRoot ? '14px' : '10px';
            const branchLeft = isRoot ? '-14px' : '-10px';
            return (
              <Box key={child.id} sx={{
                position: 'relative',
                mt: isFirst ? 0 : '4px',
                '&::before': {
                  content: '""', position: 'absolute', left: branchLeft,
                  top: isFirst ? 0 : '-4px', bottom: isLast ? lastBottom : 0,
                  borderLeft: bStyle,
                },
                '&::after': {
                  content: '""', position: 'absolute', left: branchLeft,
                  top: connectY, width: branchWidth, borderTop: bStyle,
                },
              }}>
                {child.type === 'filter'
                  ? renderFilter(child, group.id, idx, depth)
                  : renderGroup(child as GroupCondition, depth + 1, false)
                }
              </Box>
            );
          })}

          {/* Drop zone at end of group */}
          <DropZone
            isActive={drag.dropTargetId === group.id && drag.dropIndex === group.children.length}
            primaryColor={primary}
            onDragOver={(e) => handleDragOver(e, group.id, group.children.length)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, group.id, group.children.length)}
          />
        </ChildrenContainer>
      </GroupBox>
    );
  };

  // ═════════════════════════════════════════════════════════════════════════
  // Render
  // ═════════════════════════════════════════════════════════════════════════

  return (
    <Dialog open={open} onClose={onClose} maxWidth={isFullscreen ? false : 'md'} fullWidth={!isFullscreen} fullScreen={isFullscreen}
      slotProps={{
        backdrop: { sx: { backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.3)', backdropFilter: 'blur(3px)' } },
        paper: { sx: {
          borderRadius: isFullscreen ? 0 : '14px',
          boxShadow: isDark ? '0 12px 48px rgba(0,0,0,0.7)' : '0 12px 48px rgba(0,0,0,0.15)',
          ...(isFullscreen ? {} : { height: '80vh', maxHeight: 720 }),
        } },
      }}>
      <DialogBody>

        {/* Header */}
        <HeaderBar isDark={isDark}>
          <HeaderLeft>
            <MagicIcon sx={{ fontSize: 18, color: primary }} />
            <Typography sx={{ fontWeight: 700, fontSize: '0.85rem' }}>
              {t('argus.builder.title', 'Visual Query Builder')}
            </Typography>
          </HeaderLeft>
          <HeaderRight>
            <UndoRedoGroup size="small" variant="outlined">
              <UndoRedoBtn size="small" onClick={undo} disabled={!canUndo} isDisabled={!canUndo} title="Undo (Ctrl+Z)">
                <UndoIcon sx={{ fontSize: 14 }} />
              </UndoRedoBtn>
              <UndoRedoBtn size="small" onClick={redo} disabled={!canRedo} isDisabled={!canRedo} title="Redo (Ctrl+Y)">
                <RedoIcon sx={{ fontSize: 14 }} />
              </UndoRedoBtn>
            </UndoRedoGroup>
            <FullscreenButton size="small" onClick={() => setIsFullscreen((f) => !f)} title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}>
              {isFullscreen ? <FullscreenExitIcon sx={{ fontSize: 16 }} /> : <FullscreenIcon sx={{ fontSize: 16 }} />}
            </FullscreenButton>
            <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
          </HeaderRight>
        </HeaderBar>

        {/* Tree editor */}
        <TreeEditor>
          {renderGroup(tree, 0, true)}
        </TreeEditor>

        {/* Splitter */}
        <SplitHandle isDark={isDark}
          onMouseDown={(e) => {
            e.preventDefault();
            const startY = e.clientY;
            const startH = previewHeight;
            const onMove = (ev: MouseEvent) => {
              const delta = startY - ev.clientY;
              setPreviewHeight(Math.max(100, Math.min(600, startH + delta)));
            };
            const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
          }}
        />

        {/* Bottom — Preview + Actions */}
        <BottomSection sx={{ height: previewHeight, flexShrink: 0 }}>

          {/* Preview — DSL / ClickHouse */}
          <PreviewHeader>
            <Typography sx={{ fontSize: '0.6rem', fontWeight: 600, color: 'text.secondary' }}>
              {t('argus.builder.queryPreviewTitle', 'Generated Query')}
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.25 }}>
              {(['dsl', 'clickhouse'] as const).map((m) => (
                <PreviewModeToggle key={m} isActive={previewMode === m} primaryColor={primary}
                  onClick={() => setPreviewMode(m)}>
                  {m === 'dsl' ? <DslIcon sx={{ fontSize: 9 }} /> : <SqlIcon sx={{ fontSize: 9 }} />}
                  {m === 'dsl' ? 'DSL' : 'ClickHouse'}
                </PreviewModeToggle>
              ))}
            </Box>
          </PreviewHeader>
          <PreviewContainer>
            <QueryHighlighter query={previewMode === 'dsl' ? dslPreview : sqlPreview} mode={previewMode} isDark={isDark} />
          </PreviewContainer>

          {/* Actions */}
          <ActionsRow>
            <CancelButton size="small" onClick={onClose}>
              {t('common.cancel', 'Cancel')}
            </CancelButton>
            <ApplyButton size="small" variant="contained" onClick={handleApply} disabled={!isValid}>
              {t('argus.builder.apply', 'Apply Query')}
            </ApplyButton>
          </ActionsRow>
        </BottomSection>
      </DialogBody>
    </Dialog>
  );
};

export default QueryBuilderPanel;

