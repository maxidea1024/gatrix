import { describe, it, expect } from 'vitest';
import { parse } from '../parser';

describe('Parser', () => {
  describe('basic filters', () => {
    it('should parse simple field:value', () => {
      const { ast, errors } = parse('country:KR');
      expect(errors).toHaveLength(0);
      expect(ast).toMatchObject({
        type: 'Filter',
        field: 'country',
        operator: '=',
        value: 'KR',
      });
    });

    it('should parse quoted string value', () => {
      const { ast } = parse('message:"hello world"');
      expect(ast).toMatchObject({
        type: 'Filter',
        field: 'message',
        operator: '=',
        value: 'hello world',
        quoted: true,
      });
    });

    it('should parse number value', () => {
      const { ast } = parse('level:100');
      expect(ast).toMatchObject({
        type: 'Filter',
        field: 'level',
        operator: '=',
        value: 100,
      });
    });

    it('should parse boolean value', () => {
      const { ast } = parse('handled:true');
      expect(ast).toMatchObject({
        type: 'Filter',
        field: 'handled',
        operator: '=',
        value: true,
      });
    });
  });

  describe('comparison operators', () => {
    it('should parse !=', () => {
      const { ast } = parse('country:!=CN');
      expect(ast).toMatchObject({
        type: 'Filter',
        field: 'country',
        operator: '!=',
        value: 'CN',
      });
    });

    it('should parse >', () => {
      const { ast } = parse('level:>100');
      expect(ast).toMatchObject({ type: 'Filter', operator: '>', value: 100 });
    });

    it('should parse >=', () => {
      const { ast } = parse('level:>=100');
      expect(ast).toMatchObject({ type: 'Filter', operator: '>=', value: 100 });
    });

    it('should parse <', () => {
      const { ast } = parse('level:<50');
      expect(ast).toMatchObject({ type: 'Filter', operator: '<', value: 50 });
    });

    it('should parse <=', () => {
      const { ast } = parse('level:<=50');
      expect(ast).toMatchObject({ type: 'Filter', operator: '<=', value: 50 });
    });
  });

  describe('function operators', () => {
    it('should parse contains()', () => {
      const { ast } = parse('message:contains("timeout")');
      expect(ast).toMatchObject({
        type: 'Filter',
        field: 'message',
        operator: 'contains',
        value: 'timeout',
        funcOp: 'contains',
      });
    });

    it('should parse startsWith()', () => {
      const { ast } = parse('message:startsWith("net")');
      expect(ast).toMatchObject({
        type: 'Filter',
        operator: 'startsWith',
        value: 'net',
      });
    });

    it('should parse in() with multiple values', () => {
      const { ast } = parse('country:in("KR", "JP", "US")');
      expect(ast).toMatchObject({
        type: 'Filter',
        field: 'country',
        operator: 'in',
        values: ['KR', 'JP', 'US'],
      });
    });
  });

  describe('logical operators', () => {
    it('should parse AND', () => {
      const { ast } = parse('country:KR and level:error');
      expect(ast).toMatchObject({
        type: 'Binary',
        operator: 'and',
        left: { type: 'Filter', field: 'country' },
        right: { type: 'Filter', field: 'level' },
      });
    });

    it('should parse OR', () => {
      const { ast } = parse('country:KR or country:JP');
      expect(ast).toMatchObject({
        type: 'Binary',
        operator: 'or',
        left: { type: 'Filter', value: 'KR' },
        right: { type: 'Filter', value: 'JP' },
      });
    });

    it('should parse NOT', () => {
      const { ast } = parse('not country:CN');
      expect(ast).toMatchObject({
        type: 'Not',
        usedBang: false,
        expression: { type: 'Filter', field: 'country', value: 'CN' },
      });
    });

    it('should parse BANG (!)', () => {
      const { ast } = parse('!country:CN');
      expect(ast).toMatchObject({
        type: 'Not',
        usedBang: true,
        expression: { type: 'Filter', field: 'country' },
      });
    });

    it('should respect operator precedence: not > and > or', () => {
      // a:1 or b:2 and not c:3  →  a:1 or (b:2 and (not c:3))
      const { ast } = parse('a:1 or b:2 and not c:3');
      expect(ast).toMatchObject({
        type: 'Binary',
        operator: 'or',
        left: { type: 'Filter', field: 'a' },
        right: {
          type: 'Binary',
          operator: 'and',
          left: { type: 'Filter', field: 'b' },
          right: { type: 'Not', expression: { type: 'Filter', field: 'c' } },
        },
      });
    });
  });

  describe('grouping', () => {
    it('should parse parenthesized expression', () => {
      const { ast } = parse('(country:KR or country:JP) and level:error');
      expect(ast).toMatchObject({
        type: 'Binary',
        operator: 'and',
        left: {
          type: 'Group',
          expression: { type: 'Binary', operator: 'or' },
        },
        right: { type: 'Filter', field: 'level' },
      });
    });

    it('should parse !(expr)', () => {
      const { ast } = parse('!(country:KR)');
      expect(ast).toMatchObject({
        type: 'Not',
        usedBang: true,
        expression: {
          type: 'Group',
          expression: { type: 'Filter', field: 'country' },
        },
      });
    });
  });

  describe('free text', () => {
    it('should parse standalone word as FreeText', () => {
      const { ast } = parse('timeout');
      expect(ast).toMatchObject({
        type: 'FreeText',
        value: 'timeout',
        quoted: false,
      });
    });

    it('should parse quoted free text', () => {
      const { ast } = parse('"network error"');
      expect(ast).toMatchObject({
        type: 'FreeText',
        value: 'network error',
        quoted: true,
      });
    });

    it('should parse free text mixed with filter', () => {
      const { ast } = parse('timeout and country:KR');
      expect(ast).toMatchObject({
        type: 'Binary',
        operator: 'and',
        left: { type: 'FreeText', value: 'timeout' },
        right: { type: 'Filter', field: 'country' },
      });
    });
  });

  describe('error recovery', () => {
    it('should detect dangling AND', () => {
      const { errors } = parse('country:KR and');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].type).toBe('DANGLING_OPERATOR');
    });

    it('should detect dangling OR', () => {
      const { errors } = parse('country:KR or');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].type).toBe('DANGLING_OPERATOR');
    });

    it('should detect dangling NOT', () => {
      const { errors } = parse('not');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].type).toBe('DANGLING_OPERATOR');
    });

    it('should detect unclosed paren', () => {
      const { errors } = parse('(country:KR');
      expect(errors.some((e) => e.type === 'UNCLOSED_PAREN')).toBe(true);
    });

    it('should detect incomplete filter', () => {
      const { errors } = parse('country:');
      expect(errors.some((e) => e.type === 'INCOMPLETE_FILTER')).toBe(true);
    });

    it('should detect incomplete function', () => {
      // `message:contains(` — has `(` so contains is recognized as function
      const { errors } = parse('message:contains(');
      expect(
        errors.some(
          (e) => e.type === 'INCOMPLETE_FUNCTION' || e.type === 'UNCLOSED_PAREN'
        )
      ).toBe(true);
    });

    it('should still return AST on errors', () => {
      const { ast, errors } = parse('country:KR and');
      expect(ast).not.toBeNull();
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('empty input', () => {
    it('should return null AST for empty string', () => {
      const { ast, errors } = parse('');
      expect(ast).toBeNull();
      expect(errors).toHaveLength(0);
    });

    it('should return null AST for whitespace', () => {
      const { ast, errors } = parse('   ');
      expect(ast).toBeNull();
      expect(errors).toHaveLength(0);
    });
  });
});
