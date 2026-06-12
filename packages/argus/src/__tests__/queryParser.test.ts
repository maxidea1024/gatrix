/**
 * QueryParser — Negated Operators Unit Tests
 *
 * Tests the full pipeline:
 *   1. parse() — tokenize + AST construction
 *   2. generateSQL() — AST → parameterised ClickHouse SQL
 *
 * Coverage:
 *   - key:!=value           (colon + != comparison)
 *   - key:>value, key:>=    (colon + comparison operators)
 *   - .not_contains:        (compound negated text operator)
 *   - .not_starts_with:     (compound negated text operator)
 *   - .not_ends_with:       (compound negated text operator)
 *   - .contains:, .starts_with:, .ends_with: (positive compound ops — regression)
 *   - has:field, !has:field  (existence operators)
 *   - !key:value            (prefix negation)
 *   - Complex combinations
 */
import { QueryParser } from '../utils/queryParser';
import { TableSchema } from '../utils/tableSchemas';

// ─── Test Fixtures ───────────────────────────────────────────────────────────

const ALLOWED_COLUMNS = new Set([
  'log_id',
  'trace_id',
  'span_id',
  'issue_id',
  'timestamp',
  'level',
  'logger_name',
  'message',
  'body',
  'service',
  'environment',
  'release',
]);

const COLUMN_ALIASES: Record<string, string> = {
  severity: 'level',
  logger: 'logger_name',
};

function createParser() {
  return new QueryParser(ALLOWED_COLUMNS, new Set(), COLUMN_ALIASES);
}

/** Parse and generate SQL, returning { where, having, params } */
function parseSql(query: string) {
  const parser = createParser();
  const ast = parser.parse(query);
  const params: Record<string, string> = {};
  const result = parser.generateSQL(ast, params);
  return { ...result, params, ast };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Colon + Comparison Operators (key:!=value, key:>value)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Colon + comparison operators', () => {
  test('key:!=value → column != param', () => {
    const { where, params } = parseSql('logger_name:!=UE4Core');
    expect(where).toContain('logger_name !=');
    // Verify param has the value
    const paramKey = Object.keys(params).find((k) => params[k] === 'UE4Core');
    expect(paramKey).toBeDefined();
  });

  test('key:!=value with alias → resolved column != param', () => {
    const { where, params } = parseSql('logger:!=LuaVM');
    expect(where).toContain('logger_name !=');
    const paramKey = Object.keys(params).find((k) => params[k] === 'LuaVM');
    expect(paramKey).toBeDefined();
  });

  test('key:!=quoted_value → column != param', () => {
    const { where, params } = parseSql('service:!="my service"');
    expect(where).toContain('service !=');
    const paramKey = Object.keys(params).find(
      (k) => params[k] === 'my service'
    );
    expect(paramKey).toBeDefined();
  });

  test('key:>value → column > param (numeric)', () => {
    const { where } = parseSql('level:>100');
    expect(where).toContain('level >');
  });

  test('key:>=value → column >= param', () => {
    const { where } = parseSql('level:>=50');
    expect(where).toContain('level >=');
  });

  test('key:<value → column < param', () => {
    const { where } = parseSql('level:<10');
    expect(where).toContain('level <');
  });

  test('key:<=value → column <= param', () => {
    const { where } = parseSql('level:<=25');
    expect(where).toContain('level <=');
  });

  test('key:=value (positive) still works', () => {
    const { where, params } = parseSql('logger_name:UE4Core');
    expect(where).toContain('logger_name =');
    const paramKey = Object.keys(params).find((k) => params[k] === 'UE4Core');
    expect(paramKey).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Compound text-matching operators (positive)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Compound text operators (positive)', () => {
  test('.contains: → ILIKE %value%', () => {
    const { where, params } = parseSql('message.contains:timeout');
    expect(where).toContain('ILIKE');
    expect(where).not.toContain('NOT ILIKE');
    const paramKey = Object.keys(params).find((k) => params[k] === '%timeout%');
    expect(paramKey).toBeDefined();
  });

  test('.starts_with: → ILIKE value%', () => {
    const { where, params } = parseSql('message.starts_with:Error');
    expect(where).toContain('ILIKE');
    expect(where).not.toContain('NOT ILIKE');
    const paramKey = Object.keys(params).find((k) => params[k] === 'Error%');
    expect(paramKey).toBeDefined();
  });

  test('.ends_with: → ILIKE %value', () => {
    const { where, params } = parseSql('message.ends_with:failed');
    expect(where).toContain('ILIKE');
    expect(where).not.toContain('NOT ILIKE');
    const paramKey = Object.keys(params).find((k) => params[k] === '%failed');
    expect(paramKey).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Compound text-matching operators (negated)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Compound text operators (negated)', () => {
  test('.not_contains: → NOT ILIKE %value%', () => {
    const { where, params } = parseSql('message.not_contains:timeout');
    expect(where).toContain('NOT ILIKE');
    const paramKey = Object.keys(params).find((k) => params[k] === '%timeout%');
    expect(paramKey).toBeDefined();
  });

  test('.not_starts_with: → NOT ILIKE value%', () => {
    const { where, params } = parseSql('message.not_starts_with:Error');
    expect(where).toContain('NOT ILIKE');
    const paramKey = Object.keys(params).find((k) => params[k] === 'Error%');
    expect(paramKey).toBeDefined();
  });

  test('.not_ends_with: → NOT ILIKE %value', () => {
    const { where, params } = parseSql('message.not_ends_with:failed');
    expect(where).toContain('NOT ILIKE');
    const paramKey = Object.keys(params).find((k) => params[k] === '%failed');
    expect(paramKey).toBeDefined();
  });

  test('.not_contains: with quoted value', () => {
    const { where, params } = parseSql(
      'message.not_contains:"connection reset"'
    );
    expect(where).toContain('NOT ILIKE');
    const paramKey = Object.keys(params).find(
      (k) => params[k] === '%connection reset%'
    );
    expect(paramKey).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. has / !has operators
// ═══════════════════════════════════════════════════════════════════════════════

describe('has / !has operators', () => {
  test('has:field → field != "" AND field IS NOT NULL', () => {
    const { where } = parseSql('has:environment');
    expect(where).toContain("environment != ''");
    expect(where).toContain('IS NOT NULL');
  });

  test('has:aliased_field → resolved field', () => {
    const { where } = parseSql('has:severity');
    expect(where).toContain("level != ''");
    expect(where).toContain('IS NOT NULL');
  });

  test('!has:field → NOT(field != "" AND ...)', () => {
    const { where } = parseSql('!has:environment');
    expect(where).toContain('NOT');
    expect(where).toContain("environment != ''");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. Prefix negation (!)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Prefix negation', () => {
  test('!key:value → NOT(column = param)', () => {
    const { where, params } = parseSql('!level:error');
    expect(where).toContain('NOT');
    expect(where).toContain('level =');
    const paramKey = Object.keys(params).find((k) => params[k] === 'error');
    expect(paramKey).toBeDefined();
  });

  test('!key:value with alias', () => {
    const { where } = parseSql('!severity:error');
    expect(where).toContain('NOT');
    expect(where).toContain('level =');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. Complex combinations
// ═══════════════════════════════════════════════════════════════════════════════

describe('Complex queries with negated operators', () => {
  test('positive AND negated equality', () => {
    const { where, params } = parseSql('level:error AND logger_name:!=UE4Core');
    expect(where).toContain('level =');
    expect(where).toContain('logger_name !=');
    expect(where).toContain('AND');
    expect(Object.values(params)).toContain('error');
    expect(Object.values(params)).toContain('UE4Core');
  });

  test('negated contains AND positive filter', () => {
    const { where } = parseSql('message.not_contains:timeout AND level:error');
    expect(where).toContain('NOT ILIKE');
    expect(where).toContain('AND');
    expect(where).toContain('level =');
  });

  test('multiple negated operators', () => {
    const { where, params } = parseSql(
      'logger_name:!=UE4Core AND message.not_contains:timeout'
    );
    expect(where).toContain('logger_name !=');
    expect(where).toContain('NOT ILIKE');
    expect(where).toContain('AND');
    expect(Object.values(params)).toContain('UE4Core');
  });

  test('!has combined with negated equality', () => {
    const { where } = parseSql('!has:environment AND service:!=api');
    expect(where).toContain('NOT');
    expect(where).toContain('service !=');
  });

  test('negated with OR', () => {
    const { where } = parseSql('logger_name:!=UE4Core OR logger_name:!=LuaVM');
    expect(where).toContain('OR');
    expect(where).toContain('logger_name !=');
  });

  test('parenthesized negated expression', () => {
    const { where } = parseSql(
      '(level:error OR level:warning) AND service:!=test'
    );
    expect(where).toContain('OR');
    expect(where).toContain('AND');
    expect(where).toContain('service !=');
  });

  test('implicit AND with negated operator', () => {
    const { where } = parseSql('level:error logger_name:!=UE4Core');
    expect(where).toContain('level =');
    expect(where).toContain('logger_name !=');
    expect(where).toContain('AND');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. AST structure verification
// ═══════════════════════════════════════════════════════════════════════════════

describe('AST structure for negated operators', () => {
  test('key:!=value produces CONDITION with != op', () => {
    const parser = createParser();
    const ast = parser.parse('logger_name:!=UE4Core');
    expect(ast).not.toBeNull();
    expect(ast!.type).toBe('CONDITION');
    if (ast!.type === 'CONDITION') {
      expect(ast!.key).toBe('logger_name');
      expect(ast!.op).toBe('!=');
      expect(ast!.value).toBe('UE4Core');
    }
  });

  test('key:>value produces CONDITION with > op', () => {
    const parser = createParser();
    const ast = parser.parse('level:>100');
    expect(ast).not.toBeNull();
    expect(ast!.type).toBe('CONDITION');
    if (ast!.type === 'CONDITION') {
      expect(ast!.key).toBe('level');
      expect(ast!.op).toBe('>');
      expect(ast!.value).toBe('100');
    }
  });

  test('.not_contains produces CONDITION with NOT_CONTAINS op', () => {
    const parser = createParser();
    const ast = parser.parse('message.not_contains:timeout');
    expect(ast).not.toBeNull();
    expect(ast!.type).toBe('CONDITION');
    if (ast!.type === 'CONDITION') {
      expect(ast!.key).toBe('message');
      expect(ast!.op).toBe('NOT_CONTAINS');
      expect(ast!.value).toBe('timeout');
    }
  });

  test('.not_starts_with produces CONDITION with NOT_STARTS_WITH op', () => {
    const parser = createParser();
    const ast = parser.parse('message.not_starts_with:Error');
    expect(ast).not.toBeNull();
    expect(ast!.type).toBe('CONDITION');
    if (ast!.type === 'CONDITION') {
      expect(ast!.key).toBe('message');
      expect(ast!.op).toBe('NOT_STARTS_WITH');
    }
  });

  test('.not_ends_with produces CONDITION with NOT_ENDS_WITH op', () => {
    const parser = createParser();
    const ast = parser.parse('message.not_ends_with:fail');
    expect(ast).not.toBeNull();
    expect(ast!.type).toBe('CONDITION');
    if (ast!.type === 'CONDITION') {
      expect(ast!.key).toBe('message');
      expect(ast!.op).toBe('NOT_ENDS_WITH');
    }
  });

  test('!key:value produces NOT wrapping CONDITION', () => {
    const parser = createParser();
    const ast = parser.parse('!level:error');
    expect(ast).not.toBeNull();
    expect(ast!.type).toBe('NOT');
    if (ast!.type === 'NOT') {
      expect(ast!.expr.type).toBe('CONDITION');
      if (ast!.expr.type === 'CONDITION') {
        expect(ast!.expr.key).toBe('level');
        expect(ast!.expr.op).toBe('=');
        expect(ast!.expr.value).toBe('error');
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. Edge cases
// ═══════════════════════════════════════════════════════════════════════════════

describe('Edge cases', () => {
  test('empty input returns null AST and empty SQL', () => {
    const { where, having, ast } = parseSql('');
    expect(ast).toBeNull();
    expect(where).toBe('');
    expect(having).toBe('');
  });

  test('key:value with unknown column is silently ignored', () => {
    const { where } = parseSql('unknown_column:!=value');
    // Unknown column → 1=1 → cleaned to empty
    expect(where).not.toContain('unknown_column');
  });

  test('raw text search still works', () => {
    const { where } = parseSql('timeout');
    expect(where).toContain('ILIKE');
    expect(where).toContain('message');
  });

  test('wildcard with != still works', () => {
    const { where } = parseSql('message:!=*timeout*');
    expect(where).toContain('NOT ILIKE');
  });

  test('key:=value (explicit equals) works same as key:value', () => {
    const r1 = parseSql('level:error');
    const r2 = parseSql('level=error');
    // Both should produce level = {param}
    expect(r1.where).toContain('level =');
    expect(r2.where).toContain('level =');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 9. List value (IN / NOT IN) operators
// ═══════════════════════════════════════════════════════════════════════════════

describe('List value (IN / NOT IN) SQL generation', () => {
  test('key:[val1, val2] → column IN (param1, param2)', () => {
    const { where, params } = parseSql('logger_name:[UE4Core, LuaVM]');
    expect(where).toContain('logger_name IN (');
    expect(Object.values(params)).toContain('UE4Core');
    expect(Object.values(params)).toContain('LuaVM');
  });

  test('!key:[val1, val2] → NOT(column IN (param1, param2))', () => {
    const { where } = parseSql('!logger_name:[UE4Core, LuaVM]');
    expect(where).toContain('NOT (logger_name IN (');
  });

  test('key:!= [val1, val2] → column NOT IN (param1, param2)', () => {
    const { where } = parseSql('logger_name:!=[UE4Core, LuaVM]');
    expect(where).toContain('logger_name NOT IN (');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 10. Map column fallback (schema-based)
// ═══════════════════════════════════════════════════════════════════════════════



const MAP_SCHEMA: TableSchema = {
  columns: {
    level: 'string',
    message: 'string',
    service: 'string',
    timestamp: 'number',
  },
  mapColumns: [{ name: 'tags', valueType: 'String' }],
  aliases: { severity: 'level' },
};

function createMapParser() {
  return new QueryParser(MAP_SCHEMA);
}

function parseMapSql(query: string) {
  const parser = createMapParser();
  const ast = parser.parse(query);
  const params: Record<string, string> = {};
  const result = parser.generateSQL(ast, params);
  return { ...result, params, ast };
}

describe('Map column fallback — basic operations', () => {
  test('known key → top-level column SQL (no map fallback)', () => {
    const { where } = parseMapSql('level:error');
    expect(where).toContain('level =');
    expect(where).not.toContain('mapContains');
    expect(where).not.toContain('tags[');
  });

  test('unknown key + map config → mapContains + tags[key] = value', () => {
    const { where, params } = parseMapSql('build:10234');
    expect(where).toContain('mapContains(tags,');
    expect(where).toContain('tags[');
    expect(where).toContain('=');
    expect(Object.values(params)).toContain('build');
    expect(Object.values(params)).toContain('10234');
  });

  test('unknown key + no map config → 1=1 (backward compat)', () => {
    // Use legacy constructor without map columns
    const parser = new QueryParser(
      new Set(['level', 'message']),
      new Set()
    );
    const ast = parser.parse('build:10234');
    const params: Record<string, string> = {};
    const { where } = parser.generateSQL(ast, params);
    // Unknown column should be silently ignored → empty or no filter
    expect(where).not.toContain('build');
    expect(where).not.toContain('mapContains');
  });
});

describe('Map column fallback — operators', () => {
  test('map key: != (inequality)', () => {
    const { where } = parseMapSql('build:!=10234');
    expect(where).toContain('mapContains(tags,');
    expect(where).toContain('!=');
  });

  test('map key: *wildcard* (ILIKE)', () => {
    const { where, params } = parseMapSql('build:*beta*');
    expect(where).toContain('mapContains(tags,');
    expect(where).toContain('ILIKE');
    // Value should be converted: *beta* → %beta%
    expect(Object.values(params)).toContain('%beta%');
  });

  test('map key: != *wildcard* (NOT ILIKE)', () => {
    const { where } = parseMapSql('build:!=*beta*');
    expect(where).toContain('NOT ILIKE');
  });

  test('map key: [list, values] (IN)', () => {
    const { where, params } = parseMapSql('build:[v1, v2, v3]');
    expect(where).toContain('mapContains(tags,');
    expect(where).toContain('IN (');
    expect(Object.values(params)).toContain('v1');
    expect(Object.values(params)).toContain('v2');
    expect(Object.values(params)).toContain('v3');
  });

  test('map key: != [list] (NOT IN)', () => {
    const { where } = parseMapSql('build:!=[v1, v2]');
    expect(where).toContain('NOT IN');
  });

  test('map key: .contains (compound)', () => {
    const { where, params } = parseMapSql('build.contains:beta');
    expect(where).toContain('mapContains(tags,');
    expect(where).toContain('ILIKE');
    expect(Object.values(params)).toContain('%beta%');
  });

  test('map key: .not_contains (compound negated)', () => {
    const { where, params } = parseMapSql('build.not_contains:beta');
    expect(where).toContain('NOT ILIKE');
    expect(Object.values(params)).toContain('%beta%');
  });

  test('map key: .starts_with', () => {
    const { where, params } = parseMapSql('build.starts_with:v3');
    expect(where).toContain('ILIKE');
    expect(Object.values(params)).toContain('v3%');
  });

  test('map key: .ends_with', () => {
    const { where, params } = parseMapSql('build.ends_with:rc1');
    expect(where).toContain('ILIKE');
    expect(Object.values(params)).toContain('%rc1');
  });

  test('map key: .not_starts_with', () => {
    const { where } = parseMapSql('build.not_starts_with:dev');
    expect(where).toContain('NOT ILIKE');
  });

  test('map key: .not_ends_with', () => {
    const { where } = parseMapSql('build.not_ends_with:snapshot');
    expect(where).toContain('NOT ILIKE');
  });

  test('map key: > (greater than)', () => {
    const { where } = parseMapSql('version:>100');
    expect(where).toContain('mapContains(tags,');
    expect(where).toContain('>');
  });
});

describe('Map column fallback — has: keyword', () => {
  test('has:known_column → column != ""', () => {
    const { where } = parseMapSql('has:level');
    expect(where).toContain("level != ''");
    expect(where).toContain('IS NOT NULL');
    expect(where).not.toContain('mapContains');
  });

  test('has:unknown_key + map → mapContains(tags, key)', () => {
    const { where, params } = parseMapSql('has:build');
    expect(where).toContain('mapContains(tags,');
    expect(Object.values(params)).toContain('build');
    expect(where).not.toContain("!= ''");
  });

  test('!has:unknown_key + map → NOT mapContains(tags, key)', () => {
    const { where } = parseMapSql('!has:build');
    expect(where).toContain('NOT');
    expect(where).toContain('mapContains(tags,');
  });

  test('has:aliased_key resolves alias then checks top-level', () => {
    const { where } = parseMapSql('has:severity');
    // 'severity' alias → 'level' which IS a top-level column
    expect(where).toContain("level != ''");
    expect(where).not.toContain('mapContains');
  });
});

describe('Map column fallback — negation', () => {
  test('!map_key:value → NOT(mapContains AND tags[key] = val)', () => {
    const { where } = parseMapSql('!build:10234');
    expect(where).toContain('NOT');
    expect(where).toContain('mapContains(tags,');
  });
});

describe('Map column fallback — combinations', () => {
  test('top-level AND map key combined', () => {
    const { where, params } = parseMapSql('level:error AND build:10234');
    expect(where).toContain('level =');
    expect(where).toContain('mapContains(tags,');
    expect(where).toContain('AND');
    expect(Object.values(params)).toContain('error');
    expect(Object.values(params)).toContain('10234');
  });

  test('map key OR map key', () => {
    const { where } = parseMapSql('build:v1 OR build:v2');
    expect(where).toContain('OR');
    // Should have two mapContains checks
    const matches = where.match(/mapContains/g) || [];
    expect(matches.length).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 11. Map(String, Float64) support
// ═══════════════════════════════════════════════════════════════════════════════

describe('Map(String, Float64) support', () => {
  const FLOAT_SCHEMA: TableSchema = {
    columns: { transaction: 'string' },
    mapColumns: [{ name: 'measurements', valueType: 'Float64' }],
  };

  function parseFloatSql(query: string) {
    const parser = new QueryParser(FLOAT_SCHEMA);
    const ast = parser.parse(query);
    const params: Record<string, string> = {};
    const result = parser.generateSQL(ast, params);
    return { ...result, params };
  }

  test('numeric comparison → Float64 param type', () => {
    const { where } = parseFloatSql('lcp:>2500');
    expect(where).toContain('mapContains(measurements,');
    expect(where).toContain(':Float64}');
  });

  test('string equality → String param type', () => {
    const { where } = parseFloatSql('lcp:slow');
    expect(where).toContain('mapContains(measurements,');
    expect(where).toContain(':String}');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 12. Legacy constructor backward compatibility
// ═══════════════════════════════════════════════════════════════════════════════

describe('Legacy constructor compatibility', () => {
  test('Set<string> constructor still works without map support', () => {
    const parser = new QueryParser(
      new Set(['level', 'message']),
      new Set(),
      { severity: 'level' }
    );
    const ast = parser.parse('severity:error');
    const params: Record<string, string> = {};
    const { where } = parser.generateSQL(ast, params);
    expect(where).toContain('level =');
    expect(Object.values(params)).toContain('error');
  });

  test('unknown column with legacy constructor → silently ignored', () => {
    const parser = new QueryParser(new Set(['level']), new Set());
    const ast = parser.parse('unknown:value');
    const params: Record<string, string> = {};
    const { where } = parser.generateSQL(ast, params);
    expect(where).not.toContain('unknown');
  });
});
