// ============================================================================
// Query DSL Engine — Serializer (AST → Backend Query String)
// Spec: Section 13
// ============================================================================

import type { Expression } from './types';

// Backend operator mappings
const FUNC_OP_MAP: Record<string, string> = {
  contains: '.contains:',
  '!contains': '.not_contains:',
  startsWith: '.starts_with:',
  '!startsWith': '.not_starts_with:',
  endsWith: '.ends_with:',
  '!endsWith': '.not_ends_with:',
  before: '.before:',
  after: '.after:',
  between: '.between:',
};

/**
 * Serialize an AST expression into a backend-compatible query string.
 * Throws if the AST contains errors that prevent serialization.
 */
export function serializeForBackend(ast: Expression | null): string {
  if (!ast) return '';
  return serializeNode(ast);
}

function serializeNode(node: Expression): string {
  switch (node.type) {
    case 'Filter':
      return serializeFilter(node);
    case 'FreeText':
      return serializeFreeText(node);
    case 'Binary':
      return serializeBinary(node);
    case 'Not':
      return serializeNot(node);
    case 'Group':
      return `(${serializeNode(node.expression)})`;
    case 'Partial':
      throw new Error(`Cannot serialize partial expression: ${node.raw}`);
    default:
      throw new Error(`Unknown node type: ${(node as Expression).type}`);
  }
}

function serializeFilter(node: Expression & { type: 'Filter' }): string {
  const field = node.field;

  // Multi-value support (array representation)
  if (node.values && node.values.length > 0) {
    const vals = node.values.map((v) => formatValue(v)).join(', ');

    // Function operators with multiple values
    const funcMapping = FUNC_OP_MAP[node.operator];
    if (funcMapping) {
      return `${field}${funcMapping}[${vals}]`;
    }

    // Comparison operators with multiple values
    if (node.operator === '!=') {
      return `!${field}:[${vals}]`;
    }
    // Default implicit or explicit '=' with multiple values
    return `${field}:[${vals}]`;
  }

  // Function operators
  const funcMapping = FUNC_OP_MAP[node.operator];
  if (funcMapping) {
    return `${field}${funcMapping}${quoteValue(node.value)}`;
  }

  // Comparison operators
  if (node.operator === '!=') {
    return `${field}:!=${formatValue(node.value)}`;
  }
  if (['>', '>=', '<', '<='].includes(node.operator)) {
    return `${field}:${node.operator}${formatValue(node.value)}`;
  }

  // Simple equality
  return `${field}:${formatValue(node.value)}`;
}

function serializeFreeText(node: Expression & { type: 'FreeText' }): string {
  // FreeText → message:contains("...")
  return `message.contains:${quoteValue(node.value)}`;
}

function serializeBinary(node: Expression & { type: 'Binary' }): string {
  const left = serializeNode(node.left);
  const right = serializeNode(node.right);
  const op = node.operator.toUpperCase();
  return `${left} ${op} ${right}`;
}

function serializeNot(node: Expression & { type: 'Not' }): string {
  const inner = serializeNode(node.expression);
  return `!${inner}`;
}

function formatValue(value: string | number | boolean): string {
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return String(value);
  // Quote strings that contain spaces or special chars
  if (needsQuoting(value)) return `"${escapeString(value)}"`;
  return value;
}

function quoteValue(value: string | number | boolean): string {
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return String(value);
  return `"${escapeString(String(value))}"`;
}

function escapeString(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function needsQuoting(value: string): boolean {
  return (
    value.includes(' ') ||
    value.includes('"') ||
    value.includes('(') ||
    value.includes(')')
  );
}
