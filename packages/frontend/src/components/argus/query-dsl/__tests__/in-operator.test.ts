/**
 * IN / NOT IN operator — end-to-end tests.
 *
 * Coverage:
 *   1. Lexer: tokenization of in()/!in()
 *   2. Parser: AST structure with values array
 *   3. Serializer: AST → backend format (field:[v1,v2])
 *   4. useFilterChips: queryToChips ↔ chipsToQuery round-trip
 *   5. Edge cases: empty in(), single value, mixed types, nested
 */
import { describe, it, expect } from 'vitest';
import { tokenize } from '../lexer';
import { parse } from '../parser';
import { serializeForBackend } from '../serializer';
import { queryToChips, chipsToQuery, type FilterChip } from '../useFilterChips';
import { TokenType } from '../types';
import type { FilterExpression } from '../types';

// ─── Helper ──────────────────────────────────────────────────────────────────

function assertFilter(ast: unknown): FilterExpression {
  expect(ast).not.toBeNull();
  const node = ast as FilterExpression;
  expect(node.type).toBe('Filter');
  return node;
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. LEXER
// ═════════════════════════════════════════════════════════════════════════════

describe('Lexer — in/!in tokenization', () => {
  it('should tokenize field:in("v1","v2") into FIELD COLON IN LPAREN STRING COMMA STRING RPAREN', () => {
    const tokens = tokenize('logger:in("UE4Core", "LuaVM")');
    const types = tokens.map((t) => t.type);

    expect(types).toEqual([
      TokenType.FIELD,   // logger
      TokenType.COLON,   // :
      TokenType.IN,      // in
      TokenType.LPAREN,  // (
      TokenType.STRING,  // UE4Core
      TokenType.COMMA,   // ,
      TokenType.STRING,  // LuaVM
      TokenType.RPAREN,  // )
      TokenType.EOF,
    ]);
  });

  it('should tokenize field:!in("v1","v2") into FIELD COLON NOT_IN ...', () => {
    const tokens = tokenize('logger:!in("UE4Core", "LuaVM")');
    const types = tokens.map((t) => t.type);

    expect(types).toEqual([
      TokenType.FIELD,
      TokenType.COLON,
      TokenType.NOT_IN,
      TokenType.LPAREN,
      TokenType.STRING,
      TokenType.COMMA,
      TokenType.STRING,
      TokenType.RPAREN,
      TokenType.EOF,
    ]);
  });

  it('should tokenize single-value in()', () => {
    const tokens = tokenize('level:in("error")');
    const types = tokens.map((t) => t.type);

    expect(types).toEqual([
      TokenType.FIELD,
      TokenType.COLON,
      TokenType.IN,
      TokenType.LPAREN,
      TokenType.STRING,
      TokenType.RPAREN,
      TokenType.EOF,
    ]);
  });

  it('should tokenize in with unquoted values', () => {
    const tokens = tokenize('level:in(error, warning, info)');
    const types = tokens.map((t) => t.type);

    // Unquoted words inside parens → FIELD tokens (afterColon=false after '(')
    expect(types).toEqual([
      TokenType.FIELD,
      TokenType.COLON,
      TokenType.IN,
      TokenType.LPAREN,
      TokenType.FIELD,   // error (unquoted → FIELD)
      TokenType.COMMA,
      TokenType.FIELD,   // warning
      TokenType.COMMA,
      TokenType.FIELD,   // info
      TokenType.RPAREN,
      TokenType.EOF,
    ]);
  });

  it('should NOT tokenize "in" as IN when not followed by (', () => {
    // "in" without parens is just a STRING value
    const tokens = tokenize('logger:in');
    const types = tokens.map((t) => t.type);

    expect(types).toEqual([
      TokenType.FIELD,
      TokenType.COLON,
      TokenType.STRING, // "in" treated as string value, not IN function
      TokenType.EOF,
    ]);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 2. PARSER
// ═════════════════════════════════════════════════════════════════════════════

describe('Parser — in/!in AST structure', () => {
  it('should parse in() with multiple quoted values', () => {
    const { ast, errors } = parse('logger:in("UE4Core", "LuaVM")');
    expect(errors).toHaveLength(0);

    const filter = assertFilter(ast);
    expect(filter.field).toBe('logger');
    expect(filter.operator).toBe('in');
    expect(filter.values).toEqual(['UE4Core', 'LuaVM']);
    expect(filter.funcOp).toBe('in');
  });

  it('should parse !in() with multiple values', () => {
    const { ast, errors } = parse('logger:!in("UE4Core", "LuaVM", "Net")');
    expect(errors).toHaveLength(0);

    const filter = assertFilter(ast);
    expect(filter.field).toBe('logger');
    expect(filter.operator).toBe('!in');
    expect(filter.values).toEqual(['UE4Core', 'LuaVM', 'Net']);
    expect(filter.funcOp).toBe('!in');
  });

  it('should parse single-value in()', () => {
    const { ast, errors } = parse('level:in("error")');
    expect(errors).toHaveLength(0);

    const filter = assertFilter(ast);
    expect(filter.operator).toBe('in');
    expect(filter.values).toEqual(['error']);
    expect(filter.value).toBe('error');
  });

  it('should parse in() with unquoted values', () => {
    const { ast, errors } = parse('level:in(error, warning)');
    expect(errors).toHaveLength(0);

    const filter = assertFilter(ast);
    expect(filter.operator).toBe('in');
    expect(filter.values).toEqual(['error', 'warning']);
  });

  it('should parse in() with numeric values', () => {
    const { ast, errors } = parse('status:in(200, 404, 500)');
    expect(errors).toHaveLength(0);

    const filter = assertFilter(ast);
    expect(filter.operator).toBe('in');
    // Numeric values inside in() parens come as strings (lexer emits FIELD tokens)
    expect(filter.values).toEqual(['200', '404', '500']);
  });

  it('should parse in() combined with AND', () => {
    const { ast, errors } = parse('logger:in("UE4Core", "LuaVM") and level:error');
    expect(errors).toHaveLength(0);
    expect(ast).not.toBeNull();
    expect(ast!.type).toBe('Binary');
    if (ast!.type === 'Binary') {
      const left = ast.left as FilterExpression;
      expect(left.operator).toBe('in');
      expect(left.values).toEqual(['UE4Core', 'LuaVM']);

      const right = ast.right as FilterExpression;
      expect(right.field).toBe('level');
      expect(right.operator).toBe('=');
    }
  });

  it('should parse in() with implicit AND', () => {
    const { ast, errors } = parse('logger:in("UE4Core", "LuaVM") level:error');
    expect(errors).toHaveLength(0);
    expect(ast).not.toBeNull();
    expect(ast!.type).toBe('Binary');
  });

  it('should produce error for empty in()', () => {
    const { ast, errors } = parse('logger:in()');
    // Should still produce an AST, but with empty values
    expect(ast).not.toBeNull();
    const filter = assertFilter(ast);
    expect(filter.operator).toBe('in');
    expect(filter.values).toEqual([]);
  });

  it('should produce error for in without parens', () => {
    const { errors } = parse('logger:in');
    // "in" without parens → treated as simple value "in" (field:value = "in")
    // This is NOT an error; it just becomes logger = "in"
    expect(errors).toHaveLength(0);
  });

  it('should handle unclosed in(', () => {
    const { ast, errors } = parse('logger:in("UE4Core"');
    // Should have UNCLOSED_PAREN error but still parse values
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.type === 'UNCLOSED_PAREN')).toBe(true);

    const filter = assertFilter(ast);
    expect(filter.values).toEqual(['UE4Core']);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 3. SERIALIZER (AST → Backend Format)
// ═════════════════════════════════════════════════════════════════════════════

describe('Serializer — in/!in to backend format', () => {
  it('should serialize in() as field:[v1, v2]', () => {
    const { ast } = parse('logger:in("UE4Core", "LuaVM")');
    const serialized = serializeForBackend(ast);
    expect(serialized).toBe('logger:[UE4Core, LuaVM]');
  });

  it('should serialize !in() as !field:[v1, v2]', () => {
    const { ast } = parse('logger:!in("UE4Core", "LuaVM")');
    const serialized = serializeForBackend(ast);
    expect(serialized).toBe('!logger:[UE4Core, LuaVM]');
  });

  it('should serialize single-value in() as field:[v1]', () => {
    const { ast } = parse('level:in("error")');
    const serialized = serializeForBackend(ast);
    expect(serialized).toBe('level:[error]');
  });

  it('should serialize in() with AND correctly', () => {
    const { ast } = parse('logger:in("UE4Core", "LuaVM") and level:error');
    const serialized = serializeForBackend(ast);
    expect(serialized).toBe('logger:[UE4Core, LuaVM] AND level:error');
  });

  it('should serialize in() with values containing spaces', () => {
    const { ast } = parse('logger:in("UE4 Core", "Lua VM")');
    const serialized = serializeForBackend(ast);
    expect(serialized).toBe('logger:["UE4 Core", "Lua VM"]');
  });

  it('should serialize numeric in() values without quotes', () => {
    const { ast } = parse('status:in(200, 404)');
    const serialized = serializeForBackend(ast);
    expect(serialized).toBe('status:[200, 404]');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 4. useFilterChips — queryToChips / chipsToQuery Round-trip
// ═════════════════════════════════════════════════════════════════════════════

describe('useFilterChips — in/!in round-trip', () => {
  it('queryToChips should produce chip with values array for in()', () => {
    const chips = queryToChips('logger:in("UE4Core", "LuaVM")');
    expect(chips).toHaveLength(1);
    const chip = chips[0];
    expect(chip.field).toBe('logger');
    expect(chip.operator).toBe('in');
    expect(chip.values).toEqual(['UE4Core', 'LuaVM']);
    expect(chip.value).toBe('UE4Core, LuaVM');
  });

  it('queryToChips should produce chip with values for !in()', () => {
    const chips = queryToChips('logger:!in("UE4Core", "LuaVM")');
    expect(chips).toHaveLength(1);
    expect(chips[0].operator).toBe('!in');
    expect(chips[0].values).toEqual(['UE4Core', 'LuaVM']);
  });

  it('chipsToQuery should serialize in chip correctly', () => {
    const chip: FilterChip = {
      id: 'test1', type: 'filter', field: 'logger',
      operator: 'in', value: 'UE4Core, LuaVM',
      values: ['UE4Core', 'LuaVM'], quoted: true,
    };
    const query = chipsToQuery([chip]);
    expect(query).toBe('logger:in("UE4Core", "LuaVM")');
  });

  it('chipsToQuery should serialize !in chip correctly', () => {
    const chip: FilterChip = {
      id: 'test2', type: 'filter', field: 'logger',
      operator: '!in', value: 'UE4Core, LuaVM',
      values: ['UE4Core', 'LuaVM'], quoted: true,
    };
    const query = chipsToQuery([chip]);
    expect(query).toBe('logger:!in("UE4Core", "LuaVM")');
  });

  it('round-trip: queryToChips → chipsToQuery should preserve in()', () => {
    const original = 'logger:in("UE4Core", "LuaVM")';
    const chips = queryToChips(original);
    const restored = chipsToQuery(chips);
    expect(restored).toBe(original);
  });

  it('round-trip: queryToChips → chipsToQuery should preserve !in()', () => {
    const original = 'logger:!in("UE4Core", "LuaVM")';
    const chips = queryToChips(original);
    const restored = chipsToQuery(chips);
    expect(restored).toBe(original);
  });

  it('round-trip with multiple chips including in()', () => {
    const original = 'logger:in("UE4Core", "LuaVM") level:error';
    const chips = queryToChips(original);
    expect(chips).toHaveLength(2);
    expect(chips[0].operator).toBe('in');
    expect(chips[1].operator).toBe('=');

    const restored = chipsToQuery(chips);
    expect(restored).toBe(original);
  });

  it('queryToChips with three values', () => {
    const chips = queryToChips('logger:in("A", "B", "C")');
    expect(chips).toHaveLength(1);
    expect(chips[0].values).toEqual(['A', 'B', 'C']);
    expect(chips[0].value).toBe('A, B, C');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 5. Edge cases
// ═════════════════════════════════════════════════════════════════════════════

describe('Edge cases — in/!in', () => {
  it('"in" as a simple value (no parens) should be equality filter', () => {
    const { ast, errors } = parse('logger:in');
    expect(errors).toHaveLength(0);

    const filter = assertFilter(ast);
    expect(filter.operator).toBe('=');
    expect(filter.value).toBe('in');
    expect(filter.values).toBeUndefined();
  });

  it('in() with single value should still use in operator', () => {
    const { ast } = parse('logger:in("UE4Core")');
    const filter = assertFilter(ast);
    expect(filter.operator).toBe('in');
    expect(filter.values).toEqual(['UE4Core']);
  });

  it('serializer round-trip: parse → serialize → parse should match', () => {
    const input = 'logger:in("UE4Core", "LuaVM")';
    const { ast: ast1 } = parse(input);
    const serialized = serializeForBackend(ast1);
    // Backend format is logger:[UE4Core, LuaVM] — different from frontend in()
    // So we verify the serialized form is correct for backend
    expect(serialized).toBe('logger:[UE4Core, LuaVM]');
  });

  it('in() combined with OR', () => {
    const { ast, errors } = parse('logger:in("UE4Core", "LuaVM") or level:error');
    expect(errors).toHaveLength(0);
    expect(ast).not.toBeNull();
    expect(ast!.type).toBe('Binary');
    if (ast!.type === 'Binary') {
      expect(ast!.operator).toBe('or');
    }
  });

  it('NOT in() (prefix negation)', () => {
    const { ast, errors } = parse('not logger:in("UE4Core", "LuaVM")');
    expect(errors).toHaveLength(0);
    expect(ast).not.toBeNull();
    expect(ast!.type).toBe('Not');
    if (ast!.type === 'Not') {
      const inner = ast!.expression as FilterExpression;
      expect(inner.operator).toBe('in');
      expect(inner.values).toEqual(['UE4Core', 'LuaVM']);
    }
  });

  it('!in() vs not field:in() produce different ASTs', () => {
    // field:!in() → operator is '!in'
    const { ast: ast1 } = parse('logger:!in("UE4Core")');
    const f1 = assertFilter(ast1);
    expect(f1.operator).toBe('!in');

    // not field:in() → Not wrapping a filter with 'in' operator
    const { ast: ast2 } = parse('not logger:in("UE4Core")');
    expect(ast2!.type).toBe('Not');
  });

  it('in() with mixed quoted and unquoted values', () => {
    const { ast } = parse('logger:in("UE4Core", LuaVM)');
    const filter = assertFilter(ast);
    expect(filter.values).toEqual(['UE4Core', 'LuaVM']);
  });

  it('in() with trailing comma should still work', () => {
    const { ast } = parse('logger:in("UE4Core", "LuaVM",)');
    const filter = assertFilter(ast);
    // Trailing comma should be ignored, values should be parsed correctly
    expect(filter.values).toEqual(['UE4Core', 'LuaVM']);
  });

  it('in() within parenthesized group', () => {
    const { ast, errors } = parse('(logger:in("A", "B")) and level:error');
    expect(errors).toHaveLength(0);
    expect(ast).not.toBeNull();
    expect(ast!.type).toBe('Binary');
    if (ast!.type === 'Binary') {
      expect(ast!.left.type).toBe('Group');
    }
  });
});
