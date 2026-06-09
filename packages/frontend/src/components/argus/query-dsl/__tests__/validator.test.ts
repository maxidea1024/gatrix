import { describe, it, expect } from 'vitest';
import { parse } from '../parser';
import { validate } from '../validator';
import { LOGS_CONFIG, PERFORMANCE_CONFIG } from '../fields';

describe('Validator', () => {
  describe('valid queries', () => {
    it('should pass valid filter', () => {
      const { ast } = parse('level:error');
      const errors = validate(ast, LOGS_CONFIG);
      expect(errors).toHaveLength(0);
    });

    it('should pass valid != operator on string field', () => {
      const { ast } = parse('level:!=warning');
      const errors = validate(ast, LOGS_CONFIG);
      expect(errors).toHaveLength(0);
    });

    it('should pass valid contains on message field', () => {
      const { ast } = parse('message:contains("test")');
      const errors = validate(ast, LOGS_CONFIG);
      expect(errors).toHaveLength(0);
    });
  });

  describe('unknown fields', () => {
    it('should warn on unknown field', () => {
      const { ast } = parse('foobar:test');
      const errors = validate(ast, LOGS_CONFIG);
      expect(errors).toHaveLength(1);
      expect(errors[0].type).toBe('UNKNOWN_FIELD');
      expect(errors[0].severity).toBe('warning');
      expect(errors[0].params.field).toBe('foobar');
    });

    it('should resolve alias and not warn', () => {
      // severity → level (alias)
      const { ast } = parse('severity:error');
      const errors = validate(ast, LOGS_CONFIG);
      expect(errors).toHaveLength(0);
    });
  });

  describe('invalid operators', () => {
    it('should error on > operator for string field', () => {
      const { ast } = parse('level:>100');
      const errors = validate(ast, LOGS_CONFIG);
      expect(errors.some((e) => e.type === 'INVALID_OPERATOR')).toBe(true);
    });

    it('should error on contains for non-string field (issue_id is number)', () => {
      const { ast } = parse('issue_id:contains("test")');
      const errors = validate(ast, LOGS_CONFIG);
      expect(errors.some((e) => e.type === 'INVALID_OPERATOR')).toBe(true);
    });
  });

  describe('value type validation', () => {
    it('should error on non-number value for number field', () => {
      const { ast } = parse('issue_id:abc');
      const errors = validate(ast, LOGS_CONFIG);
      expect(errors.some((e) => e.type === 'INVALID_VALUE_TYPE')).toBe(true);
    });
  });

  describe('domain-specific fields', () => {
    it('should warn on field not in logs domain', () => {
      const { ast } = parse('transaction:test');
      const errors = validate(ast, LOGS_CONFIG);
      expect(errors.some((e) => e.type === 'UNKNOWN_FIELD')).toBe(true);
    });

    it('should pass for field in performance domain', () => {
      const { ast } = parse('transaction:test');
      const errors = validate(ast, PERFORMANCE_CONFIG);
      expect(errors).toHaveLength(0);
    });
  });

  describe('i18n keys', () => {
    it('should include correct i18n keys', () => {
      const { ast } = parse('foobar:test');
      const errors = validate(ast, LOGS_CONFIG);
      expect(errors[0].messageKey).toBe('dsl.error.unknownField');
      expect(errors[0].hintKey).toBe('dsl.hint.unknownField');
    });
  });
});
