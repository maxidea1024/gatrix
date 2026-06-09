// ============================================================================
// Query DSL Engine — Lexer Tests
// Spec: Section 19.2
// ============================================================================

import { describe, it, expect } from 'vitest';
import { tokenize } from '../lexer';
import { TokenType } from '../types';
import type { Token } from '../types';

/** Helper: extract type/value pairs, excluding EOF */
function tv(input: string): Array<[TokenType, string]> {
  return tokenize(input)
    .filter((t) => t.type !== TokenType.EOF)
    .map((t) => [t.type, t.value]);
}

/** Helper: get token types only, excluding EOF */
function types(input: string): TokenType[] {
  return tokenize(input)
    .filter((t) => t.type !== TokenType.EOF)
    .map((t) => t.type);
}

describe('Lexer', () => {
  // ─── Basic tokens ────────────────────────────────────────────────────

  describe('basic tokens', () => {
    it('should tokenize empty string', () => {
      const tokens = tokenize('');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].type).toBe(TokenType.EOF);
    });

    it('should tokenize whitespace only', () => {
      const tokens = tokenize('   \t\n  ');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].type).toBe(TokenType.EOF);
    });

    it('should tokenize a simple field:value', () => {
      expect(tv('country:KR')).toEqual([
        [TokenType.FIELD, 'country'],
        [TokenType.COLON, ':'],
        [TokenType.STRING, 'KR'],
      ]);
    });

    it('should tokenize field with quoted string value', () => {
      expect(tv('message:"hello world"')).toEqual([
        [TokenType.FIELD, 'message'],
        [TokenType.COLON, ':'],
        [TokenType.STRING, 'hello world'],
      ]);
    });

    it('should tokenize number value', () => {
      expect(tv('level:100')).toEqual([
        [TokenType.FIELD, 'level'],
        [TokenType.COLON, ':'],
        [TokenType.NUMBER, '100'],
      ]);
    });

    it('should tokenize negative number', () => {
      expect(tv('offset:-50')).toEqual([
        [TokenType.FIELD, 'offset'],
        [TokenType.COLON, ':'],
        [TokenType.NUMBER, '-50'],
      ]);
    });

    it('should tokenize decimal number', () => {
      expect(tv('ratio:3.14')).toEqual([
        [TokenType.FIELD, 'ratio'],
        [TokenType.COLON, ':'],
        [TokenType.NUMBER, '3.14'],
      ]);
    });

    it('should tokenize boolean values', () => {
      expect(tv('handled:true')).toEqual([
        [TokenType.FIELD, 'handled'],
        [TokenType.COLON, ':'],
        [TokenType.BOOLEAN, 'true'],
      ]);
      expect(tv('handled:false')).toEqual([
        [TokenType.FIELD, 'handled'],
        [TokenType.COLON, ':'],
        [TokenType.BOOLEAN, 'false'],
      ]);
    });
  });

  // ─── Comparison operators ────────────────────────────────────────────

  describe('comparison operators', () => {
    it('should tokenize != operator', () => {
      expect(tv('country:!=CN')).toEqual([
        [TokenType.FIELD, 'country'],
        [TokenType.COLON, ':'],
        [TokenType.NE, '!='],
        [TokenType.STRING, 'CN'],
      ]);
    });

    it('should tokenize > operator', () => {
      expect(tv('level:>100')).toEqual([
        [TokenType.FIELD, 'level'],
        [TokenType.COLON, ':'],
        [TokenType.GT, '>'],
        [TokenType.NUMBER, '100'],
      ]);
    });

    it('should tokenize >= operator', () => {
      expect(tv('level:>=100')).toEqual([
        [TokenType.FIELD, 'level'],
        [TokenType.COLON, ':'],
        [TokenType.GTE, '>='],
        [TokenType.NUMBER, '100'],
      ]);
    });

    it('should tokenize < operator', () => {
      expect(tv('level:<50')).toEqual([
        [TokenType.FIELD, 'level'],
        [TokenType.COLON, ':'],
        [TokenType.LT, '<'],
        [TokenType.NUMBER, '50'],
      ]);
    });

    it('should tokenize <= operator', () => {
      expect(tv('level:<=50')).toEqual([
        [TokenType.FIELD, 'level'],
        [TokenType.COLON, ':'],
        [TokenType.LTE, '<='],
        [TokenType.NUMBER, '50'],
      ]);
    });
  });

  // ─── Function operators ──────────────────────────────────────────────

  describe('function operators', () => {
    it('should tokenize contains()', () => {
      expect(tv('message:contains("timeout")')).toEqual([
        [TokenType.FIELD, 'message'],
        [TokenType.COLON, ':'],
        [TokenType.CONTAINS, 'contains'],
        [TokenType.LPAREN, '('],
        [TokenType.STRING, 'timeout'],
        [TokenType.RPAREN, ')'],
      ]);
    });

    it('should tokenize startsWith()', () => {
      expect(tv('message:startsWith("net")')).toEqual([
        [TokenType.FIELD, 'message'],
        [TokenType.COLON, ':'],
        [TokenType.STARTS_WITH, 'startsWith'],
        [TokenType.LPAREN, '('],
        [TokenType.STRING, 'net'],
        [TokenType.RPAREN, ')'],
      ]);
    });

    it('should tokenize endsWith()', () => {
      expect(tv('message:endsWith("error")')).toEqual([
        [TokenType.FIELD, 'message'],
        [TokenType.COLON, ':'],
        [TokenType.ENDS_WITH, 'endsWith'],
        [TokenType.LPAREN, '('],
        [TokenType.STRING, 'error'],
        [TokenType.RPAREN, ')'],
      ]);
    });

    it('should tokenize before()', () => {
      expect(tv('timestamp:before("2025-01-01")')).toEqual([
        [TokenType.FIELD, 'timestamp'],
        [TokenType.COLON, ':'],
        [TokenType.BEFORE, 'before'],
        [TokenType.LPAREN, '('],
        [TokenType.STRING, '2025-01-01'],
        [TokenType.RPAREN, ')'],
      ]);
    });

    it('should tokenize after()', () => {
      expect(tv('timestamp:after("now-1h")')).toEqual([
        [TokenType.FIELD, 'timestamp'],
        [TokenType.COLON, ':'],
        [TokenType.AFTER, 'after'],
        [TokenType.LPAREN, '('],
        [TokenType.STRING, 'now-1h'],
        [TokenType.RPAREN, ')'],
      ]);
    });

    it('should NOT treat function keywords as operators outside colon context', () => {
      // `contains:value` → FIELD("contains"), COLON, STRING("value")
      expect(tv('contains:value')).toEqual([
        [TokenType.FIELD, 'contains'],
        [TokenType.COLON, ':'],
        [TokenType.STRING, 'value'],
      ]);
    });
  });

  // ─── Logical operators ───────────────────────────────────────────────

  describe('logical operators', () => {
    it('should tokenize AND', () => {
      expect(tv('country:KR and level:error')).toEqual([
        [TokenType.FIELD, 'country'],
        [TokenType.COLON, ':'],
        [TokenType.STRING, 'KR'],
        [TokenType.AND, 'and'],
        [TokenType.FIELD, 'level'],
        [TokenType.COLON, ':'],
        [TokenType.STRING, 'error'],
      ]);
    });

    it('should tokenize OR', () => {
      expect(tv('country:KR or country:JP')).toEqual([
        [TokenType.FIELD, 'country'],
        [TokenType.COLON, ':'],
        [TokenType.STRING, 'KR'],
        [TokenType.OR, 'or'],
        [TokenType.FIELD, 'country'],
        [TokenType.COLON, ':'],
        [TokenType.STRING, 'JP'],
      ]);
    });

    it('should tokenize NOT', () => {
      expect(tv('not country:CN')).toEqual([
        [TokenType.NOT, 'not'],
        [TokenType.FIELD, 'country'],
        [TokenType.COLON, ':'],
        [TokenType.STRING, 'CN'],
      ]);
    });

    it('should tokenize BANG (! prefix)', () => {
      expect(tv('!country:CN')).toEqual([
        [TokenType.BANG, '!'],
        [TokenType.FIELD, 'country'],
        [TokenType.COLON, ':'],
        [TokenType.STRING, 'CN'],
      ]);
    });

    it('should be case-insensitive for keywords', () => {
      expect(types('AND')).toEqual([TokenType.AND]);
      expect(types('Or')).toEqual([TokenType.OR]);
      expect(types('NOT')).toEqual([TokenType.NOT]);
    });
  });

  // ─── Parentheses ─────────────────────────────────────────────────────

  describe('parentheses', () => {
    it('should tokenize grouped expression', () => {
      expect(tv('(country:KR or country:JP) and level:error')).toEqual([
        [TokenType.LPAREN, '('],
        [TokenType.FIELD, 'country'],
        [TokenType.COLON, ':'],
        [TokenType.STRING, 'KR'],
        [TokenType.OR, 'or'],
        [TokenType.FIELD, 'country'],
        [TokenType.COLON, ':'],
        [TokenType.STRING, 'JP'],
        [TokenType.RPAREN, ')'],
        [TokenType.AND, 'and'],
        [TokenType.FIELD, 'level'],
        [TokenType.COLON, ':'],
        [TokenType.STRING, 'error'],
      ]);
    });

    it('should tokenize !(expr)', () => {
      expect(tv('!(country:KR)')).toEqual([
        [TokenType.BANG, '!'],
        [TokenType.LPAREN, '('],
        [TokenType.FIELD, 'country'],
        [TokenType.COLON, ':'],
        [TokenType.STRING, 'KR'],
        [TokenType.RPAREN, ')'],
      ]);
    });
  });

  // ─── Token positions ────────────────────────────────────────────────

  describe('token positions', () => {
    it('should track correct start/end offsets', () => {
      const tokens = tokenize('country:KR');
      // "country" → 0..7, ":" → 7..8, "KR" → 8..10
      expect(tokens[0]).toMatchObject({ start: 0, end: 7 });
      expect(tokens[1]).toMatchObject({ start: 7, end: 8 });
      expect(tokens[2]).toMatchObject({ start: 8, end: 10 });
    });

    it('should track positions with spaces', () => {
      const tokens = tokenize('a:1 and b:2');
      // "a"→0..1, ":"→1..2, "1"→2..3, "and"→4..7, "b"→8..9, ":"→9..10, "2"→10..11
      const nonEof = tokens.filter((t) => t.type !== TokenType.EOF);
      expect(nonEof[0]).toMatchObject({ value: 'a', start: 0, end: 1 });
      expect(nonEof[3]).toMatchObject({ value: 'and', start: 4, end: 7 });
      expect(nonEof[4]).toMatchObject({ value: 'b', start: 8, end: 9 });
    });
  });

  // ─── Edge cases ──────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('should handle colon-after-space tolerance', () => {
      // `country: KR` should work same as `country:KR`
      expect(tv('country: KR')).toEqual([
        [TokenType.FIELD, 'country'],
        [TokenType.COLON, ':'],
        [TokenType.STRING, 'KR'],
      ]);
    });

    it('should handle incomplete quoted string', () => {
      const result = tv('message:"hello');
      expect(result).toEqual([
        [TokenType.FIELD, 'message'],
        [TokenType.COLON, ':'],
        [TokenType.STRING, 'hello'],
      ]);
    });

    it('should handle escape sequences in strings', () => {
      const result = tv('message:"say \\"hello\\""');
      expect(result[2]).toEqual([TokenType.STRING, 'say "hello"']);
    });

    it('should handle keyword as field when followed by colon', () => {
      expect(tv('and:value')).toEqual([
        [TokenType.FIELD, 'and'],
        [TokenType.COLON, ':'],
        [TokenType.STRING, 'value'],
      ]);
    });

    it('should handle or:value as field', () => {
      expect(tv('or:test')).toEqual([
        [TokenType.FIELD, 'or'],
        [TokenType.COLON, ':'],
        [TokenType.STRING, 'test'],
      ]);
    });

    it('should handle identifiers with dots', () => {
      expect(tv('event.type:click')).toEqual([
        [TokenType.FIELD, 'event.type'],
        [TokenType.COLON, ':'],
        [TokenType.STRING, 'click'],
      ]);
    });

    it('should handle identifiers with underscores', () => {
      expect(tv('logger_name:main')).toEqual([
        [TokenType.FIELD, 'logger_name'],
        [TokenType.COLON, ':'],
        [TokenType.STRING, 'main'],
      ]);
    });

    it('should handle relative time values', () => {
      expect(tv('timestamp:after("now-1h")')).toEqual([
        [TokenType.FIELD, 'timestamp'],
        [TokenType.COLON, ':'],
        [TokenType.AFTER, 'after'],
        [TokenType.LPAREN, '('],
        [TokenType.STRING, 'now-1h'],
        [TokenType.RPAREN, ')'],
      ]);
    });

    it('should handle free text (field without colon)', () => {
      expect(tv('timeout')).toEqual([[TokenType.FIELD, 'timeout']]);
    });

    it('should handle complex query', () => {
      const result = types(
        '(country:KR or country:JP) and level:!=error and !message:contains("test")'
      );
      expect(result).toEqual([
        TokenType.LPAREN,
        TokenType.FIELD,
        TokenType.COLON,
        TokenType.STRING,
        TokenType.OR,
        TokenType.FIELD,
        TokenType.COLON,
        TokenType.STRING,
        TokenType.RPAREN,
        TokenType.AND,
        TokenType.FIELD,
        TokenType.COLON,
        TokenType.NE,
        TokenType.STRING,
        TokenType.AND,
        TokenType.BANG,
        TokenType.FIELD,
        TokenType.COLON,
        TokenType.CONTAINS,
        TokenType.LPAREN,
        TokenType.STRING,
        TokenType.RPAREN,
      ]);
    });

    it('should handle consecutive operators without values (error input)', () => {
      // `country:KR and or` — should tokenize even though semantically wrong
      expect(tv('country:KR and or')).toEqual([
        [TokenType.FIELD, 'country'],
        [TokenType.COLON, ':'],
        [TokenType.STRING, 'KR'],
        [TokenType.AND, 'and'],
        [TokenType.OR, 'or'],
      ]);
    });

    it('should handle multiple spaces between tokens', () => {
      expect(tv('country:KR    and    level:error')).toEqual([
        [TokenType.FIELD, 'country'],
        [TokenType.COLON, ':'],
        [TokenType.STRING, 'KR'],
        [TokenType.AND, 'and'],
        [TokenType.FIELD, 'level'],
        [TokenType.COLON, ':'],
        [TokenType.STRING, 'error'],
      ]);
    });

    it('should handle Unicode / non-ASCII character words', () => {
      expect(tv('안녕하세요')).toEqual([[TokenType.FIELD, '안녕하세요']]);
      expect(tv('country:한국')).toEqual([
        [TokenType.FIELD, 'country'],
        [TokenType.COLON, ':'],
        [TokenType.STRING, '한국'],
      ]);
    });
  });
});
