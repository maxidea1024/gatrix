/**
 * Negated Operators — Unit Tests
 *
 * Verifies the full pipeline for:
 *   - != (is not)
 *   - !contains, !startsWith, !endsWith
 *   - has / !has
 *
 * Pipeline: lexer → queryToChips → chipsToQuery (roundtrip)
 *           parser → serializer (backend format)
 */
import { describe, it, expect } from 'vitest';
import { tokenize } from '../lexer';
import { TokenType } from '../types';
import { queryToChips, chipsToQuery } from '../useFilterChips';
import { parse } from '../parser';
import { serializeForBackend } from '../serializer';

// ─── Helper ──────────────────────────────────────────────────────────────────

/** Full roundtrip: query → chips → query */
function roundtrip(query: string): string {
  const chips = queryToChips(query);
  return chipsToQuery(chips);
}

/** Backend serialization: query → AST → backend string */
function serialize(query: string): string {
  const { ast } = parse(query);
  return serializeForBackend(ast);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Lexer: negated function operators tokenized correctly
// ═══════════════════════════════════════════════════════════════════════════════

describe('Lexer: negated function operators', () => {
  it('!contains → NOT_CONTAINS token', () => {
    const tokens = tokenize('message:!contains("test")');
    const funcToken = tokens.find((t) => t.type === TokenType.NOT_CONTAINS);
    expect(funcToken).toBeDefined();
    expect(funcToken!.value.toLowerCase()).toBe('!contains');
  });

  it('!startsWith → NOT_STARTS_WITH token', () => {
    const tokens = tokenize('message:!startsWith("err")');
    const funcToken = tokens.find((t) => t.type === TokenType.NOT_STARTS_WITH);
    expect(funcToken).toBeDefined();
  });

  it('!endsWith → NOT_ENDS_WITH token', () => {
    const tokens = tokenize('message:!endsWith("timeout")');
    const funcToken = tokens.find((t) => t.type === TokenType.NOT_ENDS_WITH);
    expect(funcToken).toBeDefined();
  });

  it('!= → NE token (after colon)', () => {
    const tokens = tokenize('level:!=error');
    const neToken = tokens.find((t) => t.type === TokenType.NE);
    expect(neToken).toBeDefined();
    expect(neToken!.value).toBe('!=');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. queryToChips: negated operators parsed into correct chip operators
// ═══════════════════════════════════════════════════════════════════════════════

describe('queryToChips: negated operators', () => {
  it('field:!=value → chip with operator "!="', () => {
    const chips = queryToChips('logger:!=LuaVM');
    expect(chips).toHaveLength(1);
    expect(chips[0].field).toBe('logger');
    expect(chips[0].operator).toBe('!=');
    expect(chips[0].value).toBe('LuaVM');
  });

  it('field:!contains("val") → chip with operator "!contains"', () => {
    const chips = queryToChips('message:!contains("timeout")');
    expect(chips).toHaveLength(1);
    expect(chips[0].field).toBe('message');
    expect(chips[0].operator).toBe('!contains');
    expect(chips[0].value).toBe('timeout');
  });

  it('field:!startsWith("val") → chip with operator "!startsWith"', () => {
    const chips = queryToChips('message:!startsWith("Error")');
    expect(chips).toHaveLength(1);
    expect(chips[0].field).toBe('message');
    expect(chips[0].operator).toBe('!startsWith');
    expect(chips[0].value).toBe('Error');
  });

  it('field:!endsWith("val") → chip with operator "!endsWith"', () => {
    const chips = queryToChips('message:!endsWith("fail")');
    expect(chips).toHaveLength(1);
    expect(chips[0].field).toBe('message');
    expect(chips[0].operator).toBe('!endsWith');
    expect(chips[0].value).toBe('fail');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. chipsToQuery: negated operators serialized to correct DSL format
// ═══════════════════════════════════════════════════════════════════════════════

describe('chipsToQuery: negated operators', () => {
  it('!= chip → field:!=value', () => {
    expect(roundtrip('logger:!=LuaVM')).toBe('logger:!=LuaVM');
  });

  it('!contains chip → field:!contains("value")', () => {
    expect(roundtrip('message:!contains("timeout")')).toBe(
      'message:!contains("timeout")'
    );
  });

  it('!startsWith chip → field:!startsWith("value")', () => {
    expect(roundtrip('message:!startsWith("Error")')).toBe(
      'message:!startsWith("Error")'
    );
  });

  it('!endsWith chip → field:!endsWith("value")', () => {
    expect(roundtrip('message:!endsWith("fail")')).toBe(
      'message:!endsWith("fail")'
    );
  });

  it('non-negated function operators still work', () => {
    expect(roundtrip('message:contains("test")')).toBe(
      'message:contains("test")'
    );
    expect(roundtrip('message:startsWith("net")')).toBe(
      'message:startsWith("net")'
    );
    expect(roundtrip('message:endsWith("err")')).toBe(
      'message:endsWith("err")'
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. has / !has roundtrip
// ═══════════════════════════════════════════════════════════════════════════════

describe('has / !has roundtrip', () => {
  it('has:field → roundtrip', () => {
    const chips = queryToChips('has:logger');
    expect(chips).toHaveLength(1);
    expect(chips[0].field).toBe('has');
    expect(chips[0].value).toBe('logger');
    expect(roundtrip('has:logger')).toBe('has:logger');
  });

  it('!has:field → roundtrip', () => {
    const chips = queryToChips('!has:logger');
    expect(chips).toHaveLength(1);
    expect(chips[0].field).toBe('!has');
    expect(chips[0].value).toBe('logger');
    expect(roundtrip('!has:logger')).toBe('!has:logger');
  });

  it('has:field AND filter → roundtrip', () => {
    const result = roundtrip('has:logger level:error');
    expect(result).toBe('has:logger level:error');
  });

  it('!has:field AND filter → roundtrip', () => {
    const result = roundtrip('!has:logger level:error');
    expect(result).toBe('!has:logger level:error');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. Backend serializer: negated function operators
// ═══════════════════════════════════════════════════════════════════════════════

describe('Backend serializer: negated function operators', () => {
  it('!contains → .not_contains:', () => {
    expect(serialize('message:!contains("timeout")')).toBe(
      'message.not_contains:"timeout"'
    );
  });

  it('!startsWith → .not_starts_with:', () => {
    expect(serialize('message:!startsWith("Error")')).toBe(
      'message.not_starts_with:"Error"'
    );
  });

  it('!endsWith → .not_ends_with:', () => {
    expect(serialize('message:!endsWith("fail")')).toBe(
      'message.not_ends_with:"fail"'
    );
  });

  it('positive operators still serialize correctly', () => {
    expect(serialize('message:contains("test")')).toBe(
      'message.contains:"test"'
    );
    expect(serialize('message:startsWith("net")')).toBe(
      'message.starts_with:"net"'
    );
    expect(serialize('message:endsWith("err")')).toBe(
      'message.ends_with:"err"'
    );
  });

  it('!= still serializes correctly', () => {
    expect(serialize('level:!=error')).toBe('level:!=error');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. Complex queries with negated operators
// ═══════════════════════════════════════════════════════════════════════════════

describe('Complex queries with negated operators', () => {
  it('negated contains AND positive filter → roundtrip', () => {
    const result = roundtrip('message:!contains("timeout") AND level:error');
    expect(result).toBe('message:!contains("timeout") AND level:error');
  });

  it('multiple negated operators → roundtrip', () => {
    const result = roundtrip('message:!contains("timeout") AND logger:!=LuaVM');
    expect(result).toBe('message:!contains("timeout") AND logger:!=LuaVM');
  });

  it('negated with has → roundtrip', () => {
    const result = roundtrip('!has:logger AND message:!contains("timeout")');
    expect(result).toBe('!has:logger AND message:!contains("timeout")');
  });
});
