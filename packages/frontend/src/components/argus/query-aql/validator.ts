// ============================================================================
// AQL (Argus Query Language) Engine — Semantic Validator
// Spec: Section 12
// ============================================================================

import type {
  Expression,
  ValidationError,
  DomainConfig,
  QueryOperator,
} from './types';
import { getFieldByKey, resolveAlias } from './fields';

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Validate an AST against field metadata for a specific domain.
 * Returns semantic errors (field-operator compatibility, unknown fields, etc.)
 * This does NOT include syntax errors — those are produced by the parser.
 */
export function validate(
  ast: Expression | null,
  config: DomainConfig
): ValidationError[] {
  if (!ast) return [];
  const errors: ValidationError[] = [];
  validateNode(ast, config, errors);
  return errors;
}

// ─── Validation logic ────────────────────────────────────────────────────────

function validateNode(
  node: Expression,
  config: DomainConfig,
  errors: ValidationError[]
): void {
  switch (node.type) {
    case 'Filter':
      validateFilter(node, config, errors);
      break;
    case 'FreeText':
      break;
    case 'Binary':
      validateNode(node.left, config, errors);
      validateNode(node.right, config, errors);
      break;
    case 'Not':
      validateNode(node.expression, config, errors);
      break;
    case 'Group':
      validateNode(node.expression, config, errors);
      break;
    case 'Partial':
      break;
  }
}

function validateFilter(
  node: Expression & { type: 'Filter' },
  config: DomainConfig,
  errors: ValidationError[]
): void {
  const resolvedKey = resolveAlias(node.field, config);
  const field = config.fields.find((f) => f.key === resolvedKey);

  if (!field) {
    errors.push({
      type: 'UNKNOWN_FIELD',
      messageKey: 'aql.error.unknownField',
      hintKey: 'aql.hint.unknownField',
      params: { field: node.field },
      field: node.field,
      start: node.start,
      end: node.end,
      severity: 'warning',
    });
    return;
  }

  // Check operator compatibility
  const op = node.operator as QueryOperator;
  if (op !== '=' && !field.operators.includes(op)) {
    errors.push({
      type: 'INVALID_OPERATOR',
      messageKey: 'aql.error.invalidOperator',
      hintKey: 'aql.hint.invalidOperator',
      params: { field: node.field, op },
      field: node.field,
      operator: op,
      start: node.start,
      end: node.end,
      severity: 'error',
    });
  }

  // Check value type compatibility
  validateValueType(
    node.field,
    field.type,
    node.value,
    node.start,
    node.end,
    errors
  );
}

function validateValueType(
  fieldName: string,
  expectedType: string,
  value: string | number | boolean,
  start: number,
  end: number,
  errors: ValidationError[]
): void {
  switch (expectedType) {
    case 'number':
      if (typeof value === 'string' && isNaN(Number(value)) && value !== '') {
        errors.push({
          type: 'INVALID_VALUE_TYPE',
          messageKey: 'aql.error.invalidValueType',
          hintKey: 'aql.hint.invalidValueType',
          params: { field: fieldName, expected: 'number' },
          field: fieldName,
          start,
          end,
          severity: 'error',
        });
      }
      break;
    case 'boolean':
      if (
        typeof value === 'string' &&
        value !== 'true' &&
        value !== 'false' &&
        value !== ''
      ) {
        errors.push({
          type: 'INVALID_VALUE_TYPE',
          messageKey: 'aql.error.invalidValueType',
          hintKey: 'aql.hint.invalidValueType',
          params: { field: fieldName, expected: 'boolean' },
          field: fieldName,
          start,
          end,
          severity: 'error',
        });
      }
      break;
    // string and datetime accept any value
  }
}
