// ═════════════════════════════════════════════════════════════════════════════
// Query Builder Tree — Condition data model + DSL/SQL conversion
// Works with existing queryToChips → chipsToQuery pipeline
// ═════════════════════════════════════════════════════════════════════════════

import type { FilterChip } from './query-dsl/useFilterChips';
import { chipToQueryPart } from './query-dsl/useFilterChips';

// ═════════════════════════════════════════════════════════════════════════════
// Types
// ═════════════════════════════════════════════════════════════════════════════

let _treeId = 0;
export const nextId = () => `cond_${++_treeId}_${Math.random().toString(36).slice(2, 5)}`;

export interface FilterCondition {
  id: string;
  type: 'filter';
  field: string;
  operator: string;
  value: string;
  /** Multi-value array for in/!in operators */
  values?: string[];
  negated: boolean;
  quoted?: boolean;
}

export interface GroupCondition {
  id: string;
  type: 'group';
  connector: 'AND' | 'OR';
  negated: boolean;
  children: Condition[];
}

export type Condition = FilterCondition | GroupCondition;

// ═════════════════════════════════════════════════════════════════════════════
// Factory helpers
// ═════════════════════════════════════════════════════════════════════════════

export function createFilter(field = '', operator = '=', value = ''): FilterCondition {
  return { id: nextId(), type: 'filter', field, operator, value, negated: false };
}

export function createGroup(connector: 'AND' | 'OR' = 'AND', children: Condition[] = []): GroupCondition {
  return { id: nextId(), type: 'group', connector, negated: false, children };
}

export function createEmptyRoot(): GroupCondition {
  return createGroup('AND', []);
}

// ═════════════════════════════════════════════════════════════════════════════
// FilterChip[] → Condition Tree
// ═════════════════════════════════════════════════════════════════════════════

export function chipsToTree(chips: FilterChip[]): GroupCondition {
  if (chips.length === 0) return createEmptyRoot();

  const { items, connector } = parseLevel(chips, 0, chips.length);
  if (items.length === 0) return createEmptyRoot();
  if (items.length === 1 && items[0].type === 'group') {
    return items[0] as GroupCondition;
  }
  return createGroup(connector, items);
}

interface ParseResult {
  items: Condition[];
  connector: 'AND' | 'OR';
}

function parseLevel(chips: FilterChip[], start: number, end: number): ParseResult {
  const items: Condition[] = [];
  let connector: 'AND' | 'OR' = 'AND';
  let i = start;

  while (i < end) {
    const c = chips[i];

    // Parentheses → sub-group
    if (c.type === 'paren' && c.label === '(') {
      let depth = 1, j = i + 1;
      while (j < end && depth > 0) {
        if (chips[j].type === 'paren' && chips[j].label === '(') depth++;
        if (chips[j].type === 'paren' && chips[j].label === ')') depth--;
        j++;
      }
      const sub = parseLevel(chips, i + 1, j - 1);
      items.push(createGroup(sub.connector, sub.items));
      i = j;
      continue;
    }

    // NOT
    if (c.type === 'logical' && c.label === 'NOT') {
      if (i + 1 < end && chips[i + 1].type === 'paren' && chips[i + 1].label === '(') {
        // NOT (group)
        let depth = 1, j = i + 2;
        while (j < end && depth > 0) {
          if (chips[j].type === 'paren' && chips[j].label === '(') depth++;
          if (chips[j].type === 'paren' && chips[j].label === ')') depth--;
          j++;
        }
        const sub = parseLevel(chips, i + 2, j - 1);
        const g = createGroup(sub.connector, sub.items);
        g.negated = true;
        items.push(g);
        i = j;
        continue;
      }
      // NOT filter
      if (i + 1 < end && (chips[i + 1].type === 'filter' || !chips[i + 1].type)) {
        const f = chipToFilter(chips[i + 1]);
        f.negated = true;
        items.push(f);
        i += 2;
        continue;
      }
      i++;
      continue;
    }

    // AND/OR
    if (c.type === 'logical' && (c.label === 'AND' || c.label === 'OR')) {
      connector = c.label as 'AND' | 'OR';
      i++;
      continue;
    }

    // Filter
    if (c.type === 'filter' || !c.type) {
      items.push(chipToFilter(c));
      i++;
      continue;
    }

    i++;
  }

  return { items, connector };
}

function chipToFilter(chip: FilterChip): FilterCondition {
  // Resolve values: prefer chip.values, fallback to splitting value by ', '
  let values: string[] | undefined;
  if (chip.values && chip.values.length > 1) {
    values = [...chip.values];
  } else if (chip.value && chip.value.includes(', ')) {
    const parts = chip.value.split(', ').map((v) => v.trim()).filter(Boolean);
    if (parts.length > 1) values = parts;
  }
  return {
    id: nextId(),
    type: 'filter',
    field: chip.field || '',
    operator: chip.operator || '=',
    value: chip.value || '',
    values,
    negated: false,
    quoted: chip.quoted,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// Multi-value resolution helper
// ═════════════════════════════════════════════════════════════════════════════

/** Resolve multi-value: prefer cond.values[], fallback to splitting value by ', ' */
function resolveValues(cond: FilterCondition): string[] | null {
  if (cond.values && cond.values.length > 1) return cond.values;
  // Detect comma-separated values in the value string
  if (cond.value && cond.value.includes(', ')) {
    const parts = cond.value.split(', ').map((v) => v.trim()).filter(Boolean);
    if (parts.length > 1) return parts;
  }
  return null;
}

// ═════════════════════════════════════════════════════════════════════════════
// Condition Tree → DSL string
// ═════════════════════════════════════════════════════════════════════════════

export function conditionToDsl(cond: Condition): string {
  if (cond.type === 'filter') {
    if (!cond.field) return '';
    const multi = resolveValues(cond);
    const chip: FilterChip = {
      id: cond.id,
      type: 'filter',
      field: cond.field,
      operator: cond.operator,
      value: multi ? multi[0] : cond.value,
      values: multi ?? undefined,
      quoted: cond.quoted,
    };
    const part = chipToQueryPart(chip);
    return cond.negated ? `NOT ${part}` : part;
  }

  // Group
  const parts = cond.children.map(conditionToDsl).filter(Boolean);
  if (parts.length === 0) return '';
  const inner = parts.length === 1 ? parts[0] : `(${parts.join(` ${cond.connector} `)})`;
  return cond.negated ? `NOT ${inner}` : inner;
}

// ═════════════════════════════════════════════════════════════════════════════
// Condition Tree → ClickHouse SQL
// ═════════════════════════════════════════════════════════════════════════════

export function conditionToSql(cond: Condition): string {
  const esc = (s: string) => `'${s.replace(/'/g, "''")}'`;

  if (cond.type === 'filter') {
    if (!cond.field || (!cond.value && cond.field !== 'has' && cond.field !== '!has')) return '';
    const not = cond.negated ? 'NOT ' : '';

    // HAS / !HAS
    if (cond.field === 'has') return `${not}${cond.value} IS NOT NULL`;
    if (cond.field === '!has') return `${not}${cond.value} IS NULL`;

    // Multi-value → IN clause
    const multi = resolveValues(cond);
    if (multi) {
      const inList = multi.map(esc).join(', ');
      const op = cond.operator === '!=' ? 'NOT IN' : 'IN';
      return `${not}${cond.field} ${op} (${inList})`;
    }

    const fm: Record<string, (x: string) => string> = {
      contains: (x) => `ILIKE ${esc(`%${x}%`)}`,
      '!contains': (x) => `NOT ILIKE ${esc(`%${x}%`)}`,
      startsWith: (x) => `ILIKE ${esc(`${x}%`)}`,
      '!startsWith': (x) => `NOT ILIKE ${esc(`${x}%`)}`,
      endsWith: (x) => `ILIKE ${esc(`%${x}`)}`,
      '!endsWith': (x) => `NOT ILIKE ${esc(`%${x}`)}`,
    };
    if (fm[cond.operator]) return `${not}${cond.field} ${fm[cond.operator](cond.value)}`;
    return `${not}${cond.field} ${cond.operator} ${esc(cond.value)}`;
  }

  // Group
  const parts = cond.children.map(conditionToSql).filter(Boolean);
  if (parts.length === 0) return '';
  const not = cond.negated ? 'NOT ' : '';
  if (parts.length === 1) return `${not}${parts[0]}`;
  return `${not}(${parts.join(` ${cond.connector} `)})`;
}

// ═════════════════════════════════════════════════════════════════════════════
// Pretty-printed DSL (multi-line, aligned)
// ═════════════════════════════════════════════════════════════════════════════

export function conditionToDslPretty(cond: Condition): string {
  return formatDslNode(cond, 0);
}

function formatDslNode(cond: Condition, depth: number): string {
  if (cond.type === 'filter') {
    if (!cond.field) return '';
    const multi = resolveValues(cond);
    const chip: FilterChip = {
      id: cond.id, type: 'filter', field: cond.field,
      operator: cond.operator,
      value: multi ? multi[0] : cond.value,
      values: multi ?? undefined, quoted: cond.quoted,
    };
    const part = chipToQueryPart(chip);
    return cond.negated ? `NOT ${part}` : part;
  }

  const parts = cond.children.map((c) => formatDslNode(c, depth + 1)).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) {
    const inner = parts[0];
    return cond.negated ? `NOT ${inner}` : inner;
  }

  const connector = cond.connector; // AND / OR
  const pad = '  '.repeat(depth);
  const lines = parts.map((p, i) => {
    if (i === 0) return p;
    return `${pad}${connector.padStart(4)} ${p}`;
  });
  const body = lines.join('\n');
  if (depth > 0) {
    return cond.negated ? `NOT (${body})` : `(${body})`;
  }
  return cond.negated ? `NOT (${body})` : body;
}

// ═════════════════════════════════════════════════════════════════════════════
// Pretty-printed ClickHouse SQL (multi-line, aligned)
// ═════════════════════════════════════════════════════════════════════════════

export function conditionToSqlPretty(cond: Condition): string {
  const sql = formatSqlNode(cond, 0);
  return sql ? `WHERE ${sql}` : '';
}

function formatSqlNode(cond: Condition, depth: number): string {
  const esc = (s: string) => `'${s.replace(/'/g, "''")}'`;

  if (cond.type === 'filter') {
    if (!cond.field || (!cond.value && cond.field !== 'has' && cond.field !== '!has')) return '';
    const not = cond.negated ? 'NOT ' : '';
    if (cond.field === 'has') return `${not}${cond.value} IS NOT NULL`;
    if (cond.field === '!has') return `${not}${cond.value} IS NULL`;

    const multi = resolveValues(cond);
    if (multi) {
      const inList = multi.map(esc).join(', ');
      const op = cond.operator === '!=' ? 'NOT IN' : 'IN';
      return `${not}${cond.field} ${op} (${inList})`;
    }

    const fm: Record<string, (x: string) => string> = {
      contains: (x) => `ILIKE ${esc(`%${x}%`)}`,
      '!contains': (x) => `NOT ILIKE ${esc(`%${x}%`)}`,
      startsWith: (x) => `ILIKE ${esc(`${x}%`)}`,
      '!startsWith': (x) => `NOT ILIKE ${esc(`${x}%`)}`,
      endsWith: (x) => `ILIKE ${esc(`%${x}`)}`,
      '!endsWith': (x) => `NOT ILIKE ${esc(`%${x}`)}`,
    };
    if (fm[cond.operator]) return `${not}${cond.field} ${fm[cond.operator](cond.value)}`;
    return `${not}${cond.field} ${cond.operator} ${esc(cond.value)}`;
  }

  const parts = cond.children.map((c) => formatSqlNode(c, depth + 1)).filter(Boolean);
  if (parts.length === 0) return '';
  const not = cond.negated ? 'NOT ' : '';
  if (parts.length === 1) return `${not}${parts[0]}`;

  const connector = cond.connector;
  const pad = '      ' + '  '.repeat(depth); // align under WHERE
  const lines = parts.map((p, i) => {
    if (i === 0) return p;
    return `${pad}${connector.padStart(4)} ${p}`;
  });
  const body = lines.join('\n');
  if (depth > 0) {
    return `${not}(${body})`;
  }
  return `${not}${body}`;
}

// ═════════════════════════════════════════════════════════════════════════════
// Tree mutation helpers (immutable — return new tree)
// ═════════════════════════════════════════════════════════════════════════════

/** Deep clone */
export function cloneTree(cond: Condition): Condition {
  if (cond.type === 'filter') return { ...cond };
  return { ...cond, children: cond.children.map(cloneTree) };
}

/** Find and remove a condition by ID. Returns [newTree, removedItem]. */
export function removeCondition(root: GroupCondition, id: string): [GroupCondition, Condition | null] {
  let removed: Condition | null = null;

  function walk(group: GroupCondition): GroupCondition {
    const newChildren: Condition[] = [];
    for (const child of group.children) {
      if (child.id === id) {
        removed = child;
        continue; // skip = remove
      }
      if (child.type === 'group') {
        newChildren.push(walk(child));
      } else {
        newChildren.push({ ...child });
      }
    }
    return { ...group, children: newChildren };
  }

  const newRoot = walk(root);
  return [newRoot, removed];
}

/** Insert a condition into a group at a specific index. */
export function insertCondition(
  root: GroupCondition,
  targetGroupId: string,
  condition: Condition,
  index: number,
): GroupCondition {
  function walk(group: GroupCondition): GroupCondition {
    if (group.id === targetGroupId) {
      const children = [...group.children];
      children.splice(Math.min(index, children.length), 0, condition);
      return { ...group, children };
    }
    return { ...group, children: group.children.map((c) => c.type === 'group' ? walk(c) : { ...c }) };
  }
  return walk(root);
}

/** Move a condition from its current location to a target group at index. */
export function moveCondition(
  root: GroupCondition,
  conditionId: string,
  targetGroupId: string,
  index: number,
): GroupCondition {
  const [withoutCond, removed] = removeCondition(root, conditionId);
  if (!removed) return root;
  const inserted = insertCondition(withoutCond, targetGroupId, removed, index);
  return pruneEmptyGroups(inserted);
}

/** Remove non-root groups that have no children after a move/delete. */
export function pruneEmptyGroups(root: GroupCondition): GroupCondition {
  function walk(group: GroupCondition, isRoot: boolean): GroupCondition {
    const children: Condition[] = [];
    for (const child of group.children) {
      if (child.type === 'group') {
        const pruned = walk(child, false);
        // Keep only if it still has children (or is root)
        if (pruned.children.length > 0 || isRoot) {
          children.push(pruned);
        }
      } else {
        children.push(child);
      }
    }
    return { ...group, children };
  }
  return walk(root, true);
}

/** Update a condition's properties. */
export function updateCondition(
  root: GroupCondition,
  id: string,
  patch: Partial<FilterCondition> | Partial<GroupCondition>,
): GroupCondition {
  function walk(cond: Condition): Condition {
    if (cond.id === id) return { ...cond, ...patch } as Condition;
    if (cond.type === 'group') return { ...cond, children: cond.children.map(walk) };
    return { ...cond };
  }
  return walk(root) as GroupCondition;
}

/** Add a filter to a group. */
export function addFilterToGroup(
  root: GroupCondition,
  groupId: string,
  field = '',
  operator = '=',
): GroupCondition {
  const filter = createFilter(field, operator);
  return insertCondition(root, groupId, filter, Infinity);
}

/** Add a sub-group to a group. */
export function addGroupToGroup(
  root: GroupCondition,
  groupId: string,
): GroupCondition {
  const group = createGroup('AND', []);
  return insertCondition(root, groupId, group, Infinity);
}

/** Check if tree has any valid filters. */
export function hasValidFilters(root: GroupCondition): boolean {
  for (const child of root.children) {
    if (child.type === 'filter') {
      if (child.field === 'has' || child.field === '!has') {
        if (child.value) return true;
      } else if (child.field && child.value) {
        return true;
      }
    } else if (child.type === 'group') {
      if (hasValidFilters(child)) return true;
    }
  }
  return false;
}

/** Deep-clone a condition tree, assigning new IDs to every node. */
function deepClone(cond: Condition): Condition {
  if (cond.type === 'filter') {
    return { ...cond, id: nextId() };
  }
  return {
    ...cond,
    id: nextId(),
    children: cond.children.map(deepClone),
  };
}

/** Duplicate a condition (filter or group) right after itself in the same parent. */
export function duplicateCondition(
  root: GroupCondition,
  conditionId: string,
): GroupCondition {
  function walk(group: GroupCondition): GroupCondition {
    const children: Condition[] = [];
    for (const child of group.children) {
      if (child.type === 'group') {
        children.push(walk(child));
      } else {
        children.push(child);
      }
      if (child.id === conditionId) {
        children.push(deepClone(child));
      }
    }
    return { ...group, children };
  }
  return walk(root);
}
