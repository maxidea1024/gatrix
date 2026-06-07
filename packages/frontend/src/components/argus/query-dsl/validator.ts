// ============================================================================
// Query DSL Engine — Semantic Validator
// Spec: Section 12
// ============================================================================

import type {
  Expression,
  ValidationError,
  QueryDomain,
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
  domain: QueryDomain
): ValidationError[] {
  if (!ast) return [];
  const errors: ValidationError[] = [];
  validateNode(ast, domain, errors);
  return errors;
}

// ─── Validation logic ────────────────────────────────────────────────────────

function validateNode(
  node: Expression,
  domain: QueryDomain,
  errors: ValidationError[]
): void {
  switch (node.type) {
    case 'Filter':
      validateFilter(node, domain, errors);
      break;
    case 'FreeText':
      // Free text is always valid at semantic level
      break;
    case 'Binary':
      validateNode(node.left, domain, errors);
      validateNode(node.right, domain, errors);
      break;
    case 'Not':
      validateNode(node.expression, domain, errors);
      break;
    case 'Group':
      validateNode(node.expression, domain, errors);
      break;
    case 'Partial':
      // Partial nodes already have syntax errors from parser
      break;
  }
}

function validateFilter(
  node: Expression & { type: 'Filter' },
  domain: QueryDomain,
  errors: ValidationError[]
): void {
  const resolvedKey = resolveAlias(node.field, domain);
  const field = getFieldByKey(resolvedKey, domain);

  if (!field) {
    errors.push({
      type: 'UNKNOWN_FIELD',
      messageKey: 'dsl.error.unknownField',
      hintKey: 'dsl.hint.unknownField',
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
      messageKey: 'dsl.error.invalidOperator',
      hintKey: 'dsl.hint.invalidOperator',
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
          messageKey: 'dsl.error.invalidValueType',
          hintKey: 'dsl.hint.invalidValueType',
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
          messageKey: 'dsl.error.invalidValueType',
          hintKey: 'dsl.hint.invalidValueType',
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
