import { describe, it, expect } from 'vitest';
import { parse } from '../parser';
import { tokenize } from '../lexer';
import { serializeForBackend } from '../serializer';
import { validate } from '../validator';
import { TokenType } from '../types';

describe('Edge Cases', () => {
  describe('deeply nested expressions', () => {
    it('should parse deeply nested groups', () => {
      const { ast, errors } = parse('((a:1 and b:2) or (c:3 and d:4))');
      expect(errors).toHaveLength(0);
      expect(ast).not.toBeNull();
      expect(ast!.type).toBe('Group');
    });

    it('should parse triple nested NOT', () => {
      const { ast, errors } = parse('not not not a:1');
      expect(errors).toHaveLength(0);
      expect(ast!.type).toBe('Not');
    });
  });

  describe('special characters in values', () => {
    it('should handle asterisk in quoted string (not wildcard)', () => {
      const { ast } = parse('message:contains("*network*")');
      expect(ast).toMatchObject({
        type: 'Filter',
        operator: 'contains',
        value: '*network*',
      });
    });

    it('should handle question mark in quoted string (not wildcard)', () => {
      const { ast } = parse('message:"test?.log"');
      expect(ast).toMatchObject({
        type: 'Filter',
        value: 'test?.log',
      });
    });

    it('should handle escaped quotes in string', () => {
      const tokens = tokenize('message:"\\"hello\\""');
      const strings = tokens.filter((t) => t.type === TokenType.STRING);
      expect(strings[0].value).toBe('"hello"');
    });
  });

  describe('colon-after-space tolerance', () => {
    it('should parse country: KR as country:KR', () => {
      const { ast, errors } = parse('country: KR');
      expect(errors).toHaveLength(0);
      expect(ast).toMatchObject({
        type: 'Filter',
        field: 'country',
        value: 'KR',
      });
    });

    it('should parse with multiple spaces after colon', () => {
      const { ast, errors } = parse('country:    KR');
      expect(errors).toHaveLength(0);
      expect(ast).toMatchObject({ type: 'Filter', value: 'KR' });
    });
  });

  describe('keywords as field names', () => {
    it('should parse and:value as filter', () => {
      const { ast } = parse('and:value');
      expect(ast).toMatchObject({
        type: 'Filter',
        field: 'and',
        value: 'value',
      });
    });

    it('should parse or:test as filter', () => {
      const { ast } = parse('or:test');
      expect(ast).toMatchObject({ type: 'Filter', field: 'or', value: 'test' });
    });

    it('should parse not:test as filter', () => {
      const { ast } = parse('not:test');
      expect(ast).toMatchObject({
        type: 'Filter',
        field: 'not',
        value: 'test',
      });
    });
  });

  describe('empty and whitespace', () => {
    it('should return null for empty', () => {
      expect(parse('').ast).toBeNull();
    });

    it('should return null for whitespace', () => {
      expect(parse('   \t\n  ').ast).toBeNull();
    });
  });

  describe('identifier rules', () => {
    it('should allow dots in field names', () => {
      const { ast } = parse('event.type:click');
      expect(ast).toMatchObject({
        type: 'Filter',
        field: 'event.type',
        value: 'click',
      });
    });

    it('should allow underscores in field names', () => {
      const { ast } = parse('logger_name:main');
      expect(ast).toMatchObject({
        type: 'Filter',
        field: 'logger_name',
        value: 'main',
      });
    });

    it('should allow underscore-start field names', () => {
      const { ast } = parse('_custom:val');
      expect(ast).toMatchObject({ type: 'Filter', field: '_custom' });
    });
  });

  describe('relative time in datetime fields', () => {
    it('should parse now-1h as value', () => {
      const { ast } = parse('timestamp:after("now-1h")');
      expect(ast).toMatchObject({ type: 'Filter', value: 'now-1h' });
    });

    it('should serialize relative time as-is', () => {
      const serialized = serializeForBackend(
        parse('timestamp:after("now-1h")').ast
      );
      expect(serialized).toContain('now-1h');
    });
  });

  describe('round-trip consistency', () => {
    it('should preserve semantics through parse → serialize', () => {
      const input = 'country:KR and level:error';
      const { ast } = parse(input);
      const serialized = serializeForBackend(ast);
      expect(serialized).toBe('country:KR AND level:error');
    });
  });

  describe('mixed free text and filters', () => {
    it('should parse free text before filter', () => {
      const { ast } = parse('timeout and country:KR');
      expect(ast).toMatchObject({
        type: 'Binary',
        operator: 'and',
        left: { type: 'FreeText', value: 'timeout' },
        right: { type: 'Filter', field: 'country' },
      });
    });

    it('should parse free text after filter', () => {
      const { ast } = parse('country:KR and timeout');
      expect(ast).toMatchObject({
        type: 'Binary',
        operator: 'and',
        left: { type: 'Filter' },
        right: { type: 'FreeText' },
      });
    });
  });

  describe('validator with discover domain', () => {
    it('should accept all fields in discover domain', () => {
      const { ast } = parse('transaction:test and level:error');
      const errors = validate(ast, 'discover');
      expect(errors).toHaveLength(0);
    });
  });
});
